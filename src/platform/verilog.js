"use strict";

var VERILOG_PRESETS = [
  {id:'hvsync.v', name:'Hello Verilog'},
];

function VerilatorBase() {
  this.VL_RAND_RESET_I = function(bits) { return Math.floor(Math.random() * (1<<bits)); }

  this.tick = function() {
    this.eval();
    this.clk ^= 1;
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
        if (++__VclockLoop > 100) vl_fatal(__FILE__,__LINE__,__FILE__,"Verilated model didn't converge");
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
        if (++__VclockLoop > 100) vl_fatal(__FILE__,__LINE__,__FILE__,"Verilated model didn't DC converge");
    }
  }
}

var VerilogPlatform = function(mainElement, options) {
  var self = this;
  var video;
  var videoWidth=288;
  var videoHeight=248;
  var idata, timer;
  var gen;
  var frameRate = 60;

  this.getPresets = function() { return VERILOG_PRESETS; }

  this.start = function() {
    // TODO
    video = new RasterVideo(mainElement,videoWidth,videoHeight);
    video.create();
    idata = video.getFrameData();
    // TODO: 15.7 kHz?
    timer = new AnimationTimer(frameRate, function() {
			if (!self.isRunning())
				return;
      var i=0;
      for (var y=0; y<videoHeight; y++) {
        for (var x=0; x<videoWidth; x++) {
          gen.tick();
          gen.tick();
          idata[i++] = gen.pixel ? 0xffffffff : 0xff111111;
        }
        var z=0;
        while (gen.hsync && z++<videoWidth*2) gen.tick();
        while (!gen.hsync && z++<videoWidth*2) gen.tick();
      }
      var z=0;
      while (gen.vsync && z++<videoWidth*160) gen.tick();
      while (!gen.vsync && z++<videoWidth*160) gen.tick();
      video.updateFrame();
    });
  }

  this.loadROM = function(title, modtext) {
    //console.log(modtext);
    var mod = new Function('base', modtext);
    var base = new VerilatorBase();
    gen = new mod(base);
    gen.__proto__ = base;
    console.log(gen);
    this.reset();
  }

  this.isRunning = function() {
    return timer && timer.isRunning();
  }
  this.pause = function() {
    timer.stop();
    //audio.stop();
  }
  this.resume = function() {
    timer.start();
    //audio.start();
  }

  this.reset = function() {
    gen._ctor_var_reset();
  }
  this.getToolForFilename = function(fn) {
    return "verilator";
  }
  this.getDefaultExtension = function() { return ".v"; };
};

////////////////

PLATFORMS['verilog'] = VerilogPlatform;
