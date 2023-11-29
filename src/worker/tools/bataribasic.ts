import { BuildStep, BuildStepResult, gatherFiles, getWorkFileAsString, populateFiles, putWorkFile, staleFiles } from "../builder";
import { EmscriptenModule, emglobal, execMain, load, print_fn, setupFS, setupStdin } from "../wasmutils";

function preprocessBatariBasic(code: string): string {
    load("bbpreprocess");
    var bbout = "";
    function addbbout_fn(s) {
        bbout += s;
        bbout += "\n";
    }
    var BBPRE: EmscriptenModule = emglobal.preprocess({
        noInitialRun: true,
        //logReadFiles:true,
        print: addbbout_fn,
        printErr: print_fn,
        noFSInit: true,
    });
    var FS = BBPRE.FS;
    setupStdin(FS, code);
    BBPRE.callMain([]);
    console.log("preprocess " + code.length + " -> " + bbout.length + " bytes");
    return bbout;
}

export function compileBatariBasic(step: BuildStep): BuildStepResult {
    load("bb2600basic");
    var params = step.params;
    // stdout
    var asmout = "";
    function addasmout_fn(s) {
        asmout += s;
        asmout += "\n";
    }
    // stderr
    var re_err1 = /[(](\d+)[)]:?\s*(.+)/;
    var errors = [];
    var errline = 0;
    function match_fn(s) {
        console.log(s);
        var matches = re_err1.exec(s);
        if (matches) {
            errline = parseInt(matches[1]);
            errors.push({
                line: errline,
                msg: matches[2]
            });
        }
    }
    gatherFiles(step, { mainFilePath: "main.bas" });
    var destpath = step.prefix + '.asm';
    if (staleFiles(step, [destpath])) {
        var BB: EmscriptenModule = emglobal.bb2600basic({
            noInitialRun: true,
            //logReadFiles:true,
            print: addasmout_fn,
            printErr: match_fn,
            noFSInit: true,
            TOTAL_MEMORY: 64 * 1024 * 1024,
        });
        var FS = BB.FS;
        populateFiles(step, FS);
        // preprocess, pipe file to stdin
        var code = getWorkFileAsString(step.path);
        code = preprocessBatariBasic(code);
        setupStdin(FS, code);
        setupFS(FS, '2600basic');
        execMain(step, BB, ["-i", "/share", step.path]);
        if (errors.length)
            return { errors: errors };
        // build final assembly output from include file list
        var includesout = FS.readFile("includes.bB", { encoding: 'utf8' });
        var redefsout = FS.readFile("2600basic_variable_redefs.h", { encoding: 'utf8' });
        var includes = includesout.trim().split("\n");
        var combinedasm = "";
        var splitasm = asmout.split("bB.asm file is split here");
        for (var incfile of includes) {
            var inctext;
            if (incfile == "bB.asm")
                inctext = splitasm[0];
            else if (incfile == "bB2.asm")
                inctext = splitasm[1];
            else
                inctext = FS.readFile("/share/includes/" + incfile, { encoding: 'utf8' });
            console.log(incfile, inctext.length);
            combinedasm += "\n\n;;;" + incfile + "\n\n";
            combinedasm += inctext;
        }
        // TODO: ; bB.asm file is split here
        putWorkFile(destpath, combinedasm);
        putWorkFile("2600basic.h", FS.readFile("/share/includes/2600basic.h"));
        putWorkFile("2600basic_variable_redefs.h", redefsout);
    }
    return {
        nexttool: "dasm",
        path: destpath,
        args: [destpath],
        files: [destpath, "2600basic.h", "2600basic_variable_redefs.h"],
        bblines: true,
    };
}