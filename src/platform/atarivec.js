"use strict";

var ATARIVEC_PRESETS = [
]

var AtariVectorPlatform = function(mainElement) {
  var self = this;
  var cpuFrequency = 1500000.0;
  var cpuCyclesPerNMI = 6000;
  var cpuCyclesPerFrame = Math.round(cpuFrequency/60);
  var cpu, cpuram, dvgram, rom, vecrom, bus, dvg;
  var video, audio, timer;
  var clock;
  var switches = new RAM(16).mem;
  var nmicount = cpuCyclesPerNMI;

  this.__proto__ = new Base6502Platform();

  this.getPresets = function() {
    return ATARIVEC_PRESETS;
  }

  this.start = function() {
    cpu = new jt.M6502();
    cpuram = new RAM(0x400);
    dvgram = new RAM(0x2000);
    //switches[5] = 0xff;
    //switches[7] = 0xff;
    // bus
    bus = {
      read: function(address) {
        address &= 0x7fff;
        if (address >= 0x6800 && address <= 0x7fff) {
          return rom[address - 0x6800];
        } else if (address <= 0x3ff) {
          return cpuram.mem[address];
        } else if (address >= 0x5000 && address <= 0x5fff) {
          return vecrom[address - 0x5000];
        } else if (address >= 0x4000 && address <= 0x5fff) {
          return dvgram.mem[address - 0x4000];
        } else if (address >= 0x2000 && address <= 0x3fff) {
          if (address == 0x2001)
            return ((clock/500) & 1) ? 0xff : 0x00;
          else if (address >= 0x2000 && address <= 0x2007)
            return switches[address - 0x2000];
          else if (address >= 0x2400 && address <= 0x2407)
            return switches[address - 0x2400 + 8];
        }
        return 0xff;
      },
      write: function(address, val) {
        address &= 0x7fff;
        if (address < 0x3ff) {
          cpuram.mem[address] = val;
        } else if (address >= 0x4000 && address <= 0x5fff) {
          dvgram.mem[address - 0x4000] = val;
        } else if (address >= 0x3000 && address <= 0x3fff) {
          //console.log(address.toString(16), val);
          if (address == 0x3000) dvg.runUntilHalt();
          // TODO: draw asynchronous or allow poll of HALT ($2002)
        }
      }
    };
    cpu.connectBus(bus);
    // create video/audio
    video = new VectorVideo(mainElement,1024,1024);
    dvg = new DVGStateMachine(bus, video);
    audio = new SampleAudio(cpuFrequency);
    video.start();
    timer = new AnimationTimer(60, function() {
      video.clear();
      // 262.5 scanlines per frame
      var iaddr = 0x4000;
      var iofs = 0;
      var debugCond = self.getDebugCallback();
      clock = 0;
      for (var i=0; i<cpuCyclesPerFrame; i++) {
        if (debugCond && debugCond()) { debugCond = null; }
        clock++;
        if (--nmicount == 0)  {
          //console.log("NMI", cpu.saveState());
          var n = cpu.setNMIAndWait();
          clock += n;
          nmicount = cpuCyclesPerNMI - n;
          //console.log(n, clock, nmicount);
        }
        cpu.clockPulse();
        //cpu.executeInstruction();
      }
      self.restartDebugState();
    });
    video.setKeyboardEvents(function(key,code,flags) {
      var KEY2ADDR = {
        16: 3, // shift
        32: 4, // space
        53: 8+0, // 5
        54: 8+1, // 6
        55: 8+2, // 7
        49: 8+3, // 1
        50: 8+4, // 2
        38: 8+5,
        39: 8+6,
        37: 8+7,
      };
      var addr = KEY2ADDR[key];
      //console.log(key,flags,addr);
      if (addr >= 0) {
        switches[addr] = (flags&1) ? 0xff : 0x00;
      }
    });
  }

  this.loadROM = function(title, data) {
    if(data.length != 0x2000) {
      throw "ROM length must be == 0x2000";
    }
    rom = data.slice(0,0x1800);
    vecrom = data.slice(0x1800,0x2000);
    this.reset();
  }

  this.getRasterPosition = function() {
    return {x:0, y:0};
  }

  this.isRunning = function() {
    return timer.isRunning();
  }
  this.pause = function() {
    timer.stop();
  }
  this.resume = function() {
    timer.start();
  }
  this.reset = function() {
    this.clearDebug();
    cpu.reset();
  }
  this.readAddress = function(addr) {
    return bus.read(addr);
  }

  this.loadState = function(state) {
    cpu.loadState(state.c);
    cpuram.mem.set(state.cb);
    dvgram.mem.set(state.db);
    nmicount = state.nmic;
  }
  this.saveState = function() {
    return {
      c:cpu.saveState(),
      cb:cpuram.mem.slice(0),
      db:dvgram.mem.slice(0),
      nmic:nmicount
    }
  }
  this.getRAMForState = function(state) {
    return state.cb;
  }
  this.getCPUState = function() {
    return cpu.saveState();
  }
}

var DVGStateMachine = function(bus, video) {
  var self = this;
  var pc = 0;
  var x = 0;
  var y = 0;
  var gsc = 0;
  var bofs = 0x4000;
  var pcstack = [];
  var running = false;

  function readWord(a) {
    a &= 0xfff;
    return bus.read(a*2+bofs) + (bus.read(a*2+bofs+1) << 8);
  }

  function decodeSigned(w, o2) {
    var s = w & (1<<o2);
    w = w & ((1<<o2)-1);
    if (s)
      return -w;
    else
      return w;
  }

  this.go = function() {
    pc = 0;
    gsc = 7;
    running = true;
  }

  this.runUntilHalt = function() {
    this.go();
    for (var i=0; i<10000; i++) { // TODO
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
    //console.log(hex(pc), hex(w));
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
        video.drawLine(x, y, x2, y2, z);
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
        video.drawLine(x, y, x2, y2, z);
        x = x2;
        y = y2;
        break;
      }
    }
  }
}
