"use strict";

var wtu = require('../workertestutils.js');
includeInThisContext('src/common/cpu/z80.js');
if (!global.buildZ80) global.buildZ80 = global.window.buildZ80;

var Memory = function(dump) {
	var self = {};

	var mem;
	var initialMem;

	self.clear = function() {
		mem = new Uint8Array(0x10000);
		for (var i = 0; i < 0x10000; i += 4) {
			mem[i] = 0xde; mem[i+1] = 0xad; mem[i+2] = 0xbe; mem[i+3] = 0xef;
		}
		initialMem = new Uint8Array(0x10000);
		for (var i = 0; i < 0x10000; i += 4) {
			initialMem[i] = 0xde; initialMem[i+1] = 0xad; initialMem[i+2] = 0xbe; initialMem[i+3] = 0xef;
		}
	}

	self.isContended = function(addr) {
		return ((addr & 0xc000) == 0x4000);
	}

	self.contend = function(addr, tstate) {
		if (self.oncontend) self.oncontend(addr);
		return 0;
	}

	self.read = function(addr) {
		var val = mem[addr];
		if (self.onread) self.onread(addr, val);
		return val;
	}
	self.write = function(addr, val) {
		mem[addr] = val;
		if (self.onwrite) self.onwrite(addr, val);
	}
	self.initialWrite = function(addr, val) {
		mem[addr] = val;
		initialMem[addr] = val;
	}
	self.dump = function() {
		for (var i = 0; i < mem.length; i++) {
			if((initialMem[i]) != (mem[i])) {
				var changeReport = hexWord(i);
				while ((initialMem[i]) != (mem[i]) && i < mem.length) {
					changeReport += ' ' + hexByte(mem[i]);
					i++;
				}
				dump(changeReport + ' -1');
			}
		}
	}

	return self;
}

var IOBus = function() {
	var self = {};

	self.read = function(addr) {
		var val = addr >> 8;
		if (self.onread) self.onread(addr, val);
		return val;
	}
	self.write = function(addr, val) {
		if (self.onwrite) self.onwrite(addr, val);
	}
	self.isULAPort = function(addr) {
		return ((addr & 0x0001) == 0x0000);
	}
	self.contend = function(addr) {
		if (self.oncontend) self.oncontend(addr);
		return 0;
	}

	return self;
}

function runTest(input, expected) {

	var output = "";
	function dump(line) {
		output += line + "\n";
	}

	var memory = Memory(dump);
	var ioBus = IOBus();
	var z80 = global.Z80({
		display: {},
		memory: memory,
		ioBus: ioBus
	});
	memory.oncontend = function(addr) {
		dump(('     ' + z80.getTstates()).substr(-5) + ' MC ' + hexWord(addr));
	}
	memory.onread = function(addr, val) {
		dump(('     ' + z80.getTstates()).substr(-5) + ' MR ' + hexWord(addr) + ' ' + hexByte(val));
	}
	memory.onwrite = function(addr, val) {
		dump(('     ' + z80.getTstates()).substr(-5) + ' MW ' + hexWord(addr) + ' ' + hexByte(val));
	}
	ioBus.onread = function(addr, val) {
		dump(('     ' + z80.getTstates()).substr(-5) + ' PR ' + hexWord(addr) + ' ' + hexByte(val));
	}
	ioBus.onwrite = function(addr, val) {
		dump(('     ' + z80.getTstates()).substr(-5) + ' PW ' + hexWord(addr) + ' ' + hexByte(val));
	}
	ioBus.oncontend = function(addr) {
		dump(('     ' + z80.getTstates()).substr(-5) + ' PC ' + hexWord(addr));
	}

	var lines = input.split("\n");
	var mainRegs = lines[1].split(/\s+/); /* AF BC DE HL AF' BC' DE' HL' IX IY SP PC */
	var af = parseInt(mainRegs[0], 16); z80.setAF(af);
	var bc = parseInt(mainRegs[1], 16); z80.setBC(bc);
	var de = parseInt(mainRegs[2], 16); z80.setDE(de);
	var hl = parseInt(mainRegs[3], 16); z80.setHL(hl);
	var af_ = parseInt(mainRegs[4], 16); z80.setAF_(af_);
	var bc_ = parseInt(mainRegs[5], 16); z80.setBC_(bc_);
	var de_ = parseInt(mainRegs[6], 16); z80.setDE_(de_);
	var hl_ = parseInt(mainRegs[7], 16); z80.setHL_(hl_);
	var ix = parseInt(mainRegs[8], 16); z80.setIX(ix);
	var iy = parseInt(mainRegs[9], 16); z80.setIY(iy);
	z80.setSP(parseInt(mainRegs[10], 16));
	z80.setPC(parseInt(mainRegs[11], 16));
	var otherRegs = lines[2].split(/\s+/); /* I R IFF1 IFF2 IM <halted> <tstates> */
	z80.setI(parseInt(otherRegs[0], 16));
	z80.setR(parseInt(otherRegs[1], 16));
	z80.setIFF1(parseInt(otherRegs[2], 16));
	z80.setIFF2(parseInt(otherRegs[3], 16));
	z80.setIM(parseInt(otherRegs[4], 16));
	z80.setHalted(otherRegs[5] == '1');
	var runTime = parseInt(otherRegs[6]);

	memory.clear();

	for (var j=3; j<lines.length; j++) {
		var memLine = lines[j];
		var memWrites = memLine.split(/\s+/);
		var addr = parseInt(memWrites.shift(), 16);
		for (var i = 0; i < memWrites.length; i++) {
			var byte = memWrites[i];
			if (byte != '-1') {
				memory.initialWrite(addr++, parseInt(byte, 16));
			}
		}
	}

	dump(lines[0]);
	z80.setTstates(0);
	z80.runFrame(runTime);

	/* AF BC DE HL AF' BC' DE' HL' IX IY SP PC */
	dump(
		hexWord(z80.getAF()) + ' '
		+ hexWord(z80.getBC()) + ' '
		+ hexWord(z80.getDE()) + ' '
		+ hexWord(z80.getHL()) + ' '
		+ hexWord(z80.getAF_()) + ' '
		+ hexWord(z80.getBC_()) + ' '
		+ hexWord(z80.getDE_()) + ' '
		+ hexWord(z80.getHL_()) + ' '
		+ hexWord(z80.getIX()) + ' '
		+ hexWord(z80.getIY()) + ' '
		+ hexWord(z80.getSP()) + ' '
		+ hexWord(z80.getPC())
	);
	/* I R IFF1 IFF2 IM <halted> <tstates> */
	dump(
		hexByte(z80.getI()) + ' ' + hexByte(z80.getR()) + ' '
		+ z80.getIFF1() + ' ' + z80.getIFF2() + ' ' + z80.getIM() + ' ' + (z80.getHalted() ? '1' : '0') + ' ' + z80.getTstates()
	)
	/* dump memory state */
	memory.dump();
	dump('');
	return output;
}

function hexByte(num) {
	return ('00' + num.toString(16)).substr(-2);
}
function hexWord(num) {
	return ('0000' + num.toString(16)).substr(-4);
}

///

var fs = require('fs');
var assert = require('assert');
var testsIn = fs.readFileSync('test/cli/z80/tests.in', {encoding:'utf8'}).split('\n\n');
var testsExpected = fs.readFileSync('test/cli/z80/tests.expected', {encoding:'utf8'}).split('\n\n');
assert(testsIn.length == testsExpected.length);

function benchmark(cycles) {
	var memory = Memory(function() { });
	var ioBus = IOBus();
	var z80 = global.Z80({
		display: {},
		memory: memory,
		ioBus: ioBus
	});
	memory.clear();
	for (var i=0; i<0x10000; i++)
		memory.write(i, i&0xff);
	z80.setTstates(0);
	z80.runFrame(cycles);
	console.log(z80.saveState());
}

if (global.describe) {
	describe('Z80 CPU', function() {
		global.buildZ80({
			applyContention: true
		});
		global.Z80 = global.window.Z80;
		it('should execute Z80 test cases', function() {
			for (var iter=0; iter<testsIn.length; iter++) {
				var fn = function(index, input, expected) {
					var output = runTest(input);
					assert.equal(output.trim(), expected.trim());
				}.call(this, iter, testsIn[iter], testsExpected[iter]);
			}
	  });
		it('should run Z80 1M cycles', function() {
			benchmark(1164770);
		});
	});
} else {
	benchmark(100*1000000);
}
