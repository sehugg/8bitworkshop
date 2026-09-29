import { GameBoyMachine } from "../machine/gb";
import { BaseMachinePlatform, cpuStateToLongString_SM83, getToolForFilename_z80, Platform, Preset, dumpStackToString, isDebuggable, EmuState, DisasmLine } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { disassembleSM83 } from "../common/cpu/disasmSM83";

const GB_PRESETS: Preset[] = [
  { id: 'hello.c', name: 'Hello World', category: 'C' },
  { id: 'typewriter.c', name: 'Typewriter Text' },
  { id: 'testdrawing.c', name: 'Drawing Routines' },
  { id: 'joypad.c', name: 'Joypad Input' },
  { id: 'testphys.c', name: 'Sprite Movement' },
  { id: 'sprites.c', name: 'Multiple Sprites' },
  { id: 'metasprites.c', name: 'Metasprites' },
  { id: 'paint.c', name: 'Paint Program' },
  { id: 'scroll.c', name: 'Scrolling' },
  { id: 'large_map.c', name: 'Large Scrolling Map' },
  { id: 'window.c', name: 'Window Status Bar' },
  { id: 'galaxy.c', name: 'Window + Sprites' },
  { id: 'interrupts.c', name: 'VBlank + Timer Interrupts' },
  { id: 'vram.c', name: 'VRAM/OAM Access' },
  { id: 'detect.c', name: 'Detect Hardware' },
  { id: 'gbc.c', name: 'Game Boy Color' },
  { id: 'gbdecompress.c', name: 'Decompression' },
  { id: 'music.c', name: 'Music Player' },
  { id: 'aputest.c', name: 'Sound Tester' },
  { id: 'clock.c', name: 'MBC3 Real-Time Clock' },
  { id: 'savegame.c', name: 'Battery Save RAM' },
  { id: 'banking.c', name: 'ROM Bank Switching' },
  { id: 'flicker.c', name: 'Flicker Transparency', category: 'Advanced Graphics' },
  { id: 'parallax.c', name: 'Parallax Scrolling' },
  { id: 'animstream.c', name: 'Streaming Animation' },
  { id: 'raster.c', name: 'STAT/LYC Raster Effects' },
  { id: 'wireframe.c', name: 'Wireframe 3D' },
  { id: 'polyfill.c', name: 'Filled Polygons' },
  { id: 'raycast.c', name: 'Raycasting 3D' },
  { id: 'siegegame.c', name: 'Siege Game', category: 'Games' },
  { id: 'climber.c', name: 'Climber Game' },
  { id: 'chase.c', name: "Shiru's Chase Game" },
  { id: 'pakupaku.c', name: 'Paku Paku' },
  { id: 'sm83.c', name: 'C vs. Assembly', category: 'Assembler' },
  { id: 'hello.sgb', name: 'Hello World (ASM)' },
  { id: 'main.wiz', name: 'Snake Game (Wiz)' },
];

class GameBoyPlatform extends BaseMachinePlatform<GameBoyMachine> implements Platform {

  newMachine()          { return new GameBoyMachine(); }
  getPresets()          { return GB_PRESETS; }
  getDefaultExtensions() { return [".c", ".ns", ".s", ".scc", ".sgb", ".z", ".wiz"]; }
  getToolForFilename    = getToolForFilename_z80;
  readAddress(a)        { return this.machine.read(a); }
  readVRAMAddress(a)    { return this.machine.readVRAMAddress(a); }

  // DMG LCD response is slow; blend each frame with the last one shown.
  // Fraction of the previous frame retained (0 = off).
  lcdPersistence = 0.5;
  lcdPrevFrame: Uint32Array;

  async start() {
    await super.start();
    // only the browser canvas (headless stand-ins keep raw frames)
    if (typeof HTMLCanvasElement !== 'undefined' && this.video?.canvas instanceof HTMLCanvasElement) {
      const updateFrame = this.video.updateFrame.bind(this.video);
      this.video.updateFrame = (...args) => {
        this.applyLCDPersistence();
        updateFrame(...args);
      };
    }
  }

  applyLCDPersistence() {
    if (!(this.lcdPersistence > 0) || this.machine.cgbMode) {
      this.lcdPrevFrame = null;
      return;
    }
    const pixels = this.video.getFrameData();
    let prev = this.lcdPrevFrame;
    if (!prev || prev.length != pixels.length) {
      this.lcdPrevFrame = new Uint32Array(pixels);
      return;
    }
    // blend in place; lines the PPU redraws next frame get fresh values,
    // lines it doesn't (LCD off, breakpoint mid-frame) are already == prev
    const a = Math.round(this.lcdPersistence * 256);
    const b = 256 - a;
    for (let i = 0; i < pixels.length; i++) {
      const c = pixels[i];
      const p = prev[i];
      if (c === p) continue;
      const r = (((p & 0xff) * a + (c & 0xff) * b) >> 8);
      const g = ((((p >> 8) & 0xff) * a + ((c >> 8) & 0xff) * b) >> 8);
      const bl = ((((p >> 16) & 0xff) * a + ((c >> 16) & 0xff) * b) >> 8);
      prev[i] = pixels[i] = 0xff000000 | (bl << 16) | (g << 8) | r;
    }
  }

  getOriginPC() {
    return 0x100;
  }

  getROMExtension() {
    return ".gb";
  }

  getMemoryMap() {
    return {
      main: [
        { name: 'ROM Bank 0', start: 0x0000, size: 0x4000, type: 'rom' },
        { name: 'ROM Bank 1+', start: 0x4000, size: 0x4000, type: 'rom' },
        { name: 'Video RAM', start: 0x8000, size: 0x2000, type: 'ram' },
        { name: 'External RAM', start: 0xA000, size: 0x2000, type: 'ram' },
        { name: 'Work RAM', start: 0xC000, size: 0x2000, type: 'ram' },
        { name: 'OAM', start: 0xFE00, size: 0xA0, type: 'ram' },
        { name: 'I/O Registers', start: 0xFF00, size: 0x80, type: 'io' },
        { name: 'High RAM', start: 0xFF80, size: 0x7F, type: 'ram' },
      ]
    };
  }

  getDebugCategories() {
    if (isDebuggable(this.machine))
      return this.machine.getDebugCategories();
    else
      return ['CPU', 'Stack', 'PPU'];
  }

  getDebugInfo(category: string, state: EmuState): string {
    switch (category) {
      case 'CPU': return cpuStateToLongString_SM83(state.c);
      case 'Stack': {
        var sp = (state.c.SP - 1) & 0xFFFF;
        var start = sp & 0xFF00;
        var end = start + 0xFF;
        if (sp == 0) sp = 0x10000;
        return dumpStackToString(<Platform><any>this, [], start, end, sp, 0xCD);
      }
      default: return isDebuggable(this.machine) && this.machine.getDebugInfo(category, state);
    }
  }

  disassemble(pc: number, read: (addr: number) => number): DisasmLine {
    return disassembleSM83(pc, read(pc), read(pc + 1), read(pc + 2));
  }

  showHelp() {
    return "https://8bitworkshop.com/docs/platforms/gameboy/";
  }
}

class GameBoyColorPlatform extends GameBoyPlatform {

  lcdPersistence = 0;

  newMachine() {
    var m = new GameBoyMachine();
    // not needed, gb.color sets the CGB header byte to 0x80
    //m.forceColor = true;
    return m;
  }
  getPresets()          { return GB_PRESETS; }

  getROMExtension() {
    return ".gbc";
  }

  getMemoryMap() {
    return {
      main: [
        { name: 'ROM Bank 0', start: 0x0000, size: 0x4000, type: 'rom' },
        { name: 'ROM Bank 1+', start: 0x4000, size: 0x4000, type: 'rom' },
        { name: 'Video RAM B0', start: 0x8000, size: 0x2000, type: 'ram' },
        { name: 'External RAM', start: 0xA000, size: 0x2000, type: 'ram' },
        { name: 'Work RAM 0', start: 0xC000, size: 0x1000, type: 'ram' },
        { name: 'Work RAM 1-7', start: 0xD000, size: 0x1000, type: 'ram' },
        { name: 'OAM', start: 0xFE00, size: 0xA0, type: 'ram' },
        { name: 'I/O Registers', start: 0xFF00, size: 0x80, type: 'io' },
        { name: 'High RAM', start: 0xFF80, size: 0x7F, type: 'ram' },
      ]
    };
  }

  showHelp() {
    return "https://8bitworkshop.com/docs/platforms/gameboy/";
  }
}

PLATFORMS['gb'] = GameBoyPlatform;
PLATFORMS['gb.color'] = GameBoyColorPlatform;
