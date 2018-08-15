
#include "neslib.h"

#pragma data-name (push,"CHARS")
#pragma data-name(pop)

//#link "tileset1.c"

// tile set, two planes for 4 colors
extern unsigned char TILESET[8*256];

//variables

static unsigned char i;
static unsigned char pad,spr;
static unsigned char touch;
static unsigned char frame;

//two players coords

static unsigned char cat_x[2];
static unsigned char cat_y[2];


//first player metasprite, data structure explained in neslib.h

const unsigned char metaCat1[]={
        0,      0,      0x50,   0,
        8,      0,      0x51,   1,
        16,     0,      0x52,   0,
        0,      8,      0x60,   0,
        8,      8,      0x61,   0,
        16,     8,      0x62,   0,
        0,      16,     0x70,   0,
        8,      16,     0x71,   0,
        16,     16,     0x72,   0,
        128
};

//second player metasprite, the only difference is palette number

const unsigned char metaCat2[]={
        0,      0,      0x50,   0,
        8,      0,      0x51,   1,
        16,     0,      0x52,   0,
        0,      8,      0x60,   1,
        8,      8,      0x61,   1,
        16,     8,      0x62,   1,
        0,      16,     0x70,   1,
        8,      16,     0x71,   1,
        16,     16,     0x72,   1,
        128
};



void main(void)
{
        //copy tileset to RAM
	vram_adr(0x0);
        vram_write((unsigned char*)TILESET, sizeof(TILESET));
  
        ppu_on_all();//enable rendering

        //set initial coords
        
        cat_x[0]=52;
        cat_y[0]=100;
        cat_x[1]=180;
        cat_y[1]=100;

        //init other vars
        
        touch=0;//collision flag
        frame=0;//frame counter

        //now the main loop

        while(1)
        {
                ppu_wait_nmi();//wait for next TV frame

                //flashing color for touch
                
                i=frame&1?0x30:0x2a;

                pal_col(17,touch?i:0x21);//set first sprite color
                pal_col(21,touch?i:0x26);//set second sprite color

                //process players
                
                spr=0;

                for(i=0;i<2;++i)
                {
                        //display metasprite
                        
                        spr=oam_meta_spr(cat_x[i],cat_y[i],spr,!i?metaCat1:metaCat2);

                        //poll pad and change coordinates
                        
                        pad=pad_poll(i);

                        if(pad&PAD_LEFT &&cat_x[i]>  0) cat_x[i]-=2;
                        if(pad&PAD_RIGHT&&cat_x[i]<232) cat_x[i]+=2;
                        if(pad&PAD_UP   &&cat_y[i]>  0) cat_y[i]-=2;
                        if(pad&PAD_DOWN &&cat_y[i]<212) cat_y[i]+=2;
                }

                //check for collision for a smaller bounding box
                //metasprite is 24x24, collision box is 20x20
                
                if(!(cat_x[0]+22< cat_x[1]+2 ||
                     cat_x[0]+ 2>=cat_x[1]+22||
                 cat_y[0]+22< cat_y[1]+2 ||
                     cat_y[0]+ 2>=cat_y[1]+22)) touch=1; else touch=0;

                frame++;
        }
}
