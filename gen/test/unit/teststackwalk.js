"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const disasm6502_1 = require("../../src/common/cpu/disasm6502");
const disasmz80_1 = require("../../src/common/cpu/disasmz80");
const stackwalk_1 = require("../../src/common/stackwalk");
// Memory with code poked in, and a stack, for walking by hand.
function machine(arch) {
    const mem = new Uint8Array(0x10000);
    const disassemble = arch === '6502'
        ? (a) => (0, disasm6502_1.disassemble6502)(a, mem[a], mem[a + 1], mem[a + 2])
        : (a) => (0, disasmz80_1.disassembleZ80)(a, mem[a], mem[a + 1], mem[a + 2], mem[a + 3]);
    return { mem, target: (sp) => ({ arch, sp, read: (a) => mem[a], disassemble }) };
}
(0, mocha_1.describe)('Stack walk', function () {
    (0, mocha_1.it)('finds 6502 JSRs, skipping pushed data', function () {
        const { mem, target } = machine('6502');
        // $8000 main: JSR $9000 (foo); $9000 foo: ... JSR $A000 (bar)
        mem.set([0x20, 0x00, 0x90], 0x8000);
        mem.set([0x20, 0x00, 0xa0], 0x9010);
        // stack from $1FF down: main's return ($8002), a PHA'd byte, foo's return ($9012)
        mem.set([0x12, 0x90, 0x55, 0x02, 0x80], 0x1fb);
        const frames = (0, stackwalk_1.walkStack)(target(0xfa), 0xa005);
        assert_1.default.deepStrictEqual(frames.map(f => f.pc), [0xa005, 0x9010, 0x8000]);
        assert_1.default.ok(frames.slice(1).every(f => f.matched));
    });
    (0, mocha_1.it)('prefers a Z80 return address whose CALL goes to the routine it is in', function () {
        const { mem, target } = machine('z80');
        // $0100 main: CALL $0200 (foo); $0150: CALL $0300 (other); $0200 foo: CALL $0400
        mem.set([0xcd, 0x00, 0x02], 0x100);
        mem.set([0xcd, 0x00, 0x03], 0x150);
        mem.set([0xcd, 0x00, 0x04], 0x210);
        // stack at $F000: foo's return ($0213), a stale return from other ($0153),
        // main's return ($0103)
        mem.set([0x13, 0x02, 0x53, 0x01, 0x03, 0x01], 0xf000);
        const frames = (0, stackwalk_1.walkStack)(target(0xf000), 0x0405);
        assert_1.default.deepStrictEqual(frames.map(f => f.pc), [0x0405, 0x0210, 0x0100]);
    });
    (0, mocha_1.it)('takes an RST, and a call it cannot match when nothing better is near', function () {
        const { mem, target } = machine('z80');
        // $0100: RST 38H; $0038: JP (HL) -- the call goes on somewhere we can't see
        mem[0x100] = 0xff;
        mem.set([0x01, 0x01], 0xf000);
        const frames = (0, stackwalk_1.walkStack)(target(0xf000), 0x5000);
        assert_1.default.deepStrictEqual(frames.map(f => [f.pc, f.matched]), [[0x5000, undefined], [0x0100, false]]);
        // near enough to $38 to be in the routine there
        assert_1.default.strictEqual((0, stackwalk_1.walkStack)(target(0xf000), 0x0050)[1].matched, true);
    });
    (0, mocha_1.it)('stops where there are no more calls', function () {
        const { target } = machine('z80');
        assert_1.default.deepStrictEqual((0, stackwalk_1.walkStack)(target(0xf000), 0x1234).map(f => f.pc), [0x1234]);
        assert_1.default.deepStrictEqual((0, stackwalk_1.walkStack)(Object.assign(Object.assign({}, target(0xf000)), { arch: 'arm32' }), 0x1234).map(f => f.pc), [0x1234]);
    });
});
//# sourceMappingURL=teststackwalk.js.map