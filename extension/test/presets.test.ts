import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// out/presets.json is written by scripts/presetindex.ts during the build.
// The export-ROM feature reads each platform's romext from it.
describe('preset index', function () {
  var index = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'presets.json'), 'utf-8'));

  function romext(id: string): string | undefined {
    return index.platforms.find((p: any) => p.id === id)?.romext;
  }

  it('records the ROM extension for platforms that define one', function () {
    assert.equal(romext('nes'), '.nes');
    assert.equal(romext('vcs'), '.a26');
    assert.equal(romext('gb'), '.gb');
  });

  it('defaults to .bin for platforms without one', function () {
    assert.equal(romext('astrocade'), '.bin');
  });

  // presetindex builds each platform on the main thread; the Verilog platform
  // pulls in binaryen, which used to fail there and skip these platforms
  it('offers the Verilog platforms and their templates', function () {
    for (var id of ['verilog', 'verilog-vga']) {
      var p = index.platforms.find((p: any) => p.id === id);
      assert.ok(p, `${id} missing from the preset index`);
      assert.ok(p.templates.length > 0, `${id} has no templates`);
    }
  });
});
