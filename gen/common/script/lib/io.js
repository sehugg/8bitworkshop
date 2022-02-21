"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mutable = exports.Mutable = exports.module = exports.splitlines = exports.readlines = exports.readbin = exports.read = exports.readnocache = exports.fetchurl = exports.canonicalurl = exports.IOWaitError = exports.data = exports.$$loadData = exports.$$getData = exports.$$setupFS = void 0;
const util_1 = require("../../util");
// remote resource cache
var $$cache = new util_1.FileDataCache(); // TODO: better cache?
// file read/write interface
var $$store;
// backing store for data
var $$data = {};
// module cache
var $$modules = new Map();
function $$setupFS(store) {
    $$store = store;
}
exports.$$setupFS = $$setupFS;
function $$getData() {
    return $$data;
}
exports.$$getData = $$getData;
function $$loadData(data) {
    Object.assign($$data, data);
}
exports.$$loadData = $$loadData;
var data;
(function (data) {
    function load(object, key) {
        if (object == null)
            return object;
        let override = $$data && $$data[key];
        if (override && object.$$setstate) {
            object.$$setstate(override);
        }
        else if (override) {
            Object.assign(object, override);
        }
        return object;
    }
    data.load = load;
    function save(object, key) {
        if ($$data && object && object.$$getstate) {
            $$data[key] = object.$$getstate();
        }
        return object;
    }
    data.save = save;
    function get(key) {
        return $$data && $$data[key];
    }
    data.get = get;
    function set(key, value) {
        if ($$data) {
            $$data[key] = value;
        }
    }
    data.set = set;
})(data = exports.data || (exports.data = {}));
class IOWaitError extends Error {
}
exports.IOWaitError = IOWaitError;
function canonicalurl(url) {
    // get raw resource URL for github
    if (url.startsWith('https://github.com/')) {
        let toks = url.split('/');
        if (toks[5] === 'blob') {
            return `https://raw.githubusercontent.com/${toks[3]}/${toks[4]}/${toks.slice(6).join('/')}`;
        }
    }
    return url;
}
exports.canonicalurl = canonicalurl;
function fetchurl(url, type) {
    // TODO: only works in web worker
    var xhr = new XMLHttpRequest();
    xhr.responseType = type === 'text' ? 'text' : 'arraybuffer';
    xhr.open("GET", url, false); // synchronous request
    xhr.send(null);
    if (xhr.response != null && xhr.status == 200) {
        if (type === 'text') {
            return xhr.response;
        }
        else {
            return new Uint8Array(xhr.response);
        }
    }
    else {
        throw new Error(`The resource at "${url}" responded with status code of ${xhr.status}.`);
    }
}
exports.fetchurl = fetchurl;
function readnocache(url, type) {
    if (url.startsWith('http:') || url.startsWith('https:')) {
        return fetchurl(url, type);
    }
    if ($$store) {
        return $$store.getFileData(url);
    }
}
exports.readnocache = readnocache;
// TODO: read files too
function read(url, type) {
    // canonical-ize url
    url = canonicalurl(url);
    // check cache first
    let cachekey = url;
    let data = $$cache.get(cachekey);
    if (data != null)
        return data;
    // not in cache, read it
    data = readnocache(url, type);
    if (data == null)
        throw new Error(`Cannot find resource "${url}"`);
    if (type === 'text' && typeof data !== 'string')
        throw new Error(`Resource "${url}" is not a string`);
    if (type === 'binary' && !(data instanceof Uint8Array))
        throw new Error(`Resource "${url}" is not a binary file`);
    // store in cache
    $$cache.put(cachekey, data);
    return data;
}
exports.read = read;
function readbin(url) {
    var data = read(url, 'binary');
    if (data instanceof Uint8Array)
        return data;
    else
        throw new Error(`The resource at "${url}" is not a binary file.`);
}
exports.readbin = readbin;
function readlines(url) {
    return read(url, 'text').split('\n');
}
exports.readlines = readlines;
function splitlines(text) {
    return text.split(/\n|\r\n/g);
}
exports.splitlines = splitlines;
function module(url) {
    // find module in cache?
    let key = `${url}::${url.length}`;
    let exports = $$modules.get(key);
    if (exports == null) {
        let code = readnocache(url, 'text');
        let func = new Function('exports', 'module', code);
        let module = {}; // TODO?
        exports = {};
        func(exports, module);
        $$modules.set(key, exports);
    }
    return exports;
}
exports.module = module;
///
// TODO: what if this isn't top level?
class Mutable {
    constructor(initial) {
        this.value = initial;
    }
    $$setstate(newstate) {
        this.value = newstate.value;
    }
    $$getstate() {
        return { value: this.value };
    }
}
exports.Mutable = Mutable;
function mutable(obj) {
    Object.defineProperty(obj, '$$setstate', {
        value: function (newstate) {
            Object.assign(this, newstate);
        },
        enumerable: false
    });
    Object.defineProperty(obj, '$$getstate', {
        value: function () {
            return this;
        },
        enumerable: false
    });
    return obj;
}
exports.mutable = mutable;
//# sourceMappingURL=io.js.map