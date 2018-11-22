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
    print(dims)
    width,height = list(map(int, dims.split()))
    assert(width==40)
    # read bitmap rows
    for y in range(0,height):
        row = bytes(f.read(5) + b'\0\0\0') # pad to 8 bytes
        # convert bytes from MSB first to LSB first
        row2 = []
        for i in range(0,8):
            row2.append(rev(row[i]))
        # convert to 64-bit integer
        pix = struct.unpack('<q',bytes(row2))[0]
        # generate playfield bytes
        out(0, pix, 0, 4, 0, 4)
        out(1, pix, 4, 12, 1)
        out(2, pix, 12, 20, 0)
        out(3, pix, 20, 24, 0, 4)
        out(4, pix, 24, 32, 1)
        out(5, pix, 32, 40, 0)

# output bitmap tables
for c in range(0,6):
    print(("PFBitmap%d" % c))
    s = '\thex '
    for i in range(0,height):
        s += '%02x' % output[c][height-i-1]
        if i % 16 == 15:
            print(s)
            s = '\thex '
    if len(s)>5:
        print(s)
