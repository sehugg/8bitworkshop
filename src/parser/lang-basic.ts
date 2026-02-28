// CodeMirror 6 language support for BASIC
// Migrated from CodeMirror 5 mode
// Original copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

import { StreamLanguage, StreamParser, LanguageSupport } from "@codemirror/language";

interface BasicState {
  tokenize: (stream: any, state: BasicState) => string | null;
  currentIndent: number;
  doInCurrentLine: boolean;
}

// TODO: Migrate to CodeMirror 6 Lezer parser.
const basicParser: StreamParser<BasicState> = {
  startState() {
    return {
      tokenize: tokenBase,
      currentIndent: 0,
      doInCurrentLine: false
    };
  },

  token(stream, state) {
    if (stream.sol()) {
      state.doInCurrentLine = false;
    }
    return state.tokenize(stream, state);
  },

  indent(state, textAfter, context) {
    const unit = context.unit;
    const closing = /^(?:next|end|wend|else|to|then)\b/i;
    if (closing.test(textAfter)) {
      return (state.currentIndent - 1) * unit;
    }
    return state.currentIndent * unit;
  },

  languageData: {
    commentTokens: { line: "'" }
  }
};

// --- Regex Helpers ---

function wordRegexp(words: string[]) {
  return new RegExp("^((" + words.join(")|(") + "))\\b", "i");
}

const singleOperators = /^[\+\-\*/%&\\|\^~<>!]/;
const singleDelimiters = /^[\(\)\[\]\{\}@,:`=;\.]/;
const doubleOperators = /^((==)|(<>)|(<=)|(>=)|(<>)|(<<)|(>>)|(\/\/)|(\*\*))/;
const doubleDelimiters = /^((\+=)|(\-=)|(\*=)|(%=)|(\/=)|(&=)|(\|=)|(\^=))/;
const tripleDelimiters = /^(((\/\/)=)|(>>=)|(<<=)|(\*\*=))/;
const identifiers = /^[_A-Za-z][_A-Za-z0-9]*/;

const openingKeywords = ['if', 'for', 'while'];
const middleKeywords = ['to', 'then', 'else'];
const endKeywords = ['next', 'end', 'wend'];
const operatorKeywords = ['and', 'or', 'not', 'xor', 'eqv', 'imp', 'mod'];

const commonKeywords = [
  'BASE', 'DATA', 'DEF', 'DIM', 'GO', 'GOSUB', 'GOTO', 'INPUT', 'LET', 'ON', 'OPTION', 'PRINT',
  'RANDOMIZE', 'READ', 'REM', 'RESTORE', 'RETURN', 'STEP', 'STOP', 'SUB', 'CALL', 'CHANGE',
  'CONVERT', 'CLEAR', 'DIALECT', 'SELECT', 'CASE'
];

const commontypes = ['xxxxbyte', 'xxxxword'];

const keywords = wordRegexp(commonKeywords);
const types = wordRegexp(commontypes);
const opening = wordRegexp(openingKeywords);
const middle = wordRegexp(middleKeywords);
const closing = wordRegexp(endKeywords);
const doubleClosing = wordRegexp(['end']);
const doOpening = wordRegexp(['do']);
const wordOperators = wordRegexp(operatorKeywords);

// --- Tokenizer Functions ---

function tokenBase(stream: any, state: BasicState): string | null {
  if (stream.eatSpace()) return null;

  const ch = stream.peek();

  // Comments
  if (ch === "'") {
    stream.skipToEnd();
    return "comment";
  }

  // Numbers
  if (stream.match(/^(\$)?[0-9\.a-f]/i, false)) {
    if (stream.match(/^\d*\.\d+F?/i) || stream.match(/^\d+\.\d*F?/) || stream.match(/^\.\d+F?/)) {
      stream.eat(/J/i);
      return "number";
    }
    if (stream.match(/^\$[0-9a-f]+/i) || stream.match(/^&O[0-7]+/i) || stream.match(/^\d+F?/) || stream.match(/^0(?![\dx])/i)) {
      stream.eat(/J/i);
      stream.eat(/L/i);
      return "number";
    }
  }

  // REM Remark
  if (stream.match(/\bREM/i)) {
    stream.skipToEnd();
    return "comment";
  }

  // Strings
  if (ch === '"') {
    state.tokenize = tokenString;
    return state.tokenize(stream, state);
  }

  // Delimiters & Operators
  if (stream.match(tripleDelimiters) || stream.match(doubleDelimiters)) return null;
  if (stream.match(doubleOperators) || stream.match(singleOperators) || stream.match(wordOperators)) return "operator";
  if (stream.match(singleDelimiters)) return null;

  // Indentation logic
  if (stream.match(doOpening)) {
    state.currentIndent++;
    state.doInCurrentLine = true;
    return "keyword";
  }
  if (stream.match(opening)) {
    if (!state.doInCurrentLine) state.currentIndent++;
    else state.doInCurrentLine = false;
    return "keyword";
  }
  if (stream.match(middle)) return "keyword";
  if (stream.match(doubleClosing)) {
    state.currentIndent -= 2;
    return "keyword";
  }
  if (stream.match(closing)) {
    state.currentIndent--;
    return "keyword";
  }

  if (stream.match(types) || stream.match(keywords)) return "keyword";
  if (stream.match(identifiers)) return "variable";

  stream.next();
  return "error";
}

function tokenString(stream: any, state: BasicState): string {
  stream.next(); // Skip initial quote
  while (!stream.eol()) {
    stream.eatWhile(/[^"]/);
    if (stream.eat('"')) {
      state.tokenize = tokenBase;
      return "string";
    }
  }
  state.tokenize = tokenBase;
  return "string";
}

export function basic(): LanguageSupport {
  return new LanguageSupport(StreamLanguage.define(basicParser));
}