import assert from "assert";
import { describe } from "mocha";
import { indentUnit } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { spacesToTabStop } from "../../src/ide/views/tabs";

// Build a state from text with '|' marking the cursor; returns the spaces Tab would insert.
function tabAt(textWithCursor: string, tabSize: number, unit: number): string {
    const head = textWithCursor.indexOf('|');
    const state = EditorState.create({
        doc: textWithCursor.replace('|', ''),
        extensions: [EditorState.tabSize.of(tabSize), indentUnit.of(" ".repeat(unit))],
    });
    return spacesToTabStop(state, head);
}

describe('spacesToTabStop', () => {
    it('should advance by indent unit in leading whitespace', () => {
        assert.strictEqual(tabAt('|', 8, 2).length, 2);
        assert.strictEqual(tabAt('  |', 8, 2).length, 2);
        assert.strictEqual(tabAt('    |x', 8, 2).length, 2);
        assert.strictEqual(tabAt('   |x', 8, 2).length, 1); // 3 -> 4
    });
    it('should advance to tab size stops after text', () => {
        assert.strictEqual(tabAt('int x;|', 8, 2).length, 2); // 6 -> 8
        assert.strictEqual(tabAt('int x;  |', 8, 2).length, 8); // 8 -> 16
        assert.strictEqual(tabAt('x|', 8, 2).length, 7);
    });
    it('should use the tab size stops when indent unit equals it', () => {
        assert.strictEqual(tabAt('|', 8, 8).length, 8);
        assert.strictEqual(tabAt('  |', 8, 8).length, 6);
    });
    it('should count literal tab characters as tab size columns', () => {
        assert.strictEqual(tabAt('\t|', 8, 2).length, 2); // col 8 -> 10
        assert.strictEqual(tabAt('\tx|', 8, 2).length, 7); // col 9 -> 16
    });
    it('should use the cursor line only', () => {
        assert.strictEqual(tabAt('    foo\n|', 8, 2).length, 2);
        assert.strictEqual(tabAt('a\n  b|\nc', 4, 2).length, 1); // col 3 -> 4
    });
    it('should insert spaces only', () => {
        assert.strictEqual(tabAt('a|', 4, 2), '   ');
    });
});
