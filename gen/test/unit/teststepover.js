"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const baseplatform_1 = require("../../src/common/baseplatform");
const disasm6502_1 = require("../../src/common/cpu/disasm6502");
// Minimal 6502-ish platform for exercising BaseDebugPlatform.stepOver().
// readAddress() relies on 'this' like real platforms (e.g. c64.ts), so it
// catches bugs where the method reference is detached from its object.
class TestStepPlatform extends baseplatform_1.BaseDebugPlatform {
    constructor() {
        super(...arguments);
        this.mem = new Uint8Array(0x10000);
        this.cpu = { PC: 0, SP: 0xff };
        this.paused = false;
    }
    getPC() { return this.cpu.PC; }
    getSP() { return this.cpu.SP; }
    getCPUState() { return { PC: this.cpu.PC, SP: this.cpu.SP }; }
    isStable() { return true; }
    // uses 'this' -- must not be called unbound
    readAddress(a) { return this.mem[a & 0xffff]; }
    // like real platforms, goes through the passed-in read callback
    disassemble(pc, read) {
        return (0, disasm6502_1.disassemble6502)(pc, read(pc), read(pc + 1), read(pc + 2));
    }
    saveState() { return { c: { PC: this.cpu.PC, SP: this.cpu.SP } }; }
    loadState(state) { this.cpu.PC = state.c.PC; this.cpu.SP = state.c.SP; }
    pause() { this.paused = true; }
    // like a real platform, resuming starts the emulation loop running
    // until the next breakpoint
    resume() { this.paused = false; this.advance(); }
    isRunning() { return !this.paused; }
    advance(novideo) {
        // execute instructions until breakpoint hit or budget exceeded
        var n = 0;
        while (!this.wasBreakpointHit() && n < 1000) {
            this.execInstruction();
            n++;
            this.debugClock++;
            this.evalDebugCondition();
        }
        return n;
    }
    execInstruction() {
        var op = this.readAddress(this.cpu.PC);
        switch (op) {
            case 0x20: { // JSR abs
                var target = this.readAddress(this.cpu.PC + 1) | (this.readAddress(this.cpu.PC + 2) << 8);
                var ret = (this.cpu.PC + 2) & 0xffff;
                this.push((ret >> 8) & 0xff);
                this.push(ret & 0xff);
                this.cpu.PC = target;
                break;
            }
            case 0x60: { // RTS
                var lo = this.pop();
                var hi = this.pop();
                this.cpu.PC = ((lo | (hi << 8)) + 1) & 0xffff;
                break;
            }
            default: // NOP and anything else: treat as 1-byte instruction
                this.cpu.PC = (this.cpu.PC + 1) & 0xffff;
                break;
        }
    }
    push(b) {
        this.mem[0x100 + this.cpu.SP] = b & 0xff;
        this.cpu.SP = (this.cpu.SP - 1) & 0xff;
    }
    pop() {
        this.cpu.SP = (this.cpu.SP + 1) & 0xff;
        return this.mem[0x100 + this.cpu.SP];
    }
}
(0, mocha_1.describe)('BaseDebugPlatform stepOver', function () {
    function makePlatform() {
        var p = new TestStepPlatform();
        // JSR $0005 ; NOP ; BRK
        p.mem.set([0x20, 0x05, 0x00, 0xEA, 0x00], 0x0000);
        // subroutine at $0005: LDA #$01 ; RTS
        p.mem.set([0xA9, 0x01, 0x60], 0x0005);
        p.cpu.PC = 0x0000;
        return p;
    }
    (0, mocha_1.it)('should step over a JSR to the following instruction', function () {
        var p = makePlatform();
        var sp0 = p.getSP();
        p.stepOver(); // runs the runEval loop via advance()
        assert_1.default.strictEqual(p.getPC(), 0x0003); // not inside the subroutine
        assert_1.default.strictEqual(p.getSP(), sp0); // subroutine returned
    });
    (0, mocha_1.it)('should single-step when instruction is not a call', function () {
        var p = makePlatform();
        p.cpu.PC = 0x0003; // NOP
        p.stepOver();
        assert_1.default.strictEqual(p.getPC(), 0x0004);
    });
    (0, mocha_1.it)('should detect iscall on JSR opcode', function () {
        var p = makePlatform();
        var d = p.disassemble(0x0000, (a) => p.readAddress(a));
        assert_1.default.strictEqual(d.iscall, true);
        assert_1.default.strictEqual(d.nbytes, 3);
    });
});
//# sourceMappingURL=teststepover.js.map