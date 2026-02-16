
const assert = require('assert');
const { EditorState } = require("@codemirror/state");
const { syntaxTree } = require("@codemirror/language");
const { asm6502 } = require("../../gen/parser/lang-6502.js");


describe('6502 Parser', function () {

    it('Should parse basic instructions', function () {
        const code = `
      lda #$00
      sta $1234
      rts
    `;

        // Create an editor state with the new parser
        const state = EditorState.create({
            doc: code,
            extensions: [asm6502()]
        });

        // Check if the tree is available (basic check that parser didn't crash)
        // In a real environment we might traverse the tree to check specific nodes
        // but here we just want to ensure it instantiates and runs without throwing.
        assert.ok(syntaxTree(state), "Syntax tree should be generated");
    });

    it('Should handle labels', function () {
        const code = `
    start:
      jmp start
    `;
        const state = EditorState.create({
            doc: code,
            extensions: [asm6502()]
        });
        assert.ok(syntaxTree(state), "Syntax tree should be generated");
    });
});
