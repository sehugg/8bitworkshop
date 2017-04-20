
"use strict";
var VICDUAL_PRESETS = [
  {id:'minimal.c', name:'Minimal Example'},
  {id:'hello.c', name:'Hello World'},
  {id:'gfxtest.c', name:'Graphics Test'},
  {id:'soundtest.c', name:'Sound Test'},
  {id:'snake1.c', name:'Siege Game (Prototype)'},
  {id:'snake2.c', name:'Siege Game (Full)'},
  {id:'music.c', name:'Music Player'},
];

var VicDualPlatform = function(mainElement) {
  var self = this;
  this.__proto__ = new BaseZ80Platform();

  var cpu, ram, membus, iobus, rom;
  var video, audio, psg, timer, pixels, probe;
  var inputs = [0xff, 0xff, 0xff, 0xff^0x8]; // most things active low
	var palbank = 0;

  var XTAL = 15468000.0;
  var scanlinesPerFrame = 0x106;
  var vblankStart = 0xe0;
	var vsyncStart = 0xec;
	var vsyncEnd = 0xf0;
  var cpuFrequency = XTAL/8;
  var hsyncFrequency = XTAL/3/scanlinesPerFrame;
  var vsyncFrequency = hsyncFrequency/0x148;
  var cpuCyclesPerLine = cpuFrequency/hsyncFrequency;
	var timerFrequency = 500; // input 2 bit 0x8
  var cyclesPerTimerTick = cpuFrequency / (2 * timerFrequency);
  var reset_disable = false;
  var reset_disable_timer;
  var framestats;

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
    0xe0,0x60,0x20,0x60, 0xc0,0x60,0x40,0xc0,
    0x20,0x40,0x60,0x80, 0xa0,0xc0,0xe0,0x0e,
    0xe0,0xe0,0xe0,0xe0, 0x60,0x60,0x60,0x60,
    0xe0,0xe0,0xe0,0xe0, 0xe0,0xe0,0xe0,0xe0,
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
			var code = ram.mem[vramofs+xx];
      var data = ram.mem[0x800 + (code<<3) + yy];
			var col = (code>>5) + (palbank<<3);
			var color1 = palette[(colorprom[col] >> 1) & 7];
			var color2 = palette[(colorprom[col] >> 5) & 7];
      for (var i=0; i<8; i++) {
        var bm = 128>>i;
        pixels[outi] = (data&bm) ? color2 : color1;
        /* TODO
        if (framestats) {
          framestats.layers.tiles[outi] = (data&bm) ? colorprom[col+8] : colorprom[col];
        }
        */
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
    this.readMemory = membus.read;
    iobus = {
      read: function(addr) {
        return inputs[addr&3];
      },
    	write: function(addr, val) {
				if (addr & 0x1) { psg.selectRegister(val & 0xf); }; // audio 1
				if (addr & 0x2) { psg.setData(val); }; // audio 2
				if (addr & 0x8) { }; // TODO: assert coin status
				if (addr & 0x40) { palbank = val & 3; }; // palette
    	}
    };
    probe = new BusProbe(membus);
    cpu = window.Z80({
  		display: {},
  		memory: probe,
  		ioBus: iobus
  	});
    video = new RasterVideo(mainElement,256,224,{rotate:-90});
    audio = new MasterAudio();
		psg = new AY38910_Audio(audio);
    //var speech = new VotraxSpeech();
    //audio.master.addChannel(speech);
    video.create();
    var idata = video.getFrameData();
		setKeyboardFromMap(video, inputs, CARNIVAL_KEYCODE_MAP, function(o) {
			// reset when coin inserted
			if (o.index==3 && o.mask==0x8 && !reset_disable) cpu.reset();
      // don't allow repeated resets in short period of time
      reset_disable = true;
      clearTimeout(reset_disable_timer);
      reset_disable_timer = setTimeout(function() { reset_disable = false; }, 1100);
		});
    pixels = video.getFrameData();
    timer = new AnimationTimer(60, function() {
			if (!self.isRunning())
				return;
      var debugCond = self.getDebugCallback();
      var targetTstates = cpu.getTstates();
      for (var sl=0; sl<scanlinesPerFrame; sl++) {
        inputs[2] &= ~0x8;
        inputs[2] |= ((cpu.getTstates() / cyclesPerTimerTick) & 1) << 3;
				drawScanline(pixels, sl);
        targetTstates += cpuCyclesPerLine;
				if (sl == vblankStart) inputs[1] |= 0x8;
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
    if (data.length >= 0x4020 && (data[0x4000] || data[0x401f])) {
      colorprom = data.slice(0x4000,0x4020);
    }
    rom = padBytes(data, 0x4040);
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
  this.readAddress = function(addr) {
    return membus.read(addr & 0xffff); // TODO?
  }
  this.setFrameStats = function(on) {
    framestats = on ? {
      palette: palette,
      layers: {width:256, height:224, tiles:[]}
    } : null;
  }
  this.getProbe = function() { return probe; }
}

PLATFORMS['vicdual'] = VicDualPlatform;
