"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileBatariBasic = compileBatariBasic;
const builder_1 = require("../builder");
const wasmutils_1 = require("../wasmutils");
function preprocessBatariBasic(code) {
    (0, wasmutils_1.load)("bbpreprocess");
    var bbout = "";
    function addbbout_fn(s) {
        bbout += s;
        bbout += "\n";
    }
    var BBPRE = wasmutils_1.emglobal.preprocess({
        noInitialRun: true,
        //logReadFiles:true,
        print: addbbout_fn,
        printErr: wasmutils_1.print_fn,
        noFSInit: true,
    });
    var FS = BBPRE.FS;
    (0, wasmutils_1.setupStdin)(FS, code);
    BBPRE.callMain([]);
    console.log("preprocess " + code.length + " -> " + bbout.length + " bytes");
    return bbout;
}
function compileBatariBasic(step) {
    (0, wasmutils_1.load)("bb2600basic");
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
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.bas" });
    var destpath = step.prefix + '.asm';
    if ((0, builder_1.staleFiles)(step, [destpath])) {
        var BB = wasmutils_1.emglobal.bb2600basic({
            noInitialRun: true,
            //logReadFiles:true,
            print: addasmout_fn,
            printErr: match_fn,
            noFSInit: true,
            TOTAL_MEMORY: 64 * 1024 * 1024,
        });
        var FS = BB.FS;
        (0, builder_1.populateFiles)(step, FS);
        // preprocess, pipe file to stdin
        var code = (0, builder_1.getWorkFileAsString)(step.path);
        code = preprocessBatariBasic(code);
        (0, wasmutils_1.setupStdin)(FS, code);
        (0, wasmutils_1.setupFS)(FS, '2600basic');
        (0, wasmutils_1.execMain)(step, BB, ["-i", "/share", step.path]);
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
        (0, builder_1.putWorkFile)(destpath, combinedasm);
        (0, builder_1.putWorkFile)("2600basic.h", FS.readFile("/share/includes/2600basic.h"));
        (0, builder_1.putWorkFile)("2600basic_variable_redefs.h", redefsout);
    }
    return {
        nexttool: "dasm",
        path: destpath,
        args: [destpath],
        files: [destpath, "2600basic.h", "2600basic_variable_redefs.h"],
        bblines: true,
    };
}
//# sourceMappingURL=bataribasic.js.map