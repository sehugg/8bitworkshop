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
                print((chord,bytes))
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
    x = 0
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
def tohex2(v):
    return '0x%02x'%v
def tobin(v):
    return "bitarray[0][0]=3'b{0:3b};\n".format(v)

print(('\thex ' + ''.join(map(tohex,output))))
print((''.join(map(tohex2,output))))
print(('\thex ' + ''.join(map(tohex,outputlo))))
print(('\thex ' + ''.join(map(tohex,outputhi))))
print((''.join(map(tobin,output))))

print((len(output),len(outputlo),len(outputhi)))
