"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Devel6502 = void 0;
const MOS6502_1 = require("../common/cpu/MOS6502");
const devices_1 = require("../common/devices");
const emu_1 = require("../common/emu"); // TODO
const INPUT_HALTED = 31;
class Devel6502 extends devices_1.BasicHeadlessMachine {
    constructor() {
        super();
        this.cpuFrequency = 1000000;
        this.defaultROMSize = 0x8000;
        this.cpu = new MOS6502_1.MOS6502();
        this.ram = new Uint8Array(0x4000);
        this.read = (0, emu_1.newAddressDecoder)([
            [0x0000, 0x3fff, 0x3fff, (a) => { return this.ram[a]; }],
            [0x4000, 0x4000, 0xffff, (a) => { return this.serial.byteAvailable() ? 0x80 : 0; }],
            [0x4001, 0x4001, 0xffff, (a) => { return this.serial.recvByte(); }],
            [0x4002, 0x4002, 0xffff, (a) => { return this.serial.clearToSend() ? 0x80 : 0; }],
            [0x8000, 0xffff, 0x7fff, (a) => { return this.rom && this.rom[a]; }],
        ]);
        this.write = (0, emu_1.newAddressDecoder)([
            [0x0000, 0x3fff, 0x3fff, (a, v) => { this.ram[a] = v; }],
            [0x4003, 0x4003, 0xffff, (a, v) => { return this.serial.sendByte(v); }],
            [0x400f, 0x400f, 0xffff, (a, v) => { this.inputs[INPUT_HALTED] = 1; }],
        ]);
        this.connectCPUMemoryBus(this);
    }
    connectSerialIO(serial) {
        this.serial = serial;
    }
    readConst(a) {
        return this.read(a);
    }
    advanceFrame(trap) {
        var clock = 0;
        while (clock < this.cpuFrequency / 60) {
            if (trap && trap())
                break;
            clock += this.advanceCPU();
        }
        return clock;
    }
    advanceCPU() {
        if (this.isHalted())
            return 1;
        var n = super.advanceCPU();
        if (this.serial)
            this.serial.advance(n);
        return n;
    }
    reset() {
        this.inputs[INPUT_HALTED] = 0;
        super.reset();
        if (this.serial)
            this.serial.reset();
    }
    isHalted() { return this.inputs[INPUT_HALTED] != 0; }
}
exports.Devel6502 = Devel6502;
//# sourceMappingURL=devel.js.map