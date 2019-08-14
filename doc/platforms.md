
class Platform 
--------------

Mandatory functions:
~~~
  start() : void;
  reset() : void;
  isRunning() : boolean;
  pause() : void;
  resume() : void;
  loadROM(title:string, rom:any);
~~~

These are for the compiler/editor:
~~~
  getToolForFilename(s:string) : string;
  getDefaultExtension() : string;
  getPresets() : Preset[];
~~~

Most platforms have these:
~~~
  loadState?(state : EmuState) : void;
  saveState?() : EmuState;
~~~

... etc


6502
----

`advance()` advances one frame.
The basic idea: iterate through all the scanlines, run a bunch of CPU cycles per scanline.
If we hit a breakpoint, exit the loop.

~~~
    var debugCond = this.getDebugCallback();
    for (var sl=0; sl<262; sl++) {
      for (var i=0; i<cpuCyclesPerLine; i++) {
        if (debugCond && debugCond()) {
          debugCond = null;
          sl = 999;
          break;
        }
        clock++;
        cpu.clockPulse();
      }
    }
~~~

Hitting a breakpoint does a `saveState()` but debug info is better when the platform is stopped at the breakpoint instead of being allowed to continue.

Some platforms like `vector` aren't scanline-based, they just have a target number of scanlines per frame (per 1/60 sec)

The 6502 CPU core is usually a byte behind the current instruction at breakpoints.
So when saving state we +1 the PC by calling `fixPC`.
When loading state we have to -1 the PC, load state, then +1 the PC.

~~~
    this.unfixPC(state.c);
    cpu.loadState(state.c);
    this.fixPC(state.c);
~~~



Z80
---

There's a `runCPU()` wrapper:

~~~
  advance(novideo : boolean) {
    for (var sl=0; sl<scanlinesPerFrame; sl++) {
      drawScanline(pixels, sl);
      this.runCPU(cpu, cpuCyclesPerLine);
    }
    // NMI each frame
    if (interruptEnabled) { cpu.nonMaskableInterrupt(); }
  }
~~~


Atari 2600
-----------
8bitworkshop was originally VCS-only, Javatari.js was the first emulator it supported.

It's a wonderful emulator, but it didn't have hooks for debugging.
I had to hack it up quite a bit, and wasn't sure what I was doing.
A lot of the debugging functions just pass-through to my hacked-up functions:

~~~
  step() { Javatari.room.console.debugSingleStepCPUClock(); }
  stepBack() { Javatari.room.console.debugStepBackInstruction(); }
  runEval(evalfunc) { Javatari.room.console.debugEval(evalfunc); }
~~~

Even so, I decided to monkey-patch the `clockPulse()` function so that I could record frames:

~~~
    Javatari.room.console.oldClockPulse = Javatari.room.console.clockPulse;
    Javatari.room.console.clockPulse = function() {
      self.updateRecorder();
      this.oldClockPulse();
    }
~~~

Eventually I'd like to make it more like the other platforms.
8bitworkshop uses its CPU core for other 6502 platforms.


BasicZ80ScanlinePlatform 
------------------------

Can be used to easily build a Z80-based raster platform.
Just have to fill out the following:

~~~
  cpuFrequency : number;
  canvasWidth : number;
  numTotalScanlines : number;
  numVisibleScanlines : number;
  defaultROMSize : number;

  abstract newRAM() : Uint8Array;
  abstract newMembus() : MemoryBus;
  abstract newIOBus() : MemoryBus;
  abstract getVideoOptions() : {};
  abstract getKeyboardMap();
  abstract startScanline(sl : number) : void;
  abstract drawScanline(sl : number) : void;
  getRasterScanline() : number { return this.currentScanline; }
  getKeyboardFunction() { return null; }
~~~


NES
---

NES uses the JSNES emulator, which has a callback function after each frame.

~~~
    this.nes = new jsnes.NES({
      onFrame: (frameBuffer : number[]) => {
      },
      onAudioSample: (left:number, right:number) => {
      },
      onStatusUpdate: function(s) {
      },
    });
~~~

We monkey-patch the code to add a debugging hook:

~~~
    // insert debug hook
    this.nes.cpu._emulate = this.nes.cpu.emulate;
    this.nes.cpu.emulate = () => {
      var cycles = this.nes.cpu._emulate();
      this.evalDebugCondition();
      return cycles;
    }
~~~

NES was the first platform with an "illegal opcode" hard stop, so we added a special `EmuHalt` exception which causes a breakpoint:

~~~
    this.nes.stop = () => {
      console.log(this.nes.cpu.toJSON());
      throw new EmuHalt("CPU STOPPED @ PC $" + hex(this.nes.cpu.REG_PC));
    };
~~~


MAME
----

The `BaseMAMEPlatform` class implements a MAME platform.
You just have to pass it various parameters when starting, and tell it how to load the ROM file:

~~~
class ColecoVisionMAMEPlatform extends BaseMAMEPlatform implements Platform {

  start() {
    this.startModule(this.mainElement, {
      jsfile: 'mamecoleco.js',
      cfgfile: 'coleco.cfg',
      biosfile: 'coleco/313 10031-4005 73108a.u2',
      driver: 'coleco',
      width: 280 * 2,
      height: 216 * 2,
      romfn: '/emulator/cart.rom',
      romsize: 0x8000,
      preInit: function(_self) {
      },
    });
  }

  loadROM(title, data) {
    this.loadROMFile(data);
    this.loadRegion(":coleco_cart:rom", data);
  }

  getPresets() { return ColecoVision_PRESETS; }
  getToolForFilename = getToolForFilename_z80;
  getDefaultExtension() { return ".c"; };
}
~~~

A lot of things are done via Lua scripting -- for example, loading a ROM requires we loop over the memory region and issue `rgn:write_u32` calls.
It kinda-sorta works, except debugging isn't reliable because MAME [doesn't return from the event loop](https://github.com/mamedev/mame/issues/3649) at breakpoints.

MAME platforms don't have state load/save either.


Verilog
--------

The Verilog platform is the odd one out, since it has no fixed CPU as such.
The `loadROM` function instead loads a JavaScript function.
Some platforms do have a ROM if using assembly, so we load that into a Verilog array.
It's quite the hack, and it could be better.

Verilog has its own debugger, logging signals in a fixed-size buffer.



Profiling 
----------

`EmuProfilerImpl` runs the profiler.
When started, it calls `setBreakpoint` to add a profiler-specific breakpoint that never hits, just records the CPU state at each clock.
It uses `getRasterScanline` to associate IPs with scanlines.
Platforms can also log their own reads, writes, interrupts, etc.


Future Ideas
------------

There should be a standard CPU interface, buses, memory map.
More like MAME configuration.

Platforms might have different ideas of "clock" (CPU clock, pixel clock, 1 clock per instruction, etc)

The goal is to rewind and advance to any clock cycle within a frame, and get complete introspection of events, without hurting performance.

Unify raster platforms, they should all allow the same debugging and CPU interfaces.

Separate UI/sim parts of platform?
A lot of platforms write into a uint32 buffer.
We might want to buffer audio the same way.
Also some way to log events, and handle input.

Figure out how to make platform-specific type for load/save state.
(generics?)

Separate emulators from 8bitworkshop IDE.

Can we use WASM emulators without JS interop penalty?
Maybe using [AssemblyScript](https://docs.assemblyscript.org/)?
Startup would be faster, probably runtime too.
Drawback is that dynamic stuff (custom breakpoint functions, profiling) might be slow, slower dev too maybe.
Need proof-of-concept.
