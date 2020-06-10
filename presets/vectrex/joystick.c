
#pragma vx_copyright "2020"
#pragma vx_title_pos -100, -80 
#pragma vx_title_size -8, 80
#pragma vx_title "CONTROLS TEST"
#pragma vx_music vx_music_1 

#include "vectrex.h"
#include "bios.h"

// http://www.playvectrex.com/designit/chrissalo/joystick.htm

const char rom_text[] = "JOYSTICKS:";

int main()
{
  char j1t[] = { '1', ':', '_', '_', '_', '_', 0x00 };
  char btn1[] = { '1', '2', '3', '4', 0x00 };
  char j2t[] = { '2', ':', '_', '_', '_', '_', 0x00 };
  char btn2[] = { '1', '2', '3', '4', 0x00 };

  uint8_t i, j1, j2, btns;

  while(1)
  {
    wait_retrace();
    
    j1 = read_joystick(1);
    j2 = read_joystick(2);
    btns = read_buttons(); // momentary
    btns = *((byte*)0xc80f); // persistent
        
    for(i=0;i<4;i++) {
      j1t[2+i] = (j1 & (1<<i)) ? 'X' : '_';
      j2t[2+i] = (j2 & (1<<i)) ? 'X' : '_';
    } 

    btn1[0] = (btns & JOY1_BTN1_MASK) ? 'X' : '1';
    btn1[1] = (btns & JOY1_BTN2_MASK) ? 'X' : '2';
    btn1[2] = (btns & JOY1_BTN3_MASK) ? 'X' : '3';
    btn1[3] = (btns & JOY1_BTN4_MASK) ? 'X' : '4';
    btn2[0] = (btns & JOY2_BTN1_MASK) ? 'X' : '1';
    btn2[1] = (btns & JOY2_BTN2_MASK) ? 'X' : '2';
    btn2[2] = (btns & JOY2_BTN3_MASK) ? 'X' : '3';
    btn2[3] = (btns & JOY2_BTN4_MASK) ? 'X' : '4';

    intensity(0x7f);
    print_str_c( 0x10, -0x50, (char*)rom_text); 
    print_str_c(-0x10, -0x50, j1t); 
    print_str_c(-0x20, -0x40, btn1); 
    print_str_c(-0x30, -0x50, j2t); 
    print_str_c(-0x40, -0x40, btn2); 
  }
  return 0;
}
