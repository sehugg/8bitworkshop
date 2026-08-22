
// workerlib.ts - Node.js-friendly entry point for the worker build system
// Re-exports core worker functionality without Web Worker onmessage/postMessage wiring
// FOR TESTING ONLY

import * as fs from 'fs';
import * as path from 'path';
import type { WorkerResult, WorkerMessage } from "../common/workertypes";
import { getBasePlatform, getRootBasePlatform } from "../common/util";
import { getPreloadFSName } from "../common/toolmeta";
import { store, builder } from "./builder";
import { emglobal, fsMeta, loadFilesystem, listSharedFiles, readSharedFile, ensureFilesystem, readWasiSharedFile, listWasiSharedFiles, ensureWasiFilesystem } from "./wasmutils";

// shared FS names starting with 'wasi:' refer to a WASI filesystem zip
function splitWasiFSName(fsName: string): { wasi: boolean, name: string } {
  return fsName.startsWith('wasi:') ? { wasi: true, name: fsName.substring(5) } : { wasi: false, name: fsName };
}
import { setupRequireFunction } from "./workermain";

export { store, builder };
export { PLATFORM_PARAMS } from "./platforms";
export { TOOLS } from "./workertools";

class Blob {
  private data: string;
  size: number;
  length: number;
  constructor(data: string) {
    this.data = data;
    this.size = data.length;
    this.length = data.length;
  }
  slice(a: number, b: number): Blob {
    return new Blob(this.data.slice(a, b));
  }
  arrayBuffer(): Uint8Array {
    return this.asArrayBuffer();
  }
  asArrayBuffer(): Uint8Array {
    var buf = new ArrayBuffer(this.data.length);
    var arr = new Uint8Array(buf);
    for (var i = 0; i < this.data.length; i++)
      arr[i] = this.data.charCodeAt(i);
    return arr;
  }
}

/**
 * Set up the Node.js environment to provide XMLHttpRequest, fetch, and other
 * browser globals that the worker build system expects.
 * Call this once before using handleMessage/builder.
 */
export function setupNodeEnvironment() {
  // Basic globals expected by various parts of the worker system
  // Some Emscripten-generated WASM modules check for __filename/__dirname
  if (typeof globalThis.__filename === 'undefined') {
    (globalThis as any).__filename = __filename;
  }
  if (typeof globalThis.__dirname === 'undefined') {
    (globalThis as any).__dirname = __dirname;
    // TODO: support require('path').dirname
  }
  emglobal.window = emglobal;
  emglobal.exports = {};
  emglobal.self = emglobal;
  emglobal.location = { href: '.' };
  emglobal.path = path;
  emglobal.btoa = require('btoa');
  emglobal.atob = require('atob');
  try { emglobal.navigator = emglobal; } catch (e) { /* read-only in newer Node */ }
  emglobal.ResizeObserver = class { observe() { } };

  // XMLHttpRequest shim that reads from the local filesystem
  emglobal.XMLHttpRequest = function () {
    this.open = function (method: string, url: string, async?: boolean) {
      if (this.responseType == 'json') {
        var txt = fs.readFileSync('src/worker/' + url, 'utf-8');
        this.response = JSON.parse(txt);
      } else if (this.responseType == 'blob') {
        var data = fs.readFileSync('src/worker/' + url, { encoding: 'binary' });
        this.response = new Blob(data);
      } else if (this.responseType == 'arraybuffer') {
        var data = fs.readFileSync('src/worker/' + url, { encoding: 'binary' });
        this.response = new Blob(data).asArrayBuffer();
      }
      this.status = this.response ? 200 : 404;
    };
    this.send = function () { };
  };

  // FileReaderSync shim
  emglobal.FileReaderSync = function () {
    this.readAsArrayBuffer = function (blob: any) {
      return blob.asArrayBuffer();
    };
  };

  // fetch shim that reads from the local filesystem
  emglobal.fetch = function (filepath: string) {
    return new Promise((resolve, reject) => {
      try {
        var bin = fs.readFileSync(filepath, { encoding: 'binary' });
        var response = new Blob(bin);
        resolve(response);
      } catch (e) {
        reject(e);
      }
    });
  };

  // importScripts shim - runs scripts in the global context like a web worker would.
  // In the web worker, importScripts loads relative to the worker bundle.
  // PWORKER is "../../src/worker/", so paths like "../../src/worker/asmjs/dasm.js"
  // need to be resolved to the actual file on disk.
  var vm = require('vm');
  emglobal.importScripts = function (scriptPath: string) {
    // Strip the PWORKER prefix and load from src/worker/
    var resolved = scriptPath.replace(/^\.\.\/\.\.\//, '');
    var fullPath = path.resolve(process.cwd(), resolved);
    var code = fs.readFileSync(fullPath, 'utf-8');
    vm.runInThisContext(code, fullPath);
  };

  // Suppress onmessage/postMessage (not used in Node mode)
  emglobal.onmessage = null;
  emglobal.postMessage = null;

  // Set up the require function for WASM modules
  setupRequireFunction();
}

/**
 * Handle a worker message (preload, reset, or build).
 * Same logic as workermain.ts handleMessage but exported for direct use.
 */
export async function handleMessage(data: WorkerMessage): Promise<WorkerResult> {
  // preload file system
  if (data.preload) {
    var fsName = getPreloadFSName(data.preload, data.platform && getBasePlatform(data.platform))
      || getPreloadFSName(data.preload, data.platform && getRootBasePlatform(data.platform));
    if (fsName && !fsMeta[fsName])
      loadFilesystem(fsName);
    return;
  }
  // read a file from a filesystem package (shared code)
  if (data.readshared) {
    var fs1 = splitWasiFSName(data.preload_fs);
    var contents = fs1.wasi ? await readWasiSharedFile(fs1.name, data.readshared)
      : (ensureFilesystem(fs1.name), await readSharedFile(fs1.name, data.readshared));
    return { output: contents, qid: data.qid } as WorkerResult;
  }
  // list files in a filesystem package directory (shared code)
  if (data.listshared != null) {
    var fs2 = splitWasiFSName(data.preload_fs);
    var files = fs2.wasi ? await listWasiSharedFiles(fs2.name, data.listshared)
      : (ensureFilesystem(fs2.name), listSharedFiles(fs2.name, data.listshared));
    return { output: files, qid: data.qid } as WorkerResult;
  }
  // preload a filesystem package directly by name
  if (data.preload_fs) {
    var fs3 = splitWasiFSName(data.preload_fs);
    if (fs3.wasi) await ensureWasiFilesystem(fs3.name);
    else ensureFilesystem(fs3.name);
    return;
  }
  // clear filesystem?
  if (data.reset) {
    store.reset();
    return;
  }
  return builder.handleMessage(data);
}
