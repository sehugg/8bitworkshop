#!/usr/bin/python

import sys,string,argparse

#lochar = 0x20 #48
#hichar = 0x5e #57

parser = argparse.ArgumentParser()
parser.add_argument('-s', '--start', type=int, default=0, help="index of first character")
parser.add_argument('-e', '--end', type=int, default=255, help="index of last character")
parser.add_argument('bdffile', help="BDF bitmap file")
args = parser.parse_args()

lochar = args.start
hichar = args.end

def tohex(v):
    return '%02x'%v
def tohex2(v):
    return '0x%02x'%v

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
        elif toks[0] == 'BBX':
            bbx = [int(x) for x in toks[1:]]
        elif toks[0] == 'ENDCHAR':
            inbitmap = False
            if chord >= lochar and chord <= hichar:
                #bytes.reverse()
                #print chord,bytes,bbx
                width = bbx[0]+1
                height = bbx[1]
                output = [(width+1)//2 + (width)*16, height + (height+bbx[3])*16]
                for y in range(0,height):
                    for x in range(0,width,2):
                        b = 0
                        if bytes[y] & (0x80 >> x):
                            b |= 0xf0
                        if bytes[y] & (0x40 >> x):
                            b |= 0x0f
                        output.append(b)
                print('const char CH_%d[] = { %s };' % ( chord, ','.join([tohex2(x) for x in output]) ))
                chars[chord] = 'CH_%d' % chord
        elif inbitmap and len(toks) == 1:
            byte = int(toks[0],16)
            bytes.append(byte)

print('const char* const FONT_TABLE[%d] = {' % (hichar-lochar+1), end=' ')
for ch in range(lochar, hichar+1):
    if chars.get(ch):
        print('%s,' % chars[ch], end=' ')
    else:
        print('0,', end=' ')
print("};")
