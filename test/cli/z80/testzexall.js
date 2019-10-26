
var assert = require('assert');
var fs = require('fs');

var emu = require("gen/common/devices.js");
var ZilogZ80 = require("gen/common/cpu/ZilogZ80.js");
var testbin = fs.readFileSync('test/cli/z80/zexall.bin', null);
var runall = false;

describe('ZilogZ80', function() {
  it('Should pass functional tests', function() {
    assert.equal(8590, testbin.length);
    var mem = new Uint8Array(65536);
    mem.set(testbin, 0x100);
    var bus = {
      read:  (a)   => { return mem[a]; },
      write: (a,v) => { mem[a] = v; }
    };
    var iobus = {
      read:  (a)   => { return 0; },
      write: (a,v) => { }
    };
    mem[0] = 0xC3;
    mem[1] = 0x00;
    mem[2] = 0x01;       // JP 0x100 CP/M TPA
    mem[5] = 0xC9; // Return from BDOS call
    var cpu = new ZilogZ80.Z80();
    cpu.connectMemoryBus(bus);
    cpu.connectIOBus(bus);
    cpu.reset();
    let cycles = 0;
    let finish = false;
    var maxcyc = runall ? 10000000000 : 10000000;
    for (var i=0; i<maxcyc; i++) {
      cycles += cpu.advanceInsn(1);
      var pc = cpu.getPC();
      if (pc == 0x5) { // BDOS call
        var regC = cpu.saveState().BC & 0xff;
        console.log(cycles, pc, regC);
        switch (regC) {
          case 0: // reset
            finish = true;
            break;
          case 9: // print
            var regDE = cpu.saveState().DE;
            var s = "";
            while (mem[regDE] != 0x24/*'$'*/) {
              s += String.fromCharCode(mem[regDE++] & 0x7f);
            }
            console.log(s);
            break;
        }
      }
    }
    console.log("runall", runall);
    assert.equal(finish, runall);
  });
});

