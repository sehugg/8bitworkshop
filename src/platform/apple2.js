
var PRESETS = [
]

Apple2Platform = function(mainElement) {
  var self = this;
  var cpuFrequency = 1.023;
  var cpuCyclesPerLine = 65;
  var cpu, ram, rom, bus;
  var video, audio, timer;

  this.start = function() {
    cpu = new jt.M6502();
    ram = new RAM(0xc000);
    //rom = new lzgmini().decode(APPLEIIGO_LZG).slice(0,12288);
    // bus
    bus = {
      read: function(address) {
        if (address >= 0xd000 && address <= 0xffff) {
          return rom[address - 0xd000];
        } else if (address < 0xc000) {
          return ram.mem[address];
        }
      },
      write: function(address, val) {
        if (address < 0xc000) {
          ram.mem[address] = val;
        }
      }
    };
    cpu.connectBus(bus);
    // create video/audio
    video = new RasterVideo(mainElement,280,192);
    audio = new SampleAudio(cpuFrequency);
    video.start();
    var idata = video.getFrameData();
    var colors = [0xffff0000, 0xff00ff00];
    timer = new AnimationTimer(60, function() {
      // 262.5 scanlines per frame
      var iaddr = 0x2000;
      var iofs = 0;
      breakClock = -1;
      clock = 0;
      for (var sl=0; sl<262; sl++) {
        for (var i=0; i<cpuCyclesPerLine; i++) {
          if (debugCondition && breakClock < 0 && debugCondition()) { breakClock = clock; }
          clock++;
          cpu.clockPulse();
          // TODO: audio
        }
        if (sl < 192) {
          for (var xo=0; xo<35; xo++) {
            var b = ram.mem[iaddr++];
            idata[iofs++] = colors[(b>>0)&1];
            idata[iofs++] = colors[(b>>1)&1];
            idata[iofs++] = colors[(b>>2)&1];
            idata[iofs++] = colors[(b>>3)&1];
            idata[iofs++] = colors[(b>>4)&1];
            idata[iofs++] = colors[(b>>5)&1];
            idata[iofs++] = colors[(b>>6)&1];
          }
        }
      }
      video.updateFrame();
    });
  }

  this.getOpcodeMetadata = function(opcode, offset) {
    return Javatari.getOpcodeMetadata(opcode, offset); // TODO
  }

  this.loadROM = function(title, data) {
    if(data.length != 0x3000) {
      throw "ROM length must be == 0x3000";
    }
    rom = data;
    this.reset();
  }

  this.getRasterPosition = function() {
    return {x:xpos, y:ypos};
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
  }
  this.getOriginPC = function() {
    return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
  }
  this.readAddress = function(addr) {
    return bus.read(addr);
  }

  var onBreakpointHit;
  var debugCondition;
  var debugSavedState = null;
  var debugBreakState = null;
  var debugTargetClock = 0;
  var debugClock = 0;
  var debugFrameStartClock = 0;
  var breakClock;

  this.setDebugCondition = function(debugCond) {
    if (debugSavedState) {
      self.loadState(debugSavedState);
    } else {
      debugSavedState = self.saveState();
    }
    debugClock = 0;
    debugCondition = debugCond;
    self.resume();
  }
  this.setupDebug = function(callback) {
    onBreakpointHit = callback;
  }
  this.clearDebug = function() {
    debugSavedState = null;
    debugTargetClock = 0;
    debugClock = 0;
    debugFrameStartClock = 0;
    onBreakpointHit = null;
    debugCondition = null;
  }
  this.breakpointHit = function() {
    debugBreakState = self.saveState();
    console.log("Breakpoint at clk", debugClock, "PC", debugBreakState.c.PC.toString(16));
    this.pause();
    if (onBreakpointHit) {
      onBreakpointHit(debugBreakState);
    }
  }
  this.step = function() {
    var previousPC = -1;
    self.setDebugCondition(function() {
      if (debugClock++ >= debugTargetClock) {
        var thisState = cpu.saveState();
        if (previousPC < 0) {
          previousPC = thisState.PC;
        } else {
          if (thisState.PC != previousPC && thisState.T == 0) {
            //console.log(previousPC.toString(16), thisPC.toString(16));
            debugTargetClock = debugClock-1;
            self.breakpointHit();
            return true;
          }
        }
      }
      return false;
    });
  }
  this.runToPC = function(targetPC) {
    var self = this;
    self.setDebugCondition(function() {
      if (debugClock++ >= debugTargetClock) {
        var thisPC = cpu.saveState().PC;
        if (thisPC == targetPC) {
          self.breakpointHit();
          debugTargetClock = debugClock;
          return true;
        } else {
          return false;
        }
      }
    });
  }

  this.loadState = function(state) {
    cpu.loadState(state.c);
    ram.mem.set(state.b);
  }
  this.saveState = function() {
    return {
      c:cpu.saveState(),
      b:ram.mem.slice(0),
    };
  }
};

APPLEIIGO_LZG = [
  76,90,71,0,0,48,0,0,0,5,159,47,60,46,159,1,21,25,30,52,65,80,80,76,69,73,73,71,79,32,82,79,
  77,49,46,48,0,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,28,52,6,32,0,224,25,30,67,52,
  30,52,28,25,31,174,52,31,52,30,52,28,52,6,25,63,107,52,31,52,30,52,28,25,63,101,52,19,25,31,139,52,
  31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,25,160,32,52,28,32,32,160,
  25,14,40,1,16,16,12,5,19,15,6,20,32,14,15,20,32,1,22,1,9,12,1,2,12,5,25,16,40,198,207,210,
  160,205,207,210,197,160,201,206,30,3,205,193,212,201,207,206,160,208,204,197,193,211,197,160,195,204,201,195,203,160,30,8,
  160,25,8,40,212,200,197,160,193,208,30,25,201,201,199,207,160,204,207,52,129,194,197,204,207,215,30,28,52,10,25,29,
  224,52,22,76,3,224,32,88,252,162,39,189,0,223,157,128,4,202,16,247,30,3,48,223,157,0,5,30,195,30,78,25,
  5,3,96,30,3,6,30,195,144,30,25,7,30,3,76,64,224,52,65,25,30,131,52,31,52,31,52,31,52,31,52,31,
  52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,
  52,31,52,24,201,206,176,238,201,201,144,234,201,204,240,230,208,232,234,52,11,72,74,41,3,9,4,133,41,104,41,24,
  144,2,105,127,133,40,10,10,5,40,133,40,96,25,30,116,0,165,37,32,193,251,101,32,25,29,75,52,21,165,34,72,
  32,36,252,165,40,133,42,165,41,133,43,164,33,136,104,105,1,197,35,176,13,30,78,177,40,145,42,136,16,249,48,225,
  160,0,32,158,252,176,134,164,36,169,160,145,40,200,196,33,144,249,25,30,199,52,27,164,36,177,40,72,41,63,9,64,
  145,40,104,108,56,25,19,27,32,12,253,32,165,251,52,161,201,155,240,243,25,28,141,52,6,32,142,253,165,51,32,237,
  253,162,1,138,240,243,202,32,53,253,201,149,208,2,177,40,201,224,144,2,41,223,157,0,2,201,141,208,178,32,156,252,
  169,141,208,91,164,61,166,60,30,39,32,64,249,160,0,169,173,76,237,253,25,28,87,52,31,52,31,52,31,52,31,52,
  31,52,31,52,31,52,31,52,31,52,31,52,31,52,31,52,28,52,7,169,0,133,28,165,230,133,27,160,0,132,26,165,
  28,145,26,32,126,244,200,208,246,230,27,165,27,41,31,208,238,96,133,226,134,224,132,225,72,41,192,133,38,74,74,5,
  38,133,38,104,133,39,10,10,10,38,39,52,66,102,38,165,39,41,31,5,230,133,39,138,192,0,240,5,160,35,105,4,
  200,233,7,176,251,132,229,170,189,185,244,133,48,152,74,165,228,133,28,176,21,28,0,35,52,4,10,201,192,16,6,165,
  28,73,127,133,28,25,254,218,52,31,52,31,52,31,52,31,52,31,52,31,52,28,52,10,74,8,32,71,248,40,169,15,
  144,2,105,224,133,46,177,38,69,48,37,46,81,38,145,38,96,32,0,248,196,44,176,17,200,32,14,248,144,246,105,1,
  72,30,8,104,197,45,144,245,96,160,47,208,2,160,39,132,45,160,39,169,0,133,48,32,40,248,136,16,246,96,21,5,
  4,126,39,21,6,4,126,38,10,10,25,130,52,96,165,48,24,105,3,41,15,133,48,10,52,1,5,48,133,48,25,103,
  223,144,4,74,52,1,41,15,25,107,240,168,74,144,9,106,176,16,201,162,240,12,41,135,74,170,189,98,249,32,121,248,
  208,4,160,128,169,0,170,189,166,249,133,46,41,3,133,47,152,41,143,170,152,160,3,224,138,240,11,74,144,8,74,74,
  9,32,136,208,250,200,136,208,242,25,159,59,52,31,52,31,52,20,216,32,132,254,32,47,251,32,147,254,32,137,254,173,
  88,192,173,90,192,173,93,192,173,95,192,173,255,207,44,16,192,216,32,58,255,32,96,251,169,0,133,0,169,198,133,1,
  108,25,30,111,52,29,21,3,19,108,221,219,199,207,25,10,13,173,112,192,160,0,234,234,189,100,192,16,4,200,208,248,
  136,96,169,0,133,72,173,86,192,173,84,192,173,81,192,169,0,240,11,173,80,192,173,83,192,32,54,248,169,20,133,34,
  30,22,32,169,40,133,33,169,24,133,35,169,23,133,37,76,34,252,32,88,252,160,9,185,8,251,153,14,4,136,208,247,
  96,173,243,3,73,165,141,244,3,96,201,141,208,24,172,0,192,16,19,192,147,208,15,44,16,192,30,68,251,192,131,240,
  3,30,4,76,253,251,25,12,148,21,29,7,248,40,133,40,96,201,135,208,18,169,64,32,168,252,160,192,169,12,52,193,
  173,48,192,136,208,245,96,164,36,145,40,230,36,165,36,197,33,176,102,96,201,160,176,239,168,16,236,201,141,240,90,201,
  138,52,97,136,208,201,198,36,16,232,165,33,133,36,198,36,165,34,197,37,176,11,198,37,21,28,7,248,0,72,32,36,
  252,32,158,252,160,0,104,105,0,197,35,144,240,176,202,165,34,133,37,160,0,132,36,240,228,169,0,133,36,230,30,62,
  30,16,182,198,37,21,29,7,248,21,6,7,248,56,72,233,1,208,252,104,52,129,246,96,230,66,208,2,230,67,165,60,
  197,62,165,61,229,63,230,60,30,6,61,25,125,244,52,18,21,13,7,248,230,78,208,2,230,79,44,0,192,16,245,145,
  40,173,0,192,44,16,192,96,21,10,7,248,254,96,165,50,72,169,255,133,50,189,0,2,32,237,253,104,30,129,201,136,
  240,29,201,152,240,10,224,248,144,3,32,58,255,232,208,19,169,220,30,21,21,10,7,248,254,21,30,7,248,52,27,0,
  72,25,162,88,32,229,253,104,41,15,9,176,201,186,144,2,105,6,108,54,0,201,160,144,2,37,50,132,53,72,32,120,
  251,104,164,53,25,49,47,64,25,10,5,25,11,24,177,60,145,66,32,180,252,144,247,25,190,97,52,1,160,63,208,2,
  160,255,132,50,25,98,82,62,162,56,160,27,208,8,30,130,54,160,240,165,62,41,15,240,6,9,192,160,0,240,2,169,
  253,148,0,149,1,96,234,234,76,21,31,30,67,52,7,169,135,76,237,253,165,72,72,165,69,166,70,164,71,25,110,22,
  25,62,27,52,30,52,14,245,3,251,3,98,250,98,250
];
