"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const atari7800_1 = require("../machine/atari7800");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
var Atari7800_PRESETS = [
    { id: 'sprites.dasm', name: 'Sprites (ASM)' },
    { id: 'wsync.c', name: 'WSYNC' },
    { id: 'sprites.c', name: 'Double Buffering' },
    { id: 'scroll.c', name: 'Scrolling' },
];
class Atari7800Platform extends baseplatform_1.Base6502MachinePlatform {
    constructor() {
        super(...arguments);
        // TODO loadBIOS(bios)	{ this.machine.loadBIOS(a); }
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'TIA', start: 0x00, size: 0x20, type: 'io' },
                    { name: 'MARIA', start: 0x20, size: 0x20, type: 'io' },
                    { name: 'RAM (6166 Block 0)', start: 0x40, size: 0xc0, type: 'ram' },
                    { name: 'RAM (6166 Block 1)', start: 0x140, size: 0xc0, type: 'ram' },
                    { name: 'PIA', start: 0x280, size: 0x18, type: 'io' },
                    { name: 'RAM', start: 0x1800, size: 0x1000, type: 'ram' },
                    { name: 'Cartridge ROM', start: 0x4000, size: 0xc000, type: 'rom' },
                ] };
        };
    }
    newMachine() { return new atari7800_1.Atari7800(); }
    getPresets() { return Atari7800_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.readConst(a); }
    getROMExtension() { return ".a78"; }
}
///
emu_1.PLATFORMS['atari7800'] = Atari7800Platform;
//# sourceMappingURL=atari7800.js.map