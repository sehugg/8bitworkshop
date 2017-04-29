
"use strict";
var BASEZ80_PRESETS = [
  {id:'simple1.c', name:'Multiply by 2'},
  {id:'simple2.c', name:'Divide by 4'},
  {id:'prng.c', name:'Pseudorandom Numbers'},
  {id:'fib.c', name:'Fibonacci'},
  {id:'gfx.c', name:'Graphics'},
  {id:'empty.c', name:'Your Code Here...'},
];

var Base_Z80Platform = function(mainElement) {
  var self = this;
  this.__proto__ = new BaseZ80Platform();

  var cpu, ram, membus, iobus, rom, timer;

  this.getPresets = function() {
    return BASEZ80_PRESETS;
  }

  this.start = function() {
    ram = new RAM(0x8000);
    membus = {
      read: new AddressDecoder([
				[0x0000, 0x7fff, 0x7fff, function(a) { return rom ? rom[a] : null; }],
				[0x8000, 0xffff, 0x7fff, function(a) { return ram.mem[a]; }],
			]),
			write: new AddressDecoder([
				[0x8000, 0xffff, 0x7fff, function(a,v) { ram.mem[a] = v; }],
			]),
      isContended: function() { return false; },
    };
    this.readAddress = membus.read;
    iobus = {
      read: function(addr) {
        return 0;
      },
    	write: function(addr, val) {
    	}
    };
    cpu = this.newCPU(membus, iobus);
  }

  this.loadROM = function(title, data) {
    rom = padBytes(data, 0x8000);
    self.reset();
  }

  this.loadState = function(state) {
    cpu.loadState(state.c);
    ram.mem.set(state.b);
  }
  this.saveState = function() {
    return {
      c:self.getCPUState(),
      b:ram.mem.slice(0),
    };
  }
  this.getCPUState = function() {
    return cpu.saveState();
  }

  this.isRunning = function() {
    return timer && timer.isRunning();
  }
  this.pause = function() {
    if (timer) timer.stop();
  }
  this.resume = function() {
    if (timer) timer.start();
  }
  this.reset = function() {
    cpu.reset();
    if (!this.getDebugCallback()) cpu.setTstates(0); // TODO?
  }
}

PLATFORMS['base_z80'] = Base_Z80Platform;
