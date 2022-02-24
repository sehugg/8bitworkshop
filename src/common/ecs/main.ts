import { readFileSync } from "fs";
import { ECSCompiler } from "./compiler";
import { Dialect_CA65, EntityManager, SourceFileExport } from "./ecs";

class ECSMain {

    compiler = new ECSCompiler(new EntityManager(new Dialect_CA65()), true); // TODO

    constructor(readonly args: string[]) {
    }

    run() {
        for (let path of this.args) {
            let text = readFileSync(path, 'utf-8');
            try {
                this.compiler.parseFile(text, path);
                if (this.compiler.errors.length == 0) {
                    let file = new SourceFileExport();
                    this.compiler.exportToFile(file);
                    console.log(file.toString());
                }
            } catch (e) {
                console.error(e);
            }
            for (let err of this.compiler.errors) {
                console.error(`${err.path}:${err.line}:${err.start}: ${err.msg}`);
            }
        }
    }
}

new ECSMain(process.argv.slice(2)).run();
