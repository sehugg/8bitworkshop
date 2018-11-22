#!/usr/bin/python

import sys

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
    assert(header == 'P4')
    dims = f.readline().strip()
    while dims[0] == '#':
        dims = f.readline().strip()
    width,height = map(int, dims.split())
    wbytes = (width+7)/8
    data = f.read()
    print("{%d,%d," % (wbytes,height), end='')
    for i in range(0,len(data)):
        if i>0:
            sys.stdout.write(",")
        ofs = i+wbytes-(i%wbytes)*2-1
        sys.stdout.write( "0x%02x" % ord(data[ofs]) )
    print("}")

