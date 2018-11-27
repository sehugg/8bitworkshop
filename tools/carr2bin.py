
import sys,re

inf = sys.stdin
outf = open('a.out','wb')
l = inf.readline()
while l:
    l = l.strip()
    if l[-1] == ',':
        l = l[0:-1]
    toks = re.split('[,\s]+', l)
    toks = list(filter(lambda x: x[0:2]=='0x', toks))
    arr = [int(x,0) for x in toks]
    outf.write(bytes(arr))
    l = inf.readline()
