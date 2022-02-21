"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const emu_1 = require("../common/emu");
const kim1_1 = require("../machine/kim1");
const baseplatform_1 = require("../common/baseplatform");
var KIM1_PRESETS = [
    { id: 'hello.dasm', name: 'Hello World (ASM)' },
];
class KIM1Platform extends baseplatform_1.Base6502MachinePlatform {
    constructor() {
        super(...arguments);
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'RAM', start: 0x0000, size: 0x1400, type: 'ram' },
                    { name: '6530', start: 0x1700, size: 0x0040, type: 'io' },
                    { name: '6530', start: 0x1740, size: 0x0040, type: 'io' },
                    { name: 'RAM', start: 0x1780, size: 0x0080, type: 'ram' },
                    { name: 'BIOS', start: 0x1800, size: 0x0800, type: 'rom' },
                ] };
        };
    }
    newMachine() { return new kim1_1.KIM1(); }
    getPresets() { return KIM1_PRESETS; }
    getDefaultExtension() { return ".dasm"; }
    ;
    readAddress(a) { return this.machine.readConst(a); }
}
///
emu_1.PLATFORMS['kim1'] = KIM1Platform;
//# sourceMappingURL=kim1.js.map