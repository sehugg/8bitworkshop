"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runJavascript = void 0;
const workermain_1 = require("../workermain");
const env_1 = require("../../common/script/env");
const io = __importStar(require("../../common/script/lib/io"));
const project_1 = require("../../ide/project");
// cache environments
var environments = {};
function getEnv(path) {
    var env = environments[path];
    if (!env) {
        env = environments[path] = new env_1.Environment(workermain_1.emglobal, path);
        // TODO: load environment from store?
    }
    return env;
}
async function runJavascript(step) {
    var env = getEnv(step.path);
    var code = workermain_1.store.getFileAsString(step.path);
    var lstore = (0, project_1.createNewPersistentStore)(step.platform + "//items");
    // load items from persistent storage (TODO)
    const itemskey = step.path;
    if (workermain_1.store.items == null) {
        workermain_1.store.items = (await lstore.getItem(itemskey)) || {}; // TODO
        console.log(workermain_1.store.items);
    }
    io.$$setupFS(workermain_1.store);
    io.$$loadData(workermain_1.store.items);
    try {
        await env.run(code);
        let cells = env.render();
        let state = env.commitLoadableState(); // TODO: doesn't work
        let output = { cells, state };
        // save items to persistent storage (TODO)
        lstore.setItem(itemskey, state); // TODO
        workermain_1.store.items = state; // TODO: why????
        return { output: output };
    }
    catch (e) {
        console.log(e);
        return { errors: env.extractErrors(e) };
    }
    finally {
        io.$$setupFS(null);
    }
}
exports.runJavascript = runJavascript;
//# sourceMappingURL=script.js.map