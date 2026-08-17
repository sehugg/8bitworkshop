"use strict";
// WebAssembly module cache
// for Emscripten-compiled functions
Object.defineProperty(exports, "__esModule", { value: true });
exports.print_fn = exports.fsMeta = exports.emglobal = void 0;
exports.getWASMMemory = getWASMMemory;
exports.getWASMBinary = getWASMBinary;
exports.moduleInstFn = moduleInstFn;
exports.execMain = execMain;
exports.loadFilesystem = loadFilesystem;
exports.load = load;
exports.loadWASMBinary = loadWASMBinary;
exports.loadWASM = loadWASM;
exports.loadNative = loadNative;
exports.setupFS = setupFS;
exports.setupStdin = setupStdin;
const builder_1 = require("./builder");
const ENVIRONMENT_IS_WEB = typeof window === 'object';
const ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
exports.emglobal = ENVIRONMENT_IS_WORKER ? self : ENVIRONMENT_IS_WEB ? window : global;
// simple CommonJS module loader
// TODO: relative paths for dependencies
if (!exports.emglobal['require']) {
    exports.emglobal['require'] = (modpath) => {
        if (modpath.endsWith('.js'))
            modpath = modpath.slice(-3);
        var modname = modpath.split('/').slice(-1)[0];
        var hasNamespace = exports.emglobal[modname] != null;
        console.log('@@@ require', modname, modpath, hasNamespace);
        if (!hasNamespace) {
            exports = {};
            importScripts(`${modpath}.js`);
        }
        if (exports.emglobal[modname] == null) {
            exports.emglobal[modname] = exports; // TODO: always put in global scope?
        }
        return exports.emglobal[modname]; // TODO
    };
}
// TODO: leaks memory even when disabled...
var _WASM_module_cache = {};
var CACHE_WASM_MODULES = true; // if false, use asm.js only
// TODO: which modules need this?
var wasmMemory;
function getWASMMemory() {
    if (wasmMemory == null) {
        wasmMemory = new WebAssembly.Memory({
            'initial': 1024, // 64MB
            'maximum': 16384, // 1024MB
        });
    }
    return wasmMemory;
}
function getWASMBinary(module_id) {
    return wasmBlob[module_id];
}
function getWASMModule(module_id) {
    var module = _WASM_module_cache[module_id];
    if (!module) {
        (0, builder_1.starttime)();
        module = new WebAssembly.Module(wasmBlob[module_id]);
        if (CACHE_WASM_MODULES) {
            _WASM_module_cache[module_id] = module;
            delete wasmBlob[module_id];
        }
        (0, builder_1.endtime)("module creation " + module_id);
    }
    return module;
}
// function for use with instantiateWasm
function moduleInstFn(module_id) {
    return function (imports, ri) {
        var mod = getWASMModule(module_id);
        var inst = new WebAssembly.Instance(mod, imports);
        ri(inst);
        return inst.exports;
    };
}
function execMain(step, mod, args) {
    (0, builder_1.starttime)();
    var run = mod.callMain || mod.run; // TODO: run?
    run(args);
    (0, builder_1.endtime)(step.tool);
    console.log('exec', step.tool, args.join(' '));
}
/// asm.js / WASM / filesystem loading
exports.fsMeta = {};
var fsBlob = {};
var wasmBlob = {};
// load filesystems for CC65 and others asynchronously
function loadFilesystem(name) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open("GET", builder_1.PWORKER + "fs/fs" + name + ".data", false); // synchronous request
    xhr.send(null);
    fsBlob[name] = xhr.response;
    xhr = new XMLHttpRequest();
    xhr.responseType = 'json';
    xhr.open("GET", builder_1.PWORKER + "fs/fs" + name + ".js.metadata", false); // synchronous request
    xhr.send(null);
    exports.fsMeta[name] = xhr.response;
    console.log("Loaded " + name + " filesystem", exports.fsMeta[name].files.length, 'files', fsBlob[name].size, 'bytes');
}
var loaded = {};
function load(modulename, debug) {
    if (!loaded[modulename]) {
        importScripts(builder_1.PWORKER + 'asmjs/' + modulename + (debug ? "." + debug + ".js" : ".js"));
        loaded[modulename] = 1;
    }
}
function loadWASMBinary(modulename) {
    if (!loaded[modulename]) {
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
        xhr.open("GET", builder_1.PWORKER + "wasm/" + modulename + ".wasm", false); // synchronous request
        xhr.send(null);
        if (xhr.response) {
            wasmBlob[modulename] = new Uint8Array(xhr.response);
            console.log("Loaded " + modulename + ".wasm (" + wasmBlob[modulename].length + " bytes)");
            loaded[modulename] = 1;
        }
        else {
            throw Error("Could not load WASM file " + modulename + ".wasm");
        }
    }
    return wasmBlob[modulename];
}
function loadWASM(modulename, debug) {
    if (!loaded[modulename]) {
        importScripts(builder_1.PWORKER + "wasm/" + modulename + (debug ? "." + debug + ".js" : ".js"));
        loadWASMBinary(modulename);
    }
}
function loadNative(modulename) {
    // detect WASM
    if (CACHE_WASM_MODULES && typeof WebAssembly === 'object') {
        loadWASM(modulename);
    }
    else {
        load(modulename);
    }
}
// mount the filesystem at /share
function setupFS(FS, name) {
    var WORKERFS = FS.filesystems['WORKERFS'];
    if (name === '65-vector')
        name = '65-none'; // TODO
    if (name === '65-atari7800')
        name = '65-none'; // TODO
    if (name === '65-devel')
        name = '65-none'; // TODO
    if (name === '65-vcs')
        name = '65-atari2600'; // TODO
    if (name === '65-exidy')
        name = '65-none'; // TODO
    if (!exports.fsMeta[name])
        throw Error("No filesystem for '" + name + "'");
    FS.mkdir('/share');
    FS.mount(WORKERFS, {
        packages: [{ metadata: exports.fsMeta[name], blob: fsBlob[name] }]
    }, '/share');
    // fix for slow Blob operations by caching typed arrays
    // https://github.com/kripken/emscripten/blob/incoming/src/library_workerfs.js
    // https://bugs.chromium.org/p/chromium/issues/detail?id=349304#c30
    var reader = WORKERFS.reader;
    var blobcache = {};
    WORKERFS.stream_ops.read = function (stream, buffer, offset, length, position) {
        if (position >= stream.node.size)
            return 0;
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
var print_fn = function (s) {
    console.log(s);
    //console.log(new Error().stack);
};
exports.print_fn = print_fn;
function setupStdin(fs, code) {
    var i = 0;
    fs.init(function () { return i < code.length ? code.charCodeAt(i++) : null; });
}
//# sourceMappingURL=wasmutils.js.map