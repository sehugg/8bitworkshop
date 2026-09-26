// detection - finds the platform for code the user already has: a file
// they chose (Set as Main File, or Run with no project) or a folder they
// opened. Uses the shared detector in src/common/detect.ts.

import * as vscode from 'vscode';
import * as path from 'path';
import { Detection, detectProject, detectionSummary, describeDetection, describeFinding, isBuildableSource, isClearWinner, isFolderOfPrograms, isStrongDetection, toolForDialect } from '../../src/common/detect';
export { detectionSummary, describeDetection, describeFinding, isFolderOfPrograms };
import { PLATFORM_PARAMS } from '../../src/worker/platforms';
import { getToolForPlatform } from '../../src/common/toolselect';
import { isProbablyBinary } from '../../src/common/util';
import type { Templates } from './templates';

const MAX_SCAN_FILES = 3000;
const DONT_ASK = 'dontAskToDetect:';

/** Platform ids detection chooses among: the ones the IDE's menu lists, else the worker's. */
export function detectablePlatforms(templates: Templates): string[] {
  var ids = new Set<string>();
  try {
    for (var p of templates.get().platforms) ids.add(p.id);
  } catch (e) {
    // no index: fall back to the build worker's list
  }
  for (var id of Object.keys(PLATFORM_PARAMS)) if (id.indexOf('.') < 0) ids.add(id);
  return [...ids];
}

export function platformName(templates: Templates, id: string): string {
  try {
    return templates.platform(id)?.name || id;
  } catch (e) {
    return id;
  }
}

async function readText(uri: vscode.Uri): Promise<string | null> {
  if (isProbablyBinary(uri.path)) return null;
  var doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
  if (doc) return doc.getText();
  try {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch (e) {
    return null;
  }
}

/** Detect for one directory, given the files in it (names relative to it). */
export async function detectDirectory(templates: Templates, dir: vscode.Uri, files: string[]): Promise<Detection[]> {
  var headers: { [h: string]: string[] } = {};
  try {
    headers = templates.get().headers;
  } catch (e) {
    // detection still works from system headers and fingerprints
  }
  return detectProject({
    files, headers,
    platforms: detectablePlatforms(templates),
    read: (f) => readText(vscode.Uri.joinPath(dir, f)),
    dirName: path.basename(dir.fsPath),
  });
}

export interface FileChoice {
  platform: string;
  tool?: string;
}

/**
 * Case 2: the user asked to use this file. Detect from it and its
 * neighbors, confirm the platform (and a dialect's tool), and return it.
 */
export async function chooseForFile(templates: Templates, file: vscode.Uri): Promise<FileChoice | undefined> {
  var dir = vscode.Uri.joinPath(file, '..');
  var main = path.basename(file.fsPath);
  var neighbors: string[] = [];
  try {
    neighbors = (await vscode.workspace.fs.readDirectory(dir))
      .filter(([n, t]) => t === vscode.FileType.File && n !== main && (/\.(h|inc|i|cfg|mk)$/i.test(n) || /^(makefile|readme(\.md)?)$/i.test(n)))
      .map(([n]) => n);
  } catch (e) {
    // an unsaved or remote file has no neighbors to read
  }
  var found = await detectDirectory(templates, dir, [main, ...neighbors]);
  var platform: string | undefined;
  if (isClearWinner(found)) {
    platform = found[0].platform;
    // the user asked, so apply it now and offer a way out
    vscode.window.showInformationMessage(`Using ${platformName(templates, platform)} (${describeDetection(found[0])}).`, 'Change')
      .then(async a => {
        if (a === 'Change') vscode.commands.executeCommand('8bitworkshop.selectPlatform');
      });
  } else {
    platform = await pickPlatformWithEvidence(templates, found, `Platform for ${main}`);
  }
  if (!platform) return undefined;
  var text = await readText(file);
  var tool = await confirmDialect(platform, main, text);
  if (tool === null) return undefined;
  return { platform, tool };
}

/** A quick pick with the detected candidates first, each with its evidence. */
export async function pickPlatformWithEvidence(templates: Templates, found: Detection[], title: string): Promise<string | undefined> {
  type Item = vscode.QuickPickItem & { id?: string };
  var items: Item[] = [];
  var shown = new Set<string>();
  var candidates = found.filter(d => d.score > 0.1).slice(0, 6);
  if (candidates.length) {
    items.push({ label: 'Detected', kind: vscode.QuickPickItemKind.Separator });
    for (var d of candidates) {
      shown.add(d.platform);
      items.push({ label: platformName(templates, d.platform), description: d.platform, detail: describeDetection(d), id: d.platform });
    }
    items.push({ label: 'All platforms', kind: vscode.QuickPickItemKind.Separator });
  }
  var all: { id: string, name: string }[] = [];
  try {
    all = templates.get().platforms.map(p => ({ id: p.id, name: p.name }));
  } catch (e) {
    all = detectablePlatforms(templates).map(id => ({ id, name: id }));
  }
  for (var p of all) if (!shown.has(p.id)) items.push({ label: p.name, description: p.id, id: p.id });
  var picked = await vscode.window.showQuickPick(items, { title, placeHolder: 'Platform', matchOnDescription: true });
  return picked?.id;
}

/**
 * If the file is written for another assembler than its extension picks,
 * ask which to use. Returns the tool to store (undefined for the default),
 * or null if the user backed out.
 */
async function confirmDialect(platform: string, file: string, text: string | null): Promise<string | undefined | null> {
  if (!text) return undefined;
  var dialect = toolForDialect(platform, file, text);
  if (!dialect) return undefined;
  var chosen = getToolForPlatform(platform, file);
  var ext = path.extname(file);
  var answer = await vscode.window.showWarningMessage(
    `This looks like ${dialect} code; ${ext} builds with ${chosen}.`, `Use ${dialect}`, `Keep ${chosen}`);
  if (!answer) return null;
  return answer === `Use ${dialect}` ? dialect : undefined;
}

export interface FolderFinding {
  dir: vscode.Uri;
  detection: Detection;
}

/**
 * Case 3: scan a folder for projects. Returns each directory whose code
 * points strongly at one platform; plain C or assembly alone never counts.
 */
export async function scanFolder(templates: Templates, folder: vscode.WorkspaceFolder): Promise<FolderFinding[]> {
  var exclude = '{**/node_modules/**,**/.git/**,**/out/**,**/build/**}';
  var uris = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*'), exclude, MAX_SCAN_FILES);
  var byDir = new Map<string, string[]>();
  for (var uri of uris) {
    var dir = path.dirname(uri.fsPath);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(path.basename(uri.fsPath));
  }
  var findings: FolderFinding[] = [];
  for (var [dir, files] of byDir) {
    if (!files.some(f => isBuildableSource(f) || /\.(nes|a26|a78|gb|col|sms)$/i.test(f))) continue;
    var found = await detectDirectory(templates, vscode.Uri.file(dir), files);
    if (found.length && isStrongDetection(found[0]) && isClearWinner(found)) {
      findings.push({ dir: vscode.Uri.file(dir), detection: found[0] });
    }
  }
  // a folder of programs already covers a nested library folder inside it;
  // a nested project with its own main file stays
  findings = findings.filter(f => !findings.some(p =>
    p !== f && isFolderOfPrograms(p.detection) && !f.detection.mainFile && isInsideDir(p.dir.fsPath, f.dir.fsPath)));
  return findings;
}

function isInsideDir(parent: string, child: string): boolean {
  var rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function dontAskKey(folder: vscode.WorkspaceFolder) {
  return DONT_ASK + folder.uri.toString();
}

