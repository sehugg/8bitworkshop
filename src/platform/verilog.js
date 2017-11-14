"use strict";

var VERILOG_PRESETS = [
  {id:'hvsync.v', name:'Hello Verilog'},
  {id:'pong.v', name:'Pong'},
];

function VerilatorBase() {
  this.VL_RAND_RESET_I = function(bits) { return Math.floor(Math.random() * (1<<bits)); }

  function vl_fatal(msg) {
    console.log(msg);
  }

  this.reset2 = function() {
    if (this.reset !== 'undefined') {
      this.reset = 1;
      for (var i=0; i<100; i++)
        this.tick2();
      this.reset = 0;
    }
  }

  this.tick2 = function() {
    this.clk = 0;
    this.eval();
    this.clk = 1;
    this.eval();
  }

  var vlSymsp = {TOPp:this};
  var maxVclockLoop = 1;

  this.eval = function() {
    vlSymsp.TOPp = this;
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
  }

  this._eval_initial_loop = function(vlSymsp) {
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
  var videoWidth=288;
  var videoHeight=248;
  var idata, timer;
  var gen;
  var frameRate = 60;
  var AUDIO_FREQ = 15700;
  var current_output;

  this.getPresets = function() { return VERILOG_PRESETS; }

  function tick2() {
    gen.tick2();
    audio.addSingleSample(0+gen.audio); // TODO: sync with audio freq
  }

  var RGBLOOKUP = [
    0xff111111,
    0xff1111ff,
    0xff11ff11,
    0xff11ffff,
    0xffff1111,
    0xffff11ff,
    0xffffff11,
    0xffffffff,
  ];

  function updateVideoFrame() {
    var i=0;
    for (var y=0; y<videoHeight; y++) {
      for (var x=0; x<videoWidth; x++) {
        tick2();
        idata[i++] = RGBLOOKUP[gen.rgb];
      }
      var z=0;
      while (gen.hsync && z++<videoWidth) tick2();
      while (!gen.hsync && z++<videoWidth) tick2();
    }
    var z=0;
    while (gen.vsync && z++<videoWidth*80) tick2();
    while (!gen.vsync && z++<videoWidth*80) tick2();
    video.updateFrame();
  }

  var yposlist = [];

  function updateScopeFrame() {
    var arr = current_output.ports;
    if (!arr) return;
    for (var i=0; i<idata.length; i++) {
      if (idata[i])
        idata[i] = 0; //<<= 1;
    }
    var COLOR_SIGNAL = 0xff11ff11;
    var COLOR_BORDER = 0xff661111;
    for (var x=0; x<videoWidth; x++) {
      gen.clk ^= 1;
      gen.eval();
      var yb = 8;
      var y1 = 0;
      for (var i=0; i<arr.length; i++) {
        var v = arr[i];
        var lo = 0; // TODO? v.ofs?
        var hi = v.len ? ((2 << v.len)-1) : 1;
        var ys = hi>1 ? v.len*2+8 : 8;
        var y2 = y1+ys;
        var z = gen[v.name];
        var y = y2 - ys*((z-lo)/hi);
        yposlist[i] = y2;
        //idata[x + y1*videoWidth] = COLOR_BORDER;
        //idata[x + y2*videoWidth] = COLOR_BORDER;
        idata[x + Math.round(y)*videoWidth] = COLOR_SIGNAL;
        y1 += ys+yb;
      }
    }
    video.updateFrame();
    // draw labels
    var ctx = video.getContext();
    ctx.font = "8px TinyFont";
    ctx.fillStyle = "white";
    for (var i=0; i<arr.length; i++) {
      var v = arr[i];
      ctx.fillText(v.name, 1, yposlist[i]);
    }
  }

  this.start = function() {
    // TODO
    video = new RasterVideo(mainElement,videoWidth,videoHeight);
    video.create();
    audio = new SampleAudio(AUDIO_FREQ);
    idata = video.getFrameData();
    // TODO: 15.7 kHz?
    timer = new AnimationTimer(frameRate, function() {
			if (!self.isRunning())
				return;
      if (gen.vsync !== undefined && gen.hsync !== undefined && gen.rgb !== undefined)
        updateVideoFrame();
      else
        updateScopeFrame();
    });
  }

  this.loadROM = function(title, output) {
    var mod = new Function('base', output.code);
    var base = new VerilatorBase();
    gen = new mod(base);
    gen.__proto__ = base;
    output.code = null;
    output.ports_signals = output.ports.concat(output.signals);
    current_output = output;
    this.reset();
  }

  this.isRunning = function() {
    return timer && timer.isRunning();
  }
  this.pause = function() {
    timer.stop();
    audio.stop();
  }
  this.resume = function() {
    timer.start();
    audio.start();
  }

  this.reset = function() {
    gen._ctor_var_reset();
    gen.reset2();
  }
  this.getToolForFilename = function(fn) {
    return "verilator";
  }
  this.getDefaultExtension = function() { return ".v"; };
};

////////////////

PLATFORMS['verilog'] = VerilogPlatform;
