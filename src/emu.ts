"use strict";

import { hex } from "./util";

// external modules
declare var jt, Javatari, Z80_fast, CPU6809;

// Emulator classes

export var PLATFORMS = {};

export var frameUpdateFunction : (Canvas) => void = null;

var _random_state = 1;

export function noise() {
	let x = _random_state;
	x ^= x << 13;
	x ^= x >> 17;
	x ^= x << 5;
	return (_random_state = x) & 0xff;
}

export function getNoiseSeed() {
  return _random_state;
}

export function setNoiseSeed(x : number) {
  _random_state = x;
}

type KeyboardCallback = (which:number, charCode:number, flags:number) => void;

function __createCanvas(mainElement:HTMLElement, width:number, height:number) : HTMLElement {
  var canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.classList.add("emuvideo");
  canvas.tabIndex = -1;               // Make it focusable
  mainElement.appendChild(canvas);
  return canvas;
}

function _setKeyboardEvents(canvas:HTMLElement, callback:KeyboardCallback) {
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

export var RasterVideo = function(mainElement:HTMLElement, width:number, height:number, options?) {
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
    this.canvas = canvas = __createCanvas(mainElement, width, height);
    if (options && options.rotate) {
      this.setRotate(options.rotate);
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

  this.setKeyboardEvents = function(callback) {
    _setKeyboardEvents(canvas, callback);
  }

  this.getFrameData = function() { return datau32; }

  this.getContext = function() { return ctx; }

  this.updateFrame = function(sx:number, sy:number, dx:number, dy:number, width?:number, height?:number) {
    //imageData.data.set(buf8); // TODO: slow w/ partial updates
    if (width && height)
      ctx.putImageData(imageData, sx, sy, dx, dy, width, height);
    else
      ctx.putImageData(imageData, 0, 0);
    if (frameUpdateFunction) frameUpdateFunction(canvas);
  }
}

export var VectorVideo = function(mainElement:HTMLElement, width:number, height:number) {
  var self = this;
  var canvas, ctx;
  var persistenceAlpha = 0.5;
  var jitter = 1.0;
  var gamma = 0.8;
  var sx = width/1024.0;
  var sy = height/1024.0;

  this.create = function() {
    this.canvas = canvas = __createCanvas(mainElement, width, height);
    ctx = canvas.getContext('2d');
  }

  this.setKeyboardEvents = function(callback) {
    _setKeyboardEvents(canvas, callback);
  }

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

  this.drawLine = function(x1:number, y1:number, x2:number, y2:number, intensity:number, color:number) {
    //console.log(x1,y1,x2,y2,intensity,color);
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

export class RAM {
  mem : Uint8Array;
  constructor(size:number) {
    this.mem = new Uint8Array(new ArrayBuffer(size));
  }
}

export var AnimationTimer = function(frequencyHz:number, callback:() => void) {
  var intervalMsec = 1000.0 / frequencyHz;
  var running;
  var lastts = 0;
  var useReqAnimFrame = false; //window.requestAnimationFrame ? (frequencyHz>40) : false;
  var nframes, startts; // for FPS calc
  this.frameRate = frequencyHz;

  function scheduleFrame(msec:number) {
    if (useReqAnimFrame)
      window.requestAnimationFrame(nextFrame);
    else
      setTimeout(nextFrame, msec);
  }
  function nextFrame(ts:number) {
    if (!ts) ts = Date.now();
    if (ts - lastts < intervalMsec*10) {
      lastts += intervalMsec;
    } else {
      lastts = ts + intervalMsec; // frames skipped, catch up
    }
    if (running) {
      scheduleFrame(lastts - ts);
    }
    if (!useReqAnimFrame || lastts - ts > intervalMsec/2) {
      if (running) {
        try {
          callback();
        } catch (e) {
          running = false;
          throw e;
        }
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
      scheduleFrame(0);
    }
  }
  this.stop = function() {
    running = false;
  }
}

//

export function dumpRAM(ram:number[], ramofs:number, ramlen:number) : string {
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

export const Keys = {
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

export function setKeyboardFromMap(video, switches, map, func?) {
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

export function makeKeycodeMap(table) {
  var map = {};
  for (var i=0; i<table.length; i++) {
    var entry = table[i];
    map[entry[0].c] = {index:entry[1], mask:entry[2]};
  }
  return map;
}

export function padBytes(data, len) {
  if (data.length > len) {
    throw Error("Data too long, " + data.length + " > " + len);
  }
  var r = new RAM(len);
  r.mem.set(data);
  return r.mem;
}

type AddressReadWriteFn = ((a:number) => number) | ((a:number,v:number) => void);
type AddressDecoderEntry = [number, number, number, AddressReadWriteFn];
type AddressDecoderOptions = {gmask?:number};

// TODO: better performance, check values
export function AddressDecoder(table : AddressDecoderEntry[], options?:AddressDecoderOptions) {
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

export function newAddressDecoder(table : AddressDecoderEntry[], options?:AddressDecoderOptions) : (a:number,v?:number) => number {
  return new (AddressDecoder as any)(table, options);
}

// STACK DUMP

declare var addr2symbol;		// address to symbol name map (TODO: import)

function lookupSymbol(addr) {
  var start = addr;
  var foundsym;
  while (addr >= 0) {
    var sym = addr2symbol[addr];
    if (sym && sym.startsWith('_')) { // return first C symbol we find
      return addr2symbol[addr] + " + " + (start-addr);
    } else if (sym && !foundsym) { // cache first non-C symbol found
      foundsym = sym;
    }
    addr--;
  }
  return foundsym || "";
}

export function dumpStackToString(mem:number[], start:number, end:number, sp:number) : string {
  var s = "";
  var nraw = 0;
  //s = dumpRAM(mem.slice(start,start+end+1), start, end-start+1);
  while (sp < end) {
    sp++;
    // see if there's a JSR on the stack here
    // TODO: make work with roms and memory maps
    var addr = mem[sp] + mem[sp+1]*256;
    var opcode = mem[addr-2]; // might be out of bounds
    if (opcode == 0x20) { // JSR
      s += "\n$" + hex(sp) + ": ";
      s += hex(addr,4) + " " + lookupSymbol(addr);
      sp++;
      nraw = 0;
    } else {
      if (nraw == 0)
        s += "\n$" + hex(sp) + ": ";
      s += hex(mem[sp+1]) + " ";
      if (++nraw == 8) nraw = 0;
    }
  }
  return s+"\n";
}
