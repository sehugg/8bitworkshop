import assert from "assert";
import fs from "fs";
import { describe, it } from "mocha";
import { mockAudio, mockGlobals } from "../../src/tools/nodemock";

mockGlobals();
mockAudio();

// imported after the globals are mocked -- the machine pulls in the audio
// classes that live on globalThis
import { Midway8080 } from "../../src/machine/mw8080bw";
import { GalaxianScrambleMachine } from "../../src/machine/galaxian";
import { Devel6502 } from "../../src/machine/devel";
import { EmuHalt } from "../../src/common/emu";
import { hashState as hashAnyState } from "../../src/common/statehash";
import { NullProbe } from "../../src/common/devices";
import { History } from "../../src/common/history";
import {
  compareTimestamps,
  formatTimestamp,
  MachineCore,
  timestamp,
  timestampsEqual,
} from "../../src/common/timeline";

// MachineCore against a real machine: a Z80 BasicScanlineMachine running a
// real ROM. The fake machine in testtimeline.ts pins the semantics; this pins
// that they survive contact with an emulator whose advanceFrame() restarts the
// scanline loop and whose state is typed arrays.

function newCore() {
  const m = new Midway8080();
  m.connectVideo(new Uint32Array(m.canvasWidth * m.numVisibleScanlines));
  m.loadROM(new Uint8Array(fs.readFileSync('./test/roms/mw8080bw/game2.c.rom')));
  m.reset();
  return { m, core: new MachineCore(m) };
}

// cheap order-sensitive checksum over the whole machine state
function hashState(m: Midway8080): number {
  const s: any = m.saveState();
  let h = 0x811c9dc5;
  const mix = (v: number) => { h = Math.imul(h ^ (v & 0xff), 0x01000193) >>> 0; };
  for (const k of Object.keys(s).sort()) {
    const v = s[k];
    if (v instanceof Uint8Array) for (let i = 0; i < v.length; i++) mix(v[i]);
    else for (const kk of Object.keys(v).sort()) { mix(kk.charCodeAt(0)); mix(v[kk]); mix(v[kk] >> 8); }
  }
  return h;
}

describe('MachineCore on a real machine', function () {

  it('replays to the identical state from a snapshot 20 frames back', function () {
    const { m, core } = newCore();
    const snap0 = core.snapshot();
    core.runUntil(timestamp(20, 500), () => false);
    const expected = hashState(m);
    const pc = m.cpu.getPC();

    core.restore(snap0, timestamp(0, 0));
    const r = core.runUntil(timestamp(20, 500), () => false);
    assert.ok(timestampsEqual(r.at, timestamp(20, 500)), formatTimestamp(r.at));
    assert.strictEqual(m.cpu.getPC(), pc);
    assert.strictEqual(hashState(m), expected);
  });

  it('reaches a sub-frame position identically forwards and backwards', function () {
    // where the machine should be at 12:250, reached only by running forward
    const fwd = newCore();
    fwd.core.runUntil(timestamp(12, 250), () => false);
    const expected = hashState(fwd.m);

    // now overshoot and come back to it
    const { m, core } = newCore();
    const snap0 = core.snapshot();
    core.runUntil(timestamp(12, 900), () => false);
    assert.notStrictEqual(hashState(m), expected);
    core.restore(snap0, timestamp(0, 0));
    core.runUntil(timestamp(12, 250), () => false);
    assert.strictEqual(hashState(m), expected);
  });

  it('traps on a condition several frames ahead and reports where', function () {
    const { m, core } = newCore();
    core.runUntil(timestamp(5, 0));
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
    const expected = hashState(m);
    core.restore(snap5, timestamp(5, 0));
    const r2 = core.runUntil(timestamp(30, 0), () => m.cpu.getPC() === targetPC);
    assert.ok(timestampsEqual(r2.at, hit), `${formatTimestamp(r2.at)} != ${formatTimestamp(hit)}`);
    assert.strictEqual(hashState(m), expected);
  });

  it('keeps counting frames past a trap instead of resetting', function () {
    const { m, core } = newCore();
    core.runUntil(timestamp(3, 100), () => false);
    assert.ok(timestampsEqual(core.now(), timestamp(3, 100)));
    core.runUntil(timestamp(7, 20), () => false);
    assert.ok(timestampsEqual(core.now(), timestamp(7, 20)));
  });

  it('counts a whole metered frame', function () {
    const { core } = newCore();
    core.runUntil(timestamp(2, 0), () => false);
    // one Z80 instruction per step, so a frame is a few thousand of them
    const steps = core.getLastFrameSteps();
    assert.ok(steps > 100 && steps < 100000, `implausible step count ${steps}`);
  });
});

// A watchpoint: a probe that latches a write to one address. Params are
// optional because NullProbe declares these with none.
class WatchProbe extends NullProbe {
  hit = false;
  constructor(readonly addr: number) { super(); }
  logWrite(a?: number, v?: number) { if (a === this.addr) this.hit = true; }
  // clearing on test means each write is reported once; handing the probe to
  // the search lets History attach it only while the search runs
  asCondition() {
    return {
      probe: this,
      test: () => { const h = this.hit; this.hit = false; return h; },
      reset: () => { this.hit = false; },
    };
  }
}

describe('History on a real machine', function () {

  it('replays a recorded run back to the same present', function () {
    const { m, core } = newCore();
    const hist = new History(core, { checkpointInterval: 5 });
    for (var i = 0; i < 40; i++) hist.recordFrame();
    const present = hashState(m);

    hist.seek(timestamp(3, 200));
    assert.notStrictEqual(hashState(m), present);
    hist.seek(hist.last());
    assert.strictEqual(hashState(m), present);
  });

  it('finds when a memory location was last written, after the fact', function () {
    const WATCH = 0x200b;   // written a couple of times early in the ROM

    const { m, core } = newCore();
    const hist = new History(core, { checkpointInterval: 5 });
    const probe = new WatchProbe(WATCH);
    // recorded with no probe attached at all -- the point is to ask afterwards
    for (var i = 0; i < 40; i++) hist.recordFrame();
    assert.strictEqual(m.probing, false, 'recording should not be probing');

    const hit = hist.findLast(probe.asCondition());
    assert.strictEqual(m.probing, false, 'probe should be detached after the search');
    assert.ok(hit, `no write to $${WATCH.toString(16)} found`);
    assert.ok(compareTimestamps(hit, hist.first()) >= 0 && compareTimestamps(hit, hist.last()) < 0,
      `hit ${formatTimestamp(hit)} outside the recorded window`);

    // the multi-span walk backwards must agree with one linear scan
    const solo = newCore();
    const soloHist = new History(solo.core, { checkpointInterval: 100000 });
    const soloProbe = new WatchProbe(WATCH);
    for (var i = 0; i < 40; i++) soloHist.recordFrame();
    const soloHit = soloHist.findLast(soloProbe.asCondition());
    assert.ok(timestampsEqual(hit, soloHit),
      `checkpointed search said ${formatTimestamp(hit)}, linear scan said ${formatTimestamp(soloHit)}`);
  });

  it('steps backwards one instruction exactly', function () {
    const { m, core } = newCore();
    const hist = new History(core, { checkpointInterval: 5 });
    for (var i = 0; i < 20; i++) hist.recordFrame();

    hist.seek(timestamp(10, 40));
    const pcAt40 = m.cpu.getPC();
    const prev = hist.previousStep();
    assert.ok(timestampsEqual(prev, timestamp(10, 39)), formatTimestamp(prev));
    const pcAt39 = m.cpu.getPC();
    // seeking to each again must reproduce both
    hist.seek(timestamp(10, 40));
    assert.strictEqual(m.cpu.getPC(), pcAt40);
    hist.seek(timestamp(10, 39));
    assert.strictEqual(m.cpu.getPC(), pcAt39);
  });
});

// A trap stops the CPU loop, not the frame: galaxian's advanceFrame() still
// advances its graphics, decrements the watchdog and raises an NMI after the
// loop exits. A core stopped mid-frame must show the state at the stop, not
// the state after that tail ran.
describe('MachineCore break state', function () {

  function newGalaxian() {
    const m = new GalaxianScrambleMachine();
    m.connectVideo(new Uint32Array(m.canvasWidth * m.numVisibleScanlines));
    m.loadROM(new Uint8Array(fs.readFileSync('./test/roms/galaxian-scramble/shoot2.c.rom')));
    m.reset();
    return { m, core: new MachineCore(m) };
  }

  it('shows the state at the trap, not after the frame tail', function () {
    const { m, core } = newGalaxian();
    core.runUntil(timestamp(5, 0));
    var n = 0;
    var atTrap: number = null;
    const r = core.runUntil(timestamp(6, 0), () => {
      if (n++ < 500) return false;
      atTrap = hashAnyState(m.saveState());
      return true;
    });
    assert.ok(r.trapped);
    assert.strictEqual(hashAnyState(m.saveState()), atTrap);
  });

  it('shows the state at the target step when stopping at one', function () {
    // the trap is not consulted at the target step itself, so capture the
    // expected state from a second run that goes one step further
    const ref = newGalaxian();
    ref.core.runUntil(timestamp(5, 0));
    var atStep: number = null;
    var n = 0;
    ref.core.runUntil(timestamp(5, 501), () => {
      if (n++ === 500) atStep = hashAnyState(ref.m.saveState());
      return false;
    });
    assert.notStrictEqual(atStep, null);

    const { m, core } = newGalaxian();
    core.runUntil(timestamp(5, 0));
    core.runUntil(timestamp(5, 500));
    assert.ok(timestampsEqual(core.now(), timestamp(5, 500)), formatTimestamp(core.now()));
    assert.strictEqual(hashAnyState(m.saveState()), atStep);
  });
});

// A 6502 that counts $11 up to 100 (about 12 frames at 1 MHz), then executes
// KIL, which MOS6502 throws as EmuHalt from the middle of the instruction.
describe('MachineCore on a 6502 that halts', function () {

  const KIL_ADDR = 0x800c;

  function newDevel() {
    const rom = new Uint8Array(0x8000);
    rom.set([
      0xe6, 0x10,         // 8000 loop: inc $10
      0xd0, 0xfc,         // 8002       bne loop
      0xe6, 0x11,         // 8004       inc $11
      0xa5, 0x11,         // 8006       lda $11
      0xc9, 100,          // 8008       cmp #100
      0xd0, 0xf4,         // 800a       bne loop
      0x02,               // 800c       kil
    ]);
    rom[0x7ffc] = 0x00; rom[0x7ffd] = 0x80;
    const m = new Devel6502();
    m.loadROM(rom);
    m.reset();
    return { m, core: new MachineCore(m) };
  }

  it('parks on the KIL instruction, whether metered or not', function () {
    const a = newDevel();
    const ra = a.core.runUntil(timestamp(100, 0));
    assert.ok(ra.halt instanceof EmuHalt, 'expected a halt');
    assert.ok(ra.at.frame > 5, formatTimestamp(ra.at));
    assert.strictEqual(a.m.cpu.getPC(), KIL_ADDR);
    assert.strictEqual(a.m.ram[0x11], 100);

    const b = newDevel();
    const rb = b.core.runUntil(timestamp(100, 0), () => false);
    assert.ok(rb.halt instanceof EmuHalt);
    assert.ok(timestampsEqual(ra.at, rb.at), `${formatTimestamp(ra.at)} != ${formatTimestamp(rb.at)}`);
    assert.strictEqual(hashAnyState(a.m.saveState()), hashAnyState(b.m.saveState()));
  });

  it('records to the halt and rewinds to the step before it', function () {
    const { m, core } = newDevel();
    const hist = new History(core, { checkpointInterval: 4 });
    var r;
    for (var i = 0; i < 100 && !r?.halt; i++) r = hist.recordFrame();
    assert.ok(r.halt instanceof EmuHalt, 'expected a halt');
    const haltAt = hist.last();
    assert.strictEqual(m.cpu.getPC(), KIL_ADDR);
    // a 6502 steps by clocks, so the previous instruction is the last stable
    // step before now: the bne that fell through to the KIL
    const prev = hist.findLast(() => m.cpu.isStable(), hist.first(), hist.previousStep());
    assert.ok(prev, 'no previous instruction');
    assert.strictEqual(m.cpu.getPC(), 0x800a);
    // and forward to the present again, without halting
    assert.strictEqual(hist.seek(haltAt).halt, undefined);
    assert.strictEqual(m.cpu.getPC(), KIL_ADDR);
  });
});
