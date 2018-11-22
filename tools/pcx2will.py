#!/usr/bin/python

import sys, array, string

col0 = 0

def tocolor(x):
    if x == 0:
        return 0
    else:
        return x + col0

def tohex2(v):
    return '0x%02x'%v

with open(sys.argv[1],'rb') as f:
    data = array.array('B', f.read())
    assert data[0] == 0xa
    assert data[3] == 8
    
    # palette
    print("byte palette[16] = {", end='')
    for i in range(0,16):
        r = data[16+i*3]
        g = data[17+i*3]
        b = data[18+i*3]
        entry = (r>>5) | ((g>>2)&0x38) | (b&0xc0)
        print('%s,' % (tohex2(entry)), end='')
    print("}")
    
    # image data
    width = (data[9] << 8) + data[8] + 1
    height = (data[11] << 8) + data[10] + 1
    rowlen = (data[0x43] << 8) + data[0x42]
    print("const byte sprite[] = {")
    print("%d,%d," % ((width+1)/2,height))
    for y in range(0,height):
        ofs = 0x80 + y*rowlen
        output = []
        for x in range(0,width,2):
            b = (tocolor(data[ofs]) << 4) + tocolor(data[ofs+1])
            output.append(b)
            ofs += 2
        print(','.join(map(tohex2,output)) + ',')
    print("}")
    
