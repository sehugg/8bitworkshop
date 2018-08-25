"use strict";

import { Platform, BaseZ80Platform  } from "../baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap } from "../emu";
import { hex } from "../util";
import { MasterAudio, AY38910_Audio } from "../audio";

const GALAXIAN_PRESETS = [
  {id:'gfxtest.c', name:'Graphics Test'},
  {id:'shoot2.c', name:'Solarian Game'},
];

const GALAXIAN_KEYCODE_MAP = makeKeycodeMap([
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

const SCRAMBLE_KEYCODE_MAP = makeKeycodeMap([
  [Keys.VK_UP,    0, -0x1], // P1
  [Keys.VK_SHIFT, 0, -0x2], // fire
  [Keys.VK_7,     0, -0x4], // credit
  [Keys.VK_SPACE, 0, -0x8], // bomb
  [Keys.VK_RIGHT, 0, -0x10],
  [Keys.VK_LEFT,  0, -0x20],
  [Keys.VK_6,     0, -0x40],
  [Keys.VK_5,     0, -0x80],
  [Keys.VK_1,     1, -0x80],
  [Keys.VK_2,     1, -0x40],
  [Keys.VK_DOWN,  2, -0x40],
  //[Keys.VK_UP,    2, -0x10],
]);


const _GalaxianPlatform = function(mainElement, options) {
  options = options || {};
  var romSize = options.romSize || 0x4000;
  var gfxBase = options.gfxBase || 0x2800;
  var palBase = options.palBase || 0x3800;
  var keyMap = options.keyMap || GALAXIAN_KEYCODE_MAP;
  var missileWidth = options.missileWidth || 4;
  var missileOffset = options.missileOffset || 0;

  var cpu;
  var ram, vram, oram : RAM;
  var membus, iobus, rom, palette, outlatches;
  var video, audio, timer, pixels;
  var psg1, psg2;
  var inputs;
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
  var INITIAL_WATCHDOG = 8;
  var showOffscreenObjects = false;
  var stars = [];
  for (var i=0; i<256; i++)
    stars[i] = noise();

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
      var addr = gfxBase+(tile<<3)+yy;
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
      var sy = 240 - (base0 - ((sprnum<3)?1:0)); // the first three sprites match against y-1
      var yy = (sl - sy);
      if (yy >= 0 && yy < 16) {
        var sx = oram.mem[base+3] + 1; // +1 pixel offset from tiles
        if (sx == 0 && !showOffscreenObjects)
          continue; // drawn off-buffer
        var code = oram.mem[base+1];
        var flipx = code & 0x40; // TODO: flipx
        if (code & 0x80) // flipy
          yy = 15-yy;
        code &= 0x3f;
        var color0 = (oram.mem[base+2] & 7) << 2;
        var addr = gfxBase+(code<<5)+(yy<8?yy:yy+8);
        outi = pixofs + sx; //<< 1
        var data1 = rom[addr];
        var data2 = rom[addr+0x800];
  			for (var i=0; i<8; i++) {
          var bm = 128>>i;
          var color = ((data1&bm)?1:0) + ((data2&bm)?2:0);
          if (color)
  				    pixels[flipx?(outi+15-i):(outi+i)] = palette[color0 + color];
        }
        var data1 = rom[addr+8];
        var data2 = rom[addr+0x808];
  			for (var i=0; i<8; i++) {
          var bm = 128>>i;
          var color = ((data1&bm)?1:0) + ((data2&bm)?2:0);
          if (color)
              pixels[flipx?(outi+7-i):(outi+i+8)] = palette[color0 + color];
        }
      }
    }
    // draw bullets/shells
    var shell = 0xff;
    var missile = 0xff;
    for (var which=0; which<8; which++) {
      var sy = oram.mem[0x60 + (which<<2)+1];
      if (((sy + sl - ((which<3)?1:0))&0xff) == 0xff) {
        if (which != 7)
          shell = which;
        else
          missile = which;
      }
    }
    for (var i=0; i<2; i++) {
      which = i ? missile : shell;
      if (which != 0xff) {
        var sx = 255 - oram.mem[0x60 + (which<<2)+3];
        var outi = pixofs+sx-missileOffset;
        var col = which == 7 ? 0xffffff00 : 0xffffffff;
        for (var j=0; j<missileWidth; j++)
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

  var m_protection_state = 0;
  var m_protection_result = 0;
  function scramble_protection_w(addr,data) {
    /*
        This is not fully understood; the low 4 bits of port C are
        inputs; the upper 4 bits are outputs. Scramble main set always
        writes sequences of 3 or more nibbles to the low port and
        expects certain results in the upper nibble afterwards.
    */
    m_protection_state = (m_protection_state << 4) | (data & 0x0f);
    switch (m_protection_state & 0xfff)
    {
            /* scramble */
            case 0xf09:     m_protection_result = 0xff; break;
            case 0xa49:     m_protection_result = 0xbf; break;
            case 0x319:     m_protection_result = 0x4f; break;
            case 0x5c9:     m_protection_result = 0x6f; break;

            /* scrambls */
            case 0x246:     m_protection_result ^= 0x80;    break;
            case 0xb5f:     m_protection_result = 0x6f; break;
    }
  }
  function scramble_protection_alt_r() {
    var bit = (m_protection_result >> 7) & 1;
    return (bit << 5) | ((bit^1) << 7);
  }
  
	const bitcolors = [
		0x000021, 0x000047, 0x000097, // red
		0x002100, 0x004700, 0x009700, // green
		0x510000, 0xae0000            // blue
	];

 class GalaxianPlatform extends BaseZ80Platform {

  getPresets() {
    return GALAXIAN_PRESETS;
  }

  start() {
    ram = new RAM(0x800);
    vram = new RAM(0x400);
    oram = new RAM(0x100);
		outlatches = new RAM(0x8);
    if (options.scramble) {
      inputs = [0xff,0xfc,0xf1];
      membus = {
        read: newAddressDecoder([
  				[0x0000, 0x3fff, 0,      function(a) { return rom ? rom[a] : null; }],
  				[0x4000, 0x47ff, 0x7ff,  function(a) { return ram.mem[a]; }],
//          [0x4800, 0x4fff, 0x3ff,  function(a) { return vram.mem[a]; }],
//  				[0x5000, 0x5fff, 0xff,   function(a) { return oram.mem[a]; }],
  				[0x7000, 0x7000, 0,      function(a) { watchdog_counter = INITIAL_WATCHDOG; }],
          [0x7800, 0x7800, 0,      function(a) { watchdog_counter = INITIAL_WATCHDOG; }],
          //[0x8000, 0x820f, 0,      function(a) { return noise(); }], // TODO: remove
          [0x8100, 0x8100, 0,      function(a) { return inputs[0]; }],
  				[0x8101, 0x8101, 0,      function(a) { return inputs[1]; }],
  				[0x8102, 0x8102, 0,      function(a) { return inputs[2] | scramble_protection_alt_r(); }],
          [0x8202, 0x8202, 0,      function(a) { return m_protection_result; }], // scramble (protection)
          [0x9100, 0x9100, 0,      function(a) { return inputs[0]; }],
  				[0x9101, 0x9101, 0,      function(a) { return inputs[1]; }],
  				[0x9102, 0x9102, 0,      function(a) { return inputs[2] | scramble_protection_alt_r(); }],
          [0x9212, 0x9212, 0,      function(a) { return m_protection_result; }], // scramble (protection)
          //[0, 0xffff, 0, function(a) { console.log(hex(a)); return 0; }]
  			]),
  			write: newAddressDecoder([
  				[0x4000, 0x47ff, 0x7ff,  function(a,v) { ram.mem[a] = v; }],
          [0x4800, 0x4fff, 0x3ff,  function(a,v) { vram.mem[a] = v; }],
  				[0x5000, 0x5fff, 0xff,   function(a,v) { oram.mem[a] = v; }],
          [0x6801, 0x6801, 0,      function(a,v) { interruptEnabled = v & 1; /*console.log(a,v,cpu.getPC().toString(16));*/ }],
          [0x6802, 0x6802, 0,      function(a,v) { /* TODO: coin counter */ }],
          [0x6803, 0x6803, 0,      function(a,v) { /* TODO: backgroundColor = (v & 1) ? 0xFF000056 : 0xFF000000; */ }],
          [0x6804, 0x6804, 0,      function(a,v) { starsEnabled = v & 1; }],
          [0x6808, 0x6808, 0,      function(a,v) { missileWidth = v; }], // not on h/w
          [0x6809, 0x6809, 0,      function(a,v) { missileOffset = v; }], // not on h/w
          [0x8202, 0x8202, 0, scramble_protection_w],
          //[0x8100, 0x8103, 0, function(a,v){ /* PPI 0 */ }],
          //[0x8200, 0x8203, 0, function(a,v){ /* PPI 1 */ }],
          //[0, 0xffff, 0, function(a,v) { console.log(hex(a),hex(v)); }]
  			]),
        isContended: function() { return false; },
      };
    } else {
      inputs = [0xe,0x8,0x0];
      membus = {
        read: newAddressDecoder([
  				[0x0000, 0x3fff, 0,      function(a) { return rom ? rom[a] : null; }],
  				[0x4000, 0x47ff, 0x3ff,  function(a) { return ram.mem[a]; }],
  				[0x5000, 0x57ff, 0x3ff,  function(a) { return vram.mem[a]; }],
  				[0x5800, 0x5fff, 0xff,   function(a) { return oram.mem[a]; }],
  				[0x6000, 0x6000, 0,      function(a) { return inputs[0]; }],
  				[0x6800, 0x6800, 0,      function(a) { return inputs[1]; }],
  				[0x7000, 0x7000, 0,      function(a) { return inputs[2]; }],
  				[0x7800, 0x7800, 0,      function(a) { watchdog_counter = INITIAL_WATCHDOG; }],
  			]),
  			write: newAddressDecoder([
  				[0x4000, 0x47ff, 0x3ff,  function(a,v) { ram.mem[a] = v; }],
  				[0x5000, 0x57ff, 0x3ff,  function(a,v) { vram.mem[a] = v; }],
  				[0x5800, 0x5fff, 0xff,   function(a,v) { oram.mem[a] = v; }],
  				//[0x6004, 0x6007, 0x3,    function(a,v) { }], // lfo freq
  				//[0x6800, 0x6807, 0x7,    function(a,v) { }], // sound
  				//[0x7800, 0x7800, 0x7,    function(a,v) { }], // pitch
  				[0x6000, 0x6003, 0x3,    function(a,v) { outlatches.mem[a] = v; }],
  				[0x7001, 0x7001, 0,      function(a,v) { interruptEnabled = v & 1; }],
  				[0x7004, 0x7004, 0,      function(a,v) { starsEnabled = v & 1; }],
  			]),
        isContended: function() { return false; },
      };
    }
    audio = new MasterAudio();
    psg1 = new AY38910_Audio(audio);
    psg2 = new AY38910_Audio(audio);
    iobus = {
      read: function(addr) {
        return 0;
      },
    	write: function(addr, val) {
        if (addr & 0x1) { psg1.selectRegister(val & 0xf); };
				if (addr & 0x2) { psg1.setData(val); };
        if (addr & 0x4) { psg2.selectRegister(val & 0xf); };
				if (addr & 0x8) { psg2.setData(val); };
    	}
    };
    cpu = this.newCPU(membus, iobus);
    video = new RasterVideo(mainElement,264,264,{rotate:90});
    video.create();
    var idata = video.getFrameData();
		setKeyboardFromMap(video, inputs, keyMap);
    pixels = video.getFrameData();
    timer = new AnimationTimer(60, this.nextFrame.bind(this));
  }

  readAddress(a) {
    return (a == 0x7000 || a == 0x7800) ? null : membus.read(a); // ignore watchdog
  }
  
  advance(novideo : boolean) {
    for (var sl=0; sl<scanlinesPerFrame; sl++) {
      if (!novideo) {
        drawScanline(pixels, sl);
      }
      this.runCPU(cpu, cpuCyclesPerLine);
    }
    // visible area is 256x224 (before rotation)
    if (!novideo) {
      video.updateFrame(0, 0, 0, 0, showOffscreenObjects ? 264 : 256, 264);
    }
    frameCounter = (frameCounter + 1) & 0xff;
    if (watchdog_counter-- <= 0) {
      console.log("WATCHDOG FIRED, PC ", hex(cpu.getPC())); // TODO: alert on video
      this.reset();
    }
    // NMI interrupt @ 0x66
    if (interruptEnabled) { cpu.nonMaskableInterrupt(); }
  }

  loadROM(title, data) {
    rom = padBytes(data, romSize);

		palette = new Uint32Array(new ArrayBuffer(32*4));
		for (var i=0; i<32; i++) {
			var b = rom[palBase+i];
			palette[i] = 0xff000000;
			for (var j=0; j<8; j++)
				if (((1<<j) & b))
					palette[i] += bitcolors[j];
		}
    this.reset();
  }

  loadState(state) {
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
  saveState() {
    return {
      c:this.getCPUState(),
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
  loadControlsState(state) {
    inputs[0] = state.in0;
    inputs[1] = state.in1;
    inputs[2] = state.in2;
  }
  saveControlsState() {
    return {
      in0:inputs[0],
      in1:inputs[1],
      in2:inputs[2],
    };
  }
  getCPUState() {
    return cpu.saveState();
  }

  isRunning() {
    return timer && timer.isRunning();
  }
  pause() {
    timer.stop();
    audio.stop();
  }
  resume() {
    timer.start();
    audio.start();
  }
  reset() {
    cpu.reset();
		//audio.reset();
    if (!this.getDebugCallback()) cpu.setTstates(0); // TODO?
    watchdog_counter = INITIAL_WATCHDOG;
  }
 }
  
  return new GalaxianPlatform();
}

const _GalaxianScramblePlatform = function(mainElement) {
  return _GalaxianPlatform(mainElement, {
    romSize: 0x5020,
    gfxBase: 0x4000,
    palBase: 0x5000,
    scramble: true,
    keyMap: SCRAMBLE_KEYCODE_MAP,
    missileWidth: 1,
    missileOffset: 6,
  });
}

PLATFORMS['galaxian'] = _GalaxianPlatform;
PLATFORMS['galaxian-scramble'] = _GalaxianScramblePlatform;
