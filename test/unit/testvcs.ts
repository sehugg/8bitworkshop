import assert from "assert";
import fs from "fs";
import { describe, it } from "mocha";
import { mockAudio, mockGlobals } from "../../src/tools/nodemock";

mockGlobals();
mockAudio();

// imported after the globals are mocked -- the machine pulls in the Javatari
// core, which reaches for window/navigator/document at run time
import { JavatariMachine } from "../../src/machine/vcs";
import { EmuHalt, KeyFlags, Keys } from "../../src/common/emu";
import { hashState } from "../../src/common/statehash";
import { NullProbe } from "../../src/common/devices";
import { History } from "../../src/common/history";
import {
  formatTimestamp,
  MachineCore,
  timestamp,
  timestampsEqual,
} from "../../src/common/timeline";

// The VCS machine runs the Javatari TIA frame loop with a trap before every
// CPU clock, so a step is one clock. This pins the same guarantees
// testtimelinemachine.ts pins for the BasicScanline machines: exact replay
// from a snapshot, exact sub-frame seeking, and a KIL that parks where it
// happened.

const ROM = './test/roms/vcs/brickgame.rom';

/** Counts what the machine hands the probe, so a run can be checked for shape. */
class CountingProbe extends NullProbe {
  frames = 0;
  scanlines = 0;
  clocks = 0;
  executes = 0;
  waits = 0;
  ioWrites = 0;
  pcs = new Set<number>();
  logNewFrame() { this.frames++; }
  logNewScanline() { this.scanlines++; }
  logClocks(n?: number) { this.clocks += n || 0; }
  logExecute(pc?: number) { this.executes++; this.pcs.add(pc); }
  logWait() { this.waits++; }
  logIOWrite() { this.ioWrites++; }
}

function newCore() {
  const m = new JavatariMachine();
  m.connectVideo(new Uint32Array(m.getVideoParams().width * m.getVideoParams().height));
  m.loadROM(new Uint8Array(fs.readFileSync(ROM)));
  m.reset();
  return { m, core: new MachineCore(m, 'clock') };
}

describe('JavatariMachine (VCS)', function () {
  this.timeout(60000);

  it('detects the cartridge format and runs a frame', function () {
    const { m, core } = newCore();
    assert.strictEqual(m.getCartridgeFormat(), '4K');
    const r = core.runUntil(timestamp(1, 0));
    assert.ok(timestampsEqual(r.at, timestamp(1, 0)), formatTimestamp(r.at));
    assert.ok(timestampsEqual(core.now(), timestamp(1, 0)));
  });

  it('replays to the identical state from a snapshot 20 frames back', function () {
    const { m, core } = newCore();
    core.runUntil(timestamp(20, 0), () => false);
    const snap = core.snapshot();
    core.runUntil(timestamp(40, 0), () => false);
    const expected = hashState(m.saveState());
    const pc = m.cpu.getPC();

    core.restore(snap, timestamp(20, 0));
    const r = core.runUntil(timestamp(40, 0), () => false);
    assert.ok(timestampsEqual(r.at, timestamp(40, 0)), formatTimestamp(r.at));
    assert.strictEqual(m.cpu.getPC(), pc);
    assert.strictEqual(hashState(m.saveState()), expected);
  });

  it('reaches a sub-frame position identically forwards and backwards', function () {
    // where the machine should be at 12:250, reached only by running forward
    const fwd = newCore();
    fwd.core.runUntil(timestamp(12, 250), () => false);
    const expected = hashState(fwd.m.saveState());

    // now overshoot, rewind to the frame boundary, and come back
    const { m, core } = newCore();
    core.runUntil(timestamp(12, 0), () => false);
    const snap = core.snapshot();
    core.runUntil(timestamp(12, 900), () => false);
    assert.notStrictEqual(hashState(m.saveState()), expected);
    core.restore(snap, timestamp(12, 0));
    core.runUntil(timestamp(12, 250), () => false);
    assert.strictEqual(hashState(m.saveState()), expected);
  });

  it('traps on a condition several frames ahead and reports where', function () {
    const { m, core } = newCore();
    core.runUntil(timestamp(5, 0), () => false);
    const snap5 = core.snapshot();
    // find some PC the ROM reaches later, whatever it is
    const seen = new Set<number>();
    core.runUntil(timestamp(6, 0), () => { seen.add(m.cpu.getPC()); return false; });
    core.restore(snap5, timestamp(5, 0));
    const targetPC = [...seen][Math.floor(seen.size / 2)];

    const r = core.runUntil(timestamp(30, 0), () => m.cpu.getPC() === targetPC);
    assert.strictEqual(r.trapped, true);
    assert.strictEqual(m.cpu.getPC(), targetPC);

    // the same search from the same snapshot must land on the same instant
    const hit = r.at;
    const expected = hashState(m.saveState());
    core.restore(snap5, timestamp(5, 0));
    const r2 = core.runUntil(timestamp(30, 0), () => m.cpu.getPC() === targetPC);
    assert.ok(timestampsEqual(r2.at, hit), `${formatTimestamp(r2.at)} != ${formatTimestamp(hit)}`);
    assert.strictEqual(hashState(m.saveState()), expected);
  });

  it('runs a hundred frames in a sane amount of time', function () {
    const { core } = newCore();
    const t0 = Date.now();
    core.runUntil(timestamp(100, 0), () => false);
    const ms = Date.now() - t0;
    // the smoke test measured about 1ms per frame; this is a wide bound so a
    // slow CI machine passes but a pathological slowdown fails
    assert.ok(ms < 5000, `100 frames took ${ms}ms`);
  });

  it('leaves the machine alone when asked what memory holds', function () {
    // read() drives the real bus, so it latches the open-bus register the way
    // the hardware does; readConst() is what the disassembler and the debugger
    // use, and it must not move the machine or a replay stops matching
    const { m, core } = newCore();
    core.runUntil(timestamp(5, 0), () => false);
    const before = hashState(m.saveState());
    m.readConst(0x80);
    m.readConst(0xfffc);
    m.readConst(0x0280);
    m.readConst(0x00);
    assert.strictEqual(hashState(m.saveState()), before);

    m.read(0x80);
    assert.notStrictEqual(hashState(m.saveState()), before, 'read() should latch the bus');
  });

  it('logs through the probe without perturbing the run', function () {
    const plain = newCore();
    plain.core.runUntil(timestamp(3, 0), () => false);
    const expected = hashState(plain.m.saveState());

    const { m, core } = newCore();
    const probe = new CountingProbe();
    m.connectProbe(probe);
    assert.strictEqual(m.probing, true);
    core.runUntil(timestamp(3, 0), () => false);
    // probing must not change what the machine does, or a recorded run and the
    // replay of it would not agree
    assert.strictEqual(hashState(m.saveState()), expected);
    assert.strictEqual(probe.frames, 3);
    assert.ok(probe.scanlines > 700, `only ${probe.scanlines} scanlines`);
    assert.ok(probe.executes > 1000, `only ${probe.executes} instructions`);
    // 76 CPU clocks a line, a little over 260 lines a frame
    assert.ok(probe.clocks > 50000, `only ${probe.clocks} clocks`);
    assert.ok(probe.waits > 0, 'no WSYNC wait was logged');
    assert.ok(probe.ioWrites > 0, 'no TIA writes were logged');
    // the PCs a probe sees are the ones the CPU is really at
    assert.ok([...probe.pcs].every(pc => pc >= 0 && pc < 0x10000));

    // and the bus is un-wrapped again once the probe is dropped
    m.connectProbe(null);
    assert.strictEqual(m.probing, false);
    m.connectProbe(probe);
    assert.strictEqual(m.probing, true);
  });

  it('delivers keys to the joysticks and the console switches', function () {
    const { m, core } = newCore();
    const idle = hashState(m.saveState());
    // joystick 1 is the arrows
    m.setKeyInput(Keys.UP.c, 0, KeyFlags.KeyDown);
    assert.notStrictEqual(hashState(m.saveState()), idle, 'the stick did not move');
    m.setKeyInput(Keys.UP.c, 0, KeyFlags.KeyUp);
    assert.strictEqual(hashState(m.saveState()), idle, 'the stick did not come back');

    // a key the machine has no use for must not touch it
    m.setKeyInput(Keys.VK_F7.c, 0, KeyFlags.KeyDown);
    assert.strictEqual(hashState(m.saveState()), idle);

    // the difficulty switches live in the PIA port the program reads
    m.setKeyInput(Keys.VK_F4.c, 0, KeyFlags.KeyDown);
    assert.notStrictEqual(hashState(m.saveState()), idle);
    core.runUntil(timestamp(1, 0), () => false);
  });
});

describe('History on a VCS machine', function () {
  this.timeout(60000);

  it('replays a recorded run back to the same present', function () {
    const { m, core } = newCore();
    const hist = new History(core, { checkpointInterval: 5 });
    for (var i = 0; i < 40; i++) hist.recordFrame();
    const present = hashState(m.saveState());

    hist.seek(timestamp(3, 200));
    assert.notStrictEqual(hashState(m.saveState()), present);
    hist.seek(hist.last());
    assert.strictEqual(hashState(m.saveState()), present);
  });

  it('steps back to an instruction inside a frame', function () {
    const { m, core } = newCore();
    const hist = new History(core, { checkpointInterval: 4 });
    for (var i = 0; i < 6; i++) hist.recordFrame();
    const present = hist.last();

    // the last stable instruction before the frame-4 boundary
    const hit = hist.findLast(() => m.cpu.isStable(), hist.first(), timestamp(4, 0));
    assert.ok(hit, 'no stable instruction found');
    assert.ok(timestampsEqual(core.now(), hit), formatTimestamp(core.now()));
    assert.ok(m.cpu.isStable());
    const hitState = hashState(m.saveState());
    const hitPC = m.cpu.getPC();

    // seek away and back: the instruction must come back exactly
    hist.seek(hist.first());
    hist.seek(hit);
    assert.strictEqual(hashState(m.saveState()), hitState);
    assert.strictEqual(m.cpu.getPC(), hitPC);

    // and carrying on to the present must match the original present
    hist.seek(present);
    assert.ok(timestampsEqual(core.now(), present), formatTimestamp(core.now()));
  });
});

// A 6502 that counts $80 up to 5 (a handful of frames at 1 MHz), then executes
// KIL, which the machine raises as EmuHalt from the onHalt hook.
describe('JavatariMachine on a 6502 that halts', function () {
  this.timeout(60000);

  const KIL_ADDR = 0xf008;

  function newRom() {
    const rom = new Uint8Array(0x1000);
    rom.set([
      0xe6, 0x80,         // f000 loop: inc $80
      0xa5, 0x80,         // f002       lda $80
      0xc9, 5,            // f004       cmp #5
      0xd0, 0xf8,         // f006       bne loop
      0x02,               // f008       kil
    ]);
    rom[0xffc] = 0x00; rom[0xffd] = 0xf0;   // reset vector -> $f000
    const m = new JavatariMachine();
    m.connectVideo(new Uint32Array(m.getVideoParams().width * m.getVideoParams().height));
    m.loadROM(rom);
    m.reset();
    return { m, core: new MachineCore(m, 'clock') };
  }

  it('parks on the KIL instruction, whether metered or not', function () {
    const a = newRom();
    const ra = a.core.runUntil(timestamp(100, 0));
    assert.ok(ra.halt instanceof EmuHalt, 'expected a halt');
    assert.strictEqual(a.m.cpu.getPC(), KIL_ADDR);
    assert.strictEqual(a.m.readConst(0x80), 5);

    const b = newRom();
    const rb = b.core.runUntil(timestamp(100, 0), () => false);
    assert.ok(rb.halt instanceof EmuHalt);
    assert.ok(timestampsEqual(ra.at, rb.at), `${formatTimestamp(ra.at)} != ${formatTimestamp(rb.at)}`);
    assert.strictEqual(hashState(a.m.saveState()), hashState(b.m.saveState()));
  });

  it('records to the halt and rewinds to the step before it', function () {
    const { m, core } = newRom();
    const hist = new History(core, { checkpointInterval: 4 });
    var r;
    for (var i = 0; i < 100 && !r?.halt; i++) r = hist.recordFrame();
    assert.ok(r.halt instanceof EmuHalt, 'expected a halt');
    const haltAt = hist.last();
    assert.strictEqual(m.cpu.getPC(), KIL_ADDR);
    // the 6502 steps by clocks, so the previous instruction is the last stable
    // step before now: the bne that fell through to the KIL
    const prev = hist.findLast(() => m.cpu.isStable(), hist.first(), hist.now());
    assert.ok(prev, 'no previous instruction');
    assert.strictEqual(m.cpu.getPC(), 0xf006);
    // and forward to the present again, without halting
    assert.strictEqual(hist.seek(haltAt).halt, undefined);
    assert.strictEqual(m.cpu.getPC(), KIL_ADDR);
  });
});