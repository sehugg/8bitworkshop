import assert from "assert";
import { WASIRunner } from "../common/wasi/wasishim";
import * as fs from "fs";

async function loadWASM(filename: string) {
    const wasmdata = fs.readFileSync(`./src/worker/wasm/${filename}.wasm`);
    let shim = new WASIRunner();
    await shim.loadAsync(wasmdata);
    return shim;
}

async function loadDASM() {
    return loadWASM('dasm-wasisdk');
}
async function loadCC7800() {
    return loadWASM('cc7800');
}

describe('test WASI DASM', function () {
    it('dasm help', async function () {
        let shim = await loadDASM();
        let errno = shim.run();
        assert.strictEqual(errno, 1);
    });
    it('dasm file not found', async function () {
        let shim = await loadDASM();
        shim.setArgs(["dasm", "file_not_found.asm"]);
        let errno = shim.run();
        assert.strictEqual(errno, 2);
    });
    it('dasm file not found 2', async function () {
        let shim = await loadDASM();
        shim.setArgs(["dasm", "/file.asm", "-d"]);
        let errno = shim.run();
        assert.strictEqual(errno, 2);
    });
    it('dasm bad args 1', async function () {
        let shim = await loadDASM();
        shim.setArgs(["dasm", "file_not_found.asm", "extra_arg.asm"]);
        let errno = shim.run();
        assert.strictEqual(errno, 1);
    });
    it('dasm bad args 2', async function () {
        let shim = await loadDASM();
        shim.setArgs(["dasm", "file_not_found.asm", "-E9"]);
        let errno = shim.run();
        assert.strictEqual(errno, 1);
    });
    it('dasm empty file', async function () {
        let shim = await loadDASM();
        shim.setArgs(["dasm", "empty.asm"]);
        shim.addPreopenDirectory("/root");
        shim.fs.putFile("/root/empty.asm", "");
        let errno = shim.run();
        assert.strictEqual(errno, 0);
    });
    it('dasm small file', async function () {
        let shim = await loadDASM();
        shim.setArgs(["dasm", "empty.asm"]);
        shim.addPreopenDirectory("/root");
        shim.fs.putFile("/root/empty.asm", " processor 6502\n org $100\n nop");
        let errno = shim.run();
        assert.strictEqual(errno, 0);
        let aout = shim.fs.getFile("/root/a.out");
        assert.deepStrictEqual(Array.from(aout.getBytes()), [0x00, 0x01, 0xea]);
    });
});

describe('test WASI cc7800', function () {
    it('cc7800 help', async function () {
        let shim = await loadCC7800();
        shim.setArgs(["cc7800", '-h']);
        let errno = shim.run();
        assert.strictEqual(errno, 0);
        const stdout = shim.fds[1].getBytesAsString();
        console.log(stdout);
        assert.ok(stdout.indexOf('Usage: cc7800') >= 0);
    });
});
