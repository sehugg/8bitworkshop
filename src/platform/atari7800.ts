"use strict";

import { MOS6502 } from "../cpu/MOS6502";
import { Atari7800 } from "../machine/atari7800";
import { Platform, Base6502MachinePlatform } from "../baseplatform";
import { PLATFORMS } from "../emu";

var Atari7800_PRESETS = [
  {id:'sprites.dasm', name:'Sprites (ASM)'},
];

class Atari7800Platform extends Base6502MachinePlatform<Atari7800> implements Platform {

  newMachine()          { return new Atari7800(); }
  getPresets()          { return Atari7800_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.readConst(a); }
  // TODO loadBios(bios)	{ this.machine.loadBIOS(a); }

}

///

PLATFORMS['atari7800'] = Atari7800Platform;
