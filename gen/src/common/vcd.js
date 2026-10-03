"use strict";
// Writes signal traces as a VCD (value change dump) file, as a stream: it
// keeps only each signal's last value and writes a line when one changes, so
// memory use doesn't depend on how long the recording is.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VCDWriter = void 0;
exports.vcdId = vcdId;
// flush to `write` once this many characters are waiting
const CHUNK_CHARS = 1 << 16;
/** The nth identifier code: printable ASCII from `!` to `~`, base 94. */
function vcdId(n) {
    let s = '';
    do {
        s = String.fromCharCode(33 + n % 94) + s;
        n = Math.floor(n / 94) - 1;
    } while (n >= 0);
    return s;
}
/** A signal's value as VCD text: `1` for a bit, `b101` for a vector (no leading zeros). */
function formatValue(v, len, id) {
    if (len === 1)
        return (v ? '1' : '0') + id;
    return 'b' + v.toString(2) + ' ' + id;
}
/** The value as an unsigned number (a bigint past 32 bits), cut to `len` bits. */
function normalize(v, len) {
    if (typeof v === 'bigint')
        return BigInt.asUintN(len, v);
    if (typeof v !== 'number')
        return 0;
    if (len <= 32)
        return len === 32 ? v >>> 0 : (v & ((1 << len) - 1)) >>> 0;
    return BigInt.asUintN(len, BigInt(Math.trunc(v)));
}
class VCDWriter {
    constructor(signals, write, opts = {}) {
        this.signals = signals;
        this.write = write;
        this.buf = [];
        this.bufChars = 0;
        /** samples taken so far; the next one is at this time */
        this.samples = 0;
        this.ids = signals.map((_, i) => vcdId(i));
        this.last = signals.map(() => undefined);
        this.header(opts);
    }
    /** Record the signals' values at the next time step; only changes are written. */
    sample(state) {
        const { signals, ids, last } = this;
        let stamped = false;
        for (let i = 0; i < signals.length; i++) {
            const s = signals[i];
            const v = normalize(state[s.name], s.len);
            if (v === last[i])
                continue;
            if (!stamped) {
                // the first sample opens $dumpvars, which gives every signal a value
                this.put(this.samples === 0 ? '#0\n$dumpvars\n' : '#' + this.samples + '\n');
                stamped = true;
            }
            last[i] = v;
            this.put(formatValue(v, s.len, ids[i]) + '\n');
        }
        if (this.samples === 0)
            this.put('$end\n');
        this.samples++;
    }
    /** Write what's left, with a final time stamp so viewers show the whole recording. */
    finish() {
        if (this.samples > 0)
            this.put('#' + this.samples + '\n');
        this.flush();
    }
    header(opts) {
        const out = ['$version 8bitworkshop $end\n', `$timescale ${opts.timescale || '1 ns'} $end\n`];
        // nest the signals in scopes named by the `$`-separated parts of their names
        let open = [];
        out.push(`$scope module ${opts.top || 'top'} $end\n`);
        this.signals.forEach((s, i) => {
            const parts = s.name.split('$');
            const leaf = parts.pop() || s.name;
            // a design's own name (the first part) is the top scope already
            const path = parts.slice(1);
            let common = 0;
            while (common < open.length && common < path.length && open[common] === path[common])
                common++;
            for (let j = open.length; j > common; j--)
                out.push('$upscope $end\n');
            for (let j = common; j < path.length; j++)
                out.push(`$scope module ${path[j]} $end\n`);
            open = path;
            const range = s.len > 1 ? ` [${s.len - 1}:0]` : '';
            out.push(`$var wire ${s.len} ${this.ids[i]} ${leaf}${range} $end\n`);
        });
        for (let j = open.length; j > 0; j--)
            out.push('$upscope $end\n');
        out.push('$upscope $end\n', '$enddefinitions $end\n');
        this.put(out.join(''));
    }
    put(s) {
        this.buf.push(s);
        this.bufChars += s.length;
        if (this.bufChars >= CHUNK_CHARS)
            this.flush();
    }
    flush() {
        if (this.buf.length)
            this.write(this.buf.join(''));
        this.buf = [];
        this.bufChars = 0;
    }
}
exports.VCDWriter = VCDWriter;
//# sourceMappingURL=vcd.js.map