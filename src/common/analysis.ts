
import { hex, byte2signed } from "./util";
import { Platform } from "./baseplatform";

export interface CodeAnalyzer {
  showLoopTimingForPC(pc:number);
  pc2minclocks : {[key:number]:number};
  pc2maxclocks : {[key:number]:number};
  MAX_CLOCKS : number;
}

/// VCS TIMING ANALYSIS

// [taken, not taken]
const BRANCH_CONSTRAINTS = [
  [{N:0},{N:1}],
  [{N:1},{N:0}],
  [{V:0},{V:1}],
  [{V:1},{V:0}],
  [{C:0},{C:1}],
  [{C:1},{C:0}],
  [{Z:0},{Z:1}],
  [{Z:1},{Z:0}]
];

function constraintEquals(a,b) {
  if (a == null || b == null)
    return null;
  for (var n in a) {
    if (b[n] !== 'undefined')
      return a[n] == b[n];
  }
  for (var n in b) {
    if (a[n] !== 'undefined')
      return a[n] == b[n];
  }
  return null;
}

abstract class CodeAnalyzer6502 implements CodeAnalyzer {
  pc2minclocks = {};
  pc2maxclocks = {};
  START_CLOCKS : number;
  MAX_CLOCKS : number;
  WRAP_CLOCKS : boolean;
  jsrresult = {};
  platform : Platform;
  MAX_CYCLES : number = 2000;
  
  constructor(platform : Platform) {
    this.platform = platform;
  }

  getClockCountsAtPC(pc) {
    var opcode = this.platform.readAddress(pc);
    var meta = this.platform.getOpcodeMetadata(opcode, pc);
    return meta; // minCycles, maxCycles
  }

  traceInstructions(pc:number, minclocks:number, maxclocks:number, subaddr:number, constraints) {
    if (this.WRAP_CLOCKS) {
      if (this.pc2minclocks[pc] !== undefined)
        minclocks = Math.min(minclocks, this.pc2minclocks[pc]);
      if (this.pc2maxclocks[pc] !== undefined)
        maxclocks = Math.max(maxclocks, this.pc2maxclocks[pc]);
    }
    //console.log("trace", hex(pc), minclocks, maxclocks);
    if (!constraints) constraints = {};
    var modified = true;
    var abort = false;
    for (var i=0; modified && !abort; i++) {
      if (i >= this.MAX_CYCLES) {
        console.log("too many cycles @", hex(pc), "routine", hex(subaddr));
        break;
      }
      modified = false;
      if (this.WRAP_CLOCKS && minclocks >= this.MAX_CLOCKS) {
        // wrap clocks
        minclocks = minclocks % this.MAX_CLOCKS;
        maxclocks = maxclocks % this.MAX_CLOCKS;
      } else {
        // truncate clocks
        minclocks = Math.min(this.MAX_CLOCKS, minclocks);
        maxclocks = Math.min(this.MAX_CLOCKS, maxclocks);
      }
      var meta = this.getClockCountsAtPC(pc);
      var lob = this.platform.readAddress(pc+1);
      var hib = this.platform.readAddress(pc+2);
      var addr = lob + (hib << 8);
      var pc0 = pc;
      if (!(minclocks >= this.pc2minclocks[pc0])) {
        this.pc2minclocks[pc0] = minclocks;
        modified = true;
      }
      if (!(maxclocks <= this.pc2maxclocks[pc0])) {
        this.pc2maxclocks[pc0] = maxclocks;
        modified = true;
      }
      //console.log(hex(pc),minclocks,maxclocks,modified,meta,constraints);
      if (!meta.insnlength) {
        console.log("Illegal instruction!", hex(pc), hex(meta.opcode), meta);
        break;
      }
      pc += meta.insnlength;
      var oldconstraints = constraints;
      constraints = null;
      // TODO: if jump to zero-page, maybe assume RTS?
      switch (meta.opcode) {
        case 0x19: case 0x1d:
        case 0x39: case 0x3d:
        case 0x59: case 0x5d:
        case 0x79: case 0x7d:
        case 0x99: case 0x9d:
        case 0xa9: case 0xad:
        case 0xb9: case 0xbd: case 0xbc: case 0xbe:
        case 0xd9: case 0xdd:
        case 0xf9: case 0xfd:
          if (lob == 0)
            meta.maxCycles -= 1; // no page boundary crossed
          break;
        // TODO: only VCS
        case 0x85:
          if (lob == 0x2) { // STA WSYNC
            minclocks = maxclocks = 0;
            meta.minCycles = meta.maxCycles = 0;
          }
          break;
        // TODO: only NES (sprite 0 poll)
        case 0x2c:
          if (lob == 0x02 && hib == 0x20) { // BIT $2002
            minclocks = 0;
            maxclocks = 4; // uncertainty b/c of assumed branch poll
            meta.minCycles = meta.maxCycles = 0;
          }
          break;
        // TODO: only Apple2 (vapor lock)
        case 0xad:
          if (lob == 0x61 && hib == 0xc0) { // LDA $C061
            minclocks = 0;
            maxclocks = 4; // uncertainty?
            meta.minCycles = meta.maxCycles = 0;
          }
          break;
        case 0x20: // JSR
          this.traceInstructions(addr, minclocks, maxclocks, addr, constraints);
          var result = this.jsrresult[addr];
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
        case 0x40: // RTI
          abort = true;
          break;
        case 0x60: // RTS
          if (subaddr) { // TODO: 0 doesn't work
            // TODO: combine with previous result
            var result = this.jsrresult[subaddr];
            if (!result) {
              result = {minclocks:minclocks, maxclocks:maxclocks};
            } else {
              result = {
                minclocks:Math.min(minclocks,result.minclocks),
                maxclocks:Math.max(maxclocks,result.maxclocks)
              }
            }
            this.jsrresult[subaddr] = result;
            console.log("RTS", hex(pc), hex(subaddr), this.jsrresult[subaddr]);
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
          // recursively trace the taken branch
          if (true || cons0 !== false) { // TODO?
            this.traceInstructions(newpc, minclocks+meta.maxCycles, maxclocks+meta.maxCycles, subaddr, cons[0]);
          }
          // abort if we will always take the branch
          if (cons1 === false) {
            console.log("branch always taken", hex(pc), oldconstraints, cons[1]);
            abort = true;
          }
          constraints = cons[1]; // not taken
          meta.maxCycles = meta.minCycles; // branch not taken, no extra clock(s)
          break;
        case 0x6c:
          console.log("Instruction not supported!", hex(pc), hex(meta.opcode), meta); // TODO
          return;
      }
      // add min/max instruction time to min/max clocks bound
      minclocks += meta.minCycles;
      maxclocks += meta.maxCycles;
    }
  }

  showLoopTimingForPC(pc:number) {
    this.pc2minclocks = {};
    this.pc2maxclocks = {};
    this.jsrresult = {};
    // recurse through all traces
    this.traceInstructions(pc | this.platform.getOriginPC(), this.START_CLOCKS, this.MAX_CLOCKS, 0, {});
  }
}

// 76 cycles * 2 (support two scanline kernels)
export class CodeAnalyzer_vcs extends CodeAnalyzer6502 {
  constructor(platform : Platform) {
    super(platform);
    this.MAX_CLOCKS = this.START_CLOCKS = 76*2; // 2 scanlines
    this.WRAP_CLOCKS = false;
  }
}

// https://wiki.nesdev.com/w/index.php/PPU_rendering#Line-by-line_timing
// TODO: sprite 0 hit, CPU stalls
export class CodeAnalyzer_nes extends CodeAnalyzer6502 {
  constructor(platform : Platform) {
    super(platform);
    this.MAX_CLOCKS = 114; // 341 clocks for 3 scanlines
    this.START_CLOCKS = 0;
    this.WRAP_CLOCKS = true;
  }
}

export class CodeAnalyzer_apple2 extends CodeAnalyzer6502 {
  constructor(platform : Platform) {
    super(platform);
    this.MAX_CLOCKS = 65;
    this.START_CLOCKS = 0;
    this.WRAP_CLOCKS = true;
  }
}

