
import { Platform, BaseMAMEPlatform, getOpcodeMetadata_6502, getToolForFilename_6502 } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";

const APPLE2_PRESETS = [
  {id:'sieve.c', name:'Sieve'},
  {id:'keyboardtest.c', name:'Keyboard Test'},
  {id:'mandel.c', name:'Mandelbrot'},
  {id:'tgidemo.c', name:'TGI Graphics Demo'},
  {id:'Eliza.c', name:'Eliza'},
  {id:'siegegame.c', name:'Siege Game'},
  {id:'cosmic.c', name:'Cosmic Impalas'},
  {id:'farmhouse.c', name:"Farmhouse Adventure"},
  {id:'yum.c', name:"Yum Dice Game"},
  {id:'lzgtest.c', name:"LZG Decompressor (C)"},
  {id:'hgrtest.a', name:"HGR Test (ASM)"},
  {id:'conway.a', name:"Conway's Game of Life (ASM)"},
  {id:'lz4fh.a', name:"LZ4FH Decompressor (ASM)"},
  {id:'deltamod.dasm', name:"Delta Modulation (ASM)"},
//  {id:'zap.dasm', name:"ZAP! (ASM)"},
//  {id:'tb_6502.s', name:'Tom Bombem (assembler game)'},
];

/// MAME support

class Apple2MAMEPlatform extends BaseMAMEPlatform implements Platform {

  start () {
    this.startModule(this.mainElement, {
      jsfile:'mame8bitws.js',
      biosfile:['apple2e.zip'],
      //cfgfile:'nes.cfg',
      driver:'apple2e',
      width:280*2,
      height:192*2,
      //romfn:'/emulator/cart.nes',
      //romsize:romSize,
      //romdata:new lzgmini().decode(lzgRom).slice(0, romSize),
      preInit:function(_self) {
      },
    });
  }

  getOpcodeMetadata = getOpcodeMetadata_6502;
  getDefaultExtension () { return ".c"; };
  getToolForFilename = getToolForFilename_6502;

  getPresets () { return APPLE2_PRESETS; }

  loadROM (title, data) {
    this.loadROMFile(data);
    // TODO
  }
}

///

import { AppleII } from "../machine/apple2";
import { Base6502MachinePlatform } from "../common/baseplatform";
import { CodeAnalyzer_apple2 } from "../common/analysis";

class NewApple2Platform extends Base6502MachinePlatform<AppleII> implements Platform {

  newMachine()          { return new AppleII(); }
  getPresets()          { return APPLE2_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.readConst(a); }
  // TODO loadBIOS(bios)	{ this.machine.loadBIOS(a); }
  getMemoryMap = function() { return { main:[
      {name:'Zero Page RAM',start:0x0,size:0x100,type:'ram'},
      {name:'Line Input RAM',start:0x200,size:0x100,type:'ram'},
      {name:'RAM',start:0x300,size:0xc0,type:'ram'},
      {name:'DOS Vectors',start:0x3c0,size:0x40,type:'ram'},
      {name:'Text/Lores Page 1',start:0x400,size:0x400,type:'ram'},
      {name:'RAM',start:0x800,size:0x1800,type:'ram'},
      {name:'Hires Page 1',start:0x2000,size:0x2000,type:'ram'},
      {name:'Hires Page 2',start:0x4000,size:0x2000,type:'ram'},
      {name:'RAM',start:0x6000,size:0x6000,type:'ram'},
      {name:'I/O',start:0xc000,size:0x1000,type:'io'},
      {name:'ROM',start:0xd000,size:0x3000-6,type:'rom'},
  ] } };
  getROMExtension(rom:Uint8Array) {
    if (rom && rom.length == 35*16*256) return ".dsk"; // DSK image
    return ".bin";
  };
  getToolForFilename = (fn:string) : string => {
    if (fn.endsWith(".lnk")) return "merlin32";
    else return getToolForFilename_6502(fn);
  }
  /*
  newCodeAnalyzer() {
    return new CodeAnalyzer_apple2(this);
  }
  getOriginPC() {
    return 0x803; // TODO?
  }
  */
}

//PLATFORMS['apple2.mame'] = Apple2MAMEPlatform;
PLATFORMS['apple2'] = NewApple2Platform;
