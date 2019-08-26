
import { VicDual } from "../machine/vicdual";
import { BaseZ80MachinePlatform } from "../baseplatform";
import { Platform } from "../baseplatform";
import { PLATFORMS } from "../emu";

const VICDUAL_PRESETS = [
  { id: 'minimal.c', name: 'Minimal Example' },
  { id: 'hello.c', name: 'Hello World' },
  { id: 'gfxtest.c', name: 'Graphics Test' },
  { id: 'soundtest.c', name: 'Sound Test' },
  { id: 'snake1.c', name: 'Siege Game (Prototype)' },
  { id: 'snake2.c', name: 'Siege Game (Full)' },
  { id: 'music.c', name: 'Music Player' },
];

class VicDualPlatform extends BaseZ80MachinePlatform<VicDual> implements Platform {

  newMachine()          { return new VicDual(); }
  getPresets()          { return VICDUAL_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.read(a); }
  // TODO loadBios(bios)	{ this.machine.loadBIOS(a); }

}

PLATFORMS['vicdual'] = VicDualPlatform;
