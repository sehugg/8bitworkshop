
// 8bitworkshop VS Code extension entry point.
// Keep this module light: the build system loads on the first build.

import * as vscode from 'vscode';
import * as path from 'path';
import type * as BuildCore from './buildcore';

const CONFIG = '8bitworkshop';

let buildcore: typeof BuildCore;
let builder: BuildCore.Builder;
let output: vscode.OutputChannel;
let diagnostics: vscode.DiagnosticCollection;
let status: vscode.StatusBarItem;
let lastMain: vscode.Uri | undefined;
let lastPaths = new Set<string>();   // fsPaths the last build read
let lastBuild: BuildCore.BuildOutcome | undefined;
let pending: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  output = vscode.window.createOutputChannel('8bitworkshop');
  diagnostics = vscode.languages.createDiagnosticCollection('8bitworkshop');
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  status.command = '8bitworkshop.selectPlatform';
  context.subscriptions.push(output, diagnostics, status);
  updateStatus();

  context.subscriptions.push(
    vscode.commands.registerCommand('8bitworkshop.build', () => buildCommand(context)),
    vscode.commands.registerCommand('8bitworkshop.selectPlatform', () => selectPlatform(context)),
    vscode.workspace.onDidSaveTextDocument(doc => onSave(context, doc)),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(CONFIG)) updateStatus();
    }),
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

function loadBuildCore(context: vscode.ExtensionContext): typeof BuildCore {
  if (!buildcore) {
    // a computed path keeps esbuild from inlining it
    buildcore = require(path.join(__dirname, 'buildcore'));
    var configured = config().get<string>('toolchainPath');
    var root = configured || buildcore.findRootDir(context.extensionPath);
    if (!root) throw new Error('Cannot find toolchain assets (src/worker). Set 8bitworkshop.toolchainPath.');
    output.appendLine(`Toolchain root: ${root}`);
    builder = new buildcore.Builder(root);
  }
  return buildcore;
}

async function selectPlatform(context: vscode.ExtensionContext): Promise<string | undefined> {
  var core = loadBuildCore(context);
  var picked = await vscode.window.showQuickPick(core.listPlatforms(), { placeHolder: 'Target platform' });
  if (!picked) return undefined;
  var target = vscode.workspace.workspaceFolders ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
  await config().update('platform', picked, target);
  return picked;
}

async function buildCommand(context: vscode.ExtensionContext) {
  var platform = config().get<string>('platform') || await selectPlatform(context);
  if (!platform) return;
  var main = findMainFile(context);
  if (!main) {
    vscode.window.showWarningMessage('8bitworkshop: open a source file or set 8bitworkshop.mainFile.');
    return;
  }
  var result = await runBuild(context, platform, main);
  if (result && !result.success) output.show(true);
}

function onSave(context: vscode.ExtensionContext, doc: vscode.TextDocument) {
  var platform = config().get<string>('platform');
  if (!platform || !config().get<boolean>('buildOnSave')) return;
  if (doc.uri.scheme === 'untitled') return;
  var isDep = lastPaths.has(doc.uri.fsPath);
  if (!isDep && !loadBuildCore(context).isSourceFile(doc.fileName)) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = undefined;
    // a saved dependency rebuilds the last main file
    var main = (isDep && lastMain) || findMainFile(context);
    if (main) runBuild(context, platform!, main);
  }, 300);
}

/** The setting, else the active editor's file, else the last main file. */
function findMainFile(context: vscode.ExtensionContext): vscode.Uri | undefined {
  var setting = config().get<string>('mainFile');
  var folder = vscode.workspace.workspaceFolders?.[0];
  if (setting) {
    return path.isAbsolute(setting) || !folder ? vscode.Uri.file(setting) : vscode.Uri.joinPath(folder.uri, setting);
  }
  var editor = vscode.window.activeTextEditor;
  if (editor && loadBuildCore(context).isSourceFile(editor.document.fileName)) {
    return editor.document.uri;
  }
  return lastMain;
}

async function runBuild(context: vscode.ExtensionContext, platform: string, main: vscode.Uri) {
  var core = loadBuildCore(context);
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
  var result: BuildCore.BuildOutcome;
  try {
    result = await builder.build({
      platform,
      mainPath,
      mainText: new TextDecoder().decode(mainData),
      files: new core.ProjectFileProvider(read, builder.rootDir, platform),
      tool: config().get<string>('tool') || undefined,
    });
  } catch (e) {
    output.appendLine(`Build crashed: ${e && e.stack || e}`);
    output.show(true);
    return;
  } finally {
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

function showDiagnostics(result: BuildCore.BuildOutcome, toUri: (rel: string) => vscode.Uri) {
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

/** The most recent successful or failed build, for the emulator (milestone 2). */
export function getLastBuild() {
  return lastBuild;
}
