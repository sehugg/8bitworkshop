"use strict";
var VICDUAL_PRESETS = [
];

// TODO: global???
window.buildZ80({
	applyContention: false
});

var VicDualPlatform = function(mainElement) {
  var self = this;
  this.__proto__ = new BaseZ80Platform();

  var cpu, ram, membus, iobus, rom;
  var video, audio, timer, pixels;
  var inputs = [0xff, 0xff, 0xff, 0xff]; // most things active low

  var XTAL = 15468000.0;
  var scanlinesPerFrame = 0x106;
	var vsyncStart = 0xec;
	var vsyncEnd = 0xf0;
  var cpuFrequency = XTAL/8;
  var hsyncFrequency = XTAL/3/scanlinesPerFrame;
  var vsyncFrequency = hsyncFrequency/0x148;
  var cpuCyclesPerLine = cpuFrequency/hsyncFrequency;
	var timerFrequency = 500; // TODO

  // TODO: programmable palette
	var palette = [
		0xffcccccc,
		0xff00ffff, // yellow
		0xff0000ff, // red
		0xff00ffff, // yellow
		0xffffff00, // cyan
		0xff00ffff, // yellow 2
		0xff00ff00, // green
		0xffffffff  // white
	];

	function drawScanline(pixels, sl) {
		if (sl >= 224) return;
		var pixofs = sl*256;
		var outi = pixofs; // starting output pixel in frame buffer
		var vramofs = (sl>>3)<<5; // offset in VRAM
		var yy = sl & 7; // y offset within tile
		for (var xx=0; xx<32; xx++) {
			var attrib = ram.mem[vramofs+xx];
      var data = ram.mem[0x800 + (attrib<<3) + yy];
			var col = (attrib>>5); // + (palbank<<3);
			var color1 = 0xff000000; // TODO
			var color2 = palette[col & 0x7]; // TODO
      for (var i=0; i<8; i++) {
        var bm = 128>>i;
        pixels[outi] = (data&bm) ? color2 : color1;
        outi++;
      }
		}
	}

  var KEYCODE_MAP = {
		37:{i:1,m:0x10,a:0}, // left arrow (P1)
    39:{i:1,m:0x20,a:0}, // right arrow (P1)
		49:{i:2,m:0x10,a:0}, // 1
    32:{i:2,m:0x20,a:0}, // space bar (P1)
    53:{i:3,m:0x08,a:1}, // 5
		50:{i:3,m:0x20,a:0}, // 2
  }

  this.getPresets = function() {
    return VICDUAL_PRESETS;
  }

  this.start = function() {
    ram = new RAM(0x1000);
    membus = {
      read: new AddressDecoder([
				[0x0000, 0x7fff, 0x3fff, function(a) { return rom ? rom[a] : null; }],
				[0x8000, 0xffff, 0x0fff, function(a) { return ram.mem[a]; }],
			]),
			write: new AddressDecoder([
				[0x8000, 0xffff, 0x0fff, function(a,v) { ram.mem[a] = v; }],
			]),
      isContended: function() { return false; },
    };
    iobus = {
      read: function(addr) { return inputs[addr&3]; },
    	write: function(addr, val) {
				if (addr & 0x1) { }; // audio 1
				if (addr & 0x2) { }; // audio 2
				if (addr & 0x8) { }; // coin status
				if (addr & 0x40) { }; // palette
    	}
    };
    cpu = window.Z80({
  		display: {},
  		memory: membus,
  		ioBus: iobus
  	});
    video = new RasterVideo(mainElement,256,224,{rotate:-90});
    audio = new SampleAudio(cpuFrequency);
    video.create();
    var idata = video.getFrameData();
    video.setKeyboardEvents(function(key,code,flags) {
      var o = KEYCODE_MAP[key];
      if (o) {
        if ((flags^o.a) & 1) {
					inputs[o.i] &= ~o.m;
        } else {
					inputs[o.i] |= o.m;
        }
        // reset CPU when coin inserted
        if (o.i==3 && o.m==0x8) cpu.reset();
      }
    });
    pixels = video.getFrameData();
    timer = new AnimationTimer(60, function() {
			if (!self.isRunning())
				return;
      var debugCond = self.getDebugCallback();
      var targetTstates = cpu.getTstates();
      for (var sl=0; sl<scanlinesPerFrame; sl++) {
				drawScanline(pixels, sl);
        targetTstates += cpuCyclesPerLine;
				if (sl == vsyncStart) inputs[1] |= 0x8;
				if (sl == vsyncEnd) inputs[1] &= ~0x8;
        if (debugCond) {
          while (cpu.getTstates() < targetTstates) {
            if (debugCond && debugCond()) { debugCond = null; }
            cpu.runFrame(cpu.getTstates() + 1);
          }
        } else {
          cpu.runFrame(targetTstates);
        }
      }
      video.updateFrame();
      self.restartDebugState();
    });
  }

  this.loadROM = function(title, data) {
    rom = padBytes(data, 0x4000);
    self.reset();
  }

  this.loadState = function(state) {
    cpu.loadState(state.c);
    ram.mem.set(state.b);
    inputs[0] = state.in0;
    inputs[1] = state.in1;
    inputs[2] = state.in2;
		inputs[3] = state.in3;
  }
  this.saveState = function() {
    return {
      c:self.getCPUState(),
      b:ram.mem.slice(0),
      in0:inputs[0],
      in1:inputs[1],
      in2:inputs[2],
			in3:inputs[3],
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
    audio.stop();
  }
  this.resume = function() {
    timer.start();
    audio.start();
  }
  this.reset = function() {
    cpu.reset();
    if (!this.getDebugCallback()) cpu.setTstates(0); // TODO?
  }
  this.readAddress = function(addr) {
    return membus.read(addr); // TODO?
  }
}

PLATFORMS['vicdual'] = VicDualPlatform;
