"use strict";

import { Z80, Z80State } from "../common/cpu/ZilogZ80";
import { BasicMachine, CPU, Bus } from "../common/devices";
import { Platform, BaseZ80MachinePlatform } from "../common/baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap } from "../common/emu";
import { SampleAudio } from "../common/audio";

var WILLIAMS_SOUND_PRESETS = [
  { id: 'swave.c', name: 'Wavetable Synth' },
];

/****************************************************************************

    Midway/Williams Audio Boards
    ----------------------------

    6809 MEMORY MAP

    Function                                  Address     R/W  Data
    ---------------------------------------------------------------
    Program RAM                               0000-07FF   R/W  D0-D7

    Music (YM-2151)                           2000-2001   R/W  D0-D7

    6821 PIA                                  4000-4003   R/W  D0-D7

    HC55516 clock low, digit latch            6000        W    D0
    HC55516 clock high                        6800        W    xx

    Bank select                               7800        W    D0-D2

    Banked Program ROM                        8000-FFFF   R    D0-D7

****************************************************************************/

class WilliamsSound extends BasicMachine {
  cpuFrequency = 18432000 / 6; // 3.072 MHz
  cpuCyclesPerFrame = this.cpuFrequency / 60;
  cpuAudioFactor = 32;
  canvasWidth = 256;
  numVisibleScanlines = 256;
  defaultROMSize = 0x4000;
  sampleRate = this.cpuFrequency;
  overscan = true;
  
  cpu : Z80;
  ram = new Uint8Array(0x400);
  iobus : Bus;
  
  command : number = 0;
  dac : number = 0;
  dac_float : number = 0;
  xpos : number = 0;

  read = newAddressDecoder([
    [0x0000, 0x3fff, 0x3fff, (a) => { return this.rom && this.rom[a]; }],
    [0x4000, 0x7fff, 0x3ff, (a) => { return this.ram[a]; }]
  ]);

  write = newAddressDecoder([
    [0x4000, 0x7fff, 0x3ff, (a, v) => { this.ram[a] = v; }],
  ]);
  
  constructor() {
    super();
    this.cpu = new Z80();
    this.connectCPUMemoryBus(this);
    this.connectCPUIOBus({
      read: (addr) => {
        return this.command & 0xff;
      },
      write: (addr, val) => {
        let dac = this.dac = val & 0xff;
        this.dac_float = ((dac & 0x80) ? -256 + dac : dac) / 128.0;
      }
    });
  }
  
  advanceFrame(trap) : number {
    this.pixels && this.pixels.fill(0); // clear waveform
    let maxCycles = this.cpuCyclesPerFrame;
    var n = 0;
    while (n < maxCycles) {
      if (trap && trap()) {
        break;
      }
      n += this.advanceCPU();
    }
    return n;
  }
  
  advanceCPU() {
    var n = super.advanceCPU();
    this.audio && this.audio.feedSample(this.dac_float, n);
    // draw waveform on screen
    if (this.pixels && !this.cpu.isHalted()) {
      this.pixels[((this.xpos >> 8) & 0xff) + ((255-this.dac) << 8)] = 0xff33ff33;
      this.xpos = (this.xpos + n) & 0xffffff;
    }
    return n;
  }

  setKeyInput(key:number, code:number, flags:number) : void {
    var intr = (key - 49);
    if (intr >= 0 && (flags & 1)) {
      this.command = intr & 0xff;
      this.cpu.reset();
    }
  }
}

export class WilliamsSoundPlatform extends BaseZ80MachinePlatform<WilliamsSound> {

  newMachine()          { return new WilliamsSound(); }
  getPresets()          { return WILLIAMS_SOUND_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.read(a); }

}

PLATFORMS['sound_williams-z80'] = WilliamsSoundPlatform;
