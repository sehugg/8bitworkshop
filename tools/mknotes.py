#!/usr/bin/python

import sys, string, math, argparse

parser = argparse.ArgumentParser()
parser.add_argument('-l', '--length', type=int, default=64, help="length of note table")
parser.add_argument('-u', '--upper', type=int, default=49, help="upper note # to test")
parser.add_argument('-f', '--freq', type=float, default=3579545/32.0, help="base frequency (Hz)")
args = parser.parse_args()

test_notes = args.upper
final_notes = args.length
basehz = args.freq

results = []

for a440 in range(4300,4500):
    error = 0
    for note in range(1,test_notes):
        notehz = a440 / 10.0 * math.pow(2.0, (note - 49) / 12.0);
        period = int(round(basehz / notehz))
        tonehz = basehz / period
        error += abs(notehz-tonehz)
        #print a440,note,notehz,notehz-tonehz,period
        #if a440 == 4405:
        #  print '%d,%f,%d' % (note,tonehz-notehz,period)
    results.append((error, a440))

results.sort()
best_error, best_a440 = results[0]
best_a440 /= 10.0
print '//', best_a440, best_error, test_notes

print "const int note_table[%d] = {" % final_notes
for note in range(0,final_notes):
    notehz = best_a440 * math.pow(2.0, (note - 49) / 12.0);
    period = int(round(basehz / notehz))
    print '%d,' % period,
print "};"
