
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
});
