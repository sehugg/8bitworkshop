import assert from "assert";
import { WASIRunner } from "../../src/common/wasi/wasishim";
import * as fs from "fs";
import { unzipWASIFilesystem } from "../../src/worker/wasiutils";

async function loadBBRunner(filename: string, bbfs: any): Promise<WASIRunner> {
    const wasmdata = fs.readFileSync(`./src/worker/wasm/bb/${filename}.wasm`);
    let shim = new WASIRunner();
    await shim.loadAsync(wasmdata);
    shim.fs.setParent(bbfs);
    shim.addPreopenDirectory(".");
    return shim;
}

// load the bB include filesystem zip
async function loadBBFS() {
    const zipdata = fs.readFileSync(`./src/worker/fs/bb-fs.zip`);
    return unzipWASIFilesystem(zipdata as any, "./");
}

describe('test batariBasic WASI pipeline', function () {

    it('2600basic -v', async function () {
        let shim = await loadBBRunner('2600basic', null);
        shim.setArgs(["2600basic", "-v"]);
        let errno = shim.run();
        assert.strictEqual(errno, 0);
        const stdout = shim.fds[1].getBytesAsString();
        assert.ok(stdout.indexOf('batari Basic') >= 0, stdout);
    });

    it('compile helloworld.bas end-to-end', async function () {
        const bbfs = await loadBBFS();

        // 1. preprocess: source on stdin -> tokenized output on stdout
        let pre = await loadBBRunner('preprocess', bbfs);
        pre.stdin.write(new TextEncoder().encode(
            fs.readFileSync('./presets/vcs/bb/helloworld.bas', 'utf8')));
        pre.stdin.offset = 0; // reset so fd_read starts at BOF
        pre.setArgs(["preprocess"]);
        assert.strictEqual(pre.run(), 0, pre.fds[2].getBytesAsString());
        const preprocessed = pre.fds[1].getBytes();
        assert.ok(preprocessed.length > 100);

        // 2. 2600basic: preprocessed input -> bB.asm on stdout (-i . => ./includes)
        let basic = await loadBBRunner('2600basic', bbfs);
        basic.stdin.write(preprocessed);
        basic.stdin.offset = 0;
        basic.setArgs(["2600basic", "-i", "."]);
        assert.strictEqual(basic.run(), 0, basic.fds[2].getBytesAsString());
        const basicerr = basic.fds[2].getBytesAsString();
        assert.ok(basicerr.indexOf('compilation complete') >= 0, basicerr);
        const bbasm = basic.fds[1].getBytes();
        assert.ok(bbasm.length > 500);

        // copy compiler-generated files (includes.bB, variable redefs) to next stage
        function copyGeneratedFiles(dest: WASIRunner) {
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
        assert.strictEqual(post.run(), 0, post.fds[2].getBytesAsString());
        const asmout = post.fds[1].getBytes();
        assert.ok(asmout.length > 10000);

        // 4. dasm: assemble composite asm (+ generated headers) with -I./includes
        let dasm = await loadBBRunner('dasm', bbfs);
        dasm.fs.putFile("./main.bas.asm", asmout);
        copyGeneratedFiles(dasm);
        dasm.setArgs(["dasm", "main.bas.asm", "-I./includes", "-f3", "-p20",
            "-lmain.bas.lst", "-smain.bas.sym", "-omain.bas.bin"]);
        assert.strictEqual(dasm.run(), 0, dasm.fds[2].getBytesAsString());
        const bin = dasm.fs.getFile("./main.bas.bin");
        assert.ok(bin && bin.size >= 2048, "bin size " + (bin && bin.size));
    });
});
