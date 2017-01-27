"use strict";

var VCS_PRESETS = [
  {id:'examples/hello', chapter:4, name:'Hello 6502 and TIA'},
  {id:'examples/vsync', chapter:5, name:'Painting on the CRT', title:'Color Bars'},
  {id:'examples/playfield', chapter:6, name:'Playfield Graphics'},
  {id:'examples/sprite', chapter:7, name:'Players and Sprites'},
  {id:'examples/timing2', chapter:9, name:'Fine Positioning', title:'Fine Position'},
  {id:'examples/missiles', chapter:10, name:'Player/Missile Graphics', title:'Player/Missile'},
  {id:'examples/complexscene', chapter:15, name:'Complex Scene I'},
  {id:'examples/complexscene2', chapter:16, name:'Complex Scene II'},
  {id:'examples/scoreboard', chapter:18, name:'Scoreboard'},
  {id:'examples/collisions', chapter:19, name:'Collisions'},
  {id:'examples/bitmap', chapter:20, name:'Async Playfield: Bitmap', title:'Async PF Bitmap'},
  {id:'examples/brickgame', chapter:21, name:'Async Playfield: Bricks', title:'Async PF Bricks'},
//  {id:'examples/multisprite1', chapter:8, name:'Sprite Kernel'},
  {id:'examples/bigsprite', chapter:22, name:'A Big 48-Pixel Sprite', title:'48-Pixel Sprite'},
  {id:'examples/tinyfonts2', chapter:23, name:'Tiny Text'},
  {id:'examples/score6', chapter:24, name:'6-Digit Score'},
  {id:'examples/retrigger', chapter:26, name:'Sprite Formations'},
//  {id:'examples/tinyfonts', chapter:23, name:'Tiny Fonts, Slow'},
  {id:'examples/multisprite3', chapter:28, name:'Multisprites'},
  {id:'examples/procgen1', chapter:30, name:'Procedural Generation'},
  {id:'examples/lines', chapter:31, name:'Drawing Lines'},
//  {id:'examples/piatable', name:'Timer Table'},
  {id:'examples/musicplayer', chapter:32, name:'Music Player'},
  {id:'examples/road', chapter:33, name:'Pseudo 3D Road'},
  {id:'examples/bankswitching', chapter:35, name:'Bankswitching'},
  {id:'examples/wavetable', chapter:36, name:'Wavetable Sound'},
//  {id:'examples/fullgame', name:'Thru Hike: The Game', title:'Thru Hike'},
];

Javatari.AUTO_START = false;
Javatari.SHOW_ERRORS = false;
Javatari.CARTRIDGE_CHANGE_DISABLED = true;
Javatari.DEBUG_SCANLINE_OVERFLOW = false; // TODO: make a switch
Javatari.AUDIO_BUFFER_SIZE = 256;

var VCSPlatform = function() {
  var self = this;

  this.getPresets = function() { return VCS_PRESETS; }

  this.start = function() {
    Javatari.start();
    $("#booklink_vcs").show();
  }

  this.loadROM = function(title, data) {
    Javatari.loadROM(title, data);
    this.current_output = data; // TODO: use bus
  }

  this.getOpcodeMetadata = function(opcode, offset) {
    return Javatari.getOpcodeMetadata(opcode, offset);
  }

  this.getRasterPosition = function() {
    var clkfs = Javatari.room.console.getClocksFromFrameStart() - 1;
    var row = Math.floor(clkfs/76);
    var col = clkfs - row*76;
    var xpos = col*3-68;
    var ypos = row-39;
    return {x:xpos, y:ypos};
  }

  this.isRunning = function() { return Javatari.room.console.isRunning(); }
  this.pause = function() { Javatari.room.console.pause(); }
  this.resume = function() { Javatari.room.console.go(); }
  this.step = function() { Javatari.room.console.debugSingleStepCPUClock(); }
  this.stepBack = function() { Javatari.room.console.debugStepBackInstruction(); }
  this.runEval = function(evalfunc) { Javatari.room.console.debugEval(evalfunc); }

  this.setupDebug = function(callback) {
    Javatari.room.console.onBreakpointHit = callback;
  }
  this.clearDebug = function() {
    Javatari.room.console.disableDebug();
    Javatari.room.console.onBreakpointHit = null;
  }
  this.reset = function() {
    Javatari.room.console.powerOff();
    Javatari.room.console.resetDebug();
    Javatari.room.console.powerOn();
  }
  this.getOriginPC = function() {
    return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
  }
  /*
  this.saveState = function() {
    return Javatari.room.console.saveState(); // TODO
  }
  this.loadState = function(state) {
    return Javatari.room.console.loadState(state); // TODO
  }
  */
  this.readAddress = function(addr) {
    return current_output[addr & 0xfff]; // TODO: use bus to read
  }
  this.runUntilReturn = function() {
    var depth = 1;
    self.runEval(function(c) {
      if (depth <= 0 && c.T == 0)
        return true;
      if (c.o == 0x20)
        depth++;
      else if (c.o == 0x60 || c.o == 0x40)
        --depth;
      return false;
    });
  }
  this.cpuStateToLongString = function(c) {
    return cpuStateToLongString_6502(c);
  }
  this.getRAMForState = function(state) {
    return jt.Util.byteStringToUInt8Array(atob(state.r.b));
  }
  this.ramStateToLongString = function(state) {
    var ram = self.getRAMForState(state);
    return "\n" + dumpRAM(ram, 0x80, 0x80);
  }
  this.getToolForFilename = function(fn) {
    return "dasm";
  }
};

PLATFORMS['vcs'] = VCSPlatform;
