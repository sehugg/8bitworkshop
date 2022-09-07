
//// WASM Machine

// http://www.zimmers.net/anonftp/pub/cbm/documents/chipdata/VIC-I.txt
// http://www.zimmers.net/anonftp/pub/cbm/maps/Vic20.MemoryMap.txt
// http://sleepingelephant.com/denial/wiki/index.php/Autostart

import { Machine } from "../common/baseplatform";
import { Probeable, TrapCondition } from "../common/devices";
import { KeyFlags } from "../common/emu";
import { hex } from "../common/util";
import { BaseWASMMachine } from "../common/wasmplatform";

export class VIC20_WASMMachine extends BaseWASMMachine implements Machine, Probeable {

  numTotalScanlines = 312;
  cpuCyclesPerLine = 71;
  videoOffsetBytes = -24 * 4;

  prgstart : number;
  joymask0 = 0;
  joymask1 = 0;

  getBIOSLength() { return 0x5000 };

  loadBIOS(srcArray: Uint8Array) {
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
      let rom = this.romarr;
      this.exports.machine_load_rom(this.sys, this.romptr, this.romlen);
      let iscart = rom[4+2]==0x41 && rom[5+2]==0x30 && rom[6+2]==0xC3 && rom[7+2]==0xC2 && rom[8+2]==0xCD;
      if (!iscart) {
        this.prgstart = rom[0] + (rom[1]<<8); // get load address
        // look for BASIC program start
        if (this.prgstart == 0x1001) {
          this.prgstart = rom[2] + (rom[3]<<8) + 2; // point to after BASIC program
          console.log("prgstart", hex(this.prgstart));
        }
        // is program loaded into RAM?
        if (this.prgstart < 0x8000) {
          // advance BIOS a few frames
          this.exports.machine_exec(this.sys, 500000);
          // type in command (SYS 2061)
          var cmd = "SYS "+this.prgstart+"\r";
          console.log(cmd);
          for (var i=0; i<cmd.length; i++) {
            var key = cmd.charCodeAt(i);
            this.exports.machine_exec(this.sys, 10000);
            this.exports.machine_exec(this.sys, 10000);
            this.exports.machine_key_down(this.sys, key);
            this.exports.machine_exec(this.sys, 10000);
            this.exports.machine_exec(this.sys, 10000);
            this.exports.machine_key_up(this.sys, key);
          }
          // advance clock until program starts
          for (var i=0; i<10000 && this.getPC() != this.prgstart; i++) {
            this.exports.machine_tick(this.sys);
          }
        }
      } else {
        // get out of reset
        //this.exports.machine_exec(this.sys, 100);
        // wait until cartridge start
        // TODO: detect ROM cartridge
        var warmstart = this.romarr[0x2+2] + this.romarr[0x3+2]*256;
        for (var i=0; i<10000 && this.getPC() != warmstart; i++) {
          this.exports.machine_tick(this.sys);
        }
        console.log('cart', i, hex(warmstart));
      }
      // TODO: shouldn't we return here @ start of frame?
      // and stop probing
    }
  }
  advanceFrame(trap: TrapCondition) : number {
    // TODO: does this sync with VSYNC?
    var scanline = this.getRasterY();
    var clocks = Math.floor((this.numTotalScanlines - scanline) * 22152 / this.numTotalScanlines);
    var probing = this.probe != null;
    if (probing) this.exports.machine_reset_probe_buffer();
    clocks = super.advanceFrameClock(trap, clocks);
    if (probing) this.copyProbeData();
    return clocks;
  }
  getRasterY() {
    return this.exports.machine_get_raster_line(this.sys);
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
    return {
      c:this.getCPUState(),
      state:this.statearr.slice(0),
      ram:this.statearr.slice(18640, 18640+0x200), // ZP and stack (TODO)
    };
  }
  loadState(state) : void {
    this.statearr.set(state.state);
    this.exports.machine_load_state(this.sys, this.stateptr);
  }
  getVideoParams() {
   return {width:232, height:272, overscan:true, videoFrequency:50, aspect:1.5};
  }
  setKeyInput(key: number, code: number, flags: number): void {
    // TODO: handle shifted keys
    if (key == 16 || key == 17 || key == 18 || key == 224) return; // meta keys
    //console.log(key, code, flags);
    //if (flags & KeyFlags.Shift) { key += 64; }
    // convert to vic20
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
    this.exports.vic20_joystick(this.sys, this.joymask0, this.joymask1);
  }

}
