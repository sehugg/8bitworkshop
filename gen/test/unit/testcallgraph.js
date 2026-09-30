"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const callgraph_1 = require("../../src/common/callgraph");
const probe_1 = require("../../src/common/probe");
// Feed a builder the events the probe would log: before each instruction,
// the SP change the previous one made, then the instruction's address.
function run(kinds, steps) {
    const b = new callgraph_1.CallGraphBuilder(pc => { var _a; return (_a = kinds[pc]) !== null && _a !== void 0 ? _a : 'other'; }, pc => '$' + pc.toString(16));
    let sp = -1;
    for (const [pc, newsp] of steps) {
        if (newsp !== sp) {
            b.event(newsp < sp ? probe_1.ProbeFlags.SP_PUSH : probe_1.ProbeFlags.SP_POP, newsp, 0);
            sp = newsp;
        }
        b.event(probe_1.ProbeFlags.EXECUTE, pc, 0);
    }
    return b;
}
(0, mocha_1.describe)('Call graph', function () {
    (0, mocha_1.it)('follows calls and returns, not pushes and jumps', function () {
        const b = run({ 0x102: 'call', 0x205: 'return', 0x110: 'call' }, [
            [0x100, 0xf004],
            [0x102, 0xf004], // CALL $200
            [0x200, 0xf002],
            [0x201, 0xf002], // PUSH HL, then a jump: not a call
            [0x202, 0xf000],
            [0x300, 0xf000],
            [0x204, 0xf002], // POP HL
            [0x205, 0xf002], // RET
            [0x103, 0xf004],
            [0x110, 0xf004], // CALL C,$200, not taken: SP stays
            [0x113, 0xf004],
        ]);
        assert_1.default.deepStrictEqual(Object.keys(b.graph.calls), ['$200']);
        assert_1.default.strictEqual(b.graph.calls['$200'].count, 1);
        assert_1.default.deepStrictEqual(Object.keys(b.graph.calls['$200'].calls), []);
        assert_1.default.strictEqual(b.stack.length, 1);
    });
    (0, mocha_1.it)('counts an interrupt as a call', function () {
        const b = new callgraph_1.CallGraphBuilder(() => 'other', pc => '$' + pc.toString(16));
        b.event(probe_1.ProbeFlags.SP_POP, 0x1ff, 0);
        b.event(probe_1.ProbeFlags.EXECUTE, 0x8000, 0);
        b.event(probe_1.ProbeFlags.EXECUTE, 0x8001, 0);
        b.event(probe_1.ProbeFlags.INTERRUPT, 0, 0);
        b.event(probe_1.ProbeFlags.SP_PUSH, 0x1fc, 0);
        b.event(probe_1.ProbeFlags.EXECUTE, 0x9000, 0);
        assert_1.default.deepStrictEqual(Object.keys(b.graph.calls), ['$9000']);
    });
    (0, mocha_1.it)('counts an unreported interrupt as a call, so its return is not a new root', function () {
        // an NMI: the interrupted instruction is not a call, SP drops by 3 and the PC jumps
        const b = run({ 0x9002: 'return' }, [
            [0x100, 0x1ff], [0x101, 0x1ff],
            [0x9000, 0x1fc], [0x9001, 0x1fc], [0x9002, 0x1fc], // NMI handler, ends in RTI
            [0x102, 0x1ff], [0x103, 0x1ff],
        ]);
        assert_1.default.deepStrictEqual(Object.keys(b.graph.calls), ['$9000']);
        assert_1.default.strictEqual(b.graph.calls['$9000'].count, 1);
        assert_1.default.strictEqual(b.stack.length, 1);
        assert_1.default.strictEqual(b.graph.$$PC, null); // the root was not re-parented
    });
    (0, mocha_1.it)('returns past where it started into a new root', function () {
        const b = run({ 0x205: 'return' }, [[0x204, 0xf000], [0x205, 0xf000], [0x103, 0xf002]]);
        assert_1.default.deepStrictEqual(Object.keys(b.graph.calls), ['$205']);
        assert_1.default.strictEqual(b.stack.length, 1);
    });
    (0, mocha_1.it)('guesses from SP and PC when it cannot tell the instruction', function () {
        const kinds = new Proxy({}, { get: () => 'unknown' });
        const b = run(kinds, [[0x100, 0x1ff], [0x101, 0x1ff], [0x200, 0x1fd]]);
        assert_1.default.deepStrictEqual(Object.keys(b.graph.calls), ['$200']);
    });
    (0, mocha_1.it)('charges clocks to the routine running and to its callers', function () {
        const b = new callgraph_1.CallGraphBuilder(pc => pc === 0x102 ? 'call' : pc === 0x201 ? 'return' : 'other', pc => '$' + pc.toString(16));
        const step = (pc, sp, clocks) => {
            if (sp !== step.sp)
                b.event(sp < step.sp ? probe_1.ProbeFlags.SP_PUSH : probe_1.ProbeFlags.SP_POP, sp, 0);
            step.sp = sp;
            b.event(probe_1.ProbeFlags.EXECUTE, pc, 0);
            b.event(probe_1.ProbeFlags.CLOCKS, clocks, 0);
        };
        step.sp = -1;
        step(0x100, 0xf004, 4);
        step(0x102, 0xf004, 6); // CALL $200
        step(0x200, 0xf002, 10);
        step(0x201, 0xf002, 6); // RET
        step(0x103, 0xf004, 4);
        const call = b.graph.calls['$200'];
        assert_1.default.strictEqual(call.self, 16);
        assert_1.default.strictEqual(call.total, 16);
        assert_1.default.strictEqual(b.graph.self, 4 + 6 + 4); // the CALL counts where it started; so does the RET, in $200
        assert_1.default.strictEqual(b.graph.total, 30);
    });
});
//# sourceMappingURL=testcallgraph.js.map