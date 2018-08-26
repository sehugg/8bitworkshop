"use strict";

import { Platform, BaseMAMEPlatform, getToolForFilename_z80 } from "../baseplatform";
import { PLATFORMS } from "../emu";

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
  {id:'text32.c', name:'32-Column Text'},
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

PLATFORMS['coleco'] = ColecoVisionMAMEPlatform;
