import assert from "assert";
import { describe, it } from "mocha";
import { CallGraphBuilder, InsnKind } from "../../src/common/callgraph";
import { ProbeFlags } from "../../src/common/probe";

// Feed a builder the events the probe would log: before each instruction,
// the SP change the previous one made, then the instruction's address.
function run(kinds: { [pc: number]: InsnKind }, steps: [number, number][]) {
  const b = new CallGraphBuilder(pc => kinds[pc] ?? 'other', pc => '$' + pc.toString(16));
  let sp = -1;
  for (const [pc, newsp] of steps) {
    if (newsp !== sp) {
      b.event(newsp < sp ? ProbeFlags.SP_PUSH : ProbeFlags.SP_POP, newsp, 0);
      sp = newsp;
    }
    b.event(ProbeFlags.EXECUTE, pc, 0);
  }
  return b;
}

describe('Call graph', function () {
  it('follows calls and returns, not pushes and jumps', function () {
    const b = run({ 0x102: 'call', 0x205: 'return', 0x110: 'call' }, [
      [0x100, 0xf004],
      [0x102, 0xf004],  // CALL $200
      [0x200, 0xf002],
      [0x201, 0xf002],  // PUSH HL, then a jump: not a call
      [0x300, 0xf000],
      [0x204, 0xf002],  // POP HL
      [0x205, 0xf002],  // RET
      [0x103, 0xf004],
      [0x110, 0xf004],  // CALL C,$200, not taken: SP stays
      [0x113, 0xf004],
    ]);
    assert.deepStrictEqual(Object.keys(b.graph.calls), ['$200']);
    assert.strictEqual(b.graph.calls['$200'].count, 1);
    assert.deepStrictEqual(Object.keys(b.graph.calls['$200'].calls), []);
    assert.strictEqual(b.stack.length, 1);
  });

  it('counts an interrupt as a call', function () {
    const b = new CallGraphBuilder(() => 'other', pc => '$' + pc.toString(16));
    b.event(ProbeFlags.SP_POP, 0x1ff, 0);
    b.event(ProbeFlags.EXECUTE, 0x8000, 0);
    b.event(ProbeFlags.EXECUTE, 0x8001, 0);
    b.event(ProbeFlags.INTERRUPT, 0, 0);
    b.event(ProbeFlags.SP_PUSH, 0x1fc, 0);
    b.event(ProbeFlags.EXECUTE, 0x9000, 0);
    assert.deepStrictEqual(Object.keys(b.graph.calls), ['$9000']);
  });

  it('returns past where it started into a new root', function () {
    const b = run({ 0x205: 'return' }, [[0x204, 0xf000], [0x205, 0xf000], [0x103, 0xf002]]);
    assert.deepStrictEqual(Object.keys(b.graph.calls), ['$205']);
    assert.strictEqual(b.stack.length, 1);
  });

  it('guesses from SP and PC when it cannot tell the instruction', function () {
    const kinds = new Proxy({}, { get: () => 'unknown' }) as any;
    const b = run(kinds, [[0x100, 0x1ff], [0x101, 0x1ff], [0x200, 0x1fd]]);
    assert.deepStrictEqual(Object.keys(b.graph.calls), ['$200']);
  });
});
