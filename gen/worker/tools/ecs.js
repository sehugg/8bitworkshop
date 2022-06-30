"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assembleECS = void 0;
const compiler_1 = require("../../common/ecs/compiler");
const ecs_1 = require("../../common/ecs/ecs");
const tokenizer_1 = require("../../common/tokenizer");
const workermain_1 = require("../workermain");
function assembleECS(step) {
    let em = new ecs_1.EntityManager(new ecs_1.Dialect_CA65()); // TODO
    let compiler = new compiler_1.ECSCompiler(em, true);
    compiler.getImportFile = (path) => {
        return (0, workermain_1.getWorkFileAsString)(path);
    };
    (0, workermain_1.gatherFiles)(step, { mainFilePath: "main.ecs" });
    if (step.mainfile)
        em.mainPath = step.path;
    var destpath = step.prefix + '.ca65';
    if ((0, workermain_1.staleFiles)(step, [destpath])) {
        let code = (0, workermain_1.getWorkFileAsString)(step.path);
        (0, workermain_1.fixParamsWithDefines)(step.path, step.params);
        try {
            compiler.includeDebugInfo = true;
            compiler.parseFile(code, step.path);
            let outtext = compiler.export().toString();
            (0, workermain_1.putWorkFile)(destpath, outtext);
            var listings = {};
            listings[destpath] = { lines: [], text: outtext }; // TODO
            var debuginfo = compiler.em.getDebugTree();
        }
        catch (e) {
            if (e instanceof ecs_1.ECSError) {
                compiler.addError(e.message, e.$loc);
                for (let obj of e.$sources) {
                    let name = obj.event;
                    if (name == 'start')
                        break;
                    compiler.addError(`... ${name}`, obj.$loc); // TODO?
                }
                return { errors: compiler.errors };
            }
            else if (e instanceof tokenizer_1.CompileError) {
                return { errors: compiler.errors };
            }
            else {
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
exports.assembleECS = assembleECS;
//# sourceMappingURL=ecs.js.map