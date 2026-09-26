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
//# sourceMappingURL=testaudio.js.map