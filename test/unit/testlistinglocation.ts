import assert from "assert";
import { describe, it } from "mocha";
import { SourceFile } from "../../src/common/workertypes";
import { findListingLocation, ListingLocationContext } from "../../src/ide/search/listinglocation";

const LOOKAHEAD = 64;

function makeFile(lines: { line: number, offset: number }[]): SourceFile {
  return new SourceFile(lines, '');
}

// a context where every candidate window id is "known" and file-prefix
// lookup just strips a trailing extension, like the real IDE's windows
function makeContext(overrides: Partial<ListingLocationContext> = {}): ListingLocationContext {
  return {
    listings: {},
    filename2path: {},
    isWindow: () => true,
    findWindowWithFilePrefix: (fn) => fn.replace(/\.lst$/, ''),
    ...overrides,
  };
}

describe('findListingLocation', function () {

  it('returns null when there are no listings', function () {
    const ctx = makeContext({ listings: {} });
    assert.strictEqual(findListingLocation(0x100, ctx, LOOKAHEAD), null);
  });

  it('returns null when the PC matches no line in any listing', function () {
    const ctx = makeContext({
      listings: {
        'game.c': { lines: [], sourcefile: makeFile([{ line: 1, offset: 0 }]) } as any,
      },
    });
    assert.strictEqual(findListingLocation(0x9999, ctx, LOOKAHEAD), null);
  });

  it('resolves a sourcefile-only listing via findWindowWithFilePrefix', function () {
    const ctx = makeContext({
      listings: {
        'game.c.lst': { lines: [], sourcefile: makeFile([{ line: 1, offset: 0x10 }]) } as any,
      },
    });
    const loc = findListingLocation(0x10, ctx, LOOKAHEAD);
    assert.ok(loc);
    assert.strictEqual(loc.wndid, 'game.c'); // .lst stripped by findWindowWithFilePrefix
    assert.strictEqual(loc.line, 1);
  });

  it('prefers the assembly listing over the source file when both are present', function () {
    const ctx = makeContext({
      listings: {
        'game.c.lst': {
          lines: [],
          sourcefile: makeFile([{ line: 1, offset: 0x10 }]),
          assemblyfile: makeFile([{ line: 7, offset: 0x10 }]),
        } as any,
      },
      filename2path: { 'game.c.lst': 'game.c.lst' },
    });
    const loc = findListingLocation(0x10, ctx, LOOKAHEAD);
    assert.ok(loc);
    assert.strictEqual(loc.wndid, 'game.c.lst'); // resolved via filename2path, not findWindowWithFilePrefix
    assert.strictEqual(loc.line, 7);
  });

  it('skips a listing whose window is not known', function () {
    const ctx = makeContext({
      listings: {
        'unknown.c.lst': { lines: [], sourcefile: makeFile([{ line: 1, offset: 0x10 }]) } as any,
      },
      isWindow: () => false,
    });
    assert.strictEqual(findListingLocation(0x10, ctx, LOOKAHEAD), null);
  });

  it('picks the closest match among several listings', function () {
    const ctx = makeContext({
      listings: {
        'far.c.lst': { lines: [], sourcefile: makeFile([{ line: 1, offset: 0x00 }]) } as any,
        'near.c.lst': { lines: [], sourcefile: makeFile([{ line: 1, offset: 0x0e }]) } as any,
      },
    });
    // pc=0x10: 'near' (offset 0x0e, score 2) beats 'far' (offset 0x00, score 16)
    const loc = findListingLocation(0x10, ctx, LOOKAHEAD);
    assert.ok(loc);
    assert.strictEqual(loc.wndid, 'near.c');
  });

  it('finds the line closely preceding the PC when there is no exact match', function () {
    const ctx = makeContext({
      listings: {
        'game.c.lst': { lines: [], sourcefile: makeFile([{ line: 5, offset: 0x100 }]) } as any,
      },
    });
    const loc = findListingLocation(0x103, ctx, LOOKAHEAD);
    assert.ok(loc);
    assert.strictEqual(loc.line, 5);
  });

  it('does not look further behind the PC than the given lookahead', function () {
    const ctx = makeContext({
      listings: {
        'game.c.lst': { lines: [], sourcefile: makeFile([{ line: 5, offset: 0x100 }]) } as any,
      },
    });
    assert.strictEqual(findListingLocation(0x100 + 5, ctx, 4), null);
  });

});
