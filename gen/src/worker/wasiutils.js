"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBlobSync = loadBlobSync;
exports.unzipWASIFilesystem = unzipWASIFilesystem;
exports.loadWASIFilesystemZip = loadWASIFilesystemZip;
exports.populateWASIFiles = populateWASIFiles;
exports.runWASI = runWASI;
const jszip_1 = __importDefault(require("jszip"));
const wasishim_1 = require("../common/wasi/wasishim");
const builder_1 = require("./builder");
function loadBlobSync(path) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open("GET", path, false); // synchronous request
    xhr.send(null);
    return xhr.response;
}
async function unzipWASIFilesystem(zipdata, rootPath = "./") {
    // In the Node.js test env, the XMLHttpRequest shim returns a custom Blob
    // that JSZip does not recognize. Convert it to an ArrayBuffer first.
    if (zipdata && typeof zipdata.asArrayBuffer === 'function') {
        zipdata = zipdata.asArrayBuffer();
    }
    const jszip = new jszip_1.default();
    await jszip.loadAsync(zipdata);
    let fs = new wasishim_1.WASIMemoryFilesystem();
    let promises = [];
    jszip.forEach(async (relativePath, zipEntry) => {
        if (zipEntry.dir) {
            fs.putDirectory(relativePath);
        }
        else {
            let path = rootPath + relativePath;
            let prom = zipEntry.async("uint8array").then((data) => {
                fs.putFile(path, data);
            });
            promises.push(prom);
        }
    });
    await Promise.all(promises);
    return fs;
}
async function loadWASIFilesystemZip(zippath, rootPath = "./") {
    const jszip = new jszip_1.default();
    const path = '../../src/worker/fs/' + zippath;
    const zipdata = loadBlobSync(path);
    return unzipWASIFilesystem(zipdata, rootPath);
}
/** Copy a build step's source files into a WASI runner and preopen directories. */
function populateWASIFiles(wasi, step, dirs = ["."]) {
    for (let file of step.files) {
        wasi.fs.putFile("./" + file, builder_1.store.getFileData(file));
    }
    for (let dir of dirs) {
        wasi.addPreopenDirectory(dir);
    }
}
/** Run a WASI command, recording any thrown error into the given list. */
function runWASI(wasi, errors) {
    try {
        wasi.run();
    }
    catch (e) {
        errors.push({ line: 0, msg: "" + e });
    }
}
//# sourceMappingURL=wasiutils.js.map