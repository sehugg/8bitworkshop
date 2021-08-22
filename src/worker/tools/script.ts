
import { BuildStep, BuildStepResult, emglobal, store } from "../workermain";
import { Environment, RunResult } from "../../common/script/env";
import * as io from "../../common/script/lib/io";

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
    try {
        io.$$setupFS(store);
        io.$$loadData(store.items); // TODO: load from file
        await env.run(code);
        let cells = env.render();
        let state = env.getLoadableState(); // TODO: doesn't work
        let output : RunResult = { cells, state };
        return { output: output };
    } catch (e) {
        console.log(e);
        return { errors: env.extractErrors(e) };
    } finally {
        io.$$setupFS(null);
    }
}
