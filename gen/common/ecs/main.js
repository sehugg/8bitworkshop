"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const compiler_1 = require("./compiler");
const ecs_1 = require("./ecs");
class ECSMain {
    constructor(args) {
        this.args = args;
        this.compiler = new compiler_1.ECSCompiler(new ecs_1.EntityManager(new ecs_1.Dialect_CA65()), true); // TODO
    }
    run() {
        for (let path of this.args) {
            let text = (0, fs_1.readFileSync)(path, 'utf-8');
            try {
                this.compiler.parseFile(text, path);
                if (this.compiler.errors.length == 0) {
                    let file = new ecs_1.SourceFileExport();
                    this.compiler.exportToFile(file);
                    console.log(file.toString());
                }
            }
            catch (e) {
                console.error(e);
            }
            for (let err of this.compiler.errors) {
                console.error(`${err.path}:${err.line}:${err.start}: ${err.msg}`);
            }
        }
    }
}
new ECSMain(process.argv.slice(2)).run();
//# sourceMappingURL=main.js.map