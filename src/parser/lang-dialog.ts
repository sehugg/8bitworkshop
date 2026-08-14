// CodeMirror 6 language support for Dialog
// https://linusakesson.net/dialog/docs/

import { StreamLanguage, StreamParser } from "@codemirror/language";
import { LanguageSupport } from "@codemirror/language";

interface DialogState {
    // parens are only nested inside a rule head/query; column 0 starts a rule
    depth: number;
}

// TODO: Migrate to CodeMirror 6 Lezer parser.
function createDialogParser(): StreamParser<DialogState> {
    // control keywords appear as the first word inside a parenthesis
    const keywords = new Set([
        "if", "then", "elseif", "else", "endif", "or", "select", "stopping",
        "at random", "purely at random", "then purely at random", "cycling",
        "collect", "into", "collect words", "determine object", "from words",
        "matching all of", "stoppable", "stop", "just", "exhaust", "repeat forever",
        "now", "global variable", "generate", "interface", "fail",
    ]);

    function token(stream: any, state: DialogState): string | null {
        if (stream.eatSpace()) return null;
        const ch = stream.peek();
        // %% comment to end of line
        if (stream.match("%%")) {
            stream.skipToEnd();
            return "comment";
        }
        // \( and \) are escaped literals inside text
        if (stream.match(/\\./)) {
            return "escape";
        }
        if (ch == "(" || ch == ")") {
            stream.next();
            state.depth += ch == "(" ? 1 : -1;
            if (state.depth < 0) state.depth = 0;
            return "bracket";
        }
        if (ch == "[" || ch == "]" || ch == "{" || ch == "}") {
            stream.next();
            return "bracket";
        }
        // $Variable, or $ for an anonymous variable
        if (stream.match(/\$[a-zA-Z0-9_]*/)) {
            return "variableName";
        }
        // #object name
        if (stream.match(/#[a-zA-Z0-9_+-]+/)) {
            return "atom";
        }
        // @style class
        if (stream.match(/@[a-zA-Z0-9_-]+/)) {
            return "className";
        }
        if (stream.match(/-?\d+\b/)) {
            return "number";
        }
        // ~ negation, * multi-query, | list tail
        if (stream.match(/[~*|]/)) {
            return "operator";
        }
        // words: keywords only count at the start of a predicate
        if (stream.match(/[^\s()\[\]{}$#@~*|\\%]+/)) {
            if (state.depth > 0 && keywords.has(stream.current().toLowerCase())) {
                return "keyword";
            }
            // text outside of parentheses is printed verbatim by the story
            return state.depth > 0 ? null : "string";
        }
        stream.next();
        return null;
    }

    return {
        startState(): DialogState {
            return { depth: 0 };
        },
        token,
        languageData: {
            commentTokens: { line: "%%" }
        }
    };
}

/**
 * Language support for Dialog
 */
export function dialog(): LanguageSupport {
    return new LanguageSupport(StreamLanguage.define(createDialogParser()));
}
