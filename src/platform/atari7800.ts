
import { Atari7800 } from "../machine/atari7800";
import { Platform, Base6502MachinePlatform, getToolForFilename_6502 } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";

var Atari7800_PRESETS = [
  {id:'sprites.dasm', name:'Sprites (ASM)', category:'Assembler'},

  {id:'wsync.c', name:'WSYNC', category:'CC65'},
  {id:'sprites.c', name:'Double Buffering'},
  {id:'scroll.c', name:'Scrolling'},

  {id:'test_conio.c78', name:'Conio Test', category:'cc7800'},
  {id:'example_small_sprites.c78', name:'Small Sprites'},
  {id:'example_vertical_scrolling.c78', name:'Vertical Scrolling'},
];

class Atari7800Platform extends Base6502MachinePlatform<Atari7800> implements Platform {

  newMachine()          { return new Atari7800(); }
  getPresets()          { return Atari7800_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.readConst(a); }
  // TODO loadBIOS(bios)	{ this.machine.loadBIOS(a); }
  getMemoryMap = function() { return { main:[
      {name:'TIA',start:0x00,size:0x20,type:'io'},
      {name:'MARIA',start:0x20,size:0x20,type:'io'},
      {name:'RAM (6166 Block 0)',start:0x40,size:0xc0,type:'ram'},
      {name:'RAM (6166 Block 1)',start:0x140,size:0xc0,type:'ram'},
      {name:'PIA',start:0x280,size:0x18,type:'io'},
      {name:'RAM',start:0x1800,size:0x1000,type:'ram'}, // TODO: shadow ram
      {name:'Cartridge ROM',start:0x4000,size:0xc000-6,type:'rom'},
      {name:'CPU Vectors',start:0xfffa,size:0x6,type:'rom'},
  ] } };
  getROMExtension() { return ".a78"; }
  getDebugTree() {
    let tree = super.getDebugTree();
    tree['display_list'] = this.machine.getDebugDisplayLists();
    return tree;
  }
  getToolForFilename(filename: string) {
    if (filename.endsWith(".cc7800")) return "cc7800";
    if (filename.endsWith(".c78")) return "cc7800";
    return getToolForFilename_6502(filename);
  }
}

///

PLATFORMS['atari7800'] = Atari7800Platform;
