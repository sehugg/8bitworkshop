import { CodeListing, CodeListingMap, WorkerError } from "../../common/workertypes";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, putWorkFile, store } from "../builder";
import { msvcErrorMatcher, re_crlf } from "../listingutils";
import { WASIRunner } from "../../common/wasi/wasishim";
import { loadWASMBinary } from "../wasmutils";

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

let wasiModule: WebAssembly.Module | null = null;

export function assembleACME(step: BuildStep): BuildStepResult {
    let errors: WorkerError[] = [];
    gatherFiles(step, { mainFilePath: "main.acme" });
    var binpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".sym";
    if (staleFiles(step, [binpath])) {
        if (!wasiModule) {
            wasiModule = new WebAssembly.Module(loadWASMBinary("acme"));
        }
        const wasi = new WASIRunner();
        wasi.initSync(wasiModule);
        for (let file of step.files) {
            wasi.fs.putFile("./" + file, store.getFileData(file));
        }
        wasi.addPreopenDirectory(".");
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
        wasi.setArgs(['acme', ...args]);
        try {
            wasi.run();
        } catch (e) {
            errors.push({ line: 0, msg: "" + e });
        }
        const stdout = wasi.fds[1].getBytesAsString();
        const stderr = wasi.fds[2].getBytesAsString();
        if (stdout) console.log(stdout);
        const matcher = msvcErrorMatcher(errors);
        for (let line of stderr.split(re_crlf)) {
            matcher(line);
        }
        if (errors.length) {
            let listings: CodeListingMap = {};
            return { errors, listings };
        }
        let binout: Uint8Array, lstout: string, symout: string;
        try {
            binout = wasi.fs.getFile("./" + binpath).getBytes();
            lstout = wasi.fs.getFile("./" + lstpath).getBytesAsString();
            symout = wasi.fs.getFile("./" + sympath).getBytesAsString();
        } catch (e) {
            errors.push({ line: 0, msg: "No output generated, maybe a fatal assembly error?" });
            return { errors };
        }
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
