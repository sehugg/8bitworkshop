
all: minbios.rom
	mkdir -p ../../mame/roms/coleco
	cp $< ../../mame/roms/coleco/"313 10031-4005 73108a.u2"

clean:
	rm -f minbios.rom

%.rom: %.asm
	naken_asm -b $<
	dd if=out.bin of=$@ bs=1 count=8192

# python parsebdf8.py -f -s 32 -e 127 -B fonts/tom-thumb.bdf
