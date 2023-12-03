"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRequireFunction = void 0;
const util_1 = require("../common/util");
const workertools_1 = require("./workertools");
const builder_1 = require("./builder");
const wasmutils_1 = require("./wasmutils");
function setupRequireFunction() {
    var exports = {};
    exports['jsdom'] = {
        JSDOM: function (a, b) {
            this.window = {};
        }
    };
    wasmutils_1.emglobal['require'] = (modname) => {
        console.log('require', modname, exports[modname] != null);
        return exports[modname];
    };
}
exports.setupRequireFunction = setupRequireFunction;
////////////////////////////
//const waitFor = delay => new Promise(resolve => setTimeout(resolve, delay)); // for testing
async function handleMessage(data) {
    // preload file system
    if (data.preload) {
        var fs = workertools_1.TOOL_PRELOADFS[data.preload];
        if (!fs && data.platform)
            fs = workertools_1.TOOL_PRELOADFS[data.preload + '-' + (0, util_1.getBasePlatform)(data.platform)];
        if (!fs && data.platform)
            fs = workertools_1.TOOL_PRELOADFS[data.preload + '-' + (0, util_1.getRootBasePlatform)(data.platform)];
        if (fs && !wasmutils_1.fsMeta[fs])
            (0, wasmutils_1.loadFilesystem)(fs);
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