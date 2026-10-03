import assert from "assert";
import { describe, it } from "mocha";
import { readTraceSignal, TraceMirror } from "../../src/common/waveform";

// three signals, four clocks: a=0..3, b=10..13, c=20..23
const DATA = Uint32Array.from([0,10,20, 1,11,21, 2,12,22, 3,13,23]);

describe('Waveform trace', function () {
  it('reads one signal from an interleaved buffer', function () {
    assert.deepEqual(readTraceSignal(DATA, 3, DATA.length, false, 1, 0, 10), [10, 11, 12, 13]);
    assert.deepEqual(readTraceSignal(DATA, 3, DATA.length, false, 2, 1, 2), [21, 22]);
    assert.deepEqual(readTraceSignal(DATA, 3, DATA.length, false, 0, 4, 2), []);
  });

  it('wraps to the start of the buffer when asked', function () {
    assert.deepEqual(readTraceSignal(DATA, 3, DATA.length, true, 0, 2, 5), [2, 3, 0, 1, 2]);
  });

  it('mirrors a snapshot and sends writes back', function () {
    const writes: number[][] = [];
    const m = new TraceMirror((i, v) => writes.push([i, v]));
    assert.deepEqual(m.getSignalMetadata(), []);
    assert.deepEqual(m.getSignalData(0, 0, 4), []);
    const meta = ['a', 'b', 'c'].map(label => ({ label, len: 8, input: false, output: true }));
    m.snapshot = { meta, data: DATA, wrap: false, now: 3 };
    assert.equal(m.getSignalMetadata().length, 3);
    assert.deepEqual(m.getSignalData(2, 0, 3), [20, 21, 22]);
    m.setSignalValue(1, 99);
    assert.deepEqual(writes, [[1, 99]]);
  });
});
