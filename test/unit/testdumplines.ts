import assert from "assert";
import { describe, it } from "mocha";
import { computeDumpLines, DumpLine } from "../../src/common/symbols/dumplines";

function labelAt(lines: DumpLine[], addr: number) {
  const line = lines.find((l) => addr >= l.a && addr < l.a + l.l);
  return line && line.s;
}

describe('Memory dump symbol ranges', function () {

  it('labels only the bytes of a sized symbol', function () {
    const lines = computeDumpLines(
      { 0x100: 'a', 0x180: 'b', 0x10000: '__END__' },
      { a: 0x20, b: 0x10 });
    assert.strictEqual(labelAt(lines, 0x100), 'a');
    assert.strictEqual(labelAt(lines, 0x11f), 'a');
    assert.strictEqual(labelAt(lines, 0x120), '');
    assert.strictEqual(labelAt(lines, 0x17f), '');
    assert.strictEqual(labelAt(lines, 0x180), 'b');
    assert.strictEqual(labelAt(lines, 0x190), '');
    assert.deepStrictEqual(lines.filter((l) => l.s == 'a').map((l) => [l.a, l.l]),
      [[0x100, 0x10], [0x110, 0x10]]);
  });

  it('extends an unsized symbol only to its segment boundary', function () {
    const lines = computeDumpLines(
      { 0x100: 'a', 0x150: 'b', 0x10000: '__END__' },
      null,
      [{ name: 'CODE', start: 0x100, size: 0x20, type: 'rom' }]);
    assert.strictEqual(labelAt(lines, 0x11f), 'a');
    assert.strictEqual(labelAt(lines, 0x120), '');
    assert.strictEqual(labelAt(lines, 0x14f), '');
    assert.strictEqual(labelAt(lines, 0x150), 'b');
  });

  it('trusts a size over a segment boundary', function () {
    const lines = computeDumpLines(
      { 0x100: 'a', 0x200: 'b', 0x10000: '__END__' },
      { a: 0x40 },
      [{ name: 'CODE', start: 0x100, size: 0x20, type: 'rom' }]);
    assert.strictEqual(labelAt(lines, 0x11f), 'a');
    assert.strictEqual(labelAt(lines, 0x120), 'a');
    assert.strictEqual(labelAt(lines, 0x13f), 'a');
    assert.strictEqual(labelAt(lines, 0x140), '');
  });

  it('stops a size at the next symbol', function () {
    const lines = computeDumpLines(
      { 0x100: 'a', 0x110: 'b', 0x10000: '__END__' },
      { a: 0x40, b: 1 });
    assert.strictEqual(labelAt(lines, 0x10f), 'a');
    assert.strictEqual(labelAt(lines, 0x110), 'b');
    assert.strictEqual(labelAt(lines, 0x111), '');
  });

  it('keeps the old gap behavior without a size or segment', function () {
    const lines = computeDumpLines({ 0x100: 'a', 0x200: 'b', 0x10000: '__END__' });
    assert.strictEqual(labelAt(lines, 0x180), 'a');
    assert.strictEqual(labelAt(lines, 0x200), 'b');
  });

});
