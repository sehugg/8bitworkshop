
import { BallyAstrocade } from "../machine/astrocade";
import { BaseZ80MachinePlatform } from "../baseplatform";
import { Platform } from "../baseplatform";
import { PLATFORMS } from "../emu";

// http://metopal.com/projects/ballybook/doku.php

const ASTROCADE_PRESETS = [
  { id: '01-helloworlds.asm', name: 'Hello World' },
  { id: '02-telephone.asm', name: 'Telephone' },
  { id: '03-horcbpal.asm', name: 'Paddle Demo' },
  { id: 'hello.c', name: 'Hello Graphics' },
  { id: 'lines.c', name: 'Lines' },
  { id: 'sprites.c', name: 'Sprites' },
  { id: 'vsync.c', name: 'Sprites w/ VSYNC' },
  { id: 'fastsprites.c', name: 'Fast Sprites' },
  { id: 'music.c', name: 'Music' },
  { id: 'rotate.c', name: 'Rotate Op' },
  { id: 'rainbow.c', name: 'Rainbow' },
  { id: 'cosmic.c', name: 'Cosmic Impalas Game' },
  { id: 'racing.c', name: 'Pseudo 3-D Racing Game' },
];

const ASTROCADE_BIOS_PRESETS = [
  { id: 'bios.c', name: 'BIOS' },
];

class BallyAstrocadePlatform extends BaseZ80MachinePlatform<BallyAstrocade> implements Platform {

  newMachine()          { return new BallyAstrocade(false); }
  getPresets()          { return ASTROCADE_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.read(a); }
  // TODO loadBios(bios)	{ this.machine.loadBIOS(a); }

}


/////

PLATFORMS['astrocade'] = BallyAstrocadePlatform;
//PLATFORMS['astrocade-bios'] = _BallyAstrocadeBIOSPlatform;
//PLATFORMS['astrocade-arcade'] = _BallyArcadePlatform;

