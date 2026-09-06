"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assembleACME = assembleACME;
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const wasishim_1 = require("../../common/wasi/wasishim");
const wasmutils_1 = require("../wasmutils");
function parseACMESymbolTable(text) {
    var symbolmap = {};
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i].trim();
        // 	init_text	= $81b	; ?
        var m = line.match(/(\w+)\s*=\s*[$]([0-9a-f]+)/i);
        if (m) {
            symbolmap[m[1]] = parseInt(m[2], 16);
        }
    }
    return symbolmap;
}
function parseACMEReportFile(text) {
    var listings = {};
    var listing;
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i].trim();
        // ; ******** Source: hello.acme
        var m1 = line.match(/^;\s*[*]+\s*Source: (.+)$/);
        if (m1) {
            var file = m1[1];
            listings[file] = listing = {
                lines: [],
            };
            continue;
        }
        //    15  0815 201b08             		jsr init_text		; write line of text
        var m2 = line.match(/^(\d+)\s+([0-9a-f]+)\s+([0-9a-f]+)/i);
        if (m2) {
            if (listing) {
                listing.lines.push({
                    line: parseInt(m2[1]),
                    offset: parseInt(m2[2], 16),
                    insns: m2[3],
                });
            }
        }
    }
    return listings;
}
let wasiModule = null;
function assembleACME(step) {
    var _a;
    let errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.acme" });
    var binpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".sym";
    if ((0, builder_1.staleFiles)(step, [binpath])) {
        if (!wasiModule) {
            wasiModule = new WebAssembly.Module((0, wasmutils_1.loadWASMBinary)("acme"));
        }
        const wasi = new wasishim_1.WASIRunner();
        wasi.initSync(wasiModule);
        for (let file of step.files) {
            wasi.fs.putFile("./" + file, builder_1.store.getFileData(file));
        }
        wasi.addPreopenDirectory(".");
        var args = ['--msvc', '--initmem', '0', '-o', binpath, '-r', lstpath, '-l', sympath, step.path];
        if ((_a = step.params) === null || _a === void 0 ? void 0 : _a.acmeargs) {
            args.unshift.apply(args, step.params.acmeargs);
        }
        else {
            args.unshift.apply(args, ['-f', 'plain']);
        }
        args.unshift.apply(args, ["-D__8BITWORKSHOP__=1"]);
        if (step.mainfile) {
            args.unshift.apply(args, ["-D__MAIN__=1"]);
        }
        wasi.setArgs(['acme', ...args]);
        try {
            wasi.run();
        }
        catch (e) {
            errors.push({ line: 0, msg: "" + e });
        }
        const stdout = wasi.fds[1].getBytesAsString();
        const stderr = wasi.fds[2].getBytesAsString();
        if (stdout)
            console.log(stdout);
        const matcher = (0, listingutils_1.msvcErrorMatcher)(errors);
        for (let line of stderr.split(listingutils_1.re_crlf)) {
            matcher(line);
        }
        if (errors.length) {
            let listings = {};
            return { errors, listings };
        }
        let binout, lstout, symout;
        try {
            binout = wasi.fs.getFile("./" + binpath).getBytes();
            lstout = wasi.fs.getFile("./" + lstpath).getBytesAsString();
            symout = wasi.fs.getFile("./" + sympath).getBytesAsString();
        }
        catch (e) {
            errors.push({ line: 0, msg: "No output generated, maybe a fatal assembly error?" });
            return { errors };
        }
        (0, builder_1.putWorkFile)(binpath, binout);
        (0, builder_1.putWorkFile)(lstpath, lstout);
        (0, builder_1.putWorkFile)(sympath, symout);
        return {
            output: binout,
            listings: parseACMEReportFile(lstout),
            errors: errors,
            symbolmap: parseACMESymbolTable(symout),
        };
    }
}
//# sourceMappingURL=acme.js.map