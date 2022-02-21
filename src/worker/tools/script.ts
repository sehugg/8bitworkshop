
import { BuildStep, BuildStepResult, emglobal, store } from "../workermain";
import { Environment, RunResult } from "../../common/script/env";
import * as io from "../../common/script/lib/io";
import { createNewPersistentStore } from "../../ide/project";

// cache environments
var environments: { [path: string]: Environment } = {};

function getEnv(path: string): Environment {
    var env = environments[path];
    if (!env) {
        env = environments[path] = new Environment(emglobal, path);
        // TODO: load environment from store?
    }
    return env;
}

export async function runJavascript(step: BuildStep): Promise<BuildStepResult> {
    var env = getEnv(step.path);
    var code = store.getFileAsString(step.path);
    var lstore = createNewPersistentStore(step.platform + "//items");
    // load items from persistent storage (TODO)
    const itemskey = step.path;
    if (store.items == null) {
        store.items = (await lstore.getItem(itemskey)) || {}; // TODO
        console.log(store.items);
    }
    io.$$setupFS(store);
    io.$$loadData(store.items);
    try {
        await env.run(code);
        let cells = env.render();
        let state = env.commitLoadableState(); // TODO: doesn't work
        let output : RunResult = { cells, state };
        // save items to persistent storage (TODO)
        lstore.setItem(itemskey, state); // TODO
        store.items = state; // TODO: why????
        return { output: output };
    } catch (e) {
        console.log(e);
        return { errors: env.extractErrors(e) };
    } finally {
        io.$$setupFS(null);
    }
}
