
import { Environment } from "../../common/script/env";
import { BuildStep, BuildStepResult, emglobal, store } from "../workermain";

// cache environments
var environments : {[path:string] : Environment} = {};

function getEnv(path: string) : Environment {
    var env = environments[path];
    if (!env) {
        env = environments[path] = new Environment(emglobal, path);
        // TODO: load environment from store?
    }
    return env;
}

export async function runJavascript(step: BuildStep) : Promise<BuildStepResult> {
    var env = getEnv(step.path);
    var code = store.getFileAsString(step.path);
    try {
        await env.run(code);
    } catch (e) {
        return {errors: env.extractErrors(e)};
    }
    var output = env.render();
    return {
        output
    };
}
