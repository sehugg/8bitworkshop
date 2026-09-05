
var assert = require('assert');
var fs = require('fs');
var vm = require('vm');

// tss audio channels are plain scripts that install themselves as globals
global.window = global;
global.self = global;
function includeInThisContext(path) {
  vm.runInThisContext(fs.readFileSync(path), path);
}
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
});
