"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const c64_1 = require("../machine/c64");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const mameplatform_1 = require("../common/mameplatform");
const C64_PRESETS = [
    { id: 'helloc.c', name: 'Hello World', category: 'C' },
    { id: 'screen_ram.c', name: 'Screen RAM' },
    { id: 'siegegame.c', name: 'Siege Game' },
    { id: 'joymove.c', name: 'Sprite Movement' },
    { id: 'sprite_collision.c', name: 'Sprite Collision' },
    { id: 'scroll1.c', name: 'Scrolling (Single Buffer)' },
    { id: 'test_setirq.c', name: 'Raster Interrupts' },
    { id: 'test_display_list.c', name: 'Raster IRQ Library' },
    { id: 'scrolling_text.c', name: 'Big Scrolling Text' },
    { id: 'side_scroller.c', name: 'Side-Scrolling Game' },
    { id: 'scroll2.c', name: 'Scrolling (Double Buffer)' },
    { id: 'scroll3.c', name: 'Scrolling (Multidirectional)' },
    { id: 'scroll4.c', name: 'Scrolling (Color RAM Buffering)' },
    { id: 'scroll5.c', name: 'Scrolling (Camera Following)' },
    //  {id:'scrollingmap1.c', name:'Scrolling Tile Map'},
    { id: 'fullscrollgame.c', name: 'Full-Scrolling Game' },
    { id: 'test_multiplex.c', name: 'Sprite Retriggering' },
    { id: 'test_multispritelib.c', name: 'Sprite Multiplexing Library' },
    { id: 'mcbitmap.c', name: 'Multicolor Bitmap Mode' },
    { id: 'testlz4.c', name: 'LZ4 Bitmap Compression' },
    //{id:'mandel.c', name:'Mandelbrot Fractal'},
    { id: 'musicplayer.c', name: 'Music Player' },
    //{id:'sidtune.dasm', name:'Tiny SID Tune (ASM)'},
    { id: 'siddemo.c', name: 'SID Player Demo' },
    { id: 'digisound.c', name: 'Digi Sound Player' },
    { id: 'climber.c', name: 'Climber Game' },
    { id: 'test_border_sprites.c', name: 'Sprites in the Borders' },
    { id: 'sprite_stretch.c', name: 'Sprite Stretching' },
    { id: 'linecrunch.c', name: 'Linecrunch' },
    { id: 'fld.c', name: 'Flexible Line Distance' },
    { id: 'plasma.c', name: 'Plasma Demo' },
    { id: '23matches.c', name: '23 Matches' },
    { id: 'tgidemo.c', name: 'TGI Graphics Demo' },
    { id: 'upandaway.c', name: 'Up, Up and Away' },
    { id: 'hello.dasm', name: 'Hello World (DASM)', category: 'Assembly Language' },
    { id: 'hello.acme', name: 'Hello World (ACME)' },
    { id: 'hello.wiz', name: 'Hello Wiz (Wiz)' },
];
const C64_MEMORY_MAP = { main: [
        { name: '6510 Registers', start: 0x0, size: 0x2, type: 'io' },
        { name: 'BIOS Reserved', start: 0x200, size: 0xa7 },
        { name: 'Default Screen RAM', start: 0x400, size: 1024, type: 'ram' },
        //{name:'RAM',          start:0x2,   size:0x7ffe,type:'ram'},
        { name: 'Cartridge ROM', start: 0x8000, size: 0x2000, type: 'rom' },
        { name: 'BASIC ROM', start: 0xa000, size: 0x2000, type: 'rom' },
        { name: 'Upper RAM', start: 0xc000, size: 0x1000, type: 'ram' },
        { name: 'Character ROM', start: 0xd000, size: 0x1000, type: 'rom' },
        { name: 'VIC-II I/O', start: 0xd000, size: 0x0400, type: 'io' },
        { name: 'SID', start: 0xd400, size: 0x0400, type: 'io' },
        { name: 'Color RAM', start: 0xd800, size: 0x0400, type: 'io' },
        { name: 'CIA 1', start: 0xdc00, size: 0x0100, type: 'io' },
        { name: 'CIA 2', start: 0xdd00, size: 0x0100, type: 'io' },
        { name: 'I/O 1', start: 0xde00, size: 0x0100, type: 'io' },
        { name: 'I/O 2', start: 0xdf00, size: 0x0100, type: 'io' },
        { name: 'KERNAL ROM', start: 0xe000, size: 0x2000, type: 'rom' },
    ] };
// WASM C64 platform
class C64WASMPlatform extends baseplatform_1.Base6502MachinePlatform {
    newMachine() { return new c64_1.C64_WASMMachine('c64'); }
    getPresets() { return C64_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.readConst(a); }
    getMemoryMap() { return C64_MEMORY_MAP; }
    showHelp() { return "https://8bitworkshop.com/docs/platforms/c64/"; }
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
// C64 MAME platform
class C64MAMEPlatform extends mameplatform_1.BaseMAME6502Platform {
    constructor() {
        super(...arguments);
        this.getToolForFilename = baseplatform_1.getToolForFilename_6502;
        this.getOpcodeMetadata = baseplatform_1.getOpcodeMetadata_6502;
    }
    getPresets() { return C64_PRESETS; }
    getDefaultExtension() { return ".c"; }
    loadROM(title, data) {
        if (!this.started) {
            this.startModule(this.mainElement, {
                jsfile: 'mame8bitpc.js',
                biosfile: 'c64.zip',
                cfgfile: 'c64.cfg',
                driver: 'c64',
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
    getMemoryMap() { return C64_MEMORY_MAP; }
}
emu_1.PLATFORMS['c64'] = C64WASMPlatform;
emu_1.PLATFORMS['c64.wasm'] = C64WASMPlatform;
emu_1.PLATFORMS['c64.mame'] = C64MAMEPlatform;
//# sourceMappingURL=c64.js.map