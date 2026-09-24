import assert from "assert";
import { describe, it } from "mocha";
import { GameBoyMachine } from "../../src/machine/gb";

// Build a minimal ROM with the given cartridge type and RAM size.
function makeROM(cartType: number, ramSize = 0x02): Uint8Array {
  const rom = new Uint8Array(0x8000);
  rom[0x143] = 0x00; // DMG mode
  rom[0x147] = cartType;
  rom[0x149] = ramSize;
  return rom;
}

function newMBC3RTC(): GameBoyMachine {
  const m = new GameBoyMachine();
  let fakeNow = 1700000000000; // fixed epoch
  m.now = () => fakeNow;
  m.loadROM(makeROM(0x10)); // MBC3 + TIMER + RAM + BATTERY
  return m;
}

// Select an RTC register (0x08-0x0C) then latch (write 0x00, then 0x01).
function latch(m: GameBoyMachine, reg: number): number {
  m.write(0x4000, reg);
  m.write(0x6000, 0x00);
  m.write(0x6000, 0x01);
  return m.read(0xA000);
}

describe('Game Boy MBC3 RTC', function () {

  it('detects RTC cartridges', function () {
    const rtc = new GameBoyMachine();
    rtc.loadROM(makeROM(0x10));
    assert.strictEqual(rtc.hasRTC, true);

    const noTimer = new GameBoyMachine();
    noTimer.loadROM(makeROM(0x11)); // MBC3 without RTC
    assert.strictEqual(noTimer.hasRTC, false);

    const mbc1 = new GameBoyMachine();
    mbc1.loadROM(makeROM(0x03));
    assert.strictEqual(mbc1.hasRTC, false);
  });

  it('powers on at the wall-clock time', function () {
    const m = new GameBoyMachine();
    const fake = new Date(2024, 0, 15, 9, 30, 45).getTime();
    m.now = () => fake;
    m.loadROM(makeROM(0x10));
    assert.strictEqual(m.rtcHour, 9);
    assert.strictEqual(m.rtcMin, 30);
    assert.strictEqual(m.rtcSec, 45);
    // latched snapshot matches the live clock at boot
    assert.strictEqual(m.rtcLatched[0], 45);
    assert.strictEqual(m.rtcLatched[1], 30);
    assert.strictEqual(m.rtcLatched[2], 9);
  });

  it('advances by elapsed wall-clock seconds', function () {
    const m = newMBC3RTC();
    let fake = m.now();
    // pin a known time (set through the machine, then reload the base)
    m.rtcSec = 57; m.rtcMin = 58; m.rtcHour = 0; m.rtcDay = 0;
    m.rtcHalt = false; m.rtcCarry = false;
    m.rtcLastSync = fake;

    fake += 5 * 1000;
    m.now = () => fake;
    m.syncRTC();
    assert.strictEqual(m.rtcSec, 2);
    assert.strictEqual(m.rtcMin, 59);
    assert.strictEqual(m.rtcHour, 0);
    assert.strictEqual(m.rtcDay, 0);
  });

  it('rolls over hours into days', function () {
    const m = newMBC3RTC();
    const fake = m.now();
    m.rtcSec = 0; m.rtcMin = 0; m.rtcHour = 23; m.rtcDay = 0;
    m.rtcLastSync = fake;
    m.now = () => fake + 3600 * 1000;
    m.syncRTC();
    assert.strictEqual(m.rtcHour, 0);
    assert.strictEqual(m.rtcDay, 1);
  });

  it('wraps the 9-bit day counter and sets carry', function () {
    const m = newMBC3RTC();
    const fake = m.now();
    m.rtcSec = 0; m.rtcMin = 0; m.rtcHour = 0; m.rtcDay = 511;
    m.rtcCarry = false;
    m.rtcLastSync = fake;
    m.now = () => fake + 24 * 3600 * 1000;
    m.syncRTC();
    assert.strictEqual(m.rtcDay, 0);
    assert.strictEqual(m.rtcCarry, true);
  });

  it('freezes while the halt bit is set', function () {
    const m = newMBC3RTC();
    const fake = m.now();
    m.rtcSec = 10; m.rtcMin = 0; m.rtcHour = 0; m.rtcDay = 0;
    m.rtcHalt = true;
    m.rtcLastSync = fake;
    m.now = () => fake + 100 * 1000;
    m.syncRTC();
    assert.strictEqual(m.rtcSec, 10);
    assert.strictEqual(m.rtcMin, 0);
  });

  it('returns latched registers at A000-BFFF', function () {
    const m = newMBC3RTC();
    const fixed = new Date(2024, 0, 15, 1, 2, 3).getTime();
    m.now = () => fixed;
    m.loadROM(makeROM(0x10)); // re-init to pick up the new clock
    assert.strictEqual(latch(m, 0x08), 3);   // seconds
    assert.strictEqual(latch(m, 0x09), 2);   // minutes
    assert.strictEqual(latch(m, 0x0A), 1);   // hours
    assert.strictEqual(latch(m, 0x0B), 0);   // day low
    assert.strictEqual(latch(m, 0x0C), 0);   // day high / flags
  });

  it('reflects elapsed time across a re-latch', function () {
    const m = newMBC3RTC();
    const fake = m.now();
    m.rtcSec = 50; m.rtcMin = 0; m.rtcHour = 0; m.rtcDay = 0;
    m.rtcLastSync = fake;
    assert.strictEqual(latch(m, 0x08), 50);
    assert.strictEqual(latch(m, 0x09), 0);

    m.now = () => fake + 15 * 1000;
    assert.strictEqual(latch(m, 0x08), 5);
    assert.strictEqual(latch(m, 0x09), 1);
  });

  it('ignores writes to RTC registers', function () {
    const m = newMBC3RTC();
    const fixed = new Date(2024, 0, 15, 1, 2, 3).getTime();
    m.now = () => fixed;
    m.loadROM(makeROM(0x10));
    m.write(0x4000, 0x08);       // select seconds
    m.write(0x6000, 0x00);       // latch
    m.write(0x6000, 0x01);
    assert.strictEqual(m.read(0xA000), 3);
    m.write(0xA000, 0xAA);       // read-only
    assert.strictEqual(m.read(0xA000), 3);
  });

  it('does not treat RTC select on non-RTC carts', function () {
    const m = new GameBoyMachine();
    m.loadROM(makeROM(0x11));
    m.write(0x4000, 0x08);
    assert.strictEqual(m.rtcRegisterSelect, -1);
    // normal external RAM path still works
    m.write(0x0000, 0x0A); // enable RAM
    m.write(0xA000, 0x42);
    assert.strictEqual(m.read(0xA000), 0x42);
  });

  it('round-trips RTC state through save/load', function () {
    const m = newMBC3RTC();
    const fake = m.now();
    m.rtcSec = 11; m.rtcMin = 22; m.rtcHour = 3; m.rtcDay = 4;
    m.rtcHalt = true; m.rtcCarry = true;
    m.rtcLastSync = fake;
    m.latchRTC();
    const state = m.saveState();

    const m2 = new GameBoyMachine();
    m2.loadState(state);
    assert.strictEqual(m2.hasRTC, true);
    assert.strictEqual(m2.rtcSec, 11);
    assert.strictEqual(m2.rtcMin, 22);
    assert.strictEqual(m2.rtcHour, 3);
    assert.strictEqual(m2.rtcDay, 4);
    assert.strictEqual(m2.rtcHalt, true);
    assert.strictEqual(m2.rtcCarry, true);
    assert.deepStrictEqual(Array.from(m2.rtcLatched), Array.from(m.rtcLatched));
    assert.strictEqual(m2.rtcLastSync, fake);
  });
});
