
var assert = require('assert');
var fs = require('fs');
var wtu = require('./workertestutils.js');
var PNG = require('pngjs').PNG;

const dom = createTestDOM();
includeInThisContext('src/common/cpu/6809.js');
includeInThisContext("javatari.js/release/javatari/javatari.js");
Javatari.AUTO_START = false;
includeInThisContext('tss/js/Log.js');
//global.Log = require('tss/js/Log.js').Log;
includeInThisContext('tss/js/tss/PsgDeviceChannel.js');
includeInThisContext('tss/js/tss/MasterChannel.js');
includeInThisContext('tss/js/tss/AudioLooper.js');
//includeInThisContext("jsnes/dist/jsnes.min.js");
global.jsnes = require("jsnes/dist/jsnes.min.js");

//var devices = require('gen/common/devices.js');
var emu = require('gen/common/emu.js');
var Keys = emu.Keys;
var audio = require('gen/common/audio.js');
var recorder = require('gen/common/recorder.js');
//var _6502 = require('gen/common/cpu/MOS6502.js');
var _apple2 = require('gen/platform/apple2.js');
//var m_apple2 = require('gen/machine/apple2.js');
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
var _atari7800 = require('gen/platform/atari7800.js');
var _coleco = require('gen/platform/coleco.js');
var _sms = require('gen/platform/sms.js');
var _c64 = require('gen/platform/c64.js');
var _vectrex = require('gen/platform/vectrex.js');
var _zx = require('gen/platform/zx.js');


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
var lastrastervideo;

emu.RasterVideo = function(mainElement, width, height, options) {
  var buffer;
  var datau8;
  var datau32;
  this.create = function() {
    this.width = width;
    this.height = height;
    buffer = new ArrayBuffer(width*height*4);
    datau8 = new Uint8Array(buffer);
    datau32 = new Uint32Array(buffer);
    lastrastervideo = this;
  }
  this.setKeyboardEvents = function(callback) {
    keycallback = callback;
  }
  this.getFrameData = function() { return datau32; }
  this.getImageData = function() { return {data:datau8, width:width, height:height}; }
  this.updateFrame = function() {}
  this.clearRect = function() {}
  this.setupMouseEvents = function() { }
  this.canvas = this;
  this.getContext = function() { return this; }
  this.fillRect = function() { }
  this.fillStyle = '';
  this.putImageData = function() { }
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

global.Mousetrap = function() {
  this.bind = function() { }
}

//

function checkForBigNonTypedArrays(obj, path='') {
  if (typeof obj != 'object' || obj == null) return;
  Object.entries(obj).forEach((entry) => {
    if (entry[1] instanceof Array && entry[1].length > 200) {
      if (typeof entry[1][0] == 'number' && entry[1].buffer == null)
        throw new Error("array in save state not typed: " + path + '/' + entry[0]);
    }
    checkForBigNonTypedArrays(entry[1], path + '/' + entry[0]);
  });
}

async function testPlatform(platid, romname, maxframes, callback) {
    var platform = new emu.PLATFORMS[platid](emudiv);
    await platform.start();
    var emudiv = document.getElementById('emulator');
    var rec = new recorder.StateRecorderImpl(platform);
    assert.ok(platform.saveState()); // can save before ROM load?
    var rom = fs.readFileSync('./test/roms/' + platid + '/' + romname);
    rom = new Uint8Array(rom);
    platform.loadROM("ROM", rom);
    var state0a = platform.saveState();
    checkForBigNonTypedArrays(state0a);
    platform.reset(); // reset again
    var state0b = platform.saveState();
    //TODO: vcs fails assert.deepEqual(state0a, state0b);
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
    maxframes = Math.min(maxframes, rec.maxCheckpoints * rec.checkpointInterval);
    assert.equal(maxframes, rec.numFrames());
    var state1 = platform.saveState();
    platform.loadState(state1);
    assert.deepEqual(state1, platform.saveState());
    assert.equal(0, rec.loadFrame(0));
    assert.equal(1, rec.loadFrame(1));
    assert.equal(maxframes, rec.loadFrame(maxframes));
    var state2 = platform.saveState();
    assert.deepEqual(state1, state2);
    checkForBigNonTypedArrays(state2);
    // test memory reads not clearing stuff
    for (var i=0; i<=0xffff; i++)
      if (platform.readAddress) platform.readAddress(i);
    var state3 = platform.saveState();
    assert.deepEqual(state2, state3);
    // test debug info
    var debugs = platform.getDebugCategories();
    for (var dcat of debugs) {
      var dinfo = platform.getDebugInfo(dcat, state2);
      console.log(dcat, dinfo);
      assert.ok(dinfo && dinfo.length > 0, dcat + " empty");
      assert.ok(dinfo.length < 80*24, dcat + " too long");
      assert.ok(dinfo.indexOf('undefined') < 0, dcat + " undefined");
      assert.ok(dinfo.indexOf('Display On:  false') < 0, dcat + " display off");
    }
    // record video to file
    if (lastrastervideo) {
      var png = new PNG({width:lastrastervideo.width, height:lastrastervideo.height});
      png.data = lastrastervideo.getImageData().data;
      var pngbuffer = PNG.sync.write(png);
      assert(pngbuffer.length > 500); // make sure PNG is big enough
      try { fs.mkdirSync("./test"); } catch(e) { }
      try { fs.mkdirSync("./test/output"); } catch(e) { }
      try {
        fs.writeFileSync("./test/output/"+platid+"-"+romname+".png", pngbuffer);
      } catch (e) { console.log(e) }
    }
    // probe
    var proberec = platform.startProbing && platform.startProbing();
    if (proberec) {
      proberec.reset(0x100000);
      proberec.singleFrame = false;
      var lastclk = 0;
      for (var i=0; i<5; i++) {
        platform.nextFrame(true);
        var clks = proberec.countClocks();
        console.log(proberec.idx, clks - lastclk, proberec.sl);
        lastclk = clks;
      }
      assert.equal(clks, proberec.countClocks());
    }
    // debug tree
    if (platform.getDebugTree) {
      var dbgtree = platform.getDebugTree();
      JSON.stringify(dbgtree);
    }
    // misc
    assert.ok(platform.getDefaultExtension().startsWith('.'));
    if (platform.getROMExtension) assert.ok(platform.getROMExtension().startsWith("."));
    // load state again
    platform.loadState(state3);
    return platform;
}

describe('Platform Replay', () => {

  it('Should run apple2', async () => {
    var platform = await testPlatform('apple2', 'cosmic.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(32, 32, 128); // space bar
      }
    });
    assert.equal(platform.saveState().kbdlatch, 0x20); // strobe cleared
  });

  it('Should run > 120 secs', async () => {
    var platform = await testPlatform('apple2', 'mandel.c.rom', 122*60, (platform, frameno) => {
    });
  });

  it('Should run vcs', async () => {
    var platform = await testPlatform('vcs', 'brickgame.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        var cstate = platform.saveControlsState();
        cstate.SA = 0xff ^ 0x40; // stick left
        platform.loadControlsState(cstate);
      }
    });
    assert.equal(platform.saveState().p.SA, 0xff ^ 0x40);
    assert.equal(60, platform.readAddress(0x80)); // player x pos
  });

  it('Should run nes', async () => {
    var platform = await testPlatform('nes', 'shoot2.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_LEFT.c, Keys.VK_LEFT.c, 1);
      }
    });
    assert.equal(120-10, platform.readAddress(0x41d)); // player x pos
  });

  it('Should run vicdual', async () => {
    var platform = await testPlatform('vicdual', 'snake1.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_DOWN.c, Keys.VK_DOWN.c, 1);
      }
    });
  });

  it('Should run mw8080bw', async () => {
    var platform = await testPlatform('mw8080bw', 'game2.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_LEFT.c, Keys.VK_LEFT.c, 1);
      }
    });
    assert.equal(96-9*2, platform.readAddress(0x2006)); // player x pos
  });

  it('Should run galaxian', async () => {
    var platform = await testPlatform('galaxian-scramble', 'shoot2.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_LEFT.c, Keys.VK_LEFT.c, 1);
      }
    });
    assert.equal(112-10, platform.readAddress(0x4074)); // player x pos
  });

  it('Should run vector', async () => {
    var platform = await testPlatform('vector-z80color', 'game.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_UP.c, Keys.VK_UP.c, 1);
      }
    });
  });
/*
  it('Should run williams 6809', async () => {
    var platform = await testPlatform('williams', 'vidfill.asm.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_LEFT.c, Keys.VK_LEFT.c, 1);
      }
    });
  });
*/
  it('Should run williams-z80', async () => {
    var platform = await testPlatform('williams-z80', 'game1.c.rom', 72, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_LEFT.c, Keys.VK_LEFT.c, 1);
      }
    });
  });
  it('Should run sound_williams', async () => {
    var platform = await testPlatform('sound_williams-z80', 'swave.c.rom', 72, (platform, frameno) => {
      if (frameno == 60) {
        keycallback(Keys.VK_2.c, Keys.VK_2.c, 1);
      }
    });
  });

  it('Should run astrocade', async () => {
    var platform = await testPlatform('astrocade', 'cosmic.c.rom', 92, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_SPACE.c, Keys.VK_SPACE.c, 1);
      }
    });
  });
  it('Should run coleco', async () => {
    var platform = await testPlatform('coleco', 'shoot.c.rom', 92, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_SPACE.c, Keys.VK_SPACE.c, 1);
      }
    });
  });
  it('Should run sms-sg1000-libcv', async () => {
    var platform = await testPlatform('sms-sg1000-libcv', 'shoot.c.rom', 92, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_SPACE.c, Keys.VK_SPACE.c, 1);
      }
    });
  });
  it('Should run sms-sms-libcv', async () => {
    var platform = await testPlatform('sms-sms-libcv', 'climber.c-sms-sms-libcv.rom', 200, (platform, frameno) => {
      if (frameno == 122) {
        keycallback(Keys.RIGHT.c, Keys.VK_RIGHT.c, 1);
      }
    });
  });
  it('Should run atari7800', async () => {
    var platform = await testPlatform('atari7800', 'sprites.dasm.rom', 92, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_DOWN.c, Keys.VK_DOWN.c, 1);
      }
    });
    assert.equal(0x1800, platform.saveState().maria.dll);
    assert.equal(39, platform.readAddress(0x81)); // player y pos
  });
  it('Should run vectrex', async () => {
    var platform = await testPlatform('vectrex', 'joystick.c.rom', 92, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_DOWN.c, Keys.VK_DOWN.c, 1);
      }
    });
  });
  it('Should run c64', async () => {
    await testPlatform('c64', 'climber.c.rom', 92, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_DOWN.c, Keys.VK_DOWN.c, 1);
      }
    });
  });
  it('Should run zx spectrum', async () => {
    await testPlatform('zx', 'cosmic.c.rom', 92, (platform, frameno) => {
      if (frameno == 62) {
        keycallback(Keys.VK_LEFT.c, Keys.VK_LEFT.c, 1);
      }
    });
  });
});
