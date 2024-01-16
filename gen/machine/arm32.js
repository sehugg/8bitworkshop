"use strict";
/*
 * Copyright (c) 2024 Steven E. Hugg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARM32Machine = void 0;
const ARM_1 = require("../common/cpu/ARM");
const devices_1 = require("../common/devices");
const emu_1 = require("../common/emu");
const util_1 = require("../common/util");
var GBA_KEYCODE_MAP = (0, emu_1.makeKeycodeMap)([
    [emu_1.Keys.A, 0, 0x1],
    [emu_1.Keys.B, 0, 0x2],
    [emu_1.Keys.GP_A, 0, 0x1],
    [emu_1.Keys.GP_B, 0, 0x2],
    [emu_1.Keys.SELECT, 0, 0x4],
    [emu_1.Keys.START, 0, 0x8],
    [emu_1.Keys.RIGHT, 0, 0x10],
    [emu_1.Keys.LEFT, 0, 0x20],
    [emu_1.Keys.UP, 0, 0x40],
    [emu_1.Keys.DOWN, 0, 0x80],
]);
const RAM_START = 0x0;
const RAM_SIZE = 0x100000;
const ROM_BASE = 0x0;
const IO_START = 0x4000000;
const IO_SIZE = 0x100;
const MAX_SERIAL_CHARS = 1000000;
const CPU_FREQ = 4000000; // 4 MHz
const ILLEGAL_OPCODE = 0xedededed;
class ARM32Machine extends devices_1.BasicScanlineMachine {
    constructor() {
        super();
        this.cpuFrequency = CPU_FREQ; // MHz
        this.canvasWidth = 160;
        this.numTotalScanlines = 256;
        this.numVisibleScanlines = 128;
        this.cpuCyclesPerLine = Math.floor(CPU_FREQ / (256 * 60));
        this.defaultROMSize = RAM_SIZE - ROM_BASE;
        this.sampleRate = 1;
        this.cpu = new ARM_1.ARM32CPU();
        this.ram = new Uint8Array(RAM_SIZE);
        this.ram16 = new Uint16Array(this.ram.buffer);
        this.ram32 = new Uint32Array(this.ram.buffer);
        this.rombase = ROM_BASE;
        this.brightness = 255;
        this.ioregs = new Uint8Array(IO_SIZE);
        this.ioregs32 = new Uint32Array(this.ioregs.buffer);
        // TODO: 32-bit bus?
        this.read = (0, emu_1.newAddressDecoder)([
            [RAM_START, RAM_START + RAM_SIZE - 1, RAM_SIZE - 1, (a) => {
                    return this.ram[a];
                }],
            [IO_START, IO_START + IO_SIZE - 1, IO_SIZE - 1, (a, v) => {
                    return this.readIO(a);
                }],
        ], { defaultval: ILLEGAL_OPCODE & 0xff });
        this.write = (0, emu_1.newAddressDecoder)([
            [RAM_START, RAM_START + RAM_SIZE - 1, RAM_SIZE - 1, (a, v) => {
                    this.ram[a] = v;
                }],
            [IO_START, IO_START + IO_SIZE - 1, IO_SIZE - 1, (a, v) => {
                    this.writeIO(a, v);
                }],
        ]);
        this.read32 = (a) => {
            if (a >= RAM_START && a < RAM_SIZE && (a & 3) == 0) {
                return this.ram32[a >> 2];
            }
            else {
                return this.read(a) | (this.read(a + 1) << 8) | (this.read(a + 2) << 16) | (this.read(a + 3) << 24);
            }
        };
        this.write32 = (a, v) => {
            if (a >= RAM_START && a < RAM_SIZE && (a & 3) == 0) {
                this.ram32[a >> 2] = v;
            }
            else {
                this.write(a, v & 0xff);
                this.write(a + 1, (v >> 8) & 0xff);
                this.write(a + 2, (v >> 16) & 0xff);
                this.write(a + 3, (v >> 24) & 0xff);
            }
        };
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
    loadROM(rom) {
        super.loadROM(rom);
    }
    reset() {
        this.ram.fill(0);
        if (this.rom) {
            this.ram.set(this.rom, this.rombase);
        }
        super.reset();
        this.serialOut = [];
        this.serialIn = [];
    }
    readAddress(a) {
        if (a >= RAM_START && a < RAM_START + RAM_SIZE)
            return this.read(a);
        else
            return ILLEGAL_OPCODE;
    }
    readIO(a) {
        switch (a) {
            case 0x0:
                return this.inputs[0];
            case 0x20:
                return this.getRasterY() & 0xff;
            case 0x21:
                return this.getRasterY() >> 8;
            case 0x24:
                return this.getRasterX();
            case 0x25:
                return this.getRasterX() >> 8;
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
        this.ioregs[a] = v;
        switch (a) {
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
        const vidbase = this.ioregs32[0x80 >> 2];
        var vbase = (vidbase >> 1) & 0xfffff;
        var mask = this.brightness << 24;
        for (var i = 0; i < p32.length; i++) {
            var col = this.ram16[i + vbase];
            // rrrrrgggggbbbbb0 ->
            // 000rrrrr000ggggg000bbbbb00011111111
            p32[i] = mask | ((col & 31) << 3) | (((col >> 5) & 31) << 11) | (((col >> 10) & 31) << 19);
        }
    }
    getDebugCategories() {
        return ['CPU', 'Stack', 'FPU'];
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'Stack':
                var s = '';
                var c = state.c;
                var sp = c.gprs[13];
                var fp = c.gprs[11];
                // dump stack using ram32
                for (var i = 0; i < 16; i++) {
                    s += (0, util_1.hex)(sp, 8) + '  ' + (0, util_1.hex)(this.ram32[(sp - RAM_START) >> 2], 8);
                    if (sp == fp)
                        s += ' FP';
                    s += '\n';
                    sp += 4;
                    if (sp >= RAM_START + RAM_SIZE)
                        break;
                }
                return s;
            case 'CPU':
                var s = '';
                var c = state.c;
                const EXEC_MODE = { 2: 'Thumb', 4: 'ARM' };
                const REGNAMES = { 15: 'PC', 14: 'LR', 13: 'SP', 12: 'IP', 11: 'FP', 9: 'SB' };
                for (var i = 0; i < 8; i++) {
                    let j = i + 8;
                    s += (0, util_1.lpad)('r' + i, 5) + ' ' + (0, util_1.hex)(c.gprs[i], 8) + '   ';
                    s += (0, util_1.lpad)('r' + j, 5) + ' ' + (0, util_1.hex)(c.gprs[j], 8) + (0, util_1.lpad)(REGNAMES[j] || '', 3) + '\n';
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
            case 'FPU':
                var s = '';
                var c = state.c;
                for (var i = 0; i < 16; i++) {
                    //let j = i+16;
                    s += (0, util_1.lpad)('s' + i, 5) + ' ' + (0, util_1.hex)(c.ifprs[i], 8) + ' ' + c.sfprs[i].toPrecision(6);
                    if (i & 1) {
                        s += (0, util_1.lpad)('d' + (i >> 1), 5) + ' ' + c.dfprs[i >> 1].toPrecision(12);
                    }
                    s += '\n';
                    //s += lpad('s'+j, 5) + ' ' + lpad(c.sfprs[j]+'',8) + '\n';
                }
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