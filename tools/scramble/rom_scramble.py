#!/usr/bin/python

import sys, zipfile

OUTFILE = 'scramble.zip'

ROMS = [
        ( "s1.2d",        0x0000, 0x0800),
        ( "s2.2e",        0x0800, 0x0800),
        ( "s3.2f",        0x1000, 0x0800),
        ( "s4.2h",        0x1800, 0x0800),
        ( "s5.2j",        0x2000, 0x0800),
        ( "s6.2l",        0x2800, 0x0800),
        ( "s7.2m",        0x3000, 0x0800),
        ( "s8.2p",        0x3800, 0x0800),
#        ROM_REGION( 0x10000, "audiocpu", 0 )
        ( "ot1.5c",       0x0000, 0x0800),
        ( "ot2.5d",       0x0800, 0x0800),
        ( "ot3.5e",       0x1000, 0x0800),
#        ROM_REGION( 0x1000, "gfx1", 0 )
        ( "c2.5f",        0x4000, 0x0800),
        ( "c1.5h",        0x4800, 0x0800),
#        ROM_REGION( 0x0020, "proms", 0 )
        ( "c01s.6e",      0x5000, 0x0020),
]

fn = sys.argv[1]
with open(fn, 'rb') as f:
        data = f.read()
        print "Read %d bytes of %s" % (len(data), fn)

with zipfile.ZipFile(OUTFILE, 'w') as zipf:
        for name,start,length in ROMS:
                romdata = data[start:start+length]
                if len(romdata) != length:
                        print "*** No data for %s (offset 0x%x)" % (name,start)
                        romdata = '\0' * length
                        zipf.writestr(name, romdata)
                else:
                        print 'Wrote %s (%d bytes)' % (name, length)
                        zipf.writestr(name, romdata)

        