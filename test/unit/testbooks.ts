import assert from "assert";
import { describe, it } from "mocha";
import { bookFor } from "../../src/common/books";

describe('bookFor', function () {
  it('finds the book for a platform and its variants', function () {
    assert.equal(bookFor('nes')?.id, 'nes');
    assert.equal(bookFor('nes-asm')?.id, 'nes');
    assert.equal(bookFor('vcs.mame')?.id, 'vcs');
    assert.equal(bookFor('verilog-vga')?.id, 'verilog');
    assert.equal(bookFor('c64')?.id, 'c64');
  });

  it('covers only the arcade platforms in the arcade book', function () {
    for (var p of ['mw8080bw', 'vicdual', 'galaxian-scramble', 'vector-z80color', 'williams-z80'])
      assert.equal(bookFor(p)?.id, 'arcade', p);
    for (var p of ['williams', 'vector-ataricolor', 'coleco', 'gb', 'msx', 'apple2'])
      assert.equal(bookFor(p), undefined, p);
  });
});
