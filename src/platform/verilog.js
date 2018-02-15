"use strict";

var VERILOG_PRESETS = [
  {id:'clock_divider.v', name:'Clock Divider'},
  {id:'hvsync_generator.v', name:'Video Sync Generator'},
  {id:'test_hvsync.v', name:'Test Pattern'},
  {id:'digits10.v', name:'Bitmapped Digits'},
  {id:'7segment.v', name:'7-Segment Decoder'},
  {id:'scoreboard.v', name:'Scoreboard'},
  {id:'ball_slip_counter.v', name:'Ball Motion (slipping counter)'},
  {id:'ball_paddle.v', name:'Brick Smash Game'},
  {id:'ram1.v', name:'RAM Text Display'},
  {id:'sprite_bitmap.v', name:'Sprite Bitmaps'},
  {id:'sprite_renderer.v', name:'Sprite Rendering'},
  {id:'sprite_multiple.v', name:'Multiple Sprites'},
  {id:'sprite_rotation.v', name:'Sprite Rotation'},
  {id:'tank.v', name:'Tank Game'},
  {id:'cpu8.v', name:'Simple 8-Bit CPU'},
  {id:'race_game_cpu.v', name:'Race Game With CPU'},
  {id:'music.v', name:'3-Voice Music'},
  {id:'lfsr.v', name:'Linear Feedback Shift Register'},
  {id:'starfield.v', name:'Scrolling Starfield'},
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

  var VL_UL = function(x) { return x|0; }
  var VL_ULL = function(x) { return x|0; }
  var VL_TIME_Q = function() { return (new Date().getTime())|0; }

  /// Return true if data[bit] set
  var VL_BITISSET_I = this.VL_BITISSET_I = function(data,bit) { return (data & (VL_UL(1)<<VL_BITBIT_I(bit))); }

  var VL_EXTENDSIGN_I = this.VL_EXTENDSIGN_I = function(lbits, lhs) { return (-((lhs)&(VL_UL(1)<<(lbits-1)))); }

  var VL_EXTEND_II = this.VL_EXTEND_II = function(obits,lbits,lhs) { return lhs; }

  var VL_EXTENDS_II = this.VL_EXTENDS_II = function(x,lbits,lhs) {
    return VL_EXTENDSIGN_I(lbits,lhs) | lhs;
  }

  var VL_EXTEND_II = this.VL_EXTEND_II = function(obits,lbits,lhs) { return lhs; }

  var VL_NEGATE_I = this.VL_NEGATE_I = function(x) { return -x; }

  var VL_LTS_III = this.VL_LTS_III = function(x,lbits,y,lhs,rhs) {
    return 0 | (VL_EXTENDS_II(x,lbits,lhs) < VL_EXTENDS_II(x,lbits,rhs)); }

  var VL_GTS_III = this.VL_GTS_III = function(x,lbits,y,lhs,rhs) {
    return 0 | (VL_EXTENDS_II(x,lbits,lhs) > VL_EXTENDS_II(x,lbits,rhs)); }

  var VL_LTES_III = this.VL_LTES_III = function(x,lbits,y,lhs,rhs) {
    return 0 | (VL_EXTENDS_II(x,lbits,lhs) <= VL_EXTENDS_II(x,lbits,rhs)); }

  var VL_GTES_III = this.VL_GTES_III = function(x,lbits,y,lhs,rhs) {
    return 0 | (VL_EXTENDS_II(x,lbits,lhs) >= VL_EXTENDS_II(x,lbits,rhs)); }

  var VL_MODDIV_III = this.VL_MODDIV_III = function(lbits,lhs,rhs) {
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
  var videoWidth  = 256+16;
  var videoHeight = 240+16;
  var maxVideoBlankLines = 80;
  var idata, timer;
  var gen;
  var frameRate = 60;
  var AUDIO_FREQ = (256+23+7+23)*262*60; // 4857480
  var current_output;
  var paddle_x = 0;
  var paddle_y = 0;
  var switches = [0,0,0];
  var inspect_obj, inspect_sym;
  var inspect_data = new Uint32Array(videoWidth * videoHeight);
  var scope_time_x = 0; // scope cursor
  var scope_x_offset = 0;
  var scope_y_offset = 0;
  var scope_max_y = 0;

  var yposlist = [];
  var lasty = [];
  var lastval = [];
  var ports_and_signals;
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
      var COLOR_BIT_OFF = 0xffff3333;
      var COLOR_BIT_ON  = 0xffffffff;
      for (var y=0; y<videoHeight; y++) {
        var val = inspect_data[y * videoWidth];
        var i = y * videoWidth + 16;
        do {
          idata[i] = (val & 1) ? COLOR_BIT_ON : COLOR_BIT_OFF;
          i -= 2;
          val >>= 1;
        } while (val != 0);
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

  function updateVideoFrame() {
    useAudio = gen.spkr !== 'undefined';
    debugCond = self.getDebugCallback();
    var i=videoWidth-10;
    var trace=inspect_obj && inspect_sym;
    gen.switches_p1 = switches[0];
    gen.switches_p2 = switches[1];
    gen.switches_gen = switches[2];
    for (var y=0; y<videoHeight; y++) {
      gen.hpaddle = y > paddle_x ? 1 : 0;
      gen.vpaddle = y > paddle_y ? 1 : 0;
      for (var x=0; x<videoWidth; x++) {
        vidtick();
        if (trace) {
          inspect_data[i] = inspect_obj[inspect_sym];
        }
        idata[i++] = RGBLOOKUP[gen.rgb & 7];
      }
      var z=0;
      while (!gen.hsync && z++<videoWidth) vidtick();
      while (gen.hsync && z++<videoWidth) vidtick();
    }
    var z=0;
    while (!gen.vsync && z++<videoWidth*maxVideoBlankLines) vidtick();
    while (gen.vsync && z++<videoWidth*maxVideoBlankLines) vidtick();
    updateInspectionFrame();
    video.updateFrame();
    updateInspectionPostFrame();
    self.restartDebugState();
    gen.__unreset();
  }

  function fillTraceBuffer(count) {
    var arr = ports_and_signals;
    var max_index = Math.min(trace_buffer.length, trace_index + count);
    while (trace_index < max_index) {
      gen.clk ^= 1;
      gen.eval();
      for (var i=0; i<arr.length; i++) {
        var v = arr[i];
        var z = gen[v.name];
        trace_buffer[trace_index++] = z;
      }
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
    var arr = ports_and_signals;
    if (!arr) return;
    fillTraceBuffer(Math.floor(videoWidth/4) * arr.length);
    if (!dirty) return;
    dirty = false;
    var COLOR_BLACK  = 0xff000000;
    var COLOR_SIGNAL = 0xff22ff22;
    var COLOR_BORDER = 0xff662222;
    var COLOR_TRANS_SIGNAL = 0xff226622;
    var COLOR_BLIP_SIGNAL = 0xff226622;
    idata.fill(COLOR_BLACK);
    var jstart = scope_x_offset * arr.length;
    var j = jstart;
    for (var x=0; x<videoWidth; x++) {
      var yb = 8;
      var y1 = scope_y_offset;
      for (var i=0; i<arr.length; i++) {
        var v = arr[i];
        var lo = 0; // TODO? v.ofs?
        var hi = v.len ? ((2 << v.len)-1) : 1;
        var ys = hi>1 ? v.len*2+8 : 8;
        var y2 = y1+ys;
        var z = trace_buffer[j++];
        var y = Math.round(y2 - ys*((z-lo)/hi));
        yposlist[i] = y2;
        var ly = lasty[i];
        if (x > 0 && ly != y) {
          var dir = ly < y ? 1 : -1;
          while ((ly += dir) != y && ly >= y1 && ly <= y2) {
            idata[x + ly*videoWidth] = COLOR_TRANS_SIGNAL;
          }
        }
        idata[x + y*videoWidth] = lastval[i]==z ? COLOR_SIGNAL : COLOR_BLIP_SIGNAL;
        lasty[i] = y;
        lastval[i] = z;
        y1 += ys+yb;
      }
    }
    scope_max_y = y1 - scope_y_offset;
    video.updateFrame();
    // draw labels
    var ctx = video.getContext();
    for (var i=0; i<arr.length; i++) {
      var v = arr[i];
      var name = v.name;
      ctx.fillStyle = name == inspect_sym ? "yellow" : "white";
      name = name.replace(/__DOT__/g,'.');
      ctx.textAlign = 'left';
      ctx.fillStyle = "white";
      shadowText(ctx, name, 1, yposlist[i]);
      if (scope_time_x > 0) {
        ctx.textAlign = 'right';
        var value = arr.length * scope_time_x + i + jstart;
        shadowText(ctx, ""+trace_buffer[value], videoWidth-1, yposlist[i]);
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
    // TODO
    video = new RasterVideo(mainElement,videoWidth,videoHeight);
    video.create();
    var ctx = video.getContext();
    ctx.font = "8px TinyFont";
    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    setKeyboardFromMap(video, switches, VERILOG_KEYCODE_MAP);
		$(video.canvas).mousemove(function(e) {
      var new_x = Math.floor(e.offsetX * video.canvas.width / $(video.canvas).width() - 20);
      var new_y = Math.floor(e.offsetY * video.canvas.height / $(video.canvas).height() - 20);
      if (mouse_pressed) {
        scope_y_offset = clamp(Math.min(0,-scope_max_y+videoHeight), 0, scope_y_offset + new_y - paddle_y);
  			scope_time_x = Math.floor(e.offsetX * video.canvas.width / $(video.canvas).width() - 16);
        dirty = true;
      }
			paddle_x = clamp(8, 240, new_x);
			paddle_y = clamp(8, 240, new_y);
		});
		$(video.canvas).mousedown(function(e) {
			scope_time_x = Math.floor(e.offsetX * video.canvas.width / $(video.canvas).width() - 16);
      mouse_pressed = true;
      if (e.target.setCapture) e.target.setCapture();
      dirty = true;
		});
		$(video.canvas).mouseup(function(e) {
      mouse_pressed = false;
      if (e.target.setCapture) e.target.releaseCapture();
		});
    audio = new SampleAudio(AUDIO_FREQ);
    idata = video.getFrameData();
    // TODO: 15.7 kHz?
    timer = new AnimationTimer(frameRate, function() {
			if (!self.isRunning())
				return;
      gen.switches = switches[0];
      if (gen.vsync !== undefined && gen.hsync !== undefined && gen.rgb !== undefined)
        updateVideoFrame();
      else
        updateScopeFrame();
    });
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
    try {
      mod = new Function('base', output.code);
    } catch (e) {
      this.printErrorCodeContext(e, output.code);
      throw e;
    }
    var base = new VerilatorBase();
    gen = new mod(base);
    gen.__proto__ = base;
    current_output = output;
    ports_and_signals = current_output.ports; // TODO: current_output.ports.concat(current_output.signals);
    trace_buffer = new Uint32Array(0x10000);
    trace_index = 0;
    this.poweron();
  }

  this.isRunning = function() {
    return timer && timer.isRunning();
  }
  this.pause = function() {
    timer.stop();
    if (gen.spkr !== undefined) audio.stop();
  }
  this.resume = function() {
    timer.start();
    if (gen.spkr !== undefined) audio.start();
  }

  this.poweron = function() {
    gen._ctor_var_reset();
    this.reset();
  }
  this.reset = function() {
    gen.__reset();
    trace_index = scope_x_offset = 0;
    trace_buffer.fill(0);
    dirty = true;
    console.log(gen.rotate);
    video.setRotate(gen.rotate ? -90 : 0);
  }
  this.tick = function() {
    gen.tick2();
  }
  this.getToolForFilename = function(fn) {
    if (fn.endsWith("asm"))
      return "caspr";
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
    if (val !== undefined) {
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

function traceTiming() {
  // TODO: merge with main setCode(text)
  var text = editor.getValue();
  worker.postMessage({
    code:text,
    dependencies:loadFileDependencies(text),
    platform:platform_id,
    tool:'yosys'
  });
}

////////////////

PLATFORMS['verilog'] = VerilogPlatform;
