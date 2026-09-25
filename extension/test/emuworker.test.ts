
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { Rpc } from '../src/rpc';
import { findRootDir } from '../src/projectinfo';
import type { EmuStatus, FrameEvent } from '../src/emuworker';

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

  beforeEach(function () {
    worker = new Worker(path.join(__dirname, '..', 'emuworker.js'), { workerData: { rootDir: ROOT } });
    rpc = new Rpc(worker);
    frames = [];
    statuses = [];
    rpc.on('frame', f => frames.push(f));
    rpc.on('status', s => statuses.push(s));
  });

  afterEach(async function () {
    await worker.terminate();
  });

  async function waitForFrames(n: number) {
    var start = frames.length;
    for (var i = 0; i < 200 && frames.length - start < n; i++) await new Promise(r => setTimeout(r, 20));
    assert.ok(frames.length - start >= n, `only ${frames.length - start} frames`);
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

  it('loads a BIOS from the asset root', async function () {
    await rpc.call('start', 'atari8-5200', rom('atari8-5200/hello.a.rom'));
    await waitForFrames(10);
    assert.ok(!statuses.some(s => s && s.state === 'halted'), JSON.stringify(statuses));
  });
});
