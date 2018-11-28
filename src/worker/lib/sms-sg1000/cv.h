// (c) 2013 Philipp Klaus Krause

// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 2.1 of the License, or (at your option) any later version.

// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.

// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA

#ifndef CV_H
#define CV_H 1

#include <stdint.h>

#define CV_LIBVERSION_MAJOR 0
#define CV_LIBVERSION_MINOR 24
#define CV_LIBVERSION_STRING "0.24"

#include "cv_input.h"
#include "cv_graphics.h"
#include "cv_sound.h"

// Set the handler for the vertical retrace interrupt.
extern void cv_set_vint_handler(void (* handler)(void));

// Get the handler for the vertical retrace interrupt.
extern void *cv_get_vint_handler(void);

// Get the vertical retrace frequency in Hz. 50 for PAL, 60 for NTSC.
unsigned char cv_get_vint_frequency(void);

#ifndef CV_SMS
enum cv_machine {
	CV_COLECOVISION = 0,	// Coleco ColecoVision
	//CV_ADAM = 1,	// Coleco Adam - TODO
	//CV_SUPERGAME = 2, // Coleco ColecoVision with super game module
};
#else
enum cv_machine {
	CV_SG1000 = 0,	// Sega SG-1000
	CV_SC3000 = 1,	// Sega SC-3000
	CV_MARKIII = 2,	// Sega Mark III or Master System
	//CV_GAMEGEAR = 3,	// Sega Game Gear - TODO
};
#endif

// Find out on which machine we are running 
enum cv_machine cv_get_machine(void);

// Get the contents of the refresh register R. Can be useful for seeding PRNGs.
uint8_t cv_get_r(void) __preserves_regs(b, c, d, e, h, iyl, iyh);

#endif

