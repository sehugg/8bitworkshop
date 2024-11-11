import assert from "assert";
import { WASIRunner } from "../common/wasi/wasishim";
import * as fs from "fs";
import { loadWASIFilesystemZip, unzipWASIFilesystem } from "../worker/wasiutils";

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
async function loadOscar64() {
    return loadWASM('oscar64');
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

/*
describe('test WASI oscar64', function () {
    it('oscar64 compile', async function () {
        let shim = await loadOscar64();
        const zipdata = fs.readFileSync(`./src/worker/fs/oscar64-fs.zip`);
        shim.fs = await unzipWASIFilesystem(zipdata, "/root/");
        // https://github.com/WebAssembly/wasi-filesystem/issues/24
        // https://github.com/WebAssembly/wasi-libc/pull/214
        shim.addPreopenDirectory("/root");
        shim.fs.putSymbolicLink("/proc/self/exe", "/root/bin/oscar64");
        shim.fs.putFile("/root/main.c", `#include <stdio.h>\nint main() { printf("FOO"); return 0; }`);
        shim.setArgs(["oscar64", '-v', '-g', '-O', '-o=foo.prg', 'main.c']);
        let errno = shim.run();
        const stdout = shim.fds[1].getBytesAsString();
        console.log(stdout);
        const stderr = shim.fds[2].getBytesAsString();
        console.log(stderr);
        assert.strictEqual(errno, 0);
        assert.ok(stdout.indexOf('Starting oscar64') >= 0);
        console.log(shim.fs.getFile("/root/foo.asm").getBytesAsString());
    });
});
*/
