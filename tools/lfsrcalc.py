#!/usr/bin/python

MAXBITS=16

print("Period,nbits,feedback,mask")

for n in range(1,MAXBITS):
    mask = (1<<n)-1
    hibit = (1<<(n-1))
    for i in range(0,1<<n):
        for invert in [0,1]:
            x = 1
            seq = []
            seen = set()
            while x and not x in seen:
                seq.append(x)
                seen.add(x)
                feedback = x & hibit
                x = ((x << 1) & mask)
                if invert:
                    if not feedback:
                        x ^= i
                else:
                    if feedback:
                        x ^= i
            if x:
                seqindex = seq.index(x)
                seqlen = len(seq) - seqindex
                if seqlen>1:
                    print((seqlen, "#(%d,%d'%s,%d)" % (n,n,bin(i)[1:],invert), seqindex))
