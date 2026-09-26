// projectscope - the extension's view of 8bitworkshop projects: reads them
// from settings, README badges, and choices made in a window with no folder;
// saves them back to settings; and keeps each project's run target.

import * as vscode from 'vscode';
import * as path from 'path';
import { parseReadmeBadge } from '../../src/common/detect';
import { FolderInfo, Project, ProjectContext, ProjectSettings, RunTargetChoice, isInside, listProjects, projectFor, resolveRunTarget } from './projectinfo';

export const CONFIG = '8bitworkshop';
const RECENT_BUILDS = 6;

export interface BuildRecord {
  project: Project;
  /** the file built as the main file */
  target: string;
  /** absolute paths the build read */
  paths: string[];
  tool: string;
}

export class ProjectScope implements vscode.Disposable {
  private readmes = new Map<string, { platform: string, mainFile?: string }>();
  private windowProjects: Project[] = [];
  private builds: BuildRecord[] = [];
  /** targets for projects with no folder to store them in */
  private memoryTargets = new Map<string, RunTargetChoice>();
  private emitter = new vscode.EventEmitter<void>();
  private subs: vscode.Disposable[] = [];
  readonly onDidChange = this.emitter.event;

  constructor(readonly state: vscode.Memento) {
    this.subs.push(
      vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration(CONFIG)) this.emitter.fire(); }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.loadReadmes()),
    );
    var watcher = vscode.workspace.createFileSystemWatcher('**/README.md');
    watcher.onDidChange(() => this.loadReadmes());
    watcher.onDidCreate(() => this.loadReadmes());
    watcher.onDidDelete(() => this.loadReadmes());
    this.subs.push(watcher);
  }

  dispose() {
    this.subs.forEach(s => s.dispose());
    this.emitter.dispose();
  }

  /** Read each workspace folder's README badge. */
  async loadReadmes() {
    this.readmes.clear();
    for (var folder of vscode.workspace.workspaceFolders || []) {
      for (var name of ['README.md', 'readme.md', 'README']) {
        try {
          var text = new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, name)));
          var badge = parseReadmeBadge(text);
          if (badge) this.readmes.set(folder.uri.fsPath, badge);
          break;
        } catch (e) {
          // no README by that name
        }
      }
    }
    this.emitter.fire();
  }

  context(): ProjectContext {
    var folders: FolderInfo[] = (vscode.workspace.workspaceFolders || [])
      .filter(f => f.uri.scheme === 'file')
      .map(f => {
        var cfg = vscode.workspace.getConfiguration(CONFIG, f.uri);
        return {
          path: f.uri.fsPath,
          settings: {
            platform: cfg.get<string>('platform') || undefined,
            mainFile: cfg.get<string>('mainFile') || undefined,
            tool: cfg.get<string>('tool') || undefined,
          },
          folders: cfg.get<{ [dir: string]: ProjectSettings }>('folders') || {},
          readme: this.readmes.get(f.uri.fsPath),
        };
      });
    return { folders, window: this.windowProjects, builds: this.builds };
  }

  projects(): Project[] {
    return listProjects(this.context()).concat(this.windowProjects);
  }

  projectFor(uri: vscode.Uri | undefined): Project | undefined {
    if (!uri || uri.scheme !== 'file') return undefined;
    return projectFor(uri.fsPath, this.context());
  }

  /** True if some folder has settings or a badge, so detection needn't run. */
  folderHasProject(folder: vscode.WorkspaceFolder): boolean {
    return this.projects().some(p => p.folder === folder.uri.fsPath);
  }

  ////// builds

  recordBuild(rec: BuildRecord) {
    this.builds = [rec].concat(this.builds.filter(b => b.target !== rec.target)).slice(0, RECENT_BUILDS);
  }

  lastBuildOf(target: string): BuildRecord | undefined {
    return this.builds.find(b => b.target === target);
  }

  /** The most recent build of any target in this project. */
  lastBuildIn(project: Project): BuildRecord | undefined {
    return this.builds.find(b => b.project.scope === project.scope && b.project.platform === project.platform);
  }

  /** Every recent build that read this file. */
  buildsReading(file: string): BuildRecord[] {
    return this.builds.filter(b => b.target === file || b.paths.includes(file));
  }

  ////// run targets

  private targetKey(p: Project) {
    return 'runTarget:' + p.scope;
  }

  getTargetChoice(p: Project): RunTargetChoice {
    if (p.origin === 'window' || !p.folder) return this.memoryTargets.get(p.scope);
    return this.state.get<RunTargetChoice>(this.targetKey(p));
  }

  async setTargetChoice(p: Project, choice: RunTargetChoice) {
    if (choice && choice !== 'follow') choice = path.relative(p.root, choice);
    if (p.origin === 'window' || !p.folder) this.memoryTargets.set(p.scope, choice);
    else await this.state.update(this.targetKey(p), choice);
    this.emitter.fire();
  }

  /** The file Build and Run use for this project right now. */
  runTarget(p: Project, active: vscode.Uri | undefined): string | undefined {
    var last = this.lastBuildIn(p);
    var dep = (f: string) => this.builds.some(b => b.project.scope === p.scope && b.target !== f && b.paths.includes(f));
    var activeFile = active && active.scheme === 'file' ? active.fsPath : undefined;
    return resolveRunTarget(p, this.getTargetChoice(p), activeFile, last && last.target, dep);
  }

  ////// saving

  /** A choice for a file opened with no folder; lasts until the window closes. */
  addWindowProject(p: Project) {
    this.windowProjects = this.windowProjects.filter(w => w.scope !== p.scope).concat([p]);
    this.emitter.fire();
  }

  /**
   * Write a project to the settings of the workspace folder that holds
   * `dir`: top-level settings when `dir` is the folder itself, else an
   * 8bitworkshop.folders entry. `mainFile` is absolute (or unset for a
   * directory of programs). Returns false with no folder to write to.
   */
  async saveProject(dir: string, s: { platform: string, mainFile?: string, tool?: string }): Promise<boolean> {
    var folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(path.join(dir, '_')));
    if (!folder) return false;
    var cfg = vscode.workspace.getConfiguration(CONFIG, folder.uri);
    var target = (vscode.workspace.workspaceFolders || []).length > 1 ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
    var rel = path.relative(folder.uri.fsPath, dir).split(path.sep).join('/');
    var main = s.mainFile ? path.relative(dir, s.mainFile).split(path.sep).join('/') : undefined;
    if (rel === '') {
      await cfg.update('platform', s.platform, target);
      await cfg.update('mainFile', main || undefined, target);
      await cfg.update('tool', s.tool || undefined, target);
    } else {
      var folders = { ...(cfg.get<{ [dir: string]: ProjectSettings }>('folders') || {}) };
      var entry: ProjectSettings = { platform: s.platform };
      if (main) entry.mainFile = main;
      if (s.tool) entry.tool = s.tool;
      folders[rel] = entry;
      await cfg.update('folders', folders, target);
    }
    this.windowProjects = this.windowProjects.filter(w => !isInside(w.scope, dir));
    this.emitter.fire();
    return true;
  }

  /** Change one setting of an existing project, where it came from. */
  async updateProject(p: Project, change: { platform?: string, mainFile?: string | null, tool?: string | null }) {
    if (p.origin === 'window') {
      var next: Project = { ...p };
      if (change.platform) next.platform = change.platform;
      if (change.mainFile !== undefined) {
        next.mainFile = change.mainFile || undefined;
        next.root = next.mainFile ? path.dirname(next.mainFile) : next.scope;
      }
      if (change.tool !== undefined) next.tool = change.tool || undefined;
      this.addWindowProject(next);
      return;
    }
    await this.saveProject(p.scope, {
      platform: change.platform || p.platform,
      mainFile: change.mainFile === undefined ? p.mainFile : change.mainFile || undefined,
      tool: change.tool === undefined ? p.tool : change.tool || undefined,
    });
  }
}
