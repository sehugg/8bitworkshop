#include <stdlib.h>
#include <string.h>

#include "cv.h"
#include "cvu.h"

#define PATTERN ((const cv_vmemp)0x0000)
#define COLOR ((const cv_vmemp)0x2000)
#define IMAGE ((const cv_vmemp)0x1c00)

volatile bool vint;
volatile uint_fast8_t vint_counter;
uint_fast8_t oldcounter;

void vint_handler(void)
{
	vint = true;
	vint_counter++;
}

void update_stars(void)
{
	uint_fast8_t j;
	uint_fast8_t tmp = vint_counter;
	tmp %= (16 * 8);

	for(j = 0; j < 3; j++)
	{
		cvu_voutb(0x00, PATTERN + j * 256 * 8 + oldcounter);
		cvu_voutb(0x10, PATTERN + j * 256 * 8 + tmp);
	}

	oldcounter = tmp;
}

void init_stars(void)
{
	uint_fast8_t i, j, r;

	for(j = 0; j < 32; j += rand() % 2)
	{
		r = rand() % 16;
		for(i = 0; i < 24; i++)
		{
			cvu_voutb(r++, IMAGE + j + i * 32);
			r %= 16;
		}
	}

	for(j = 0; j < 3; j++)
		cvu_vmemset(COLOR + j * 256 * 8, (CV_COLOR_WHITE << 4) | CV_COLOR_BLACK, 16 * 8);

	cvu_voutb(0x10, PATTERN);
	oldcounter = 0;
	vint_counter = 0;
}

void main(void)
{
	cv_set_screen_active(false);	
	cv_set_image_table(IMAGE);
	cv_set_color_table(0x3fff);
	cv_set_character_pattern_t(0x1fff);
	cv_set_screen_mode(CV_SCREENMODE_BITMAP);
	cv_set_vint_handler(&vint_handler);
	
	cvu_vmemset(PATTERN, 0, 8 * 256 * 3);
	cvu_vmemset(COLOR, 0, 8 * 256 * 3);
	cvu_vmemset(IMAGE, 0xff, 32 * 24);

	init_stars();

	cv_set_screen_active(true);

	for(;;)
	{
		while(!vint);
		update_stars();
		vint = false;
	}
}
