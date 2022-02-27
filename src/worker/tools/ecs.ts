import { ECSCompiler } from "../../common/ecs/compiler";
import { Dialect_CA65, ECSError, EntityManager } from "../../common/ecs/ecs";
import { CompileError } from "../../common/tokenizer";
import { CodeListingMap } from "../../common/workertypes";
import { BuildStep, BuildStepResult, fixParamsWithDefines, gatherFiles, getWorkFileAsString, putWorkFile, staleFiles } from "../workermain";

export function assembleECS(step: BuildStep): BuildStepResult {
    let em = new EntityManager(new Dialect_CA65()); // TODO
    let compiler = new ECSCompiler(em, true);
    compiler.getImportFile = (path: string) => {
        return getWorkFileAsString(path);
    }
    gatherFiles(step, { mainFilePath: "main.ecs" });
    if (step.mainfile) em.mainPath = step.path;
    var destpath = step.prefix + '.ca65';
    if (staleFiles(step, [destpath])) {
        let code = getWorkFileAsString(step.path);
        fixParamsWithDefines(step.path, step.params);
        try {
            compiler.includeDebugInfo = true;
            compiler.parseFile(code, step.path);
            let outtext = compiler.export().toString();
            putWorkFile(destpath, outtext);
            var listings: CodeListingMap = {};
            listings[destpath] = {lines:[], text:outtext} // TODO
            var debuginfo = compiler.em.getDebugTree();
        } catch (e) {
            if (e instanceof ECSError) {
                compiler.addError(e.message, e.$loc);
                for (let obj of e.$sources) {
                    let name = (obj as any).event;
                    if (name == 'start') break;
                    compiler.addError(`... ${name}`, obj.$loc); // TODO?
                }
                return { errors: compiler.errors };
            } else if (e instanceof CompileError) {
                return { errors: compiler.errors };
            } else {
                throw e;
            }
        }
        return {
            nexttool: "ca65",
            path: destpath,
            args: [destpath],
            files: [destpath].concat(step.files),
            listings,
            debuginfo
        };
    }
}
