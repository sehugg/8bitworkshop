import assert from "assert";
import { describe, it } from "mocha";
import {
  resolveDebuggerTarget,
  findSegmentAt,
  makeDebuggerHit,
  shouldOfferDebuggerHit,
} from "../../src/ide/search/debuggerhit";
import { Segment } from "../../src/common/workertypes";

const SYMBOLS = {
  main: 0xc000,
  JOY_READ: 0xf000,
  videoTop: 0x0200,
};

describe('DebuggerHit', function () {

  describe('resolveDebuggerTarget', function () {
    it('should resolve exact symbol names', function () {
      const t = resolveDebuggerTarget('main', SYMBOLS);
      assert.ok(t);
      assert.strictEqual(t!.addr, 0xc000);
      assert.strictEqual(t!.isSymbol, true);
    });

    it('should resolve symbol names case-insensitively', function () {
      const t = resolveDebuggerTarget('joy_read', SYMBOLS);
      assert.ok(t);
      assert.strictEqual(t!.addr, 0xf000);
      assert.strictEqual(t!.isSymbol, true);
    });

    it('should prefer symbol map over hex parse', function () {
      // "add" is valid hex (0xadd) but if a symbol exists, it wins
      const t = resolveDebuggerTarget('add', { add: 0x123 });
      assert.ok(t);
      assert.strictEqual(t!.addr, 0x123);
      assert.strictEqual(t!.isSymbol, true);
    });

    it('should parse $-prefixed hex', function () {
      const t = resolveDebuggerTarget('$c000');
      assert.ok(t);
      assert.strictEqual(t!.addr, 0xc000);
      assert.strictEqual(t!.isSymbol, false);
    });

    it('should parse 0x-prefixed hex', function () {
      const t = resolveDebuggerTarget('0xC000');
      assert.ok(t);
      assert.strictEqual(t!.addr, 0xc000);
      assert.strictEqual(t!.isSymbol, false);
    });

    it('should parse bare hex digits', function () {
      const t = resolveDebuggerTarget('C000');
      assert.ok(t);
      assert.strictEqual(t!.addr, 0xc000);
      assert.strictEqual(t!.isSymbol, false);
    });

    it('should return null for non-hex identifiers', function () {
      assert.strictEqual(resolveDebuggerTarget('zzz'), null);
      assert.strictEqual(resolveDebuggerTarget('main loop'), null);
      assert.strictEqual(resolveDebuggerTarget(''), null);
      assert.strictEqual(resolveDebuggerTarget('   '), null);
    });

    it('should return null for hex-like names when no symbol map exists... or resolve as hex', function () {
      // without a symbol map, hex-like needles still resolve (as raw hex)
      const t = resolveDebuggerTarget('add');
      assert.ok(t);
      assert.strictEqual(t!.addr, 0xadd);
      assert.strictEqual(t!.isSymbol, false);
    });
  });

  describe('findSegmentAt', function () {
    const segs: Segment[] = [
      { name: 'Code', start: 0xc000, size: 0x1000, type: 'rom' },
      { name: 'RAM', start: 0x0200, size: 0x100, type: 'ram' },
      { name: 'IO', start: 0x8000, last: 0x8003, size: 0x4, type: 'io' },
    ];

    it('should find the segment containing an address', function () {
      assert.strictEqual(findSegmentAt(0xc123, segs)?.name, 'Code');
      assert.strictEqual(findSegmentAt(0x02ff, segs)?.name, 'RAM');
    });

    it('should respect the last field when present', function () {
      assert.strictEqual(findSegmentAt(0x8003, segs)?.name, 'IO');
      assert.strictEqual(findSegmentAt(0x8004, segs), null);
    });

    it('should return null for unmapped addresses', function () {
      assert.strictEqual(findSegmentAt(0x0000, segs), null);
      assert.strictEqual(findSegmentAt(0x10000, segs), null);
    });

    it('should handle missing segment lists', function () {
      assert.strictEqual(findSegmentAt(0xc000, undefined), null);
      assert.strictEqual(findSegmentAt(0xc000, []), null);
    });
  });

  describe('makeDebuggerHit', function () {
    it('should build a disassembler hit for code (rom) segments', function () {
      const segs: Segment[] = [{ name: 'Code', start: 0xc000, size: 0x1000, type: 'rom' }];
      const hit = makeDebuggerHit('main', { addr: 0xc100, isSymbol: true }, segs);
      assert.strictEqual(hit.record.source, 'debugger');
      assert.strictEqual(hit.record.kind, 'label');
      assert.strictEqual(hit.record.brief, 'open in Disassembly');
      assert.strictEqual(hit.record.addr, 0xc100);
      assert.strictEqual(hit.record.name, 'main');
    });

    it('should build a memory browser hit for data (ram) segments', function () {
      const segs: Segment[] = [{ name: 'RAM', start: 0x0200, size: 0x100, type: 'ram' }];
      const hit = makeDebuggerHit('videoTop', { addr: 0x0200, isSymbol: true }, segs);
      assert.strictEqual(hit.record.kind, 'var');
      assert.strictEqual(hit.record.brief, 'open in Memory Browser');
      assert.strictEqual(hit.record.addr, 0x0200);
    });

    it('should default to the memory browser when no segment matches', function () {
      const hit = makeDebuggerHit('$9000', { addr: 0x9000, isSymbol: false }, []);
      assert.strictEqual(hit.record.kind, 'var');
      assert.strictEqual(hit.record.brief, 'open in Memory Browser');
    });

    it('should give debugger hits a low score so source hits rank first', function () {
      const hit = makeDebuggerHit('main', { addr: 0xc000, isSymbol: true }, []);
      assert.ok(hit.score < 1000);
    });
  });

  describe('shouldOfferDebuggerHit', function () {
    it('should always offer exact symbol matches', function () {
      assert.strictEqual(shouldOfferDebuggerHit({ addr: 0xc000, isSymbol: true }, true), true);
      assert.strictEqual(shouldOfferDebuggerHit({ addr: 0xc000, isSymbol: true }, false), true);
    });

    it('should only offer raw hex when there are no other hits', function () {
      assert.strictEqual(shouldOfferDebuggerHit({ addr: 0xadd, isSymbol: false }, false), true);
      assert.strictEqual(shouldOfferDebuggerHit({ addr: 0xadd, isSymbol: false }, true), false);
    });
  });
});
