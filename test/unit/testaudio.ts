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

// A minimal Web Audio graph so the ScriptProcessor ring path (the only place
// getStats has data) can run under Node.
class FakeNode {
  type = '';
  frequency = { value: 0 };
  gain = { value: 0 };
  connect() { return this; }
}
class FakeScriptProcessorNode extends FakeNode {
  onaudioprocess: any;
  module: any;
}
class FakeAudioContext {
  static last: FakeAudioContext;
  sampleRate = 44100;
  state = 'running';
  destination = new FakeNode();
  scriptProcessor = new FakeScriptProcessorNode();
  constructor() { FakeAudioContext.last = this; }
  createBiquadFilter() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createScriptProcessor(_len: number, _in: number, _out: number) { return this.scriptProcessor; }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  close() { }
}

// A context that starts suspended, the way the browser hands one back when it is
// created before the first user gesture.
class SuspendedAudioContext extends FakeAudioContext {
  state = 'suspended';
  resumes = 0;
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
}

const RING_BUFFER_SAMPLES = 2048;

function withFakeAudio(fn: () => void | Promise<void>) {
  const prev = (global as any).window;
  (global as any).window = { AudioContext: FakeAudioContext };
  try {
    return fn();
  } finally {
    (global as any).window = prev;
  }
}

function feedBuffers(audio: SampledAudio, buffers: number, value = 0.25) {
  for (let i = 0; i < buffers * RING_BUFFER_SAMPLES; i++) audio.feedSample(value, 1);
}

function pullBlock(length = RING_BUFFER_SAMPLES): Float32Array {
  const out = new Float32Array(length);
  const node = FakeAudioContext.last.scriptProcessor;
  node.onaudioprocess.call(node, { outputBuffer: { getChannelData: () => out }, srcElement: node });
  return out;
}

describe('SampleAudio autoplay unlock', function () {
  afterEach(function () {
    setAudioStreamFactory(null);
  });

  it('resumes a context that was created suspended', async function () {
    const prev = (global as any).window;
    (global as any).window = { AudioContext: SuspendedAudioContext };
    try {
      const audio = new SampledAudio(44100);
      audio.start();
      const ctx = FakeAudioContext.last as SuspendedAudioContext;
      // the suspend()/resume() cycle is async so it can't race
      await new Promise((r) => setTimeout(r, 0));
      assert.equal(ctx.resumes, 1);
      assert.equal(ctx.state, 'running');
      // a later start (e.g. platform.resume()) must not recreate the graph
      audio.start();
      assert.equal(ctx.resumes, 1);
    } finally {
      (global as any).window = prev;
    }
  });
});

describe('SampleAudio ring depth', function () {
  afterEach(function () {
    setAudioStreamFactory(null);
  });

  it('fills to the full ring by default (behavior unchanged)', function () {
    withFakeAudio(() => {
      const audio = new SampledAudio(44100);
      audio.start();
      const stats = audio.getStats();
      assert.equal(stats.maxBuffers, 8);
      assert.equal(stats.targetDepth, 8);
      assert.equal(stats.sampleRate, 44100);
    });
  });

  it('drops the oldest buffer when the producer laps the consumer', function () {
    withFakeAudio(() => {
      const audio = new SampledAudio(44100);
      audio.start();
      feedBuffers(audio, 8); // no consumer yet, so the 8th commit trips depth 8
      assert.equal(audio.getStats().skippedBuffers, 1);
    });
  });

  it('serves committed buffers in order and records the fill', function () {
    withFakeAudio(() => {
      const audio = new SampledAudio(44100);
      audio.start();
      audio.setStatsEnabled(true);
      feedBuffers(audio, 2);
      var out = pullBlock();
      assert.equal(out[0], 0.25);
      var stats = audio.getStats();
      assert.equal(stats.samples, 1);
      assert.equal(stats.underruns, 0);
      assert.equal(stats.fillHistogram[2], 1); // two buffers outstanding when pulled
      assert.equal(stats.meanFill, 2);
      // draining past the producer is an underrun, not stale audio
      pullBlock();
      pullBlock();
      assert.equal(audio.getStats().underruns, 1);
    });
  });

  it('turns the resample ratio up when the ring runs dry', async function () {
    await withFakeAudio(async () => {
      const audio = new SampledAudio(44100);
      audio.start();
      feedBuffers(audio, 1);
      for (let i = 0; i < 20; i++) pullBlock(); // drains, so fillAvg ends up below target
      await new Promise((r) => setTimeout(r, 520));
      feedBuffers(audio, 1); // first commit after the interval triggers an adjustment
      const stats = audio.getStats();
      assert.ok(stats.fillAvg < 1.5, 'expected a dry ring, got fillAvg=' + stats.fillAvg);
      assert.ok(stats.trim > 1, 'expected trim > 1, got ' + stats.trim);
    });
  });

  it('turns the resample ratio down when the ring is too full', async function () {
    await withFakeAudio(async () => {
      const audio = new SampledAudio(44100);
      audio.start();
      feedBuffers(audio, 3);
      pullBlock();
      for (let i = 0; i < 20; i++) { feedBuffers(audio, 1); pullBlock(); } // holds fill at 3
      await new Promise((r) => setTimeout(r, 520));
      feedBuffers(audio, 1);
      const stats = audio.getStats();
      assert.ok(stats.fillAvg > 1.5, 'expected a full ring, got fillAvg=' + stats.fillAvg);
      assert.ok(stats.trim < 1, 'expected trim < 1, got ' + stats.trim);
    });
  });
});
