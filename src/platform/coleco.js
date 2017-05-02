"use strict";

// http://www.colecovision.eu/ColecoVision/development/tutorial1.shtml
// http://www.colecovision.eu/ColecoVision/development/libcv.shtml
// http://www.kernelcrash.com/blog/recreating-the-colecovision/2016/01/27/
// http://www.atarihq.com/danb/files/CV-Tech.txt
// http://www.colecoboxart.com/faq/FAQ05.htm
// http://www.theadamresource.com/manuals/technical/Jeffcoleco.html
// http://bifi.msxnet.org/msxnet//tech/tms9918a.txt
// http://www.colecovision.dk/tools.htm?refreshed

var ColecoVision_PRESETS = [
  {id:'text.c', name:'Text Mode'},
  {id:'hello.c', name:'Scrolling Text'},
  {id:'text32.c', name:'32-Column Text'},
  {id:'stars.c', name:'Scrolling Starfield'},
  {id:'cursorsmooth.c', name:'Moving Cursor'},
  {id:'simplemusic.c', name:'Simple Music'},
  {id:'siegegame.c', name:'Siege Game'},
];

// doesn't work, use MAME
var ColecoVisionPlatform = function(mainElement) {
  var self = this;
  this.__proto__ = new BaseZ80Platform();

  var cpu, ram, membus, iobus, rom, bios;
  var video, audio, psg, timer, pixels;
  var inputs = [0xff, 0xff, 0xff, 0xff^0x8]; // most things active low
	var palbank = 0;

  var XTAL = 3579545*2;
  var totalScanlinesPerFrame = 262.5;
  var visibleScanlinesPerFrame = 192;
  var visiblePixelsPerScanline = 256;
  var cpuFrequency = XTAL/2;
  var hsyncFrequency = XTAL*3/(2*322);
  var vsyncFrequency = hsyncFrequency/totalScanlinesPerFrame;
  var cpuCyclesPerLine = cpuFrequency/hsyncFrequency;
  var framestats;

  function RGB(r,g,b) {
    return (r << 0) + (g << 8) + (b << 16) | 0xff000000;
  }

  var palette = [
    RGB(0x00,0x00,0x00),RGB(0x00,0x00,0x00),RGB(0x47,0xB7,0x3B),RGB(0x7C,0xCF,0x6F),
    RGB(0x5D,0x4E,0xFF),RGB(0x80,0x72,0xFF),RGB(0xB6,0x62,0x47),RGB(0x5D,0xC8,0xED),
    RGB(0xD7,0x6B,0x48),RGB(0xFB,0x8F,0x6C),RGB(0xC3,0xCD,0x41),RGB(0xD3,0xDA,0x76),
    RGB(0x3E,0x9F,0x2F),RGB(0xB6,0x64,0xC7),RGB(0xCC,0xCC,0xCC),RGB(0xFF,0xFF,0xFF)
  ];

	// videoram 0xc000-0xc3ff
	// RAM      0xc400-0xc7ff
	// charram  0xc800-0xcfff
	function drawScanline(pixels, sl) {
		if (sl >= visibleScanlinesPerFrame) return;
		var pixofs = sl * 256;
		var outi = pixofs; // starting output pixel in frame buffer
		var vramofs = (sl>>3)<<5; // offset in VRAM
		var yy = sl & 7; // y offset within tile
		for (var xx=0; xx<32; xx++) {
			var code = ram.mem[vramofs+xx];
      var data = ram.mem[0x800 + (code<<3) + yy];
			var col = (code>>5) + (palbank<<3);
			var color1 = palette[col&15];
			var color2 = 0;
      for (var i=0; i<8; i++) {
        var bm = 128>>i;
        pixels[outi] = (data&bm) ? color2 : color1;
        outi++;
      }
		}
	}

	var CARNIVAL_KEYCODE_MAP = makeKeycodeMap([
		[Keys.VK_SPACE, 2, -0x20],
    [Keys.VK_SHIFT, 2, -0x40],
		[Keys.VK_LEFT, 1, -0x10],
		[Keys.VK_RIGHT, 1, -0x20],
    [Keys.VK_UP, 1, -0x40],
		[Keys.VK_DOWN, 1, -0x80],
		[Keys.VK_1, 2, -0x10],
		[Keys.VK_2, 3, -0x20],
		[Keys.VK_5, 3, 0x8],
  ]);

  this.getPresets = function() {
    return ColecoVision_PRESETS;
  }

  this.start = function() {
    ram = new RAM(0x400);
    //bios = COLECO_BIOS;
    membus = {
      read: new AddressDecoder([
				[0x0000, 0x1fff, 0x1fff, function(a) { return bios ? bios[a] : null; }],
				[0x6000, 0x7fff, 0x3ff, function(a) { return ram.mem[a]; }],
			]),
			write: new AddressDecoder([
				[0x6000, 0x7fff, 0x3ff, function(a,v) { ram.mem[a] = v; }],
			]),
      isContended: function() { return false; },
    };
    this.readAddress = membus.read;
    iobus = {
      read: function(addr) {
        return inputs[addr&3];
      },
    	write: function(addr, val) {
        console.log(addr,val);
    	}
    };
    cpu = this.newCPU(membus, iobus);
    video = new RasterVideo(mainElement,visiblePixelsPerScanline,visibleScanlinesPerFrame);
    audio = new MasterAudio();
		psg = new AY38910_Audio(audio);
    //var speech = new VotraxSpeech();
    //audio.master.addChannel(speech);
    video.create();
    var idata = video.getFrameData();
		setKeyboardFromMap(video, inputs, CARNIVAL_KEYCODE_MAP);
    pixels = video.getFrameData();
    timer = new AnimationTimer(60, function() {
			if (!self.isRunning())
				return;
      var debugCond = self.getDebugCallback();
      var targetTstates = cpu.getTstates();
      for (var sl=0; sl<visibleScanlinesPerFrame; sl++) {
				drawScanline(pixels, sl);
        targetTstates += cpuCyclesPerLine;
        self.runCPU(cpu, targetTstates - cpu.getTstates());
      }
      video.updateFrame();
      self.restartDebugState();
    });
  }

  this.loadROM = function(title, data) {
    rom = padBytes(data, 0x8000);
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
    return timer && timer.isRunning();
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
		psg.reset();
    if (!this.getDebugCallback()) cpu.setTstates(0); // TODO?
  }
}

/// MAME support

var ColecoVisionMAMEPlatform = function(mainElement) {
  var self = this;
  this.__proto__ = new BaseMAMEPlatform();

//
  this.start = function() {
    self.startModule(mainElement, {
      jsfile:'mamecoleco.js',
      cfgfile:'coleco.cfg',
      biosfile:'coleco/313 10031-4005 73108a.u2',
      driver:'coleco',
      width:280*2,
      height:216*2,
      romfn:'/emulator/cart.rom',
      romsize:0x8000,
      preInit:function(_self) {
        /*
        console.log("Writing BIOS");
        var dir = '/roms/coleco';
        FS.mkdir('/roms');
        FS.mkdir(dir);
        FS.writeFile(dir + "/313 10031-4005 73108a.u2", COLECO_BIOS, {encoding:'binary'});
        */
      },
    });
  }

  this.loadROM = function(title, data) {
    this.loadRegion(":coleco_cart:rom", data);
  }

  this.getPresets = function() { return ColecoVision_PRESETS; }

  this.getToolForFilename = getToolForFilename_z80;
  this.getDefaultExtension = function() { return ".c"; };
}

///

PLATFORMS['coleco'] = ColecoVisionMAMEPlatform;
