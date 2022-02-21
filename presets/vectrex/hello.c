
#pragma vx_copyright "2020"
#pragma vx_title_pos -100, -80 
#pragma vx_title_size -8, 80
#pragma vx_title "HELLO WORLD"
#pragma vx_music vx_music_1 

#include "vectrex.h"
#include "bios.h"

int main()
{
  while(1)
  {
    wait_retrace();
    intensity(0x7f);
    print_str_c( 0x10, -0x50, (char*)"HELLO WORLD!" );
    intensity(0x3f);
    print_str_c( -0x10, -0x50, (char*)"THIS IS CMOC" );
  }
  return 0;
}
