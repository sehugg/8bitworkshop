"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const breakcond_1 = require("../../src/ide/breakcond");
const assert_1 = __importDefault(require("assert"));
const ctx = {
    cpuFields: new Set(['PC', 'A', 'X', 'Y', 'SP']),
    symbol: (name) => ({ mainloop: 0x800, foo: 0x20 }[name]),
    readMem: (a) => (a == 0x10 ? 0x2a : 0),
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
//# sourceMappingURL=testbreakpoints.js.map