"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const audio_1 = require("../../src/common/audio");
// A stand-in for the extension's worker-side stream (see extension/emuworker.ts).
class TestStream {
    constructor(sampleRate) {
        this.sampleRate = sampleRate;
        this.chunks = [];
        this.started = false;
        this.stopped = false;
    }
    start() { this.started = true; }
    stop() { this.stopped = true; }
    push(samples) { this.chunks.push(samples); }
}
(0, mocha_1.describe)('SampleAudio streaming', function () {
    (0, mocha_1.afterEach)(function () {
        (0, audio_1.setAudioStreamFactory)(null);
    });
    (0, mocha_1.it)('hands full buffer chunks to the stream at the source rate', function () {
        var stream;
        (0, audio_1.setAudioStreamFactory)(() => (stream = new TestStream(48000)));
        const audio = new audio_1.SampledAudio(48000); // source rate == stream rate, so sinc is 1
        audio.start();
        assert_1.default.ok(stream.started);
        for (var i = 0; i < audio_1.AUDIO_CHUNK_SAMPLES; i++)
            audio.feedSample(0.5, 1);
        assert_1.default.equal(stream.chunks.length, 1);
        assert_1.default.equal(stream.chunks[0].length, audio_1.AUDIO_CHUNK_SAMPLES);
        assert_1.default.equal(stream.chunks[0][0], 0.5);
        audio.stop();
        assert_1.default.ok(stream.stopped);
    });
    (0, mocha_1.it)('resamples a lower source rate up to the stream rate', function () {
        var stream;
        (0, audio_1.setAudioStreamFactory)(() => (stream = new TestStream(48000)));
        const audio = new audio_1.SampledAudio(24000); // sinc = 48000 / 24000 = 2
        audio.start();
        for (var i = 0; i < 24000; i++)
            audio.feedSample(0.25, 1);
        // 24000 source samples * 2 = 48000 output samples; the final partial
        // buffer stays in SampleAudio until another chunk fills it
        var full = Math.floor(48000 / audio_1.AUDIO_CHUNK_SAMPLES) * audio_1.AUDIO_CHUNK_SAMPLES;
        var total = stream.chunks.reduce((n, c) => n + c.length, 0);
        assert_1.default.equal(total, full);
    });
    (0, mocha_1.it)('reports its output rate once started', function () {
        (0, audio_1.setAudioStreamFactory)(() => new TestStream(44100));
        const audio = new audio_1.SampledAudio(15720);
        audio.start();
        assert_1.default.equal(audio.sampleRate, 44100);
    });
    (0, mocha_1.it)('start is idempotent, so resume does not recreate the stream', function () {
        var count = 0;
        var stream;
        (0, audio_1.setAudioStreamFactory)(() => { count++; return (stream = new TestStream(48000)); });
        const audio = new audio_1.SampledAudio(48000);
        audio.start();
        audio.start();
        assert_1.default.equal(count, 1);
        assert_1.default.ok(stream.started);
    });
});
// A minimal Web Audio graph so the ScriptProcessor ring path (the only place
// getStats has data) can run under Node.
class FakeNode {
    constructor() {
        this.type = '';
        this.frequency = { value: 0 };
        this.gain = { value: 0 };
    }
    connect() { return this; }
}
class FakeScriptProcessorNode extends FakeNode {
}
class FakeAudioContext {
    constructor() {
        this.sampleRate = 44100;
        this.state = 'running';
        this.destination = new FakeNode();
        this.scriptProcessor = new FakeScriptProcessorNode();
        FakeAudioContext.last = this;
    }
    createBiquadFilter() { return new FakeNode(); }
    createDynamicsCompressor() { return new FakeNode(); }
    createScriptProcessor(_len, _in, _out) { return this.scriptProcessor; }
    resume() { }
    suspend() { }
    close() { }
}
const RING_BUFFER_SAMPLES = 2048;
function withFakeAudio(fn) {
    const prev = global.window;
    global.window = { AudioContext: FakeAudioContext };
    try {
        return fn();
    }
    finally {
        global.window = prev;
    }
}
function feedBuffers(audio, buffers, value = 0.25) {
    for (let i = 0; i < buffers * RING_BUFFER_SAMPLES; i++)
        audio.feedSample(value, 1);
}
function pullBlock(length = RING_BUFFER_SAMPLES) {
    const out = new Float32Array(length);
    const node = FakeAudioContext.last.scriptProcessor;
    node.onaudioprocess.call(node, { outputBuffer: { getChannelData: () => out }, srcElement: node });
    return out;
}
(0, mocha_1.describe)('SampleAudio ring depth', function () {
    (0, mocha_1.afterEach)(function () {
        (0, audio_1.setAudioStreamFactory)(null);
    });
    (0, mocha_1.it)('fills to the full ring by default (behavior unchanged)', function () {
        withFakeAudio(() => {
            const audio = new audio_1.SampledAudio(44100);
            audio.start();
            const stats = audio.getStats();
            assert_1.default.equal(stats.maxBuffers, 8);
            assert_1.default.equal(stats.targetDepth, 8);
            assert_1.default.equal(stats.sampleRate, 44100);
        });
    });
    (0, mocha_1.it)('drops the oldest buffer when the producer laps the consumer', function () {
        withFakeAudio(() => {
            const audio = new audio_1.SampledAudio(44100);
            audio.start();
            feedBuffers(audio, 8); // no consumer yet, so the 8th commit trips depth 8
            assert_1.default.equal(audio.getStats().skippedBuffers, 1);
        });
    });
    (0, mocha_1.it)('serves committed buffers in order and records the fill', function () {
        withFakeAudio(() => {
            const audio = new audio_1.SampledAudio(44100);
            audio.start();
            audio.setStatsEnabled(true);
            feedBuffers(audio, 2);
            var out = pullBlock();
            assert_1.default.equal(out[0], 0.25);
            var stats = audio.getStats();
            assert_1.default.equal(stats.samples, 1);
            assert_1.default.equal(stats.underruns, 0);
            assert_1.default.equal(stats.fillHistogram[2], 1); // two buffers outstanding when pulled
            assert_1.default.equal(stats.meanFill, 2);
            // draining past the producer is an underrun, not stale audio
            pullBlock();
            pullBlock();
            assert_1.default.equal(audio.getStats().underruns, 1);
        });
    });
    (0, mocha_1.it)('turns the resample ratio up when the ring runs dry', async function () {
        await withFakeAudio(async () => {
            const audio = new audio_1.SampledAudio(44100);
            audio.start();
            feedBuffers(audio, 1);
            for (let i = 0; i < 20; i++)
                pullBlock(); // drains, so fillAvg ends up below target
            await new Promise((r) => setTimeout(r, 520));
            feedBuffers(audio, 1); // first commit after the interval triggers an adjustment
            const stats = audio.getStats();
            assert_1.default.ok(stats.fillAvg < 1.5, 'expected a dry ring, got fillAvg=' + stats.fillAvg);
            assert_1.default.ok(stats.trim > 1, 'expected trim > 1, got ' + stats.trim);
        });
    });
    (0, mocha_1.it)('turns the resample ratio down when the ring is too full', async function () {
        await withFakeAudio(async () => {
            const audio = new audio_1.SampledAudio(44100);
            audio.start();
            feedBuffers(audio, 3);
            pullBlock();
            for (let i = 0; i < 20; i++) {
                feedBuffers(audio, 1);
                pullBlock();
            } // holds fill at 3
            await new Promise((r) => setTimeout(r, 520));
            feedBuffers(audio, 1);
            const stats = audio.getStats();
            assert_1.default.ok(stats.fillAvg > 1.5, 'expected a full ring, got fillAvg=' + stats.fillAvg);
            assert_1.default.ok(stats.trim < 1, 'expected trim < 1, got ' + stats.trim);
        });
    });
});
//# sourceMappingURL=testaudio.js.map