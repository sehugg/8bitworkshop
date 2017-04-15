
all: cp437.mw8080.c c64.mw8080.c baddies-horiz.rot.c scrappy.rot.c

# convert DOS CP437 font (256 chars)
cp437.mw8080.c: ../fonts/cp437-8x8.bdf
	python ../parsebdf8.py $< -f -r -C > $@

# convert C64 font (63 chars)
c64.mw8080.c: ../fonts/c64.bdf
	python ../parsebdf8.py $< -f -r -C -s 32 -e 94 > $@

%.h:
	cat $* | hexdump -v -e '"\n" 128/1 "0x%02x,"'

# convert PBM bitmap to C array
%.c: %.pbm
	python ../pbm_to_c.py $< > $@

#%.rot.pbm: %.pbm
#	convert $< -transpose -bordercolor white -border 4x4 $@

# rotate and dither example bitmaps

baddies-horiz.rot.pbm: ../images/baddies-horiz.png
	convert $< +dither -brightness-contrast 50x50 -fill black -transpose -negate $@

scrappy.rot.pbm: ../images/scrappy48x64.pbm
	convert $< -transpose -bordercolor white -border 4x4 $@

