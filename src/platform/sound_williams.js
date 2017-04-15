"use strict";

var WILLIAMS_SOUND_PRESETS = [
  {id:'swave.c', name:'Wavetable Synth'},
];

/****************************************************************************

    Midway/Williams Audio Boards
    ----------------------------

    6809 MEMORY MAP

    Function                                  Address     R/W  Data
    ---------------------------------------------------------------
    Program RAM                               0000-07FF   R/W  D0-D7

    Music (YM-2151)                           2000-2001   R/W  D0-D7

    6821 PIA                                  4000-4003   R/W  D0-D7

    HC55516 clock low, digit latch            6000        W    D0
    HC55516 clock high                        6800        W    xx

    Bank select                               7800        W    D0-D2

    Banked Program ROM                        8000-FFFF   R    D0-D7

****************************************************************************/

var WilliamsSoundPlatform = function(mainElement) {
  var self = this;
  this.__proto__ = new BaseZ80Platform();

  var cpu, ram, rom, membus, iobus;
  var audio, master;
  var video, timer;
  var command = 0;
  var dac = 0;
  var dac_float = 0.0
  var current_buffer;
  var last_tstate;
  var pixels;

  var cpuFrequency = 18432000/6; // 3.072 MHz
  var cpuCyclesPerFrame = cpuFrequency/60;
  var cpuAudioFactor = 32;

  function fillBuffer() {
    var t = cpu.getTstates() / cpuAudioFactor;
    while (last_tstate < t) {
      current_buffer[last_tstate++] = dac_float;
    }
  }

  this.getPresets = function() {
    return WILLIAMS_SOUND_PRESETS;
  }

  this.start = function() {
    ram = new RAM(0x400);
    membus = {
      read: new AddressDecoder([
				[0x0000, 0x3fff, 0x3fff, function(a) { return rom ? rom[a] : null; }],
				[0x4000, 0x7fff, 0x3ff,  function(a) { return ram.mem[a]; }]
			]),
			write: new AddressDecoder([
				[0x4000, 0x7fff, 0x3ff,  function(a,v) { ram.mem[a] = v; }],
			]),
      isContended: function() { return false; },
    };
    iobus = {
      read: function(addr) {
        return command & 0xff;
    	},
    	write: function(addr, val) {
        dac = val & 0xff;
        dac_float = ((dac & 0x80) ? -256+dac : dac) / 128.0;
        fillBuffer();
    	}
    };
    cpu = window.Z80({
  		display: {},
  		memory: membus,
  		ioBus: iobus
  	});
    audio = new SampleAudio(cpuFrequency / cpuAudioFactor);
    audio.callback = function(lbuf) {
      if (self.isRunning()) {
        cpu.setTstates(0);
        current_buffer = lbuf;
        last_tstate = 0;
        self.runCPU(cpu, lbuf.length * cpuAudioFactor);
        cpu.setTstates(lbuf.length * cpuAudioFactor); // TODO?
        fillBuffer();
        for (var i=0; i<256; i++) {
          var y = Math.round((current_buffer[i] * 127) + 128);
          pixels[i + y*256] = 0xff33ff33;
        }
      }
    };
    video = new RasterVideo(mainElement,256,256);
    video.create();
    video.setKeyboardEvents(function(key,code,flags) {
      var intr = (key-49);
      if (intr >= 0 && (flags & 1)) {
        command = intr & 0xff;
        cpu.reset();
      }
    });
    pixels = video.getFrameData();
    timer = new AnimationTimer(30, function() {
      if (self.isRunning()) {
        video.updateFrame();
        pixels.fill(0);
      }
    });
  }

  this.loadROM = function(title, data) {
    rom = padBytes(data, 0x4000);
    cpu.reset();
  }

  this.loadState = function(state) {
    cpu.loadState(state.c);
    ram.mem.set(state.b);
  }
  this.saveState = function() {
    return {
      c:self.getCPUState(),
      b:ram.mem.slice(0),
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

PLATFORMS['sound_williams-z80'] = WilliamsSoundPlatform;
