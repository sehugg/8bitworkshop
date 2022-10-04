"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGear = exports.SMS = exports.SG1000 = void 0;
const vdp_z80_1 = require("./vdp_z80");
const emu_1 = require("../common/emu");
const util_1 = require("../common/util");
const audio_1 = require("../common/audio");
const tms9918a_1 = require("../common/video/tms9918a");
// http://www.smspower.org/Development/Index
// http://www.smspower.org/uploads/Development/sg1000.txt
// http://www.smspower.org/uploads/Development/richard.txt
// http://www.smspower.org/uploads/Development/msvdp-20021112.txt
// http://www.smspower.org/uploads/Development/SN76489-20030421.txt
var SG1000_KEYCODE_MAP = (0, emu_1.makeKeycodeMap)([
    [emu_1.Keys.UP, 0, 0x1],
    [emu_1.Keys.DOWN, 0, 0x2],
    [emu_1.Keys.LEFT, 0, 0x4],
    [emu_1.Keys.RIGHT, 0, 0x8],
    [emu_1.Keys.A, 0, 0x10],
    [emu_1.Keys.B, 0, 0x20],
    [emu_1.Keys.P2_UP, 0, 0x40],
    [emu_1.Keys.P2_DOWN, 0, 0x80],
    [emu_1.Keys.P2_LEFT, 1, 0x1],
    [emu_1.Keys.P2_RIGHT, 1, 0x2],
    [emu_1.Keys.P2_A, 1, 0x4],
    [emu_1.Keys.P2_B, 1, 0x8],
    [emu_1.Keys.VK_BACK_SLASH, 1, 0x10],
    [emu_1.Keys.VK_ENTER, 1, 0x80], // start/pause
]);
class SG1000 extends vdp_z80_1.BaseZ80VDPBasedMachine {
    constructor() {
        super();
        this.numVisibleScanlines = 240;
        this.defaultROMSize = 0xc000;
        this.ram = new Uint8Array(0x400);
        this.read = (0, emu_1.newAddressDecoder)([
            [0xc000, 0xffff, 0x3ff, (a) => { return this.ram[a]; }],
            [0x0000, 0xbfff, 0xffff, (a) => { return this.rom && this.rom[a]; }],
        ]);
        this.write = (0, emu_1.newAddressDecoder)([
            [0xc000, 0xffff, 0x3ff, (a, v) => { this.ram[a] = v; }],
        ]);
        this.init(this, this.newIOBus(), new audio_1.SN76489_Audio(new audio_1.MasterAudio()));
    }
    getKeyboardMap() { return SG1000_KEYCODE_MAP; }
    vdpInterrupt() {
        this.probe.logInterrupt(0xff);
        return this.cpu.interrupt(0xff); // RST 0x38
    }
    getVCounter() { return 0; }
    getHCounter() { return 0; }
    setMemoryControl(v) { }
    setIOPortControl(v) { }
    readIO(addr) {
        switch (addr & 0xc1) {
            case 0x40: return this.getVCounter();
            case 0x41: return this.getHCounter();
            case 0x80: return this.vdp.readData();
            case 0x81: return this.vdp.readStatus();
            case 0xc0: return this.inputs[0] ^ 0xff;
            case 0xc1: return this.inputs[1] ^ 0xff;
        }
        return 0;
    }
    writeIO(addr, val) {
        switch (addr & 0xc1) {
            case 0x00: return this.setMemoryControl(val);
            case 0x01: return this.setIOPortControl(val);
            case 0x40:
            case 0x41: return this.psg.setData(val);
            case 0x80: return this.vdp.writeData(val);
            case 0x81: return this.vdp.writeAddress(val);
        }
    }
    newIOBus() {
        return {
            read: (addr) => {
                addr &= 0xff;
                //console.log('IO read', hex(addr,4));
                return this.readIO(addr);
            },
            write: (addr, val) => {
                addr &= 0xff;
                val &= 0xff;
                //console.log('IO write', hex(addr,4), hex(val,2));
                this.writeIO(addr, val);
            }
        };
    }
}
exports.SG1000 = SG1000;
///
class SMS extends SG1000 {
    constructor() {
        super(...arguments);
        this.cartram = new Uint8Array(0);
        this.pagingRegisters = new Uint8Array(4);
        this.latchedHCounter = 0;
        this.ioControlFlags = 0;
        // TODO: hide bottom scanlines
        this.ram = new Uint8Array(0x2000);
        this.read = (0, emu_1.newAddressDecoder)([
            [0xc000, 0xffff, 0x1fff, (a) => { return this.ram[a]; }],
            [0x0000, 0x03ff, 0x3ff, (a) => { return this.rom && this.rom[a]; }],
            [0x0400, 0x3fff, 0x3fff, (a) => { return this.getPagedROM(a, 1); }],
            [0x4000, 0x7fff, 0x3fff, (a) => { return this.getPagedROM(a, 2); }],
            [0x8000, 0xbfff, 0x3fff, (a) => {
                    var reg0 = this.pagingRegisters[0]; // RAM select?
                    if (reg0 & 0x8) {
                        return this.cartram[(reg0 & 0x4) ? a + 0x4000 : a];
                    }
                    else {
                        return this.getPagedROM(a, 3);
                    }
                }],
        ]);
        this.write = (0, emu_1.newAddressDecoder)([
            [0xc000, 0xfffb, 0x1fff, (a, v) => {
                    this.ram[a] = v;
                }],
            [0xfffc, 0xffff, 0x3, (a, v) => {
                    this.pagingRegisters[a] = v;
                    this.ram[a + 0x1ffc] = v;
                }],
            [0x8000, 0xbfff, 0x3fff, (a, v) => {
                    var reg0 = this.pagingRegisters[0]; // RAM select?
                    if (reg0 & 0x8) {
                        if (this.cartram.length == 0)
                            this.cartram = new Uint8Array(0x8000); // create cartridge RAM lazily
                        this.cartram[(reg0 & 0x4) ? a + 0x4000 : a] = v;
                    }
                }],
        ]);
    }
    newVDP(frameData, cru, flicker) {
        return new tms9918a_1.SMSVDP(frameData, cru, flicker);
    }
    reset() {
        super.reset();
        this.pagingRegisters.set([0, 0, 1, 2]);
    }
    getVCounter() {
        var y = this.scanline;
        return (y <= 0xda) ? (y) : (y - 6);
    }
    getHCounter() {
        return this.latchedHCounter;
    }
    computeHCounter() {
        return 0;
        /*
        var t0 = this.startLineTstates;
        var t1 = this.cpu.getTstates();
        return (t1-t0) & 0xff; // TODO
        */
    }
    setIOPortControl(v) {
        if ((v ^ this.ioControlFlags) & 0xa0) { // either joystick TH pin
            this.latchedHCounter = this.computeHCounter();
            //console.log("H:"+hex(this.latchedHCounter)+" V:"+hex(this.getVCounter()));
        }
        this.ioControlFlags = v;
    }
    getPagedROM(a, reg) {
        //if (!(a&0xff)) console.log(hex(a), reg, this.pagingRegisters[reg], this.romPageMask);
        return this.rom && this.rom[a + ((this.pagingRegisters[reg] & this.romPageMask) << 14)]; // * $4000
    }
    loadROM(data) {
        if (data.length <= 0xc000) {
            this.rom = (0, emu_1.padBytes)(data, 0xc000);
            this.romPageMask = 3; // only pages 0, 1, 2
        }
        else {
            switch (data.length) {
                case 0x10000:
                case 0x20000:
                case 0x40000:
                case 0x80000:
                    this.rom = data;
                    this.romPageMask = (data.length >> 14) - 1; // div $4000
                    break;
                default:
                    throw Error("Unknown rom size: $" + (0, util_1.hex)(data.length));
            }
        }
        //console.log("romPageMask: " + hex(this.romPageMask));
        this.reset();
    }
    loadState(state) {
        super.loadState(state);
        this.pagingRegisters.set(state.pr);
        this.cartram.set(state.cr);
        this.latchedHCounter = state.lhc;
        this.ioControlFlags = state.iocf;
    }
    saveState() {
        var state = super.saveState();
        state['pr'] = this.pagingRegisters.slice(0);
        state['cr'] = this.cartram.slice(0);
        state['lhc'] = this.latchedHCounter;
        state['iocf'] = this.ioControlFlags;
        return state;
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'SMS': // TODO
                return super.getDebugInfo(category, state) +
                    "\nBank Regs: " + this.pagingRegisters + "\n";
            default: return super.getDebugInfo(category, state);
        }
    }
}
exports.SMS = SMS;
// https://segaretro.org/images/1/16/Sega_Game_Gear_Hardware_Reference_Manual.pdf
class GameGear extends SMS {
    newVDP(frameData, cru, flicker) {
        return new tms9918a_1.GameGearVDP(frameData, cru, flicker);
    }
    readIO(addr) {
        switch (addr & 0xc1) {
            case 0x00: return (~this.inputs[1] & 0x80) | 0x40;
            case 0xdc: return this.inputs[0] ^ 0xff;
            case 0xdd: return this.inputs[1] ^ 0xff;
        }
        return super.readIO(addr);
    }
}
exports.GameGear = GameGear;
//# sourceMappingURL=sms.js.map