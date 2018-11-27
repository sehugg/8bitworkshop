#!/bin/sh

./scr2floyd_percept $1.tga
lzg -9 $1.CHR > $1.CHR.lzg
lzg -9 $1.CLR > $1.CLR.lzg
rm -f $1.s
echo "\t.area _CODE" >> $1.s
echo "\t.globl _msx_mode2_pattern_lzg" >> $1.s
echo "\t.globl _msx_mode2_color_lzg" >> $1.s
echo "\n_msx_mode2_pattern_lzg:" >> $1.s
cat $1.CHR.lzg | hexdump -v -e '"\n.db " 16/1 ",0x%02x"' | sed "s/n.db,/ .db /" | tail -n +3 >> $1.s
echo "\n_msx_mode2_color_lzg:" >> $1.s
cat $1.CLR.lzg | hexdump -v -e '"\n.db " 16/1 ",0x%02x"' | sed "s/n.db,/ .db /" | tail -n +3 >> $1.s

