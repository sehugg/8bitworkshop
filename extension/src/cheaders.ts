// What a host C parser (clangd, cpptools) needs to read cc65 and SDCC
// code: the toolchain's headers, extracted from the worker's filesystem
// packages (emscripten .data or WASI .zip) and patched where clang can't parse them; the defines the build
// passes; and flags that match the compiler's dialect. Forced-include shims
// in extension/shims/ hide the keywords a macro can hide.
// No vscode import: scripts/clangcheck.ts and the extension share it.

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { TOOL_META, getSharedFileSystemName, getIncludeDirs } from '../../src/common/toolmeta';
import { PLATFORM_PARAMS } from '../../src/worker/platforms';

export interface PackageFile { path: string; data: Buffer; }

/** Files in an emscripten preload package (src/worker/fs/fs<name>.data). */
export function readPreloadPackage(workerDir: string, fsName: string): PackageFile[] {
  const base = path.join(workerDir, 'fs', `fs${fsName}`);
  const meta = JSON.parse(fs.readFileSync(`${base}.js.metadata`, 'utf8'));
  const data = fs.readFileSync(`${base}.data`);
  return meta.files.map((f: any) => ({ path: f.filename, data: data.subarray(f.start, f.end) }));
}

/** Files in a WASI filesystem zip (src/worker/fs/<name>.zip), at '/' + their zip path. */
export function readWASIZipPackage(workerDir: string, zipName: string): PackageFile[] {
  const zip = fs.readFileSync(path.join(workerDir, 'fs', zipName));
  // the end-of-central-directory record gives the central directory's offset
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error(`${zipName}: not a zip file`);
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  const files: PackageFile[] = [];
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10);
    const csize = zip.readUInt32LE(p + 20);
    const namelen = zip.readUInt16LE(p + 28);
    const extralen = zip.readUInt16LE(p + 30);
    const commentlen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.toString('utf8', p + 46, p + 46 + namelen);
    p += 46 + namelen + extralen + commentlen;
    if (name.endsWith('/')) continue; // directory
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const raw = zip.subarray(start, start + csize);
    if (method !== 0 && method !== 8) throw new Error(`${zipName}: ${name} uses unsupported compression ${method}`);
    files.push({ path: '/' + name, data: method === 8 ? zlib.inflateRawSync(raw) : raw });
  }
  return files;
}

/** Rewrites what clang rejects in a toolchain header but the compiler accepts. */
export function patchHeaderForClang(tool: string, text: string): string {
  if (tool === 'cc65') {
    // cc65 allows arrays of void for driver addresses
    return text.replace(/extern (const )?void (\w+)\[\]/g, 'extern $1unsigned char $2[]');
  }
  if (tool === 'sdcc') {
    return text
      // __sfr __at 0xbe port; -> __at(0xbe), which the shim's macro takes
      .replace(/__at\s+(0x[0-9A-Fa-f]+|\d+)/g, '__at($1)')
      // inline assembly in header functions
      .replace(/__asm\b(?!__)[\s\S]*?__endasm\s*;/g, ';');
  }
  return text;
}

/**
 * Writes a tool's patched headers under outDir: the filesystem package's
 * files at their own paths (/include/..., /share/cc65/include/...), and the platform's lib directory
 * (src/worker/lib/<platform>, which the worker copies into the build) in
 * /lib. Returns the files written.
 */
export function extractHeaders(workerDir: string, tool: string, platform: string, outDir: string): string[] {
  const files: PackageFile[] = [];
  const fsName = getSharedFileSystemName(tool, platform);
  if (fsName && fsName.startsWith('wasi:')) files.push(...readWASIZipPackage(workerDir, fsName.substring(5)));
  else if (fsName) files.push(...readPreloadPackage(workerDir, fsName));
  // subdirectories too: GBDK's headers are gb/gb.h and so on
  const libDir = path.join(workerDir, 'lib', platform);
  if (fs.existsSync(libDir)) {
    for (const f of fs.readdirSync(libDir, { recursive: true }) as string[]) {
      if (/\.h$/i.test(f))
        files.push({ path: `/lib/${f.split(path.sep).join('/')}`, data: fs.readFileSync(path.join(libDir, f)) });
    }
  }
  const written: string[] = [];
  for (const f of files) {
    if (!/\.h$/i.test(f.path)) continue;
    const out = path.join(outDir, f.path);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, patchHeaderForClang(tool, f.data.toString('latin1')), 'latin1');
    written.push(out);
  }
  return written;
}

export interface ClangConfig {
  /** clang --target: msp430 has cc65's and SDCC's 16-bit int and pointers */
  target: string;
  std: string;
  defines: string[];     // NAME or NAME=value
  includeDirs: string[];
  forcedInclude: string;
  flags: string[];
}

/**
 * The clang configuration for a C file built by `tool` on `platform`.
 * headerDir is extractHeaders()'s outDir; shimDir holds cc65.h and sdcc.h.
 */
export function clangConfig(tool: string, platform: string, dirs: {
  headerDir: string; shimDir: string; sourceDir: string;
}): ClangConfig | undefined {
  const params: any = (PLATFORM_PARAMS as any)[platform] || {};
  const defines = ['__8BITWORKSHOP__', ...(params.define || [])];
  // the worker stages the platform's lib directory (extra_compile_files) in
  // the build directory, next to the source; extractHeaders() puts it in /lib
  const libDir = path.join(dirs.headerDir, 'lib');
  const includeDirs = [dirs.sourceDir, libDir];
  // -D and -I from extra_preproc_args; '.' is the build directory
  const extra: string[] = params.extra_preproc_args || [];
  for (let i = 0; i < extra.length - 1; i++) {
    if (extra[i] === '-D') defines.push(extra[++i]);
    else if (extra[i] === '-I') {
      const dir = extra[++i];
      if (dir !== '.') includeDirs.push(dir.replace(/^\/share/, dirs.headerDir));
    }
  }
  // the first of the tool's include dirs, as extractHeaders() wrote it
  const includeRoot = path.join(dirs.headerDir, getIncludeDirs(tool, platform)[0] || '/include');
  if (tool === 'cc65') {
    return {
      target: 'msp430', std: 'gnu89',
      defines: ['__CC65__', ...defines],
      includeDirs: [...includeDirs, includeRoot],
      forcedInclude: path.join(dirs.shimDir, 'cc65.h'),
      // char is unsigned; the worker passes -W -pointer-sign
      flags: ['-funsigned-char', '-Wno-pointer-sign', '-Wno-main-return-type'],
    };
  }
  if (tool === 'sdcc') {
    const cpu = params.arch === 'gbz80' ? 'gbz80' : 'z80';
    const version = (TOOL_META.sdcc.version || '').split('.');
    return {
      target: 'msp430', std: 'gnu99',
      defines: [`SDCC=${version.join('')}`, `__SDCC=${version.join('_')}`,
        `__SDCC_${cpu}`, `__${cpu}`, `SDCC_${cpu}`, ...defines],
      includeDirs: [...includeDirs, includeRoot],
      forcedInclude: path.join(dirs.shimDir, 'sdcc.h'),
      // sdcc builds with --less-pedantic, which allows these
      flags: ['-funsigned-char', '-Wno-pointer-sign',
        '-Wno-error=int-conversion', '-Wno-error=incompatible-function-pointer-types',
        '-Wno-error=implicit-function-declaration', '-Wno-error=implicit-int'],
    };
  }
  return undefined;
}

/** clang command-line arguments for a ClangConfig (compile_commands.json, clang -fsyntax-only) */
export function clangArgs(c: ClangConfig): string[] {
  return [`--target=${c.target}`, `-std=${c.std}`, '-nostdinc',
    ...c.defines.map((d) => `-D${d}`),
    ...c.includeDirs.map((d) => `-I${d}`),
    '-include', c.forcedInclude,
    '-Wno-unknown-pragmas', ...c.flags];
}
