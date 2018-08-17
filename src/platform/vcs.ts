"use strict";

import { Platform, cpuStateToLongString_6502, BaseMAMEPlatform } from "../baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, dumpRAM } from "../emu";
import { hex, lpad, tobin, byte2signed } from "../util";
import { CodeAnalyzer_vcs } from "../analysis";

declare var platform : Platform; // global platform object
declare var Javatari : any;
declare var jt : any; // 6502

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
  {id:'examples/fracpitch', name:'Fractional Pitch'},
//  {id:'examples/music2', name:'Pitch-Accurate Music'},
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
    $("#javatari-div").show();
    Javatari.start();
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

  this.isRunning = function() { return Javatari.room && Javatari.room.console.isRunning(); }
  this.pause = function() { Javatari.room.console.pause(); Javatari.room.speaker.mute(); }
  this.resume = function() { Javatari.room.console.go(); Javatari.room.speaker.play(); }
  this.step = function() { Javatari.room.console.debugSingleStepCPUClock(); }
  this.stepBack = function() { Javatari.room.console.debugStepBackInstruction(); }
  this.runEval = function(evalfunc) { Javatari.room.console.debugEval(evalfunc); }

  this.setupDebug = function(callback) {
    Javatari.room.console.onBreakpointHit = callback;
    Javatari.room.speaker.mute();
  }
  this.clearDebug = function() {
    Javatari.room.console.disableDebug();
    Javatari.room.console.onBreakpointHit = null;
    if (this.isRunning()) Javatari.room.speaker.play();
  }
  this.reset = function() {
    Javatari.room.console.powerOff();
    Javatari.room.console.resetDebug();
    Javatari.room.console.powerOn();
    Javatari.room.speaker.play();
  }
  this.getOriginPC = function() {
    return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
  }
  this.newCodeAnalyzer = function() {
    return new CodeAnalyzer_vcs(this);
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
    return this.current_output[addr & 0xfff]; // TODO: use bus to read
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
  this.getDefaultExtension = function() { return ".a"; };

  this.getDebugCategories = function() {
    return ['CPU','PIA','TIA'];
  }
  this.getDebugInfo = function(category, state) {
    switch (category) {
      case 'CPU':    return this.cpuStateToLongString(state.c);
      case 'PIA':    return this.ramStateToLongString(state) + "\n" + this.piaStateToLongString(state.p);
      case 'TIA':    return this.tiaStateToLongString(state.t);
    }
  }
  this.piaStateToLongString = function(p) {
    return "Timer  " + p.t + "/" + p.c + "\n";
  }
  this.tiaStateToLongString = function(t) {
    var pos = this.getRasterPosition();
    var s = '';
    s += "H" + lpad(pos.x,5) + "  V" + lpad(pos.y,5) + "   ";
    s += (t.vs?"VSYNC ":"- ") + (t.vb?"VBLANK ":"- ") + "\n";
    s += "\n";
    s += "Playfield " + t.f + "\n";
    s += "          " + (t.fr?"REFLECT ":"- ") + (t.fs?"SCOREMODE ":"- ") + (t.ft?"PRIORITY ":"- ") + "\n";
    for (var j=0; j<2; j++) {
      var i = "p"+j;
      s += "Player"+j+ lpad(tobin(t[i]),11) + lpad(tobin(t[i+'d']),11) + "\n";
    }
    s += "\n";
    // TODO? s += "    Color {color:0x" + hex(t.fc)  + "} {color:0x" + hex(t.fb) + "}\n";
    s += "          Count Scan Speed\n";
    for (var j=0; j<2; j++) {
      var i = "p"+j;
      s += "Player"+j+ lpad(t[i+'co'],8) + lpad(nonegstr(t[i+'sc']),5) + lpad(t[i+'ss'],6);
      s += " " + (t[i+'rr']?"RESET":"") + " " + (t[i+'v']?"DELAY":"") + " " + (t[i+'cc']?"CLOSECOPY":"") + " " + (t[i+'mc']?"MEDCOPY":"") + " " + (t[i+'wc']?"WIDECOPY":"") + " " + (t[i+'r']?"REFLECT":"") + "\n";
    }
    for (var j=0; j<2; j++) {
      var i = "m"+j;
      s += "Missile"+j+ lpad(t[i+'co'],7) + lpad(nonegstr(t[i+'sc']),5) + lpad(t[i+'ss'],6);
      s += " " + (t[i+'rr']?"RESET":"") + " " + (t[i+'r']?"RESET2PLAYER":"") + "\n";
    }
    s += "Ball"+ lpad(t['bco'],11) + lpad(nonegstr(t['bsc']),5) + lpad(t['bss'],6) + "\n";
    return s;
  }
};

function nonegstr(n) {
  return n < 0 ? "-" : n.toString();
}

///////////////

var VCSMAMEPlatform = function(mainElement) {
  var self = this;
  this.__proto__ = new BaseMAMEPlatform();

//  MCFG_SCREEN_RAW_PARAMS( MASTER_CLOCK_NTSC, 228, 26, 26 + 160 + 16, 262, 24 , 24 + 192 + 31 )
  this.start = function() {
    self.startModule(mainElement, {
      jsfile:'mamea2600.js',
      driver:'a2600',
      width:176*2,
      height:223,
      romfn:'/emulator/cart.rom',
      romsize:0x1000,
    });
  }

  this.loadROM = function(title, data) {
    this.loadROMFile(data);
    this.loadRegion(":cartslot:cart:rom", data);
  }

  this.getPresets = function() { return VCS_PRESETS; }

  this.getToolForFilename = function(fn) {
    return "dasm";
  }
  this.getDefaultExtension = function() { return ".a"; };

  this.getOriginPC = function() {
    return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
  }
  /*
  this.getOpcodeMetadata = function(opcode, offset) {
    return Javatari.getOpcodeMetadata(opcode, offset);
  }
  */
}

////////////////

PLATFORMS['vcs'] = VCSPlatform;
PLATFORMS['vcs.mame'] = VCSMAMEPlatform;
