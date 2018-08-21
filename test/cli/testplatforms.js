
var assert = require('assert');
var fs = require('fs');
var wtu = require('./workertestutils.js');
global.includeInThisContext('src/cpu/z80fast.js');

const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { window } = new JSDOM();

global['Javatari'] = {AUTO_START:false};

const dom = new JSDOM(`<!DOCTYPE html><div id="emulator"></div>`);
global['window'] = dom.window;
global['document'] = dom.window.document;
dom.window.Audio = null;

//var javatari = require("javatari.js/release/javatari/javatari.js");
includeInThisContext('src/cpu/z80fast.js');
//includeInThisContext('tss/js/Log.js');
global['Log'] = require('tss/js/Log.js').Log;
includeInThisContext('tss/js/tss/PsgDeviceChannel.js');
includeInThisContext('tss/js/tss/MasterChannel.js');
includeInThisContext('tss/js/tss/AudioLooper.js');

var jsnes = require("jsnes/jsnes.min.js");

var emu = require('gen/emu.js');
var audio = require('gen/audio.js');
var vicdual = require('gen/platform/vicdual.js');

//

emu.RasterVideo = function(mainElement, width, height, options) {
  var datau32;
  this.create = function() {
      datau32 = new Uint32Array(width*height);
  }
  this.setKeyboardEvents = function(callback) {
  }
  this.getFrameData = function() { return datau32; }
}

//

function testPlatform(platid) {
    var emudiv = document.getElementById('emulator');
    var platform = new emu.PLATFORMS[platid](emudiv);
    platform.start();
    // TODO
}

describe('VIC Dual Platform', function() {
    testPlatform('vicdual');
});
