"use strict";

var BEST={}

var MAXBITS=17
//MAXBITS=12

for (var n=1; n<MAXBITS; n++) {
    var mask = (1<<n)-1;
    var hibit = (1<<(n-1));
    for (var i=0; i < (1<<n); i++) {
        for (var invert=0; invert<2; invert++) {
            var x = 1;
            var seq = [];
            var seen = new Map();
            while (x && !seen.get(x)) {
                seq.push(x);
                seen.set(x, true);
                var feedback = (x & hibit) != 0;
                x = ((x << 1) & mask);
                if (invert && !feedback) x ^= i;
                if (!invert && feedback) x ^= i;
            }
            if (x) {
                var seqindex = seq.indexOf(x);
                var seqlen = seq.length - seqindex;
                if (seqlen > 1 && x == 1) {
                    if (!BEST[seqlen] || n < BEST[seqlen].n) {
                        BEST[seqlen] = {n:n, i:i, invert:invert};
                        //console.log(seqlen + "\t" + n + "\t" + i.toString(2) + "\t" + x.toString(2));
                    }
                }
            }
        }
    }
}

for (var seqlen in BEST) {
    var b = BEST[seqlen];
    console.log(seqlen+" &\t@"+b.n+"'b"+b.i.toString(2)+","+b.invert+"@ \\\\");
}

