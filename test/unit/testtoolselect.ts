import assert from "assert";
import { describe, it } from "mocha";
import { getToolForFilename } from "../../src/tools/testlib";

// The CLI picks the tool for every file of a build the way the IDE's platform
// objects do (the getToolForFilename members in src/platform/*.ts). It gets
// there from the platform's arch, so an arch the table doesn't name would send
// that platform's linked files to the fallback -- sdcc, for a z80 -- and the
// build would fail on the second file rather than the first.
describe('tool selection by platform', () => {
    it('should use the 6502 tools for the PC Engine', () => {
        assert.strictEqual(getToolForFilename('pcegfx.c', 'pce'), 'cc65');
        assert.strictEqual(getToolForFilename('pcegfx_tia.s', 'pce'), 'ca65');
    });
    it('should use the ARM tools for arm32', () => {
        assert.strictEqual(getToolForFilename('serialout.c', 'arm32'), 'armtcc');
        assert.strictEqual(getToolForFilename('boot.vasm', 'arm32'), 'vasmarm');
        assert.strictEqual(getToolForFilename('boot.armips', 'arm32'), 'armips');
    });
    it('should use the tools of the other architectures', () => {
        assert.strictEqual(getToolForFilename('main.c', 'c64'), 'cc65');
        assert.strictEqual(getToolForFilename('main.c', 'coleco'), 'sdcc');
        assert.strictEqual(getToolForFilename('main.c', 'williams'), 'cmoc');
        assert.strictEqual(getToolForFilename('main.c', 'x86'), 'smlrc');
        assert.strictEqual(getToolForFilename('main.v', 'verilog'), 'verilator');
    });
});
