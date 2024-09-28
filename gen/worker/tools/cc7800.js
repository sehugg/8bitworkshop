"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileCC7800 = compileCC7800;
const wasishim_1 = require("../../common/wasi/wasishim");
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const wasiutils_1 = require("../wasiutils");
const wasmutils_1 = require("../wasmutils");
let cc7800_fs = null;
let wasiModule = null;
async function compileCC7800(step) {
    const errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.c" });
    const destpath = "./a.out";
    if ((0, builder_1.staleFiles)(step, [destpath])) {
        if (!cc7800_fs) {
            cc7800_fs = await (0, wasiutils_1.loadWASIFilesystemZip)("cc7800-fs.zip");
        }
        if (!wasiModule) {
            wasiModule = new WebAssembly.Module((0, wasmutils_1.loadWASMBinary)("cc7800"));
        }
        const wasi = new wasishim_1.WASIRunner();
        wasi.initSync(wasiModule);
        wasi.fs.setParent(cc7800_fs);
        for (let file of step.files) {
            wasi.fs.putFile("./" + file, builder_1.store.getFileData(file));
        }
        wasi.addPreopenDirectory("headers");
        wasi.addPreopenDirectory(".");
        wasi.setArgs(["cc7800", "-v", "-g", "-S", "-I", "headers", step.path]);
        try {
            wasi.run();
        }
        catch (e) {
            errors.push(e);
        }
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
//# sourceMappingURL=cc7800.js.map