// presets - the examples and blank programs index (presets.json, written by
// extension/scripts/presetindex.ts) and copying one into a directory. Shared
// by the 8bws `presets` and `new` commands and the VS Code extension's
// "new project" flow.

import * as fs from 'fs';
import * as path from 'path';
import type { PlatformInfo, PresetIndex, TemplateInfo } from './presettypes';
import { UNSUPPORTED_PLATFORMS } from './exclusions';
import { getRootBasePlatform } from '../common/util';

export type { PlatformInfo, PresetIndex, TemplateInfo };

/** presets.json: next to the bundle (npm, extension), else a checkout's build. */
export function findPresetIndex(root: string, bundleDir: string): string | null {
  for (const file of [path.join(bundleDir, 'presets.json'), path.join(root, 'extension', 'out', 'presets.json')]) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/**
 * The index minus what this install can't build: unsupported platforms (cpc.6128
 * counts as cpc), and with `providesTool` the examples whose tool is missing.
 */
export function readPresetIndex(file: string, providesTool: (tool: string) => boolean = () => true): PresetIndex {
  const index: PresetIndex = JSON.parse(fs.readFileSync(file, 'utf-8'));
  index.platforms = index.platforms.filter((p) => !UNSUPPORTED_PLATFORMS.includes(getRootBasePlatform(p.id)));
  for (const p of index.platforms) p.templates = p.templates.filter((t) => providesTool(t.tool.replace(/^remote:/, '')));
  return index;
}

/** The source file a template is saved as: blank programs get main.<ext>. */
export function savedName(t: TemplateInfo): string {
  return t.saveAs || t.id;
}

/**
 * The files to copy for a template, as [name in presets/<dir>, name in the
 * copy]: the main file, the files only this template reads, and with
 * `libraries` the ones other templates read too. Without them, a build still
 * finds the shared ones in presets/.
 */
export function templateFiles(t: TemplateInfo, libraries: boolean): [string, string][] {
  const files: [string, string][] = [[t.id, savedName(t)]];
  for (const f of t.files.concat(libraries ? t.shared : [])) files.push([f, f]);
  return files;
}

/**
 * A template by a user's spelling: "nes/hello.c", "nes/hello" (extension
 * left off), "nes/skeleton.cc65", case ignored. Throws, listing the matches,
 * if it names none or more than one.
 */
export function findTemplate(index: PresetIndex, spec: string): { platform: PlatformInfo, template: TemplateInfo } {
  const slash = spec.indexOf('/');
  if (slash <= 0 || slash === spec.length - 1) throw new Error(`Name a preset as <platform>/<file>, like nes/hello.c. Try: 8bws presets`);
  const platform = index.platforms.find((p) => p.id === spec.slice(0, slash).toLowerCase());
  if (!platform) throw new Error(`No platform '${spec.slice(0, slash)}'. Try: 8bws presets`);
  const want = spec.slice(slash + 1).toLowerCase();
  const stem = (s: string) => s.toLowerCase().replace(/\.[^./]+$/, '');
  const exact = platform.templates.filter((t) => t.id.toLowerCase() === want);
  const found = exact.length ? exact : platform.templates.filter((t) => stem(t.id) === want);
  if (found.length === 1) return { platform, template: found[0] };
  const names = (found.length ? found : platform.templates).map((t) => t.id).join(', ');
  throw new Error(found.length
    ? `'${spec}' matches ${found.length} presets (${names}); give the extension.`
    : `No preset '${spec.slice(slash + 1)}' for ${platform.id}. Available: ${names}`);
}

/**
 * Copy a template from `presetsDir` (the asset root's presets/) into `dir`,
 * creating it. Refuses to replace existing files unless `force`. Returns the
 * files written, relative to `dir`, main file first.
 */
export function copyTemplate(presetsDir: string, platform: PlatformInfo, t: TemplateInfo, dir: string,
  opts: { libraries?: boolean, force?: boolean } = {}): string[] {
  const src = path.join(presetsDir, platform.dir);
  const files = templateFiles(t, !!opts.libraries)
    .map(([from, to]) => ({ from: path.resolve(src, from), to, dest: path.resolve(dir, to) }));
  for (const f of files) {
    // names come from our own index, but keep a bad one from leaving `dir`
    if (path.relative(path.resolve(dir), f.dest).startsWith('..')) throw new Error(`Bad file name in preset: ${f.to}`);
  }
  const present = files.filter((f) => fs.existsSync(f.from));
  if (!present.length || present[0].to !== savedName(t)) throw new Error(`${t.id} isn't in ${src}`);
  const clash = present.filter((f) => fs.existsSync(f.dest)).map((f) => f.to);
  if (clash.length && !opts.force) throw new Error(`${clash.join(', ')} already in ${dir}. Use --force to overwrite, or pick another directory.`);
  for (const f of present) {
    fs.mkdirSync(path.dirname(f.dest), { recursive: true });
    fs.copyFileSync(f.from, f.dest);
  }
  return present.map((f) => f.to);
}
