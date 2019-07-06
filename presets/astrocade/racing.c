
//#resource "astrocade.inc"
#include "aclib.h"
//#link "aclib.s"
#include "acbios.h"
//#link "acbios.s"
#include "acfast.h"
//#link "acfast.s"
//#link "hdr_autostart.s"

#include <stdlib.h>
#include <string.h>

#pragma opt_code_speed

// reserve 240 bytes to expand screen RAM to 4eff
byte UNUSED[0xf0];

#define SKYH 35
#define GNDH 45
#define BOTTOM (35+45)
#define DASH_Y (BOTTOM+8)
#define PLAYER_Y (BOTTOM-67)
#define DASH_HEIGHT 16

/*{pal:"astrocade",layout:"astrocade"}*/
const byte palette[8] = {
  0x07, 0xA5, 0x00, 0x03,
  0xE6, 0xE5, 0xE4, 0xE3,
};

/*{pal:"astrocade",layout:"astrocade"}*/
const byte dash_palette[4] = {
  0x05, 0x53, 0x86, 0x00,
};

/*{pal:"astrocade"}*/
const byte ground_colors[8] = {
  0xA5, 0xA4, 0xA3, 0xA2, 0x91, 0x81, 0x80, 0x01, 
};

/*{pal:"astrocade"}*/
const byte sky_colors[4*8] = {
  0xE6, 0xE5, 0xE4, 0xE3,
  0xE5, 0xE4, 0xF3, 0x12,
  0xE4, 0xE3, 0x12, 0x22,
  0xE3, 0x12, 0x22, 0x44,
  0x12, 0x22, 0x44, 0x64,
  0x12, 0x22, 0x20, 0xE0,
  0x12, 0x22, 0xE0, 0x00,
  0x11, 0xE0, 0x00, 0x00,
};

const byte CURBS[4*16] = {
/*{w:16,h:16,bpp:2,brev:1}*/
  0xBF, 0xFF,  0xFF, 0xFA,
  0xBF, 0xFF,  0xFF, 0xFA,
  0xAF, 0xFF,  0xFF, 0xEA,
  0xAF, 0xFF,  0xFF, 0xEA,
  0xAB, 0xFF,  0xFF, 0xAA,
  0xAB, 0xFF,  0xFF, 0xAA,
  0xAA, 0xFF,  0xFE, 0xAA,
  0xAA, 0xFF,  0xFE, 0xAA,
  0xAA, 0xBF,  0xFA, 0xAA,
  0xAA, 0xBF,  0xFA, 0xAA,
  0xAA, 0xAF,  0xEA, 0xAA,
  0xAA, 0xAB,  0xAA, 0xAA,
  0xAA, 0xAA,  0xAA, 0xAA,
  0xAA, 0xAA,  0xAA, 0xAA,
  0xAA, 0xAA,  0xAA, 0xAA,
  0xAA, 0xAA,  0xAA, 0xAA,
};

const byte CAR_10_MASK[2+4*10] = {
  4,10,
/*{w:16,h:10,bpp:2,brev:1}*/
  0x03, 0xC0, 0x03, 0xC0,
  0x03, 0xFF, 0xFF, 0xC0,
  0x00, 0x3F, 0xFC, 0x00,
  0x00, 0xFF, 0xFF, 0x00,
  0x3F, 0xFF, 0xFF, 0xFC,
  0xFF, 0xFF, 0xFF, 0xFF,
  0xFF, 0xFF, 0xFF, 0xFF,
  0xFF, 0xFF, 0xFF, 0xFF,
  0xFF, 0xFF, 0xFF, 0xFF,
  0x3F, 0xC0, 0x03, 0xFC,
};

const byte CAR_10_INV[2+4*10] = {
  4,10,
/*{w:16,h:10,bpp:2,brev:1}*/
  0x02, 0x80, 0x02, 0x80,
  0x02, 0x95, 0x56, 0x80,
  0x00, 0x16, 0x94, 0x00,
  0x00, 0x58, 0x25, 0x00,
  0x2A, 0x51, 0x45, 0xA8,
  0x82, 0x6A, 0xA9, 0x82,
  0xAA, 0x96, 0x96, 0xAA,
  0xAA, 0x56, 0x95, 0xAA,
  0xAA, 0x7F, 0xFD, 0xAA,
  0x2A, 0xC0, 0x03, 0xA8,
};

const byte CAR_10[2+4*10] = {
  4,10,
/*{w:16,h:10,bpp:2,brev:1}*/
  0x01, 0x40, 0x01, 0x40,
  0x01, 0x6A, 0xA9, 0x40,
  0x00, 0x29, 0x68, 0x00,
  0x02, 0xA7, 0xDA, 0x80,
  0x15, 0xAC, 0x3A, 0x54,
  0x7D, 0x95, 0x56, 0x7D,
  0x55, 0x69, 0x69, 0x55,
  0x55, 0xA9, 0x6A, 0x55,
  0x55, 0x80, 0x02, 0x55,
  0x15, 0x00, 0x00, 0x54,
};

const byte CAR_9[2+4*9] = {
  4,9,
/*{w:16,h:9,bpp:2,brev:1}*/
  0x00, 0x50, 0x05, 0x00,
  0x00, 0x5A, 0xA5, 0x00,
  0x00, 0x29, 0x68, 0x00,
  0x02, 0xA7, 0xDA, 0x80,
  0x15, 0xAC, 0x3A, 0x54,
  0x1D, 0x95, 0x56, 0x7C,
  0x15, 0x69, 0x69, 0x54,
  0x15, 0xA9, 0x6A, 0x54,
  0x15, 0x80, 0x02, 0x54,
};

const byte CAR_8[2+4*8] = {
  4,8,
/*{w:16,h:8,bpp:2,brev:1}*/
  0x00, 0x14, 0x14, 0x00,
  0x00, 0x1A, 0xA4, 0x00,
  0x00, 0x29, 0x68, 0x00,
  0x02, 0xA7, 0xDA, 0x80,
  0x05, 0xA0, 0x0A, 0x50,
  0x0D, 0x55, 0x55, 0x70,
  0x05, 0xA9, 0x6A, 0x50,
  0x05, 0x00, 0x00, 0x50,
};

const byte CAR_7[2+4*7] = {
  4,7,
/*{w:16,h:7,bpp:2,brev:1}*/
  0x00, 0x04, 0x10, 0x00,
  0x00, 0x06, 0x90, 0x00,
  0x00, 0x29, 0x68, 0x00,
  0x00, 0xA7, 0xDA, 0x00,
  0x03, 0x55, 0x55, 0xC0,
  0x01, 0x6A, 0xA9, 0x40,
  0x01, 0x40, 0x01, 0x40,
};

const byte CAR_6[2+4*6] = {
  2,6,
/*{w:8,h:6,bpp:2,brev:1}*/
  0x04, 0x10,
  0x06, 0x90,
  0x0B, 0xE0,
  0x55, 0x55,
  0x5A, 0xA5,
  0x50, 0x05,
};

const byte CAR_5[2+4*5] = {
  2,5,
/*{w:8,h:5,bpp:2,brev:1}*/
  0x04, 0x10,
  0x0A, 0xA0,
  0x05, 0x50,
  0x16, 0x94,
  0x14, 0x14,
};

const byte CAR_4[2+4*4] = {
  2,4,
/*{w:8,h:4,bpp:2,brev:1}*/
  0x01, 0x40,
  0x0A, 0xA0,
  0x05, 0x50,
  0x04, 0x10,
};

const byte CAR_3[2+4*3] = {
  2,3,
/*{w:8,h:3,bpp:2,brev:1}*/
  0x01, 0x40,
  0x06, 0x90,
  0x04, 0x10,
};

const byte CAR_2[2+4*2] = {
  2,2,
/*{w:8,h:2,bpp:2,brev:1}*/
  0x02, 0x80,
  0x01, 0x40,
};

const byte* const CAR_PATTERNS[16] = {
  CAR_10, CAR_10, CAR_10,
  CAR_9, CAR_9, CAR_8,
  CAR_7, CAR_6, CAR_5, CAR_4, CAR_3,
  CAR_2, CAR_2, CAR_2, CAR_2
};

// Z-table -- y = 800/(x*0.5+16)
const byte ZTAB[128] = {
50,48,47,45,44,43,42,41,40,39,38,37,36,35,34,34,33,32,32,31,30,30,29,29,28,28,27,27,26,26,25,25,25,24,24,23,23,23,22,22,22,21,21,21,21,20,20,20,20,19,19,19,19,18,18,18,18,17,17,17,17,17,17,16,16,16,16,16,16,15,15,15,15,15,15,14,14,14,14,14,14,14,14,13,13,13,13,13,13,13,13,13,12,12,12,12,12,12,12,12,12,12,11,11,11,11,11,11,11,11,11,11,11,11,10,10,10,10,10,10,10,10,10,10,10,10,10,10,
};

byte get1z(byte x) __z88dk_fastcall {
  return (x<128) ? ZTAB[x] : (255-x)/16+2;
}

#define PAT_ROAD 0x00
#define PAT_SKY 0x55
#define PAT_GROUND 0xaa

byte road_width = 142;
byte road_cenx = 80;
int road_inc = 0;
sbyte road_curve = 0;
byte curve_dir = 1;
word track_pos = 0;
byte speed = 4;
byte fill_grass = 0;

// interrupt handler declarations
void inthandler1() __interrupt;
void inthandler2() __interrupt;
void inthandler3() __interrupt;
void inthandler4() __interrupt;
void inthandler5() __interrupt;

// pointers to the interrupt handlers
const t_interrupt_handler const intvector1 = &inthandler1;
const t_interrupt_handler const intvector2 = &inthandler2;
const t_interrupt_handler const intvector3 = &inthandler3;
const t_interrupt_handler const intvector4 = &inthandler4;
const t_interrupt_handler const intvector5 = &inthandler5;

// bottom of screen, set sky palette
// update track_pos every 1/60 sec
void inthandler1() __interrupt {
  SET_RIGHT_PALETTE(_palette+4);
  hw_inlin = SKYH*2 - 2;
  track_pos += speed;
  CHANGE_INTERRUPT_VECTOR(_intvector2);
}
// horizon, set ground palette
// next split calculated linearly
void inthandler2() __interrupt {
  hw_horcb = 40;
  hw_inlin = SKYH*2 + 2 + ((track_pos&0xff)>>4);
  CHANGE_INTERRUPT_VECTOR(_intvector3);
}
// far split, change road color
// next split calculated with Z lookup table
void inthandler3() __interrupt {
  byte y = (SKYH + ZTAB[((~track_pos&0xff)>>1)]) * 2;
  hw_inlin = y > BOTTOM*2 ? BOTTOM*2 : y;
  hw_col0l = 2 ^ ((track_pos>>8)&1);
  CHANGE_INTERRUPT_VECTOR(_intvector4);
}
// near split, change road color until dash
void inthandler4() __interrupt {
  hw_inlin = (BOTTOM+2)*2;
  hw_col0l = 3 ^ ((track_pos>>8)&1);
  CHANGE_INTERRUPT_VECTOR(_intvector5);
}
// set dash palette until bottom of screen
void inthandler5() __interrupt {
  SET_RIGHT_PALETTE(_dash_palette);
  hw_horcb = 0;
  hw_inlin = 106*2;
  CHANGE_INTERRUPT_VECTOR(_intvector1);
}

// get track position, preventing race condition
// if it changes during interrupt
word get_track_pos(void) {
  __asm__("di");
  __asm__("ld hl,(_track_pos)");
  __asm__("ei");
}

// car record
typedef struct {
  sbyte x;
  byte y;
  const byte* pattern;
} Car;

#define MAX_CARS 2
Car cars[MAX_CARS];

void draw_car(byte x1, const Car* car) {
  byte x = x1 + car->x;
  byte* dest = &vmagic[BOTTOM - car->y][x>>2];
  hw_magic = M_SHIFT(x) | M_OR;
  // is this pattern 16 pixels wide?
  if (car->pattern[0] == 4) {
    // special mask mode for cars near the edge
    if (car->pattern == CAR_10 && (x < 40 || x > 120)) {
      hw_magic = M_SHIFT(x) | M_OR;
      fast_sprite_16(CAR_10_MASK, dest);
      hw_magic = M_SHIFT(x) | M_XOR;
      fast_sprite_16(CAR_10_INV, dest);
      fill_grass = 2; // draw over grass next frame
    } else {
      // 16-pixel fast OR with background
      fast_sprite_16(car->pattern, dest);
    }
  } else {
    // 8-pixel fast OR with background
    fast_sprite_8(car->pattern, dest);
  }
}

void draw_cars(byte x1, byte y) {
  if (y == cars[0].y) {
    draw_car(x1, &cars[0]);
  }
  if (y == cars[1].y) {
    draw_car(x1, &cars[1]);
  }
}

void draw_grass(byte* start, byte* end) {
  hw_magic = 0;
  while (start < end) {
    *start++ = PAT_GROUND;
  }
}

void draw_road() {
  byte y,x1,x2,w,j;
  register byte* dest;
  static byte* line;
  static word xx;
  static int inc;
  static const byte* curb;
  curb = CURBS;
  line = &vmagic[BOTTOM][0];
  inc = road_inc;
  w = road_width;
  // 16-bit X coordinate
  xx = road_cenx << 8;
  // loop from bottom to top
  for (y=0; y<GNDH; y++) {
    x1 = (xx >> 8) - w/2;
    x2 = x1 + w;
    // fill in grass?
    if (fill_grass && y <= PLAYER_Y) {
      // TODO: calc redundant expr but keeps our register var
      draw_grass(line, line + x1/4);
    }
    // left side of road
    dest = line + x1/4;
    hw_magic = M_SHIFT(x1);
    WASTER = PAT_GROUND;  // fill shifter with ground color
    *dest++ = curb[0];
    *dest++ = curb[1];
    // repave road, unroll loop a bit
    // (causes a little flicker on the right)
    for (j=0; j<w/8; j++) {
      *dest++ = PAT_ROAD;
      *dest++ = PAT_ROAD;
    }
    // right side of road
    dest = line + x2/4;
    hw_magic = M_SHIFT(x2);
    *dest++ = curb[2];
    *dest++ = curb[3];
    *dest = PAT_GROUND;
    // fill in grass?
    if (fill_grass && y <= PLAYER_Y) {
      draw_grass(dest, line+40);
    }
    // draw any cars which start on this line
    draw_cars(xx>>8, y);
    // next line up, update variables
    line -= 40;
    if ((y&3) == 0) curb += 4;
    xx += inc;
    inc += road_curve;
    w -= 3;
  }
  if (fill_grass) fill_grass--;
}

void draw_sky() {
  SYS_FILL(0x4000+0*40, 44*40, 0x00);
  SYS_FILL(0x4000+25*40, 10*40, 0x55);
  SYS_FILL(0x4000+30*40, 5*40, 0xaa);
  SYS_FILL(0x4000+33*40, 2*40, 0xff);
}

void draw_ground() {
  SYS_FILL(0x4000+35*40, 44*40, 0xaa);
}

void draw_dash() {
  SYS_FILL(0x4000+80*40, 16*40, 0x00);
  SYS_FILL(0x4000+80*40, 5*40, 0xff);
}

void position_cars() {
  byte x,y,zr;
  // player car
  cars[0].x = hw_p1pot/2 - 64;
  // other cars
  zr = get1z((get_track_pos() & 0xff) ^ 0xff);
  y = GNDH - zr;
  x = zr;
  cars[1].x = x;
  cars[1].y = y;
  cars[1].pattern = CAR_PATTERNS[y/4];
  if (y < 10) cars[1].y = -1; // TODO: clipping
}

void main(void) {
  // setup palette
  set_palette(palette);
  // set screen height
  // set horizontal color split (position / 4)
  // set interrupt status
  set_interrupt_vector(&intvector1);
  SYS_SETOUT(96*2, 0, 0x8);
  // draw initial background
  draw_sky();
  draw_ground();
  draw_dash();
  // place player car
  cars[0].y = PLAYER_Y;
  cars[0].x = 50;
  cars[0].pattern = CAR_10;
  // player other car
  cars[1].y = BOTTOM-60;
  cars[1].x = 20;
  cars[1].pattern = CAR_6;
  // draw score
  display_string(0, DASH_Y, XPAND_COLORS(1,0), " 00:00");
  // infinite loop
  while (1) {
    position_cars();
    draw_road();
    road_curve += curve_dir;
    if (road_curve >= 21) curve_dir = -1;
    if (road_curve <= -20) curve_dir = 1;
    if (hw_p1ctrl & JOY_UP && speed<16) speed++;
    if (hw_p1ctrl & JOY_DOWN && speed>1) speed--;
  }
}
