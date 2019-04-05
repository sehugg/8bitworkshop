"use strict";

import { Platform, Base6502Platform, BaseMAMEPlatform, getOpcodeMetadata_6502, cpuStateToLongString_6502, getToolForFilename_6502, dumpStackToString, ProfilerOutput } from "../baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap, dumpRAM, KeyFlags, EmuHalt } from "../emu";
import { hex, lpad, lzgmini, byteArrayToString } from "../util";
import { CodeAnalyzer_nes } from "../analysis";
import { SampleAudio } from "../audio";

declare var jsnes : any;

const JSNES_PRESETS = [
  {id:'ex0.asm', name:'Initialization (ASM)'},
  {id:'ex1.asm', name:'Hello World (ASM)'},
  {id:'ex2.asm', name:'Scrolling Demo (ASM)'},
  {id:'ex3.asm', name:'Sprite Demo (ASM)'},
  {id:'ex4.asm', name:'Controller Demo (ASM)'},
  {id:'hello.c', name:'Text'},
  {id:'scroll.c', name:'Scrolling'},
  {id:'vrambuffer.c', name:'VRAM Buffer'},
  {id:'sprites.c', name:'Sprites'},
  {id:'metasprites.c', name:'Metasprites'},
  {id:'flicker.c', name:'Flickering Sprites'},
  {id:'metacursor.c', name:'Controllers'},
  {id:'metatrigger.c', name:'Trigger Mode + Vbright'},
  {id:'rletitle.c', name:'Title Screen RLE'},
  {id:'statusbar.c', name:'Split Status Bar'},
  {id:'horizmask.c', name:'Offscreen Scrolling'},
  {id:'attributes.c', name:'Attribute Table + Pixels'},
  {id:'monobitmap.c', name:'Monochrome Bitmap'},
  {id:'aputest.c', name:'Sound Tester'},
  {id:'music.c', name:'Music Player'},
  {id:'siegegame.c', name:'Siege Game'},
  {id:'shoot2.c', name:'Solarian Game'},
  {id:'climber.c', name:'Platform Game'},
  {id:'fami.c', name:'Famitone Demo'},
  {id:'musicdemo.asm', name:'Famitone Demo (ASM)'},
  {id:'bankswitch.c', name:'Bank Switching'},
  {id:'irq.c', name:'IRQ Scanline Counter'},
  {id:'scrollrt.asm', name:'Line-by-line Scrolling (ASM)'},
];

/// JSNES

const JSNES_KEYCODE_MAP = makeKeycodeMap([
  [Keys.VK_X,     0, 0],
  [Keys.VK_Z,     0, 1],
  [Keys.VK_SPACE, 0, 2],
  [Keys.VK_ENTER, 0, 3],
  [Keys.VK_UP,    0, 4],
  [Keys.VK_DOWN,  0, 5],
  [Keys.VK_LEFT,  0, 6],
  [Keys.VK_RIGHT, 0, 7],
  [Keys.VK_Q,     1, 0],
  [Keys.VK_E,     1, 1],
  [Keys.VK_4,     1, 2],
  [Keys.VK_3,     1, 3],
  [Keys.VK_W,     1, 4],
  [Keys.VK_S,     1, 5],
  [Keys.VK_A,     1, 6],
  [Keys.VK_D,     1, 7],
]);

const _JSNESPlatform = function(mainElement) {

  var nes;
  var rom;
  var video, audio, timer;
  const audioFrequency = 44030; //44100
  var frameindex = 0;
  var ntvideo;
  var ntlastbuf;

 class JSNESPlatform extends Base6502Platform implements Platform {

  getPresets() { return JSNES_PRESETS; }

  start() {
    this.debugPCDelta = 1;
    var debugbar = $("<div>").appendTo(mainElement);
    audio = new SampleAudio(audioFrequency);
    video = new RasterVideo(mainElement,256,224,{overscan:true});
    video.create();
    // debugging view
    ntvideo = new RasterVideo(mainElement,512,480,{overscan:false});
    ntvideo.create();
    $(ntvideo.canvas).hide();
    ntlastbuf = new Uint32Array(0x1000);
    // toggle buttons
    $('<button>').text("Video").appendTo(debugbar).click(() => { $(video.canvas).toggle() });
    $('<button>').text("Nametable").appendTo(debugbar).click(() => { $(ntvideo.canvas).toggle() });

    var idata = video.getFrameData();
    nes = new jsnes.NES({
      onFrame: (frameBuffer : number[]) => {
        for (var i=0; i<frameBuffer.length; i++)
          idata[i] = frameBuffer[i] | 0xff000000;
        video.updateFrame();
        frameindex++;
        this.updateDebugViews();
      },
      onAudioSample: (left:number, right:number) => {
        if (frameindex < 10)
          audio.feedSample(0, 1); // avoid popping at powerup
        else
          audio.feedSample(left+right, 1);
      },
      onStatusUpdate: function(s) {
        console.log(s);
      },
      //TODO: onBatteryRamWrite
    });
    //nes.ppu.clipToTvSize = false;
    nes.stop = () => {
      // TODO: trigger breakpoint
      console.log(nes.cpu.toJSON());
      throw new EmuHalt("CPU STOPPED @ PC $" + hex(nes.cpu.REG_PC));
    };
    // insert debug hook
    nes.cpu._emulate = nes.cpu.emulate;
    nes.cpu.emulate = () => {
      var cycles = nes.cpu._emulate();
      this.evalDebugCondition();
      return cycles;
    }
    timer = new AnimationTimer(60, this.nextFrame.bind(this));
    // set keyboard map
    setKeyboardFromMap(video, [], JSNES_KEYCODE_MAP, (o,key,code,flags) => {
      if (flags & KeyFlags.KeyDown)
        nes.buttonDown(o.index+1, o.mask); // controller, button
      else if (flags & KeyFlags.KeyUp)
        nes.buttonUp(o.index+1, o.mask); // controller, button
    });
    //var s = ''; nes.ppu.palTable.curTable.forEach((rgb) => { s += "0x"+hex(rgb,6)+", "; }); console.log(s);
  }

  advance(novideo : boolean) {
    nes.frame();
  }

  updateDebugViews() {
   // don't update if view is hidden
   if (! $(ntvideo.canvas).is(":visible"))
     return;
   var a = 0;
   var attraddr = 0;
   var idata = ntvideo.getFrameData();
   var baseTile = nes.ppu.regS === 0 ? 0 : 256;
   for (var row=0; row<60; row++) {
     for (var col=0; col<64; col++) {
       a = 0x2000 + (col&31) + ((row%30)*32);
       if (col >= 32) a += 0x400;
       if (row >= 30) a += 0x800;
       var name = nes.ppu.mirroredLoad(a) + baseTile;
       var t = nes.ppu.ptTile[name];
       attraddr = (a & 0x2c00) | 0x3c0 | (a & 0x0C00) | ((a >> 4) & 0x38) | ((a >> 2) & 0x07);
       var attr = nes.ppu.mirroredLoad(attraddr);
       var tag = name ^ (attr<<9) ^ 0x80000000;
       if (tag != ntlastbuf[a & 0xfff]) {
         ntlastbuf[a & 0xfff] = tag;
         var i = row*64*8*8 + col*8;
         var j = 0;
         var attrshift = (col&2) + ((a&0x40)>>4);
         var coloradd = ((attr >> attrshift) & 3) << 2;
         for (var y=0; y<8; y++) {
           for (var x=0; x<8; x++) {
             var color = t.pix[j++];
             if (color) color += coloradd;
             var rgb = nes.ppu.imgPalette[color];
             idata[i++] = rgb | 0xff000000;
           }
           i += 64*8-8;
         }
       }
     }
   }
   ntvideo.updateFrame();
  }

  loadROM(title, data) {
    var romstr = byteArrayToString(data);
    nes.loadROM(romstr);
    frameindex = 0;
  }
  newCodeAnalyzer() {
    return new CodeAnalyzer_nes(this);
  }
  getOriginPC() {	// TODO: is actually NMI
    return (this.readAddress(0xfffa) | (this.readAddress(0xfffb) << 8)) & 0xffff;
  }
  getDefaultExtension() { return ".c"; };

  reset() {
    //nes.cpu.reset(); // doesn't work right, crashes
    nes.cpu.requestIrq(nes.cpu.IRQ_RESET);
  }
  isRunning() {
    return timer.isRunning();
  }
  pause() {
    timer.stop();
    audio.stop();
  }
  resume() {
    timer.start();
    audio.start();
  }

  runToVsync() {
    var frame0 = frameindex;
    this.runEval((c) => { return frameindex>frame0; });
  }

  getRasterScanline() : number {
    return nes.ppu.scanline;
  }
  readVRAMAddress(addr : number) : number {
    return nes.ppu.vramMem[addr & 0x7fff];
  }

  getCPUState() {
    var c = nes.cpu.toJSON();
    this.copy6502REGvars(c);
    return c;
  }
  // TODO don't need to save ROM?
  saveState() {
    //var s = $.extend(true, {}, nes);
    var s = nes.toJSON();
    s.c = s.cpu;
    this.copy6502REGvars(s.c);
    s.b = s.cpu.mem = s.cpu.mem.slice(0);
    s.ppu.vramMem = s.ppu.vramMem.slice(0);
    s.ppu.spriteMem = s.ppu.spriteMem.slice(0);
    s.ctrl = this.saveControlsState();
    return s;
  }
  loadState(state) {
    nes.fromJSON(state);
    //nes.cpu.fromJSON(state.cpu);
    //nes.mmap.fromJSON(state.mmap);
    //nes.ppu.fromJSON(state.ppu);
    nes.cpu.mem = state.cpu.mem.slice(0);
    nes.ppu.vramMem = state.ppu.vramMem.slice(0);
    nes.ppu.spriteMem = state.ppu.spriteMem.slice(0);
    this.loadControlsState(state.ctrl);
    //$.extend(nes, state);
  }
  saveControlsState() {
    return {
      c1: nes.controllers[1].state.slice(0),
      c2: nes.controllers[2].state.slice(0),
    };
  }
  loadControlsState(state) {
    nes.controllers[1].state = state.c1;
    nes.controllers[2].state = state.c2;
  }
  readAddress(addr) {
    return nes.cpu.mem[addr] & 0xff;
  }
  copy6502REGvars(c) {
    c.T = 0;
    c.PC = c.REG_PC;
    c.A = c.REG_ACC;
    c.X = c.REG_X;
    c.Y = c.REG_Y;
    c.SP = c.REG_SP & 0xff;
    c.Z = c.F_ZERO;
    c.N = c.F_SIGN;
    c.V = c.F_OVERFLOW;
    c.D = c.F_DECIMAL;
    c.C = c.F_CARRY;
    c.I = c.F_INTERRUPT;
    c.R = 1;
    c.o = this.readAddress(c.PC+1);
    return c;
  }

  getDebugCategories() {
    return super.getDebugCategories().concat(['PPU', 'Mapper']);
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'PPU': return this.ppuStateToLongString(state.ppu, state.b);
      case 'Mapper': return this.mapperStateToLongString(state.mmap, state.b);
      default: return super.getDebugInfo(category, state);
    }
  }
  ppuStateToLongString(ppu, mem) {
    var s = '';
    var PPUFLAGS = [
      ["f_nmiOnVblank","NMI_ON_VBLANK"],
      ["f_spVisibility","SPRITES"],
      ["f_spClipping","NO_CLIP_SPRITES"],
      ["f_dispType","MONOCHROME"],
      ["f_bgVisibility","BACKGROUND"],
      ["f_bgClipping","NO_CLIP_BACKGROUND"],
    ];
    for (var i=0; i<PPUFLAGS.length; i++) {
      var flag = PPUFLAGS[i];
      s += (ppu[flag[0]] ? flag[1] : "-") + " ";
      if (i==2 || i==5) s += "\n";
    }
    var status = mem[0x2002];
    s += "\n Status ";
    s += (status & 0x80) ? "VBLANK " : "- ";
    s += (status & 0x40) ? "SPRITE0HIT " : "- ";
    s += "\n";
    if (ppu.f_color)
      s += "   Tint " + ((ppu.f_color&1)?"RED ":"") + ((ppu.f_color&2)?"BLUE ":"") + ((ppu.f_color&4)?"GREEN ":"") + "\n";
    if (ppu.f_spVisibility) {
      s += "SprSize " + (ppu.f_spriteSize ? "8x16" : "8x8") + "\n";
      s += "SprBase $" + (ppu.f_spPatternTable ? "1000" : "0000") + "\n";
    }
    if (ppu.f_bgVisibility) {
      s += " BgBase $" + (ppu.f_bgPatternTable ? "1000" : "0000") + "\n";
      s += " NTBase $" + hex(ppu.f_nTblAddress*0x400+0x2000) + "\n";
      s += "AddrInc " + (ppu.f_addrInc ? "32" : "1") + "\n";
    }
    var scrollX = ppu.regFH + ppu.regHT*8;
    var scrollY = ppu.regFV + ppu.regVT*8;
    s += "ScrollX $" + hex(scrollX) + " (" + ppu.regHT + " * 8 + " + ppu.regFH + " = " + scrollX + ")\n";
    s += "ScrollY $" + hex(scrollY) + " (" + ppu.regVT + " * 8 + " + ppu.regFV + " = " + scrollY + ")\n";
    s += " Vstart $" + hex(ppu.vramTmpAddress,4) + "\n";
    s += "\n";
    s += "   Scan Y: " + ppu.scanline + "  X: " + ppu.curX + "\n";
    s += " VRAM " + (ppu.firstWrite?"@":"?") + " $" + hex(ppu.vramAddress,4) + "\n";
    /*
    var PPUREGS = [
      'cntFV',
      'cntV',
      'cntH',
      'cntVT',
      'cntHT',
      'regV',
      'regH',
      'regS',
    ];
    s += "\n";
    for (var i=0; i<PPUREGS.length; i++) {
      var reg = PPUREGS[i];
      s += lpad(reg.toUpperCase(),7) + " $" + hex(ppu[reg]) + " (" + ppu[reg] + ")\n";
    }
    */
    return s;
  }
  mapperStateToLongString(mmap, mem) {
    //console.log(mmap, mem);
    var s = "";
    if (mmap.irqCounter !== undefined) {
      s += "\nIRQ Counter: " + mmap.irqCounter;
      s += "\n  IRQ Latch: " + mmap.irqLatchValue;
      s += "\n IRQ Reload: " + mmap.irqReload;
      s += "\n IRQ Enable: " + mmap.irqEnable;
      s += "\n PRG Select: " + mmap.prgAddressSelect;
      s += "\n CHR Select: " + mmap.chrAddressSelect;
    }
    s += "\n";
    return s;
  }
 }
  return new JSNESPlatform();
}

/// MAME support

class NESMAMEPlatform extends BaseMAMEPlatform implements Platform {

  start() {
  }

  loadROM(title, data) {
    if (!this.started) {
      this.startModule(this.mainElement, {
        jsfile:'mamenes.js',
        //cfgfile:'nes.cfg',
        driver:'nes',
        width:256,
        height:240,
        romfn:'/emulator/cart.nes',
        romdata:new Uint8Array(data),
        preInit:function(_self) {
        },
      });
    } else {
      // look at iNES header for PRG and CHR ROM lengths
      var prgromlen = data[4] * 0x2000;
      var chrromlen = data[5] * 0x1000;
      this.loadROMFile(data);
      this.loadRegion(":nes_slot:cart:prg_rom", data.slice(0x10, 0x10+prgromlen));
      this.loadRegion(":nes_slot:cart:chr_rom", data.slice(0x10+prgromlen, 0x10+prgromlen+chrromlen));
    }
  }

  getPresets() { return JSNES_PRESETS; }
  getOpcodeMetadata = getOpcodeMetadata_6502;
  getToolForFilename = getToolForFilename_6502;
  getDefaultExtension() { return ".c"; };
}

///

PLATFORMS['nes'] = _JSNESPlatform;
PLATFORMS['nes.mame'] = NESMAMEPlatform;

