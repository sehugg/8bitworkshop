
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { Rpc } from '../src/rpc';
import { findRootDir } from '../src/projectinfo';
import { Builder, ProjectFileProvider } from '../src/buildcore';
import type { AudioChunk, EmuStatus, FrameEvent, ScriptResult, VcdEvent, ViewEvent } from '../src/emuworker';
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
  var viewEvents: ViewEvent[];
  var vcdEvents: VcdEvent[];
  var reveals: string[];

  beforeEach(function () {
    worker = new Worker(path.join(__dirname, '..', 'emuworker.js'), { workerData: { rootDir: ROOT } });
    rpc = new Rpc(worker);
    frames = [];
    statuses = [];
    audios = [];
    viewEvents = [];
    vcdEvents = [];
    reveals = [];
    rpc.on('reveal', (id: string) => reveals.push(id));
    rpc.on('vcd', v => vcdEvents.push(v));
    rpc.on('view', v => viewEvents.push(v));
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

  it('sends the Machine view its debug info only while it is showing', async function () {
    var s = await rpc.call<EmuStatus>('start', 'nes', rom('nes/shoot2.c.rom'));
    assert.ok(s.debugInfo, 'nes has debug info');
    assert.strictEqual(s.screen, true, 'platforms with a screen say so');
    await waitForFrames(10);
    assert.equal(viewEvents.length, 0, 'nothing is sent to a hidden view');
    await rpc.call('setViews', ['machine']);
    await waitForFrames(30);
    assert.ok(viewEvents.length > 0);
    var ev = viewEvents[viewEvents.length - 1];
    assert.equal(ev.id, 'machine');
    assert.ok(ev.sections && ev.sections.length > 0 && ev.sections[0].text.length > 0);
    // a stop sends the state it stopped in, whatever the throttle
    var n = viewEvents.length;
    await rpc.call('pause');
    assert.ok(viewEvents.length > n);
    // hiding it stops the data
    await rpc.call('setViews', []);
    n = viewEvents.length;
    await rpc.call('resume');
    await waitForFrames(30);
    assert.equal(viewEvents.length, n);
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

  // vcs runs on the vcs.jt4 core, which can stop between instructions
  it('runs the VCS on a core that steps and rewinds', async function () {
    var s = await rpc.call<EmuStatus>('start', 'vcs', rom('vcs/brickgame.rom'));
    assert.equal(s.platform, 'vcs.jt4');
    var caps = await rpc.call<any>('debug', 'capabilities');
    assert.ok(caps.step && caps.rewind, JSON.stringify(caps));
    assert.notEqual(caps.granularity, 'frame');
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
  it('runs a script on a paused machine for the language model tools', async function () {
    var dir = path.join(ROOT, 'presets/nes');
    var read = async (rel: string) => {
      var p = path.join(dir, rel);
      return fs.existsSync(p) ? new Uint8Array(fs.readFileSync(p)) : null;
    };
    var nes = await new Builder(ROOT).build({
      // not hello.c: the build store is global, and another test builds that
      platform: 'nes', mainPath: 'attributes.c', mainText: fs.readFileSync(path.join(dir, 'attributes.c'), 'utf-8'),
      files: new ProjectFileProvider(read, ROOT, 'nes'),
    });
    await rpc.call('start', 'nes', nes.output, nes.files, { paused: true });
    var build = { listings: nes.listings, symbolmap: nes.symbolmap, mainPath: 'attributes.c', paths: nes.paths };
    var r = await rpc.call<ScriptResult>('script', 'run 30; mem main 4', build);
    assert.equal(r.error, undefined);
    assert.equal(r.frame, 30);
    assert.match(r.output, /[0-9a-f]{4}/i);
    assert.deepEqual([...r.png.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    // no frames streamed: the script drives the machine, not the pacing loop
    assert.equal(frames.length, 0);
    r = await rpc.call<ScriptResult>('script', 'bogus', build);
    assert.match(r.error, /unknown command 'bogus'/);
  });

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

  describe('verilog waveform view', function () {
    const MAIN = [
      'module top(clk, reset, hsync, vsync, rgb, sw);',
      '  input clk, reset;',
      '  input [3:0] sw;',
      '  output hsync, vsync;',
      '  output [3:0] rgb;',
      '  reg [7:0] n;',
      '  always @(posedge clk) n <= reset ? 0 : n + 1;',
      '  assign hsync = n[7];',
      '  assign vsync = 0;',
      '  assign rgb = n[3:0];',
      'endmodule',
      '',
    ].join('\n');

    it('sends the signal trace only while the view is showing, and takes writes', async function () {
      var read = async (rel: string) => null;
      var built = await new Builder(ROOT).build({
        platform: 'verilog', mainPath: 'main.v', mainText: MAIN,
        files: new ProjectFileProvider(read, ROOT, 'verilog'),
      });
      assert.deepEqual(built.diagnostics, []);
      var s = await rpc.call<EmuStatus>('start', 'verilog', built.output, built.files);
      assert.ok(s.waveform, 'verilog has a waveform');
      await waitForFrames(5);
      assert.equal(viewEvents.length, 0, 'nothing is sent to a hidden view');
      await rpc.call('setViews', ['waveform']);
      await waitForFrames(40); // the view refreshes a few times a second
      var ev = viewEvents.filter(e => e.id === 'waveform').pop();
      assert.ok(ev && ev.waveform, 'no waveform event');
      var w = ev!.waveform!;
      var labels = w.meta.map(m => m.label);
      assert.ok(labels.indexOf('n') >= 0 && labels.indexOf('sw') >= 0, labels.join());
      assert.equal(w.data.length % w.meta.length, 0);
      // the counter counts up one a clock
      var n = labels.indexOf('n');
      var vals = Array.from({ length: 10 }, (_, i) => w.data[(i + 20) * w.meta.length + n]);
      for (var i = 1; i < vals.length; i++) assert.equal(vals[i], (vals[i - 1] + 1) & 255, vals.join());
      // a write to an input shows in the next trace
      var sw = labels.indexOf('sw');
      assert.ok(w.meta[sw].input);
      await rpc.call('setSignal', sw, 5);
      await waitForFrames(40);
      w = viewEvents.filter(e => e.id === 'waveform').pop()!.waveform!;
      assert.equal(w.data[10 * w.meta.length + sw], 5);
    });
  });

  describe('verilog waveform view, while paused and with no video', function () {
    async function build(main: string) {
      var read = async (rel: string) => null;
      var built = await new Builder(ROOT).build({
        platform: 'verilog', mainPath: 'main.v', mainText: main,
        files: new ProjectFileProvider(read, ROOT, 'verilog'),
      });
      assert.deepEqual(built.diagnostics, []);
      return built;
    }
    const COUNTER = [
      'module top(clk, reset, n);',
      '  input clk, reset;',
      '  output reg [7:0] n;',
      '  always @(posedge clk) n <= reset ? 0 : n + 1;',
      'endmodule',
      '',
    ].join('\n');
    const WITH_VIDEO = [
      'module top(clk, reset, hsync, vsync, rgb);',
      '  input clk, reset;',
      '  output hsync, vsync;',
      '  output [3:0] rgb;',
      '  reg [7:0] n;',
      '  always @(posedge clk) n <= reset ? 0 : n + 1;',
      '  assign hsync = n[7];',
      '  assign vsync = 0;',
      '  assign rgb = n[3:0];',
      'endmodule',
      '',
    ].join('\n');

    async function lastWaveform() {
      for (var i = 0; i < 100 && !viewEvents.some(e => e.waveform); i++) await new Promise(r => setTimeout(r, 20));
      return viewEvents.filter(e => e.waveform).pop()!.waveform!;
    }

    it('asks the host to open the view for a design with no video, once', async function () {
      var built = await build(COUNTER);
      var s = await rpc.call<EmuStatus>('start', 'verilog', built.output, built.files);
      assert.strictEqual(s.screen, false, 'only signals, so no emulator screen');
      await waitForFrames(1).catch(() => { }); // no video: there may be no frames
      for (var i = 0; i < 100 && !reveals.length; i++) await new Promise(r => setTimeout(r, 20));
      assert.deepEqual(reveals, ['waveform']);
      // it traces once the view is showing
      await rpc.call('setViews', ['waveform']);
      var w: any;
      for (i = 0; i < 100; i++) {
        await new Promise(r => setTimeout(r, 20));
        w = viewEvents.filter(e => e.waveform).pop()?.waveform;
        if (w && w.data.some((v: number) => v > 3)) break;
      }
      assert.ok(w && w.data.some((v: number) => v > 3), 'no trace');
      assert.deepEqual(reveals, ['waveform'], 'asked once');
    });

    it('keeps the screen for a design with sound or controls but no video', async function () {
      var tone = await build([
        'module top(clk, reset, spkr);',
        '  input clk, reset;',
        '  output spkr;',
        '  reg [15:0] c;',
        '  always @(posedge clk) c <= reset ? 0 : c + 1;',
        '  assign spkr = c[8];',
        'endmodule',
        '',
      ].join('\n'));
      var s = await rpc.call<EmuStatus>('start', 'verilog', tone.output, tone.files);
      assert.strictEqual(s.screen, true, 'sound needs the panel');
      assert.ok(s.audio, 'and it makes sound');
      await waitForAudio(3);
      var keys = await build([
        'module top(clk, reset, switches_p1, led);',
        '  input clk, reset;',
        '  input [7:0] switches_p1;',
        '  output led;',
        '  assign led = switches_p1[0];',
        'endmodule',
        '',
      ].join('\n'));
      await worker.terminate();
      var other = new Worker(path.join(__dirname, '..', 'emuworker.js'), { workerData: { rootDir: ROOT } });
      var rpc2 = new Rpc(other);
      s = await rpc2.call<EmuStatus>('start', 'verilog', keys.output, keys.files);
      assert.strictEqual(s.screen, true, 'controls need the panel');
      await other.terminate();
    });

    it('shows the last frame of a paused design when the view opens', async function () {
      var built = await build(WITH_VIDEO);
      var s = await rpc.call<EmuStatus>('start', 'verilog', built.output, built.files);
      assert.strictEqual(s.screen, true);
      await waitForFrames(10);
      await rpc.call('pause');
      viewEvents.length = 0;
      await rpc.call('setViews', ['waveform']);
      var w = await lastWaveform();
      var n = w.meta.map(m => m.label).indexOf('n');
      assert.ok(Array.from({ length: 50 }, (_, i) => w.data[i * w.meta.length + n]).some(v => v > 0), 'trace is empty');
    });
  });

  describe('verilog VCD recording', function () {
    const MAIN = [
      'module top(clk, reset, hsync, vsync, rgb);',
      '  input clk, reset;',
      '  output hsync, vsync;',
      '  output [3:0] rgb;',
      '  reg [7:0] n;',
      '  always @(posedge clk) n <= reset ? 0 : n + 1;',
      '  assign hsync = n[7];',
      '  assign vsync = 0;',
      '  assign rgb = n[3:0];',
      'endmodule',
      '',
    ].join('\n');
    var built: Awaited<ReturnType<Builder['build']>>;
    var dir: string;

    before(async function () {
      var read = async (rel: string) => null;
      built = await new Builder(ROOT).build({
        platform: 'verilog', mainPath: 'main.v', mainText: MAIN,
        files: new ProjectFileProvider(read, ROOT, 'verilog'),
      });
      assert.deepEqual(built.diagnostics, []);
      dir = fs.mkdtempSync(path.join(os.tmpdir(), '8bws-vcd-'));
    });

    async function waitForVcd(recording: boolean) {
      for (var i = 0; i < 400 && !vcdEvents.some(e => e.recording === recording); i++) await new Promise(r => setTimeout(r, 20));
      var ev = vcdEvents.find(e => e.recording === recording);
      assert.ok(ev, 'no vcd event ' + JSON.stringify(vcdEvents));
      return ev!;
    }

    it('records a number of frames to a file and stops by itself', async function () {
      var s = await rpc.call<EmuStatus>('start', 'verilog', built.output, built.files);
      assert.ok(s.vcd, 'verilog design has signals to record');
      var file = path.join(dir, 'a.vcd');
      await rpc.call('startVcd', file, 2);
      var done = await waitForVcd(false);
      assert.equal(done.file, file);
      assert.ok(done.clocks! > 0 && done.bytes! > 0);
      var text = fs.readFileSync(file, 'utf-8');
      assert.equal(text.length, done.bytes);
      assert.ok(text.startsWith('$version'));
      assert.ok(/\$var wire 8 \S+ n \[7:0\] \$end/.test(text), text.slice(0, 400));
      assert.ok(text.endsWith('#' + done.clocks + '\n'));
      // the counter changes every clock
      assert.ok(text.split('\n').filter(l => /^b\d+ /.test(l)).length > 1000);
    });

    it('stops when asked, and a hidden-length recording keeps going until then', async function () {
      await rpc.call('start', 'verilog', built.output, built.files);
      var file = path.join(dir, 'b.vcd');
      await rpc.call('startVcd', file);
      await new Promise(r => setTimeout(r, 300));
      assert.ok(!vcdEvents.some(e => !e.recording), 'no length, so it runs on');
      var ev = await rpc.call<VcdEvent>('stopVcd');
      assert.equal(ev.file, file);
      assert.ok(ev.clocks! > 0);
      assert.equal(await rpc.call('stopVcd'), null);
    });

    it('ends itself at the size limit', async function () {
      await rpc.call('start', 'verilog', built.output, built.files);
      var file = path.join(dir, 'full.vcd');
      await rpc.call('startVcd', file, 0, 100000);
      var done = await waitForVcd(false);
      assert.ok(done.full, JSON.stringify(done));
      assert.ok(done.bytes! >= 100000 && done.bytes! < 300000, 'bytes ' + done.bytes);
      assert.equal(fs.statSync(file).size, done.bytes);
      assert.equal(await rpc.call('stopVcd'), null, 'already finished');
    });

    it('refuses platforms with no signals', async function () {
      var s = await rpc.call<EmuStatus>('start', 'nes', rom('nes/shoot2.c.rom'));
      assert.ok(!s.vcd);
      await assert.rejects(rpc.call('startVcd', path.join(dir, 'c.vcd')), /no signals/);
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
      await debug('setBuild', { listings: built.listings, symbolmap: built.symbolmap, mainPath: 'game2.c', paths: built.paths });
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
      await debug('setBuild', { listings: nes.listings, symbolmap: nes.symbolmap, mainPath: 'hello.c', paths: nes.paths });
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

    it('browses the NES machine state and symbols', async function () {
      var dir = path.join(ROOT, 'presets/nes');
      var read = async (rel: string) => {
        var p = path.join(dir, rel);
        return fs.existsSync(p) ? new Uint8Array(fs.readFileSync(p)) : null;
      };
      var nes = await new Builder(ROOT).build({
        platform: 'nes', mainPath: 'scroll.c', mainText: fs.readFileSync(path.join(dir, 'scroll.c'), 'utf-8'),
        files: new ProjectFileProvider(read, ROOT, 'nes'),
      });
      await rpc.call('start', 'nes', nes.output, nes.files, { paused: true });
      await debug('setBuild', { listings: nes.listings, symbolmap: nes.symbolmap, mainPath: 'scroll.c', paths: nes.paths });
      var caps = await debug('capabilities');
      assert.equal(caps.tree, true);
      assert.equal(caps.write, true);
      assert.deepEqual(await debug('debugTree', []), [{ name: 'state', value: '', expandable: true }]);
      var cpu = await debug('debugTree', ['state', 'c']);
      assert.ok(cpu.find((e: any) => e.name === 'PC'));
      var syms = await debug('symbols');
      assert.ok(syms.find((s: any) => s.name === '_main'));
      // zero page, through the machine's write
      assert.equal(await debug('writeMemory', 0x10, [0x5a]), 1);
      assert.deepEqual(await debug('readMemory', 0x10, 1), [0x5a]);

      // a 6502 call stack, from JSR return addresses: neslib's vram_write
      // (no source) called from put_str, called from main
      await debug('setBreakpoints', [{ id: 2, type: 'address', target: 'vram_write', enabled: true }]);
      await debug('continue');
      assert.equal((await nextStop()).reason, 'breakpoint');
      var stack = await debug('callStack');
      assert.deepEqual(stack.map((f: any) => [f.symbol?.name, f.source?.line ?? null, !!f.unsure]),
        [['_vram_write', null, false], ['_put_str', 21, false], ['_main', 52, false]]);
      await debug('setBreakpoints', []);
    });

    it('drives the debug adapter through the worker, as the extension does', async function () {
      var backend = new WorkerDebugBackend((method, ...args) => rpc.call('debug', method, ...args), async () => {
        await rpc.call('start', 'mw8080bw', built.output, built.files, { paused: true });
        await rpc.call('debug', 'setBuild', { listings: built.listings, symbolmap: built.symbolmap, mainPath: 'game2.c', paths: built.paths });
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
