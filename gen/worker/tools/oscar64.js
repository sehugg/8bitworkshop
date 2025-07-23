"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileOscar64 = compileOscar64;
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const wasmutils_1 = require("../wasmutils");
async function compileOscar64(step) {
    (0, wasmutils_1.loadNative)("oscar64");
    var params = step.params;
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.c" });
    const destpath = (step.path || "main.c").replace(/\.[^.]+$/, ".prg");
    var errors = [];
    if ((0, builder_1.staleFiles)(step, [destpath])) {
        // (58, 17) : error 3001: Could not open source file. 'stdlib.c'
        const matcher = (0, listingutils_1.makeErrorMatcher)(errors, /\((\d+),\s+(\d+)\)\s+: error (\d+): (.+)/, 1, 4, step.path);
        var oscar64 = await wasmutils_1.emglobal.Oscar64({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('oscar64'),
            noInitialRun: true,
            print: wasmutils_1.print_fn,
            printErr: matcher,
        });
        var FS = oscar64.FS;
        //setupFS(FS, 'oscar64');
        (0, builder_1.populateFiles)(step, FS);
        (0, builder_1.populateExtraFiles)(step, FS, params.extra_compile_files);
        var args = ["-v", "-g", "-i=/root", step.path];
        (0, wasmutils_1.execMain)(step, oscar64, args);
        if (errors.length)
            return { errors: errors };
        var output = FS.readFile(destpath, { encoding: 'binary' });
        (0, builder_1.putWorkFile)(destpath, output);
        return {
            output,
            errors,
            //listings,
            //symbolmap
        };
    }
}
//# sourceMappingURL=oscar64.js.map