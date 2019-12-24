"use strict";

/****************************************************************************

    Midway/Williams Audio Boards
    ----------------------------

    6809 MEMORY MAP

    Function                                  Address     R/W  Data
    ---------------------------------------------------------------
    Program RAM                               0000-07FF   R/W  D0-D7

    Music (YM-2151)                           2000-2001   R/W  D0-D7

    6821 PIA                                  4000-4003   R/W  D0-D7

    HC55516 clock low, digit latch            6000        W    D0
    HC55516 clock high                        6800        W    xx

    Bank select                               7800        W    D0-D2

    Banked Program ROM                        8000-FFFF   R    D0-D7

****************************************************************************/

var window = {};
var exports = {};
function require(modname) {
  if (modname == 'jquery') return $;
  else if (modname.startsWith('.')) return exports;
  else { console.log("Unknown require()", modname); return exports; }
}

importScripts("../../../gen/common/emu.js");
importScripts("../../../gen/common/cpu/ZilogZ80.js");

var cpu, ram, rom, membus, iobus;
var audio;
var command = 0;
var dac = 0;
var current_buffer;
var tstates;
var last_tstate;

var timer;
var curTime;
var timerPeriod = 20;
var sampleRate;
var numChannels = 2;
var bufferLength;

var cpuFrequency = 18432000/6; // 3.072 MHz
var cpuCyclesPerFrame = cpuFrequency/60;
var cpuAudioFactor = 32;

rom = new RAM(0x4000).mem;
// sample: [0xe,0x0,0x6,0x0,0x78,0xb9,0x30,0x06,0xa9,0xd3,0x00,0x04,0x18,0xf6,0x0c,0x79,0xd6,0xff,0x38,0xee,0x76,0x18,0xea];
rom.fill(0x76); // HALT opcodes

function fillBuffer() {
  var t = tstates / cpuAudioFactor;
  while (last_tstate < t) {
    current_buffer[last_tstate*2] = dac;
    current_buffer[last_tstate*2+1] = dac;
    last_tstate++;
  }
}

function start() {
  ram = new RAM(0x400);
  membus = {
    read: new AddressDecoder([
      [0x0000, 0x3fff, 0x3fff, function(a) { return rom ? rom[a] : null; }],
      [0x4000, 0x7fff, 0x3ff,  function(a) { return ram.mem[a]; }]
    ]),
    write: new AddressDecoder([
      [0x4000, 0x7fff, 0x3ff,  function(a,v) { ram.mem[a] = v; }],
    ]),
    isContended: function() { return false; },
  };
  iobus = {
    read: function(addr) {
      return command & 0xff;
    },
    write: function(addr, val) {
      dac = (val & 0xff) << 8;
      fillBuffer();
    }
  };
  cpu = new exports.Z80();
  cpu.connectMemoryBus(membus);
  cpu.connectIOBus(iobus);
  current_buffer = new Int16Array(bufferLength);
  console.log('started audio');
}

function timerCallback() {
  tstates = 0;
  last_tstate = 0;
  var numStates = Math.floor(bufferLength * cpuAudioFactor / numChannels);
  while (tstates < numStates) {
    tstates += cpu.advanceInsn();
  }
  tstates = 0;
  fillBuffer();
  postMessage({samples:current_buffer});
  if (!cpu.saveState().halted) {
    curTime += timerPeriod;
    var dt = curTime - new Date().getTime();
    if (dt < 0) dt = 0;
    timer = setTimeout(timerCallback, dt);
  } else {
    timer = 0;
    //console.log("HALT @ " + cpu.getPC());
  }
}

function reset() {
  if (!bufferLength) return;
  cpu.reset();
  if (!timer) {
    curTime = new Date().getTime() - timerPeriod*4;
    timerCallback();
  }
}

onmessage = function(e) {
  if (e && e.data) {
    if (e.data.command) {
      command = e.data.command & 0xff;
      reset();
    } else if (e.data.sampleRate) {
      console.log(e.data);
      sampleRate = e.data.sampleRate;
      bufferLength = numChannels*sampleRate*timerPeriod/1000;
      start();
      reset();
    } else if (e.data.rom) {
      rom = e.data.rom;
      command = 0x0;
      reset();
    }
  }
}


/**

0000                      56 _main::
                          57 ;<stdin>:10:
0000 0E 00         [ 7]   58 	ld	c,#0x00
                          59 ;<stdin>:11:
0002                      60 00111$:
0002 06 00         [ 7]   61 	ld	b,#0x00
0004                      62 00104$:
0004 78            [ 4]   63 	ld	a,b
0005 B9            [ 4]   64 	cp	a,c
0006 30 06         [12]   65 	jr	NC,00107$
0008 A9            [ 4]   66 	xor	a, c
0009 D3 00         [11]   67 	out	(_dac),a
000B 04            [ 4]   68 	inc	b
000C 18 F6         [12]   69 	jr	00104$
000E                      70 00107$:
                          71 ;<stdin>:10:
000E 0C            [ 4]   72 	inc	c
000F 79            [ 4]   73 	ld	a,c
0010 D6 FF         [ 7]   74 	sub	a, #0xff
0012 38 EE         [12]   75 	jr	C,00111$
                          76 ;<stdin>:13:
0014 18 EA         [12]   77 	jr	_main

**/
