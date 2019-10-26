
var assert = require('assert');
var fs = require('fs');

var emu = require("gen/common/devices.js");
var MOS6502 = require("gen/common/cpu/MOS6502.js");
var testbin = fs.readFileSync('test/cli/6502/6502_functional_test.bin', null);

describe('MOS6502', function() {
  it('Should pass functional tests', function() {
    assert.equal(65536, testbin.length);
    var mem = new Uint8Array(testbin);
    var bus = {
      read:  (a)   => { return mem[a]; },
      write: (a,v) => { mem[a] = v; }
    };
    var cpu = new MOS6502.MOS6502();
    cpu.connectMemoryBus(bus);
    cpu.reset();
    var s0 = cpu.saveState();
    s0.PC = 0x400;
    cpu.loadState(s0);
    for (var i=0; i<100000000; i++) {
      //console.log(cpu.isStable(), cpu.saveState().o);
      cpu.advanceClock();
      var pc = cpu.getPC();
      if (pc == 0x3469) break; // success!
    }
    console.log(i+' cycles, PC = $'+pc.toString(16));
    assert.equal(pc, 0x3469);
    // NMI trap
    cpu.interrupt(1);
    for (var i=0; i<20; i++) {
      cpu.advanceClock();
      var pc = cpu.getPC();
      if (pc == 0x379e) break;
    }
    assert.equal(pc, 0x379e);
    // hooks
    mem.set(testbin);
    cpu.loadState(s0);
    var pcs = [];
    var profiler = {
      logExecute: function(a) { pcs.push(a); },
      logRead:    function(a) { pcs.push(a); },
      logWrite:   function(a) { pcs.push(a); },
    };
  });
});

