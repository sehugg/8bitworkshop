
all: binaries images/parrot.c

%.hex: %
	cat $< | hexdump -v -e '"\n.byte" 16/1 ",0x%02x"' | sed "s/byte,/byte /" > $@

%.c: %.CHR.lzg.hex %.CLR.lzg.hex
	echo "// MSX mode 2 data" > $@
	xxd -i $(word 1,$^) >> $@
	xxd -i $(word 2,$^) >> $@

%.lzg: %
	lzg -9 $< $@

%.CHR: %.tga
	./scr2floyd_percept $<

binaries: scr2floyd scr2floyd_percept galois

