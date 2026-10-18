"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const dumplines_1 = require("../../src/common/symbols/dumplines");
function labelAt(lines, addr) {
    const line = lines.find((l) => addr >= l.a && addr < l.a + l.l);
    return line && line.s;
}
(0, mocha_1.describe)('Memory dump symbol ranges', function () {
    (0, mocha_1.it)('labels only the bytes of a sized symbol', function () {
        const lines = (0, dumplines_1.computeDumpLines)({ 0x100: 'a', 0x180: 'b', 0x10000: '__END__' }, { a: 0x20, b: 0x10 });
        assert_1.default.strictEqual(labelAt(lines, 0x100), 'a');
        assert_1.default.strictEqual(labelAt(lines, 0x11f), 'a');
        assert_1.default.strictEqual(labelAt(lines, 0x120), '');
        assert_1.default.strictEqual(labelAt(lines, 0x17f), '');
        assert_1.default.strictEqual(labelAt(lines, 0x180), 'b');
        assert_1.default.strictEqual(labelAt(lines, 0x190), '');
        assert_1.default.deepStrictEqual(lines.filter((l) => l.s == 'a').map((l) => [l.a, l.l]), [[0x100, 0x10], [0x110, 0x10]]);
    });
    (0, mocha_1.it)('extends an unsized symbol only to its segment boundary', function () {
        const lines = (0, dumplines_1.computeDumpLines)({ 0x100: 'a', 0x150: 'b', 0x10000: '__END__' }, null, [{ name: 'CODE', start: 0x100, size: 0x20, type: 'rom' }]);
        assert_1.default.strictEqual(labelAt(lines, 0x11f), 'a');
        assert_1.default.strictEqual(labelAt(lines, 0x120), '');
        assert_1.default.strictEqual(labelAt(lines, 0x14f), '');
        assert_1.default.strictEqual(labelAt(lines, 0x150), 'b');
    });
    (0, mocha_1.it)('trusts a size over a segment boundary', function () {
        const lines = (0, dumplines_1.computeDumpLines)({ 0x100: 'a', 0x200: 'b', 0x10000: '__END__' }, { a: 0x40 }, [{ name: 'CODE', start: 0x100, size: 0x20, type: 'rom' }]);
        assert_1.default.strictEqual(labelAt(lines, 0x11f), 'a');
        assert_1.default.strictEqual(labelAt(lines, 0x120), 'a');
        assert_1.default.strictEqual(labelAt(lines, 0x13f), 'a');
        assert_1.default.strictEqual(labelAt(lines, 0x140), '');
    });
    (0, mocha_1.it)('stops a size at the next symbol', function () {
        const lines = (0, dumplines_1.computeDumpLines)({ 0x100: 'a', 0x110: 'b', 0x10000: '__END__' }, { a: 0x40, b: 1 });
        assert_1.default.strictEqual(labelAt(lines, 0x10f), 'a');
        assert_1.default.strictEqual(labelAt(lines, 0x110), 'b');
        assert_1.default.strictEqual(labelAt(lines, 0x111), '');
    });
    (0, mocha_1.it)('keeps the old gap behavior without a size or segment', function () {
        const lines = (0, dumplines_1.computeDumpLines)({ 0x100: 'a', 0x200: 'b', 0x10000: '__END__' });
        assert_1.default.strictEqual(labelAt(lines, 0x180), 'a');
        assert_1.default.strictEqual(labelAt(lines, 0x200), 'b');
    });
});
//# sourceMappingURL=testdumplines.js.map