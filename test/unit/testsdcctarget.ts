import assert from "assert";
import { describe, it } from "mocha";
import { sdccTarget } from "../../src/worker/tools/sdcc";
import { getToolForFilename_6502 } from "../../src/common/toolselect";

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

});
