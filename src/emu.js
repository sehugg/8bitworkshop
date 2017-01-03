"use strict";

// Emulator classes

var RasterVideo = function(mainElement, width, height, options) {
  var self = this;
  var canvas, ctx;
  var imageData, buf8, datau32;

  this.start = function() {
    // TODO
    fsElement = document.createElement('div');
    fsElement.style.position = "relative";
    fsElement.style.padding = "50px";
    //fsElement.style.width = "100%";
    //fsElement.style.height = "100%";
    fsElement.style.overflow = "hidden";
    fsElement.style.background = "black";

    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    fsElement.appendChild(canvas);
    mainElement.appendChild(fsElement);

    ctx = canvas.getContext('2d');
    imageData = ctx.createImageData(width, height);
    var buf = new ArrayBuffer(imageData.data.length);
    buf8 = new Uint8ClampedArray(buf);
    datau32 = new Uint32Array(buf);
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
    // TODO
    var fsElement = document.createElement('div');
    fsElement.style.position = "relative";
    fsElement.style.padding = "20px";
    fsElement.style.overflow = "hidden";
    fsElement.style.background = "black";

    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.tabIndex = "-1";               // Make it focusable

    fsElement.appendChild(canvas);
    mainElement.appendChild(fsElement);

    ctx = canvas.getContext('2d');
  }

  this.setKeyboardEvents = function(callback) {
    canvas.onkeydown = function(e) {
      callback(e.key, 1);
    };
    canvas.onkeyup = function(e) {
      callback(e.key, 0);
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

var SampleAudio = function(clockfreq) {

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
