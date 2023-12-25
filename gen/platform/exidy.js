"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const exidy_1 = require("../machine/exidy");
var EXIDY_PRESETS = [
    { id: 'minimal.c', name: 'Minimal Example', category: "C" },
];
class ExidyUGBPlatform extends baseplatform_1.Base6502MachinePlatform {
    newMachine() { return new exidy_1.ExidyUGBv2(); }
    getPresets() { return EXIDY_PRESETS; }
    getDefaultExtension() { return ".dasm"; }
    ;
    readAddress(a) { return this.machine.readConst(a); }
    getMemoryMap() {
        return { main: [
                { name: 'RAM', start: 0x00, size: 0x400, type: 'ram' },
                { name: 'Sprite I/O', start: 0x5000, size: 0x100, type: 'io' },
                { name: 'I/O', start: 0x5100, size: 0x3, type: 'io' },
                { name: 'PIA 6821', start: 0x5200, size: 0xf, type: 'io' },
                { name: 'Color Latches', start: 0x5210, size: 0x3, type: 'io' },
                { name: 'Screen RAM', start: 0x4000, size: 0x400, type: 'ram' },
                { name: 'Character RAM', start: 0x6800, size: 0x800, type: 'ram' },
                { name: 'Audio ROM', start: 0x5800, size: 0x2800, type: 'rom' },
                { name: 'Program ROM', start: 0x8000, size: 0x8000, type: 'rom' },
            ]
        };
    }
}
emu_1.PLATFORMS["exidy"] = ExidyUGBPlatform;
//# sourceMappingURL=exidy.js.map