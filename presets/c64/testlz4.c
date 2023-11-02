
// sid config so we don't use stack above $8000

//#resource "c64-sid.cfg"
#define CFGFILE c64-sid.cfg

#include "common.h"
//#link "common.c"

#include "mcbitmap.h"
//#link "mcbitmap.c"

#include <lz4.h>

// include the LZ4 binary data -> image_c64_multi_lz4[]

//#incbin "image-c64.multi.lz4"

/*
CharData equ .
ScreenData equ CharData+8000
ColorData equ ScreenData+1000
XtraData equ ColorData+1000
*/

void main() {
  char* const uncomp = (char*)0xb000;
  char bgcolor;
  
  // setup VIC for multicolor bitmap
  // colormap = $c000-$c7ff
  // bitmap = $e000-$ffff
  setup_bitmap_multi();
  // enable HIMEM so we can write to $c000-$ffff
  ENABLE_HIMEM();
  // decompress into $8000-$a711
  decompress_lz4(image_c64_multi_lz4+11, uncomp, 10002);
  // read background color
  bgcolor = uncomp[10000];
  // copy data to destination areas
  memcpy((void*)MCB_BITMAP, uncomp, 8000);
  memcpy(COLOR_RAM, uncomp+9000, 1000);
  memcpy((void*)MCB_COLORS, uncomp+8000, 1000);
  DISABLE_HIMEM();
  // set background color
  VIC.bgcolor0 = bgcolor;
  // wait for key
  cgetc();
}
