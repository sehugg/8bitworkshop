
all: baddies.4.pcx.h badspacerobots.tga

%.h: %
	cat $* | hexdump -v -e '"\n" 128/1 "0x%02x,"' > $@

%.tga: %.png
	convert $< -resize 192 $<.gif
	convert $<.gif +dither -type palette -depth 4 -compress RLE -colors 8 -flip $@
	convert $@ $@.png

%.pcx: %.png
	convert $< -format raw -type palette -compress none -colors 15 +dither $@
%.rle.pcx: %.png
	convert $< -format raw -type palette -compress rle -colors 15 +dither $@
%.4.pcx: %.png
	convert $< -format raw -type palette -compress none -colors 4 +dither $@

