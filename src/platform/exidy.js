"use strict";

var EXIDY_PRESETS = [
];

var ExidyPlatform = function(mainElement) {
  var self = this;
  var cpuFrequency = 705562;
  var cyclesPerFrame = Math.round(cpuFrequency/60);
  var vblankCyclesPerFrame = Math.round(cpuFrequency*3/(262.5*60));
  var cpu, ram, bus, rom;
  var video, ap2disp, audio, timer;
  var port_dsw = 0;
  var PGM_BASE = 0x1000; // where to JMP after pr#6

  this.getPresets = function() {
    return EXIDY_PRESETS;
  }

  this.start = function() {
    cpu = new jt.M6502();
    ram = new RAM(0x200); // 64K + 16K LC RAM - 4K hardware
    rom = new RAM(0x1000);
    // bus
    bus = {
      read: function(address) {
        address &= 0xffff;
        if (address < ram.mem.length) {
          return ram.mem[address];
        } else if (address >= 0x1000 && address <= 0x1fff) {
          return rom.mem[address - 0x1000];
        } else if (address >= 0xf000) {
          return rom.mem[address - 0xf000];
        } else if (address == 0xc000) {
          return port_dsw;
        }
        return 0;
      },
      write: function(address, val) {
        address &= 0xffff;
        val &= 0xff;
        if (address < ram.mem.length) {
          ram.mem[address] = val;
        }
      }
    };
    cpu.connectBus(bus);
    // create video/audio
    video = new RasterVideo(mainElement,256,256);
    video.create();
    audio = new SampleAudio(cpuFrequency); // TODO
    var idata = video.getFrameData();
    timer = new AnimationTimer(60, function() {
      var clock = 0;
      breakClock = -1;
      for (var i=0; i<cyclesPerFrame; i++) {
        if (debugCondition && breakClock < 0 && debugCondition()) { breakClock = clock; }
        clock++;
        cpu.clockPulse();
        port_dsw = (i < vblankCyclesPerFrame) ? 0x80 : 0x0;
      }
      video.updateFrame();
    });
    // TODO: reset debug state
  }

  // TODO: refactor into base

  this.getOpcodeMetadata = function(opcode, offset) {
    return Javatari.getOpcodeMetadata(opcode, offset); // TODO
  }

  this.loadROM = function(title, data) {
    this.reset();
    if(data.length != 0x1000) {
      throw "ROM length must be == 0x1000";
    }
    rom.mem.set(data);
  }

  this.getRasterPosition = function() {
    return {x:0, y:0};
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
    debugBreakState.c.PC = (debugBreakState.c.PC-1) & 0xffff;
    console.log("Breakpoint at clk", debugClock, "PC", debugBreakState.c.PC.toString(16));
    this.pause();
    if (onBreakpointHit) {
      onBreakpointHit(debugBreakState);
    }
  }
  this.step = function() {
    var previousPC = -1;
    self.setDebugCondition(function() {
      if (debugClock++ > debugTargetClock) {
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
  this.runEval = function(evalfunc) {
    var self = this;
    self.setDebugCondition(function() {
      if (debugClock++ > debugTargetClock) {
        var cpuState = cpu.saveState();
        cpuState.PC = (cpuState.PC-1)&0xffff;
        if (evalfunc(cpuState)) {
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
  this.getRAMForState = function(state) {
    return ram.mem;
  }
};

PLATFORMS['exidy'] = ExidyPlatform;
