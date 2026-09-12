"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const ZilogZ80_1 = require("../../src/common/cpu/ZilogZ80");
const devices_1 = require("../../src/common/devices");
const probe_1 = require("../../src/common/probe");
const pacman_1 = require("../../src/machine/pacman");
function makeBus(mem) {
    return {
        read: (a) => mem[a & 0xffff],
        write: (a, v) => { mem[a & 0xffff] = v & 0xff; },
    };
}
function makeIO() {
    return { read: (_a) => 0xff, write: (_a, _v) => { } };
}
(0, mocha_1.describe)('Z80 bus reconnection', function () {
    (0, mocha_1.it)('should preserve CPU state when the buses are reconnected', function () {
        const mem = new Uint8Array(0x10000);
        // LD A,$42 ; LD B,$13
        mem.set([0x3e, 0x42, 0x06, 0x13], 0);
        const cpu = new ZilogZ80_1.Z80();
        cpu.connectMemoryBus(makeBus(mem));
        cpu.connectIOBus(makeIO());
        cpu.advanceInsn();
        cpu.advanceInsn();
        const before = cpu.saveState();
        assert_1.default.strictEqual(before.PC, 4);
        assert_1.default.strictEqual((before.AF >> 8) & 0xff, 0x42);
        // This is what BasicHeadlessMachine.rewireCPUBuses() does when a probe is
        // attached or detached.
        cpu.connectMemoryBus(makeBus(mem));
        cpu.connectIOBus(makeIO());
        const after = cpu.saveState();
        assert_1.default.strictEqual(after.PC, before.PC);
        assert_1.default.strictEqual(after.AF, before.AF);
        assert_1.default.strictEqual(after.BC, before.BC);
    });
    (0, mocha_1.it)('should route accesses through the newly connected memory bus', function () {
        const memA = new Uint8Array(0x10000);
        const memB = new Uint8Array(0x10000);
        // LD HL,$0010 ; LD A,(HL)
        const prog = [0x21, 0x10, 0x00, 0x7e];
        memA.set(prog, 0);
        memB.set(prog, 0);
        memA[0x10] = 0xaa;
        memB[0x10] = 0xbb;
        const cpu = new ZilogZ80_1.Z80();
        cpu.connectMemoryBus(makeBus(memA));
        cpu.connectIOBus(makeIO());
        cpu.advanceInsn(); // LD HL,$0010
        cpu.connectMemoryBus(makeBus(memB)); // swap in a different bus
        cpu.advanceInsn(); // LD A,(HL) must read memB
        assert_1.default.strictEqual((cpu.saveState().AF >> 8) & 0xff, 0xbb);
    });
});
class TestZ80Machine extends devices_1.BasicHeadlessMachine {
    constructor() {
        super();
        this.cpuFrequency = 1000000;
        this.defaultROMSize = 0x10000;
        this.cpu = new ZilogZ80_1.Z80();
        this.ram = new Uint8Array(0x10000);
        this.connectCPUMemoryBus(this);
        this.connectCPUIOBus(makeIO());
    }
    read(a) { return this.ram[a & 0xffff]; }
    write(a, v) { this.ram[a & 0xffff] = v & 0xff; }
}
(0, mocha_1.describe)('Probing does not reset Z80 machines', function () {
    (0, mocha_1.it)('should keep CPU state across connectProbe() on a generic Z80 machine', function () {
        const m = new TestZ80Machine();
        m.ram.set([0x3e, 0x42, 0x06, 0x13, 0x7e], 0);
        m.advanceCPU();
        m.advanceCPU();
        const before = m.saveState().c;
        assert_1.default.strictEqual(before.PC, 4);
        const rec = new probe_1.ProbeRecorder(m);
        m.connectProbe(rec);
        assert_1.default.strictEqual(m.saveState().c.PC, before.PC);
        assert_1.default.strictEqual(m.saveState().c.AF, before.AF);
        m.advanceCPU();
        assert_1.default.ok(rec.idx > 0, 'probe should record data while connected');
        m.connectProbe(null);
        assert_1.default.strictEqual(m.saveState().c.PC, 5);
    });
});
(0, mocha_1.describe)('Pacman probing', function () {
    (0, mocha_1.it)('should not reset and should record data when the probe is toggled', function () {
        const m = new pacman_1.PacmanMachine();
        m.rom.fill(0);
        // LD A,$42 ; NOP ; LD B,$13
        m.rom.set([0x3e, 0x42, 0x00, 0x06, 0x13], 0);
        m.advanceCPU();
        m.advanceCPU();
        const before = m.saveState().c;
        assert_1.default.strictEqual(before.PC, 3);
        const rec = new probe_1.ProbeRecorder(m);
        m.connectProbe(rec);
        assert_1.default.strictEqual(m.saveState().c.PC, before.PC, 'probe toggle must not reset Pacman');
        m.advanceCPU();
        assert_1.default.ok(rec.idx > 0, 'Pacman probe should record execute/clocks');
        m.connectProbe(null);
        assert_1.default.strictEqual(m.saveState().c.PC, 5);
    });
});
//# sourceMappingURL=testz80probe.js.map