"use strict";
/*
 * pokey.c - POKEY sound chip emulation
 *
 * Copyright (C) 1995-1998 David Firth
 * Copyright (C) 1998-2008 Atari800 development team (see DOC/CREDITS)
 *
 * This file is part of the Atari800 emulator project which emulates
 * the Atari 400, 800, 800XL, 130XE, and 5200 8-bit computers.
 *
 * Atari800 is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * Atari800 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Atari800; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.POKEY = void 0;
const emu_1 = require("../../common/emu");
const util_1 = require("../../common/util");
const AUDF1 = 0x00;
const AUDC1 = 0x01;
const AUDF2 = 0x02;
const AUDC2 = 0x03;
const AUDF3 = 0x04;
const AUDC3 = 0x05;
const AUDF4 = 0x06;
const AUDC4 = 0x07;
const AUDCTL = 0x08;
const STIMER = 0x09;
const SKRES = 0x0a;
const POTGO = 0x0b;
const SEROUT = 0x0d;
const IRQEN = 0x0e;
const SKCTL = 0x0f;
const POT0 = 0x00;
const POT1 = 0x01;
const POT2 = 0x02;
const POT3 = 0x03;
const POT4 = 0x04;
const POT5 = 0x05;
const POT6 = 0x06;
const POT7 = 0x07;
const ALLPOT = 0x08;
const KBCODE = 0x09;
const RANDOM = 0x0a;
const SERIN = 0x0d;
const IRQST = 0x0e;
const SKSTAT = 0x0f;
/* definitions for AUDCx (D201, D203, D205, D207) */
const NOTPOLY5 = 0x80; /* selects POLY5 or direct CLOCK */
const POLY4 = 0x40; /* selects POLY4 or POLY17 */
const PURETONE = 0x20; /* selects POLY4/17 or PURE tone */
const VOL_ONLY = 0x10; /* selects VOLUME OUTPUT ONLY */
const VOLUME_MASK = 0x0f; /* volume mask */
/* definitions for AUDCTL (D208) */
const POLY9 = 0x80; /* selects POLY9 or POLY17 */
const CH1_179 = 0x40; /* selects 1.78979 MHz for Ch 1 */
const CH3_179 = 0x20; /* selects 1.78979 MHz for Ch 3 */
const CH1_CH2 = 0x10; /* clocks channel 1 w/channel 2 */
const CH3_CH4 = 0x08; /* clocks channel 3 w/channel 4 */
const CH1_FILTER = 0x04; /* selects channel 1 high pass filter */
const CH2_FILTER = 0x02; /* selects channel 2 high pass filter */
const CLOCK_15 = 0x01; /* selects 15.6999kHz or 63.9210kHz */
/* for accuracy, the 64kHz and 15kHz clocks are exact divisions of
   the 1.79MHz clock */
const DIV_64 = 28; /* divisor for 1.79MHz clock to 64 kHz */
const DIV_15 = 114; /* divisor for 1.79MHz clock to 15 kHz */
/* the size (in entries) of the 4 polynomial tables */
const POLY4_SIZE = 0x000f;
const POLY5_SIZE = 0x001f;
const POLY9_SIZE = 0x01ff;
const POLY17_SIZE = 0x0001ffff;
const CHAN1 = 0;
const CHAN2 = 1;
const CHAN3 = 2;
const CHAN4 = 3;
const ANTIC_LINE_C = 114;
/* Some defines about the serial I/O timing. Currently fixed! */
const SIO_XMTDONE_INTERVAL = 15;
const SIO_SERIN_INTERVAL = 8;
const SIO_SEROUT_INTERVAL = 8;
const SIO_ACK_INTERVAL = 36;
var poly9;
var poly17;
function initPolyTables() {
    poly9 = new Uint8Array(511);
    poly17 = new Uint8Array(16385);
    /* initialise poly9_lookup */
    let reg = 0x1ff;
    for (let i = 0; i < 511; i++) {
        reg = ((((reg >> 5) ^ reg) & 1) << 8) + (reg >> 1);
        poly9[i] = reg;
    }
    /* initialise poly17_lookup */
    reg = 0x1ffff;
    for (let i = 0; i < 16385; i++) {
        reg = ((((reg >> 5) ^ reg) & 0xff) << 9) + (reg >> 8);
        poly17[i] = (reg >> 1);
    }
}
class POKEY {
    constructor(irq, antic_xpos) {
        this.irq = irq;
        this.antic_xpos = antic_xpos;
        this.regs = new Uint8Array(16);
        this.readregs = new Uint8Array(16);
        this.divnirq = new Uint32Array(4);
        this.divnmax = new Uint32Array(4);
        this.pot_inputs = new Uint8Array(8);
        this.basemult = 0;
        this.pot_scanline = 0;
        this.random_scanline_counter = 0;
        this.kbcode = 0;
        this.DELAYED_SERIN_IRQ = 0;
        this.DELAYED_SEROUT_IRQ = 0;
        this.DELAYED_XMTDONE_IRQ = 0;
        this.init();
    }
    saveState() {
        return (0, util_1.safe_extend)(0, {}, this);
    }
    loadState(s) {
        (0, util_1.safe_extend)(0, this, s);
    }
    init() {
        /* Initialise Serial Port Interrupts */
        //DELAYED_SERIN_IRQ = 0;
        //DELAYED_SEROUT_IRQ = 0;
        //DELAYED_XMTDONE_IRQ = 0;
        this.readregs.fill(0xff);
        this.readregs[SKSTAT] = 0xef;
        //SERIN = 0x00;	/* or 0xff ? */
        //IRQEN = 0x00;
        //SKCTL = 0x00;
        this.basemult = DIV_64;
        this.pot_inputs.fill(128);
        initPolyTables();
    }
    read(addr) {
        let byte = this.readregs[addr];
        addr &= 0xf;
        switch (addr) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                byte = this.pot_inputs[addr];
                return (byte < this.pot_scanline) ? byte : this.pot_scanline;
            case ALLPOT:
                for (let i = 0; i < 8; i++) {
                    if (this.pot_inputs[i] <= this.pot_scanline)
                        byte &= ~(1 << i); // reset bit if pot value known
                }
                break;
            case KBCODE:
                return this.kbcode;
            case SKSTAT:
                byte = SKSTAT + (this.CASSETTE_IOLineStatus() << 4);
                break;
            case RANDOM:
                if ((this.regs[SKCTL] & 0x03) != 0) {
                    let i = this.random_scanline_counter + this.antic_xpos();
                    if (this.regs[AUDCTL] & POLY9)
                        byte = poly9[i % POLY9_SIZE];
                    else {
                        i %= POLY17_SIZE;
                        let ptr = i >> 3;
                        i &= 7;
                        byte = (poly17[ptr] >> i) + (poly17[ptr + 1] << (8 - i));
                    }
                }
                break;
        }
        return byte & 0xff;
    }
    write(addr, byte) {
        addr &= 0x0f;
        this.regs[addr] = byte;
        switch (addr) {
            case AUDCTL:
                /* determine the base multiplier for the 'div by n' calculations */
                if (byte & CLOCK_15)
                    this.basemult = DIV_15;
                else
                    this.basemult = DIV_64;
                this.update_counter((1 << CHAN1) | (1 << CHAN2) | (1 << CHAN3) | (1 << CHAN4));
                break;
            case AUDF1:
                this.update_counter((this.regs[AUDCTL] & CH1_CH2) ? ((1 << CHAN2) | (1 << CHAN1)) : (1 << CHAN1));
                break;
            case AUDF2:
                this.update_counter(1 << CHAN2);
                break;
            case AUDF3:
                this.update_counter((this.regs[AUDCTL] & CH3_CH4) ? ((1 << CHAN4) | (1 << CHAN3)) : (1 << CHAN3));
                break;
            case AUDF4:
                this.update_counter(1 << CHAN4);
                break;
            case IRQEN:
                this.readregs[IRQST] |= ~byte & 0xf7; /* Reset disabled IRQs except XMTDONE */
                let mask = ~this.readregs[IRQST] & this.regs[IRQEN];
                if (mask) {
                    this.generateIRQ(this.readregs[IRQST]);
                }
                break;
            case SKRES:
                this.readregs[SKSTAT] |= 0xe0;
                break;
            case POTGO:
                if (!(this.regs[SKCTL] & 4))
                    this.pot_scanline = 0; /* slow pot mode */
                break;
            case SEROUT:
                if ((this.regs[SKCTL] & 0x70) == 0x20 && this.siocheck()) {
                    this.SIO_PutByte(byte);
                }
                // check if cassette 2-tone mode has been enabled 
                if ((this.regs[SKCTL] & 0x08) == 0x00) {
                    // intelligent device
                    this.DELAYED_SEROUT_IRQ = SIO_SEROUT_INTERVAL;
                    this.readregs[IRQST] |= 0x08;
                    this.DELAYED_XMTDONE_IRQ = SIO_XMTDONE_INTERVAL;
                }
                else {
                    // cassette 
                    // some savers patch the cassette baud rate, so we evaluate it here 
                    // scanlines per second*10 bit*audiofrequency/(1.79 MHz/2) 
                    this.DELAYED_SEROUT_IRQ = 312 * 50 * 10 * (this.regs[AUDF3] + this.regs[AUDF4] * 0x100) / 895000;
                    // safety check 
                    if (this.DELAYED_SEROUT_IRQ >= 3) {
                        this.readregs[IRQST] |= 0x08;
                        this.DELAYED_XMTDONE_IRQ = 2 * this.DELAYED_SEROUT_IRQ - 2;
                    }
                    else {
                        this.DELAYED_SEROUT_IRQ = 0;
                        this.DELAYED_XMTDONE_IRQ = 0;
                    }
                }
                ;
                break;
            case STIMER:
                this.divnirq[CHAN1] = this.divnmax[CHAN1];
                this.divnirq[CHAN2] = this.divnmax[CHAN2];
                this.divnirq[CHAN3] = this.divnmax[CHAN3];
                this.divnirq[CHAN4] = this.divnmax[CHAN4];
                //POKEYSND_Update(STIMER, byte, 0, SOUND_GAIN);
                break;
            case SKCTL:
                //VOICEBOX_SKCTLPutByte(byte);
                //POKEYSND_Update(SKCTL, byte, 0, SOUND_GAIN);
                if (byte & 4)
                    this.pot_scanline = 228; /* fast pot mode - return results immediately */
                if ((byte & 0x03) == 0) {
                    /* POKEY reset. */
                    /* Stop serial IO. */
                    this.DELAYED_SERIN_IRQ = 0;
                    this.DELAYED_SEROUT_IRQ = 0;
                    this.DELAYED_XMTDONE_IRQ = 0;
                    // TODO: CASSETTE_ResetPOKEY();
                    /* TODO other registers should also be reset. */
                }
                break;
        }
        this.snd_update(addr);
        //POKEYSND_Update(AUDC1, byte, 0, SOUND_GAIN);
    }
    /*****************************************************************************/
    /* Module:  Update_Counter()                                                 */
    /* Purpose: To process the latest control values stored in the AUDF, AUDC,   */
    /*          and AUDCTL registers.  It pre-calculates as much information as  */
    /*          possible for better performance.  This routine has been added    */
    /*          here again as I need the precise frequency for the pokey timers  */
    /*          again. The pokey emulation is therefore somewhat sub-optimal     */
    /*          since the actual pokey emulation should grab the frequency values */
    /*          directly from here instead of calculating them again.            */
    /*                                                                           */
    /* Author:  Ron Fries,Thomas Richter                                         */
    /* Date:    March 27, 1998                                                   */
    /*                                                                           */
    /* Inputs:  chan_mask: Channel mask, one bit per channel.                    */
    /*          The channels that need to be updated                             */
    /*                                                                           */
    /* Outputs: Adjusts local globals - no return value                          */
    /*                                                                           */
    /*****************************************************************************/
    update_counter(chan_mask) {
        /************************************************************/
        /* As defined in the manual, the exact Div_n_cnt values are */
        /* different depending on the frequency and resolution:     */
        /*    64 kHz or 15 kHz - AUDF + 1                           */
        /*    1 MHz, 8-bit -     AUDF + 4                           */
        /*    1 MHz, 16-bit -    AUDF[CHAN1]+256*AUDF[CHAN2] + 7    */
        /************************************************************/
        /* only reset the channels that have changed */
        if (chan_mask & (1 << CHAN1)) {
            /* process channel 1 frequency */
            if (this.regs[AUDCTL] & CH1_179)
                this.divnmax[CHAN1] = this.regs[AUDF1 + CHAN1] + 4;
            else
                this.divnmax[CHAN1] = (this.regs[AUDF1 + CHAN1] + 1) * this.basemult;
            if (this.divnmax[CHAN1] < ANTIC_LINE_C)
                this.divnmax[CHAN1] = ANTIC_LINE_C;
        }
        if (chan_mask & (1 << CHAN2)) {
            /* process channel 2 frequency */
            if (this.regs[AUDCTL] & CH1_CH2) {
                if (this.regs[AUDCTL] & CH1_179)
                    this.divnmax[CHAN2] = this.regs[AUDF1 + CHAN2] * 256 + this.regs[AUDF1 + CHAN1] + 7;
                else
                    this.divnmax[CHAN2] = (this.regs[AUDF1 + CHAN2] * 256 + this.regs[AUDF1 + CHAN1] + 1) * this.basemult;
            }
            else
                this.divnmax[CHAN2] = (this.regs[AUDF1 + CHAN2] + 1) * this.basemult;
            if (this.divnmax[CHAN2] < ANTIC_LINE_C)
                this.divnmax[CHAN2] = ANTIC_LINE_C;
        }
        if (chan_mask & (1 << CHAN4)) {
            /* process channel 4 frequency */
            if (this.regs[AUDCTL] & CH3_CH4) {
                if (this.regs[AUDCTL] & CH3_179)
                    this.divnmax[CHAN4] = this.regs[AUDF1 + CHAN4] * 256 + this.regs[AUDF1 + CHAN3] + 7;
                else
                    this.divnmax[CHAN4] = (this.regs[AUDF1 + CHAN4] * 256 + this.regs[AUDF1 + CHAN3] + 1) * this.basemult;
            }
            else
                this.divnmax[CHAN4] = (this.regs[AUDF1 + CHAN4] + 1) * this.basemult;
            if (this.divnmax[CHAN4] < ANTIC_LINE_C)
                this.divnmax[CHAN4] = ANTIC_LINE_C;
        }
        //console.log(chan_mask, this.divnmax);
    }
    snd_update(addr) {
    }
    advanceScanline() {
        /***************************************************************************
         ** Generate POKEY Timer IRQs if required                                 **
         ** called on a per-scanline basis, not very precise, but good enough     **
         ** for most applications                                                 **
         ***************************************************************************/
        /* on nonpatched i/o-operation, enable the cassette timing */
        /*
        if (!ESC_enable_sio_patch) {
            if (CASSETTE_AddScanLine())
                DELAYED_SERIN_IRQ = 1;
        }
        */
        if ((this.regs[SKCTL] & 0x03) == 0)
            /* Don't process timers when POKEY is in reset mode. */
            return;
        if (this.pot_scanline < 228)
            this.pot_scanline++;
        this.random_scanline_counter += ANTIC_LINE_C;
        this.random_scanline_counter %= (this.regs[AUDCTL] & POLY9) ? POLY9_SIZE : POLY17_SIZE;
        if (this.DELAYED_SERIN_IRQ > 0) {
            if (--this.DELAYED_SERIN_IRQ == 0) {
                // Load a byte to SERIN - even when the IRQ is disabled. 
                this.readregs[SERIN] = this.SIO_GetByte();
                this.generateIRQ(0x20);
            }
        }
        if (this.DELAYED_SEROUT_IRQ > 0) {
            if (--this.DELAYED_SEROUT_IRQ == 0) {
                this.generateIRQ(0x10);
            }
        }
        if (this.DELAYED_XMTDONE_IRQ > 0)
            if (--this.DELAYED_XMTDONE_IRQ == 0) {
                this.generateIRQ(0x08);
            }
        this.advanceIRQTimer(CHAN1, 0x1);
        this.advanceIRQTimer(CHAN2, 0x2);
        this.advanceIRQTimer(CHAN4, 0x4);
    }
    advanceIRQTimer(chan, mask) {
        if ((this.divnirq[chan] -= ANTIC_LINE_C) < 0) {
            this.divnirq[chan] += this.divnmax[chan];
            this.generateIRQ(mask);
            //console.log('irq', chan, this.divnirq[chan], this.divnmax[chan])
        }
    }
    generateIRQ(mask) {
        if (this.regs[IRQEN] & mask) {
            this.irq();
            this.readregs[IRQST] &= ~mask;
        }
    }
    static stateToLongString(state) {
        let s = '';
        s += "Write Registers:\n";
        s += (0, emu_1.dumpRAM)(state.regs, 0, 16);
        s += "Read Registers:\n";
        s += (0, emu_1.dumpRAM)(state.readregs, 0, 16);
        return s;
    }
    CASSETTE_IOLineStatus() {
        return 0;
    }
    siocheck() {
        return (((this.regs[AUDF1 + CHAN3] == 0x28 || this.regs[AUDF1 + CHAN3] == 0x10
            || this.regs[AUDF1 + CHAN3] == 0x08 || this.regs[AUDF1 + CHAN3] == 0x0a)
            && this.regs[AUDF1 + CHAN4] == 0x00) // intelligent peripherals speeds
            || (this.regs[SKCTL] & 0x78) == 0x28) // cassette save mode
            && (this.regs[AUDCTL] & 0x28) == 0x28;
    }
    SIO_PutByte(byte) {
        // TODO
        console.log("SIO put byte", byte);
    }
    SIO_GetByte() {
        return 0; // TODO
    }
}
exports.POKEY = POKEY;
//const SOUND_GAIN 4
/*
void Frame(void)
{
    random_scanline_counter %= (this.regs[AUDCTL] & POLY9) ? POLY9_SIZE : POLY17_SIZE;
}
*/
//# sourceMappingURL=pokey.js.map