"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIA6522 = void 0;
const util_1 = require("../../common/util");
// MOS 6522 Versatile Interface Adapter
// http://archive.6502.org/datasheets/mos_6522_preliminary_nov_1977.pdf
// Port A/B behaviour is host-specific; see VIA6522Host above.
// Based on the 6522 core from https://github.com/raz0red/jsvecx
class VIA6522 {
    constructor(host) {
        //static unsigned via_ora;
        this.ora = 0;
        //static unsigned via_orb;
        this.orb = 0;
        //static unsigned via_ddra;
        this.ddra = 0;
        //static unsigned via_ddrb;
        this.ddrb = 0;
        //static unsigned via_t1on;  /* is timer 1 on? */
        this.t1on = 0;
        //static unsigned via_t1int; /* are timer 1 interrupts allowed? */
        this.t1int = 0;
        //static unsigned via_t1c;
        this.t1c = 0;
        //static unsigned via_t1ll;
        this.t1ll = 0;
        //static unsigned via_t1lh;
        this.t1lh = 0;
        //static unsigned via_t1pb7; /* timer 1 controlled version of pb7 */
        this.t1pb7 = 0;
        //static unsigned via_t2on;  /* is timer 2 on? */
        this.t2on = 0;
        //static unsigned via_t2int; /* are timer 2 interrupts allowed? */
        this.t2int = 0;
        //static unsigned via_t2c;
        this.t2c = 0;
        //static unsigned via_t2ll;
        this.t2ll = 0;
        //static unsigned via_sr;
        this.sr = 0;
        //static unsigned via_srb;   /* number of bits shifted so far */
        this.srb = 0;
        //static unsigned via_src;   /* shift counter */
        this.src = 0;
        //static unsigned via_srclk;
        this.srclk = 0;
        //static unsigned via_acr;
        this.acr = 0;
        //static unsigned via_pcr;
        this.pcr = 0;
        //static unsigned via_ifr;
        this.ifr = 0;
        //static unsigned via_ier;
        this.ier = 0;
        //static unsigned via_ca2;
        this.ca2 = 0;
        //static unsigned via_cb2h;  /* basic handshake version of cb2 */
        this.cb2h = 0;
        //static unsigned via_cb2s;  /* version of cb2 controlled by the shift register */
        this.cb2s = 0;
        this.host = host;
        this.reset();
    }
    reset() {
        // "Reset sets all registers to zero except t1 t2 and sr"
        this.ora = 0;
        this.orb = 0;
        this.ddra = 0;
        this.ddrb = 0;
        this.t1on = 0;
        this.t1int = 0;
        this.t1c = 0;
        this.t1ll = 0;
        this.t1lh = 0;
        this.t1pb7 = 0x80;
        this.t2on = 0;
        this.t2int = 0;
        this.t2c = 0;
        this.t2ll = 0;
        this.sr = 0;
        this.srb = 8;
        this.src = 0;
        this.srclk = 0;
        this.acr = 0;
        this.pcr = 0;
        this.ifr = 0;
        this.ier = 0;
        this.ca2 = 1;
        this.cb2h = 1;
        this.cb2s = 0;
    }
    ;
    int_update() {
        if ((this.ifr & 0x7f) & (this.ier & 0x7f)) {
            this.ifr |= 0x80;
        }
        else {
            this.ifr &= 0x7f;
        }
    }
    step0() {
        var t2shift = 0;
        if (this.t1on) {
            this.t1c = (this.t1c > 0 ? this.t1c - 1 : 0xffff);
            if ((this.t1c & 0xffff) == 0xffff) {
                /* counter just rolled over */
                if (this.acr & 0x40) {
                    /* continuous interrupt mode */
                    this.ifr |= 0x40;
                    this.int_update();
                    this.t1pb7 ^= 0x80;
                    /* reload counter */
                    this.t1c = (this.t1lh << 8) | this.t1ll;
                }
                else {
                    /* one shot mode */
                    if (this.t1int) {
                        this.ifr |= 0x40;
                        this.int_update();
                        this.t1pb7 = 0x80;
                        this.t1int = 0;
                    }
                }
            }
        }
        if (this.t2on && (this.acr & 0x20) == 0x00) {
            this.t2c = (this.t2c > 0 ? this.t2c - 1 : 0xffff);
            if ((this.t2c & 0xffff) == 0xffff) {
                /* one shot mode */
                if (this.t2int) {
                    this.ifr |= 0x20;
                    this.int_update();
                    this.t2int = 0;
                }
            }
        }
        /* shift counter */
        this.src = (this.src > 0 ? this.src - 1 : 0xff); // raz was 0xffffffff
        if ((this.src & 0xff) == 0xff) {
            this.src = this.t2ll;
            if (this.srclk) {
                t2shift = 1;
                this.srclk = 0;
            }
            else {
                t2shift = 0;
                this.srclk = 1;
            }
        }
        else {
            t2shift = 0;
        }
        if (this.srb < 8) {
            switch (this.acr & 0x1c) {
                case 0x00:
                    /* disabled */
                    break;
                case 0x04:
                    /* shift in under control of t2 */
                    if (t2shift) {
                        /* shifting in 0s since cb2 is always an output */
                        this.sr <<= 1;
                        this.srb++;
                    }
                    break;
                case 0x08:
                    /* shift in under system clk control */
                    this.sr <<= 1;
                    this.srb++;
                    break;
                case 0x0c:
                    /* shift in under cb1 control */
                    break;
                case 0x10:
                    /* shift out under t2 control (free run) */
                    if (t2shift) {
                        this.cb2s = (this.sr >> 7) & 1;
                        this.sr <<= 1;
                        this.sr |= this.cb2s;
                    }
                    break;
                case 0x14:
                    /* shift out under t2 control */
                    if (t2shift) {
                        this.cb2s = (this.sr >> 7) & 1;
                        this.sr <<= 1;
                        this.sr |= this.cb2s;
                        this.srb++;
                    }
                    break;
                case 0x18:
                    /* shift out under system clock control */
                    this.cb2s = (this.sr >> 7) & 1;
                    this.sr <<= 1;
                    this.sr |= this.cb2s;
                    this.srb++;
                    break;
                case 0x1c:
                    /* shift out under cb1 control */
                    break;
            }
            if (this.srb == 8) {
                this.ifr |= 0x04;
                this.int_update();
            }
        }
    }
    step1() {
        if ((this.pcr & 0x0e) == 0x0a) {
            /* if ca2 is in pulse mode, then make sure
             * it gets restored to '1' after the pulse.
             */
            this.ca2 = 1;
        }
        if ((this.pcr & 0xe0) == 0xa0) {
            /* if cb2 is in pulse mode, then make sure
             * it gets restored to '1' after the pulse.
             */
            this.cb2h = 1;
        }
    }
    read(address, peek = false) {
        var data;
        /* io */
        switch (address & 0xf) {
            case 0x0:
                /* compare signal is an input so the value does not come from
                  * orb.
                  */
                var ext = (this.host && this.host.readPortB && this.host.readPortB()) | 0;
                if (this.acr & 0x80) {
                    /* timer 1 has control of bit 7 */
                    data = ((this.orb & 0x5f) | this.t1pb7 | ext);
                }
                else {
                    /* bit 7 is being driven by orb */
                    data = ((this.orb & 0xdf) | ext);
                }
                return data & 0xff;
            case 0x1:
                /* register 1 also performs handshakes if necessary */
                if (!peek && (this.pcr & 0x0e) == 0x08) {
                    /* if ca2 is in pulse mode or handshake mode, then it
                    * goes low whenever ira is read.
                    */
                    this.ca2 = 0;
                }
            /* fall through */
            case 0xf:
                var extA = this.host && this.host.readPortA && this.host.readPortA();
                if (extA === undefined) {
                    data = this.ora;
                }
                else {
                    /* the external device is driving port a */
                    data = extA;
                }
                return data & 0xff;
            case 0x2:
                return this.ddrb & 0xff;
            case 0x3:
                return this.ddra & 0xff;
            case 0x4:
                /* T1 low order counter */
                data = this.t1c;
                if (!peek) {
                    this.ifr &= 0xbf; /* remove timer 1 interrupt flag */
                    this.t1on = 0; /* timer 1 is stopped */
                    this.t1int = 0;
                    this.t1pb7 = 0x80;
                    this.int_update();
                }
                return data & 0xff;
            case 0x5:
                /* T1 high order counter */
                return (this.t1c >> 8) & 0xff;
            case 0x6:
                /* T1 low order latch */
                return this.t1ll & 0xff;
            case 0x7:
                /* T1 high order latch */
                return this.t1lh & 0xff;
            case 0x8:
                /* T2 low order counter */
                data = this.t2c;
                if (!peek) {
                    this.ifr &= 0xdf; /* remove timer 2 interrupt flag */
                    this.t2on = 0; /* timer 2 is stopped */
                    this.t2int = 0;
                    this.int_update();
                }
                return data & 0xff;
            case 0x9:
                /* T2 high order counter */
                return (this.t2c >> 8);
            case 0xa:
                data = this.sr;
                if (!peek) {
                    this.ifr &= 0xfb; /* remove shift register interrupt flag */
                    this.srb = 0;
                    this.srclk = 1;
                    this.int_update();
                }
                return data & 0xff;
            case 0xb:
                return this.acr & 0xff;
            case 0xc:
                return this.pcr & 0xff;
            case 0xd:
                /* interrupt flag register */
                return this.ifr & 0xff;
            case 0xe:
                /* interrupt enable register */
                return (this.ier | 0x80) & 0xff;
        }
    }
    write(address, data) {
        switch (address & 0xf) {
            case 0x0:
                this.orb = data;
                if (this.host && this.host.writePortB)
                    this.host.writePortB(this.orb);
                if ((this.pcr & 0xe0) == 0x80) {
                    /* if cb2 is in pulse mode or handshake mode, then it
                    * goes low whenever orb is written.
                    */
                    this.cb2h = 0;
                }
                break;
            case 0x1:
                /* register 1 also performs handshakes if necessary */
                if ((this.pcr & 0x0e) == 0x08) {
                    /* if ca2 is in pulse mode or handshake mode, then it
                    * goes low whenever ora is written.
                    */
                    this.ca2 = 0;
                }
            /* fall through */
            case 0xf:
                this.ora = data;
                if (this.host && this.host.writePortA)
                    this.host.writePortA(this.ora);
                break;
            case 0x2:
                this.ddrb = data;
                break;
            case 0x3:
                this.ddra = data;
                break;
            case 0x4:
                /* T1 low order counter */
                this.t1ll = data;
                break;
            case 0x5:
                /* T1 high order counter */
                this.t1lh = data;
                this.t1c = (this.t1lh << 8) | this.t1ll;
                this.ifr &= 0xbf; /* remove timer 1 interrupt flag */
                this.t1on = 1; /* timer 1 starts running */
                this.t1int = 1;
                this.t1pb7 = 0;
                this.int_update();
                break;
            case 0x6:
                /* T1 low order latch */
                this.t1ll = data;
                break;
            case 0x7:
                /* T1 high order latch */
                this.t1lh = data;
                break;
            case 0x8:
                /* T2 low order latch */
                this.t2ll = data;
                break;
            case 0x9:
                /* T2 high order latch/counter */
                this.t2c = (data << 8) | this.t2ll;
                this.ifr &= 0xdf;
                this.t2on = 1; /* timer 2 starts running */
                this.t2int = 1;
                this.int_update();
                break;
            case 0xa:
                this.sr = data;
                this.ifr &= 0xfb; /* remove shift register interrupt flag */
                this.srb = 0;
                this.srclk = 1;
                this.int_update();
                break;
            case 0xb:
                this.acr = data;
                break;
            case 0xc:
                this.pcr = data;
                if ((this.pcr & 0x0e) == 0x0c) {
                    /* ca2 is outputting low */
                    this.ca2 = 0;
                }
                else {
                    /* ca2 is disabled or in pulse mode or is
                    * outputting high.
                    */
                    this.ca2 = 1;
                }
                if ((this.pcr & 0xe0) == 0xc0) {
                    /* cb2 is outputting low */
                    this.cb2h = 0;
                }
                else {
                    /* cb2 is disabled or is in pulse mode or is
                    * outputting high.
                    */
                    this.cb2h = 1;
                }
                break;
            case 0xd:
                /* interrupt flag register */
                this.ifr &= (~(data & 0x7f)); // & 0xffff ); // raz
                this.int_update();
                break;
            case 0xe:
                /* interrupt enable register */
                if (data & 0x80) {
                    this.ier |= data & 0x7f;
                }
                else {
                    this.ier &= (~(data & 0x7f)); // & 0xffff ); // raz
                }
                this.int_update();
                break;
        }
    }
    saveState() {
        return (0, util_1.safe_extend)(null, {}, this);
    }
    loadState(state) {
        (0, util_1.safe_extend)(null, this, state);
    }
    toLongString(state) {
        var s = "";
        for (var key in state) {
            s += key + ": " + (0, util_1.hex)(state[key]) + "\n";
        }
        return s;
    }
}
exports.VIA6522 = VIA6522;
;
//# sourceMappingURL=via6522.js.map