
// 8bitworkshop VS Code extension entry point.
// Builds and emulation run in worker threads (buildworker, emuworker): both
// replace globals like fetch and window, which the shared extension host
// must not see. This module stays light.

import * as vscode from 'vscode';
import * as path from 'path';
import type { BuildOutcome } from './buildcore';
import type { BuildArgs } from './buildworker';
import type { EmuStatus } from './emuworker';
import { WorkerHandle } from './engine';
import { EmulatorPanel } from './emulatorpanel';
import { findRootDir, isSourceFile } from './projectinfo';

const CONFIG = '8bitworkshop';

let output: vscode.OutputChannel;
let diagnostics: vscode.DiagnosticCollection;
let status: vscode.StatusBarItem;
let builds: WorkerHandle | undefined;
let emu: WorkerHandle | undefined;
let panel: EmulatorPanel | undefined;
let emuStatus: EmuStatus | null = null;
let pausedByHide = false;
let lastMain: vscode.Uri | undefined;
let lastPaths = new Set<string>();   // fsPaths the last build read
let lastBuild: BuildOutcome | undefined;
let pending: NodeJS.Timeout | undefined;
let nextBuildId = 1;
const readers = new Map<number, (rel: string) => Promise<Uint8Array | null>>();

export function activate(context: vscode.ExtensionContext) {
  output = vscode.window.createOutputChannel('8bitworkshop');
  diagnostics = vscode.languages.createDiagnosticCollection('8bitworkshop');
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  status.command = '8bitworkshop.selectPlatform';
  context.subscriptions.push(output, diagnostics, status);
  updateStatus();

  const command = (id: string, fn: () => any) =>
    context.subscriptions.push(vscode.commands.registerCommand('8bitworkshop.' + id, fn));
  command('build', () => buildCommand(context));
  command('run', () => runCommand(context));
  command('reset', () => emu?.started && emu.call('reset'));
  command('pause', () => emu?.started && emu.call('pause'));
  command('resume', () => emu?.started && emu.call('resume'));
  command('stop', () => panel?.dispose());
  command('selectPlatform', () => selectPlatform(context));

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => onSave(context, doc)),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(CONFIG)) updateStatus();
    }),
    { dispose: () => { builds?.dispose(); emu?.dispose(); } },
  );
}

export function deactivate() {
  if (pending) clearTimeout(pending);
}

function config() {
  return vscode.workspace.getConfiguration(CONFIG);
}

function updateStatus() {
  var platform = config().get<string>('platform');
  status.text = '$(chip) ' + (platform || 'No platform');
  status.tooltip = 'Select 8bitworkshop platform';
  status.show();
}

function rootDir(context: vscode.ExtensionContext): string {
  var root = config().get<string>('toolchainPath') || findRootDir(context.extensionPath);
  if (!root) throw new Error('Cannot find toolchain assets (src/worker). Set 8bitworkshop.toolchainPath.');
  return root;
}

function getBuilds(context: vscode.ExtensionContext): WorkerHandle {
  if (!builds) {
    var root = rootDir(context);
    output.appendLine(`Toolchain root: ${root}`);
    builds = new WorkerHandle('buildworker.js', root, {
      readFile: (buildId: number, rel: string) => readers.get(buildId)?.(rel) ?? null,
    }, msg => output.appendLine(msg));
  }
  return builds;
}

function getEmu(context: vscode.ExtensionContext): WorkerHandle {
  if (!emu) {
    emu = new WorkerHandle('emuworker.js', rootDir(context), {}, msg => output.appendLine(msg));
    emu.on('frame', frame => panel?.showFrame(frame));
    emu.on('status', (s: EmuStatus | null) => {
      emuStatus = s;
      panel?.showStatus(s);
      vscode.commands.executeCommand('setContext', '8bitworkshop.emuRunning', s?.state === 'running');
      if (s?.state === 'halted') output.appendLine(`Emulator halted at frame ${s.frame}: ${s.message}`);
    });
  }
  return emu;
}

async function selectPlatform(context: vscode.ExtensionContext): Promise<string | undefined> {
  var platforms = await getBuilds(context).call<string[]>('listPlatforms');
  var picked = await vscode.window.showQuickPick(platforms, { placeHolder: 'Target platform' });
  if (!picked) return undefined;
  var target = vscode.workspace.workspaceFolders ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
  await config().update('platform', picked, target);
  return picked;
}

async function buildCommand(context: vscode.ExtensionContext) {
  var platform = config().get<string>('platform') || await selectPlatform(context);
  if (!platform) return;
  var main = findMainFile();
  if (!main) {
    vscode.window.showWarningMessage('8bitworkshop: open a source file or set 8bitworkshop.mainFile.');
    return;
  }
  var result = await runBuild(context, platform, main);
  if (result && !result.success) output.show(true);
}

/** Build, then start the emulator on the output. */
async function runCommand(context: vscode.ExtensionContext) {
  var platform = config().get<string>('platform') || await selectPlatform(context);
  if (!platform) return;
  var main = findMainFile();
  if (!main) {
    vscode.window.showWarningMessage('8bitworkshop: open a source file or set 8bitworkshop.mainFile.');
    return;
  }
  var result = await runBuild(context, platform, main);
  if (!result) return;
  if (!result.success || !lastBuild?.output) {
    output.show(true);
    vscode.window.showErrorMessage('8bitworkshop: build failed; see Problems.');
    return;
  }
  await startEmulator(context, platform, lastBuild.output, path.posix.basename(main.path));
}

async function startEmulator(context: vscode.ExtensionContext, platform: string, rom: any, title: string) {
  var worker = getEmu(context);
  if (!panel) {
    panel = new EmulatorPanel({
      onKey: (key, code, flags) => { worker.call('key', key, code, flags); },
      onVisible: visible => {
        // don't burn CPU on a hidden screen
        if (!visible && emuStatus?.state === 'running') {
          pausedByHide = true;
          worker.call('pause');
        } else if (visible && pausedByHide) {
          pausedByHide = false;
          worker.call('resume');
        }
      },
      onDispose: () => {
        panel = undefined;
        emuStatus = null;
        worker.call('stop');
        vscode.commands.executeCommand('setContext', '8bitworkshop.emuRunning', false);
      },
    });
  } else {
    panel.reveal();
  }
  panel.setTitle(`${title} (${platform})`);
  try {
    emuStatus = await worker.call<EmuStatus>('start', platform, rom);
    output.appendLine(`Running ${title} on ${platform}`);
  } catch (e) {
    output.appendLine(`Emulator failed to start: ${e && e.stack || e}`);
    output.show(true);
  }
}

/** After a rebuild, reload the running emulator with the new ROM. */
async function reloadEmulator(context: vscode.ExtensionContext, platform: string, main: vscode.Uri) {
  if (!panel || !emuStatus || !lastBuild?.output) return;
  if (emuStatus.platform !== platform) {
    await startEmulator(context, platform, lastBuild.output, path.posix.basename(main.path));
  } else {
    emuStatus = await getEmu(context).call<EmuStatus>('loadROM', lastBuild.output);
  }
}

function onSave(context: vscode.ExtensionContext, doc: vscode.TextDocument) {
  var platform = config().get<string>('platform');
  if (!platform || !config().get<boolean>('buildOnSave')) return;
  if (doc.uri.scheme === 'untitled') return;
  var isDep = lastPaths.has(doc.uri.fsPath);
  if (!isDep && !isSourceFile(doc.fileName)) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(async () => {
    pending = undefined;
    // a saved dependency rebuilds the last main file
    var main = (isDep && lastMain) || findMainFile();
    if (!main) return;
    var result = await runBuild(context, platform!, main);
    if (result?.success && !result.unchanged) await reloadEmulator(context, platform!, main);
  }, 300);
}

/** The setting, else the active editor's file, else the last main file. */
function findMainFile(): vscode.Uri | undefined {
  var setting = config().get<string>('mainFile');
  var folder = vscode.workspace.workspaceFolders?.[0];
  if (setting) {
    return path.isAbsolute(setting) || !folder ? vscode.Uri.file(setting) : vscode.Uri.joinPath(folder.uri, setting);
  }
  var editor = vscode.window.activeTextEditor;
  if (editor && isSourceFile(editor.document.fileName)) {
    return editor.document.uri;
  }
  return lastMain;
}

async function runBuild(context: vscode.ExtensionContext, platform: string, main: vscode.Uri) {
  // paths are relative to the main file's directory, like the IDE's project root
  var rootUri = vscode.Uri.joinPath(main, '..');
  var toUri = (rel: string) => vscode.Uri.joinPath(rootUri, rel);
  var read = async (rel: string): Promise<Uint8Array | null> => {
    var uri = toUri(rel);
    // unsaved editor contents win over disk
    var doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
    if (doc) return new TextEncoder().encode(doc.getText());
    try {
      return await vscode.workspace.fs.readFile(uri);
    } catch (e) {
      return null;
    }
  };
  var mainPath = path.posix.basename(main.path);
  var mainData = await read(mainPath);
  if (mainData == null) {
    vscode.window.showErrorMessage(`8bitworkshop: cannot read ${main.fsPath}`);
    return;
  }
  var t0 = Date.now();
  status.text = '$(sync~spin) ' + platform;
  var buildId = nextBuildId++;
  readers.set(buildId, read);
  var args: BuildArgs = {
    buildId,
    platform,
    mainPath,
    mainText: new TextDecoder().decode(mainData),
    tool: config().get<string>('tool') || undefined,
  };
  var result: BuildOutcome;
  try {
    result = await getBuilds(context).call<BuildOutcome>('build', args);
  } catch (e) {
    output.appendLine(`Build crashed: ${e && e.stack || e}`);
    output.show(true);
    return;
  } finally {
    readers.delete(buildId);
    updateStatus();
  }
  lastMain = main;
  lastPaths = new Set(result.paths.map(p => toUri(p).fsPath));
  if (result.unchanged) return result;
  lastBuild = result;
  showDiagnostics(result, toUri);
  var elapsed = Date.now() - t0;
  if (result.success) {
    var size = result.output?.length ?? 0;
    output.appendLine(`${mainPath}: built with ${result.tool} for ${platform}, ${size} bytes (${elapsed} ms)`);
  } else {
    output.appendLine(`${mainPath}: ${result.diagnostics.length} error(s) from ${result.tool} (${elapsed} ms)`);
    for (var d of result.diagnostics) output.appendLine(`  ${d.path}:${d.line}: ${d.msg}`);
  }
  return result;
}

function showDiagnostics(result: BuildOutcome, toUri: (rel: string) => vscode.Uri) {
  diagnostics.clear();
  var byFile = new Map<string, { uri: vscode.Uri, diags: vscode.Diagnostic[] }>();
  for (var d of result.diagnostics) {
    var uri = toUri(d.path);
    var key = uri.toString();
    if (!byFile.has(key)) byFile.set(key, { uri, diags: [] });
    var line = Math.max(0, d.line - 1);
    var range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
    var diag = new vscode.Diagnostic(range, d.msg, vscode.DiagnosticSeverity.Error);
    diag.source = result.tool;
    byFile.get(key)!.diags.push(diag);
  }
  for (var { uri, diags } of byFile.values()) diagnostics.set(uri, diags);
}
