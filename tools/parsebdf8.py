#!/usr/bin/python

import sys,string

height = 8
lochar = 0x20 #48
hichar = 0x5e #57

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
            bytes.append(byte)

# output font table
x = 0
output = []
invoutput = []
rotoutput = []
rot2output = []
for ch in range(lochar,hichar+1):
    bytes = chars.get(ch)
    #bytes = bytes + [0]
    if not bytes:
        bytes = [0] * height
    for b in bytes:
        output.append(b)
        invoutput.append(b ^ 0xff)
        rotoutput.append(0)
        rot2output.append(0)
    for x in range(0,height):
        for y in range(0,height):
            rotoutput[-7+x] |= (((output[-1-y]>>x)&1)<<y)
            rot2output[-1-x] |= (((output[-7+y]>>x)&1)<<y)

def tohex(v):
    return '%02x'%v
def tohex2(v):
    return '0x%02x'%v

for arr in [output,invoutput,rotoutput,rot2output]:
    print '\thex ' + string.join(map(tohex,arr),'')
    for i in range(0,len(output),height):
        print '{', string.join(map(tohex2,arr[i:i+height]),','), '},',
    print
    print

print len(output),len(invoutput),len(rotoutput),len(rot2output)

