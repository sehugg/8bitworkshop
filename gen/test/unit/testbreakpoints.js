"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const breakcond_1 = require("../../src/common/breakcond");
const breakpoints_1 = require("../../src/common/breakpoints");
const symbolfile_1 = require("../../src/common/symbols/symbolfile");
const workertypes_1 = require("../../src/common/workertypes");
const assert_1 = __importDefault(require("assert"));
const ctx = {
    cpuFields: new Set(['PC', 'A', 'X', 'Y', 'SP']),
    symbol: (name) => ({ mainloop: 0x800, foo: 0x20 }[name]),
    readMem: (a) => (a == 0x10 ? 0x2a : 0),
    readVRAM: (a) => (a == 0x2000 ? 0x80 : 0),
    hw: {
        scanline: () => 150,
        lineclock: () => 40,
    },
};
function evalc(src, c) {
    return (0, breakcond_1.compileCondition)(src, ctx)(c);
}
(0, mocha_1.describe)('Breakpoints', () => {
    it('should evaluate register comparisons', () => {
        let c = { PC: 0x800, A: 5, X: 3, Y: 0, SP: 0x1ff };
        assert_1.default.equal(evalc('A == 5', c), true);
        assert_1.default.equal(evalc('A != 5', c), false);
        assert_1.default.equal(evalc('A < 5', c), false);
        assert_1.default.equal(evalc('A <= 5', c), true);
        assert_1.default.equal(evalc('X > 2 && X < 4', c), true);
        assert_1.default.equal(evalc('A == 5 && X == 4', c), false);
        assert_1.default.equal(evalc('A == 5 || X == 4', c), true);
        assert_1.default.equal(evalc('!(A == 5)', c), false);
    });
    it('should parse numbers', () => {
        let c = { PC: 0, A: 0xff };
        assert_1.default.equal(evalc('A == $ff', c), true);
        assert_1.default.equal(evalc('A == 0xff', c), true);
        assert_1.default.equal(evalc('A == 255', c), true);
        assert_1.default.equal(evalc('A == $FF', c), true);
    });
    it('should resolve symbols at compile time', () => {
        let c = { PC: 0x800, A: 0 };
        assert_1.default.equal(evalc('PC == mainloop', c), true);
        assert_1.default.equal(evalc('A == foo', c), false);
        assert_1.default.throws(() => (0, breakcond_1.compileCondition)('A == bar', ctx));
    });
    it('should support memory reads', () => {
        let c = { PC: 0, A: 0x2a };
        assert_1.default.equal(evalc('[0x10] == $2a', c), true);
        assert_1.default.equal(evalc('A == [$10]', c), true);
        assert_1.default.equal(evalc('[foo] == 0', c), true); // foo is at $20, memory there reads 0
        assert_1.default.equal(evalc('[0x99] == 0', c), true);
        // explicit main-memory space is a synonym for plain [expr]
        assert_1.default.equal(evalc('#mem[0x10] == $2a', c), true);
        assert_1.default.equal(evalc('#ram[0x10] == $2a', c), true);
    });
    it('should support VRAM reads', () => {
        let c = { PC: 0 };
        assert_1.default.equal(evalc('#vram[0x2000] == $80', c), true);
        assert_1.default.equal(evalc('#vram[0x2000] != $80', c), false);
        assert_1.default.equal(evalc('#vram[0x9999] == 0', c), true);
    });
    it('should support 16-bit reads', () => {
        // little-endian: $10 holds $2a, $11 holds $01 -> $012a
        let ctx16 = Object.assign(Object.assign({}, ctx), { readMem: (a) => (a == 0x10 ? 0x2a : a == 0x11 ? 0x01 : 0) });
        let c = { PC: 0 };
        assert_1.default.equal((0, breakcond_1.compileCondition)('#mem16[0x10] == $012a', ctx16)(c), true);
        assert_1.default.equal((0, breakcond_1.compileCondition)('#ram16[0x10] == $012a', ctx16)(c), true);
        assert_1.default.equal(evalc('#mem16[0x99] == $0000', c), true); // both bytes read 0
        assert_1.default.equal(evalc('#vram16[0x2000] == $0080', c), true);
    });
    it('should support hardware accessors', () => {
        let c = { PC: 0 };
        assert_1.default.equal(evalc('#scanline == 150', c), true);
        assert_1.default.equal(evalc('#scanline > 100 && #lineclock < 50', c), true);
    });
    it('should reject unknown hardware accessors and spaces', () => {
        assert_1.default.throws(() => (0, breakcond_1.compileCondition)('#foo == 1', ctx));
        assert_1.default.throws(() => (0, breakcond_1.compileCondition)('#bogus[0] == 1', ctx));
        assert_1.default.throws(() => (0, breakcond_1.compileCondition)('# == 1', ctx));
    });
    it('should support arithmetic and bitwise ops', () => {
        let c = { PC: 0, A: 0x0f, X: 2 };
        assert_1.default.equal(evalc('A + 1 == $10', c), true);
        assert_1.default.equal(evalc('A * 2 == $1e', c), true);
        assert_1.default.equal(evalc('A / 4 == 3', c), true);
        assert_1.default.equal(evalc('A % 4 == 3', c), true);
        assert_1.default.equal(evalc('(A & $0f) == $0f', c), true);
        assert_1.default.equal(evalc('(A | $f0) == $ff', c), true);
        assert_1.default.equal(evalc('(A ^ $0f) == 0', c), true);
        assert_1.default.equal(evalc('A & ($0f == $0f)', c), true); // == binds tighter than &
        assert_1.default.equal(evalc('1 << X == 4', c), true);
        assert_1.default.equal(evalc('A >> 2 == 3', c), true);
        assert_1.default.equal(evalc('~A == -$10', c), true);
        assert_1.default.equal(evalc('-A == -15', c), true);
    });
    it('should support parentheses and precedence', () => {
        let c = { PC: 0, A: 3, X: 4 };
        assert_1.default.equal(evalc('(A + 1) * X == $10', c), true);
        assert_1.default.equal(evalc('A + 1 * X == 7', c), true);
        assert_1.default.equal(evalc('A == 3 && X == 4 || A == 9', c), true);
    });
    it('should not throw at eval time', () => {
        let c = { PC: 0, A: 0 };
        // division by zero, unreadable memory: condition is just false
        assert_1.default.equal(evalc('A / 0 == 1', c), false);
        assert_1.default.equal(evalc('A % 0 == 1', c), false);
    });
    it('should reject bad syntax', () => {
        assert_1.default.throws(() => (0, breakcond_1.compileCondition)('A ==', ctx));
        assert_1.default.throws(() => (0, breakcond_1.compileCondition)('A == (5', ctx));
        assert_1.default.throws(() => (0, breakcond_1.compileCondition)('A @ 5', ctx));
        assert_1.default.throws(() => (0, breakcond_1.compileCondition)('== 5', ctx));
        assert_1.default.throws(() => (0, breakcond_1.compileCondition)('', ctx));
        assert_1.default.throws(() => (0, breakcond_1.compileCondition)('A == 5 3', ctx));
    });
    it('should reject unknown identifiers', () => {
        assert_1.default.throws(() => (0, breakcond_1.compileCondition)('QQ == 5', ctx));
        // identifiers that look like symbols but aren't in the map either
        assert_1.default.throws(() => (0, breakcond_1.compileCondition)('[QQQ] == 5', ctx));
    });
    it('should parse targets', () => {
        const sym = (name) => ({ mainloop: 0x800 }[name]);
        assert_1.default.equal((0, breakcond_1.parseTarget)('$1234', sym).pc, 0x1234);
        assert_1.default.equal((0, breakcond_1.parseTarget)('0xABC', sym).pc, 0xabc);
        assert_1.default.equal((0, breakcond_1.parseTarget)('48879', sym).pc, 0xbeef);
        assert_1.default.equal((0, breakcond_1.parseTarget)('mainloop', sym).pc, 0x800);
        assert_1.default.ok((0, breakcond_1.parseTarget)('nosuch', sym).error);
        assert_1.default.ok((0, breakcond_1.parseTarget)('', sym).error);
        assert_1.default.ok((0, breakcond_1.parseTarget)('12ab', sym).error); // neither number nor symbol
    });
});
(0, mocha_1.describe)('Breakpoint resolution (shared by IDE, CLI, debug adapter)', () => {
    const symbols = { _main: 0x1234, mainloop: 0x800, vblank: 0x900 };
    const sourcefile = new workertypes_1.SourceFile([{ line: 10, offset: 0x1234 }], '');
    const ctx = {
        symbols,
        getListingForFile: (path) => path == 'game.c' ? { lines: [], sourcefile } : undefined,
        platform: {
            getCPUState: () => ({ PC: 0x1234, A: 7 }),
            readAddress: (a) => (a == 0x10 ? 0x2a : 0),
        },
    };
    const bp = (patch) => (Object.assign({ id: 1, type: 'address', enabled: true }, patch));
    it('should resolve a symbol, with or without the C underscore', () => {
        assert_1.default.equal((0, breakpoints_1.resolveBreakpoint)(bp({ target: 'mainloop' }), ctx).pc, 0x800);
        assert_1.default.equal((0, breakpoints_1.resolveBreakpoint)(bp({ target: '_main' }), ctx).pc, 0x1234);
        assert_1.default.equal((0, breakpoints_1.resolveBreakpoint)(bp({ target: 'main' }), ctx).pc, 0x1234);
        assert_1.default.ok((0, breakpoints_1.resolveBreakpoint)(bp({ target: 'nosuch' }), ctx).error);
    });
    it('should resolve a source line through the listing', () => {
        assert_1.default.equal((0, breakpoints_1.resolveBreakpoint)(bp({ type: 'source', file: 'game.c', line: 10 }), ctx).pc, 0x1234);
        assert_1.default.equal((0, breakpoints_1.resolveBreakpoint)(bp({ type: 'source', file: 'game.c', line: 11 }), ctx).error, 'line has no code');
        assert_1.default.equal((0, breakpoints_1.resolveBreakpoint)(bp({ type: 'source', file: 'other.c', line: 10 }), ctx).error, 'no debug info (build first?)');
    });
    it('should compile a condition against the host platform', () => {
        let r = (0, breakpoints_1.resolveBreakpoint)(bp({ target: '$800', condition: 'A == 7 && [$10] == 42' }), ctx);
        assert_1.default.equal(r.pc, 0x800);
        assert_1.default.equal(r.condFn({ A: 7 }), true);
        assert_1.default.equal(r.condFn({ A: 6 }), false);
    });
    it('should work without a platform or listings', () => {
        assert_1.default.equal((0, breakpoints_1.resolveBreakpoint)(bp({ target: '$c000' }), {}).pc, 0xc000);
        assert_1.default.ok((0, breakpoints_1.resolveBreakpoint)(bp({ type: 'source', file: 'game.c', line: 10 }), {}).error);
    });
    it('should report whether a platform can stop at breakpoints', () => {
        assert_1.default.equal((0, breakpoints_1.canUseBreakpoints)(null), false);
        assert_1.default.equal((0, breakpoints_1.canUseBreakpoints)({ runEval: () => { } }), true);
    });
});
(0, mocha_1.describe)('Symbol files', () => {
    it('should parse ca65 and VICE label files', () => {
        let syms = (0, symbolfile_1.parseSymbolFile)('main = $1234 ;\nal 00C000 .vblank\nadd_label 0800 loop\n');
        assert_1.default.deepEqual(syms, { main: 0x1234, vblank: 0xc000, loop: 0x800 });
    });
    it('should look up names as a user types them', () => {
        let syms = { _main: 1, loop: 2 };
        assert_1.default.equal((0, symbolfile_1.lookupSymbol)(syms, '_main'), 1);
        assert_1.default.equal((0, symbolfile_1.lookupSymbol)(syms, 'main'), 1);
        assert_1.default.equal((0, symbolfile_1.lookupSymbol)(syms, '.loop'), 2);
        assert_1.default.equal((0, symbolfile_1.lookupSymbol)(syms, 'nope'), undefined);
        assert_1.default.equal((0, symbolfile_1.lookupSymbol)(null, 'main'), undefined);
    });
});
//# sourceMappingURL=testbreakpoints.js.map