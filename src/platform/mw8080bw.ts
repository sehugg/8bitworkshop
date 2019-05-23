"use strict";

import { Platform, BasicZ80ScanlinePlatform, BaseZ80Platform } from "../baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap } from "../emu";
import { hex } from "../util";

// http://www.computerarcheology.com/Arcade/

const MW8080BW_PRESETS = [
  { id: 'gfxtest.c', name: 'Graphics Test' },
  { id: 'shifter.c', name: 'Sprite w/ Bit Shifter' },
  { id: 'game2.c', name: 'Cosmic Impalas' },
];

const SPACEINV_KEYCODE_MAP = makeKeycodeMap([
  [Keys.VK_SPACE, 1, 0x10], // P1
  [Keys.VK_LEFT, 1, 0x20],
  [Keys.VK_RIGHT, 1, 0x40],
  [Keys.VK_S, 2, 0x10], // P2
  [Keys.VK_A, 2, 0x20],
  [Keys.VK_D, 2, 0x40],
  [Keys.VK_5, 1, 0x1],
  [Keys.VK_1, 1, 0x4],
  [Keys.VK_2, 1, 0x2],
]);

const INITIAL_WATCHDOG = 256;
const PIXEL_ON = 0xffeeeeee;
const PIXEL_OFF = 0xff000000;


class Midway8080BWPlatform extends BasicZ80ScanlinePlatform implements Platform {
  cpuFrequency = 1996800; // MHz
  canvasWidth = 256;
  numTotalScanlines = 262;
  numVisibleScanlines = 224;
  defaultROMSize = 0x2000;

  bitshift_offset = 0;
  bitshift_register = 0;
  watchdog_counter;

  getPresets() { return MW8080BW_PRESETS; }
  getKeyboardMap() { return SPACEINV_KEYCODE_MAP; }
  getVideoOptions() { return { rotate: -90 }; }
  newRAM() { return new Uint8Array(0x2000); }

  newMembus() {
    return {
      read: newAddressDecoder([
        [0x0000, 0x1fff, 0x1fff, (a) => { return this.rom ? this.rom[a] : 0; }],
        [0x2000, 0x3fff, 0x1fff, (a) => { return this.ram[a]; }],
      ]),
      write: newAddressDecoder([
        [0x2000, 0x23ff, 0x3ff, (a, v) => { this.ram[a] = v; }],
        [0x2400, 0x3fff, 0x1fff, (a, v) => {
          this.ram[a] = v;
          var ofs = (a - 0x400) << 3;
          for (var i = 0; i < 8; i++) {
            this.pixels[ofs + i] = (v & (1 << i)) ? PIXEL_ON : PIXEL_OFF;
          }
          //if (displayPCs) displayPCs[a] = cpu.getPC(); // save program counter
        }],
      ]),
      isContended: function() { return false; },
    };
  }

  newIOBus() {
    return {
      read: (addr) => {
        addr &= 0x3;
        //console.log('IO read', hex(addr,4));
        switch (addr) {
          case 0:
          case 1:
          case 2:
            return this.inputs[addr];
          case 3:
            return (this.bitshift_register >> (8 - this.bitshift_offset)) & 0xff;
        }
        return 0;
      },
      write: (addr, val) => {
        addr &= 0x7;
        val &= 0xff;
        //console.log('IO write', hex(addr,4), hex(val,2));
        switch (addr) {
          case 2:
            this.bitshift_offset = val & 0x7;
            break;
          case 3:
          case 5:
            // TODO: sound
            break;
          case 4:
            this.bitshift_register = (this.bitshift_register >> 8) | (val << 8);
            break;
          case 6:
            this.watchdog_counter = INITIAL_WATCHDOG;
            break;
        }
      }
    };
  }

  startScanline(sl: number) {
  }

  drawScanline(sl: number) {
    // at end of scanline
    if (sl == 95)
      this.cpu.requestInterrupt(0x8); // RST $8
    else if (sl == 223)
      this.cpu.requestInterrupt(0x10); // RST $10
  }

  advance(novideo: boolean) {
    super.advance(novideo);
    if (this.watchdog_counter-- <= 0) {
      console.log("WATCHDOG FIRED"); // TODO: alert on video
      this.reset();
    }
  }

  loadState(state) {
    super.loadState(state);
    this.bitshift_register = state.bsr;
    this.bitshift_offset = state.bso;
    this.watchdog_counter = state.wdc;
  }
  saveState() {
    var state: any = super.saveState();
    state.bsr = this.bitshift_register;
    state.bso = this.bitshift_offset;
    state.wdc = this.watchdog_counter;
    return state;
  }
  reset() {
    super.reset();
    this.watchdog_counter = INITIAL_WATCHDOG;
  }
}

/*
		$(video.canvas).click(function(e) {
			var x = Math.floor(e.offsetX * video.canvas.width / $(video.canvas).width());
			var y = Math.floor(e.offsetY * video.canvas.height / $(video.canvas).height());
			var addr = (x>>3) + (y*32) + 0x400;
      if (displayPCs) console.log(x, y, hex(addr,4), "PC", hex(displayPCs[addr],4));
		});
  */

PLATFORMS['mw8080bw'] = Midway8080BWPlatform;
