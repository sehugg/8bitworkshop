
// workerlib.ts - Node.js-friendly entry point for the worker build system
// Re-exports core worker functionality without Web Worker onmessage/postMessage wiring
// FOR TESTING ONLY

import * as fs from 'fs';
import * as path from 'path';
import { store, builder } from "./builder";
import { emglobal } from "./wasmutils";
import { setupRequireFunction, handleMessage } from "./workermain";

export { handleMessage };

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

/** Scripts loaded through the importScripts shim (Emscripten glue) */
const importedScripts = new Set<string>();
const GLUE_EVENTS = ['uncaughtException', 'unhandledRejection'];
let glueHandlersIgnored = false;

/**
 * Emscripten glue running under Node adds uncaughtException and
 * unhandledRejection handlers every time a tool module is instantiated. They
 * rethrow or abort, which kills a long-lived host (the VS Code extension), and
 * they pile up, one pair per tool per build. Drop the ones the glue adds; the
 * build catches tool errors itself.
 */
function ignoreGlueProcessHandlers() {
  if (glueHandlersIgnored) return;
  glueHandlersIgnored = true;
  const fromGlue = () => {
    const stack = new Error().stack || '';
    for (const script of importedScripts) if (stack.includes(script)) return true;
    return false;
  };
  for (const method of ['on', 'addListener', 'prependListener'] as const) {
    const original = process[method];
    (process as any)[method] = function (event: string | symbol, listener: (...args: any[]) => void) {
      if (GLUE_EVENTS.includes(event as string) && fromGlue()) return this;
      return original.call(this, event, listener);
    };
  }
}

/**
 * Set up the Node.js environment to provide XMLHttpRequest, fetch, and other
 * browser globals that the worker build system expects.
 * Call this once before using handleMessage/builder.
 * `rootDir` is the directory holding src/worker (toolchain assets); it
 * defaults to the current directory.
 */
export function setupNodeEnvironment(rootDir: string = process.cwd()) {
  var workerDir = path.resolve(rootDir, 'src/worker');
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
        var txt = fs.readFileSync(path.resolve(workerDir, url), 'utf-8');
        this.response = JSON.parse(txt);
      } else if (this.responseType == 'blob') {
        var data = fs.readFileSync(path.resolve(workerDir, url), { encoding: 'binary' });
        this.response = new Blob(data);
      } else if (this.responseType == 'arraybuffer') {
        var data = fs.readFileSync(path.resolve(workerDir, url), { encoding: 'binary' });
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
        var bin = fs.readFileSync(path.resolve(rootDir, filepath), { encoding: 'binary' });
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
    var fullPath = path.resolve(rootDir, resolved);
    var code = fs.readFileSync(fullPath, 'utf-8');
    importedScripts.add(fullPath);
    vm.runInThisContext(code, fullPath);
  };
  ignoreGlueProcessHandlers();

  // Suppress onmessage/postMessage (not used in Node mode)
  emglobal.onmessage = null;
  emglobal.postMessage = null;

  // Set up the require function for WASM modules
  setupRequireFunction();
}
