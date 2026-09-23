"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const memmaplayout_1 = require("../../src/ide/views/memmaplayout");
const oscar64parse_1 = require("../../src/worker/tools/oscar64parse");
const native = [
    { name: 'RAM', start: 0x0000, size: 0x800, type: 'ram', source: 'native' },
    { name: 'PPU', start: 0x2000, size: 0x8, type: 'io', source: 'native' },
    { name: 'ROM', start: 0x8000, size: 0x8000, type: 'rom', source: 'native' },
];
const linker = [
    { name: 'ZP', start: 0x00, size: 0x20, type: 'ram', source: 'linker' },
    { name: 'BSS', start: 0x300, size: 0x100, type: 'ram', source: 'linker' },
    { name: 'CODE', start: 0x8000, size: 0x1000, type: 'rom', source: 'linker' },
];
(0, mocha_1.describe)('Memory map layout', function () {
    (0, mocha_1.it)('fills gaps in the native column', function () {
        const layout = (0, memmaplayout_1.computeMemoryMapLayout)(native);
        assert_1.default.equal(layout.columns.length, 1);
        const col = layout.columns[0];
        assert_1.default.equal(col.id, 'native');
        const blocks = col.blocks.slice().sort((a, b) => a.start - b.start);
        assert_1.default.deepEqual(blocks.map(b => [b.start, b.end, b.type]), [
            [0x0000, 0x0800, 'ram'],
            [0x0800, 0x2000, 'unmapped'],
            [0x2000, 0x2008, 'io'],
            [0x2008, 0x8000, 'unmapped'],
            [0x8000, 0x10000, 'rom'],
        ]);
        assert_1.default.equal(col.lanes, 1);
    });
    (0, mocha_1.it)('separates native and linker columns on shared bounds', function () {
        const layout = (0, memmaplayout_1.computeMemoryMapLayout)(native.concat(linker));
        assert_1.default.deepEqual(layout.columns.map(c => c.id), ['native', 'linker']);
        const lnk = layout.columns[1];
        assert_1.default.ok(lnk.blocks.some(b => b.type == 'free' && b.start == 0x20 && b.end == 0x300));
        for (const col of layout.columns)
            for (const b of col.blocks) {
                assert_1.default.ok(layout.bounds.includes(b.start));
                assert_1.default.ok(layout.bounds.includes(b.end));
            }
    });
    (0, mocha_1.it)('puts overlapping segments in separate lanes', function () {
        const layout = (0, memmaplayout_1.computeMemoryMapLayout)([
            { name: 'ROM', start: 0xd000, size: 0x3000, type: 'rom', source: 'native' },
            { name: 'LC', start: 0xd000, size: 0x1000, type: 'ram', source: 'native' },
        ]);
        const col = layout.columns[0];
        assert_1.default.equal(col.lanes, 2);
        assert_1.default.deepEqual(col.blocks.filter(b => b.start == 0xd000).map(b => b.lane).sort(), [0, 1]);
    });
    (0, mocha_1.it)('folds overlaps beyond the lane limit into a visible block', function () {
        const hdr = (name, size) => ({ name, start: 0, size, source: 'linker' });
        const layout = (0, memmaplayout_1.computeMemoryMapLayout)([hdr('EXEHDR', 2), hdr('MAINHDR', 4), hdr('SYSCHKHDR', 4), hdr('AUTOSTRT', 6)]);
        const col = layout.columns[0];
        assert_1.default.equal(col.lanes, 2);
        assert_1.default.equal(col.blocks.length, 2);
        const hidden = col.blocks.flatMap(b => (b.hidden || []).map(h => h.name)).sort();
        assert_1.default.deepEqual(hidden, ['EXEHDR', 'SYSCHKHDR']);
    });
    (0, mocha_1.it)('finds large variables from symbol gaps', function () {
        const symbols = {
            _small: 0x300, _buffer: 0x302, _last: 0x380,
            __BSS_RUN__: 0x300, _code: 0x8000, _zp: 0x10,
        };
        const vars = (0, memmaplayout_1.findLargeVariables)(symbols, native.concat(linker), { minVarSize: 16 });
        assert_1.default.deepEqual(vars.map(v => [v.name, v.start, v.end]), [
            ['_last', 0x380, 0x400],
            ['_buffer', 0x302, 0x380],
            ['_zp', 0x10, 0x20],
        ]);
    });
    (0, mocha_1.it)('skips the last symbol of a native-only RAM segment', function () {
        const vars = (0, memmaplayout_1.findLargeVariables)({ _a: 0x100, _b: 0x200 }, native, { minVarSize: 16 });
        assert_1.default.deepEqual(vars.map(v => v.name), ['_a']);
    });
    (0, mocha_1.it)('uses reported symbol sizes over gap estimates', function () {
        const symbols = { _a: 0x300, _b: 0x340, ZeroStart: 0x380, _c: 0x380 };
        const sizes = { _a: 20, _b: 8, ZeroStart: 0, _c: 0x40 };
        const vars = (0, memmaplayout_1.findLargeVariables)(symbols, native.concat(linker), { minVarSize: 16 }, sizes);
        assert_1.default.deepEqual(vars.map(v => [v.name, v.start, v.end, !!v.approx]), [
            ['_c', 0x380, 0x3c0, false],
            ['_a', 0x300, 0x314, false],
        ]);
    });
    (0, mocha_1.it)('reads object sizes from an oscar64 map', function () {
        const map = [
            'sections',
            '0a27 - 0a32 : DATA, data',
            '',
            'objects',
            '00f7 - 00f8 : c1A, DATA:zeropage',
            '00f7 - 00f7 : ZeroStart, START:zeropage',
            '0a32 - 0a5a : xbuf, DATA:bss',
            '0b00 - 0c00 : sinustable, DATA:data',
            '',
            'objects by size',
            '0b00 (0100) : sinustable, DATA:data',
        ].join('\n');
        const { symbolmap, symbolsizes } = (0, oscar64parse_1.parseOscar64Map)(map);
        assert_1.default.equal(symbolmap.xbuf, 0x0a32);
        assert_1.default.deepEqual(symbolsizes, { c1A: 1, ZeroStart: 0, xbuf: 40, sinustable: 256 });
    });
});
//# sourceMappingURL=testmemmaplayout.js.map