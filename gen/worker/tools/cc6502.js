"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileCC6502 = compileCC6502;
const wasishim_1 = require("../../common/wasi/wasishim");
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const wasiutils_1 = require("../wasiutils");
const wasmutils_1 = require("../wasmutils");
const wasiModules = {};
const wasiFilesystems = {};
// cc2600 and cc7800 are the same compiler for different consoles: they share
// the driver, options and "Syntax error:" diagnostics, and differ only by the
// console headers and the target name baked into their WASI builds.
async function compileCC6502(step, cfg) {
    const errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.c" });
    const destpath = "./a.out";
    if ((0, builder_1.staleFiles)(step, [destpath])) {
        if (!wasiFilesystems[cfg.tool]) {
            wasiFilesystems[cfg.tool] = await (0, wasiutils_1.loadWASIFilesystemZip)(cfg.fsZip);
        }
        if (!wasiModules[cfg.tool]) {
            wasiModules[cfg.tool] = new WebAssembly.Module((0, wasmutils_1.loadWASMBinary)(cfg.tool));
        }
        const wasi = new wasishim_1.WASIRunner();
        wasi.initSync(wasiModules[cfg.tool]);
        wasi.fs.setParent(wasiFilesystems[cfg.tool]);
        (0, wasiutils_1.populateWASIFiles)(wasi, step, ["headers", "."]);
        wasi.setArgs([cfg.tool, "-v", "-g", "-S", "-I", "headers", step.path]);
        (0, wasiutils_1.runWASI)(wasi, errors);
        // TODO
        let stdout = wasi.fds[1].getBytesAsString();
        let stderr = wasi.fds[2].getBytesAsString();
        console.log('stdout', stdout);
        console.log('stderr', stderr);
        // Syntax error: Unknown identifier cputes on line 11 of test.c78
        if (stderr.indexOf("Syntax error:") >= 0) {
            const matcher = (0, listingutils_1.makeErrorMatcher)(errors, /^Syntax error: (.+?) on line (\d+) of (.+)/, 2, 1, step.path, 3);
            for (let line of stderr.split('\n')) {
                matcher(line);
            }
        }
        if (errors.length) {
            return { errors };
        }
        console.log(wasi.fs);
        const combinedasm = wasi.fs.getFile(destpath).getBytesAsString();
        (0, builder_1.putWorkFile)(destpath, combinedasm);
    }
    return {
        nexttool: "dasm",
        path: destpath,
        args: [destpath],
        files: [destpath]
    };
}
//# sourceMappingURL=cc6502.js.map