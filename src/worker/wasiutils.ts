import JSZip from 'jszip';
import { WASIRunner, WASIMemoryFilesystem } from "../common/wasi/wasishim";
import { WorkerError } from "../common/workertypes";
import { BuildStep, store } from "./builder";

export function loadBlobSync(path: string) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open("GET", path, false);  // synchronous request
    xhr.send(null);
    return xhr.response;
}

export async function unzipWASIFilesystem(zipdata: any, rootPath: string = "./") {
    // In the Node.js test env, the XMLHttpRequest shim returns a custom Blob
    // that JSZip does not recognize. Convert it to an ArrayBuffer first.
    if (zipdata && typeof zipdata.asArrayBuffer === 'function') {
        zipdata = zipdata.asArrayBuffer();
    }
    const jszip = new JSZip();
    await jszip.loadAsync(zipdata);
    let fs = new WASIMemoryFilesystem();
    let promises = [];
    jszip.forEach(async (relativePath, zipEntry) => {
        if (zipEntry.dir) {
            fs.putDirectory(relativePath);
        } else {
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

export async function loadWASIFilesystemZip(zippath: string, rootPath: string = "./") {
    const jszip = new JSZip();
    const path = '../../src/worker/fs/' + zippath;
    const zipdata = loadBlobSync(path);
    return unzipWASIFilesystem(zipdata, rootPath);
}

/** Copy a build step's source files into a WASI runner and preopen directories. */
export function populateWASIFiles(wasi: WASIRunner, step: BuildStep, dirs: string[] = ["."]) {
    for (let file of step.files) {
        wasi.fs.putFile("./" + file, store.getFileData(file));
    }
    for (let dir of dirs) {
        wasi.addPreopenDirectory(dir);
    }
}

/** Run a WASI command, recording any thrown error into the given list. */
export function runWASI(wasi: WASIRunner, errors: WorkerError[]) {
    try {
        wasi.run();
    } catch (e) {
        errors.push({ line: 0, msg: "" + e });
    }
}
