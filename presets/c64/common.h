#ifndef _COMMON_H
#define _COMMON_H

#include <conio.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <peekpoke.h>
#include <string.h>
#include <c64.h>
#include <joystick.h>

typedef uint8_t byte;
typedef uint16_t word;
typedef int8_t sbyte;
typedef enum { false, true } bool;

#define COLS 40
#define ROWS 25

#define DEFAULT_SCREEN ((void*)0x400)

#define wait_vblank waitvsync

void raster_wait(byte line);

char* get_vic_bank_start(void);

#endif
