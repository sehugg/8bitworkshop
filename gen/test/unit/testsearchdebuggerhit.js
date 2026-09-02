"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const debuggerhit_1 = require("../../src/ide/search/debuggerhit");
const SYMBOLS = {
    main: 0xc000,
    JOY_READ: 0xf000,
    videoTop: 0x0200,
};
(0, mocha_1.describe)('DebuggerHit', function () {
    (0, mocha_1.describe)('resolveDebuggerTarget', function () {
        (0, mocha_1.it)('should resolve exact symbol names', function () {
            const t = (0, debuggerhit_1.resolveDebuggerTarget)('main', SYMBOLS);
            assert_1.default.ok(t);
            assert_1.default.strictEqual(t.addr, 0xc000);
            assert_1.default.strictEqual(t.isSymbol, true);
        });
        (0, mocha_1.it)('should resolve symbol names case-insensitively', function () {
            const t = (0, debuggerhit_1.resolveDebuggerTarget)('joy_read', SYMBOLS);
            assert_1.default.ok(t);
            assert_1.default.strictEqual(t.addr, 0xf000);
            assert_1.default.strictEqual(t.isSymbol, true);
        });
        (0, mocha_1.it)('should prefer symbol map over hex parse', function () {
            // "add" is valid hex (0xadd) but if a symbol exists, it wins
            const t = (0, debuggerhit_1.resolveDebuggerTarget)('add', { add: 0x123 });
            assert_1.default.ok(t);
            assert_1.default.strictEqual(t.addr, 0x123);
            assert_1.default.strictEqual(t.isSymbol, true);
        });
        (0, mocha_1.it)('should parse $-prefixed hex', function () {
            const t = (0, debuggerhit_1.resolveDebuggerTarget)('$c000');
            assert_1.default.ok(t);
            assert_1.default.strictEqual(t.addr, 0xc000);
            assert_1.default.strictEqual(t.isSymbol, false);
        });
        (0, mocha_1.it)('should parse 0x-prefixed hex', function () {
            const t = (0, debuggerhit_1.resolveDebuggerTarget)('0xC000');
            assert_1.default.ok(t);
            assert_1.default.strictEqual(t.addr, 0xc000);
            assert_1.default.strictEqual(t.isSymbol, false);
        });
        (0, mocha_1.it)('should parse bare hex digits', function () {
            const t = (0, debuggerhit_1.resolveDebuggerTarget)('C000');
            assert_1.default.ok(t);
            assert_1.default.strictEqual(t.addr, 0xc000);
            assert_1.default.strictEqual(t.isSymbol, false);
        });
        (0, mocha_1.it)('should return null for non-hex identifiers', function () {
            assert_1.default.strictEqual((0, debuggerhit_1.resolveDebuggerTarget)('zzz'), null);
            assert_1.default.strictEqual((0, debuggerhit_1.resolveDebuggerTarget)('main loop'), null);
            assert_1.default.strictEqual((0, debuggerhit_1.resolveDebuggerTarget)(''), null);
            assert_1.default.strictEqual((0, debuggerhit_1.resolveDebuggerTarget)('   '), null);
        });
        (0, mocha_1.it)('should return null for hex-like names when no symbol map exists... or resolve as hex', function () {
            // without a symbol map, hex-like needles still resolve (as raw hex)
            const t = (0, debuggerhit_1.resolveDebuggerTarget)('add');
            assert_1.default.ok(t);
            assert_1.default.strictEqual(t.addr, 0xadd);
            assert_1.default.strictEqual(t.isSymbol, false);
        });
    });
    (0, mocha_1.describe)('findSegmentAt', function () {
        const segs = [
            { name: 'Code', start: 0xc000, size: 0x1000, type: 'rom' },
            { name: 'RAM', start: 0x0200, size: 0x100, type: 'ram' },
            { name: 'IO', start: 0x8000, last: 0x8003, size: 0x4, type: 'io' },
        ];
        (0, mocha_1.it)('should find the segment containing an address', function () {
            var _a, _b;
            assert_1.default.strictEqual((_a = (0, debuggerhit_1.findSegmentAt)(0xc123, segs)) === null || _a === void 0 ? void 0 : _a.name, 'Code');
            assert_1.default.strictEqual((_b = (0, debuggerhit_1.findSegmentAt)(0x02ff, segs)) === null || _b === void 0 ? void 0 : _b.name, 'RAM');
        });
        (0, mocha_1.it)('should respect the last field when present', function () {
            var _a;
            assert_1.default.strictEqual((_a = (0, debuggerhit_1.findSegmentAt)(0x8003, segs)) === null || _a === void 0 ? void 0 : _a.name, 'IO');
            assert_1.default.strictEqual((0, debuggerhit_1.findSegmentAt)(0x8004, segs), null);
        });
        (0, mocha_1.it)('should return null for unmapped addresses', function () {
            assert_1.default.strictEqual((0, debuggerhit_1.findSegmentAt)(0x0000, segs), null);
            assert_1.default.strictEqual((0, debuggerhit_1.findSegmentAt)(0x10000, segs), null);
        });
        (0, mocha_1.it)('should handle missing segment lists', function () {
            assert_1.default.strictEqual((0, debuggerhit_1.findSegmentAt)(0xc000, undefined), null);
            assert_1.default.strictEqual((0, debuggerhit_1.findSegmentAt)(0xc000, []), null);
        });
    });
    (0, mocha_1.describe)('makeDebuggerHit', function () {
        (0, mocha_1.it)('should build a disassembler hit for code (rom) segments', function () {
            const segs = [{ name: 'Code', start: 0xc000, size: 0x1000, type: 'rom' }];
            const hit = (0, debuggerhit_1.makeDebuggerHit)('main', { addr: 0xc100, isSymbol: true }, segs);
            assert_1.default.strictEqual(hit.record.source, 'debugger');
            assert_1.default.strictEqual(hit.record.kind, 'label');
            assert_1.default.strictEqual(hit.record.brief, 'open in Disassembly');
            assert_1.default.strictEqual(hit.record.addr, 0xc100);
            assert_1.default.strictEqual(hit.record.name, 'main');
        });
        (0, mocha_1.it)('should build a memory browser hit for data (ram) segments', function () {
            const segs = [{ name: 'RAM', start: 0x0200, size: 0x100, type: 'ram' }];
            const hit = (0, debuggerhit_1.makeDebuggerHit)('videoTop', { addr: 0x0200, isSymbol: true }, segs);
            assert_1.default.strictEqual(hit.record.kind, 'var');
            assert_1.default.strictEqual(hit.record.brief, 'open in Memory Browser');
            assert_1.default.strictEqual(hit.record.addr, 0x0200);
        });
        (0, mocha_1.it)('should default to the memory browser when no segment matches', function () {
            const hit = (0, debuggerhit_1.makeDebuggerHit)('$9000', { addr: 0x9000, isSymbol: false }, []);
            assert_1.default.strictEqual(hit.record.kind, 'var');
            assert_1.default.strictEqual(hit.record.brief, 'open in Memory Browser');
        });
        (0, mocha_1.it)('should give debugger hits a low score so source hits rank first', function () {
            const hit = (0, debuggerhit_1.makeDebuggerHit)('main', { addr: 0xc000, isSymbol: true }, []);
            assert_1.default.ok(hit.score < 1000);
        });
    });
    (0, mocha_1.describe)('shouldOfferDebuggerHit', function () {
        (0, mocha_1.it)('should always offer exact symbol matches', function () {
            assert_1.default.strictEqual((0, debuggerhit_1.shouldOfferDebuggerHit)({ addr: 0xc000, isSymbol: true }, true), true);
            assert_1.default.strictEqual((0, debuggerhit_1.shouldOfferDebuggerHit)({ addr: 0xc000, isSymbol: true }, false), true);
        });
        (0, mocha_1.it)('should only offer raw hex when there are no other hits', function () {
            assert_1.default.strictEqual((0, debuggerhit_1.shouldOfferDebuggerHit)({ addr: 0xadd, isSymbol: false }, false), true);
            assert_1.default.strictEqual((0, debuggerhit_1.shouldOfferDebuggerHit)({ addr: 0xadd, isSymbol: false }, true), false);
        });
    });
});
//# sourceMappingURL=testsearchdebuggerhit.js.map