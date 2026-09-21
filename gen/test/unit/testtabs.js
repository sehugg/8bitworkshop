"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const language_1 = require("@codemirror/language");
const state_1 = require("@codemirror/state");
const tabs_1 = require("../../src/ide/views/tabs");
// Build a state from text with '|' marking the cursor; returns the spaces Tab would insert.
function tabAt(textWithCursor, tabSize, unit) {
    const head = textWithCursor.indexOf('|');
    const state = state_1.EditorState.create({
        doc: textWithCursor.replace('|', ''),
        extensions: [state_1.EditorState.tabSize.of(tabSize), language_1.indentUnit.of(" ".repeat(unit))],
    });
    return (0, tabs_1.spacesToTabStop)(state, head);
}
(0, mocha_1.describe)('spacesToTabStop', () => {
    it('should advance by indent unit in leading whitespace', () => {
        assert_1.default.strictEqual(tabAt('|', 8, 2).length, 2);
        assert_1.default.strictEqual(tabAt('  |', 8, 2).length, 2);
        assert_1.default.strictEqual(tabAt('    |x', 8, 2).length, 2);
        assert_1.default.strictEqual(tabAt('   |x', 8, 2).length, 1); // 3 -> 4
    });
    it('should advance to tab size stops after text', () => {
        assert_1.default.strictEqual(tabAt('int x;|', 8, 2).length, 2); // 6 -> 8
        assert_1.default.strictEqual(tabAt('int x;  |', 8, 2).length, 8); // 8 -> 16
        assert_1.default.strictEqual(tabAt('x|', 8, 2).length, 7);
    });
    it('should use the tab size stops when indent unit equals it', () => {
        assert_1.default.strictEqual(tabAt('|', 8, 8).length, 8);
        assert_1.default.strictEqual(tabAt('  |', 8, 8).length, 6);
    });
    it('should count literal tab characters as tab size columns', () => {
        assert_1.default.strictEqual(tabAt('\t|', 8, 2).length, 2); // col 8 -> 10
        assert_1.default.strictEqual(tabAt('\tx|', 8, 2).length, 7); // col 9 -> 16
    });
    it('should use the cursor line only', () => {
        assert_1.default.strictEqual(tabAt('    foo\n|', 8, 2).length, 2);
        assert_1.default.strictEqual(tabAt('a\n  b|\nc', 4, 2).length, 1); // col 3 -> 4
    });
    it('should insert spaces only', () => {
        assert_1.default.strictEqual(tabAt('a|', 4, 2), '   ');
    });
});
(0, mocha_1.describe)('hasLineNumbers', () => {
    const has = (doc) => (0, tabs_1.hasLineNumbers)(state_1.EditorState.create({ doc }));
    it('should detect line-numbered BASIC', () => {
        assert_1.default.strictEqual(has('10 PRINT "HI"\n20 GOTO 10'), true);
        assert_1.default.strictEqual(has('REM start\n30 END'), true);
        assert_1.default.strictEqual(has('REM start\n3 END'), false);
        assert_1.default.strictEqual(has('REM start\n  30 END'), false);
    });
    it('should treat unnumbered source as structured', () => {
        assert_1.default.strictEqual(has(''), false);
        assert_1.default.strictEqual(has('for i = 1 to 10\n  print i\nnext'), false);
        assert_1.default.strictEqual(has('x1 = 5'), false);
    });
});
//# sourceMappingURL=testtabs.js.map