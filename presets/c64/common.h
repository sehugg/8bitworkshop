#ifndef _COMMON_H
#define _COMMON_H

#include <c64.h>
#include <stdint.h>

typedef uint8_t byte;
typedef uint16_t word;
typedef int8_t sbyte;
typedef enum { false, true } bool;

#define COLS 40
#define ROWS 25

void raster_wait(unsigned char line);
void wait_vblank(void);

#endif
