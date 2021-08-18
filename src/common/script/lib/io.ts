
import { FileData, WorkingStore } from "../../workertypes";

// remote resource cache
var $$cache: WeakMap<object,FileData> = new WeakMap();
// file read/write interface
var $$store: WorkingStore;
// backing store for data
var $$data: {} = {};

export function $$setupFS(store: WorkingStore) {
    $$store = store;
}
export function $$getData() {
    return $$data;
}
export function $$loadData(data: {}) {
    Object.assign($$data, data);
}

// object that can load state from backing store
export interface Loadable {
    reset() : void;
    $$getstate() : {};
}

export namespace data {
    export function get(object: Loadable, key: string): Loadable {
        let override = $$data && $$data[key];
        if (override) Object.assign(object, override);
        else if (object.reset) object.reset();
        return object;
    }
    export function set(object: Loadable, key: string): Loadable {
        if ($$data && object.$$getstate) {
            $$data[key] = object.$$getstate();
        }
        return object;
    }
}

export class IOWaitError extends Error {
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

export function clearcache() {
    $$cache = new WeakMap();
}

export function fetchurl(url: string, type?: 'binary' | 'text'): FileData {
    // TODO: only works in web worker
    var xhr = new XMLHttpRequest();
    xhr.responseType = type === 'text' ? 'text' : 'arraybuffer';
    xhr.open("GET", url, false);  // synchronous request
    xhr.send(null);
    if (xhr.response != null && xhr.status == 200) {
        if (type === 'text') {
            return xhr.response as string;
        } else {
            return new Uint8Array(xhr.response);
        }
    } else {
        throw new Error(`The resource at "${url}" responded with status code of ${xhr.status}.`)
    }
}

export function readnocache(url: string, type?: 'binary' | 'text'): FileData {
    if (url.startsWith('http:') || url.startsWith('https:')) {
        return fetchurl(url, type);
    }
    if ($$store) {
        return $$store.getFileData(url);
    }
}

// TODO: read files too
export function read(url: string, type?: 'binary' | 'text'): FileData {
    url = canonicalurl(url);
    // check cache
    let cachekey = {url: url};
    if ($$cache.has(cachekey)) {
        return $$cache.get(cachekey);
    }
    let data = readnocache(url, type);
    if (data == null) throw new Error(`Cannot find resource "${url}"`);
    if (type === 'text' && typeof data !== 'string') throw new Error(`Resource "${url}" is not a string`);
    if (type === 'binary' && !(data instanceof Uint8Array)) throw new Error(`Resource "${url}" is not a binary file`);
    $$cache.set(cachekey, data);
    return data;
}

export function readbin(url: string): Uint8Array {
    var data = read(url, 'binary');
    if (data instanceof Uint8Array)
        return data;
    else
        throw new Error(`The resource at "${url}" is not a binary file.`);
}

export function readlines(url: string) : string[] {
    return (read(url, 'text') as string).split('\n');
}

export function splitlines(text: string) : string[] {
    return text.split(/\n|\r\n/g);
}
