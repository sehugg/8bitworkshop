"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBlobSync = loadBlobSync;
exports.unzipWASIFilesystem = unzipWASIFilesystem;
exports.loadWASIFilesystemZip = loadWASIFilesystemZip;
exports.populateWASIFiles = populateWASIFiles;
exports.runWASI = runWASI;
exports.wasiFSAdapter = wasiFSAdapter;
exports.runWASITool = runWASITool;
exports.checkExitCode = checkExitCode;
exports.readWASIOutput = readWASIOutput;
exports.readWASIOutputString = readWASIOutputString;
const jszip_1 = __importDefault(require("jszip"));
const wasishim_1 = require("../common/wasi/wasishim");
const builder_1 = require("./builder");
const listingutils_1 = require("./listingutils");
const wasmutils_1 = require("./wasmutils");
function loadBlobSync(path) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open("GET", path, false); // synchronous request
    xhr.send(null);
    return xhr.response;
}
async function unzipWASIFilesystem(zipdata, rootPath = "./") {
    // In the Node.js test env, the XMLHttpRequest shim returns a custom Blob
    // that JSZip does not recognize. Convert it to an ArrayBuffer first.
    if (zipdata && typeof zipdata.asArrayBuffer === 'function') {
        zipdata = zipdata.asArrayBuffer();
    }
    const jszip = new jszip_1.default();
    await jszip.loadAsync(zipdata);
    let fs = new wasishim_1.WASIMemoryFilesystem();
    let promises = [];
    jszip.forEach(async (relativePath, zipEntry) => {
        if (zipEntry.dir) {
            fs.putDirectory(relativePath);
        }
        else {
            let path = rootPath + relativePath;
            let prom = zipEntry.async("uint8array").then((data) => {
                fs.putFile(path, data);
            });
            promises.push(prom);
        }
    });
    await Promise.all(promises);
    return fs;
}
async function loadWASIFilesystemZip(zippath, rootPath = "./") {
    const jszip = new jszip_1.default();
    const path = '../../src/worker/fs/' + zippath;
    const zipdata = loadBlobSync(path);
    return unzipWASIFilesystem(zipdata, rootPath);
}
/** Copy a build step's source files into a WASI runner and preopen directories. */
function populateWASIFiles(wasi, step, dirs = ["."]) {
    for (let file of step.files) {
        wasi.fs.putFile("./" + file, builder_1.store.getFileData(file));
    }
    for (let dir of dirs) {
        wasi.addPreopenDirectory(dir);
    }
}
/** Run a WASI command, recording any thrown error into the given list. */
function runWASI(wasi, errors) {
    try {
        wasi.run();
    }
    catch (e) {
        errors.push({ line: 0, msg: "" + e });
    }
}
/**
 * Wrap a WASI runner's filesystem in the Emscripten FS calls the builder's
 * populateFiles/populateExtraFiles/populateEntry use, so tools can share them.
 */
function wasiFSAdapter(wasi) {
    return {
        mkdir: (path) => wasi.fs.putDirectory(path),
        writeFile: (path, data) => wasi.fs.putFile(path, data),
        utime: () => { },
    };
}
const wasiModules = {};
/**
 * Run a WASI tool on a fresh runner with '.' preopened, optionally layered over
 * a shared filesystem zip. argv[0] is `tool` (some tools, like sdld, pick
 * their target from it). Returns the runner (for reading outputs), its exit
 * code and its stdout and stderr lines.
 */
async function runWASITool(tool, args, opts = {}) {
    const module = opts.module || tool;
    const wasi = new wasishim_1.WASIRunner();
    if (opts.sharedFS) {
        const sharefs = await (0, wasmutils_1.ensureWasiFilesystem)(opts.sharedFS);
        if (!sharefs)
            throw new Error("Could not load filesystem " + opts.sharedFS);
        wasi.fs.setParent(sharefs);
    }
    if (!wasiModules[module]) {
        wasiModules[module] = new WebAssembly.Module((0, wasmutils_1.loadWASMBinary)(module));
    }
    wasi.initSync(wasiModules[module]);
    if (opts.populate)
        opts.populate(wasiFSAdapter(wasi));
    if (opts.stdin != null) {
        wasi.stdin.write(new TextEncoder().encode(opts.stdin));
        wasi.stdin.offset = 0; // so fd_read starts at the beginning
    }
    wasi.addPreopenDirectory(".");
    wasi.setArgs([tool, ...args]);
    const errno = wasi.run();
    console.log('exec', tool, args.join(' '));
    const stdout = wasi.fds[1].getBytesAsString().split(listingutils_1.re_crlf).filter(s => s != '');
    if (stdout.length)
        console.log(stdout.join('\n'));
    const stderr = wasi.fds[2].getBytesAsString().split(listingutils_1.re_crlf).filter(s => s != '');
    return { wasi, errno, stdout, stderr };
}
/** Report a failed tool run that printed no parseable error message. */
function checkExitCode(tool, errno, stderr, errors) {
    if (errno && !errors.length) {
        errors.push({ line: 0, msg: tool + " exited with code " + errno + (stderr.length ? ": " + stderr.join('\n') : '') });
    }
}
function readWASIOutput(wasi, path) {
    const fd = wasi.fs.getFile(path);
    if (!fd)
        throw new Error("Missing output file " + path);
    return fd.getBytes().slice();
}
function readWASIOutputString(wasi, path) {
    return new TextDecoder().decode(readWASIOutput(wasi, path));
}
//# sourceMappingURL=wasiutils.js.map