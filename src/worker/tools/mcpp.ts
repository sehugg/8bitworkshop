import { getBasePlatform } from "../../common/util";
import { BuildStep, populateFiles, populateExtraFiles, errorResult } from "../builder";
import { makeErrorMatcher, extractErrors } from "../listingutils";
import { PLATFORM_PARAMS } from "../platforms";
import { load, print_fn, setupFS, execMain, emglobal, EmscriptenModule } from "../wasmutils";

function makeCPPSafe(s: string): string {
    return s.replace(/[^A-Za-z0-9_]/g, '_');
}

export function preprocessMCPP(step: BuildStep, filesys: string) {
    load("mcpp");
    var platform = step.platform;
    var params = PLATFORM_PARAMS[getBasePlatform(platform)];
    if (!params) throw Error("Platform not supported: " + platform);
    // <stdin>:2: error: Can't open include file "foo.h"
    var errors = [];
    var match_fn = makeErrorMatcher(errors, /<stdin>:(\d+): (.+)/, 1, 2, step.path);
    var MCPP: EmscriptenModule = emglobal.mcpp({
        noInitialRun: true,
        noFSInit: true,
        print: print_fn,
        printErr: match_fn,
    });
    var FS = MCPP.FS;
    if (filesys) setupFS(FS, filesys);
    populateFiles(step, FS);
    populateExtraFiles(step, FS, params.extra_compile_files);
    // TODO: make configurable by other compilers
    var args = [
        "-D", "__8BITWORKSHOP__",
        "-D", "__SDCC_z80",
        "-D", makeCPPSafe(platform.toUpperCase()),
        "-I", "/share/include",
        "-Q",
        step.path, "main.i"];
    if (step.mainfile) {
        args.unshift.apply(args, ["-D", "__MAIN__"]);
    }
    let platform_def = (platform.toUpperCase() as any).replaceAll(/[^a-zA-Z0-9]/g, '_');
    args.unshift.apply(args, ["-D", `__PLATFORM_${platform_def}__`]);
    if (params.extra_preproc_args) {
        args.push.apply(args, params.extra_preproc_args);
    }
    execMain(step, MCPP, args);
    if (errors.length)
        return { errors: errors };
    var iout = FS.readFile("main.i", { encoding: 'utf8' });
    iout = iout.replace(/^#line /gm, '\n# ');
    try {
        var errout = FS.readFile("mcpp.err", { encoding: 'utf8' });
        if (errout.length) {
            // //main.c:2: error: Can't open include file "stdiosd.h"
            var errors = extractErrors(/([^:]+):(\d+): (.+)/, errout.split("\n"), step.path, 2, 3, 1);
            if (errors.length == 0) {
                errors = errorResult(errout).errors;
            }
            return { errors: errors };
        }
    } catch (e) {
        //
    }
    return { code: iout };
}