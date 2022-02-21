"use strict";
// TODO: must be a better way to do all this
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
exports.compileSilice = exports.compileYosys = exports.compileVerilator = exports.compileJSASMStep = void 0;
const assembler_1 = require("../assembler");
const vxmlparser = __importStar(require("../../common/hdl/vxmlparser"));
const workermain_1 = require("../workermain");
function detectModuleName(code) {
    var m = /^\s*module\s+(\w+_top)\b/m.exec(code)
        || /^\s*module\s+(top|t)\b/m.exec(code)
        || /^\s*module\s+(\w+)\b/m.exec(code);
    return m ? m[1] : null;
}
function detectTopModuleName(code) {
    var topmod = detectModuleName(code) || "top";
    var m = /^\s*module\s+(\w+?_top)/m.exec(code);
    if (m && m[1])
        topmod = m[1];
    return topmod;
}
// cached stuff (TODO)
var jsasm_module_top;
var jsasm_module_output;
var jsasm_module_key;
function compileJSASM(asmcode, platform, options, is_inline) {
    var asm = new assembler_1.Assembler(null);
    var includes = [];
    asm.loadJSON = (filename) => {
        var jsontext = (0, workermain_1.getWorkFileAsString)(filename);
        if (!jsontext)
            throw Error("could not load " + filename);
        return JSON.parse(jsontext);
    };
    asm.loadInclude = (filename) => {
        if (!filename.startsWith('"') || !filename.endsWith('"'))
            return 'Expected filename in "double quotes"';
        filename = filename.substr(1, filename.length - 2);
        includes.push(filename);
    };
    var loaded_module = false;
    asm.loadModule = (top_module) => {
        // compile last file in list
        loaded_module = true;
        var key = top_module + '/' + includes;
        if (jsasm_module_key != key) {
            jsasm_module_key = key;
            jsasm_module_output = null;
        }
        jsasm_module_top = top_module;
        var main_filename = includes[includes.length - 1];
        // TODO: take out .asm dependency
        var voutput = compileVerilator({ platform: platform, files: includes, path: main_filename, tool: 'verilator' });
        if (voutput)
            jsasm_module_output = voutput;
        return null; // no error
    };
    var result = asm.assembleFile(asmcode);
    if (loaded_module && jsasm_module_output) {
        // errors? return them
        if (jsasm_module_output.errors && jsasm_module_output.errors.length)
            return jsasm_module_output;
        // return program ROM array
        var asmout = result.output;
        // TODO: unify
        result.output = jsasm_module_output.output;
        // TODO: typecheck this garbage
        result.output.program_rom = asmout;
        // TODO: not cpu_platform__DOT__program_rom anymore, make const
        result.output.program_rom_variable = jsasm_module_top + "$program_rom";
        result.listings = {};
        result.listings[options.path] = { lines: result.lines };
        return result;
    }
    else {
        return result;
    }
}
function compileJSASMStep(step) {
    (0, workermain_1.gatherFiles)(step);
    var code = (0, workermain_1.getWorkFileAsString)(step.path);
    var platform = step.platform || 'verilog';
    return compileJSASM(code, platform, step, false);
}
exports.compileJSASMStep = compileJSASMStep;
function compileInlineASM(code, platform, options, errors, asmlines) {
    code = code.replace(/__asm\b([\s\S]+?)\b__endasm\b/g, function (s, asmcode, index) {
        var firstline = code.substr(0, index).match(/\n/g).length;
        var asmout = compileJSASM(asmcode, platform, options, true);
        if (asmout.errors && asmout.errors.length) {
            for (var i = 0; i < asmout.errors.length; i++) {
                asmout.errors[i].line += firstline;
                errors.push(asmout.errors[i]);
            }
            return "";
        }
        else if (asmout.output) {
            let s = "";
            var out = asmout.output;
            for (var i = 0; i < out.length; i++) {
                if (i > 0) {
                    s += ",";
                    if ((i & 0xff) == 0)
                        s += "\n";
                }
                s += 0 | out[i];
            }
            if (asmlines) {
                var al = asmout.lines;
                for (var i = 0; i < al.length; i++) {
                    al[i].line += firstline;
                    asmlines.push(al[i]);
                }
            }
            return s;
        }
    });
    return code;
}
function compileVerilator(step) {
    (0, workermain_1.loadNative)("verilator_bin");
    var platform = step.platform || 'verilog';
    var errors = [];
    (0, workermain_1.gatherFiles)(step);
    // compile verilog if files are stale
    if ((0, workermain_1.staleFiles)(step, [xmlPath])) {
        // TODO: %Error: Specified --top-module 'ALU' isn't at the top level, it's under another cell 'cpu'
        // TODO: ... Use "/* verilator lint_off BLKSEQ */" and lint_on around source to disable this message.
        var match_fn = (0, workermain_1.makeErrorMatcher)(errors, /%(.+?): (.+?):(\d+)?[:]?\s*(.+)/i, 3, 4, step.path, 2);
        var verilator_mod = workermain_1.emglobal.verilator_bin({
            instantiateWasm: (0, workermain_1.moduleInstFn)('verilator_bin'),
            noInitialRun: true,
            noExitRuntime: true,
            print: workermain_1.print_fn,
            printErr: match_fn,
            wasmMemory: (0, workermain_1.getWASMMemory)(), // reuse memory
            //INITIAL_MEMORY:256*1024*1024,
        });
        var code = (0, workermain_1.getWorkFileAsString)(step.path);
        var topmod = detectTopModuleName(code);
        var FS = verilator_mod.FS;
        var listings = {};
        // process inline assembly, add listings where found
        (0, workermain_1.populateFiles)(step, FS, {
            mainFilePath: step.path,
            processFn: (path, code) => {
                if (typeof code === 'string') {
                    let asmlines = [];
                    code = compileInlineASM(code, platform, step, errors, asmlines);
                    if (asmlines.length) {
                        listings[path] = { lines: asmlines };
                    }
                }
                return code;
            }
        });
        (0, workermain_1.starttime)();
        var xmlPath = `obj_dir/V${topmod}.xml`;
        try {
            var args = ["--cc", "-O3",
                "-DEXT_INLINE_ASM", "-DTOPMOD__" + topmod, "-D__8BITWORKSHOP__",
                "-Wall",
                "-Wno-DECLFILENAME", "-Wno-UNUSED", "-Wno-EOFNEWLINE", "-Wno-PROCASSWIRE",
                "--x-assign", "fast", "--noassert", "--pins-sc-biguint",
                "--debug-check",
                "--top-module", topmod, step.path];
            (0, workermain_1.execMain)(step, verilator_mod, args);
        }
        catch (e) {
            console.log(e);
            errors.push({ line: 0, msg: "Compiler internal error: " + e });
        }
        (0, workermain_1.endtime)("compile");
        // remove boring errors
        errors = errors.filter(function (e) { return !/Exiting due to \d+/.exec(e.msg); }, errors);
        errors = errors.filter(function (e) { return !/Use ["][/][*]/.exec(e.msg); }, errors);
        if (errors.length) {
            return { errors: errors };
        }
        (0, workermain_1.starttime)();
        var xmlParser = new vxmlparser.VerilogXMLParser();
        try {
            var xmlContent = FS.readFile(xmlPath, { encoding: 'utf8' });
            var xmlScrubbed = xmlContent.replace(/ fl=".+?" loc=".+?"/g, '');
            // TODO: this squelches the .asm listing
            //listings[step.prefix + '.xml'] = {lines:[],text:xmlContent};
            (0, workermain_1.putWorkFile)(xmlPath, xmlScrubbed); // don't detect changes in source position
            if (!(0, workermain_1.anyTargetChanged)(step, [xmlPath]))
                return;
            xmlParser.parse(xmlContent);
        }
        catch (e) {
            console.log(e, e.stack);
            if (e.$loc != null) {
                let $loc = e.$loc;
                errors.push({ msg: "" + e, path: $loc.path, line: $loc.line });
            }
            else {
                errors.push({ line: 0, msg: "" + e });
            }
            return { errors: errors, listings: listings };
        }
        finally {
            (0, workermain_1.endtime)("parse");
        }
        return {
            output: xmlParser,
            errors: errors,
            listings: listings,
        };
    }
}
exports.compileVerilator = compileVerilator;
// TODO: test
function compileYosys(step) {
    (0, workermain_1.loadNative)("yosys");
    var code = step.code;
    var errors = [];
    var match_fn = (0, workermain_1.makeErrorMatcher)(errors, /ERROR: (.+?) in line (.+?[.]v):(\d+)[: ]+(.+)/i, 3, 4, step.path);
    (0, workermain_1.starttime)();
    var yosys_mod = workermain_1.emglobal.yosys({
        instantiateWasm: (0, workermain_1.moduleInstFn)('yosys'),
        noInitialRun: true,
        print: workermain_1.print_fn,
        printErr: match_fn,
    });
    (0, workermain_1.endtime)("create module");
    var topmod = detectTopModuleName(code);
    var FS = yosys_mod.FS;
    FS.writeFile(topmod + ".v", code);
    (0, workermain_1.starttime)();
    try {
        (0, workermain_1.execMain)(step, yosys_mod, ["-q", "-o", topmod + ".json", "-S", topmod + ".v"]);
    }
    catch (e) {
        console.log(e);
        (0, workermain_1.endtime)("compile");
        return { errors: errors };
    }
    (0, workermain_1.endtime)("compile");
    //TODO: filename in errors
    if (errors.length)
        return { errors: errors };
    try {
        var json_file = FS.readFile(topmod + ".json", { encoding: 'utf8' });
        var json = JSON.parse(json_file);
        console.log(json);
        return { output: json, errors: errors }; // TODO
    }
    catch (e) {
        console.log(e);
        return { errors: errors };
    }
}
exports.compileYosys = compileYosys;
function compileSilice(step) {
    (0, workermain_1.loadNative)("silice");
    var params = step.params;
    (0, workermain_1.gatherFiles)(step, { mainFilePath: "main.ice" });
    var destpath = step.prefix + '.v';
    var errors = [];
    var errfile;
    var errline;
    if ((0, workermain_1.staleFiles)(step, [destpath])) {
        //[preprocessor] 97]  attempt to concatenate a nil value (global 'addrW')
        var match_fn = (s) => {
            s = s.replaceAll(/\033\[\d+\w/g, '');
            var mf = /file:\s*(\w+)/.exec(s);
            var ml = /line:\s+(\d+)/.exec(s);
            var preproc = /\[preprocessor\] (\d+)\] (.+)/.exec(s);
            if (mf)
                errfile = mf[1];
            else if (ml)
                errline = parseInt(ml[1]);
            else if (preproc) {
                errors.push({ path: step.path, line: parseInt(preproc[1]), msg: preproc[2] });
            }
            else if (errfile && errline && s.length > 1) {
                if (s.length > 2) {
                    errors.push({ path: errfile + ".ice", line: errline, msg: s });
                }
                else {
                    errfile = null;
                    errline = null;
                }
            }
            else
                console.log(s);
        };
        var silice = workermain_1.emglobal.silice({
            instantiateWasm: (0, workermain_1.moduleInstFn)('silice'),
            noInitialRun: true,
            print: match_fn,
            printErr: match_fn,
        });
        var FS = silice.FS;
        (0, workermain_1.setupFS)(FS, 'Silice');
        (0, workermain_1.populateFiles)(step, FS);
        (0, workermain_1.populateExtraFiles)(step, FS, params.extra_compile_files);
        const FWDIR = '/share/frameworks';
        var args = [
            '-D', 'NTSC=1',
            '--frameworks_dir', FWDIR,
            '-f', `/8bitworkshop.v`,
            '-o', destpath,
            step.path
        ];
        (0, workermain_1.execMain)(step, silice, args);
        if (errors.length)
            return { errors: errors };
        var vout = FS.readFile(destpath, { encoding: 'utf8' });
        (0, workermain_1.putWorkFile)(destpath, vout);
    }
    return {
        nexttool: "verilator",
        path: destpath,
        args: [destpath],
        files: [destpath],
    };
}
exports.compileSilice = compileSilice;
//# sourceMappingURL=verilog.js.map