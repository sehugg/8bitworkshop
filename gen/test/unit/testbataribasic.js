"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const wasishim_1 = require("../../src/common/wasi/wasishim");
const fs = __importStar(require("fs"));
const wasiutils_1 = require("../../src/worker/wasiutils");
async function loadBBRunner(filename, bbfs) {
    const wasmdata = fs.readFileSync(`./src/worker/wasm/bb/${filename}.wasm`);
    let shim = new wasishim_1.WASIRunner();
    await shim.loadAsync(wasmdata);
    shim.fs.setParent(bbfs);
    shim.addPreopenDirectory(".");
    return shim;
}
// load the bB include filesystem zip
async function loadBBFS() {
    const zipdata = fs.readFileSync(`./src/worker/fs/bb-fs.zip`);
    return (0, wasiutils_1.unzipWASIFilesystem)(zipdata, "./");
}
describe('test batariBasic WASI pipeline', function () {
    it('2600basic -v', async function () {
        let shim = await loadBBRunner('2600basic', null);
        shim.setArgs(["2600basic", "-v"]);
        let errno = shim.run();
        assert_1.default.strictEqual(errno, 0);
        const stdout = shim.fds[1].getBytesAsString();
        assert_1.default.ok(stdout.indexOf('batari Basic') >= 0, stdout);
    });
    it('compile helloworld.bas end-to-end', async function () {
        const bbfs = await loadBBFS();
        // 1. preprocess: source on stdin -> tokenized output on stdout
        let pre = await loadBBRunner('preprocess', bbfs);
        pre.stdin.write(new TextEncoder().encode(fs.readFileSync('./presets/vcs/bb/helloworld.bas', 'utf8')));
        pre.stdin.offset = 0; // reset so fd_read starts at BOF
        pre.setArgs(["preprocess"]);
        assert_1.default.strictEqual(pre.run(), 0, pre.fds[2].getBytesAsString());
        const preprocessed = pre.fds[1].getBytes();
        assert_1.default.ok(preprocessed.length > 100);
        // 2. 2600basic: preprocessed input -> bB.asm on stdout (-i . => ./includes)
        let basic = await loadBBRunner('2600basic', bbfs);
        basic.stdin.write(preprocessed);
        basic.stdin.offset = 0;
        basic.setArgs(["2600basic", "-i", "."]);
        assert_1.default.strictEqual(basic.run(), 0, basic.fds[2].getBytesAsString());
        const basicerr = basic.fds[2].getBytesAsString();
        assert_1.default.ok(basicerr.indexOf('compilation complete') >= 0, basicerr);
        const bbasm = basic.fds[1].getBytes();
        assert_1.default.ok(bbasm.length > 500);
        // copy compiler-generated files (includes.bB, variable redefs) to next stage
        function copyGeneratedFiles(dest) {
            for (const f of basic.fs.getFiles()) {
                if (!f.name.startsWith('./includes/')) {
                    dest.fs.putFile(f.name, f.getBytes());
                }
            }
        }
        // 3. postprocess: reads includes.bB + bB.asm from cwd -> composite asm
        let post = await loadBBRunner('postprocess', bbfs);
        post.fs.putFile("./bB.asm", bbasm);
        copyGeneratedFiles(post);
        post.setArgs(["postprocess", "-i", "."]);
        assert_1.default.strictEqual(post.run(), 0, post.fds[2].getBytesAsString());
        const asmout = post.fds[1].getBytes();
        assert_1.default.ok(asmout.length > 10000);
        // 4. dasm: assemble composite asm (+ generated headers) with -I./includes
        let dasm = await loadBBRunner('dasm', bbfs);
        dasm.fs.putFile("./main.bas.asm", asmout);
        copyGeneratedFiles(dasm);
        dasm.setArgs(["dasm", "main.bas.asm", "-I./includes", "-f3", "-p20",
            "-lmain.bas.lst", "-smain.bas.sym", "-omain.bas.bin"]);
        assert_1.default.strictEqual(dasm.run(), 0, dasm.fds[2].getBytesAsString());
        const bin = dasm.fs.getFile("./main.bas.bin");
        assert_1.default.ok(bin && bin.size >= 2048, "bin size " + (bin && bin.size));
    });
});
//# sourceMappingURL=testbataribasic.js.map