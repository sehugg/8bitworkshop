// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
  mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
  define(["../../lib/codemirror"], mod);
  else // Plain browser env
  mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

// 6502 DASM syntax

CodeMirror.defineMode('6502', function(_config, parserConfig) {
  var keywords1, keywords2;

  var directives_list = [
    'processor',
    'byte','word','long',
    'include','seg','dc','ds','dv','hex','err','org','rorg','echo','rend',
    'align','subroutine','equ','eqm','set','mac','endm','mexit','ifconst',
    'ifnconst','if','else','endif','eif','repeat','repend'];
  var directives = {};
  for (var s of directives_list)
    directives[s] = 'keyword';

  var opcodes = /^[a-z][a-z][a-z]\b/i;
  var numbers = /^([\da-f]+h|[0-7]+o|[01]+b|\d+d?)\b/i;

  return {
    startState: function() {
      return {
        context: 0
      };
    },
    token: function(stream, state) {
      if (!stream.column()) {
        state.context = 0;
        if (stream.eatWhile(/[\w.]/))
          return 'tag';
      }
      if (stream.eatSpace())
        return null;

      var w;
      if (stream.eatWhile(/\w/)) {
        w = stream.current();
        var cur = w.toLowerCase();
        var style = directives[cur];
        if (style)
          return style;

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
        if (stream.match(/\\?.'/))
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
});

CodeMirror.defineMIME("text/x-6502", "6502");

});
