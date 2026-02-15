// CodeMirror 6 language support for Z80 assembly
// Migrated from CodeMirror 5 mode
// Original copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

import { StreamLanguage, StreamParser } from "@codemirror/language";
import { LanguageSupport } from "@codemirror/language";

interface Z80State {
    context: number;
}

interface Z80Config {
    ez80?: boolean;
}

// TODO: Migrate to CodeMirror 6 Lezer parser.
function createZ80Parser(config: Z80Config = {}): StreamParser<Z80State> {
    const ez80 = config.ez80 || false;

    let keywords1: RegExp, keywords2: RegExp;
    if (ez80) {
        keywords1 = /^(exx?|(ld|cp)([di]r?)?|[lp]ea|pop|push|ad[cd]|cpl|daa|dec|inc|neg|sbc|sub|and|bit|[cs]cf|x?or|res|set|r[lr]c?a?|r[lr]d|s[lr]a|srl|djnz|nop|[de]i|halt|im|in([di]mr?|ir?|irx|2r?)|ot(dmr?|[id]rx|imr?)|out(0?|[di]r?|[di]2r?)|tst(io)?|slp)(\.([sl]?i)?[sl])?\b/i;
        keywords2 = /^(((call|j[pr]|rst|ret[in]?)(\.([sl]?i)?[sl])?)|(rs|st)mix)\b/i;
    } else {
        keywords1 = /^(exx?|(ld|cp|in)([di]r?)?|pop|push|ad[cd]|cpl|daa|dec|inc|neg|sbc|sub|and|bit|[cs]cf|x?or|res|set|r[lr]c?a?|r[lr]d|s[lr]a|srl|djnz|nop|rst|[de]i|halt|im|ot[di]r|out[di]?)\b/i;
        keywords2 = /^(call|j[pr]|ret[in]?|b_?(call|jump))\b/i;
    }

    const variables1 = /^(af?|bc?|c|de?|e|hl?|l|i[xy]?|r|sp)\b/i;
    const variables2 = /^(n?[zc]|p[oe]?|m)\b/i;
    const errors = /^([hl][xy]|i[xy][hl]|slia|sll)\b/i;
    const numbers = /^([\da-f]+h|[0-7]+o|[01]+b|\d+d?)\b/i;

    return {
        startState(): Z80State {
            return {
                context: 0
            };
        },

        token(stream, state) {
            if (!stream.column())
                state.context = 0;

            if (stream.eatSpace())
                return null;

            var w;

            if (stream.eatWhile(/\w/)) {
                if (ez80 && stream.eat('.')) {
                    stream.eatWhile(/\w/);
                }
                w = stream.current();

                if (stream.indentation()) {
                    if ((state.context == 1 || state.context == 4) && variables1.test(w)) {
                        state.context = 4;
                        return 'variableName.special';
                    }

                    if (state.context == 2 && variables2.test(w)) {
                        state.context = 4;
                        return 'variableName.constant';
                    }

                    if (keywords1.test(w)) {
                        state.context = 1;
                        return 'keyword';
                    } else if (keywords2.test(w)) {
                        state.context = 2;
                        return 'keyword';
                    } else if (state.context == 4 && numbers.test(w)) {
                        return 'number';
                    }

                    if (errors.test(w))
                        return 'invalid';
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
            } else if (stream.eat('.') || stream.sol() && stream.eat('#')) {
                state.context = 5;

                if (stream.eatWhile(/\w/))
                    return 'keyword.control';
            } else if (stream.eat('$')) {
                if (stream.eatWhile(/[\da-f]/i))
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
}

/**
 * Language support for Z80 assembly language
 */
export function asmZ80(): LanguageSupport {
    return new LanguageSupport(StreamLanguage.define(createZ80Parser()));
}

/**
 * Language support for eZ80 assembly language
 */
export function asmEZ80(): LanguageSupport {
    return new LanguageSupport(StreamLanguage.define(createZ80Parser({ ez80: true })));
}
