"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const testlib_1 = require("../../src/tools/testlib");
// A hand-written ca65 program for the VCS is a plain 4K cartridge: it supplies
// its own reset code and vectors, so it must not be linked against the C
// runtime (crt0.o + atari2600.lib) or laid out with the bank-switched
// atari2600.cfg that vcslib's C programs use -- crt0 has a VECTORS segment of
// its own, and two of them overflow the $FFFA..$FFFF the config pins them to.
(0, mocha_1.describe)('vcs link configuration', () => {
    (0, mocha_1.it)('should link a ca65 project as a plain 4K cart', async () => {
        await (0, testlib_1.preload)('ca65', 'vcs');
        const result = await (0, testlib_1.compileSourceFile)('ca65', 'vcs', 'presets/vcs/skeleton.ca65', 'skeleton.s');
        assert_1.default.deepStrictEqual(result.errors || [], []);
        assert_1.default.strictEqual(result.output.length, 4096);
    });
    (0, mocha_1.it)('should link a cc65 project with the bank-switched config', async () => {
        await (0, testlib_1.preload)('cc65', 'vcs');
        const result = await (0, testlib_1.compileSourceFile)('cc65', 'vcs', 'presets/vcs/skeleton.cc65', 'skeleton.c');
        assert_1.default.deepStrictEqual(result.errors || [], []);
        assert_1.default.strictEqual(result.output.length, 18432);
    });
});
// sdcc's linker also emits records for whatever it placed outside the ROM --
// here a GSINIT area that landed in the _DATA area's RAM at $e5b0. Those bytes
// are not part of the cartridge, and checking them for an overlap used to read
// past the end of the ROM image and report one that wasn't there.
(0, mocha_1.describe)('sdcc IHX output', () => {
    (0, mocha_1.it)('should ignore records outside the ROM image', async () => {
        await (0, testlib_1.preload)('sdcc', 'vector-z80color');
        const result = await (0, testlib_1.compileSourceFile)('sdcc', 'vector-z80color', 'presets/vector-z80color/game.c');
        assert_1.default.deepStrictEqual(result.errors || [], []);
        assert_1.default.strictEqual(result.output.length, 32768);
    });
});
//# sourceMappingURL=testlinking.js.map