// Hello World in C for the devel-6502 machine, using SDCC's mos6502 backend.
// (The -sdcc.c suffix selects SDCC instead of cc65.)

#include <stdint.h>

#define SERIAL_OUT (*(volatile uint8_t *)0x4003)
#define HALT       (*(volatile uint8_t *)0x400f)

const char message[] = "Hello, SDCC 6502!\n";

uint8_t counter = 3;    // initialized data is copied to RAM at startup

void putstr(const char *s) {
    while (*s) SERIAL_OUT = *s++;
}

void main(void) {
    putstr(message);
    while (counter--) putstr("again\n");
    HALT = 1;
    while (1);
}
