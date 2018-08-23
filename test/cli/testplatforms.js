
var assert = require('assert');
var fs = require('fs');
var wtu = require('./workertestutils.js');
global.includeInThisContext('src/cpu/z80fast.js');

const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { window } = new JSDOM();

const dom = new JSDOM(`<!DOCTYPE html><div id="emulator"></div>`);
global.window = dom.window;
global.document = dom.window.document;
dom.window.Audio = null;
global.Image = function() { }

includeInThisContext("javatari.js/release/javatari/javatari.js");
Javatari.AUTO_START = false;
includeInThisContext('src/cpu/z80fast.js');
//includeInThisContext('tss/js/Log.js');
global.Log = require('tss/js/Log.js').Log;
includeInThisContext('tss/js/tss/PsgDeviceChannel.js');
includeInThisContext('tss/js/tss/MasterChannel.js');
includeInThisContext('tss/js/tss/AudioLooper.js');

var jsnes = require("jsnes/jsnes.min.js");

var emu = require('gen/emu.js');
var audio = require('gen/audio.js');
var recorder = require('gen/recorder.js');
var vicdual = require('gen/platform/vicdual.js');
var apple2 = require('gen/platform/apple2.js');

//

emu.RasterVideo = function(mainElement, width, height, options) {
  var datau32;
  this.create = function() {
      datau32 = new Uint32Array(width*height);
  }
  this.setKeyboardEvents = function(callback) {
  }
  this.getFrameData = function() { return datau32; }
  this.updateFrame = function() { }
}

//

function testPlatform(platid, romname, maxframes, callback) {
    var emudiv = document.getElementById('emulator');
    var platform = new emu.PLATFORMS[platid](emudiv);
    var rec = new recorder.StateRecorderImpl(platform);
    platform.start();
    var rom = fs.readFileSync('./test/roms/' + platid + '/' + romname);
    rom = new Uint8Array(rom);
    platform.loadROM(rom);
    platform.resume(); // so that recorder works
    platform.setRecorder(rec);
    for (var i=0; i<maxframes; i++) {
      if (callback) callback(platform, i);
      platform.nextFrame();
    }
    platform.pause();
    assert.equal(maxframes, rec.numFrames());
    var state1 = platform.saveState();
    assert.equal(1, rec.loadFrame(1));
    assert.equal(maxframes, rec.loadFrame(maxframes));
    var state2 = platform.saveState();
    assert.deepEqual(state1, state2);
    return platform;
}

describe('Platform Replay', () => {
  it('Should run apple2', () => {
    var platform = testPlatform('apple2', 'cosmic.c.rom', 70, (platform, frameno) => {
      if (frameno == 60) {
        var cstate = platform.saveControlsState();
        cstate.kbd = 0x80 | 0x20;
        platform.loadControlsState(cstate);
      }
    });
    assert.equal(platform.saveState().kbd, 0x20); // strobe cleared
  });
});
