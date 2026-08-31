"use strict";
/**
 * ToolchainSource tests - dumb full-text search over the worker's bundled
 * header files. The worker is mocked by providing a queryWorker on the
 * stubbed project (same provider injection as ProjectSource).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const toolchainsource_1 = require("../../src/ide/search/toolchainsource");
const projectsource_1 = require("../../src/ide/search/projectsource");
/** Build a fake "worker" backed by a hash of paths -> text. */
function makeFs(files) {
    const paths = Object.keys(files).sort();
    return {
        mainPath: 'main.c',
        platform_id: 'nes',
        iterateFiles: (cb) => { },
        getToolForFilename: () => 'cc65',
        queryWorker: async (msg) => {
            if (msg.listshared != null) {
                const prefix = msg.listshared + '/';
                return { output: paths.filter(p => p.startsWith(prefix)) };
            }
            if (msg.readshared != null) {
                const text = files[msg.readshared];
                if (text == null)
                    return { output: null };
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
        (0, projectsource_1.setProjectProvider)(() => null);
    });
    it('should list and lazily search bundled header files', async function () {
        (0, projectsource_1.setProjectProvider)(() => makeFs({ '/include/nes.h': NES_H, '/include/apple.h': APPLE_H }));
        const ts = new toolchainsource_1.ToolchainSource();
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
        (0, projectsource_1.setProjectProvider)(() => makeFs({ '/include/nes.h': NES_H }));
        const ts = new toolchainsource_1.ToolchainSource();
        const hits = await ts.query('vblank', 10);
        assert.ok(hits.length >= 1);
    });
    it('should require at least 2 chars', async function () {
        (0, projectsource_1.setProjectProvider)(() => makeFs({ '/include/nes.h': NES_H }));
        const ts = new toolchainsource_1.ToolchainSource();
        const hits = await ts.query('x', 10);
        assert.strictEqual(hits.length, 0);
    });
    it('should load files in batches across queries', async function () {
        const fs = makeFs({ '/include/nes.h': NES_H, '/include/apple.h': APPLE_H });
        (0, projectsource_1.setProjectProvider)(() => fs);
        const ts = new toolchainsource_1.ToolchainSource();
        // Shrink batch so a query only loads a subset
        ts.files = ['/include/nes.h', '/include/apple.h'];
        ts.loadIdx = 0;
        ts.fsName = '65-nes';
        ts.readyDone = true;
        ts.batchSize = 1;
        // First query: only nes.h loaded
        let hits = await ts.query('VBLANK', 10);
        assert.ok(hits.length >= 1, 'nes.h loaded in first batch');
        assert.strictEqual(ts['loaded'].size, 1);
        // Second query: apple.h loaded too
        hits = await ts.query('VBLANK', 10);
        assert.strictEqual(ts['loaded'].size, 2);
    });
    it('should rank matches near the start of the line higher', async function () {
        (0, projectsource_1.setProjectProvider)(() => makeFs({ '/include/nes.h': NES_H }));
        const ts = new toolchainsource_1.ToolchainSource();
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
        const ts = new toolchainsource_1.ToolchainSource();
        assert.strictEqual(ts.isSearchable('/include/nes.h'), true);
        assert.strictEqual(ts.isSearchable('/include/nes.o'), false);
        assert.strictEqual(ts.isSearchable('/lib/binary.bin'), false);
        assert.strictEqual(ts.isSearchable('/scripts/makefile'), true); // no ext
    });
    it('should handle missing worker gracefully', async function () {
        (0, projectsource_1.setProjectProvider)(() => ({
            mainPath: 'main.c',
            iterateFiles: (cb) => { },
        }));
        const ts = new toolchainsource_1.ToolchainSource();
        const hits = await ts.query('anything', 10);
        assert.deepStrictEqual(hits, []);
    });
});
//# sourceMappingURL=testsearchtoolchain.js.map