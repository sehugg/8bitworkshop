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

// inform6 DASM syntax

CodeMirror.defineMode('inform6', function(_config, parserConfig) {
  var keywords1, keywords2;

  var keywords_list = "box|break|continue|do|else|fonton|fontoff|for|give|if|jump|new_line|objectloop|print|print_ret|remove|return|rfalse|rtrue|spaces|string|styleroman|stylebold|styleunderline|stylereverse|stylefixed|switch|until|while|has|hasnt|with|in|notin|ofclass|provides|or".split("|");
  var directives_list = "Abbreviate|Array|Attribute|Class|Constant|Default|End|Endif|Extend|Global|Ifdef|Ifndef|Ifnot|Iftrue|Iffalse|Import|Include|Link|Lowstring|Message|Object|Property|Release|Replace|Serial|Switches|Statuslinescore|Statuslinetime|System_file|Verb|Zcharacter".toLowerCase().split("|");
  var properties_list = "add_to_scope|after|article|articles|before|cant_go|capacity|d_to|daemon|describe|description|door_dir|door_to|e_to|each_turn|found_in|grammar|in_to|initial|inside_description|invent|life|list_together|name|n_to|ne_to|number|nw_to|orders|out_to|parse_name|plural|react_after|react_before|s_to|se_to|short_name|short_name_indef|sw_to|time_left|time_out|u_to|w_to|when_closed|when_open|when_on|when_off|with_key".split("|");
  var attributes_list = "absent|animate|clothing|concealed|container|door|edible|enterable|female|general|light|lockable|locked|male|moved|neuter|open|openable|pluralname|proper|scenery|scored|static|supporter|switchable|talkable|transparent|visited|workflag|worn".split("|");
  var actions_list = "Pronouns|Quit|Restart|Restore|Save|Verify|ScriptOn|ScriptOff|NotifyOn|NotifyOff|Places|Objects|Score|FullScore|Version|LMode1|LMode2|LMode3|Look|Examine|Search|Inv|InvTall|InvWide|Take|Drop|Remove|PutOn|Insert|LetGo|Receive|Empty|EmptyT|Remove|Transfer|Go|Enter|GetOff|GoIn|Exit|Unlock|Lock|SwitchOn|SwitchOff|Open|Close|Disrobe|Wear|Eat|Wait|LookUnder|Listen|Taste|Touch|Pull|Push|Wave|Turn|PushDir|ThrowAt|ThrownAt|JumpOver|Tie|Drink|Fill|Attack|Swing|Blow|Rub|Set|SetTo|Buy|Climb|Squeeze|Burn|Dig|Cut|Consult|Tell|Answer|Ask|Give|Show|AskFor|WakeOther|Kiss|Sleep|Sing|WaveHands|Swim|Sorry|Strong|Mild|Jump|Think|Smell|Pray|VagueGo|Yes|No|Wake|Answer|Ask|Attack|Give|Kiss|Order|Show|Tell|ThrowAt|WakeOther".toLowerCase().split("|");

  var directives = new Map();
  directives_list.forEach(function(s) { directives.set(s, 'keyword'); });
  keywords_list.forEach(function(s) { directives.set(s, 'keyword'); });
  properties_list.forEach(function(s) { directives.set(s, 'keyword'); });
  attributes_list.forEach(function(s) { directives.set(s, 'keyword'); });
  actions_list.forEach(function(s) { directives.set(s, 'keyword'); });

  var numbers = /^([\da-f]+h|[0-7]+o|[01]+b|\d+d?)\b/i;

  /*
  var type, content;
  function ret(tp, style, cont) {
    type = tp; content = cont;
    return style;
  }
  */

  function tokenBase(stream, state) {
    if (stream.eatSpace())
      return null;

    var w;
    if (stream.eatWhile(/\w/)) {
      w = stream.current();
      var cur = w.toLowerCase();
      var style = directives.get(cur);
      if (style)
        return style;

      if (numbers.test(w)) {
        return 'number';
      } else if (stream.match(numbers)) {
        return 'number';
      } else {
        return null;
      }
    } else if (stream.eat('!')) {
      stream.skipToEnd();
      return 'comment';
    } else if (stream.match(/\]|\[|\}|\{/)) {
      return 'bracket';
    } else if (stream.match(/\<\<|\>\>/)) {
      return 'bracket';
    } else if (stream.match(/[#]+\w+/)) {
      return 'number';
    } else if (stream.eat('"')) {
      state.tokenize = tokenString;
      return tokenString(stream, state);
    } else if (stream.eat('\'')) {
      return tokenString2(stream, state);
    } else if (stream.eat('$')) {
      if (stream.eatWhile(/[^;]/i))
        return 'number';
    } else {
      stream.next();
    }
    return null;
  }

  function tokenString(stream, state) {
    var ch;
    while (ch = stream.next()) {
      if (ch == '"') {
        state.tokenize = tokenBase;
        break;
      }
    }
    return "string";
  }

  function tokenString2(stream, state) {
    var ch;
    while (ch = stream.next()) {
      if (ch == "'") {
        state.tokenize = tokenBase;
        break;
      }
    }
    return "meta";
  }

  return {
    startState: function() {
      return {
        context: 0,
        tokenize: tokenBase
      };
    },
    token: function(stream, state) {
      return state.tokenize(stream, state);
    }
  }
});

CodeMirror.defineMIME("text/x-inform6", "inform6");

});
