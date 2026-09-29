import assert from "assert";
import { describe, it } from "mocha";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { compileSourceFile, preload } from "../../src/tools/testlib";
import { withStartupObjects } from "../../src/worker/tools/sdcc";

// The Game Boy links GBDK's crt0 and sfr objects from src/worker/lib/gb
// ahead of the program's, unless the program links its own.
describe('sdcc startup objects', function () {
  it('go first', function () {
    assert.deepStrictEqual(withStartupObjects(['sfr.rel', 'crt0.rel'], ['main.rel', 'util.rel']),
      ['sfr.rel', 'crt0.rel', 'main.rel', 'util.rel']);
  });

  it('give way to the project\'s own, by file name', function () {
    assert.deepStrictEqual(withStartupObjects(['sfr.rel', 'crt0.rel'], ['gb/sfr.rel', 'gb/crt0.rel', 'main.rel']),
      ['gb/sfr.rel', 'gb/crt0.rel', 'main.rel']);
    assert.deepStrictEqual(withStartupObjects(['sfr.rel', 'crt0.rel'], ['crt0.rel', 'main.rel']),
      ['sfr.rel', 'crt0.rel', 'main.rel']);
  });

  it('leave other platforms alone', function () {
    assert.deepStrictEqual(withStartupObjects(undefined, ['main.rel']), ['main.rel']);
    assert.deepStrictEqual(withStartupObjects([], ['main.rel']), ['main.rel']);
  });
});

describe('Game Boy C build', function () {
  this.timeout(60000);
  const MAIN = '#include "gb/types.h"\n#include "gb/hardware.h"\n#include "gb/gb.h"\n' +
    'void main(void) { wait_vbl_done(); }\n';
  let tmpdir: string;
  before(async function () {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "sdcclink-"));
    await preload('sdcc', 'gb');
  });
  after(function () { fs.rmSync(tmpdir, { recursive: true, force: true }); });

  function build(name: string, code: string) {
    const p = path.join(tmpdir, name);
    fs.writeFileSync(p, code);
    return compileSourceFile('sdcc', 'gb', p);
  }

  it('links crt0 and the GBDK headers from the library', async function () {
    const result = await build('plain.c', MAIN);
    assert.deepStrictEqual(result.errors || [], []);
    assert.strictEqual(result.output.length, 0x8000);
  });

  it('links the project\'s own crt0 instead, to the same ROM', async function () {
    for (const f of ['crt0.sgb', 'sfr.sgb', 'global.sgb'])
      fs.copyFileSync(path.join('src/worker/lib/gb', f), path.join(tmpdir, f));
    const plain = await build('plain2.c', MAIN);
    const own = await build('own.c', '//#link "sfr.sgb"\n//#link "crt0.sgb"\n' + MAIN);
    assert.deepStrictEqual(own.errors || [], []);
    assert.deepStrictEqual(Buffer.from(own.output), Buffer.from(plain.output));
  });
});
