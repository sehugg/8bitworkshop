
import { Platform, getOpcodeMetadata_6502, getToolForFilename_6502, Base6502MachinePlatform } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { BaseMAME6502Platform } from "../common/mameplatform";
import { Atari5200, Atari800 } from "../machine/atari8";

declare var jt; // for 6502

var Atari8_PRESETS = [
  {id:'hello.dasm', name:'Hello World (ASM)'},
  {id:'hellopm.dasm', name:'Hello Sprites (ASM)'},
  {id:'helloconio.c', name:'Text Mode (C)'},
  {id:'siegegame.c', name:'Siege Game (C)'},
  {id:'hellodlist.c', name:'Display List (C)'},
];

var Atari800_PRESETS = Atari8_PRESETS.concat([
  {id:'sieve.bas', name:'Benchmark (FastBasic)'},
  {id:'pmtest.bas', name:'Sprites Test (FastBasic)'},
  {id:'dli.bas', name:'DLI Test (FastBasic)'},
  {id:'joyas.bas', name:'Match-3 Game (FastBasic)'},
]);

const Atari800_MemoryMap = { main:[
  {name:'RAM',start:0x0,size:0xc000,type:'ram'},
  {name:'Left Cartridge ROM',start:0xa000,size:0x2000,type:'rom'},
  {name:'GTIA',start:0xd000,size:0x20,type:'io'},
  {name:'POKEY',start:0xd200,size:0x10,type:'io'},
  {name:'PIA',start:0xd300,size:0x04,type:'io'},
  {name:'ANTIC',start:0xd400,size:0x10,type:'io'},
  {name:'Cartridge Control Line',start:0xd600,size:0x100,type:'io'},
  {name:'ROM',start:0xd800,size:0x800,type:'rom'},
  {name:'Character Set',start:0xe000,size:0x400,type:'rom'},
  {name:'ROM',start:0xe400,size:0x1c00,type:'rom'},
] }

function getToolForFilename_Atari8(fn:string) {
  if (fn.endsWith(".bas") || fn.endsWith(".fb") || fn.endsWith(".fbi")) return "fastbasic";
  else return getToolForFilename_6502(fn);
}

class Atari800Platform extends Base6502MachinePlatform<Atari800> {
  newMachine()          { return new Atari800(); }
  getPresets()          { return Atari800_PRESETS; }
  getDefaultExtension() { return ".c"; };
  getToolForFilename = getToolForFilename_Atari8;
  readAddress(a)        { return this.machine.readConst(a); }
  getMemoryMap()        { return Atari800_MemoryMap; }
  showHelp = atari8_showHelp;
  getROMExtension = atari8_getROMExtension;
  
  async start() {
    let bios = await this.loadKernel();
    await super.start();
    this.machine.loadBIOS(bios);
  }
  biosPath = 'res/altirra/kernel.rom';
  async loadKernel() {
    var biosResponse = await fetch(this.biosPath);
    if (biosResponse.status == 200 || (biosResponse as any as Blob).size) {
      var biosBinary = await biosResponse.arrayBuffer();
      return new Uint8Array(biosBinary);
    } else throw new Error('could not load BIOS file');
  }
}

class Atari5200Platform extends Atari800Platform {
  newMachine() { return new Atari5200(); }
  biosPath = 'res/altirra/superkernel.rom';
}


/// MAME support

abstract class Atari8MAMEPlatform extends BaseMAME6502Platform {
  getPresets() { return Atari8_PRESETS; }
  getToolForFilename = getToolForFilename_Atari8;
  getOpcodeMetadata = getOpcodeMetadata_6502;
  getDefaultExtension() { return ".asm"; };
  showHelp = atari8_showHelp;
}

class Atari800MAMEPlatform extends Atari8MAMEPlatform implements Platform {
  getPresets() { return Atari800_PRESETS; }
  loadROM(title, data) {
    if (!this.started) {
      this.startModule(this.mainElement, {
        jsfile:'mame8bitws.js',
        biosfile:'a800xl.zip',
        cfgfile:'a800xl.cfg',
        driver:'a800xl',
        width:336*2,
        height:225*2,
        romfn:'/emulator/cart.rom',
        romdata:new Uint8Array(data),
        romsize:0x2000,
        preInit:function(_self) {
        },
      });
    } else {
      this.loadROMFile(data);
      this.loadRegion(":cartleft:cart:rom", data);
    }
  }
  start() {
  }
  getMemoryMap = function() { return Atari800_MemoryMap };
}

class Atari5200MAMEPlatform extends Atari8MAMEPlatform implements Platform {
  loadROM(title, data) {
    if (!this.started) {
      this.startModule(this.mainElement, {
        jsfile:'mame8bitws.js',
        biosfile:'a5200/5200.rom',
        cfgfile:'a5200.cfg',
        driver:'a5200',
        width:336*2,
        height:225*2,
        romfn:'/emulator/cart.rom',
        romdata:new Uint8Array(data),
        romsize:0x8000,
        preInit:function(_self) {
        },
      });
    } else {
      this.loadROMFile(data);
      this.loadRegion(":cartleft:cart:rom", data);
    }
  }
  start() {
  }
  getMemoryMap = function() { return { main:[
    {name:'RAM',start:0x0,size:0x4000,type:'ram'},
    {name:'Cartridge ROM',start:0x4000,size:0x8000,type:'rom'},
    {name:'GTIA',start:0xc000,size:0x20,type:'io'},
    {name:'ANTIC',start:0xd400,size:0x10,type:'io'},
    {name:'POKEY',start:0xe800,size:0x10,type:'io'},
    {name:'ATARI Character Set',start:0xf800,size:0x400,type:'rom'},
    {name:'ROM',start:0xfc00,size:0x400,type:'rom'},
  ] } };
}

function atari8_getROMExtension(rom: Uint8Array) {
  if (rom == null) return ".bin";
  if (rom[0] == 0xff && rom[1] == 0xff) return ".xex";
  else return ".rom";
}

function atari8_showHelp() {
  return "https://8bitworkshop.com/docs/platforms/atari8/";
}

///

PLATFORMS['atari8-800.xlmame'] = Atari800MAMEPlatform
PLATFORMS['atari8-800xl.mame'] = Atari800MAMEPlatform // for dithertron
PLATFORMS['atari8-5200.mame'] = Atari5200MAMEPlatform
PLATFORMS['atari8-800'] = Atari800Platform
PLATFORMS['atari8-5200'] = Atari5200Platform
