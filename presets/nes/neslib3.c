
//this example shows how to set up a palette and use 8x8 HW sprites
//also shows how fast (or slow) C code is

#include <string.h>

#include "neslib.h"

#pragma data-name (push,"CHARS")
#pragma data-name(pop)

//#link "tileset1.c"

// tile set, two planes for 4 colors
extern unsigned char TILESET[8*256];

//this example shows how to poll the gamepad
//and how to use nametable update system that allows to modify nametable
//while rendering is enabled

//these macro are needed to simplify defining update list constants

#define NTADR(x,y)      ((0x2000|((y)<<5)|x))

#define MSB(x)          (((x)>>8))
#define LSB(x)          (((x)&0xff))

//variables

static unsigned char i;
static unsigned char x,y;

//the update list, it is for 6 tiles, 3 bytes per tile

static unsigned char list[6*3];

//init data for the update list, it contains MSB and LSB of a tile address
//in the nametable, then the tile number

const unsigned char list_init[6*3+1]={
  MSB(NTADR(2,2)),LSB(NTADR(2,2)),0,
  MSB(NTADR(3,2)),LSB(NTADR(3,2)),0,
  MSB(NTADR(4,2)),LSB(NTADR(4,2)),0,
  MSB(NTADR(6,2)),LSB(NTADR(6,2)),0,
  MSB(NTADR(7,2)),LSB(NTADR(7,2)),0,
  MSB(NTADR(8,2)),LSB(NTADR(8,2)),0,
  NT_UPD_EOF
};

void main(void)
{
        //copy tileset to RAM
  	vram_adr(0x0);
        vram_write((unsigned char*)TILESET, sizeof(TILESET));

        pal_col(1,0x21);//blue color for text
        pal_col(17,0x30);//white color for sprite

        memcpy(list,list_init,sizeof(list_init));
        set_vram_update(list);

        ppu_on_all();//enable rendering

        x=124;
        y=116;

        //now the main loop

        while(1)
        {
                ppu_wait_nmi();//wait for next TV frame

                oam_spr(x,y,0x41,0,0);//put sprite

                //poll the pad and change coordinates according to pressed buttons

                i=pad_poll(0);

                if(i&PAD_LEFT &&x>  0) x-=2;
                if(i&PAD_RIGHT&&x<248) x+=2;
                if(i&PAD_UP   &&y>  0) y-=2;
                if(i&PAD_DOWN &&y<232) y+=2;

                //put x 3-digit number into the update list

                list[2]=0x10+x/100;
                list[5]=0x10+x/10%10;
                list[8]=0x10+x%10;

                //put y 3-digit number into the update list

                list[11]=0x10+y/100;
                list[14]=0x10+y/10%10;
                list[17]=0x10+y%10;
        }
}
