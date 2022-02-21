"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const apple2_1 = require("../machine/apple2");
const baseplatform_2 = require("../common/baseplatform");
const mameplatform_1 = require("../common/mameplatform");
const APPLE2_PRESETS = [
    { id: 'sieve.c', name: 'Sieve' },
    { id: 'keyboardtest.c', name: 'Keyboard Test' },
    { id: 'mandel.c', name: 'Mandelbrot' },
    { id: 'tgidemo.c', name: 'TGI Graphics Demo' },
    { id: 'Eliza.c', name: 'Eliza' },
    { id: 'siegegame.c', name: 'Siege Game' },
    { id: 'cosmic.c', name: 'Cosmic Impalas' },
    { id: 'farmhouse.c', name: "Farmhouse Adventure" },
    { id: 'yum.c', name: "Yum Dice Game" },
    { id: 'lzgtest.c', name: "LZG Decompressor (C)" },
    { id: 'hgrtest.a', name: "HGR Test (ASM)" },
    { id: 'conway.a', name: "Conway's Game of Life (ASM)" },
    { id: 'lz4fh.a', name: "LZ4FH Decompressor (ASM)" },
    { id: 'deltamod.dasm', name: "Delta Modulation (ASM)" },
    //  {id:'zap.dasm', name:"ZAP! (ASM)"},
    //  {id:'tb_6502.s', name:'Tom Bombem (assembler game)'},
];
/// MAME support
class Apple2MAMEPlatform extends mameplatform_1.BaseMAME6502Platform {
    constructor() {
        super(...arguments);
        this.getOpcodeMetadata = baseplatform_1.getOpcodeMetadata_6502;
        this.getToolForFilename = baseplatform_1.getToolForFilename_6502;
    }
    start() {
        this.startModule(this.mainElement, {
            jsfile: 'mame8bitpc.js',
            biosfile: ['apple2e.zip'],
            //cfgfile:'nes.cfg',
            driver: 'apple2e',
            width: 280 * 2,
            height: 192 * 2,
            //romfn:'/emulator/cart.nes',
            //romsize:romSize,
            //romdata:new lzgmini().decode(lzgRom).slice(0, romSize),
            preInit: function (_self) {
            },
        });
    }
    getDefaultExtension() { return ".c"; }
    ;
    getPresets() { return APPLE2_PRESETS; }
    loadROM(title, data) {
        this.loadROMFile(data);
        // TODO
    }
}
///
class NewApple2Platform extends baseplatform_2.Base6502MachinePlatform {
    constructor() {
        super(...arguments);
        // TODO loadBIOS(bios)	{ this.machine.loadBIOS(a); }
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'Zero Page RAM', start: 0x0, size: 0x100, type: 'ram' },
                    { name: 'Line Input RAM', start: 0x200, size: 0x100, type: 'ram' },
                    { name: 'RAM', start: 0x300, size: 0xc0, type: 'ram' },
                    { name: 'DOS Vectors', start: 0x3c0, size: 0x40, type: 'ram' },
                    { name: 'Text/Lores Page 1', start: 0x400, size: 0x400, type: 'ram' },
                    { name: 'RAM', start: 0x800, size: 0x1800, type: 'ram' },
                    { name: 'Hires Page 1', start: 0x2000, size: 0x2000, type: 'ram' },
                    { name: 'Hires Page 2', start: 0x4000, size: 0x2000, type: 'ram' },
                    { name: 'RAM', start: 0x6000, size: 0x6000, type: 'ram' },
                    { name: 'I/O', start: 0xc000, size: 0x1000, type: 'io' },
                    { name: 'ROM', start: 0xd000, size: 0x3000 - 6, type: 'rom' },
                ] };
        };
        this.getToolForFilename = (fn) => {
            if (fn.endsWith(".lnk"))
                return "merlin32";
            else
                return (0, baseplatform_1.getToolForFilename_6502)(fn);
        };
        /*
        newCodeAnalyzer() {
          return new CodeAnalyzer_apple2(this);
        }
        getOriginPC() {
          return 0x803; // TODO?
        }
        */
    }
    newMachine() { return new apple2_1.AppleII(); }
    getPresets() { return APPLE2_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.readConst(a); }
    getROMExtension(rom) {
        if (rom && rom.length == 35 * 16 * 256)
            return ".dsk"; // DSK image
        return ".bin";
    }
    ;
}
emu_1.PLATFORMS['apple2.mame'] = Apple2MAMEPlatform;
emu_1.PLATFORMS['apple2'] = NewApple2Platform;
//# sourceMappingURL=apple2.js.map