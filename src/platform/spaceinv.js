"use strict";

// http://www.computerarcheology.com/Arcade/SpaceInvaders/Hardware.html

var SPACEINV_PRESETS = [
];

// TODO: global???
window.buildZ80({
	applyContention: false
});

var SpaceInvadersPlatform = function(mainElement) {
  var self = this;
  this.__proto__ = new BaseZ80Platform();

  var cpu, ram, membus, iobus, rom;
  var video, timer, pixels, displayPCs;
  var inputs = [0xe,0x8,0x0];
  var bitshift_offset = 0;
  var bitshift_register = 0;
  var watchdog_counter;
  var cpuFrequency = 1996800;
  var cpuCyclesPerLine = cpuFrequency/(60*224); // TODO
  var INITIAL_WATCHDOG = 256;
  var PIXEL_ON = 0xffeeeeee;
  var PIXEL_OFF = 0xff000000;

  var KEYCODE_MAP = {
    32:{i:1,b:4}, // space bar (P1)
    37:{i:1,b:5}, // left arrow (P1)
    39:{i:1,b:6}, // right arrow (P1)
    0x53:{i:2,b:4}, // S (P2)
    0x41:{i:2,b:5}, // A (P2)
    0x44:{i:2,b:6}, // D (P2)
    53:{i:1,b:0}, // 5
    49:{i:1,b:2}, // 1
    50:{i:1,b:1}, // 2
  }

  this.getPresets = function() {
    return SPACEINV_PRESETS;
  }

  this.start = function() {
    ram = new RAM(0x2000);
    displayPCs = new Uint16Array(new ArrayBuffer(0x2000*2));
    membus = {
      read: function(address) {
        if (address < 0x2000) {
          return (rom ? rom[address] : 0) & 0xff;
        } else {
          address &= 0x1fff;
          return ram.mem[address] & 0xff;
        }
      },
      write: function(address, value) {
        //console.log("write", hex(address,4), hex(value,2));
        if (address >= 0x2000) {
          address &= 0x1fff;
          value &= 0xff;
          ram.mem[address] = value;
          if (address >= 0x400) {
						// TODO: dirty flags
            var ofs = (address - 0x400)*8;
            for (var i=0; i<8; i++)
              pixels[ofs+i] = (value & (1<<i)) ? PIXEL_ON : PIXEL_OFF;
            displayPCs[address] = cpu.getPC(); // save program counter
          }
        }
      },
      isContended: function() { return false; },
    };
    iobus = {
      read: function(addr) {
				addr &= 0x3;
        //console.log('IO read', hex(addr,4));
        switch (addr) {
          case 0:
          case 1:
          case 2:
            return inputs[addr];
          case 3:
            return (bitshift_register >> (8-bitshift_offset)) & 0xff;
        }
        return 0;
    	},
    	write: function(addr, val) {
				addr &= 0x7;
				val &= 0xff;
        //console.log('IO write', hex(addr,4), hex(val,2));
        switch (addr) {
          case 2:
            bitshift_offset = val & 0x7;
            break;
          case 3:
          case 5:
            // TODO: sound
            break;
          case 4:
            bitshift_register = (bitshift_register >> 8) | (val << 8);
            break;
          case 6:
            watchdog_counter = INITIAL_WATCHDOG;
            break;
        }
    	}
    };
    cpu = window.Z80({
  		display: {},
  		memory: membus,
  		ioBus: iobus
  	});
    video = new RasterVideo(mainElement,256,224,{rotate:-90});
    video.create();
		$(video.canvas).click(function(e) {
			var x = Math.floor(e.offsetX * video.canvas.width / $(video.canvas).width());
			var y = Math.floor(e.offsetY * video.canvas.height / $(video.canvas).height());
			var addr = (x>>3) + (y*32) + 0x400;
			console.log(x, y, hex(addr,4), "PC", hex(displayPCs[addr],4));
		});
    var idata = video.getFrameData();
    video.setKeyboardEvents(function(key,code,flags) {
      var o = KEYCODE_MAP[key];
      if (o) {
        if (flags & 1) {
          inputs[o.i] |= (1<<o.b);
        } else {
          inputs[o.i] &= ~(1<<o.b);
        }
      }
    });
    pixels = video.getFrameData();
    timer = new AnimationTimer(60, function() {
			if (!self.isRunning())
				return;
      var debugCond = self.getDebugCallback();
      var targetTstates = cpu.getTstates();
      for (var sl=0; sl<224; sl++) {
        targetTstates += cpuCyclesPerLine;
        if (debugCond) {
          while (cpu.getTstates() < targetTstates) {
            if (debugCond && debugCond()) {
              debugCond = null;
              break;
            }
            cpu.runFrame(cpu.getTstates() + 1);
          }
          if (!debugCond)
            break;
        } else {
          cpu.runFrame(targetTstates);
        }
        if (sl == 95)
          cpu.requestInterrupt(0x8); // RST $8
        else if (sl == 223)
          cpu.requestInterrupt(0x10); // RST $10
      }
      video.updateFrame();
      if (watchdog_counter-- <= 0) {
        console.log("WATCHDOG FIRED"); // TODO: alert on video
        self.reset();
      }
      self.restartDebugState();
    });
  }

  this.loadROM = function(title, data) {
    rom = padBytes(data, 0x2000);
    self.reset();
  }

  this.loadState = function(state) {
    cpu.loadState(state.c);
    ram.mem.set(state.b);
    bitshift_register = state.bsr;
    bitshift_offset = state.bso;
    watchdog_counter = state.wdc;
    inputs[0] = state.in0;
    inputs[1] = state.in1;
    inputs[2] = state.in2;
  }
  this.saveState = function() {
    return {
      c:self.getCPUState(),
      b:ram.mem.slice(0),
      bsr:bitshift_register,
      bso:bitshift_offset,
      wdc:watchdog_counter,
      in0:inputs[0],
      in1:inputs[1],
      in2:inputs[2],
    };
  }
  this.getRAMForState = function(state) {
    return ram.mem;
  }
  this.getCPUState = function() {
    return cpu.saveState();
  }

  this.isRunning = function() {
    return timer.isRunning();
  }
  this.pause = function() {
    timer.stop();
  }
  this.resume = function() {
    timer.start();
  }
  this.reset = function() {
    cpu.reset();
    cpu.setTstates(0);
    watchdog_counter = INITIAL_WATCHDOG;
  }
  this.readAddress = function(addr) {
    return membus.read(addr);
  }

	this.ramStateToLongString = function(state) {
		return "";
		//var stack = state.b.slice(state.c.SP & 0x1fff, 0x400);
    //return "\n" + dumpRAM(stack, state.c.SP, stack.length);
  }
}

PLATFORMS['spaceinv'] = SpaceInvadersPlatform;
