"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const sdcc_1 = require("../../src/worker/tools/sdcc");
(0, mocha_1.describe)('sdcc symbol sizes', function () {
    const segments = [{ start: 0x2000, size: 0x10 }, { start: 0x100, size: 0x40 }];
    (0, mocha_1.it)('sizes a symbol up to the next one, and the last up to its segment end', function () {
        const sizes = (0, sdcc_1.inferSymbolSizes)({ _a: 0x2000, _b: 0x2001, _c: 0x2003 }, segments);
        assert_1.default.deepStrictEqual(sizes, { _a: 1, _b: 2, _c: 0xd });
    });
    (0, mocha_1.it)('gives aliases the same size, and skips bounds, debug labels and outsiders', function () {
        const sizes = (0, sdcc_1.inferSymbolSizes)({
            _a: 0x2000, _alias: 0x2000, _b: 0x2004, s__DATA: 0x2000, l__DATA: 0x10,
            'G$f$0$0': 0x2002, _rom: 0x100, _far: 0x9000,
        }, segments);
        assert_1.default.deepStrictEqual(sizes, { _a: 4, _alias: 4, _b: 0xc, _rom: 0x40 });
    });
});
//# sourceMappingURL=testsdccsizes.js.map