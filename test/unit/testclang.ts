import assert from "assert";
import { describe } from "mocha";
import { ensureSyntaxTree, getIndentation, indentUnit } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { c } from "../../src/parser/lang-c";

// Indentation CodeMirror computes for the line at '|' (end of doc if absent).
// Text after '|' is what reindent-on-input sees on that line.
function indentAfter(textWithCursor: string, unit = "  "): number {
    const pos = textWithCursor.includes('|') ? textWithCursor.indexOf('|') : textWithCursor.length;
    const doc = textWithCursor.replace('|', '');
    const state = EditorState.create({ doc, extensions: [c(), indentUnit.of(unit)] });
    ensureSyntaxTree(state, state.doc.length, 5000);
    return getIndentation(state, pos);
}

describe('C smart indent', () => {
    it('should indent blocks', () => {
        assert.strictEqual(indentAfter("void main() {\n"), 2);
        assert.strictEqual(indentAfter("void main() {\n  while (1) {\n"), 4);
        assert.strictEqual(indentAfter("void main() {\n    while (1) {\n", "    "), 8);
        assert.strictEqual(indentAfter("struct foo {\n"), 2);
        assert.strictEqual(indentAfter("int a[] = {\n"), 2);
    });
    it('should indent an unbraced if body', () => {
        assert.strictEqual(indentAfter("void main() {\n  if (x)\n"), 4);
        assert.strictEqual(indentAfter("void main() {\n  if (x) {\n"), 4);
    });
    it('should not indent else', () => {
        assert.strictEqual(indentAfter("void main() {\n  if (x)\n    a();\n  |else"), 2);
        assert.strictEqual(indentAfter("void main() {\n  if (x) {\n    a();\n  }\n  |else"), 2);
    });
    it('should dedent after a finished if', () => {
        assert.strictEqual(indentAfter("void main() {\n  if (x) {\n    a();\n  }\n"), 2);
        assert.strictEqual(indentAfter("void main() {\n  if (x)\n    a();\n"), 2);
    });
    it('should indent case bodies', () => {
        assert.strictEqual(indentAfter("void main() {\n  switch (x) {\n"), 4);
        assert.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n"), 6);
        assert.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n      a();\n"), 6);
        assert.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n      a();\n    |case"), 4);
        assert.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n      a();\n    |default"), 4);
        assert.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n      a();\n  |}"), 2);
        assert.strictEqual(indentAfter("void main() {\n  switch (x) {\n    default:\n"), 6);
        assert.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n      if (y)\n"), 8);
    });
    it('should match the indentation of the statement above', () => {
        assert.strictEqual(indentAfter("void main() {\n    int x;\n    x = 1;\n"), 4);
        assert.strictEqual(indentAfter("void main() {\n    int x;\n    if (x)\n        a();\n"), 4);
        assert.strictEqual(indentAfter("void main() {\n    foo(1,\n        2);\n"), 4);
        assert.strictEqual(indentAfter("void main() {\n    x = 1;\n|}"), 0);
        assert.strictEqual(indentAfter("struct foo {\n    int a;\n"), 4);
        assert.strictEqual(indentAfter("enum foo {\n    A,\n"), 4);
        assert.strictEqual(indentAfter("int a[] = {\n    1, 2,\n"), 4);
    });
    it('should ignore comments and preprocessor lines above', () => {
        assert.strictEqual(indentAfter("void main() {\n    x = 1;\n// old\n"), 4);
        assert.strictEqual(indentAfter("void main() {\n    x = 1;\n#ifdef FOO\n"), 4);
        assert.strictEqual(indentAfter("void main() {\n#ifdef FOO\n"), 2);
    });
    it('should indent mid-file', () => {
        assert.strictEqual(indentAfter("void main() {\n  if (x)\n|\n  b();\n}\n"), 4);
        assert.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n|\n  }\n}\n"), 6);
    });
});
