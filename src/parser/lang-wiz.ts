// CodeMirror 6 language support for Wiz
// Migrated from CodeMirror 5 mode
// Original copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

import { StreamLanguage, StreamParser } from "@codemirror/language";
import { LanguageSupport } from "@codemirror/language";

interface WizState {
    tokenize: ((stream: any, state: WizState) => string | null) | null;
    lastToken: string | null;
}

// TODO: Migrate to CodeMirror 6 Lezer parser.
function createWizParser(): StreamParser<WizState> {
    function words(str: string): Set<string> {
        return new Set(str.split(" "));
    }

    const keywords = words("u8 u16 u24 u32 u64 i8 i16 i24 i32 i64 bool iexpr " +
        "vardata prgdata constdata chrdata varinitdata " +
        "do else for if switch while in import embed bank config goto return by break continue " +
        "zero carry negative overflow decimal nointerrupt push pop nop halt stop bit cmp " +
        "var let const namespace func inline struct union enum typealias " +
        "sizeof as compile_if");

    const types = words("u8 u16 u24 u32 u64 i8 i16 i24 i32 i64 bool iexpr");
    const atoms = words("true false null");

    const isOperatorChar = /[+\-*&%=<>!?|\/]/;
    const isIdentifierChar = /[\w$_\xa1-\uffff]/;
    const number = /^(?:0x[a-f\d_]+|0b[01_]+|(?:[\d_]+\.?\d*|\.[\d_]+)(?:e[-+]?[\d_]+)?)(u|ll?|l|f)?/i;

    function tokenBase(stream: any, state: WizState): string | null {
        const ch = stream.next();

        // Handle # meta directives
        if (ch === '#') {
            stream.eatWhile(/\S/);
            return 'meta';
        }

        // Handle strings
        if (ch === '"' || ch === "'") {
            state.tokenize = tokenString(ch);
            return state.tokenize(stream, state);
        }

        // Handle punctuation
        if (/[\[\]{}(),;:\.]/.test(ch)) {
            return null;
        }

        // Handle numbers
        if (/[\d\.]/.test(ch)) {
            stream.backUp(1);
            if (stream.match(number)) {
                return 'number';
            }
            stream.next();
        }

        // Handle comments
        if (ch === '/') {
            if (stream.eat('*')) {
                state.tokenize = tokenComment;
                return tokenComment(stream, state);
            }
            if (stream.eat('/')) {
                stream.skipToEnd();
                return 'comment';
            }
        }

        // Handle operators
        if (isOperatorChar.test(ch)) {
            while (!stream.match(/^\/[\/*]/, false) && stream.eat(isOperatorChar)) { }
            return 'operator';
        }

        // Handle identifiers and keywords
        if (isIdentifierChar.test(ch)) {
            stream.eatWhile(isIdentifierChar);
            const cur = stream.current();

            if (keywords.has(cur)) {
                return 'keyword';
            }
            if (types.has(cur)) {
                return 'typeName';
            }
            if (atoms.has(cur)) {
                return 'atom';
            }

            // Check if this identifier is a definition (follows definition keywords)
            const defKeywords = ['in', 'bank', 'namespace', 'func', 'struct', 'union', 'enum', 'typealias'];
            if (state.lastToken && defKeywords.includes(state.lastToken)) {
                return 'definition.name';
            }

            return 'variableName';
        }

        return null;
    }

    function tokenString(quote: string) {
        return function (stream: any, state: WizState): string | null {
            let escaped = false;
            let next;
            while ((next = stream.next()) != null) {
                if (next === quote && !escaped) {
                    state.tokenize = null;
                    break;
                }
                escaped = !escaped && next === '\\';
            }
            return 'string';
        };
    }

    function tokenComment(stream: any, state: WizState): string | null {
        let maybeEnd = false;
        let ch;
        while (ch = stream.next()) {
            if (ch === '/' && maybeEnd) {
                state.tokenize = null;
                break;
            }
            maybeEnd = (ch === '*');
        }
        return 'comment';
    }

    return {
        startState(): WizState {
            return {
                tokenize: null,
                lastToken: null
            };
        },

        token(stream, state) {
            if (stream.eatSpace()) {
                return null;
            }
            const style = (state.tokenize || tokenBase)(stream, state);

            // Track the last keyword token for context
            if (style === 'keyword') {
                state.lastToken = stream.current();
            } else if (style && style !== 'comment') {
                // Reset lastToken after we've used it (but keep it through comments)
                state.lastToken = null;
            }

            return style;
        }
    };
}

/**
 * Language support for Wiz
 */
export function wiz(): LanguageSupport {
    return new LanguageSupport(StreamLanguage.define(createWizParser()));
}
