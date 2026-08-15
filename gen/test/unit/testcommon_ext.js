"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const gbpalette_1 = require("../../src/common/gbpalette");
const workertypes_1 = require("../../src/common/workertypes");
const probe_1 = require("../../src/common/probe");
(0, mocha_1.describe)('Game Boy Palette Functions', function () {
    (0, mocha_1.it)('rgbToPixel should convert RGB to packed pixel format', function () {
        const white = (0, gbpalette_1.rgbToPixel)(255, 255, 255);
        assert_1.default.strictEqual(white & 0xFFFFFF, 0xFFFFFF);
        assert_1.default.strictEqual((white >> 24) & 0xFF, 0xFF); // alpha
        const black = (0, gbpalette_1.rgbToPixel)(0, 0, 0);
        assert_1.default.strictEqual(black & 0xFFFFFF, 0x000000);
        const red = (0, gbpalette_1.rgbToPixel)(255, 0, 0);
        assert_1.default.strictEqual(red & 0xFF, 255); // red channel
        assert_1.default.strictEqual((red >> 8) & 0xFF, 0); // green channel
        assert_1.default.strictEqual((red >> 16) & 0xFF, 0); // blue channel
    });
    (0, mocha_1.it)('DMG_PALETTE should contain 4 shades', function () {
        assert_1.default.strictEqual(gbpalette_1.DMG_PALETTE.length, 4);
        // Should be in light to dark order
        assert_1.default.ok(gbpalette_1.DMG_PALETTE[0] > gbpalette_1.DMG_PALETTE[3]); // lightest > darkest numerically
    });
    (0, mocha_1.it)('DMG_PALETTE_RGB should match DMG_PALETTE', function () {
        assert_1.default.strictEqual(gbpalette_1.DMG_PALETTE_RGB.length, 4);
        for (let i = 0; i < 4; i++) {
            const [r, g, b] = gbpalette_1.DMG_PALETTE_RGB[i];
            const expected = (0, gbpalette_1.rgbToPixel)(r, g, b);
            assert_1.default.strictEqual(gbpalette_1.DMG_PALETTE[i], expected);
        }
    });
    (0, mocha_1.it)('DMG_PALETTE_RGB24 should be RGB values without alpha', function () {
        assert_1.default.strictEqual(gbpalette_1.DMG_PALETTE_RGB24.length, 4);
        assert_1.default.strictEqual(gbpalette_1.DMG_PALETTE_RGB24[0], 0xd0d884); // lightest
        assert_1.default.strictEqual(gbpalette_1.DMG_PALETTE_RGB24[3], 0x2d3122); // darkest
    });
    (0, mocha_1.it)('dmgShadeFromRgb should map greyscale to shade index', function () {
        // Very light colors should map to shade 0
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(255, 255, 255), 0);
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(200, 200, 200), 0);
        // Medium-light should be shade 1
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(128, 128, 128), 1);
        // Medium-dark should be shade 2
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(80, 80, 80), 2);
        // Very dark should be shade 3
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(0, 0, 0), 3);
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(30, 30, 30), 3);
    });
    (0, mocha_1.it)('dmgShadeFromRgb should work with non-greyscale colors', function () {
        // Red (255,0,0) avg=85 → 2
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(255, 0, 0), 2);
        // Red (128,0,0) avg≈43 → 3
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(128, 0, 0), 3);
        // Green (0,255,0) avg=85 → 2
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(0, 255, 0), 2);
        // Green (0,128,0) avg≈43 → 3
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(0, 128, 0), 3);
        // Blue (0,0,255) avg=85 → 2
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(0, 0, 255), 2);
        // Blue (0,0,128) avg≈43 → 3
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(0, 0, 128), 3);
    });
    (0, mocha_1.it)('dmgShadeFromRgb thresholds should be accurate', function () {
        // Test boundary at 192
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(192, 192, 192), 0);
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(191, 191, 191), 1);
        // Test boundary at 128
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(128, 128, 128), 1);
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(127, 127, 127), 2);
        // Test boundary at 64
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(64, 64, 64), 2);
        assert_1.default.strictEqual((0, gbpalette_1.dmgShadeFromRgb)(63, 63, 63), 3);
    });
});
(0, mocha_1.describe)('SourceFile Class', function () {
    (0, mocha_1.it)('should create SourceFile with lines and text', function () {
        const lines = [
            { line: 1, offset: 0, insns: 'LDA #$00' },
            { line: 2, offset: 2, insns: 'STA $80' },
            { line: 3, offset: 4, insns: 'RTS' },
        ];
        const text = 'LDA #$00\nSTA $80\nRTS\n';
        const sf = new workertypes_1.SourceFile(lines, text);
        assert_1.default.strictEqual(sf.lines.length, 3);
        assert_1.default.strictEqual(sf.text, text);
    });
    (0, mocha_1.it)('should build offset to line mapping', function () {
        const lines = [
            { line: 1, offset: 0, insns: 'LDA #$00' },
            { line: 2, offset: 2, insns: 'STA $80' },
            { line: 3, offset: 4, insns: 'RTS' },
        ];
        const sf = new workertypes_1.SourceFile(lines, '');
        assert_1.default.ok(sf.offset2loc[0]);
        assert_1.default.ok(sf.offset2loc[2]);
        assert_1.default.ok(sf.offset2loc[4]);
    });
    (0, mocha_1.it)('should build line to offset mapping', function () {
        const lines = [
            { line: 1, offset: 0 },
            { line: 2, offset: 2 },
            { line: 3, offset: 4 },
        ];
        const sf = new workertypes_1.SourceFile(lines, '');
        assert_1.default.strictEqual(sf.line2offset[1], 0);
        assert_1.default.strictEqual(sf.line2offset[2], 2);
        assert_1.default.strictEqual(sf.line2offset[3], 4);
    });
    (0, mocha_1.it)('should handle negative offsets gracefully', function () {
        const lines = [
            { line: 1, offset: -1 },
            { line: 2, offset: 0 },
            { line: 3, offset: 2 },
        ];
        const sf = new workertypes_1.SourceFile(lines, '');
        // Negative offsets should not be added to mapping
        assert_1.default.ok(!sf.offset2loc[-1]);
        assert_1.default.ok(sf.offset2loc[0]);
    });
    (0, mocha_1.it)('findLineForOffset should locate source line by address', function () {
        const lines = [
            { line: 1, offset: 0, insns: 'LDA #$00' },
            { line: 2, offset: 2, insns: 'STA $80' },
            { line: 3, offset: 4, insns: 'RTS' },
        ];
        const sf = new workertypes_1.SourceFile(lines, '');
        const line0 = sf.findLineForOffset(0, 0);
        assert_1.default.strictEqual(line0.line, 1);
        assert_1.default.strictEqual(line0.offset, 0);
        const line2 = sf.findLineForOffset(2, 0);
        assert_1.default.strictEqual(line2.line, 2);
        assert_1.default.strictEqual(line2.offset, 2);
    });
    (0, mocha_1.it)('findLineForOffset should look behind for nearest line', function () {
        const lines = [
            { line: 1, offset: 0, insns: 'LDA #$00' },
            { line: 2, offset: 2, insns: 'STA $80' },
            { line: 3, offset: 4, insns: 'RTS' },
        ];
        const sf = new workertypes_1.SourceFile(lines, '');
        // Looking for offset 3 with lookbehind=1 should find offset 2
        const line = sf.findLineForOffset(3, 1);
        assert_1.default.strictEqual(line.line, 2);
        assert_1.default.strictEqual(line.offset, 2);
    });
    (0, mocha_1.it)('findLineForOffset should return null if not found', function () {
        const lines = [
            { line: 1, offset: 0 },
            { line: 2, offset: 2 },
        ];
        const sf = new workertypes_1.SourceFile(lines, '');
        // Looking for offset 10 should not find anything
        const line = sf.findLineForOffset(10, 0);
        assert_1.default.strictEqual(line, null);
    });
    (0, mocha_1.it)('lineCount should return number of lines', function () {
        const lines = [
            { line: 1, offset: 0 },
            { line: 2, offset: 2 },
            { line: 3, offset: 4 },
        ];
        const sf = new workertypes_1.SourceFile(lines, '');
        assert_1.default.strictEqual(sf.lineCount(), 3);
    });
    (0, mocha_1.it)('should handle duplicate offsets (first wins)', function () {
        const lines = [
            { line: 1, offset: 0, insns: 'LDA #$00' },
            { line: 2, offset: 0, insns: 'STA $80' }, // Same offset
            { line: 3, offset: 2, insns: 'RTS' },
        ];
        const sf = new workertypes_1.SourceFile(lines, '');
        // First line at offset 0 should be returned
        const line = sf.findLineForOffset(0, 0);
        assert_1.default.strictEqual(line.line, 1);
    });
});
(0, mocha_1.describe)('ProbeRecorder Class', function () {
    class MockMachine {
        connectProbe(probe) {
            this.probe = probe;
        }
    }
    (0, mocha_1.it)('should create ProbeRecorder with buffer', function () {
        const machine = new MockMachine();
        const pr = new probe_1.ProbeRecorder(machine, 1024);
        assert_1.default.ok(pr.buf);
        assert_1.default.strictEqual(pr.buf.length, 1024);
        assert_1.default.strictEqual(pr.idx, 0);
    });
    (0, mocha_1.it)('should log data to buffer', function () {
        const machine = new MockMachine();
        const pr = new probe_1.ProbeRecorder(machine, 100);
        pr.log(0x12000080); // MEM_READ at address 0x80
        assert_1.default.strictEqual(pr.idx, 1);
        assert_1.default.strictEqual(pr.buf[0], 0x12000080);
        pr.log(0x13000081); // MEM_WRITE at address 0x81
        assert_1.default.strictEqual(pr.idx, 2);
        assert_1.default.strictEqual(pr.buf[1], 0x13000081);
    });
    (0, mocha_1.it)('should not exceed buffer length', function () {
        const machine = new MockMachine();
        const pr = new probe_1.ProbeRecorder(machine, 2);
        pr.log(0x12000080);
        pr.log(0x13000081);
        pr.log(0x14000082); // Should not write (buffer full)
        assert_1.default.strictEqual(pr.idx, 2);
        assert_1.default.strictEqual(pr.buf[0], 0x12000080);
        assert_1.default.strictEqual(pr.buf[1], 0x13000081);
    });
    (0, mocha_1.it)('should retrieve last operation', function () {
        const machine = new MockMachine();
        const pr = new probe_1.ProbeRecorder(machine, 100);
        pr.log(0x12000080);
        pr.log(0x13000081);
        const lastOp = pr.lastOp();
        assert_1.default.strictEqual(lastOp, 0x13000000); // MEM_WRITE flag
    });
    (0, mocha_1.it)('should retrieve last address', function () {
        const machine = new MockMachine();
        const pr = new probe_1.ProbeRecorder(machine, 100);
        pr.log(0x12000080);
        pr.log(0x13AABBCC);
        const lastAddr = pr.lastAddr();
        assert_1.default.strictEqual(lastAddr, 0xAABBCC);
    });
    (0, mocha_1.it)('should return -1 for lastOp on empty buffer', function () {
        const machine = new MockMachine();
        const pr = new probe_1.ProbeRecorder(machine, 100);
        const lastOp = pr.lastOp();
        assert_1.default.strictEqual(lastOp, -1);
    });
    (0, mocha_1.it)('should clear buffer', function () {
        const machine = new MockMachine();
        const pr = new probe_1.ProbeRecorder(machine, 100);
        pr.log(0x12000080);
        pr.log(0x13000081);
        assert_1.default.strictEqual(pr.idx, 2);
        pr.clear();
        assert_1.default.strictEqual(pr.idx, 0);
    });
    (0, mocha_1.it)('should reset buffer', function () {
        const machine = new MockMachine();
        const pr = new probe_1.ProbeRecorder(machine, 100);
        pr.log(0x12000080);
        assert_1.default.strictEqual(pr.buf.length, 100);
        pr.reset(200);
        assert_1.default.strictEqual(pr.buf.length, 200);
        assert_1.default.strictEqual(pr.idx, 0);
    });
    (0, mocha_1.it)('should relog last entry', function () {
        const machine = new MockMachine();
        const pr = new probe_1.ProbeRecorder(machine, 100);
        pr.log(0x12000080);
        pr.relog(0x13000080);
        assert_1.default.strictEqual(pr.idx, 1);
        assert_1.default.strictEqual(pr.buf[0], 0x13000080);
    });
    (0, mocha_1.it)('should track scanline', function () {
        const machine = new MockMachine();
        const pr = new probe_1.ProbeRecorder(machine, 100);
        assert_1.default.strictEqual(pr.sl, 0);
        pr.sl = 100;
        assert_1.default.strictEqual(pr.sl, 100);
    });
    (0, mocha_1.it)('should track stack pointer', function () {
        const machine = new MockMachine();
        const pr = new probe_1.ProbeRecorder(machine, 100);
        assert_1.default.strictEqual(pr.cur_sp, -1);
        pr.cur_sp = 0xFF;
        assert_1.default.strictEqual(pr.cur_sp, 0xFF);
    });
});
(0, mocha_1.describe)('ProbeFlags Enumeration', function () {
    (0, mocha_1.it)('should have correct flag values', function () {
        assert_1.default.strictEqual(probe_1.ProbeFlags.CLOCKS, 0x00000000);
        assert_1.default.strictEqual(probe_1.ProbeFlags.EXECUTE, 0x01000000);
        assert_1.default.strictEqual(probe_1.ProbeFlags.INTERRUPT, 0x08000000);
        assert_1.default.strictEqual(probe_1.ProbeFlags.MEM_READ, 0x12000000);
        assert_1.default.strictEqual(probe_1.ProbeFlags.MEM_WRITE, 0x13000000);
        assert_1.default.strictEqual(probe_1.ProbeFlags.FRAME, 0x7f000000);
    });
    (0, mocha_1.it)('should extract operation from probe value', function () {
        const probeValue = 0x12000080;
        const opcode = probeValue & 0xFF000000;
        assert_1.default.strictEqual(opcode, probe_1.ProbeFlags.MEM_READ);
        const address = probeValue & 0xFFFFFF;
        assert_1.default.strictEqual(address, 0x80);
    });
});
//# sourceMappingURL=testcommon_ext.js.map