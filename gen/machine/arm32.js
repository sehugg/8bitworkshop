"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARM32Machine = void 0;
const ARM_1 = require("../common/cpu/ARM");
const devices_1 = require("../common/devices");
const emu_1 = require("../common/emu");
const util_1 = require("../common/util");
var GBA_KEYCODE_MAP = (0, emu_1.makeKeycodeMap)([
    [emu_1.Keys.A, 0, 0x1],
    [emu_1.Keys.B, 0, 0x2],
    [emu_1.Keys.SELECT, 0, 0x4],
    [emu_1.Keys.START, 0, 0x8],
    [emu_1.Keys.RIGHT, 0, 0x10],
    [emu_1.Keys.LEFT, 0, 0x20],
    [emu_1.Keys.UP, 0, 0x40],
    [emu_1.Keys.DOWN, 0, 0x80],
]);
const ROM_START = 0x0;
const ROM_SIZE = 0x80000;
const RAM_START = 0x2000000;
const RAM_SIZE = 0x80000;
const IO_START = 0x4000000;
const IO_SIZE = 0x100;
const MAX_SERIAL_CHARS = 1000000;
const CPU_FREQ = 4000000; // 4 MHz
class ARM32Machine extends devices_1.BasicScanlineMachine {
    constructor() {
        super();
        this.cpuFrequency = CPU_FREQ; // MHz
        this.canvasWidth = 160;
        this.numTotalScanlines = 256;
        this.numVisibleScanlines = 128;
        this.cpuCyclesPerLine = Math.floor(CPU_FREQ / (256 * 60));
        this.defaultROMSize = 512 * 1024;
        this.sampleRate = 1;
        this.cpu = new ARM_1.ARM32CPU();
        this.ram = new Uint8Array(96 * 1024);
        this.ram16 = new Uint16Array(this.ram.buffer);
        this.vidbase = 0;
        this.brightness = 255;
        // TODO: 32-bit bus?
        this.read = (0, emu_1.newAddressDecoder)([
            [ROM_START, ROM_START + ROM_SIZE - 1, ROM_SIZE - 1, (a) => {
                    return this.rom ? this.rom[a] : 0;
                }],
            [RAM_START, RAM_START + RAM_SIZE - 1, RAM_SIZE - 1, (a) => {
                    return this.ram[a];
                }],
            [IO_START, IO_START + IO_SIZE - 1, IO_SIZE - 1, (a, v) => {
                    return this.readIO(a);
                }],
            [0, (1 << 31) - 1, 0, (a, v) => {
                    throw new emu_1.EmuHalt(`Address read out of bounds: 0x${(0, util_1.hex)(a)}`);
                }]
        ]);
        this.write = (0, emu_1.newAddressDecoder)([
            [RAM_START, RAM_START + RAM_SIZE - 1, RAM_SIZE - 1, (a, v) => {
                    this.ram[a] = v;
                }],
            [IO_START, IO_START + IO_SIZE - 1, IO_SIZE - 1, (a, v) => {
                    this.writeIO(a, v);
                }],
        ]);
        this.connectCPUMemoryBus(this);
        this.handler = (0, emu_1.newKeyboardHandler)(this.inputs, GBA_KEYCODE_MAP);
    }
    connectVideo(pixels) {
        super.connectVideo(pixels);
        this.pixels32 = pixels;
        this.pixels8 = new Uint8Array(pixels.buffer);
    }
    connectSerialIO(serial) {
        this.serial = serial;
    }
    reset() {
        super.reset();
        this.serialOut = [];
        this.serialIn = [];
    }
    readIO(a) {
        switch (a) {
            case 0x0:
                return this.inputs[0];
            case 0x40:
                return (this.serial.byteAvailable() ? 0x80 : 0) | (this.serial.clearToSend() ? 0x40 : 0);
            case 0x44:
                let evin = this.serialIn.shift();
                if (evin != null) {
                    this.serialOut.push(evin);
                    return evin.value;
                }
                else
                    return 0;
            default:
                return 0;
        }
    }
    writeIO(a, v) {
        switch (a) {
            case 0x0:
                //this.brightness = v & 0xff;
                break;
            case 0x48:
                if (this.serialOut.length < MAX_SERIAL_CHARS) {
                    this.serialOut.push({ op: 'write', value: v, nbits: 8 });
                }
                break;
        }
    }
    startScanline() {
    }
    drawScanline() {
    }
    postFrame() {
        var p32 = this.pixels32;
        var vbase = (this.vidbase >> 1) & 0xfffff;
        var mask = this.brightness << 24;
        for (var i = 0; i < p32.length; i++) {
            var col = this.ram16[i + vbase];
            // rrrrrgggggbbbbb0 ->
            // 000rrrrr000ggggg000bbbbb00011111111
            p32[i] = mask | ((col & 31) << 3) | (((col >> 5) & 31) << 11) | (((col >> 10) & 31) << 19);
        }
    }
    getDebugCategories() {
        return ['CPU', 'Stack'];
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'CPU':
                var s = '';
                var c = state.c;
                const EXEC_MODE = { 2: 'Thumb', 4: 'ARM' };
                const REGNAMES = { 15: 'PC', 14: 'LR', 13: 'SP', 12: 'IP', 11: 'FP', 9: 'SB' };
                for (var i = 0; i < 16; i++) {
                    s += (0, util_1.lpad)(REGNAMES[i] || '', 3) + (0, util_1.lpad)('r' + i, 5) + '  ' + (0, util_1.hex)(c.gprs[i], 8) + '\n';
                }
                s += 'Flags ';
                s += c.cpsrN ? " N" : " -";
                s += c.cpsrV ? " V" : " -";
                s += c.cpsrF ? " F" : " -";
                s += c.cpsrZ ? " Z" : " -";
                s += c.cpsrC ? " C" : " -";
                s += c.cpsrI ? " I" : " -";
                s += '\n';
                s += 'MODE ' + EXEC_MODE[c.instructionWidth] + ' ' + MODE_NAMES[c.mode] + '\n';
                s += 'SPSR ' + (0, util_1.hex)(c.spsr, 8) + '\n';
                s += 'cycl ' + c.cycles + '\n';
                return s;
        }
    }
    saveState() {
        var state = super.saveState();
        state.serial = {
            sin: this.serialIn.slice(0),
            sout: this.serialOut.slice(0)
        };
        return state;
    }
    loadState(state) {
        super.loadState(state);
        this.serialIn = state.serial.sin;
        this.serialOut = state.serial.sout;
    }
}
exports.ARM32Machine = ARM32Machine;
const MODE_NAMES = {
    0x10: "USER",
    0x11: "FIQ",
    0x12: "IRQ",
    0x13: "SUPERVISOR",
    0x17: "ABORT",
    0x1b: "UNDEFINED",
    0x1f: "SYSTEM",
};
//# sourceMappingURL=arm32.js.map