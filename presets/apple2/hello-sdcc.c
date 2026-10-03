// Hello World in C for the Apple ][ using SDCC's mos6502 backend.
// (The -sdcc.c suffix selects SDCC instead of cc65.) The program is linked
// as a DOS 3.3 binary at $803; there is no C library or conio, so we poke
// the text screen directly.

#include <stdint.h>

#define TEXT_PAGE1 ((volatile uint8_t *)0x400)

const char message[] = "HELLO, SDCC 6502!";

uint8_t row = 10;       // initialized data is copied to RAM at startup

// text rows are interleaved: three groups of 8 rows, 40 bytes apart,
// each row of a group $80 bytes after the previous
volatile uint8_t *row_address(uint8_t r) {
    return TEXT_PAGE1 + (r & 7) * 0x80 + (r >> 3) * 40;
}

void main(void) {
    uint8_t i, r;
    volatile uint8_t *p;
    for (r = 0; r < 24; r++) {          // clear the screen
        p = row_address(r);
        for (i = 0; i < 40; i++) p[i] = 0xa0;
    }
    p = row_address(row) + 11;
    for (i = 0; message[i]; i++)
        p[i] = message[i] | 0x80;       // normal video: high bit set
    while (1);
}
