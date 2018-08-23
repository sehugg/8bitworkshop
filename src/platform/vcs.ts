"use strict";

import { Platform, cpuStateToLongString_6502, BaseMAMEPlatform, EmuRecorder } from "../baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, dumpRAM } from "../emu";
import { hex, lpad, tobin, byte2signed } from "../util";
import { CodeAnalyzer_vcs } from "../analysis";

declare var platform : Platform; // global platform object
declare var Javatari : any;
declare var jt : any; // 6502

const VCS_PRESETS = [
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

class VCSPlatform {

  current_output;
  recorder : EmuRecorder;
  paused : boolean = true;

  getPresets() { return VCS_PRESETS; }

  start() {
    var self = this;
    $("#javatari-div").show();
    Javatari.start();
    // intercept clockPulse function
    Javatari.room.console.oldClockPulse = Javatari.room.console.clockPulse;
    Javatari.room.console.clockPulse = function() {
      self.updateRecorder();
      this.oldClockPulse();
    }
    this.paused = false;
  }

  loadROM(title, data) {
    Javatari.loadROM(title, data);
    this.current_output = data; // TODO: use bus
  }

  getOpcodeMetadata(opcode, offset) {
    return Javatari.getOpcodeMetadata(opcode, offset);
  }

  getRasterPosition() {
    var clkfs = Javatari.room.console.getClocksFromFrameStart() - 1;
    var row = Math.floor(clkfs/76);
    var col = clkfs - row*76;
    var xpos = col*3-68;
    var ypos = row-39;
    return {x:xpos, y:ypos};
  }

  // TODO: Clock changes this on event, so it may not be current
  isRunning() {
    return Javatari.room && Javatari.room.console.isRunning();
  }
  pause() {	
    //console.log('pause', this.paused, this.isRunning());
    if (!this.paused) {
      this.paused = true;
      Javatari.room.console.pause();
      Javatari.room.speaker.mute();
    }
  }
  resume() {
    //console.log('resume', this.paused, this.isRunning());
    if (this.paused) {
      this.paused = false;
      Javatari.room.console.go();
      Javatari.room.speaker.play();
    }
  }
  advance() {
    Javatari.room.console.clockPulse();
  }

  step() { Javatari.room.console.debugSingleStepCPUClock(); }
  stepBack() { Javatari.room.console.debugStepBackInstruction(); }
  runEval(evalfunc) { Javatari.room.console.debugEval(evalfunc); }
  
  setupDebug(callback) {
    Javatari.room.console.onBreakpointHit = (state) => {
      this.paused = true;
      callback(state);
    }
    Javatari.room.speaker.mute();
  }
  clearDebug() {
    Javatari.room.console.disableDebug();
    Javatari.room.console.onBreakpointHit = null;
    if (this.isRunning()) Javatari.room.speaker.play();
  }
  
  reset() {
    Javatari.room.console.powerOff();
    Javatari.room.console.resetDebug();
    Javatari.room.console.powerOn();
    Javatari.room.speaker.play();
  }
  getOriginPC() {
    return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
  }
  newCodeAnalyzer() {
    return new CodeAnalyzer_vcs(this);
  }
  saveState() {
    return Javatari.room.console.saveState();
  }
  loadState(state) {
    return Javatari.room.console.loadState(state);
  }
  // TODO: load/save controls state
  readAddress(addr) {
    return this.current_output[addr & 0xfff]; // TODO: use bus to read
  }
  runUntilReturn() {
    var depth = 1;
    this.runEval(function(c) {
      if (depth <= 0 && c.T == 0)
        return true;
      if (c.o == 0x20)
        depth++;
      else if (c.o == 0x60 || c.o == 0x40)
        --depth;
      return false;
    });
  }
  cpuStateToLongString(c) {
    return cpuStateToLongString_6502(c);
  }
  getRAMForState(state) {
    return jt.Util.byteStringToUInt8Array(atob(state.r.b));
  }
  ramStateToLongString(state) {
    var ram = this.getRAMForState(state);
    return "\n" + dumpRAM(ram, 0x80, 0x80);
  }
  getToolForFilename(fn) {
    return "dasm";
  }
  getDefaultExtension() { return ".a"; };

  getDebugCategories() {
    return ['CPU','PIA','TIA'];
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'CPU':    return this.cpuStateToLongString(state.c);
      case 'PIA':    return this.ramStateToLongString(state) + "\n" + this.piaStateToLongString(state.p);
      case 'TIA':    return this.tiaStateToLongString(state.t);
    }
  }
  piaStateToLongString(p) {
    return "Timer  " + p.t + "/" + p.c + "\n";
  }
  tiaStateToLongString(t) {
    var pos = this.getRasterPosition();
    var s = '';
    s += "H" + lpad(pos.x.toString(),5) + "  V" + lpad(pos.y.toString(),5) + "   ";
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

  setRecorder(recorder : EmuRecorder) : void {
    this.recorder = recorder;
  }
  updateRecorder() {
    // are we recording and do we need to save a frame?
    if (this.recorder && !this.paused && this.isRunning() && this.recorder.frameRequested()) {
      this.recorder.recordFrame(this.saveState());
    }
  }
};

function nonegstr(n) {
  return n < 0 ? "-" : n.toString();
}

///////////////

class VCSMAMEPlatform extends BaseMAMEPlatform {

//  MCFG_SCREEN_RAW_PARAMS( MASTER_CLOCK_NTSC, 228, 26, 26 + 160 + 16, 262, 24 , 24 + 192 + 31 )

  start = function() {
    this.startModule(this.mainElement, {
      jsfile:'mamea2600.js',
      driver:'a2600',
      width:176*2,
      height:223,
      romfn:'/emulator/cart.rom',
      romsize:0x1000,
    });
  }

  loadROM = function(title, data) {
    this.loadROMFile(data);
    this.loadRegion(":cartslot:cart:rom", data);
  }

  getPresets = function() { return VCS_PRESETS; }

  getToolForFilename = function(fn) {
    return "dasm";
  }
  getDefaultExtension = function() { return ".a"; };

  getOriginPC = function() {
    return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
  }
}

////////////////

PLATFORMS['vcs'] = VCSPlatform;
PLATFORMS['vcs.mame'] = VCSMAMEPlatform;
