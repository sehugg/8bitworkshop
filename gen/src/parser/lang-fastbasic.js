"use strict";
// CodeMirror 6 language support for FastBasic
// Migrated from CodeMirror 5 mode
// Original copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE
Object.defineProperty(exports, "__esModule", { value: true });
exports.fastBasic = fastBasic;
const language_1 = require("@codemirror/language");
const language_2 = require("@codemirror/language");
// TODO: Migrate to CodeMirror 6 Lezer parser.
function createFastBasicParser() {
    function wordRegexp(words) {
        return new RegExp("^((" + words.join(")|(") + "))\\b", "i");
    }
    const singleOperators = /^[\+\-\*/%&\\|^\~<>!]/;
    const singleDelimiters = /^[\(\)\[\]\{\}@,:`=;\\.]/;
    const doubleOperators = /^((==)|(<>)|(<=)|(>=)|(<>)|(<<)|(>>)|(\/\/)|(\*\*))/;
    const doubleDelimiters = /^((\+=)|(\-=)|(\*=)|(%=)|(\/=)|(&=)|(\|=)|(\^=))/;
    const tripleDelimiters = /^((\/\/=)|(>>=)|(<<=)|(\*\*=))/;
    const identifiers = /^[_A-Za-z][_A-Za-z0-9]*/;
    const openingKeywords = ['while', 'repeat', 'proc', 'do', 'if', 'for'];
    const middleKeywords = ['else', 'elseif', 'to'];
    const endKeywords = ['next', 'loop', 'wend', 'endproc', 'endif', 'end', 'until'];
    const operatorKeywords = ['and', 'or', 'not', 'xor', 'in'];
    const commonKeywords = [
        'as', 'dim', 'break', 'continue', 'optional', 'then', 'until', 'goto', 'true', 'false',
        'data', 'graphics', 'poke', 'se', 'move', 'mset',
        'print', 'exec', 'pause', 'inc', 'dec', 'sound',
        'get', 'put', 'cls', 'input', 'position', 'exit',
        'color', 'drawto', 'fcolor', 'fillto', 'locate', 'plot', 'pmgraphics', 'pmhpos', 'setcolor',
        'bget', 'bput', 'close', 'open', 'xio',
        'clr', 'timer', 'dli', 'into', 'step', 'set',
        'dpoke', 'dpeek', 'adr', 'usr',
    ];
    const commontypes = ['byte', 'word'];
    const keywords = wordRegexp(commonKeywords);
    const types = wordRegexp(commontypes);
    const opening = wordRegexp(openingKeywords);
    const middle = wordRegexp(middleKeywords);
    const closing = wordRegexp(endKeywords);
    const wordOperators = wordRegexp(operatorKeywords);
    function tokenBase(stream, state) {
        if (stream.eatSpace()) {
            return null;
        }
        const ch = stream.peek();
        // Handle Comments
        if (ch === "'") {
            stream.skipToEnd();
            return 'comment';
        }
        // Handle Number Literals
        if (stream.match(/^(\$)?[0-9\.a-f]/i, false)) {
            let floatLiteral = false;
            // Floats
            if (stream.match(/^\d*\.\d+F?/i)) {
                floatLiteral = true;
            }
            else if (stream.match(/^\d+\.\d*F?/)) {
                floatLiteral = true;
            }
            else if (stream.match(/^\.\d+F?/)) {
                floatLiteral = true;
            }
            if (floatLiteral) {
                // Float literals may be "imaginary"
                stream.eat(/J/i);
                return 'number';
            }
            // Integers
            let intLiteral = false;
            // Hex
            if (stream.match(/^\$[0-9a-f]+/i)) {
                intLiteral = true;
            }
            // Octal
            else if (stream.match(/^&O[0-7]+/i)) {
                intLiteral = true;
            }
            // Decimal
            else if (stream.match(/^[1-9]\d*F?/)) {
                // Decimal literals may be "imaginary"
                stream.eat(/J/i);
                intLiteral = true;
            }
            // Zero by itself with no other piece of number.
            else if (stream.match(/^0(?![\dx])/i)) {
                intLiteral = true;
            }
            if (intLiteral) {
                // Integer literals may be "long"
                stream.eat(/L/i);
                return 'number';
            }
        }
        // Handle Strings
        if (stream.eat('"')) {
            state.tokenize = tokenString;
            return tokenString(stream, state);
        }
        // Handle operators and Delimiters
        if (stream.match(tripleDelimiters) || stream.match(doubleDelimiters)) {
            return null;
        }
        if (stream.match(doubleOperators)
            || stream.match(singleOperators)
            || stream.match(wordOperators)) {
            return 'operator';
        }
        if (stream.match(singleDelimiters)) {
            return null;
        }
        // Handle keywords
        if (stream.match(opening) || stream.match(middle) || stream.match(closing)) {
            return 'keyword';
        }
        if (stream.match(types)) {
            return 'keyword';
        }
        if (stream.match(keywords)) {
            return 'keyword';
        }
        if (stream.match(identifiers)) {
            return 'variableName';
        }
        // Handle non-detected items
        stream.next();
        return null;
    }
    function tokenString(stream, state) {
        while (!stream.eol()) {
            stream.eatWhile(/[^'"]/);
            if (stream.eat('"')) {
                state.tokenize = tokenBase;
                return 'string';
            }
            else {
                stream.eat(/['"]/);
            }
        }
        // Single-line strings
        state.tokenize = tokenBase;
        return 'string';
    }
    return {
        startState() {
            return {
                tokenize: tokenBase
            };
        },
        token(stream, state) {
            return state.tokenize(stream, state);
        }
    };
}
/**
 * Language support for FastBASIC
 */
function fastBasic() {
    return new language_2.LanguageSupport(language_1.StreamLanguage.define(createFastBasicParser()));
}
//# sourceMappingURL=lang-fastbasic.js.map