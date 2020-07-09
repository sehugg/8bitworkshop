
import { Platform, BaseZ80Platform, Base6502Platform, Base6809Platform } from "../common/baseplatform";
import { PLATFORMS, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, VectorVideo, Keys, makeKeycodeMap } from "../common/emu";
import { hex, lzgmini, stringToByteArray, safe_extend } from "../common/util";
import { MasterAudio, AY38910_Audio } from "../common/audio";
import { ProbeRecorder } from "../common/recorder";
import { NullProbe, Probeable, ProbeAll } from "../common/devices";

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
]

// TODO: player 2
var VECTREX_KEYCODE_MAP = makeKeycodeMap([
  [Keys.LEFT,  0, 0x01],
  [Keys.RIGHT, 0, 0x02],
  [Keys.DOWN,  0, 0x04],
  [Keys.UP,    0, 0x08],
  [Keys.GP_B,  2, 0x01],
  [Keys.GP_A,  2, 0x02],
  [Keys.GP_D,  2, 0x04],
  [Keys.GP_C,  2, 0x08],

  [Keys.P2_LEFT,  1, 0x01],
  [Keys.P2_RIGHT, 1, 0x02],
  [Keys.P2_DOWN,  1, 0x04],
  [Keys.P2_UP,    1, 0x08],
  [Keys.P2_GP_B,  2, 0x10],
  [Keys.P2_GP_A,  2, 0x20],
  [Keys.P2_GP_D,  2, 0x40],
  [Keys.P2_GP_C,  2, 0x80],
]);

//

class VIA6522 {
  vectrex: VectrexPlatform;
  constructor(vectrex) {
    this.vectrex = vectrex;
  }

  //static unsigned via_ora;
  ora = 0;
  //static unsigned via_orb;
  orb = 0;
  //static unsigned via_ddra;
  ddra = 0;
  //static unsigned via_ddrb;
  ddrb = 0;
  //static unsigned via_t1on;  /* is timer 1 on? */
  t1on = 0;
  //static unsigned via_t1int; /* are timer 1 interrupts allowed? */
  t1int = 0;
  //static unsigned via_t1c;
  t1c = 0;
  //static unsigned via_t1ll;
  t1ll = 0;
  //static unsigned via_t1lh;
  t1lh = 0;
  //static unsigned via_t1pb7; /* timer 1 controlled version of pb7 */
  t1pb7 = 0;
  //static unsigned via_t2on;  /* is timer 2 on? */
  t2on = 0;
  //static unsigned via_t2int; /* are timer 2 interrupts allowed? */
  t2int = 0;
  //static unsigned via_t2c;
  t2c = 0;
  //static unsigned via_t2ll;
  t2ll = 0;
  //static unsigned via_sr;
  sr = 0;
  //static unsigned via_srb;   /* number of bits shifted so far */
  srb = 0;
  //static unsigned via_src;   /* shift counter */
  src = 0;
  //static unsigned via_srclk;
  srclk = 0;
  //static unsigned via_acr;
  acr = 0;
  //static unsigned via_pcr;
  pcr = 0;
  //static unsigned via_ifr;
  ifr = 0;
  //static unsigned via_ier;
  ier = 0;
  //static unsigned via_ca2;
  ca2 = 0;
  //static unsigned via_cb2h;  /* basic handshake version of cb2 */
  cb2h = 0;
  //static unsigned via_cb2s;  /* version of cb2 controlled by the shift register */
  cb2s = 0;

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
  };

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
    return safe_extend(null, {}, this);
  }
  loadState(state) {
    safe_extend(null, this, state);
  }
  toLongString(state) {
    var s = "";
    for (var key in state) {
      s += key + ": " + hex(state[key]) + "\n";
    }
    return s;
  }
};

const Globals =
{
  VECTREX_MHZ: 1500000, /* speed of the vectrex being emulated */
  VECTREX_COLORS: 128,     /* number of possible colors ... grayscale */
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
  vectrex: VectrexPlatform;
  constructor(vectrex) {
    this.vectrex = vectrex;
  }
  videoEnabled = true;
  //static unsigned rsh;  /* zero ref sample and hold */
  rsh = 0;
  //static unsigned xsh;  /* x sample and hold */
  xsh = 0;
  //static unsigned ysh;  /* y sample and hold */
  ysh = 0;
  //static unsigned zsh;  /* z sample and hold */
  zsh = 0;
  //unsigned jch0;		  /* joystick direction channel 0 */
  jch0 = 0;
  //unsigned jch1;		  /* joystick direction channel 1 */
  jch1 = 0;
  //unsigned jch2;		  /* joystick direction channel 2 */
  jch2 = 0;
  //unsigned jch3;		  /* joystick direction channel 3 */
  jch3 = 0;
  //static unsigned jsh;  /* joystick sample and hold */
  jsh = 0;
  //static unsigned compare;
  compare = 0;
  //static long dx;     /* delta x */
  dx = 0;
  //static long dy;     /* delta y */
  dy = 0;
  //static long curr_x; /* current x position */
  curr_x = 0;
  //static long curr_y; /* current y position */
  curr_y = 0;

  max_x = Globals.ALG_MAX_X >> 1;
  max_y = Globals.ALG_MAX_Y >> 1;

  //static unsigned vectoring; /* are we drawing a vector right now? */
  vectoring = false;
  //static long vector_x0;
  vector_x0 = 0;
  //static long vector_y0;
  vector_y0 = 0;
  //static long vector_x1;
  vector_x1 = 0;
  //static long vector_y1;
  vector_y1 = 0;
  //static long vector_dx;
  vector_dx = 0;
  //static long vector_dy;
  vector_dy = 0;
  //static unsigned char vector_color;
  vector_color = 0;

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
          } else {
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
    } else {
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

    if (via.ca2 == 0)
    {
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

        this.addline(this.vector_x0, this.vector_y0,
          this.vector_x1, this.vector_y1,
          this.vector_color);
      }
      else if (sig_dx != this.vector_dx ||
        sig_dy != this.vector_dy ||
        (this.zsh & 0xff) != this.vector_color) {

        /* the parameters of the vectoring processing has changed.
         * so end the current line.
         */
        this.addline(this.vector_x0, this.vector_y0,
          this.vector_x1, this.vector_y1,
          this.vector_color);

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
    if (!this.videoEnabled) return;
    // TODO
    //console.log(x0, y0, x1, y1, color);
    x0 = (x0 - Globals.BOUNDS_MIN_X) / (Globals.BOUNDS_MAX_X - Globals.BOUNDS_MIN_X) * Globals.SCREEN_X_DEFAULT;
    x1 = (x1 - Globals.BOUNDS_MIN_X) / (Globals.BOUNDS_MAX_X - Globals.BOUNDS_MIN_X) * Globals.SCREEN_X_DEFAULT;
    y0 = (y0 - Globals.BOUNDS_MIN_Y) / (Globals.BOUNDS_MAX_Y - Globals.BOUNDS_MIN_Y) * Globals.SCREEN_Y_DEFAULT;
    y1 = (y1 - Globals.BOUNDS_MIN_Y) / (Globals.BOUNDS_MAX_Y - Globals.BOUNDS_MIN_Y) * Globals.SCREEN_Y_DEFAULT;
    this.vectrex.video.drawLine(x0, y0, x1, y1, color, 7);
  }

  saveState() {
    return safe_extend(null, {}, this);
  }
  loadState(state) {
    safe_extend(null, this, state);
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

class VectrexPlatform extends Base6809Platform {

  mainElement;
  via: VIA6522;
  alg: VectrexAnalog;
  ram: Uint8Array;
  rom: Uint8Array;
  bios: Uint8Array;
  inputs: Uint8Array;
  bus;
  video: VectorVideo;
  psg: AY38910_Audio;
  audio;
  timer: AnimationTimer;

  constructor(mainElement) {
    super();
    this.mainElement = mainElement;
  }

  getPresets() {
    return VECTREX_PRESETS;
  }

  start() {
    this.via = new VIA6522(this);
    this.alg = new VectrexAnalog(this);
    this.bios = padBytes(new lzgmini().decode(stringToByteArray(atob(VECTREX_FASTROM_LZG))), 0x2000);
    this.ram = new Uint8Array(0x400);
    this.inputs = new Uint8Array(4);
    var mbus = {
      read: newAddressDecoder([
        [0x0000, 0x7fff, 0, (a) => { return this.rom && this.rom[a]; }],
        [0xc800, 0xcfff, 0x3ff, (a) => { return this.ram[a]; }],
        [0xd000, 0xdfff, 0xf, (a) => { return this.via.read(a); }],
        [0xe000, 0xffff, 0x1fff, (a) => { return this.bios && this.bios[a]; }],
      ]),

      write: newAddressDecoder([
        [0xc800, 0xcfff, 0x3ff, (a, v) => { this.ram[a] = v; }],
        [0xd000, 0xd7ff, 0x3ff, (a, v) => { this.via.write(a & 0xf, v); }],
        [0xd800, 0xdfff, 0x3ff, (a, v) => { this.ram[a] = v; this.via.write(a & 0xf, v); }],
      ])
    };
    this.bus = {
      read: (a) => { var v = mbus.read(a); this.probe.logRead(a,v); return v; },
      write: (a,v) => { this.probe.logWrite(a,v); mbus.write(a,v); }
    };
    this._cpu = this.newCPU(this.bus);
    // create video/audio
    this.video = new VectorVideo(this.mainElement, Globals.SCREEN_X_DEFAULT, Globals.SCREEN_Y_DEFAULT);
    this.video.persistenceAlpha = 0.2;
    this.audio = new MasterAudio();
    this.psg = new AY38910_Audio(this.audio);
    this.video.create();
    this.timer = new AnimationTimer(60, this.nextFrame.bind(this));
    setKeyboardFromMap(this.video, this.inputs, VECTREX_KEYCODE_MAP); // true = always send function);
  }

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

  advance(novideo:boolean) : number {
    if (!novideo) this.video.clear();
    this.alg.videoEnabled = !novideo;
    this.updateControls();
    this.probe.logNewFrame();
    var frameCycles = 1500000 / 60;
    var cycles = 0;
    while (cycles < frameCycles) {
      cycles += this.step();
    }
    return cycles;
  }

  step() {
    this.probe.logExecute(this.getPC(), this.getSP());
    if (this.via.ifr & 0x80) {
      this._cpu.interrupt();
    }
    var n = this.runCPU(this._cpu, 1);
    if (n == 0) n = 1; // TODO?
    this.probe.logClocks(n);
    for (var i=0; i<n; i++) {
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
    this.rom = padBytes(data, 0x8000);
    this.reset();
  }

  loadBIOS(title, data) {
    this.bios = padBytes(data, 0x2000);
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
  readAddress(addr: number) {
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
    }
  };

  getDebugCategories() {
    return super.getDebugCategories().concat(['VIA6522','ANALOG']);
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'VIA6522': return this.via.toLongString(state.via);
      case 'ANALOG': return this.alg.toLongString(state.alg);
      default: return super.getDebugInfo(category, state);
    }
  }

  // probing
  nullProbe = new NullProbe();
  probe : ProbeAll = this.nullProbe;

  startProbing?() : ProbeRecorder {
    var rec = new ProbeRecorder(this);
    this.connectProbe(rec);
    return rec;
  }
  stopProbing?() : void {
    this.connectProbe(null);
  }
  connectProbe(probe:ProbeAll) {
    this.probe = probe || this.nullProbe;
  }
}

//

PLATFORMS['vectrex'] = VectrexPlatform;

var VECTREX_FASTROM_LZG = `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`;
