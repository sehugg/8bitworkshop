"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WilliamsSoundPlatform = void 0;
const ZilogZ80_1 = require("../common/cpu/ZilogZ80");
const devices_1 = require("../common/devices");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
var WILLIAMS_SOUND_PRESETS = [
    { id: 'swave.c', name: 'Wavetable Synth' },
];
/****************************************************************************

    Midway/Williams Audio Boards
    ----------------------------

    6809 MEMORY MAP

    Function                                  Address     R/W  Data
    ---------------------------------------------------------------
    Program RAM                               0000-07FF   R/W  D0-D7

    Music (YM-2151)                           2000-2001   R/W  D0-D7

    6821 PIA                                  4000-4003   R/W  D0-D7

    HC55516 clock low, digit latch            6000        W    D0
    HC55516 clock high                        6800        W    xx

    Bank select                               7800        W    D0-D2

    Banked Program ROM                        8000-FFFF   R    D0-D7

****************************************************************************/
class WilliamsSound extends devices_1.BasicMachine {
    constructor() {
        super();
        this.cpuFrequency = 18432000 / 6; // 3.072 MHz
        this.cpuCyclesPerFrame = this.cpuFrequency / 60;
        this.cpuAudioFactor = 32;
        this.canvasWidth = 256;
        this.numVisibleScanlines = 256;
        this.defaultROMSize = 0x4000;
        this.sampleRate = this.cpuFrequency;
        this.overscan = true;
        this.ram = new Uint8Array(0x400);
        this.command = 0;
        this.dac = 0;
        this.dac_float = 0;
        this.xpos = 0;
        this.read = (0, emu_1.newAddressDecoder)([
            [0x0000, 0x3fff, 0x3fff, (a) => { return this.rom && this.rom[a]; }],
            [0x4000, 0x7fff, 0x3ff, (a) => { return this.ram[a]; }]
        ]);
        this.write = (0, emu_1.newAddressDecoder)([
            [0x4000, 0x7fff, 0x3ff, (a, v) => { this.ram[a] = v; }],
        ]);
        this.cpu = new ZilogZ80_1.Z80();
        this.connectCPUMemoryBus(this);
        this.connectCPUIOBus({
            read: (addr) => {
                return this.command & 0xff;
            },
            write: (addr, val) => {
                let dac = this.dac = val & 0xff;
                this.dac_float = ((dac & 0x80) ? -256 + dac : dac) / 128.0;
            }
        });
    }
    advanceFrame(trap) {
        this.pixels && this.pixels.fill(0); // clear waveform
        let maxCycles = this.cpuCyclesPerFrame;
        var n = 0;
        while (n < maxCycles) {
            if (trap && trap()) {
                break;
            }
            n += this.advanceCPU();
        }
        return n;
    }
    advanceCPU() {
        var n = super.advanceCPU();
        this.audio && this.audio.feedSample(this.dac_float, n);
        // draw waveform on screen
        if (this.pixels && !this.cpu.isHalted()) {
            this.pixels[((this.xpos >> 8) & 0xff) + ((255 - this.dac) << 8)] = 0xff33ff33;
            this.xpos = (this.xpos + n) & 0xffffff;
        }
        return n;
    }
    setKeyInput(key, code, flags) {
        var intr = (key - 49);
        if (intr >= 0 && (flags & 1)) {
            this.command = intr & 0xff;
            this.cpu.reset();
        }
    }
}
class WilliamsSoundPlatform extends baseplatform_1.BaseZ80MachinePlatform {
    newMachine() { return new WilliamsSound(); }
    getPresets() { return WILLIAMS_SOUND_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.read(a); }
}
exports.WilliamsSoundPlatform = WilliamsSoundPlatform;
emu_1.PLATFORMS['sound_williams-z80'] = WilliamsSoundPlatform;
//# sourceMappingURL=sound_williams.js.map