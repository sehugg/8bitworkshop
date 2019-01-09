#!/usr/bin/python

import sys,string,argparse

#lochar = 0x20 #48
#hichar = 0x5e #57

parser = argparse.ArgumentParser()
parser.add_argument('-s', '--start', type=int, default=0, help="index of first character")
parser.add_argument('-e', '--end', type=int, default=255, help="index of last character")
parser.add_argument('-H', '--height', type=int, default=8, help="character height")
parser.add_argument('-i', '--invert', action="store_true", help="invert bits")
parser.add_argument('-r', '--rotate', action="store_true", help="rotate bits")
parser.add_argument('-f', '--flip', action="store_true", help="flip bits (vertically)")
parser.add_argument('-m', '--mirror', action="store_true", help="mirror bits (horizontally)")
outfmtgroup = parser.add_mutually_exclusive_group()
outfmtgroup.add_argument("-A", "--asmhex", action="store_true", help="DASM-compatible hex")
outfmtgroup.add_argument("-B", "--asmdb", action="store_true", help="Z80ASM-compatible hex")
outfmtgroup.add_argument("-C", "--carray", action="store_true", help="Nested C array")
outfmtgroup.add_argument("-F", "--flatcarray", action="store_true", help="Flat C array")
outfmtgroup.add_argument("-V", "--verilog", action="store_true", help="Verilog-compatible hex")
parser.add_argument('bdffile', help="BDF bitmap file")
args = parser.parse_args()

height = args.height
lochar = args.start
hichar = args.end
invert = args.invert
flip = args.flip
rotate = args.rotate
mirror = args.mirror

chars = {}
inbitmap = 0
with open(args.bdffile,'r') as f:
    lines = f.readlines()
    for l in lines:
        l = l.strip()
        toks = l.split()
        #print l,toks
        if toks[0] == 'ENCODING':
            chord = int(toks[1])
        elif toks[0] == 'BITMAP':
            inbitmap = True
            bytes = []
        elif toks[0] == 'ENDCHAR':
            inbitmap = False
            if chord >= lochar and chord <= hichar:
                while len(bytes) < height:
                    bytes.insert(0,0)
                assert(len(bytes) == height)
                bytes.reverse()
                #print chord,bytes
                chars[chord] = bytes
        elif inbitmap and len(toks) == 1:
            byte = int(toks[0],16)
            bytes.append(byte)

def revbits(n):
    r = 0
    for i in range(0,8):
        if (n & (1<<i)):
            r |= (1<<(7-i))
    return r

# output font table
x = 0
output = []
revoutput = []
rotoutput = []
rot2output = []
for ch in range(lochar,hichar+1):
    bytes = chars.get(ch)
    if not bytes:
        bytes = [0] * height
    if flip:
        bytes.reverse()
    if mirror:
        for i in range(0,height):
            bytes[i] = revbits(bytes[i])
    if rotate:
        rotbytes = [0] * height
        for x in range(0,height):
            for y in range(0,height):
                rotbytes[-1-x] |= (((bytes[-1-y]>>x)&1)<<y)
        bytes = rotbytes
          #rotoutput[-7+x] |= (((output[-1-y]>>x)&1)<<y)
          #rotoutput[-1-x] |= (((output[-1-y]>>x)&1)<<y)
          #rot2output[-1-x] |= (((output[-7+y]>>x)&1)<<y)
    for b in bytes:
        output.append(b)

def tohex(v):
    return '%02x'%v
def tohex2(v):
    return '0x%02x'%v
def tohexv(v):
    return "8'h%02x"%v

for arr in [output]:
    if args.asmhex:
        print('\thex ' + ''.join(list(map(tohex,arr))))
    if args.asmdb:
        for i in range(0,len(output),height):
            print('.DB', ','.join(list(map(tohex2,arr[i:i+height]))), ';%d'%(i/height+lochar))
    if args.carray:
        print("static char FONT[%d][%d] = {" % (hichar-lochar+1, height))
        for i in range(0,len(output),height):
            print('{', ','.join(list(map(tohex2,arr[i:i+height]))), '},', end=' ')
        print()
        print("};")
    if args.flatcarray:
        print("static char FONT[%d] = {" % ((hichar-lochar+1) * height))
        print(','.join(list(map(tohex2,arr))))
        print("}");
    if args.verilog:
        j = 0
        for i in range(0,len(output),height):
            print(','.join(list(map(tohexv,arr[i:i+height]))) + ", //%d" % (i/height))
            j += 1
