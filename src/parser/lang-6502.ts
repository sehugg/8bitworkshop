// CodeMirror 6 language support for 6502 assembly
// Migrated from CodeMirror 5 mode
// Original copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

import { StreamLanguage, StreamParser } from "@codemirror/language";
import { LanguageSupport } from "@codemirror/language";

// TODO: Migrate to CodeMirror 6 Lezer parser.
const asm6502Parser: StreamParser<{ context: number }> = {
  startState() {
    return {
      context: 0
    };
  },

  token(stream, state) {
    // Labels at start of line
    if (!stream.column()) {
      state.context = 0;
      if (stream.eatWhile(/[\w.]/))
        return 'labelName';
    }

    if (stream.eatSpace())
      return null;

    var w;
    if (stream.eatWhile(/\w/)) {
      w = stream.current();
      var cur = w.toLowerCase();

      // Check for directives
      var style = directives.get(cur);
      if (style)
        return style;

      // Check for opcodes (3-letter mnemonics)
      if (opcodes.test(w)) {
        state.context = 4;
        return 'keyword';
      } else if (state.context == 4 && numbers.test(w)) {
        return 'number';
      } else if (stream.match(numbers)) {
        return 'number';
      } else {
        return null;
      }
    } else if (stream.eat(';')) {
      stream.skipToEnd();
      return 'comment';
    } else if (stream.eat('"')) {
      while (w = stream.next()) {
        if (w == '"')
          break;

        if (w == '\\')
          stream.next();
      }
      return 'string';
    } else if (stream.eat('\'')) {
      if (stream.match(/\\?.'/) || stream.match(/\\?.'/))
        return 'number';
    } else if (stream.eat('$') || stream.eat('#')) {
      if (stream.eatWhile(/[^;]/i))
        return 'number';
    } else if (stream.eat('%')) {
      if (stream.eatWhile(/[01]/))
        return 'number';
    } else {
      stream.next();
    }
    return null;
  }
};

// Directive keywords
const directives_list = [
  'processor',
  'byte', 'word', 'long',
  'include', 'seg', 'dc', 'ds', 'dv', 'hex', 'err', 'org', 'rorg', 'echo', 'rend',
  'align', 'subroutine', 'equ', 'eqm', 'set', 'mac', 'endm', 'mexit', 'ifconst',
  'ifnconst', 'if', 'else', 'endif', 'eif', 'repeat', 'repend'
];
const directives = new Map<string, string>();
directives_list.forEach(function (s) { directives.set(s, 'keyword'); });

const opcodes = /^[a-z][a-z][a-z]\b/i;
const numbers = /^([\da-f]+h|[0-7]+o|[01]+b|\d+d?)\b/i;

/**
 * Language support for 6502 assembly language
 */
export function asm6502(): LanguageSupport {
  return new LanguageSupport(StreamLanguage.define(asm6502Parser));
}
