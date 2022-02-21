"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SerialTestHarness = void 0;
const emu_1 = require("../common/emu");
const devel_1 = require("../machine/devel");
const baseplatform_1 = require("../common/baseplatform");
const util_1 = require("../common/util");
const teletype_1 = require("../common/teletype");
const ui_1 = require("../ide/ui");
var DEVEL_6502_PRESETS = [
    { id: 'hello.dasm', name: 'Hello World (ASM)' },
];
class SerialInOutViewer {
    constructor(div) {
        div.style.overflowY = 'auto';
        var gameport = $('<div id="gameport"/>').appendTo(div);
        $('<p class="transcript-header">Serial Output</p>').appendTo(gameport);
        var windowport = $('<div id="windowport" class="transcript"/>').appendTo(gameport);
        this.div = windowport[0];
    }
    start() {
        this.tty = new teletype_1.TeleType(this.div, false);
        //this.tty.ncols = 40;
    }
    reset() {
        this.tty.clear();
    }
    saveState() {
        return this.tty.saveState();
    }
    loadState(state) {
        this.tty.loadState(state);
    }
}
function byteToASCII(b) {
    if (b == 10)
        return '';
    if (b < 32)
        return String.fromCharCode(b + 0x2400);
    else
        return String.fromCharCode(b);
}
class SerialTestHarness {
    constructor() {
        this.bufferedRead = true;
        this.cyclesPerByte = 1000000 / (57600 / 8); // 138.88888 cycles
        this.maxOutputBytes = 4096;
    }
    clearToSend() {
        return this.outputBytes.length < this.maxOutputBytes;
    }
    sendByte(b) {
        if (this.clearToSend()) {
            this.outputBytes.push(b);
            this.viewer.tty.addtext(byteToASCII(b), 2 | 32);
            if (b == 10)
                this.viewer.tty.newline();
            if (!this.clearToSend()) {
                this.viewer.tty.newline();
                this.viewer.tty.addtext("⚠️ OUTPUT BUFFER FULL ⚠️", 4);
            }
        }
    }
    byteAvailable() {
        return this.readIndex() > this.inputIndex;
    }
    recvByte() {
        var index = this.readIndex();
        this.inputIndex = index;
        var b = (this.inputBytes && this.inputBytes[index]) | 0;
        //this.bufin += byteToASCII(b);
        this.viewer.tty.addtext(byteToASCII(b), 2 | 16);
        if (b == 10)
            this.viewer.tty.newline();
        return b;
    }
    readIndex() {
        return this.bufferedRead ? (this.inputIndex + 1) : Math.floor(this.clk / this.cyclesPerByte);
    }
    reset() {
        this.inputIndex = -1;
        this.clk = 0;
        this.outputBytes = [];
        this.bufin = '';
    }
    advance(clocks) {
        this.clk += clocks;
    }
    saveState() {
        return {
            clk: this.clk,
            idx: this.inputIndex,
            out: this.outputBytes.slice()
        };
    }
    loadState(state) {
        this.clk = state.clk;
        this.inputIndex = state.idx;
        this.outputBytes = state.out.slice();
    }
}
exports.SerialTestHarness = SerialTestHarness;
class Devel6502Platform extends baseplatform_1.Base6502MachinePlatform {
    constructor(mainElement) {
        super(mainElement);
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'RAM', start: 0x0000, size: 0x4000, type: 'ram' },
                    { name: 'ROM', start: 0x8000, size: 0x8000, type: 'rom' },
                ] };
        };
        this.serview = new SerialInOutViewer(mainElement);
    }
    async start() {
        super.start();
        this.serial = new SerialTestHarness();
        this.serial.viewer = this.serview;
        this.serview.start();
        this.machine.connectSerialIO(this.serial);
    }
    reset() {
        this.serial.inputBytes = (0, util_1.convertDataToUint8Array)(this.internalFiles['serialin.dat']);
        super.reset();
        this.serview.reset();
    }
    isBlocked() {
        return this.machine.isHalted();
    }
    advance(novideo) {
        if (this.isBlocked()) {
            this.internalFiles['serialout.dat'] = (0, util_1.byteArrayToString)(this.serial.outputBytes);
            (0, ui_1.haltEmulation)();
            return 0;
        }
        return super.advance(novideo);
    }
    saveState() {
        var state = super.saveState();
        state.serial = this.serial.saveState();
        state.serview = this.serview.saveState();
        return state;
    }
    loadState(state) {
        super.loadState(state);
        this.serial.loadState(state.serial);
        this.serview.loadState(state.serview);
        // TODO: reload tty UI
    }
    newMachine() { return new devel_1.Devel6502(); }
    getPresets() { return DEVEL_6502_PRESETS; }
    getDefaultExtension() { return ".dasm"; }
    ;
    readAddress(a) { return this.machine.readConst(a); }
}
///
emu_1.PLATFORMS['devel-6502'] = Devel6502Platform;
//# sourceMappingURL=devel.js.map