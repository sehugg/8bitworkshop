
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { Rpc } from '../src/rpc';
import { findRootDir } from '../src/projectinfo';
import { Builder, ProjectFileProvider } from '../src/buildcore';
import type { AudioChunk, EmuStatus, FrameEvent } from '../src/emuworker';
import { WorkerDebugBackend } from '../src/debugbackend';
import { EmuDebugSession } from '../../src/tools/dapsession';
import { DapClient } from '../../test/unit/dapclient';

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

  // $readmem reads project files at load time, so they travel with the ROM
  describe('verilog $readmem', function () {
    const MAIN = [
      'module top(clk, reset, hsync, vsync, rgb);',
      '  input clk, reset;',
      '  output hsync, vsync;',
      '  output [3:0] rgb;',
      '  reg [7:0] rom[0:3];',
      '  initial $readmemh("rom_data.hex", rom);',
      '  assign hsync = 0;',
      '  assign vsync = 0;',
      '  assign rgb = rom[1][3:0];',
      'endmodule',
      '',
    ].join('\n');
    var built: Awaited<ReturnType<Builder['build']>>;

    before(async function () {
      var enc = new TextEncoder();
      var files: { [path: string]: string } = { 'main.v': MAIN, 'rom_data.hex': '00\n0f\n00\n00\n' };
      var read = async (rel: string) => rel in files ? enc.encode(files[rel]) : null;
      built = await new Builder(ROOT).build({
        platform: 'verilog', mainPath: 'main.v', mainText: MAIN,
        files: new ProjectFileProvider(read, ROOT, 'verilog'),
      });
      assert.deepEqual(built.diagnostics, []);
    });

    it('builds with the data file attached', function () {
      assert.equal(built.files['rom_data.hex'], '00\n0f\n00\n00\n');
    });

    it('runs with the data file', async function () {
      var s = await rpc.call<EmuStatus>('start', 'verilog', built.output, built.files);
      assert.equal(s.state, 'running');
      await waitForFrames(3);
      assert.ok(!statuses.some(s => s && s.state === 'halted'), JSON.stringify(statuses));
    });

    it('reports a missing data file without killing the worker', async function () {
      var exited = false;
      worker.on('exit', () => { exited = true; });
      await assert.rejects(rpc.call('start', 'verilog', built.output, {}), /no file "rom_data.hex"/);
      await new Promise(r => setTimeout(r, 200));
      assert.ok(!exited, 'worker exited');
      await rpc.call('status');
    });
  });

  describe('debugging', function () {
    var built: Awaited<ReturnType<Builder['build']>>;
    var stops: any[];

    before(async function () {
      var mainText = fs.readFileSync(path.join(ROOT, 'presets/mw8080bw/game2.c'), 'utf-8');
      var read = async (rel: string) => rel === 'game2.c' ? new TextEncoder().encode(mainText) : null;
      built = await new Builder(ROOT).build({
        platform: 'mw8080bw', mainPath: 'game2.c', mainText,
        files: new ProjectFileProvider(read, ROOT, 'mw8080bw'),
      });
      assert.deepEqual(built.diagnostics, []);
    });

    beforeEach(function () {
      stops = [];
      rpc.on('stopped', e => stops.push(e));
    });

    /** The next stop not yet seen; it may have come before the call's reply. */
    async function nextStop() {
      for (var i = 0; i < 300 && !stops.length; i++) await new Promise(r => setTimeout(r, 20));
      assert.ok(stops.length, 'never stopped');
      return stops.shift();
    }

    const debug = (method: string, ...args: any[]) => rpc.call('debug', method, ...args);

    it('starts stopped, then stops at a source breakpoint, steps, and steps back', async function () {
      var s = await rpc.call<EmuStatus>('start', 'mw8080bw', built.output, built.files, { paused: true });
      assert.equal(s.state, 'paused');
      await debug('setBuild', { listings: built.listings, symbols: built.symbolmap, mainPath: 'game2.c', paths: built.paths });
      var [bp] = await debug('setBreakpoints', [{ id: 1, type: 'source', file: 'game2.c', line: 166, enabled: true }]);
      assert.ok(bp.verified, bp.message);
      await debug('continue');
      assert.equal((await nextStop()).reason, 'breakpoint');
      assert.equal((await debug('location')).source.line, 166);
      await debug('step', 'over', 'line');
      assert.equal((await nextStop()).reason, 'step');
      assert.equal((await debug('location')).source.line, 167);
      await debug('stepBack', 'line');
      assert.equal((await nextStop()).reason, 'step');
      assert.equal((await debug('location')).source.line, 166);
      assert.equal(statuses[statuses.length - 1].state, 'paused');
    });

    it('steps through C source on the NES, which has no Machine of its own', async function () {
      // jsnes stops between instructions through the trap its frame() takes
      var dir = path.join(ROOT, 'presets/nes');
      var mainText = fs.readFileSync(path.join(dir, 'hello.c'), 'utf-8');
      var read = async (rel: string) => {
        var p = path.join(dir, rel);
        return fs.existsSync(p) ? new Uint8Array(fs.readFileSync(p)) : null;
      };
      var nes = await new Builder(ROOT).build({
        platform: 'nes', mainPath: 'hello.c', mainText,
        files: new ProjectFileProvider(read, ROOT, 'nes'),
      });
      assert.deepEqual(nes.diagnostics, []);
      await rpc.call('start', 'nes', nes.output, nes.files, { paused: true });
      await debug('setBuild', { listings: nes.listings, symbols: nes.symbolmap, mainPath: 'hello.c', paths: nes.paths });
      var [bp] = await debug('setBreakpoints', [{ id: 1, type: 'source', file: 'hello.c', line: 19, enabled: true }]);
      assert.ok(bp.verified, bp.message);
      await debug('continue');
      assert.equal((await nextStop()).reason, 'breakpoint');
      assert.equal((await debug('location')).source.line, 19);
      await debug('step', 'over', 'line');
      assert.equal((await nextStop()).reason, 'step');
      assert.equal((await debug('location')).source.line, 20);
      await debug('stepBack', 'line');
      assert.equal((await nextStop()).reason, 'step');
      assert.equal((await debug('location')).source.line, 19);
      await debug('setBreakpoints', []);
    });

    it('drives the debug adapter through the worker, as the extension does', async function () {
      var backend = new WorkerDebugBackend((method, ...args) => rpc.call('debug', method, ...args), async () => {
        await rpc.call('start', 'mw8080bw', built.output, built.files, { paused: true });
        await rpc.call('debug', 'setBuild', { listings: built.listings, symbols: built.symbolmap, mainPath: 'game2.c', paths: built.paths });
        return { root: '/proj' };
      }, async () => { });
      rpc.on('stopped', e => backend.handleStop(e));
      var c = new DapClient(new EmuDebugSession(backend));
      await c.request('initialize', { adapterID: '8bitworkshop', pathFormat: 'path', linesStartAt1: true, columnsStartAt1: true });
      await c.request('launch', { mainFile: 'game2.c' });
      await c.event('initialized');
      var { breakpoints } = await c.request('setBreakpoints', { source: { path: '/proj/game2.c' }, breakpoints: [{ line: 166 }] });
      assert.ok(breakpoints[0].verified);
      await c.request('configurationDone');
      assert.equal((await c.event('stopped')).reason, 'breakpoint');
      var frame = await c.where();
      assert.equal(frame.source.path, '/proj/game2.c');
      assert.equal(frame.line, 166);
      await c.request('next', { threadId: 1 });
      await c.event('stopped');
      assert.equal((await c.where()).line, 167);
      await c.request('stepBack', { threadId: 1 });
      await c.event('stopped');
      assert.equal((await c.where()).line, 166);
      assert.match((await c.request('evaluate', { expression: 'now', context: 'repl' })).result, /past/);
    });

    it('pauses with a stop, and seeks to a recorded frame', async function () {
      await rpc.call('start', 'mw8080bw', built.output, built.files);
      await waitForFrames(10);
      await rpc.call('pause');
      assert.equal((await nextStop()).reason, 'pause');
      var s = await rpc.call<EmuStatus>('seekFrame', 3);
      assert.equal((await nextStop()).reason, 'goto');
      assert.equal(s.timeline.now.frame, 3);
      assert.ok(s.timeline.past);
      assert.ok(s.timeline.last >= 10);
    });
  });
});
