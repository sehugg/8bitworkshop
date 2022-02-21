
#include <stdlib.h>
#include <string.h>
#include <cv.h>
#include <cvu.h>

#define DEFINE_BIOS_FN(name,address) \
int name() { __asm call address __endasm; }

DEFINE_BIOS_FN(cvbios_skill_screen, 0x1f7c)
//DEFINE_BIOS_FN(cvbios_read_ctl, 0x1f79)
  
int cvbios_read_left_joystick() {
  __asm
    ld hl,#0x0000
    jp 0x1f79
  __endasm;
}

int cvbios_read_right_joystick() {
  __asm
    ld hl,#0x0100
    jp 0x1f79
  __endasm;
}

const char* const HEX = "0123456789ABCDEF";
  
void main() {
  // load BIOS-friendly stack address
  __asm
    ld sp,#0x73b9
  __endasm;
  // call BIOS
  cvbios_skill_screen();
  // loop and read joystick
  do {
    int ctl = cvbios_read_left_joystick();
    cvu_voutb(HEX[(ctl>>0)&0xf], 0x1800 + 3);
    cvu_voutb(HEX[(ctl>>4)&0xf], 0x1800 + 2);
    cvu_voutb(HEX[(ctl>>8)&0xf], 0x1800 + 1);
    cvu_voutb(HEX[(ctl>>12)&0xf], 0x1800 + 0);
  } while(1) ;
}
