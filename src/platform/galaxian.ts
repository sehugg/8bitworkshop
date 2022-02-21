
import { Platform } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { GalaxianMachine, GalaxianScrambleMachine } from "../machine/galaxian";
import { BaseZ80MachinePlatform } from "../common/baseplatform";

const GALAXIAN_PRESETS = [
  { id: 'gfxtest.c', name: 'Graphics Test' },
  { id: 'shoot2.c', name: 'Solarian Game' },
];

class GalaxianPlatform extends BaseZ80MachinePlatform<GalaxianMachine> implements Platform {

  newMachine()          { return new GalaxianMachine(); }
  getPresets()          { return GALAXIAN_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.readConst(a); }
  readVRAMAddress(a)    { return (a < 0x800) ? this.machine.vram[a] : this.machine.oram[a-0x800]; }
  // TODO loadBIOS(bios)	{ this.machine.loadBIOS(a); }
  getMemoryMap = function() { return { main:[
    {name:'Video RAM',start:0x5000,size:0x400,type:'ram'},
    {name:'Sprite RAM',start:0x5800,size:0x100,type:'ram'},
    {name:'I/O Registers',start:0x6000,size:0x2000,type:'io'},
  ] } };
}

class GalaxianScramblePlatform extends GalaxianPlatform implements Platform {

  newMachine()          { return new GalaxianScrambleMachine(); }

}

PLATFORMS['galaxian'] = GalaxianPlatform;
PLATFORMS['galaxian-scramble'] = GalaxianScramblePlatform;
