import { BaseWASIMachine, Machine } from "../common/baseplatform";
import { AcceptsKeyInput, AcceptsPaddleInput, AcceptsROM, FrameBased, Probeable, RasterFrameBased, TrapCondition, VideoSource } from "../common/devices";
import { KeyFlags } from "../common/emu";
import { hex } from "../common/util";

export class Atari8_WASMMachine extends BaseWASIMachine
  implements Machine, Probeable, VideoSource, AcceptsROM, FrameBased, AcceptsKeyInput, AcceptsPaddleInput {

  numTotalScanlines = 312;
  cpuCyclesPerLine = 63;

  prgstart: number;
  joymask0 = 0;
  joymask1 = 0;

  loadROM(rom: Uint8Array) {
    super.loadROM(rom);
    this.reloadROM();
  }
  reloadROM() {
    if (this.sys) {
      var result = this.exports.machine_load_rom(this.sys, this.romptr, this.romlen);
      console.log('machine_load_rom', result);
      //console.log(this.wasmFs.fs.existsSync('atari8.img'), result);
    }
  }
  loadBIOS(srcArray: Uint8Array) {
    super.loadBIOS(srcArray);
  }
  reset() {
    super.reset();
    this.reloadROM();
  }
  advanceFrame(trap: TrapCondition): number {
    // TODO
    this.exports.machine_start_frame(this.sys);
    if (trap) {
      this.advanceFrameClock(trap, 999999); // TODO?
    } else {
      this.exports.machine_advance_frame(this.sys);
    }
    this.syncVideo();
    this.syncAudio();
    return 1;
  }
  getCPUState() {
    this.exports.machine_save_cpu_state(this.sys, this.stateptr);
    var s = this.statearr;
    var pc = s[6] + (s[7]<<8);
    return {
      PC:pc,
      SP:s[2],
      A:s[0],
      X:s[3],
      Y:s[4],
      C:s[1] & 1,
      Z:s[1] & 2,
      I:s[1] & 4,
      D:s[1] & 8,
      V:s[1] & 64,
      N:s[1] & 128,
      o:this.readConst(pc),
    }
  }
  saveState() {
    var cpu = this.getCPUState();
    this.exports.machine_save_state(this.sys, this.stateptr);
    return {
      c: cpu,
      state: this.statearr.slice(0),
      //ram:this.statearr.slice(18640, 18640+0x200), // ZP and stack
    };
  }
  loadState(state): void {
    this.statearr.set(state.state);
    this.exports.machine_load_state(this.sys, this.stateptr);
  }
  getVideoParams() {
    return { width: 384, height: 240, overscan: true, videoFrequency: 60 };
  }
  pollControls() {
  }
  setKeyInput(key: number, code: number, flags: number): void {
    // modifier flags
    if (flags & KeyFlags.Shift) key |= 0x100;
    if (flags & KeyFlags.Ctrl) key |= 0x200;
    // keyboard -> joystick
    var mask = 0;
    if (key == 37) { key = 0x8; mask = 0x4; } // LEFT
    if (key == 38) { key = 0xb; mask = 0x1; } // UP
    if (key == 39) { key = 0x9; mask = 0x8; } // RIGHT
    if (key == 40) { key = 0xa; mask = 0x2; } // DOWN
    if (key == 32) { mask = 0x100; } // FIRE
    // set machine inputs
    if (flags & KeyFlags.KeyDown) {
      this.exports.machine_key_down(this.sys, key);
      this.joymask0 |= mask;
    } else if (flags & KeyFlags.KeyUp) {
      this.exports.machine_key_up(this.sys, key);
      this.joymask0 &= ~mask;
    }
    this.setJoyInput(0, this.joymask0);
    this.setJoyInput(1, this.joymask1);
  }
  setJoyInput(joy: number, mask: number) {
    this.exports.machine_joy_set(this.sys, joy, mask);
  }
  setPaddleInput(controller: number, value: number): void {
    this.exports.machine_paddle_set(this.sys, controller, value);
  }

}
