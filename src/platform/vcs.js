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

  this.isRunning = function() { return Javatari.room && Javatari.room.console.isRunning(); }
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
  this.getDefaultExtension = function() { return ".a"; };
};

PLATFORMS['vcs'] = VCSPlatform;

/// VCS TIMING ANALYSIS

var pc2minclocks = {};
var pc2maxclocks = {};
var jsrresult = {};
var MAX_CLOCKS = 76*2;

function _traceInstructions(pc, minclocks, maxclocks, subaddr, constraints) {
  //console.log("trace", hex(pc), minclocks, maxclocks);
  if (!minclocks) minclocks = 0;
  if (!maxclocks) maxclocks = 0;
  if (!constraints) constraints = {};
  var modified = true;
  var abort = false;
  for (var i=0; i<1000 && modified && !abort; i++) {
    modified = false;
    var meta = getClockCountsAtPC(pc);
    var lob = platform.readAddress(pc+1);
    var hib = platform.readAddress(pc+2);
    var addr = lob + (hib << 8);
    var pc0 = pc;
    if (!pc2minclocks[pc0] || minclocks < pc2minclocks[pc0]) {
      pc2minclocks[pc0] = minclocks;
      modified = true;
    }
    if (!pc2maxclocks[pc0] || maxclocks > pc2maxclocks[pc0]) {
      pc2maxclocks[pc0] = maxclocks;
      modified = true;
    }
    //console.log(hex(pc),minclocks,maxclocks,meta);
    if (!meta.insnlength) {
      console.log("Illegal instruction!", hex(pc), hex(meta.opcode), meta);
      break;
    }
    pc += meta.insnlength;
    var oldconstraints = constraints;
    constraints = null;
    // TODO: if jump to zero-page, maybe assume RTS?
    switch (meta.opcode) {
      /*
      case 0xb9: // TODO: hack for zero page,y
        if (addr < 0x100)
          meta.maxCycles -= 1;
        break;
      */
      case 0x85:
        if (lob == 0x2) { // STA WSYNC
          minclocks = maxclocks = 0;
          meta.minCycles = meta.maxCycles = 0;
        }
        break;
      case 0x20: // JSR
        _traceInstructions(addr, minclocks, maxclocks, addr, constraints);
        var result = jsrresult[addr];
        if (result) {
          minclocks = result.minclocks;
          maxclocks = result.maxclocks;
        } else {
          console.log("No JSR result!", hex(pc), hex(addr));
          return;
        }
        break;
      case 0x4c: // JMP
        pc = addr; // TODO: make sure in ROM space
        break;
      case 0x60: // RTS
        if (subaddr) {
          // TODO: combine with previous result
          var result = jsrresult[subaddr];
          if (!result) {
            result = {minclocks:minclocks, maxclocks:maxclocks};
          } else {
            result = {
              minclocks:Math.min(minclocks,result.minclocks),
              maxclocks:Math.max(maxclocks,result.maxclocks)
            }
          }
          jsrresult[subaddr] = result;
          console.log("RTS", hex(pc), hex(subaddr), jsrresult[subaddr]);
        }
        return;
      case 0x10: case 0x30: // branch
      case 0x50: case 0x70:
      case 0x90: case 0xB0:
      case 0xD0: case 0xF0:
        var newpc = pc + byte2signed(lob);
        var crosspage = (pc>>8) != (newpc>>8);
        if (!crosspage) meta.maxCycles--;
        // TODO: other instructions might modify flags too
        var cons = BRANCH_CONSTRAINTS[Math.floor((meta.opcode-0x10)/0x20)];
        var cons0 = constraintEquals(oldconstraints, cons[0]);
        var cons1 = constraintEquals(oldconstraints, cons[1]);
        if (cons0 !== false) {
          _traceInstructions(newpc, minclocks+meta.maxCycles, maxclocks+meta.maxCycles, subaddr, cons[0]);
        }
        if (cons1 === false) {
          console.log("abort", hex(pc), oldconstraints, cons[1]);
          abort = true;
        }
        constraints = cons[1]; // not taken
        meta.maxCycles = meta.minCycles; // branch not taken, no extra clock(s)
        break;
      case 0x6c:
        console.log("Instruction not supported!", hex(pc), hex(meta.opcode), meta); // TODO
        return;
    }
    // TODO: wraparound?
    minclocks = Math.min(MAX_CLOCKS, minclocks + meta.minCycles);
    maxclocks = Math.min(MAX_CLOCKS, maxclocks + meta.maxCycles);
  }
}

function showLoopTimingForPC(pc) {
  pc2minclocks = {};
  pc2maxclocks = {};
  jsrresult = {};
  // recurse through all traces
  _traceInstructions(pc | platform.getOriginPC(), MAX_CLOCKS, MAX_CLOCKS);
  // show the lines
  for (var line in sourcefile.line2offset) {
    var pc = sourcefile.line2offset[line];
    var minclocks = pc2minclocks[pc];
    var maxclocks = pc2maxclocks[pc];
    if (minclocks>=0 && maxclocks>=0) {
      var s;
      if (maxclocks == minclocks)
        s = minclocks + "";
      else
        s = minclocks + "-" + maxclocks;
      if (maxclocks == MAX_CLOCKS)
        s += "+";
      var textel = document.createTextNode(s);
      editor.setGutterMarker(line-1, "gutter-bytes", textel);
    }
  }
}

function traceTiming() {
  trace_pending_at_pc = platform.getOriginPC();
  setCode(editor.getValue());
}
