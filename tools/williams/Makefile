
all: baddies.c badspacerobots.tga tom-thumb.c swave.c.rom.h

clean:
	rm -f baddies.[ch] *.gif *.tga *.tga.png tom-thumb.c swave.c.rom.h

%.h: %
	cat $* | hexdump -v -e '"\n" 128/1 "0x%02x,"' > $@

# convert PCX (or PNG) file to Williams C sprite
%.c: %.pcx
	python3 ../pcx2will.py $< > $@

# convert PNG into RLE-encoded TGA bitmap
%.tga: %.png
	convert $< -resize 192 $<.gif
	convert $<.gif +dither -type palette -depth 4 -compress RLE -colors 8 -flip $@
	convert $@ $@.png

# convert PNG to 15-color PCX
%.pcx: %.png
	convert $< -format raw -type palette -compress none -colors 15 +dither $@

#%.4.pcx: %.png
#	convert $< -format raw -type palette -compress none -colors 4 +dither $@

# convert BDF font file to definitions
%.c: ../fonts/%.bdf
	python3 ../parsebdf4bit.py -s 33 -e 97 $< > $@

