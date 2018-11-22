"use strict";

import { Platform, BaseMAMEPlatform, BaseZ80Platform, getToolForFilename_z80 } from "../baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap } from "../emu";
import { hex, lzgmini, stringToByteArray } from "../util";
import { MasterAudio, SN76489_Audio } from "../audio";
import { TMS9918A } from "../video/tms9918a";

// http://www.colecovision.eu/ColecoVision/development/tutorial1.shtml
// http://www.colecovision.eu/ColecoVision/development/libcv.shtml
// http://www.kernelcrash.com/blog/recreating-the-colecovision/2016/01/27/
// http://www.atarihq.com/danb/files/CV-Tech.txt
// http://www.atarihq.com/danb/files/CV-Sound.txt
// http://www.colecoboxart.com/faq/FAQ05.htm
// http://www.theadamresource.com/manuals/technical/Jeffcoleco.html
// http://bifi.msxnet.org/msxnet//tech/tms9918a.txt
// http://www.colecovision.dk/tools.htm?refreshed
// http://www.theadamresource.com/manuals/technical/ColecoVision%20Coding%20Guide.pdf
// http://www.unige.ch/medecine/nouspikel/ti99/tms9918a.htm

var ColecoVision_PRESETS = [
  {id:'text.c', name:'Text Mode'},
  {id:'hello.c', name:'Scrolling Text'},
  {id:'text32.c', name:'32-Column Color Text'},
  {id:'stars.c', name:'Scrolling Starfield'},
  {id:'cursorsmooth.c', name:'Moving Cursor'},
  {id:'simplemusic.c', name:'Simple Music'},
  {id:'musicplayer.c', name:'Multivoice Music'},
  {id:'mode2bitmap.c', name:'Mode 2 Bitmap'},
  {id:'lines.c', name:'Mode 2 Lines'},
  {id:'multicolor.c', name:'Multicolor Mode'},
  {id:'siegegame.c', name:'Siege Game'},
  {id:'shoot.c', name:'Solarian Game'},
  {id:'platform.c', name:'Platform Game'},
];

var COLECOVISION_KEYCODE_MAP = makeKeycodeMap([
  [Keys.VK_UP,    0, 0x1],
  [Keys.VK_DOWN,  0, 0x4],
  [Keys.VK_LEFT,  0, 0x8],
  [Keys.VK_RIGHT, 0, 0x2],
  [Keys.VK_SPACE, 0, 0x40],
  [Keys.VK_CONTROL, 1, 0x40],

  [Keys.VK_W, 2, 0x1],
  [Keys.VK_S, 2, 0x4],
  [Keys.VK_A, 2, 0x8],
  [Keys.VK_D, 2, 0x2],
  [Keys.VK_Z, 2, 0x40],
  [Keys.VK_X, 3, 0x40],
]);

/// standard emulator

const _ColecoVisionPlatform = function(mainElement) {

  const cpuFrequency = 3579545; // MHz
  const canvasWidth = 304;
  const numTotalScanlines = 262;
  const numVisibleScanlines = 240;
  const cpuCyclesPerLine = Math.round(cpuFrequency / 60 / numTotalScanlines);

  var cpu, ram, membus, iobus, rom, bios;
  var video, vdp, timer;
  var audio, psg;
  var inputs = new Uint8Array(4);
  var keypadMode = false;

  class ColecoVisionPlatform extends BaseZ80Platform implements Platform {

    getPresets() { return ColecoVision_PRESETS; }
    getToolForFilename = getToolForFilename_z80;
    getDefaultExtension() { return ".c"; };

    start() {
       ram = new RAM(1024);
       bios = new lzgmini().decode(stringToByteArray(atob(COLECO_BIOS_LZG)));
       membus = {
         read: newAddressDecoder([
           [0x0000, 0x1fff, 0x1fff, function(a) { return bios ? bios[a] : 0; }],
           [0x6000, 0x7fff,  0x3ff, function(a) { return ram.mem[a]; }],
           [0x8000, 0xffff, 0x7fff, function(a) { return rom ? rom[a] : 0; }],
	       ]),
         write: newAddressDecoder([
           [0x6000, 0x7fff,  0x3ff, function(a,v) { ram.mem[a] = v; }],
         ]),
         isContended: function() { return false; },
      };
      iobus = {
        read: function(addr) {
  				addr &= 0xff;
          //console.log('IO read', hex(addr,4));
          switch (addr) {
            case 0xfc: return inputs[keypadMode?1:0] ^ 0xff;
            case 0xff: return inputs[keypadMode?3:2] ^ 0xff;
          }
          if (addr >= 0xa0 && addr <= 0xbf) {
            if (addr & 1)
              return vdp.readStatus();
            else
              return vdp.readData();
          }
          return 0;
      	},
      	write: function(addr, val) {
  				addr &= 0xff;
  				val &= 0xff;
          //console.log('IO write', hex(addr,4), hex(val,2));
          switch (addr >> 4) {
            case 0x8: case 0x9: keypadMode = true; break;
            case 0xc: case 0xd: keypadMode = false; break;
            case 0xa: case 0xb:
              if (addr & 1)
                return vdp.writeAddress(val);
              else
                return vdp.writeData(val);
            case 0xf: psg.setData(val); break;
          }
      	}
      };
      cpu = this.newCPU(membus, iobus);
      video = new RasterVideo(mainElement,canvasWidth,numVisibleScanlines);
      video.create();
      audio = new MasterAudio();
      psg = new SN76489_Audio(audio);
      var cru = {
        setVDPInterrupt: (b) => {
          if (b) {
            cpu.nonMaskableInterrupt();
          } else {
            // TODO: reset interrupt?
          }
        }
      };
      vdp = new TMS9918A(video.canvas, cru, true); // true = 4 sprites/line
      setKeyboardFromMap(video, inputs, COLECOVISION_KEYCODE_MAP);
      timer = new AnimationTimer(60, this.nextFrame.bind(this));
    }

    readAddress(addr) {
      return membus.read(addr);
    }

    advance(novideo : boolean) {
      for (var sl=0; sl<numTotalScanlines; sl++) {
        this.runCPU(cpu, cpuCyclesPerLine);
        if (sl < numVisibleScanlines)
          vdp.drawScanline(sl);
      }
      vdp.updateCanvas();
    }

    loadROM(title, data) {
      rom = padBytes(data, 0x8000);
      this.reset();
    }

    loadState(state) {
      cpu.loadState(state.c);
      ram.mem.set(state.b);
      vdp.restoreState(state.vdp);
      keypadMode = state.kpm;
      inputs.set(state.in);
    }
    saveState() {
      return {
        c:this.getCPUState(),
        b:ram.mem.slice(0),
        vdp:vdp.getState(),
        kpm:keypadMode,
        in:inputs.slice(0),
      };
    }
    loadControlsState(state) {
      inputs[0] = state.in0;
      inputs[1] = state.in1;
      inputs[2] = state.in2;
    }
    saveControlsState() {
      return {
        in0:inputs[0],
        in1:inputs[1],
        in2:inputs[2],
      };
    }
    getCPUState() {
      return cpu.saveState();
    }

    isRunning() {
      return timer && timer.isRunning();
    }
    pause() {
      timer.stop();
      audio.stop();
    }
    resume() {
      timer.start();
      audio.start();
    }
    reset() {
      cpu.reset();
      cpu.setTstates(0);
      vdp.reset();
      psg.reset();
    }

    getDebugCategories() {
      return super.getDebugCategories().concat(['VDP']);
    }
    getDebugInfo(category, state) {
      switch (category) {
        case 'VDP': return this.vdpStateToLongString(state.vdp);
        default: return super.getDebugInfo(category, state);
      }
    }
    vdpStateToLongString(ppu) {
      return vdp.getRegsString();
    }
  }
  return new ColecoVisionPlatform();
}

var COLECO_BIOS_LZG = `
TFpHAAAgAAAAB7djQcnHAQEDBgcx/3MYawAAAMMMgAehB+EPB+USB+UVB+UYB+UbB+UeB+QHHAZm
IYA8igUCBYIAKgCAff5VIAl8/qogBCoKgOnHAwkfgICAAAMFT6CgB4LgByEH4WDAYMBABlggQIAg
B+HAwOCgYAMGKweBQAYxBphAQEAG+KBABnAGEuAGUAabB+QA4AflBkggIAYyB+FgoKCgwAZdwAY5
B+HABhAGYAfhIAZQoKDgIAMCcOCAwAaIYIDgoAZY4AMFOAYGBsgGIAZYAwJWBlAAQAMEcAYfQAZ4
BhoDA3gGBgaQBjgGGwYfoOCAAwLIB+EDA/DAoAchAwNggAaQwAMFmOCAByEH5QZ4AwKABligAwUw
4EBAQAZYICAgoAMCUAYuBpAGPwawoOAG4AfhAyNQQKCgBqDAoMADJECgoOADBGjgwAZYYIADBPgD
AlADBEigAwVooAMFCAMEQAYHAwRQBg8GUAMiEAMEoAMEcAMD6gaQICAGyAADJZgDJ4gDI7gAwGAD
I0CAwAME6AMC+QMCaCBgAwRwAGCgwAaIQOADA2AGJiAH4gZoAwPgA0M6ACAAAwX4gKDAAwPAAyLP
AwNgAwXwAyNJAwR+AwX4oMADRQBgAyOgAyJxB+PAYANDEOBAQAMDeAMF+AfhA0RQAyJBB+NAAwPI
BncGkOBgwAZQYECABrADQs8DAkjAQCBAA0QYAAMDUAcLOERsRFREOAA4fFR8RHw4AAAofHx8OBAA
ABA4B+MQODgQfHwDBQgQBhgAADAwB4H8/PzMzAeBAAB4SEh4BkiEtLSEBggcDDRISDAAOEREOBAG
eBgUEDBwYAAMNCw0LGxgAABUOGw4VAAAIDA4PDgwIAAIGDh4OBgIAwJXEAMCaCgHAgAoADxUVDQU
FBQAOEQwKBhEAwNwAAB4eAMGIAchfBAHAQAHggMEqBh8GAfBABAwfDAH4gAAQEBAfAAAKCh8KCgG
DxA4OHwGB3x8ODgGLwcHBg8GfgBsbEgGyQZnfCgAIDhAMAhwEABkZAgQIExMACBQUCBUSDQAMDAD
ZEsQIAcCEAAgAwJ5EAYMKDh8OCgGURB8AwdYBuV8AwdlAyIyBAgQAyKmOERMVGREOAAQMAZ4OAYI
BBggQHwH4jgEBhAIGChIfAgIAHxAQHgGSAYVeEQH4XwGeCAgAyNYBkgHgTwECAMiijAwAySSB+Mg
Bh5AIBAIAwR3B0EGBAZyAwNgAwLoOERcVFxABrhEfEREAHhERAdCBghAQEBEOAZIBwF4AwN4AyJA
B+RABlhcREQ8AAbvRAA4AwP4OAAEBwEDAohESFBgUEhEAyJ1AyN4RGxUBh9EAERkVEwGqAZGAwRY
AwVIREQDIlAGSEgGmEADA/gDI9YQEAMCYAaoB8MoBkhUBwEoB+EoECgGKAaOBiB4AwLpQHgAOAMj
kDgAAAMC9gQAADgIBwI4AAYlA0rv/DADRR0GGgQ8RDwABjQDA+gGCEQDAvgEBg4DAuAGSHhAAyJ4
IHgDInAAAAYQPAQ4QEBwSAcBAANEehgACAAYCAgISDBAQAMD+QaOBlAAAGhUVEQDAnQG6AMCSAMC
yAADI1p4QAMDSEQ8BAAAWCQgIHAGWEA4BAYYAwJnKAMCnAYuWANCUQME+AfiVHwGSEhIMAMDSAYY
OBBgAAB4CDBAeAMCoGAgIBgDAngHYzAICAwICDAAKFADRuhsRER8AwPeQEQ4EDBIAwVYDAMF4Ach
AyMIKAflMAflOCgH5AMkFxAwBiAGqAYgB+MGIAMFCAME8BAGgRgAIAMFCAYHKER8RAMCQGwH4gwA
fEB4A2KYAHgUfFA8ADxQUHxQUFwAOAAwSAOCOCgH5WAH5TgDBaBgB+UoAwXwAwL9BugH5AAQOEBA
OBAAGCQgeCAkXABEKBB8ByEAYFBQaFxISAAIFBA4EBBQIBgDBdADIyIQGAfhAwRgGAMGWFADI6kH
4khoWEgDBSY8AwUeeAMi8DADQiAAA2ISA6N2/AQEB6FASFA4RAgcB+IsVBwEBmADglsGEiRIJAZf
AEgkAyKuVACoB2SoBySo/FT8B2IDRDAHA/AHpQfjUFBQ0AdhAyK+8AfjAwYQ0BAGkAcGBhAGyNAQ
8AYkAAYCB+MGJgfjBngDBVgcBpAQEPwDZgwDBhAHggZIAwYYAwUOBpBQUFBcAwNYXAMjtQMC9wbI
3AboB6HcAwUYBpAGCAaQBhgGkBADBghQUAMGKAMDWAZCAwW7AwNQAwJoBpgDBXAGAnwG11ADB0AD
JiADBbgGoPwHBQZJB+LgBwUcBwUDBhQAADRISDQDY49wSEhwQHhIA4OpAAB8A8R6eEggECADwtEA
PANDTwNjYHAGWShQAwKHOBA4A8LZA0IIeAaZOEREKChsADBAIBA4BqkoA4KfA0KIVFQDIvg4QANi
FwAGaQNjr3gHIwZYEAAGEEAwCDBABgkHoTAIBlEIFANIAlAgBiAAfAdhAwJ3B0IGfwMDjgPmiAcB
A8SRHAYnBihQAwK9BwFgEAODTQPjNXgDAmgHHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8H
HwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBwM=`;

/// MAME support

class ColecoVisionMAMEPlatform extends BaseMAMEPlatform implements Platform {

  start() {
    this.startModule(this.mainElement, {
      jsfile:'mamecoleco.js',
      cfgfile:'coleco.cfg',
      biosfile:'coleco/313 10031-4005 73108a.u2',
      driver:'coleco',
      width:280*2,
      height:216*2,
      romfn:'/emulator/cart.rom',
      romsize:0x8000,
      preInit:function(_self) {
      },
    });
  }

  loadROM(title, data) {
    this.loadROMFile(data);
    this.loadRegion(":coleco_cart:rom", data);
  }

  getPresets() { return ColecoVision_PRESETS; }

  getToolForFilename = getToolForFilename_z80;
  getDefaultExtension() { return ".c"; };
}


///

PLATFORMS['coleco.mame'] = ColecoVisionMAMEPlatform;
PLATFORMS['coleco'] = _ColecoVisionPlatform;
