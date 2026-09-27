// 8bitworkshop VS Code extension entry point.
// Builds and emulation run in worker threads (buildworker, emuworker): both
// replace globals like fetch and window, which the shared extension host
// must not see. This module stays light.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { BuildOutcome } from './buildcore';
import type { BuildArgs } from './buildworker';
import type { AudioChunk, EmuStatus } from './emuworker';
import { WorkerHandle } from './engine';
import { EmulatorPanel } from './emulatorpanel';
import { Project, findRootDir, isHeaderFile, isInside, isOwnExtension, isSourceFile } from './projectinfo';
import { CONFIG, ProjectScope } from './projectscope';
import { BuildReason, BuildScheduler } from './autobuild';
import { PRESET_SCHEME, PresetFileSystem, Templates } from './templates';
import { chooseForFile, detectDirectoryAt, detectionSummary, describeDetection, describeFinding, dontAskKey, FolderFinding, platformName, scanFolder } from './detection';
import { Detection, classifyFinding, isBuildableSource } from '../../src/common/detect';
import { TOOL_META } from '../../src/common/toolmeta';
import { AssetStore } from './assets';
import { AssetManifest, packsForPlatform } from './assetpacks';

let context: vscode.ExtensionContext;
let output: vscode.OutputChannel;
let diagnostics: vscode.DiagnosticCollection;
let status: vscode.StatusBarItem;
let scope: ProjectScope;
let templates: Templates;
let scheduler: BuildScheduler;
let builds: WorkerHandle | undefined;
let emu: WorkerHandle | undefined;
let assets: AssetStore | undefined;
let panel: EmulatorPanel | undefined;
let emuStatus: EmuStatus | null = null;
let nextBuildId = 1;
const readers = new Map<number, (rel: string) => Promise<Uint8Array | null>>();

/** What Build and Run act on: a project's run target, or an example. */
interface Target {
  platform: string;
  main: vscode.Uri;
  tool?: string;
  project?: Project;
}

/** What the emulator runs, so a rebuild of the same thing reloads it. */
let running: Target | undefined;
/** The build it runs, so an identical rebuild (a comment edit) doesn't restart it. */
let runningBuild: BuildOutcome | undefined;
/** The target auto-build rebuilds: the last one changed or saved. */
let autoTarget: Target | undefined;
/** Diagnostics from a failed type-build, shown after a pause in typing. */
let heldDiagnostics: { timer: NodeJS.Timeout, show: () => void } | undefined;
/** Sound is muted; remembered across runs and webviews. */
let muted = false;

export function activate(ctx: vscode.ExtensionContext) {
  context = ctx;
  output = vscode.window.createOutputChannel('8bitworkshop');
  diagnostics = vscode.languages.createDiagnosticCollection('8bitworkshop');
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  status.command = '8bitworkshop.projectMenu';
  scope = new ProjectScope(ctx.workspaceState);
  templates = new Templates(ctx.extensionPath, () => toolchainRoot());
  scheduler = new BuildScheduler(reason => autoBuild(reason));
  ctx.subscriptions.push(output, diagnostics, status, scope);

  ctx.subscriptions.push(vscode.workspace.registerFileSystemProvider(PRESET_SCHEME, new PresetFileSystem(templates),
    { isCaseSensitive: true, isReadonly: PresetFileSystem.readonlyMessage() }));

  const command = (id: string, fn: (...args: any[]) => any) =>
    ctx.subscriptions.push(vscode.commands.registerCommand('8bitworkshop.' + id, async (...args) => {
      try {
        return await fn(...args);
      } catch (e) {
        output.appendLine(`${id}: ${e && e.stack || e}`);
        vscode.window.showErrorMessage(`8bitworkshop: ${e && e.message || e}`);
      }
    }));
  command('build', () => buildCommand(false));
  command('run', () => buildCommand(true));
  command('runThisFile', (uri?: vscode.Uri) => runThisFile(uri));
  command('runMainFile', () => runMainFile());
  command('followActiveEditor', () => followActiveEditor());
  command('setMainFile', (uri?: vscode.Uri) => setMainFile(uri));
  command('changeMainFile', () => changeMainFile());
  command('selectPlatform', () => changePlatform());
  command('newProject', (platformId?: string) => newProject(platformId));
  command('openExample', () => openExample());
  command('copyToWorkspace', (uri?: vscode.Uri) => copyToWorkspace(uri));
  command('detectProjects', () => detectProjects(true));
  command('addLaunchConfiguration', () => addLaunchConfiguration());
  command('projectMenu', () => projectMenu());
  command('reset', () => emu?.started && emu.call('reset'));
  command('pause', () => emu?.started && emu.call('pause'));
  command('resume', () => emu?.started && emu.call('resume'));
  command('stop', () => panel?.dispose());
  command('downloadToolchains', () => downloadToolchains());
  command('mute', () => setMuted(true));
  command('unmute', () => setMuted(false));
  muted = ctx.globalState.get<boolean>('muted', false);
  vscode.commands.executeCommand('setContext', '8bitworkshop.muted', muted);

  // F5 on an 8bitworkshop launch configuration runs it (no debugger yet)
  ctx.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('8bitworkshop', {
    resolveDebugConfiguration: async (folder, config) => {
      await runLaunchConfiguration(folder, config);
      return undefined;  // no debug session; the emulator panel runs it
    },
  }));

  ctx.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => onSave(doc)),
    vscode.workspace.onDidChangeTextDocument(e => onChange(e)),
    vscode.window.onDidChangeActiveTextEditor(() => { updateStatus(); detectForActiveFile(); }),
    scope.onDidChange(() => updateStatus()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => detectProjects(false)),
    { dispose: () => { builds?.dispose(); emu?.dispose(); } },
  );
  folderScans = scope.loadReadmes().then(() => {
    welcomeProject().catch(e => output.appendLine(`welcome: ${e}`));
    return detectProjects(false);
  });
  detectForActiveFile();
  updateStatus();
}

export function deactivate() {
  scheduler?.cancel();
  if (heldDiagnostics) clearTimeout(heldDiagnostics.timer);
}

function config(uri?: vscode.Uri) {
  return vscode.workspace.getConfiguration(CONFIG, uri);
}

////// toolchains

// asset servers, tried in order (8bitworkshop.assetUrl goes first)
const ASSET_URLS = ['https://sehugg.github.io/8bitworkshop/vscode/', 'https://8bitworkshop.com/vscode/'];

/** A local copy (toolchainPath, or the repo in development), if there is one. */
function localRoot(): string | null {
  return config().get<string>('toolchainPath') || findRootDir(context.extensionPath);
}

function getAssets(): AssetStore {
  if (!assets) {
    var file = path.join(context.extensionPath, 'out', 'assets.json');
    try {
      var manifest: AssetManifest = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
      throw new Error(`Cannot find toolchains: no ${file}. Set 8bitworkshop.toolchainPath.`);
    }
    var custom = config().get<string>('assetUrl');
    assets = new AssetStore(path.join(context.globalStorageUri.fsPath, 'toolchains'), manifest,
      custom ? [custom, ...ASSET_URLS] : ASSET_URLS, msg => output.appendLine(msg));
  }
  return assets;
}

/** The asset root, after downloading any packs `platform` needs. */
async function toolchainRoot(platform?: string): Promise<string> {
  var local = localRoot();
  if (local) return local;
  return installPacks(packsForPlatform(platform));
}

async function installPacks(packs: string[]): Promise<string> {
  var store = getAssets();
  if (packs.every(p => store.has(p))) return store.root;
  return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: '8bitworkshop: Downloading toolchains' }, progress => {
    var shown = new Map<string, number>();
    return store.ensure(packs, (pack, n, total) => {
      var pct = total ? Math.floor(100 * n / total / packs.length) : 0;
      progress.report({ message: `${pack}: ${mb(n)} of ${mb(total)}`, increment: pct - (shown.get(pack) || 0) });
      shown.set(pack, pct);
    });
  });
}

async function downloadToolchains() {
  if (localRoot()) {
    vscode.window.showInformationMessage(`8bitworkshop: using the toolchains in ${localRoot()}.`);
    return;
  }
  await installPacks(Object.keys(getAssets().manifest.packs));
  vscode.window.showInformationMessage('8bitworkshop: all toolchains downloaded.');
}

function mb(n: number): string {
  return (n / 1048576).toFixed(1) + ' MB';
}

async function getBuilds(platform: string): Promise<WorkerHandle> {
  var root = await toolchainRoot(platform);
  if (!builds) {
    output.appendLine(`Toolchain root: ${root}`);
    builds = new WorkerHandle('buildworker.js', root, {
      readFile: (buildId: number, rel: string) => readers.get(buildId)?.(rel) ?? null,
    }, msg => output.appendLine(msg));
  }
  return builds;
}

async function getEmu(platform: string): Promise<WorkerHandle> {
  var root = await toolchainRoot(platform);
  if (!emu) {
    emu = new WorkerHandle('emuworker.js', root, {}, msg => output.appendLine(msg));
    emu.on('frame', frame => panel?.showFrame(frame));
    emu.on('audio', (chunk: AudioChunk) => panel?.showAudio(chunk));
    emu.on('audioReset', () => panel?.resetAudio());
    emu.on('status', (s: EmuStatus | null) => {
      emuStatus = s;
      panel?.showStatus(s);
      vscode.commands.executeCommand('setContext', '8bitworkshop.emuRunning', s?.state === 'running');
      if (s?.state === 'halted') output.appendLine(`Emulator halted at frame ${s.frame}: ${s.message}`);
    });
  }
  return emu;
}

////// targets

function activeUri(): vscode.Uri | undefined {
  return vscode.window.activeTextEditor?.document.uri;
}

/** The example behind an 8bws-preset: document, as a target. */
function presetTarget(uri: vscode.Uri): Target | undefined {
  var p = templates.fromUri(uri);
  if (!p) return undefined;
  return { platform: p.platform.id, main: uri };
}

/** What Build and Run use for the active editor, if anything. */
function currentTarget(): Target | undefined {
  var uri = activeUri();
  if (uri && uri.scheme === PRESET_SCHEME) return presetTarget(uri);
  var project = scope.projectFor(uri);
  if (!project) {
    // with no editor, the project that ran last
    if (!uri && running?.project) project = running.project;
    else return undefined;
  }
  return targetIn(project, uri);
}

function targetIn(project: Project, uri: vscode.Uri | undefined): Target | undefined {
  var file = scope.runTarget(project, uri);
  if (!file) return undefined;
  var tool = file === project.mainFile ? project.tool : undefined;
  return { platform: project.platform, main: vscode.Uri.file(file), tool, project };
}

function describeTarget(t: Target): string {
  return path.posix.basename(t.main.path);
}

////// status bar

function updateStatus() {
  var uri = activeUri();
  var target = currentTarget();
  var canRun = !!target || (!!uri && uri.scheme === 'file' && isSourceFile(uri.fsPath));
  vscode.commands.executeCommand('setContext', '8bitworkshop.canRun', canRun);
  vscode.commands.executeCommand('setContext', '8bitworkshop.isExample', uri?.scheme === PRESET_SCHEME);
  var project = target?.project;
  if (target) {
    var name = platformName(templates, target.platform);
    var follow = project && (!project.mainFile || scope.getTargetChoice(project) === 'follow');
    var notMain = project && project.mainFile && target.main.fsPath !== project.mainFile;
    status.text = `$(chip) ${name} · ${describeTarget(target)}${follow ? ' (active file)' : ''}`;
    var tip = new vscode.MarkdownString();
    tip.appendMarkdown(`**${name}** (\`${target.platform}\`)\n\n`);
    if (project?.mainFile) tip.appendMarkdown(`Main file: \`${path.relative(project.scope, project.mainFile)}\`\n\n`);
    if (notMain) tip.appendMarkdown(`Running \`${describeTarget(target)}\` instead of the main file.\n\n`);
    if (uri?.scheme === PRESET_SCHEME) tip.appendMarkdown('Read-only example.\n\n');
    if (lastTool(target)?.startsWith('remote:')) tip.appendMarkdown('This tool builds on a server, so it builds when you save.\n\n');
    tip.appendMarkdown('Click for project options.');
    status.tooltip = tip;
    status.show();
  } else if (uri && uri.scheme === 'file' && dirGuesses.get(path.dirname(uri.fsPath))) {
    var guess = dirGuesses.get(path.dirname(uri.fsPath))!;
    status.text = `$(chip) ${platformName(templates, guess.platform)}?`;
    status.tooltip = `Looks like ${platformName(templates, guess.platform)}: ${describeDetection(guess)}. Click to choose a platform.`;
    status.show();
  } else if (uri && uri.scheme === 'file' && isOwnExtension(uri.fsPath)) {
    status.text = '$(chip) No platform';
    status.tooltip = 'Choose a platform for this file';
    status.show();
  } else {
    status.hide();
  }
}

function lastTool(t: Target): string | undefined {
  return scope.lastBuildOf(t.main.fsPath)?.tool;
}

async function projectMenu() {
  var target = currentTarget();
  var project = target?.project;
  type Item = vscode.QuickPickItem & { run?: () => any };
  var items: Item[] = [];
  if (!target) {
    items.push({ label: '$(file-code) Set as Main File', description: 'choose a platform for this file', run: () => setMainFile() });
    items.push({ label: '$(new-folder) New Project...', run: () => newProject() });
    items.push({ label: '$(book) Open Example', run: () => openExample() });
  } else if (!project) {
    items.push({ label: '$(copy) Copy to Workspace', run: () => copyToWorkspace() });
  } else {
    var choice = scope.getTargetChoice(project);
    if (project.mainFile && target.main.fsPath !== project.mainFile) {
      items.push({ label: '$(arrow-left) Run Main File', description: path.basename(project.mainFile), run: () => runMainFile() });
    }
    var recent = new Set<string>();
    for (var b of [scope.lastBuildIn(project)].filter(Boolean)) recent.add(b.target);
    for (var r of recent) {
      if (r !== target.main.fsPath && r !== project.mainFile)
        items.push({ label: `$(play) Run ${path.basename(r)}`, description: 'recent', run: () => runFile(project, r) });
    }
    if (choice !== 'follow' && project.mainFile)
      items.push({ label: '$(eye) Follow Active Editor', description: 'run whichever program is open', run: () => followActiveEditor() });
    items.push({ label: 'Project', kind: vscode.QuickPickItemKind.Separator });
    items.push({ label: '$(chip) Change Platform...', description: platformName(templates, project.platform), run: () => changePlatform() });
    items.push({ label: '$(file-code) Change Main File...', description: project.mainFile ? path.basename(project.mainFile) : 'none', run: () => changeMainFile() });
    if (project.mainFile && target.main.fsPath !== project.mainFile)
      items.push({ label: '$(debug-alt) Add Launch Configuration', description: `for ${describeTarget(target)}`, run: () => addLaunchConfiguration() });
    items.push({ label: '$(search) Detect Again', run: () => detectAgain(project) });
  }
  var picked = await vscode.window.showQuickPick(items, { title: '8bitworkshop' });
  await picked?.run?.();
}

////// build and run

async function buildCommand(run: boolean) {
  var target = currentTarget();
  if (!target) {
    // no project owns this file yet: start one from it (case 2)
    var uri = activeUri();
    if (!uri || !isSourceFile(uri.fsPath)) {
      vscode.window.showWarningMessage('8bitworkshop: open a source file, or run "8bitworkshop: New Project...".');
      return;
    }
    if (!await setMainFile(uri)) return;
    target = currentTarget();
    if (!target) return;
  }
  await buildAndMaybeRun(target, run, 'command');
}

async function buildAndMaybeRun(target: Target, run: boolean, reason: BuildReason) {
  var result = await runBuild(target, reason);
  if (!result) return;
  if (!result.success) {
    if (run) vscode.window.showErrorMessage('8bitworkshop: build failed; see Problems.');
    return;
  }
  if (run) {
    if (result.output) await startEmulator(target, result);
    else {
      output.appendLine('8bitworkshop: the build produced no ROM to run; see the output for the last build.');
      output.show(true);
    }
  } else if (!result.unchanged) {
    await reloadEmulator(target, reason, result);
  }
}

async function runFile(project: Project, file: string) {
  await scope.setTargetChoice(project, file);
  var target = targetIn(project, vscode.Uri.file(file));
  if (target) await buildAndMaybeRun(target, true, 'command');
}

async function runThisFile(uri?: vscode.Uri) {
  uri = uri || activeUri();
  if (!uri) return;
  if (uri.scheme === PRESET_SCHEME) {
    var pt = presetTarget(uri);
    if (pt) await buildAndMaybeRun(pt, true, 'command');
    return;
  }
  var project = scope.projectFor(uri);
  if (!project) {
    if (!await setMainFile(uri)) return;
    project = scope.projectFor(uri);
    if (!project) return;
  }
  await runFile(project, uri.fsPath);
}

async function runMainFile() {
  var project = currentTarget()?.project || running?.project;
  if (!project) return;
  await scope.setTargetChoice(project, undefined);
  var target = targetIn(project, activeUri());
  if (target) await buildAndMaybeRun(target, true, 'command');
}

async function followActiveEditor() {
  var project = currentTarget()?.project;
  if (!project) return;
  await scope.setTargetChoice(project, 'follow');
}

async function startEmulator(target: Target, build: BuildOutcome) {
  // each run gets a fresh worker: platforms keep global state (see emuworker)
  emu?.dispose();
  emu = undefined;
  emuStatus = null;
  var worker = await getEmu(target.platform);
  if (!panel) {
    panel = new EmulatorPanel({
      onKey: (key, code, flags) => { emu?.call('key', key, code, flags); },
      onControlsVisible: visible => context.globalState.update('controlsVisible', visible),
      // don't burn CPU on a hidden screen
      onVisible: visible => { emu?.call('setVisible', visible); },
      onDispose: () => {
        panel = undefined;
        emuStatus = null;
        running = undefined;
        // the next run starts a new worker anyway
        emu?.dispose();
        emu = undefined;
        vscode.commands.executeCommand('setContext', '8bitworkshop.emuRunning', false);
      },
    }, context.globalState.get<boolean>('controlsVisible', true));
  } else {
    panel.reveal();
  }
  var title = describeTarget(target);
  panel.setTitle(`${title} (${target.platform})`);
  panel.setMuted(muted);
  try {
    emuStatus = await worker.call<EmuStatus>('start', target.platform, build.output, build.files);
    worker.call('setMuted', muted);
    panel.showStatus(emuStatus);
    running = target;
    runningBuild = build;
    output.appendLine(`Running ${title} on ${target.platform}`);
  } catch (e) {
    output.appendLine(`Emulator failed to start: ${e && e.stack || e}`);
    output.show(true);
  }
}

/** After a rebuild of what the emulator runs, reload it (per reloadOnBuild). */
async function reloadEmulator(target: Target, reason: BuildReason, result: BuildOutcome) {
  if (!panel || !emuStatus || !running || !result.output) return;
  if (running.main.toString() !== target.main.toString()) return;
  var mode = config(target.main).get<string>('reloadOnBuild', 'always');
  if (mode === 'never' || (mode === 'onSave' && reason === 'type')) return;
  if (emuStatus.platform !== target.platform) {
    await startEmulator(target, result);
  } else if (!sameBuild(runningBuild, result)) {
    runningBuild = result;
    try {
      emuStatus = await (await getEmu(target.platform)).call<EmuStatus>('loadROM', result.output, result.files);
    } catch (e) {
      output.appendLine(`Emulator failed to load: ${e && e.message || e}`);
      output.show(true);
    }
  }
}

/** Turn sound on or off everywhere (the webview gain and the worker's push). */
function setMuted(m: boolean) {
  muted = m;
  context.globalState.update('muted', m);
  panel?.setMuted(m);
  if (emu?.started) emu.call('setMuted', m);
  vscode.commands.executeCommand('setContext', '8bitworkshop.muted', m);
}

/** Same output and same load-time files (see BuildOutcome.files). */
function sameBuild(a: BuildOutcome | undefined, b: BuildOutcome): boolean {
  if (!a || !sameData(a.output, b.output)) return false;
  var af = a.files || {}, bf = b.files || {};
  var keys = Object.keys(bf);
  return keys.length === Object.keys(af).length && keys.every(k => sameData(af[k], bf[k]));
}

/** Compares ROM bytes, file text, or (verilog) the compiled unit. */
function sameData(a: any, b: any): boolean {
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  try {
    return !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;  // not JSON (cycles): assume it changed
  }
}

/**
 * Write the build's ROM to <main dir>/<exportRomPath>/<main>.<romext>.
 * Off by default; only successful command/save builds export.
 */
async function exportRom(target: Target, rom: Uint8Array) {
  var cfg = config(target.main);
  if (!target.project || !cfg.get<boolean>('exportRom')) return;
  var dir = path.dirname(target.main.fsPath);
  var folder = cfg.get<string>('exportRomPath') || 'bin';
  var ext = templates.platform(target.platform)?.romext || '.bin';
  var name = path.basename(target.main.fsPath, path.extname(target.main.fsPath)) + ext;
  var out = path.resolve(dir, folder, name);
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(out)));
    await vscode.workspace.fs.writeFile(vscode.Uri.file(out), rom);
    output.appendLine(`Exported ${path.relative(dir, out)} (${rom.length} bytes)`);
  } catch (e) {
    output.appendLine(`Cannot export ROM to ${out}: ${e && e.message || e}`);
  }
}

/** Build a target; unsaved editor contents win over disk. */
async function runBuild(target: Target, reason: BuildReason): Promise<BuildOutcome | undefined> {
  var main = target.main;
  // paths are relative to the main file's directory, like the IDE's project root
  var rootUri = vscode.Uri.joinPath(main, '..');
  var toUri = (rel: string) => vscode.Uri.joinPath(rootUri, rel);
  var read = async (rel: string): Promise<Uint8Array | null> => {
    var uri = toUri(rel);
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
  var buildId = nextBuildId++;
  readers.set(buildId, read);
  var args: BuildArgs = {
    buildId,
    platform: target.platform,
    mainPath,
    mainText: new TextDecoder().decode(mainData),
    tool: target.tool,
  };
  var result: BuildOutcome;
  if (reason !== 'type') status.text = '$(sync~spin) ' + platformName(templates, target.platform);
  try {
    result = await (await getBuilds(target.platform)).call<BuildOutcome>('build', args);
  } catch (e) {
    output.appendLine(`Build crashed: ${e && e.stack || e}`);
    output.show(true);
    return;
  } finally {
    readers.delete(buildId);
    updateStatus();
  }
  if (main.scheme === 'file' && target.project) {
    scope.recordBuild({
      project: target.project, target: main.fsPath, tool: result.tool,
      paths: result.paths.map(p => toUri(p).fsPath),
    });
  }
  if (result.unchanged) {
    // no rebuild: the last successful outcome stands. Clear any errors a later
    // failed build showed (the IDE does the same in ui.ts setCompileOutput),
    // and drop a held type-build error that would otherwise reappear.
    if (result.success) {
      releaseHeldDiagnostics();
      showDiagnostics(result, toUri);
    }
    return result;
  }
  var elapsed = Date.now() - t0;
  if (result.success) {
    releaseHeldDiagnostics();
    showDiagnostics(result, toUri);
    var size = result.output?.length ?? 0;
    output.appendLine(`${mainPath}: built with ${result.tool} for ${target.platform}, ${size} bytes (${elapsed} ms)`);
    if (result.output && reason !== 'type') await exportRom(target, result.output);
  } else if (reason === 'type') {
    // half-typed code fails; hold the errors until the typing pauses
    holdDiagnostics(() => {
      showDiagnostics(result, toUri);
      logErrors(mainPath, result, elapsed);
    });
  } else {
    showDiagnostics(result, toUri);
    logErrors(mainPath, result, elapsed);
    output.show(true);
  }
  return result;
}

function logErrors(mainPath: string, result: BuildOutcome, elapsed: number) {
  output.appendLine(`${mainPath}: ${result.diagnostics.length} error(s) from ${result.tool} (${elapsed} ms)`);
  for (var d of result.diagnostics) output.appendLine(`  ${d.path}:${d.line}: ${d.msg}`);
}

const HOLD_ERRORS_MS = 1000;

function holdDiagnostics(show: () => void) {
  releaseHeldDiagnostics(false);
  var wait = Math.max(0, scheduler.lastChange + HOLD_ERRORS_MS - Date.now());
  heldDiagnostics = { show, timer: setTimeout(() => releaseHeldDiagnostics(true), wait) };
}

function releaseHeldDiagnostics(show = false) {
  if (!heldDiagnostics) return;
  clearTimeout(heldDiagnostics.timer);
  if (show) heldDiagnostics.show();
  heldDiagnostics = undefined;
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

////// auto-build

/** The target a change to this document should rebuild, if any. */
function targetForDocument(doc: vscode.TextDocument): Target | undefined {
  if (doc.uri.scheme !== 'file') return undefined;
  var file = doc.uri.fsPath;
  // a file the running program or a recent build reads rebuilds that build
  if (running && running.main.scheme === 'file' && (running.main.fsPath === file || scope.lastBuildOf(running.main.fsPath)?.paths.includes(file)))
    return running;
  var reading = scope.buildsReading(file)[0];
  if (reading) {
    return { platform: reading.project.platform, main: vscode.Uri.file(reading.target), project: reading.project,
      tool: reading.target === reading.project.mainFile ? reading.project.tool : undefined };
  }
  // no build has read it yet: a source file in a project builds its target
  var project = scope.projectFor(doc.uri);
  if (project && isSourceFile(file)) return targetIn(project, doc.uri);
  return undefined;
}

function autoBuildMode(t: Target): string {
  var mode = config(t.main).get<string>('autoBuild', 'onType');
  // server tools cost the server and the network; build those on save
  var tool = lastTool(t) || t.tool || '';
  if (mode === 'onType' && (tool.startsWith('remote:') || TOOL_META[tool]?.remote)) return 'onSave';
  return mode;
}

function onChange(e: vscode.TextDocumentChangeEvent) {
  if (!e.contentChanges.length) return;
  var t = targetForDocument(e.document);
  if (!t || autoBuildMode(t) !== 'onType') return;
  // a header only matters once a build has read it
  if (isHeaderFile(e.document.fileName) && !scope.buildsReading(e.document.uri.fsPath).length) return;
  autoTarget = t;
  scheduler.changed();
  if (heldDiagnostics) holdDiagnostics(heldDiagnostics.show);
}

function onSave(doc: vscode.TextDocument) {
  var t = targetForDocument(doc);
  if (!t || autoBuildMode(t) === 'off') return;
  autoTarget = t;
  scheduler.now('save');
}

async function autoBuild(reason: BuildReason) {
  var t = autoTarget;
  if (!t) return;
  await buildAndMaybeRun(t, false, reason);
}

////// projects

/**
 * Case 2: make `uri` a project's main file. With no project, detect the
 * platform and save it. Returns false if the user backed out.
 */
async function setMainFile(uri?: vscode.Uri): Promise<boolean> {
  uri = uri || activeUri();
  if (!uri || uri.scheme !== 'file') return false;
  var file = uri.fsPath;
  var project = scope.projectFor(uri);
  if (project && project.origin !== 'build') {
    if (project.mainFile === file) return true;
    var dir = path.dirname(file);
    type Item = vscode.QuickPickItem & { id: string };
    var items: Item[] = [
      { id: 'main', label: `Make ${path.basename(file)} the main file`, detail: `Build and Run use it instead of ${project.mainFile ? path.basename(project.mainFile) : 'the active file'}.` },
      dir === project.scope
        ? { id: 'dir', label: 'Run each program in this folder on its own', detail: 'Build and Run use whichever program is open.' }
        : { id: 'sub', label: `Start a second project in ${path.relative(project.scope, dir)}`, detail: `A separate ${platformName(templates, project.platform)} project with ${path.basename(file)} as its main file.` },
    ];
    var picked = await vscode.window.showQuickPick(items, { title: `Set ${path.basename(file)} as Main File` });
    if (!picked) return false;
    if (picked.id === 'main') await scope.updateProject(project, { mainFile: file });
    else if (picked.id === 'dir') await scope.updateProject(project, { mainFile: null });
    else await scope.saveProject(dir, { platform: project.platform, mainFile: file });
    await scope.setTargetChoice(scope.projectFor(uri) || project, undefined);
    return true;
  }
  var choice = await chooseForFile(templates, uri);
  if (!choice) return false;
  var dir = path.dirname(file);
  var saved = await scope.saveProject(dir, { platform: choice.platform, mainFile: file, tool: choice.tool });
  if (!saved) {
    // no folder to save to: keep it for this window, and offer the folder
    scope.addWindowProject({ scope: dir, root: dir, platform: choice.platform, mainFile: file, tool: choice.tool, origin: 'window' });
    vscode.window.showInformationMessage(`${path.basename(file)} uses ${platformName(templates, choice.platform)} until you close this window.`, 'Open Containing Folder')
      .then(async a => {
        if (a !== 'Open Containing Folder') return;
        // write the settings first, so the folder opens as a project
        await writeFolderSettings(vscode.Uri.file(dir), { platform: choice.platform, mainFile: path.basename(file), tool: choice.tool });
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(dir));
      });
  }
  return true;
}

/** Write .vscode/settings.json in a folder that isn't open yet. */
async function writeFolderSettings(dir: vscode.Uri, s: { platform: string, mainFile?: string, tool?: string }) {
  var file = vscode.Uri.joinPath(dir, '.vscode', 'settings.json');
  var json: any = {};
  try {
    json = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(file)));
  } catch (e) {
    // no settings yet (or comments we can't parse: start fresh only if missing)
    try { await vscode.workspace.fs.stat(file); return; } catch (e2) { }
  }
  json[CONFIG + '.platform'] = s.platform;
  if (s.mainFile) json[CONFIG + '.mainFile'] = s.mainFile;
  if (s.tool) json[CONFIG + '.tool'] = s.tool;
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(dir, '.vscode'));
  await vscode.workspace.fs.writeFile(file, new TextEncoder().encode(JSON.stringify(json, null, 2) + '\n'));
}

async function changeMainFile() {
  var project = currentTarget()?.project;
  if (!project) return setMainFile();
  var files = await vscode.workspace.findFiles(new vscode.RelativePattern(project.scope, '**/*'), '{**/node_modules/**,**/.git/**}', 500);
  var mains = files.filter(u => isSourceFile(u.fsPath) && !isHeaderFile(u.fsPath));
  type Item = vscode.QuickPickItem & { file?: string };
  var items: Item[] = mains.map(u => ({ label: path.relative(project.scope, u.fsPath), file: u.fsPath,
    description: u.fsPath === project.mainFile ? 'current' : undefined }));
  items.push({ label: '(none: run whichever program is open)' });
  var picked = await vscode.window.showQuickPick(items, { title: 'Main file' });
  if (!picked) return;
  await scope.updateProject(project, { mainFile: picked.file || null });
  await scope.setTargetChoice(project, undefined);
}

async function changePlatform() {
  var uri = activeUri();
  var project = currentTarget()?.project || scope.projectFor(uri);
  if (!project) {
    if (uri && uri.scheme === 'file') await setMainFile(uri);
    return;
  }
  var picked = await templates.pickPlatform('Change platform', project.platform);
  if (!picked || picked.id === project.platform) return;
  await scope.updateProject(project, { platform: picked.id });
  vscode.window.showInformationMessage(`Now building for ${picked.name}.`);
  var target = currentTarget();
  if (target) await buildAndMaybeRun(target, !!panel, 'command');
}

async function detectAgain(project: Project) {
  var main = project.mainFile || running?.main.fsPath || activeUri()?.fsPath;
  if (!main) return;
  var choice = await chooseForFile(templates, vscode.Uri.file(main));
  if (choice) await scope.updateProject(project, { platform: choice.platform, tool: choice.tool || null });
}

////// templates

async function newProject(platformId?: string) {
  var platform = platformId ? templates.platform(platformId) : await templates.pickPlatform('New 8bitworkshop Project', currentTarget()?.platform);
  if (!platform) return;
  var template = await templates.pickTemplate(platform, `New ${platform.name} Project`);
  if (!template) return;
  await createFromTemplate(platform.id, template.id);
}

async function openExample() {
  var platform = await templates.pickPlatform('Open Example', currentTarget()?.platform);
  if (!platform) return;
  var template = await templates.pickTemplate(platform, `${platform.name} Examples`);
  if (!template) return;
  await vscode.window.showTextDocument(templates.presetUri(platform, template), { preview: false });
}

async function copyToWorkspace(uri?: vscode.Uri) {
  uri = uri && uri.scheme === PRESET_SCHEME ? uri : activeUri();
  var found = uri && templates.fromUri(uri);
  if (!found || !found.template) {
    vscode.window.showWarningMessage('8bitworkshop: open an example first.');
    return;
  }
  await createFromTemplate(found.platform.id, found.template.id, uri);
}

async function createFromTemplate(platformId: string, templateId: string, replacing?: vscode.Uri) {
  var platform = templates.platform(platformId);
  var t = platform.templates.find(x => x.id === templateId);
  var name = t.saveAs ? `${platform.dir}-project` : t.id;
  var dest = await templates.pickDestination(name);
  if (!dest) return;
  var withLibraries = false;
  if (t.shared.length) {
    var answer = await vscode.window.showQuickPick([
      { label: 'Copy the program', description: 'recommended', detail: `Library files (${t.shared.slice(0, 3).join(', ')}${t.shared.length > 3 ? ', ...' : ''}) still build from the examples.`, lib: false },
      { label: 'Also copy library files', detail: 'To edit them, or to build without the extension.', lib: true },
    ], { title: `Copy ${t.name}` });
    if (!answer) return;
    withLibraries = answer.lib;
  }
  var main = await templates.copy(platform, t, dest.dir, withLibraries);
  if (!main) return;
  var settings = { platform: platform.id, mainFile: main.fsPath };
  if (dest.open) {
    await writeFolderSettings(dest.dir, { platform: platform.id, mainFile: path.basename(main.fsPath) });
    await vscode.commands.executeCommand('vscode.openFolder', dest.dir, { forceNewWindow: !!vscode.workspace.workspaceFolders?.length });
    return;
  }
  await scope.saveProject(dest.dir.fsPath, settings);
  if (replacing) await closeEditor(replacing);
  await openAndBuild(main.fsPath, false);
}

async function closeEditor(uri: vscode.Uri) {
  for (var group of vscode.window.tabGroups.all) {
    for (var tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === uri.toString()) await vscode.window.tabGroups.close(tab);
    }
  }
}

////// detection on open (case 3)

interface FolderOffer {
  folder: vscode.WorkspaceFolder;
  strong: FolderFinding[];
  potential: FolderFinding[];
}

// resolves when the latest folder scan is done (not its prompts)
let folderScans: Promise<void> = Promise.resolve();

/**
 * Scan the workspace folders and offer what they hold. Resolves once the
 * scans are done; the prompts carry on.
 */
function detectProjects(asked: boolean): Promise<void> {
  var scans = scanForOffers(asked);
  scans.then(offers => offerFindings(offers, asked)).catch(e => output.appendLine(`detect: ${e}`));
  return folderScans = scans.then(() => undefined, () => undefined);
}

async function scanForOffers(asked: boolean): Promise<FolderOffer[]> {
  var offers: FolderOffer[] = [];
  for (var folder of vscode.workspace.workspaceFolders || []) {
    if (folder.uri.scheme !== 'file') continue;
    if (!asked && (scope.folderHasProject(folder) || context.workspaceState.get(dontAskKey(folder)))) continue;
    var scan = await scanFolder(templates, folder);
    // folders with settings keep them
    var findings = scan.findings.filter(f => !scope.projects().some(p => p.origin !== 'build' && isInside(p.scope, f.dir.fsPath)));
    var strong = findings.filter(f => !f.potential);
    // weak evidence is offered only when the user asks
    var potential = asked ? findings.filter(f => f.potential) : [];
    // unasked, a big repo with projects scattered through it isn't ours;
    // opening a file in one of them still asks
    if (!asked && (scan.truncated || !scan.madeOfProjects)) continue;
    if (!strong.length && !potential.length) {
      if (asked) vscode.window.showInformationMessage(`No 8bitworkshop projects found in ${folder.name}.`);
      continue;
    }
    // this prompt speaks for the folder; opening a file in it won't ask again
    for (var f of findings) dirGuesses.set(f.dir.fsPath, f.detection);
    quietFolders.add(folder.uri.toString());
    offers.push({ folder, strong, potential });
  }
  return offers;
}

async function offerFindings(offers: FolderOffer[], asked: boolean) {
  for (var { folder, strong, potential } of offers) {
    if (strong.length === 1 && !potential.length) {
      await offerProject(folder, strong[0].dir, strong[0].detection, asked);
      continue;
    }
    var plural = (n: number) => n === 1 ? '' : 's';
    var message = strong.length
      ? `Found ${strong.length} 8bitworkshop project${plural(strong.length)}${potential.length ? ` and ${potential.length} potential` : ''} in ${folder.name}.`
      : `Found ${potential.length} potential 8bitworkshop project${plural(potential.length)} in ${folder.name}.`;
    // "Don't Ask" only makes sense on a prompt the user didn't ask for
    var review = await vscode.window.showInformationMessage(message, 'Review', 'Not Now', ...(asked ? [] : ["Don't Ask"]));
    if (review === "Don't Ask") await context.workspaceState.update(dontAskKey(folder), true);
    if (review === 'Review') await reviewFindings(folder, [...strong, ...potential]);
  }
}

/**
 * Offer one directory as a project. `prefer` is a program the user opened:
 * it becomes the main file in place of the detector's pick. Returns true if
 * the user took the offer.
 */
async function offerProject(folder: vscode.WorkspaceFolder | undefined, dir: vscode.Uri, d: Detection, asked: boolean, prefer?: string): Promise<boolean> {
  var where = folder ? path.relative(folder.uri.fsPath, dir.fsPath) : '';
  var name = platformName(templates, d.platform);
  // a sure thing needs no clue; just say what it found
  var why = d.score >= 1 ? detectionSummary(d) : describeFinding(d);
  var answer = await vscode.window.showInformationMessage(
    `This looks like a${/^[aeiou]/i.test(name) ? 'n' : ''} ${name} project${where ? ' in ' + where : ''}${why ? ` (${why})` : ''}.`,
    'Use It', 'Choose...', 'Not Now', ...(asked || !folder ? [] : ["Don't Ask"]));
  if (answer === 'Use It') {
    await openAndBuild(await acceptFinding(dir.fsPath, d, d.platform, prefer), true);
    return true;
  }
  if (answer === 'Choose...') {
    var picked = await templates.pickPlatform('Platform for this folder', d.platform);
    if (picked) await openAndBuild(await acceptFinding(dir.fsPath, d, picked.id, prefer), true);
    return !!picked;
  }
  if (answer === "Don't Ask" && folder) await context.workspaceState.update(dontAskKey(folder), true);
  return false;
}

////// detection on opening a file

// directories detected this session, with the best guess if any
const dirGuesses = new Map<string, Detection | undefined>();
// workspace folders not to prompt in again this session
const quietFolders = new Set<string>();

/**
 * Opening a source file in a directory with no project detects that
 * directory, once a session: a strong guess prompts, a weaker one only
 * shows in the status bar.
 */
async function detectForActiveFile() {
  var uri = activeUri();
  if (!uri || uri.scheme !== 'file' || currentTarget() || !isBuildableSource(uri.fsPath)) return;
  await folderScans;
  var dir = path.dirname(uri.fsPath);
  if (dirGuesses.has(dir) || currentTarget()) return;
  dirGuesses.set(dir, undefined);
  var found = await detectDirectoryAt(templates, vscode.Uri.file(dir));
  var kind = classifyFinding(found);
  if (!kind) return;
  dirGuesses.set(dir, found[0]);
  updateStatus();
  if (kind !== 'project') return;
  var folder = vscode.workspace.getWorkspaceFolder(uri);
  var key = folder?.uri.toString() || dir;
  if (quietFolders.has(key) || (folder && context.workspaceState.get(dontAskKey(folder)))) return;
  // the file the user opened wins over the detector's pick, when it's a program
  var name = path.basename(uri.fsPath);
  var prefer = found[0].mainCandidates?.includes(name) ? name : undefined;
  // one prompt at a time; turning it down quiets the folder for the session
  quietFolders.add(key);
  if (await offerProject(folder, vscode.Uri.file(dir), found[0], false, prefer)) quietFolders.delete(key);
}

/** Let the user pick which findings to keep as projects. */
async function reviewFindings(folder: vscode.WorkspaceFolder, findings: FolderFinding[]) {
  type Item = vscode.QuickPickItem & { f: FolderFinding };
  var items: Item[] = findings.map(f => ({
    label: path.relative(folder.uri.fsPath, f.dir.fsPath) || '.',
    description: `${platformName(templates, f.detection.platform)}${detectionSummary(f.detection) ? ' · ' + detectionSummary(f.detection) : ''}${f.potential ? ' · potential' : ''}`,
    detail: describeFinding(f.detection), picked: !f.potential, f,
  }));
  var chosen = await vscode.window.showQuickPick(items, { canPickMany: true, title: 'Use these as 8bitworkshop projects', matchOnDetail: true });
  if (!chosen?.length) return;
  var files: (string | undefined)[] = [];
  for (var c of chosen) files.push(await acceptFinding(c.f.dir.fsPath, c.f.detection));
  // build the rest in the background of the first, which opens
  for (var file of files.slice(1)) if (file) await buildFile(file);
  await openAndBuild(files[0], true);
}

/**
 * Save a detected project, on the platform the user chose if not the
 * detected one. Returns the file to open: the main file, or a folder of
 * programs' first program.
 */
async function acceptFinding(dir: string, d: Detection, platform = d.platform, prefer?: string): Promise<string | undefined> {
  var tool = platform === d.platform ? d.tool : undefined;
  // a program the user opened is the main file, even when the detector
  // preferred another one (or saw a folder of programs with none)
  var file = prefer && d.mainCandidates?.includes(prefer) ? prefer : d.mainFile || d.mainCandidates?.[0];
  var mainFile = prefer && file === prefer ? file : d.mainFile;
  await scope.saveProject(dir, { platform, mainFile: mainFile ? path.join(dir, mainFile) : undefined, tool });
  return file && path.join(dir, file);
}

////// after a project appears

// set once this workspace has shown the user a project's file
const WELCOMED = 'welcomed';

/**
 * Open a project's file and build it, so the Run button and the result
 * are in view. The emulator never starts unasked; with `offerRun`, a good
 * build offers it.
 */
async function openAndBuild(file: string | undefined, offerRun: boolean) {
  if (!file) return;
  await context.workspaceState.update(WELCOMED, true);
  var uri = vscode.Uri.file(file);
  await vscode.window.showTextDocument(uri, { preview: false });
  var project = scope.projectFor(uri);
  var target = project && targetIn(project, uri);
  if (!target) return;
  // with the emulator open, the new program just replaces what it runs
  if (panel) return buildAndMaybeRun(target, false, 'command');
  var result = await runBuild(target, 'command');
  if (!offerRun || !result?.success) return;
  var answer = await vscode.window.showInformationMessage(
    `Built ${describeTarget(target)} for ${platformName(templates, target.platform)}.`, 'Run');
  if (answer === 'Run') await buildAndMaybeRun(target, true, 'command');
}

/** Build a project's file without opening it; errors go to Problems. */
async function buildFile(file: string) {
  var uri = vscode.Uri.file(file);
  var project = scope.projectFor(uri);
  var target = project && targetIn(project, uri);
  if (target) await runBuild(target, 'command');
}

/**
 * The first time a folder with a project opens (a README badge, or a new
 * project opened in a new window), open its main file and build it,
 * unless the user already has editors open.
 */
async function welcomeProject() {
  if (context.workspaceState.get(WELCOMED)) return;
  var project = scope.projects().find(p => p.mainFile && (p.origin === 'settings' || p.origin === 'folders' || p.origin === 'readme'));
  if (!project) return;
  await context.workspaceState.update(WELCOMED, true);
  if (vscode.window.tabGroups.all.some(g => g.tabs.length)) return;
  await openAndBuild(project.mainFile, false);
}

////// launch configurations

async function addLaunchConfiguration() {
  var target = currentTarget();
  var project = target?.project;
  if (!target || !project?.folder) return;
  var folderUri = vscode.Uri.file(project.folder);
  var launch = vscode.workspace.getConfiguration('launch', folderUri);
  var configs = (launch.get<any[]>('configurations') || []).slice();
  var rel = path.relative(project.folder, target.main.fsPath).split(path.sep).join('/');
  var name = `Run ${path.basename(rel)} (${platformName(templates, target.platform)})`;
  if (configs.some(c => c.type === '8bitworkshop' && c.mainFile === rel && c.platform === target.platform)) {
    vscode.window.showInformationMessage(`"${name}" is already in launch.json.`);
    return;
  }
  var entry: any = { type: '8bitworkshop', request: 'launch', name, platform: target.platform, mainFile: rel };
  if (target.tool) entry.tool = target.tool;
  configs.push(entry);
  await launch.update('configurations', configs, vscode.ConfigurationTarget.WorkspaceFolder);
  vscode.window.showInformationMessage(`Added "${name}" to launch.json. Choose it in Run and Debug, then press F5.`);
}

async function runLaunchConfiguration(folder: vscode.WorkspaceFolder | undefined, cfg: vscode.DebugConfiguration) {
  var base = folder?.uri.fsPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cfg.mainFile || !base) {
    // F5 with no launch.json: run the current target
    return buildCommand(true);
  }
  var file = path.resolve(base, cfg.mainFile);
  var project = scope.projectFor(vscode.Uri.file(file));
  var platform = cfg.platform || project?.platform;
  if (!platform) {
    vscode.window.showErrorMessage(`8bitworkshop: launch configuration "${cfg.name}" needs a platform.`);
    return;
  }
  if (project) await scope.setTargetChoice(project, file);
  await buildAndMaybeRun({ platform, main: vscode.Uri.file(file), tool: cfg.tool, project }, true, 'command');
}
