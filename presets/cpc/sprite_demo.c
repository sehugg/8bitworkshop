
// from https://github.com/cpcitor/cpcrslib/tree/master/examples

#include "cpcrslib.h"

extern unsigned char sp_1[];	//masked sprite data
extern unsigned char sp_2[];	//masked sprite data
extern unsigned char tintas[];	//inks
extern unsigned char buffer[];	//inks

struct sprite  		// minimun sprite structure
{
    char *sp0;		//2 bytes 	01
    char *sp1;		//2 bytes	23
    int coord0;		//2 bytes	45	current superbuffer address
    int coord1;		//2 bytes	67  old superbuffer address
    unsigned char cx, cy;	//2 bytes 89 	current coordinates
    unsigned char ox, oy;	//2 bytes 1011  old coordinates
    unsigned char move1;	// los bits 4,3,2 definen el tipo de dibujo!!
    unsigned char move;		// 	in this example, to know the movement direction of the sprite
};

struct sprite sprite00,sprite01,sprite02;

void data(void)
{
    __asm
_buffer:
    .db #30
_sp_1:
    .db #4,#15								//sprite dimensions in bytes withd, height
    .db #0xFF,#0x00,#0x00,#0xCF,#0x00,#0xCF,#0xFF,#0x00	//data: mask, sprite, mask, sprite...
    .db #0xAA,#0x45,#0x00,#0x3C,#0x00,#0x3C,#0x55,#0x8A
    .db #0x00,#0x8A,#0x00,#0x55,#0x00,#0xAA,#0x00,#0x45
    .db #0x00,#0x8A,#0x00,#0x20,#0x00,#0x00,#0x00,#0x65
    .db #0x00,#0x28,#0x00,#0x55,#0x00,#0xAA,#0x00,#0x14
    .db #0x00,#0x7D,#0x00,#0xBE,#0x00,#0xFF,#0x00,#0xBE
    .db #0xAA,#0x14,#0x00,#0xFF,#0x00,#0xBE,#0x55,#0x28
    .db #0xAA,#0x00,#0x00,#0x3C,#0x00,#0x79,#0x55,#0x00
    .db #0x00,#0x51,#0x00,#0x51,#0x00,#0xA2,#0x55,#0xA2
    .db #0x00,#0xF3,#0x00,#0x10,#0x00,#0x20,#0x00,#0xF3
    .db #0x00,#0xF3,#0x00,#0x51,#0x00,#0xA2,#0x00,#0xF3
    .db #0x55,#0x28,#0x00,#0x0F,#0x00,#0x0F,#0xAA,#0x14
    .db #0xFF,#0x00,#0x55,#0x0A,#0xAA,#0x05,#0xFF,#0x00
    .db #0x55,#0x02,#0x55,#0x28,#0xAA,#0x14,#0xAA,#0x01
    .db #0x00,#0x03,#0x55,#0x02,#0xAA,#0x01,#0x00,#0x03
 
_sp_2:
    .db #4,#21
    .db #0xFF,#0x00,#0x00,#0xCC,#0x00,#0xCC,#0xFF,#0x00
    .db #0xFF,#0x00,#0xAA,#0x44,#0x55,#0x88,#0xFF,#0x00
    .db #0xFF,#0x00,#0xAA,#0x44,#0x55,#0x88,#0xFF,#0x00
    .db #0xFF,#0x00,#0xAA,#0x44,#0x55,#0x88,#0xFF,#0x00
    .db #0xFF,#0x00,#0x00,#0xCF,#0x00,#0xCF,#0xFF,#0x00
    .db #0xAA,#0x45,#0x00,#0xCF,#0x00,#0xCF,#0x55,#0x8A
    .db #0xAA,#0x45,#0x00,#0xE5,#0x00,#0xDA,#0x55,#0x8A
    .db #0xAA,#0x45,#0x00,#0xCF,#0x00,#0xCF,#0x55,#0x8A
    .db #0xAA,#0x45,#0x00,#0xCF,#0x00,#0xCF,#0x55,#0x8A
    .db #0xAA,#0x45,#0x00,#0xCF,#0x00,#0xCF,#0x55,#0x8A
    .db #0xAA,#0x45,#0x00,#0xCF,#0x00,#0xCF,#0x55,#0x8A
    .db #0xFF,#0x00,#0x00,#0xCF,#0x00,#0xCF,#0xFF,#0x00
    .db #0xAA,#0x01,#0x00,#0x03,#0x00,#0x03,#0x55,#0x02
    .db #0x00,#0xA9,#0x00,#0x03,#0x00,#0x03,#0x00,#0x56
    .db #0x00,#0xA9,#0x00,#0x03,#0x00,#0x03,#0x00,#0x56
    .db #0xAA,#0x01,#0x00,#0x03,#0x00,#0x03,#0x55,#0x02
    .db #0xAA,#0x01,#0x00,#0x03,#0x00,#0x03,#0x55,#0x02
    .db #0xAA,#0x01,#0x00,#0x06,#0x00,#0x09,#0x55,#0x02
    .db #0xFF,#0x00,#0x00,#0x0C,#0x00,#0x0C,#0xFF,#0x00
    .db #0xFF,#0x00,#0x00,#0x0C,#0x00,#0x0C,#0xFF,#0x00
    .db #0xFF,#0x00,#0x00,#0x0C,#0x00,#0x0C,#0xFF,#0x00

// There is a tool called Sprot that allows to generate masked sprites for z88dk.
// ask for it: www.amstrad.es/forum/

_tintas:  //firmware inks
    .db #0,#13,#1,#6,#26,#24,#15,#8,#10,#22,#14,#3,#18,#4,#11,#25
    __endasm;
}


void *p_sprites[7];

void initPointers()
{

    p_sprites[0] = &sprite00;
    p_sprites[1] = &sprite01;
    p_sprites[2] = &sprite02;

}

void set_colours(void)
{
    unsigned char x;
    for (x=0; x<16; x++)
    {
        cpc_SetInk(x,tintas[x]);
    }
    cpc_SetBorder(0);
}
void pause(void)
{
    __asm
    ld b,#80
pause_loop:
    halt
    djnz pause_loop
    __endasm;
}
void collide(void)
{
    cpc_SetColour(16,1);
    pause();
    cpc_SetColour(16,9);
}

void draw_tilemap(void)
{
    unsigned char x,y;
    //set the tiles of the map. In this example, the tile map is 32x16 tile
    //Tile Map configuration file: TileMapConf.asm

    y=0;
    for(x=0; x<32; x++)
    {
        cpc_SetTile(x,y,1);
    }
    for(y=1; y<15; y++)
    {
        for (x=0; x<32; x++)
        {
            cpc_SetTile(x,y,0);
        }
    }
    y=15;
    for (x=0; x<32; x++)
    {
        cpc_SetTile(x,y,2);
    }
}

void print_credits(void)
{
    cpc_PrintGphStrXY("SMALL;SPRITE;DEMO",9*2+3,20*8);
    cpc_PrintGphStrXY("SDCC;;;CPCRSLIB",10*2+3,21*8);
    cpc_PrintGphStrXY("BY;ARTABURU;2015",10*2+2,22*8);
    cpc_PrintGphStrXY("ESPSOFT<AMSTRAD<ES",10*2+3-3,24*8);
}

main()
{
    initPointers();

    set_colours();
    cpc_SetInkGphStr(0,0);
    cpc_SetModo(0);

    cpc_DisableFirmware();
    // All the sprite values are initilized
    sprite00.sp1=sp_1;
    sprite00.sp0=sp_1;
    sprite00.ox=50;
    sprite00.oy=70;
    sprite00.cx=50;
    sprite00.cy=70;
    sprite00.move1=3;
    cpc_SuperbufferAddress(p_sprites[0]); //first time it's important to do this

    sprite01.sp1=sp_2;
    sprite01.sp0=sp_2;
    sprite01.ox=50;
    sprite01.oy=106;
    sprite01.cx=50;
    sprite01.cy=106;
    sprite01.move=1;
    sprite01.move1=3;
    cpc_SuperbufferAddress(p_sprites[1]);

    sprite02.sp1=sp_2;
    sprite02.sp0=sp_2;
    sprite02.ox=20;
    sprite02.oy=100;
    sprite02.cx=20;
    sprite02.cy=100;
    sprite02.move=2;
    sprite02.move1=3;
    cpc_SuperbufferAddress(p_sprites[2]);


    //Drawing the tile map
    draw_tilemap();
    cpc_ShowTileMap();		//Show entire tile map in the screen
    print_credits();
    cpc_SetTile(0,1,2);
    /*cpc_GetTiles(0,0,2,3, buffer);

    cpc_PutTiles(0,13,2,3, buffer);
    cpc_GetTiles(0,13,2,3, buffer);
    cpc_PutTiles(8,9,2,3, buffer); */

    cpc_ShowTileMap();		//Show entire tile map in the screen
    while(1)
    {
		//cpc_PutTile2x8(sp_1,3,5);
		//cpc_PutTile2x8(sp_1,10,170);
        //Default number keys for moving one of the sprites:
        // 0: cursor right
        // 1: cursor left
        // 2: cursor up
        // 3: cursor down

        //for example., if key 0 is pressed, and the sprite is inside tilemap, then
        //the sprite is moved one byte to the right:
        if (cpc_TestKey(0)==1 && sprite00.cx<60) sprite00.cx++;
        if (cpc_TestKey(1)==1 && sprite00.cx>0) sprite00.cx--;
        if (cpc_TestKey(2)==1 && sprite00.cy>0) sprite00.cy-=2;
        if (cpc_TestKey(3)==1 && sprite00.cy<112) sprite00.cy+=2;

        // The other sprites are automatically moved
        if (sprite01.move==0)   //0 = left, 1 = right
        {
            if (sprite01.cx>0) sprite01.cx--;
            else sprite01.move=1;
        }
        if (sprite01.move==1)   //0 = left, 1 = right
        {
            if (sprite01.cx<60) sprite01.cx++;
            else sprite01.move=0;
        }

        if (sprite02.move==2)   //2 = up, 3 = down
        {
            if (sprite02.cy>0) sprite02.cy-=2;
            else sprite02.move=3;
        }
        if (sprite02.move==3)    //2 = up, 3 = down
        {
            if (sprite02.cy<106) sprite02.cy+=2;
            else sprite02.move=2;
        }

        cpc_ResetTouchedTiles();		//clear touched tile table

        //Sprite phase 1
        cpc_PutSpTileMap(p_sprites[0]);		//search the tiles where is and was the sprite
        cpc_PutSpTileMap(p_sprites[1]);
        cpc_PutSpTileMap(p_sprites[2]);

        cpc_UpdScr(); 					//Update the screen to new situatio (show the touched tiles)

        //Sprite phase 2
        cpc_PutMaskSpTileMap2b(p_sprites[0]);	//Requires to move sprite with cpc_SpUpdX or cpc_SpUpdY
        cpc_PutMaskSpTileMap2b(p_sprites[1]);
        cpc_PutMaskSpTileMap2b(p_sprites[2]);

        cpc_ShowTileMap2();			//Show the touched tiles-> show the new sprite situatuion

        if (cpc_CollSp(p_sprites[0],p_sprites[1])) collide();  //test if there is collision between sprite00 and sprite01
        if (cpc_CollSp(p_sprites[0],p_sprites[2])) collide();

    }
}
