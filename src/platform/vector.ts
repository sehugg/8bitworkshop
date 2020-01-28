"use strict";

import { Platform, BaseZ80Platform, Base6502Platform  } from "../common/baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, VectorVideo, Keys, makeKeycodeMap } from "../common/emu";
import { hex } from "../common/util";
import { MasterAudio, POKEYDeviceChannel, newPOKEYAudio } from "../common/audio";

// http://www.computerarcheology.com/Arcade/Asteroids/DVG.html
// http://arcarc.xmission.com/Tech/neilw_xy.txt

var VECTOR_PRESETS = [
  {id:'font.c', name:'Vector Fonts'},
  {id:'threed.c', name:'3D Transformations'},
  {id:'game.c', name:'Space Game'},
  {id:'music.c', name:'POKEY Music'},
]

var ASTEROIDS_KEYCODE_MAP = makeKeycodeMap([
  [Keys.B,      3, 0xff],
  [Keys.A,      4, 0xff],
  [Keys.SELECT, 8, 0xff],
  [Keys.VK_6,   9, 0xff],
  [Keys.VK_7,   10, 0xff],
  [Keys.START,  11, 0xff],
  [Keys.P2_START, 12, 0xff],
  [Keys.UP,     13, 0xff],
  [Keys.RIGHT,  14, 0xff],
  [Keys.LEFT,   15, 0xff],
]);

var GRAVITAR_KEYCODE_MAP = makeKeycodeMap([
  [Keys.B,      1, -0x1],
  [Keys.A,      1, -0x2],
  [Keys.VK_5,   0, 0x2],
  [Keys.VK_6,   0, 0x1],
  [Keys.START,  2, 0x20],
  [Keys.P2_START, 2, 0x40],
  [Keys.UP,     1, -0x10],
  [Keys.DOWN,   1, -0x20],
  [Keys.RIGHT,  1, -0x4],
  [Keys.LEFT,   1, -0x8],
]);

var AtariVectorPlatform = function(mainElement) {
  var XTAL = 12096000;
  var cpuFrequency = XTAL/8;
  var cpuCyclesPer3khz = Math.round(cpuFrequency/(XTAL/4096)); // ~3 Khz
  var cpuCyclesPerNMI = Math.round(cpuFrequency*12/(XTAL/4096)); // ~250 Hz
  var cpuCyclesPerFrame = Math.round(cpuFrequency/60);
  var cpu, cpuram, dvgram, rom, vecrom, bus, dvg;
  var video, audio, timer;
  var clock;
  var watchdog = 0;
  var switches = new RAM(16).mem;
  var nmicount = cpuCyclesPerNMI;

  this.__proto__ = new (Base6502Platform as any)();

  this.getPresets = function() {
    return VECTOR_PRESETS;
  }

  this.start = function() {
    cpuram = new RAM(0x400);
    dvgram = new RAM(0x2000);
    //switches[5] = 0xff;
    //switches[7] = 0xff;
    // bus
    bus = {

      read: newAddressDecoder([
        [0x0,    0x3ff,  0x3ff,  function(a) { return cpuram.mem[a]; }],
        [0x2001, 0x2001, 0,      function(a) { return ((clock / cpuCyclesPer3khz) & 1) ? 0xff : 0x00; }],
        [0x2000, 0x2007, 0x7,    function(a) { return switches[a]; }],
        [0x2400, 0x2407, 0x7,    function(a) { return switches[a+8]; }],
        [0x4000, 0x4fff, 0xfff,  function(a) { return dvgram.mem[a]; }],
        [0x5000, 0x5fff, 0xfff,  function(a) { return vecrom[a]; }],
        [0x6800, 0x7fff, 0,      function(a) { return rom ? rom[a - 0x6800] : 0; }],
      ], {gmask:0x7fff}),

      write: newAddressDecoder([
        [0x0,    0x3ff,  0x3ff,  function(a,v) { cpuram.mem[a] = v; }],
        [0x3000, 0x3000, 0,      function(a,v) { dvg.runUntilHalt(0); }],
        [0x3400, 0x3400, 0,      function(a,v) { watchdog = 0; }],
        // TODO: draw asynchronous or allow poll of HALT ($2002)
        [0x4000, 0x5fff, 0x1fff, function(a,v) { dvgram.mem[a] = v; }],
      ], {gmask:0x7fff})

    };
    this.readAddress = bus.read;
    cpu = this.newCPU(bus);
    // create video/audio
    video = new VectorVideo(mainElement,1024,1024);
    dvg = new DVGBWStateMachine(bus, video, 0x4000);
    audio = newPOKEYAudio(2);
    video.create();
    timer = new AnimationTimer(60, this.nextFrame.bind(this));
    setKeyboardFromMap(video, switches, ASTEROIDS_KEYCODE_MAP);
  }

  this.advance = (novideo) => {
      if (!novideo) video.clear();
      var debugCond = this.getDebugCallback();
      clock = 0;
      for (var i=0; i<cpuCyclesPerFrame; i++) {
        if (debugCond && debugCond()) {
          debugCond = null;
          break;
        }
        clock++;
        if (--nmicount == 0) {
          //console.log("NMI", cpu.saveState());
          var n = cpu.setNMIAndWait();
          clock += n;
          nmicount = cpuCyclesPerNMI - n;
        }
        cpu.clockPulse();
        //cpu.executeInstruction();
      }
      //if (++watchdog == 256) { watchdog = 0; cpu.reset(); }
  }

  this.loadROM = function(title, data) {
    if(data.length != 0x2000) {
      throw Error("ROM length must be == 0x2000");
    }
    rom = data.slice(0,0x1800);
    vecrom = data.slice(0x1800,0x2000);
    this.reset();
  }

  this.isRunning = function() {
    return timer && timer.isRunning();
  }
  this.pause = function() {
    timer.stop();
    audio.stop();
  }
  this.resume = function() {
    timer.start();
    audio.start();
  }
  this.reset = function() {
    this.clearDebug();
    cpu.reset();
  }

  this.loadState = function(state) {
    cpu.loadState(state.c);
    cpuram.mem.set(state.b);
    dvgram.mem.set(state.db);
    switches.set(state.sw);
    nmicount = state.nmic;
  }
  this.saveState = function() {
    return {
      c:cpu.saveState(),
      b:cpuram.mem.slice(0),
      db:dvgram.mem.slice(0),
      sw:switches.slice(0),
      nmic:nmicount
    }
  }
  this.loadControlsState = function(state) {
    switches.set(state.sw);
  }
  this.saveControlsState = function() {
    return {
      sw:switches.slice(0),
    }
  }
  this.getCPUState = function() {
    return cpu.saveState();
  }
  this.getMemoryMap = function() { return { main:[
      {name:'Switches/POKEY I/O',start:0x7800,size:0x1000,type:'io'},
      {name:'DVG I/O',start:0x8800,size:0x100,type:'io'},
      {name:'EAROM',start:0x8900,size:0x100,type:'ram'},
  ] } };
}

var AtariColorVectorPlatform = function(mainElement) {
  var masterFrequency = 12096000.0;
  var cpuFrequency = masterFrequency / 8;
  var nmiFrequency = masterFrequency / 4096 / 12;
  var cpuCyclesPerNMI = Math.round(cpuFrequency / nmiFrequency);
  var cpuCyclesPerFrame = Math.round(cpuFrequency / 60);
  var cpu, cpuram, dvgram, rom, vecrom, bus, dvg, earom;
  var video, audio, timer;
  var clock;
  var switches = new RAM(16).mem;
  var nmicount = cpuCyclesPerNMI;
  var earom_offset, earom_data;

  this.__proto__ = new (Base6502Platform as any)();
  //this.debugPCDelta = 0;

  this.getPresets = function() {
    return VECTOR_PRESETS;
  }

  this.start = function() {
    cpuram = new RAM(0x800);
    dvgram = new RAM(0x2000);
    earom = new RAM(0x40);
    //rom = padBytes(new lzgmini().decode(GRAVITAR_ROM).slice(0), 0x7000+1);
    //vecrom = padBytes(new lzgmini().decode(GRAVITAR_VECROM).slice(0), 0x6000-0x2800+1);
    switches[0] = 0x0;
    switches[1] = 0xff;
    switches[2] = 0x0;
    // bus
    bus = {

      read: newAddressDecoder([
        [0x0,    0x7ff,  0x7ff,  function(a) { return cpuram.mem[a]; }],
        [0x2000, 0x27ff, 0x7ff,  function(a) { return dvgram.mem[a]; }],
        [0x2800, 0x5fff, 0x7fff, function(a) { return vecrom[a - 0x2800]; }],
        //[0x2001, 0x2001, 0,      function(a) { return ((clock/500) & 1) ? 0xff : 0x00; }],
        //[0x6000, 0x67ff, 0x7ff,  function(a) { /* pokey1 */ return 0; }],
        //[0x6800, 0x6fff, 0x7ff,  function(a) { /* pokey2 */ return 0; }],
        [0x7800, 0x7800, 0,      function(a) { return switches[0]; }],
        [0x8000, 0x8000, 0,      function(a) { return switches[1]; }],
        [0x8800, 0x8800, 0,      function(a) { return switches[2]; }],
        //[0x7000, 0x7000, 0,      function(a) { /* EAROM read */ return 0; }],
        //[0x8940, 0x897f, 0x3f,   function(a) { /* EAROM data */ return 0; }],
        [0x8900, 0x8900, 0,      function(a) { /* EAROM read */ return earom_data; }],
        [0x9000, 0xffff, 0xffff, function(a) { return rom ? rom[a - 0x9000] : 0; }],
      ]),

      write: newAddressDecoder([
        [0x0,    0x7ff,  0x7ff,  function(a,v) { cpuram.mem[a] = v; }],
        [0x2000, 0x27ff, 0x7ff,  function(a,v) { dvgram.mem[a] = v; }],
        [0x2800, 0x5fff, 0x7fff, function(a,v) { vecrom[a - 0x2800] = v; }], // TODO: remove (it's ROM!)
        [0x6000, 0x67ff, 0xf,    function(a,v) { audio.pokey1.setRegister(a, v); }],
        [0x6800, 0x6fff, 0xf,    function(a,v) { audio.pokey2.setRegister(a, v); }],
        [0x8800, 0x8800, 0,      function(a,v) { /* LEDs, etc */ }],
        [0x8840, 0x8840, 0,      function(a,v) { dvg.runUntilHalt(0); }],
        [0x8880, 0x8880, 0,      function(a,v) { dvg.reset(); }],
        [0x88c0, 0x88c0, 0,      function(a,v) { /* IRQ ACK */ }],
        [0x8900, 0x8900, 0,      function(a,v) { /* EAROM ctrl */
          if (v == 9) earom_data=earom.mem[earom_offset];
          if (v == 12) earom.mem[earom_offset]=earom_data;
        }],
        [0x8940, 0x897f, 0x3f,   function(a,v) { /* EAROM data */ earom_offset = a; earom_data = v; }],
        [0x8980, 0x8980, 0,      function(a,v) { /* TODO: watchdog */ }],
        // TODO: draw asynchronous or allow poll of HALT ($2002)
        //[0, 0xffff, 0,    function(a,v) { console.log(hex(a,4),hex(v,2)); }],
      ])

    };
    this.readAddress = bus.read;
    cpu = this.newCPU(bus);
    // create video/audio
    video = new VectorVideo(mainElement,1024,1024);
    dvg = new DVGColorStateMachine(bus, video, 0x2000);
    audio = newPOKEYAudio(2);
    video.create();
    timer = new AnimationTimer(60, this.nextFrame.bind(this));
    setKeyboardFromMap(video, switches, GRAVITAR_KEYCODE_MAP);
  }

  this.advance = (novideo) => {
      if (!novideo) video.clear();
      var debugCond = this.getDebugCallback();
      clock = 0;
      for (var i=0; i<cpuCyclesPerFrame; i++) {
        if (debugCond && debugCond()) {
          debugCond = null;
          break;
        }
        clock++;
        if (--nmicount == 0) {
          //console.log("NMI", cpu.saveState());
          var n = cpu.setIRQAndWait(); // TODO: only if I flag set
          clock += n;
          nmicount = cpuCyclesPerNMI - n;
          //console.log(n, clock, nmicount);
        }
        cpu.clockPulse();
        //cpu.executeInstruction();
      }
  }

  this.loadROM = function(title, data) {
    rom = data.slice(0, 0x7000);
    vecrom = padBytes(data.slice(0x7000), 0x3800);
    this.reset();
  }

  this.isRunning = function() {
    return timer && timer.isRunning();
  }
  this.pause = function() {
    timer.stop();
    audio.stop();
  }
  this.resume = function() {
    timer.start();
    audio.start();
  }
  this.reset = function() {
    this.clearDebug();
    cpu.reset();
  }

  this.loadState = function(state) {
    this.unfixPC(state.c);
    cpu.loadState(state.c);
    this.fixPC(state.c);
    cpuram.mem.set(state.b);
    dvgram.mem.set(state.db);
    switches.set(state.sw);
    nmicount = state.nmic;
  }
  this.saveState = function() {
    return {
      c:this.getCPUState(),
      b:cpuram.mem.slice(0),
      db:dvgram.mem.slice(0),
      sw:switches.slice(0),
      nmic:nmicount
    }
  }
  this.loadControlsState = function(state) {
    switches.set(state.sw);
  }
  this.saveControlsState = function() {
    return {
      sw:switches.slice(0),
    }
  }
  this.getCPUState = function() {
    return this.fixPC(cpu.saveState());
  }
}

//

var Z80ColorVectorPlatform = function(mainElement, proto) {
  var cpuFrequency = 4000000.0;
  var cpuCyclesPerFrame = Math.round(cpuFrequency/60);
  var cpu, cpuram, dvgram, rom, bus, dvg;
  var video, audio, timer;
  var clock;
  var switches = new RAM(16).mem;
  var mathram = new RAM(16).mem;

  this.__proto__ = new (BaseZ80Platform as any)();

  this.getPresets = function() {
    return VECTOR_PRESETS;
  }

  function do_math() {
    var sum = (((mathram[0] + (mathram[1]<<8)) << 16) >> 16);
    var a = (mathram[2] << 24) >> 24;
    var b = (mathram[3] << 24) >> 24;
    var d = a!=0 ? (sum/a) : 0;
    sum += (a*b) & 0xffff;
    mathram[0] = sum & 0xff;
    mathram[1] = (sum >> 8) & 0xff;
    mathram[4] = d & 0xff;
    mathram[5] = (d >> 8) & 0xff;
  }

  this.start = function() {
    cpuram = new RAM(0x2000);
    dvgram = new RAM(0x4000);
    switches[0] = 0x0;
    switches[1] = 0xff;
    switches[2] = 0x0;
    // bus
    bus = {

      read: newAddressDecoder([
        [0x0,    0x7fff, 0,      function(a) { return rom ? rom[a] : 0; }],
        [0x8000, 0x800f, 0xf,    function(a) { return switches[a]; }],
        [0x8100, 0x810f, 0xf,    function(a) { return mathram[a]; } ],
        [0xa000, 0xdfff, 0x3fff, function(a) { return dvgram.mem[a]; }],
        [0xe000, 0xffff, 0x1fff, function(a) { return cpuram.mem[a]; }],
      ]),

      write: newAddressDecoder([
        [0x8000, 0x800f, 0xf,    function(a,v) { audio.pokey1.setRegister(a, v); }],
        [0x8010, 0x801f, 0xf,    function(a,v) { audio.pokey2.setRegister(a, v); }],
        [0x8100, 0x810e, 0xf,    function(a,v) { mathram[a] = v; } ],
        [0x810f, 0x810f, 0,      function(a,v) { do_math(); } ],
        [0x8840, 0x8840, 0,      function(a,v) { dvg.runUntilHalt(0); }],
        [0x8880, 0x8880, 0,      function(a,v) { dvg.reset(); }],
        [0x8980, 0x8980, 0,      function(a,v) { switches[0xe] = 16; }],
        [0xa000, 0xdfff, 0x3fff, function(a,v) { dvgram.mem[a] = v; }],
        [0xe000, 0xffff, 0x1fff, function(a,v) { cpuram.mem[a] = v; }],
      ])

    };
    this.readAddress = bus.read;
    cpu = this.newCPU(bus, bus);
    // create video/audio
    video = new VectorVideo(mainElement,1024,1024);
    dvg = new DVGColorStateMachine(bus, video, 0xa000);
    audio = newPOKEYAudio(2);
    video.create();
    timer = new AnimationTimer(60, this.nextFrame.bind(this));
    setKeyboardFromMap(video, switches, GRAVITAR_KEYCODE_MAP);
  }

  this.advance = (novideo) => {
      if (!novideo) video.clear();
      this.runCPU(cpu, cpuCyclesPerFrame);
      cpu.interrupt(0xff); // RST 0x38
      switches[0xf] = (switches[0xf] + 1) & 0x3;
      if (--switches[0xe] <= 0) {
        console.log("WATCHDOG FIRED"); // TODO: alert on video
        this.reset(); // watchdog reset
      }
  }

  this.loadROM = function(title, data) {
    rom = padBytes(data, 0x8000);
    this.reset();
  }

  this.isRunning = function() {
    return timer && timer.isRunning();
  }
  this.pause = function() {
    timer.stop();
    audio.stop();
  }
  this.resume = function() {
    timer.start();
    audio.start();
  }
  this.reset = function() {
    switches[0xe] = 16;
    cpu.reset();
  }

  this.loadState = function(state) {
    cpu.loadState(state.c);
    cpuram.mem.set(state.b);
    dvgram.mem.set(state.db);
    switches.set(state.sw);
    mathram.set(state.mr);
  }
  this.saveState = function() {
    return {
      c:cpu.saveState(),
      b:cpuram.mem.slice(0),
      db:dvgram.mem.slice(0),
      sw:switches.slice(0),
      mr:mathram.slice(0),
    }
  }
  this.loadControlsState = function(state) {
    switches.set(state.sw);
  }
  this.saveControlsState = function() {
    return {
      sw:switches.slice(0),
    }
  }
  this.getCPUState = function() {
    return cpu.saveState();
  }
  this.getMemoryMap = function() { return { main:[
      {name:'Switches/POKEY I/O',start:0x8000,size:0x100,type:'io'},
      {name:'Math Box I/O',start:0x8100,size:0x100,type:'io'},
      {name:'DVG I/O',start:0x8800,size:0x100,type:'io'},
      {name:'DVG RAM',start:0xa000,size:0x4000,type:'ram'},
  ] } };
}

// DIGITAL VIDEO GENERATOR

var DVGBWStateMachine = function(bus, video, bofs) {
  var pc = 0;
  var x = 0;
  var y = 0;
  var gsc = 0;
  var pcstack = [];
  var running = false;
  bofs &= 0xffff;

  function readWord(a) {
    a &= 0xfff;
    var v = bus.read(a*2+bofs) + (bus.read(a*2+bofs+1) << 8);
    //console.log(hex(a*2+bofs,4), hex(v,4), hex(x>>2), hex(y>>2));
    return v;
  }

  function decodeSigned(w, o2) {
    var s = w & (1<<o2);
    w = w & ((1<<o2)-1);
    if (s)
      return -w;
    else
      return w;
  }

  this.reset = function() {
    pc = 0;
    gsc = 7;
    running = false;
  }

  this.go = function() {
    this.reset();
    running = true;
  }

  this.runUntilHalt = function(startpc) {
    this.go();
    pc = startpc;
    for (var i=0; i<10000; i++) { // TODO: limit execution
      if (!running) break;
      this.nextInstruction();
    }
    //console.log('DVG',i);
  }

  var GSCALES = [7, 6, 5, 4, 3, 2, 1, 0, 15, 14, 13, 12, 11, 10, 9, 8];

  this.nextInstruction = function() {
    if (!running) return;
    var w = readWord(pc);
    var op = w >> 12;
    //console.log(hex(pc*2+bofs), hex(w), hex(x>>2), hex(y>>2), hex(32-pcstack.length*2));
    pc++;
    switch (op) {
      // VEC
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
      case 8:
      case 9: { // VCTR
        var sc = gsc + 9 - op;
        var w2 = readWord(pc++);
        var z = w2 >> 12;
        var x2 = x + ((decodeSigned(w2, 10) << 7) >> sc);
        var y2 = y + ((decodeSigned(w, 10) << 7) >> sc);
        video.drawLine(x, y, x2, y2, z*32, 7);
        //console.log(pc.toString(16), w.toString(16), w2.toString(16), gsc, sc, x, y, x2, y2);
        x = x2;
        y = y2;
        break;
      }
      case 10: { // LABS
        var w2 = readWord(pc++);
        gsc = GSCALES[w2 >> 12];
        x = w2 & 0x3ff;
        y = w & 0x3ff;
        break;
      }
      case 11: // HALT
        running = false;
        break;
      case 13: // RTSL
        pc = pcstack.pop();
        break;
      case 12: // JSRL
        pcstack.push(pc);
      case 14: // JMPL
        pc = w & 0xfff;
        break;
      case 15: { // SVEC
        var sc = ((w>>11)&1) + ((w>>2)&2);
        sc = gsc - sc - 1;
        var x2 = x + ((decodeSigned(w, 2) << 7) >> sc);
        var y2 = y + ((decodeSigned(w>>8, 2) << 7) >> sc);
        var z = (w >> 4) & 0xf;
        video.drawLine(x, y, x2, y2, z*32, 7);
        x = x2;
        y = y2;
        break;
      }
    }
  }
}

var DVGColorStateMachine = function(bus, video, bofs) {
  var pc = 0;
  var x = 0;
  var y = 0;
  var scale = 1.0;
  var color;
  var statz;
  var sparkle;
  var pcstack = [];
  var running = false;

  bofs &= 0xffff;

  function readWord(a) {
    a &= 0x1fff;
    return bus.read(a*2+bofs) + (bus.read(a*2+bofs+1) << 8);
  }

  // twos complement
  function decodeSigned(w, o2) {
    var s = w & (1<<o2);
    w = w & ((1<<o2)-1);
    if (s)
      return w-(1<<o2);
    else
      return w;
  }

  function sparkle_color() {
    return (Math.random() * 256) & 0x7;
  }

  this.reset = function() {
    pc = 0;
    scale = 1.0;
    color = 7;
    statz = 15;
    x = 512;
    y = 512;
    sparkle = false;
    running = false;
  }

  this.go = function() {
    this.reset();
    running = true;
  }

  this.runUntilHalt = function(startpc) {
    this.go();
    pc = startpc;
    for (var i=0; i<10000; i++) { // TODO: limit execution
      if (!running) break;
      this.nextInstruction();
    }
    //console.log('DVG',i);
  }

  this.nextInstruction = function() {
    if (!running) return;
    var w = readWord(pc);
    var op = w >> 13;
    //video.drawLine(pc, 1023, pc+1, 1023-op, 7);
    //console.log(hex(pc), hex(w), op);
    pc++;
    switch (op) {
      case 0: { // VCTR
        var w2 = readWord(pc++);
        var z = w2 >> 13;
        if (z == 2) z = statz;
        var x2 = x + Math.round(decodeSigned(w2, 12) * scale);
        var y2 = y + Math.round(decodeSigned(w, 12) * scale);
        if (sparkle) color = sparkle_color();
        video.drawLine(x, y, x2, y2, z<<4, color);
        x = x2;
        y = y2;
        break;
      }
      case 1: // HALT
        running = false;
        break;
      case 2: { // SVEC
        var x2 = x + Math.round(decodeSigned(w, 4) * scale * 2);
        var y2 = y + Math.round(decodeSigned(w>>8, 4) * scale * 2);
        var z = (w >> 5) & 0x7;
        if (z == 2) z = statz;
        if (sparkle) color = sparkle_color();
        video.drawLine(x, y, x2, y2, z<<4, color);
        x = x2;
        y = y2;
        break;
      }
      case 3: { // STAT/SCAL
        if (w & 0x1000) { // SCAL
          var b = ((w >> 8) & 0x07)+8;
          var l = (~w) & 0xff;
          scale = ((l << 16) >> b) / 32768.0;
        } else { // STAT
          color = w & 7;
          statz = (w >> 4) & 0xf;
          sparkle = (w & 0x800) != 0;
        }
        break;
      }
      case 4: // CNTR
        x = 512;
        y = 512;
        break;
      case 6: // RTSL
        if (pcstack.length == 0) {
          //console.log("stack underflow"); // TODO: error?
        } else {
          pc = pcstack.pop();
        }
        break;
      case 5: // JSRL
        pcstack.push(pc);
      case 7: // JMPL
        if (pc == 0)
          running = false;
        else
          pc = w & 0x1fff;
        break;
    }
  }
}

//

PLATFORMS['vector-ataribw'] = AtariVectorPlatform;
PLATFORMS['vector-ataricolor'] = AtariColorVectorPlatform;
PLATFORMS['vector-z80color'] = Z80ColorVectorPlatform;
