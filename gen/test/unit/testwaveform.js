"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const waveform_1 = require("../../src/common/waveform");
// three signals, four clocks: a=0..3, b=10..13, c=20..23
const DATA = Uint32Array.from([0, 10, 20, 1, 11, 21, 2, 12, 22, 3, 13, 23]);
(0, mocha_1.describe)('Waveform trace', function () {
    (0, mocha_1.it)('reads one signal from an interleaved buffer', function () {
        assert_1.default.deepEqual((0, waveform_1.readTraceSignal)(DATA, 3, DATA.length, false, 1, 0, 10), [10, 11, 12, 13]);
        assert_1.default.deepEqual((0, waveform_1.readTraceSignal)(DATA, 3, DATA.length, false, 2, 1, 2), [21, 22]);
        assert_1.default.deepEqual((0, waveform_1.readTraceSignal)(DATA, 3, DATA.length, false, 0, 4, 2), []);
    });
    (0, mocha_1.it)('wraps to the start of the buffer when asked', function () {
        assert_1.default.deepEqual((0, waveform_1.readTraceSignal)(DATA, 3, DATA.length, true, 0, 2, 5), [2, 3, 0, 1, 2]);
    });
    (0, mocha_1.it)('mirrors a snapshot and sends writes back', function () {
        const writes = [];
        const m = new waveform_1.TraceMirror((i, v) => writes.push([i, v]));
        assert_1.default.deepEqual(m.getSignalMetadata(), []);
        assert_1.default.deepEqual(m.getSignalData(0, 0, 4), []);
        const meta = ['a', 'b', 'c'].map(label => ({ label, len: 8, input: false, output: true }));
        m.snapshot = { meta, data: DATA, wrap: false, now: 3 };
        assert_1.default.equal(m.getSignalMetadata().length, 3);
        assert_1.default.deepEqual(m.getSignalData(2, 0, 3), [20, 21, 22]);
        m.setSignalValue(1, 99);
        assert_1.default.deepEqual(writes, [[1, 99]]);
    });
});
//# sourceMappingURL=testwaveform.js.map