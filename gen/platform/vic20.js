"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vic20_1 = require("../machine/vic20");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const mameplatform_1 = require("../common/mameplatform");
const VIC20_PRESETS = [
    { id: 'hello.dasm', name: 'Hello World (ASM)' },
    { id: 'hellocart.dasm', name: 'Hello Cartridge (ASM)' },
    { id: 'siegegame.c', name: 'Siege Game (C)' },
];
const VIC20_MEMORY_MAP = { main: [
        { name: 'RAM', start: 0x0000, size: 0x0400, type: 'ram' },
        { name: 'RAM', start: 0x1000, size: 0x1000, type: 'ram' },
        { name: 'BLK1 Cart ROM', start: 0x2000, size: 0x2000, type: 'rom' },
        { name: 'BLK2 Cart ROM', start: 0x4000, size: 0x2000, type: 'rom' },
        { name: 'BLK3 Cart ROM', start: 0x6000, size: 0x2000, type: 'rom' },
        { name: 'Character ROM', start: 0x8000, size: 0x1000, type: 'rom' },
        { name: 'I/O 1', start: 0x9000, size: 0x0400, type: 'io' },
        { name: 'Color RAM', start: 0x9400, size: 0x0400, type: 'io' },
        { name: 'I/O 2', start: 0x9800, size: 0x0400, type: 'io' },
        { name: 'I/O 3', start: 0x9c00, size: 0x0400, type: 'io' },
        { name: 'BLK5 Autostart', start: 0xa000, size: 0x2000, type: 'rom' },
        { name: 'BASIC ROM', start: 0xc000, size: 0x2000, type: 'rom' },
        { name: 'KERNAL ROM', start: 0xe000, size: 0x2000, type: 'rom' },
    ] };
// WASM VIC20 platform
class VIC20WASMPlatform extends baseplatform_1.Base6502MachinePlatform {
    newMachine() { return new vic20_1.VIC20_WASMMachine('vic20'); }
    getPresets() { return VIC20_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.readConst(a); }
    getMemoryMap() { return VIC20_MEMORY_MAP; }
    showHelp() {
        return "https://8bitworkshop.com/docs/platforms/vic20/";
    }
    getROMExtension(rom) {
        /*
        if (rom && rom[0] == 0x00 && rom[1] == 0x80 && rom[2+4] == 0xc3 && rom[2+5] == 0xc2) return ".crt";
        */
        if (rom && rom[0] == 0x01 && rom[1] == 0x08)
            return ".prg";
        else
            return ".bin";
    }
}
// VIC20 MAME platform (TODO)
class VIC20MAMEPlatform extends mameplatform_1.BaseMAME6502Platform {
    constructor() {
        super(...arguments);
        this.getToolForFilename = baseplatform_1.getToolForFilename_6502;
        this.getOpcodeMetadata = baseplatform_1.getOpcodeMetadata_6502;
    }
    getPresets() { return VIC20_PRESETS; }
    getDefaultExtension() { return ".c"; }
    loadROM(title, data) {
        if (!this.started) {
            this.startModule(this.mainElement, {
                jsfile: 'mame8bitpc.js',
                biosfile: 'vic20.zip',
                cfgfile: 'vic20.cfg',
                driver: 'vic20',
                width: 418,
                height: 235,
                romfn: '/emulator/image.crt',
                romdata: new Uint8Array(data),
                romsize: 0x10000,
                extraargs: ['-autoboot_delay', '5', '-autoboot_command', 'load "$",8,1\n'],
                preInit: function (_self) {
                },
            });
        }
        else {
            this.loadROMFile(data);
            this.loadRegion(":quickload", data);
            var result = this.luacall(`image:load("/emulator/image.prg")`);
            console.log('load rom', result);
            //this.loadRegion(":exp:standard", data);
        }
    }
    start() {
    }
    getMemoryMap() { return VIC20_MEMORY_MAP; }
}
emu_1.PLATFORMS['vic20'] = VIC20WASMPlatform;
emu_1.PLATFORMS['vic20.wasm'] = VIC20WASMPlatform;
emu_1.PLATFORMS['vic20.mame'] = VIC20MAMEPlatform;
//# sourceMappingURL=vic20.js.map