"use strict";

import { Platform, BaseZ80Platform  } from "../baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap } from "../emu";
import { hex } from "../util";

// http://www.computerarcheology.com/Arcade/

const MW8080BW_PRESETS = [
  {id:'gfxtest.c', name:'Graphics Test'},
  {id:'shifter.c', name:'Sprite w/ Bit Shifter'},
  {id:'game2.c', name:'Cosmic Impalas'},
];

const _Midway8080BWPlatform = function(mainElement) {

  var cpu, ram, membus, iobus, rom;
  var probe;
  var video, timer, pixels, displayPCs;
  var inputs = [0xe,0x8,0x0];
  var bitshift_offset = 0;
  var bitshift_register = 0;
  var watchdog_counter;
  const cpuFrequency = 1996800;
  const cpuCyclesPerLine = cpuFrequency/(60*224); // TODO
  const INITIAL_WATCHDOG = 256;
  const PIXEL_ON = 0xffeeeeee;
  const PIXEL_OFF = 0xff000000;

	const SPACEINV_KEYCODE_MAP = makeKeycodeMap([
		[Keys.VK_SPACE, 1, 0x10], // P1
		[Keys.VK_LEFT, 1, 0x20],
		[Keys.VK_RIGHT, 1, 0x40],
		[Keys.VK_S, 2, 0x10], // P2
		[Keys.VK_A, 2, 0x20],
		[Keys.VK_D, 2, 0x40],
		[Keys.VK_5, 1, 0x1],
		[Keys.VK_1, 1, 0x4],
		[Keys.VK_2, 1, 0x2],
  ]);
  
 class Midway8080BWPlatform extends BaseZ80Platform {

  getPresets() {
    return MW8080BW_PRESETS;
  }

  start = function() {
    ram = new RAM(0x2000);
    //displayPCs = new Uint16Array(new ArrayBuffer(0x2000*2));
    membus = {
      read: newAddressDecoder([
				[0x0000, 0x1fff, 0x1fff, function(a) { return rom ? rom[a] : 0; }],
				[0x2000, 0x3fff, 0x1fff, function(a) { return ram.mem[a]; }],
			]),
			write: newAddressDecoder([
				[0x2000, 0x23ff, 0x3ff,  function(a,v) { ram.mem[a] = v; }],
				[0x2400, 0x3fff, 0x1fff, function(a,v) {
					ram.mem[a] = v;
					var ofs = (a - 0x400)<<3;
					for (var i=0; i<8; i++)
						pixels[ofs+i] = (v & (1<<i)) ? PIXEL_ON : PIXEL_OFF;
          if (displayPCs) displayPCs[a] = cpu.getPC(); // save program counter
				}],
			]),
      isContended: function() { return false; },
    };
    iobus = {
      read: function(addr) {
				addr &= 0x3;
        //console.log('IO read', hex(addr,4));
        switch (addr) {
          case 0:
          case 1:
          case 2:
            return inputs[addr];
          case 3:
            return (bitshift_register >> (8-bitshift_offset)) & 0xff;
        }
        return 0;
    	},
    	write: function(addr, val) {
				addr &= 0x7;
				val &= 0xff;
        //console.log('IO write', hex(addr,4), hex(val,2));
        switch (addr) {
          case 2:
            bitshift_offset = val & 0x7;
            break;
          case 3:
          case 5:
            // TODO: sound
            break;
          case 4:
            bitshift_register = (bitshift_register >> 8) | (val << 8);
            break;
          case 6:
            watchdog_counter = INITIAL_WATCHDOG;
            break;
        }
    	}
    };
    cpu = this.newCPU(membus, iobus);
    video = new RasterVideo(mainElement,256,224,{rotate:-90});
    video.create();
		$(video.canvas).click(function(e) {
			var x = Math.floor(e.offsetX * video.canvas.width / $(video.canvas).width());
			var y = Math.floor(e.offsetY * video.canvas.height / $(video.canvas).height());
			var addr = (x>>3) + (y*32) + 0x400;
      if (displayPCs) console.log(x, y, hex(addr,4), "PC", hex(displayPCs[addr],4));
		});
    var idata = video.getFrameData();
		setKeyboardFromMap(video, inputs, SPACEINV_KEYCODE_MAP);
    pixels = video.getFrameData();
    timer = new AnimationTimer(60, this.advance.bind(this));
  }

  readAddress(addr) {
    return membus.read(addr);
  }
  
  advance(novideo : boolean) {
    var debugCond = this.getDebugCallback();
    var targetTstates = cpu.getTstates();
    for (var sl=0; sl<224; sl++) {
      targetTstates += cpuCyclesPerLine;
      if (debugCond) {
        while (cpu.getTstates() < targetTstates) {
          if (debugCond && debugCond()) {
            debugCond = null;
            break;
          }
          cpu.runFrame(cpu.getTstates() + 1);
        }
        if (!debugCond)
          break;
      } else {
        cpu.runFrame(targetTstates);
      }
      if (sl == 95)
        cpu.requestInterrupt(0x8); // RST $8
      else if (sl == 223)
        cpu.requestInterrupt(0x10); // RST $10
    }
    if (!novideo) {
      video.updateFrame();
    }
    if (watchdog_counter-- <= 0) {
      console.log("WATCHDOG FIRED"); // TODO: alert on video
      this.reset();
    }
    this.restartDebugState();
  }

  loadROM(title, data) {
    rom = padBytes(data, 0x2000);
    this.reset();
  }

  loadState(state) {
    cpu.loadState(state.c);
    ram.mem.set(state.b);
    bitshift_register = state.bsr;
    bitshift_offset = state.bso;
    watchdog_counter = state.wdc;
    inputs[0] = state.in0;
    inputs[1] = state.in1;
    inputs[2] = state.in2;
  }
  saveState() {
    return {
      c:this.getCPUState(),
      b:ram.mem.slice(0),
      bsr:bitshift_register,
      bso:bitshift_offset,
      wdc:watchdog_counter,
      in0:inputs[0],
      in1:inputs[1],
      in2:inputs[2],
    };
  }
  loadControlsState(state) {
    inputs[0] = state.in0;
    inputs[1] = state.in1;
    inputs[2] = state.in2;
  }
  saveControlsState() {
    return {
      in0:inputs[0],
      in1:inputs[1],
      in2:inputs[2],
    };
  }
  getCPUState() {
    return cpu.saveState();
  }

  isRunning() {
    return timer && timer.isRunning();
  }
  pause() {
    timer.stop();
  }
  resume() {
    timer.start();
  }
  reset() {
    cpu.reset();
    cpu.setTstates(0);
    watchdog_counter = INITIAL_WATCHDOG;
  }
 }
  return new Midway8080BWPlatform();
}

PLATFORMS['mw8080bw'] = _Midway8080BWPlatform;
