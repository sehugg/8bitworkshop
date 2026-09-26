import assert from "assert";
import { describe, it, afterEach } from "mocha";
import { AUDIO_CHUNK_SAMPLES, AudioStream, SampledAudio, setAudioStreamFactory } from "../../src/common/audio";

// A stand-in for the extension's worker-side stream (see extension/emuworker.ts).
class TestStream implements AudioStream {
  chunks: Float32Array[] = [];
  started = false;
  stopped = false;
  constructor(readonly sampleRate: number) { }
  start() { this.started = true; }
  stop() { this.stopped = true; }
  push(samples: Float32Array) { this.chunks.push(samples); }
}

describe('SampleAudio streaming', function () {
  afterEach(function () {
    setAudioStreamFactory(null);
  });

  it('hands full buffer chunks to the stream at the source rate', function () {
    var stream: TestStream;
    setAudioStreamFactory(() => (stream = new TestStream(48000)));
    const audio = new SampledAudio(48000); // source rate == stream rate, so sinc is 1
    audio.start();
    assert.ok(stream.started);
    for (var i = 0; i < AUDIO_CHUNK_SAMPLES; i++) audio.feedSample(0.5, 1);
    assert.equal(stream.chunks.length, 1);
    assert.equal(stream.chunks[0].length, AUDIO_CHUNK_SAMPLES);
    assert.equal(stream.chunks[0][0], 0.5);
    audio.stop();
    assert.ok(stream.stopped);
  });

  it('resamples a lower source rate up to the stream rate', function () {
    var stream: TestStream;
    setAudioStreamFactory(() => (stream = new TestStream(48000)));
    const audio = new SampledAudio(24000); // sinc = 48000 / 24000 = 2
    audio.start();
    for (var i = 0; i < 24000; i++) audio.feedSample(0.25, 1);
    // 24000 source samples * 2 = 48000 output samples; the final partial
    // buffer stays in SampleAudio until another chunk fills it
    var full = Math.floor(48000 / AUDIO_CHUNK_SAMPLES) * AUDIO_CHUNK_SAMPLES;
    var total = stream.chunks.reduce((n, c) => n + c.length, 0);
    assert.equal(total, full);
  });

  it('reports its output rate once started', function () {
    setAudioStreamFactory(() => new TestStream(44100));
    const audio = new SampledAudio(15720);
    audio.start();
    assert.equal(audio.sampleRate, 44100);
  });

  it('start is idempotent, so resume does not recreate the stream', function () {
    var count = 0;
    var stream: TestStream;
    setAudioStreamFactory(() => { count++; return (stream = new TestStream(48000)); });
    const audio = new SampledAudio(48000);
    audio.start();
    audio.start();
    assert.equal(count, 1);
    assert.ok(stream.started);
  });
});
