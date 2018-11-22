#!/usr/bin/python

import sys, string, math, argparse

parser = argparse.ArgumentParser()
parser.add_argument('-l', '--length', type=int, default=64, help="length of note table")
parser.add_argument('-u', '--upper', type=int, default=49, help="upper note # to test")
parser.add_argument('-f', '--freq', type=float, default=3579545/32.0, help="base frequency (Hz)")
parser.add_argument('-b', '--bias', type=float, default=0, help="divisor bias")
parser.add_argument('-m', '--maxbits', type=float, default=12, help="max. # of bits")
args = parser.parse_args()

test_notes = args.upper
final_notes = args.length
basehz = args.freq
bias = args.bias
maxval = (1<<int(args.maxbits))-1

results = []

for a440 in range(4300,4500):
    error = 0
    for note in range(1,test_notes):
        notehz = a440 / 10.0 * math.pow(2.0, (note - 49) / 12.0);
        period = int(round(basehz / notehz)) 
        while period > maxval:
            period /= 2
        tonehz = basehz / period
        error += abs(notehz-tonehz)
        #print a440,note,notehz,notehz-tonehz,period
        #if a440 == 4405:
        #  print '%d,%f,%d' % (note,tonehz-notehz,period)
    results.append((error, a440))

results.sort()
best_error, best_a440 = results[0]
best_a440 /= 10.0
print('//', args)
print('//', best_a440, best_error, test_notes)

print("const int note_table[%d] = {" % final_notes)
for note in range(0,final_notes):
    notehz = best_a440 * math.pow(2.0, (note - 49) / 12.0);
    period = int(round(basehz / notehz)) - bias
    while period > maxval:
        period /= 2
    print('%d,' % period, end='')
print("};")
