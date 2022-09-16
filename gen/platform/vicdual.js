"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vicdual_1 = require("../machine/vicdual");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const VICDUAL_PRESETS = [
    { id: 'minimal.c', name: 'Minimal Example' },
    { id: 'hello.c', name: 'Hello World' },
    { id: 'gfxtest.c', name: 'Graphics Test' },
    { id: 'soundtest.c', name: 'Sound Test' },
    { id: 'snake1.c', name: 'Siege Game (Prototype)' },
    { id: 'snake2.c', name: 'Siege Game (Full)' },
    { id: 'music.c', name: 'Music Player' },
];
class VicDualPlatform extends baseplatform_1.BaseZ80MachinePlatform {
    constructor() {
        super(...arguments);
        // TODO loadBIOS(bios)	{ this.machine.loadBIOS(a); }
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'Cell RAM', start: 0xe000, size: 32 * 32, type: 'ram' },
                    { name: 'Tile RAM', start: 0xe800, size: 256 * 8, type: 'ram' },
                ] };
        };
    }
    newMachine() { return new vicdual_1.VicDual(); }
    getPresets() { return VICDUAL_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.read(a); }
    showHelp() { return "https://8bitworkshop.com/docs/platforms/arcade/index.html#vic-dual"; }
}
emu_1.PLATFORMS['vicdual'] = VicDualPlatform;
//# sourceMappingURL=vicdual.js.map