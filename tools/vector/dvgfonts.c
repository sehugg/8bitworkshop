
#include <string.h>
#include <stdio.h>

typedef unsigned char byte;
typedef unsigned short word;

#define P(x,y) ((((x) & 0xF) << 4) | (((y) & 0xF) << 0))
#define FONT_UP 0xFE
#define FONT_LAST 0xFF

const byte vecfont[59][8] = {
  /*' '*/{ FONT_LAST },
  /*'!'*/{ P(4,0), P(3,2), P(5,2), P(4,0), FONT_UP, P(4,4), P(4,12), FONT_LAST },
  /*'"'*/{ P(2,10), P(2,6), FONT_UP, P(6,10), P(6,6), FONT_LAST },
  /*'#'*/{ P(0,4), P(8,4), P(6,2), P(6,10), P(8,8), P(0,8), P(2,10), P(2,2) },
  /*'$'*/{ P(6,2), P(2,6), P(6,10), FONT_UP, P(4,12), P(4,0), FONT_LAST },
  /*'%'*/{ P(0,0), P(8,12), FONT_UP, P(2,10), P(2,8), FONT_UP, P(6,4), P(6,2) },
  /*'&'*/{ P(8,0), P(4,12), P(8,8), P(0,4), P(4,0), P(8,4), FONT_LAST },
  /*'''*/{ P(0,12), P(8,0), FONT_LAST },

  /*'('*/{ P(6,0), P(2,4), P(2,8), P(6,12), FONT_LAST },
  /*')'*/{ P(2,0), P(6,4), P(6,8), P(2,12), FONT_LAST },
  /*'*'*/{ P(0,0), P(4,12), P(8,0), P(0,8), P(8,8), P(0,0), FONT_LAST },
  /*'+'*/{ P(1,6), P(7,6), FONT_UP, P(4,9), P(4,3), FONT_LAST },
  /*','*/{ P(2,0), P(4,2), FONT_LAST },
  /*'-'*/{ P(2,6), P(6,6), FONT_LAST },
  /*'.'*/{ P(3,0), P(4,0), FONT_LAST },
  /*'/'*/{ P(0,0), P(8,12), FONT_LAST },

  /*'0'*/{ P(0,0), P(8,0), P(8,12), P(0,12), P(0,0), P(8,12), FONT_LAST },
  /*'1'*/{ P(4,0), P(4,12), P(3,10), FONT_LAST },
  /*'2'*/{ P(0,12), P(8,12), P(8,7), P(0,5), P(0,0), P(8,0), FONT_LAST },
  /*'3'*/{ P(0,12), P(8,12), P(8,0), P(0,0), FONT_UP, P(0,6), P(8,6), FONT_LAST },
  /*'4'*/{ P(0,12), P(0,6), P(8,6), FONT_UP, P(8,12), P(8,0), FONT_LAST },
  /*'5'*/{ P(0,0), P(8,0), P(8,6), P(0,7), P(0,12), P(8,12), FONT_LAST },
  /*'6'*/{ P(0,12), P(0,0), P(8,0), P(8,5), P(0,7), FONT_LAST },
  /*'7'*/{ P(0,12), P(8,12), P(8,6), P(4,0), FONT_LAST },

  /*'8'*/{ P(0,0), P(8,0), P(8,12), P(0,12), P(0,0), FONT_UP, P(0,6), P(8,6), },
  /*'9'*/{ P(8,0), P(8,12), P(0,12), P(0,7), P(8,5), FONT_LAST },
  /*':'*/{ P(4,9), P(4,7), FONT_UP, P(4,5), P(4,3), FONT_LAST },
  /*';'*/{ P(4,9), P(4,7), FONT_UP, P(4,5), P(1,2), FONT_LAST },
  /*'<'*/{ P(6,0), P(2,6), P(6,12), FONT_LAST },
  /*'='*/{ P(1,4), P(7,4), FONT_UP, P(1,8), P(7,8), FONT_LAST },
  /*'>'*/{ P(2,0), P(6,6), P(2,12), FONT_LAST },
  /*'?'*/{ P(0,8), P(4,12), P(8,8), P(4,4), FONT_UP, P(4,1), P(4,0), FONT_LAST },
  
  /*'@'*/{ P(8,4), P(4,0), P(0,4), P(0,8), P(4,12), P(8,8), P(4,4), P(3,6) },
  /*'A'*/{ P(0,0), P(0,8), P(4,12), P(8,8), P(8,0), FONT_UP, P(0,4), P(8,4) },
  /*'B'*/{ P(0,0), P(0,12), P(4,12), P(8,10), P(4,6), P(8,2), P(4,0), P(0,0) },
  /*'C'*/{ P(8,0), P(0,0), P(0,12), P(8,12), FONT_LAST },
  /*'D'*/{ P(0,0), P(0,12), P(4,12), P(8,8), P(8,4), P(4,0), P(0,0), FONT_LAST },
  /*'E'*/{ P(8,0), P(0,0), P(0,12), P(8,12), FONT_UP, P(0,6), P(6,6), FONT_LAST },
  /*'F'*/{ P(0,0), P(0,12), P(8,12), FONT_UP, P(0,6), P(6,6), FONT_LAST },
  /*'G'*/{ P(6,6), P(8,4), P(8,0), P(0,0), P(0,12), P(8,12), FONT_LAST },

  /*'H'*/{ P(0,0), P(0,12), FONT_UP, P(0,6), P(8,6), FONT_UP, P(8,12), P(8,0) },
  /*'I'*/{ P(0,0), P(8,0), FONT_UP, P(4,0), P(4,12), FONT_UP, P(0,12), P(8,12) },
  /*'J'*/{ P(0,4), P(4,0), P(8,0), P(8,12), FONT_LAST },
  /*'K'*/{ P(0,0), P(0,12), FONT_UP, P(8,12), P(0,6), P(6,0), FONT_LAST },
  /*'L'*/{ P(8,0), P(0,0), P(0,12), FONT_LAST },
  /*'M'*/{ P(0,0), P(0,12), P(4,8), P(8,12), P(8,0), FONT_LAST },
  /*'N'*/{ P(0,0), P(0,12), P(8,0), P(8,12), FONT_LAST },
  /*'O'*/{ P(0,0), P(0,12), P(8,12), P(8,0), P(0,0), FONT_LAST },

  /*'P'*/{ P(0,0), P(0,12), P(8,12), P(8,6), P(0,5), FONT_LAST },
  /*'Q'*/{ P(0,0), P(0,12), P(8,12), P(8,4), P(0,0), FONT_UP, P(4,4), P(8,0) },
  /*'R'*/{ P(0,0), P(0,12), P(8,12), P(8,6), P(0,5), FONT_UP, P(4,5), P(8,0) },
  /*'S'*/{ P(0,2), P(2,0), P(8,0), P(8,5), P(0,7), P(0,12), P(6,12), P(8,10) },
  /*'T'*/{ P(0,12), P(8,12), FONT_UP, P(4,12), P(4,0), FONT_LAST },
  /*'U'*/{ P(0,12), P(0,2), P(4,0), P(8,2), P(8,12), FONT_LAST },
  /*'V'*/{ P(0,12), P(4,0), P(8,12), FONT_LAST },
  /*'W'*/{ P(0,12), P(2,0), P(4,4), P(6,0), P(8,12), FONT_LAST },

  /*'X'*/{ P(0,0), P(8,12), FONT_UP, P(0,12), P(8,0), FONT_LAST },
  /*'Y'*/{ P(0,12), P(4,6), P(8,12), FONT_UP, P(4,6), P(4,0), FONT_LAST },
  /*'Z'*/{ P(0,12), P(8,12), P(0,0), P(8,0), FONT_UP, P(2,6), P(6,6), FONT_LAST },
};

////

static int frame = 0;

void draw_char(char ch) {
  const byte* p = vecfont[ch - ' '];
  byte bright = 0;
  byte x = 0;
  byte y = 0;
  byte i;
  if (ch < ' ' || ch > 'Z') return;
  printf("const word VECFONT_%d[] = { ", ch);
  for (i=0; i<8; i++) {
    byte b = *p++;
    if (b == FONT_LAST) break; // last move
    else if (b == FONT_UP) bright = 0; // pen up
    else {
      byte x2 = b>>4;
      byte y2 = b&15;
      printf("_SVEC(%d,%d,%d), ", (char)(x2-x), (char)(y2-y), bright);
      bright = 4;
      x = x2;
      y = y2;
    }
  }
  printf("_SVEC(%d,%d,%d), _RTSL() };\n", (char)12-x, (char)-y, 0);
}

void main(void) {
    for (int i=' '; i<='Z'; i++) {
        draw_char(i);
    }
    printf("const word* const VECFONT[] = { ");
    for (int i=' '; i<='Z'; i++) {
      printf("VECFONT_%d,", i);
    }
    printf(" };\n");
}
