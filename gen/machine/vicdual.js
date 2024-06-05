"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VicDual = void 0;
const ZilogZ80_1 = require("../common/cpu/ZilogZ80");
const devices_1 = require("../common/devices");
const emu_1 = require("../common/emu");
const audio_1 = require("../common/audio");
const CARNIVAL_KEYCODE_MAP = (0, emu_1.makeKeycodeMap)([
    [emu_1.Keys.A, 2, -0x20],
    [emu_1.Keys.B, 2, -0x40],
    [emu_1.Keys.LEFT, 1, -0x10],
    [emu_1.Keys.RIGHT, 1, -0x20],
    [emu_1.Keys.UP, 1, -0x40],
    [emu_1.Keys.DOWN, 1, -0x80],
    [emu_1.Keys.START, 2, -0x10],
    [emu_1.Keys.P2_START, 3, -0x20],
    [emu_1.Keys.SELECT, 3, 0x8],
]);
const XTAL = 15468000.0;
const scanlinesPerFrame = 0x106;
const vblankStart = 0xe0;
const vsyncStart = 0xec;
const vsyncEnd = 0xf0;
const cpuFrequency = XTAL / 8;
const hsyncFrequency = XTAL / 3 / scanlinesPerFrame;
const vsyncFrequency = hsyncFrequency / 0x148;
const cpuCyclesPerLine = cpuFrequency / hsyncFrequency;
const timerFrequency = 500; // input 2 bit 0x8
const cyclesPerTimerTick = cpuFrequency / (2 * timerFrequency);
const audioOversample = 2;
const audioSampleRate = 60 * scanlinesPerFrame; // why not hsync?
class VicDual extends devices_1.BasicScanlineMachine {
    constructor() {
        super();
        this.cpuFrequency = XTAL / 8; // MHz
        this.canvasWidth = 256;
        this.numTotalScanlines = 262;
        this.numVisibleScanlines = 224;
        this.defaultROMSize = 0x4040;
        this.sampleRate = audioSampleRate * audioOversample;
        this.cpuCyclesPerLine = cpuCyclesPerLine | 0;
        this.rotate = -90;
        this.cpu = new ZilogZ80_1.Z80();
        this.ram = new Uint8Array(0x1000);
        this.read = (0, emu_1.newAddressDecoder)([
            [0x0000, 0x7fff, 0x3fff, (a) => { return this.rom ? this.rom[a] : null; }],
            [0x8000, 0xffff, 0x0fff, (a) => { return this.ram[a]; }],
        ]);
        this.write = (0, emu_1.newAddressDecoder)([
            [0x8000, 0xffff, 0x0fff, (a, v) => { this.ram[a] = v; }],
        ]);
        this.connectCPUMemoryBus(this);
        this.connectCPUIOBus(this.newIOBus());
        this.inputs.set([0xff, 0xff, 0xff, 0xff ^ 0x8]); // most things active low
        this.display = new VicDualDisplay();
        this.handler = (0, emu_1.newKeyboardHandler)(this.inputs, CARNIVAL_KEYCODE_MAP, this.getKeyboardFunction());
        this.psg = new audio_1.AY38910_Audio(new audio_1.MasterAudio());
        this.audioadapter = new audio_1.TssChannelAdapter(this.psg.psg, audioOversample, this.sampleRate);
    }
    getKeyboardFunction() {
        return (o) => {
            // reset when coin inserted
            if (o.index == 3 && o.mask == 0x8) {
                this.cpu.reset();
                console.log("coin inserted");
                console.log(this.inputs);
            }
        };
    }
    ;
    newIOBus() {
        return {
            read: (addr) => {
                return this.inputs[addr & 3];
            },
            write: (addr, val) => {
                if (addr & 0x1) {
                    this.psg.selectRegister(val & 0xf);
                }
                ; // audio 1
                if (addr & 0x2) {
                    this.psg.setData(val);
                }
                ; // audio 2
                if (addr & 0x8) { }
                ; // TODO: assert coin status
                if (addr & 0x40) {
                    this.display.palbank = val & 3;
                }
                ; // palette
            }
        };
    }
    reset() {
        super.reset();
        this.psg.reset();
    }
    startScanline() {
        this.inputs[2] &= ~0x8;
        this.inputs[2] |= ((this.frameCycles / cyclesPerTimerTick) & 1) << 3;
        if (this.scanline == vblankStart)
            this.inputs[1] |= 0x8;
        if (this.scanline == vsyncEnd)
            this.inputs[1] &= ~0x8;
        this.audio && this.audioadapter.generate(this.audio);
    }
    drawScanline() {
        this.display.drawScanline(this.ram, this.pixels, this.scanline);
    }
    loadROM(data) {
        super.loadROM(data);
        if (data.length >= 0x4020 && (data[0x4000] || data[0x401f])) {
            this.display.colorprom = data.slice(0x4000, 0x4020);
        }
    }
    loadState(state) {
        super.loadState(state);
        this.display.palbank = state.pb;
    }
    saveState() {
        var state = super.saveState();
        state['pb'] = this.display.palbank;
        return state;
    }
}
exports.VicDual = VicDual;
class VicDualDisplay {
    constructor() {
        this.palbank = 0;
        this.palette = [
            0xff000000, // black
            0xff0000ff, // red
            0xff00ff00, // green
            0xff00ffff, // yellow
            0xffff0000, // blue
            0xffff00ff, // magenta
            0xffffff00, // cyan
            0xffffffff // white
        ];
        // default PROM
        this.colorprom = [
            0xe0, 0x60, 0x20, 0x60, 0xc0, 0x60, 0x40, 0xc0,
            0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0, 0x0e,
            0xe0, 0xe0, 0xe0, 0xe0, 0x60, 0x60, 0x60, 0x60,
            0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0,
        ];
    }
    // videoram 0xc000-0xc3ff
    // RAM      0xc400-0xc7ff
    // charram  0xc800-0xcfff
    drawScanline(ram, pixels, sl) {
        if (sl >= 224)
            return;
        var pixofs = sl * 256;
        var outi = pixofs; // starting output pixel in frame buffer
        var vramofs = (sl >> 3) << 5; // offset in VRAM
        var yy = sl & 7; // y offset within tile
        for (var xx = 0; xx < 32; xx++) {
            var code = ram[vramofs + xx];
            var data = ram[0x800 + (code << 3) + yy];
            var col = (code >> 5) + (this.palbank << 3);
            var color1 = this.palette[(this.colorprom[col] >> 1) & 7];
            var color2 = this.palette[(this.colorprom[col] >> 5) & 7];
            for (var i = 0; i < 8; i++) {
                var bm = 128 >> i;
                pixels[outi] = (data & bm) ? color2 : color1;
                outi++;
            }
        }
    }
}
//# sourceMappingURL=vicdual.js.map