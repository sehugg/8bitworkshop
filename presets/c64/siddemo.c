
#include "common.h"
//#link "common.c"

#include <tgi.h>
#include <6502.h>

//#resource "c64-sid.cfg"
#define CFGFILE c64-sid.cfg

//#resource "sidmusic1.bin"
//#link "sidplaysfx.s"
#include "sidplaysfx.h"

static const unsigned char Palette[2] = 
  { TGI_COLOR_BLUE, TGI_COLOR_WHITE };

static int sweep = 0;

#define BITMAP_START 0xe020

// recursive macros to quickly set bitmap memory
#define SID_SIGNAL(index) \
  POKE(BITMAP_START + (index), SID.noise)

#define SID_SIGNAL_4(index) \
  SID_SIGNAL(index); \
  SID_SIGNAL(index+1); \
  SID_SIGNAL(index+2); \
  SID_SIGNAL(index+3);

#define SID_SIGNAL_16(index) \
  SID_SIGNAL_4(index); \
  SID_SIGNAL_4(index+4); \
  SID_SIGNAL_4(index+8); \
  SID_SIGNAL_4(index+12);

#define SID_SIGNAL_64(index) \
  SID_SIGNAL_16(index); \
  SID_SIGNAL_16(index+16); \
  SID_SIGNAL_16(index+32); \
  SID_SIGNAL_16(index+48);

void show_signal() {
  // push SID voice 3 signal to screen memory
  // as fast as we can
  SID_SIGNAL_64(0);
  SID_SIGNAL_64(64);
  SID_SIGNAL_64(128);
  SID_SIGNAL_64(192);
}

void show_envelope() {
  // read envelope value and plot vertical lines
  // via TGI library
  byte value = 199 - (SID.read3 >> 1);
  tgi_setcolor(0);
  tgi_line(sweep, 199 - 128, sweep, value - 1);
  tgi_setcolor(1);
  tgi_line(sweep, value, sweep, 240);
  if (++sweep == 320) sweep = 0;
}

char music_update() {
  sid_update();
  return IRQ_NOT_HANDLED;
}

void main(void) {
  // install TGI graphics driver
  tgi_install(tgi_static_stddrv);
  tgi_init();
  tgi_clear();
  tgi_setpalette(Palette);

  // initialize SID player
  sid_init(0);
  sid_start();

  // install joystick driver
  joy_install(joy_static_stddrv);

  // set IRQ routine called every frame
  set_irq(music_update, (void*)0x9f00, 0x100);

  while (1) {
    // play sound effect when joystick is moved
    byte joy = joy_read(1);
    if (joy) {
      sid_sfx(joy & 3);
      // exit when fire button pressed
      if (JOY_BTN_1(joy)) { break; }
    }
    // sync with frame rate
    waitvsync();
    // update graphs
    show_envelope();
    show_signal();
  }
  
  tgi_uninstall();
  sid_stop();
}
