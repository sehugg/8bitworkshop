"use strict";

// Emulator classes

var PLATFORMS = {};

var frameUpdateFunction = null;

function noise() {
  return (Math.random() * 256) & 0xff;
}

function __createCanvas(mainElement, width, height) {
  // TODO
  var fsElement = document.createElement('div');
  fsElement.classList.add("emubevel");

  var canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.classList.add("emuvideo");
  canvas.tabIndex = "-1";               // Make it focusable

  fsElement.appendChild(canvas);
  mainElement.appendChild(fsElement);
  return canvas;
}

var RasterVideo = function(mainElement, width, height, options) {
  var self = this;
  var canvas, ctx;
  var imageData, arraybuf, buf8, datau32;

  this.setRotate = function(rotate) {
    if (rotate) {
      // TODO: aspect ratio?
      canvas.style.transform = "rotate("+rotate+"deg)";
      if (canvas.width < canvas.height)
        canvas.style.paddingLeft = canvas.style.paddingRight = "10%";
    } else {
      canvas.style.transform = null;
      canvas.style.paddingLeft = canvas.style.paddingRight = null;
    }
  }

  this.create = function() {
    self.canvas = canvas = __createCanvas(mainElement, width, height);
    if (options && options.rotate) {
      self.setRotate(options.rotate);
    }
    ctx = canvas.getContext('2d');
    imageData = ctx.createImageData(width, height);
    /*
    arraybuf = new ArrayBuffer(imageData.data.length);
    buf8 = new Uint8Array(arraybuf); // TODO: Uint8ClampedArray
    datau32 = new Uint32Array(arraybuf);
    buf8 = imageData.data;
    */
    datau32 = new Uint32Array(imageData.data.buffer);
  }

  // TODO: common function (canvas)
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
  };

  this.getFrameData = function() { return datau32; }

  this.getContext = function() { return ctx; }

  this.updateFrame = function(sx, sy, dx, dy, width, height) {
    //imageData.data.set(buf8); // TODO: slow w/ partial updates
    if (width && height)
      ctx.putImageData(imageData, sx, sy, dx, dy, width, height);
    else
      ctx.putImageData(imageData, 0, 0);
    if (frameUpdateFunction) frameUpdateFunction(canvas);
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
  var gamma = 0.8;
  var sx = width/1024.0;
  var sy = height/1024.0;

  this.create = function() {
    canvas = __createCanvas(mainElement, width, height);
    ctx = canvas.getContext('2d');
  }

  // TODO: common function (canvas)
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
  };

  this.clear = function() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = persistenceAlpha;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'lighter';
    if (frameUpdateFunction) frameUpdateFunction(canvas);
  }

  var COLORS = [
    '#111111',
    '#1111ff',
    '#11ff11',
    '#11ffff',
    '#ff1111',
    '#ff11ff',
    '#ffff11',
    '#ffffff'
  ];

  this.drawLine = function(x1, y1, x2, y2, intensity, color) {
    //console.log(x1, y1, x2, y2, intensity);
    if (intensity > 0) {
      // TODO: landscape vs portrait
      var alpha = Math.pow(intensity / 255.0, gamma);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      // TODO: bright dots
      var jx = jitter * (Math.random() - 0.5);
      var jy = jitter * (Math.random() - 0.5);
      x1 += jx;
      x2 += jx;
      y1 += jy;
      y2 += jy;
      ctx.moveTo(x1*sx, height-y1*sy);
      if (x1 == x2 && y1 == y2)
        ctx.lineTo(x2*sx+1, height-y2*sy);
      else
        ctx.lineTo(x2*sx, height-y2*sy);
      ctx.strokeStyle = COLORS[color & 7];
      ctx.stroke();
    }
  }
}

var RAM = function(size) {
  var memArray = new ArrayBuffer(size);
  this.mem = new Uint8Array(memArray);
}

var AnimationTimer = function(frequencyHz, callback) {
  var intervalMsec = 1000.0 / frequencyHz;
  var running;
  var lastts = 0;
  var useReqAnimFrame = window.requestAnimationFrame ? (frequencyHz>40) : false;
  var nframes, startts; // for FPS calc
  this.frameRate = frequencyHz;

  function scheduleFrame() {
    if (useReqAnimFrame)
      window.requestAnimationFrame(nextFrame);
    else
      setTimeout(nextFrame, intervalMsec);
  }
  function nextFrame(ts) {
    if (running) {
      scheduleFrame();
    }
    if (!useReqAnimFrame || ts - lastts > intervalMsec/2) {
      if (running) {
        try {
          callback();
        } catch (e) {
          running = false;
          throw e;
        }
      }
      if (ts - lastts < intervalMsec*30) {
        lastts += intervalMsec;
      } else {
        lastts = ts;
      }
      if (nframes == 0) startts = ts;
      if (nframes++ == 300) {
        console.log("Avg framerate: " + nframes*1000/(ts-startts) + " fps");
      }
    }
  }
  this.isRunning = function() {
    return running;
  }
  this.start = function() {
    if (!running) {
      running = true;
      lastts = 0;
      nframes = 0;
      scheduleFrame();
    }
  }
  this.stop = function() {
    running = false;
  }
}

//

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

  this.newCPU = function(membus) {
    var cpu = new jt.M6502();
    cpu.connectBus(membus);
    return cpu;
  }

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
    this.runEval(function(c) {
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
  this.getToolForFilename = getToolForFilename_6502;
  this.getDefaultExtension = function() { return ".a"; };
}

function getToolForFilename_6502(fn) {
  if (fn.endsWith(".pla")) return "plasm";
  if (fn.endsWith(".c")) return "cc65";
  if (fn.endsWith(".s")) return "ca65";
  if (fn.endsWith(".acme")) return "acme";
  return "dasm"; // .a
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

  var _cpu;
  var probe;

  this.newCPU = function(membus, iobus) {
    probe = new BusProbe(membus);
    _cpu = Z80_fast({
     display: {},
     memory: probe,
     ioBus: iobus
   });
   return _cpu;
  }

  this.getProbe = function() { return probe; }
  this.getPC = function() { return _cpu.getPC(); }
  this.getSP = function() { return _cpu.getSP(); }

  // TODO: refactor other parts into here
  this.runCPU = function(cpu, cycles) {
    _cpu = cpu; // TODO?
    if (this.wasBreakpointHit())
      return 0;
    var debugCond = this.getDebugCallback();
    var targetTstates = cpu.getTstates() + cycles;
    if (debugCond) { // || trace) {
      while (cpu.getTstates() < targetTstates) {
        //_trace(); // TODO
        if (debugCond && debugCond()) {
          debugCond = null;
          break;
        }
        cpu.runFrame(cpu.getTstates() + 1);
      }
    } else {
      cpu.runFrame(targetTstates);
    }
    return cpu.getTstates() - targetTstates;
  }

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
  this.wasBreakpointHit = function() {
    return debugBreakState != null;
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
    this.runEval(function(c) {
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
  this.getToolForFilename = getToolForFilename_z80;
  this.getDefaultExtension = function() { return ".c"; };
  // TODO
  //this.getOpcodeMetadata = function() { }
}

function getToolForFilename_z80(fn) {
  if (fn.endsWith(".c")) return "sdcc";
  if (fn.endsWith(".s")) return "sdasz80";
  if (fn.endsWith(".ns")) return "naken";
  return "z80asm";
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

  this.newCPU = function(membus) {
    var cpu = new CPU6809();
    cpu.init(membus.write, membus.read, 0);
    return cpu;
  }

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
  this.getDefaultExtension = function() { return ".asm"; };
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
  if (data.length > len) {
    throw Error("Data too long, " + data.length + " > " + len);
  }
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

var BusProbe = function(bus) {
  var active = false;
  var callback;
  this.activate = function(_callback) {
    active = true;
    callback = _callback;
  }
  this.deactivate = function() {
    active = false;
    callback = null;
  }
  this.read = function(a) {
    if (active) {
      callback(a);
    }
    return bus.read(a);
  }
  this.write = function(a,v) {
    if (active) {
      callback(a,v);
    }
    bus.write(a,v);
  }
}

/// MAME SUPPORT

var BaseMAMEPlatform = function() {
  var self = this;

  var loaded = false;
  var romfn;
  var romdata;
  var video;
  var preload_files;
  var running = false;
  var console_vars = {};
  var console_varname;
  var initluavars = false;
  var luadebugscript;
  var js_lua_string;

  this.luareset = function() {
    console_vars = {};
  }

  // http://docs.mamedev.org/techspecs/luaengine.html
  this.luacall = function(s) {
    console_varname = null;
    //Module.ccall('_Z13js_lua_stringPKc', 'void', ['string'], [s+""]);
    if (!js_lua_string) js_lua_string = Module.cwrap('_Z13js_lua_stringPKc', 'void', ['string']);
    js_lua_string(s || "");
  }

  this.pause = function() {
    if (loaded && running) {
      this.luacall('emu.pause()');
      running = false;
    }
  }

  this.resume = function() {
    if (loaded && !running) { // TODO
      this.luacall('emu.unpause()');
      running = true;
    }
  }

  this.reset = function() {
    this.luacall('manager:machine():soft_reset()');
    running = true;
    initluavars = false;
  }

  this.isRunning = function() {
    return running;
  }

  function bufferConsoleOutput(s) {
    if (!s) return;
    if (s.startsWith(">>>")) {
      console_varname = s.length > 3 ? s.slice(3) : null;
      if (console_varname) console_vars[console_varname] = [];
    } else if (console_varname) {
      console_vars[console_varname].push(s);
      if (console_varname == 'debug_stopped') {
        var debugSaveState = self.preserveState();
        self.pause();
        if (onBreakpointHit) {
          onBreakpointHit(debugSaveState);
        }
      }
    } else {
      console.log(s);
    }
  }

  this.startModule = function(mainElement, opts) {
    romfn = opts.romfn;
    if (opts.romdata) romdata = opts.romdata;
    if (!romdata) romdata = new RAM(opts.romsize).mem;
    // create canvas
    video = new RasterVideo(mainElement, opts.width, opts.height);
    video.create();
    $(video.canvas).attr('id','canvas');
    // load asm.js module
    console.log("loading", opts.jsfile);
    window.JSMESS = {};
    window.Module = {
      arguments: [opts.driver,
        '-debug',
        '-debugger', 'none',
        '-verbose', '-window', '-nokeepaspect',
        '-resolution', canvas.width+'x'+canvas.height,
        '-cart', romfn],
      screenIsReadOnly: true,
      print: bufferConsoleOutput,
      canvas:video.canvas,
      doNotCaptureKeyboard:true,
      keyboardListeningElement:video.canvas,
      preInit: function () {
        console.log("loading FS");
        ENV.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT = 'canvas';
        if (opts.cfgfile) {
          FS.mkdir('/cfg');
          FS.writeFile('/cfg/' + opts.cfgfile, opts.cfgdata, {encoding:'utf8'});
        }
        if (opts.biosfile) {
          FS.mkdir('/roms');
          FS.mkdir('/roms/' + opts.driver);
          FS.writeFile('/roms/' + opts.biosfile, opts.biosdata, {encoding:'binary'});
        }
        FS.mkdir('/emulator');
        if (romfn)
          FS.writeFile(romfn, romdata, {encoding:'binary'});
        //FS.writeFile('/debug.ini', 'debugger none\n', {encoding:'utf8'});
        if (opts.preInit) {
          opts.preInit(self);
        }
      },
      preRun: [
        function() {
          $(video.canvas).click(function(e) {
            video.canvas.focus();
          });
          loaded = true;
          console.log("about to run...");
        }
      ]
    };
    // preload files
    // TODO: ensure loaded
    var fetch_cfg, fetch_lua;
    var fetch_bios = $.Deferred();
    var fetch_wasm = $.Deferred();
    // fetch config file
    if (opts.cfgfile) {
      fetch_cfg = $.get('mame/cfg/' + opts.cfgfile, function(data) {
        opts.cfgdata = data;
        console.log("loaded " + opts.cfgfile);
      }, 'text');
    }
    // fetch BIOS file
    if (opts.biosfile) {
      var oReq1 = new XMLHttpRequest();
      oReq1.open("GET", 'mame/roms/' + opts.biosfile, true);
      oReq1.responseType = "arraybuffer";
      oReq1.onload = function(oEvent) {
        opts.biosdata = new Uint8Array(oReq1.response);
        console.log("loaded " + opts.biosfile + " (" + oEvent.total + " bytes)");
        fetch_bios.resolve();
      };
      oReq1.send();
    } else {
      fetch_bios.resolve();
    }
    // load debugger Lua script
    fetch_lua = $.get('mame/debugger.lua', function(data) {
      luadebugscript = data;
      console.log("loaded debugger.lua");
    }, 'text');
    // load WASM
    {
      var oReq2 = new XMLHttpRequest();
      oReq2.open("GET", 'mame/' + opts.jsfile.replace('.js','.wasm'), true);
      oReq2.responseType = "arraybuffer";
      oReq2.onload = function(oEvent) {
        console.log("loaded WASM file");
        window.Module.wasmBinary = new Uint8Array(oReq2.response);
        fetch_wasm.resolve();
      };
      oReq2.send();
    }
    // start loading script
    $.when(fetch_lua, fetch_cfg, fetch_bios, fetch_wasm).done(function() {
      var script = document.createElement('script');
      script.src = 'mame/' + opts.jsfile;
      document.getElementsByTagName('head')[0].appendChild(script);
      console.log("created script element");
    });
  }

  this.loadROMFile = function(data) {
    romdata = data;
    if (romfn) {
      FS.writeFile(romfn, data, {encoding:'binary'});
    }
  }

  this.loadRegion = function(region, data) {
    if (loaded) {
      //self.luacall('cart=manager:machine().images["cart"]\nprint(cart:filename())\ncart:load("' + romfn + '")\n');
      var s = 'rgn = manager:machine():memory().regions["' + region + '"]\n';
      //s += 'print(rgn.size)\n';
      for (var i=0; i<data.length; i+=4) {
        var v = data[i] + (data[i+1]<<8) + (data[i+2]<<16) + (data[i+3]<<24);
        s += 'rgn:write_u32(' + i + ',' + v + ')\n'; // TODO: endian?
      }
      self.luacall(s);
      self.reset();
    }
  }

  this.preserveState = function() {
    var state = {c:{}};
    for (var k in console_vars) {
      if (k.startsWith("cpu_")) {
        var v = parseInt(console_vars[k][0]);
        state.c[k.slice(4)] = v;
      }
    }
    // TODO: memory?
    return state;
  }

  this.saveState = function() {
    this.luareset();
    this.luacall('mamedbg.printstate()');
    return self.preserveState();
  }

  this.initlua = function() {
    if (!initluavars) {
      self.luacall(luadebugscript);
      self.luacall('mamedbg.init()')
      initluavars = true;
    }
  }

  this.readAddress = function(a) {
    self.initlua();
    self.luacall('print(">>>v"); print(mem:read_u8(' + a + '))');
    return parseInt(console_vars.v[0]);
  }

  // DEBUGGING SUPPORT

  var onBreakpointHit;

  this.clearDebug = function() {
    onBreakpointHit = null;
  }
  this.getDebugCallback = function() {
    return onBreakpointHit;
  }
  this.setupDebug = function(callback) {
    self.initlua();
    self.luareset();
    onBreakpointHit = callback;
  }
  this.runToPC = function(pc) {
    self.luacall('mamedbg.runTo(' + pc + ')');
    self.resume();
  }
  this.runToVsync = function() {
    self.luacall('mamedbg.runToVsync()');
    self.resume();
  }
  this.runUntilReturn = function() {
    self.luacall('mamedbg.runUntilReturn()');
    self.resume();
  }
  this.step = function() {
    self.luacall('mamedbg.step()');
    self.resume();
  }
  // TODO: other than z80
  this.cpuStateToLongString = function(c) {
    if (c.HL)
      return cpuStateToLongString_Z80(c);
    else
      return null; // TODO
  }

}
