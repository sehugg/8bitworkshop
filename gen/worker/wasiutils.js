"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBlobSync = loadBlobSync;
exports.unzipWASIFilesystem = unzipWASIFilesystem;
exports.loadWASIFilesystemZip = loadWASIFilesystemZip;
const jszip_1 = __importDefault(require("jszip"));
const wasishim_1 = require("../common/wasi/wasishim");
function loadBlobSync(path) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open("GET", path, false); // synchronous request
    xhr.send(null);
    return xhr.response;
}
async function unzipWASIFilesystem(zipdata, rootPath = "./") {
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
    console.log(zippath, zipdata);
    return unzipWASIFilesystem(zipdata, rootPath);
}
//# sourceMappingURL=wasiutils.js.map