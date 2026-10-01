import assert from "assert";
import { describe, it } from "mocha";
import { inferSymbolSizes } from "../../src/worker/tools/sdcc";

describe('sdcc symbol sizes', function () {
  const segments = [{ start: 0x2000, size: 0x10 }, { start: 0x100, size: 0x40 }];

  it('sizes a symbol up to the next one, and the last up to its segment end', function () {
    const sizes = inferSymbolSizes({ _a: 0x2000, _b: 0x2001, _c: 0x2003 }, segments);
    assert.deepStrictEqual(sizes, { _a: 1, _b: 2, _c: 0xd });
  });

  it('gives aliases the same size, and skips bounds, debug labels and outsiders', function () {
    const sizes = inferSymbolSizes({
      _a: 0x2000, _alias: 0x2000, _b: 0x2004, s__DATA: 0x2000, l__DATA: 0x10,
      'G$f$0$0': 0x2002, _rom: 0x100, _far: 0x9000,
    }, segments);
    assert.deepStrictEqual(sizes, { _a: 4, _alias: 4, _b: 0xc, _rom: 0x40 });
  });
});
