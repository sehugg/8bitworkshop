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

// bataribasic DASM syntax

CodeMirror.defineMode('bataribasic', function(_config, parserConfig) {
  var keywords1, keywords2;

  var directives_list = [
    'rem','if','else','then','goto',
    //'end',
    'includesfile','include','inline','function',
    'bank','sdata','data',
    'on','off',
    'up','down',
    'const','dim','for','next','gosub',
    'pfpixel','pfhline','pfclear','pfvline','pfscroll',
    'drawscreen','asm','pop','set','return','reboot','vblank',
    'pfcolors','pfheights','playfield','lives',
    'player0','player1','player2','player3','player4','player5',
    'player0color','player1color',
    'let',
    "switchreset","switchselect","switchleftb","switchrightb","switchbw",
    "joy0up","joy0down","joy0left","joy0right","joy1up","joy1down","joy1left","joy1right","joy0fire","joy1fire",
    "size","2k","8k","8kSC","16k","16kSC","32k","32kSC","4k",
    "thisbank","otherbank","flip",
    "collision","missile0","missile1","ball",
    "stackpull","rand","score","scorec","Areg",
    "smartbranching","romsize","optimization","speed","size",
    "noinlinedata","inlinerand","none","kernal","kernel_options",
    "readpaddle","player1colors","playercolors","no_blank_lines",
    "kernel","multisprite","multisprite_no_include","debug",
    "cyclescore","cycles","legacy"
    ];
  var directives = new Map();
  directives_list.forEach(function(s) { directives.set(s, 'keyword'); });

  var numbers = /^([$][0-9a-f]+|[%][01]+|[0-9.]+)/i;

  return {
    startState: function() {
      return {
        context: 0
      };
    },
    token: function(stream, state) {
      if (!stream.column()) {
        state.context = 0;
        if (stream.eatWhile(/[\w.]/)) {
          if (stream.current().toLowerCase() == 'end')
            return 'keyword';
          else
            return 'tag';
        }
      }
      if (stream.eatSpace())
        return null;

      var w;
      if (stream.eatWhile(/[$%A-Z0-9]/i)) {
        w = stream.current();
        var cur = w.toLowerCase();
        var style = directives.get(cur);
        if (cur == 'rem') {
          stream.eatWhile(/./);
          return 'comment';
        }
        if (style)
          return style;

        if (numbers.test(w)) {
          return 'number';
        } else {
          return null;
        }
      } else {
        stream.next();
      }
      return null;
    }
  };
});

CodeMirror.defineMIME("text/x-bataribasic", "bataribasic");

});
