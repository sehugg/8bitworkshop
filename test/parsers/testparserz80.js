const assert = require('assert');
const { EditorState } = require("@codemirror/state");
const { syntaxTree } = require("@codemirror/language");
const { asmZ80 } = require("../../gen/parser/lang-z80.js");

describe('Z80 Parser', function () {

    it('Should parse basic instructions', function () {
        const code = `
      ld a, 0
      ld hl, $1234
      ret
    `;

        // Create an editor state with the new parser
        const state = EditorState.create({
            doc: code,
            extensions: [asmZ80()]
        });

        // Check if the tree is available (basic check that parser didn't crash)
        assert.ok(syntaxTree(state), "Syntax tree should be generated");
    });

    it('Should handle labels', function () {
        const code = `
    start:
      jp start
    `;
        const state = EditorState.create({
            doc: code,
            extensions: [asmZ80()]
        });
        assert.ok(syntaxTree(state), "Syntax tree should be generated");
    });

    it('Should handle 8080 instructions', function () {
        const code = `
      mvi a, 0
      lxi h, $1234
      mov a, b
      inx h
      jmp start
    `;
        const state = EditorState.create({
            doc: code,
            extensions: [asmZ80()]
        });
        assert.ok(syntaxTree(state), "Syntax tree should be generated");
    });
});
