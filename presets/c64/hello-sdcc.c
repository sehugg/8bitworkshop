// Hello World in C for the Commodore 64 using SDCC's mos6502 backend.
// (The -sdcc.c suffix selects SDCC instead of cc65.) The program is a PRG
// with a BASIC "SYS 2061" stub; there is no C library or conio, so we poke
// screen RAM and color RAM directly.

#include <stdint.h>

#define SCREEN    ((volatile uint8_t *)0x400)
#define COLOR_RAM ((volatile uint8_t *)0xd800)
#define BORDER    (*(volatile uint8_t *)0xd020)
#define BACKGROUND (*(volatile uint8_t *)0xd021)

// screen codes (not ASCII): letters are 1-26, space is 32
const uint8_t message[] = { 8,5,12,12,15, 32, 19,4,3,3, 32, 54,53,48,50 };

uint8_t color = 7;      // initialized data is copied to RAM at startup

void main(void) {
    uint16_t i;
    uint8_t c;
    BORDER = 6;
    BACKGROUND = 0;
    for (i = 0; i < 1000; i++) {        // clear the screen
        SCREEN[i] = 32;
        COLOR_RAM[i] = 1;
    }
    for (c = 0; c < sizeof(message); c++) {
        SCREEN[12*40 + 12 + c] = message[c];
        COLOR_RAM[12*40 + 12 + c] = color;
    }
    while (1);
}
