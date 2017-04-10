#!/usr/bin/python

import sys, zipfile

OUTFILE = 'carnival.zip'

ROMS = [
        ( "epr-651.u33",   0x0000, 0x0400 ),
        ( "epr-652.u32",   0x0400, 0x0400 ),
        ( "epr-653.u31",   0x0800, 0x0400 ),
        ( "epr-654.u30",   0x0c00, 0x0400 ),
        ( "epr-655.u29",   0x1000, 0x0400 ),
        ( "epr-656.u28",   0x1400, 0x0400 ),
        ( "epr-657.u27",   0x1800, 0x0400 ),
        ( "epr-658.u26",   0x1c00, 0x0400 ),
        ( "epr-659.u8",    0x2000, 0x0400 ),
        ( "epr-660.u7",    0x2400, 0x0400 ),
        ( "epr-661.u6",    0x2800, 0x0400 ),
        ( "epr-662.u5",    0x2c00, 0x0400 ),
        ( "epr-663.u4",    0x3000, 0x0400 ),
        ( "epr-664.u3",    0x3400, 0x0400 ),
        ( "epr-665.u2",    0x3800, 0x0400 ),
        ( "epr-666.u1",    0x3c00, 0x0400 ),
        ( "316-633",      0x4000, 0x0020 ),
        ( "epr-412",     0x4040, 0x0400 ),
        ( "316-0206.u14", 0x4020, 0x0020 )
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
                        zipf.writestr(name, romdata)

        