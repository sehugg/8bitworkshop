"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const books_1 = require("../../src/common/books");
(0, mocha_1.describe)('bookFor', function () {
    (0, mocha_1.it)('finds the book for a platform and its variants', function () {
        var _a, _b, _c, _d, _e;
        assert_1.default.equal((_a = (0, books_1.bookFor)('nes')) === null || _a === void 0 ? void 0 : _a.id, 'nes');
        assert_1.default.equal((_b = (0, books_1.bookFor)('nes-asm')) === null || _b === void 0 ? void 0 : _b.id, 'nes');
        assert_1.default.equal((_c = (0, books_1.bookFor)('vcs.mame')) === null || _c === void 0 ? void 0 : _c.id, 'vcs');
        assert_1.default.equal((_d = (0, books_1.bookFor)('verilog-vga')) === null || _d === void 0 ? void 0 : _d.id, 'verilog');
        assert_1.default.equal((_e = (0, books_1.bookFor)('c64')) === null || _e === void 0 ? void 0 : _e.id, 'c64');
    });
    (0, mocha_1.it)('covers only the arcade platforms in the arcade book', function () {
        var _a;
        for (var p of ['mw8080bw', 'vicdual', 'galaxian-scramble', 'vector-z80color', 'williams-z80'])
            assert_1.default.equal((_a = (0, books_1.bookFor)(p)) === null || _a === void 0 ? void 0 : _a.id, 'arcade', p);
        for (var p of ['williams', 'vector-ataricolor', 'coleco', 'gb', 'msx', 'apple2'])
            assert_1.default.equal((0, books_1.bookFor)(p), undefined, p);
    });
});
//# sourceMappingURL=testbooks.js.map