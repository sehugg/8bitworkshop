"use strict";

var Atari8_PRESETS = [
  {id:'hello.a', name:'Hello World (ASM)'},
  {id:'hellopm.a', name:'Hello Sprites (ASM)'},
];

/// MAME support

var Atari8MAMEPlatform = function(mainElement) {
  var self = this;
  this.__proto__ = new BaseMAMEPlatform();

//
  this.start = function() {
    self.startModule(mainElement, {
      jsfile:'mameatari400.js',
      biosfile:'a5200/5200.rom',
      //cfgfile:'atari5200.cfg',
      driver:'a5200',
      width:336*2,
      height:225*2,
      romfn:'/emulator/cart.rom',
      romsize:0x4000,
      preInit:function(_self) {
      },
    });
  }

  this.loadROM = function(title, data) {
    this.loadROMFile(data);
    this.loadRegion(":cartleft:cart:rom", data);
  }

  this.getPresets = function() { return Atari8_PRESETS; }

  this.getToolForFilename = getToolForFilename_6502;
  this.getDefaultExtension = function() { return ".c"; };
}

///

PLATFORMS['atari8-5200'] = Atari8MAMEPlatform;
