
%-pf.hex: %-pf.pbm p4_to_pfbytes.py
	python p4_to_pfbytes.py $< > $@

%-48.hex: %-48.pbm p4_to_48pix.py
	python p4_to_48pix.py $< > $@

%-pf.pbm: %.jpg
	convert $< -resize 40x192\! -colorspace Gray -dither FloydSteinberg $@

%-48.pbm: %.jpg
	convert $< -resize 48x192\! -colorspace Gray -dither FloydSteinberg $@

%.tga: %.png
	convert $< -resize 128x96\! +dither $<.gif
	convert $<.gif -type palette -compress RLE -colors 8 +dither -flip $@
	convert $@ $@.png

%.pcx: %.png
	convert $< -format raw -type palette -compress none -colors 15 +dither $@

ship1.pbm: ship1.png
	convert ship1.png -negate -flop ship1.pbm

%.h:
	cat $* | hexdump -v -e '"\n" 128/1 "0x%02x,"'

%.prom:
	cat $* | hexdump -v -e '" \n defb  " 32/1 "$$%02x,"' | cut -c 2-134

%.rot.pbm: %.pbm
	convert $< -transpose -bordercolor white -border 4x4 $@

baddies-horiz.rot.pbm: baddies-horiz.png
	convert $< +dither -brightness-contrast 50x50 -fill black -transpose -negate $@
	convert $@ foo.png
