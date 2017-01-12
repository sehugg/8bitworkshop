"use strict";

// Emulator classes

function _metakeyflags(e) {
  return (e.shiftKey?2:0) | (e.ctrlKey?4:0) | (e.altKey?8:0) | (e.metaKey?16:0);
}

function __createCanvas(mainElement, width, height) {
  // TODO
  var fsElement = document.createElement('div');
  fsElement.style.position = "relative";
  fsElement.style.padding = "20px";
  fsElement.style.overflow = "hidden";
  fsElement.style.background = "black";

  var canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
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

  this.start = function() {
    canvas = __createCanvas(mainElement, width, height);
    ctx = canvas.getContext('2d');
    imageData = ctx.createImageData(width, height);
    var buf = new ArrayBuffer(imageData.data.length);
    buf8 = new Uint8ClampedArray(buf);
    datau32 = new Uint32Array(buf);
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

  this.getFrameData = function() {
    return datau32;
  }

  this.updateFrame = function() {
    imageData.data.set(buf8);
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

  this.start = function() {
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
    } else {
      self.context = new webkitAudioContext();
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
    debugTargetClock = 0;
    debugClock = 0;
    onBreakpointHit = null;
    debugCondition = null;
  }
  this.breakpointHit = function() {
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
            debugTargetClock = debugClock-1;
            self.breakpointHit();
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
        debugTargetClock = prevClock-1;
        self.breakpointHit();
        return true;
      } else if (debugClock > debugTargetClock-10 && debugClock < debugTargetClock) {
        if (self.getCPUState().T == 0) {
          console.log(debugClock, self.getCPUState());
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
          self.breakpointHit();
          debugTargetClock = debugClock-1;
          return true;
        } else {
          return false;
        }
      }
    });
  }
}
