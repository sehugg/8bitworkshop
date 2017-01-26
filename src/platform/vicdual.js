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
	var palbank = 0;

  var XTAL = 15468000.0;
  var scanlinesPerFrame = 0x106;
	var vsyncStart = 0xec;
	var vsyncEnd = 0xf0;
  var cpuFrequency = XTAL/8;
  var hsyncFrequency = XTAL/3/scanlinesPerFrame;
  var vsyncFrequency = hsyncFrequency/0x148;
  var cpuCyclesPerLine = cpuFrequency/hsyncFrequency;
	var timerFrequency = 500; // TODO

	var palette = [
		0xff000000, // black
		0xff0000ff, // red
		0xff00ff00, // green
		0xff00ffff, // yellow
		0xffff0000, // blue
		0xffff00ff, // magenta
		0xffffff00, // cyan
		0xffffffff  // white
	];

	var colorprom = [
		0,0,0,0,0,0,0,0,
		7,3,1,3,6,3,2,6,
		7,0,0,0,0,0,0,0,
		0,1,2,3,4,5,6,7,
		4,5,6,7,0,0,0,0,
		0,0,0,0,4,5,6,7,
		1,2,4,7,0,0,0,0,
		0,0,0,0,1,2,4,7,
	];

	// videoram 0xc000-0xc3ff
	// RAM      0xc400-0xc7ff
	// charram  0xc800-0xcfff
	function drawScanline(pixels, sl) {
		if (sl >= 224) return;
		var pixofs = sl*256;
		var outi = pixofs; // starting output pixel in frame buffer
		var vramofs = (sl>>3)<<5; // offset in VRAM
		var yy = sl & 7; // y offset within tile
		for (var xx=0; xx<32; xx++) {
			var attrib = ram.mem[vramofs+xx];
      var data = ram.mem[0x800 + (attrib<<3) + yy];
			var col = (attrib>>5) + (palbank<<4);
			var color1 = palette[colorprom[col]];
			var color2 = palette[colorprom[col+8]];
      for (var i=0; i<8; i++) {
        var bm = 128>>i;
        pixels[outi] = (data&bm) ? color2 : color1;
        outi++;
      }
		}
	}

	var CARNIVAL_KEYCODE_MAP = makeKeycodeMap([
		[Keys.VK_SPACE, 2, -0x20], // P1
		[Keys.VK_LEFT, 1, -0x10],
		[Keys.VK_RIGHT, 1, -0x20],
		[Keys.VK_1, 2, -0x10],
		[Keys.VK_2, 3, -0x20],
		[Keys.VK_5, 3, 0x8],
  ]);

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
				if (addr & 0x40) { palbank = val & 3; }; // palette
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
		setKeyboardFromMap(video, inputs, CARNIVAL_KEYCODE_MAP, function(o) {
			// reset when coin inserted
			if (o.index==3 && o.mask==0x8) cpu.reset();
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
		palbank = state.pb;
  }
  this.saveState = function() {
    return {
      c:self.getCPUState(),
      b:ram.mem.slice(0),
      in0:inputs[0],
      in1:inputs[1],
      in2:inputs[2],
			in3:inputs[3],
			pb:palbank,
    };
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
