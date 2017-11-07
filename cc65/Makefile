
CC65FLAGS=-I/home/hugg/compilers/cc65/include -I/home/hugg/compilers/cc65/include/nes -L/home/hugg/compilers/cc65/lib --cfg-path /home/hugg/compilers/cc65/cfg/ -v

all: \
	default_neslib.neslib.nes default_conio.conio.nes \
	default_neslib.neslib.lzg default_conio.conio.lzg

clean:
	rm -f *.s *.o *.nes *.lzg

#%.s: %.c
#	cc65 $*.c
#	ca65 $*.s

%.neslib.nes: %.c
	cl65 $(CC65FLAGS) -o $@ -t nes -C neslib.cfg $*.c neslib.lib nes.lib

%.conio.nes: %.c
	cl65 $(CC65FLAGS) -o $@ -t nes $*.c nes.lib

%.rom: %.s
	time ld65 -o $@ -C atarivec.cfg $*.o atari2600.lib
	
%.lzg: %.nes
	lzg $< | hexdump -v -e '"\n" 32/1 "%u,"' > $@
