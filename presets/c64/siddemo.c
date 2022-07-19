
#include <stdio.h>
#include <conio.h>
#include <c64.h>
#include <cbm_petscii_charmap.h>
#include <joystick.h>

//#resource "c64-sid.cfg"
#define CFGFILE c64-sid.cfg

//#resource "sidmusic1.bin"
//#link "sidplaysfx.ca65"
#include "sidplaysfx.h"


void main(void) {
  clrscr();
  cursor(0);
  joy_install(joy_static_stddrv);
  sid_init(0);
  sid_start();
  printf("\r\nSID file loaded at $1000\r\n");
  printf("\r\nMove joystick for SFX\r\n");
  while (1) {
    char joy = joy_read(0);
    if (joy) {
      sid_sfx(joy & 3);
    }
    waitvsync();
    //sid_update();
  }
}
