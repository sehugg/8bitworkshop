
// GTIA
// https://user.xmission.com/~trevin/atari/gtia_regs.html
// https://user.xmission.com/~trevin/atari/gtia_pinout.html

import { dumpRAM } from "../../common/emu";
import { hex, rgb2bgr, safe_extend } from "../../common/util";


// write regs
const HPOSP0 = 0x0;
const HPOSM0 = 0x4;
const SIZEP0 = 0x8;
const SIZEM = 0x0c;
const GRAFP0 = 0x0d;
const GRAFM = 0x11;
const COLPM0 = 0x12;
const COLPF0 = 0x16;
const COLPF1 = 0x17;
const COLPF2 = 0x18;
const COLPF3 = 0x19;
const COLBK = 0x1a;
const PRIOR = 0x1b;
const VDELAY = 0x1c;
const GRACTL = 0x1d;
const HITCLR = 0x1e;
const CONSPK = 0x1f;
// read regs
const M0PF = 0x0;
const P0PF = 0x4;
const M0PL = 0x8;
const P0PL = 0xc;
export const TRIG0 = 0x10;
export const CONSOL = 0x1f;

export class GTIA {
    regs = new Uint8Array(0x20);
    readregs = new Uint8Array(0x20);
    shiftregs = new Uint32Array(8);

    count = 0;
    an = 0;
    rgb = 0;
    pmcol = 0;

    reset() {
        this.regs.fill(0);
        this.readregs.fill(0); // TODO?
        this.count = 0;
    }
    saveState() {
        return safe_extend(0, {}, this);
    }
    loadState(s) {
        safe_extend(0, this, s);
    }
    setReg(a: number, v: number) {
        switch (a) {
            case CONSOL:
                v = (v & 15) ^ 15; // 0 = input, 1 = pull down
                break;
            case HITCLR:
                for (let i = 0; i < 16; i++) {
                    this.readregs[i] = 0;
                }
                return;
        }
        this.regs[a] = v;
    }
    readReg(a: number) {
        return this.readregs[a];
    }
    updateGfx(h: number, data: number) {
        switch (h) {
            case 0:
                this.count = 0;
                if (this.regs[GRACTL] & 1) { this.regs[GRAFM] = data; }
                break;
            case 2: case 3: case 4: case 5:
                if (this.regs[GRACTL] & 2) { this.regs[GRAFP0 - 2 + h] = data; }
                break;
        }
    }
    getPlayfieldColor(): number {
        switch (this.an) {
            case 0:
                return COLBK;
            case 4: case 5: case 6: case 7:
                return COLPF0 + this.an - 4;
            case 8:
                // combine PF2 hue and PF1 luminance
                return (this.regs[COLPF2] & 0xf0) | (this.regs[COLPF1] & 0x0f) | 0x100;
        }
        return 0x100; // black
    }
    clockPulse1(): void {
        let topobj = -1;
        let pfset = this.an - 4; // TODO?
        let ppmask = 0;
        // players
        for (let i = 0; i < 4; i++) {
            let bit = this.shiftObject(i);
            if (bit) {
                if (pfset >= 0) {
                    this.readregs[P0PF + i] |= 1 << pfset;
                }
                ppmask |= 1 << i;
                topobj = i;
            }
        }
        this.readregs[P0PL + 0] |= ppmask & ~1;
        this.readregs[P0PL + 1] |= ppmask & ~2;
        this.readregs[P0PL + 2] |= ppmask & ~4;
        this.readregs[P0PL + 3] |= ppmask & ~8;
        // missiles
        for (let i = 0; i < 4; i++) {
            let bit = this.shiftObject(i + 4);
            if (bit) {
                if (pfset >= 0) {
                    this.readregs[M0PF + i] |= 1 << pfset;
                }
                this.readregs[M0PL + i] |= ppmask;
                topobj = i + 4;
            }
        }
        this.pmcol = topobj >= 0 ? this.getObjectColor(topobj) : -1;
        this.count++;
        this.clockPulse2();
    }
    clockPulse2(): void {
        var col: number;
        if (this.pmcol >= 0) {
            col = this.pmcol;
        } else {
            let pf = this.getPlayfieldColor();
            col = pf & 0x100 ? pf & 0xff : this.regs[pf];
        }
        this.rgb = COLORS_RGBA[col];
    }
    shiftObject(i: number) {
        let bit = this.shiftregs[i] & 0x80000000;
        this.shiftregs[i] <<= 1;
        if (this.regs[HPOSP0 + i] - 7 == this.count) {
            this.triggerObject(i);
        }
        return bit;
    }
    getObjectColor(i: number) {
        if ((this.regs[PRIOR] & 0x10) && i >= 4) {
            return this.regs[COLPF3];
        } else {
            return this.regs[COLPM0 + (i & 3)];
        }
    }
    triggerObject(i: number) {
        let size, data;
        if (i < 4) {
            size = this.regs[SIZEP0 + i] & 3;
            data = this.regs[GRAFP0 + i];
        } else {
            let s = (i - 4) << 1;
            size = (this.regs[SIZEM] >> s) & 3;
            data = ((this.regs[GRAFM] >> s) & 3) << 6;
        }
        if (size & 1) data = expandBits(data); else data <<= 8;
        if (size == 3) data = expandBits(data); else data <<= 16;
        this.shiftregs[i] = data;
    }

    static stateToLongString(state): string {
        let s = ''
        s += "Write Registers:\n";
        s += dumpRAM(state.regs, 0, 32);
        s += "Read Registers:\n";
        s += dumpRAM(state.readregs, 0, 32);
        return s;
    }
}

function expandBits(x: number): number {
    x = (x | (x << 8)) & 0x00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;
    return x | (x << 1);
}

const ATARI_NTSC_RGB = [
    0x000000,		// 00
    0x404040,		// 02
    0x6c6c6c,		// 04
    0x909090,		// 06
    0xb0b0b0,		// 08
    0xc8c8c8,		// 0A
    0xdcdcdc,		// 0C
    0xf4f4f4,		// 0E
    0x004444,		// 10
    0x106464,		// 12
    0x248484,		// 14
    0x34a0a0,		// 16
    0x40b8b8,		// 18
    0x50d0d0,		// 1A
    0x5ce8e8,		// 1C
    0x68fcfc,		// 1E
    0x002870,		// 20
    0x144484,		// 22
    0x285c98,		// 24
    0x3c78ac,		// 26
    0x4c8cbc,		// 28
    0x5ca0cc,		// 2A
    0x68b4dc,		// 2C
    0x78c8ec,		// 2E
    0x001884,		// 30
    0x183498,		// 32
    0x3050ac,		// 34
    0x4868c0,		// 36
    0x5c80d0,		// 38
    0x7094e0,		// 3A
    0x80a8ec,		// 3C
    0x94bcfc,		// 3E
    0x000088,		// 40
    0x20209c,		// 42
    0x3c3cb0,		// 44
    0x5858c0,		// 46
    0x7070d0,		// 48
    0x8888e0,		// 4A
    0xa0a0ec,		// 4C
    0xb4b4fc,		// 4E
    0x5c0078,		// 50
    0x74208c,		// 52
    0x883ca0,		// 54
    0x9c58b0,		// 56
    0xb070c0,		// 58
    0xc084d0,		// 5A
    0xd09cdc,		// 5C
    0xe0b0ec,		// 5E
    0x780048,		// 60
    0x902060,		// 62
    0xa43c78,		// 64
    0xb8588c,		// 66
    0xcc70a0,		// 68
    0xdc84b4,		// 6A
    0xec9cc4,		// 6C
    0xfcb0d4,		// 6E
    0x840014,		// 70
    0x982030,		// 72
    0xac3c4c,		// 74
    0xc05868,		// 76
    0xd0707c,		// 78
    0xe08894,		// 7A
    0xeca0a8,		// 7C
    0xfcb4bc,		// 7E
    0x880000,		// 80
    0x9c201c,		// 82
    0xb04038,		// 84
    0xc05c50,		// 86
    0xd07468,		// 88
    0xe08c7c,		// 8A
    0xeca490,		// 8C
    0xfcb8a4,		// 8E
    0x7c1800,		// 90
    0x90381c,		// 92
    0xa85438,		// 94
    0xbc7050,		// 96
    0xcc8868,		// 98
    0xdc9c7c,		// 9A
    0xecb490,		// 9C
    0xfcc8a4,		// 9E
    0x5c2c00,		// A0
    0x784c1c,		// A2
    0x906838,		// A4
    0xac8450,		// A6
    0xc09c68,		// A8
    0xd4b47c,		// AA
    0xe8cc90,		// AC
    0xfce0a4,		// AE
    0x2c3c00,		// B0
    0x485c1c,		// B2
    0x647c38,		// B4
    0x809c50,		// B6
    0x94b468,		// B8
    0xacd07c,		// BA
    0xc0e490,		// BC
    0xd4fca4,		// BE
    0x003c00,		// C0
    0x205c20,		// C2
    0x407c40,		// C4
    0x5c9c5c,		// C6
    0x74b474,		// C8
    0x8cd08c,		// CA
    0xa4e4a4,		// CC
    0xb8fcb8,		// CE
    0x003814,		// D0
    0x1c5c34,		// D2
    0x387c50,		// D4
    0x50986c,		// D6
    0x68b484,		// D8
    0x7ccc9c,		// DA
    0x90e4b4,		// DC
    0xa4fcc8,		// DE
    0x00302c,		// E0
    0x1c504c,		// E2
    0x347068,		// E4
    0x4c8c84,		// E6
    0x64a89c,		// E8
    0x78c0b4,		// EA
    0x88d4cc,		// EC
    0x9cece0,		// EE
    0x002844,		// F0
    0x184864,		// F2
    0x306884,		// F4
    0x4484a0,		// F6
    0x589cb8,		// F8
    0x6cb4d0,		// FA
    0x7ccce8,		// FC
    0x8ce0fc		// FE
];

var COLORS_RGBA = new Uint32Array(256);
var COLORS_WEB = [];
for (var i = 0; i < 256; i++) {
    COLORS_RGBA[i] = ATARI_NTSC_RGB[i >> 1] | 0xff000000;
    COLORS_WEB[i] = "#" + hex(rgb2bgr(ATARI_NTSC_RGB[i >> 1]), 6);
}

