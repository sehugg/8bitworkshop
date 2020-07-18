
import { MOS6502, MOS6502State } from "../common/cpu/MOS6502";
import { BasicMachine, RasterFrameBased, Bus, ProbeAll, Probeable, NullProbe } from "../common/devices";
import { KeyFlags, newAddressDecoder, padBytes, Keys, makeKeycodeMap, newKeyboardHandler, EmuHalt, dumpRAM } from "../common/emu";
import { lzgmini, stringToByteArray, hex, rgb2bgr } from "../common/util";

// https://www.c64-wiki.com/wiki/C64
// http://www.zimmers.net/cbmpics/cbm/c64/vic-ii.txt
// http://www.zimmers.net/cbmpics/cbm/c64/c64prg.txt
// http://sta.c64.org/cbm64mem.html
// http://hitmen.c02.at/temp/palstuff/

//// WASM Machine

import { Machine, BaseWASMMachine } from "../common/baseplatform";
import { TrapCondition } from "../common/devices";

export class C64_WASMMachine extends BaseWASMMachine implements Machine, Probeable {

  numTotalScanlines = 312;
  cpuCyclesPerLine = 63;

  prgstart : number;
  joymask0 = 0;
  joymask1 = 0;

  loadBIOS(srcArray: Uint8Array) {
    var patch1ofs = 0xea24 - 0xe000 + 0x3000;
    /*if (srcArray[patch1ofs] == 0x02)*/ srcArray[patch1ofs] = 0x60; // cursor move, KIL -> RTS
    super.loadBIOS(srcArray);
  }
  reset() {
    super.reset();
    // clear keyboard
    for (var ch=0; ch<128; ch++) {
      this.setKeyInput(ch, 0, KeyFlags.KeyUp);
    }
    // load rom
    if (this.romptr && this.romlen) {
      this.exports.machine_load_rom(this.sys, this.romptr, this.romlen);
      this.prgstart = this.romarr[0] + (this.romarr[1]<<8); // get load address
      // look for BASIC program start
      if (this.prgstart == 0x801) {
        this.prgstart = this.romarr[2] + (this.romarr[3]<<8) + 2; // point to after BASIC program
        console.log("prgstart", hex(this.prgstart));
      }
      // is program loaded into RAM?
      if (this.prgstart < 0x8000) {
        // advance BIOS a few frames
        this.exports.machine_exec(this.sys, 250000);
        // type in command (SYS 2061)
        var cmd = "SYS "+this.prgstart+"\r";
        for (var i=0; i<cmd.length; i++) {
          var key = cmd.charCodeAt(i);
          this.exports.machine_exec(this.sys, 10000);
          this.exports.machine_key_down(this.sys, key);
          this.exports.machine_exec(this.sys, 10000);
          this.exports.machine_key_up(this.sys, key);
        }
        // advance clock until program starts
        for (var i=0; i<100000 && this.getPC() != this.prgstart; i++) {
          this.exports.machine_tick(this.sys);
        }
      } else {
        // get out of reset
        this.exports.machine_exec(this.sys, 100);
        // wait until cartridge start
        // TODO: detect ROM cartridge
        var warmstart = this.romarr[0x4] + this.romarr[0x5]*256;
        for (var i=0; i<150000 && this.getPC() != warmstart; i++) {
          this.exports.machine_tick(this.sys);
        }
      }
      // TODO: shouldn't we return here @ start of frame?
      // and stop probing
    }
  }
  advanceFrame(trap: TrapCondition) : number {
    // TODO: does this sync with VSYNC?
    var scanline = this.exports.machine_get_raster_line(this.sys);
    var clocks = Math.floor((this.numTotalScanlines - scanline) * (19656+295) / this.numTotalScanlines);
    var probing = this.probe != null;
    if (probing) this.exports.machine_reset_probe_buffer();
    var clocks = super.advanceFrameClock(trap, clocks);
    if (probing) this.copyProbeData();
    return clocks;
  }
  getCPUState() {
    this.exports.machine_save_cpu_state(this.sys, this.cpustateptr);
    var s = this.cpustatearr;
    var pc = s[2] + (s[3]<<8);
    return {
      PC:pc,
      SP:s[9],
      A:s[6],
      X:s[7],
      Y:s[8],
      C:s[10] & 1,
      Z:s[10] & 2,
      I:s[10] & 4,
      D:s[10] & 8,
      V:s[10] & 64,
      N:s[10] & 128,
      o:this.readConst(pc),
    }
  }
  saveState() {
    this.exports.machine_save_state(this.sys, this.stateptr);
    /*
    for (var i=0; i<this.statearr.length; i++)
      if (this.statearr[i] == 0xa0 && this.statearr[i+1] == 0x4d && this.statearr[i+2] == 0xe2) console.log(hex(i));
    */
    return {
      c:this.getCPUState(),
      state:this.statearr.slice(0),
      ram:this.statearr.slice(18640, 18640+0x200), // ZP and stack
    };
  }
  loadState(state) : void {
    this.statearr.set(state.state);
    this.exports.machine_load_state(this.sys, this.stateptr);
  }
  getVideoParams() {
   return {width:392, height:272, overscan:true, videoFrequency:50};
  }
  setKeyInput(key: number, code: number, flags: number): void {
    // TODO: handle shifted keys
    if (key == 16 || key == 17 || key == 18 || key == 224) return; // meta keys
    //console.log(key, code, flags);
    //if (flags & KeyFlags.Shift) { key += 64; }
    // convert to c64
    var mask = 0;
    var mask2 = 0;
    if (key == 37) { key = 0x8; mask = 0x4; } // LEFT
    if (key == 38) { key = 0xb; mask = 0x1; } // UP
    if (key == 39) { key = 0x9; mask = 0x8; } // RIGHT
    if (key == 40) { key = 0xa; mask = 0x2; } // DOWN
    if (key == 32) { mask = 0x10; } // FIRE
    /* player 2 (TODO)
    if (key == 65) { key = 65; mask2 = 0x4; } // LEFT
    if (key == 87) { key = 87; mask2 = 0x1; } // UP
    if (key == 68) { key = 68; mask2 = 0x8; } // RIGHT
    if (key == 83) { key = 83; mask2 = 0x2; } // DOWN
    if (key == 69) { mask2 = 0x10; } // FIRE
    */
    if (key == 113) { key = 0xf1; } // F2
    if (key == 115) { key = 0xf3; } // F4
    if (key == 119) { key = 0xf5; } // F8
    if (key == 121) { key = 0xf7; } // F10
    if (flags & KeyFlags.KeyDown) {
      this.exports.machine_key_down(this.sys, key);
      this.joymask0 |= mask;
      this.joymask1 |= mask2;
    } else if (flags & KeyFlags.KeyUp) {
      this.exports.machine_key_up(this.sys, key);
      this.joymask0 &= ~mask;
      this.joymask1 &= ~mask2;
    }
    this.exports.c64_joystick(this.sys, this.joymask0, this.joymask1);
  }

}
