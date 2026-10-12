import assert from "assert";
import { describe, it } from "mocha";
import { rust } from "@codemirror/lang-rust";
import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { TOOL_META, getToolMetaForFilename } from "../../src/common/toolmeta";
import { extractSymbols } from "../../src/common/symbols";

describe('Rust editor support', function () {
  it('maps .rs files to urust with the rust editor style', function () {
    assert.ok(getToolMetaForFilename('main.rs').some(m => m.id === 'urust'));
    assert.strictEqual(TOOL_META.urust.editorStyle, 'rust');
  });

  it('parses a Rust source file', function () {
    const code = 'fn main() {\n    let x: u8 = 1; // hi\n    loop {}\n}\n';
    const state = EditorState.create({ doc: code, extensions: [rust()] });
    const names: string[] = [];
    syntaxTree(state).iterate({ enter: n => { names.push(n.name); } });
    for (const expected of ['FunctionItem', 'LetDeclaration', 'LoopExpression', 'LineComment']) {
      assert.ok(names.includes(expected), `expected ${expected} in ${names.join(' ')}`);
    }
  });

  it('extracts Rust fn declarations as symbols', function () {
    const records = extractSymbols('fn draw(x: u8) {}\nfn main() {}\n', 'main.rs', 'rust', 'project');
    assert.deepStrictEqual(records.filter(r => r.kind === 'func').map(r => r.name), ['draw', 'main']);
  });
});
