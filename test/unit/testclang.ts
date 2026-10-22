import assert from "assert";
import { describe } from "mocha";
import { ensureSyntaxTree, getIndentation, indentUnit } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { c } from "../../src/parser/lang-c";

// Indentation CodeMirror computes for the line at '|' (end of doc if absent).
// Text after '|' is what reindent-on-input sees on that line.
// The syntax tree is parsed on a later tick, so wait for it: without that the
// indentation is unknown (null) and the test depends on the machine's speed.
async function indentAfter(textWithCursor: string, unit = "  "): Promise<number> {
    const pos = textWithCursor.includes('|') ? textWithCursor.indexOf('|') : textWithCursor.length;
    const doc = textWithCursor.replace('|', '');
    const state = EditorState.create({ doc, extensions: [c(), indentUnit.of(unit)] });
    await ensureSyntaxTree(state, state.doc.length, 5000);
    return getIndentation(state, pos);
}

describe('C smart indent', () => {
    it('should indent blocks', async () => {
        assert.strictEqual(await indentAfter("void main() {\n"), 2);
        assert.strictEqual(await indentAfter("void main() {\n  while (1) {\n"), 4);
        assert.strictEqual(await indentAfter("void main() {\n    while (1) {\n", "    "), 8);
        assert.strictEqual(await indentAfter("struct foo {\n"), 2);
        assert.strictEqual(await indentAfter("int a[] = {\n"), 2);
    });
    it('should indent an unbraced if body', async () => {
        assert.strictEqual(await indentAfter("void main() {\n  if (x)\n"), 4);
        assert.strictEqual(await indentAfter("void main() {\n  if (x) {\n"), 4);
    });
    it('should not indent else', async () => {
        assert.strictEqual(await indentAfter("void main() {\n  if (x)\n    a();\n  |else"), 2);
        assert.strictEqual(await indentAfter("void main() {\n  if (x) {\n    a();\n  }\n  |else"), 2);
    });
    it('should dedent after a finished if', async () => {
        assert.strictEqual(await indentAfter("void main() {\n  if (x) {\n    a();\n  }\n"), 2);
        assert.strictEqual(await indentAfter("void main() {\n  if (x)\n    a();\n"), 2);
    });
    it('should indent case bodies', async () => {
        assert.strictEqual(await indentAfter("void main() {\n  switch (x) {\n"), 4);
        assert.strictEqual(await indentAfter("void main() {\n  switch (x) {\n    case 1:\n"), 6);
        assert.strictEqual(await indentAfter("void main() {\n  switch (x) {\n    case 1:\n      a();\n"), 6);
        assert.strictEqual(await indentAfter("void main() {\n  switch (x) {\n    case 1:\n      a();\n    |case"), 4);
        assert.strictEqual(await indentAfter("void main() {\n  switch (x) {\n    case 1:\n      a();\n    |default"), 4);
        assert.strictEqual(await indentAfter("void main() {\n  switch (x) {\n    case 1:\n      a();\n  |}"), 2);
        assert.strictEqual(await indentAfter("void main() {\n  switch (x) {\n    default:\n"), 6);
        assert.strictEqual(await indentAfter("void main() {\n  switch (x) {\n    case 1:\n      if (y)\n"), 8);
    });
    it('should match the indentation of the statement above', async () => {
        assert.strictEqual(await indentAfter("void main() {\n    int x;\n    x = 1;\n"), 4);
        assert.strictEqual(await indentAfter("void main() {\n    int x;\n    if (x)\n        a();\n"), 4);
        assert.strictEqual(await indentAfter("void main() {\n    foo(1,\n        2);\n"), 4);
        assert.strictEqual(await indentAfter("void main() {\n    x = 1;\n|}"), 0);
        assert.strictEqual(await indentAfter("struct foo {\n    int a;\n"), 4);
        assert.strictEqual(await indentAfter("enum foo {\n    A,\n"), 4);
        assert.strictEqual(await indentAfter("int a[] = {\n    1, 2,\n"), 4);
    });
    it('should ignore comments and preprocessor lines above', async () => {
        assert.strictEqual(await indentAfter("void main() {\n    x = 1;\n// old\n"), 4);
        assert.strictEqual(await indentAfter("void main() {\n    x = 1;\n#ifdef FOO\n"), 4);
        assert.strictEqual(await indentAfter("void main() {\n#ifdef FOO\n"), 2);
    });
    it('should indent mid-file', async () => {
        assert.strictEqual(await indentAfter("void main() {\n  if (x)\n|\n  b();\n}\n"), 4);
        assert.strictEqual(await indentAfter("void main() {\n  switch (x) {\n    case 1:\n|\n  }\n}\n"), 6);
    });
});
