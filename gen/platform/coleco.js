"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColecoVision_PRESETS = void 0;
const coleco_1 = require("../machine/coleco");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const mameplatform_1 = require("../common/mameplatform");
exports.ColecoVision_PRESETS = [
    { id: 'text.c', name: 'Text Mode' },
    { id: 'hello.c', name: 'Scrolling Text' },
    { id: 'text32.c', name: '32-Column Color Text' },
    { id: 'stars.c', name: 'Scrolling Starfield' },
    { id: 'cursorsmooth.c', name: 'Moving Cursor' },
    { id: 'simplemusic.c', name: 'Simple Music' },
    { id: 'musicplayer.c', name: 'Multivoice Music' },
    { id: 'mode2bitmap.c', name: 'Mode 2 Bitmap' },
    { id: 'mode2compressed.c', name: 'Mode 2 Bitmap (LZG)' },
    { id: 'lines.c', name: 'Mode 2 Lines' },
    { id: 'multicolor.c', name: 'Multicolor Mode' },
    { id: 'siegegame.c', name: 'Siege Game' },
    { id: 'shoot.c', name: 'Solarian Game' },
    { id: 'climber.c', name: 'Climber Game' },
];
class ColecoVisionPlatform extends baseplatform_1.BaseZ80MachinePlatform {
    constructor() {
        super(...arguments);
        // TODO loadBIOS(bios)	{ this.machine.loadBIOS(a); }
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'BIOS', start: 0x0, size: 0x2000, type: 'rom' },
                    { name: 'Cartridge Header', start: 0x8000, size: 0x100, type: 'rom' },
                ] };
        };
    }
    newMachine() { return new coleco_1.ColecoVision(); }
    getPresets() { return exports.ColecoVision_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.read(a); }
    readVRAMAddress(a) { return this.machine.readVRAMAddress(a); }
    showHelp() {
        return "https://8bitworkshop.com/docs/platforms/coleco/";
    }
}
/// MAME support
class ColecoVisionMAMEPlatform extends mameplatform_1.BaseMAMEZ80Platform {
    constructor() {
        super(...arguments);
        this.getToolForFilename = baseplatform_1.getToolForFilename_z80;
    }
    start() {
        this.startModule(this.mainElement, {
            jsfile: 'mame8bitws.js',
            cfgfile: 'coleco.cfg',
            biosfile: 'coleco/313 10031-4005 73108a.u2',
            driver: 'coleco',
            width: 280 * 2,
            height: 216 * 2,
            romfn: '/emulator/cart.rom',
            romsize: 0x8000,
            preInit: function (_self) {
            },
        });
    }
    loadROM(title, data) {
        this.loadROMFile(data);
        this.loadRegion(":coleco_cart:rom", data);
    }
    getPresets() { return exports.ColecoVision_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
}
///
emu_1.PLATFORMS['coleco.mame'] = ColecoVisionMAMEPlatform;
emu_1.PLATFORMS['coleco'] = ColecoVisionPlatform;
//# sourceMappingURL=coleco.js.map