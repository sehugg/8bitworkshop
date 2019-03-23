
#include "neslib.h"
#include "nes.h"

#define NES_MAPPER 2		// UxROM mapper
#define NES_CHR_BANKS 0		// CHR RAM

void set_pixel(byte x, byte y, byte color) {
  // compute pattern table address
  word a = (x/8)*16 + ((y&63)/8)*(16*32) + (y&7);
  byte b;
  if (y & 64) a |= 8;
  if (y & 128) a |= 0x1000;
  // read old byte
  vram_adr(a);
  vram_read(&b, 1);
  if (color) {
    b |= 128 >> (x&7); // set pixel
  } else {
    b &= ~(128 >> (x&7)); // clear pixel
  }
  // write new byte
  vram_adr(a);
  vram_put(b);
}

// write values 0..255
void vram_put_256inc() {
  word i;
  for (i=0; i<256; i++)
    vram_put(i);
}

void vram_put_attrib() {
  vram_fill(0x00, 0x10); // first palette
  vram_fill(0x55, 0x10); // second palette
}

void setup_monobitmap() {
  // clear pattern table
  vram_adr(0x0);
  vram_fill(0x0, 0x2000);
  // setup nametable A and B
  vram_adr(NAMETABLE_A);
  vram_put_256inc();
  vram_put_256inc();
  vram_put_256inc();
  vram_put_256inc();
  vram_adr(NAMETABLE_B);
  vram_put_256inc();
  vram_put_256inc();
  vram_put_256inc();
  vram_put_256inc();
  vram_adr(NAMETABLE_A + 0x3c0);
  vram_put_attrib();
  vram_put_attrib();
  vram_adr(NAMETABLE_B + 0x3c0);
  vram_put_attrib();
  vram_put_attrib();
  bank_bg(0);
  // setup sprite 0
  oam_clear();
  oam_size(0);
  oam_spr(255, 125, 255, 0, 0);
  bank_spr(1);
  // make sprite 255 = white square
  vram_adr(0x1ff0);
  vram_fill(0xff, 0x10);
}

/*{pal:"nes"}*/
const byte MONOBMP_PALETTE[16] = {
  0x03,
  0x30, 0x03, 0x30,  0x00,
  0x03, 0x30, 0x30,  0x00,
  0x30, 0x03, 0x30,  0x00,
  0x03, 0x30, 0x30
};

void demo() {
  byte i;
  for (i=16; i<220; i++) {
    set_pixel(i,16,1);
    set_pixel(16,i,1);
    set_pixel(i,220,1);
    set_pixel(220,i,1);
    set_pixel(i,i,1);
  }
}

void main(void)
{
  byte ctrl;
  setup_monobitmap();
  pal_bg(MONOBMP_PALETTE);
  demo();
  ppu_on_all();//enable rendering
  while(1) {
    ppu_wait_nmi();
    // split screen at line 128
    ctrl = PPU.control;
    split(0,0);
    PPU.control = ctrl ^ 0x10; // bg bank 1
  }
}
