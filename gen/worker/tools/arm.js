"use strict";
/*
 * Copyright (c) 2024 Steven E. Hugg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.assembleARMIPS = assembleARMIPS;
exports.assembleVASMARM = assembleVASMARM;
exports.compileARMTCC = compileARMTCC;
exports.linkARMTCC = linkARMTCC;
const binutils_1 = require("../../common/binutils");
const util_1 = require("../../common/util");
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const wasiutils_1 = require("../wasiutils");
const wasmutils_1 = require("../wasmutils");
function assembleARMIPS(step) {
    (0, wasmutils_1.loadNative)("armips");
    var errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.asm" });
    var objpath = "main.bin";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".sym";
    //test.armips(3) error: Parse error '.arm'
    var error_fn = (0, listingutils_1.makeErrorMatcher)(errors, /^(.+?)\((\d+)\)\s+(fatal error|error|warning):\s+(.+)/, 2, 4, step.path, 1);
    if ((0, builder_1.staleFiles)(step, [objpath])) {
        var args = [step.path, '-temp', lstpath, '-sym', sympath, '-erroronwarning'];
        var armips = wasmutils_1.emglobal.armips({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('armips'),
            noInitialRun: true,
            print: error_fn,
            printErr: error_fn,
        });
        var FS = armips.FS;
        var code = (0, builder_1.getWorkFileAsString)(step.path);
        code = `.arm.little :: .create "${objpath}",0 :: ${code}
  .close`;
        (0, builder_1.putWorkFile)(step.path, code);
        (0, builder_1.populateFiles)(step, FS);
        (0, wasmutils_1.execMain)(step, armips, args);
        if (errors.length)
            return { errors: errors };
        var objout = FS.readFile(objpath, { encoding: 'binary' });
        (0, builder_1.putWorkFile)(objpath, objout);
        if (!(0, builder_1.anyTargetChanged)(step, [objpath]))
            return;
        var symbolmap = {};
        var segments = [];
        var listings = {};
        var lstout = FS.readFile(lstpath, { encoding: 'utf8' });
        var lines = lstout.split(listingutils_1.re_crlf);
        //00000034 .word 0x11223344                                             ; /vidfill.armips line 25
        var re_asmline = /^([0-9A-F]+) (.+?); [/](.+?) line (\d+)/;
        var lastofs = -1;
        for (var line of lines) {
            var m;
            if (m = re_asmline.exec(line)) {
                var path = m[3];
                var path2 = (0, builder_1.getPrefix)(path) + '.lst'; // TODO: don't rename listing
                var lst = listings[path2];
                if (lst == null) {
                    lst = listings[path2] = { lines: [] };
                }
                var ofs = parseInt(m[1], 16);
                if (lastofs == ofs) {
                    lst.lines.pop(); // get rid of duplicate offset
                }
                else if (ofs > lastofs) {
                    var lastline = lst.lines[lst.lines.length - 1];
                    if (lastline && !lastline.insns) {
                        var insns = objout.slice(lastofs, ofs).reverse();
                        lastline.insns = Array.from(insns).map((b) => (0, util_1.hex)(b, 2)).join('');
                    }
                }
                lst.lines.push({
                    path: path,
                    line: parseInt(m[4]),
                    offset: ofs
                });
                lastofs = ofs;
            }
        }
        //listings[lstpath] = {lines:lstlines, text:lstout};
        var symout = FS.readFile(sympath, { encoding: 'utf8' });
        //0000000C loop2
        //00000034 .dbl:0004
        var re_symline = /^([0-9A-F]+)\s+(.+)/;
        for (var line of symout.split(listingutils_1.re_crlf)) {
            var m;
            if (m = re_symline.exec(line)) {
                symbolmap[m[2]] = parseInt(m[1], 16);
            }
        }
        return {
            output: objout, //.slice(0),
            listings: listings,
            errors: errors,
            symbolmap: symbolmap,
            segments: segments
        };
    }
}
function assembleVASMARM(step) {
    (0, wasmutils_1.loadNative)("vasmarm_std");
    /// error 2 in line 8 of "gfxtest.c": unknown mnemonic <ew>
    /// error 3007: undefined symbol <XXLOOP>
    /// TODO: match undefined symbols
    var re_err1 = /^(fatal error|error|warning)? (\d+) in line (\d+) of "(.+)": (.+)/;
    var re_err2 = /^(fatal error|error|warning)? (\d+): (.+)/;
    var re_undefsym = /symbol <(.+?)>/;
    var errors = [];
    var undefsyms = [];
    function findUndefinedSymbols(line) {
        // find undefined symbols in line
        undefsyms.forEach((sym) => {
            if (line.indexOf(sym) >= 0) {
                errors.push({
                    path: curpath,
                    line: curline,
                    msg: "Undefined symbol: " + sym,
                });
            }
        });
    }
    function match_fn(s) {
        let matches = re_err1.exec(s);
        if (matches) {
            errors.push({
                line: parseInt(matches[3]),
                path: matches[4],
                msg: matches[5],
            });
        }
        else {
            matches = re_err2.exec(s);
            if (matches) {
                let m = re_undefsym.exec(matches[3]);
                if (m) {
                    undefsyms.push(m[1]);
                }
                else {
                    errors.push({
                        line: 0,
                        msg: s,
                    });
                }
            }
            else {
                console.log(s);
            }
        }
    }
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.asm" });
    var objpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";
    if ((0, builder_1.staleFiles)(step, [objpath])) {
        var args = ['-Fbin', '-m7tdmi', '-x', '-wfail', step.path, '-o', objpath, '-L', lstpath];
        var vasm = wasmutils_1.emglobal.vasm({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('vasmarm_std'),
            noInitialRun: true,
            print: match_fn,
            printErr: match_fn,
        });
        var FS = vasm.FS;
        (0, builder_1.populateFiles)(step, FS);
        (0, wasmutils_1.execMain)(step, vasm, args);
        if (errors.length) {
            return { errors: errors };
        }
        if (undefsyms.length == 0) {
            var objout = FS.readFile(objpath, { encoding: 'binary' });
            (0, builder_1.putWorkFile)(objpath, objout);
            if (!(0, builder_1.anyTargetChanged)(step, [objpath]))
                return;
        }
        var lstout = FS.readFile(lstpath, { encoding: 'utf8' });
        // 00:00000018 023020E0        	    14:  eor r3, r0, r2
        // Source: "vidfill.vasm"
        // 00: ".text" (0-40)
        // LOOP                            00:00000018
        // STACK                            S:20010000
        var symbolmap = {};
        var segments = []; // TODO
        var listings = {};
        // TODO: parse listings
        var re_asmline = /^(\d+):([0-9A-F]+)\s+([0-9A-F ]+)\s+(\d+)([:M])/;
        var re_secline = /^(\d+):\s+"(.+)"/;
        var re_nameline = /^Source:\s+"(.+)"/;
        var re_symline = /^(\w+)\s+(\d+):([0-9A-F]+)/;
        var re_emptyline = /^\s+(\d+)([:M])/;
        var curpath = step.path;
        var curline = 0;
        var sections = {};
        // map file and section indices -> names
        var lines = lstout.split(listingutils_1.re_crlf);
        // parse lines
        var lstlines = [];
        for (var line of lines) {
            var m;
            if (m = re_secline.exec(line)) {
                sections[m[1]] = m[2];
            }
            else if (m = re_nameline.exec(line)) {
                curpath = m[1];
            }
            else if (m = re_symline.exec(line)) {
                symbolmap[m[1]] = parseInt(m[3], 16);
            }
            else if (m = re_asmline.exec(line)) {
                if (m[5] == ':') {
                    curline = parseInt(m[4]);
                }
                else {
                    // TODO: macro line
                }
                lstlines.push({
                    path: curpath,
                    line: curline,
                    offset: parseInt(m[2], 16),
                    insns: m[3].replaceAll(' ', '')
                });
                findUndefinedSymbols(line);
            }
            else if (m = re_emptyline.exec(line)) {
                curline = parseInt(m[1]);
                findUndefinedSymbols(line);
            }
            else {
                //console.log(line);
            }
        }
        listings[lstpath] = { lines: lstlines, text: lstout };
        // catch-all if no error generated
        if (undefsyms.length && errors.length == 0) {
            errors.push({
                line: 0,
                msg: 'Undefined symbols: ' + undefsyms.join(', ')
            });
        }
        return {
            output: objout, //.slice(0x34),
            listings: listings,
            errors: errors,
            symbolmap: symbolmap,
            segments: segments
        };
    }
}
function tccErrorMatcher(errors, mainpath) {
    return (0, listingutils_1.makeErrorMatcher)(errors, /([^:]+|tcc):(\d+|\s*error): (.+)/, 2, 3, mainpath, 1);
    ;
}
let armtcc_fs = null;
async function compileARMTCC(step) {
    (0, wasmutils_1.loadNative)("arm-tcc");
    const params = step.params;
    const errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.c" });
    const objpath = step.prefix + ".o";
    const error_fn = tccErrorMatcher(errors, step.path);
    if (!armtcc_fs) {
        armtcc_fs = await (0, wasiutils_1.loadWASIFilesystemZip)("arm32-fs.zip");
    }
    if ((0, builder_1.staleFiles)(step, [objpath])) {
        const armtcc = await wasmutils_1.emglobal.armtcc({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('arm-tcc'),
            noInitialRun: true,
            print: error_fn,
            printErr: error_fn,
        });
        var args = ['-c', '-I.', '-I./include',
            //'-std=c11',
            '-funsigned-char',
            //'-Wwrite-strings',
            '-gdwarf-2',
            '-o', objpath];
        if (params.define) {
            params.define.forEach((x) => args.push('-D' + x));
        }
        if (params.extra_compile_args) {
            args = args.concat(params.extra_compile_args);
        }
        args.push(step.path);
        const FS = armtcc.FS;
        // TODO: only should do once?
        armtcc_fs.getDirectories().forEach((dir) => {
            if (dir.name != '/')
                FS.mkdir(dir.name);
        });
        armtcc_fs.getFiles().forEach((file) => {
            FS.writeFile(file.name, file.getBytes(), { encoding: 'binary' });
        });
        (0, builder_1.populateExtraFiles)(step, FS, params.extra_compile_files);
        (0, builder_1.populateFiles)(step, FS, {
            mainFilePath: step.path,
            processFn: (path, code) => {
                if (typeof code === 'string') {
                    code = (0, builder_1.processEmbedDirective)(code);
                }
                return code;
            }
        });
        (0, wasmutils_1.execMain)(step, armtcc, args);
        if (errors.length)
            return { errors: errors };
        var objout = FS.readFile(objpath, { encoding: 'binary' });
        (0, builder_1.putWorkFile)(objpath, objout);
    }
    return {
        linktool: "armtcclink",
        files: [objpath],
        args: [objpath]
    };
}
async function linkARMTCC(step) {
    (0, wasmutils_1.loadNative)("arm-tcc");
    const params = step.params;
    const errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.c" });
    const objpath = "main.elf";
    const error_fn = tccErrorMatcher(errors, step.path);
    if ((0, builder_1.staleFiles)(step, [objpath])) {
        const armtcc = await wasmutils_1.emglobal.armtcc({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('arm-tcc'),
            noInitialRun: true,
            print: error_fn,
            printErr: error_fn,
        });
        var args = ['-L.', '-nostdlib', '-nostdinc',
            '-Wl,--oformat=elf32-arm',
            //'-Wl,-section-alignment=0x100000',
            '-gdwarf-2',
            '-o', objpath];
        if (params.define) {
            params.define.forEach((x) => args.push('-D' + x));
        }
        args = args.concat(step.files);
        if (params.extra_link_args) {
            args = args.concat(params.extra_link_args);
        }
        const FS = armtcc.FS;
        (0, builder_1.populateExtraFiles)(step, FS, params.extra_link_files);
        (0, builder_1.populateFiles)(step, FS);
        (0, wasmutils_1.execMain)(step, armtcc, args);
        if (errors.length)
            return { errors: errors };
        var objout = FS.readFile(objpath, { encoding: 'binary' });
        (0, builder_1.putWorkFile)(objpath, objout);
        if (!(0, builder_1.anyTargetChanged)(step, [objpath]))
            return;
        // parse ELF and create ROM
        const elfparser = new binutils_1.ELFParser(objout);
        let maxaddr = 0;
        elfparser.sectionHeaders.forEach((section, index) => {
            maxaddr = Math.max(maxaddr, section.vmaddr + section.size);
        });
        let rom = new Uint8Array(maxaddr);
        elfparser.sectionHeaders.forEach((section, index) => {
            if (section.flags & 0x2) {
                let data = objout.slice(section.offset, section.offset + section.size);
                //console.log(section.name, section.vmaddr.toString(16), data);
                rom.set(data, section.vmaddr);
            }
        });
        // set vectors, entry point etc
        const obj32 = new Uint32Array(rom.buffer);
        const start = elfparser.entry;
        obj32[0] = start; // set reset vector
        obj32[1] = start; // set undefined vector
        obj32[2] = start; // set swi vector
        obj32[3] = start; // set prefetch abort vector
        obj32[4] = start; // set data abort vector
        obj32[5] = start; // set reserved vector
        obj32[6] = start; // set irq vector
        obj32[7] = start; // set fiq vector
        let symbolmap = {};
        elfparser.getSymbols().forEach((symbol, index) => {
            symbolmap[symbol.name] = symbol.value;
        });
        let segments = [];
        elfparser.sectionHeaders.forEach((section, index) => {
            if ((section.flags & 0x2) && section.size) {
                segments.push({
                    name: section.name,
                    start: section.vmaddr,
                    size: section.size,
                    type: section.type,
                });
            }
        });
        const listings = {};
        const dwarf = new binutils_1.DWARFParser(elfparser);
        dwarf.lineInfos.forEach((lineInfo) => {
            lineInfo.files.forEach((file) => {
                if (!file || !file.lines)
                    return;
                file.lines.forEach((line) => {
                    const filename = line.file;
                    const offset = line.address;
                    const path = (0, builder_1.getPrefix)(filename) + '.lst';
                    const linenum = line.line;
                    let lst = listings[path];
                    if (lst == null) {
                        lst = listings[path] = { lines: [] };
                    }
                    lst.lines.push({
                        path,
                        line: linenum,
                        offset
                    });
                });
            });
        });
        //console.log(listings);
        return {
            output: rom, //.slice(0x34),
            listings: listings,
            errors: errors,
            symbolmap: symbolmap,
            segments: segments,
            debuginfo: dwarf
        };
    }
}
//# sourceMappingURL=arm.js.map