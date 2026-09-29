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
const mocha_1 = require("mocha");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const testlib_1 = require("../../src/tools/testlib");
const sdcc_1 = require("../../src/worker/tools/sdcc");
// The Game Boy links GBDK's crt0 and sfr objects from src/worker/lib/gb
// ahead of the program's, unless the program links its own.
(0, mocha_1.describe)('sdcc startup objects', function () {
    (0, mocha_1.it)('go first', function () {
        assert_1.default.deepStrictEqual((0, sdcc_1.withStartupObjects)(['sfr.rel', 'crt0.rel'], ['main.rel', 'util.rel']), ['sfr.rel', 'crt0.rel', 'main.rel', 'util.rel']);
    });
    (0, mocha_1.it)('give way to the project\'s own, by file name', function () {
        assert_1.default.deepStrictEqual((0, sdcc_1.withStartupObjects)(['sfr.rel', 'crt0.rel'], ['gb/sfr.rel', 'gb/crt0.rel', 'main.rel']), ['gb/sfr.rel', 'gb/crt0.rel', 'main.rel']);
        assert_1.default.deepStrictEqual((0, sdcc_1.withStartupObjects)(['sfr.rel', 'crt0.rel'], ['crt0.rel', 'main.rel']), ['sfr.rel', 'crt0.rel', 'main.rel']);
    });
    (0, mocha_1.it)('leave other platforms alone', function () {
        assert_1.default.deepStrictEqual((0, sdcc_1.withStartupObjects)(undefined, ['main.rel']), ['main.rel']);
        assert_1.default.deepStrictEqual((0, sdcc_1.withStartupObjects)([], ['main.rel']), ['main.rel']);
    });
});
(0, mocha_1.describe)('Game Boy C build', function () {
    this.timeout(60000);
    const MAIN = '#include "gb/types.h"\n#include "gb/hardware.h"\n#include "gb/gb.h"\n' +
        'void main(void) { wait_vbl_done(); }\n';
    let tmpdir;
    before(async function () {
        tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "sdcclink-"));
        await (0, testlib_1.preload)('sdcc', 'gb');
    });
    after(function () { fs.rmSync(tmpdir, { recursive: true, force: true }); });
    function build(name, code) {
        const p = path.join(tmpdir, name);
        fs.writeFileSync(p, code);
        return (0, testlib_1.compileSourceFile)('sdcc', 'gb', p);
    }
    (0, mocha_1.it)('links crt0 and the GBDK headers from the library', async function () {
        const result = await build('plain.c', MAIN);
        assert_1.default.deepStrictEqual(result.errors || [], []);
        assert_1.default.strictEqual(result.output.length, 0x8000);
    });
    (0, mocha_1.it)('links the project\'s own crt0 instead, to the same ROM', async function () {
        for (const f of ['crt0.sgb', 'sfr.sgb', 'global.sgb'])
            fs.copyFileSync(path.join('src/worker/lib/gb', f), path.join(tmpdir, f));
        const plain = await build('plain2.c', MAIN);
        const own = await build('own.c', '//#link "sfr.sgb"\n//#link "crt0.sgb"\n' + MAIN);
        assert_1.default.deepStrictEqual(own.errors || [], []);
        assert_1.default.deepStrictEqual(Buffer.from(own.output), Buffer.from(plain.output));
    });
});
//# sourceMappingURL=testsdcclink.js.map