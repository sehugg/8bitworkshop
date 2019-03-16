
CC65LIB=../../src/worker/lib/nes/
NESLIB=$(HOME)/compilers/cc65/neslib/

shoot2: shoot2.c neslib.h
	cl65 -tnes -O -o $@ -l $@.lst vrambuf.c bcd.c apu.c shoot2.c -lnes -lneslib $(CC65LIB)/crt0.o -L$(CC65LIB) -C$(NESLIB)/nes.cfg\
	 -Wl -DNES_MIRRORING=1 -Wl -DNES_PRG_BANKS=2 -Wl -DNES_CHR_BANKS=0 -Wl -DNES_MAPPER=2

conio: conio.c
	cl65 -l conio.lst -tnes -O $<

test.rom: ex2.asm nesdefs.asm nesppu.asm
	dasm ex2.asm

