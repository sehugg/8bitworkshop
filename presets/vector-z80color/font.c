
#include <string.h>

typedef unsigned char byte;
typedef unsigned short word;

void main();

void start() {
__asm
        LD      SP,#0x0
        DI
__endasm;
  main();
}

int dvgwrofs; // write offset for DVG buffer

inline word ___swapw(word j) {
  return ((j << 8) | (j >> 8));
}

word __at(0xa000) dvgram[0x1000];
byte __at(0x8840) _dvgstart;

inline void dvgreset() {
  dvgwrofs = 0;
}

inline void dvgstart() {
  _dvgstart = 0;
}

void dvgwrite(word w) {
  dvgram[dvgwrofs++] = w;
}

inline void VCTR(int dx, int dy, byte bright) {
  dvgwrite((dy & 0x1fff));
  dvgwrite(((bright & 7) << 13) | (dx & 0x1fff));
}

inline void SVEC(signed char dx, signed char dy, byte bright) {
  dvgwrite(0x4000 | (dx & 0x1f) | ((bright&7)<<5) | ((dy & 0x1f)<<8));
}

inline void JSRL(word offset) {
  dvgwrite(0xa000 | offset);
}

inline void JMPL(word offset) {
  dvgwrite(0xe000 | offset);
}

inline void RTSL() {
  dvgwrite(0xc000);
}

inline void CNTR() {
  dvgwrite(0x8000);
}

inline void HALT() {
  dvgwrite(0x2000);
}

inline void STAT(byte rgb, byte intens) {
  dvgwrite(0x6000 | ((intens & 0xf)<<4) | (rgb & 7));
}

inline void SCAL(word scale) {
  dvgwrite(0x7000 | scale);
}

enum {
  BLACK, BLUE, GREEN, CYAN, RED, MAGENTA, YELLOW, WHITE
} Color;

/// https://trmm.net/Asteroids_font

#define P(x,y) ((((x) & 0xF) << 4) | (((y) & 0xF) << 0))
#define FONT_UP 0xFE
#define FONT_LAST 0xFF

const byte vecfont[95][8] = {
  ['0' - 0x20] = { P(0,0), P(8,0), P(8,12), P(0,12), P(0,0), P(8,12), FONT_LAST },
  ['1' - 0x20] = { P(4,0), P(4,12), P(3,10), FONT_LAST },
  ['2' - 0x20] = { P(0,12), P(8,12), P(8,7), P(0,5), P(0,0), P(8,0), FONT_LAST },
  ['3' - 0x20] = { P(0,12), P(8,12), P(8,0), P(0,0), FONT_UP, P(0,6), P(8,6), FONT_LAST },
  ['4' - 0x20] = { P(0,12), P(0,6), P(8,6), FONT_UP, P(8,12), P(8,0), FONT_LAST },
  ['5' - 0x20] = { P(0,0), P(8,0), P(8,6), P(0,7), P(0,12), P(8,12), FONT_LAST },
  ['6' - 0x20] = { P(0,12), P(0,0), P(8,0), P(8,5), P(0,7), FONT_LAST },
  ['7' - 0x20] = { P(0,12), P(8,12), P(8,6), P(4,0), FONT_LAST },
  ['8' - 0x20] = { P(0,0), P(8,0), P(8,12), P(0,12), P(0,0), FONT_UP, P(0,6), P(8,6), },
  ['9' - 0x20] = { P(8,0), P(8,12), P(0,12), P(0,7), P(8,5), FONT_LAST },
  [' ' - 0x20] = { FONT_LAST },
  ['.' - 0x20] = { P(3,0), P(4,0), FONT_LAST },
  [',' - 0x20] = { P(2,0), P(4,2), FONT_LAST },
  ['-' - 0x20] = { P(2,6), P(6,6), FONT_LAST },
  ['+' - 0x20] = { P(1,6), P(7,6), FONT_UP, P(4,9), P(4,3), FONT_LAST },
  ['!' - 0x20] = { P(4,0), P(3,2), P(5,2), P(4,0), FONT_UP, P(4,4), P(4,12), FONT_LAST },
  ['#' - 0x20] = { P(0,4), P(8,4), P(6,2), P(6,10), P(8,8), P(0,8), P(2,10), P(2,2) },
  ['^' - 0x20] = { P(2,6), P(4,12), P(6,6), FONT_LAST },
  ['=' - 0x20] = { P(1,4), P(7,4), FONT_UP, P(1,8), P(7,8), FONT_LAST },
  ['*' - 0x20] = { P(0,0), P(4,12), P(8,0), P(0,8), P(8,8), P(0,0), FONT_LAST },
  ['_' - 0x20] = { P(0,0), P(8,0), FONT_LAST },
  ['/' - 0x20] = { P(0,0), P(8,12), FONT_LAST },
  ['\\' - 0x20] = { P(0,12), P(8,0), FONT_LAST },
  ['@' - 0x20] = { P(8,4), P(4,0), P(0,4), P(0,8), P(4,12), P(8,8), P(4,4), P(3,6) },
  ['$' - 0x20] = { P(6,2), P(2,6), P(6,10), FONT_UP, P(4,12), P(4,0), FONT_LAST },
  ['&' - 0x20] = { P(8,0), P(4,12), P(8,8), P(0,4), P(4,0), P(8,4), FONT_LAST },
  ['[' - 0x20] = { P(6,0), P(2,0), P(2,12), P(6,12), FONT_LAST },
  [']' - 0x20] = { P(2,0), P(6,0), P(6,12), P(2,12), FONT_LAST },
  ['(' - 0x20] = { P(6,0), P(2,4), P(2,8), P(6,12), FONT_LAST },
  [')' - 0x20] = { P(2,0), P(6,4), P(6,8), P(2,12), FONT_LAST },
  ['{' - 0x20] = { P(6,0), P(4,2), P(4,10), P(6,12), FONT_UP, P(2,6), P(4,6), FONT_LAST },
  ['}' - 0x20] = { P(4,0), P(6,2), P(6,10), P(4,12), FONT_UP, P(6,6), P(8,6), FONT_LAST },
  ['%' - 0x20] = { P(0,0), P(8,12), FONT_UP, P(2,10), P(2,8), FONT_UP, P(6,4), P(6,2) },
  ['<' - 0x20] = { P(6,0), P(2,6), P(6,12), FONT_LAST },
  ['>' - 0x20] = { P(2,0), P(6,6), P(2,12), FONT_LAST },
  ['|' - 0x20] = { P(4,0), P(4,5), FONT_UP, P(4,6), P(4,12), FONT_LAST },
  [':' - 0x20] = { P(4,9), P(4,7), FONT_UP, P(4,5), P(4,3), FONT_LAST },
  [';' - 0x20] = { P(4,9), P(4,7), FONT_UP, P(4,5), P(1,2), FONT_LAST },
  ['"' - 0x20] = { P(2,10), P(2,6), FONT_UP, P(6,10), P(6,6), FONT_LAST },
  ['\'' - 0x20] = { P(2,6), P(6,10), FONT_LAST },
  ['`' - 0x20] = { P(2,10), P(6,6), FONT_LAST },
  ['~' - 0x20] = { P(0,4), P(2,8), P(6,4), P(8,8), FONT_LAST },
  ['?' - 0x20] = { P(0,8), P(4,12), P(8,8), P(4,4), FONT_UP, P(4,1), P(4,0), FONT_LAST },
  ['A' - 0x20] = { P(0,0), P(0,8), P(4,12), P(8,8), P(8,0), FONT_UP, P(0,4), P(8,4) },
  ['B' - 0x20] = { P(0,0), P(0,12), P(4,12), P(8,10), P(4,6), P(8,2), P(4,0), P(0,0) },
  ['C' - 0x20] = { P(8,0), P(0,0), P(0,12), P(8,12), FONT_LAST },
  ['D' - 0x20] = { P(0,0), P(0,12), P(4,12), P(8,8), P(8,4), P(4,0), P(0,0), FONT_LAST },
  ['E' - 0x20] = { P(8,0), P(0,0), P(0,12), P(8,12), FONT_UP, P(0,6), P(6,6), FONT_LAST },
  ['F' - 0x20] = { P(0,0), P(0,12), P(8,12), FONT_UP, P(0,6), P(6,6), FONT_LAST },
  ['G' - 0x20] = { P(6,6), P(8,4), P(8,0), P(0,0), P(0,12), P(8,12), FONT_LAST },
  ['H' - 0x20] = { P(0,0), P(0,12), FONT_UP, P(0,6), P(8,6), FONT_UP, P(8,12), P(8,0) },
  ['I' - 0x20] = { P(0,0), P(8,0), FONT_UP, P(4,0), P(4,12), FONT_UP, P(0,12), P(8,12) },
  ['J' - 0x20] = { P(0,4), P(4,0), P(8,0), P(8,12), FONT_LAST },
  ['K' - 0x20] = { P(0,0), P(0,12), FONT_UP, P(8,12), P(0,6), P(6,0), FONT_LAST },
  ['L' - 0x20] = { P(8,0), P(0,0), P(0,12), FONT_LAST },
  ['M' - 0x20] = { P(0,0), P(0,12), P(4,8), P(8,12), P(8,0), FONT_LAST },
  ['N' - 0x20] = { P(0,0), P(0,12), P(8,0), P(8,12), FONT_LAST },
  ['O' - 0x20] = { P(0,0), P(0,12), P(8,12), P(8,0), P(0,0), FONT_LAST },
  ['P' - 0x20] = { P(0,0), P(0,12), P(8,12), P(8,6), P(0,5), FONT_LAST },
  ['Q' - 0x20] = { P(0,0), P(0,12), P(8,12), P(8,4), P(0,0), FONT_UP, P(4,4), P(8,0) },
  ['R' - 0x20] = { P(0,0), P(0,12), P(8,12), P(8,6), P(0,5), FONT_UP, P(4,5), P(8,0) },
  ['S' - 0x20] = { P(0,2), P(2,0), P(8,0), P(8,5), P(0,7), P(0,12), P(6,12), P(8,10) },
  ['T' - 0x20] = { P(0,12), P(8,12), FONT_UP, P(4,12), P(4,0), FONT_LAST },
  ['U' - 0x20] = { P(0,12), P(0,2), P(4,0), P(8,2), P(8,12), FONT_LAST },
  ['V' - 0x20] = { P(0,12), P(4,0), P(8,12), FONT_LAST },
  ['W' - 0x20] = { P(0,12), P(2,0), P(4,4), P(6,0), P(8,12), FONT_LAST },
  ['X' - 0x20] = { P(0,0), P(8,12), FONT_UP, P(0,12), P(8,0), FONT_LAST },
  ['Y' - 0x20] = { P(0,12), P(4,6), P(8,12), FONT_UP, P(4,6), P(4,0), FONT_LAST },
  ['Z' - 0x20] = { P(0,12), P(8,12), P(0,0), P(8,0), FONT_UP, P(2,6), P(6,6), FONT_LAST },
};

////

static int frame = 0;

void draw_char(char ch) {
  const byte* p = vecfont[ch-0x20];
  byte bright = 0;
  byte x = 0;
  byte y = 0;
  byte i;
  for (i=0; i<8; i++) {
    byte b = *p++;
    if (b == FONT_LAST) break; // last move
    else if (b == FONT_UP) bright = 0; // pen up
    else {
      byte x2 = b>>4;
      byte y2 = b&15;
      SVEC((char)(x2-x), (char)(y2-y), bright);
      bright = 4;
      x = x2;
      y = y2;
    }
  }
  SVEC((char)12-x, (char)-y, 0);
}

void draw_string(const char* str, byte spacing) {
  while (*str) {
    draw_char(*str++);
    if (spacing) SVEC(spacing, 0, 0);
  }
}

void main() {
  int r = 512;
  dvgwrofs = 0x800;
  draw_string("HELLO WORLD", 0);
  RTSL();
  while (1) {
    dvgreset();
    CNTR();
    SCAL(0x7f);
    STAT(RED, 0);
    VCTR(r, r, 1);
    VCTR(-r*2, 0, 3);
    VCTR(0, -r*2, 5);
    VCTR(r*2, 0, 7);
    VCTR(0, r*2, 7);
    CNTR();
    STAT(GREEN, 0);
    VCTR(100, -100, 0);
    JSRL(0x800);
    HALT();
    dvgstart();
    frame++;
  }
}
