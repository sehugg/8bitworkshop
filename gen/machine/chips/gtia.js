"use strict";
// GTIA
// https://user.xmission.com/~trevin/atari/gtia_regs.html
// https://user.xmission.com/~trevin/atari/gtia_pinout.html
Object.defineProperty(exports, "__esModule", { value: true });
exports.GTIA = exports.CONSOL = exports.TRIG0 = void 0;
const emu_1 = require("../../common/emu");
const util_1 = require("../../common/util");
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
const VDELAY = 0x1c; // TODO
const GRACTL = 0x1d;
const HITCLR = 0x1e;
const CONSPK = 0x1f;
// read regs
const M0PF = 0x0;
const P0PF = 0x4;
const M0PL = 0x8;
const P0PL = 0xc;
exports.TRIG0 = 0x10;
exports.CONSOL = 0x1f;
const HOFFSET = -9; // bias to account for antic->gtia delay
const PRIOR_TABLE = [
    0, 1, 2, 3, 7, 7, 7, 7, 8, 8, 8, 8, 4, 5, 6, 7,
    0, 1, 2, 3, 7, 7, 7, 7, 8, 8, 8, 8, 4, 5, 6, 7,
    0, 1, 6, 7, 5, 5, 5, 5, 8, 8, 8, 8, 2, 3, 4, 5,
    0, 1, 6, 7, 5, 5, 5, 5, 8, 8, 8, 8, 2, 3, 4, 5,
    4, 5, 6, 7, 3, 3, 3, 3, 8, 8, 8, 8, 0, 1, 2, 3,
    4, 5, 6, 7, 3, 3, 3, 3, 8, 8, 8, 8, 0, 1, 2, 3,
    4, 5, 6, 7, 3, 3, 3, 3, 8, 8, 8, 8, 0, 1, 2, 3,
    4, 5, 6, 7, 3, 3, 3, 3, 8, 8, 8, 8, 0, 1, 2, 3,
    2, 3, 4, 5, 7, 7, 7, 7, 8, 8, 8, 8, 0, 1, 6, 7,
    2, 3, 4, 5, 7, 7, 7, 7, 8, 8, 8, 8, 0, 1, 6, 7,
    2, 3, 4, 5, 7, 7, 7, 7, 8, 8, 8, 8, 0, 1, 6, 7,
    2, 3, 4, 5, 7, 7, 7, 7, 8, 8, 8, 8, 0, 1, 6, 7,
    2, 3, 4, 5, 7, 7, 7, 7, 8, 8, 8, 8, 0, 1, 6, 7,
    2, 3, 4, 5, 7, 7, 7, 7, 8, 8, 8, 8, 0, 1, 6, 7,
    2, 3, 4, 5, 7, 7, 7, 7, 8, 8, 8, 8, 0, 1, 6, 7,
    2, 3, 4, 5, 7, 7, 7, 7, 8, 8, 8, 8, 0, 1, 6, 7, // 1000
];
const MODE_9_LOOKUP = [
    COLPM0 + 0, COLPM0 + 1, COLPM0 + 2, COLPM0 + 3,
    COLPF0 + 0, COLPF0 + 1, COLPF0 + 2, COLPF0 + 3,
    COLBK, COLBK, COLBK, COLBK,
    COLPF0 + 0, COLPF0 + 1, COLPF0 + 2, COLPF0 + 3,
];
class GTIA {
    constructor() {
        this.regs = new Uint8Array(0x20);
        this.readregs = new Uint8Array(0x20);
        this.shiftregs = new Uint32Array(8);
        this.count = 0;
        this.an = 0;
        this.rgb = 0;
        this.pmcol = 0;
        this.gtiacol = 0;
        this.gtiacol2 = 0;
        this.hbias = HOFFSET;
        this.pmDebugMask = -1;
    }
    reset() {
        this.regs.fill(0);
        this.readregs.fill(0); // TODO?
        this.readregs[0x14] = 0xf; // NTSC
        this.readregs.fill(0xf, 0x15); // default value for write-only regs
        this.count = 0;
    }
    saveState() {
        return (0, util_1.safe_extend)(0, {}, this);
    }
    loadState(s) {
        (0, util_1.safe_extend)(0, this, s);
    }
    setReg(a, v) {
        switch (a) {
            case COLPM0:
            case COLPM0 + 1:
            case COLPM0 + 2:
            case COLPM0 + 3:
            case COLPF0:
            case COLPF0 + 1:
            case COLPF0 + 2:
            case COLPF0 + 3:
            case COLBK:
                v &= 0xfe; // bit 0 unused in color regs
                break;
            case HITCLR:
                this.readregs.fill(0, 0, 16);
                return;
        }
        this.regs[a] = v;
    }
    readReg(a) {
        switch (a) {
            case exports.CONSOL:
                return this.readregs[a] & ~this.regs[CONSPK];
        }
        return this.readregs[a];
    }
    sync() {
        this.count = 0;
    }
    setBias(b) {
        this.hbias = HOFFSET + b;
    }
    updateGfx(h, v, data) {
        switch (h) {
            case 0:
                if (this.regs[GRACTL] & 1) {
                    // TODO: VDELAY
                    this.regs[GRAFM] = data;
                }
                break;
            case 2:
            case 3:
            case 4:
            case 5:
                if (this.regs[GRACTL] & 2) {
                    if (!(v & 1) || !(this.regs[VDELAY] & (1 << (h + 2))))
                        this.regs[GRAFP0 - 2 + h] = data;
                }
                break;
        }
    }
    getPlayfieldColor() {
        // which GTIA mode?
        switch (this.regs[PRIOR] >> 6) {
            // normal mode
            case 0:
                switch (this.an) {
                    case 0:
                        return COLBK;
                    case 4:
                    case 5:
                    case 6:
                    case 7:
                        return COLPF0 + this.an - 4;
                    case 8:
                        // combine PF2 hue and PF1 luminance
                        return (this.regs[COLPF2] & 0xf0) | (this.regs[COLPF1] & 0x0f) | 0x100;
                }
                break;
            // mode 9 -- 16 luminances
            case 1:
                return (this.regs[COLBK] & 0xf0) | (this.gtiacol & 0xf) | 0x100;
            // mode 10 -- 9 colors from registers
            case 2:
                return MODE_9_LOOKUP[this.gtiacol];
            // mode 11 -- 16 hues
            case 3:
                return (this.regs[COLBK] & 0xf) | (this.gtiacol << 4) | 0x100;
        }
        return 0x100; // black
    }
    anySpriteActive() {
        return this.shiftregs[0] || this.shiftregs[1] || this.shiftregs[2]
            || this.shiftregs[3] || this.shiftregs[4] || this.shiftregs[5]
            || this.shiftregs[6] || this.shiftregs[7];
    }
    processPlayerMissile() {
        // no p/m gfx, just evaluate horiz. triggers
        if (!this.anySpriteActive()) {
            this.evalTrigger(0);
            this.evalTrigger(1);
            this.evalTrigger(2);
            this.evalTrigger(3);
            this.evalTrigger(4);
            this.evalTrigger(5);
            this.evalTrigger(6);
            this.evalTrigger(7);
            this.pmcol = -1;
            return;
        }
        // no collisions in blank area, but shift and trigger anyway
        if (this.an == 2) {
            this.shiftObject(0);
            this.shiftObject(1);
            this.shiftObject(2);
            this.shiftObject(3);
            this.shiftObject(4);
            this.shiftObject(5);
            this.shiftObject(6);
            this.shiftObject(7);
            this.pmcol = -1;
            return;
        }
        // TODO: gtia, hi-res mode collisions
        // compute gfx and collisions for players/missiles
        let priobias = (this.regs[PRIOR] & 15) << 4; // TODO
        let topprio = PRIOR_TABLE[(this.an & 7) + 8 + priobias];
        let pfset = this.an - 4; // TODO?
        let topobj = -1;
        let ppmask = 0;
        // players
        for (let i = 0; i < 4; i++) {
            let bit = this.shiftObject(i);
            if (bit) {
                if (pfset >= 0) { // TODO: hires and GTIA modes
                    this.readregs[P0PF + i] |= 1 << pfset;
                }
                ppmask |= 1 << i;
                let prio = PRIOR_TABLE[i + priobias];
                if (prio < topprio) {
                    topobj = i;
                    topprio = prio;
                }
            }
        }
        // missiles
        for (let i = 0; i < 4; i++) {
            let bit = this.shiftObject(i + 4);
            if (bit) {
                if (pfset >= 0) {
                    this.readregs[M0PF + i] |= 1 << pfset;
                }
                this.readregs[M0PL + i] |= ppmask;
                let prio = (this.regs[PRIOR] & 0x10)
                    ? PRIOR_TABLE[priobias + 15]
                    : PRIOR_TABLE[i + priobias];
                if (prio < topprio) {
                    topobj = i + 4;
                    topprio = prio;
                }
            }
        }
        // set player-player collision flags
        // TODO: either as a player or a GTIA mode 2 color
        if (ppmask & 1)
            this.readregs[P0PL + 0] |= ppmask & ~1;
        if (ppmask & 2)
            this.readregs[P0PL + 1] |= ppmask & ~2;
        if (ppmask & 4)
            this.readregs[P0PL + 2] |= ppmask & ~4;
        if (ppmask & 8)
            this.readregs[P0PL + 3] |= ppmask & ~8;
        this.pmcol = topobj >= 0 ? this.getObjectColor(topobj) : -1;
    }
    shiftObject(i) {
        let bit = (this.shiftregs[i] & 0x80000000) != 0;
        this.shiftregs[i] <<= 1;
        this.evalTrigger(i);
        return bit;
    }
    getObjectColor(i) {
        if ((this.regs[PRIOR] & 0x10) && i >= 4) {
            return this.regs[COLPF3];
        }
        else {
            return this.regs[COLPM0 + (i & 3)];
        }
    }
    evalTrigger(i) {
        if (this.regs[HPOSP0 + i] + this.hbias == this.count) {
            this.triggerObject(i);
        }
    }
    triggerObject(i) {
        let size, data;
        if (!(this.pmDebugMask & (1 << i)))
            return;
        if (i < 4) {
            size = this.regs[SIZEP0 + i] & 3;
            data = this.regs[GRAFP0 + i];
        }
        else {
            let s = (i - 4) << 1;
            size = (this.regs[SIZEM] >> s) & 3;
            data = ((this.regs[GRAFM] >> s) & 3) << 6;
        }
        if (size & 1)
            data = expandBits(data);
        else
            data <<= 8;
        if (size == 3)
            data = expandBits(data);
        else
            data <<= 16;
        this.shiftregs[i] |= data;
    }
    clockPulse1() {
        this.processPlayerMissile();
        this.clockPulse2();
        this.count++;
    }
    clockPulse2() {
        var col;
        if (this.pmcol >= 0) {
            col = this.pmcol;
        }
        else {
            let pf = this.getPlayfieldColor();
            col = pf & 0x100 ? pf & 0xff : this.regs[pf];
        }
        this.rgb = COLORS_RGBA[col];
        // TODO: hires modes return 8, so other modes wont work
        this.gtiacol2 = (this.gtiacol2 << 1) | (this.an >> 3);
    }
    clockPulse4() {
        // latch GTIA buffer
        this.gtiacol = this.gtiacol2 & 15;
    }
    static stateToLongString(state) {
        let s = '';
        s += `X: ${(0, util_1.lpad)(state.count, 3)}  ANTIC: ${(0, util_1.hex)(state.an, 1)}  PM: ${(0, util_1.hex)(state.pmcol, 3)}\n`;
        s += "Write Registers:\n";
        s += (0, emu_1.dumpRAM)(state.regs, 0, 32);
        s += "Read Registers:\n";
        s += (0, emu_1.dumpRAM)(state.readregs, 0, 32);
        return s;
    }
}
exports.GTIA = GTIA;
function expandBits(x) {
    x = (x | (x << 8)) & 0x00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;
    return x | (x << 1);
}
var COLORS_RGBA = new Uint32Array(256);
for (var i = 0; i < 256; i++) {
    COLORS_RGBA[i] = (0, emu_1.gtia_ntsc_to_rgb)(i);
}
//# sourceMappingURL=gtia.js.map