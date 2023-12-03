import { CodeListing, CodeListingMap } from "../../common/workertypes";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, populateFiles, fixParamsWithDefines, putWorkFile } from "../builder";
import { msvcErrorMatcher } from "../listingutils";
import { loadNative, moduleInstFn, print_fn, setupFS, execMain, emglobal, EmscriptenModule } from "../wasmutils";

function parseACMESymbolTable(text: string) {
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

function parseACMEReportFile(text: string) {
    var listings : CodeListingMap = {};
    var listing : CodeListing;
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

export function assembleACME(step: BuildStep): BuildStepResult {
    loadNative("acme");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.acme" });
    var binpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".sym";
    if (staleFiles(step, [binpath])) {
        var binout, lstout, symout;
        var ACME: EmscriptenModule = emglobal.acme({
            instantiateWasm: moduleInstFn('acme'),
            noInitialRun: true,
            print: print_fn,
            printErr: msvcErrorMatcher(errors),
            //printErr: makeErrorMatcher(errors, /(Error|Warning) - File (.+?), line (\d+)[^:]+: (.+)/, 3, 4, step.path, 2),
        });
        var FS = ACME.FS;
        populateFiles(step, FS);
        fixParamsWithDefines(step.path, step.params);
        var args = ['--msvc', '--initmem', '0', '-o', binpath, '-r', lstpath, '-l', sympath, step.path];
        if (step.params?.acmeargs) {
            args.unshift.apply(args, step.params.acmeargs);
        } else {
            args.unshift.apply(args, ['-f', 'plain']);
        }
        args.unshift.apply(args, ["-D__8BITWORKSHOP__=1"]);
        if (step.mainfile) {
            args.unshift.apply(args, ["-D__MAIN__=1"]);
        }
        execMain(step, ACME, args);
        if (errors.length) {
            let listings: CodeListingMap = {};
            return { errors, listings };
        }
        binout = FS.readFile(binpath, { encoding: 'binary' });
        lstout = FS.readFile(lstpath, { encoding: 'utf8' });
        symout = FS.readFile(sympath, { encoding: 'utf8' });
        putWorkFile(binpath, binout);
        putWorkFile(lstpath, lstout);
        putWorkFile(sympath, symout);
        return {
            output: binout,
            listings: parseACMEReportFile(lstout),
            errors: errors,
            symbolmap: parseACMESymbolTable(symout),
        };
    }
}
