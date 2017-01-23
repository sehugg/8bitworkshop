#!/usr/bin/python

import sys,string

height = 5
lochar = 41
hichar = 90

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
                print chord,bytes
                chars[chord] = bytes
        elif inbitmap and len(toks) == 1:
            byte = int(toks[0],16)
            assert((byte&15)==0)
            assert((byte&1)==0)
            byte = byte / 32
            bytes.append(byte)

# output font table
x = 0
output = []
outputlo = []
outputhi = []
for ch in range(lochar,hichar+1):
    bytes = chars.get(ch)
    #bytes = bytes + [0]
    if not bytes:
        bytes = [0] * height
    for b in bytes:
        if not x:
            v = b
        else:
            v = v | (b<<4)
            output.append(v)
        x ^= 1
        outputlo.append(b)
        outputhi.append(b<<4)

def tohex(v):
    return '%02x'%v

print '\thex ' + string.join(map(tohex,output),'')
print '\thex ' + string.join(map(tohex,outputlo),'')
print '\thex ' + string.join(map(tohex,outputhi),'')

print len(output),len(outputlo),len(outputhi)