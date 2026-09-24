import assert from "assert";
import { describe, it } from "mocha";
import { GameBoyMachine } from "../../src/machine/gb";

// CGB ROM that arms the speed switch (KEY1 = FF4D), executes STOP, then
// spins in a 3-M-cycle JR loop:
//   0100: 3E 01     LD A,$01
//   0102: E0 4D     LDH ($4D),A   ; arm speed switch
//   0104: 10 00     STOP 0
//   0106: 18 FE     JR -2
function makeCGBMachine(): GameBoyMachine {
  const rom = new Uint8Array(0x8000);
  rom[0x143] = 0x80; // CGB flag
  rom[0x147] = 0x00; // ROM only
  rom[0x100] = 0x3e; rom[0x101] = 0x01;
  rom[0x102] = 0xe0; rom[0x103] = 0x4d;
  rom[0x104] = 0x10; rom[0x105] = 0x00;
  rom[0x106] = 0x18; rom[0x107] = 0xfe;
  const m = new GameBoyMachine();
  m.loadROM(rom);
  m.connectVideo(new Uint32Array(160 * 144));
  m.cpu.PC = 0x0100;
  return m;
}

// Run the prologue so the CPU sits in the idle loop with the requested speed.
function makeLoopingMachine(doubleSpeed: boolean): GameBoyMachine {
  const m = makeCGBMachine();
  for (let i = 0; i < 3; i++) m.advanceCPU(); // LD, LDH, STOP
  assert.strictEqual(m.cpu.PC, 0x0106, "should be in the JR loop");
  m.doubleSpeed = doubleSpeed;
  return m;
}

describe('Game Boy CGB double speed', function () {

  it('arms and toggles speed on STOP', function () {
    const m = makeCGBMachine();
    assert.strictEqual(m.doubleSpeed, false);
    m.advanceCPU(); // LD A,$01
    m.advanceCPU(); // LDH ($4D),A
    assert.strictEqual(m.speedSwitchArmed, true);
    m.advanceCPU(); // STOP
    assert.strictEqual(m.doubleSpeed, true, "STOP should enter double speed");
    assert.strictEqual(m.speedSwitchArmed, false, "arm bit should clear");
    m.cpu.PC = 0x0106;
    m.write(0xFF4D, 0x01); // re-arm
    m.cpu.PC = 0x0104;     // STOP again
    m.advanceCPU();
    assert.strictEqual(m.doubleSpeed, false, "second STOP should return to normal");
  });

  it('does not switch without a preceding KEY1 write', function () {
    const m = makeCGBMachine();
    m.cpu.PC = 0x0104; // jump straight to STOP
    m.advanceCPU();
    assert.strictEqual(m.doubleSpeed, false);
  });

  it('halves the hardware T-cycles per instruction', function () {
    const normal = makeLoopingMachine(false);
    assert.strictEqual(normal.advanceCPU(), 12, "JR takes 3 M-cycles = 12 T-cycles");
    const fast = makeLoopingMachine(true);
    assert.strictEqual(fast.advanceCPU(), 6, "double speed halves hardware T-cycles");
  });

  it('fits roughly twice the instructions into a frame', function () {
    const normal = makeLoopingMachine(false);
    const fast = makeLoopingMachine(true);
    const normalSteps = normal.advanceFrame(null);
    const fastSteps = fast.advanceFrame(null);
    assert.ok(fastSteps > normalSteps * 1.9 && fastSteps < normalSteps * 2.1,
      `expected ~2x steps, got ${normalSteps} vs ${fastSteps}`);
  });

  it('keeps DIV/timer at hardware rate', function () {
    const run = (doubleSpeed: boolean) => {
      const m = makeLoopingMachine(doubleSpeed);
      m.tac = 0x05; // enable timer, 16 T-cycle period
      m.advanceFrame(null);
      return { div: m.divCounter, tima: m.tima };
    };
    const normal = run(false);
    const fast = run(true);
    // Same number of scanlines elapsed, so DIV should advance identically.
    assert.strictEqual(fast.div, normal.div, "DIV must run at hardware rate");
    assert.strictEqual(fast.tima, normal.tima, "TIMA must run at hardware rate");
  });
});