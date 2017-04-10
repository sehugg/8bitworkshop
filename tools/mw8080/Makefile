
all: cp437.mw8080.c c64.mw8080.c baddies-horiz.rot.c scrappy.rot.c

cp437.mw8080.c: ../cp437-8x8.bdf
	python ../parsebdf8.py $< -f -r -C > $@

c64.mw8080.c: ../c64.bdf
	python ../parsebdf8.py $< -f -r -C -s 32 -e 94 > $@

%.h:
	cat $* | hexdump -v -e '"\n" 128/1 "0x%02x,"'


%.c: %.pbm
	python ../pbm_to_c.py $< > $@

#%.rot.pbm: %.pbm
#	convert $< -transpose -bordercolor white -border 4x4 $@

baddies-horiz.rot.pbm: ../baddies-horiz.png
	convert $< +dither -brightness-contrast 50x50 -fill black -transpose -negate $@

scrappy.rot.pbm: ../scrappy48x64.pbm
	convert $< -transpose -bordercolor white -border 4x4 $@



