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
import { Project, findRootDir, isHeaderFile, isInside, isOwnExtension, isSourceFile } from './projectinfo';
import { CONFIG, ProjectScope } from './projectscope';
import { BuildReason, BuildScheduler } from './autobuild';
import { PRESET_SCHEME, PresetFileSystem, Templates } from './templates';
import { chooseForFile, detectionSummary, describeFinding, dontAskKey, platformName, scanFolder } from './detection';
import { TOOL_META } from '../../src/common/toolmeta';

let context: vscode.ExtensionContext;
let output: vscode.OutputChannel;
let diagnostics: vscode.DiagnosticCollection;
let status: vscode.StatusBarItem;
let scope: ProjectScope;
let templates: Templates;
let scheduler: BuildScheduler;
let builds: WorkerHandle | undefined;
let emu: WorkerHandle | undefined;
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
/** The ROM it runs, so an identical rebuild (a comment edit) doesn't restart it. */
let runningRom: Uint8Array | undefined;
/** The target auto-build rebuilds: the last one changed or saved. */
let autoTarget: Target | undefined;
/** Diagnostics from a failed type-build, shown after a pause in typing. */
let heldDiagnostics: { timer: NodeJS.Timeout, show: () => void } | undefined;

export function activate(ctx: vscode.ExtensionContext) {
  context = ctx;
  output = vscode.window.createOutputChannel('8bitworkshop');
  diagnostics = vscode.languages.createDiagnosticCollection('8bitworkshop');
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  status.command = '8bitworkshop.projectMenu';
  scope = new ProjectScope(ctx.workspaceState);
  templates = new Templates(ctx.extensionPath, rootDir);
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
    vscode.window.onDidChangeActiveTextEditor(() => updateStatus()),
    scope.onDidChange(() => updateStatus()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => detectProjects(false)),
    { dispose: () => { builds?.dispose(); emu?.dispose(); } },
  );
  scope.loadReadmes().then(() => detectProjects(false));
  updateStatus();
}

export function deactivate() {
  scheduler?.cancel();
  if (heldDiagnostics) clearTimeout(heldDiagnostics.timer);
}

function config(uri?: vscode.Uri) {
  return vscode.workspace.getConfiguration(CONFIG, uri);
}

function rootDir(): string {
  var root = config().get<string>('toolchainPath') || findRootDir(context.extensionPath);
  if (!root) throw new Error('Cannot find toolchain assets (src/worker). Set 8bitworkshop.toolchainPath.');
  return root;
}

function getBuilds(): WorkerHandle {
  if (!builds) {
    var root = rootDir();
    output.appendLine(`Toolchain root: ${root}`);
    builds = new WorkerHandle('buildworker.js', root, {
      readFile: (buildId: number, rel: string) => readers.get(buildId)?.(rel) ?? null,
    }, msg => output.appendLine(msg));
  }
  return builds;
}

function getEmu(): WorkerHandle {
  if (!emu) {
    emu = new WorkerHandle('emuworker.js', rootDir(), {}, msg => output.appendLine(msg));
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
  if (run && result.output) await startEmulator(target, result.output);
  else if (!result.unchanged) await reloadEmulator(target, reason, result);
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
  if (target) await buildAndMaybeRun(target, !!panel, 'command');
}

async function followActiveEditor() {
  var project = currentTarget()?.project;
  if (!project) return;
  await scope.setTargetChoice(project, 'follow');
}

async function startEmulator(target: Target, rom: any) {
  // each run gets a fresh worker: platforms keep global state (see emuworker)
  emu?.dispose();
  emu = undefined;
  emuStatus = null;
  var worker = getEmu();
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
  try {
    emuStatus = await worker.call<EmuStatus>('start', target.platform, rom);
    panel.showStatus(emuStatus);
    running = target;
    runningRom = rom;
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
    await startEmulator(target, result.output);
  } else if (!sameBytes(runningRom, result.output)) {
    emuStatus = await getEmu().call<EmuStatus>('loadROM', result.output);
    runningRom = result.output;
  }
}

function sameBytes(a: Uint8Array | undefined, b: Uint8Array | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
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
    result = await getBuilds().call<BuildOutcome>('build', args);
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
  await vscode.window.showTextDocument(main);
  var target = currentTarget();
  if (target) await buildAndMaybeRun(target, false, 'command');
}

async function closeEditor(uri: vscode.Uri) {
  for (var group of vscode.window.tabGroups.all) {
    for (var tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === uri.toString()) await vscode.window.tabGroups.close(tab);
    }
  }
}

////// detection on open (case 3)

async function detectProjects(asked: boolean) {
  for (var folder of vscode.workspace.workspaceFolders || []) {
    if (folder.uri.scheme !== 'file') continue;
    if (!asked && (scope.folderHasProject(folder) || context.workspaceState.get(dontAskKey(folder)))) continue;
    var findings = await scanFolder(templates, folder);
    // folders with settings keep them
    findings = findings.filter(f => !scope.projects().some(p => p.origin !== 'build' && isInside(p.scope, f.dir.fsPath)));
    if (!findings.length) {
      if (asked) vscode.window.showInformationMessage(`No 8bitworkshop projects found in ${folder.name}.`);
      continue;
    }
    if (findings.length === 1) {
      var f = findings[0], d = f.detection;
      var where = path.relative(folder.uri.fsPath, f.dir.fsPath);
      var answer = await vscode.window.showInformationMessage(
        `This looks like a${/^[aeiou]/i.test(platformName(templates, d.platform)) ? 'n' : ''} ${platformName(templates, d.platform)} project${where ? ' in ' + where : ''} (${describeFinding(d)}).`,
        'Use It', 'Choose...', 'Not Now', "Don't Ask");
      if (answer === 'Use It') await acceptFinding(f.dir.fsPath, d.platform, d.mainFile, d.tool);
      else if (answer === 'Choose...') {
        var picked = await templates.pickPlatform('Platform for this folder', d.platform);
        if (picked) await acceptFinding(f.dir.fsPath, picked.id, d.mainFile, undefined);
      } else if (answer === "Don't Ask") await context.workspaceState.update(dontAskKey(folder), true);
      continue;
    }
    var review = await vscode.window.showInformationMessage(`Found ${findings.length} 8bitworkshop projects in ${folder.name}.`, 'Review', 'Not Now', "Don't Ask");
    if (review === "Don't Ask") await context.workspaceState.update(dontAskKey(folder), true);
    if (review !== 'Review') continue;
    type Item = vscode.QuickPickItem & { f: typeof findings[0] };
    var items: Item[] = findings.map(f => ({
      label: path.relative(folder.uri.fsPath, f.dir.fsPath) || '.',
      description: `${platformName(templates, f.detection.platform)}${detectionSummary(f.detection) ? ' · ' + detectionSummary(f.detection) : ''}`,
      detail: describeFinding(f.detection), picked: true, f,
    }));
    var chosen = await vscode.window.showQuickPick(items, { canPickMany: true, title: 'Use these as 8bitworkshop projects', matchOnDetail: true });
    for (var c of chosen || []) await acceptFinding(c.f.dir.fsPath, c.f.detection.platform, c.f.detection.mainFile, c.f.detection.tool);
  }
}

async function acceptFinding(dir: string, platform: string, mainFile: string | undefined, tool: string | undefined) {
  await scope.saveProject(dir, { platform, mainFile: mainFile ? path.join(dir, mainFile) : undefined, tool });
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
