import assert from "assert";
import { describe, it } from "mocha";
import { sdccTarget, loadHeader } from "../../src/worker/tools/sdcc";
import { getToolForFilename_6502, getToolForFilename_z80, getToolForFilename_apple2 } from "../../src/common/toolselect";

describe("sdcc targets", function () {

  it("maps the platform arch to an SDCC port", function () {
    assert.deepStrictEqual(
      ['z80', 'gbz80', '6502', undefined].map((a) => sdccTarget(a).mflag),
      ['-mz80', '-mgbz80', '-mmos6502', '-mz80']);
    assert.strictEqual(sdccTarget('6502').as, 'sdas6500');
    assert.strictEqual(sdccTarget('gbz80').as, 'sdasgb');
  });

  it("only the mos6502 port is SDCC 4 only, and uses sdcccall(0)", function () {
    assert.ok(sdccTarget('6502').only4);
    assert.ok(!sdccTarget('z80').only4);
    assert.strictEqual(sdccTarget('6502').sdcccall, 0);
    assert.strictEqual(sdccTarget('z80').sdcccall, 1);
  });

  it("selects SDCC for -sdcc.c on 6502 platforms, cc65 otherwise", function () {
    assert.strictEqual(getToolForFilename_6502('hello-sdcc.c'), 'sdcc');
    assert.strictEqual(getToolForFilename_6502('hello.c'), 'cc65');
  });

  it("selects SDCC for .sdcc files", function () {
    assert.strictEqual(getToolForFilename_6502('hello.sdcc'), 'sdcc');
    assert.strictEqual(getToolForFilename_apple2('hello.sdcc'), 'sdcc');
    assert.strictEqual(getToolForFilename_z80('skeleton.sdcc'), 'sdcc');
  });


  it("wraps linked images in a load header", function () {
    const img = Uint8Array.of(1, 2, 3, 4, 5);
    assert.deepStrictEqual(Array.from(loadHeader('dos33', img, 0x803, 3)), [3, 8, 3, 0, 1, 2, 3]);
    // load address, link pointer, line 10, SYS 2061, then the code
    assert.deepStrictEqual(Array.from(loadHeader('prg', img, 0x80d, 2)),
      [1, 8, 0x0b, 8, 10, 0, 0x9e, 0x32, 0x30, 0x36, 0x31, 0, 0, 0, 1, 2]);
    assert.throws(() => loadHeader('prg', img, 0x900, 2), /\$80d/);
    assert.throws(() => loadHeader('bogus', img, 0, 0), /unknown load_header/);
  });
});
