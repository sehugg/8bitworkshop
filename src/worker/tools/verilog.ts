
// TODO: must be a better way to do all this

import { WorkerError, CodeListingMap, SourceLocation } from "../../common/workertypes";
import { Assembler } from "../assembler";
import * as vxmlparser from '../../common/hdl/vxmlparser';
import { getWorkFileAsString, BuildStep, BuildStepResult, gatherFiles, loadNative, staleFiles, makeErrorMatcher, emglobal, moduleInstFn, print_fn, populateFiles, execMain, putWorkFile, anyTargetChanged, endtime, getWASMMemory, starttime, populateExtraFiles, setupFS } from "../workermain";
import { EmscriptenModule } from "../workermain"

function detectModuleName(code: string) {
    var m = /^\s*module\s+(\w+_top)\b/m.exec(code)
        || /^\s*module\s+(top|t)\b/m.exec(code)
        || /^\s*module\s+(\w+)\b/m.exec(code);
    return m ? m[1] : null;
}

function detectTopModuleName(code: string) {
    var topmod = detectModuleName(code) || "top";
    var m = /^\s*module\s+(\w+?_top)/m.exec(code);
    if (m && m[1]) topmod = m[1];
    return topmod;
}

// cached stuff (TODO)
var jsasm_module_top;
var jsasm_module_output;
var jsasm_module_key;

function compileJSASM(asmcode: string, platform, options, is_inline) {
    var asm = new Assembler(null);
    var includes = [];
    asm.loadJSON = (filename: string) => {
        var jsontext = getWorkFileAsString(filename);
        if (!jsontext) throw Error("could not load " + filename);
        return JSON.parse(jsontext);
    };
    asm.loadInclude = (filename) => {
        if (!filename.startsWith('"') || !filename.endsWith('"'))
            return 'Expected filename in "double quotes"';
        filename = filename.substr(1, filename.length - 2);
        includes.push(filename);
    };
    var loaded_module = false;
    asm.loadModule = (top_module: string) => {
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
    }
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
        (result as any).output.program_rom = asmout;
        // TODO: not cpu_platform__DOT__program_rom anymore, make const
        (result as any).output.program_rom_variable = jsasm_module_top + "$program_rom";
        (result as any).listings = {};
        (result as any).listings[options.path] = { lines: result.lines };
        return result;
    } else {
        return result;
    }
}

export function compileJSASMStep(step: BuildStep): BuildStepResult {
    gatherFiles(step);
    var code = getWorkFileAsString(step.path);
    var platform = step.platform || 'verilog';
    return compileJSASM(code, platform, step, false);
}

function compileInlineASM(code: string, platform, options, errors, asmlines) {
    code = code.replace(/__asm\b([\s\S]+?)\b__endasm\b/g, function (s, asmcode, index) {
        var firstline = code.substr(0, index).match(/\n/g).length;
        var asmout = compileJSASM(asmcode, platform, options, true);
        if (asmout.errors && asmout.errors.length) {
            for (var i = 0; i < asmout.errors.length; i++) {
                asmout.errors[i].line += firstline;
                errors.push(asmout.errors[i]);
            }
            return "";
        } else if (asmout.output) {
            let s = "";
            var out = asmout.output;
            for (var i = 0; i < out.length; i++) {
                if (i > 0) {
                    s += ",";
                    if ((i & 0xff) == 0) s += "\n";
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

export function compileVerilator(step: BuildStep): BuildStepResult {
    loadNative("verilator_bin");
    var platform = step.platform || 'verilog';
    var errors: WorkerError[] = [];
    gatherFiles(step);
    // compile verilog if files are stale
    if (staleFiles(step, [xmlPath])) {
        // TODO: %Error: Specified --top-module 'ALU' isn't at the top level, it's under another cell 'cpu'
        // TODO: ... Use "/* verilator lint_off BLKSEQ */" and lint_on around source to disable this message.
        var match_fn = makeErrorMatcher(errors, /%(.+?): (.+?):(\d+)?[:]?\s*(.+)/i, 3, 4, step.path, 2);
        var verilator_mod: EmscriptenModule = emglobal.verilator_bin({
            instantiateWasm: moduleInstFn('verilator_bin'),
            noInitialRun: true,
            noExitRuntime: true,
            print: print_fn,
            printErr: match_fn,
            wasmMemory: getWASMMemory(), // reuse memory
            //INITIAL_MEMORY:256*1024*1024,
        });
        var code = getWorkFileAsString(step.path);
        var topmod = detectTopModuleName(code);
        var FS = verilator_mod.FS;
        var listings: CodeListingMap = {};
        // process inline assembly, add listings where found
        populateFiles(step, FS, {
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
        starttime();
        var xmlPath = `obj_dir/V${topmod}.xml`;
        try {
            var args = ["--cc", "-O3",
                "-DEXT_INLINE_ASM", "-DTOPMOD__" + topmod, "-D__8BITWORKSHOP__",
                "-Wall",
                "-Wno-DECLFILENAME", "-Wno-UNUSED", "-Wno-EOFNEWLINE", "-Wno-PROCASSWIRE",
                "--x-assign", "fast", "--noassert", "--pins-sc-biguint",
                "--debug-check", // for XML output
                "--top-module", topmod, step.path]
            execMain(step, verilator_mod, args);
        } catch (e) {
            console.log(e);
            errors.push({ line: 0, msg: "Compiler internal error: " + e });
        }
        endtime("compile");
        // remove boring errors
        errors = errors.filter(function (e) { return !/Exiting due to \d+/.exec(e.msg); }, errors);
        errors = errors.filter(function (e) { return !/Use ["][/][*]/.exec(e.msg); }, errors);
        if (errors.length) {
            return { errors: errors };
        }
        starttime();
        var xmlParser = new vxmlparser.VerilogXMLParser();
        try {
            var xmlContent = FS.readFile(xmlPath, { encoding: 'utf8' });
            var xmlScrubbed = xmlContent.replace(/ fl=".+?" loc=".+?"/g, '');
            // TODO: this squelches the .asm listing
            //listings[step.prefix + '.xml'] = {lines:[],text:xmlContent};
            putWorkFile(xmlPath, xmlScrubbed); // don't detect changes in source position
            if (!anyTargetChanged(step, [xmlPath]))
                return;
            xmlParser.parse(xmlContent);
        } catch (e) {
            console.log(e, e.stack);
            if (e.$loc != null) {
                let $loc = e.$loc as SourceLocation;
                errors.push({ msg: "" + e, path: $loc.path, line: $loc.line });
            } else {
                errors.push({ line: 0, msg: "" + e });
            }
            return { errors: errors, listings: listings };
        } finally {
            endtime("parse");
        }
        return {
            output: xmlParser,
            errors: errors,
            listings: listings,
        };
    }
}

// TODO: test
export function compileYosys(step: BuildStep): BuildStepResult {
    loadNative("yosys");
    var code = step.code;
    var errors = [];
    var match_fn = makeErrorMatcher(errors, /ERROR: (.+?) in line (.+?[.]v):(\d+)[: ]+(.+)/i, 3, 4, step.path);
    starttime();
    var yosys_mod: EmscriptenModule = emglobal.yosys({
        instantiateWasm: moduleInstFn('yosys'),
        noInitialRun: true,
        print: print_fn,
        printErr: match_fn,
    });
    endtime("create module");
    var topmod = detectTopModuleName(code);
    var FS = yosys_mod.FS;
    FS.writeFile(topmod + ".v", code);
    starttime();
    try {
        execMain(step, yosys_mod, ["-q", "-o", topmod + ".json", "-S", topmod + ".v"]);
    } catch (e) {
        console.log(e);
        endtime("compile");
        return { errors: errors };
    }
    endtime("compile");
    //TODO: filename in errors
    if (errors.length) return { errors: errors };
    try {
        var json_file = FS.readFile(topmod + ".json", { encoding: 'utf8' });
        var json = JSON.parse(json_file);
        console.log(json);
        return { output: json, errors: errors }; // TODO
    } catch (e) {
        console.log(e);
        return { errors: errors };
    }
}

export function compileSilice(step: BuildStep): BuildStepResult {
    loadNative("silice");
    var params = step.params;
    gatherFiles(step, { mainFilePath: "main.ice" });
    var destpath = step.prefix + '.v';
    var errors: WorkerError[] = [];
    var errfile: string;
    var errline: number;
    if (staleFiles(step, [destpath])) {
        //[preprocessor] 97]  attempt to concatenate a nil value (global 'addrW')
        var match_fn = (s: string) => {
            s = (s as any).replaceAll(/\033\[\d+\w/g, '');
            var mf = /file:\s*(\w+)/.exec(s);
            var ml = /line:\s+(\d+)/.exec(s);
            var preproc = /\[preprocessor\] (\d+)\] (.+)/.exec(s);
            if (mf) errfile = mf[1];
            else if (ml) errline = parseInt(ml[1]);
            else if (preproc) {
                errors.push({ path: step.path, line: parseInt(preproc[1]), msg: preproc[2] });
            }
            else if (errfile && errline && s.length > 1) {
                if (s.length > 2) {
                    errors.push({ path: errfile + ".ice", line: errline, msg: s });
                } else {
                    errfile = null;
                    errline = null;
                }
            }
            else console.log(s);
        }
        var silice: EmscriptenModule = emglobal.silice({
            instantiateWasm: moduleInstFn('silice'),
            noInitialRun: true,
            print: match_fn,
            printErr: match_fn,
        });
        var FS = silice.FS;
        setupFS(FS, 'Silice');
        populateFiles(step, FS);
        populateExtraFiles(step, FS, params.extra_compile_files);
        const FWDIR = '/share/frameworks';
        var args = [
            '-D', 'NTSC=1',
            '--frameworks_dir', FWDIR,
            '-f', `/8bitworkshop.v`,
            '-o', destpath,
            step.path];
        execMain(step, silice, args);
        if (errors.length)
            return { errors: errors };
        var vout = FS.readFile(destpath, { encoding: 'utf8' });
        putWorkFile(destpath, vout);
    }
    return {
        nexttool: "verilator",
        path: destpath,
        args: [destpath],
        files: [destpath],
    };
}

