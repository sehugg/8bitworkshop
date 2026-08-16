import { WASIFilesystem, WASIRunner } from "../../common/wasi/wasishim";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, store, putWorkFile } from "../builder";
import { makeErrorMatcher } from "../listingutils";
import { loadWASIFilesystemZip } from "../wasiutils";
import { loadWASMBinary } from "../wasmutils";

let oscar64_fs: WASIFilesystem | null = null;
let wasiModule: WebAssembly.Module | null = null;

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
        return {
            output,
            errors,
            //listings,
            //symbolmap
        };
    }
}
