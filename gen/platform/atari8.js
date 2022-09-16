"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const mameplatform_1 = require("../common/mameplatform");
const atari8_1 = require("../machine/atari8");
var Atari8_PRESETS = [
    { id: 'hello.dasm', name: 'Hello World (ASM)' },
    { id: 'hellopm.dasm', name: 'Hello Sprites (ASM)' },
    { id: 'helloconio.c', name: 'Text Mode (C)' },
    { id: 'siegegame.c', name: 'Siege Game (C)' },
    { id: 'hellodlist.c', name: 'Display List (C)' },
];
var Atari800_PRESETS = Atari8_PRESETS.concat([
    { id: 'sieve.bas', name: 'Benchmark (FastBasic)' },
    { id: 'pmtest.bas', name: 'Sprites Test (FastBasic)' },
    { id: 'dli.bas', name: 'DLI Test (FastBasic)' },
    { id: 'joyas.bas', name: 'Match-3 Game (FastBasic)' },
]);
const Atari800_MemoryMap = { main: [
        { name: 'RAM', start: 0x0, size: 0xc000, type: 'ram' },
        { name: 'Left Cartridge ROM', start: 0xa000, size: 0x2000, type: 'rom' },
        { name: 'GTIA', start: 0xd000, size: 0x20, type: 'io' },
        { name: 'POKEY', start: 0xd200, size: 0x10, type: 'io' },
        { name: 'PIA', start: 0xd300, size: 0x04, type: 'io' },
        { name: 'ANTIC', start: 0xd400, size: 0x10, type: 'io' },
        { name: 'Cartridge Control Line', start: 0xd600, size: 0x100, type: 'io' },
        { name: 'ROM', start: 0xd800, size: 0x800, type: 'rom' },
        { name: 'Character Set', start: 0xe000, size: 0x400, type: 'rom' },
        { name: 'ROM', start: 0xe400, size: 0x1c00, type: 'rom' },
    ] };
function getToolForFilename_Atari8(fn) {
    if (fn.endsWith(".bas") || fn.endsWith(".fb") || fn.endsWith(".fbi"))
        return "fastbasic";
    else
        return (0, baseplatform_1.getToolForFilename_6502)(fn);
}
class Atari800Platform extends baseplatform_1.Base6502MachinePlatform {
    constructor() {
        super(...arguments);
        this.getToolForFilename = getToolForFilename_Atari8;
        this.showHelp = atari8_showHelp;
        this.getROMExtension = atari8_getROMExtension;
        this.biosPath = 'res/altirra/kernel.rom';
    }
    newMachine() { return new atari8_1.Atari800(); }
    getPresets() { return Atari800_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.readConst(a); }
    getMemoryMap() { return Atari800_MemoryMap; }
    async start() {
        let bios = await this.loadKernel();
        await super.start();
        this.machine.loadBIOS(bios);
    }
    async loadKernel() {
        var biosResponse = await fetch(this.biosPath);
        if (biosResponse.status == 200 || biosResponse.size) {
            var biosBinary = await biosResponse.arrayBuffer();
            return new Uint8Array(biosBinary);
        }
        else
            throw new Error('could not load BIOS file');
    }
}
class Atari5200Platform extends Atari800Platform {
    constructor() {
        super(...arguments);
        this.biosPath = 'res/altirra/superkernel.rom';
    }
    newMachine() { return new atari8_1.Atari5200(); }
}
/// MAME support
class Atari8MAMEPlatform extends mameplatform_1.BaseMAME6502Platform {
    constructor() {
        super(...arguments);
        this.getToolForFilename = getToolForFilename_Atari8;
        this.getOpcodeMetadata = baseplatform_1.getOpcodeMetadata_6502;
        this.showHelp = atari8_showHelp;
    }
    getPresets() { return Atari8_PRESETS; }
    getDefaultExtension() { return ".asm"; }
    ;
}
class Atari800MAMEPlatform extends Atari8MAMEPlatform {
    constructor() {
        super(...arguments);
        this.getMemoryMap = function () { return Atari800_MemoryMap; };
    }
    getPresets() { return Atari800_PRESETS; }
    loadROM(title, data) {
        if (!this.started) {
            this.startModule(this.mainElement, {
                jsfile: 'mame8bitws.js',
                biosfile: 'a800xl.zip',
                cfgfile: 'a800xl.cfg',
                driver: 'a800xl',
                width: 336 * 2,
                height: 225 * 2,
                romfn: '/emulator/cart.rom',
                romdata: new Uint8Array(data),
                romsize: 0x2000,
                preInit: function (_self) {
                },
            });
        }
        else {
            this.loadROMFile(data);
            this.loadRegion(":cartleft:cart:rom", data);
        }
    }
    start() {
    }
}
class Atari5200MAMEPlatform extends Atari8MAMEPlatform {
    constructor() {
        super(...arguments);
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'RAM', start: 0x0, size: 0x4000, type: 'ram' },
                    { name: 'Cartridge ROM', start: 0x4000, size: 0x8000, type: 'rom' },
                    { name: 'GTIA', start: 0xc000, size: 0x20, type: 'io' },
                    { name: 'ANTIC', start: 0xd400, size: 0x10, type: 'io' },
                    { name: 'POKEY', start: 0xe800, size: 0x10, type: 'io' },
                    { name: 'ATARI Character Set', start: 0xf800, size: 0x400, type: 'rom' },
                    { name: 'ROM', start: 0xfc00, size: 0x400, type: 'rom' },
                ] };
        };
    }
    loadROM(title, data) {
        if (!this.started) {
            this.startModule(this.mainElement, {
                jsfile: 'mame8bitws.js',
                biosfile: 'a5200/5200.rom',
                cfgfile: 'a5200.cfg',
                driver: 'a5200',
                width: 336 * 2,
                height: 225 * 2,
                romfn: '/emulator/cart.rom',
                romdata: new Uint8Array(data),
                romsize: 0x8000,
                preInit: function (_self) {
                },
            });
        }
        else {
            this.loadROMFile(data);
            this.loadRegion(":cartleft:cart:rom", data);
        }
    }
    start() {
    }
}
function atari8_getROMExtension(rom) {
    if (rom == null)
        return ".bin";
    if (rom[0] == 0xff && rom[1] == 0xff)
        return ".xex";
    else
        return ".rom";
}
function atari8_showHelp() {
    return "https://8bitworkshop.com/docs/platforms/atari8/";
}
///
emu_1.PLATFORMS['atari8-800.xlmame'] = Atari800MAMEPlatform;
emu_1.PLATFORMS['atari8-800xl.mame'] = Atari800MAMEPlatform; // for dithertron
emu_1.PLATFORMS['atari8-5200.mame'] = Atari5200MAMEPlatform;
emu_1.PLATFORMS['atari8-800'] = Atari800Platform;
emu_1.PLATFORMS['atari8-5200'] = Atari5200Platform;
//# sourceMappingURL=atari8.js.map