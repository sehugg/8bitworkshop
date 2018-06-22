"use strict";

var Atari8_PRESETS = [
  {id:'hello.a', name:'Hello World (ASM)'},
  {id:'hellopm.a', name:'Hello Sprites (ASM)'},
];

/// MAME support

var Atari8MAMEPlatform = function(mainElement) {
  var self = this;
  this.__proto__ = new BaseMAMEPlatform();

  this.loadROM = function(title, data) {
    this.loadROMFile(data);
    this.loadRegion(":cartleft:cart:rom", data);
  }

  this.getPresets = function() { return Atari8_PRESETS; }

  this.getToolForFilename = getToolForFilename_6502;
  this.getDefaultExtension = function() { return ".c"; };
}

var Atari800Platform = function(mainElement) {
  var self = this;
  this.__proto__ = new Atari8MAMEPlatform(mainElement);

  this.start = function() {
    self.startModule(mainElement, {
      jsfile:'mameatari400.js',
      biosfile:'a400.zip', // TODO: load multiple files
      //cfgfile:'atari5200.cfg',
      driver:'a400',
      width:336*2,
      height:225*2,
      romfn:'/emulator/cart.rom',
      romsize:0x2000,
      preInit:function(_self) {
      },
    });
  }
}

var Atari5200Platform = function(mainElement) {
  var self = this;
  this.__proto__ = new Atari8MAMEPlatform(mainElement);

  this.start = function() {
    self.startModule(mainElement, {
      jsfile:'mameatari400.js',
      biosfile:'a5200/5200.rom',
      //cfgfile:'atari5200.cfg',
      driver:'a5200',
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

PLATFORMS['atari8-800'] = Atari800Platform;
PLATFORMS['atari8-5200'] = Atari5200Platform;
