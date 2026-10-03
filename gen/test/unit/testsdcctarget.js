"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const sdcc_1 = require("../../src/worker/tools/sdcc");
const toolselect_1 = require("../../src/common/toolselect");
(0, mocha_1.describe)("sdcc targets", function () {
    (0, mocha_1.it)("maps the platform arch to an SDCC port", function () {
        assert_1.default.deepStrictEqual(['z80', 'gbz80', '6502', undefined].map((a) => (0, sdcc_1.sdccTarget)(a).mflag), ['-mz80', '-mgbz80', '-mmos6502', '-mz80']);
        assert_1.default.strictEqual((0, sdcc_1.sdccTarget)('6502').as, 'sdas6500');
        assert_1.default.strictEqual((0, sdcc_1.sdccTarget)('gbz80').as, 'sdasgb');
    });
    (0, mocha_1.it)("only the mos6502 port is SDCC 4 only, and uses sdcccall(0)", function () {
        assert_1.default.ok((0, sdcc_1.sdccTarget)('6502').only4);
        assert_1.default.ok(!(0, sdcc_1.sdccTarget)('z80').only4);
        assert_1.default.strictEqual((0, sdcc_1.sdccTarget)('6502').sdcccall, 0);
        assert_1.default.strictEqual((0, sdcc_1.sdccTarget)('z80').sdcccall, 1);
    });
    (0, mocha_1.it)("selects SDCC for -sdcc.c on 6502 platforms, cc65 otherwise", function () {
        assert_1.default.strictEqual((0, toolselect_1.getToolForFilename_6502)('hello-sdcc.c'), 'sdcc');
        assert_1.default.strictEqual((0, toolselect_1.getToolForFilename_6502)('hello.c'), 'cc65');
    });
    (0, mocha_1.it)("selects SDCC for .sdcc files", function () {
        assert_1.default.strictEqual((0, toolselect_1.getToolForFilename_6502)('hello.sdcc'), 'sdcc');
        assert_1.default.strictEqual((0, toolselect_1.getToolForFilename_apple2)('hello.sdcc'), 'sdcc');
        assert_1.default.strictEqual((0, toolselect_1.getToolForFilename_z80)('skeleton.sdcc'), 'sdcc');
    });
    (0, mocha_1.it)("wraps linked images in a load header", function () {
        const img = Uint8Array.of(1, 2, 3, 4, 5);
        assert_1.default.deepStrictEqual(Array.from((0, sdcc_1.loadHeader)('dos33', img, 0x803, 3)), [3, 8, 3, 0, 1, 2, 3]);
        // load address, link pointer, line 10, SYS 2061, then the code
        assert_1.default.deepStrictEqual(Array.from((0, sdcc_1.loadHeader)('prg', img, 0x80d, 2)), [1, 8, 0x0b, 8, 10, 0, 0x9e, 0x32, 0x30, 0x36, 0x31, 0, 0, 0, 1, 2]);
        assert_1.default.throws(() => (0, sdcc_1.loadHeader)('prg', img, 0x900, 2), /\$80d/);
        assert_1.default.throws(() => (0, sdcc_1.loadHeader)('bogus', img, 0, 0), /unknown load_header/);
    });
});
//# sourceMappingURL=testsdcctarget.js.map