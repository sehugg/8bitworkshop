"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assembleACME = assembleACME;
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
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
function assembleACME(step) {
    var _a;
    (0, wasmutils_1.loadNative)("acme");
    var errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.acme" });
    var binpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".sym";
    if ((0, builder_1.staleFiles)(step, [binpath])) {
        var binout, lstout, symout;
        var ACME = wasmutils_1.emglobal.acme({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('acme'),
            noInitialRun: true,
            print: wasmutils_1.print_fn,
            printErr: (0, listingutils_1.msvcErrorMatcher)(errors),
            //printErr: makeErrorMatcher(errors, /(Error|Warning) - File (.+?), line (\d+)[^:]+: (.+)/, 3, 4, step.path, 2),
        });
        var FS = ACME.FS;
        (0, builder_1.populateFiles)(step, FS);
        (0, builder_1.fixParamsWithDefines)(step.path, step.params);
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
        (0, wasmutils_1.execMain)(step, ACME, args);
        if (errors.length) {
            let listings = {};
            return { errors, listings };
        }
        binout = FS.readFile(binpath, { encoding: 'binary' });
        lstout = FS.readFile(lstpath, { encoding: 'utf8' });
        symout = FS.readFile(sympath, { encoding: 'utf8' });
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