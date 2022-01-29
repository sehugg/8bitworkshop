import { ECSCompiler } from "../../common/ecs/compiler";
import { CompileError } from "../../common/tokenizer";
import { CodeListingMap } from "../../common/workertypes";
import { BuildStep, BuildStepResult, gatherFiles, getWorkFileAsString, putWorkFile, staleFiles } from "../workermain";

export function assembleECS(step: BuildStep): BuildStepResult {
    let compiler = new ECSCompiler();
    gatherFiles(step, { mainFilePath: "main.ecs" });
    var destpath = step.prefix + '.ca65';
    if (staleFiles(step, [destpath])) {
        let code = getWorkFileAsString(step.path);
        try {
            compiler.parseFile(code, step.path);
        } catch (e) {
            if (e instanceof CompileError) {
                return { errors: compiler.errors };
            } else {
                throw e;
            }
        }
        //var listings: CodeListingMap = {};
        putWorkFile(destpath, compiler.export().toString());
    }
    return {
        nexttool: "ca65",
        path: destpath,
        args: [destpath],
        files: [destpath, 'vcs-ca65.h'], //TODO
    };
}
