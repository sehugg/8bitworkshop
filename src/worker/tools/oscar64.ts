import { WASIFilesystem, WASIRunner } from "../../common/wasi/wasishim";
import { defineArgs, extraArgsFor } from "../../common/toolmeta";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, store, putWorkFile } from "../builder";
import { makeErrorMatcher } from "../listingutils";
import { parseOscar64Listing, parseOscar64Lbl, parseOscar64Map } from "./oscar64parse";
import { loadWASIFilesystemZip } from "../wasiutils";
import { loadWASMBinary } from "../wasmutils";

let oscar64_fs: WASIFilesystem | null = null;
let wasiModule: WebAssembly.Module | null = null;

// read a file from the WASI fs by name, falling back to matching on the given
// suffix (oscar64 may pick a different output extension than the one requested).
function getWasiFileAsString(wasi: WASIRunner, suffix: string): string | null {
    const exact = wasi.fs.getFile(suffix);
    if (exact) return exact.getBytesAsString();
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
        // build with source-level debug info and no optimization, so inlined
        // helpers (e.g. neslib's pal_col/vram_adr) keep their call-site line
        // info and the editor can show hex offsets for every line. User build
        // args are appended after this, so -O1/-O2 still override it.
        let args = ["oscar64", "-O1", "-Oz", "-Op", "-Ox", "-g", "-ii=include", "-o=" + destpath];
        args.push.apply(args, defineArgs('oscar64', step.params && step.params.define));
        args.push.apply(args, defineArgs('oscar64', step.params && step.params.symbols && step.params.symbols.compiler));
        args.push.apply(args, extraArgsFor('oscar64', step.params && step.params.buildArgs));
        args.push(step.path);
        wasi.setArgs(args);
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
        // oscar64 picks the output extension from the target machine/format
        // (e.g. .xex for the atari target), ignoring the one we asked for.
        const prefix = destpath.replace(/\.[^.]+$/, '');
        let outpath = destpath;
        for (const ext of [".xex", ".prg", ".crt", ".bin", ".nes"]) {
            if (wasi.fs.getFile(prefix + ext)) { outpath = prefix + ext; break; }
        }
        const output = wasi.fs.getFile(outpath).getBytes();
        putWorkFile(destpath, output);
        // read and parse oscar64 auxiliary output files (.map, .lbl, .asm)
        let mapout = getWasiFileAsString(wasi, prefix + ".map") || getWasiFileAsString(wasi, ".map");
        let lblout = getWasiFileAsString(wasi, prefix + ".lbl") || getWasiFileAsString(wasi, ".lbl");
        // banked targets (NES) emit a Mesen label file (.mlb) instead of a VICE .lbl
        let mlbout = getWasiFileAsString(wasi, prefix + ".mlb") || getWasiFileAsString(wasi, ".mlb");
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
        if (mlbout) {
            putWorkFile(prefix + ".mlb", mlbout);
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
