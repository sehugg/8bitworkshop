#ifndef __CV_SUPPORT_H
#define __CV_SUPPORT_H 1

#include <stdint.h>

#include "cv_graphics.h"

extern void cv_init(void); // Initialize Colecovision library.

extern void cv_vdpout(const uint8_t reg, const uint8_t data) __preserves_regs(d, e, iyl, iyh);  // Write data to VDP control register reg.

#ifndef CV_MSX
extern void cv_enable_nmi(void);

extern void cv_disable_nmi(void);
#endif

#endif

