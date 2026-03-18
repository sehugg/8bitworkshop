"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gb_1 = require("../machine/gb");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const disasmSM83_1 = require("../common/cpu/disasmSM83");
const GB_PRESETS = [
    { id: 'hello.c', name: 'Hello World (C)' },
    { id: 'testdrawing.c', name: 'Drawing Routines (C)' },
    { id: 'testphys.c', name: 'Sprite Test (C)' },
    { id: 'hello.sgb', name: 'Hello World (ASM)' },
    { id: 'main.wiz', name: 'Snake Game (Wiz)' },
];
class GameBoyPlatform extends baseplatform_1.BaseMachinePlatform {
    constructor() {
        super(...arguments);
        this.getToolForFilename = baseplatform_1.getToolForFilename_z80;
    }
    newMachine() { return new gb_1.GameBoyMachine(); }
    getPresets() { return GB_PRESETS; }
    getDefaultExtensions() { return [".c", ".ns", ".s", ".scc", ".sgb", ".z", ".wiz"]; }
    readAddress(a) { return this.machine.read(a); }
    readVRAMAddress(a) { return this.machine.readVRAMAddress(a); }
    getOriginPC() {
        return 0x100;
    }
    getROMExtension() {
        return ".gb";
    }
    getMemoryMap() {
        return {
            main: [
                { name: 'ROM Bank 0', start: 0x0000, size: 0x4000, type: 'rom' },
                { name: 'ROM Bank 1+', start: 0x4000, size: 0x4000, type: 'rom' },
                { name: 'Video RAM', start: 0x8000, size: 0x2000, type: 'ram' },
                { name: 'External RAM', start: 0xA000, size: 0x2000, type: 'ram' },
                { name: 'Work RAM', start: 0xC000, size: 0x2000, type: 'ram' },
                { name: 'OAM', start: 0xFE00, size: 0xA0, type: 'ram' },
                { name: 'I/O Registers', start: 0xFF00, size: 0x80, type: 'io' },
                { name: 'High RAM', start: 0xFF80, size: 0x7F, type: 'ram' },
            ]
        };
    }
    getDebugCategories() {
        if ((0, baseplatform_1.isDebuggable)(this.machine))
            return this.machine.getDebugCategories();
        else
            return ['CPU', 'Stack', 'PPU'];
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'CPU': return (0, baseplatform_1.cpuStateToLongString_SM83)(state.c);
            case 'Stack': {
                var sp = (state.c.SP - 1) & 0xFFFF;
                var start = sp & 0xFF00;
                var end = start + 0xFF;
                if (sp == 0)
                    sp = 0x10000;
                return (0, baseplatform_1.dumpStackToString)(this, [], start, end, sp, 0xCD);
            }
            default: return (0, baseplatform_1.isDebuggable)(this.machine) && this.machine.getDebugInfo(category, state);
        }
    }
    disassemble(pc, read) {
        return (0, disasmSM83_1.disassembleSM83)(pc, read(pc), read(pc + 1), read(pc + 2));
    }
    showHelp() {
        return "https://8bitworkshop.com/docs/platforms/gameboy/";
    }
}
const GBC_PRESETS = [
    { id: 'hello_color.c', name: 'Hello Color World (C)' },
];
class GameBoyColorPlatform extends GameBoyPlatform {
    newMachine() {
        var m = new gb_1.GameBoyMachine();
        m.forceColor = true;
        return m;
    }
    getPresets() { return GBC_PRESETS; }
    getROMExtension() {
        return ".gbc";
    }
    getMemoryMap() {
        return {
            main: [
                { name: 'ROM Bank 0', start: 0x0000, size: 0x4000, type: 'rom' },
                { name: 'ROM Bank 1+', start: 0x4000, size: 0x4000, type: 'rom' },
                { name: 'Video RAM B0', start: 0x8000, size: 0x2000, type: 'ram' },
                { name: 'External RAM', start: 0xA000, size: 0x2000, type: 'ram' },
                { name: 'Work RAM 0', start: 0xC000, size: 0x1000, type: 'ram' },
                { name: 'Work RAM 1-7', start: 0xD000, size: 0x1000, type: 'ram' },
                { name: 'OAM', start: 0xFE00, size: 0xA0, type: 'ram' },
                { name: 'I/O Registers', start: 0xFF00, size: 0x80, type: 'io' },
                { name: 'High RAM', start: 0xFF80, size: 0x7F, type: 'ram' },
            ]
        };
    }
    showHelp() {
        return "https://8bitworkshop.com/docs/platforms/gameboy/";
    }
}
emu_1.PLATFORMS['gb'] = GameBoyPlatform;
emu_1.PLATFORMS['gb.color'] = GameBoyColorPlatform;
//# sourceMappingURL=gb.js.map