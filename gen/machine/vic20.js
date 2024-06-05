"use strict";
//// WASM Machine
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIC20_WASMMachine = void 0;
const emu_1 = require("../common/emu");
const util_1 = require("../common/util");
const wasmplatform_1 = require("../common/wasmplatform");
class VIC20_WASMMachine extends wasmplatform_1.BaseWASMMachine {
    constructor() {
        super(...arguments);
        this.numTotalScanlines = 312;
        this.cpuCyclesPerLine = 71;
        this.videoOffsetBytes = -24 * 4;
        this.joymask0 = 0;
        this.joymask1 = 0;
    }
    getBIOSLength() { return 0x5000; }
    ;
    loadBIOS(srcArray) {
        super.loadBIOS(srcArray);
    }
    async fetchBIOS() {
        let bios = new Uint8Array(20480);
        bios.set(DEFAULT_BIOS, bios.length - DEFAULT_BIOS.length);
        this.allocateBIOS(bios);
        this.loadBIOS(new Uint8Array(bios));
    }
    reset() {
        super.reset();
        // clear keyboard
        for (var ch = 0; ch < 128; ch++) {
            this.setKeyInput(ch, 0, emu_1.KeyFlags.KeyUp);
        }
        // load rom
        if (this.romptr && this.romlen) {
            let rom = this.romarr;
            this.exports.machine_load_rom(this.sys, this.romptr, this.romlen);
            let iscart = rom[4 + 2] == 0x41 && rom[5 + 2] == 0x30 && rom[6 + 2] == 0xC3 && rom[7 + 2] == 0xC2 && rom[8 + 2] == 0xCD;
            if (!iscart) {
                this.prgstart = rom[0] + (rom[1] << 8); // get load address
                // look for BASIC program start
                if (this.prgstart == 0x1001) {
                    this.prgstart = rom[2] + (rom[3] << 8) + 2; // point to after BASIC program
                    console.log("prgstart", (0, util_1.hex)(this.prgstart));
                }
                // is program loaded into RAM?
                if (this.prgstart < 0x8000) {
                    // advance BIOS a few frames
                    this.exports.machine_exec(this.sys, 500000);
                    // type in command (SYS 2061)
                    var cmd = "SYS " + this.prgstart + "\r";
                    console.log(cmd);
                    for (var i = 0; i < cmd.length; i++) {
                        var key = cmd.charCodeAt(i);
                        this.exports.machine_exec(this.sys, 10000);
                        this.exports.machine_exec(this.sys, 10000);
                        this.exports.machine_key_down(this.sys, key);
                        this.exports.machine_exec(this.sys, 10000);
                        this.exports.machine_exec(this.sys, 10000);
                        this.exports.machine_key_up(this.sys, key);
                    }
                    // advance clock until program starts
                    for (var i = 0; i < 10000 && this.getPC() != this.prgstart; i++) {
                        this.exports.machine_tick(this.sys);
                    }
                }
            }
            else {
                // get out of reset
                //this.exports.machine_exec(this.sys, 100);
                // wait until cartridge start
                // TODO: detect ROM cartridge
                var warmstart = this.romarr[0x2 + 2] + this.romarr[0x3 + 2] * 256;
                for (var i = 0; i < 10000 && this.getPC() != warmstart; i++) {
                    this.exports.machine_tick(this.sys);
                }
                console.log('cart', i, (0, util_1.hex)(warmstart));
            }
            // TODO: shouldn't we return here @ start of frame?
            // and stop probing
        }
    }
    advanceFrame(trap) {
        // TODO: does this sync with VSYNC?
        var scanline = this.getRasterY();
        var clocks = Math.floor((this.numTotalScanlines - scanline) * 22152 / this.numTotalScanlines);
        var probing = this.probe != null;
        if (probing)
            this.exports.machine_reset_probe_buffer();
        clocks = super.advanceFrameClock(trap, clocks);
        if (probing)
            this.copyProbeData();
        return clocks;
    }
    getRasterY() {
        return this.exports.machine_get_raster_line(this.sys);
    }
    getRasterCanvasPosition() {
        return {
            x: -1, // TODO?
            y: this.getRasterY() - 14,
        };
    }
    getCPUState() {
        this.exports.machine_save_cpu_state(this.sys, this.cpustateptr);
        var s = this.cpustatearr;
        var pc = s[2] + (s[3] << 8);
        return {
            PC: pc,
            SP: s[9],
            A: s[6],
            X: s[7],
            Y: s[8],
            C: s[10] & 1,
            Z: s[10] & 2,
            I: s[10] & 4,
            D: s[10] & 8,
            V: s[10] & 64,
            N: s[10] & 128,
            o: this.readConst(pc),
        };
    }
    saveState() {
        this.exports.machine_save_state(this.sys, this.stateptr);
        return {
            c: this.getCPUState(),
            state: this.statearr.slice(0),
            ram: this.statearr.slice(18640, 18640 + 0x200), // ZP and stack (TODO)
        };
    }
    loadState(state) {
        this.statearr.set(state.state);
        this.exports.machine_load_state(this.sys, this.stateptr);
    }
    getVideoParams() {
        return { width: 232, height: 272, overscan: true, videoFrequency: 50, aspect: 1.5 };
    }
    setKeyInput(key, code, flags) {
        // TODO: handle shifted keys
        if (key == 16 || key == 17 || key == 18 || key == 224)
            return; // meta keys
        //console.log(key, code, flags);
        //if (flags & KeyFlags.Shift) { key += 64; }
        // convert to vic20
        var mask = 0;
        var mask2 = 0;
        if (key == 37) {
            key = 0x8;
            mask = 0x4;
        } // LEFT
        if (key == 38) {
            key = 0xb;
            mask = 0x1;
        } // UP
        if (key == 39) {
            key = 0x9;
            mask = 0x8;
        } // RIGHT
        if (key == 40) {
            key = 0xa;
            mask = 0x2;
        } // DOWN
        if (key == 32) {
            mask = 0x10;
        } // FIRE
        /* player 2 (TODO)
        if (key == 65) { key = 65; mask2 = 0x4; } // LEFT
        if (key == 87) { key = 87; mask2 = 0x1; } // UP
        if (key == 68) { key = 68; mask2 = 0x8; } // RIGHT
        if (key == 83) { key = 83; mask2 = 0x2; } // DOWN
        if (key == 69) { mask2 = 0x10; } // FIRE
        */
        if (key == 113) {
            key = 0xf1;
        } // F2
        if (key == 115) {
            key = 0xf3;
        } // F4
        if (key == 119) {
            key = 0xf5;
        } // F8
        if (key == 121) {
            key = 0xf7;
        } // F10
        if (flags & emu_1.KeyFlags.KeyDown) {
            this.exports.machine_key_down(this.sys, key);
            this.joymask0 |= mask;
            this.joymask1 |= mask2;
        }
        else if (flags & emu_1.KeyFlags.KeyUp) {
            this.exports.machine_key_up(this.sys, key);
            this.joymask0 &= ~mask;
            this.joymask1 &= ~mask2;
        }
        this.exports.vic20_joystick(this.sys, this.joymask0, this.joymask1);
    }
}
exports.VIC20_WASMMachine = VIC20_WASMMachine;
// pretty much just runs autostart ROM and not much else...
const DEFAULT_BIOS = [
    0xA2, 0x10, 0xA0, 0x91, 0x60, 0x71, 0xFF, 0x71, 0xFF, 0x5C, 0xFF, 0xA2, 0xFF, 0x78, 0x9A, 0xD8,
    0x6C, 0x00, 0xA0, 0xA2, 0x45, 0xA0, 0xFF, 0x18, 0x78, 0x6C, 0x18, 0x03, 0x48, 0x8A, 0x48, 0x98,
    0x48, 0xAD, 0x1D, 0x91, 0x10, 0x03, 0x6C, 0x02, 0xA0, 0x4C, 0x6C, 0xFF, 0x68, 0xA8, 0x68, 0xAA,
    0x68, 0x40, 0x48, 0x8A, 0x48, 0x98, 0x48, 0xBA, 0xBD, 0x04, 0x01, 0x29, 0x10, 0xF0, 0x03, 0x6C,
    0x16, 0x03, 0x6C, 0x14, 0x03, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x4C, 0x53, 0xFF, 0x4C, 0x44, 0xFF,
    0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C,
    0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44,
    0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF,
    0x6C, 0x1A, 0x03, 0x6C, 0x1C, 0x03, 0x6C, 0x1E, 0x03, 0x6C, 0x20, 0x03, 0x6C, 0x22, 0x03, 0x6C,
    0x24, 0x03, 0x6C, 0x26, 0x03, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44,
    0xFF, 0x6C, 0x28, 0x03, 0x6C, 0x2A, 0x03, 0x6C, 0x2C, 0x03, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF,
    0x4C, 0x44, 0xFF, 0x4C, 0x40, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x58, 0xFF, 0x4B, 0xFF, 0x72, 0xFF
];
//# sourceMappingURL=vic20.js.map