import assert from "assert";
import { describe, it } from "mocha";
import { Z80 } from "../../src/common/cpu/ZilogZ80";
import { BasicHeadlessMachine } from "../../src/common/devices";
import { ProbeRecorder } from "../../src/common/probe";
import { PacmanMachine } from "../../src/machine/pacman";

function makeBus(mem: Uint8Array) {
  return {
    read: (a: number) => mem[a & 0xffff],
    write: (a: number, v: number) => { mem[a & 0xffff] = v & 0xff; },
  };
}

function makeIO() {
  return { read: (_a: number) => 0xff, write: (_a: number, _v: number) => { } };
}

describe('Z80 bus reconnection', function () {
  it('should preserve CPU state when the buses are reconnected', function () {
    const mem = new Uint8Array(0x10000);
    // LD A,$42 ; LD B,$13
    mem.set([0x3e, 0x42, 0x06, 0x13], 0);
    const cpu = new Z80();
    cpu.connectMemoryBus(makeBus(mem));
    cpu.connectIOBus(makeIO());
    cpu.advanceInsn();
    cpu.advanceInsn();
    const before = cpu.saveState();
    assert.strictEqual(before.PC, 4);
    assert.strictEqual((before.AF >> 8) & 0xff, 0x42);

    // This is what BasicHeadlessMachine.rewireCPUBuses() does when a probe is
    // attached or detached.
    cpu.connectMemoryBus(makeBus(mem));
    cpu.connectIOBus(makeIO());

    const after = cpu.saveState();
    assert.strictEqual(after.PC, before.PC);
    assert.strictEqual(after.AF, before.AF);
    assert.strictEqual(after.BC, before.BC);
  });

  it('should route accesses through the newly connected memory bus', function () {
    const memA = new Uint8Array(0x10000);
    const memB = new Uint8Array(0x10000);
    // LD HL,$0010 ; LD A,(HL)
    const prog = [0x21, 0x10, 0x00, 0x7e];
    memA.set(prog, 0);
    memB.set(prog, 0);
    memA[0x10] = 0xaa;
    memB[0x10] = 0xbb;

    const cpu = new Z80();
    cpu.connectMemoryBus(makeBus(memA));
    cpu.connectIOBus(makeIO());
    cpu.advanceInsn(); // LD HL,$0010
    cpu.connectMemoryBus(makeBus(memB)); // swap in a different bus
    cpu.advanceInsn(); // LD A,(HL) must read memB
    assert.strictEqual((cpu.saveState().AF >> 8) & 0xff, 0xbb);
  });
});

class TestZ80Machine extends BasicHeadlessMachine {
  cpuFrequency = 1000000;
  defaultROMSize = 0x10000;
  cpu = new Z80();
  ram = new Uint8Array(0x10000);

  constructor() {
    super();
    this.connectCPUMemoryBus(this);
    this.connectCPUIOBus(makeIO());
  }
  read(a: number): number { return this.ram[a & 0xffff]; }
  write(a: number, v: number): void { this.ram[a & 0xffff] = v & 0xff; }
}

describe('Probing does not reset Z80 machines', function () {
  it('should keep CPU state across connectProbe() on a generic Z80 machine', function () {
    const m = new TestZ80Machine();
    m.ram.set([0x3e, 0x42, 0x06, 0x13, 0x7e], 0);
    m.advanceCPU();
    m.advanceCPU();
    const before = m.saveState().c;
    assert.strictEqual(before.PC, 4);

    const rec = new ProbeRecorder(m);
    m.connectProbe(rec);
    assert.strictEqual(m.saveState().c.PC, before.PC);
    assert.strictEqual(m.saveState().c.AF, before.AF);

    m.advanceCPU();
    assert.ok(rec.idx > 0, 'probe should record data while connected');

    m.connectProbe(null);
    assert.strictEqual(m.saveState().c.PC, 5);
  });
});

describe('Pacman probing', function () {
  it('should not reset and should record data when the probe is toggled', function () {
    const m = new PacmanMachine();
    m.rom.fill(0);
    // LD A,$42 ; NOP ; LD B,$13
    m.rom.set([0x3e, 0x42, 0x00, 0x06, 0x13], 0);
    m.advanceCPU();
    m.advanceCPU();
    const before = m.saveState().c;
    assert.strictEqual(before.PC, 3);

    const rec = new ProbeRecorder(m);
    m.connectProbe(rec);
    assert.strictEqual(m.saveState().c.PC, before.PC, 'probe toggle must not reset Pacman');

    m.advanceCPU();
    assert.ok(rec.idx > 0, 'Pacman probe should record execute/clocks');

    m.connectProbe(null);
    assert.strictEqual(m.saveState().c.PC, 5);
  });
});
