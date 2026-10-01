"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const util_1 = require("../common/util");
const audio_1 = require("../common/audio");
const probe_1 = require("../common/probe");
const devices_1 = require("../common/devices");
// emulator from https://github.com/raz0red/jsvecx
// https://roadsidethoughts.com/vectrex/vectrex-memory-map.htm
// http://www.playvectrex.com/designit/chrissalo/memorymap.htm
// http://vectrexmuseum.com/share/coder/other/TEXT/VECTREX/INTERNAL.TXT
// http://vide.malban.de/help/vectrex-tutorial-ii-starting-with-bios
// http://www.playvectrex.com/designit/chrissalo/bios.asm
// https://www.6809.org.uk/asm6809/doc/asm6809.shtml
// http://www.playvectrex.com/
// http://vectrexmuseum.com/vectrexhistory.php
var VECTREX_PRESETS = [
    { id: 'hello.xasm', name: 'Hello World (ASM)' },
    { id: 'hello.c', name: 'Hello World (CMOC)' },
    { id: 'joystick.c', name: 'Joystick Test (CMOC)' },
    { id: 'threed.c', name: '3D Transformations (CMOC)' },
];
// TODO: player 2
var VECTREX_KEYCODE_MAP = (0, emu_1.makeKeycodeMap)([
    [emu_1.Keys.LEFT, 0, 0x01],
    [emu_1.Keys.RIGHT, 0, 0x02],
    [emu_1.Keys.DOWN, 0, 0x04],
    [emu_1.Keys.UP, 0, 0x08],
    [emu_1.Keys.GP_B, 2, 0x01],
    [emu_1.Keys.GP_A, 2, 0x02],
    [emu_1.Keys.GP_D, 2, 0x04],
    [emu_1.Keys.GP_C, 2, 0x08],
    [emu_1.Keys.P2_LEFT, 1, 0x01],
    [emu_1.Keys.P2_RIGHT, 1, 0x02],
    [emu_1.Keys.P2_DOWN, 1, 0x04],
    [emu_1.Keys.P2_UP, 1, 0x08],
    [emu_1.Keys.P2_GP_B, 2, 0x10],
    [emu_1.Keys.P2_GP_A, 2, 0x20],
    [emu_1.Keys.P2_GP_D, 2, 0x40],
    [emu_1.Keys.P2_GP_C, 2, 0x80],
]);
//
class VIA6522 {
    constructor(vectrex) {
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
        this.vectrex = vectrex;
    }
    reset() {
        // http://archive.6502.org/datasheets/mos_6522_preliminary_nov_1977.pdf
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
    read(address) {
        var data;
        /* io */
        switch (address & 0xf) {
            case 0x0:
                /* compare signal is an input so the value does not come from
                  * orb.
                  */
                if (this.acr & 0x80) {
                    /* timer 1 has control of bit 7 */
                    data = ((this.orb & 0x5f) | this.t1pb7 | this.vectrex.alg.compare);
                }
                else {
                    /* bit 7 is being driven by orb */
                    data = ((this.orb & 0xdf) | this.vectrex.alg.compare);
                }
                return data & 0xff;
            case 0x1:
                /* register 1 also performs handshakes if necessary */
                if ((this.pcr & 0x0e) == 0x08) {
                    /* if ca2 is in pulse mode or handshake mode, then it
                    * goes low whenever ira is read.
                    */
                    this.ca2 = 0;
                }
            /* fall through */
            case 0xf:
                if ((this.orb & 0x18) == 0x08) {
                    /* the snd chip is driving port a */
                    data = this.vectrex.psg.readData();
                    //console.log(this.vectrex.psg.currentRegister(), data);
                }
                else {
                    data = this.ora;
                }
                return data & 0xff;
            case 0x2:
                return this.ddrb & 0xff;
            case 0x3:
                return this.ddra & 0xff;
            case 0x4:
                /* T1 low order counter */
                data = this.t1c;
                this.ifr &= 0xbf; /* remove timer 1 interrupt flag */
                this.t1on = 0; /* timer 1 is stopped */
                this.t1int = 0;
                this.t1pb7 = 0x80;
                this.int_update();
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
                this.ifr &= 0xdf; /* remove timer 2 interrupt flag */
                this.t2on = 0; /* timer 2 is stopped */
                this.t2int = 0;
                this.int_update();
                return data & 0xff;
            case 0x9:
                /* T2 high order counter */
                return (this.t2c >> 8);
            case 0xa:
                data = this.sr;
                this.ifr &= 0xfb; /* remove shift register interrupt flag */
                this.srb = 0;
                this.srclk = 1;
                this.int_update();
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
                this.vectrex.snd_update();
                this.vectrex.alg.update();
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
                this.vectrex.snd_update();
                /* output of port a feeds directly into the dac which then
                 * feeds the x axis sample and hold.
                 */
                this.vectrex.alg.xsh = data ^ 0x80;
                this.vectrex.alg.update();
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
;
const Globals = {
    VECTREX_MHZ: 1500000, /* speed of the vectrex being emulated */
    VECTREX_COLORS: 128, /* number of possible colors ... grayscale */
    ALG_MAX_X: 33000,
    ALG_MAX_Y: 41000,
    //VECTREX_PDECAY: 30, /* phosphor decay rate */
    //VECTOR_HASH: 65521,
    SCREEN_X_DEFAULT: 900,
    SCREEN_Y_DEFAULT: 1100,
    BOUNDS_MIN_X: 0,
    BOUNDS_MAX_X: 30000,
    BOUNDS_MIN_Y: 41000,
    BOUNDS_MAX_Y: 0,
};
class VectrexAnalog {
    constructor(vectrex) {
        this.videoEnabled = true;
        //static unsigned rsh;  /* zero ref sample and hold */
        this.rsh = 0;
        //static unsigned xsh;  /* x sample and hold */
        this.xsh = 0;
        //static unsigned ysh;  /* y sample and hold */
        this.ysh = 0;
        //static unsigned zsh;  /* z sample and hold */
        this.zsh = 0;
        //unsigned jch0;		  /* joystick direction channel 0 */
        this.jch0 = 0;
        //unsigned jch1;		  /* joystick direction channel 1 */
        this.jch1 = 0;
        //unsigned jch2;		  /* joystick direction channel 2 */
        this.jch2 = 0;
        //unsigned jch3;		  /* joystick direction channel 3 */
        this.jch3 = 0;
        //static unsigned jsh;  /* joystick sample and hold */
        this.jsh = 0;
        //static unsigned compare;
        this.compare = 0;
        //static long dx;     /* delta x */
        this.dx = 0;
        //static long dy;     /* delta y */
        this.dy = 0;
        //static long curr_x; /* current x position */
        this.curr_x = 0;
        //static long curr_y; /* current y position */
        this.curr_y = 0;
        this.max_x = Globals.ALG_MAX_X >> 1;
        this.max_y = Globals.ALG_MAX_Y >> 1;
        //static unsigned vectoring; /* are we drawing a vector right now? */
        this.vectoring = false;
        //static long vector_x0;
        this.vector_x0 = 0;
        //static long vector_y0;
        this.vector_y0 = 0;
        //static long vector_x1;
        this.vector_x1 = 0;
        //static long vector_y1;
        this.vector_y1 = 0;
        //static long vector_dx;
        this.vector_dx = 0;
        //static long vector_dy;
        this.vector_dy = 0;
        //static unsigned char vector_color;
        this.vector_color = 0;
        this.vectrex = vectrex;
    }
    reset() {
        this.rsh = 128;
        this.xsh = 128;
        this.ysh = 128;
        this.zsh = 0;
        this.jch0 = 128;
        this.jch1 = 128;
        this.jch2 = 128;
        this.jch3 = 128;
        this.jsh = 128;
        this.compare = 0;
        /* check this */
        this.dx = 0;
        this.dy = 0;
        this.curr_x = Globals.ALG_MAX_X >> 1;
        this.curr_y = Globals.ALG_MAX_Y >> 1;
        this.vectoring = false;
    }
    update() {
        var via = this.vectrex.via;
        switch (via.orb & 0x06) {
            case 0x00:
                this.jsh = this.jch0;
                if ((via.orb & 0x01) == 0x00) {
                    /* demultiplexor is on */
                    this.ysh = this.xsh;
                }
                break;
            case 0x02:
                this.jsh = this.jch1;
                if ((via.orb & 0x01) == 0x00) {
                    /* demultiplexor is on */
                    this.rsh = this.xsh;
                }
                break;
            case 0x04:
                this.jsh = this.jch2;
                if ((via.orb & 0x01) == 0x00) {
                    /* demultiplexor is on */
                    if (this.xsh > 0x80) {
                        this.zsh = this.xsh - 0x80;
                    }
                    else {
                        this.zsh = 0;
                    }
                }
                break;
            case 0x06:
                /* sound output line */
                this.jsh = this.jch3;
                break;
        }
        /* compare the current joystick direction with a reference */
        if (this.jsh > this.xsh) {
            this.compare = 0x20;
        }
        else {
            this.compare = 0;
        }
        /* compute the new "deltas" */
        this.dx = this.xsh - this.rsh;
        this.dy = this.rsh - this.ysh;
    }
    step() {
        var via = this.vectrex.via;
        var sig_dx = 0;
        var sig_dy = 0;
        var sig_ramp = 0;
        var sig_blank = 0;
        if (via.acr & 0x10) {
            sig_blank = via.cb2s;
        }
        else {
            sig_blank = via.cb2h;
        }
        if (via.ca2 == 0) {
            /* need to force the current point to the 'orgin' so just
             * calculate distance to origin and use that as dx,dy.
             */
            sig_dx = this.max_x - this.curr_x;
            sig_dy = this.max_y - this.curr_y;
        }
        else {
            if (via.acr & 0x80) {
                sig_ramp = via.t1pb7;
            }
            else {
                sig_ramp = via.orb & 0x80;
            }
            if (sig_ramp == 0) {
                sig_dx = this.dx;
                sig_dy = this.dy;
            }
            else {
                sig_dx = 0;
                sig_dy = 0;
            }
        }
        //if (sig_dx || sig_dy) console.log(via.ca2, this.curr_x, this.curr_y, this.dx, this.dy, sig_dx, sig_dy, sig_ramp, sig_blank);
        if (!this.vectoring) {
            if (sig_blank == 1 &&
                this.curr_x >= 0 && this.curr_x < Globals.ALG_MAX_X &&
                this.curr_y >= 0 && this.curr_y < Globals.ALG_MAX_Y) {
                /* start a new vector */
                this.vectoring = true;
                this.vector_x0 = this.curr_x;
                this.vector_y0 = this.curr_y;
                this.vector_x1 = this.curr_x;
                this.vector_y1 = this.curr_y;
                this.vector_dx = sig_dx;
                this.vector_dy = sig_dy;
                this.vector_color = this.zsh & 0xff;
            }
        }
        else {
            /* already drawing a vector ... check if we need to turn it off */
            if (sig_blank == 0) {
                /* blank just went on, vectoring turns off, and we've got a
                 * new line.
                 */
                this.vectoring = false;
                this.addline(this.vector_x0, this.vector_y0, this.vector_x1, this.vector_y1, this.vector_color);
            }
            else if (sig_dx != this.vector_dx ||
                sig_dy != this.vector_dy ||
                (this.zsh & 0xff) != this.vector_color) {
                /* the parameters of the vectoring processing has changed.
                 * so end the current line.
                 */
                this.addline(this.vector_x0, this.vector_y0, this.vector_x1, this.vector_y1, this.vector_color);
                /* we continue vectoring with a new set of parameters if the
                 * current point is not out of limits.
                 */
                if (this.curr_x >= 0 && this.curr_x < Globals.ALG_MAX_X &&
                    this.curr_y >= 0 && this.curr_y < Globals.ALG_MAX_Y) {
                    this.vector_x0 = this.curr_x;
                    this.vector_y0 = this.curr_y;
                    this.vector_x1 = this.curr_x;
                    this.vector_y1 = this.curr_y;
                    this.vector_dx = sig_dx;
                    this.vector_dy = sig_dy;
                    this.vector_color = this.zsh & 0xff;
                }
                else {
                    this.vectoring = false;
                }
            }
        }
        this.curr_x += sig_dx;
        this.curr_y += sig_dy;
        if (this.vectoring &&
            this.curr_x >= 0 && this.curr_x < Globals.ALG_MAX_X &&
            this.curr_y >= 0 && this.curr_y < Globals.ALG_MAX_Y) {
            /* we're vectoring ... current point is still within limits so
             * extend the current vector.
             */
            this.vector_x1 = this.curr_x;
            this.vector_y1 = this.curr_y;
        }
    }
    addline(x0, y0, x1, y1, color) {
        if (!this.videoEnabled)
            return;
        // TODO
        //console.log(x0, y0, x1, y1, color);
        x0 = (x0 - Globals.BOUNDS_MIN_X) / (Globals.BOUNDS_MAX_X - Globals.BOUNDS_MIN_X) * Globals.SCREEN_X_DEFAULT;
        x1 = (x1 - Globals.BOUNDS_MIN_X) / (Globals.BOUNDS_MAX_X - Globals.BOUNDS_MIN_X) * Globals.SCREEN_X_DEFAULT;
        y0 = (y0 - Globals.BOUNDS_MIN_Y) / (Globals.BOUNDS_MAX_Y - Globals.BOUNDS_MIN_Y) * Globals.SCREEN_Y_DEFAULT;
        y1 = (y1 - Globals.BOUNDS_MIN_Y) / (Globals.BOUNDS_MAX_Y - Globals.BOUNDS_MIN_Y) * Globals.SCREEN_Y_DEFAULT;
        this.vectrex.video.drawLine(x0, y0, x1, y1, color, 7);
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
            s += key + ": " + state[key] + "\n";
        }
        return s;
    }
}
//
class VectrexPlatform extends baseplatform_1.Base6809Platform {
    constructor(mainElement) {
        super();
        // probing
        this.nullProbe = new devices_1.NullProbe();
        this.probe = this.nullProbe;
        this.mainElement = mainElement;
    }
    getPresets() {
        return VECTREX_PRESETS;
    }
    showHelp() {
        return "https://8bitworkshop.com/docs/platforms/vectrex/";
    }
    async start() {
        this.via = new VIA6522(this);
        this.alg = new VectrexAnalog(this);
        var biosResponse = await fetch('res/vectrex.bios');
        if (!biosResponse.ok)
            throw new Error('could not load BIOS file');
        this.bios = (0, emu_1.padBytes)(new Uint8Array(await biosResponse.arrayBuffer()), 0x2000);
        this.ram = new Uint8Array(0x400);
        this.inputs = new Uint8Array(4);
        var mbus = {
            read: (0, emu_1.newAddressDecoder)([
                [0x0000, 0x7fff, 0, (a) => { return this.rom && this.rom[a]; }],
                [0xc800, 0xcfff, 0x3ff, (a) => { return this.ram[a]; }],
                [0xd000, 0xdfff, 0xf, (a) => { return this.via.read(a); }],
                [0xe000, 0xffff, 0x1fff, (a) => { return this.bios && this.bios[a]; }],
            ]),
            write: (0, emu_1.newAddressDecoder)([
                [0xc800, 0xcfff, 0x3ff, (a, v) => { this.ram[a] = v; }],
                [0xd000, 0xd7ff, 0x3ff, (a, v) => { this.via.write(a & 0xf, v); }],
                [0xd800, 0xdfff, 0x3ff, (a, v) => { this.ram[a] = v; this.via.write(a & 0xf, v); }],
            ])
        };
        this.bus = {
            read: (a) => { var v = mbus.read(a); this.probe.logRead(a, v); return v; },
            write: (a, v) => { this.probe.logWrite(a, v); mbus.write(a, v); }
        };
        this._cpu = this.newCPU(this.bus);
        // create video/audio
        this.video = new emu_1.VectorVideo(this.mainElement, Globals.SCREEN_X_DEFAULT, Globals.SCREEN_Y_DEFAULT);
        this.video.persistenceAlpha = 0.2;
        this.audio = new audio_1.MasterAudio();
        this.psg = new audio_1.AY38910_Audio(this.audio);
        this.video.create();
        this.timer = new emu_1.AnimationTimer(60, this.nextFrame.bind(this));
        this.poller = (0, emu_1.setKeyboardFromMap)(this.video, this.inputs, VECTREX_KEYCODE_MAP); // true = always send function);
    }
    pollControls() { this.poller && this.poller.poll(); }
    // TODO: loadControlsState
    updateControls() {
        // joystick (analog simulation)
        this.alg.jch0 = (this.inputs[0] & 0x1) ? 0x00 : (this.inputs[0] & 0x2) ? 0xff : 0x80;
        this.alg.jch1 = (this.inputs[0] & 0x4) ? 0x00 : (this.inputs[0] & 0x8) ? 0xff : 0x80;
        this.alg.jch2 = (this.inputs[1] & 0x1) ? 0x00 : (this.inputs[1] & 0x2) ? 0xff : 0x80;
        this.alg.jch3 = (this.inputs[1] & 0x4) ? 0x00 : (this.inputs[1] & 0x8) ? 0xff : 0x80;
        // buttons (digital)
        this.psg.psg.register[14] = ~this.inputs[2];
    }
    advance(novideo) {
        if (!novideo)
            this.video.clear();
        this.alg.videoEnabled = !novideo;
        this.updateControls();
        this.probe.logNewFrame();
        var frameCycles = 1500000 / 60;
        var cycles = 0;
        while (cycles < frameCycles) {
            cycles += this.nextCycle();
        }
        return cycles;
    }
    nextCycle() {
        this.probe.logExecute(this.getPC(), this.getSP());
        if (this.via.ifr & 0x80) {
            this._cpu.interrupt();
        }
        var n = this.runCPU(this._cpu, 1);
        if (n == 0)
            n = 1; // TODO?
        this.probe.logClocks(n);
        for (var i = 0; i < n; i++) {
            this.via.step0();
            this.alg.step();
            this.via.step1();
        }
        return n;
    }
    snd_update() {
        switch (this.via.orb & 0x18) {
            case 0x00:
                /* the sound chip is disabled */
                break;
            case 0x08:
                /* the sound chip is sending data */
                break;
            case 0x10:
                /* the sound chip is recieving data */
                if (this.psg.curreg != 14) {
                    this.psg.setData(this.via.ora);
                }
                break;
            case 0x18:
                /* the sound chip is latching an address */
                if ((this.via.ora & 0xf0) == 0x00) {
                    this.psg.selectRegister(this.via.ora & 0x0f);
                }
                break;
        }
    }
    getCPUState() {
        return this._cpu.saveState();
    }
    loadROM(title, data) {
        this.rom = (0, emu_1.padBytes)(data, 0x8000);
        this.reset();
    }
    loadBIOS(title, data) {
        this.bios = (0, emu_1.padBytes)(data, 0x2000);
        this.reset();
    }
    isRunning() {
        return this.timer.isRunning();
    }
    pause() {
        this.timer.stop();
        this.audio.stop();
    }
    resume() {
        this.timer.start();
        this.audio.start();
    }
    reset() {
        this._cpu.reset();
        this.via.reset();
        this.alg.reset();
    }
    readAddress(addr) {
        return ((addr & 0xf000) != 0xd000) ? this.bus.read(addr) : null; // ignore I/O space
    }
    loadState(state) {
        this._cpu.loadState(state.c);
        this.ram.set(state.b);
        this.via.loadState(state.via);
        this.alg.loadState(state.alg);
        this.loadControlsState(state);
    }
    saveState() {
        return {
            c: this.getCPUState(),
            b: this.ram.slice(0),
            via: this.via.saveState(),
            alg: this.alg.saveState(),
            in: this.inputs.slice(0)
        };
    }
    loadControlsState(state) {
        this.inputs.set(state.in);
    }
    saveControlsState() {
        return {
            in: this.inputs.slice(0)
        };
    }
    getMemoryMap() {
        return {
            main: [
                { name: 'Cartridge ROM', start: 0x0000, size: 0x8000, type: 'rom' },
                { name: 'RAM', start: 0xc800, size: 0x400, type: 'ram' },
                { name: 'I/O Registers', start: 0xd000, size: 0x80, type: 'io' },
                { name: 'BIOS', start: 0xe000, size: 0x2000, type: 'rom' },
            ]
        };
    }
    ;
    getDebugCategories() {
        return super.getDebugCategories().concat(['VIA6522', 'ANALOG']);
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'VIA6522': return this.via.toLongString(state.via);
            case 'ANALOG': return this.alg.toLongString(state.alg);
            default: return super.getDebugInfo(category, state);
        }
    }
    startProbing() {
        var rec = new probe_1.ProbeRecorder(this);
        this.connectProbe(rec);
        return rec;
    }
    stopProbing() {
        this.connectProbe(null);
    }
    connectProbe(probe) {
        this.probe = probe || this.nullProbe;
    }
}
//
emu_1.PLATFORMS['vectrex'] = VectrexPlatform;
//# sourceMappingURL=vectrex.js.map