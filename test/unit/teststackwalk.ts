import assert from "assert";
import { describe, it } from "mocha";
import { disassemble6502 } from "../../src/common/cpu/disasm6502";
import { disassembleZ80 } from "../../src/common/cpu/disasmz80";
import { walkStack } from "../../src/common/stackwalk";

// Memory with code poked in, and a stack, for walking by hand.
function machine(arch: string) {
  const mem = new Uint8Array(0x10000);
  const disassemble = arch === '6502'
    ? (a: number) => disassemble6502(a, mem[a], mem[a + 1], mem[a + 2])
    : (a: number) => disassembleZ80(a, mem[a], mem[a + 1], mem[a + 2], mem[a + 3]);
  return { mem, target: (sp: number) => ({ arch, sp, read: (a: number) => mem[a], disassemble }) };
}

describe('Stack walk', function () {
  it('finds 6502 JSRs, skipping pushed data', function () {
    const { mem, target } = machine('6502');
    // $8000 main: JSR $9000 (foo); $9000 foo: ... JSR $A000 (bar)
    mem.set([0x20, 0x00, 0x90], 0x8000);
    mem.set([0x20, 0x00, 0xa0], 0x9010);
    // stack from $1FF down: main's return ($8002), a PHA'd byte, foo's return ($9012)
    mem.set([0x12, 0x90, 0x55, 0x02, 0x80], 0x1fb);
    const frames = walkStack(target(0xfa), 0xa005);
    assert.deepStrictEqual(frames.map(f => f.pc), [0xa005, 0x9010, 0x8000]);
    assert.ok(frames.slice(1).every(f => f.matched));
  });

  it('prefers a Z80 return address whose CALL goes to the routine it is in', function () {
    const { mem, target } = machine('z80');
    // $0100 main: CALL $0200 (foo); $0150: CALL $0300 (other); $0200 foo: CALL $0400
    mem.set([0xcd, 0x00, 0x02], 0x100);
    mem.set([0xcd, 0x00, 0x03], 0x150);
    mem.set([0xcd, 0x00, 0x04], 0x210);
    // stack at $F000: foo's return ($0213), a stale return from other ($0153),
    // main's return ($0103)
    mem.set([0x13, 0x02, 0x53, 0x01, 0x03, 0x01], 0xf000);
    const frames = walkStack(target(0xf000), 0x0405);
    assert.deepStrictEqual(frames.map(f => f.pc), [0x0405, 0x0210, 0x0100]);
  });

  it('takes an RST, and a call it cannot match when nothing better is near', function () {
    const { mem, target } = machine('z80');
    // $0100: RST 38H; $0038: JP (HL) -- the call goes on somewhere we can't see
    mem[0x100] = 0xff;
    mem.set([0x01, 0x01], 0xf000);
    const frames = walkStack(target(0xf000), 0x5000);
    assert.deepStrictEqual(frames.map(f => [f.pc, f.matched]), [[0x5000, undefined], [0x0100, false]]);
    // near enough to $38 to be in the routine there
    assert.strictEqual(walkStack(target(0xf000), 0x0050)[1].matched, true);
  });

  it('stops where there are no more calls', function () {
    const { target } = machine('z80');
    assert.deepStrictEqual(walkStack(target(0xf000), 0x1234).map(f => f.pc), [0x1234]);
    assert.deepStrictEqual(walkStack({ ...target(0xf000), arch: 'arm32' }, 0x1234).map(f => f.pc), [0x1234]);
  });
});
