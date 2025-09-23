import { WASIFilesystem, WASIMemoryFilesystem, WASIRunner } from "../../common/wasi/wasishim";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, store, putWorkFile } from "../builder";
import { makeErrorMatcher } from "../listingutils";
import { loadWASIFilesystemZip } from "../wasiutils";
import { loadWASMBinary } from "../wasmutils";

let cc2600_fs: WASIFilesystem | null = null;
let wasiModule: WebAssembly.Module | null = null;

export async function compilecc2600(step: BuildStep): Promise<BuildStepResult> {
    const errors = [];
    gatherFiles(step, { mainFilePath: "main.c" });
    const destpath = "./a.out";
    if (staleFiles(step, [destpath])) {
        if (!cc2600_fs) {
            cc2600_fs = await loadWASIFilesystemZip("cc2600-fs.zip");
        }
        if (!wasiModule) {
            wasiModule = new WebAssembly.Module(loadWASMBinary("cc2600"));
        }
        const wasi = new WASIRunner();
        wasi.initSync(wasiModule);
        wasi.fs.setParent(cc2600_fs);
        for (let file of step.files) {
            wasi.fs.putFile("./" + file, store.getFileData(file));
        }
        wasi.addPreopenDirectory("headers");
        wasi.addPreopenDirectory(".");
        wasi.setArgs(["cc2600", "-v", "-g", "-S", "-I", "headers", step.path]);
        try {
            wasi.run();
        } catch (e) {
            errors.push(e);
        }
        // TODO
        let stdout = wasi.fds[1].getBytesAsString();
        let stderr = wasi.fds[2].getBytesAsString();
        console.log('stdout', stdout);
        console.log('stderr', stderr);
        // Syntax error: Unknown identifier cputes on line 11 of test.c78
        if (stderr.indexOf("Syntax error:") >= 0) {
            const matcher = makeErrorMatcher(errors, /^Syntax error: (.+?) on line (\d+) of (.+)/, 2, 1, step.path, 3);
            for (let line of stderr.split('\n')) {
                matcher(line);
            }
        }
        if (errors.length) {
            return { errors };
        }
        console.log(wasi.fs);
        const combinedasm = wasi.fs.getFile(destpath).getBytesAsString();
        putWorkFile(destpath, combinedasm);
    }
    return {
        nexttool: "dasm",
        path: destpath,
        args: [destpath],
        files: [destpath]
    };
}
