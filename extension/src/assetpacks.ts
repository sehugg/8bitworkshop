// assetpacks - which toolchain files go in which downloadable pack, and the
// format they ship in (.tar.br). scripts/assetpack.ts builds the packs; assets.ts
// downloads and unpacks them.

import * as zlib from 'zlib';
import { promisify } from 'util';

/** Repo directories the packs are made from (git-tracked files only). */
export const ASSET_DIRS = ['src/worker/wasm', 'src/worker/fs', 'src/worker/asmjs', 'src/worker/lib', 'presets', 'res'];

/**
 * Tracked res files the extension never loads: Altirra debug listings, and the
 * x86 BIOSes (x86 isn't offered in the extension). Everything else under res/
 * (kernels, BIOSes, wasm cores) goes in the base pack.
 */
export const ASSET_EXCLUDE = /^res\/(altirra\/.*\.(lab|lst)|freedos722\.img|seabios\.bin|vgabios\.bin)$/;

/** Files outside ASSET_DIRS that a pack also carries, from the repo root. */
export const EXTRA_FILES: { [pack: string]: string[] } = {
  // the Verilog emulator compiles HDL to WASM with binaryen (see binaryen.js)
  verilog: ['node_modules/binaryen/index.js'],
};

// verilator, silice and silice's preload package are only used by Verilog
const VERILOG_FILES = /^src\/worker\/(wasm\/(verilator_bin|silice)\.|fs\/fsSilice\.)/;

export type PackName = 'base' | 'verilog';
export const PACKS: PackName[] = ['base', 'verilog'];

/** The pack a file under ASSET_DIRS belongs to. */
export function packForFile(file: string): PackName {
  return VERILOG_FILES.test(file) ? 'verilog' : 'base';
}

/** The packs a platform needs to build and run. */
export function packsForPlatform(platform?: string): PackName[] {
  return platform && platform.startsWith('verilog') ? ['base', 'verilog'] : ['base'];
}

/** One pack, as listed in out/assets.json. */
export interface PackInfo {
  /** file name on the asset server; includes the hash, so it never changes */
  file: string;
  size: number;
  sha256: string;
  /** number of files inside */
  count: number;
}

/** out/assets.json: the packs this build of the extension expects. */
export interface AssetManifest {
  /** the IDE version the assets come from (the repo's package.json) */
  ideVersion: string;
  packs: { [pack: string]: PackInfo };
}

/** Brotli quality for packs: 11 is smallest (minutes for the base pack). */
export const BROTLI_QUALITY = 11;

/**
 * One tar of the files, in order, compressed with Brotli. Compressing the
 * whole archive, not each file, halves the size of a zip: toolchain files
 * repeat across packages. The same input always gives the same bytes.
 */
export async function makePack(files: { path: string, data: Uint8Array }[], quality = BROTLI_QUALITY): Promise<Uint8Array> {
  var tar = makeTar(files);
  var out = await promisify(zlib.brotliCompress)(tar, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: quality,
      [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: tar.length,
    },
  });
  return new Uint8Array(out.buffer, out.byteOffset, out.length);
}

/** The files in a pack made by makePack. */
export async function readPack(data: Uint8Array): Promise<{ path: string, data: Uint8Array }[]> {
  var tar = await promisify(zlib.brotliDecompress)(data);
  return readTar(new Uint8Array(tar.buffer, tar.byteOffset, tar.length));
}

////// tar (ustar: regular files only, fixed metadata)

const BLOCK = 512;

function tarHeader(name: string, size: number): Uint8Array {
  var h = new Uint8Array(BLOCK);
  var put = (s: string, ofs: number, len: number) => {
    var b = Buffer.from(s, 'utf-8');
    if (b.length > len) throw new Error(`tar: name too long: ${name}`);
    h.set(b, ofs);
  };
  var octal = (n: number, ofs: number, len: number) => put(n.toString(8).padStart(len - 1, '0'), ofs, len - 1);
  // names over 100 bytes split at a slash into prefix/name
  var prefix = '';
  if (Buffer.byteLength(name) > 100) {
    var cut = name.lastIndexOf('/', 155);
    prefix = name.slice(0, cut);
    name = name.slice(cut + 1);
  }
  put(name, 0, 100);
  octal(0o644, 100, 8);    // mode
  octal(0, 108, 8);        // uid
  octal(0, 116, 8);        // gid
  octal(size, 124, 12);
  octal(0, 136, 12);       // mtime
  h.fill(0x20, 148, 156);  // checksum counts as spaces
  h[156] = 0x30;           // '0': regular file
  put('ustar', 257, 6);
  put('00', 263, 2);
  put(prefix, 345, 155);
  var sum = h.reduce((a, b) => a + b, 0);
  put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return h;
}

function makeTar(files: { path: string, data: Uint8Array }[]): Uint8Array {
  var size = BLOCK * 2;
  for (var f of files) size += BLOCK + Math.ceil(f.data.length / BLOCK) * BLOCK;
  var out = new Uint8Array(size);
  var ofs = 0;
  for (var f of files) {
    out.set(tarHeader(f.path, f.data.length), ofs);
    out.set(f.data, ofs + BLOCK);
    ofs += BLOCK + Math.ceil(f.data.length / BLOCK) * BLOCK;
  }
  return out;
}

function readTar(tar: Uint8Array): { path: string, data: Uint8Array }[] {
  var str = (ofs: number, len: number) => {
    var end = tar.indexOf(0, ofs);
    return Buffer.from(tar.subarray(ofs, end < 0 || end > ofs + len ? ofs + len : end)).toString('utf-8');
  };
  var files: { path: string, data: Uint8Array }[] = [];
  for (var ofs = 0; ofs + BLOCK <= tar.length && tar[ofs] !== 0;) {
    var name = str(ofs, 100);
    var prefix = str(ofs + 345, 155);
    var size = parseInt(str(ofs + 124, 12).trim(), 8);
    var type = tar[ofs + 156];
    if (isNaN(size)) throw new Error('tar: bad header');
    if (type === 0x30 || type === 0) {
      files.push({ path: prefix ? prefix + '/' + name : name, data: tar.subarray(ofs + BLOCK, ofs + BLOCK + size) });
    }
    ofs += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
  }
  return files;
}
