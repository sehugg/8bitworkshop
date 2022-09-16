"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const astrocade_1 = require("../machine/astrocade");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
// http://metopal.com/projects/ballybook/doku.php
const ASTROCADE_PRESETS = [
    { id: '01-helloworlds.asm', name: 'Hello World (ASM)' },
    { id: '02-telephone.asm', name: 'Telephone (ASM)' },
    { id: '03-horcbpal.asm', name: 'Paddle Demo (ASM)' },
    { id: 'hello.c', name: 'Hello Graphics' },
    { id: 'lines.c', name: 'Lines' },
    { id: 'sprites.c', name: 'Sprites' },
    { id: 'vsync.c', name: 'Sprites w/ VSYNC' },
    { id: 'fastsprites.c', name: 'Fast Sprites' },
    { id: 'music.c', name: 'Music' },
    { id: 'rotate.c', name: 'Rotate Op' },
    { id: 'rainbow.c', name: 'Rainbow' },
    { id: 'cosmic.c', name: 'Cosmic Impalas Game' },
    { id: 'racing.c', name: 'Pseudo 3-D Racing Game' },
];
const ASTROCADE_BIOS_PRESETS = [
    { id: 'bios.c', name: 'BIOS' },
];
class BallyAstrocadePlatform extends baseplatform_1.BaseZ80MachinePlatform {
    constructor() {
        super(...arguments);
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'BIOS', start: 0x0, size: 0x2000, type: 'rom' },
                    //{name:'Cart ROM',start:0x2000,size:0x2000,type:'rom'},
                    //{name:'Magic RAM',start:0x0,size:0x4000,type:'ram'},
                    { name: 'Screen RAM', start: 0x4000, size: 0x1000, type: 'ram' },
                    { name: 'BIOS Variables', start: 0x4fce, size: 0x5000 - 0x4fce, type: 'ram' },
                ] };
        };
    }
    newMachine() { return new astrocade_1.BallyAstrocade(false); }
    getPresets() { return ASTROCADE_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.read(a); }
    showHelp() { return "https://8bitworkshop.com/docs/platforms/astrocade/"; }
}
class BallyAstrocadeBIOSPlatform extends BallyAstrocadePlatform {
    getPresets() { return ASTROCADE_BIOS_PRESETS; }
    loadROM(title, rom) { this.machine.loadBIOS(rom); }
}
class BallyArcadePlatform extends BallyAstrocadePlatform {
    constructor() {
        super(...arguments);
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'Magic RAM', start: 0x0, size: 0x4000, type: 'ram' },
                    { name: 'Screen RAM', start: 0x4000, size: 0x4000, type: 'ram' },
                ] };
        };
    }
    newMachine() { return new astrocade_1.BallyAstrocade(true); }
}
emu_1.PLATFORMS['astrocade'] = BallyAstrocadePlatform;
emu_1.PLATFORMS['astrocade-bios'] = BallyAstrocadeBIOSPlatform;
emu_1.PLATFORMS['astrocade-arcade'] = BallyArcadePlatform;
//# sourceMappingURL=astrocade.js.map