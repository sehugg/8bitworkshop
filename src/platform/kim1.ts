
import { Platform, getOpcodeMetadata_6502, getToolForFilename_6502 } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { KIM1 } from "../machine/kim1";
import { Base6502MachinePlatform } from "../common/baseplatform";

var KIM1_PRESETS = [
  {id:'hello.dasm', name:'Hello World (ASM)'},
];

class KIM1Platform extends Base6502MachinePlatform<KIM1> implements Platform {

  newMachine()          { return new KIM1(); }
  getPresets()          { return KIM1_PRESETS; }
  getDefaultExtension() { return ".dasm"; };
  readAddress(a)        { return this.machine.readConst(a); }

  getMemoryMap = function() { return { main:[
      {name:'RAM',          start:0x0000,size:0x1400,type:'ram'},
      {name:'6530',         start:0x1700,size:0x0040,type:'io'},
      {name:'6530',         start:0x1740,size:0x0040,type:'io'},
      {name:'RAM',          start:0x1780,size:0x0080,type:'ram'},
      {name:'BIOS',         start:0x1800,size:0x0800,type:'rom'},
  ] } };
}

///

PLATFORMS['kim1'] = KIM1Platform;
