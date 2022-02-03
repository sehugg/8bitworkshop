import { ECSCompiler } from "../../common/ecs/compiler";
import { Dialect_CA65, ECSError, EntityManager } from "../../common/ecs/ecs";
import { CompileError } from "../../common/tokenizer";
import { CodeListingMap } from "../../common/workertypes";
import { BuildStep, BuildStepResult, gatherFiles, getWorkFileAsString, putWorkFile, staleFiles } from "../workermain";

export function assembleECS(step: BuildStep): BuildStepResult {
    let em = new EntityManager(new Dialect_CA65()); // TODO
    let compiler = new ECSCompiler(em);
    compiler.getImportFile = (path: string) => {
        return getWorkFileAsString(path);
    }
    gatherFiles(step, { mainFilePath: "main.ecs" });
    var destpath = step.prefix + '.ca65';
    if (staleFiles(step, [destpath])) {
        let code = getWorkFileAsString(step.path);
        try {
            compiler.parseFile(code, step.path);
            let outtext = compiler.export().toString();
            putWorkFile(destpath, outtext);
            var listings: CodeListingMap = {};
            listings[destpath] = {lines:[], text:outtext} // TODO
        } catch (e) {
            if (e instanceof ECSError) {
                compiler.addError(e.message, e.$loc);
                return { errors: compiler.errors };
            } else if (e instanceof CompileError) {
                return { errors: compiler.errors };
            } else {
                throw e;
            }
        }
    }
    return {
        nexttool: "ca65",
        path: destpath,
        args: [destpath],
        files: [destpath, 'vcs-ca65.h'], //TODO
        listings
    };
}
