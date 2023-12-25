"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preprocessMCPP = void 0;
const util_1 = require("../../common/util");
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const platforms_1 = require("../platforms");
const wasmutils_1 = require("../wasmutils");
function makeCPPSafe(s) {
    return s.replace(/[^A-Za-z0-9_]/g, '_');
}
function preprocessMCPP(step, filesys) {
    (0, wasmutils_1.load)("mcpp");
    var platform = step.platform;
    var params = platforms_1.PLATFORM_PARAMS[(0, util_1.getBasePlatform)(platform)];
    if (!params)
        throw Error("Platform not supported: " + platform);
    // <stdin>:2: error: Can't open include file "foo.h"
    var errors = [];
    var match_fn = (0, listingutils_1.makeErrorMatcher)(errors, /<stdin>:(\d+): (.+)/, 1, 2, step.path);
    var MCPP = wasmutils_1.emglobal.mcpp({
        noInitialRun: true,
        noFSInit: true,
        print: wasmutils_1.print_fn,
        printErr: match_fn,
    });
    var FS = MCPP.FS;
    if (filesys)
        (0, wasmutils_1.setupFS)(FS, filesys);
    (0, builder_1.populateFiles)(step, FS, {
        mainFilePath: step.path,
        processFn: (path, code) => {
            if (typeof code === 'string') {
                code = (0, builder_1.processEmbedDirective)(code);
            }
            return code;
        }
    });
    (0, builder_1.populateExtraFiles)(step, FS, params.extra_compile_files);
    // TODO: make configurable by other compilers
    var args = [
        "-D", "__8BITWORKSHOP__",
        "-D", "__SDCC_z80",
        "-D", makeCPPSafe(platform.toUpperCase()),
        "-I", "/share/include",
        "-Q",
        step.path, "main.i"
    ];
    if (step.mainfile) {
        args.unshift.apply(args, ["-D", "__MAIN__"]);
    }
    let platform_def = platform.toUpperCase().replaceAll(/[^a-zA-Z0-9]/g, '_');
    args.unshift.apply(args, ["-D", `__PLATFORM_${platform_def}__`]);
    if (params.extra_preproc_args) {
        args.push.apply(args, params.extra_preproc_args);
    }
    (0, wasmutils_1.execMain)(step, MCPP, args);
    if (errors.length)
        return { errors: errors };
    var iout = FS.readFile("main.i", { encoding: 'utf8' });
    iout = iout.replace(/^#line /gm, '\n# ');
    try {
        var errout = FS.readFile("mcpp.err", { encoding: 'utf8' });
        if (errout.length) {
            // //main.c:2: error: Can't open include file "stdiosd.h"
            var errors = (0, listingutils_1.extractErrors)(/([^:]+):(\d+): (.+)/, errout.split("\n"), step.path, 2, 3, 1);
            if (errors.length == 0) {
                errors = (0, builder_1.errorResult)(errout).errors;
            }
            return { errors: errors };
        }
    }
    catch (e) {
        //
    }
    return { code: iout };
}
exports.preprocessMCPP = preprocessMCPP;
//# sourceMappingURL=mcpp.js.map