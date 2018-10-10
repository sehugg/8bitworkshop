"use strict";

import { Platform, BasePlatform } from "../baseplatform";
import { PLATFORMS, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap } from "../emu";
import { SampleAudio } from "../audio";
import { safe_extend, clamp } from "../util";
import { WaveformView, WaveformProvider, WaveformMeta } from "../waveform";

declare var Split;

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
  {id:'chardisplay.v', name:'RAM Text Display'},
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

// SIMULATOR STUFF (should be global)

export var vl_finished = false;
export var vl_stopped = false;

export function VL_UL(x) { return x|0; }
export function VL_ULL(x) { return x|0; }
export function VL_TIME_Q() { return (new Date().getTime())|0; }

  /// Return true if data[bit] set
export function VL_BITISSET_I(data,bit) { return (data & (VL_UL(1)<<VL_UL(bit))); }

export function VL_EXTENDSIGN_I(lbits, lhs) { return (-((lhs)&(VL_UL(1)<<(lbits-1)))); }

export function VL_EXTEND_II(obits,lbits,lhs) { return lhs; }

export function VL_EXTENDS_II(x,lbits,lhs) {
    return VL_EXTENDSIGN_I(lbits,lhs) | lhs;
  }

export function VL_NEGATE_I(x) { return -x; }

export function VL_LTS_III(x,lbits,y,lhs,rhs) {
    return (VL_EXTENDS_II(x,lbits,lhs) < VL_EXTENDS_II(x,lbits,rhs)) ? 1 : 0; }

export function VL_GTS_III(x,lbits,y,lhs,rhs) {
    return (VL_EXTENDS_II(x,lbits,lhs) > VL_EXTENDS_II(x,lbits,rhs)) ? 1 : 0; }

export function VL_LTES_III(x,lbits,y,lhs,rhs) {
    return (VL_EXTENDS_II(x,lbits,lhs) <= VL_EXTENDS_II(x,lbits,rhs)) ? 1 : 0; }

export function VL_GTES_III(x,lbits,y,lhs,rhs) {
    return (VL_EXTENDS_II(x,lbits,lhs) >= VL_EXTENDS_II(x,lbits,rhs)) ? 1 : 0; }

export function VL_MODDIV_III(lbits,lhs,rhs) {
    return (((rhs)==0)?0:(lhs)%(rhs)); }

export function VL_MODDIVS_III(lbits,lhs,rhs) {
    return (((rhs)==0)?0:(lhs)%(rhs)); }

export function VL_REDXOR_32(r) {
    r=(r^(r>>1)); r=(r^(r>>2)); r=(r^(r>>4)); r=(r^(r>>8)); r=(r^(r>>16));
    return r;
  }

export var VL_WRITEF = console.log; // TODO: $write

export function vl_finish(filename,lineno,hier) {
    console.log("Finished at " + filename + ":" + lineno, hier);
    vl_finished = true;
  }
export function vl_stop(filename,lineno,hier) {
    console.log("Stopped at " + filename + ":" + lineno, hier);
    vl_stopped = true;
  }

export function VL_RAND_RESET_I(bits) { return 0 | Math.floor(Math.random() * (1<<bits)); }

export function VL_RANDOM_I(bits) { return 0 | Math.floor(Math.random() * (1<<bits)); }
  
// SIMULATOR BASE

abstract class VerilatorBase {

  totalTicks = 0;
  maxVclockLoop = 0;
  clk = 0;
  reset = 0;
  enable?;

  vl_fatal(msg:string) {
    console.log(msg);
  }

  ticks() : number { return this.totalTicks; }
  setTicks(T:number) { this.totalTicks = T|0; }

  __reset() {
    if (this.enable !== undefined) {
      this.enable = 1; // enable enable if defined
    }
    if (this.reset !== undefined) {
      this.totalTicks = 0;
      this.reset = 0;
      this.tick2();
      this.reset = 1;
    }
  }

  __unreset() {
    if (this.reset !== undefined) {
      this.reset = 0;
    }
  }

  tick2() {
    this.clk = 0;
    this.eval();
    this.clk = 1;
    this.eval();
  }
  
  abstract _eval(vlSymsp);
  abstract __Vm_didInit : boolean;
  abstract __Vm_activity : boolean;
  abstract _change_request(vlSymsp);
  abstract _eval_initial(vlSymsp);
  abstract _eval_settle(vlSymsp);

  eval() {
    let vlSymsp = this; //{TOPp:this};
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
        if (++__VclockLoop > 100) { this.vl_fatal("Verilated model didn't converge"); }
    }
    if (__VclockLoop > this.maxVclockLoop) {
      this.maxVclockLoop = __VclockLoop;
      if (this.maxVclockLoop > 1) {
        console.log("Graph took " + this.maxVclockLoop + " iterations to stabilize");
        $("#verilog_bar").show();
        $("#settle_label").text(this.maxVclockLoop+"");
      }
    }
    this.totalTicks++;
  }

  _eval_initial_loop(vlSymsp) {
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
        if (++__VclockLoop > 100) { this.vl_fatal("Verilated model didn't DC converge"); }
    }
  }
}

// PLATFORM

var VerilogPlatform = function(mainElement, options) {
  this.__proto__ = new (BasePlatform as any)();
  
  var video, audio;
  var useAudio = false;
  var videoWidth  = 292;
  var videoHeight = 256;
  var maxVideoLines = 262+40; // vertical hold
  var idata, timer, timerCallback;
  var gen;
  var cyclesPerFrame = (256+23+7+23)*262; // 4857480/60 Hz
  var current_output;

  // control inputs
  var switches = [0,0,0];

  // inspect feature  
  var inspect_obj, inspect_sym;
  var inspect_data = new Uint32Array(videoWidth * videoHeight);

  // for scope
  var module_name;
  //var trace_ports;
  var trace_signals;
  var trace_buffer;
  var trace_index;

  // for virtual CRT
  var framex=0;
  var framey=0;
  var frameidx=0;
  var framehsync=false;
  var framevsync=false;

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
  var frameRate = 0;

  function vidtick() {
    gen.tick2();
    if (useAudio)
      audio.feedSample(gen.spkr*(1.0/255.0), 1);
    if (debugCond && debugCond())
      debugCond = null;
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

  // inner Platform class
    
 class _VerilogPlatform extends BasePlatform implements WaveformProvider {
 
  waveview : WaveformView;
  wavediv : JQuery;
  split;
  hasvideo : boolean;

  getPresets() { return VERILOG_PRESETS; }

  start() {
    video = new RasterVideo(mainElement,videoWidth,videoHeight);
    video.create();
    var ctx = video.getContext();
    ctx.font = "8px TinyFont";
    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    setKeyboardFromMap(video, switches, VERILOG_KEYCODE_MAP);
    var vcanvas = $(video.canvas);
    idata = video.getFrameData();
    timerCallback = () => {
			if (!this.isRunning())
				return;
      gen.switches = switches[0];
      this.updateFrame();
    };
    this.setFrameRate(60);
    // setup scope
    trace_buffer = new Uint32Array(0x20000);
    var overlay = $("#emuoverlay").show();
    var topdiv = $('<div class="emuspacer">').appendTo(overlay);
    this.wavediv = $('<div class="emuscope">').appendTo(overlay);
    this.split = Split( [topdiv[0], this.wavediv[0]], {
      minSize: [0,0],
      sizes: [99,1],
      direction: 'vertical',
      gutterSize: 16,
      onDrag: () => {
        if (this.waveview) this.waveview.recreate();
      },
      onDragStart: () => {
        $(".emuoverlay").css("pointer-events", "auto"); // allow drag
      },
      onDragEnd: () => {
        $(".emuoverlay").css("pointer-events", "none"); // disallow drag
      },
    });
    // setup mouse events
    video.setupMouseEvents();
  }
  
  setGenInputs() {
    useAudio = (audio != null);
    //TODO debugCond = this.getDebugCallback();
    gen.switches_p1 = switches[0];
    gen.switches_p2 = switches[1];
    gen.switches_gen = switches[2];
  }
  
  updateVideoFrame() {
    this.setGenInputs();
    var fps = this.getFrameRate();
    // darken the previous frame?
    if (fps < 45) {
      var mask = fps > 5 ? 0xe7ffffff : 0x7fdddddd;
      for (var i=0; i<idata.length; i++)
        idata[i] &= mask;
    }
    // paint into frame, synched with vsync if full speed
    var sync = fps > 45;
    var trace = this.isScopeVisible();
    this.updateVideoFrameCycles(cyclesPerFrame * fps/60 + 1, sync, trace);
    //this.restartDebugState();
    gen.__unreset();
    this.refreshVideoFrame();
    // set scope offset
    if (trace && this.waveview) {
      this.waveview.setEndTime(Math.floor(trace_index/trace_signals.length));
    }
  }
  
  isScopeVisible() {
    return this.split.getSizes()[1] > 2; // TODO?
  }

  // TODO: merge with prev func  
  advance(novideo : boolean) {
    this.setGenInputs();
    this.updateVideoFrameCycles(cyclesPerFrame, true, false);
    gen.__unreset();
    if (!novideo) {
      this.refreshVideoFrame();
    }
  }
  
  refreshVideoFrame() {
    this.updateInspectionFrame();
    video.updateFrame();
    this.updateInspectionPostFrame();
  }
  
  refreshScopeOverlay() {
    // TODO
  }
  
  updateScopeFrame() {
    this.split.setSizes([0,100]); // ensure scope visible
    var done = this.fillTraceBuffer(32 * trace_signals.length); // TODO: const
    if (done)
      this.pause(); // TODO?
    // TODO
  }
  
  updateScope() {
    // create scope, if visible
    if (this.isScopeVisible()) {
      if (!this.waveview) {
        this.waveview = new WaveformView(this.wavediv[0], this);
      } else {
        this.waveview.refresh();
      }
    }
  }

  updateFrame() {
    if (!gen) return;
    if (this.hasvideo)
      this.updateVideoFrame();
    else
      this.updateScopeFrame();
    this.updateScope();
  }

  updateInspectionFrame() {
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

  updateInspectionPostFrame() {
    if (inspect_obj && inspect_sym) {
      var ctx = video.getContext();
      var val = inspect_data[inspect_data.length-1];
      ctx.fillStyle = "black";
      ctx.fillRect(18, videoHeight-8, 30, 8);
      ctx.fillStyle = "white";
      ctx.fillText(val.toString(10), 20, videoHeight-1);
    }
  }

  updateVideoFrameCycles(ncycles:number, sync:boolean, trace:boolean) {
    ncycles |= 0;
    var inspect = inspect_obj && inspect_sym;
    var trace0 = trace_index;
    while (ncycles--) {
      if (trace) {
        this.snapshotTrace();
        if (trace_index == trace0) trace = false; // kill trace when wraps around
      }
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
        gen.hpaddle = framey > video.paddle_x ? 1 : 0;
        gen.vpaddle = framey > video.paddle_y ? 1 : 0;
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
        if (sync && wasvsync) {
          this.updateRecorder();
          return; // exit when vsync ends
        }
      }
    }
  }

  snapshotTrace() {
    var arr = trace_signals;
    for (var i=0; i<arr.length; i++) {
      var v = arr[i];
      var z = gen[v.name];
      if (typeof(z) === 'number')
        trace_buffer[trace_index] = z;
      trace_index++;
    }
    if (trace_index >= trace_buffer.length - arr.length)
      trace_index = 0;
  }

  fillTraceBuffer(count:number) : boolean {
    var max_index = Math.min(trace_buffer.length - trace_signals.length, trace_index + count);
    while (trace_index < max_index) {
      gen.clk ^= 1;
      gen.eval();
      this.snapshotTrace();
      if (trace_index == 0)
        break;
    }
    gen.__unreset();
    return (trace_index == 0);
  }
  
  getSignalMetadata() : WaveformMeta[] {
    return trace_signals;
  }
  
  getSignalData(index:number, start:number, len:number) : number[] {
    // TODO: not efficient
    var skip = this.getSignalMetadata().length;
    var last = trace_buffer.length - trace_signals.length; // TODO: refactor, and not correct
    var wrap = this.hasvideo; // TODO?
    var a = [];
    index += skip * start;
    while (index < last && a.length < len) {
      a.push(trace_buffer[index]);
      index += skip;
      if (wrap && index >= last) // TODO: what if starts with index==last
        index = 0;
    }
    return a;
  }

  printErrorCodeContext(e, code) {
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

  loadROM(title, output) {
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
        var base = new (VerilatorBase as any)();
        gen = new mod();
        //$.extend(gen, base);
        gen.__proto__ = base;
        current_output = output;
        module_name = output.name ? output.name.substr(1) : "top";
        //trace_ports = current_output.ports;
        trace_signals = current_output.ports.concat(current_output.signals);	// combine ports + signals
        trace_signals = trace_signals.filter((v) => { return !v.name.startsWith("__V"); }); // remove __Vclklast etc
        for (var v of trace_signals) {
          v.label = v.name.replace(/__DOT__/g, ".");	// make nicer name
        }
        trace_index = 0;
        // power on module
        this.poweron();
        // query output
        this.hasvideo = gen.vsync !== undefined && gen.hsync !== undefined && gen.rgb !== undefined;
        if (this.hasvideo) {
          const IGNORE_SIGNALS = ['clk','reset'];
          trace_signals = trace_signals.filter((v) => { return IGNORE_SIGNALS.indexOf(v.name)<0; }); // remove clk, reset
          $("#speed_bar").show();
        } else {
          $("#speed_bar").hide();
        }
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
    this.restartAudio();
    // destroy scope
    if (this.waveview) {
      this.waveview.destroy();
      this.waveview = null;
    }
  }
  
  restartAudio() {
    // stop/start audio
    var hasAudio = gen && gen.spkr !== undefined && frameRate > 1;
    if (audio && !hasAudio) {
      audio.stop();
      audio = null;
    } else if (!audio && hasAudio) {
      audio = new SampleAudio(cyclesPerFrame * this.getFrameRate());
      if (this.isRunning())
        audio.start();
    }
  }

  isRunning() {
    return timer && timer.isRunning();
  }
  pause() {
    timer.stop();
    if (audio) audio.stop();
  }
  resume() {
    timer.start();
    if (audio) audio.start();
  }

  setFrameRate(rateHz) {
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
    this.restartAudio();
  }  
  getFrameRate() { return frameRate; }

  poweron() {
    gen._ctor_var_reset();
    this.reset();
  }
  reset() {
    gen.__reset();
    trace_index = 0;
    if (trace_buffer) trace_buffer.fill(0);
    if (video) video.setRotate(gen.rotate ? -90 : 0);
    $("#verilog_bar").hide();
    if (!this.hasvideo) this.resume(); // TODO?
  }
  tick() {
    gen.tick2();
  }
  getToolForFilename(fn) {
    if (fn.endsWith("asm"))
      return "jsasm";
    else
      return "verilator";
  }
  getDefaultExtension() { return ".v"; };

  inspect(name) {
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
  }

  // DEBUGGING

  // TODO: bind() a function to avoid depot?
  saveState() {
    var state = {
      T:gen.ticks(),
      o:safe_extend(true, {}, gen)
    };
    state.o.TOPp = null;
    return state;
  }
  loadState(state) {
    gen = safe_extend(true, gen, state.o);
    gen.setTicks(state.T);
    gen.TOPp = gen;
    //console.log(gen, state.o);
  }
  saveControlsState() {
    return {
      p1x: video.paddle_x,
      p1y: video.paddle_y,
      sw0: switches[0],
      sw1: switches[1],
      sw2: switches[2],
    };
  }
  loadControlsState(state) {
    video.paddle_x = state.p1x;
    video.paddle_y = state.p1y;
    switches[0] = state.sw0;
    switches[1] = state.sw1;
    switches[2] = state.sw2;
  }

 } // end of inner class
 return new _VerilogPlatform();  
};

////////////////

PLATFORMS['verilog'] = VerilogPlatform;
