"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wasmboy_1 = require("wasmboy");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const GB_PRESETS = [
    { id: 'hello.sgb', name: 'Hello (ASM)' },
];
class GameBoyPlatform {
    constructor(mainElement) {
        this.audioFrequency = 22050;
        this.frameIndex = 0;
        this.machine = { cpuCyclesPerLine: 114 }; // TODO: adjust for GameBoy
        this.getToolForFilename = (fn) => {
            return (0, baseplatform_1.getToolForFilename_z80)(fn);
        };
        this.getMemoryMap = function () {
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
        //super();
        this.mainElement = mainElement;
    }
    getPresets() { return GB_PRESETS; }
    async start() {
        this.video = new emu_1.RasterVideo(this.mainElement, 160, 144, { overscan: false });
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
        await wasmboy_1.WasmBoy.config(config, this.video.canvas, this.audioFrequency);
    }
    pollControls() {
        // WasmBoy handles controller polling internally
        // No need to implement this method
    }
    advance(novideo) {
        // WasmBoy handles frame timing internally
        return 70224; // Game Boy CPU cycles per frame
    }
    async loadROM(title, data) {
        var romArray = new Uint8Array(data);
        await wasmboy_1.WasmBoy.loadROM(romArray);
        this.frameIndex = 0;
    }
    reset() {
        wasmboy_1.WasmBoy.reset();
    }
    isRunning() {
        return wasmboy_1.WasmBoy.isPlaying();
    }
    pause() {
        wasmboy_1.WasmBoy.pause();
    }
    resume() {
        wasmboy_1.WasmBoy.play();
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
    showHelp() {
        return "https://8bitworkshop.com/docs/platforms/gameboy/";
    }
}
emu_1.PLATFORMS['gb'] = GameBoyPlatform;
emu_1.PLATFORMS['gameboy'] = GameBoyPlatform;
//# sourceMappingURL=gb.js.map