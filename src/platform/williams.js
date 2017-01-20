
"use strict";
var WILLIAMS_PRESETS = [
];

var WilliamsPlatform = function(mainElement) {
  var self = this;
  this.__proto__ = new Base6809Platform();

  var cpu, ram, membus, iobus, rom, nvram;
  var video, timer, pixels, displayPCs;
  var banksel = 0;
  var watchdog_counter;
  var video_counter;
  var pia6821 = [0,0,0,0,0,0,0,0];
  var screenNeedsRefresh = false;

  var xtal = 12000000;
  var cpuFrequency = xtal/3/4;
  var cpuCyclesPerFrame = cpuFrequency/60; // TODO
  var INITIAL_WATCHDOG = 64;
  var PIXEL_ON = 0xffeeeeee;
  var PIXEL_OFF = 0xff000000;

  var KEYCODE_MAP = makeKeycodeMap([
    [Keys.VK_SPACE, 4, 0x1],
    [Keys.VK_RIGHT, 4, 0x2],
    [Keys.VK_Z, 4, 0x4],
    [Keys.VK_X, 4, 0x8],
    [Keys.VK_2, 4, 0x10],
    [Keys.VK_1, 4, 0x20],
    [Keys.VK_LEFT, 4, 0x40],
    [Keys.VK_DOWN, 4, 0x80],
    [Keys.VK_UP, 6, 0x1],
    [Keys.VK_5, 0, 0x4],
    [Keys.VK_7, 0, 0x1],
    [Keys.VK_8, 0, 0x2],
    [Keys.VK_9, 0, 0x8],
  ]);

  var palette = [];
  for (var ii=0; ii<16; ii++)
    palette[ii] = 0xff000000;

  this.getPresets = function() {
    return WILLIAMS_PRESETS;
  }

  var ioread = new AddressDecoder([
    [0x400, 0x5ff, 0x1ff, function(a) { return nvram.mem[a]; }],
    [0x800, 0x800, 0,     function(a) { return video_counter; }],
    [0xc00, 0xc07, 0x7,   function(a) { return pia6821[a]; }],
    [0x0,   0xfff, 0,     function(a) { console.log('ioread',hex(a)); }],
  ]);

  var iowrite = new AddressDecoder([
    [0x0, 0xf, 0xf, function(a,v) {
      // RRRGGGBB
      var color = 0xff000000 | ((v&7)<<5) | (((v>>3)&7)<<13) | (((v>>6)<<22));
      if (color != palette[a]) {
        palette[a] = color;
        screenNeedsRefresh = true;
      }
    }],
    [0x3fc, 0x3ff, 0,     function(a,v) { if (v == 56) watchdog_counter = INITIAL_WATCHDOG; }], // TODO: check value?
    [0x400, 0x5ff, 0x1ff, function(a,v) { nvram.mem[a] = v; }],
    [0xc00, 0xc07, 0x7,   function(a,v) { pia6821[a] = v; }],
    [0x0,   0xfff, 0,     function(a,v) { console.log('iowrite',hex(a),hex(v)); }],
  ]);

  function drawDisplayByte(a,v) {
    var ofs = ((a&0xff00)<<1) | ((a&0xff)^0xff);
    pixels[ofs] = palette[v>>4];
    pixels[ofs+256] = palette[v&0xf];
  }

  this.start = function() {
    ram = new RAM(0xc000);
    nvram = new RAM(0x200);
    // TODO: save in browser storage?
    nvram.mem.set([240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,242,241,242,247,240,244,244,245,242,244,250,240,241,248,243,241,245,245,243,244,241,244,253,240,241,245,249,242,240,244,252,244,245,244,244,240,241,244,242,248,245,245,240,244,247,244,244,240,241,242,245,242,240,244,243,245,242,244,242,240,241,241,240,243,245,244,253,245,242,245,243,240,240,248,242,246,245,245,243,245,243,245,242,240,240,246,240,241,240,245,244,244,253,244,248,240,240,245,250,240,241,240,240,240,243,240,243,240,241,240,244,240,241,240,241,240,240,240,240,240,240,240,245,241,245,240,241,240,245,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240,240]);
    displayPCs = new Uint16Array(new ArrayBuffer(0x9800*2));
    rom = padBytes(new lzgmini().decode(DEFENDER_ROM).slice(0), 0x7000);
    membus = {
      read: new AddressDecoder([
        [0x0000, 0xbfff, 0xffff, function(a) { return ram.mem[a]; }],
        [0xc000, 0xcfff, 0x0fff, function(a) {
          switch (banksel) {
            case 0: return ioread(a);
            case 1: return rom[a+0x3000];
            case 2: return rom[a+0x4000];
            case 3: return rom[a+0x5000];
            case 4:
            case 5:
            case 6:
            case 7: return rom[a+0x6000];
            default: return 0; // TODO: error light
          }
        }],
				[0xd000, 0xffff, 0xffff, function(a) { return rom ? rom[a-0xd000] : 0; }],
			]),
			write: new AddressDecoder([
        [0x9800, 0xbfff, 0, function(a,v) { ram.mem[a] = v; }],
				[0x0000, 0x97ff, 0, function(a,v) {
					ram.mem[a] = v;
          drawDisplayByte(a, v);
					displayPCs[a] = cpu.getPC(); // save program counter
				}],
        [0xc000, 0xcfff, 0x0fff, iowrite],
        [0xd000, 0xdfff, 0, function(a,v) { banksel = v&0x7; }],
        [0, 0xffff, 0, function(a,v) { console.log(hex(a), hex(v)); }],
			]),
    };
    cpu = new CPU6809();
    cpu.init(membus.write, membus.read, 0);
    video = new RasterVideo(mainElement,256,304,{rotate:-90});
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
        console.log(key,code,flags,o);
        if (flags & 1) {
          pia6821[o.index] |= o.mask;
        } else {
          pia6821[o.index] &= ~o.mask;
        }
      }
    });
    pixels = video.getFrameData();
    timer = new AnimationTimer(60, function() {
			if (!self.isRunning())
				return;
      var debugCond = self.getDebugCallback();
      // interrupts happen every 1/4 of the screen
      for (var quarter=0; quarter<4; quarter++) {
        video_counter = (quarter & 1) ? 0xff : 0x00;
        if (pia6821[7] == 0x3c) { // TODO?
          cpu.interrupt();
          //console.log(cpu.getPC());
        }
        var targetTstates = cpu.T() + cpuCyclesPerFrame/4;
        if (debugCond) {
          while (cpu.T() < targetTstates) {
            if (debugCond && debugCond()) {
              debugCond = null;
              break;
            }
            cpu.steps(1);
          }
        } else {
          cpu.steps(cpuCyclesPerFrame);
        }
      }
      if (screenNeedsRefresh) {
        for (var i=0; i<0x9800; i++)
          drawDisplayByte(i, ram.mem[i]);
        screenNeedsRefresh = false;
      }
      video.updateFrame();
      if (watchdog_counter-- <= 0) {
        console.log("WATCHDOG FIRED, PC =", cpu.getPC().toString(16)); // TODO: alert on video
        // TODO: self.breakpointHit(cpu.T());
        self.reset();
      }
      self.restartDebugState();
    });
  }

  this.loadROM = function(title, data) {
    // TODO
    self.reset();
  }

  this.loadState = function(state) {
    cpu.loadState(state.c);
    ram.mem.set(state.b);
    nvram.mem.set(state.nvram);
    watchdog_counter = state.wdc;
    banksel = state.bs;
    pia6821 = state.pia;
  }
  this.saveState = function() {
    return {
      c:self.getCPUState(),
      b:ram.mem.slice(0),
      nvram:nvram.mem.slice(0),
      wdc:watchdog_counter,
      bs:banksel,
      pia:pia6821,
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
    watchdog_counter = INITIAL_WATCHDOG;
  }
  this.readAddress = function(addr) {
    return membus.read(addr);
  }
}

PLATFORMS['williams'] = WilliamsPlatform;
