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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const wasishim_1 = require("../common/wasi/wasishim");
const fs = __importStar(require("fs"));
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
//# sourceMappingURL=testwasishim.js.map