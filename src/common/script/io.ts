import { ProjectFilesystem } from "../../ide/project";
import { FileData } from "../workertypes";

// TODO

var $$fs: ProjectFilesystem;
var $$cache: { [path: string]: FileData } = {};

export class IOWaitError extends Error {
}

export function $$setupFS(fs: ProjectFilesystem) {
    $$fs = fs;
}

function getFS(): ProjectFilesystem {
    if ($$fs == null) throw new Error(`Internal Error: The 'io' module has not been set up properly.`)
    return $$fs;
}

export function canonicalurl(url: string) : string {
    // get raw resource URL for github
    if (url.startsWith('https://github.com/')) {
        let toks = url.split('/');
        if (toks[5] === 'blob') {
            return `https://raw.githubusercontent.com/${toks[3]}/${toks[4]}/${toks.slice(6).join('/')}`
        }
    }
    return url;
}

export function load(url: string, type?: 'binary' | 'text'): FileData {
    url = canonicalurl(url);
    // TODO: only works in web worker
    var xhr = new XMLHttpRequest();
    xhr.responseType = type === 'text' ? 'text' : 'arraybuffer';
    xhr.open("GET", url, false);  // synchronous request
    xhr.send(null);
    if (xhr.response != null && xhr.status == 200) {
        if (type !== 'text') {
            return new Uint8Array(xhr.response);
        } else {
            return xhr.response;
        }
    } else {
        throw new Error(`The resource at "${url}" responded with status code of ${xhr.status}.`)
    }
}

export function loadbin(url: string): Uint8Array {
    var data = load(url, 'binary');
    if (data instanceof Uint8Array)
        return data;
    else
        throw new Error(`The resource at "${url}" is not a binary file.`);
}

export function xload(path: string): FileData {
    var data = $$cache[path];
    if (data == null) {
        getFS().getFileData(path).then((value) => {
            $$cache[path] = value;
        })
        throw new IOWaitError(path);
    } else {
        return data;
    }
}

