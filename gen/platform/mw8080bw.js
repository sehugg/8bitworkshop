"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mw8080bw_1 = require("../machine/mw8080bw");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
// http://www.computerarcheology.com/Arcade/
const MW8080BW_PRESETS = [
    { id: 'gfxtest.c', name: 'Graphics Test' },
    { id: 'shifter.c', name: 'Sprite w/ Bit Shifter' },
    { id: 'game2.c', name: 'Cosmic Impalas' },
];
class Midway8080BWPlatform extends baseplatform_1.BaseZ80MachinePlatform {
    constructor() {
        super(...arguments);
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'Frame Buffer', start: 0x2400, size: 7168, type: 'ram' },
                ] };
        };
    }
    newMachine() { return new mw8080bw_1.Midway8080(); }
    getPresets() { return MW8080BW_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.read(a); }
    showHelp() { return "https://8bitworkshop.com/docs/platforms/arcade/index.html#midway-8080"; }
}
emu_1.PLATFORMS['mw8080bw'] = Midway8080BWPlatform;
//# sourceMappingURL=mw8080bw.js.map