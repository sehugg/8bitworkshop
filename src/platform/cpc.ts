
import { CPC_WASMMachine } from "../machine/cpc";
import { Platform, BaseZ80MachinePlatform } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";

const CPC_PRESETS = [
  {id:'hello.asm', name:'Hello World (ASM)'},
  {id:'sprite_demo.c', name:'Sprite Demo (C)'},
  {id:'keyboard_redefine.c', name:'Keyboard Redefine (C)'},
];

const CPC_MEMORY_MAP = { main:[
  {name:'BIOS', start:0x0000, size:0x4000, type:'rom'},
  {name:'Screen RAM', start:0xc000, size:0x4000, type:'ram'},
] }

// WASM CPC platform
class CPCWASMPlatform extends BaseZ80MachinePlatform<CPC_WASMMachine> implements Platform {

  newMachine()          { return new CPC_WASMMachine('cpc'); }

  getPresets()          { return CPC_PRESETS; }
  getDefaultExtension() { return ".asm"; };
  readAddress(a)        { return this.machine.readConst(a); }
  getMemoryMap()        { return CPC_MEMORY_MAP; }
  showHelp() {
    window.open("https://worldofspectrum.org/faq/reference/reference.htm", "_help");
  }
}

PLATFORMS['cpc.464'] = CPCWASMPlatform;
