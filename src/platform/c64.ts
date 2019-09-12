
import { C64 } from "../machine/c64";
import { Platform, Base6502MachinePlatform } from "../baseplatform";
import { PLATFORMS } from "../emu";

var C64_PRESETS = [
  {id:'hello.dasm', name:'Hello World (ASM)'},
];

class C64Platform extends Base6502MachinePlatform<C64> implements Platform {

  newMachine()          { return new C64(); }
  getPresets()          { return C64_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.readConst(a); }
  loadBios(bios)	{ this.machine.loadBIOS(bios); }
  getMemoryMap()        { return { main:[
      {name:'6510 Registers',start:0x0,  size:0x2,type:'io'},
      {name:'RAM',          start:0x2,   size:0x7ffe,type:'ram'},
      {name:'Cartridge ROM',start:0x8000,size:0x2000,type:'rom'},
      {name:'BASIC ROM',    start:0xa000,size:0x2000,type:'rom'},
      {name:'RAM',          start:0xc000,size:0x1000,type:'ram'},
      {name:'VIC-II I/O',   start:0xd000,size:0x0400,type:'io'},
      {name:'Color RAM',    start:0xd800,size:0x0400,type:'io'},
      {name:'CIA 1',        start:0xdc00,size:0x0100,type:'io'},
      {name:'CIA 2',        start:0xdd00,size:0x0100,type:'io'},
      {name:'KERNAL ROM',   start:0xe000,size:0x2000,type:'rom'},
  ] } };
}

PLATFORMS['c64'] = C64Platform;

