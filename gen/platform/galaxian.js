"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const emu_1 = require("../common/emu");
const galaxian_1 = require("../machine/galaxian");
const baseplatform_1 = require("../common/baseplatform");
const GALAXIAN_PRESETS = [
    { id: 'gfxtest.c', name: 'Graphics Test' },
    { id: 'shoot2.c', name: 'Solarian Game' },
];
class GalaxianPlatform extends baseplatform_1.BaseZ80MachinePlatform {
    constructor() {
        super(...arguments);
        // TODO loadBIOS(bios)	{ this.machine.loadBIOS(a); }
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'Video RAM', start: 0x5000, size: 0x400, type: 'ram' },
                    { name: 'Sprite RAM', start: 0x5800, size: 0x100, type: 'ram' },
                    { name: 'I/O Registers', start: 0x6000, size: 0x2000, type: 'io' },
                ] };
        };
    }
    newMachine() { return new galaxian_1.GalaxianMachine(); }
    getPresets() { return GALAXIAN_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.readConst(a); }
    readVRAMAddress(a) { return (a < 0x800) ? this.machine.vram[a] : this.machine.oram[a - 0x800]; }
    showHelp() { return "https://8bitworkshop.com/docs/platforms/arcade/index.html#galaxian-scramble"; }
}
class GalaxianScramblePlatform extends GalaxianPlatform {
    newMachine() { return new galaxian_1.GalaxianScrambleMachine(); }
}
emu_1.PLATFORMS['galaxian'] = GalaxianPlatform;
emu_1.PLATFORMS['galaxian-scramble'] = GalaxianScramblePlatform;
//# sourceMappingURL=galaxian.js.map