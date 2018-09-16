"use strict";

import { Platform, BasePlatform, cpuStateToLongString_6502, BaseMAMEPlatform, EmuRecorder, dumpStackToString, DisasmLine } from "../baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, dumpRAM } from "../emu";
import { hex, lpad, tobin, byte2signed } from "../util";
import { CodeAnalyzer_vcs } from "../analysis";
import { disassemble6502 } from "../cpu/disasm6502";
import { platform, symbolmap, addr2symbol } from "../ui";

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
  {id:'examples/pal', name:'PAL Video Output'},
//  {id:'examples/testlibrary', name:'VCS Library Demo'},
//  {id:'examples/music2', name:'Pitch-Accurate Music'},
//  {id:'examples/fullgame', name:'Thru Hike: The Game', title:'Thru Hike'},
];

Javatari.AUTO_START = false;
Javatari.SHOW_ERRORS = false;
Javatari.CARTRIDGE_CHANGE_DISABLED = true;
Javatari.DEBUG_SCANLINE_OVERFLOW = false; // TODO: make a switch
Javatari.AUDIO_BUFFER_SIZE = 256;

class VCSPlatform extends BasePlatform {

  lastDebugState;

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
  }

  loadROM(title, data) {
    if (data.length == 0 || ((data.length & 0x3ff) != 0))
      throw Error("Invalid ROM length: " + data.length);
    // TODO: parse Log messages from Javatari?
    var wasrunning = this.isRunning();
    Javatari.loadROM(title, data);
    if (!this.isRunning()) throw Error("Could not load ROM");
    if (!wasrunning) this.pause();
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
    //console.log(Javatari.room.console.isRunning(), Javatari.room.console.isPowerOn);
    return Javatari.room && Javatari.room.console.isRunning();
  }
  pause() {	
    Javatari.room.console.pause();
    Javatari.room.speaker.mute();
  }
  resume() {
    Javatari.room.console.go();
    Javatari.room.speaker.play();
  }
  advance() {
    Javatari.room.console.clockPulse();
  }
  // for unit test
  nextFrame() {
    Javatari.room.console.clockPulse();
  }

  step() { Javatari.room.console.debugSingleStepCPUClock(); }
  stepBack() { Javatari.room.console.debugStepBackInstruction(); }
  runEval(evalfunc) { Javatari.room.console.debugEval(evalfunc); }
  
  setupDebug(callback) {
    Javatari.room.console.onBreakpointHit = (state) => {
      state.c.PC = (state.c.PC - 1) & 0xffff;
      this.fixState(state);
      Javatari.room.console.pause();
      Javatari.room.speaker.mute();
      this.lastDebugState = state;
      callback(state);
    }
    Javatari.room.speaker.mute();
  }
  clearDebug() {
    this.lastDebugState = null;
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
    var state = Javatari.room.console.saveState();
    this.fixState(state);
    return state;
  }
  fixState(state) {
    var ofs = state.ca.bo || 0;
    if (state.ca.fo && (state.c.PC & 0xfff) >= 2048)
      ofs = state.ca.fo; // 3E/3F fixed-slice formats
    state.c.EPC = state.c.PC + ofs; // ofs = effective PC for ROM
  }
  loadState(state) {
    return Javatari.room.console.loadState(state);
  }
  getCPUState() {
    return Javatari.room.console.saveState().c;
  }
  saveControlsState() {
    return Javatari.room.console.saveControlsState();
  }
  loadControlsState(state) {
    Javatari.room.console.loadControlsState(state);
  }
  readAddress(addr) {
    // TODO: shouldn't have to do this when debugging
    if (this.lastDebugState && addr >= 0x80 && addr < 0x100)
      return this.getRAMForState(this.lastDebugState)[addr & 0x7f];
    else
      return Javatari.room.console.readAddress(addr);
  }
  writeAddress(addr,value) {
    Javatari.room.console.writeAddress(addr,value);
  }
  runUntilReturn() {
    var depth = 1;
    this.runEval( (c) => {
      if (depth <= 0 && c.T == 0)
        return true;
      if (c.o == 0x20)
        depth++;
      else if (c.o == 0x60 || c.o == 0x40)
        --depth;
      return false;
    });
  }
  runToVsync() {
    this.advance();
    this.runEval( (c) => { return true; } );
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
    return ['CPU','Stack','PIA','TIA'];
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'CPU':    return this.cpuStateToLongString(state.c) + this.bankSwitchStateToString(state);
      case 'Stack':	 return dumpStackToString(this, this.getRAMForState(state), 0x100, 0x1ff, 0x100+state.c.SP, 0x20);
      case 'PIA':    return this.ramStateToLongString(state) + "\n" + this.piaStateToLongString(state.p);
      case 'TIA':    return this.tiaStateToLongString(state.t);
    }
  }
  bankSwitchStateToString(state) {
    return (state.ca.bo !== undefined ? ("BankOffset "+hex(state.ca.bo,4)+"\n"):"");
  }
  piaStateToLongString(p) {
    return "Timer  " + p.t + "/" + p.c + "\nINTIM  $" + hex(p.IT,2) + " (" + p.IT + ")\nINSTAT $" + hex(p.IS,2) + "\n";
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

  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    return disassemble6502(pc, read(pc), read(pc+1), read(pc+2));
  }
  inspect(ident : string) : string {
    if (this.isRunning()) return; // only inspect when stopped
    var result;
    var addr = symbolmap && (symbolmap[ident]); // || symbolmap['_'+ident]);
    if (addr >= 0x80 && addr < 0x100) { // in RAM?
      var size=4;
      result = "$" + hex(addr,4) + ":";
      for (var i=0; i<size; i++) {
        var byte = platform.readAddress(addr+i);
        result += " $" + hex(byte,2) + " (" + byte + ")";
        if (addr2symbol[addr+1]) break; // stop if we hit another symbol
        else if (i==size-1) result += " ...";
      }
    }
    return result;
  }
};
// TODO: mixin for Base6502Platform?

function nonegstr(n) {
  return n < 0 ? "-" : n.toString();
}

///////////////

class VCSMAMEPlatform extends BaseMAMEPlatform implements Platform {

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
