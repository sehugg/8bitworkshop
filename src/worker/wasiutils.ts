import JSZip from 'jszip';
import { WASIMemoryFilesystem } from "../common/wasi/wasishim";

export function loadBlobSync(path: string) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open("GET", path, false);  // synchronous request
    xhr.send(null);
    return xhr.response;
}

export async function loadWASIFilesystemZip(zippath: string) {
    const jszip = new JSZip();
    const path = '../../src/worker/fs/' + zippath;
    const zipdata = loadBlobSync(path);
    console.log(zippath, zipdata);
    await jszip.loadAsync(zipdata);
    let fs = new WASIMemoryFilesystem();
    let promises = [];
    jszip.forEach(async (relativePath, zipEntry) => {
        if (zipEntry.dir) {
            fs.putDirectory(relativePath);
        } else {
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
