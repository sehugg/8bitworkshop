import assert from "assert";
import { describe, it } from "mocha";
import { treeChildren } from "../../src/common/debugtree";

describe('Debug tree', function () {
  const tree = {
    cpu: { PC: 0x1234, A: 7, halted: false, name: 'Z80' },
    ram: new Uint8Array(0x10000).map((_, i) => i & 0xff),
    regs: new Uint8Array([1, 2, 0xff]),
    words: new Uint16Array(20).fill(0xbeef),
    map: new Map([[1, 'one']]),
    big: Array.from({ length: 1000 }, (_, i) => i),
    lazy: { $$: () => ({ made: 1 }) },
    $$hidden: 1,
    ratio: 0.5,
  };

  it('lists a level with values and hides $$ names', function () {
    const top = treeChildren(tree, []);
    assert.deepStrictEqual(top.map(e => e.name), ['cpu', 'ram', 'regs', 'words', 'map', 'big', 'lazy', 'ratio']);
    const cpu = treeChildren(tree, ['cpu']);
    assert.deepStrictEqual(cpu, [
      { name: 'PC', value: '4660 ($1234)', expandable: false },
      { name: 'A', value: '7 ($07)', expandable: false },
      { name: 'halted', value: 'false', expandable: false },
      { name: 'name', value: 'Z80', expandable: false },
    ]);
    const regs = top.find(e => e.name === 'regs');
    assert.deepStrictEqual(regs, { name: 'regs', value: '01 02 FF', expandable: false });
    assert.strictEqual(top.find(e => e.name === 'ratio').value, '0.5');
  });

  it('splits a typed array into chunks of rows', function () {
    const chunks = treeChildren(tree, ['ram']);
    assert.strictEqual(chunks.length, 256);
    assert.deepStrictEqual(chunks[1], { name: '$0100', value: '', expandable: true });
    const rows = treeChildren(tree, ['ram', '$0100']);
    assert.strictEqual(rows.length, 16);
    assert.strictEqual(rows[1].name, '$0110');
    assert.strictEqual(rows[1].value, '10 11 12 13 14 15 16 17 18 19 1A 1B 1C 1D 1E 1F');
    assert.strictEqual(rows[1].expandable, false);
    const words = treeChildren(tree, ['words']);
    assert.deepStrictEqual(words.map(e => e.name), ['$0000', '$0010']);
    assert.match(words[1].value, /^BEEF BEEF BEEF BEEF$/);
  });

  it('expands maps, lazy nodes and big arrays', function () {
    assert.deepStrictEqual(treeChildren(tree, ['map']), [{ name: '1', value: 'one', expandable: false }]);
    assert.deepStrictEqual(treeChildren(tree, ['lazy']), [{ name: 'made', value: '1 ($01)', expandable: false }]);
    const big = treeChildren(tree, ['big']);
    assert.deepStrictEqual(big.map(e => e.name), ['$00', '$100', '$200', '$300']);
    assert.strictEqual(treeChildren(tree, ['big', '$100'])[0].value, '256 ($0100)');
  });

  it('says when a path is gone', function () {
    assert.throws(() => treeChildren(tree, ['cpu', 'nope']), /no 'nope'/);
  });
});
