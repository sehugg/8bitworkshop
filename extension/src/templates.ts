// templates - examples and blank programs (out/presets.json), the read-only
// 8bws-preset: file system that shows them, and copying one into a folder.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { PlatformInfo, PresetIndex, TemplateInfo } from './presettypes';

export const PRESET_SCHEME = '8bws-preset';
// VS Code only allows commands in trusted Markdown that we list
const COPY_COMMAND = '8bitworkshop.copyToWorkspace';

export class Templates {
  private index: PresetIndex | null = null;

  constructor(readonly extensionPath: string, readonly rootDir: () => string) { }

  get(): PresetIndex {
    if (!this.index) {
      var file = path.join(this.extensionPath, 'out', 'presets.json');
      try {
        this.index = JSON.parse(fs.readFileSync(file, 'utf-8'));
      } catch (e) {
        throw new Error(`Cannot read the examples index (${file}). Run "npm run build" in extension/.`);
      }
    }
    return this.index;
  }

  platform(id: string): PlatformInfo | undefined {
    return this.get().platforms.find(p => p.id === id);
  }

  /** The platform and template behind an 8bws-preset: URI. */
  fromUri(uri: vscode.Uri): { platform: PlatformInfo, template?: TemplateInfo, file: string } | undefined {
    if (uri.scheme !== PRESET_SCHEME) return undefined;
    var [, id, ...rest] = uri.path.split('/');
    var platform = this.platform(id);
    if (!platform) return undefined;
    var file = rest.join('/');
    return { platform, template: platform.templates.find(t => t.id === file), file };
  }

  presetUri(platform: PlatformInfo, template: TemplateInfo): vscode.Uri {
    return vscode.Uri.from({ scheme: PRESET_SCHEME, path: `/${platform.id}/${template.id}` });
  }

  /** presets/<dir>/<file> on disk. */
  presetPath(platform: PlatformInfo, file: string): string {
    return path.join(this.rootDir(), 'presets', platform.dir, file);
  }

  ////// pickers

  /** Platforms grouped by family, `current` first. */
  async pickPlatform(title: string, current?: string): Promise<PlatformInfo | undefined> {
    type Item = vscode.QuickPickItem & { platform?: PlatformInfo };
    var items: Item[] = [];
    var platforms = this.get().platforms;
    var cur = platforms.find(p => p.id === current);
    if (cur) {
      items.push({ label: 'Current', kind: vscode.QuickPickItemKind.Separator });
      items.push({ label: cur.name, description: cur.id, platform: cur });
    }
    var family = '';
    for (var p of platforms) {
      if (p === cur) continue;
      if (p.family !== family) {
        family = p.family;
        items.push({ label: family, kind: vscode.QuickPickItemKind.Separator });
      }
      items.push({ label: p.name, description: p.id, platform: p });
    }
    var picked = await vscode.window.showQuickPick(items, { title, placeHolder: 'Platform', matchOnDescription: true });
    return picked?.platform;
  }

  /**
   * Templates for a platform: "Start here" first, then the examples by
   * category. Moving through the list previews each one read-only.
   */
  pickTemplate(platform: PlatformInfo, title: string): Promise<TemplateInfo | undefined> {
    type Item = vscode.QuickPickItem & { template?: TemplateInfo };
    var items: Item[] = [];
    var category = '';
    for (var t of platform.templates) {
      if (t.category !== category) {
        category = t.category;
        items.push({ label: category, kind: vscode.QuickPickItemKind.Separator });
      }
      var file = t.saveAs || t.id;
      items.push({
        label: t.name,
        description: `${file} · ${t.tool.replace(/^remote:/, '')}${t.remote ? ' (builds on a server)' : ''}`,
        template: t,
      });
    }
    return new Promise(resolve => {
      var qp = vscode.window.createQuickPick<Item>();
      qp.title = title;
      qp.placeholder = `${platform.name}: choose a blank program or an example`;
      qp.items = items;
      qp.matchOnDescription = true;
      var previewed: vscode.Uri | undefined;
      var done = false;
      qp.onDidChangeActive(async active => {
        var t = active[0]?.template;
        if (!t) return;
        previewed = this.presetUri(platform, t);
        try {
          await vscode.window.showTextDocument(previewed, { preview: true, preserveFocus: true, viewColumn: vscode.ViewColumn.Active });
        } catch (e) {
          // a template that can't open still gets picked
        }
      });
      qp.onDidAccept(() => {
        done = true;
        resolve(qp.selectedItems[0]?.template);
        qp.hide();
      });
      qp.onDidHide(() => {
        if (!done) {
          resolve(undefined);
          // don't leave a preview behind when the user backs out
          if (previewed) closePreview(previewed);
        }
        qp.dispose();
      });
      qp.show();
    });
  }

  ////// copying

  /**
   * Where a copy goes: an empty workspace folder itself, a new subfolder of
   * a folder with files, or (no folder, or "Elsewhere...") a new folder the
   * user names, which then opens.
   */
  async pickDestination(name: string): Promise<{ dir: vscode.Uri, open: boolean } | undefined> {
    var folder = vscode.workspace.workspaceFolders?.[0];
    if (folder && folder.uri.scheme === 'file') {
      var entries = await vscode.workspace.fs.readDirectory(folder.uri);
      var visible = entries.filter(([n]) => !n.startsWith('.'));
      if (visible.length === 0) return { dir: folder.uri, open: false };
      var input = vscode.window.createInputBox();
      var elsewhere: vscode.QuickInputButton = { iconPath: new vscode.ThemeIcon('folder-opened'), tooltip: 'Elsewhere...' };
      input.title = 'New folder for the project';
      input.prompt = `In ${folder.name}. Use the folder button to put it somewhere else.`;
      input.value = uniqueName(folder.uri.fsPath, name);
      input.buttons = [elsewhere];
      var result = await new Promise<string | 'elsewhere' | undefined>(resolve => {
        input.onDidAccept(() => { resolve(input.value.trim()); input.hide(); });
        input.onDidTriggerButton(() => { resolve('elsewhere'); input.hide(); });
        input.onDidHide(() => { resolve(undefined); input.dispose(); });
        input.show();
      });
      if (result === undefined || result === '') return undefined;
      if (result !== 'elsewhere') return { dir: vscode.Uri.joinPath(folder.uri, result), open: false };
    }
    var parent = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Create Project Here', title: 'Parent folder for the new project' });
    if (!parent || !parent[0]) return undefined;
    var folderName = await vscode.window.showInputBox({ title: 'Project folder name', value: uniqueName(parent[0].fsPath, name) });
    if (!folderName) return undefined;
    return { dir: vscode.Uri.joinPath(parent[0], folderName), open: true };
  }

  /**
   * Copy a template into `dir`. Asks before overwriting. Returns the main
   * file's URI, or undefined if the user cancelled.
   */
  async copy(platform: PlatformInfo, t: TemplateInfo, dir: vscode.Uri, withLibraries: boolean): Promise<vscode.Uri | undefined> {
    var files: [string, string][] = [[t.id, t.saveAs || t.id]];
    for (var f of t.files.concat(withLibraries ? t.shared : [])) files.push([f, f]);
    await vscode.workspace.fs.createDirectory(dir);
    var overwriteAll = false;
    for (var [from, to] of files) {
      var src = this.presetPath(platform, from);
      if (!fs.existsSync(src)) continue;
      var dest = vscode.Uri.joinPath(dir, to);
      if (!overwriteAll && await exists(dest)) {
        var answer = await vscode.window.showWarningMessage(`${to} already exists in ${path.basename(dir.fsPath)}.`, { modal: true },
          'Overwrite', 'Overwrite All', 'Skip');
        if (!answer) return undefined;
        if (answer === 'Skip') continue;
        if (answer === 'Overwrite All') overwriteAll = true;
      }
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(dest, '..'));
      await vscode.workspace.fs.writeFile(dest, fs.readFileSync(src));
    }
    return vscode.Uri.joinPath(dir, t.saveAs || t.id);
  }
}

/** Serves presets/ read-only under 8bws-preset:/<platform>/<file>. */
export class PresetFileSystem implements vscode.FileSystemProvider {
  private emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this.emitter.event;

  constructor(readonly templates: Templates) { }

  static readonlyMessage(): vscode.MarkdownString {
    var md = new vscode.MarkdownString(`Examples are read-only. [Copy to Workspace](command:${COPY_COMMAND}) to edit this one.`);
    md.isTrusted = { enabledCommands: [COPY_COMMAND] };
    return md;
  }

  private resolve(uri: vscode.Uri): string {
    var [, id, ...rest] = uri.path.split('/');
    var platform = id && this.templates.platform(id);
    if (!platform) throw vscode.FileSystemError.FileNotFound(uri);
    var dir = path.join(this.templates.rootDir(), 'presets', platform.dir);
    var file = path.resolve(dir, rest.join('/'));
    if (!file.startsWith(dir)) throw vscode.FileSystemError.NoPermissions(uri);
    return file;
  }

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => { });
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    if (uri.path === '/' || uri.path.split('/').length === 2) {
      return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0, permissions: vscode.FilePermission.Readonly };
    }
    try {
      var st = fs.statSync(this.resolve(uri));
    } catch (e) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return {
      type: st.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
      ctime: st.ctimeMs, mtime: st.mtimeMs, size: st.size, permissions: vscode.FilePermission.Readonly,
    };
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    if (uri.path === '/' || uri.path === '') {
      return this.templates.get().platforms.map(p => [p.id, vscode.FileType.Directory] as [string, vscode.FileType]);
    }
    var dir = this.resolve(uri);
    return fs.readdirSync(dir, { withFileTypes: true })
      .map(d => [d.name, d.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File] as [string, vscode.FileType]);
  }

  readFile(uri: vscode.Uri): Uint8Array {
    try {
      return fs.readFileSync(this.resolve(uri));
    } catch (e) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
  }

  createDirectory(uri: vscode.Uri): void { throw vscode.FileSystemError.NoPermissions(uri); }
  writeFile(uri: vscode.Uri): void { throw vscode.FileSystemError.NoPermissions(uri); }
  delete(uri: vscode.Uri): void { throw vscode.FileSystemError.NoPermissions(uri); }
  rename(uri: vscode.Uri): void { throw vscode.FileSystemError.NoPermissions(uri); }
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (e) {
    return false;
  }
}

/** `name` with its extension dropped and a number added if it's taken. */
function uniqueName(parent: string, name: string): string {
  var base = name.replace(/\.[^.]*$/, '').replace(/^skeleton$/, 'project');
  var n = base;
  for (var i = 2; fs.existsSync(path.join(parent, n)); i++) n = base + '-' + i;
  return n;
}

function closePreview(uri: vscode.Uri) {
  for (var group of vscode.window.tabGroups.all) {
    for (var tab of group.tabs) {
      if (tab.isPreview && tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === uri.toString()) {
        vscode.window.tabGroups.close(tab);
      }
    }
  }
}
