"use strict";
// workerlib.ts - Node.js-friendly entry point for the worker build system
// Re-exports core worker functionality without Web Worker onmessage/postMessage wiring
// FOR TESTING ONLY
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOLS = exports.PLATFORM_PARAMS = exports.TOOL_PRELOADFS = exports.builder = exports.store = void 0;
exports.setupNodeEnvironment = setupNodeEnvironment;
exports.handleMessage = handleMessage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("../common/util");
const workertools_1 = require("./workertools");
Object.defineProperty(exports, "TOOL_PRELOADFS", { enumerable: true, get: function () { return workertools_1.TOOL_PRELOADFS; } });
const builder_1 = require("./builder");
Object.defineProperty(exports, "store", { enumerable: true, get: function () { return builder_1.store; } });
Object.defineProperty(exports, "builder", { enumerable: true, get: function () { return builder_1.builder; } });
const wasmutils_1 = require("./wasmutils");
const workermain_1 = require("./workermain");
var platforms_1 = require("./platforms");
Object.defineProperty(exports, "PLATFORM_PARAMS", { enumerable: true, get: function () { return platforms_1.PLATFORM_PARAMS; } });
var workertools_2 = require("./workertools");
Object.defineProperty(exports, "TOOLS", { enumerable: true, get: function () { return workertools_2.TOOLS; } });
class Blob {
    constructor(data) {
        this.data = data;
        this.size = data.length;
        this.length = data.length;
    }
    slice(a, b) {
        return new Blob(this.data.slice(a, b));
    }
    arrayBuffer() {
        return this.asArrayBuffer();
    }
    asArrayBuffer() {
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
function setupNodeEnvironment() {
    // Basic globals expected by various parts of the worker system
    // Some Emscripten-generated WASM modules check for __filename/__dirname
    if (typeof globalThis.__filename === 'undefined') {
        globalThis.__filename = __filename;
    }
    if (typeof globalThis.__dirname === 'undefined') {
        globalThis.__dirname = __dirname;
        // TODO: support require('path').dirname
    }
    wasmutils_1.emglobal.window = wasmutils_1.emglobal;
    wasmutils_1.emglobal.exports = {};
    wasmutils_1.emglobal.self = wasmutils_1.emglobal;
    wasmutils_1.emglobal.location = { href: '.' };
    wasmutils_1.emglobal.path = path;
    wasmutils_1.emglobal.btoa = require('btoa');
    wasmutils_1.emglobal.atob = require('atob');
    try {
        wasmutils_1.emglobal.navigator = wasmutils_1.emglobal;
    }
    catch (e) { /* read-only in newer Node */ }
    wasmutils_1.emglobal.ResizeObserver = class {
        observe() { }
    };
    // XMLHttpRequest shim that reads from the local filesystem
    wasmutils_1.emglobal.XMLHttpRequest = function () {
        this.open = function (method, url, async) {
            if (this.responseType == 'json') {
                var txt = fs.readFileSync('src/worker/' + url, 'utf-8');
                this.response = JSON.parse(txt);
            }
            else if (this.responseType == 'blob') {
                var data = fs.readFileSync('src/worker/' + url, { encoding: 'binary' });
                this.response = new Blob(data);
            }
            else if (this.responseType == 'arraybuffer') {
                var data = fs.readFileSync('src/worker/' + url, { encoding: 'binary' });
                this.response = new Blob(data).asArrayBuffer();
            }
            this.status = this.response ? 200 : 404;
        };
        this.send = function () { };
    };
    // FileReaderSync shim
    wasmutils_1.emglobal.FileReaderSync = function () {
        this.readAsArrayBuffer = function (blob) {
            return blob.asArrayBuffer();
        };
    };
    // fetch shim that reads from the local filesystem
    wasmutils_1.emglobal.fetch = function (filepath) {
        return new Promise((resolve, reject) => {
            try {
                var bin = fs.readFileSync(filepath, { encoding: 'binary' });
                var response = new Blob(bin);
                resolve(response);
            }
            catch (e) {
                reject(e);
            }
        });
    };
    // importScripts shim - runs scripts in the global context like a web worker would.
    // In the web worker, importScripts loads relative to the worker bundle.
    // PWORKER is "../../src/worker/", so paths like "../../src/worker/asmjs/dasm.js"
    // need to be resolved to the actual file on disk.
    var vm = require('vm');
    wasmutils_1.emglobal.importScripts = function (scriptPath) {
        // Strip the PWORKER prefix and load from src/worker/
        var resolved = scriptPath.replace(/^\.\.\/\.\.\//, '');
        var fullPath = path.resolve(process.cwd(), resolved);
        var code = fs.readFileSync(fullPath, 'utf-8');
        vm.runInThisContext(code, fullPath);
    };
    // Suppress onmessage/postMessage (not used in Node mode)
    wasmutils_1.emglobal.onmessage = null;
    wasmutils_1.emglobal.postMessage = null;
    // Set up the require function for WASM modules
    (0, workermain_1.setupRequireFunction)();
}
/**
 * Handle a worker message (preload, reset, or build).
 * Same logic as workermain.ts handleMessage but exported for direct use.
 */
async function handleMessage(data) {
    // preload file system
    if (data.preload) {
        var fsName = workertools_1.TOOL_PRELOADFS[data.preload];
        if (!fsName && data.platform)
            fsName = workertools_1.TOOL_PRELOADFS[data.preload + '-' + (0, util_1.getBasePlatform)(data.platform)];
        if (!fsName && data.platform)
            fsName = workertools_1.TOOL_PRELOADFS[data.preload + '-' + (0, util_1.getRootBasePlatform)(data.platform)];
        if (fsName && !wasmutils_1.fsMeta[fsName])
            (0, wasmutils_1.loadFilesystem)(fsName);
        return;
    }
    // clear filesystem?
    if (data.reset) {
        builder_1.store.reset();
        return;
    }
    return builder_1.builder.handleMessage(data);
}
//# sourceMappingURL=workerlib.js.map