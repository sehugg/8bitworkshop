"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileBatariBasic = compileBatariBasic;
// batari Basic compiler (WASI/wasmtime build, v1.9)
// Pipeline: preprocess | 2600basic > bB.asm ; postprocess -i . > final.asm ;
//           dasm final.asm -I./includes -f3 -p20 -> .bin/.lst/.sym
// (The optional optimize/bbfilter/relocateBB stages are not used here.)
const wasishim_1 = require("../../common/wasi/wasishim");
const builder_1 = require("../builder");
const wasmutils_1 = require("../wasmutils");
const wasiutils_1 = require("../wasiutils");
const dasm_1 = require("./dasm");
const listingutils_1 = require("../listingutils");
let bbModules = {};
let bbFS = null;
function getBBModule(name) {
    if (!bbModules[name]) {
        bbModules[name] = new WebAssembly.Module((0, wasmutils_1.loadWASMBinary)("bb/" + name));
    }
    return bbModules[name];
}
async function getBBFilesystem() {
    if (!bbFS) {
        bbFS = await (0, wasiutils_1.loadWASIFilesystemZip)("bb-fs.zip");
    }
    return bbFS;
}
function makeRunner(name) {
    const wasi = new wasishim_1.WASIRunner();
    wasi.initSync(getBBModule(name));
    wasi.fs.setParent(bbFS);
    wasi.addPreopenDirectory(".");
    return wasi;
}
function runRunner(wasi, name, args, errors) {
    wasi.setArgs([name, ...args]);
    try {
        wasi.run();
    }
    catch (e) {
        errors.push({ line: 0, msg: "" + e });
    }
}
// match "line #: error msg" lines from the 2600basic stderr
function matchBasicErrors(stderr, path, errors) {
    // e.g. "(14): error: Unknown keyword"
    const re = /\((\d+)\):?\s*(.+)/;
    for (let line of stderr.split("\n")) {
        const m = re.exec(line);
        if (m) {
            errors.push({ path: path, line: parseInt(m[1]), msg: m[2] });
        }
        else if (line.indexOf("error") >= 0 || line.indexOf("Error") >= 0) {
            errors.push({ line: 0, msg: line.trim() });
        }
    }
}
async function compileBatariBasic(step) {
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.bas" });
    const destpath = step.prefix + '.asm';
    const binpath = step.prefix + '.bin';
    const lstpath = step.prefix + '.lst';
    const sympath = step.prefix + '.sym';
    if (!(0, builder_1.staleFiles)(step, [destpath])) {
        return;
    }
    await getBBFilesystem();
    const errors = [];
    const srcpath = step.path;
    const srcdata = builder_1.store.getFileData(srcpath);
    const source = typeof srcdata === 'string' ? new TextEncoder().encode(srcdata) : srcdata;
    // 1. preprocess: source on stdin -> tokenized output
    const pre = makeRunner("preprocess");
    pre.stdin.write(source);
    pre.stdin.offset = 0; // reset so fd_read starts at BOF
    runRunner(pre, "preprocess", [], errors);
    matchBasicErrors(pre.fds[2].getBytesAsString(), srcpath, errors);
    if (errors.length)
        return { errors };
    const preprocessed = pre.fds[1].getBytes();
    // helper: fail if the compiler exited nonzero with no parsed errors
    function checkExit(wasi, msg) {
        if (wasi.errno != 0 && !errors.length) {
            errors.push({ line: 0, msg: msg });
        }
    }
    // 2. 2600basic: preprocessed code on stdin -> bB.asm on stdout,
    //    writes includes.bB + 2600basic_variable_redefs.h to cwd (-i . => ./includes)
    const basic = makeRunner("2600basic");
    basic.stdin.write(preprocessed);
    basic.stdin.offset = 0;
    runRunner(basic, "2600basic", ["-i", "."], errors);
    const basicerr = basic.fds[2].getBytesAsString();
    matchBasicErrors(basicerr, srcpath, errors);
    checkExit(basic, "Compilation failed.");
    if (errors.length)
        return { errors };
    const bbasm = basic.fds[1].getBytes();
    // 3. postprocess: reads includes.bB + bB.asm from cwd -> composite asm on stdout
    const post = makeRunner("postprocess");
    post.fs.putFile("./bB.asm", bbasm);
    for (const f of basic.fs.getFiles()) {
        if (!f.name.startsWith('./includes/'))
            post.fs.putFile(f.name, f.getBytes());
    }
    runRunner(post, "postprocess", ["-i", "."], errors);
    checkExit(post, "Postprocess failed.");
    if (errors.length)
        return { errors };
    const asmout = post.fds[1].getBytes();
    (0, builder_1.putWorkFile)(destpath, asmout);
    // 4. dasm: assemble composite asm with include dir
    const dasm = makeRunner("dasm");
    dasm.fs.putFile("./" + destpath, asmout);
    for (const f of basic.fs.getFiles()) {
        if (!f.name.startsWith('./includes/'))
            dasm.fs.putFile(f.name, f.getBytes());
    }
    runRunner(dasm, "dasm", [destpath, "-I./includes", "-f3", "-p20",
        "-l" + lstpath, "-s" + sympath, "-o" + binpath], errors);
    // parse dasm stdout/stderr for warnings/errors
    const unresolved = {};
    const fatal = (0, dasm_1.parseDASMOutput)(dasm.fds[1].getBytesAsString(), errors, unresolved);
    const matcher = (0, listingutils_1.msvcErrorMatcher)(errors);
    for (let line of dasm.fds[2].getBytesAsString().split("\n")) {
        matcher(line);
    }
    if (errors.length) {
        return { errors: errors };
    }
    const alst = dasm.fs.getFile("./" + lstpath).getBytesAsString();
    const listings = {};
    for (let path of [...step.files, destpath]) {
        listings[path] = { lines: [] };
    }
    (0, dasm_1.parseDASMListing)(lstpath, alst, listings, errors, unresolved);
    // the fatal summary only helps when we found nothing more specific
    if (fatal && !errors.length)
        errors.push({ line: 0, msg: fatal });
    if (errors.length) {
        return { errors: errors };
    }
    let asym;
    try {
        asym = dasm.fs.getFile("./" + sympath).getBytesAsString();
    }
    catch (e) {
        console.log(e);
        return { errors: [{ line: 0, msg: "No symbol table generated, maybe segment overflow?" }] };
    }
    const symbolmap = (0, dasm_1.parseSymbolMap)(asym);
    const aout = dasm.fs.getFile("./" + binpath).getBytes();
    (0, builder_1.putWorkFile)(binpath, aout);
    (0, builder_1.putWorkFile)(lstpath, alst);
    (0, builder_1.putWorkFile)(sympath, asym);
    // return unchanged if no files changed
    if (!(0, builder_1.anyTargetChanged)(step, [binpath]))
        return;
    // map asm listing onto the BASIC editor view
    let lst = listings[destpath];
    if (lst) {
        lst.asmlines = lst.lines;
        lst.text = alst;
        lst.lines = [];
    }
    return {
        output: aout,
        listings: listings,
        errors: errors,
        symbolmap: symbolmap,
        origin: getOrigin(listings),
    };
}
// Determine likely origin address from listing
function getOrigin(listings) {
    let minOffset;
    for (let key in listings) {
        let lst = listings[key];
        if (lst && lst.asmlines) {
            for (let line of lst.asmlines) {
                if (line.iscode && line.offset > 0) {
                    if (minOffset === undefined || line.offset < minOffset) {
                        minOffset = line.offset;
                    }
                }
            }
        }
    }
    return minOffset;
}
//# sourceMappingURL=bataribasic.js.map