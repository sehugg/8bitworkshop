"use strict";

var C64_PRESETS = [
  {id:'hello.a', name:'Hello World (ASM)'},
  {id:'hellopm.a', name:'Hello Sprites (ASM)'},
];

/// MAME support

var C64MAMEPlatform = function(mainElement) {
  var self = this;
  this.__proto__ = new BaseMAMEPlatform();

  this.loadROM = function(title, data) {
    this.loadROMFile(data);
    this.loadRegion(":basic", data);
  }

  this.getPresets = function() { return C64_PRESETS; }

  this.getToolForFilename = getToolForFilename_6502;
  this.getDefaultExtension = function() { return ".c"; };

  this.start = function() {
    self.startModule(mainElement, {
      jsfile:'mamec64.js',
      biosfile:'c64.zip', // TODO: load multiple files
      //cfgfile:'atari5200.cfg',
      driver:'c64',
      width:336*2,
      height:225*2,
      romfn:'/emulator/cart.rom',
      romsize:0x2000,
      preInit:function(_self) {
      },
    });
  }
}

///

PLATFORMS['c64'] = C64MAMEPlatform;
