#!/usr/bin/python

import sys, math

test_notes = int(sys.argv[1]) or 49
final_notes = int(sys.argv[2]) or 64

basehz = 15720.0 #4
basehz2 = 5240.0 #12
basehz3 = 1014.2 #6
s = 8

bittable = [
0b00000000,
0b00000001,
0b00010001,
0b01001001,
0b01010101,
0b10110101,
0b11011011,
0b11101111,
]

results = []

for a440 in range(4200,4600):
    error = 0
    for note in range(4,test_notes):
        notehz = a440 / 10.0 * math.pow(2.0, (note - 49) / 12.0);
        period = round(basehz * s / notehz) / s
        tonehz = basehz / period
        if period < s or period > 32*s:
            tonehz = -10000
        period2 = round(basehz2 * s / notehz) / s
        tonehz2 = basehz2 / period
        if period2 < s or period2 > 32*s:
            tonehz2 = -10000
        period3 = round(basehz3 * s / notehz) / s
        tonehz3 = basehz3 / period
        if period3 < s or period3 > 32*s:
            tonehz3 = -10000
        error += min(abs(notehz-tonehz), abs(notehz-tonehz2), abs(notehz-tonehz3))
        #print a440,note,notehz,notehz-tonehz,period
        #if a440 == 4405:
        #  print '%d,%f,%d' % (note,tonehz-notehz,period)
    results.append((error, a440))

results.sort()
best_error, best_a440 = results[0]
best_a440 /= 10.0
print '//', best_a440, best_error, test_notes

periods = []
tones = []
bits = []

print "const int note_table[%d] = {" % final_notes
for note in range(0,final_notes):
    notehz = best_a440 * math.pow(2.0, (note - 49) / 12.0);
    bestperiod = 255
    bestscore = 999999
    besthz = -1
    for hz in [basehz, basehz2, basehz3]:
        period = int(round(hz * s / notehz))
        if period >= s and period <= 32*s:
            tonehz = hz / period
            error = notehz - hz
            if error < bestscore:
                bestscore = error
                bestperiod = period
                besthz = hz
            
    #print '%d,' % period,
    print note, besthz, bestperiod, notehz
    periods.append(bestperiod / s - 1)
    bits.append(bittable[bestperiod & (s-1)])
    if besthz==basehz:
        tones.append(4)
    elif besthz==basehz2:
        tones.append(12)
    elif besthz==basehz3:
        tones.append(6)
    else:
        tones.append(0)
print "};"

print periods
print bits
print tones
