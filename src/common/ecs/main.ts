import { readFileSync } from "fs";
import { ECSCompiler } from "./compiler";
import { SourceFileExport } from "./ecs";

class ECSMain {

    compiler = new ECSCompiler();

    constructor(readonly args: string[]) {
    }

    run() {
        for (let path of this.args) {
            let text = readFileSync(path, 'utf-8');
            try {
                this.compiler.parseFile(text, path);
            } catch (e) {
                console.log(e);
                for (let err of this.compiler.errors) {
                    console.log(`${err.path}:${err.line}:${err.start}: ${err.msg}`);
                }
            }
        }
        let file = new SourceFileExport();
        this.compiler.exportToFile(file);
        console.log(file.toString());
    }
}

new ECSMain(process.argv.slice(2)).run();
