"use strict";

import { Platform, BaseMAMEPlatform, getOpcodeMetadata_6502, getToolForFilename_6502, Base6502MachinePlatform } from "../common/baseplatform";
import { PLATFORMS, Keys, makeKeycodeMap } from "../common/emu";
import { Atari8_WASMMachine } from "../machine/atari8";

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

const ATARI8_KEYCODE_MAP = makeKeycodeMap([
  [Keys.VK_SPACE, 0, 0],
  [Keys.VK_ENTER, 0, 0],
]);

const Atari800_MemoryMap = { main:[
  {name:'RAM',start:0x0,size:0x10000,type:'ram'},
  {name:'Left Cartridge ROM',start:0xa000,size:0x2000,type:'rom'},
  {name:'GTIA',start:0xd000,size:0x20,type:'io'},
  {name:'POKEY',start:0xd200,size:0x10,type:'io'},
  {name:'PIA',start:0xd300,size:0x04,type:'io'},
  {name:'ANTIC',start:0xd400,size:0x10,type:'io'},
  {name:'Cartridge Control Line',start:0xd600,size:0x100,type:'io'},
  {name:'ROM',start:0xd800,size:0x800,type:'rom'},
  {name:'ATARI Character Set',start:0xe000,size:0x400,type:'rom'},
  {name:'ROM',start:0xe400,size:0x1c00,type:'rom'},
] }

function getToolForFilename_Atari8(fn:string) {
  if (fn.endsWith(".bas") || fn.endsWith(".fb") || fn.endsWith(".fbi")) return "fastbasic";
  else return getToolForFilename_6502(fn);
}

/// MAME support

abstract class Atari8MAMEPlatform extends BaseMAMEPlatform {
  getPresets() { return Atari8_PRESETS; }
  getToolForFilename = getToolForFilename_Atari8;
  getOpcodeMetadata = getOpcodeMetadata_6502;
  getDefaultExtension() { return ".asm"; };
  showHelp(tool:string, ident:string) {
    if (tool == 'fastbasic')
      window.open("https://github.com/dmsc/fastbasic/blob/master/manual.md", "_help");
    else
      window.open("https://atariwiki.org/wiki/Wiki.jsp?page=Assembler", "_help"); // TODO
  }
}

abstract class Atari8WASIMAMEPlatform extends BaseMAMEPlatform {
  getPresets() { return Atari8_PRESETS; }
  getToolForFilename = getToolForFilename_Atari8;
  getOpcodeMetadata = getOpcodeMetadata_6502;
  getDefaultExtension() { return ".asm"; };
  showHelp(tool:string, ident:string) {
    if (tool == 'fastbasic')
      window.open("https://github.com/dmsc/fastbasic/blob/master/manual.md", "_help");
    else
      window.open("https://atariwiki.org/wiki/Wiki.jsp?page=Assembler", "_help"); // TODO
  }
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

///

// Altirra Superkernel ROM (http://www.virtualdub.org/altirra.html) compiled with MADS
const ALTIRRA_SUPERKERNEL_LZG = `
TFpHAAAIAAAABJGU01hQARcZHSUAACUFGCUBABgAAGZmZh2IZv9mJUEAGD5gPAZ8HVBsGDBmRgAcNhw4
b2Y7HagdoA4cGBgcDgAAcDgYGDhwHSA8/zwdehgYfhkFGh1EMCWhfhkGYx0IAAAGDBgwYEAAADxmbnZm
PB0MHTgYHRs8Zh0RJeF+DBgMHVAMHDxsfgwdCGB8Bh1IPGB8ZiXifh15MB1oPB2IPGY+Bgw4GQRVGQNx
JeMwHV4YDAYZBHclQWAdBhgwYBkEYBkC6Dxmbm5gPh0nHT9+ZgAAfGZ8ZmZ8HVBgYBkCUHhsZmZseBkD
eGBgHXwl4h04PmBgbmYdMB1uGSIrfhkiOR0YBiUBHXAdLR0zAAAdJR2wY3d/a2NjHRB2fn5uHRA8HS4d
YBkCZhkCSB1IbDYdyB1wPGA8BgYdGBkDUBkkkGZmfiXkPB0IY2Nrf3cZAkhmPB0zJeMdoH4ZAtcdIB4d
bx4AAEAZAuoGAAB4HUh4AAAIHDYdLiUF/wAANn9/PhwIGSLHHx8lgQMlBR0D+PgZRA/4+Bkk5CXjAwcO
HDhw4MDA4HA4HA4HAwEDBw8fP3//HRgADyUBgMDg8Pj8/v8dRB1M8CUBJeL/HZolBh3GHZQcHHd3CBwd
RxkDeBkGFR0D//8diDx+fn48GQUu///AJQUdhxkjEx0gGQVEJQIZA8AdCHhgeGB+GQL4GDwZIjoZA0l+
GSIwGDB+MBlDFwx+DCXjPH4dkAA8Bj4ZIshgGUJYfB1IYGBgPBkiyD5mHVAAPGZ+HUgOGD4ZBJ8dTwZ8
HehmAAAYADgYGB1oGSP6PB0QbBkj+B0OHZAAZn9/axkich1nHRAZI+kdUBkm+RkDSAYdSBlDWAAZY3EA
ABliPxgOHXglARkCgBkl+ABja38+Nh1IPBgZY2kdVwwZQqEZZDgZAtAYPBljzyUCAH54fG5mBgAIGDh4
OBgIABAYHB4cGBAAbAACSKkgLA7o0A1FAI0O6KUlgmwQAjAPqYAZCQkMAnAPqUAZCQkIAmodLfAZCi0S
AmokAPASGQ5EFAKpARkODBYCKhkOCxgZEAsaAopIur0BASkQ0ANsDgJoqmhA////aKgdQUiKSJhI5gLQ
COYBpQQwAuYEpQPQ5aUFjQLUpQaNA9SlB40A1KAAJAQQAqQBogiYVQidEsDKEPeiB70A6JURyhD4jQvo
bAQC////GQJBrQnoSikPqr0T/WwKAv8LAAoOCQgHDQYFBAwDAgEsD9SND9QQA2wGAmwCAnjYov+arf2/
yf/QA2z+v6IAqQCVAJ0AwJ0A1J0A6OjQ8qn4jQnUogu9lf6dAAIZAmtPvc39nQAQHUMTvei/nVAdQ6kQ
hQypD4UNqQCFDiVhDyVhEKkEjRvAogq9wh0nIB1cIoUHqcCNDtQdFQWpIIUGqQKND+ipwIUZIhapeMUC
0Pxs/r9wcHBCABCCB0HC/SFsdGlycmEAFRIQEAAyLy0AK2VybmVsGWpyJQMub3cAcGxheWluZxoZDxUZ
a58lHiUcJQkD/Lj8svyh/gL9svxI5gzQBBkiJhkj9SUfJR8lHiUBI/0x/QD8`;


/// WASM Atari8 platform
class Atari8WASMPlatform extends Base6502MachinePlatform<Atari8_WASMMachine> implements Platform {

  newMachine()          { return new Atari8_WASMMachine('atari8'); }
  getPresets()          { return Atari800_PRESETS; }
  getDefaultExtension() { return ".c"; };
  getToolForFilename = getToolForFilename_Atari8;
  readAddress(a)        { return this.machine.readConst(a); }
  getMemoryMap()        { return Atari800_MemoryMap; }
  showHelp() {
    // TODO
  }
  getROMExtension(rom:Uint8Array) { 
    // TODO
    if (rom && rom[0] == 0x01 && rom[1] == 0x08) return ".prg";
    else return ".bin";
  }
}

class Atari800WASMPlatform extends Atari8WASMPlatform {
  
}

///

PLATFORMS['atari8-800xl.mame'] = Atari800MAMEPlatform
PLATFORMS['atari8-5200.mame'] = Atari5200MAMEPlatform
PLATFORMS['atari8-800xl'] = Atari800WASMPlatform
