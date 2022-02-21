#ifndef _NESLIB_H
#define _NESLIB_H
/*
 (C) 2015 Alex Semenov (Shiru)
 (C) 2016 Lauri Kasanen

  This software is provided 'as-is', without any express or implied
  warranty.  In no event will the authors be held liable for any damages
  arising from the use of this software.

  Permission is granted to anyone to use this software for any purpose,
  including commercial applications, and to alter it and redistribute it
  freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
     claim that you wrote the original software. If you use this software
     in a product, an acknowledgment in the product documentation would be
     appreciated but is not required.
  2. Altered source versions must be plainly marked as such, and must not be
     misrepresented as being the original software.
  3. This notice may not be removed or altered from any source distribution.
*/

// NES hardware-dependent functions by Shiru (shiru@mail.ru)
// Feel free to do anything you want with this code, consider it Public Domain

// Versions history:
//  280215 - fixed palette glitch caused with the active DMC DMA glitch
//  030914 - minor fixes in the vram update system
//  310814 - added vram_flush_update
//  120414 - removed adr argument from vram_write and vram_read,
//           unrle_vram renamed to vram_unrle, with adr argument removed
//  060414 - many fixes and improvements, including sequental VRAM updates
//  previous versions were created since mid-2011, there were many updates
//  xxxx19 - updated by sehugg@8bitworkshop


// define basic types for convenience
typedef unsigned char byte;	// 8-bit unsigned
typedef signed char sbyte;	// 8-bit signed
typedef unsigned short word;	// 16-bit signed
typedef enum { false, true } bool;	// boolean


// set bg and spr palettes, data is 32 bytes array
void __fastcall__ pal_all(const char *data);

// set bg palette only, data is 16 bytes array
void __fastcall__ pal_bg(const char *data);

// set spr palette only, data is 16 bytes array
void __fastcall__ pal_spr(const char *data);

// set a palette entry, index is 0..31
void __fastcall__ pal_col(unsigned char index, unsigned char color);

// reset palette to $0f
void __fastcall__ pal_clear(void);

// set virtual bright both for sprites and background, 0 is black, 4 is normal, 8 is white
void __fastcall__ pal_bright(unsigned char bright);

// set virtual bright for sprites only
void __fastcall__ pal_spr_bright(unsigned char bright);

// set virtual bright for sprites background only
void __fastcall__ pal_bg_bright(unsigned char bright);



// wait actual TV frame, 50hz for PAL, 60hz for NTSC
void __fastcall__ ppu_wait_nmi(void);

// wait virtual frame, it is always 50hz, frame-to-frame in PAL, frameskip in NTSC
void __fastcall__ ppu_wait_frame(void);

// turn off rendering, nmi still enabled when rendering is disabled
void __fastcall__ ppu_off(void);

// turn on bg, spr
void __fastcall__ ppu_on_all(void);

// turn on bg only
void __fastcall__ ppu_on_bg(void);

// turn on spr only
void __fastcall__ ppu_on_spr(void);

// set PPU_MASK directly
void __fastcall__ ppu_mask(unsigned char mask);

// get current video system, 0 for PAL, not 0 for NTSC
unsigned char __fastcall__ ppu_system(void);

// Return an 8-bit counter incremented at each vblank
unsigned char __fastcall__ nesclock(void);

// get/set the internal ppu ctrl cache var for manual writing
unsigned char __fastcall__ get_ppu_ctrl_var(void);
void __fastcall__ set_ppu_ctrl_var(unsigned char var);


// clear OAM buffer, all the sprites are hidden
void __fastcall__ oam_clear(void);

// set sprite display mode, 0 for 8x8 sprites, 1 for 8x16 sprites
void __fastcall__ oam_size(unsigned char size);

// set sprite in OAM buffer, chrnum is tile, attr is attribute, sprid is offset in OAM in bytes
// returns sprid+4, which is offset for a next sprite
unsigned char __fastcall__ oam_spr(unsigned char x, unsigned char y,
					unsigned char chrnum, unsigned char attr,
					unsigned char sprid);

// set metasprite in OAM buffer
// meta sprite is a const unsigned char array, it contains four bytes per sprite
// in order x offset, y offset, tile, attribute
// x=128 is end of a meta sprite
// returns sprid+4, which is offset for a next sprite
unsigned char __fastcall__ oam_meta_spr(unsigned char x, unsigned char y,
					unsigned char sprid, const unsigned char *data);

// hide all remaining sprites from given offset
void __fastcall__ oam_hide_rest(unsigned char sprid);


// initialize the FamiTone system
void __fastcall__ famitone_init(void* music_data);

// initialize the FamiTone SFX system
void __fastcall__ sfx_init(void* sounds_data);

// play a music in FamiTone format
void __fastcall__ music_play(unsigned char song);

// stop music
void __fastcall__ music_stop(void);

// pause and unpause music
void __fastcall__ music_pause(unsigned char pause);

// play FamiTone sound effect on channel 0..3
void __fastcall__ sfx_play(unsigned char sound, unsigned char channel);

// play a DPCM sample, 1..63
void __fastcall__ sample_play(unsigned char sample);

// call from NMI once per frame
void __fastcall__ famitone_update(void);


// poll controller and return flags like PAD_LEFT etc, input is pad number (0 or 1)
unsigned char __fastcall__ pad_poll(unsigned char pad);

// poll controller in trigger mode, a flag is set only on button down, not hold
// if you need to poll the pad in both normal and trigger mode, poll it in the
// trigger mode for first, then use pad_state
unsigned char __fastcall__ pad_trigger(unsigned char pad);

// get previous pad state without polling ports
unsigned char __fastcall__ pad_state(unsigned char pad);


// set scroll, including the top bits
// it is always applied at beginning of a TV frame, not at the function call
void __fastcall__ scroll(unsigned int x, unsigned int y);

// set scroll after screen split invoked by the sprite 0 hit
// warning: all CPU time between the function call and the actual split point will be wasted!
// warning: the program loop has to fit into the frame time, ppu_wait_frame should not be used
//          otherwise empty frames without split will be inserted, resulting in jumpy screen
// warning: only X scroll could be changed in this version
void __fastcall__ split(unsigned int x, unsigned int y);

// set scroll after screen split invoked by the sprite 0 hit
// sets both X and Y, but timing might be iffy depending
// on exact sprite 0 position
void __fastcall__ splitxy(unsigned int x, unsigned int y);


// select current chr bank for sprites, 0..1
void __fastcall__ bank_spr(unsigned char n);

// select current chr bank for background, 0..1
void __fastcall__ bank_bg(unsigned char n);



// get random number 0..255 or 0..65535
unsigned char __fastcall__ rand8(void);
unsigned int  __fastcall__ rand16(void);

// set random seed
void __fastcall__ set_rand(unsigned int seed);



// when display is enabled, vram access could only be done with this vram update system
// the function sets a pointer to the update buffer that contains data and addresses
// in a special format. It allows to write non-sequental bytes, as well as horizontal or
// vertical nametable sequences.
// buffer pointer could be changed during rendering, but it only takes effect on a new frame
// number of transferred bytes is limited by vblank time
// to disable updates, call this function with NULL pointer

// the update data format:
//  MSB, LSB, byte for a non-sequental write
//  MSB|NT_UPD_HORZ, LSB, LEN, [bytes] for a horizontal sequence
//  MSB|NT_UPD_VERT, LSB, LEN, [bytes] for a vertical sequence
//  NT_UPD_EOF to mark end of the buffer

// length of this data should be under 256 bytes

void __fastcall__ set_vram_update(unsigned char *buf);

// all following vram functions only work when display is disabled

// do a series of VRAM writes, the same format as for set_vram_update, but writes done right away
void __fastcall__ flush_vram_update(unsigned char *buf);

// set vram pointer to write operations if you need to write some data to vram
void __fastcall__ vram_adr(unsigned int adr);

// put a byte at current vram address, works only when rendering is turned off
void __fastcall__ vram_put(unsigned char n);

// fill a block with a byte at current vram address, works only when rendering is turned off
void __fastcall__ vram_fill(unsigned char n, unsigned int len);

// set vram autoincrement, 0 for +1 and not 0 for +32
void __fastcall__ vram_inc(unsigned char n);

// read a block from current address of vram, works only when rendering is turned off
void __fastcall__ vram_read(unsigned char *dst, unsigned int size);

// write a block to current address of vram, works only when rendering is turned off
void __fastcall__ vram_write(const unsigned char *src, unsigned int size);


// unpack RLE data to current address of vram, mostly used for nametables
void __fastcall__ vram_unrle(const unsigned char *data);

// unpack LZ4 data to this address
void __fastcall__ vram_unlz4(const unsigned char *in, unsigned char *out,
				const unsigned uncompressed_size);
/*
	Rough speeds for a full 1024 nametable:
	- rle takes 0.5 frames
	- uncompressed takes 1.3 frames
	- lz4 takes 2.8 frames
*/


// like memset, but does not return anything
void __fastcall__ memfill(void *dst, unsigned char value, unsigned int len);

// delay for N frames
void __fastcall__ delay(unsigned char frames);

// display.sinc functions
void __fastcall__ oam_clear_fast(void);
void __fastcall__ oam_meta_spr_pal(unsigned char x,unsigned char y,unsigned char pal,const unsigned char *metasprite);
void __fastcall__ oam_meta_spr_clip(signed int x,unsigned char y,const unsigned char *metasprite);

// set NMI/IRQ callback
void __fastcall__ nmi_set_callback(void (*callback)(void));



#define PAD_A			0x01
#define PAD_B			0x02
#define PAD_SELECT		0x04
#define PAD_START		0x08
#define PAD_UP			0x10
#define PAD_DOWN		0x20
#define PAD_LEFT		0x40
#define PAD_RIGHT		0x80

#define OAM_FLIP_V		0x80
#define OAM_FLIP_H		0x40
#define OAM_BEHIND		0x20

#define MAX(x1,x2)		((x1)<(x2)?(x2):(x1))
#define MIN(x1,x2)		((x1)<(x2)?(x1):(x2))

#define MASK_SPR		0x10
#define MASK_BG			0x08
#define MASK_EDGE_SPR		0x04
#define MASK_EDGE_BG		0x02
#define MASK_TINT_RED		0x20
#define MASK_TINT_BLUE		0x40
#define MASK_TINT_GREEN		0x80
#define MASK_MONO		0x01

#define NAMETABLE_A		0x2000
#define NAMETABLE_B		0x2400
#define NAMETABLE_C		0x2800
#define NAMETABLE_D		0x2c00

#define NULL			0
#define TRUE			1
#define FALSE			0

#define NT_UPD_HORZ		0x40
#define NT_UPD_VERT		0x80
#define NT_UPD_EOF		0xff

// macro to calculate nametable address from X,Y in compile time

#define NTADR_A(x,y)	 	(NAMETABLE_A|(((y)<<5)|(x)))
#define NTADR_B(x,y) 		(NAMETABLE_B|(((y)<<5)|(x)))
#define NTADR_C(x,y) 		(NAMETABLE_C|(((y)<<5)|(x)))
#define NTADR_D(x,y) 		(NAMETABLE_D|(((y)<<5)|(x)))

// macro to get MSB and LSB

#define MSB(x)			(((x)>>8))
#define LSB(x)			(((x)&0xff))

// OAM buffer @ $200-$2FF

typedef struct OAMSprite {
  byte y;	// Y coordinate
  byte name;	// tile index in name table
  byte attr;	// attribute flags
  byte x;	// X coordinate
} OAMSprite;

#define OAMBUF			((OAMSprite*) 0x200)

// OAM offset for spr_pal and spr_clip

extern byte oam_off;
#pragma zpsym ("oam_off")

#endif /* neslib.h */

