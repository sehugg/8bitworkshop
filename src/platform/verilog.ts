
import { Platform, BasePlatform } from "../common/baseplatform";
import { PLATFORMS, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap, getMousePos, KeyFlags } from "../common/emu";
import { SampleAudio } from "../common/audio";
import { safe_extend, clamp, byteArrayToString } from "../common/util";
import { WaveformView, WaveformProvider, WaveformMeta } from "../ide/waveform";
import { setFrameRateUI, current_project } from "../ide/ui";

declare var Split;

var VERILOG_PRESETS = [
  {id:'clock_divider.v', name:'Clock Divider'},
  {id:'binary_counter.v', name:'Binary Counter'},
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
  [Keys.LEFT,  0, 0x1],
  [Keys.RIGHT, 0, 0x2],
  [Keys.UP,    0, 0x4],
  [Keys.DOWN,  0, 0x8],
  [Keys.A,     0, 0x10],
  [Keys.B,     0, 0x20],
  [Keys.P2_LEFT,  1, 0x1],
  [Keys.P2_RIGHT, 1, 0x2],
  [Keys.P2_UP,    1, 0x4],
  [Keys.P2_DOWN,  1, 0x8],
  [Keys.P2_A,     1, 0x10],
  [Keys.P2_B,     1, 0x20],
  [Keys.START,     2, 0x1],
  [Keys.P2_START,  2, 0x2],
  [Keys.SELECT,    2, 0x4],
  [Keys.P2_SELECT, 2, 0x8],
  [Keys.VK_7, 2, 0x10],
]);

// SIMULATOR STUFF (should be global)

export var vl_finished = false;
export var vl_stopped = false;

export function VL_UL(x) { return x|0; }
//export function VL_ULL(x) { return x|0; }
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

export function VL_DIV_III(lbits,lhs,rhs) {
    return (((rhs)==0)?0:(lhs)/(rhs)); }

export function VL_MULS_III(lbits,lhs,rhs) {
    return (((rhs)==0)?0:(lhs)*(rhs)); }
  
export function VL_MODDIV_III(lbits,lhs,rhs) {
    return (((rhs)==0)?0:(lhs)%(rhs)); }

export function VL_DIVS_III(lbits,lhs,rhs) {
  var lhs_signed = VL_EXTENDS_II(32, lbits, lhs);
  var  rhs_signed = VL_EXTENDS_II(32, lbits, rhs);
  return (((rhs_signed)==0)?0:(lhs_signed)/(rhs_signed));
}

export function VL_MODDIVS_III(lbits,lhs,rhs) {
  var lhs_signed = VL_EXTENDS_II(32, lbits, lhs);
  var  rhs_signed = VL_EXTENDS_II(32, lbits, rhs);
  return (((rhs_signed)==0)?0:(lhs_signed)%(rhs_signed));
}

export function VL_REDXOR_32(r) {
    r=(r^(r>>1)); r=(r^(r>>2)); r=(r^(r>>4)); r=(r^(r>>8)); r=(r^(r>>16));
    return r;
  }

export var VL_WRITEF = console.log; // TODO: $write

export function vl_finish(filename,lineno,hier) {
    if (!vl_finished) console.log("Finished at " + filename + ":" + lineno, hier);
    vl_finished = true;
  }
export function vl_stop(filename,lineno,hier) {
    if (!vl_stopped) console.log("Stopped at " + filename + ":" + lineno, hier);
    vl_stopped = true;
  }

export function VL_RAND_RESET_I(bits) { return 0 | Math.floor(Math.random() * (1<<bits)); }

export function VL_RANDOM_I(bits) { return 0 | Math.floor(Math.random() * (1<<bits)); }

export function VL_READMEM_Q(ishex,width,depth,array_lsb,fnwords,filename,memp,start,end) {
  VL_READMEM_W(ishex,width,depth,array_lsb,fnwords,filename,memp,start,end);
}
export function VL_READMEM_W(ishex,width,depth,array_lsb,fnwords,filename,memp,start,end) {
  // parse filename from 32-bit values into characters
  var barr = [];
  for (var i=0; i<filename.length; i++) {
    barr.push((filename[i] >> 0)  & 0xff);
    barr.push((filename[i] >> 8)  & 0xff);
    barr.push((filename[i] >> 16) & 0xff);
    barr.push((filename[i] >> 24) & 0xff);
  }
  barr = barr.filter(x => x != 0); // ignore zeros
  barr.reverse(); // reverse it
  var strfn = byteArrayToString(barr); // convert to string
  // parse hex/binary file
  var strdata = current_project.getFile(strfn) as string;
  if (strdata == null) throw Error("Could not $readmem '" + strfn + "'");
  var data = strdata.split('\n').filter(s => s !== '').map(s => parseInt(s, ishex ? 16 : 2));
  console.log('$readmem', ishex, strfn, data.length);
  // copy into destination array
  if (memp === null) throw Error("No destination array to $readmem " + strfn);
  if (memp.length < data.length) throw Error("Destination array too small to $readmem " + strfn);
  for (i=0; i<data.length; i++)
    memp[i] = data[i];
}

const CYCLES_PER_FILL = 20;

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
  var poller;
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
  var keycode = 0;

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
    if (keycode && keycode >= 128 && gen.keystrobe) // keystrobe = clear hi bit of key buffer
      keycode = gen.keycode = keycode & 0x7f;
    if (debugCond && debugCond())
      debugCond = null;
  }

  // inner Platform class
    
 class _VerilogPlatform extends BasePlatform implements WaveformProvider {
 
  waveview : WaveformView;
  wavediv : JQuery;
  topdiv : JQuery;
  split;
  hasvideo : boolean;

  getPresets() { return VERILOG_PRESETS; }

  setVideoParams(width:number, height:number, clock:number) {
    videoWidth = width;
    videoHeight = height;
    cyclesPerFrame = clock;
    maxVideoLines = height+40;
  }

  start() {
    video = new RasterVideo(mainElement,videoWidth,videoHeight,{overscan:true});
    video.create();
    poller = setKeyboardFromMap(video, switches, VERILOG_KEYCODE_MAP, (o,key,code,flags) => {
      if (flags & KeyFlags.KeyPress) {
        keycode = code | 0x80;
      }
    }, true); // true = always send function
    var vcanvas = $(video.canvas);
    idata = video.getFrameData();
    timerCallback = () => {
      if (!this.isRunning())
        return;
      if (gen) gen.switches = switches[0];
      this.updateFrame();
    };
    this.setFrameRate(60);
    // setup scope
    trace_buffer = new Uint32Array(0x20000);
    var overlay = $("#emuoverlay").show();
    this.topdiv = $('<div class="emuspacer">').appendTo(overlay);
    vcanvas.appendTo(this.topdiv);
    this.wavediv = $('<div class="emuscope">').appendTo(overlay);
    this.split = Split( [this.topdiv[0], this.wavediv[0]], {
      minSize: [0,0],
      sizes: [99,1],
      direction: 'vertical',
      gutterSize: 16,
      onDrag: () => {
        this.resize();
        //if (this.waveview) this.waveview.recreate();
        //vcanvas.css('position','relative');
        //vcanvas.css('top', -this.wavediv.height()+'px');
      },
    });
    // setup mouse events
    video.setupMouseEvents();
    // setup mouse click
    video.vcanvas.click( (e) => {
      if (!gen) return; // must have created emulator
      if (!e.ctrlKey) {
        //setFrameRateUI(60);
        return; // ctrl key must be down
      }
      setFrameRateUI(1.0/2048);
      var pos = getMousePos(video.canvas, e);
      var new_y = Math.floor(pos.y);
      var clock = 0;
      while (framey != new_y || clock++ > 200000) {
        this.setGenInputs();
        this.updateVideoFrameCycles(1, true, false);
        gen.__unreset();
      }
    });
  }
  
  // TODO: pollControls() { poller.poll(); }
  
  resize() {
    if (this.waveview) this.waveview.recreate();
  }
  
  setGenInputs() {
    useAudio = (audio != null);
    //TODO debugCond = this.getDebugCallback();
    gen.switches_p1 = switches[0];
    gen.switches_p2 = switches[1];
    gen.switches_gen = switches[2];
    gen.keycode = keycode;
  }
  
  updateVideoFrame() {
    //this.topdiv.show(); //show crt
    this.setGenInputs();
    var fps = this.getFrameRate();
    // darken the previous frame?
    var sync = fps > 45;
    if (!sync) {
      var mask = fps > 5 ? 0xe7ffffff : 0x7fdddddd;
      for (var i=0; i<idata.length; i++)
        idata[i] &= mask;
    }
    // paint into frame, synched with vsync if full speed
    var trace = this.isScopeVisible();
    this.updateVideoFrameCycles(cyclesPerFrame * fps/60 + 1, sync, trace);
    if (fps < 0.25) {
      idata[frameidx] = -1;
    }
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
  advance(novideo : boolean) : number {
    this.setGenInputs();
    this.updateVideoFrameCycles(cyclesPerFrame, true, false);
    gen.__unreset();
    if (!novideo) {
      this.refreshVideoFrame();
    }
    return cyclesPerFrame; //TODO?
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
    //this.topdiv.hide();// hide crt
    var done = this.fillTraceBuffer(CYCLES_PER_FILL * trace_signals.length);
    if (done)
      this.pause(); // TODO?
    // TODO
  }
  
  updateScope() {
    // create scope, if visible
    if (this.isScopeVisible()) {
      if (!this.waveview) {
        this.waveview = new WaveformView(this.wavediv[0] as HTMLElement, this);
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
          let rgb = gen.rgb;
          idata[frameidx] = rgb & 0x80000000 ? rgb : RGBLOOKUP[rgb & 15];
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
          $("#run_bar").show();
          $("#xtra_bar").show();
        } else {
          $("#speed_bar").hide();
          $("#run_bar").hide();
          $("#xtra_bar").hide();
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
    if (this.waveview) {
      this.waveview.recreate();
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
    if (!gen) return;
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
    if (fn.endsWith(".asm")) return "jsasm";
    else if (fn.endsWith(".ice")) return "silice";
    else return "verilator";
  }
  getDefaultExtension() { return ".v"; };

  inspect(name:string) : string {
    if (!gen) return;
    if (name) name = name.replace('.','_');
    if (!name || !name.match(/^\w+$/)) {
      inspect_obj = inspect_sym = null;
      return;
    }
    var val = gen[name];
    if (val === undefined && current_output.code) {
      var re = new RegExp("(\\w+__DOT__(?:_[dcw]_)" + name + ")\\b", "gm");
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

  getDebugTree() {
    return this.saveState().o;
  }

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
      keycode: keycode
    };
  }
  loadControlsState(state) {
    video.paddle_x = state.p1x;
    video.paddle_y = state.p1y;
    switches[0] = state.sw0;
    switches[1] = state.sw1;
    switches[2] = state.sw2;
    keycode = state.keycode;
  }

 } // end of inner class
 return new _VerilogPlatform();  
};

////////////////

var VERILOG_VGA_PRESETS = [
  {id:'hvsync_generator.v', name:'Video Sync Generator'},
  {id:'test_hvsync.v', name:'Test Pattern'},
  {id:'chardisplay.v', name:'RAM Text Display'},
  {id:'starfield.v', name:'Scrolling Starfield'},
  {id:'ball_paddle.v', name:'Brick Smash Game'},
];


var VerilogVGAPlatform = function(mainElement, options) {
  this.__proto__ = new (VerilogPlatform as any)(mainElement, options);

  this.getPresets = function() { return VERILOG_VGA_PRESETS; }

  this.setVideoParams(800-64, 520, 25000000);
}

////////////////

PLATFORMS['verilog'] = VerilogPlatform;
PLATFORMS['verilog-vga'] = VerilogVGAPlatform;
PLATFORMS['verilog-test'] = VerilogPlatform;
