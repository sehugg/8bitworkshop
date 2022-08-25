
import { AcceptsPaddleInput, Probeable } from "../common/devices";
import { dumpRAM, KeyFlags } from "../common/emu";
import { clamp, hex, lpad } from "../common/util";

// https://www.c64-wiki.com/wiki/C64
// http://www.zimmers.net/cbmpics/cbm/c64/vic-ii.txt
// http://www.zimmers.net/cbmpics/cbm/c64/c64prg.txt
// http://sta.c64.org/cbm64mem.html
// http://hitmen.c02.at/temp/palstuff/

//// WASM Machine

import { Machine } from "../common/baseplatform";
import { TrapCondition } from "../common/devices";
import { BaseWASMMachine } from "../common/wasmplatform";

export class C64_WASMMachine extends BaseWASMMachine 
  implements Machine, Probeable, AcceptsPaddleInput {

  numTotalScanlines = 312;
  cpuCyclesPerLine = 63;

  prgstart : number;
  joymask0 = 0;
  joymask1 = 0;
  lightpen_x = 0;
  lightpen_y = 0;

  loadBIOS(srcArray: Uint8Array) {
    var patch1ofs = 0xea24 - 0xe000 + 0x3000;
    /*if (srcArray[patch1ofs] == 0x02)*/ srcArray[patch1ofs] = 0x60; // cursor move, KIL -> RTS
    super.loadBIOS(srcArray);
  }
  reset() {
    super.reset();
    // clear keyboard
    for (var ch=0; ch<128; ch++) {
      this.exports.machine_key_up(this.sys, ch);
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
        var cmd = "\rSYS "+this.prgstart+"\r";
        for (var i=0; i<cmd.length; i++) {
          var key = cmd.charCodeAt(i);
          this.exports.machine_exec(this.sys, 20000);
          this.exports.machine_key_down(this.sys, key);
          this.exports.machine_exec(this.sys, 5000);
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
    // TODO: ticks, not msec (machine_tick() has different rate then machine_exec())
    var scanline = this.getRasterY();
    var clocks = Math.floor((this.numTotalScanlines - scanline) * 19656 / this.numTotalScanlines);
    var probing = this.probe != null;
    if (probing) this.exports.machine_reset_probe_buffer();
    clocks = super.advanceFrameClock(trap, clocks);
    if (probing) this.copyProbeData();
    //console.log(clocks, this.getRasterY());
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
      R:s[19] != 0x37, // bit 28 of PINS
    }
  }
  saveState() {
    this.exports.machine_save_state(this.sys, this.stateptr);
    let cia1 = this.getDebugStateOffset(1);
    let cia2 = this.getDebugStateOffset(2);
    let vic = this.getDebugStateOffset(3);
    let sid = this.getDebugStateOffset(4);
    let ramofs = this.getDebugStateOffset(5);
    let pla = this.getDebugStateOffset(9);
    return {
      c:this.getCPUState(),
      state:this.statearr.slice(0),
      ram:this.statearr.slice(ramofs, ramofs+0x10000),
      cia1:this.statearr.slice(cia1, cia1+64),
      cia2:this.statearr.slice(cia2, cia2+64),
      vic:this.statearr.slice(vic+1, vic+1+64),
      sid:this.statearr.slice(sid, sid+32),
      pla:this.statearr.slice(pla, pla+16)
    };
  }
  loadState(state) : void {
    this.statearr.set(state.state);
    this.exports.machine_load_state(this.sys, this.stateptr);
  }
  getVideoParams() {
   return {width:392, height:272, overscan:true, videoFrequency:50, aspect:392/272*0.9365};
  }
  setKeyInput(key: number, code: number, flags: number): void {
    // TODO: handle shifted keys
    if (key == 16 || key == 17 || key == 18 || key == 224) return; // meta keys
    //console.log(key, code, flags);
    //if (flags & KeyFlags.Shift) { key += 64; }
    // convert to c64
    var mask = 0;
    var mask2 = 0;
    switch (key) {
      case 32: mask = 0x10; break;
      case 37: key = 0x8; mask = 0x4; break; // LEFT
      case 38: key = 0xb; mask = 0x1; break; // UP
      case 39: key = 0x9; mask = 0x8; break; // RIGHT
      case 40: key = 0xa; mask = 0x2; break; // DOWN
      case 113: key = 0xf1; break; // F2
      case 115: key = 0xf3; break; // F4
      case 119: key = 0xf5; break; // F8
      case 121: key = 0xf7; break; // F10
      case 188: key = flags & KeyFlags.Shift ? 0x3c : 0x2e; break; // < .
      case 190: key = flags & KeyFlags.Shift ? 0x3e : 0x2c; break; // > ,
      case 191: key = flags & KeyFlags.Shift ? 0x3f : 0x2f; break; // ? /
      case 222: key = flags & KeyFlags.Shift ? 0x22 : 0x27; break; // " '
      case 219: key = flags & KeyFlags.Shift ? 0x7b : 0x5b; break; // [
      case 221: key = flags & KeyFlags.Shift ? 0x7d : 0x5d; break; // ]
      case 48: if (flags & KeyFlags.Shift) key = 0x29; break; // )
      case 49: if (flags & KeyFlags.Shift) key = 0x21; break; // !
      case 50: if (flags & KeyFlags.Shift) key = 0x40; break; // @
      case 51: if (flags & KeyFlags.Shift) key = 0x23; break; // #
      case 52: if (flags & KeyFlags.Shift) key = 0x24; break; // $
      case 53: if (flags & KeyFlags.Shift) key = 0x25; break; // %
      case 54: if (flags & KeyFlags.Shift) key = 0x5e; break; // ^
      case 55: if (flags & KeyFlags.Shift) key = 0x26; break; // &
      case 56: if (flags & KeyFlags.Shift) key = 0x2a; break; // *
      case 57: if (flags & KeyFlags.Shift) key = 0x28; break; // (
      case 59: if (flags & KeyFlags.Shift) key = 0x3a; break; // ;
      case 61: if (flags & KeyFlags.Shift) key = 0x2b; break; // +
      case 173: key = flags & KeyFlags.Shift ? 0x5f : 0x2d; break; // _ -
    }
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
  getRasterY() {
    return this.exports.machine_get_raster_line(this.sys);
  }
  getDebugStateOffset(index: number) {
    var p = this.exports.machine_get_debug_pointer(this.sys, index);
    return p - this.sys;
  }
  getDebugCategories() {
    return ['CPU','ZPRAM','Stack','PLA','CIA','VIC','SID'];
  }
  getDebugInfo(category:string, state:any) {
    switch (category) {
      case 'PLA': {
        let s = "";
        let iomapped = state.pla[0];
        let port = state.pla[3];
        s += `$0000 - $9FFF  RAM\n`;
        s += `$A000 - $BFFF  ${(port&3)==3 ? 'BASIC ROM' : 'RAM'}\n`;
        s += `$C000 - $CFFF  RAM\n`;
        s += `$D000 - $DFFF  ${iomapped ? 'I/O' : (port&3)!=0 ? 'CHAR ROM' : 'RAM'}\n`;
        s += `$E000 - $FFFF  ${(port&2)==2 ? 'KERNAL ROM' : 'RAM'}\n`;
        return s;
      }
      case 'CIA': {
        let s = "";
        for (let i=0; i<2; i++) {
          let m = i ? state.cia2 : state.cia1;
          s += `CIA ${i+1}\n`;
          s += ` A: Data ${hex(m[0])}  DDR ${hex(m[1])}  Input ${hex(m[2])}`;
          s += `  Timer ${hex(m[10]+m[11]*256, 4)}\n`;
          s += ` B: Data ${hex(m[4])}  DDR ${hex(m[5])}  Input ${hex(m[6])}`;
          s += `  Timer ${hex(m[10+10]+m[11+10]*256, 4)}\n`;
          //s += ` IMR ${hex(m[48])}  ICR ${hex(m[50])}\n`
        }
        return s;
      }
      case 'VIC': {
        let m = state.vic;
        let s = '';
        let vicbank = ((state.cia2[0] & 3) ^ 3) * 0x4000;
        let charmem = vicbank + (state.vic[0x18] & 14) * 0x400;
        let screen = vicbank + (state.vic[0x18] >> 4) * 0x400;
        let isbitmap = state.vic[0x11] & 0x20;
        let ischar = (state.cia2[0]&1)==1 && (state.vic[0x18]&12)==4;
        let rasterX = state.state[0xf4];
        let rasterY = this.getRasterY();
        s += 'Mode:';
        if (state.vic[0x11] & 0x20) s += ' BITMAP'; else s += ' CHAR';
        if (state.vic[0x16] & 0x10) s += ' MULTICOLOR';
        if (state.vic[0x11] & 0x40) s += ' EXTENDED';
        s += "\n";
        s += `Raster: (${lpad(rasterX,3)}, ${lpad(rasterY,3)})     `;
        s += `Scroll: (${state.vic[0x16] & 7}, ${state.vic[0x11] & 7})`;
        s += "\n";
        s += `VIC Bank: $${hex(vicbank,4)}   Scrn: $${hex(screen,4)}   `;
        if (isbitmap) s += `Bitmap: $${hex(charmem&0xe000,4)}`
        else if (ischar) s += `Char: ROM $${hex(charmem,4)}`;
        else s += `Char: $${hex(charmem,4)}`;
        s += "\n";
        s += dumpRAM(m, 0xd000, 64);
        return s;
      }
      case 'SID': {
        let m = state.sid;
        let s = ''
        s += dumpRAM(m, 0xd400, 32);
        return s;
      }
    }
  }

  setPaddleInput(controller: number, value: number): void {
    if (controller == 0) this.lightpen_x = value;
    if (controller == 1) this.lightpen_y = value;
    const x1 = 22;
    const y1 = 36;
    const x2 = 228;
    const y2 = 220;
    let x = clamp(0, 255, (this.lightpen_x - x1) / (x2 - x1) * 160 + 24);
    let y = clamp(0, 255, (this.lightpen_y - y1) / (y2 - y1) * 200 + 50);
    this.exports.machine_set_mouse(this.sys, x, y);
  }

}
