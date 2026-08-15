
import assert from "assert";
import { describe, it } from "mocha";
import {
  rgbToPixel, DMG_PALETTE, DMG_PALETTE_RGB, DMG_PALETTE_RGB24, dmgShadeFromRgb
} from "../../src/common/gbpalette";
import { SourceFile } from "../../src/common/workertypes";
import { ProbeRecorder, ProbeFlags } from "../../src/common/probe";

describe('Game Boy Palette Functions', function () {
  it('rgbToPixel should convert RGB to packed pixel format', function () {
    const white = rgbToPixel(255, 255, 255);
    assert.strictEqual(white & 0xFFFFFF, 0xFFFFFF);
    assert.strictEqual((white >> 24) & 0xFF, 0xFF); // alpha

    const black = rgbToPixel(0, 0, 0);
    assert.strictEqual(black & 0xFFFFFF, 0x000000);

    const red = rgbToPixel(255, 0, 0);
    assert.strictEqual(red & 0xFF, 255); // red channel
    assert.strictEqual((red >> 8) & 0xFF, 0); // green channel
    assert.strictEqual((red >> 16) & 0xFF, 0); // blue channel
  });

  it('DMG_PALETTE should contain 4 shades', function () {
    assert.strictEqual(DMG_PALETTE.length, 4);
    // Should be in light to dark order
    assert.ok(DMG_PALETTE[0] > DMG_PALETTE[3]); // lightest > darkest numerically
  });

  it('DMG_PALETTE_RGB should match DMG_PALETTE', function () {
    assert.strictEqual(DMG_PALETTE_RGB.length, 4);
    for (let i = 0; i < 4; i++) {
      const [r, g, b] = DMG_PALETTE_RGB[i];
      const expected = rgbToPixel(r, g, b);
      assert.strictEqual(DMG_PALETTE[i], expected);
    }
  });

  it('DMG_PALETTE_RGB24 should be RGB values without alpha', function () {
    assert.strictEqual(DMG_PALETTE_RGB24.length, 4);
    assert.strictEqual(DMG_PALETTE_RGB24[0], 0xd0d884); // lightest
    assert.strictEqual(DMG_PALETTE_RGB24[3], 0x2d3122); // darkest
  });

  it('dmgShadeFromRgb should map greyscale to shade index', function () {
    // Very light colors should map to shade 0
    assert.strictEqual(dmgShadeFromRgb(255, 255, 255), 0);
    assert.strictEqual(dmgShadeFromRgb(200, 200, 200), 0);

    // Medium-light should be shade 1
    assert.strictEqual(dmgShadeFromRgb(128, 128, 128), 1);

    // Medium-dark should be shade 2
    assert.strictEqual(dmgShadeFromRgb(80, 80, 80), 2);

    // Very dark should be shade 3
    assert.strictEqual(dmgShadeFromRgb(0, 0, 0), 3);
    assert.strictEqual(dmgShadeFromRgb(30, 30, 30), 3);
  });

  it('dmgShadeFromRgb should work with non-greyscale colors', function () {
    // Red (255,0,0) avg=85 → 2
    assert.strictEqual(dmgShadeFromRgb(255, 0, 0), 2);
    // Red (128,0,0) avg≈43 → 3
    assert.strictEqual(dmgShadeFromRgb(128, 0, 0), 3);

    // Green (0,255,0) avg=85 → 2
    assert.strictEqual(dmgShadeFromRgb(0, 255, 0), 2);
    // Green (0,128,0) avg≈43 → 3
    assert.strictEqual(dmgShadeFromRgb(0, 128, 0), 3);

    // Blue (0,0,255) avg=85 → 2
    assert.strictEqual(dmgShadeFromRgb(0, 0, 255), 2);
    // Blue (0,0,128) avg≈43 → 3
    assert.strictEqual(dmgShadeFromRgb(0, 0, 128), 3);
  });

  it('dmgShadeFromRgb thresholds should be accurate', function () {
    // Test boundary at 192
    assert.strictEqual(dmgShadeFromRgb(192, 192, 192), 0);
    assert.strictEqual(dmgShadeFromRgb(191, 191, 191), 1);

    // Test boundary at 128
    assert.strictEqual(dmgShadeFromRgb(128, 128, 128), 1);
    assert.strictEqual(dmgShadeFromRgb(127, 127, 127), 2);

    // Test boundary at 64
    assert.strictEqual(dmgShadeFromRgb(64, 64, 64), 2);
    assert.strictEqual(dmgShadeFromRgb(63, 63, 63), 3);
  });
});

describe('SourceFile Class', function () {
  it('should create SourceFile with lines and text', function () {
    const lines = [
      { line: 1, offset: 0, insns: 'LDA #$00' },
      { line: 2, offset: 2, insns: 'STA $80' },
      { line: 3, offset: 4, insns: 'RTS' },
    ];
    const text = 'LDA #$00\nSTA $80\nRTS\n';
    const sf = new SourceFile(lines, text);

    assert.strictEqual(sf.lines.length, 3);
    assert.strictEqual(sf.text, text);
  });

  it('should build offset to line mapping', function () {
    const lines = [
      { line: 1, offset: 0, insns: 'LDA #$00' },
      { line: 2, offset: 2, insns: 'STA $80' },
      { line: 3, offset: 4, insns: 'RTS' },
    ];
    const sf = new SourceFile(lines, '');

    assert.ok(sf.offset2loc[0]);
    assert.ok(sf.offset2loc[2]);
    assert.ok(sf.offset2loc[4]);
  });

  it('should build line to offset mapping', function () {
    const lines = [
      { line: 1, offset: 0 },
      { line: 2, offset: 2 },
      { line: 3, offset: 4 },
    ];
    const sf = new SourceFile(lines, '');

    assert.strictEqual(sf.line2offset[1], 0);
    assert.strictEqual(sf.line2offset[2], 2);
    assert.strictEqual(sf.line2offset[3], 4);
  });

  it('should handle negative offsets gracefully', function () {
    const lines = [
      { line: 1, offset: -1 },
      { line: 2, offset: 0 },
      { line: 3, offset: 2 },
    ];
    const sf = new SourceFile(lines, '');

    // Negative offsets should not be added to mapping
    assert.ok(!sf.offset2loc[-1]);
    assert.ok(sf.offset2loc[0]);
  });

  it('findLineForOffset should locate source line by address', function () {
    const lines = [
      { line: 1, offset: 0, insns: 'LDA #$00' },
      { line: 2, offset: 2, insns: 'STA $80' },
      { line: 3, offset: 4, insns: 'RTS' },
    ];
    const sf = new SourceFile(lines, '');

    const line0 = sf.findLineForOffset(0, 0);
    assert.strictEqual(line0.line, 1);
    assert.strictEqual(line0.offset, 0);

    const line2 = sf.findLineForOffset(2, 0);
    assert.strictEqual(line2.line, 2);
    assert.strictEqual(line2.offset, 2);
  });

  it('findLineForOffset should look behind for nearest line', function () {
    const lines = [
      { line: 1, offset: 0, insns: 'LDA #$00' },
      { line: 2, offset: 2, insns: 'STA $80' },
      { line: 3, offset: 4, insns: 'RTS' },
    ];
    const sf = new SourceFile(lines, '');

    // Looking for offset 3 with lookbehind=1 should find offset 2
    const line = sf.findLineForOffset(3, 1);
    assert.strictEqual(line.line, 2);
    assert.strictEqual(line.offset, 2);
  });

  it('findLineForOffset should return null if not found', function () {
    const lines = [
      { line: 1, offset: 0 },
      { line: 2, offset: 2 },
    ];
    const sf = new SourceFile(lines, '');

    // Looking for offset 10 should not find anything
    const line = sf.findLineForOffset(10, 0);
    assert.strictEqual(line, null);
  });

  it('lineCount should return number of lines', function () {
    const lines = [
      { line: 1, offset: 0 },
      { line: 2, offset: 2 },
      { line: 3, offset: 4 },
    ];
    const sf = new SourceFile(lines, '');

    assert.strictEqual(sf.lineCount(), 3);
  });

  it('should handle duplicate offsets (first wins)', function () {
    const lines = [
      { line: 1, offset: 0, insns: 'LDA #$00' },
      { line: 2, offset: 0, insns: 'STA $80' }, // Same offset
      { line: 3, offset: 2, insns: 'RTS' },
    ];
    const sf = new SourceFile(lines, '');

    // First line at offset 0 should be returned
    const line = sf.findLineForOffset(0, 0);
    assert.strictEqual(line.line, 1);
  });
});

describe('ProbeRecorder Class', function () {
  class MockMachine {
    probe: any;
    connectProbe(probe) {
      this.probe = probe;
    }
  }

  it('should create ProbeRecorder with buffer', function () {
    const machine = new MockMachine();
    const pr = new ProbeRecorder(machine, 1024);

    assert.ok(pr.buf);
    assert.strictEqual(pr.buf.length, 1024);
    assert.strictEqual(pr.idx, 0);
  });

  it('should log data to buffer', function () {
    const machine = new MockMachine();
    const pr = new ProbeRecorder(machine, 100);

    pr.log(0x12000080); // MEM_READ at address 0x80
    assert.strictEqual(pr.idx, 1);
    assert.strictEqual(pr.buf[0], 0x12000080);

    pr.log(0x13000081); // MEM_WRITE at address 0x81
    assert.strictEqual(pr.idx, 2);
    assert.strictEqual(pr.buf[1], 0x13000081);
  });

  it('should not exceed buffer length', function () {
    const machine = new MockMachine();
    const pr = new ProbeRecorder(machine, 2);

    pr.log(0x12000080);
    pr.log(0x13000081);
    pr.log(0x14000082); // Should not write (buffer full)

    assert.strictEqual(pr.idx, 2);
    assert.strictEqual(pr.buf[0], 0x12000080);
    assert.strictEqual(pr.buf[1], 0x13000081);
  });

  it('should retrieve last operation', function () {
    const machine = new MockMachine();
    const pr = new ProbeRecorder(machine, 100);

    pr.log(0x12000080);
    pr.log(0x13000081);

    const lastOp = pr.lastOp();
    assert.strictEqual(lastOp, 0x13000000); // MEM_WRITE flag
  });

  it('should retrieve last address', function () {
    const machine = new MockMachine();
    const pr = new ProbeRecorder(machine, 100);

    pr.log(0x12000080);
    pr.log(0x13AABBCC);

    const lastAddr = pr.lastAddr();
    assert.strictEqual(lastAddr, 0xAABBCC);
  });

  it('should return -1 for lastOp on empty buffer', function () {
    const machine = new MockMachine();
    const pr = new ProbeRecorder(machine, 100);

    const lastOp = pr.lastOp();
    assert.strictEqual(lastOp, -1);
  });

  it('should clear buffer', function () {
    const machine = new MockMachine();
    const pr = new ProbeRecorder(machine, 100);

    pr.log(0x12000080);
    pr.log(0x13000081);
    assert.strictEqual(pr.idx, 2);

    pr.clear();
    assert.strictEqual(pr.idx, 0);
  });

  it('should reset buffer', function () {
    const machine = new MockMachine();
    const pr = new ProbeRecorder(machine, 100);

    pr.log(0x12000080);
    assert.strictEqual(pr.buf.length, 100);

    pr.reset(200);
    assert.strictEqual(pr.buf.length, 200);
    assert.strictEqual(pr.idx, 0);
  });

  it('should relog last entry', function () {
    const machine = new MockMachine();
    const pr = new ProbeRecorder(machine, 100);

    pr.log(0x12000080);
    pr.relog(0x13000080);

    assert.strictEqual(pr.idx, 1);
    assert.strictEqual(pr.buf[0], 0x13000080);
  });

  it('should track scanline', function () {
    const machine = new MockMachine();
    const pr = new ProbeRecorder(machine, 100);

    assert.strictEqual(pr.sl, 0);
    pr.sl = 100;
    assert.strictEqual(pr.sl, 100);
  });

  it('should track stack pointer', function () {
    const machine = new MockMachine();
    const pr = new ProbeRecorder(machine, 100);

    assert.strictEqual(pr.cur_sp, -1);
    pr.cur_sp = 0xFF;
    assert.strictEqual(pr.cur_sp, 0xFF);
  });
});

describe('ProbeFlags Enumeration', function () {
  it('should have correct flag values', function () {
    assert.strictEqual(ProbeFlags.CLOCKS, 0x00000000);
    assert.strictEqual(ProbeFlags.EXECUTE, 0x01000000);
    assert.strictEqual(ProbeFlags.INTERRUPT, 0x08000000);
    assert.strictEqual(ProbeFlags.MEM_READ, 0x12000000);
    assert.strictEqual(ProbeFlags.MEM_WRITE, 0x13000000);
    assert.strictEqual(ProbeFlags.FRAME, 0x7f000000);
  });

  it('should extract operation from probe value', function () {
    const probeValue = 0x12000080;
    const opcode = probeValue & 0xFF000000;
    assert.strictEqual(opcode, ProbeFlags.MEM_READ);

    const address = probeValue & 0xFFFFFF;
    assert.strictEqual(address, 0x80);
  });
});

