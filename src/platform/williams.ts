
import { Platform, BaseZ80Platform, Base6809Platform } from "../common/baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap } from "../common/emu";
import { hex } from "../common/util";
import { MasterAudio, WorkerSoundChannel } from "../common/audio";

var WILLIAMS_PRESETS = [
  { id: 'gfxtest.c', name: 'Graphics Test' },
  { id: 'sprites.c', name: 'Sprite Test' },
  { id: 'game1.c', name: 'Raster Paranoia Game' },
  { id: 'bitmap_rle.c', name: 'RLE Bitmap' },
];

var WilliamsPlatform = function(mainElement, proto) {
  var self = this;
  this.__proto__ = new (proto ? proto : Base6809Platform)();

  var SCREEN_HEIGHT = 304;
  var SCREEN_WIDTH = 256;

  var cpu, ram, rom, nvram;
  var portsel = 0;
  var banksel = 0;
  var watchdog_counter;
  var watchdog_enabled = false;
  var pia6821 = new RAM(8).mem;
  var blitregs = new RAM(8).mem;

  var video, timer, pixels, displayPCs;
  var screenNeedsRefresh = false;
  var membus;
  var video_counter;

  var audio, worker, workerchannel;

  var xtal = 12000000;
  var cpuFrequency = xtal / 3 / 4;
  var cpuCyclesPerFrame = cpuFrequency / 60; // TODO
  var cpuScale = 1;
  var INITIAL_WATCHDOG = 8;
  var PIXEL_ON = 0xffeeeeee;
  var PIXEL_OFF = 0xff000000;

  var DEFENDER_KEYCODE_MAP = makeKeycodeMap([
    [Keys.A, 4, 0x1],
    [Keys.RIGHT, 4, 0x2],
    [Keys.B, 4, 0x4],
    [Keys.VK_X, 4, 0x8],
    [Keys.P2_START, 4, 0x10],
    [Keys.START, 4, 0x20],
    [Keys.LEFT, 4, 0x40],
    [Keys.DOWN, 4, 0x80],
    [Keys.UP, 6, 0x1],
    [Keys.SELECT, 0, 0x4],
    [Keys.VK_7, 0, 0x1],
    [Keys.VK_8, 0, 0x2],
    [Keys.VK_9, 0, 0x8],
  ]);

  var ROBOTRON_KEYCODE_MAP = makeKeycodeMap([
    [Keys.P2_UP, 0, 0x1],
    [Keys.P2_DOWN, 0, 0x2],
    [Keys.P2_LEFT, 0, 0x4],
    [Keys.P2_RIGHT, 0, 0x8],
    [Keys.START, 0, 0x10],
    [Keys.P2_START, 0, 0x20],
    [Keys.UP, 0, 0x40],
    [Keys.DOWN, 0, 0x80],
    [Keys.LEFT, 2, 0x1],
    [Keys.RIGHT, 2, 0x2],
    [Keys.VK_7, 4, 0x1],
    [Keys.VK_8, 4, 0x2],
    [Keys.VK_6, 4, 0x4],
    [Keys.VK_9, 4, 0x8],
    [Keys.SELECT, 4, 0x10],
  ]);
  // TODO: sound board handshake

  var palette = [];
  for (var ii = 0; ii < 16; ii++)
    palette[ii] = 0xff000000;

  this.getPresets = function() {
    return WILLIAMS_PRESETS;
  }

  // Defender

  var ioread_defender = newAddressDecoder([
    [0x400, 0x5ff, 0x1ff, function(a) { return nvram.mem[a]; }],
    [0x800, 0x800, 0, function(a) { return video_counter; }],
    [0xc00, 0xc07, 0x7, function(a) { return pia6821[a]; }],
    [0x0, 0xfff, 0, function(a) { /*console.log('ioread',hex(a));*/ }],
  ]);

  var iowrite_defender = newAddressDecoder([
    [0x0, 0xf, 0xf, setPalette],
    [0x3fc, 0x3ff, 0, function(a, v) { if (v == 0x38) watchdog_counter = INITIAL_WATCHDOG; }],
    [0x400, 0x5ff, 0x1ff, function(a, v) { nvram.mem[a] = v; }],
    [0xc00, 0xc07, 0x7, function(a, v) { pia6821[a] = v; }],
    [0x0, 0xfff, 0, function(a, v) { console.log('iowrite', hex(a), hex(v)); }],
  ]);

  var memread_defender = newAddressDecoder([
    [0x0000, 0xbfff, 0xffff, function(a) { return ram.mem[a]; }],
    [0xc000, 0xcfff, 0x0fff, function(a) {
      switch (banksel) {
        case 0: return ioread_defender(a);
        case 1: return rom[a + 0x3000];
        case 2: return rom[a + 0x4000];
        case 3: return rom[a + 0x5000];
        case 7: return rom[a + 0x6000];
        default: return 0; // TODO: error light
      }
    }],
    [0xd000, 0xffff, 0xffff, function(a) { return rom ? rom[a - 0xd000] : 0; }],
  ]);

  var memwrite_defender = newAddressDecoder([
    [0x0000, 0x97ff, 0, write_display_byte],
    [0x9800, 0xbfff, 0, function(a, v) { ram.mem[a] = v; }],
    [0xc000, 0xcfff, 0x0fff, iowrite_defender],
    [0xd000, 0xdfff, 0, function(a, v) { banksel = v & 0x7; }],
    [0, 0xffff, 0, function(a, v) { console.log(hex(a), hex(v)); }],
  ]);

  // Robotron, Joust, Bubbles, Stargate

  var ioread_williams = newAddressDecoder([
    [0x804, 0x807, 0x3, function(a) { return pia6821[a]; }],
    [0x80c, 0x80f, 0x3, function(a) { return pia6821[a + 4]; }],
    [0xb00, 0xbff, 0, function(a) { return video_counter; }],
    [0xc00, 0xfff, 0x3ff, function(a) { return nvram.mem[a]; }],
    [0x0, 0xfff, 0, function(a) { /* console.log('ioread',hex(a)); */ }],
  ]);

  var iowrite_williams = newAddressDecoder([
    [0x0, 0xf, 0xf, setPalette],
    [0x80c, 0x80c, 0xf, function(a, v) { if (worker) worker.postMessage({ command: v }); }],
    //[0x804, 0x807, 0x3,   function(a,v) { console.log('iowrite',a); }], // TODO: sound
    //[0x80c, 0x80f, 0x3,   function(a,v) { console.log('iowrite',a+4); }], // TODO: sound
    [0x900, 0x9ff, 0, function(a, v) { banksel = v & 0x1; }],
    [0xa00, 0xa07, 0x7, setBlitter],
    [0xbff, 0xbff, 0, function(a, v) { if (v == 0x39) watchdog_counter = INITIAL_WATCHDOG; }],
    [0xc00, 0xfff, 0x3ff, function(a, v) { nvram.mem[a] = v; }],
    //[0x0,   0xfff, 0,     function(a,v) { console.log('iowrite',hex(a),hex(v)); }],
  ]);

  var memread_williams = newAddressDecoder([
    [0x0000, 0x8fff, 0xffff, function(a) { return banksel ? rom[a] : ram.mem[a]; }],
    [0x9000, 0xbfff, 0xffff, function(a) { return ram.mem[a]; }],
    [0xc000, 0xcfff, 0x0fff, ioread_williams],
    [0xd000, 0xffff, 0xffff, function(a) { return rom ? rom[a - 0x4000] : 0; }],
  ]);

  var memwrite_williams = newAddressDecoder([
    [0x0000, 0x97ff, 0, write_display_byte],
    [0x9800, 0xbfff, 0, function(a, v) { ram.mem[a] = v; }],
    [0xc000, 0xcfff, 0x0fff, iowrite_williams],
    //[0x0000, 0xffff, 0,      function(a,v) { console.log(hex(a), hex(v)); }],
  ]);

  // d1d6 ldu $11 / beq $d1ed

  function setPalette(a, v) {
    // RRRGGGBB
    var color = 0xff000000 | ((v & 7) << 5) | (((v >> 3) & 7) << 13) | (((v >> 6) << 22));
    if (color != palette[a]) {
      palette[a] = color;
      screenNeedsRefresh = true;
    }
  }

  function write_display_byte(a: number, v: number) {
    ram.mem[a] = v;
    drawDisplayByte(a, v);
    if (displayPCs) displayPCs[a] = cpu.getPC(); // save program counter
  }

  function drawDisplayByte(a, v) {
    var ofs = ((a & 0xff00) << 1) | ((a & 0xff) ^ 0xff);
    pixels[ofs] = palette[v >> 4];
    pixels[ofs + 256] = palette[v & 0xf];
  }

  function setBlitter(a, v) {
    if (a) {
      blitregs[a] = v;
    } else {
      var cycles = doBlit(v);
      this.waitCycles -= cycles * cpuScale; // wait CPU cycles
    }
  }

  function doBlit(flags) {
    //console.log(hex(flags), blitregs);
    flags &= 0xff;
    var offs = SCREEN_HEIGHT - blitregs[7];
    var sstart = (blitregs[2] << 8) + blitregs[3];
    var dstart = (blitregs[4] << 8) + blitregs[5];
    var w = blitregs[6] ^ 4; // blitter bug fix
    var h = blitregs[7] ^ 4;
    if (w == 0) w++;
    if (h == 0) h++;
    if (h == 255) h++;
    var sxinc = (flags & 0x1) ? 256 : 1;
    var syinc = (flags & 0x1) ? 1 : w;
    var dxinc = (flags & 0x2) ? 256 : 1;
    var dyinc = (flags & 0x2) ? 1 : w;
    var pixdata = 0;
    for (var y = 0; y < h; y++) {
      var source = sstart & 0xffff;
      var dest = dstart & 0xffff;
      for (var x = 0; x < w; x++) {
        var data = memread_williams(source);
        if (flags & 0x20) {
          pixdata = (pixdata << 8) | data;
          blit_pixel(dest, (pixdata >> 4) & 0xff, flags);
        } else {
          blit_pixel(dest, data, flags);
        }
        source += sxinc;
        source &= 0xffff;
        dest += dxinc;
        dest &= 0xffff;
      }
      if (flags & 0x2)
        dstart = (dstart & 0xff00) | ((dstart + dyinc) & 0xff);
      else
        dstart += dyinc;
      if (flags & 0x1)
        sstart = (sstart & 0xff00) | ((sstart + syinc) & 0xff);
      else
        sstart += syinc;
    }
    return w * h * (2 + ((flags & 0x4) >> 2)); // # of memory accesses
  }

  function blit_pixel(dstaddr, srcdata, flags) {
    var curpix = dstaddr < 0xc000 ? ram.mem[dstaddr] : memread_williams(dstaddr);
    var solid = blitregs[1];
    var keepmask = 0xff;          //what part of original dst byte should be kept, based on NO_EVEN and NO_ODD flags
    //even pixel (D7-D4)
    if ((flags & 0x8) && !(srcdata & 0xf0)) {   //FG only and src even pixel=0
      if (flags & 0x80) keepmask &= 0x0f; // no even
    } else {
      if (!(flags & 0x80)) keepmask &= 0x0f; // not no even
    }
    //odd pixel (D3-D0)
    if ((flags & 0x8) && !(srcdata & 0x0f)) {   //FG only and src odd pixel=0
      if (flags & 0x40) keepmask &= 0xf0; // no odd
    } else {
      if (!(flags & 0x40)) keepmask &= 0xf0; // not no odd
    }
    curpix &= keepmask;
    if (flags & 0x10) // solid bit
      curpix |= (solid & ~keepmask);
    else
      curpix |= (srcdata & ~keepmask);
    if (dstaddr < 0x9800) // can cause recursion otherwise
      memwrite_williams(dstaddr, curpix);
  }

  // TODO
  /*
    var trace = false;
    var _traceinsns = {};
    function _trace() {
      var pc = cpu.getPC();
      if (!_traceinsns[pc]) {
        _traceinsns[pc] = 1;
        console.log(hex(pc), cpu.getTstates());
      }
    }
  */
  this.start = function() {
    ram = new RAM(0xc000);
    nvram = new RAM(0x400);
    rom = new Uint8Array(0xc000);
    // TODO: save in browser storage?
    //displayPCs = new Uint16Array(new ArrayBuffer(0x9800*2));
    //rom = padBytes(new lzgmini().decode(ROBOTRON_ROM).slice(0), 0xc001);
    membus = {
      read: memread_williams,
      write: memwrite_williams,
    };
    this.readAddress = membus.read;
    var iobus = {
      read: function(a) { return 0; },
      write: function(a, v) { console.log(hex(a), hex(v)); }
    }
    cpu = self.newCPU(membus, iobus);

    audio = new MasterAudio();
    worker = new Worker("./src/common/audio/z80worker.js");
    workerchannel = new WorkerSoundChannel(worker);
    audio.master.addChannel(workerchannel);

    video = new RasterVideo(mainElement, SCREEN_WIDTH, SCREEN_HEIGHT, { rotate: -90 });
    video.create();
    $(video.canvas).click(function(e) {
      var x = Math.floor(e.offsetX * video.canvas.width / $(video.canvas).width());
      var y = Math.floor(e.offsetY * video.canvas.height / $(video.canvas).height());
      var addr = (x >> 3) + (y * 32) + 0x400;
      if (displayPCs) console.log(x, y, hex(addr, 4), "PC", hex(displayPCs[addr], 4));
    });
    var idata = video.getFrameData();
    setKeyboardFromMap(video, pia6821, ROBOTRON_KEYCODE_MAP);
    pixels = video.getFrameData();
    timer = new AnimationTimer(60, this.nextFrame.bind(this));
  }

  this.getRasterScanline = function() { return video_counter; }

  this.advance = function(novideo: boolean) {
    var cpuCyclesPerSection = Math.round(cpuCyclesPerFrame / 65);
    for (var sl = 0; sl < 256; sl += 4) {
      video_counter = sl;
      // interrupts happen every 1/4 of the screen
      if (sl == 0 || sl == 0x3c || sl == 0xbc || sl == 0xfc) {
        if (membus.read != memread_defender || pia6821[7] == 0x3c) { // TODO?
          if (cpu.interrupt)
            cpu.interrupt();
          if (cpu.requestInterrupt)
            cpu.requestInterrupt();
        }
      }
      this.runCPU(cpu, cpuCyclesPerSection);
      if (sl < 256) video.updateFrame(0, 0, 256 - 4 - sl, 0, 4, 304);
    }
    // last 6 lines
    this.runCPU(cpu, cpuCyclesPerSection * 2);
    if (screenNeedsRefresh && !novideo) {
      for (var i = 0; i < 0x9800; i++)
        drawDisplayByte(i, ram.mem[i]);
      screenNeedsRefresh = false;
    }
    if (watchdog_enabled && watchdog_counter-- <= 0) {
      console.log("WATCHDOG FIRED, PC =", cpu.getPC().toString(16)); // TODO: alert on video
      // TODO: this.breakpointHit(cpu.T());
      this.reset();
    }
  }

  this.loadSoundROM = function(data) {
    console.log("loading sound ROM " + data.length + " bytes");
    var soundrom = padBytes(data, 0x4000);
    worker.postMessage({ rom: soundrom });
  }

  this.loadROM = function(title, data) {
    if (data.length > 2) {
      if (data.length > 0xc000) {
        self.loadSoundROM(data.slice(0xc000));
        rom = rom.slice(0, 0xc000);
      }
      else if (data.length > 0x9000 && data[0x9000]) {
        self.loadSoundROM(data.slice(0x9000));
      }
      rom = padBytes(data, 0xc000);
    }
    self.reset();
  }

  this.loadState = function(state) {
    cpu.loadState(state.c);
    ram.mem.set(state.b);
    nvram.mem.set(state.nvram);
    pia6821.set(state.pia);
    blitregs.set(state.blt);
    watchdog_counter = state.wdc;
    banksel = state.bs;
    portsel = state.ps;
  }
  this.saveState = function() {
    return {
      c: self.getCPUState(),
      b: ram.mem.slice(0),
      nvram: nvram.mem.slice(0),
      pia: pia6821.slice(0),
      blt: blitregs.slice(0),
      wdc: watchdog_counter,
      bs: banksel,
      ps: portsel,
    };
  }
  this.loadControlsState = function(state) {
    pia6821.set(state.pia);
  }
  this.saveControlsState = function() {
    return {
      pia: pia6821.slice(0),
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
    watchdog_counter = INITIAL_WATCHDOG;
    banksel = 1;
  }
  this.scaleCPUFrequency = function(scale) {
    cpuScale = scale;
    cpuFrequency *= scale;
    cpuCyclesPerFrame *= scale;
  }
  this.getMemoryMap = function() { return { main:[
      {name:'Video RAM',start:0x0000,size:0xc000,type:'ram'},
      {name:'I/O Registers',start:0xc000,size:0x1000,type:'io'},
  ] } };
}

var WilliamsZ80Platform = function(mainElement) {
  this.__proto__ = new WilliamsPlatform(mainElement, BaseZ80Platform);

  // Z80 @ 4 MHz
  // also scale bitblt clocks
  this.scaleCPUFrequency(4);

  this.ramStateToLongString = function(state) {
    var blt = state.blt;
    var sstart = (blt[2] << 8) + blt[3];
    var dstart = (blt[4] << 8) + blt[5];
    var w = blt[6] ^ 4; // blitter bug fix
    var h = blt[7] ^ 4;
    return "\nBLIT"
      + " " + hex(sstart, 4) + " " + hex(dstart, 4)
      + " w:" + hex(w) + " h:" + hex(h)
      + " f:" + hex(blt[0]) + " s:" + hex(blt[1]);
  }
}

PLATFORMS['williams'] = WilliamsPlatform;
PLATFORMS['williams-z80'] = WilliamsZ80Platform;

// http://seanriddle.com/willhard.html
