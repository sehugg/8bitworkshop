
import * as assert from 'assert';
import * as path from 'path';
import { Builder, ProjectFileProvider } from '../src/buildcore';
import { findRootDir, isSourceFile } from '../src/projectinfo';

// Mocha runs from extension/, not the repo root, so this also checks that
// the toolchain assets load from the configured root rather than the cwd.
const ROOT = findRootDir(__dirname);

function project(files: { [path: string]: string }) {
  var enc = new TextEncoder();
  return async (rel: string) => rel in files ? enc.encode(files[rel]) : null;
}

describe('extension buildcore', function () {
  var builder = new Builder(ROOT);

  it('finds the repo as the asset root', function () {
    assert.equal(ROOT, path.resolve(__dirname, '../../..'));
  });

  it('recognizes source files', function () {
    assert.ok(isSourceFile('main.c'));
    assert.ok(isSourceFile('game.dasm'));
    assert.ok(!isSourceFile('settings.json'));
  });

  // Files the project reads at build time must survive as bytes when they
  // aren't text, even if their extension isn't on the binary list (.hgr).
  it('keeps binary files binary and decodes text', async function () {
    var raw: { [path: string]: Uint8Array } = {
      'logo.hgr': new Uint8Array([0x25, 0x55, 0xaa, 0xd5]),  // invalid UTF-8
      'main.s': new TextEncoder().encode('\t.byte 1\n'),
    };
    var files = new ProjectFileProvider(async rel => raw[rel] ?? null, ROOT, 'apple2');
    var hgr = await files.readFile('logo.hgr') as Uint8Array;
    assert.ok(hgr instanceof Uint8Array);
    assert.deepEqual(Array.from(hgr), [0x25, 0x55, 0xaa, 0xd5]);
    assert.equal(await files.readFile('main.s'), '\t.byte 1\n');
  });

  it('builds a C file with a local header and a preset header', async function () {
    var files = project({
      'main.c': '#include "neslib.h"\n#include "util.h"\nvoid main(void) { ppu_on_all(); while (1) { x = 1; } }\n',
      'util.h': 'static int x;\n',
    });
    var mainText = new TextDecoder().decode(await files('main.c'));
    var r = await builder.build({
      platform: 'nes', mainPath: 'main.c', mainText,
      files: new ProjectFileProvider(files, ROOT, 'nes'),
    });
    assert.deepEqual(r.diagnostics, []);
    assert.ok(r.success);
    assert.equal(r.tool, 'cc65');
    assert.ok(r.output.length > 0);
    assert.ok(r.paths.indexOf('util.h') >= 0);
    assert.ok(r.listings);
  });

  it('reports errors against the file that has them', async function () {
    var files = project({
      'main.c': '#include "util.h"\nvoid main(void) { }\n',
      'util.h': 'int x;\nthis is not C;\n',
    });
    var mainText = new TextDecoder().decode(await files('main.c'));
    var r = await builder.build({
      platform: 'nes', mainPath: 'main.c', mainText,
      files: new ProjectFileProvider(files, ROOT, 'nes'),
    });
    assert.ok(!r.success);
    assert.ok(r.diagnostics.length > 0);
    assert.ok(r.diagnostics.every(d => d.path === 'util.h'), JSON.stringify(r.diagnostics));
    assert.equal(r.diagnostics[0].line, 2);
  });

  it('reports assembler errors in the main file', async function () {
    var src = '\tprocessor 6502\n\torg $f000\nStart\n\tlda #1\n\tbogus\n';
    var r = await builder.build({
      platform: 'vcs', mainPath: 'game.a', mainText: src,
      files: new ProjectFileProvider(project({ 'game.a': src }), ROOT, 'vcs'),
    });
    assert.ok(!r.success);
    assert.equal(r.tool, 'dasm');
    assert.equal(r.diagnostics[0].path, 'game.a');
    assert.equal(r.diagnostics[0].line, 5);
  });

  // Run builds first, so running the same file twice gets an unchanged build
  it('returns the previous output when nothing changed', async function () {
    var src = '#include "neslib.h"\nvoid main(void) { ppu_on_all(); while (1) ; }\n';
    var req = () => ({
      platform: 'nes', mainPath: 'same.c', mainText: src,
      files: new ProjectFileProvider(project({ 'same.c': src }), ROOT, 'nes'),
    });
    var first = await builder.build(req());
    assert.ok(first.output);
    var second = await builder.build(req());
    assert.ok(second.unchanged);
    assert.deepEqual(second.output, first.output);
    assert.ok(second.listings);
  });

  // The linker reads the config file from the source's `//#tooldef ld
  // cfgfile=` (or legacy `#define CFGFILE`) directives. Those have to be
  // applied even when the compiler step is skipped as unchanged, or the
  // second build silently links against the platform default config instead.
  it('keeps cfgfile source directives on an unchanged rebuild', async function () {
    // atari8-800 defaults to atari-cart.cfg; atari.cfg is the disk/XEX layout
    var src = '//#tooldef ld cfgfile=atari.cfg\nvoid main(void) { *(unsigned char*)0x02C8 = 1; }\n';
    var req = () => ({
      platform: 'atari8-800', mainPath: 'cfgdirective.c', mainText: src,
      files: new ProjectFileProvider(project({ 'cfgdirective.c': src }), ROOT, 'atari8-800'),
    });
    var first = await builder.build(req());
    assert.ok(first.success, JSON.stringify(first.diagnostics));
    var second = await builder.build(req());
    assert.ok(second.success, JSON.stringify(second.diagnostics));
    assert.ok(second.unchanged);
    // the cart config has a completely different segment layout
    assert.deepEqual(second.segments, first.segments);
    assert.deepEqual(second.output, first.output);
  });

  // A failed build must not drop the last success: fixing the file back to
  // what built makes the worker say "unchanged", and Run still needs the ROM.
  it('keeps the last output across a failed build', async function () {
    var good = '#include "neslib.h"\nvoid main(void) { ppu_on_all(); while (1) ; }\n';
    var bad = '#include "neslib.h"\nvoid main(void) { ppu_on_all() while (1) ; }\n';
    var build = (src: string) => builder.build({
      platform: 'nes', mainPath: 'revert.c', mainText: src,
      files: new ProjectFileProvider(project({ 'revert.c': src }), ROOT, 'nes'),
    });
    var first = await build(good);
    assert.ok(first.output);
    var failed = await build(bad);
    assert.ok(!failed.success);
    assert.ok(failed.diagnostics.length > 0);
    var reverted = await build(good);
    assert.ok(reverted.success);
    assert.ok(reverted.unchanged);
    assert.deepEqual(reverted.diagnostics, []);
    assert.deepEqual(reverted.output, first.output);
  });
});
