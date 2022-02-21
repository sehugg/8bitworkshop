"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseZ80VDPBasedMachine = void 0;
const ZilogZ80_1 = require("../common/cpu/ZilogZ80");
const devices_1 = require("../common/devices");
const emu_1 = require("../common/emu");
const audio_1 = require("../common/audio");
const tms9918a_1 = require("../common/video/tms9918a");
const audioOversample = 2;
class BaseZ80VDPBasedMachine extends devices_1.BasicScanlineMachine {
    constructor() {
        super(...arguments);
        this.cpuFrequency = 3579545; // MHz
        this.canvasWidth = 304;
        this.numTotalScanlines = 262;
        this.numVisibleScanlines = 240;
        this.cpuCyclesPerLine = this.cpuFrequency / (262 * 60);
        this.sampleRate = 262 * 60 * audioOversample;
        this.overscan = true;
        this.cpu = new ZilogZ80_1.Z80();
    }
    getKeyboardFunction() { return null; }
    init(membus, iobus, psg) {
        this.connectCPUMemoryBus(membus);
        this.connectCPUIOBus(iobus);
        this.handler = (0, emu_1.newKeyboardHandler)(this.inputs, this.getKeyboardMap(), this.getKeyboardFunction());
        this.psg = psg;
        this.audioadapter = psg && new audio_1.TssChannelAdapter(psg.psg, audioOversample, this.sampleRate);
    }
    connectVideo(pixels) {
        super.connectVideo(pixels);
        var cru = {
            setVDPInterrupt: (b) => {
                if (b) {
                    this.vdpInterrupt();
                }
                else {
                    // TODO: reset interrupt?
                }
            }
        };
        this.vdp = this.newVDP(this.pixels, cru, true);
    }
    connectProbe(probe) {
        super.connectProbe(probe);
        this.vdp.probe = probe || this.nullProbe;
    }
    newVDP(frameData, cru, flicker) {
        return new tms9918a_1.TMS9918A(frameData, cru, flicker);
    }
    startScanline() {
        this.audio && this.audioadapter && this.audioadapter.generate(this.audio);
    }
    drawScanline() {
        this.vdp.drawScanline(this.scanline);
    }
    loadState(state) {
        super.loadState(state);
        this.vdp.restoreState(state['vdp']);
    }
    saveState() {
        var state = super.saveState();
        state['vdp'] = this.vdp.getState();
        return state;
    }
    reset() {
        super.reset();
        this.vdp.reset();
        this.psg.reset();
    }
    getDebugCategories() {
        return ['CPU', 'Stack', 'VDP'];
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'VDP': return this.vdpStateToLongString(state.vdp);
        }
    }
    vdpStateToLongString(ppu) {
        return this.vdp.getRegsString();
    }
    readVRAMAddress(a) {
        return this.vdp.ram[a & 0x3fff];
    }
}
exports.BaseZ80VDPBasedMachine = BaseZ80VDPBasedMachine;
//# sourceMappingURL=vdp_z80.js.map