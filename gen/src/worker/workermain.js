"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRequireFunction = setupRequireFunction;
const util_1 = require("../common/util");
const toolmeta_1 = require("../common/toolmeta");
const builder_1 = require("./builder");
const wasmutils_1 = require("./wasmutils");
// shared FS names starting with 'wasi:' refer to a WASI filesystem zip
function splitWasiFSName(fsName) {
    return fsName.startsWith('wasi:') ? { wasi: true, name: fsName.substring(5) } : { wasi: false, name: fsName };
}
function setupRequireFunction() {
    var exports = {};
    exports['jsdom'] = {
        JSDOM: function (a, b) {
            this.window = {};
        }
    };
    wasmutils_1.emglobal['require'] = (modname) => {
        // Emscripten glue may ask for Node builtins when running outside the browser
        if (modname === 'path' || modname === 'fs') {
            try {
                return require(modname);
            }
            catch (e) { }
        }
        console.log('require', modname, exports[modname] != null);
        return exports[modname];
    };
}
////////////////////////////
//const waitFor = delay => new Promise(resolve => setTimeout(resolve, delay)); // for testing
async function handleMessage(data) {
    // preload file system
    if (data.preload) {
        var fs = (0, toolmeta_1.getPreloadFSName)(data.preload, data.platform && (0, util_1.getBasePlatform)(data.platform))
            || (0, toolmeta_1.getPreloadFSName)(data.preload, data.platform && (0, util_1.getRootBasePlatform)(data.platform));
        if (fs && !wasmutils_1.fsMeta[fs])
            (0, wasmutils_1.loadFilesystem)(fs);
        return;
    }
    // read a file from a filesystem package (shared code)
    if (data.readshared) {
        var fs1 = splitWasiFSName(data.preload_fs);
        var contents = fs1.wasi ? await (0, wasmutils_1.readWasiSharedFile)(fs1.name, data.readshared)
            : ((0, wasmutils_1.ensureFilesystem)(fs1.name), await (0, wasmutils_1.readSharedFile)(fs1.name, data.readshared));
        return { output: contents, qid: data.qid };
    }
    // list files in a filesystem package directory (shared code)
    if (data.listshared != null) {
        var fs2 = splitWasiFSName(data.preload_fs);
        var files = fs2.wasi ? await (0, wasmutils_1.listWasiSharedFiles)(fs2.name, data.listshared)
            : ((0, wasmutils_1.ensureFilesystem)(fs2.name), (0, wasmutils_1.listSharedFiles)(fs2.name, data.listshared));
        return { output: files, qid: data.qid };
    }
    // preload a filesystem package directly by name
    if (data.preload_fs) {
        var fs3 = splitWasiFSName(data.preload_fs);
        if (fs3.wasi)
            await (0, wasmutils_1.ensureWasiFilesystem)(fs3.name);
        else
            (0, wasmutils_1.ensureFilesystem)(fs3.name);
        return;
    }
    // clear filesystem? (TODO: buildkey)
    if (data.reset) {
        builder_1.store.reset();
        return;
    }
    return builder_1.builder.handleMessage(data);
}
const ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
if (ENVIRONMENT_IS_WORKER) {
    var lastpromise = null;
    onmessage = async function (e) {
        await lastpromise; // wait for previous message to complete
        lastpromise = handleMessage(e.data);
        var result = await lastpromise;
        lastpromise = null;
        if (result) {
            try {
                postMessage(result);
            }
            catch (e) {
                console.log(e);
                postMessage((0, builder_1.errorResult)(`${e}`));
            }
        }
    };
}
//# sourceMappingURL=workermain.js.map