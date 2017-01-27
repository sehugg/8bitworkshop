"use strict";
var GALAXIAN_PRESETS = [
];

// TODO: global???
window.buildZ80({
	applyContention: false
});

var GalaxianPlatform = function(mainElement) {
  var self = this;
  this.__proto__ = new BaseZ80Platform();

  var cpu, ram, vram, oram, membus, iobus, rom, palette, outlatches;
  var video, audio, timer, pixels;
  var inputs = [0xe,0x8,0x0];
	var interruptEnabled = 0;
  var starsEnabled = 0;
  var watchdog_counter;
  var frameCounter = 0;

  var XTAL = 18432000.0;
  var scanlinesPerFrame = 264;
  var cpuFrequency = XTAL/6; // 3.072 MHz
  var hsyncFrequency = XTAL/3/192/2; // 16 kHz
  var vsyncFrequency = hsyncFrequency/132/2; // 60.606060 Hz
  var vblankDuration = 1/vsyncFrequency * (20/132); // 2500 us
  var cpuCyclesPerLine = cpuFrequency/hsyncFrequency;
  var INITIAL_WATCHDOG = 256;
  var showOffscreenObjects = false;
  var stars = [];
  for (var i=0; i<256; i++)
    stars[i] = noise();

	var GALAXIAN_KEYCODE_MAP = makeKeycodeMap([
		[Keys.VK_SPACE, 0, 0x10], // P1
		[Keys.VK_LEFT, 0, 0x4],
		[Keys.VK_RIGHT, 0, 0x8],
		[Keys.VK_S, 1, 0x10], // P2
		[Keys.VK_A, 1, 0x4],
		[Keys.VK_D, 1, 0x8],
		[Keys.VK_5, 0, 0x1],
		[Keys.VK_1, 1, 0x1],
		[Keys.VK_2, 1, 0x2],
  ]);

	function drawScanline(pixels, sl) {
    if (sl < 16 && !showOffscreenObjects) return; // offscreen
    if (sl >= 240 && !showOffscreenObjects) return; // offscreen
    // draw tiles
    var pixofs = sl*264;
		var outi = pixofs; // starting output pixel in frame buffer
		for (var xx=0; xx<32; xx++) {
      var xofs = xx;
      var scroll = oram.mem[xofs*2]; // even entries control scroll position
			var attrib = oram.mem[xofs*2+1]; // odd entries control the color base
      var sl2 = (sl + scroll) & 0xff;
      var vramofs = (sl2>>3)<<5; // offset in VRAM
      var yy = sl2 & 7; // y offset within tile
      var tile = vram.mem[vramofs+xofs];
			var color0 = (attrib & 7) << 2;
      var addr = 0x2800+(tile<<3)+yy;
			var data1 = rom[addr];
      var data2 = rom[addr+0x800];
      for (var i=0; i<8; i++) {
        var bm = 128>>i;
        var color = color0 + ((data1&bm)?1:0) + ((data2&bm)?2:0);
        pixels[outi] = palette[color];
        outi++;
      }
		}
    // draw sprites
    for (var sprnum=7; sprnum>=0; sprnum--) {
      var base = (sprnum<<2) + 0x40;
      var base0 = oram.mem[base];
      var sy = 240 - (base0 - (sprnum<3)); // the first three sprites match against y-1
      var yy = (sl - sy);
      if (yy >= 0 && yy < 16) {
        var sx = oram.mem[base+3] + 1; // +1 pixel offset from tiles
        if (sx == 0 && !showOffscreenObjects)
          continue; // drawn off-buffer
        var code = oram.mem[base+1];
        var flipx = code & 0x40; // TODO
        var flipy = code & 0x80; // TODO
        code &= 0x3f;
        var color0 = oram.mem[base+2] << 2;
        var addr = 0x2800+(code<<5)+(yy<8?yy:yy+8);
        outi = pixofs + sx; //<< 1
        var data1 = rom[addr];
        var data2 = rom[addr+0x800];
  			for (var i=0; i<8; i++) {
          var bm = 128>>i;
          var color = ((data1&bm)?1:0) + ((data2&bm)?2:0);
          if (color)
  				    pixels[outi+i] = palette[color0 + color];
        }
        var data1 = rom[addr+8];
        var data2 = rom[addr+0x808];
  			for (var i=0; i<8; i++) {
          var bm = 128>>i;
          var color = ((data1&bm)?1:0) + ((data2&bm)?2:0);
          if (color)
              pixels[outi+i+8] = palette[color0 + color];
        }
      }
    }
    // draw bullets/shells
    var shell = 0xff;
    var missile = 0xff;
    for (var which=0; which<8; which++) {
      var sy = oram.mem[0x60 + (which<<2)+1];
      if (((sy + sl - (which<3))&0xff) == 0xff) {
        if (which != 7)
          shell = which;
        else
          missile = which;
      }
    }
    for (var which of [shell,missile]) {
      if (which != 0xff) {
        var sx = 255 - oram.mem[0x60 + (which<<2)+3];
        var outi = pixofs+sx;
        var col = which == 7 ? 0xffffff00 : 0xffffffff;
        pixels[outi++] = col;
        pixels[outi++] = col;
        pixels[outi++] = col;
        pixels[outi++] = col;
      }
    }
    // draw stars
    if (starsEnabled) {
      var starx = ((frameCounter + stars[sl & 0xff]) & 0xff);
      if ((starx + sl) & 0x10) {
        var outi = pixofs + starx;
        if ((pixels[outi] & 0xffffff) == 0) {
          pixels[outi] = palette[sl & 0x1f];
        }
      }
    }
	}

  this.getPresets = function() {
    return GALAXIAN_PRESETS;
  }

  this.start = function() {
    ram = new RAM(0x400);
    vram = new RAM(0x400);
    oram = new RAM(0x100);
		outlatches = new RAM(0x8);
    membus = {
      read: new AddressDecoder([
				[0x0000, 0x3fff, 0,      function(a) { return rom ? rom[a] : null; }],
				[0x4000, 0x47ff, 0x3ff,  function(a) { return ram.mem[a]; }],
				[0x5000, 0x57ff, 0x3ff,  function(a) { return vram.mem[a]; }],
				[0x5800, 0x5fff, 0xff,   function(a) { return oram.mem[a]; }],
				[0x6000, 0x6000, 0,      function(a) { return inputs[0]; }],
				[0x6800, 0x6800, 0,      function(a) { return inputs[1]; }],
				[0x7000, 0x7000, 0,      function(a) { return inputs[2]; }],
				[0x7800, 0x7800, 0,      function(a) { watchdog_counter = INITIAL_WATCHDOG; }],
			]),
			write: new AddressDecoder([
				[0x4000, 0x47ff, 0x3ff,  function(a,v) { ram.mem[a] = v; }],
				[0x5000, 0x57ff, 0x3ff,  function(a,v) { vram.mem[a] = v; }],
				[0x5800, 0x5fff, 0xff,   function(a,v) { oram.mem[a] = v; }],
				[0x6004, 0x6007, 0x3,    function(a,v) { }], // lfo freq
				[0x6800, 0x6807, 0x7,    function(a,v) { }], // sound
				[0x7800, 0x7800, 0x7,    function(a,v) { }], // pitch
				[0x6000, 0x6003, 0x3,    function(a,v) { outlatches.mem[a] = v; }],
				[0x7001, 0x7001, 0,      function(a,v) { interruptEnabled = v; }],
				[0x7004, 0x7004, 0,      function(a,v) { starsEnabled = v; }],
			]),
      isContended: function() { return false; },
    };
    iobus = {
      read: function(addr) {
        console.log('IO read', hex(addr,4));
        return 0;
    	},
    	write: function(addr, val) {
        console.log('IO write', hex(addr,4), hex(val,2));
    	}
    };
    cpu = window.Z80({
  		display: {},
  		memory: membus,
  		ioBus: iobus
  	});
    video = new RasterVideo(mainElement,264,264,{rotate:90});
		audio = new MasterAudio();
    video.create();
    var idata = video.getFrameData();
		setKeyboardFromMap(video, inputs, GALAXIAN_KEYCODE_MAP);
    pixels = video.getFrameData();
    timer = new AnimationTimer(60, function() {
			if (!self.isRunning())
				return;
      var debugCond = self.getDebugCallback();
      var targetTstates = cpu.getTstates();
			// TODO: get raster position
      for (var sl=0; sl<scanlinesPerFrame; sl++) {
				drawScanline(pixels, sl);
        targetTstates += cpuCyclesPerLine;
        if (debugCond) {
          while (cpu.getTstates() < targetTstates) {
            if (debugCond && debugCond()) { debugCond = null; }
            cpu.runFrame(cpu.getTstates() + 1);
          }
        } else {
          cpu.runFrame(targetTstates);
        }
      }
      // visible area is 256x224 (before rotation)
      video.updateFrame(0, 0, 0, 0, showOffscreenObjects ? 264 : 256, 264);
      frameCounter = (frameCounter + 1) & 0xff;
      if (watchdog_counter-- <= 0) {
        console.log("WATCHDOG FIRED, PC ", hex(cpu.getPC())); // TODO: alert on video
        self.reset();
      }
      self.restartDebugState();
      // NMI interrupt @ 0x66
			if (interruptEnabled) { cpu.nonMaskableInterrupt(); }
    });
  }

	var bitcolors = [
		0x000021, 0x000047, 0x000097, // red
		0x002100, 0x004700, 0x009700, // green
		0x510000, 0xae0000            // blue
	];

  this.loadROM = function(title, data) {
    rom = padBytes(data, 0x4000);
		// palette is at 0x3800-0x381f
		palette = new Uint32Array(new ArrayBuffer(32*4));
		for (var i=0; i<32; i++) {
			var b = rom[0x3800+i];
			palette[i] = 0xff000000;
			for (var j=0; j<8; j++)
				if (((1<<j) & b))
					palette[i] += bitcolors[j];
		}
    self.reset();
  }

  this.loadState = function(state) {
    cpu.loadState(state.c);
    ram.mem.set(state.b);
		vram.mem.set(state.bv);
		oram.mem.set(state.bo);
    watchdog_counter = state.wdc;
		interruptEnabled = state.ie;
    starsEnabled = state.se;
    frameCounter = state.fc;
    inputs[0] = state.in0;
    inputs[1] = state.in1;
    inputs[2] = state.in2;
  }
  this.saveState = function() {
    return {
      c:self.getCPUState(),
      b:ram.mem.slice(0),
			bv:vram.mem.slice(0),
			bo:oram.mem.slice(0),
      fc:frameCounter,
			ie:interruptEnabled,
      se:starsEnabled,
      wdc:watchdog_counter,
      in0:inputs[0],
      in1:inputs[1],
      in2:inputs[2],
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
		//audio.reset();
    if (!this.getDebugCallback()) cpu.setTstates(0); // TODO?
    watchdog_counter = INITIAL_WATCHDOG;
  }
  this.readAddress = function(addr) {
    return membus.read(addr); // TODO?
  }
}

PLATFORMS['galaxian'] = GalaxianPlatform;
