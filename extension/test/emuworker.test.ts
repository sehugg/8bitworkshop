
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { Rpc } from '../src/rpc';
import { findRootDir } from '../src/projectinfo';
import type { AudioChunk, EmuStatus, FrameEvent } from '../src/emuworker';

// Drives out/emuworker.js in a worker thread, the way the extension host does.
// Mocha runs from extension/, so BIOS fetches must resolve against ROOT.
const ROOT = findRootDir(__dirname);

function rom(rel: string) {
  return new Uint8Array(fs.readFileSync(path.join(ROOT, 'test/roms', rel)));
}

describe('extension emuworker', function () {
  this.timeout(60000);
  var worker: Worker;
  var rpc: Rpc;
  var frames: FrameEvent[];
  var statuses: EmuStatus[];
  var audios: AudioChunk[];

  beforeEach(function () {
    worker = new Worker(path.join(__dirname, '..', 'emuworker.js'), { workerData: { rootDir: ROOT } });
    rpc = new Rpc(worker);
    frames = [];
    statuses = [];
    audios = [];
    rpc.on('frame', f => frames.push(f));
    rpc.on('status', s => statuses.push(s));
    rpc.on('audio', c => audios.push(c));
  });

  afterEach(async function () {
    await worker.terminate();
  });

  async function waitForFrames(n: number) {
    var start = frames.length;
    for (var i = 0; i < 200 && frames.length - start < n; i++) await new Promise(r => setTimeout(r, 20));
    assert.ok(frames.length - start >= n, `only ${frames.length - start} frames`);
  }

  async function waitForAudio(n: number) {
    var start = audios.length;
    for (var i = 0; i < 200 && audios.length - start < n; i++) await new Promise(r => setTimeout(r, 20));
    assert.ok(audios.length - start >= n, `only ${audios.length - start} audio chunks`);
  }

  it('streams NES frames at the screen size', async function () {
    var s = await rpc.call<EmuStatus>('start', 'nes', rom('nes/shoot2.c.rom'));
    assert.equal(s.state, 'running');
    await waitForFrames(30);
    var f = frames[frames.length - 1];
    assert.equal(f.width, 256);
    assert.equal(f.height, 224);
    var px = new Uint32Array(f.pixels);
    assert.equal(px.length, 256 * 224);
    assert.ok(px.some(p => p !== px[0]), 'screen is blank');
  });

  it('pauses, resumes, resets, and takes keys', async function () {
    await rpc.call('start', 'nes', rom('nes/shoot2.c.rom'));
    await waitForFrames(5);
    var s = await rpc.call<EmuStatus>('pause');
    assert.equal(s.state, 'paused');
    var n = frames.length;
    await new Promise(r => setTimeout(r, 100));
    assert.equal(frames.length, n);
    await rpc.call('key', 32, 32, 1);  // space down
    await rpc.call('key', 32, 32, 64); // space up
    s = await rpc.call<EmuStatus>('resume');
    assert.equal(s.state, 'running');
    await waitForFrames(5);
    await rpc.call('reset');
    await waitForFrames(5);
  });

  it('stops while hidden without changing its paused state', async function () {
    await rpc.call('start', 'nes', rom('nes/shoot2.c.rom'));
    await waitForFrames(5);
    await rpc.call('setVisible', false);
    var n = frames.length;
    await new Promise(r => setTimeout(r, 100));
    assert.equal(frames.length, n);
    assert.equal((await rpc.call<EmuStatus>('status')).state, 'running');
    await rpc.call('setVisible', true);
    await waitForFrames(5);
    // a pause while hidden stays paused when shown
    await rpc.call('setVisible', false);
    await rpc.call('pause');
    await rpc.call('setVisible', true);
    n = frames.length;
    await new Promise(r => setTimeout(r, 100));
    assert.equal(frames.length, n);
  });

  // Platforms keep global state (Javatari deletes its own start()), so a
  // worker runs one emulator; the extension starts a new worker for each run.
  it('runs the VCS once per worker, and says so on a second start', async function () {
    var s = await rpc.call<EmuStatus>('start', 'vcs', rom('vcs/brickgame.rom'));
    assert.equal(s.state, 'running');
    await waitForFrames(5);
    await assert.rejects(rpc.call('start', 'vcs', rom('vcs/brickgame.rom')), /new worker/);
  });

  it('loads a BIOS from the asset root', async function () {
    await rpc.call('start', 'atari8-5200', rom('atari8-5200/hello.a.rom'));
    await waitForFrames(10);
    assert.ok(!statuses.some(s => s && s.state === 'halted'), JSON.stringify(statuses));
  });

  it('streams audio chunks at the resampled rate', async function () {
    var s = await rpc.call<EmuStatus>('start', 'nes', rom('nes/shoot2.c.rom'));
    assert.ok(s.audio, 'status reports an audio rate');
    assert.equal(s.audio.sampleRate, 48000);
    await waitForAudio(2);
    var c = audios[audios.length - 1];
    assert.equal(c.sampleRate, 48000);
    assert.equal(new Float32Array(c.samples).length, 2048);
  });

  it('stops sending audio while muted', async function () {
    await rpc.call('start', 'nes', rom('nes/shoot2.c.rom'));
    await waitForAudio(1);
    await rpc.call('setMuted', true);
    var n = audios.length;
    await new Promise(r => setTimeout(r, 200));
    assert.equal(audios.length, n);
    await rpc.call('setMuted', false);
    await waitForAudio(1);
  });
});
