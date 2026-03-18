"use strict";
// based on https://raw.githubusercontent.com/mamedev/mame/refs/heads/master/src/mame/midway/mcr.cpp
// license:BSD-3-Clause
// copyright-holders:Aaron Giles
Object.defineProperty(exports, "__esModule", { value: true });
const mcr_1 = require("../machine/mcr");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const MCR2_PRESETS = [
    { id: 'minimal.c', name: 'Minimal Example' },
    { id: 'gfxtest.c', name: 'Graphics Test' },
];
class MCR2Platform extends baseplatform_1.BaseZ80MachinePlatform {
    constructor() {
        super(...arguments);
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'Program ROM', start: 0x0000, size: 0xE000, type: 'rom' },
                    { name: 'NVRAM', start: 0xE000, size: 0x800, type: 'ram' },
                    { name: 'Sprite RAM', start: 0xE800, size: 0x200, type: 'ram' },
                    { name: 'Video RAM', start: 0xF000, size: 0x800, type: 'ram' },
                    { name: 'Palette RAM', start: 0xF800, size: 0x80, type: 'ram' },
                ] };
        };
    }
    newMachine() { return new mcr_1.MCR2Machine(); }
    getPresets() { return MCR2_PRESETS; }
    readAddress(a) { return this.machine.readConst(a); }
    readVRAMAddress(a) {
        if (a < 0x200)
            return this.machine.sprram[a];
        if (a < 0xa00)
            return this.machine.vram[a - 0x200];
        return this.machine.palram[(a - 0xa00) & 0x7f];
    }
}
emu_1.PLATFORMS['mcr'] = MCR2Platform;
//# sourceMappingURL=mcr.js.map