
var assert = require('assert');
var fs = require('fs');
var wtu = require('./workertestutils.js');
global.includeInThisContext('src/cpu/z80fast.js');

const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { window } = new JSDOM();

const dom = new JSDOM(`<!DOCTYPE html><div id="emulator"><div id="javatari-screen"></div></div>`);
global.window = dom.window;
global.document = dom.window.document;
dom.window.Audio = null;
global.Image = function() { }
global.btoa = require('btoa');
global.atob = require('atob');
global['$'] = require("jquery/jquery-2.2.3.min.js");
includeInThisContext("javatari.js/release/javatari/javatari.js");
Javatari.AUTO_START = false;
includeInThisContext('src/cpu/z80fast.js');
includeInThisContext('tss/js/Log.js');
//global.Log = require('tss/js/Log.js').Log;
includeInThisContext('tss/js/tss/PsgDeviceChannel.js');
includeInThisContext('tss/js/tss/MasterChannel.js');
includeInThisContext('tss/js/tss/AudioLooper.js');
//includeInThisContext("jsnes/jsnes.min.js");
global.jsnes = require("jsnes/jsnes.min.js");

var emu = require('gen/emu.js');
var Keys = emu.Keys;
var audio = require('gen/audio.js');
var recorder = require('gen/recorder.js');
var _apple2 = require('gen/platform/apple2.js');
var _vcs = require('gen/platform/vcs.js');
var _nes = require('gen/platform/nes.js');
var _vicdual = require('gen/platform/vicdual.js');
var _mw8080bw = require('gen/platform/mw8080bw.js');
var _galaxian = require('gen/platform/galaxian.js');
var _vector = require('gen/platform/vector.js');
var _williams = require('gen/platform/williams.js');
var _sound_williams = require('gen/platform/sound_williams.js');
var _astrocade = require('gen/platform/astrocade.js');
var _atari8 = require('gen/platform/atari8.js');
var _coleco = require('gen/platform/coleco.js');

//

dom.window.HTMLCanvasElement.prototype.getContext = function() {
  return {
    getImageData: function(x,y,w,h) { return {data: new Uint32Array(w*h) }; },
    fillRect: function(x,y,w,h) { },
    drawImage: function(img,x,y,w,h) { },
    putImageData: function(data,w,h) { },
  };
}
global.navigator = {};

var keycallback;

emu.RasterVideo = function(mainElement, width, height, options) {
  var datau32;
  this.create = function() {
    datau32 = new Uint32Array(width*height);
  }
  this.setKeyboardEvents = function(callback) {
    keycallback = callback;
  }
  this.getFrameData = function() { return datau32; }
  this.updateFrame = function() {}
  this.setupMouseEvents = function() { }
}

emu.VectorVideo = function(mainElement, width, height, options) {
  this.create = function() {
    this.drawops = 0;
  }
  this.setKeyboardEvents = function(callback) {
    keycallback = callback;
  }
  this.clear = function() { }
  this.drawLine = function() { this.drawops++; }
}

global.Worker = function() {
  this.msgcount = 0;
  this.postMessage = function() { this.msgcount++; }
}

//

function testPlatform(platid, romname, maxframes, callback) {
    var emudiv = document.getElementById('emulator');
    var platform = new emu.PLATFORMS[platid](emudiv);
    var rec = new recorder.StateRecorderImpl(platform);
    platform.start();
    var rom = fs.readFileSync('./test/roms/' + platid + '/' + romname);
    rom = new Uint8Array(rom);
    platform.loadROM("ROM", rom);
    platform.resume(); // so that recorder works
    platform.setRecorder(rec);
    for (var i=0; i<maxframes; i++) {
      if (callback) callback(platform, i);
      platform.nextFrame();
      if (i==10) {
        for (var j=0; j<0x10000; j++)
          platform.readAddress(j); // make sure readAddress() doesn't leave side effects
      }
    }
    // test replay feature
    platform.pause();
    if (maxframes > 120*60)
      maxframes = 120*60;
    assert.equal(maxframes, rec.numFrames());
    var state1 = platform.saveState();
    assert.equal(1, rec.loadFrame(1));
    assert.equal(maxframes, rec.loadFrame(maxframes));
    var state2 = platform.saveState();
    assert.deepEqual(state1, state2);
    // test debug info
    var debugs = platform.getDebugCategories();
    for (var dcat of debugs) {
      var dinfo = platform.getDebugInfo(dcat, state2);
      console.log(dcat, dinfo);
      assert.ok(dinfo && dinfo.length > 0, dcat + " empty");
      assert.ok(dinfo.length < 80*24, dcat + " too long");
      assert.ok(dinfo.indexOf('undefined') < 0, dcat + " undefined");
    }
    return platform;
}

describe('Platform Replay', () => {

  it('Should run apple2', () => {
    var platform = testPlatform('apple2', 'cosmic.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(32, 32, 1); // space bar
      }
    });
    assert.equal(platform.saveState().kbd, 0x20); // strobe cleared
  });

  it('Should run > 120 secs', () => {
    var platform = testPlatform('apple2', 'mandel.c.rom', 122*60, (platform, frameno) => {
    });
  });

  it('Should run vcs', () => {
    var platform = testPlatform('vcs', 'brickgame.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        var cstate = platform.saveControlsState();
        cstate.SA = 0xff ^ 0x40; // stick left
        platform.loadControlsState(cstate);
      }
    });
    assert.equal(platform.saveState().p.SA, 0xff ^ 0x40);
    assert.equal(60, platform.readAddress(0x80)); // player x pos
  });

  it('Should run nes', () => {
    var platform = testPlatform('nes', 'shoot2.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_LEFT.c, Keys.VK_LEFT.c, 1);
      }
    });
    assert.equal(120-10, platform.readAddress(0x41d)); // player x pos
  });

  it('Should run vicdual', () => {
    var platform = testPlatform('vicdual', 'snake1.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_DOWN.c, Keys.VK_DOWN.c, 1);
      }
    });
  });

  it('Should run mw8080bw', () => {
    var platform = testPlatform('mw8080bw', 'game2.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_LEFT.c, Keys.VK_LEFT.c, 1);
      }
    });
    assert.equal(96-9*2, platform.readAddress(0x2006)); // player x pos
  });

  it('Should run galaxian', () => {
    var platform = testPlatform('galaxian-scramble', 'shoot2.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_LEFT.c, Keys.VK_LEFT.c, 1);
      }
    });
    assert.equal(112-10, platform.readAddress(0x4074)); // player x pos
  });

  it('Should run vector', () => {
    var platform = testPlatform('vector-z80color', 'game.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_UP.c, Keys.VK_UP.c, 1);
      }
    });
  });

  it('Should run williams', () => {
    var platform = testPlatform('williams-z80', 'game1.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_LEFT.c, Keys.VK_LEFT.c, 1);
      }
    });
  });
/*
  it('Should run sound_williams', () => {
    var platform = testPlatform('sound_williams-z80', 'swave.c.rom', 72, (platform, frameno) => {
      if (frameno == 60) {
        keycallback(Keys.VK_2.c, Keys.VK_2.c, 1);
      }
    });
  });
*/

  it('Should run astrocade', () => {
    var platform = testPlatform('astrocade', 'cosmic.c.rom', 92, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_SPACE.c, Keys.VK_SPACE.c, 1);
      }
    });
  });
/*
  it('Should run coleco', () => {
    var platform = testPlatform('coleco', 'shoot.c.rom', 92, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_SPACE.c, Keys.VK_SPACE.c, 1);
      }
    });
  });
*/
/* TODO
  it('Should run atari8-5200', () => {
    var platform = testPlatform('atari8-5200', 'hello.a.rom', 92, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_SPACE.c, Keys.VK_SPACE.c, 1);
      }
    });
  });
*/
});


