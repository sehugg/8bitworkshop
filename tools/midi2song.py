#!/usr/bin/python

import sys, string, math
import mido

min_note = 21
max_note = 21+63
max_voices = 3
one_voice_per_channel = 1
tempo = 48
compress = 0
transpose = 0

fn = sys.argv[1]

mid = mido.MidiFile(fn)

def hex2(n):
    return '0x%02x'%n

def only_notes(s):
    for ch in s:
        if ord(ch) == 0xff:
            return False
    return True

def find_common_substrings(s):
    results = {}
    for l in range(64, 6, -1):
        for i in range(0,len(s)-l*2):
            match = s[i:i+l]
            if not only_notes(match):
                continue
            count = 0
            j = i+l
            while j < len(s):
                p = s.find(match, j)
                if p > 0:
                    count += 1
                    j = p+l
                else:
                    break
            if count:
                n = count*(l-1)-1
                if not results.get(i) or n > results[i][0]:
                    results[i] = (n,l)
    return results

def get_best_substring(ss):
    best = (0,0,0)
    for k,v in ss.items():
      if v[0] > best[2]:
          best = (k,v[1],v[0])
    return best

def offset2str(ofs):
    return chr(ofs & 0xff) + chr((ofs >> 8) & 0xff)
    #return chr(0xc0 | (ofs & 0x3f)) + chr(0xc0 | ((ofs >> 6) & 0x3f))

g_code = 0xc1
g_subs = []

def replace_substrings(s, bss):
    global g_code
    i,l,n = bss
    count = (n+1)/(l-1)
    match = s[i:i+l]
    print i,l,n,count,repr(match)
    r = s[0:i]
    while i<len(s):
        r += chr(g_code)
        p = s.find(match,i+l)
        if p < 0:
            p = len(s)
        r += s[i+l:p]
        i = p
    g_subs.append(match + chr(0xff))
    g_code += 1
    print len(s), len(r)+n+l
    assert len(s) == len(r)+n+l
    return r

def channels_for_track(track):
    channels = set()
    for msg in track:
        if msg.type == 'note_on':
            channels.add(msg.channel)
    return list(channels)

if len(sys.argv) < 3:
    print mid
    print mid.length, 'seconds'
    for i, track in enumerate(mid.tracks):
        print('Track {}: {} ({}) {}'.format(i, track.name, len(track), channels_for_track(track)))
        #for msg in track:
        #    print(msg)
else:
    if len(sys.argv) > 3:
        transpose = int(sys.argv[3])
    gtime = 0
    curtime = 0
    nnotes = 0
    nvoices = 0
    curchans = 0
    channels = [int(x) for x in string.split(sys.argv[2], ',')]
    print
    print "// %s %s" % (mid, channels)
    output = []
    for msg in mid:
        gtime += msg.time * tempo
        if msg.type == 'note_on' and msg.channel in channels:
            note = msg.note + transpose
            vel = msg.velocity
            t = int(math.ceil(gtime))
            if vel > 0:
                while curtime < t:
                    dt = min(63, t-curtime)
                    curtime += dt
                    if nnotes > 0:
                        nvoices = 0
                        curchans = 0
                        output.append(dt+128)
                if note >= min_note and note <= max_note and nvoices < max_voices:
                    if not (one_voice_per_channel and (curchans & (1<<msg.channel))):
                        n = note - min_note
                        output.append(n)
                        nnotes += 1
                        nvoices += 1
                        curchans |= 1<<msg.channel
    output.append(0xff)
    print string.join([hex2(x) for x in output], ',')
    if compress:
        # replace common substrings
        bout = ''.join(chr(i) for i in output)
        for iter in range(0,32):
          ss = find_common_substrings(bout)
          bss = get_best_substring(ss)
          print bss
          if bss[1] == 0:
              break
          bout = replace_substrings(bout, bss)
          print repr(bout)
        # build substring table
        ofs = (len(g_subs)+1)*2
        zout = offset2str(ofs)
        ofs += len(bout)
        for ss in g_subs:
            ofs += len(ss)
            zout += offset2str(ofs)
        # output strings
        zout += bout
        for ss in g_subs:
            zout += ss
        # print output
        print string.join([hex2(ord(x)) for x in zout], ',')
        print "// compressed %d -> %d bytes" % (len(output), len(zout))
