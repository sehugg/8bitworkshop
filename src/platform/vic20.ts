
import { VIC20_WASMMachine } from "../machine/vic20";
import { Platform, Base6502MachinePlatform, getToolForFilename_6502, getOpcodeMetadata_6502 } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { BaseMAME6502Platform } from "../common/mameplatform";

const VIC20_PRESETS = [
  {id:'hello.dasm', name:'Hello World (ASM)'},
  {id:'hellocart.dasm', name:'Hello Cartridge (ASM)'},
  {id:'siegegame.c', name:'Siege Game (C)'},
];

const VIC20_MEMORY_MAP = { main:[
  {name:'RAM',          start:0x0000,size:0x0400,type:'ram'},
  {name:'RAM',          start:0x1000,size:0x1000,type:'ram'},
  {name:'BLK1 Cart ROM',start:0x2000,size:0x2000,type:'rom'},
  {name:'BLK2 Cart ROM',start:0x4000,size:0x2000,type:'rom'},
  {name:'BLK3 Cart ROM',start:0x6000,size:0x2000,type:'rom'},
  {name:'Character ROM',start:0x8000,size:0x1000,type:'rom'},
  {name:'I/O 1',        start:0x9000,size:0x0400,type:'io'},
  {name:'Color RAM',    start:0x9400,size:0x0400,type:'io'},
  {name:'I/O 2',        start:0x9800,size:0x0400,type:'io'},
  {name:'I/O 3',        start:0x9c00,size:0x0400,type:'io'},
  {name:'BLK5 Autostart',start:0xa000,size:0x2000,type:'rom'},
  {name:'BASIC ROM',    start:0xc000,size:0x2000,type:'rom'},
  {name:'KERNAL ROM',   start:0xe000,size:0x2000,type:'rom'},
] }

// WASM VIC20 platform
class VIC20WASMPlatform extends Base6502MachinePlatform<VIC20_WASMMachine> implements Platform {

  newMachine()          { return new VIC20_WASMMachine('vic20'); }

  getPresets()          { return VIC20_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.readConst(a); }
  getMemoryMap()        { return VIC20_MEMORY_MAP; }
  showHelp() {
    return "https://8bitworkshop.com/docs/platforms/vic20/";
  }
  getROMExtension(rom:Uint8Array) { 
    /*
    if (rom && rom[0] == 0x00 && rom[1] == 0x80 && rom[2+4] == 0xc3 && rom[2+5] == 0xc2) return ".crt";
    */
    if (rom && rom[0] == 0x01 && rom[1] == 0x08) return ".prg";
    else return ".bin";
  }
}

// VIC20 MAME platform (TODO)
abstract class VIC20MAMEPlatform extends BaseMAME6502Platform {
  getPresets() { return VIC20_PRESETS; }
  getToolForFilename = getToolForFilename_6502;
  getOpcodeMetadata = getOpcodeMetadata_6502;
  getDefaultExtension() { return ".c"; }
  loadROM(title, data) {
    if (!this.started) {
      this.startModule(this.mainElement, {
        jsfile:'mame8bitpc.js',
        biosfile:'vic20.zip',
        cfgfile:'vic20.cfg',
        driver:'vic20',
        width:418,
        height:235,
        romfn:'/emulator/image.crt',
        romdata:new Uint8Array(data),
        romsize:0x10000,
        extraargs: ['-autoboot_delay','5','-autoboot_command','load "$",8,1\n'],
        preInit:function(_self) {
        },
      });
    } else {
      this.loadROMFile(data);
      this.loadRegion(":quickload", data);
      var result = this.luacall(`image:load("/emulator/image.prg")`)
      console.log('load rom', result);
      //this.loadRegion(":exp:standard", data);
    }
  }
  start() {
  }
  getMemoryMap() { return VIC20_MEMORY_MAP; }
}


PLATFORMS['vic20'] = VIC20WASMPlatform;
PLATFORMS['vic20.wasm'] = VIC20WASMPlatform;
PLATFORMS['vic20.mame'] = VIC20MAMEPlatform;
