"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRequireFunction = exports.preprocessMCPP = exports.fixParamsWithDefines = exports.setupStdin = exports.parseSourceLines = exports.parseListing = exports.re_lineoffset = exports.re_crlf = exports.extractErrors = exports.makeErrorMatcher = exports.msvcErrorMatcher = exports.re_msvc2 = exports.re_msvc = exports.print_fn = exports.setupFS = exports.loadNative = exports.loadWASM = exports.load = exports.execMain = exports.anyTargetChanged = exports.staleFiles = exports.populateExtraFiles = exports.populateFiles = exports.getPrefix = exports.gatherFiles = exports.populateEntry = exports.getWorkFileAsString = exports.putWorkFile = exports.store = exports.FileWorkingStore = exports.endtime = exports.starttime = exports.moduleInstFn = exports.getWASMMemory = exports.emglobal = void 0;
const util_1 = require("../common/util");
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
// WebAssembly module cache
// TODO: leaks memory even when disabled...
var _WASM_module_cache = {};
var CACHE_WASM_MODULES = true; // if false, use asm.js only
// TODO: which modules need this?
var wasmMemory;
function getWASMMemory() {
    if (wasmMemory == null) {
        wasmMemory = new WebAssembly.Memory({
            'initial': 1024,
            'maximum': 16384, // 1024MB
        });
    }
    return wasmMemory;
}
exports.getWASMMemory = getWASMMemory;
function getWASMModule(module_id) {
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
function moduleInstFn(module_id) {
    return function (imports, ri) {
        var mod = getWASMModule(module_id);
        var inst = new WebAssembly.Instance(mod, imports);
        ri(inst);
        return inst.exports;
    };
}
exports.moduleInstFn = moduleInstFn;
//
var PLATFORM_PARAMS = {
    'vcs': {
        arch: '6502',
        code_start: 0x1000,
        code_size: 0xf000,
        data_start: 0x80,
        data_size: 0x80,
        wiz_rom_ext: '.a26',
        wiz_inc_dir: '2600',
        extra_link_files: ['atari2600.cfg'],
        cfgfile: 'atari2600.cfg',
    },
    'mw8080bw': {
        arch: 'z80',
        code_start: 0x0,
        rom_size: 0x2000,
        data_start: 0x2000,
        data_size: 0x400,
        stack_end: 0x2400,
    },
    'vicdual': {
        arch: 'z80',
        code_start: 0x0,
        rom_size: 0x4020,
        data_start: 0xe400,
        data_size: 0x400,
        stack_end: 0xe800,
    },
    'galaxian': {
        arch: 'z80',
        code_start: 0x0,
        rom_size: 0x4000,
        data_start: 0x4000,
        data_size: 0x400,
        stack_end: 0x4800,
    },
    'galaxian-scramble': {
        arch: 'z80',
        code_start: 0x0,
        rom_size: 0x5020,
        data_start: 0x4000,
        data_size: 0x400,
        stack_end: 0x4800,
    },
    'williams': {
        arch: '6809',
        code_start: 0x0,
        rom_size: 0xc000,
        data_start: 0x9800,
        data_size: 0x2800,
        stack_end: 0xc000,
        set_stack_end: 0xc000,
        extra_link_files: ['williams.scr', 'libcmoc-crt-vec.a', 'libcmoc-std-vec.a'],
        extra_link_args: ['-swilliams.scr', '-lcmoc-crt-vec', '-lcmoc-std-vec'],
        extra_compile_files: ['assert.h', 'cmoc.h', 'stdarg.h', 'stdlib.h'],
        //extra_compile_args: ['--vectrex'],
    },
    'williams-defender': {
        arch: '6809',
        code_start: 0x0,
        rom_size: 0xc000,
        data_start: 0x9800,
        data_size: 0x2800,
        stack_end: 0xc000,
    },
    'williams-z80': {
        arch: 'z80',
        code_start: 0x0,
        rom_size: 0x9800,
        data_start: 0x9800,
        data_size: 0x2800,
        stack_end: 0xc000,
    },
    'vector-z80color': {
        arch: 'z80',
        code_start: 0x0,
        rom_size: 0x8000,
        data_start: 0xe000,
        data_size: 0x2000,
        stack_end: 0x0,
    },
    'vector-ataricolor': {
        arch: '6502',
        define: ['__VECTOR__'],
        cfgfile: 'vector-color.cfg',
        libargs: ['crt0.o', 'none.lib'],
        extra_link_files: ['crt0.o', 'vector-color.cfg'],
    },
    'sound_williams-z80': {
        arch: 'z80',
        code_start: 0x0,
        rom_size: 0x4000,
        data_start: 0x4000,
        data_size: 0x400,
        stack_end: 0x8000,
    },
    'base_z80': {
        arch: 'z80',
        code_start: 0x0,
        rom_size: 0x8000,
        data_start: 0x8000,
        data_size: 0x8000,
        stack_end: 0x0,
    },
    'coleco': {
        arch: 'z80',
        rom_start: 0x8000,
        code_start: 0x8100,
        rom_size: 0x8000,
        data_start: 0x7000,
        data_size: 0x400,
        stack_end: 0x8000,
        extra_preproc_args: ['-I', '/share/include/coleco', '-D', 'CV_CV'],
        extra_link_args: ['-k', '/share/lib/coleco', '-l', 'libcv', '-l', 'libcvu', 'crt0.rel'],
    },
    'msx': {
        arch: 'z80',
        rom_start: 0x4000,
        code_start: 0x4000,
        rom_size: 0x8000,
        data_start: 0xc000,
        data_size: 0x3000,
        stack_end: 0xffff,
        extra_link_args: ['crt0-msx.rel'],
        extra_link_files: ['crt0-msx.rel', 'crt0-msx.lst'],
        wiz_sys_type: 'z80',
        wiz_inc_dir: 'msx',
    },
    'msx-libcv': {
        arch: 'z80',
        rom_start: 0x4000,
        code_start: 0x4000,
        rom_size: 0x8000,
        data_start: 0xc000,
        data_size: 0x3000,
        stack_end: 0xffff,
        extra_preproc_args: ['-I', '.', '-D', 'CV_MSX'],
        extra_link_args: ['-k', '.', '-l', 'libcv-msx', '-l', 'libcvu-msx', 'crt0-msx.rel'],
        extra_link_files: ['libcv-msx.lib', 'libcvu-msx.lib', 'crt0-msx.rel', 'crt0-msx.lst'],
        extra_compile_files: ['cv.h', 'cv_graphics.h', 'cv_input.h', 'cv_sound.h', 'cv_support.h', 'cvu.h', 'cvu_c.h', 'cvu_compression.h', 'cvu_f.h', 'cvu_graphics.h', 'cvu_input.h', 'cvu_sound.h'],
    },
    'sms-sg1000-libcv': {
        arch: 'z80',
        rom_start: 0x0000,
        code_start: 0x0100,
        rom_size: 0xc000,
        data_start: 0xc000,
        data_size: 0x400,
        stack_end: 0xe000,
        extra_preproc_args: ['-I', '.', '-D', 'CV_SMS'],
        extra_link_args: ['-k', '.', '-l', 'libcv-sms', '-l', 'libcvu-sms', 'crt0-sms.rel'],
        extra_link_files: ['libcv-sms.lib', 'libcvu-sms.lib', 'crt0-sms.rel', 'crt0-sms.lst'],
        extra_compile_files: ['cv.h', 'cv_graphics.h', 'cv_input.h', 'cv_sound.h', 'cv_support.h', 'cvu.h', 'cvu_c.h', 'cvu_compression.h', 'cvu_f.h', 'cvu_graphics.h', 'cvu_input.h', 'cvu_sound.h'],
    },
    'nes': {
        arch: '6502',
        define: ['__NES__'],
        cfgfile: 'neslib2.cfg',
        libargs: ['crt0.o', 'nes.lib', 'neslib2.lib',
            '-D', 'NES_MAPPER=0',
            '-D', 'NES_PRG_BANKS=2',
            '-D', 'NES_CHR_BANKS=1',
            '-D', 'NES_MIRRORING=0', // horizontal mirroring
        ],
        extra_link_files: ['crt0.o', 'neslib2.lib', 'neslib2.cfg', 'nesbanked.cfg'],
        wiz_rom_ext: '.nes',
    },
    'apple2': {
        arch: '6502',
        define: ['__APPLE2__'],
        cfgfile: 'apple2.cfg',
        libargs: ['--lib-path', '/share/target/apple2/drv', '-D', '__EXEHDR__=0', 'apple2.lib'],
        __CODE_RUN__: 16384,
        code_start: 0x803,
    },
    'apple2-e': {
        arch: '6502',
        define: ['__APPLE2__'],
        cfgfile: 'apple2.cfg',
        libargs: ['apple2.lib'],
    },
    'atari8-800xl.disk': {
        arch: '6502',
        define: ['__ATARI__'],
        cfgfile: 'atari.cfg',
        libargs: ['atari.lib'],
        fastbasic_cfgfile: 'fastbasic-cart.cfg',
    },
    'atari8-800xl': {
        arch: '6502',
        define: ['__ATARI__'],
        cfgfile: 'atari-cart.cfg',
        libargs: ['atari.lib', '-D', '__CARTFLAGS__=4'],
        fastbasic_cfgfile: 'fastbasic-cart.cfg',
    },
    'atari8-800': {
        arch: '6502',
        define: ['__ATARI__'],
        cfgfile: 'atari-cart.cfg',
        libargs: ['atari.lib', '-D', '__CARTFLAGS__=4'],
        fastbasic_cfgfile: 'fastbasic-cart.cfg',
    },
    'atari8-5200': {
        arch: '6502',
        define: ['__ATARI5200__'],
        cfgfile: 'atari5200.cfg',
        libargs: ['atari5200.lib', '-D', '__CARTFLAGS__=255'],
        fastbasic_cfgfile: 'fastbasic-cart.cfg',
    },
    'verilog': {
        arch: 'verilog',
        extra_compile_files: ['8bitworkshop.v'],
    },
    'astrocade': {
        arch: 'z80',
        code_start: 0x2000,
        rom_size: 0x2000,
        data_start: 0x4e10,
        data_size: 0x1f0,
        stack_end: 0x5000,
    },
    'astrocade-arcade': {
        arch: 'z80',
        code_start: 0x0000,
        rom_size: 0x4000,
        data_start: 0x7de0,
        data_size: 0x220,
        stack_end: 0x8000,
    },
    'astrocade-bios': {
        arch: 'z80',
        code_start: 0x0000,
        rom_size: 0x2000,
        data_start: 0x4fce,
        data_size: 50,
        stack_end: 0x4fce,
    },
    'atari7800': {
        arch: '6502',
        define: ['__ATARI7800__'],
        cfgfile: 'atari7800.cfg',
        libargs: ['crt0.o', 'none.lib'],
        extra_link_files: ['crt0.o', 'atari7800.cfg'],
    },
    'c64': {
        arch: '6502',
        define: ['__CBM__', '__C64__'],
        cfgfile: 'c64.cfg',
        libargs: ['c64.lib'],
        //extra_link_files: ['c64-cart.cfg'],
    },
    'vic20': {
        arch: '6502',
        define: ['__CBM__', '__VIC20__'],
        cfgfile: 'vic20.cfg',
        libargs: ['vic20.lib'],
        //extra_link_files: ['c64-cart.cfg'],
    },
    'kim1': {
        arch: '6502',
    },
    'vectrex': {
        arch: '6809',
        code_start: 0x0,
        rom_size: 0x8000,
        data_start: 0xc880,
        data_size: 0x380,
        stack_end: 0xcc00,
        extra_compile_files: ['assert.h', 'cmoc.h', 'stdarg.h', 'vectrex.h', 'stdlib.h', 'bios.h'],
        extra_link_files: ['vectrex.scr', 'libcmoc-crt-vec.a', 'libcmoc-std-vec.a'],
        extra_compile_args: ['--vectrex'],
        extra_link_args: ['-svectrex.scr', '-lcmoc-crt-vec', '-lcmoc-std-vec'],
    },
    'x86': {
        arch: 'x86',
    },
    'zx': {
        arch: 'z80',
        code_start: 0x5ccb,
        rom_size: 0xff58 - 0x5ccb,
        data_start: 0xf000,
        data_size: 0xfe00 - 0xf000,
        stack_end: 0xff58,
        extra_link_args: ['crt0-zx.rel'],
        extra_link_files: ['crt0-zx.rel', 'crt0-zx.lst'],
    },
    'devel-6502': {
        arch: '6502',
        cfgfile: 'devel-6502.cfg',
        libargs: ['crt0.o', 'none.lib'],
        extra_link_files: ['crt0.o', 'devel-6502.cfg'],
    },
    // https://github.com/cpcitor/cpc-dev-tool-chain
    'cpc.rslib': {
        arch: 'z80',
        code_start: 0x4000,
        rom_size: 0xb100 - 0x4000,
        data_start: 0xb100,
        data_size: 0xb100 - 0xc000,
        stack_end: 0xc000,
        extra_compile_files: ['cpcrslib.h'],
        extra_link_args: ['crt0-cpc.rel', 'cpcrslib.lib'],
        extra_link_files: ['crt0-cpc.rel', 'crt0-cpc.lst', 'cpcrslib.lib', 'cpcrslib.lst'],
    },
    // https://lronaldo.github.io/cpctelera/ (TODO)
    'cpc': {
        arch: 'z80',
        code_start: 0x4000,
        rom_size: 0xb100 - 0x4000,
        data_start: 0xb100,
        data_size: 0xb100 - 0xc000,
        stack_end: 0xc000,
        extra_compile_files: ['cpctelera.h'],
        extra_link_args: ['crt0-cpc.rel', 'cpctelera.lib'],
        extra_link_files: ['crt0-cpc.rel', 'crt0-cpc.lst', 'cpctelera.lib', 'cpctelera.lst'],
    },
};
PLATFORM_PARAMS['sms-sms-libcv'] = PLATFORM_PARAMS['sms-sg1000-libcv'];
PLATFORM_PARAMS['sms-gg-libcv'] = PLATFORM_PARAMS['sms-sms-libcv'];
var _t1;
function starttime() { _t1 = new Date(); }
exports.starttime = starttime;
function endtime(msg) { var _t2 = new Date(); console.log(msg, _t2.getTime() - _t1.getTime(), "ms"); }
exports.endtime = endtime;
;
///
class FileWorkingStore {
    constructor() {
        this.workfs = {};
        this.workerseq = 0;
        this.reset();
    }
    reset() {
        this.workfs = {};
        this.newVersion();
    }
    currentVersion() {
        return this.workerseq;
    }
    newVersion() {
        let ts = new Date().getTime();
        if (ts <= this.workerseq)
            ts = ++this.workerseq;
        return ts;
    }
    putFile(path, data) {
        var encoding = (typeof data === 'string') ? 'utf8' : 'binary';
        var entry = this.workfs[path];
        if (!entry || !compareData(entry.data, data) || entry.encoding != encoding) {
            this.workfs[path] = entry = { path: path, data: data, encoding: encoding, ts: this.newVersion() };
            console.log('+++', entry.path, entry.encoding, entry.data.length, entry.ts);
        }
        return entry;
    }
    hasFile(path) {
        return this.workfs[path] != null;
    }
    getFileData(path) {
        return this.workfs[path] && this.workfs[path].data;
    }
    getFileAsString(path) {
        let data = this.getFileData(path);
        if (data != null && typeof data !== 'string')
            throw new Error(`${path}: expected string`);
        return data; // TODO
    }
    getFileEntry(path) {
        return this.workfs[path];
    }
    setItem(key, value) {
        this.items[key] = value;
    }
}
exports.FileWorkingStore = FileWorkingStore;
exports.store = new FileWorkingStore();
///
function errorResult(msg) {
    return { errors: [{ line: 0, msg: msg }] };
}
class Builder {
    constructor() {
        this.steps = [];
        this.startseq = 0;
    }
    // returns true if file changed during this build step
    wasChanged(entry) {
        return entry.ts > this.startseq;
    }
    async executeBuildSteps() {
        this.startseq = exports.store.currentVersion();
        var linkstep = null;
        while (this.steps.length) {
            var step = this.steps.shift(); // get top of array
            var platform = step.platform;
            var toolfn = TOOLS[step.tool];
            if (!toolfn)
                throw Error("no tool named " + step.tool);
            step.params = PLATFORM_PARAMS[(0, util_1.getBasePlatform)(platform)];
            try {
                step.result = await toolfn(step);
            }
            catch (e) {
                console.log("EXCEPTION", e, e.stack);
                return errorResult(e + ""); // TODO: catch errors already generated?
            }
            if (step.result) {
                step.result.params = step.params; // TODO: type check
                if (step.debuginfo) {
                    let r = step.result; // TODO
                    if (!r.debuginfo)
                        r.debuginfo = {};
                    Object.assign(r.debuginfo, step.debuginfo);
                }
                // errors? return them
                if ('errors' in step.result && step.result.errors.length) {
                    applyDefaultErrorPath(step.result.errors, step.path);
                    return step.result;
                }
                // if we got some output, return it immediately
                if ('output' in step.result && step.result.output) {
                    return step.result;
                }
                // combine files with a link tool?
                if ('linktool' in step.result) {
                    // add to existing link step
                    if (linkstep) {
                        linkstep.files = linkstep.files.concat(step.result.files);
                        linkstep.args = linkstep.args.concat(step.result.args);
                    }
                    else {
                        linkstep = {
                            tool: step.result.linktool,
                            platform: platform,
                            files: step.result.files,
                            args: step.result.args
                        };
                    }
                    linkstep.debuginfo = step.debuginfo; // TODO: multiple debuginfos
                }
                // process with another tool?
                if ('nexttool' in step.result) {
                    var asmstep = Object.assign({ tool: step.result.nexttool, platform: platform }, step.result);
                    this.steps.push(asmstep);
                }
                // process final step?
                if (this.steps.length == 0 && linkstep) {
                    this.steps.push(linkstep);
                    linkstep = null;
                }
            }
        }
    }
    async handleMessage(data) {
        this.steps = [];
        // file updates
        if (data.updates) {
            data.updates.forEach((u) => exports.store.putFile(u.path, u.data));
        }
        // object update
        if (data.setitems) {
            data.setitems.forEach((i) => exports.store.setItem(i.key, i.value));
        }
        // build steps
        if (data.buildsteps) {
            this.steps.push.apply(this.steps, data.buildsteps);
        }
        // single-file
        if (data.code) {
            this.steps.push(data); // TODO: remove cast
        }
        // execute build steps
        if (this.steps.length) {
            var result = await this.executeBuildSteps();
            return result ? result : { unchanged: true };
        }
        // TODO: cache results
        // message not recognized
        console.log("Unknown message", data);
    }
}
var builder = new Builder();
///
function applyDefaultErrorPath(errors, path) {
    if (!path)
        return;
    for (var i = 0; i < errors.length; i++) {
        var err = errors[i];
        if (!err.path && err.line)
            err.path = path;
    }
}
function compareData(a, b) {
    if (a.length != b.length)
        return false;
    if (typeof a === 'string' && typeof b === 'string') {
        return a == b;
    }
    else {
        for (var i = 0; i < a.length; i++) {
            //if (a[i] != b[i]) console.log('differ at byte',i,a[i],b[i]);
            if (a[i] != b[i])
                return false;
        }
        return true;
    }
}
function putWorkFile(path, data) {
    return exports.store.putFile(path, data);
}
exports.putWorkFile = putWorkFile;
function getWorkFileAsString(path) {
    return exports.store.getFileAsString(path);
}
exports.getWorkFileAsString = getWorkFileAsString;
function populateEntry(fs, path, entry, options) {
    var data = entry.data;
    if (options && options.processFn) {
        data = options.processFn(path, data);
    }
    // create subfolders
    var toks = path.split('/');
    if (toks.length > 1) {
        for (var i = 0; i < toks.length - 1; i++)
            try {
                fs.mkdir(toks[i]);
            }
            catch (e) { }
    }
    // write file
    fs.writeFile(path, data, { encoding: entry.encoding });
    var time = new Date(entry.ts);
    fs.utime(path, time, time);
    console.log("<<<", path, entry.data.length);
}
exports.populateEntry = populateEntry;
// can call multiple times (from populateFiles)
function gatherFiles(step, options) {
    var maxts = 0;
    if (step.files) {
        for (var i = 0; i < step.files.length; i++) {
            var path = step.files[i];
            var entry = exports.store.workfs[path];
            if (!entry) {
                throw new Error("No entry for path '" + path + "'");
            }
            else {
                maxts = Math.max(maxts, entry.ts);
            }
        }
    }
    else if (step.code) {
        var path = step.path ? step.path : options.mainFilePath; // TODO: what if options null
        if (!path)
            throw Error("need path or mainFilePath");
        var code = step.code;
        var entry = putWorkFile(path, code);
        step.path = path;
        step.files = [path];
        maxts = entry.ts;
    }
    else if (step.path) {
        var path = step.path;
        var entry = exports.store.workfs[path];
        maxts = entry.ts;
        step.files = [path];
    }
    if (step.path && !step.prefix) {
        step.prefix = getPrefix(step.path);
    }
    step.maxts = maxts;
    return maxts;
}
exports.gatherFiles = gatherFiles;
function getPrefix(s) {
    var pos = s.lastIndexOf('.');
    return (pos > 0) ? s.substring(0, pos) : s;
}
exports.getPrefix = getPrefix;
function populateFiles(step, fs, options) {
    gatherFiles(step, options);
    if (!step.files)
        throw Error("call gatherFiles() first");
    for (var i = 0; i < step.files.length; i++) {
        var path = step.files[i];
        populateEntry(fs, path, exports.store.workfs[path], options);
    }
}
exports.populateFiles = populateFiles;
function populateExtraFiles(step, fs, extrafiles) {
    if (extrafiles) {
        for (var i = 0; i < extrafiles.length; i++) {
            var xfn = extrafiles[i];
            // is this file cached?
            if (exports.store.workfs[xfn]) {
                fs.writeFile(xfn, exports.store.workfs[xfn].data, { encoding: 'binary' });
                continue;
            }
            // fetch from network
            var xpath = "lib/" + (0, util_1.getBasePlatform)(step.platform) + "/" + xfn;
            var xhr = new XMLHttpRequest();
            xhr.responseType = 'arraybuffer';
            xhr.open("GET", PWORKER + xpath, false); // synchronous request
            xhr.send(null);
            if (xhr.response && xhr.status == 200) {
                var data = new Uint8Array(xhr.response);
                fs.writeFile(xfn, data, { encoding: 'binary' });
                putWorkFile(xfn, data);
                console.log(":::", xfn, data.length);
            }
            else {
                throw Error("Could not load extra file " + xpath);
            }
        }
    }
}
exports.populateExtraFiles = populateExtraFiles;
function staleFiles(step, targets) {
    if (!step.maxts)
        throw Error("call populateFiles() first");
    // see if any target files are more recent than inputs
    for (var i = 0; i < targets.length; i++) {
        var entry = exports.store.workfs[targets[i]];
        if (!entry || step.maxts > entry.ts)
            return true;
    }
    console.log("unchanged", step.maxts, targets);
    return false;
}
exports.staleFiles = staleFiles;
function anyTargetChanged(step, targets) {
    if (!step.maxts)
        throw Error("call populateFiles() first");
    // see if any target files are more recent than inputs
    for (var i = 0; i < targets.length; i++) {
        var entry = exports.store.workfs[targets[i]];
        if (!entry || entry.ts > step.maxts)
            return true;
    }
    console.log("unchanged", step.maxts, targets);
    return false;
}
exports.anyTargetChanged = anyTargetChanged;
function execMain(step, mod, args) {
    starttime();
    var run = mod.callMain || mod.run; // TODO: run?
    run(args);
    endtime(step.tool);
}
exports.execMain = execMain;
/// asm.js / WASM / filesystem loading
var fsMeta = {};
var fsBlob = {};
var wasmBlob = {};
const PSRC = "../../src/";
const PWORKER = PSRC + "worker/";
// load filesystems for CC65 and others asynchronously
function loadFilesystem(name) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open("GET", PWORKER + "fs/fs" + name + ".data", false); // synchronous request
    xhr.send(null);
    fsBlob[name] = xhr.response;
    xhr = new XMLHttpRequest();
    xhr.responseType = 'json';
    xhr.open("GET", PWORKER + "fs/fs" + name + ".js.metadata", false); // synchronous request
    xhr.send(null);
    fsMeta[name] = xhr.response;
    console.log("Loaded " + name + " filesystem", fsMeta[name].files.length, 'files', fsBlob[name].size, 'bytes');
}
var loaded = {};
function load(modulename, debug) {
    if (!loaded[modulename]) {
        importScripts(PWORKER + 'asmjs/' + modulename + (debug ? "." + debug + ".js" : ".js"));
        loaded[modulename] = 1;
    }
}
exports.load = load;
function loadWASM(modulename, debug) {
    if (!loaded[modulename]) {
        importScripts(PWORKER + "wasm/" + modulename + (debug ? "." + debug + ".js" : ".js"));
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
        xhr.open("GET", PWORKER + "wasm/" + modulename + ".wasm", false); // synchronous request
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
}
exports.loadWASM = loadWASM;
function loadNative(modulename) {
    // detect WASM
    if (CACHE_WASM_MODULES && typeof WebAssembly === 'object') {
        loadWASM(modulename);
    }
    else {
        load(modulename);
    }
}
exports.loadNative = loadNative;
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
        name = '65-none'; // TODO
    if (!fsMeta[name])
        throw Error("No filesystem for '" + name + "'");
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
exports.setupFS = setupFS;
var print_fn = function (s) {
    console.log(s);
    //console.log(new Error().stack);
};
exports.print_fn = print_fn;
// test.c(6) : warning 85: in function main unreferenced local variable : 'x'
// main.a (4): error: Unknown Mnemonic 'xxx'.
// at 2: warning 190: ISO C forbids an empty source file
exports.re_msvc = /[/]*([^( ]+)\s*[(](\d+)[)]\s*:\s*(.+?):\s*(.*)/;
exports.re_msvc2 = /\s*(at)\s+(\d+)\s*(:)\s*(.*)/;
function msvcErrorMatcher(errors) {
    return function (s) {
        var matches = exports.re_msvc.exec(s) || exports.re_msvc2.exec(s);
        if (matches) {
            var errline = parseInt(matches[2]);
            errors.push({
                line: errline,
                path: matches[1],
                //type:matches[3],
                msg: matches[4]
            });
        }
        else {
            console.log(s);
        }
    };
}
exports.msvcErrorMatcher = msvcErrorMatcher;
function makeErrorMatcher(errors, regex, iline, imsg, mainpath, ifilename) {
    return function (s) {
        var matches = regex.exec(s);
        if (matches) {
            errors.push({
                line: parseInt(matches[iline]) || 1,
                msg: matches[imsg],
                path: ifilename ? matches[ifilename] : mainpath
            });
        }
        else {
            console.log("??? " + s);
        }
    };
}
exports.makeErrorMatcher = makeErrorMatcher;
function extractErrors(regex, strings, path, iline, imsg, ifilename) {
    var errors = [];
    var matcher = makeErrorMatcher(errors, regex, iline, imsg, path, ifilename);
    for (var i = 0; i < strings.length; i++) {
        matcher(strings[i]);
    }
    return errors;
}
exports.extractErrors = extractErrors;
exports.re_crlf = /\r?\n/;
//    1   %line 16+1 hello.asm
exports.re_lineoffset = /\s*(\d+)\s+[%]line\s+(\d+)\+(\d+)\s+(.+)/;
function parseListing(code, lineMatch, iline, ioffset, iinsns, icycles, funcMatch, segMatch) {
    var lines = [];
    var lineofs = 0;
    var segment = '';
    var func = '';
    var funcbase = 0;
    code.split(exports.re_crlf).forEach((line, lineindex) => {
        let segm = segMatch && segMatch.exec(line);
        if (segm) {
            segment = segm[1];
        }
        let funcm = funcMatch && funcMatch.exec(line);
        if (funcm) {
            funcbase = parseInt(funcm[1], 16);
            func = funcm[2];
        }
        var linem = lineMatch.exec(line);
        if (linem && linem[1]) {
            var linenum = iline < 0 ? lineindex : parseInt(linem[iline]);
            var offset = parseInt(linem[ioffset], 16);
            var insns = linem[iinsns];
            var cycles = icycles ? parseInt(linem[icycles]) : null;
            var iscode = cycles > 0;
            if (insns) {
                lines.push({
                    line: linenum + lineofs,
                    offset: offset - funcbase,
                    insns,
                    cycles,
                    iscode,
                    segment,
                    func
                });
            }
        }
        else {
            let m = exports.re_lineoffset.exec(line);
            // TODO: check filename too
            if (m) {
                lineofs = parseInt(m[2]) - parseInt(m[1]) - parseInt(m[3]);
            }
        }
    });
    return lines;
}
exports.parseListing = parseListing;
function parseSourceLines(code, lineMatch, offsetMatch, funcMatch, segMatch) {
    var lines = [];
    var lastlinenum = 0;
    var segment = '';
    var func = '';
    var funcbase = 0;
    for (var line of code.split(exports.re_crlf)) {
        let segm = segMatch && segMatch.exec(line);
        if (segm) {
            segment = segm[1];
        }
        let funcm = funcMatch && funcMatch.exec(line);
        if (funcm) {
            funcbase = parseInt(funcm[1], 16);
            func = funcm[2];
        }
        var linem = lineMatch.exec(line);
        if (linem && linem[1]) {
            lastlinenum = parseInt(linem[1]);
        }
        else if (lastlinenum) {
            var linem = offsetMatch.exec(line);
            if (linem && linem[1]) {
                var offset = parseInt(linem[1], 16);
                lines.push({
                    line: lastlinenum,
                    offset: offset - funcbase,
                    segment,
                    func
                });
                lastlinenum = 0;
            }
        }
    }
    return lines;
}
exports.parseSourceLines = parseSourceLines;
function setupStdin(fs, code) {
    var i = 0;
    fs.init(function () { return i < code.length ? code.charCodeAt(i++) : null; });
}
exports.setupStdin = setupStdin;
function fixParamsWithDefines(path, params) {
    var libargs = params.libargs;
    if (path && libargs) {
        var code = getWorkFileAsString(path);
        if (code) {
            var oldcfgfile = params.cfgfile;
            var ident2index = {};
            // find all lib args "IDENT=VALUE"
            for (var i = 0; i < libargs.length; i++) {
                var toks = libargs[i].split('=');
                if (toks.length == 2) {
                    ident2index[toks[0]] = i;
                }
            }
            // find #defines and replace them
            var re = /^[;]?#define\s+(\w+)\s+(\S+)/gmi; // TODO: empty string?
            var m;
            while (m = re.exec(code)) {
                var ident = m[1];
                var value = m[2];
                var index = ident2index[ident];
                if (index >= 0) {
                    libargs[index] = ident + "=" + value;
                    console.log('Using libargs', index, libargs[index]);
                    // TODO: MMC3 mapper switch
                    if (ident == 'NES_MAPPER' && value == '4') {
                        params.cfgfile = 'nesbanked.cfg';
                        console.log("using config file", params.cfgfile);
                    }
                }
                else if (ident == 'CFGFILE' && value) {
                    params.cfgfile = value;
                }
                else if (ident == 'LIBARGS' && value) {
                    params.libargs = value.split(',').filter((s) => { return s != ''; });
                    console.log('Using libargs', params.libargs);
                }
                else if (ident == 'CC65_FLAGS' && value) {
                    params.extra_compiler_args = value.split(',').filter((s) => { return s != ''; });
                    console.log('Using compiler flags', params.extra_compiler_args);
                }
            }
        }
    }
}
exports.fixParamsWithDefines = fixParamsWithDefines;
function makeCPPSafe(s) {
    return s.replace(/[^A-Za-z0-9_]/g, '_');
}
function preprocessMCPP(step, filesys) {
    load("mcpp");
    var platform = step.platform;
    var params = PLATFORM_PARAMS[(0, util_1.getBasePlatform)(platform)];
    if (!params)
        throw Error("Platform not supported: " + platform);
    // <stdin>:2: error: Can't open include file "foo.h"
    var errors = [];
    var match_fn = makeErrorMatcher(errors, /<stdin>:(\d+): (.+)/, 1, 2, step.path);
    var MCPP = exports.emglobal.mcpp({
        noInitialRun: true,
        noFSInit: true,
        print: exports.print_fn,
        printErr: match_fn,
    });
    var FS = MCPP.FS;
    if (filesys)
        setupFS(FS, filesys);
    populateFiles(step, FS);
    populateExtraFiles(step, FS, params.extra_compile_files);
    // TODO: make configurable by other compilers
    var args = [
        "-D", "__8BITWORKSHOP__",
        "-D", "__SDCC_z80",
        "-D", makeCPPSafe(platform.toUpperCase()),
        "-I", "/share/include",
        "-Q",
        step.path, "main.i"
    ];
    if (step.mainfile) {
        args.unshift.apply(args, ["-D", "__MAIN__"]);
    }
    let platform_def = platform.toUpperCase().replaceAll(/[^a-zA-Z0-9]/g, '_');
    args.unshift.apply(args, ["-D", `__PLATFORM_${platform_def}__`]);
    if (params.extra_preproc_args) {
        args.push.apply(args, params.extra_preproc_args);
    }
    execMain(step, MCPP, args);
    if (errors.length)
        return { errors: errors };
    var iout = FS.readFile("main.i", { encoding: 'utf8' });
    iout = iout.replace(/^#line /gm, '\n# ');
    try {
        var errout = FS.readFile("mcpp.err", { encoding: 'utf8' });
        if (errout.length) {
            // //main.c:2: error: Can't open include file "stdiosd.h"
            var errors = extractErrors(/([^:]+):(\d+): (.+)/, errout.split("\n"), step.path, 2, 3, 1);
            if (errors.length == 0) {
                errors = errorResult(errout).errors;
            }
            return { errors: errors };
        }
    }
    catch (e) {
        //
    }
    return { code: iout };
}
exports.preprocessMCPP = preprocessMCPP;
function setupRequireFunction() {
    var exports = {};
    exports['jsdom'] = {
        JSDOM: function (a, b) {
            this.window = {};
        }
    };
    exports.emglobal['require'] = (modname) => {
        console.log('require', modname, exports[modname] != null);
        return exports[modname];
    };
}
exports.setupRequireFunction = setupRequireFunction;
////////////////////////////
const misc = __importStar(require("./tools/misc"));
const cc65 = __importStar(require("./tools/cc65"));
const dasm = __importStar(require("./tools/dasm"));
const sdcc = __importStar(require("./tools/sdcc"));
const verilog = __importStar(require("./tools/verilog"));
const m6809 = __importStar(require("./tools/m6809"));
const m6502 = __importStar(require("./tools/m6502"));
const z80 = __importStar(require("./tools/z80"));
const x86 = __importStar(require("./tools/x86"));
const arm = __importStar(require("./tools/arm"));
const ecs = __importStar(require("./tools/ecs"));
var TOOLS = {
    'dasm': dasm.assembleDASM,
    //'acme': assembleACME,
    //'plasm': compilePLASMA,
    'cc65': cc65.compileCC65,
    'ca65': cc65.assembleCA65,
    'ld65': cc65.linkLD65,
    //'z80asm': assembleZ80ASM,
    //'sccz80': compileSCCZ80,
    'sdasz80': sdcc.assembleSDASZ80,
    'sdldz80': sdcc.linkSDLDZ80,
    'sdcc': sdcc.compileSDCC,
    'xasm6809': m6809.assembleXASM6809,
    'cmoc': m6809.compileCMOC,
    'lwasm': m6809.assembleLWASM,
    'lwlink': m6809.linkLWLINK,
    //'naken': assembleNAKEN,
    'verilator': verilog.compileVerilator,
    'yosys': verilog.compileYosys,
    'jsasm': verilog.compileJSASMStep,
    'zmac': z80.assembleZMAC,
    'nesasm': m6502.assembleNESASM,
    'smlrc': x86.compileSmallerC,
    'yasm': x86.assembleYASM,
    'bataribasic': dasm.compileBatariBasic,
    'markdown': misc.translateShowdown,
    'inform6': misc.compileInform6,
    'merlin32': m6502.assembleMerlin32,
    'fastbasic': m6502.compileFastBasic,
    'basic': misc.compileBASIC,
    'silice': verilog.compileSilice,
    'wiz': misc.compileWiz,
    'armips': arm.assembleARMIPS,
    'vasmarm': arm.assembleVASMARM,
    //'js': script.runJavascript,
    'ecs': ecs.assembleECS,
};
var TOOL_PRELOADFS = {
    'cc65-apple2': '65-apple2',
    'ca65-apple2': '65-apple2',
    'cc65-c64': '65-c64',
    'ca65-c64': '65-c64',
    'cc65-vic20': '65-vic20',
    'ca65-vic20': '65-vic20',
    'cc65-nes': '65-nes',
    'ca65-nes': '65-nes',
    'cc65-atari8': '65-atari8',
    'ca65-atari8': '65-atari8',
    'cc65-vector': '65-none',
    'ca65-vector': '65-none',
    'cc65-atari7800': '65-none',
    'ca65-atari7800': '65-none',
    'cc65-devel': '65-none',
    'ca65-devel': '65-none',
    'ca65-vcs': '65-none',
    'sdasz80': 'sdcc',
    'sdcc': 'sdcc',
    'sccz80': 'sccz80',
    'bataribasic': '2600basic',
    'inform6': 'inform',
    'fastbasic': '65-atari8',
    'silice': 'Silice',
    'wiz': 'wiz',
    'ecs-vcs': '65-none',
    'ecs-nes': '65-nes',
    'ecs-c64': '65-c64', // TODO: support multiple platforms
};
//const waitFor = delay => new Promise(resolve => setTimeout(resolve, delay)); // for testing
async function handleMessage(data) {
    // preload file system
    if (data.preload) {
        var fs = TOOL_PRELOADFS[data.preload];
        if (!fs && data.platform)
            fs = TOOL_PRELOADFS[data.preload + '-' + (0, util_1.getBasePlatform)(data.platform)];
        if (!fs && data.platform)
            fs = TOOL_PRELOADFS[data.preload + '-' + (0, util_1.getRootBasePlatform)(data.platform)];
        if (fs && !fsMeta[fs])
            loadFilesystem(fs);
        return;
    }
    // clear filesystem? (TODO: buildkey)
    if (data.reset) {
        exports.store.reset();
        return;
    }
    return builder.handleMessage(data);
}
if (ENVIRONMENT_IS_WORKER) {
    var lastpromise = null;
    onmessage = async function (e) {
        await lastpromise; // wait for previous message to complete
        lastpromise = handleMessage(e.data);
        var result = await lastpromise;
        lastpromise = null;
        if (result) {
            try {
                postMessage(result);
            }
            catch (e) {
                console.log(e);
                postMessage(errorResult(`${e}`));
            }
        }
    };
}
//# sourceMappingURL=workermain.js.map