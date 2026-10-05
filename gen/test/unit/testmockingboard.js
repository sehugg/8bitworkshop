"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const nodemock_1 = require("../../src/tools/nodemock");
(0, nodemock_1.mockGlobals)();
(0, nodemock_1.mockAudio)();
// imported after the browser globals are mocked (the machine pulls in the TSS
// audio channel objects)
const apple2_1 = require("../../src/machine/apple2");
// Poke one AY register the way Mockingboard software has to: put the register
// number on VIA port A, pulse BC1/BDIR on port B (bit 2 = /RESET stays high)
// to latch it, then put the data on port A and pulse again to write it.
function ayWrite(m, base, reg, val) {
    m.write(base, 0x04); // inactive, /RESET high
    m.write(base + 1, reg); // port A = register number
    m.write(base, 0x07); // BC1=1, BDIR=1 -> latch address
    m.write(base, 0x04); // inactive
    m.write(base + 1, val); // port A = data
    m.write(base, 0x06); // BC1=0, BDIR=1 -> write data
    m.write(base, 0x04); // inactive
}
function newMachine() {
    const m = new apple2_1.AppleII();
    m.connectVideo(new Uint32Array(m.canvasWidth * m.numVisibleScanlines));
    return m;
}
(0, mocha_1.describe)('Apple II Mockingboard', function () {
    (0, mocha_1.it)('clocks the AYs at the CPU rate (TSS wants twice the chip clock)', function () {
        const m = newMachine();
        for (const unit of m.mb.units)
            assert_1.default.strictEqual(unit.ay.psg.clock, m.cpuFrequency * 2);
    });
    (0, mocha_1.it)('programs the first AY through the slot 4 VIA', function () {
        const m = newMachine();
        ayWrite(m, 0xC400, 0, 145); // channel A period low
        ayWrite(m, 0xC400, 1, 0); // channel A period high
        ayWrite(m, 0xC400, 7, 0x3e); // enable tone A only
        ayWrite(m, 0xC400, 8, 15); // channel A volume
        assert_1.default.deepStrictEqual(Array.from(m.mb.units[0].ay.psg.register).slice(0, 9), [145, 0, 0, 0, 0, 0, 0, 0x3e, 15]);
    });
    (0, mocha_1.it)('programs the second AY at $C480 independently', function () {
        const m = newMachine();
        ayWrite(m, 0xC480, 6, 0x18); // noise period
        ayWrite(m, 0xC480, 7, 0x37); // noise A only
        ayWrite(m, 0xC480, 8, 15); // channel A volume
        // the first chip is untouched
        assert_1.default.deepStrictEqual(Array.from(m.mb.units[0].ay.psg.register), new Array(16).fill(0));
        assert_1.default.deepStrictEqual(Array.from(m.mb.units[1].ay.psg.register).slice(0, 9), [0, 0, 0, 0, 0, 0, 0x18, 0x37, 15]);
    });
    (0, mocha_1.it)('saves and restores both AY register files', function () {
        const m = newMachine();
        ayWrite(m, 0xC400, 8, 12);
        ayWrite(m, 0xC480, 8, 9);
        const state = m.saveState();
        ayWrite(m, 0xC400, 8, 0);
        ayWrite(m, 0xC480, 8, 0);
        m.loadState(state);
        assert_1.default.equal(m.mb.units[0].ay.psg.register[8], 12);
        assert_1.default.equal(m.mb.units[1].ay.psg.register[8], 9);
    });
});
//# sourceMappingURL=testmockingboard.js.map