
var assert = require('assert');
var fs = require('fs');
var vm = require('vm');

// tss audio channels are plain scripts that install themselves as globals
global.window = global;
global.self = global;
function includeInThisContext(path) {
  vm.runInThisContext(fs.readFileSync(path), path);
}
global.exports = {};
includeInThisContext('tss/js/Log.js');
includeInThisContext('tss/js/tss/PsgDeviceChannel.js');
includeInThisContext('tss/js/tss/MasterChannel.js');
includeInThisContext('tss/js/tss/AudioLooper.js');

var astrocade = require('gen/machine/astrocade.js');

const CPU_FREQ = 1789000;

// put the raster somewhere specific, then count the wait states one access costs
function waits(mach, scanline, rasterx, fn) {
  mach.scanline = scanline;
  mach.frameCycles = rasterx;
  mach.m.resetWaitStates();
  fn();
  return mach.m.resetWaitStates();
}

describe('Bally Astrocade', function () {

  // one emulated scanline is one NTSC line in the arcade and two in the console
  // (consumer mode displays each line of screen RAM twice), so both run the Z80
  // at 1.789 MHz over a 262-line frame
  it('should run the CPU at 1.789 MHz', function () {
    for (var arcade of [false, true]) {
      var mach = new astrocade.BallyAstrocade(arcade);
      var cyclesPerFrame = mach.numTotalScanlines * mach.cpuCyclesPerLine;
      assert.ok(Math.abs(cyclesPerFrame * 60 - CPU_FREQ) < CPU_FREQ * 0.01,
        'CPU runs at ' + (cyclesPerFrame * 60) + ' Hz, arcade=' + arcade);
      assert.equal(262, mach.numTotalScanlines * (arcade ? 1 : 2));
      assert.equal(31440, mach.sampleRate);
    }
  });

  // "A Z80 access cycle to this memory always results in at least one wait state"
  // -- Bally Professional Arcade Video Hardware Description (Tony Miller, 2001) p.9
  it('should wait one cycle per screen RAM access outside of active video', function () {
    var mach = new astrocade.BallyAstrocade(false);
    var vblank = mach.numVisibleScanlines + 10;
    assert.equal(1, waits(mach, vblank, 0, () => mach.write(0x4000, 0x55)));
    assert.equal(1, waits(mach, vblank, 0, () => mach.m.membus.read(0x4000)));
    assert.equal(1, waits(mach, vblank, 0, () => mach.write(0x0000, 0x55))); // magic write
    // ...and during the border/hblank part of a visible line, too
    var hblank = mach.cpuCyclesPerLine - 1;
    assert.equal(1, waits(mach, 50, hblank, () => mach.write(0x4000, 0x55)));
  });

  it('should not wait for ROM', function () {
    var mach = new astrocade.BallyAstrocade(false);
    assert.equal(0, waits(mach, 50, 0, () => mach.m.membus.read(0x0000))); // BIOS
    assert.equal(0, waits(mach, 50, 0, () => mach.m.membus.read(0x2000))); // cart
  });

  // during active video the screen refresh takes every other memory timeslot in
  // consumer mode, so half of the Z80's accesses eat a second wait state
  it('should wait 1.5 cycles on average during active video (consumer)', function () {
    var mach = new astrocade.BallyAstrocade(false);
    var n = waits(mach, 50, 0, () => {
      for (var i = 0; i < 8; i++) mach.write(0x4000 + i, 0x55);
    });
    assert.equal(12, n);
  });

  // in commercial mode it reads four bytes at a time, so it only takes one
  // timeslot in four and only a quarter of the accesses wait twice
  it('should wait 1.25 cycles on average during active video (arcade)', function () {
    var mach = new astrocade.BallyAstrocade(true);
    var n = waits(mach, 50, 0, () => {
      for (var i = 0; i < 8; i++) mach.write(0x4000 + i, 0x55);
    });
    assert.equal(10, n);
    // reads are contended just the same
    n = waits(mach, 50, 0, () => {
      for (var i = 0; i < 8; i++) mach.m.membus.read(0x4000 + i);
    });
    assert.equal(10, n);
  });

  // the arcade's scratch RAM is on its own board, not the screen RAM DRAM bus
  it('should not wait for arcade scratch RAM', function () {
    var mach = new astrocade.BallyAstrocade(true);
    assert.equal(0, waits(mach, 50, 0, () => mach.write(0xd000, 0x55)));
    assert.equal(0, waits(mach, 50, 0, () => mach.m.membus.read(0xd000)));
    assert.equal(0x55, mach.read(0xd000));
  });

  // the debugger reads memory constantly; that must not stall the CPU
  it('should not wait when peeking for the debugger', function () {
    var mach = new astrocade.BallyAstrocade(false);
    var n = waits(mach, 50, 0, () => {
      for (var i = 0; i < 0x1000; i++) mach.read(0x4000 + i);
    });
    assert.equal(0, n);
  });

  // wait states have to reach the CPU's cycle count, whatever the raster is doing
  it('should charge wait states to the CPU', function () {
    for (var arcade of [false, true]) {
      var mach = new astrocade.BallyAstrocade(arcade);
      // LD HL,$4000 / LD (HL),A -- the store is 7 T-states on a plain Z80
      var prog = new Uint8Array([0x21, 0x00, 0x40, 0x77, 0x76]);
      if (arcade) mach.loadROM(prog); else mach.loadBIOS(prog);
      mach.reset();
      mach.scanline = mach.numVisibleScanlines + 10; // vblank: exactly one wait state
      mach.frameCycles = 0;
      mach.advanceCPU();          // LD HL,nn
      assert.equal(8, mach.advanceCPU(), 'arcade=' + arcade); // LD (HL),A = 7 + 1 wait
    }
  });
  // the arcade ROM image is flat: $0000-$3FFF and $8000-$BFFF map straight through
  it('should map a flat arcade ROM image', function () {
    var mach = new astrocade.BallyAstrocade(true);
    var rom = new Uint8Array(0xc000);
    rom[0x0123] = 0x55;
    rom[0x8123] = 0x77;
    rom[0xbfff] = 0x99;
    mach.loadROM(rom);
    assert.equal(0x55, mach.m.membus.read(0x0123));
    assert.equal(0x77, mach.m.membus.read(0x8123));
    assert.equal(0x99, mach.m.membus.read(0xbfff));
  });

  // port $78+n: 0/1 source, 2 mode, 3 skip, 4 dest high, 5 width, 6 height (starts the blit)
  it('should run pattern board blits through the memory bus', function () {
    var mach = new astrocade.BallyAstrocade(true);
    mach.loadROM(new Uint8Array(0xc000));
    var out = (port, v) => mach.m.iobus.write(port, v);
    mach.write(0xd100, 0xaa); // static RAM, must survive
    for (var i = 0; i < 8; i++) mach.write(0x4000 + i, 0xff);
    mach.write(0xd12b, 0x00); // source byte
    out(0x7a, 0x20);          // mode: dest++, source fixed
    out(0x78, 0x2b); out(0x79, 0xd1);
    out(0x7b, 0x00);         // skip
    out(0x7c, 0x40);         // dest high
    out(0x7b, 0x01);
    out(0x7d, 0x03);         // 4 bytes wide
    out(0x7e, 0x00);         // 1 row
    for (var i = 0; i < 4; i++) assert.equal(0, mach.read(0x4000 + i), 'cleared ' + i);
    assert.equal(0xff, mach.read(0x4004));
    // height is rows - 1: two rows of two bytes, 'skip' bytes apart
    mach.write(0x4101, 0xff); mach.write(0x4102, 0xff); mach.write(0x4181, 0xff); mach.write(0x4200, 0xff);
    out(0x7a, 0x20);
    out(0x7b, 0x00); out(0x7c, 0x41); // dest $4100
    out(0x7b, 0x80);                  // skip
    out(0x7d, 0x01);
    out(0x7e, 0x01);
    assert.equal(0, mach.read(0x4100));
    assert.equal(0, mach.read(0x4101));
    assert.equal(0xff, mach.read(0x4102));
    assert.equal(0, mach.read(0x4180));
    assert.equal(0, mach.read(0x4181));
    assert.equal(0xff, mach.read(0x4200), 'no third row');
    assert.equal(0xaa, mach.read(0xd100));
  });

  // arcade horizontal drive is wired to the lightpen interrupt (INMOD bit 1 or 4)
  it('should fire the arcade lightpen interrupt every line when enabled', function () {
    for (var arcade of [false, true]) {
      var mach = new astrocade.BallyAstrocade(arcade);
      mach.connectVideo(new Uint32Array(320 * 262));
      var n = 0;
      var cpu = mach.cpu;
      var orig = cpu.interrupt;
      cpu.interrupt = function (data) { n++; mach.m.lastvec = data; };
      mach.m.iobus.write(0x0d, 0xc4);
      mach.m.iobus.write(0x0e, 0x18);
      mach.m.iobus.write(0x0f, 0xff); // line interrupt never matches a visible line
      for (var sl = 0; sl < 10; sl++) mach.m.drawScanline(sl);
      assert.equal(arcade ? 10 : 0, n, 'arcade=' + arcade);
      if (arcade) assert.equal(0xc0, mach.m.lastvec);
      cpu.interrupt = orig;
    }
  });

  // arcade screens are upright unless a vertical-monitor game asks (?options=rotate%3D-90)
  it('should only rotate the arcade screen when asked', function () {
    var mach = new astrocade.BallyAstrocade(true);
    assert.equal(0, mach.getVideoParams().rotate);
    mach.rotate = -90;
    assert.equal(-90, mach.getVideoParams().rotate);
  });
});
