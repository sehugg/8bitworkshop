"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileCC7800 = void 0;
const wasishim_1 = require("../../common/wasi/wasishim");
const workermain_1 = require("../workermain");
const jszip_1 = __importDefault(require("jszip"));
let cc7800_fs = null;
let wasiModule = null;
function loadBlobSync(path) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open("GET", path, false); // synchronous request
    xhr.send(null);
    return xhr.response;
}
async function loadWASIFilesystemZip(zippath) {
    const jszip = new jszip_1.default();
    const path = '../../src/worker/fs/' + zippath;
    const zipdata = loadBlobSync(path);
    console.log(zippath, zipdata);
    await jszip.loadAsync(zipdata);
    let fs = new wasishim_1.WASIMemoryFilesystem();
    let promises = [];
    jszip.forEach(async (relativePath, zipEntry) => {
        if (zipEntry.dir) {
            fs.putDirectory(relativePath);
        }
        else {
            let path = './' + relativePath;
            let prom = zipEntry.async("uint8array").then((data) => {
                fs.putFile(path, data);
            });
            promises.push(prom);
        }
    });
    await Promise.all(promises);
    return fs;
}
async function compileCC7800(step) {
    const errors = [];
    (0, workermain_1.gatherFiles)(step, { mainFilePath: "main.c" });
    const destpath = "./a.out";
    if ((0, workermain_1.staleFiles)(step, [destpath])) {
        if (!cc7800_fs) {
            cc7800_fs = await loadWASIFilesystemZip("cc7800-fs.zip");
        }
        if (!wasiModule) {
            wasiModule = new WebAssembly.Module((0, workermain_1.loadWASMBinary)("cc7800"));
        }
        const wasi = new wasishim_1.WASIRunner();
        wasi.initSync(wasiModule);
        wasi.fs.setParent(cc7800_fs);
        for (let file of step.files) {
            wasi.fs.putFile("./" + file, workermain_1.store.getFileData(file));
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
            const matcher = (0, workermain_1.makeErrorMatcher)(errors, /^Syntax error: (.+?) on line (\d+) of (.+)/, 2, 1, step.path, 3);
            for (let line of stderr.split('\n')) {
                matcher(line);
            }
        }
        if (errors.length) {
            return { errors };
        }
        const combinedasm = wasi.fs.getFile(destpath).getBytesAsString();
        (0, workermain_1.putWorkFile)(destpath, combinedasm);
    }
    return {
        nexttool: "dasm",
        path: destpath,
        args: [destpath],
        files: [destpath]
    };
}
exports.compileCC7800 = compileCC7800;
//# sourceMappingURL=cc7800.js.map