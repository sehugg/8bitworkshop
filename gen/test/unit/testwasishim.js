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
const oscar64parse_1 = require("../../src/worker/tools/oscar64parse");
async function loadWASM(filename) {
    const wasmdata = fs.readFileSync(`./src/worker/wasm/${filename}.wasm`);
    let shim = new wasishim_1.WASIRunner();
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
        assert_1.default.strictEqual(errno, 1);
    });
    it('dasm file not found', async function () {
        let shim = await loadDASM();
        shim.setArgs(["dasm", "file_not_found.asm"]);
        let errno = shim.run();
        assert_1.default.strictEqual(errno, 2);
    });
    it('dasm file not found 2', async function () {
        let shim = await loadDASM();
        shim.setArgs(["dasm", "/file.asm", "-d"]);
        let errno = shim.run();
        assert_1.default.strictEqual(errno, 2);
    });
    it('dasm bad args 1', async function () {
        let shim = await loadDASM();
        shim.setArgs(["dasm", "file_not_found.asm", "extra_arg.asm"]);
        let errno = shim.run();
        assert_1.default.strictEqual(errno, 1);
    });
    it('dasm bad args 2', async function () {
        let shim = await loadDASM();
        shim.setArgs(["dasm", "file_not_found.asm", "-E9"]);
        let errno = shim.run();
        assert_1.default.strictEqual(errno, 1);
    });
    it('dasm empty file', async function () {
        let shim = await loadDASM();
        shim.setArgs(["dasm", "empty.asm"]);
        shim.addPreopenDirectory("/root");
        shim.fs.putFile("/root/empty.asm", "");
        let errno = shim.run();
        assert_1.default.strictEqual(errno, 0);
    });
    it('dasm small file', async function () {
        let shim = await loadDASM();
        shim.setArgs(["dasm", "empty.asm"]);
        shim.addPreopenDirectory("/root");
        shim.fs.putFile("/root/empty.asm", " processor 6502\n org $100\n nop");
        let errno = shim.run();
        assert_1.default.strictEqual(errno, 0);
        let aout = shim.fs.getFile("/root/a.out");
        assert_1.default.deepStrictEqual(Array.from(aout.getBytes()), [0x00, 0x01, 0xea]);
    });
});
describe('test WASI cc7800', function () {
    it('cc7800 help', async function () {
        let shim = await loadCC7800();
        shim.setArgs(["cc7800", '-h']);
        let errno = shim.run();
        assert_1.default.strictEqual(errno, 0);
        const stdout = shim.fds[1].getBytesAsString();
        console.log(stdout);
        assert_1.default.ok(stdout.indexOf('Usage: cc7800') >= 0);
    });
});
describe('test WASI dialogc', function () {
    async function loadDialogc() {
        let shim = await loadWASM('dialogc');
        const zipdata = fs.readFileSync(`./src/worker/fs/dialog-fs.zip`);
        shim.fs.setParent(await (0, wasiutils_1.unzipWASIFilesystem)(zipdata, "./"));
        shim.addPreopenDirectory(".");
        return shim;
    }
    it('dialogc compile', async function () {
        let shim = await loadDialogc();
        const src = fs.readFileSync('./presets/zmachine/hello.dg', 'utf8');
        shim.fs.putFile("./hello.dg", src);
        shim.setArgs(["dialogc", "-t", "z8", "-o", "hello.z8", "hello.dg", "stdlib.dg"]);
        let errno = shim.run();
        assert_1.default.strictEqual(shim.fds[2].getBytesAsString(), "");
        assert_1.default.strictEqual(errno, 0);
        const zfile = shim.fs.getFile("./hello.z8").getBytes();
        assert_1.default.ok(zfile.length > 1000);
        assert_1.default.strictEqual(zfile[0], 8); // z-machine version 8
    });
    it('dialogc syntax error', async function () {
        let shim = await loadDialogc();
        shim.fs.putFile("./bad.dg", "(room #room)\n(current player #player\n");
        shim.setArgs(["dialogc", "-t", "z8", "-o", "bad.z8", "bad.dg", "stdlib.dg"]);
        let errno = shim.run();
        assert_1.default.strictEqual(errno, 1);
        const stderr = shim.fds[2].getBytesAsString();
        assert_1.default.ok(stderr.indexOf('Error: bad.dg, line ') >= 0, stderr);
    });
    it('dialogc missing source file', async function () {
        let shim = await loadDialogc();
        shim.setArgs(["dialogc", "-t", "z8", "-o", "x.z8", "nosuch.dg", "stdlib.dg"]);
        let errno = shim.run();
        assert_1.default.strictEqual(errno, 1);
        const stderr = shim.fds[2].getBytesAsString();
        assert_1.default.ok(stderr.indexOf('Error: Failed to open "nosuch.dg"') >= 0, stderr);
    });
});
describe('test WASI oscar64', function () {
    it('oscar64 compile + parse output', async function () {
        let shim = await loadOscar64();
        const zipdata = fs.readFileSync(`./src/worker/fs/oscar64-fs.zip`);
        let oscar64_fs = await (0, wasiutils_1.unzipWASIFilesystem)(zipdata, "./");
        shim.fs.setParent(oscar64_fs);
        shim.fs.putFile("./main.c", `#include <stdio.h>\nint main() { printf("FOO"); return 0; }`);
        shim.addPreopenDirectory("include");
        shim.addPreopenDirectory(".");
        shim.setArgs(["oscar64", '-v', '-gp', '-ii=include', '-o=./foo.prg', 'main.c']);
        let errno = shim.run();
        const stdout = shim.fds[1].getBytesAsString();
        const stderr = shim.fds[2].getBytesAsString();
        assert_1.default.strictEqual(errno, 0, stdout + '\n' + stderr);
        assert_1.default.ok(stdout.indexOf('Starting oscar64') >= 0, stdout);
        // oscar64 should have written a .map, .lbl and .asm file
        assert_1.default.ok(shim.fs.getFile("././foo.prg"), "foo.prg not written");
        assert_1.default.ok(shim.fs.getFile("././foo.map"), "foo.map not written");
        assert_1.default.ok(shim.fs.getFile("././foo.lbl"), "foo.lbl not written");
        assert_1.default.ok(shim.fs.getFile("././foo.asm"), "foo.asm not written");
        // parse the map file for segments and symbols
        let mapout = shim.fs.getFile("././foo.map").getBytesAsString();
        let parsed = (0, oscar64parse_1.parseOscar64Map)(mapout);
        assert_1.default.ok(parsed.segments.length > 0);
        assert_1.default.ok(parsed.symbolmap['main'] > 0);
        // parse the lbl file
        let lblout = shim.fs.getFile("././foo.lbl").getBytesAsString();
        let lbl = (0, oscar64parse_1.parseOscar64Lbl)(lblout);
        assert_1.default.ok(lbl['main'] === parsed.symbolmap['main']);
        // parse the asm listing
        let asmout = shim.fs.getFile("././foo.asm").getBytesAsString();
        let listing = (0, oscar64parse_1.parseOscar64Listing)(asmout, 'main.c');
        assert_1.default.ok(listing.asmlines.length > 0);
        assert_1.default.ok(listing.srclines.length > 0);
        assert_1.default.ok(listing.srclines[0].offset > 0);
    });
});
//# sourceMappingURL=testwasishim.js.map