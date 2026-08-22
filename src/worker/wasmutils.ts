
// WebAssembly module cache
// for Emscripten-compiled functions

import { BuildStep, PWORKER, endtime, starttime } from "./builder";

/// <reference types="emscripten" />
export interface EmscriptenModule {
  callMain: (args: string[]) => void;
  FS: any; // TODO
}

declare function importScripts(path: string);

const ENVIRONMENT_IS_WEB = typeof window === 'object';
const ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
export const emglobal: any = ENVIRONMENT_IS_WORKER ? self : ENVIRONMENT_IS_WEB ? window : global;

// simple CommonJS module loader
// TODO: relative paths for dependencies
if (!emglobal['require']) {
  emglobal['require'] = (modpath: string) => {
    if (modpath.endsWith('.js')) modpath = modpath.slice(-3);
    var modname = modpath.split('/').slice(-1)[0];
    var hasNamespace = emglobal[modname] != null;
    console.log('@@@ require', modname, modpath, hasNamespace);
    if (!hasNamespace) {
      exports = {};
      importScripts(`${modpath}.js`);
    }
    if (emglobal[modname] == null) {
      emglobal[modname] = exports; // TODO: always put in global scope?
    }
    return emglobal[modname]; // TODO
  }
}

// TODO: leaks memory even when disabled...
var _WASM_module_cache = {};
var CACHE_WASM_MODULES = true; // if false, use asm.js only

// TODO: which modules need this?
var wasmMemory;
export function getWASMMemory() {
  if (wasmMemory == null) {
    wasmMemory = new WebAssembly.Memory({
      'initial': 1024,  // 64MB
      'maximum': 16384, // 1024MB
    });
  }
  return wasmMemory;
}
export function getWASMBinary(module_id: string) {
  return wasmBlob[module_id];
}
function getWASMModule(module_id: string) {
  var module = _WASM_module_cache[module_id];
  if (!module) {
    starttime();
    module = new WebAssembly.Module(wasmBlob[module_id]);
    if (CACHE_WASM_MODULES) {
      _WASM_module_cache[module_id] = module;
      delete wasmBlob[module_id];
    }
    endtime("module creation " + module_id);
  }
  return module;
}
// function for use with instantiateWasm
export function moduleInstFn(module_id: string) {
  return function (imports, ri) {
    var mod = getWASMModule(module_id);
    var inst = new WebAssembly.Instance(mod, imports);
    ri(inst);
    return inst.exports;
  }
}

export function execMain(step: BuildStep, mod, args: string[]) {
  starttime();
  var run = mod.callMain || mod.run; // TODO: run?
  run(args);
  endtime(step.tool);
  console.log('exec', step.tool, args.join(' '));
}

/// asm.js / WASM / filesystem loading

export var fsMeta = {};
var fsBlob = {};
var wasmBlob = {};

// load filesystems for CC65 and others asynchronously
export function loadFilesystem(name: string) {
  var xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';
  xhr.open("GET", PWORKER + "fs/fs" + name + ".data", false);  // synchronous request
  xhr.send(null);
  fsBlob[name] = xhr.response;
  xhr = new XMLHttpRequest();
  xhr.responseType = 'json';
  xhr.open("GET", PWORKER + "fs/fs" + name + ".js.metadata", false);  // synchronous request
  xhr.send(null);
  fsMeta[name] = xhr.response;
  console.log("Loaded " + name + " filesystem", fsMeta[name].files.length, 'files', fsBlob[name].size, 'bytes');
}

var loaded = {};
export function load(modulename: string, debug?: boolean) {
  if (!loaded[modulename]) {
    importScripts(PWORKER + 'asmjs/' + modulename + (debug ? "." + debug + ".js" : ".js"));
    loaded[modulename] = 1;
  }
}
export function loadWASMBinary(modulename: string) {
  if (!loaded[modulename]) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.open("GET", PWORKER + "wasm/" + modulename + ".wasm", false);  // synchronous request
    xhr.send(null);
    if (xhr.response) {
      wasmBlob[modulename] = new Uint8Array(xhr.response);
      console.log("Loaded " + modulename + ".wasm (" + wasmBlob[modulename].length + " bytes)");
      loaded[modulename] = 1;
    } else {
      throw Error("Could not load WASM file " + modulename + ".wasm");
    }
  }
  return wasmBlob[modulename];
}
export function loadWASM(modulename: string, debug?: boolean) {
  if (!loaded[modulename]) {
    importScripts(PWORKER + "wasm/" + modulename + (debug ? "." + debug + ".js" : ".js"));
    loadWASMBinary(modulename);
  }
}
export function loadNative(modulename: string) {
  // detect WASM
  if (CACHE_WASM_MODULES && typeof WebAssembly === 'object') {
    loadWASM(modulename);
  } else {
    load(modulename);
  }
}

// mount the filesystem at /share
export function setupFS(FS, name: string) {
  var WORKERFS = FS.filesystems['WORKERFS'];
  if (name === '65-vector') name = '65-none'; // TODO
  if (name === '65-atari7800') name = '65-none'; // TODO
  if (name === '65-devel') name = '65-none'; // TODO
  if (name === '65-vcs') name = '65-atari2600'; // TODO
  if (name === '65-exidy') name = '65-none'; // TODO
  if (!fsMeta[name]) throw Error("No filesystem for '" + name + "'");
  FS.mkdir('/share');
  FS.mount(WORKERFS, {
    packages: [{ metadata: fsMeta[name], blob: fsBlob[name] }]
  }, '/share');
  // fix for slow Blob operations by caching typed arrays
  // https://github.com/kripken/emscripten/blob/incoming/src/library_workerfs.js
  // https://bugs.chromium.org/p/chromium/issues/detail?id=349304#c30
  var reader = WORKERFS.reader;
  var blobcache = {};
  WORKERFS.stream_ops.read = function (stream, buffer, offset, length, position) {
    if (position >= stream.node.size) return 0;
    var contents = blobcache[stream.path];
    if (!contents) {
      var ab = reader.readAsArrayBuffer(stream.node.contents);
      contents = blobcache[stream.path] = new Uint8Array(ab);
    }
    if (position + length > contents.length)
      length = contents.length - position;
    for (var i = 0; i < length; i++) {
      buffer[offset + i] = contents[position + i];
    }
    return length;
  };
}

export var print_fn = function (s: string) {
  console.log(s);
  //console.log(new Error().stack);
}

/// shared code in filesystem packages (headers, asm includes, ...)

export interface SharedFileEntry {
  filename: string;
  start: number;
  end: number;
}

/** Make sure a filesystem package is loaded (synchronous XHR, worker-only). */
export function ensureFilesystem(name: string) {
  if (!fsMeta[name]) loadFilesystem(name);
}

/** Find an entry in the filesystem package metadata. */
export function getSharedFileEntry(name: string, path: string): SharedFileEntry | null {
  ensureFilesystem(name);
  let meta = fsMeta[name];
  if (!meta || !meta.files) return null;
  for (let f of meta.files) {
    if (f.filename == path) return f;
  }
  return null;
}

/** List files under a directory prefix (e.g. '/include') of a filesystem package. */
export function listSharedFiles(name: string, dir: string): string[] {
  ensureFilesystem(name);
  let meta = fsMeta[name];
  if (!meta || !meta.files) return [];
  let result = [];
  for (let f of meta.files) {
    if (!dir || f.filename.startsWith(dir + '/')) result.push(f.filename);
  }
  return result.sort();
}

/// shared code in WASI filesystem zips (e.g. cc2600/cc7800 headers)
// referenced by worker msgs as 'wasi:<zipname>'

import { loadWASIFilesystemZip } from './wasiutils';
import type { WASIMemoryFilesystem } from '../common/wasi/wasishim';

var wasiFilesystems: { [zipname: string]: WASIMemoryFilesystem } = {};

export async function ensureWasiFilesystem(zipname: string): Promise<WASIMemoryFilesystem | null> {
  try {
    if (!wasiFilesystems[zipname]) {
      wasiFilesystems[zipname] = await loadWASIFilesystemZip(zipname);
    }
    return wasiFilesystems[zipname];
  } catch (e) {
    console.log('Error loading WASI filesystem', zipname, e);
    return null;
  }
}

// zip entries are stored under '<path>' (rootPath './' adds a './' prefix);
// strip it plus any leading '/' so '/headers/vcs.h' matches 'headers/vcs.h'
function normalizeWasiPath(path: string): string {
  path = path.startsWith('./') ? path.substring(2) : path;
  return path.startsWith('/') ? path.substring(1) : path;
}

/** Read a file from a WASI filesystem zip. Returns null if not found. */
export async function readWasiSharedFile(zipname: string, path: string): Promise<Uint8Array | null> {
  let fs = await ensureWasiFilesystem(zipname);
  if (!fs) return null;
  let norm = normalizeWasiPath(path);
  // zip entries are stored under './<path>', so try both key forms
  let fd = fs.getFile(norm) || fs.getFile('./' + norm);
  if (!fd || !fd.size) return null;
  let data = new Uint8Array(fd.size);
  fd.offset = 0;
  fd.read(data);
  return data;
}

/** List files under a directory prefix (e.g. '/headers') of a WASI filesystem zip. */
export async function listWasiSharedFiles(zipname: string, dir: string): Promise<string[]> {
  let fs = await ensureWasiFilesystem(zipname);
  if (!fs) return [];
  let prefix = normalizeWasiPath(dir) + '/';
  return fs.getFiles()
    .map(f => normalizeWasiPath(f.name))
    .filter(name => name.startsWith(prefix))
    .sort();
}

/** Read a file from a filesystem package blob. Returns null if not found.
 *  Async because Blob reading is async; call from worker message handlers. */
export async function readSharedFile(name: string, path: string): Promise<Uint8Array | null> {
  let entry = getSharedFileEntry(name, path);
  if (!entry || !fsBlob[name]) return null;
  let blob: Blob = fsBlob[name].slice(entry.start, entry.end);
  if (typeof Blob === 'undefined' || typeof blob['slice'] !== 'function') return null; // not a browser Blob
  const FRS = (typeof globalThis !== 'undefined' ? (globalThis as any).FileReaderSync : undefined);
  if (typeof FRS === 'function') {
    return new Uint8Array(new FRS().readAsArrayBuffer(blob));
  } else if (typeof FileReader !== 'undefined') {
    return await new Promise<Uint8Array>((resolve, reject) => {
      let fr = new FileReader();
      fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
      fr.onerror = () => reject(fr.error);
      fr.readAsArrayBuffer(blob);
    });
  }
  return null;
}

export function setupStdin(fs, code: string) {
  var i = 0;
  fs.init(
    function () { return i < code.length ? code.charCodeAt(i++) : null; }
  );
}
