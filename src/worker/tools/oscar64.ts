import { WASIFilesystem, WASIRunner } from "../../common/wasi/wasishim";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, store, putWorkFile } from "../builder";
import { makeErrorMatcher } from "../listingutils";
import { parseOscar64Listing, parseOscar64Lbl, parseOscar64Map } from "./oscar64parse";
import { loadWASIFilesystemZip } from "../wasiutils";
import { loadWASMBinary } from "../wasmutils";

let oscar64_fs: WASIFilesystem | null = null;
let wasiModule: WebAssembly.Module | null = null;

// find a file in the WASI fs whose name ends with the given suffix.
// oscar64 writes files as "./path/name.ext" (or "././name.ext" when the
// output was specified with a "./" prefix), so match on suffix only.
function getWasiFileAsString(wasi: WASIRunner, suffix: string): string | null {
    for (const fd of wasi.fs.getFiles()) {
        if (fd.name.endsWith(suffix)) {
            return fd.getBytesAsString();
        }
    }
    return null;
}

export async function compileOscar64(step: BuildStep): Promise<BuildStepResult> {
    const errors = [];
    gatherFiles(step, { mainFilePath: "main.c" });
    const destpath = "./" + (step.path || "main.c").replace(/\.[^.]+$/, ".prg");
    if (staleFiles(step, [destpath])) {
        if (!oscar64_fs) {
            oscar64_fs = await loadWASIFilesystemZip("oscar64-fs.zip");
        }
        if (!wasiModule) {
            wasiModule = new WebAssembly.Module(loadWASMBinary("oscar64"));
        }
        const wasi = new WASIRunner();
        wasi.initSync(wasiModule);
        wasi.fs.setParent(oscar64_fs);
        for (let file of step.files) {
            wasi.fs.putFile("./" + file, store.getFileData(file));
        }
        wasi.addPreopenDirectory("include");
        wasi.addPreopenDirectory(".");
        wasi.setArgs(["oscar64", "-v", "-g", "-ii=include", "-o=" + destpath, step.path]);
        try {
            wasi.run();
        } catch (e) {
            errors.push(e);
        }
        let stdout = wasi.fds[1].getBytesAsString();
        let stderr = wasi.fds[2].getBytesAsString();
        console.log('stdout', stdout);
        console.log('stderr', stderr);
        // (58, 17) : error 3001: Could not open source file. 'stdlib.c'
        const matcher = makeErrorMatcher(errors, /\((\d+),\s+(\d+)\)\s+: error (\d+): (.+)/, 1, 4, step.path);
        const matcher2 = makeErrorMatcher(errors, /oscar64: error (\d+): (.+)/, 0, 2, step.path);
        for (let line of stderr.split('\n')) {
            matcher(line);
            matcher2(line);
        }
        if (errors.length) {
            return { errors };
        }
        const output = wasi.fs.getFile("./" + destpath).getBytes();
        putWorkFile(destpath, output);
        // read and parse oscar64 auxiliary output files (.map, .lbl, .asm)
        const prefix = destpath.replace(/\.prg$/, '');
        let mapout = getWasiFileAsString(wasi, prefix + ".map") || getWasiFileAsString(wasi, ".map");
        let lblout = getWasiFileAsString(wasi, prefix + ".lbl") || getWasiFileAsString(wasi, ".lbl");
        let asmout = getWasiFileAsString(wasi, prefix + ".asm") || getWasiFileAsString(wasi, ".asm");
        let segments = [];
        let symbolmap = {};
        if (mapout) {
            let parsed = parseOscar64Map(mapout);
            segments = parsed.segments;
            symbolmap = parsed.symbolmap;
            putWorkFile(prefix + ".map", mapout);
        }
        if (lblout) {
            // merge any extra symbols from the .lbl file
            symbolmap = Object.assign(parseOscar64Lbl(lblout), symbolmap);
            putWorkFile(prefix + ".lbl", lblout);
        }
        let listings = {};
        if (asmout) {
            let { srclines, asmlines } = parseOscar64Listing(asmout, step.path);
            let lstpath = prefix.replace(/^\.\//, '') + '.lst';
            putWorkFile(prefix + ".asm", asmout);
            listings[lstpath] = {
                lines: srclines,
                asmlines: asmlines,
                text: asmout,
            };
        }
        return {
            output,
            errors,
            listings,
            symbolmap,
            segments,
        };
    }
}
