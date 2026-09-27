"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const language_1 = require("@codemirror/language");
const state_1 = require("@codemirror/state");
const lang_c_1 = require("../../src/parser/lang-c");
// Indentation CodeMirror computes for the line at '|' (end of doc if absent).
// Text after '|' is what reindent-on-input sees on that line.
function indentAfter(textWithCursor, unit = "  ") {
    const pos = textWithCursor.includes('|') ? textWithCursor.indexOf('|') : textWithCursor.length;
    const doc = textWithCursor.replace('|', '');
    const state = state_1.EditorState.create({ doc, extensions: [(0, lang_c_1.c)(), language_1.indentUnit.of(unit)] });
    (0, language_1.ensureSyntaxTree)(state, state.doc.length, 5000);
    return (0, language_1.getIndentation)(state, pos);
}
(0, mocha_1.describe)('C smart indent', () => {
    it('should indent blocks', () => {
        assert_1.default.strictEqual(indentAfter("void main() {\n"), 2);
        assert_1.default.strictEqual(indentAfter("void main() {\n  while (1) {\n"), 4);
        assert_1.default.strictEqual(indentAfter("void main() {\n    while (1) {\n", "    "), 8);
        assert_1.default.strictEqual(indentAfter("struct foo {\n"), 2);
        assert_1.default.strictEqual(indentAfter("int a[] = {\n"), 2);
    });
    it('should indent an unbraced if body', () => {
        assert_1.default.strictEqual(indentAfter("void main() {\n  if (x)\n"), 4);
        assert_1.default.strictEqual(indentAfter("void main() {\n  if (x) {\n"), 4);
    });
    it('should not indent else', () => {
        assert_1.default.strictEqual(indentAfter("void main() {\n  if (x)\n    a();\n  |else"), 2);
        assert_1.default.strictEqual(indentAfter("void main() {\n  if (x) {\n    a();\n  }\n  |else"), 2);
    });
    it('should dedent after a finished if', () => {
        assert_1.default.strictEqual(indentAfter("void main() {\n  if (x) {\n    a();\n  }\n"), 2);
        assert_1.default.strictEqual(indentAfter("void main() {\n  if (x)\n    a();\n"), 2);
    });
    it('should indent case bodies', () => {
        assert_1.default.strictEqual(indentAfter("void main() {\n  switch (x) {\n"), 4);
        assert_1.default.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n"), 6);
        assert_1.default.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n      a();\n"), 6);
        assert_1.default.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n      a();\n    |case"), 4);
        assert_1.default.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n      a();\n    |default"), 4);
        assert_1.default.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n      a();\n  |}"), 2);
        assert_1.default.strictEqual(indentAfter("void main() {\n  switch (x) {\n    default:\n"), 6);
        assert_1.default.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n      if (y)\n"), 8);
    });
    it('should match the indentation of the statement above', () => {
        assert_1.default.strictEqual(indentAfter("void main() {\n    int x;\n    x = 1;\n"), 4);
        assert_1.default.strictEqual(indentAfter("void main() {\n    int x;\n    if (x)\n        a();\n"), 4);
        assert_1.default.strictEqual(indentAfter("void main() {\n    foo(1,\n        2);\n"), 4);
        assert_1.default.strictEqual(indentAfter("void main() {\n    x = 1;\n|}"), 0);
        assert_1.default.strictEqual(indentAfter("struct foo {\n    int a;\n"), 4);
        assert_1.default.strictEqual(indentAfter("enum foo {\n    A,\n"), 4);
        assert_1.default.strictEqual(indentAfter("int a[] = {\n    1, 2,\n"), 4);
    });
    it('should ignore comments and preprocessor lines above', () => {
        assert_1.default.strictEqual(indentAfter("void main() {\n    x = 1;\n// old\n"), 4);
        assert_1.default.strictEqual(indentAfter("void main() {\n    x = 1;\n#ifdef FOO\n"), 4);
        assert_1.default.strictEqual(indentAfter("void main() {\n#ifdef FOO\n"), 2);
    });
    it('should indent mid-file', () => {
        assert_1.default.strictEqual(indentAfter("void main() {\n  if (x)\n|\n  b();\n}\n"), 4);
        assert_1.default.strictEqual(indentAfter("void main() {\n  switch (x) {\n    case 1:\n|\n  }\n}\n"), 6);
    });
});
//# sourceMappingURL=testclang.js.map