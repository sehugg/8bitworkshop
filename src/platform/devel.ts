
import { Platform, getOpcodeMetadata_6502, getToolForFilename_6502 } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { Devel6502 } from "../machine/devel";
import { Base6502MachinePlatform } from "../common/baseplatform";

var DEVEL_6502_PRESETS = [
  {id:'hello.dasm', name:'Hello World (ASM)'},
];

class Devel6502Platform extends Base6502MachinePlatform<Devel6502> implements Platform {

  newMachine()          { return new Devel6502(); }
  getPresets()          { return DEVEL_6502_PRESETS; }
  getDefaultExtension() { return ".dasm"; };
  readAddress(a)        { return this.machine.readConst(a); }

  getMemoryMap = function() { return { main:[
      {name:'RAM',          start:0x0000,size:0x4000,type:'ram'},
      {name:'ROM',          start:0x8000,size:0x8000,type:'rom'},
  ] } };
}

///

PLATFORMS['devel-6502'] = Devel6502Platform;
