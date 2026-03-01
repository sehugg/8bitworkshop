import { WasmBoy } from 'wasmboy';
import { EXTENSIONS_Z80, getToolForFilename_z80, Platform, Preset } from "../common/baseplatform";
import { PLATFORMS, RasterVideo } from "../common/emu";

const GB_PRESETS: Preset[] = [
  { id: 'hello.sgb', name: 'Hello (ASM)' },
];

class GameBoyPlatform implements Platform {

  mainElement;
  video;
  audioFrequency = 22050;
  frameIndex = 0;

  machine = { cpuCyclesPerLine: 114 }; // TODO: adjust for GameBoy

  constructor(mainElement) {
    //super();
    this.mainElement = mainElement;
  }

  getPresets() { return GB_PRESETS; }

  async start() {
    this.video = new RasterVideo(this.mainElement, 160, 144, { overscan: false });
    this.video.create();

    // Initialize WasmBoy
    const config = {
      headless: false,
      useFrameSkip: false,
      audioBatchProcessing: false,
      timersBatchProcessing: false,
      audioAccumulateSamples: false,
      graphicsBatchProcessing: false,
      graphicsDisableScanlineRendering: false,
      tileRendering: true,
      tileCaching: true,
    };

    await WasmBoy.config(config, this.video.canvas, this.audioFrequency);
  }

  pollControls() {
    // WasmBoy handles controller polling internally
    // No need to implement this method
  }

  advance(novideo: boolean): number {
    // WasmBoy handles frame timing internally
    return 70224; // Game Boy CPU cycles per frame
  }

  async loadROM(title, data) {
    var romArray = new Uint8Array(data);
    await WasmBoy.loadROM(romArray);
    this.frameIndex = 0;
  }

  reset() {
    WasmBoy.reset();
  }

  isRunning() {
    return WasmBoy.isPlaying();
  }

  pause() {
    WasmBoy.pause();
  }

  resume() {
    WasmBoy.play();
  }

  getOriginPC() {
    return 0x100; // GameBoy boot vector
  }

  getDefaultExtension() {
    return ".c";
  }

  getROMExtension() {
    return ".gb";
  }

  getExtensions() { return EXTENSIONS_Z80; }
  getToolForFilename = (fn: string): string => {
    return getToolForFilename_z80(fn);
  }

  getMemoryMap = function () {
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
  };

  showHelp() {
    return "https://8bitworkshop.com/docs/platforms/gameboy/";
  }
}

PLATFORMS['gb'] = GameBoyPlatform;
PLATFORMS['gameboy'] = GameBoyPlatform;
