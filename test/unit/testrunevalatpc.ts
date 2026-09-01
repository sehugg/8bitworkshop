import assert from "assert";
import { describe, it } from "mocha";
import { BaseDebugPlatform, CpuState, EmuState } from "../../src/common/baseplatform";

// Minimal platform whose PC just increments by 1 per virtual clock tick,
// for exercising BaseDebugPlatform.runEvalAtPC() / runToPC() in isolation
// (mirrors the TestStepPlatform pattern in teststepover.ts).
class TestClockPlatform extends BaseDebugPlatform {
  pc = 0;
  epc: number | undefined = undefined;
  paused = true;

  getPC(): number { return this.pc; }
  getSP(): number { return 0; }
  getCPUState(): CpuState { return { PC: this.pc, EPC: this.epc }; }
  isStable(): boolean { return true; }
  saveState(): EmuState { return { c: { PC: this.pc, EPC: this.epc } }; }
  loadState(state: EmuState) { this.pc = state.c.PC; this.epc = state.c.EPC; }
  pause() { this.paused = true; }
  resume() { this.paused = false; }
  isRunning() { return !this.paused; }
  advance(novideo?: boolean): number { return 0; }

  tick() {
    this.pc = (this.pc + 1) & 0xffff;
    this.debugClock++;
    this.evalDebugCondition();
  }

  // advance up to `budget` ticks, stopping early on a breakpoint hit
  run(budget: number) {
    for (let n = 0; n < budget && !this.wasBreakpointHit(); n++) this.tick();
  }
}

describe('BaseDebugPlatform.runEvalAtPC', function () {

  it('stops at an unconditional target address', function () {
    const p = new TestClockPlatform();
    p.runEvalAtPC(new Map([[5, null]]));
    p.run(20);
    assert.ok(p.wasBreakpointHit());
    assert.strictEqual(p.debugBreakState.c.PC, 5);
  });

  it('does not stop before the target address is reached', function () {
    const p = new TestClockPlatform();
    p.runEvalAtPC(new Map([[5, null]]));
    p.run(4); // pc reaches 4, not yet 5
    assert.ok(!p.wasBreakpointHit());
  });

  it('does not stop at a conditional address whose condition stays false', function () {
    const p = new TestClockPlatform();
    p.runEvalAtPC(new Map([[5, () => false]]));
    p.run(20);
    assert.ok(!p.wasBreakpointHit());
  });

  it('stops at a conditional address once its condition becomes true', function () {
    const p = new TestClockPlatform();
    let armed = false;
    p.runEvalAtPC(new Map([[5, () => armed]]));
    p.run(4); // reaches pc=4, condition still false, hasn't hit 5 yet
    assert.ok(!p.wasBreakpointHit());
    armed = true;
    p.run(20);
    assert.ok(p.wasBreakpointHit());
    assert.strictEqual(p.debugBreakState.c.PC, 5);
  });

  it('a failed condition does not consume the breakpoint -- it re-checks on later passes', function () {
    const p = new TestClockPlatform();
    let hits = 0;
    p.runEvalAtPC(new Map([[3, () => { hits++; return false; }]]));
    p.run(3);
    assert.strictEqual(hits, 1); // checked once, at pc==3
    assert.ok(!p.wasBreakpointHit());
  });

  it('prefers EPC over PC when present (bankswitched targets)', function () {
    const p = new TestClockPlatform();
    p.epc = 100; // banked address differs from the raw (unbanked) PC
    p.runEvalAtPC(new Map([[100, null]]));
    p.run(1);
    assert.ok(p.wasBreakpointHit());
  });

  it('matches whichever of several independent targets is reached first', function () {
    const p = new TestClockPlatform();
    p.runEvalAtPC(new Map([[50, null], [3, null]]));
    p.run(20);
    assert.ok(p.wasBreakpointHit());
    assert.strictEqual(p.debugBreakState.c.PC, 3);
  });

  it('ignores PCs not present in the target map at all', function () {
    const p = new TestClockPlatform();
    p.runEvalAtPC(new Map([[5, null]]));
    p.run(4); // stop at pc=4, which isn't a target
    assert.ok(!p.wasBreakpointHit());
    assert.strictEqual(p.pc, 4);
  });

  // Regression test for the "breakpoints don't fire" bug: armBreakpoints()
  // in ui.ts used to call platform.runEval() directly, which skips the
  // debugTargetClock bump that runToPC() (and every other run/step method)
  // does before arming. That bump is what keeps a fresh arm from being
  // gated behind a stale debugTargetClock left over from a prior session.
  // runEvalAtPC() exists specifically to carry that bookkeeping along with
  // a per-address condition map, so it must bump the clock exactly like
  // runToPC() does.
  it('bumps debugTargetClock the same way runToPC() does', function () {
    const p1 = new TestClockPlatform();
    const before1 = p1.debugTargetClock;
    p1.runToPC([5]);
    const delta1 = p1.debugTargetClock - before1;

    const p2 = new TestClockPlatform();
    const before2 = p2.debugTargetClock;
    p2.runEvalAtPC(new Map([[5, null]]));
    const delta2 = p2.debugTargetClock - before2;

    assert.strictEqual(delta1, 1);
    assert.strictEqual(delta2, delta1);
  });

  it('still bumps debugTargetClock relative to a stale prior value (not reset to 0)', function () {
    const p = new TestClockPlatform();
    p.debugTargetClock = 12345; // simulate a leftover value from an earlier debug session
    p.runEvalAtPC(new Map([[5, null]]));
    assert.strictEqual(p.debugTargetClock, 12346);
  });

});
