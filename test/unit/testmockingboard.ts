import assert from "assert";
import { describe, it } from "mocha";
import { mockAudio, mockGlobals } from "../../src/tools/nodemock";

mockGlobals();
mockAudio();

// imported after the browser globals are mocked (the machine pulls in the TSS
// audio channel objects)
import { AppleII } from "../../src/machine/apple2";

// Poke one AY register the way Mockingboard software has to: put the register
// number on VIA port A, pulse BC1/BDIR on port B (bit 2 = /RESET stays high)
// to latch it, then put the data on port A and pulse again to write it.
function ayWrite(m: AppleII, base: number, reg: number, val: number) {
  m.write(base, 0x04);      // inactive, /RESET high
  m.write(base + 1, reg);   // port A = register number
  m.write(base, 0x07);      // BC1=1, BDIR=1 -> latch address
  m.write(base, 0x04);      // inactive
  m.write(base + 1, val);   // port A = data
  m.write(base, 0x06);      // BC1=0, BDIR=1 -> write data
  m.write(base, 0x04);      // inactive
}

function newMachine() {
  const m = new AppleII();
  m.connectVideo(new Uint32Array(m.canvasWidth * m.numVisibleScanlines));
  return m;
}

describe('Apple II Mockingboard', function () {
  it('clocks the AYs at the CPU rate (TSS wants twice the chip clock)', function () {
    const m = newMachine();
    for (const unit of m.mb.units)
      assert.strictEqual((unit.ay.psg as any).clock, m.cpuFrequency * 2);
  });
  it('programs the first AY through the slot 4 VIA', function () {
    const m = newMachine();
    ayWrite(m, 0xC400, 0, 145);   // channel A period low
    ayWrite(m, 0xC400, 1, 0);     // channel A period high
    ayWrite(m, 0xC400, 7, 0x3e);  // enable tone A only
    ayWrite(m, 0xC400, 8, 15);    // channel A volume
    assert.deepStrictEqual(Array.from(m.mb.units[0].ay.psg.register).slice(0, 9),
      [145, 0, 0, 0, 0, 0, 0, 0x3e, 15]);
  });

  it('programs the second AY at $C480 independently', function () {
    const m = newMachine();
    ayWrite(m, 0xC480, 6, 0x18);  // noise period
    ayWrite(m, 0xC480, 7, 0x37);  // noise A only
    ayWrite(m, 0xC480, 8, 15);    // channel A volume
    // the first chip is untouched
    assert.deepStrictEqual(Array.from(m.mb.units[0].ay.psg.register),
      new Array(16).fill(0));
    assert.deepStrictEqual(Array.from(m.mb.units[1].ay.psg.register).slice(0, 9),
      [0, 0, 0, 0, 0, 0, 0x18, 0x37, 15]);
  });

  it('saves and restores both AY register files', function () {
    const m = newMachine();
    ayWrite(m, 0xC400, 8, 12);
    ayWrite(m, 0xC480, 8, 9);
    const state = m.saveState();
    ayWrite(m, 0xC400, 8, 0);
    ayWrite(m, 0xC480, 8, 0);
    m.loadState(state);
    assert.equal(m.mb.units[0].ay.psg.register[8], 12);
    assert.equal(m.mb.units[1].ay.psg.register[8], 9);
  });
});
