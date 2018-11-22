#!/usr/bin/python

import sys, struct

# playfield bytes, one array for each of 6 columns
output = [[],[],[],[],[],[]]

# reverse byte
def rev(n):
    return int('{:08b}'.format(n)[::-1], 2)

# output bits in given range
def out(i, pix, lb, hb, reverse=0, shift=0):
    x = (pix >> lb) & ((1<<(hb-lb))-1)
    if reverse:
        x = rev(x)
    if shift:
        x = x << shift
    assert(x>=0 and x<=255)
    output[i].append(x)

# read PBM (binary P4 format) file
with open(sys.argv[1],'rb') as f:
    # read PBM header
    header = f.readline().strip()
    assert(header == b'P4')
    dims = f.readline().strip()
    if dims[0:1] == b'#':
        dims = f.readline().strip()
    width,height = list(map(int, dims.split()))
    assert(width==48)
    # read bitmap rows
    for y in range(0,height):
        row = bytes(f.read(6) + b'\0\0') # pad to 8 bytes
        # convert to 64-bit integer
        pix = struct.unpack('<q',row)[0]
        #print '%010lx' % pix
        # generate playfield bytes
        out(0, pix, 0, 8, 0)
        out(1, pix, 8, 16, 0)
        out(2, pix, 16, 24, 0)
        out(3, pix, 24, 32, 0)
        out(4, pix, 32, 40, 0)
        out(5, pix, 40, 48, 0)

# output bitmap tables
for c in range(0,6):
    print("\talign $100")
    print(("Bitmap%d" % c))
    print("\thex 00")
    s = '\thex '
    for i in range(0,height):
        s += '%02x' % output[c][height-i-1]
        if i % 16 == 15:
            print(s)
            s = '\thex '
    if len(s)>5:
        print(s)
