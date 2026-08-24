"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const testlib_1 = require("../../src/tools/testlib");
// The CLI picks the tool for every file of a build the way the IDE's platform
// objects do (the getToolForFilename members in src/platform/*.ts). It gets
// there from the platform's arch, so an arch the table doesn't name would send
// that platform's linked files to the fallback -- sdcc, for a z80 -- and the
// build would fail on the second file rather than the first.
(0, mocha_1.describe)('tool selection by platform', () => {
    (0, mocha_1.it)('should use the 6502 tools for the PC Engine', () => {
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('pcegfx.c', 'pce'), 'cc65');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('pcegfx_tia.s', 'pce'), 'ca65');
    });
    (0, mocha_1.it)('should use the ARM tools for arm32', () => {
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('serialout.c', 'arm32'), 'armtcc');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('boot.vasm', 'arm32'), 'vasmarm');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('boot.armips', 'arm32'), 'armips');
    });
    (0, mocha_1.it)('should use the tools of the other architectures', () => {
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('main.c', 'c64'), 'cc65');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('main.c', 'coleco'), 'sdcc');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('main.c', 'williams'), 'cmoc');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('main.c', 'x86'), 'smlrc');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('main.v', 'verilog'), 'verilator');
    });
});
//# sourceMappingURL=testtoolselect.js.map