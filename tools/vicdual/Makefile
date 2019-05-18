
all: cp437.vicdual.c c64.vicdual.c

clean:
	rm -f cp437.vicdual.c c64.vicdual.c

# convert DOS CP437 font (256 chars)
cp437.vicdual.c: ../fonts/cp437-8x8.bdf
	python ../parsebdf8.py $< -r -C > $@

# convert C64 font (256 chars, some unused)
c64.vicdual.c: ../fonts/c64.bdf
	python ../parsebdf8.py $< -r -C > $@

%.h:
	cat $* | hexdump -v -e '"\n" 128/1 "0x%02x,"'


