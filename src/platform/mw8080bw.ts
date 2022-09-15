
import { Midway8080 } from "../machine/mw8080bw";
import { BaseZ80MachinePlatform } from "../common/baseplatform";
import { Platform } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";

// http://www.computerarcheology.com/Arcade/

const MW8080BW_PRESETS = [
  { id: 'gfxtest.c', name: 'Graphics Test' },
  { id: 'shifter.c', name: 'Sprite w/ Bit Shifter' },
  { id: 'game2.c', name: 'Cosmic Impalas' },
];

class Midway8080BWPlatform extends BaseZ80MachinePlatform<Midway8080> implements Platform {

  newMachine()          { return new Midway8080(); }
  getPresets()          { return MW8080BW_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.read(a); }
  getMemoryMap = function() { return { main:[
      {name:'Frame Buffer',start:0x2400,size:7168,type:'ram'},
  ] } };
  showHelp() { return "https://8bitworkshop.com/docs/platforms/arcade/index.html#midway-8080" }
}


PLATFORMS['mw8080bw'] = Midway8080BWPlatform;
