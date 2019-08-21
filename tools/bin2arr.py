#!/usr/bin/python

import sys

out = sys.stdout
chr = open(sys.argv[1],'rb').read()

out.write('const unsigned char ARRAY[%d] = {\n' % len(chr))

for i in range(0,len(chr)):
    out.write('0x%02x, ' % ord(chr[i]))
    if (i & 7) == 7:
        out.write('\n')

out.write('\n};\n')
