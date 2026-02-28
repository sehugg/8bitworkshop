// CodeMirror 6 language support for Batari Basic
// Migrated from CodeMirror 5 mode
// Original copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

import { StreamLanguage, StreamParser } from "@codemirror/language";
import { LanguageSupport } from "@codemirror/language";

interface BatariBasicState {
    context: number;
}

// TODO: Migrate to CodeMirror 6 Lezer parser.
function createBatariBasicParser(): StreamParser<BatariBasicState> {
    const directives_list = [
        'rem', 'if', 'else', 'then', 'goto',
        'includesfile', 'include', 'inline', 'function',
        'bank', 'sdata', 'data',
        'on', 'off',
        'up', 'down',
        'const', 'dim', 'for', 'next', 'gosub',
        'pfpixel', 'pfhline', 'pfclear', 'pfvline', 'pfscroll',
        'drawscreen', 'asm', 'pop', 'set', 'return', 'reboot', 'vblank',
        'pfcolors', 'pfheights', 'playfield', 'lives',
        'player0', 'player1', 'player2', 'player3', 'player4', 'player5',
        'player0color', 'player1color',
        'let',
        'switchreset', 'switchselect', 'switchleftb', 'switchrightb', 'switchbw',
        'joy0up', 'joy0down', 'joy0left', 'joy0right', 'joy1up', 'joy1down', 'joy1left', 'joy1right', 'joy0fire', 'joy1fire',
        'size', '2k', '8k', '8kSC', '16k', '16kSC', '32k', '32kSC', '4k',
        'thisbank', 'otherbank', 'flip',
        'collision', 'missile0', 'missile1', 'ball',
        'stackpull', 'rand', 'score', 'scorec', 'Areg',
        'smartbranching', 'romsize', 'optimization', 'speed', 'size',
        'noinlinedata', 'inlinerand', 'none', 'kernal', 'kernel_options',
        'readpaddle', 'player1colors', 'playercolors', 'no_blank_lines',
        'kernel', 'multisprite', 'multisprite_no_include', 'debug',
        'cyclescore', 'cycles', 'legacy'
    ];

    const directives = new Map<string, string>();
    directives_list.forEach(s => directives.set(s, 'keyword'));

    const numbers = /^([$][0-9a-f]+|[%][01]+|[0-9.]+)/i;

    return {
        startState(): BatariBasicState {
            return {
                context: 0
            };
        },

        token(stream, state) {
            if (!stream.column()) {
                state.context = 0;
                if (stream.eatWhile(/[\w.]/)) {
                    if (stream.current().toLowerCase() == 'end')
                        return 'keyword';
                    else
                        return 'meta';
                }
            }

            if (stream.eatSpace())
                return null;

            let w;
            if (stream.eatWhile(/[$%A-Z0-9]/i)) {
                w = stream.current();
                const cur = w.toLowerCase();
                const style = directives.get(cur);

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
}

/**
 * Language support for Batari Basic
 */
export function batariBasic(): LanguageSupport {
    return new LanguageSupport(StreamLanguage.define(createBatariBasicParser()));
}
