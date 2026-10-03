import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as http from 'http';
import { createHash } from 'crypto';
import { Worker } from 'worker_threads';
import * as zlib from 'zlib';
import { execFileSync } from 'child_process';
import { AssetStore } from '../src/assets';
import { needsSdcc4, AssetManifest, PackInfo, isUnreviewedFile, makePack, packForFile, packsForPlatform, readPack } from '../src/assetpacks';
import { listPackFiles } from '../scripts/assetpack';
import { findRootDir } from '../src/projectinfo';
import { Rpc } from '../src/rpc';
import type { BuildOutcome } from '../src/buildcore';
import type { EmuStatus } from '../src/emuworker';

const ROOT = findRootDir(__dirname);
const OUT = path.join(__dirname, '..');

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), '8bws-assets-'));
}

async function pack(name: string, files: { [path: string]: string }): Promise<[PackInfo, Uint8Array]> {
  var enc = new TextEncoder();
  var data = await makePack(Object.keys(files).map(p => ({ path: p, data: enc.encode(files[p]) })), 5);
  var sha256 = createHash('sha256').update(data).digest('hex');
  return [{ file: `8bitworkshop-${name}-test-${sha256.slice(0, 8)}.tar.br`, size: data.length, sha256, count: Object.keys(files).length }, data];
}

describe('extension asset packs', function () {

  it('puts the Verilog toolchain in its own pack', function () {
    assert.equal(packForFile('src/worker/wasm/verilator_bin.wasm'), 'verilog');
    assert.equal(packForFile('src/worker/fs/fsSilice.data'), 'verilog');
    assert.equal(packForFile('src/worker/wasm/sdcc.wasm'), 'base');
    assert.equal(packForFile('presets/verilog/ball_absolute.v'), 'base');
    assert.deepEqual(packsForPlatform('verilog-vga'), ['base', 'verilog']);
    assert.deepEqual(packsForPlatform('nes'), ['base']);
    assert.deepEqual(packsForPlatform(undefined), ['base']);
  });

  it('puts the lesser-used toolchains in the extra pack, fetched by tool', function () {
    for (var f of ['src/worker/wasm/oscar64.wasm', 'src/worker/fs/cc7800-fs.zip']) {
      assert.equal(packForFile(f), 'extra', f);
    }
    assert.equal(packForFile('src/worker/wasm/cc65.wasm'), 'base');
    assert.equal(packForFile('src/worker/wasm/cmoc.wasm'), 'base');
    var all = Object.values(listPackFiles(ROOT)).flat();
    assert.ok(!all.some(f => /^src\/worker\/.*(dialogc|armips|inform|yasm|dialog-fs|arm-tcc|smlrc|arm32)/.test(f)), 'unused toolchains are not packed');
    assert.equal(packForFile('src/worker/wasm/sdcc4.wasm'), 'extra');
    assert.equal(packForFile('src/worker/fs/sdcc-fs.zip'), 'extra');
    assert.equal(packForFile('src/worker/wasm/sdcc.wasm'), 'base');
    assert.equal(packForFile('src/worker/fs/fssdcc.data'), 'base');
    assert.deepEqual(packsForPlatform('c64', 'oscar64'), ['base', 'extra']);
    assert.deepEqual(packsForPlatform('verilog', 'cc2600'), ['base', 'verilog', 'extra']);
    assert.deepEqual(packsForPlatform('nes', 'cc65'), ['base']);
    // SDCC 4.x: by directive, or the 6502 backend; 3.x stays in base
    assert.deepEqual(packsForPlatform('gb', 'sdcc', 'int x;'), ['base']);
    assert.deepEqual(packsForPlatform('gb', 'sdcc', '//#tooldef c sdcc=4\nint x;'), ['base', 'extra']);
    assert.ok(needsSdcc4('coleco', 'sdcc', '//#tooldef sdcc=4'));
    assert.ok(!needsSdcc4('coleco', 'sdcc', '//#tooldef c sdcc=3'));
    assert.ok(!needsSdcc4('coleco', 'cc65', '//#tooldef c sdcc=4'));
    assert.ok(needsSdcc4('c64', 'sdcc', 'int x;'), 'mos6502 is 4.x only');
    assert.ok(!needsSdcc4('c64', 'cc65', 'int x;'));
  });

  it('lists the tracked toolchain files, with symlinked directories copied', function () {
    var lists = listPackFiles(ROOT);
    assert.ok(lists.base.includes('src/worker/wasm/cc65.wasm'));
    assert.ok(lists.base.includes('presets/nes/hello.c'));
    assert.ok(lists.base.some(f => f.startsWith('presets/msx-libcv/')), 'symlinked preset dir');
    assert.ok(!lists.base.includes('presets/msx-libcv'));
    assert.deepEqual(lists.verilog.filter(f => f.startsWith('src/')).sort(), [
      'src/worker/fs/fsSilice.data', 'src/worker/fs/fsSilice.js', 'src/worker/fs/fsSilice.js.metadata',
      'src/worker/wasm/silice.js', 'src/worker/wasm/silice.wasm',
      'src/worker/wasm/verilator_bin.js', 'src/worker/wasm/verilator_bin.wasm',
    ]);
    assert.ok(lists.verilog.includes('node_modules/binaryen/index.js'));
    for (var f of lists.base.concat(lists.verilog)) {
      assert.ok(fs.statSync(path.join(ROOT, f)).isFile(), f);
      assert.ok(!f.endsWith('~'), `backup file ${f}`);
    }
  });

  it('leaves out tools whose license is not cleared', function () {
    assert.ok(isUnreviewedFile('src/worker/wasm/nesasm.wasm'));
    assert.ok(isUnreviewedFile('src/worker/wasm/merlin32.js'));
    assert.ok(isUnreviewedFile('src/worker/asmjs/xasm6809.js'));
    assert.ok(!isUnreviewedFile('src/worker/wasm/cc65.wasm'));
    var lists = listPackFiles(ROOT);
    for (var f of lists.base.concat(lists.verilog)) {
      assert.ok(!isUnreviewedFile(f), `unreviewed file shipped: ${f}`);
    }
  });

  it('packs the same files to the same bytes', async function () {
    var [a] = await pack('base', { 'a.txt': 'x', 'b/c.txt': 'y' });
    var [b] = await pack('base', { 'a.txt': 'x', 'b/c.txt': 'y' });
    assert.equal(a.sha256, b.sha256);
  });

  it('round-trips files through a pack', async function () {
    var long = 'presets/' + 'x'.repeat(60) + '/' + 'y'.repeat(60) + '.c';
    var files = [
      { path: 'src/worker/wasm/a.wasm', data: new Uint8Array([0, 1, 2, 255]) },
      { path: 'empty.txt', data: new Uint8Array(0) },
      { path: 'block.bin', data: new Uint8Array(512).fill(7) },
      { path: long, data: new TextEncoder().encode('long name') },
    ];
    var out = await readPack(await makePack(files, 5));
    assert.deepEqual(out.map(f => [f.path, Array.from(f.data)]), files.map(f => [f.path, Array.from(f.data)]));
  });

  it('writes tar that the tar command reads', async function () {
    var dir = tmpdir();
    var tar = zlib.brotliDecompressSync(await makePack([
      { path: 'a/b.txt', data: new TextEncoder().encode('hello') },
      { path: 'c.bin', data: new Uint8Array(1000).fill(1) },
    ], 5));
    fs.writeFileSync(path.join(dir, 'p.tar'), tar);
    execFileSync('tar', ['-xf', 'p.tar'], { cwd: dir });
    assert.equal(fs.readFileSync(path.join(dir, 'a/b.txt'), 'utf-8'), 'hello');
    assert.equal(fs.statSync(path.join(dir, 'c.bin')).size, 1000);
    fs.rmSync(dir, { recursive: true });
  });
});

describe('extension AssetStore', function () {
  var server: http.Server;
  var url: string;
  var served: { [file: string]: Uint8Array };
  var hits: string[];
  var manifest: AssetManifest;
  var cache: string;

  before(async function () {
    var [base, baseZip] = await pack('base', { 'src/worker/wasm/a.wasm': 'AAA', 'presets/nes/hello.c': 'main' });
    var [verilog, verilogZip] = await pack('verilog', { 'src/worker/wasm/verilator_bin.wasm': 'VVV' });
    manifest = { ideVersion: 'test', packs: { base, verilog } };
    served = { [base.file]: baseZip, [verilog.file]: verilogZip };
    server = http.createServer((req, res) => {
      var name = path.posix.basename(req.url || '');
      hits.push(name);
      if (served[name] && req.url === '/assets/' + name) res.end(served[name]);
      else { res.statusCode = 404; res.end(); }
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${(server.address() as any).port}/assets/`;
  });

  after(function () {
    server.close();
  });

  beforeEach(function () {
    hits = [];
    cache = tmpdir();
  });

  afterEach(function () {
    fs.rmSync(cache, { recursive: true, force: true });
  });

  it('downloads a pack once and unpacks it', async function () {
    var store = new AssetStore(cache, manifest, [url]);
    var progress: number[] = [];
    var root = await store.ensure(['base'], (pack, n) => progress.push(n));
    assert.equal(fs.readFileSync(path.join(root, 'src/worker/wasm/a.wasm'), 'utf-8'), 'AAA');
    assert.ok(store.has('base'));
    assert.ok(!store.has('verilog'));
    assert.ok(progress.length > 0);
    // a second store (a new window) finds it installed
    var again = new AssetStore(cache, manifest, [url]);
    assert.equal(await again.ensure(['base']), root);
    assert.deepEqual(hits, [manifest.packs.base.file]);
  });

  it('adds the verilog pack to the same root', async function () {
    var store = new AssetStore(cache, manifest, [url]);
    var root = await store.ensure(['base']);
    assert.equal(await store.ensure(['base', 'verilog']), root);
    assert.ok(fs.existsSync(path.join(root, 'src/worker/wasm/a.wasm')));
    assert.ok(fs.existsSync(path.join(root, 'src/worker/wasm/verilator_bin.wasm')));
  });

  it('shares one download between concurrent callers', async function () {
    var store = new AssetStore(cache, manifest, [url]);
    var [a, b] = await Promise.all([store.ensure(['base']), store.ensure(['base'])]);
    assert.equal(a, b);
    assert.equal(hits.length, 1);
  });

  it('skips a server with the wrong file and tries the next', async function () {
    var bad = tmpdir();
    fs.writeFileSync(path.join(bad, manifest.packs.base.file), 'not a pack');
    var store = new AssetStore(cache, manifest, [bad, 'http://127.0.0.1:1/nothing/', url]);
    var root = await store.ensure(['base']);
    assert.ok(fs.existsSync(path.join(root, 'presets/nes/hello.c')));
    fs.rmSync(bad, { recursive: true });
  });

  it('reads a pack from a local directory or file: URL', async function () {
    var dir = tmpdir();
    fs.writeFileSync(path.join(dir, manifest.packs.base.file), served[manifest.packs.base.file]);
    var store = new AssetStore(cache, manifest, ['file://' + dir]);
    await store.ensure(['base']);
    assert.ok(store.has('base'));
    assert.deepEqual(hits, []);
    fs.rmSync(dir, { recursive: true });
  });

  it('fails when no server has a good copy, and installs nothing', async function () {
    var store = new AssetStore(cache, manifest, [url + 'missing/']);
    await assert.rejects(store.ensure(['base']), /Cannot download toolchain pack.*HTTP 404/);
    assert.ok(!store.has('base'));
  });

  it('removes roots from older builds', async function () {
    var old = path.join(cache, '0123456789ab');
    fs.mkdirSync(old);
    var store = new AssetStore(cache, manifest, [url]);
    await store.ensure(['base']);
    assert.ok(!fs.existsSync(old));
  });
});

// Builds and runs from the real packs (npm run assets), not the repo.
describe('extension toolchains from packs', function () {
  this.timeout(120000);
  var manifestFile = path.join(OUT, 'assets.json');
  var cache: string;
  var root: string;

  before(async function () {
    if (!fs.existsSync(manifestFile)) return this.skip();
    var manifest: AssetManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
    cache = tmpdir();
    var store = new AssetStore(cache, manifest, [path.join(OUT, 'assets')]);
    root = await store.ensure(["base", "verilog"]);
  });

  after(function () {
    if (cache) fs.rmSync(cache, { recursive: true, force: true });
  });

  function start(script: string, handlers = {}): [Worker, Rpc] {
    var worker = new Worker(path.join(OUT, script), { workerData: { rootDir: root } });
    return [worker, new Rpc(worker, handlers)];
  }

  async function build(platform: string, dir: string, main: string): Promise<BuildOutcome> {
    var [worker, rpc] = start('buildworker.js', {
      readFile: (id: number, rel: string) => {
        var p = path.join(root, 'presets', dir, rel);
        return fs.existsSync(p) ? new Uint8Array(fs.readFileSync(p)) : null;
      },
    });
    try {
      var mainText = fs.readFileSync(path.join(root, 'presets', dir, main), 'utf-8');
      return await rpc.call<BuildOutcome>('build', { buildId: 1, platform, mainPath: main, mainText });
    } finally {
      await worker.terminate();
    }
  }

  it('builds NES C', async function () {
    var r = await build('nes', 'nes', 'hello.c');
    assert.deepEqual(r.diagnostics, []);
    assert.ok(r.success && r.output);
  });

  it('builds Verilog and loads binaryen from the pack', async function () {
    var r = await build('verilog', 'verilog', 'ball_absolute.v');
    assert.deepEqual(r.diagnostics, []);
    assert.ok(r.success && r.output);
    // loading the platform imports binaryen, which only the pack root has.
    // (Running frames is a separate, pre-existing Verilog failure.)
    var [worker, rpc] = start('emuworker.js');
    try {
      var s = await rpc.call<EmuStatus>('start', 'verilog', r.output);
      assert.equal(s.platform, 'verilog');
    } finally {
      await worker.terminate();
    }
  });
});
