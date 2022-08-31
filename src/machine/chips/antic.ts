import { dumpRAM } from "../../common/emu";
import { hex, lpad, safe_extend } from "../../common/util";

// ANTIC
// https://www.atarimax.com/jindroush.atari.org/atanttim.html
// http://www.virtualdub.org/blog/pivot/entry.php?id=243
// http://www.beipmu.com/Antic_Timings.txt
// https://user.xmission.com/~trevin/atari/antic_regs.html
// https://user.xmission.com/~trevin/atari/antic_insns.html
// http://www.atarimuseum.com/videogames/consoles/5200/conv_to_5200.html
// https://www.virtualdub.org/downloads/Altirra%20Hardware%20Reference%20Manual.pdf

const PF_LEFT = [0, 26, 18, 10];
const PF_RIGHT = [0, 26 + 64, 18 + 80, 10 + 96];

const DMACTL = 0;
const CHACTL = 1;
const DLISTL = 2;
const DLISTH = 3;
const HSCROL = 4;
const VSCROL = 5;
const PMBASE = 7;
const CHBASE = 9;
const WSYNC = 10;
const VCOUNT = 11;
const PENH = 12;
const PENV = 13;
const NMIEN = 14;
const NMIRES = 15;
const NMIST = 15;

const PFNONE = 0;
const PFNARROW = 1;
const PFNORMAL = 2;
const PFWIDE = 3;

const NMIST_CYCLE = 12;
const NMI_CYCLE = 24;
const WSYNC_CYCLE = 212;

const MODE_LINES = [0, 0, 8, 10, 8, 16, 8, 16, 8, 4, 4, 2, 1, 2, 1, 1];
// how many bits before DMA clock repeats?
const MODE_PERIOD = [0, 0, 2, 2, 2, 2, 4, 4, 8, 4, 4, 4, 4, 2, 2, 2];
const MODE_YPERIOD = [0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 0, 0, 0, 0];
//const MODE_BPP = [0, 0, 1, 1, 2, 2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 1];
// how many color clocks / pixel * 2
export const MODE_SHIFT = [0, 0, 1, 1, 2, 2, 2, 2, 8, 4, 4, 2, 2, 2, 2, 1];

export class ANTIC {
    read: (address: number) => number;	// bus read function

    regs = new Uint8Array(0x10);				// registers

    pfwidth: number;				// playfield width
    left: number;
    right: number;					// left/right clocks for mode

    nmiPending: boolean = false;
    dma_enabled: boolean = false;
    dliop: number = 0;    // dli operation
    mode: number = 0;			// current mode
    jmp = false; // TODO
    lms = false; // TODO
    dlarg_lo: number = 0;
    dlarg_hi: number = 0;
    period: number = 0;		// current mode period bitmask
    scanaddr: number = 0;  // Scan Address (via LMS)
    startaddr: number = 0;	// Start of line Address
    pfbyte: number = 0;		// playfield byte fetched
    ch: number = 0;				// char read
    linesleft: number = 0; // # of lines left in mode
    yofs: number = 0;			// yofs fine
    v: number = 0;					// vertical scanline #
    h: number = 0;					// horizontal color clock

    linebuf = new Uint8Array(48);
    dmaclock: number = 0;
    dmaidx: number = 0;
    output: number = 0;
    dramrefresh = false;

    constructor(readfn) {
        this.read = readfn; // bus read function
    }
    reset() {
        this.regs.fill(0);
        this.regs[NMIEN] = 0x00;
        this.regs[NMIST] = 0x7f;
        this.regs[PENH] = 0x00;
        this.regs[PENV] = 0xff;
        this.setReg(DMACTL, 0x0);
        this.h = this.v = 0;
        this.startaddr = this.scanaddr = 0;
        this.dmaclock = 0;
    }
    saveState() {
        return safe_extend(0, {}, this);
    }
    loadState(s) {
        safe_extend(0, this, s);
        this.setReg(DMACTL, s.regs[DMACTL]);
    }
    static stateToLongString(state): string {
        let s = "";
        s += "H: " + lpad(state.h, 3) + "  V: " + lpad(state.v, 3) + "\n";
        s += "DLIOp: " + hex(state.dliop, 2) + "  Lines: " + state.yofs + "/" + state.linesleft + "\n";
        s += "Addr: " + hex(state.scanaddr, 4) + "\n";
        s += dumpRAM(state.regs, 0, 16).replace('$00', 'Regs');
        return s;
    }
    setReg(a: number, v: number) {
        this.regs[a] = v;
        switch (a) {
            case WSYNC:
                this.regs[WSYNC] = 0xff;
                break;
            case DMACTL:
                this.pfwidth = this.regs[DMACTL] & 3;
                break;
            case NMIRES:
                this.regs[NMIST] = 0x1f;
                break;
        }
    }
    readReg(a: number) {
        switch (a) {
            case NMIST:
                return this.regs[a];
            case VCOUNT:
                return this.v >> 1;
            default:
                return 0xff;
        }
    }
    processDLIEntry() {
        if (this.mode == 0) { // N Blank Lines
            this.linesleft = (this.dliop >> 4) + 1;
        } else {
            this.linesleft = MODE_LINES[this.mode];
            this.period = MODE_PERIOD[this.mode];
            if (this.jmp) {
                this.regs[DLISTL] = this.dlarg_lo;
                this.regs[DLISTH] = this.dlarg_hi;
                this.mode = this.period = 0;
                // JVB (Jump and wait for Vertical Blank)
                if (this.dliop & 0x40) {
                    this.linesleft = (248 - this.v) & 0xff; // TODO?
                }
            } else if (this.lms) {
                this.scanaddr = this.dlarg_lo + (this.dlarg_hi << 8);
                //console.log('scanaddr', hex(this.scanaddr));
            }
            this.startaddr = this.scanaddr;
        }
        // TODO: gtia fine scroll?
        let pfwidth = this.pfwidth;
        let hscroll = (this.dliop & 0x10) ? (this.regs[HSCROL] & 15) >> 1 : 0;
        if ((this.dliop & 0x10) && pfwidth < 3) pfwidth++;
        this.left = PF_LEFT[pfwidth] + hscroll;
        this.right = PF_RIGHT[pfwidth] + hscroll;
    }

    nextLine() {
        if (this.linesleft > 0) {
            this.linesleft--;
            this.yofs++;
            if (this.mode >= 8 && this.linesleft) {
                this.scanaddr = this.startaddr; // reset line addr
            }
        }
    }

    triggerNMI(mask: number) {
        if (this.regs[NMIEN] & mask) {
            this.nmiPending = true;
        }
        this.regs[NMIST] = mask | 0x1f;
    }

    nextInsn(): number {
        let pc = this.regs[DLISTL] + (this.regs[DLISTH] << 8);
        let b = this.read(pc);
        //console.log('nextInsn', hex(pc), hex(b), this.v);
        pc = ((pc + 1) & 0x3ff) | (pc & ~0x3ff);
        this.regs[DLISTL] = pc & 0xff;
        this.regs[DLISTH] = pc >> 8;
        return b;
    }

    nextScreen(): number {
        let b = this.read(this.scanaddr);
        this.scanaddr = ((this.scanaddr + 1) & 0xfff) | (this.scanaddr & ~0xfff);
        return b;
    }

    dlDMAEnabled() { return this.regs[DMACTL] & 0b100000; }
    pmDMAEnabled() { return this.regs[DMACTL] & 0b001100; }

    isVisibleScanline() {
        return this.v >= 8 && this.v < 248;
    }
    isPlayfieldDMAEnabled() {
        return this.dlDMAEnabled() && !this.linesleft;
    }
    isPlayerDMAEnabled() {
        return this.regs[DMACTL] & 0b1000;
    }
    isMissileDMAEnabled() {
        return this.regs[DMACTL] & 0b1100;
    }

    clockPulse(): boolean {
        let dma = this.regs[WSYNC] != 0;
        if (!this.isVisibleScanline()) {
            this.doVBlank();
        } else {
            switch (this.h) {
                case 0:
                    if (this.isMissileDMAEnabled()) {
                        this.doPlayerMissileDMA(3);
                        dma = true;
                    }
                    break;
                case 1:
                    if (this.isPlayfieldDMAEnabled()) {
                        let op = this.nextInsn(); // get mode
                        // TODO: too many booleans
                        this.jmp = (op & ~0x40) == 0x01; // JMP insn?
                        this.lms = (op & 0x40) != 0 && (op & 0xf) != 0; // LMS insn?
                        this.mode = op & 0xf;
                        this.dliop = op;
                        this.yofs = 0;
                        dma = true;
                    }
                    break;
                case 2: case 3: case 4: case 5:
                    if (this.isPlayerDMAEnabled()) {
                        this.doPlayerMissileDMA(this.h + 2);
                        dma = true;
                    }
                    break;
                case 6:
                case 7:
                    if (this.yofs == 0 && this.isPlayfieldDMAEnabled() && (this.jmp || this.lms)) { // read extra bytes?
                        if (this.h == 6) this.dlarg_lo = this.nextInsn();
                        if (this.h == 7) this.dlarg_hi = this.nextInsn();
                        dma = true;
                    }
                    break;
                case 9:
                    if (this.yofs == 0) {
                        this.processDLIEntry();
                    }
                    break;
                case 8:
                    if (this.dliop & 0x80) { // TODO: what if DLI disabled?
                        if (this.linesleft == 1) {
                            this.triggerNMI(0x80); // DLI interrupt
                        }
                    }
                    break;
                case 111:
                    this.nextLine();
                    ++this.v;
                    break;
            }
            this.output = 0; // background color (TODO: only for blank lines)
            if (this.mode >= 2 && this.period) {
                let candma = this.h < 106;
                this.dmaclock <<= 1;
                if (this.dmaclock & (1 << this.period)) {
                    this.dmaclock |= 1;
                }
                if (this.h == this.left) { this.dmaclock |= 1; this.dmaidx = 0; }
                if (this.h == this.right) { this.dmaclock &= ~1; this.dmaidx++; }
                if (this.dmaclock & 1) {
                    if (this.mode < 8 && this.yofs == 0) { // only read chars on 1st line
                        this.linebuf[this.dmaidx] = this.nextScreen(); // read char name
                        dma = candma;
                    }
                    this.dmaidx++;
                } else if (this.dmaclock & 8) {
                    this.ch = this.linebuf[this.dmaidx - 4 / this.period]; // latch char
                    this.readBitmapData(); // read bitmap
                    dma = candma;
                }
                this.output = this.h >= this.left + 3 && this.h <= this.right + 2 ? 4 : 0;
            }
        }
        if (this.h < 19 || this.h > 102) this.output = 2;
        this.incHorizCounter();
        if (!dma && this.dramrefresh) {
            this.dramrefresh = false;
            dma = true;
        }
        return dma;
    }
    incHorizCounter() {
        ++this.h;
        switch (this.h) {
            case 25: case 25 + 4 * 1: case 25 + 4 * 2: case 25 + 4 * 3: case 25 + 4 * 4:
            case 25 + 4 * 5: case 25 + 4 * 6: case 25 + 4 * 7: case 25 + 4 * 8:
                this.dramrefresh = true;
                break;
            case 105:
                this.regs[WSYNC] = 0; // TODO: dram refresh delay to 106?
                break;
            case 114:
                this.h = 0;
                break;
        }
    }
    doVBlank() {
        this.linesleft = this.mode = this.period = 0;
        if (this.h == 111) { this.v++; }
        if (this.v == 248 && this.h == 0) { this.triggerNMI(0x40); } // VBI
        if (this.v == 262 && this.h == 112) { this.v = 0; }
        this.output = 2; // blank
    }

    doPlayerMissileDMA(section: number) {
        let oneline = this.regs[DMACTL] & 0x10;
        let pmaddr = this.regs[PMBASE] << 8;
        if (oneline) {
            pmaddr &= 0b1111100000000000;
            pmaddr |= section << 8;
            pmaddr |= this.v & 0xff;
        } else {
            pmaddr &= 0b111111000000000;
            pmaddr |= section << 7;
            pmaddr |= this.v >> 1;
        }
        this.read(pmaddr);
    }

    readBitmapData() {
        const mode = this.mode;
        if (mode < 8) {	// character mode
            let ch = this.ch;
            let y = this.yofs >> MODE_YPERIOD[this.mode];
            let addrofs = y & 7;
            let chbase = this.regs[CHBASE];
            // modes 6 & 7
            if ((mode & 0xe) == 6) { // or 7
                ch &= 0x3f;
                chbase &= 0xfe;
            } else {
                ch &= 0x7f;
                chbase &= 0xfc;
            }
            let addr = (ch << 3) + (chbase << 8);
            // modes 2 & 3
            if ((mode & 0xe) == 2) { // or 3
                let chactl = this.regs[CHACTL];
                let mode3lc = mode == 3 && (ch & 0x60) == 0x60;
                if (chactl & 4)
                    this.pfbyte = this.read(addr + (addrofs ^ 7)); // mirror
                else
                    this.pfbyte = this.read(addr + addrofs);
                if (mode3lc && y < 2) { this.pfbyte = 0; }
                if (!mode3lc && y > 7) { this.pfbyte = 0; }
                if (this.ch & 0x80) {
                    if (chactl & 1)
                        this.pfbyte = 0x0; // blank
                    if (chactl & 2)
                        this.pfbyte ^= 0xff; // invert
                }
            } else {
                this.pfbyte = this.read(addr + addrofs);
            }
        } else {	// map mode
            this.pfbyte = this.nextScreen();
        }
    }

    shiftout() {
        if (this.output == 4) { // visible pixel?
            switch (this.mode) {
                case 2: case 3:
                case 15:
                    {
                        let v = (this.pfbyte >> 7) & 1;
                        this.pfbyte <<= 1;
                        return v ? 8 : 6;
                    }
                case 6: case 7:
                    {
                        let v = (this.pfbyte >> 7) & 1;
                        this.pfbyte <<= 1;
                        return v ? (this.ch >> 6) + 4 : 0;
                    }
                case 9: case 11: case 12:
                    {
                        let v = (this.pfbyte >> 7) & 1;
                        this.pfbyte <<= 1;
                        return v ? 4 : 0;
                    }
                case 4: case 5:
                case 8: case 10:
                case 13: case 14:
                    {
                        let v = (this.pfbyte >> 6) & 3;
                        this.pfbyte <<= 2;
                        return [0, 4, 5, 6][v]; // TODO: 5th color
                    }
            }
        }
        return this.output;
    }

}
