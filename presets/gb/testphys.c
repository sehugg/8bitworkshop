
/*
Physics demo for Game Boy.
A single sprite with velocity and friction, using fixed-point
coordinates: positions are 16-bit values where the lower 4 bits
are the sub-pixel fraction, dropped with >> 4 when the sprite
is moved. Arrow keys apply thrust; holding A gives a jump burst.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"
#include <stdint.h>
#include <string.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"

// A simple sub-pixel / fixed point example
// Postion values are calculated as 16 bit numbers and their
// lower 4 bits are dropped when applying them to the sprite

// 4 frames of a ball sprite (8x8, 1bpp)
UINT8 sprite_data[] = { 
/*;;{w:8,h:8,bpp:1,count:4,brev:1,np:2,pofs:1,sl:2};;*/
    0x3C,0x3C,0x42,0x7E,0x99,0xFF,0xA9,0xFF,0x89,0xFF,0x89,0xFF,0x42,0x7E,0x3C,0x3C,
    0x3C,0x3C,0x42,0x7E,0xB9,0xFF,0x89,0xFF,0x91,0xFF,0xB9,0xFF,0x42,0x7E,0x3C,0x3C,
    0x3C,0x3C,0x42,0x7E,0x99,0xFF,0x89,0xFF,0x99,0xFF,0x89,0xFF,0x5A,0x7E,0x3C,0x3C,
    0x3C,0x3C,0x42,0x7E,0xA9,0xFF,0xA9,0xFF,0xB9,0xFF,0x89,0xFF,0x42,0x7E,0x3C,0x3C
/*;;*/
};

joypads_t joypads;

// fixed-point sprite coords (fraction in lower 4 bits)
UINT16 PosX, PosY;  // position
INT16 SpdX, SpdY;   // velocity
UINT8 Jump;         // frames of jump thrust remaining

// main function
void main(void) {
    // init palettes
    BGP_REG = OBP0_REG = OBP1_REG = 0xE4;

    // load tile data into VRAM
    set_sprite_data(0, 4, sprite_data);
    
    // set sprite tile
    set_sprite_tile(0, 0);

    // show bkg and sprites
    SHOW_BKG; SHOW_SPRITES;

    // init 2 joypads
    joypad_init(1, &joypads);
 
    // start at screen center with zero velocity
    PosX = PosY = 64 << 4;
    Jump = SpdX = SpdY = 0;

    // loop forever
    while(1) {        
        // poll joypads
        joypad_ex(&joypads);
        
        // game object: arrow keys apply thrust, clamped to a max speed
        if (joypads.joy0 & J_UP) {
            SpdY -= 2;
            if (SpdY < -64) SpdY = -64;
        } else if (joypads.joy0 & J_DOWN) {
            SpdY += 2;
            if (SpdY > 64) SpdY = 64;
        }
        if (joypads.joy0 & J_LEFT) {
            SpdX -= 2;
            if (SpdX < -64) SpdX = -64;
        } else if (joypads.joy0 & J_RIGHT) {
            SpdX += 2;
            if (SpdX > 64) SpdX = 64;
        }
        // A button triggers a 3-frame jump (only when grounded)
        if ((joypads.joy0 & J_A) && (!Jump)) {
            Jump = 3;
        }

        // jump: apply upward impulse while Jump counts down
        if (Jump) {
            SpdY -= 8;
            if (SpdY < -32) SpdY = -32;
            Jump--;
        }

        // apply velocity to position
        PosX += SpdX, PosY += SpdY; 

        // Translate to pixels and move sprite
        // Downshift by 4 bits to use the whole number values
        move_sprite(0, PosX >> 4, PosY >> 4);

        // friction: velocities decay toward zero each frame
        if (SpdY >= 0) {
            if (SpdY) SpdY--; 
        } else SpdY ++;
        if (SpdX >= 0) {
            if (SpdX) SpdX--; 
        } else SpdX ++;

        // Done processing, yield CPU and wait for start of next frame (VBlank)
        wait_vbl_done();
    }
}
