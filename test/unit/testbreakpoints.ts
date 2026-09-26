import { describe } from "mocha";
import { compileCondition, parseTarget } from "../../src/common/breakcond";
import { Breakpoint, BreakpointContext, canUseBreakpoints, resolveBreakpoint } from "../../src/common/breakpoints";
import { lookupSymbol, parseSymbolFile } from "../../src/common/symbols/symbolfile";
import { SourceFile } from "../../src/common/workertypes";
import assert from "assert";

const ctx = {
    cpuFields: new Set(['PC', 'A', 'X', 'Y', 'SP']),
    symbol: (name: string) => ({ mainloop: 0x800, foo: 0x20 } as { [k: string]: number })[name],
    readMem: (a: number) => (a == 0x10 ? 0x2a : 0),
    readVRAM: (a: number) => (a == 0x2000 ? 0x80 : 0),
    hw: {
        scanline: () => 150,
        lineclock: () => 40,
    },
};

function evalc(src: string, c: any): boolean {
    return compileCondition(src, ctx)(c);
}

describe('Breakpoints', () => {

    it('should evaluate register comparisons', () => {
        let c = { PC: 0x800, A: 5, X: 3, Y: 0, SP: 0x1ff };
        assert.equal(evalc('A == 5', c), true);
        assert.equal(evalc('A != 5', c), false);
        assert.equal(evalc('A < 5', c), false);
        assert.equal(evalc('A <= 5', c), true);
        assert.equal(evalc('X > 2 && X < 4', c), true);
        assert.equal(evalc('A == 5 && X == 4', c), false);
        assert.equal(evalc('A == 5 || X == 4', c), true);
        assert.equal(evalc('!(A == 5)', c), false);
    });

    it('should parse numbers', () => {
        let c = { PC: 0, A: 0xff };
        assert.equal(evalc('A == $ff', c), true);
        assert.equal(evalc('A == 0xff', c), true);
        assert.equal(evalc('A == 255', c), true);
        assert.equal(evalc('A == $FF', c), true);
    });

    it('should resolve symbols at compile time', () => {
        let c = { PC: 0x800, A: 0 };
        assert.equal(evalc('PC == mainloop', c), true);
        assert.equal(evalc('A == foo', c), false);
        assert.throws(() => compileCondition('A == bar', ctx));
    });

    it('should support memory reads', () => {
        let c = { PC: 0, A: 0x2a };
        assert.equal(evalc('[0x10] == $2a', c), true);
        assert.equal(evalc('A == [$10]', c), true);
        assert.equal(evalc('[foo] == 0', c), true); // foo is at $20, memory there reads 0
        assert.equal(evalc('[0x99] == 0', c), true);
        // explicit main-memory space is a synonym for plain [expr]
        assert.equal(evalc('#mem[0x10] == $2a', c), true);
        assert.equal(evalc('#ram[0x10] == $2a', c), true);
    });

    it('should support VRAM reads', () => {
        let c = { PC: 0 };
        assert.equal(evalc('#vram[0x2000] == $80', c), true);
        assert.equal(evalc('#vram[0x2000] != $80', c), false);
        assert.equal(evalc('#vram[0x9999] == 0', c), true);
    });

    it('should support 16-bit reads', () => {
        // little-endian: $10 holds $2a, $11 holds $01 -> $012a
        let ctx16 = { ...ctx, readMem: (a: number) => (a == 0x10 ? 0x2a : a == 0x11 ? 0x01 : 0) };
        let c = { PC: 0 };
        assert.equal(compileCondition('#mem16[0x10] == $012a', ctx16)(c), true);
        assert.equal(compileCondition('#ram16[0x10] == $012a', ctx16)(c), true);
        assert.equal(evalc('#mem16[0x99] == $0000', c), true); // both bytes read 0
        assert.equal(evalc('#vram16[0x2000] == $0080', c), true);
    });

    it('should support hardware accessors', () => {
        let c = { PC: 0 };
        assert.equal(evalc('#scanline == 150', c), true);
        assert.equal(evalc('#scanline > 100 && #lineclock < 50', c), true);
    });

    it('should reject unknown hardware accessors and spaces', () => {
        assert.throws(() => compileCondition('#foo == 1', ctx));
        assert.throws(() => compileCondition('#bogus[0] == 1', ctx));
        assert.throws(() => compileCondition('# == 1', ctx));
    });

    it('should support arithmetic and bitwise ops', () => {
        let c = { PC: 0, A: 0x0f, X: 2 };
        assert.equal(evalc('A + 1 == $10', c), true);
        assert.equal(evalc('A * 2 == $1e', c), true);
        assert.equal(evalc('A / 4 == 3', c), true);
        assert.equal(evalc('A % 4 == 3', c), true);
        assert.equal(evalc('(A & $0f) == $0f', c), true);
        assert.equal(evalc('(A | $f0) == $ff', c), true);
        assert.equal(evalc('(A ^ $0f) == 0', c), true);
        assert.equal(evalc('A & ($0f == $0f)', c), true); // == binds tighter than &
        assert.equal(evalc('1 << X == 4', c), true);
        assert.equal(evalc('A >> 2 == 3', c), true);
        assert.equal(evalc('~A == -$10', c), true);
        assert.equal(evalc('-A == -15', c), true);
    });

    it('should support parentheses and precedence', () => {
        let c = { PC: 0, A: 3, X: 4 };
        assert.equal(evalc('(A + 1) * X == $10', c), true);
        assert.equal(evalc('A + 1 * X == 7', c), true);
        assert.equal(evalc('A == 3 && X == 4 || A == 9', c), true);
    });

    it('should not throw at eval time', () => {
        let c = { PC: 0, A: 0 };
        // division by zero, unreadable memory: condition is just false
        assert.equal(evalc('A / 0 == 1', c), false);
        assert.equal(evalc('A % 0 == 1', c), false);
    });

    it('should reject bad syntax', () => {
        assert.throws(() => compileCondition('A ==', ctx));
        assert.throws(() => compileCondition('A == (5', ctx));
        assert.throws(() => compileCondition('A @ 5', ctx));
        assert.throws(() => compileCondition('== 5', ctx));
        assert.throws(() => compileCondition('', ctx));
        assert.throws(() => compileCondition('A == 5 3', ctx));
    });

    it('should reject unknown identifiers', () => {
        assert.throws(() => compileCondition('QQ == 5', ctx));
        // identifiers that look like symbols but aren't in the map either
        assert.throws(() => compileCondition('[QQQ] == 5', ctx));
    });

    it('should parse targets', () => {
        const sym = (name: string) => ({ mainloop: 0x800 } as { [k: string]: number })[name];
        assert.equal(parseTarget('$1234', sym).pc, 0x1234);
        assert.equal(parseTarget('0xABC', sym).pc, 0xabc);
        assert.equal(parseTarget('48879', sym).pc, 0xbeef);
        assert.equal(parseTarget('mainloop', sym).pc, 0x800);
        assert.ok(parseTarget('nosuch', sym).error);
        assert.ok(parseTarget('', sym).error);
        assert.ok(parseTarget('12ab', sym).error); // neither number nor symbol
    });
});

describe('Breakpoint resolution (shared by IDE, CLI, debug adapter)', () => {

    const symbols = { _main: 0x1234, mainloop: 0x800, vblank: 0x900 };
    const sourcefile = new SourceFile([{ line: 10, offset: 0x1234 } as any], '');
    const ctx: BreakpointContext = {
        symbols,
        getListingForFile: (path) => path == 'game.c' ? { lines: [], sourcefile } as any : undefined,
        platform: {
            getCPUState: () => ({ PC: 0x1234, A: 7 }),
            readAddress: (a: number) => (a == 0x10 ? 0x2a : 0),
        } as any,
    };
    const bp = (patch: Partial<Breakpoint>): Breakpoint => ({ id: 1, type: 'address', enabled: true, ...patch });

    it('should resolve a symbol, with or without the C underscore', () => {
        assert.equal(resolveBreakpoint(bp({ target: 'mainloop' }), ctx).pc, 0x800);
        assert.equal(resolveBreakpoint(bp({ target: '_main' }), ctx).pc, 0x1234);
        assert.equal(resolveBreakpoint(bp({ target: 'main' }), ctx).pc, 0x1234);
        assert.ok(resolveBreakpoint(bp({ target: 'nosuch' }), ctx).error);
    });
    it('should resolve a source line through the listing', () => {
        assert.equal(resolveBreakpoint(bp({ type: 'source', file: 'game.c', line: 10 }), ctx).pc, 0x1234);
        assert.equal(resolveBreakpoint(bp({ type: 'source', file: 'game.c', line: 11 }), ctx).error, 'line has no code');
        assert.equal(resolveBreakpoint(bp({ type: 'source', file: 'other.c', line: 10 }), ctx).error, 'no debug info (build first?)');
    });
    it('should compile a condition against the host platform', () => {
        let r = resolveBreakpoint(bp({ target: '$800', condition: 'A == 7 && [$10] == 42' }), ctx);
        assert.equal(r.pc, 0x800);
        assert.equal(r.condFn({ A: 7 }), true);
        assert.equal(r.condFn({ A: 6 }), false);
    });
    it('should work without a platform or listings', () => {
        assert.equal(resolveBreakpoint(bp({ target: '$c000' }), {}).pc, 0xc000);
        assert.ok(resolveBreakpoint(bp({ type: 'source', file: 'game.c', line: 10 }), {}).error);
    });
    it('should report whether a platform can stop at breakpoints', () => {
        assert.equal(canUseBreakpoints(null), false);
        assert.equal(canUseBreakpoints({ runEval: () => { } } as any), true);
    });
});

describe('Symbol files', () => {
    it('should parse ca65 and VICE label files', () => {
        let syms = parseSymbolFile('main = $1234 ;\nal 00C000 .vblank\nadd_label 0800 loop\n');
        assert.deepEqual(syms, { main: 0x1234, vblank: 0xc000, loop: 0x800 });
    });
    it('should look up names as a user types them', () => {
        let syms = { _main: 1, loop: 2 };
        assert.equal(lookupSymbol(syms, '_main'), 1);
        assert.equal(lookupSymbol(syms, 'main'), 1);
        assert.equal(lookupSymbol(syms, '.loop'), 2);
        assert.equal(lookupSymbol(syms, 'nope'), undefined);
        assert.equal(lookupSymbol(null, 'main'), undefined);
    });
});
