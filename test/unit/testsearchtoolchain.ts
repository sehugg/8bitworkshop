/**
 * ToolchainSource tests - dumb full-text search over the worker's bundled
 * header files. The worker is mocked by providing a queryWorker on the
 * stubbed project (same provider injection as ProjectSource).
 */

import * as assert from 'assert';
import { ToolchainSource } from '../../src/ide/search/toolchainsource';
import { setProjectProvider } from '../../src/ide/search/projectsource';

/** Build a fake "worker" backed by a hash of paths -> text. */
function makeFs(files: { [path: string]: string }) {
  const paths = Object.keys(files).sort();
  return {
    mainPath: 'main.c',
    platform_id: 'nes',
    iterateFiles: (cb: any) => {},
    getToolForFilename: () => 'cc65',
    queryWorker: async (msg: any) => {
      if (msg.listshared != null) {
        const prefix = msg.listshared + '/';
        return { output: paths.filter(p => p.startsWith(prefix)) };
      }
      if (msg.readshared != null) {
        const text = files[msg.readshared];
        if (text == null) return { output: null };
        return { output: new TextEncoder().encode(text) };
      }
      return null;
    }
  };
}

const NES_H = `#ifndef NES_H
#define NES_H
/* NES registers */
#define PPU_CTRL  0x2000
#define PPU_MASK  0x2001
/* Turn off the screen */
#define VBLANK    0x00
#define PPU_STATUS 0x2002
static char PPU_READ(unsigned char a) {
  return a;
}
#endif
`;

const APPLE_H = `#ifndef APPLE_H
#define APPLE_H
/* Apple II registers */
#define KBD 0xC000
/* Read keyboard */
#define KBD_READ 0xC000
#endif
`;

describe('ToolchainSource', function () {
  after(function () {
    setProjectProvider(() => null);
  });

  it('should list and lazily search bundled header files', async function () {
    setProjectProvider(() => makeFs({ '/include/nes.h': NES_H, '/include/apple.h': APPLE_H }));
    const ts = new ToolchainSource();

    // First query triggers ready() (lists files) + ensureBatch() (reads them)
    const hits = await ts.query('VBLANK', 10);

    assert.ok(hits.length >= 1, 'should find VBLANK in nes.h');
    const rec = hits[0].record;
    assert.strictEqual(rec.kind, 'text');
    assert.strictEqual(rec.source, 'toolchain');
    assert.strictEqual(rec.file, '/include/nes.h');
    assert.ok(rec.line && rec.line > 0);
    // The two hash-flavored hits should both appear (each file is searched)
    assert.ok(hits.some(h => h.record.file === '/include/nes.h' && h.record.name.includes('VBLANK')));
  });

  it('should be case-insensitive', async function () {
    setProjectProvider(() => makeFs({ '/include/nes.h': NES_H }));
    const ts = new ToolchainSource();
    const hits = await ts.query('vblank', 10);
    assert.ok(hits.length >= 1);
  });

  it('should require at least 2 chars', async function () {
    setProjectProvider(() => makeFs({ '/include/nes.h': NES_H }));
    const ts = new ToolchainSource();
    const hits = await ts.query('x', 10);
    assert.strictEqual(hits.length, 0);
  });

  it('should load files in batches across queries', async function () {
    const fs = makeFs({ '/include/nes.h': NES_H, '/include/apple.h': APPLE_H });
    setProjectProvider(() => fs);
    const ts = new ToolchainSource();

    // Shrink batch so a query only loads a subset
    (ts as any).files = ['/include/nes.h', '/include/apple.h'];
    (ts as any).loadIdx = 0;
    (ts as any).fsName = '65-nes';
    (ts as any).readyDone = true;
    (ts as any).batchSize = 1;

    // First query: only nes.h loaded
    let hits = await ts.query('VBLANK', 10);
    assert.ok(hits.length >= 1, 'nes.h loaded in first batch');
    assert.strictEqual(ts['loaded'].size, 1);

    // Second query: apple.h loaded too
    hits = await ts.query('VBLANK', 10);
    assert.strictEqual(ts['loaded'].size, 2);
  });

  it('should rank matches near the start of the line higher', async function () {
    setProjectProvider(() => makeFs({ '/include/nes.h': NES_H }));
    const ts = new ToolchainSource();
    const hits = await ts.query('PPU', 10);
    assert.ok(hits.length >= 2, 'PPU matches several lines');
    // Earliest-column hit first (PPU_CTRL at col 17 is #define PPU_CTRL); the
    // column-based score should order them without any flakiness
    const cols = hits.map(h => h.ranges ? h.ranges[0] : 0);
    for (let i = 1; i < cols.length; i++) {
      assert.ok(cols[i - 1] <= cols[i], 'hits sorted by column');
    }
  });

  it('should skip non-searchable file types', async function () {
    const ts = new ToolchainSource();
    assert.strictEqual((ts as any).isSearchable('/include/nes.h'), true);
    assert.strictEqual((ts as any).isSearchable('/include/nes.o'), false);
    assert.strictEqual((ts as any).isSearchable('/lib/binary.bin'), false);
    assert.strictEqual((ts as any).isSearchable('/scripts/makefile'), true); // no ext
  });

  it('should handle missing worker gracefully', async function () {
    setProjectProvider(() => ({
      mainPath: 'main.c',
      iterateFiles: (cb: any) => {},
    }));
    const ts = new ToolchainSource();
    const hits = await ts.query('anything', 10);
    assert.deepStrictEqual(hits, []);
  });
});