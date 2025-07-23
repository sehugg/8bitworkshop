import { WorkerError, WorkerResult } from "../../common/workertypes";
import { BuildStep, gatherFiles, populateExtraFiles, populateFiles, putWorkFile, staleFiles } from "../builder";
import { makeErrorMatcher } from "../listingutils";
import { emglobal, execMain, loadNative, moduleInstFn, print_fn, setupFS } from "../wasmutils";

export async function compileOscar64(step: BuildStep): Promise<WorkerResult> {
    loadNative("oscar64");
    var params = step.params;
    gatherFiles(step, { mainFilePath: "main.c" });
    const destpath = (step.path || "main.c").replace(/\.[^.]+$/, ".prg");
    var errors: WorkerError[] = [];

    if (staleFiles(step, [destpath])) {
        // (58, 17) : error 3001: Could not open source file. 'stdlib.c'
        const matcher = makeErrorMatcher(errors, /\((\d+),\s+(\d+)\)\s+: error (\d+): (.+)/, 1, 4, step.path);
        var oscar64: EmscriptenModule = await emglobal.Oscar64({
            instantiateWasm: moduleInstFn('oscar64'),
            noInitialRun: true,
            print: print_fn,
            printErr: matcher,
        });

        var FS = (oscar64 as any).FS;
        //setupFS(FS, 'oscar64');
        populateFiles(step, FS);
        populateExtraFiles(step, FS, params.extra_compile_files);

        var args = ["-v", "-g", "-i=/root", step.path];
        execMain(step, oscar64, args);
        if (errors.length)
            return { errors: errors };

        var output = FS.readFile(destpath, { encoding: 'binary' });
        putWorkFile(destpath, output);
        return {
            output,
            errors,
            //listings,
            //symbolmap
        };
    }
}
