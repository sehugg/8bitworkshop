
import { CPC_WASMMachine } from "../machine/cpc";
import { Platform, BaseZ80MachinePlatform } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";

const CPC_PRESETS = [
  {id:'easy_stdio_boxes.c', name:'Standard I/O', category:'C'},
  {id:'easy_mode_strings.c', name:'Video Modes'},
  {id:'easy_random.c', name:'Random Numbers'},
  {id:'easy_sprites.c', name:'Keyboard + Sprites'},
  {id:'medium_scrolling.c', name:'Scrolling Text'},
  {id:'siegegame.c', name:'Siege Game'},
  {id:'music.c', name:'Music Player'},
  //{id:'sprite_demo.c', name:'Sprite Demo'},
  //{id:'keyboard_redefine.c', name:'Keyboard Redefine'},
  {id:'hello.asm', name:'Hello World', category:'Assembly'},
];

const CPC_MEMORY_MAP = { main:[
  {name:'BIOS', start:0x0000, size:0x4000, type:'rom'},
  {name:'Screen RAM', start:0xc000, size:0x4000, type:'ram'},
] }

// WASM CPC platform
class CPCWASMPlatform extends BaseZ80MachinePlatform<CPC_WASMMachine> implements Platform {

  newMachine()          { return new CPC_WASMMachine('cpc'); }

  getPresets()          { return CPC_PRESETS; }
  readAddress(a)        { return this.machine.readConst(a); }
  getMemoryMap()        { return CPC_MEMORY_MAP; }
  showHelp() {
    return "https://8bitworkshop.com/docs/platforms/cpc/";
  }
}

// TODO: make different cpc_init() types for different platforms
PLATFORMS['cpc.6128'] = CPCWASMPlatform;
PLATFORMS['cpc.464'] = CPCWASMPlatform;
PLATFORMS['cpc.kcc'] = CPCWASMPlatform;
