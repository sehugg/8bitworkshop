import JSZip from 'jszip';
import { WASIRunner, WASIMemoryFilesystem } from "../common/wasi/wasishim";
import { WorkerError } from "../common/workertypes";
import { BuildStep, store } from "./builder";
import { re_crlf } from "./listingutils";
import { ensureWasiFilesystem, loadWASMBinary } from "./wasmutils";

export function loadBlobSync(path: string) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open("GET", path, false);  // synchronous request
    xhr.send(null);
    return xhr.response;
}

export async function unzipWASIFilesystem(zipdata: any, rootPath: string = "./") {
    // In the Node.js test env, the XMLHttpRequest shim returns a custom Blob
    // that JSZip does not recognize. Convert it to an ArrayBuffer first.
    if (zipdata && typeof zipdata.asArrayBuffer === 'function') {
        zipdata = zipdata.asArrayBuffer();
    }
    const jszip = new JSZip();
    await jszip.loadAsync(zipdata);
    let fs = new WASIMemoryFilesystem();
    let promises = [];
    jszip.forEach(async (relativePath, zipEntry) => {
        if (zipEntry.dir) {
            fs.putDirectory(relativePath);
        } else {
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

export async function loadWASIFilesystemZip(zippath: string, rootPath: string = "./") {
    const jszip = new JSZip();
    const path = '../../src/worker/fs/' + zippath;
    const zipdata = loadBlobSync(path);
    return unzipWASIFilesystem(zipdata, rootPath);
}

/** Copy a build step's source files into a WASI runner and preopen directories. */
export function populateWASIFiles(wasi: WASIRunner, step: BuildStep, dirs: string[] = ["."]) {
    for (let file of step.files) {
        wasi.fs.putFile("./" + file, store.getFileData(file));
    }
    for (let dir of dirs) {
        wasi.addPreopenDirectory(dir);
    }
}

/** Run a WASI command, recording any thrown error into the given list. */
export function runWASI(wasi: WASIRunner, errors: WorkerError[]) {
    try {
        wasi.run();
    } catch (e) {
        errors.push({ line: 0, msg: "" + e });
    }
}

/**
 * Wrap a WASI runner's filesystem in the Emscripten FS calls the builder's
 * populateFiles/populateExtraFiles/populateEntry use, so tools can share them.
 */
export function wasiFSAdapter(wasi: WASIRunner) {
    return {
        mkdir: (path: string) => wasi.fs.putDirectory(path),
        writeFile: (path: string, data: string | Uint8Array) => wasi.fs.putFile(path, data),
        utime: () => { },
    };
}

const wasiModules: { [module: string]: WebAssembly.Module } = {};

export interface WASIToolOptions {
    module?: string;    // wasm module name, if not the same as argv[0]
    sharedFS?: string;  // filesystem zip layered under the runner (parent layer)
    stdin?: string;     // text fed to the tool's stdin
    populate?: (fs: ReturnType<typeof wasiFSAdapter>) => void; // copy inputs in
}

/**
 * Run a WASI tool on a fresh runner with '.' preopened, optionally layered over
 * a shared filesystem zip. argv[0] is `tool` (some tools, like sdld, pick
 * their target from it). Returns the runner (for reading outputs), its exit
 * code and its stdout and stderr lines.
 */
export async function runWASITool(tool: string, args: string[], opts: WASIToolOptions = {}) {
    const module = opts.module || tool;
    const wasi = new WASIRunner();
    if (opts.sharedFS) {
        const sharefs = await ensureWasiFilesystem(opts.sharedFS);
        if (!sharefs)
            throw new Error("Could not load filesystem " + opts.sharedFS);
        wasi.fs.setParent(sharefs);
    }
    if (!wasiModules[module]) {
        wasiModules[module] = new WebAssembly.Module(loadWASMBinary(module) as Uint8Array<ArrayBuffer>);
    }
    wasi.initSync(wasiModules[module]);
    if (opts.populate) opts.populate(wasiFSAdapter(wasi));
    if (opts.stdin != null) {
        wasi.stdin.write(new TextEncoder().encode(opts.stdin));
        wasi.stdin.offset = 0; // so fd_read starts at the beginning
    }
    wasi.addPreopenDirectory(".");
    wasi.setArgs([tool, ...args]);
    const errno = wasi.run();
    console.log('exec', tool, args.join(' '));
    const stdout = wasi.fds[1].getBytesAsString().split(re_crlf).filter(s => s != '');
    if (stdout.length) console.log(stdout.join('\n'));
    const stderr = wasi.fds[2].getBytesAsString().split(re_crlf).filter(s => s != '');
    return { wasi, errno, stdout, stderr };
}

/** Report a failed tool run that printed no parseable error message. */
export function checkExitCode(tool: string, errno: number, stderr: string[], errors: WorkerError[]) {
    if (errno && !errors.length) {
        errors.push({ line: 0, msg: tool + " exited with code " + errno + (stderr.length ? ": " + stderr.join('\n') : '') });
    }
}

export function readWASIOutput(wasi: WASIRunner, path: string): Uint8Array {
    const fd = wasi.fs.getFile(path);
    if (!fd) throw new Error("Missing output file " + path);
    return fd.getBytes().slice();
}

export function readWASIOutputString(wasi: WASIRunner, path: string): string {
    return new TextDecoder().decode(readWASIOutput(wasi, path));
}
