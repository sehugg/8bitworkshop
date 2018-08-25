"use strict";

import { Platform } from "../baseplatform";
import { PLATFORMS, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap } from "../emu";
import { SampleAudio } from "../audio";

var VERILOG_PRESETS = [
  {id:'clock_divider.v', name:'Clock Divider'},
  {id:'hvsync_generator.v', name:'Video Sync Generator'},
  {id:'test_hvsync.v', name:'Test Pattern'},
  {id:'7segment.v', name:'7-Segment Decoder'},
  {id:'digits10.v', name:'Bitmapped Digits'},
  {id:'scoreboard.v', name:'Scoreboard'},
  {id:'ball_absolute.v', name:'Ball Motion (absolute position)'},
  {id:'ball_slip_counter.v', name:'Ball Motion (slipping counter)'},
  {id:'ball_paddle.v', name:'Brick Smash Game'},
  {id:'ram1.v', name:'RAM Text Display'},
  {id:'switches.v', name:'Switch Inputs'},
  {id:'paddles.v', name:'Paddle Inputs'},
  {id:'sprite_bitmap.v', name:'Sprite Bitmaps'},
  {id:'sprite_renderer.v', name:'Sprite Rendering'},
  {id:'racing_game.v', name:'Racing Game'},
  {id:'sprite_rotation.v', name:'Sprite Rotation'},
  {id:'tank.v', name:'Tank Game'},
  {id:'sound_generator.v', name:'Sound Generator'},
  {id:'lfsr.v', name:'Linear Feedback Shift Register'},
  {id:'starfield.v', name:'Scrolling Starfield'},
  {id:'cpu8.v', name:'Simple 8-Bit CPU'},
  {id:'racing_game_cpu.v', name:'Racing Game with CPU'},
  {id:'framebuffer.v', name:'Frame Buffer'},
  {id:'tile_renderer.v', name:'Tile Renderer'},
  {id:'sprite_scanline_renderer.v', name:'Sprite Scanline Renderer'},
  {id:'cpu16.v', name:'16-Bit CPU'},
  {id:'cpu_platform.v', name:'CPU Platform'},
  {id:'test2.asm', name:'16-bit ASM Game'},
];

var VERILOG_KEYCODE_MAP = makeKeycodeMap([
  [Keys.VK_LEFT, 0, 0x1],
  [Keys.VK_RIGHT, 0, 0x2],
  [Keys.VK_UP, 0, 0x4],
  [Keys.VK_DOWN, 0, 0x8],
  [Keys.VK_SPACE, 0, 0x10],
  [Keys.VK_SHIFT, 0, 0x20],
  [Keys.VK_A, 1, 0x1],
  [Keys.VK_D, 1, 0x2],
  [Keys.VK_W, 1, 0x4],
  [Keys.VK_S, 1, 0x8],
  [Keys.VK_Z, 1, 0x10],
  [Keys.VK_X, 1, 0x20],
  [Keys.VK_1, 2, 0x1],
  [Keys.VK_2, 2, 0x2],
  [Keys.VK_5, 2, 0x4],
  [Keys.VK_6, 2, 0x8],
  [Keys.VK_7, 2, 0x10],
]);

var vl_finished = false;
var vl_stopped = false;

// TODO: these have to be global

  var VL_UL = this.VL_UL = function(x) { return x|0; }
  var VL_ULL = this.VL_ULL = function(x) { return x|0; }
  var VL_TIME_Q = this.VL_TIME_Q = function() { return (new Date().getTime())|0; }

  /// Return true if data[bit] set
  var VL_BITISSET_I = this.VL_BITISSET_I = function(data,bit) { return (data & (VL_UL(1)<<VL_UL(bit))); }

  var VL_EXTENDSIGN_I = this.VL_EXTENDSIGN_I = function(lbits, lhs) { return (-((lhs)&(VL_UL(1)<<(lbits-1)))); }

  var VL_EXTEND_II = this.VL_EXTEND_II = function(obits,lbits,lhs) { return lhs; }

  var VL_EXTENDS_II = this.VL_EXTENDS_II = function(x,lbits,lhs) {
    return VL_EXTENDSIGN_I(lbits,lhs) | lhs;
  }

  var VL_EXTEND_II = this.VL_EXTEND_II = function(obits,lbits,lhs) { return lhs; }

  var VL_NEGATE_I = this.VL_NEGATE_I = function(x) { return -x; }

  var VL_LTS_III = this.VL_LTS_III = function(x,lbits,y,lhs,rhs) {
    return (VL_EXTENDS_II(x,lbits,lhs) < VL_EXTENDS_II(x,lbits,rhs)) ? 1 : 0; }

  var VL_GTS_III = this.VL_GTS_III = function(x,lbits,y,lhs,rhs) {
    return (VL_EXTENDS_II(x,lbits,lhs) > VL_EXTENDS_II(x,lbits,rhs)) ? 1 : 0; }

  var VL_LTES_III = this.VL_LTES_III = function(x,lbits,y,lhs,rhs) {
    return (VL_EXTENDS_II(x,lbits,lhs) <= VL_EXTENDS_II(x,lbits,rhs)) ? 1 : 0; }

  var VL_GTES_III = this.VL_GTES_III = function(x,lbits,y,lhs,rhs) {
    return (VL_EXTENDS_II(x,lbits,lhs) >= VL_EXTENDS_II(x,lbits,rhs)) ? 1 : 0; }

  var VL_MODDIV_III = this.VL_MODDIV_III = function(lbits,lhs,rhs) {
    return (((rhs)==0)?0:(lhs)%(rhs)); }

  var VL_MODDIVS_III = this.VL_MODDIVS_III = function(lbits,lhs,rhs) {
    return (((rhs)==0)?0:(lhs)%(rhs)); }

  var VL_REDXOR_32 = this.VL_REDXOR_32 = function(r) {
    r=(r^(r>>1)); r=(r^(r>>2)); r=(r^(r>>4)); r=(r^(r>>8)); r=(r^(r>>16));
    return r;
  }

  var VL_WRITEF = this.VL_WRITEF = console.log; // TODO: $write

  var vl_finish = this.vl_finish = function(filename,lineno,hier) {
    console.log("Finished at " + filename + ":" + lineno, hier);
    vl_finished = true;
  }
  var vl_stop = this.vl_stop = function(filename,lineno,hier) {
    console.log("Stopped at " + filename + ":" + lineno, hier);
    vl_stopped = true;
  }

  var VL_RAND_RESET_I = this.VL_RAND_RESET_I = function(bits) { return 0 | Math.floor(Math.random() * (1<<bits)); }

  var VL_RANDOM_I = this.VL_RANDOM_I = function(bits) { return 0 | Math.floor(Math.random() * (1<<bits)); }

//

function VerilatorBase() {

  //

  var totalTicks = 0;

  function vl_fatal(msg) {
    console.log(msg);
  }

  this.ticks = function() { return totalTicks; }
  this.setTicks = function(T) { totalTicks = T|0; }

  this.__reset = function() {
    if (this.reset !== undefined) {
      totalTicks = 0;
      this.reset = 0;
      this.tick2();
      this.reset = 1;
    }
  }

  this.__unreset = function() {
    if (this.reset !== undefined) {
      this.reset = 0;
    }
  }

  this.tick2 = function() {
    this.clk = 0;
    this.eval();
    this.clk = 1;
    this.eval();
  }

  var vlSymsp = this; //{TOPp:this};
  var maxVclockLoop = 1;

  this.eval = function() {
    // Initialize
    if (!vlSymsp.__Vm_didInit)
      this._eval_initial_loop(vlSymsp);
    // Evaluate till stable
    //VL_DEBUG_IF(VL_PRINTF("\n----TOP Evaluate Vmain::eval\n"); );
    var __VclockLoop = 0;
    var __Vchange=1;
    while (__Vchange) {
        //VL_DEBUG_IF(VL_PRINTF(" Clock loop\n"););
        vlSymsp.__Vm_activity = true;
        this._eval(vlSymsp);
        __Vchange = this._change_request(vlSymsp);
        if (++__VclockLoop > 100) { vl_fatal("Verilated model didn't converge"); }
    }
    if (__VclockLoop > maxVclockLoop) {
      maxVclockLoop = __VclockLoop;
      console.log("Graph took " + maxVclockLoop + " iterations to stabilize");
    }
    totalTicks++;
  }

  this._eval_initial_loop = function(vlSymsp) {
    vlSymsp.TOPp = this;
    vlSymsp.__Vm_didInit = true;
    this._eval_initial(vlSymsp);
    vlSymsp.__Vm_activity = true;
    var __VclockLoop = 0;
    var __Vchange=1;
    while (__Vchange) {
        this._eval_settle(vlSymsp);
        this._eval(vlSymsp);
        __Vchange = this._change_request(vlSymsp);
        if (++__VclockLoop > 100) { vl_fatal("Verilated model didn't DC converge"); }
    }
  }
}

var VerilogPlatform = function(mainElement, options) {
  var self = this;
  var video, audio;
  var useAudio = false;
  var videoWidth  = 292;
  var videoHeight = 256;
  var maxVideoLines = 262+40; // vertical hold
  var idata, timer, timerCallback;
  var gen;
  var cyclesPerFrame = (256+23+7+23)*262; // 4857480/60 Hz
  var current_output;
  var paddle_x = 0;
  var paddle_y = 0;
  var switches = [0,0,0];
  var inspect_obj, inspect_sym;
  var inspect_data = new Uint32Array(videoWidth * videoHeight);
  var scope_time_x = 0; // scope cursor
  var scope_x_offset = 0;
  var scope_y_offset = 0;
  var scope_index_offset = 0;
  var scope_max_y = 0;
  var scope_y_top = 0;
  var scope_a = 0; // used for transitions
  var scopeWidth = videoWidth;
  var scopeHeight = videoHeight;
  var scopeImageData;
  var sdata; // scope data
  var module_name;

  var yposlist = [];
  var lasty = [];
  var lastval = [];
  var trace_ports;
  var trace_signals;
  var trace_buffer;
  var trace_index;
  var mouse_pressed;
  var dirty = false;

  this.getPresets = function() { return VERILOG_PRESETS; }

  var RGBLOOKUP = [
    0xff222222,
    0xff2222ff,
    0xff22ff22,
    0xff22ffff,
    0xffff2222,
    0xffff22ff,
    0xffffff22,
    0xffffffff,
    0xff999999,
    0xff9999ff,
    0xff99ff99,
    0xff99ffff,
    0xffff9999,
    0xffff99ff,
    0xffffff99,
    0xff666666,
  ];

  var debugCond;

  function vidtick() {
    gen.tick2();
    if (useAudio)
      audio.feedSample(gen.spkr*(1.0/255.0), 1);
    if (debugCond && debugCond())
      debugCond = null;
  }

  function updateInspectionFrame() {
    useAudio = false;
    if (inspect_obj && inspect_sym) {
      var COLOR_BIT_OFF = 0xffff6666;
      var COLOR_BIT_ON  = 0xffff9999;
      var i = videoWidth;
      for (var y=0; y<videoHeight-2; y++) {
        for (var x=0; x<videoWidth; x++) {
          var val = inspect_data[i];
          idata[i++] = (val & 1) ? COLOR_BIT_ON : COLOR_BIT_OFF;
        }
      }
    }
  }

  function updateInspectionPostFrame() {
    if (inspect_obj && inspect_sym) {
      var ctx = video.getContext();
      var val = inspect_data[inspect_data.length-1];
      ctx.fillStyle = "black";
      ctx.fillRect(18, videoHeight-8, 30, 8);
      ctx.fillStyle = "white";
      ctx.fillText(val.toString(10), 20, videoHeight-1);
    }
  }

  var framex=0;
  var framey=0;
  var frameidx=0;
  var framehsync=false;
  var framevsync=false;

  function updateVideoFrameCycles(ncycles, sync, trace) {
    ncycles |= 0;
    var inspect = inspect_obj && inspect_sym;
    while (ncycles--) {
      if (trace) snapshotTrace(true);
      vidtick();
      if (framex++ < videoWidth) {
        if (framey < videoHeight) {
          if (inspect) {
            inspect_data[frameidx] = inspect_obj[inspect_sym];
          }
          idata[frameidx] = RGBLOOKUP[gen.rgb & 15];
          frameidx++;
        }
      } else if (!framehsync && gen.hsync) {
        framehsync = true;
      } else if ((framehsync && !gen.hsync) || framex > videoWidth*2) {
        framehsync = false;
        framex = 0;
        framey++;
        gen.hpaddle = framey > paddle_x ? 1 : 0;
        gen.vpaddle = framey > paddle_y ? 1 : 0;
      }
      if (framey > maxVideoLines || gen.vsync) {
        framevsync = true;
        framey = 0;
        framex = 0;
        frameidx = 0;
        gen.hpaddle = 0;
        gen.vpaddle = 0;
      } else {
        var wasvsync = framevsync;
        framevsync = false;
        if (sync && wasvsync) return; // exit when vsync ends
      }
    }
  }

  function updateVideoFrame() {
    useAudio = (audio != null);
    debugCond = self.getDebugCallback();
    gen.switches_p1 = switches[0];
    gen.switches_p2 = switches[1];
    gen.switches_gen = switches[2];
    var fps = self.getFrameRate();
    // darken the previous frame?
    if (fps < 45) {
      var mask = fps > 5 ? 0xe7ffffff : 0x7fdddddd;
      for (var i=0; i<idata.length; i++)
        idata[i] &= mask;
    }
    // paint into frame, synched with vsync if full speed
    var sync = fps > 45;
    var trace = fps < 0.02;
    updateVideoFrameCycles(cyclesPerFrame * fps/60 + 1, sync, trace);
    //if (trace) displayTraceBuffer();
    self.restartDebugState();
    gen.__unreset();
    refreshVideoFrame();
  }
  
  function refreshVideoFrame() {
    updateInspectionFrame();
    updateAnimateScope();
    updateInspectionPostFrame();
  }

  function updateFrame() {
    if (!gen) return;
    if (gen.vsync !== undefined && gen.hsync !== undefined && gen.rgb !== undefined)
      updateVideoFrame();
    else
      updateScopeFrame();
  }

  function refreshFrame() {
    if (!gen) return;
    if (gen.vsync !== undefined && gen.hsync !== undefined && gen.rgb !== undefined)
      refreshVideoFrame();
    else
      refreshScopeOverlay(trace_ports);
  }

  function updateAnimateScope() {
    var fps = self.getFrameRate();
    var trace = fps < 0.02;
    var ctx = video.getContext();
    if (scope_a > 0.01) {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, videoWidth, videoHeight);
      var vidyoffset = Math.round(scope_a*(-framey+videoHeight/6));
      video.updateFrame(0, vidyoffset, 0, 0, videoWidth, videoHeight);
      ctx.fillStyle = "white";
      ctx.fillRect(framex, framey+vidyoffset, 1, 1);
      scope_index_offset = (trace_index - trace_signals.length*scopeWidth + trace_buffer.length) % trace_buffer.length;
      scope_x_offset = 0;
      refreshScopeOverlay(trace_signals);
    } else {
      video.updateFrame();
      scope_index_offset = 0;
    }
    // smooth transition
    scope_a = scope_a * 0.9 + (trace?1.0:0.0) * 0.1;
    scope_y_top = (1 - scope_a*0.7) * videoHeight - (1 - scope_a) * scope_y_offset;
  }

  function displayTraceBuffer() {
    var skip = trace_signals.length;
    var src = trace_index;
    for (var dest=0; dest<idata.length; dest+=videoWidth) {
      for (var i=0; i<skip; i++) {
        if (--src < 0) src = trace_buffer.length-1;
        var v = trace_buffer[src];
        idata[dest+i] = RGBLOOKUP[v & 15]; // TODO?
      }
    }
  }

  function snapshotTrace(signals) {
    var arr = signals ? trace_signals : trace_ports;
    for (var i=0; i<arr.length; i++) {
      var v = arr[i];
      var z = gen[v.name];
      trace_buffer[trace_index++] = z;
      if (trace_index >= trace_buffer.length) trace_index = 0;
    }
  }

  function fillTraceBuffer(count) {
    var max_index = Math.min(trace_buffer.length - trace_ports.length, trace_index + count);
    while (trace_index < max_index) {
      gen.clk ^= 1;
      gen.eval();
      snapshotTrace(false);
      dirty = true;
    }
    gen.__unreset();
  }

  function shadowText(ctx, txt, x, y) {
    ctx.shadowColor = "black";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = -1;
    ctx.shadowOffsetX = 0;
    ctx.fillText(txt, x, y);
    ctx.shadowOffsetY = 1;
    ctx.shadowOffsetX = 0;
    ctx.fillText(txt, x, y);
    ctx.shadowOffsetY = 0;
    ctx.shadowOffsetX = -1;
    ctx.fillText(txt, x, y);
    ctx.shadowOffsetY = 0;
    ctx.shadowOffsetX = 1;
    ctx.fillText(txt, x, y);
    ctx.shadowOffsetX = 0;
  }

  function updateScopeFrame() {
    fillTraceBuffer(Math.floor(videoWidth/4) * trace_ports.length);
    if (!dirty) return;
    dirty = false;
    scope_y_top = 0;
    refreshScopeOverlay(trace_ports);
  }

  function refreshScopeOverlay(arr) {
    if (!sdata) {
      scopeImageData = video.getContext().createImageData(scopeWidth,scopeHeight);
      sdata = new Uint32Array(scopeImageData.data.buffer);
    }
    var COLOR_BLACK  = 0xff000000;
    var COLOR_SIGNAL = 0xff22ff22;
    var COLOR_BORDER = 0xff662222;
    var COLOR_TRANS_SIGNAL = 0xff226622;
    var COLOR_BLIP_SIGNAL = 0xff226622;
    sdata.fill(0xff000000);
    var jstart = scope_x_offset * arr.length + scope_index_offset;
    var j = jstart;
    for (var x=0; x<scopeWidth; x++) {
      var yb = 8;
      var y1 = scope_y_offset;
      for (var i=0; i<arr.length; i++) {
        var v = arr[i];
        var lo = 0; // TODO? v.ofs?
        var hi = ((1 << v.len)-1);
        var ys = hi>1 ? v.len*2+8 : 8;
        var y2 = y1+ys;
        var z = trace_buffer[j++];
        if (j >= trace_buffer.length) j = 0;
        var y = Math.round(y2 - ys*((z-lo)/hi));
        yposlist[i] = y2 + scope_y_top;
        var ly = lasty[i];
        if (x > 0 && ly != y) {
          var dir = ly < y ? 1 : -1;
          while ((ly += dir) != y && ly >= y1 && ly <= y2) {
            sdata[x + ly * scopeWidth] = COLOR_TRANS_SIGNAL;
          }
        }
        sdata[x + y * scopeWidth] = lastval[i]==z ? COLOR_SIGNAL : COLOR_BLIP_SIGNAL;
        lasty[i] = y;
        lastval[i] = z;
        y1 += ys+yb;
      }
    }
    scope_max_y = y1 - scope_y_offset;
    video.getContext().putImageData(scopeImageData, 0, scope_y_top);
    // draw labels
    var ctx = video.getContext();
    for (var i=0; i<arr.length; i++) {
      var yp = yposlist[i];
      if (yp < 20 || yp > videoHeight) continue;
      var v = arr[i];
      var name = v.name;
      ctx.fillStyle = name == inspect_sym ? "yellow" : "white";
      name = name.replace(/__DOT__/g,'.');
      name = name.replace(module_name+'.','');
      ctx.textAlign = 'left';
      ctx.fillStyle = "white";
      shadowText(ctx, name, 1, yposlist[i]);
      if (scope_time_x > 0) {
        ctx.textAlign = 'right';
        var value = (arr.length * scope_time_x + i + jstart) % trace_buffer.length;
        shadowText(ctx, ""+trace_buffer[value], videoWidth-1, yp);
      }
    }
    // draw scope line & label
    if (scope_time_x > 0) {
      ctx.fillStyle = "cyan";
      shadowText(ctx, ""+(scope_time_x+scope_x_offset),
        (scope_time_x>10)?(scope_time_x-2):(scope_time_x+20), videoHeight-2);
      ctx.fillRect(scope_time_x, 0, 1, 4000);
    }
    // scroll left/right
    if (scope_time_x >= videoWidth && scope_x_offset < (trace_buffer.length / arr.length) - videoWidth) {
      scope_x_offset += 1 + (scope_time_x - videoWidth);
      dirty = true;
    }
    else if (scope_time_x < 0 && scope_x_offset > 0) {
      scope_x_offset = Math.max(0, scope_x_offset + scope_time_x);
      dirty = true;
    }
  }

  function clamp(minv,maxv,v) {
    return (v < minv) ? minv : (v > maxv) ? maxv : v;
  }

  this.start = function() {
    video = new RasterVideo(mainElement,videoWidth,videoHeight);
    video.create();
    var ctx = video.getContext();
    ctx.font = "8px TinyFont";
    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    setKeyboardFromMap(video, switches, VERILOG_KEYCODE_MAP);
    var vcanvas = $(video.canvas);
		vcanvas.mousemove(function(e) {
      var new_x = Math.floor(e.offsetX * video.canvas.width / vcanvas.width() - 20);
      var new_y = Math.floor(e.offsetY * video.canvas.height / vcanvas.height() - 20);
      if (mouse_pressed) {
        scope_y_offset = clamp(Math.min(0,-scope_max_y+videoHeight), 0, scope_y_offset + new_y - paddle_y);
  			scope_time_x = Math.floor(e.offsetX * video.canvas.width / vcanvas.width() - 16);
  			dirty = true;
        refreshFrame();
      }
			paddle_x = clamp(8, 240, new_x);
			paddle_y = clamp(8, 240, new_y);
		});
		vcanvas.mousedown(function(e) {
			scope_time_x = Math.floor(e.offsetX * video.canvas.width / vcanvas.width() - 16);
      mouse_pressed = true;
      //if (e.target.setCapture) e.target.setCapture(); // TODO: pointer capture
			dirty = true;
      refreshFrame();
		});
		vcanvas.mouseup(function(e) {
      mouse_pressed = false;
      //if (e.target.setCapture) e.target.releaseCapture(); // TODO: pointer capture
  		dirty = true;
      refreshFrame();
		});
		vcanvas.keydown(function(e) {
      switch (e.keyCode) {
        case 37: scope_time_x--; dirty=true; refreshFrame(); break;
        case 39: scope_time_x++; dirty=true; refreshFrame(); break;
      }
		});
    idata = video.getFrameData();
    timerCallback = function() {
			if (!self.isRunning())
				return;
      gen.switches = switches[0];
      updateFrame();
    };
    trace_buffer = new Uint32Array(0x10000);
    self.setFrameRate(60);
  }
  
  this.printErrorCodeContext = function(e, code) {
    if (e.lineNumber && e.message) {
      var lines = code.split('\n');
      var s = e.message + '\n';
      for (var i=0; i<lines.length; i++) {
        if (i > e.lineNumber-5 && i < e.lineNumber+5) {
          s += lines[i] + '\n';
        }
      }
      console.log(s);
    }
  }

  this.loadROM = function(title, output) {
    var mod;
    if (output.code) {
      // is code identical?
      if (current_output && current_output.code == output.code) {
      } else {
        try {
          mod = new Function('base', output.code);
        } catch (e) {
          this.printErrorCodeContext(e, output.code);
          throw e;
        }
        // compile Verilog code
        var base = new VerilatorBase();
        gen = new mod(base);
        //$.extend(gen, base);
        gen.__proto__ = base;
        current_output = output;
        module_name = output.name ? output.name.substr(1) : "top";
        trace_ports = current_output.ports;
        trace_signals = current_output.ports.concat(current_output.signals);
        trace_index = 0;
        // power on module
        this.poweron();
      }
    }
    // replace program ROM, if using the assembler
    if (output.program_rom && output.program_rom_variable) {
      if (gen[output.program_rom_variable]) {
        if (gen[output.program_rom_variable].length != output.program_rom.length)
          alert("ROM size mismatch -- expected " + gen[output.program_rom_variable].length + " got " + output.program_rom.length);
        else
          gen[output.program_rom_variable] = output.program_rom;
      } else {
        alert("No program_rom variable found (" + output.program_rom_variable + ")");
      }
      this.reset();
    }
    // restart audio
    restartAudio();
  }

  function restartAudio() {
    // stop/start audio
    var hasAudio = gen && gen.spkr !== undefined && frameRate > 1;
    if (audio && !hasAudio) {
      audio.stop();
      audio = null;
    } else if (!audio && hasAudio) {
      audio = new SampleAudio(cyclesPerFrame * self.getFrameRate());
      if (self.isRunning())
        audio.start();
    }
  }

  this.isRunning = function() {
    return timer && timer.isRunning();
  }
  this.pause = function() {
    timer.stop();
    if (audio) audio.stop();
  }
  this.resume = function() {
    timer.start();
    if (audio) audio.start();
  }

  var frameRate = 0;

  this.setFrameRate = function(rateHz) {
    frameRate = rateHz;
    var fps = Math.min(60, rateHz*cyclesPerFrame);
    if (!timer || timer.frameRate != fps) {
      var running = this.isRunning();
      if (timer) timer.stop();
      timer = new AnimationTimer(fps, timerCallback);
      if (running) timer.start();
    }
    if (audio) {
      audio.stop();
      audio = null;
    }
    restartAudio();
  }
  this.getFrameRate = function() { return frameRate; }

  this.poweron = function() {
    gen._ctor_var_reset();
    this.reset();
  }
  this.reset = function() {
    gen.__reset();
    trace_index = scope_x_offset = 0;
    if (trace_buffer) trace_buffer.fill(0);
    dirty = true;
    if (video) video.setRotate(gen.rotate ? -90 : 0);
  }
  this.tick = function() {
    gen.tick2();
  }
  this.getToolForFilename = function(fn) {
    if (fn.endsWith("asm"))
      return "jsasm";
    else
      return "verilator";
  }
  this.getDefaultExtension = function() { return ".v"; };

  this.inspect = function(name) {
    if (!gen) return;
    if (name && !name.match(/^\w+$/)) return;
    var val = gen[name];
    if (val === undefined && current_output.code) {
      var re = new RegExp("(\\w+__DOT__" + name + ")\\b", "gm");
      var m = re.exec(current_output.code);
      if (m) {
        name = m[1];
        val = gen[name];
      }
    }
    if (typeof(val) === 'number') {
      inspect_obj = gen;
      inspect_sym = name;
    } else {
      inspect_obj = inspect_sym = null;
    }
    dirty = true;
  }

  // DEBUGGING

  this.saveState = function() {
    return {T:gen.ticks(), o:$.extend(true, {}, gen)};
  }
  this.loadState = function(state) {
    gen = $.extend(true, gen, state.o);
    gen.setTicks(state.T);
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
        debugTargetClock -= debugSavedState.T;
      debugSavedState.T = 0;
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
    console.log("Breakpoint at clk", debugBreakState.T);
    this.pause();
    if (onBreakpointHit) {
      onBreakpointHit(debugBreakState);
    }
  }
  this.wasBreakpointHit = function() {
    return debugBreakState != null;
  }
  this.step = function() {
    var self = this;
    this.setDebugCondition(function() {
      if (gen.ticks() > debugTargetClock) {
        self.breakpointHit(gen.ticks());
        return true;
      }
      return false;
    });
  }
  this.runToVsync = function() {
    var self = this;
    this.setDebugCondition(function() {
      if (gen.vsync && gen.ticks() > debugTargetClock+2000) {
        self.breakpointHit(gen.ticks());
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
      var debugClock = gen.ticks();
      if (debugClock >= debugTargetClock && prevState) {
        self.loadState(prevState);
        self.breakpointHit(prevClock);
        return true;
      } else if (debugClock >= debugTargetClock-2 && debugClock < debugTargetClock) {
        prevState = self.saveState();
        prevClock = debugClock;
      }
      return false;
    });
  }
  this.runEval = function(evalfunc) {
    var self = this;
    this.setDebugCondition(function() {
			if (gen.ticks() > debugTargetClock) {
        if (evalfunc(gen)) {
          self.breakpointHit(gen.ticks());
          return true;
        }
      }
			return false;
    });
  }

};

////////////////

PLATFORMS['verilog'] = VerilogPlatform;
