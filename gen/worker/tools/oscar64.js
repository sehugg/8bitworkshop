"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileOscar64 = compileOscar64;
const wasishim_1 = require("../../common/wasi/wasishim");
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const wasiutils_1 = require("../wasiutils");
const wasmutils_1 = require("../wasmutils");
let oscar64_fs = null;
let wasiModule = null;
async function compileOscar64(step) {
    const errors = [];
    const rootDir = "/root/";
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.c" });
    const destpath = (step.path || "main.c").replace(/\.[^.]+$/, ".prg");
    console.log('destpath', destpath);
    if ((0, builder_1.staleFiles)(step, [destpath])) {
        if (!oscar64_fs) {
            oscar64_fs = await (0, wasiutils_1.loadWASIFilesystemZip)("oscar64-fs.zip", "/root/");
        }
        if (!wasiModule) {
            wasiModule = new WebAssembly.Module((0, wasmutils_1.loadWASMBinary)("oscar64"));
        }
        const wasi = new wasishim_1.WASIRunner();
        wasi.initSync(wasiModule);
        wasi.fs.setParent(oscar64_fs);
        for (let file of step.files) {
            wasi.fs.putFile(rootDir + file, builder_1.store.getFileData(file));
        }
        //wasi.addPreopenDirectory("include");
        wasi.addPreopenDirectory("/root");
        wasi.setArgs(["oscar64", "-v", "-g", "-i=/root", step.path]);
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
        // (58, 17) : error 3001: Could not open source file. 'stdlib.c'
        const matcher = (0, listingutils_1.makeErrorMatcher)(errors, /\((\d+),\s+(\d+)\)\s+: error (\d+): (.+)/, 1, 4, step.path);
        for (let line of stderr.split('\n')) {
            matcher(line);
        }
        if (errors.length) {
            return { errors };
        }
        const output = wasi.fs.getFile(rootDir + destpath).getBytes();
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