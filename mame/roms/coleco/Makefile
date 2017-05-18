
all: minbios.rom

%.rom: %.asm
	naken_asm -b $<
	dd if=out.bin of=$@ bs=1 count=8192

# python parsebdf8.py -f -s 32 -e 127 -B fonts/tom-thumb.bdf
