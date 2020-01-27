
import { VicDual } from "../machine/vicdual";
import { BaseZ80MachinePlatform } from "../common/baseplatform";
import { Platform } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";

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
  // TODO loadBIOS(bios)	{ this.machine.loadBIOS(a); }
  getMemoryMap = function() { return { main:[
      {name:'Cell RAM',start:0xe000,size:32*32,type:'ram'},
      {name:'Tile RAM',start:0xe800,size:256*8,type:'ram'},
  ] } };
}

PLATFORMS['vicdual'] = VicDualPlatform;
