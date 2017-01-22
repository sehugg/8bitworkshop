"use strict";

// Emulator classes

var PLATFORMS = {};

function noise() {
  return (Math.random() * 256) & 0xff;
}

function __createCanvas(mainElement, width, height) {
  // TODO
  var fsElement = document.createElement('div');
  fsElement.style.position = "relative";
  fsElement.style.padding = "5%";
  fsElement.style.overflow = "hidden";
  fsElement.style.background = "black";

  var canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style['class'] = "emuvideo";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.tabIndex = "-1";               // Make it focusable

  fsElement.appendChild(canvas);
  mainElement.appendChild(fsElement);
  return canvas;
}

var RasterVideo = function(mainElement, width, height, options) {
  var self = this;
  var canvas, ctx;
  var imageData, buf8, datau32;

  this.create = function() {
    self.canvas = canvas = __createCanvas(mainElement, width, height);
    if (options && options.rotate) {
      // TODO: aspect ratio?
      canvas.style.transform = "rotate("+options.rotate+"deg)";
      if (canvas.width > canvas.height)
        canvas.style.paddingTop = canvas.style.paddingBottom = "10%";
      else
        canvas.style.paddingLeft = canvas.style.paddingRight = "10%";
    }
    ctx = canvas.getContext('2d');
    imageData = ctx.createImageData(width, height);
    var buf = new ArrayBuffer(imageData.data.length);
    buf8 = new Uint8Array(buf); // TODO: Uint8ClampedArray
    datau32 = new Uint32Array(buf);
  }

  // TODO: make common
  this.setKeyboardEvents = function(callback) {
    canvas.onkeydown = function(e) {
      callback(e.which, 0, 1|_metakeyflags(e));
    };
    canvas.onkeyup = function(e) {
      callback(e.which, 0, 0|_metakeyflags(e));
    };
    canvas.onkeypress = function(e) {
      callback(e.which, e.charCode, 1|_metakeyflags(e));
    };
  }

  this.getFrameData = function() {
    return datau32;
  }

  this.updateFrame = function(sx, sy, dx, dy, width, height) {
    imageData.data.set(buf8);
    if (width && height)
      ctx.putImageData(imageData, sx, sy, dx, dy, width, height);
    else
      ctx.putImageData(imageData, 0, 0);
  }

/*
mainElement.style.position = "relative";
mainElement.style.overflow = "hidden";
mainElement.style.outline = "none";
mainElement.tabIndex = "-1";               // Make it focusable

borderElement = document.createElement('div');
borderElement.style.position = "relative";
borderElement.style.overflow = "hidden";
borderElement.style.background = "black";
borderElement.style.border = "0 solid black";
borderElement.style.borderWidth = "" + borderTop + "px " + borderLateral + "px " + borderBottom + "px";
if (Javatari.SCREEN_CONTROL_BAR === 2) {
    borderElement.style.borderImage = "url(" + IMAGE_PATH + "screenborder.png) " +
        borderTop + " " + borderLateral + " " + borderBottom + " repeat stretch";
}

fsElement = document.createElement('div');
fsElement.style.position = "relative";
fsElement.style.width = "100%";
fsElement.style.height = "100%";
fsElement.style.overflow = "hidden";
fsElement.style.background = "black";

document.addEventListener("fullscreenchange", fullScreenChanged);
document.addEventListener("webkitfullscreenchange", fullScreenChanged);
document.addEventListener("mozfullscreenchange", fullScreenChanged);
document.addEventListener("msfullscreenchange", fullScreenChanged);

borderElement.appendChild(fsElement);

canvas.style.position = "absolute";
canvas.style.display = "block";
canvas.style.left = canvas.style.right = 0;
canvas.style.top = canvas.style.bottom = 0;
canvas.style.margin = "auto";
canvas.tabIndex = "-1";               // Make it focusable
canvas.style.outline = "none";
fsElement.appendChild(canvas);

setElementsSizes(jt.CanvasDisplay.DEFAULT_STARTING_WIDTH, jt.CanvasDisplay.DEFAULT_STARTING_HEIGHT);

mainElement.appendChild(borderElement);
*/
}

var VectorVideo = function(mainElement, width, height) {
  var self = this;
  var canvas, ctx;
  var persistenceAlpha = 0.5;
  var jitter = 1.0;

  this.create = function() {
    canvas = __createCanvas(mainElement, width, height);
    ctx = canvas.getContext('2d');
  }

  this.setKeyboardEvents = function(callback) {
    canvas.onkeydown = function(e) {
      callback(e.which, 0, 1|_metakeyflags(e));
    };
    canvas.onkeyup = function(e) {
      callback(e.which, 0, 0|_metakeyflags(e));
    };
    canvas.onkeypress = function(e) {
      callback(e.which, e.charCode, 1|_metakeyflags(e));
    };
  }

  this.clear = function() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = persistenceAlpha;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'lighter';
  }

  this.drawLine = function(x1, y1, x2, y2, intensity) {
    //console.log(x1, y1, x2, y2, intensity);
    if (intensity > 0) {
      // TODO: landscape vs portrait
      ctx.beginPath();
      // TODO: dots
      var jx = jitter * (Math.random() - 0.5);
      var jy = jitter * (Math.random() - 0.5);
      x1 += jx;
      x2 += jx;
      y1 += jy;
      y2 += jy;
      ctx.moveTo(x1, height-y1);
      ctx.lineTo(x2+1, height-y2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = intensity*0.1;
      ctx.stroke();
    }
  }
}

var RAM = function(size) {
  var memArray = new ArrayBuffer(size);
  this.mem = new Uint8Array(memArray);
}

// TODO
var AnimationTimer = function(frequencyHz, callback) {
  var intervalMsec = 1000.0 / frequencyHz;
  var curTime = 0;
  var running;
  var useReqAnimFrame = false; // TODO: disable on OS X

  function scheduleFrame() {
    if (useReqAnimFrame)
      window.requestAnimationFrame(nextFrame);
    else
      setTimeout(nextFrame, intervalMsec);
  }

  var nextFrame = function(timestamp) {
    // TODO: calculate framerate
    callback();
    if (running) {
      scheduleFrame();
    }
  }
  this.isRunning = function() {
    return running;
  }
  this.start = function() {
    if (!running) {
      running = true;
      scheduleFrame();
    }
  }
  this.stop = function() {
    running = false;
  }
}

//

var SampleAudio = function(clockfreq) {
  var self = this;
  var sfrac, sinc, accum;
  var buffer, bufpos, bufferlist;

  function mix(ape) {
    var buflen=ape.outputBuffer.length;
    var lbuf = ape.outputBuffer.getChannelData(0);
    //var rbuf = ape.outputBuffer.getChannelData(1);
    var m = this.module;
    if (!m) m = ape.srcElement.module;
    if (!m) return;

    var buf = bufferlist[1];
    for (var i=0; i<lbuf.length; i++) {
      lbuf[i] = buf[i];
    }
  }

  function createContext() {
    if ( typeof AudioContext !== 'undefined') {
      self.context = new AudioContext();
    } else if (typeof webkitAudioContext !== 'undefined' ){
      self.context = new webkitAudioContext();
    } else {
      return;
    }
    self.sr=self.context.sampleRate;
    self.bufferlen=(self.sr > 44100) ? 4096 : 2048;

    // Amiga 500 fixed filter at 6kHz. WebAudio lowpass is 12dB/oct, whereas
    // older Amigas had a 6dB/oct filter at 4900Hz.
    self.filterNode=self.context.createBiquadFilter();
    if (self.amiga500) {
      self.filterNode.frequency.value=6000;
    } else {
      self.filterNode.frequency.value=28867;
    }

    // "LED filter" at 3275kHz - off by default
    self.lowpassNode=self.context.createBiquadFilter();
    self.lowpassNode.frequency.value=28867;
    self.filter=false;

    // mixer
    if ( typeof self.context.createScriptProcessor === 'function') {
      self.mixerNode=self.context.createScriptProcessor(self.bufferlen, 1, 1);
    } else {
      self.mixerNode=self.context.createJavaScriptNode(self.bufferlen, 1, 1);
    }

    self.mixerNode.module=self;
    self.mixerNode.onaudioprocess=mix;

    // compressor for a bit of volume boost, helps with multich tunes
    self.compressorNode=self.context.createDynamicsCompressor();

    // patch up some cables :)
    self.mixerNode.connect(self.filterNode);
    self.filterNode.connect(self.lowpassNode);
    self.lowpassNode.connect(self.compressorNode);
    self.compressorNode.connect(self.context.destination);
  }

  this.start = function() {
    if (!this.context) createContext();
    sinc = this.sr * 1.0 / clockfreq;
    sfrac = 0;
    accum = 0;
    bufpos = 0;
    bufferlist = [];
    for (var i=0; i<2; i++) {
      var arrbuf = new ArrayBuffer(self.bufferlen*4);
      bufferlist[i] = new Float32Array(arrbuf);
    }
    buffer = bufferlist[0];
  }

  this.stop = function() {
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }

  this.feedSample = function(value, count) {
    while (count-- > 0) {
      accum += value;
      sfrac += sinc;
      if (sfrac >= 1) {
        buffer[bufpos++] = accum / sfrac;
        sfrac -= 1;
        accum = 0;
        if (bufpos >= buffer.length) {
          bufpos = 0;
          bufferlist[0] = bufferlist[1];
          bufferlist[1] = buffer;
        }
      }
    }
  }
}

function cpuStateToLongString_6502(c) {
  function decodeFlags(c, flags) {
    var s = "";
    s += c.N ? " N" : " -";
    s += c.V ? " V" : " -";
    s += c.D ? " D" : " -";
    s += c.Z ? " Z" : " -";
    s += c.C ? " C" : " -";
  //  s += c.I ? " I" : " -";
    return s;
  }
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c) + "\n"
       + " A " + hex(c.A)    + "     " + (c.R ? "" : "BUSY") + "\n"
       + " X " + hex(c.X)    + "\n"
       + " Y " + hex(c.Y)    + "     " + "SP " + hex(c.SP) + "\n";
}

////// 6502

var Base6502Platform = function() {

  this.getOpcodeMetadata = function(opcode, offset) {
    return Javatari.getOpcodeMetadata(opcode, offset); // TODO
  }

  this.getOriginPC = function() {
    return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
  }

  var onBreakpointHit;
  var debugCondition;
  var debugSavedState = null;
  var debugBreakState = null;
  var debugTargetClock = 0;
  var debugClock = 0;

  this.setDebugCondition = function(debugCond) {
    if (debugSavedState) {
      this.loadState(debugSavedState);
    } else {
      debugSavedState = this.saveState();
    }
    debugClock = 0;
    debugCondition = debugCond;
    debugBreakState = null;
    this.resume();
  }
  this.restartDebugState = function() {
    if (debugCondition && !debugBreakState) {
      debugSavedState = this.saveState();
      debugTargetClock -= debugClock;
      debugClock = 0;
    }
  }
  this.getDebugCallback = function() {
    return debugCondition;
  }
  this.setupDebug = function(callback) {
    onBreakpointHit = callback;
  }
  this.clearDebug = function() {
    debugSavedState = null;
    debugBreakState = null;
    debugTargetClock = 0;
    debugClock = 0;
    onBreakpointHit = null;
    debugCondition = null;
  }
  this.breakpointHit = function(targetClock) {
    debugTargetClock = targetClock;
    debugBreakState = this.saveState();
    debugBreakState.c.PC = (debugBreakState.c.PC-1) & 0xffff;
    console.log("Breakpoint at clk", debugClock, "PC", debugBreakState.c.PC.toString(16));
    this.pause();
    if (onBreakpointHit) {
      onBreakpointHit(debugBreakState);
    }
  }
  // TODO: lower bound of clock value
  this.step = function() {
    var self = this;
    var previousPC = -1;
    this.setDebugCondition(function() {
      if (debugClock++ > debugTargetClock) {
        var thisState = self.getCPUState();
        if (previousPC < 0) {
          previousPC = thisState.PC;
        } else {
          if (thisState.PC != previousPC && thisState.T == 0) {
            //console.log(previousPC.toString(16), thisPC.toString(16));
            self.breakpointHit(debugClock-1);
            return true;
          }
        }
      }
      return false;
    });
  }
  this.stepBack = function() {
    var self = this;
    var prevState;
    var prevClock;
    this.setDebugCondition(function() {
      if (debugClock++ >= debugTargetClock && prevState) {
        self.loadState(prevState);
        self.breakpointHit(prevClock-1);
        return true;
      } else if (debugClock > debugTargetClock-10 && debugClock < debugTargetClock) {
        if (self.getCPUState().T == 0) {
          prevState = self.saveState();
          prevClock = debugClock;
        }
      }
      return false;
    });
  }
  this.runEval = function(evalfunc) {
    var self = this;
    this.setDebugCondition(function() {
      if (debugClock++ > debugTargetClock) {
        var cpuState = self.getCPUState();
        cpuState.PC = (cpuState.PC-1)&0xffff;
        if (evalfunc(cpuState)) {
          self.breakpointHit(debugClock-1);
          return true;
        } else {
          return false;
        }
      }
    });
  }
  this.runUntilReturn = function() {
    var depth = 1;
    self.runEval(function(c) {
      if (depth <= 0 && c.T == 0)
        return true;
      if (c.o == 0x20)
        depth++;
      else if (c.o == 0x60 || c.o == 0x40)
        --depth;
      return false;
    });
  }
  this.disassemble = function(pc, read) {
    return disassemble6502(pc, read(pc), read(pc+1), read(pc+2));
  }
  this.cpuStateToLongString = function(c) {
    return cpuStateToLongString_6502(c);
  }
  this.getToolForFilename = function(fn) {
    if (fn.endsWith(".pla")) return "plasm";
    if (fn.endsWith(".c")) return "cc65";
    if (fn.endsWith(".s")) return "ca65";
    return "dasm";
  }
}

function dumpRAM(ram, ramofs, ramlen) {
  var s = "";
  // TODO: show scrollable RAM for other platforms
  for (var ofs=0; ofs<ramlen; ofs+=0x10) {
    s += '$' + hex(ofs+ramofs) + ':';
    for (var i=0; i<0x10; i++) {
      if (ofs+i < ram.length) {
        if (i == 8) s += " ";
        s += " " + hex(ram[ofs+i]);
      }
    }
    s += "\n";
  }
  return s;
}

////// Z80

function cpuStateToLongString_Z80(c) {
  function decodeFlags(flags) {
    var flagspec = "SZ-H-VNC";
    var s = "";
    for (var i=0; i<8; i++)
      s += (flags & (128>>i)) ? flagspec.slice(i,i+1) : "-";
    return s; // TODO
  }
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c.AF) + "\n"
       + "SP " + hex(c.SP,4) + "  IR " + hex(c.IR,4) + "\n"
       + "IX " + hex(c.IX,4) + "  IY " + hex(c.IY,4) + "\n"
       + "AF " + hex(c.AF,4) + "  BC " + hex(c.BC,4) + "\n"
       + "DE " + hex(c.DE,4) + "  HL " + hex(c.HL,4) + "\n"
       ;
}

var BaseZ80Platform = function() {

  var onBreakpointHit;
  var debugCondition;
  var debugSavedState = null;
  var debugBreakState = null;
  var debugTargetClock = 0;

  this.setDebugCondition = function(debugCond) {
    if (debugSavedState) {
      this.loadState(debugSavedState);
    } else {
      debugSavedState = this.saveState();
    }
    debugCondition = debugCond;
    debugBreakState = null;
    this.resume();
  }
  this.restartDebugState = function() {
    if (debugCondition && !debugBreakState) {
      debugSavedState = this.saveState();
      if (debugTargetClock > 0)
        debugTargetClock -= debugSavedState.c.T;
      debugSavedState.c.T = 0;
      this.loadState(debugSavedState);
    }
  }
  this.getDebugCallback = function() {
    return debugCondition;
  }
  this.setupDebug = function(callback) {
    onBreakpointHit = callback;
  }
  this.clearDebug = function() {
    debugSavedState = null;
    debugBreakState = null;
    debugTargetClock = 0;
    onBreakpointHit = null;
    debugCondition = null;
  }
  this.breakpointHit = function(targetClock) {
    debugTargetClock = targetClock;
    debugBreakState = this.saveState();
    //debugBreakState.c.PC = (debugBreakState.c.PC-1) & 0xffff;
    console.log("Breakpoint at clk", debugBreakState.c.T, "PC", debugBreakState.c.PC.toString(16));
    this.pause();
    if (onBreakpointHit) {
      onBreakpointHit(debugBreakState);
    }
  }
  // TODO: lower bound of clock value
  this.step = function() {
    var self = this;
    this.setDebugCondition(function() {
      var cpuState = self.getCPUState();
      if (cpuState.T > debugTargetClock) {
        self.breakpointHit(cpuState.T);
        return true;
      }
      return false;
    });
  }
  this.stepBack = function() {
    var self = this;
    var prevState;
    var prevClock;
    this.setDebugCondition(function() {
      var cpuState = self.getCPUState();
      var debugClock = cpuState.T;
      if (debugClock >= debugTargetClock && prevState) {
        self.loadState(prevState);
        self.breakpointHit(prevClock);
        return true;
      } else if (debugClock > debugTargetClock-20 && debugClock < debugTargetClock) {
        prevState = self.saveState();
        prevClock = debugClock;
      }
      return false;
    });
  }
  this.runEval = function(evalfunc) {
    var self = this;
    this.setDebugCondition(function() {
      var cpuState = self.getCPUState();
			if (cpuState.T > debugTargetClock) {
        if (evalfunc(cpuState)) {
          self.breakpointHit(cpuState.T);
          return true;
        }
      }
			return false;
    });
  }
	this.runUntilReturn = function() {
    var self = this;
    var depth = 1;
    self.runEval(function(c) {
      if (depth <= 0)
        return true;
			var op = self.readAddress(c.PC);
      if (op == 0xcd) // CALL
        depth++;
      else if (op == 0xc0 || op == 0xc8 || op == 0xc9 || op == 0xd0) // RET (TODO?)
        --depth;
      return false;
    });
  }
	this.cpuStateToLongString = function(c) {
    return cpuStateToLongString_Z80(c);
  }
  this.getToolForFilename = function(fn) {
    if (fn.endsWith(".c")) return "sdcc";
    if (fn.endsWith(".s")) return "sdasz80";
    return "z80asm";
  }
  // TODO
  //this.getOpcodeMetadata = function() { }
}

////// 6809

function cpuStateToLongString_6809(c) {
  function decodeFlags(flags) {
    var flagspec = "EFHINZVC";
    var s = "";
    for (var i=0; i<8; i++)
      s += (flags & (128>>i)) ? flagspec.slice(i,i+1) : "-";
    return s; // TODO
  }
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c.CC) + "\n"
       + "SP " + hex(c.SP,4) + "\n"
       + " A " + hex(c.A,2) + "\n"
       + " B " + hex(c.B,2) + "\n"
       + " X " + hex(c.X,4) + "\n"
       + " Y " + hex(c.Y,4) + "\n"
       + " U " + hex(c.U,4) + "\n"
       ;
}

var Base6809Platform = function() {
  this.__proto__ = new BaseZ80Platform();

	this.runUntilReturn = function() {
    var self = this;
    var depth = 1;
    self.runEval(function(c) {
      if (depth <= 0)
        return true;
			var op = self.readAddress(c.PC);
      // TODO: 6809 opcodes
      if (op == 0x9d || op == 0xad || op == 0xbd) // CALL
        depth++;
      else if (op == 0x3b || op == 0x39) // RET
        --depth;
      return false;
    });
  }
	this.cpuStateToLongString = function(c) {
    return cpuStateToLongString_6809(c);
  }
  this.getToolForFilename = function(fn) {
    return "xasm6809";
  }
  this.disassemble = function(pc, read) {
    // TODO: don't create new CPU
    return new CPU6809().disasm(read(pc), read(pc+1), read(pc+2), read(pc+3), read(pc+4), pc);
  }
  //this.getOpcodeMetadata = function() { }
}

//////////

var Keys = {
    VK_ESCAPE: {c: 27, n: "Esc"},
    VK_F1: {c: 112, n: "F1"},
    VK_F2: {c: 113, n: "F2"},
    VK_F3: {c: 114, n: "F3"},
    VK_F4: {c: 115, n: "F4"},
    VK_F5: {c: 116, n: "F5"},
    VK_F6: {c: 117, n: "F6"},
    VK_F7: {c: 118, n: "F7"},
    VK_F8: {c: 119, n: "F8"},
    VK_F9: {c: 120, n: "F9"},
    VK_F10: {c: 121, n: "F10"},
    VK_F11: {c: 122, n: "F11"},
    VK_F12: {c: 123, n: "F12"},
    VK_SCROLL_LOCK: {c: 145, n: "ScrLck"},
    VK_PAUSE: {c: 19, n: "Pause"},
    VK_QUOTE: {c: 192, n: "'"},
    VK_1: {c: 49, n: "1"},
    VK_2: {c: 50, n: "2"},
    VK_3: {c: 51, n: "3"},
    VK_4: {c: 52, n: "4"},
    VK_5: {c: 53, n: "5"},
    VK_6: {c: 54, n: "6"},
    VK_7: {c: 55, n: "7"},
    VK_8: {c: 56, n: "8"},
    VK_9: {c: 57, n: "9"},
    VK_0: {c: 48, n: "0"},
    VK_MINUS: {c: 189, n: "-"},
    VK_MINUS2: {c: 173, n: "-"},
    VK_EQUALS: {c: 187, n: "="},
    VK_EQUALS2: {c: 61, n: "="},
    VK_BACK_SPACE: {c: 8, n: "Bkspc"},
    VK_TAB: {c: 9, n: "Tab"},
    VK_Q: {c: 81, n: "Q"},
    VK_W: {c: 87, n: "W"},
    VK_E: {c: 69, n: "E"},
    VK_R: {c: 82, n: "R"},
    VK_T: {c: 84, n: "T"},
    VK_Y: {c: 89, n: "Y"},
    VK_U: {c: 85, n: "U"},
    VK_I: {c: 73, n: "I"},
    VK_O: {c: 79, n: "O"},
    VK_P: {c: 80, n: "P"},
    VK_ACUTE: {c: 219, n: "´"},
    VK_OPEN_BRACKET: {c: 221, n: "["},
    VK_CLOSE_BRACKET: {c: 220, n: "]"},
    VK_CAPS_LOCK: {c: 20, n: "CpsLck"},
    VK_A: {c: 65, n: "A"},
    VK_S: {c: 83, n: "S"},
    VK_D: {c: 68, n: "D"},
    VK_F: {c: 70, n: "F"},
    VK_G: {c: 71, n: "G"},
    VK_H: {c: 72, n: "H"},
    VK_J: {c: 74, n: "J"},
    VK_K: {c: 75, n: "K"},
    VK_L: {c: 76, n: "L"},
    VK_CEDILLA: {c: 186, n: "Ç"},
    VK_TILDE: {c: 222, n: "~"},
    VK_ENTER: {c: 13, n: "Enter"},
    VK_SHIFT: {c: 16, n: "Shift"},
    VK_BACK_SLASH: {c: 226, n: "\\"},
    VK_Z: {c: 90, n: "Z"},
    VK_X: {c: 88, n: "X"},
    VK_C: {c: 67, n: "C"},
    VK_V: {c: 86, n: "V"},
    VK_B: {c: 66, n: "B"},
    VK_N: {c: 78, n: "N"},
    VK_M: {c: 77, n: "M"},
    VK_COMMA: {c: 188, n: "] ="},
    VK_PERIOD: {c: 190, n: "."},
    VK_SEMICOLON: {c: 191, n: ";"},
    VK_SLASH: {c: 193, n: "/"},
    VK_CONTROL: {c: 17, n: "Ctrl"},
    VK_ALT: {c: 18, n: "Alt"},
    VK_SPACE: {c: 32, n: "Space"},
    VK_INSERT: {c: 45, n: "Ins"},
    VK_DELETE: {c: 46, n: "Del"},
    VK_HOME: {c: 36, n: "Home"},
    VK_END: {c: 35, n: "End"},
    VK_PAGE_UP: {c: 33, n: "PgUp"},
    VK_PAGE_DOWN: {c: 34, n: "PgDown"},
    VK_UP: {c: 38, n: "Up"},
    VK_DOWN: {c: 40, n: "Down"},
    VK_LEFT: {c: 37, n: "Left"},
    VK_RIGHT: {c: 39, n: "Right"},
    VK_NUM_LOCK: {c: 144, n: "Num"},
    VK_DIVIDE: {c: 111, n: "Num /"},
    VK_MULTIPLY: {c: 106, n: "Num *"},
    VK_SUBTRACT: {c: 109, n: "Num -"},
    VK_ADD: {c: 107, n: "Num +"},
    VK_DECIMAL: {c: 194, n: "Num ."},
    VK_NUMPAD0: {c: 96, n: "Num 0"},
    VK_NUMPAD1: {c: 97, n: "Num 1"},
    VK_NUMPAD2: {c: 98, n: "Num 2"},
    VK_NUMPAD3: {c: 99, n: "Num 3"},
    VK_NUMPAD4: {c: 100, n: "Num 4"},
    VK_NUMPAD5: {c: 101, n: "Num 5"},
    VK_NUMPAD6: {c: 102, n: "Num 6"},
    VK_NUMPAD7: {c: 103, n: "Num 7"},
    VK_NUMPAD8: {c: 104, n: "Num 8"},
    VK_NUMPAD9: {c: 105, n: "Num 9"},
    VK_NUMPAD_CENTER: {c: 12, n: "Num Cntr"}
};

function _metakeyflags(e) {
  return (e.shiftKey?2:0) | (e.ctrlKey?4:0) | (e.altKey?8:0) | (e.metaKey?16:0);
}

function setKeyboardFromMap(video, switches, map, func) {
  video.setKeyboardEvents(function(key,code,flags) {
    var o = map[key];
    if (o && func) {
      func(o, key, code, flags);
    }
    if (o) {
      //console.log(key,code,flags,o);
      var mask = o.mask;
      if (mask < 0) { // negative mask == active low
        mask = -mask;
        flags ^= 1;
      }
      if (flags & 1) {
        switches[o.index] |= mask;
      } else {
        switches[o.index] &= ~mask;
      }
    }
  });
}

function makeKeycodeMap(table) {
  var map = {};
  for (var i=0; i<table.length; i++) {
    var entry = table[i];
    map[entry[0].c] = {index:entry[1], mask:entry[2]};
  }
  return map;
}

function padBytes(data, len) {
  var r = new RAM(len);
  r.mem.set(data);
  return r.mem;
}

// TODO: better performance, check values
function AddressDecoder(table, options) {
  var self = this;
  function makeFunction(lo, hi) {
    var s = "";
    if (options && options.gmask) {
      s += "a&=" + options.gmask + ";";
    }
    for (var i=0; i<table.length; i++) {
      var entry = table[i];
      var start = entry[0];
      var end = entry[1];
      var mask = entry[2];
      var func = entry[3];
      self['__fn'+i] = func;
      s += "if (a>=" + start + " && a<="+end + "){";
      if (mask) s += "a&="+mask+";";
      s += "return this.__fn"+i+"(a,v)&0xff;}\n";
    }
    s += "return 0;"; // TODO: noise()?
    return new Function('a', 'v', s);
  }
  return makeFunction(0x0, 0xffff).bind(self);
}
