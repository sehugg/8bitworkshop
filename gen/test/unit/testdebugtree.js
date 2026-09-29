"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const debugtree_1 = require("../../src/common/debugtree");
(0, mocha_1.describe)('Debug tree', function () {
    const tree = {
        cpu: { PC: 0x1234, A: 7, halted: false, name: 'Z80' },
        ram: new Uint8Array(0x10000).map((_, i) => i & 0xff),
        regs: new Uint8Array([1, 2, 0xff]),
        words: new Uint16Array(20).fill(0xbeef),
        map: new Map([[1, 'one']]),
        big: Array.from({ length: 1000 }, (_, i) => i),
        lazy: { $$: () => ({ made: 1 }) },
        $$hidden: 1,
        ratio: 0.5,
    };
    (0, mocha_1.it)('lists a level with values and hides $$ names', function () {
        const top = (0, debugtree_1.treeChildren)(tree, []);
        assert_1.default.deepStrictEqual(top.map(e => e.name), ['cpu', 'ram', 'regs', 'words', 'map', 'big', 'lazy', 'ratio']);
        const cpu = (0, debugtree_1.treeChildren)(tree, ['cpu']);
        assert_1.default.deepStrictEqual(cpu, [
            { name: 'PC', value: '4660 ($1234)', expandable: false },
            { name: 'A', value: '7 ($07)', expandable: false },
            { name: 'halted', value: 'false', expandable: false },
            { name: 'name', value: 'Z80', expandable: false },
        ]);
        const regs = top.find(e => e.name === 'regs');
        assert_1.default.deepStrictEqual(regs, { name: 'regs', value: '01 02 FF', expandable: false });
        assert_1.default.strictEqual(top.find(e => e.name === 'ratio').value, '0.5');
    });
    (0, mocha_1.it)('splits a typed array into chunks of rows', function () {
        const chunks = (0, debugtree_1.treeChildren)(tree, ['ram']);
        assert_1.default.strictEqual(chunks.length, 256);
        assert_1.default.deepStrictEqual(chunks[1], { name: '$0100', value: '', expandable: true });
        const rows = (0, debugtree_1.treeChildren)(tree, ['ram', '$0100']);
        assert_1.default.strictEqual(rows.length, 16);
        assert_1.default.strictEqual(rows[1].name, '$0110');
        assert_1.default.strictEqual(rows[1].value, '10 11 12 13 14 15 16 17 18 19 1A 1B 1C 1D 1E 1F');
        assert_1.default.strictEqual(rows[1].expandable, false);
        const words = (0, debugtree_1.treeChildren)(tree, ['words']);
        assert_1.default.deepStrictEqual(words.map(e => e.name), ['$0000', '$0010']);
        assert_1.default.match(words[1].value, /^BEEF BEEF BEEF BEEF$/);
    });
    (0, mocha_1.it)('expands maps, lazy nodes and big arrays', function () {
        assert_1.default.deepStrictEqual((0, debugtree_1.treeChildren)(tree, ['map']), [{ name: '1', value: 'one', expandable: false }]);
        assert_1.default.deepStrictEqual((0, debugtree_1.treeChildren)(tree, ['lazy']), [{ name: 'made', value: '1 ($01)', expandable: false }]);
        const big = (0, debugtree_1.treeChildren)(tree, ['big']);
        assert_1.default.deepStrictEqual(big.map(e => e.name), ['$00', '$100', '$200', '$300']);
        assert_1.default.strictEqual((0, debugtree_1.treeChildren)(tree, ['big', '$100'])[0].value, '256 ($0100)');
    });
    (0, mocha_1.it)('says when a path is gone', function () {
        assert_1.default.throws(() => (0, debugtree_1.treeChildren)(tree, ['cpu', 'nope']), /no 'nope'/);
    });
});
//# sourceMappingURL=testdebugtree.js.map