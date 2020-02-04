
import { C64, C64_WASMMachine } from "../machine/c64";
import { Platform, Base6502MachinePlatform, getToolForFilename_6502, getOpcodeMetadata_6502 } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";

const C64_PRESETS = [
  {id:'hello.dasm', name:'Hello World (ASM)'},
  {id:'sidtune.dasm', name:'SID Tune (ASM)'},
  {id:'eliza.c', name:'Eliza (C)'},
  {id:'tgidemo.c', name:'TGI Graphics Demo (C)'},
  {id:'upandaway.c', name:'Up, Up and Away (C)'},
  {id:'joymove.c', name:'Joystick Movement (C)'},
  {id:'scroll1.c', name:'Scrolling 1 (C)'},
  {id:'scroll2.c', name:'Scrolling 2 (C)'},
  {id:'scroll3.c', name:'Scrolling 3 (C)'},
  {id:'scroll4.c', name:'Scrolling 4 (C)'},
  {id:'scroll5.c', name:'Scrolling 5 (C)'},
  {id:'climber.c', name:'Climber Game (C)'},
];

const C64_MEMORY_MAP = { main:[
  {name:'6510 Registers',start:0x0,  size:0x2,type:'io'},
  //{name:'RAM',          start:0x2,   size:0x7ffe,type:'ram'},
  {name:'Cartridge ROM',start:0x8000,size:0x2000,type:'rom'},
  {name:'BASIC ROM',    start:0xa000,size:0x2000,type:'rom'},
  {name:'RAM',          start:0xc000,size:0x1000,type:'ram'},
  {name:'VIC-II I/O',   start:0xd000,size:0x0400,type:'io'},
  {name:'Color RAM',    start:0xd800,size:0x0400,type:'io'},
  {name:'CIA 1',        start:0xdc00,size:0x0100,type:'io'},
  {name:'CIA 2',        start:0xdd00,size:0x0100,type:'io'},
  {name:'KERNAL ROM',   start:0xe000,size:0x2000,type:'rom'},
] }

class C64Platform extends Base6502MachinePlatform<C64> implements Platform {

  newMachine()          { return new C64(); }
  getPresets()          { return C64_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.readConst(a); }
  loadBIOS(bios)	      { this.machine.loadBIOS(bios); }
  getMemoryMap()        { return C64_MEMORY_MAP; }
}

class C64WASMPlatform extends Base6502MachinePlatform<C64_WASMMachine> implements Platform {

  newMachine()          { return new C64_WASMMachine('c64'); }

  async start() {
    // TODO: start() needs to block
    await this.machine.loadWASM();
    super.start();
  }
  getPresets()          { return C64_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.readConst(a); }
  getMemoryMap()        { return C64_MEMORY_MAP; }
}

PLATFORMS['c64'] = C64WASMPlatform;
PLATFORMS['c64.wasm'] = C64WASMPlatform;
PLATFORMS['c64.js'] = C64Platform;
