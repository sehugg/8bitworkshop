"use strict";
// Signal traces that a platform (verilog) exposes to a waveform view.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceMirror = void 0;
exports.readTraceSignal = readTraceSignal;
/**
 * One signal's values from a trace buffer of `nsig` signals' values per clock
 * (`index` is the signal's place in a clock, `start` the first clock). A
 * buffer that `wrap`s goes back to its start at `last`.
 */
function readTraceSignal(buf, nsig, last, wrap, index, start, len) {
    var a = [];
    index += nsig * start;
    while (index < last && a.length < len) {
        a.push(buf[index]);
        index += nsig;
        if (wrap && index >= last) // TODO: what if starts with index==last
            index = 0;
    }
    return a;
}
/** A WaveformProvider over a snapshot; `setValue` sends writes back to the platform. */
class TraceMirror {
    constructor(setValue) {
        this.setValue = setValue;
        this.snapshot = null;
    }
    getSignalMetadata() { return this.snapshot ? this.snapshot.meta : []; }
    getSignalData(index, start, len) {
        var s = this.snapshot;
        if (!s)
            return [];
        return readTraceSignal(s.data, s.meta.length, s.data.length, s.wrap, index, start, len);
    }
    setSignalValue(index, value) { this.setValue(index, value); }
}
exports.TraceMirror = TraceMirror;
//# sourceMappingURL=waveform.js.map