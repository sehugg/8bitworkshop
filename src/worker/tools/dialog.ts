import { WorkerError } from "../../common/workertypes";
import { WASIFilesystem, WASIRunner } from "../../common/wasi/wasishim";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, store, putWorkFile } from "../builder";
import { loadWASIFilesystemZip } from "../wasiutils";
import { loadWASMBinary } from "../wasmutils";

// the Dialog standard library ships in the preload filesystem, but a project
// can override it by including its own copy
const STDLIB = "stdlib.dg";

let dialog_fs: WASIFilesystem | null = null;
let wasiModule: WebAssembly.Module | null = null;

// Error: story.dg, line 6: Unexpected token at beginning of line.
// Error: No library (such as stdlib.dg) was specified on the commandline.
const re_error = /^Error:\s+(?:(\S+?), line (\d+):\s+)?(.+)/;

export async function compileDialog(step: BuildStep): Promise<BuildStepResult> {
    const errors: WorkerError[] = [];
    gatherFiles(step, { mainFilePath: "main.dg" });
    const destpath = step.prefix + ".z8";
    if (staleFiles(step, [destpath])) {
        if (!dialog_fs) {
            dialog_fs = await loadWASIFilesystemZip("dialog-fs.zip");
        }
        if (!wasiModule) {
            wasiModule = new WebAssembly.Module(loadWASMBinary("dialogc"));
        }
        const wasi = new WASIRunner();
        wasi.initSync(wasiModule);
        wasi.fs.setParent(dialog_fs);
        for (let file of step.files) {
            wasi.fs.putFile("./" + file, store.getFileData(file));
        }
        wasi.addPreopenDirectory(".");
        // sources are matched in command-line order, so the story comes first
        // and the library last -- a project's own stdlib.dg shadows the
        // preloaded one, since putFile() writes to the child filesystem
        const sources = step.files.filter(fn => fn.endsWith(".dg") && fn != STDLIB);
        sources.push(STDLIB);
        wasi.setArgs(["dialogc", "-t", "z8", "-o", destpath, ...sources]);
        try {
            wasi.run();
        } catch (e) {
            errors.push({ line: 0, msg: e + "" });
        }
        const stderr = wasi.fds[2].getBytesAsString();
        for (let line of stderr.split("\n")) {
            const matches = re_error.exec(line);
            if (matches) {
                errors.push({
                    path: matches[1] || step.path,
                    line: parseInt(matches[2]) || 0,
                    msg: matches[3]
                });
            } else if (line) {
                console.log(line); // warnings, progress messages
            }
        }
        if (errors.length) {
            return { errors };
        }
        const outfile = wasi.fs.getFile("./" + destpath);
        if (!outfile) {
            return { errors: [{ line: 0, msg: "dialogc did not produce " + destpath }] };
        }
        const output = outfile.getBytes();
        putWorkFile(destpath, output);
        return { output, errors };
    }
}
