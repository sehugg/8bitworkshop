#!/usr/bin/python

import sys,string,argparse

#lochar = 0x20 #48
#hichar = 0x5e #57

parser = argparse.ArgumentParser()
parser.add_argument('-s', '--start', type=int, default=0, help="index of first character")
parser.add_argument('-e', '--end', type=int, default=255, help="index of last character")
parser.add_argument('-H', '--height', type=int, default=8, help="character height")
parser.add_argument('-i', '--invert', action="store_true", help="invert bits")
parser.add_argument('-r', '--rotate', action="store_true", help="rotate bits (vertical)")
parser.add_argument('-f', '--flip', action="store_true", help="flip bits (horizontal)")
outfmtgroup = parser.add_mutually_exclusive_group()
outfmtgroup.add_argument("-A", "--asmhex", action="store_true", help="DASM-compatible hex")
outfmtgroup.add_argument("-C", "--carray", action="store_true", help="Nested C array")
outfmtgroup.add_argument("-F", "--flatcarray", action="store_true", help="Flat C array")
parser.add_argument('bdffile', help="BDF bitmap file")
args = parser.parse_args()

height = args.height
lochar = args.start
hichar = args.end
invert = args.invert
flip = args.flip
rotate = args.rotate

chars = {}
inbitmap = 0
with open(sys.argv[1],'r') as f:
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

for arr in [output]:
    if args.asmhex:
        print '\thex ' + string.join(map(tohex,arr),'')
    if args.carray:
        print "static char FONT[%d][%d] = {" % (hichar-lochar+1, height)
        for i in range(0,len(output),height):
            print '{', string.join(map(tohex2,arr[i:i+height]),','), '},',
        print
        print "};"
    if args.flatcarray:
        print "static char FONT[%d] = {" % ((hichar-lochar+1) * height)
        print string.join(map(tohex2,arr),',')
        print "}";


