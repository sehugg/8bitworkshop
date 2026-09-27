"use strict";
// C language support: @fazelstudio/codemirror-lang-c with fixed indent rules.
// The package's IfStatement rule calls a nonexistent context.matchCh() and
// throws, which leaves Enter with no indentation, and it doesn't indent case bodies.
// Inside braces, a new line matches the statement above it, so files keep
// their own indent width.
Object.defineProperty(exports, "__esModule", { value: true });
exports.cLanguage = void 0;
exports.c = c;
const language_1 = require("@codemirror/language");
const codemirror_lang_c_1 = require("@fazelstudio/codemirror-lang-c");
const blockIndent = (0, language_1.delimitedIndent)({ closing: "}" });
const caseLabel = /^\s*(case\b|default\b|\})/;
const skipSiblings = new Set(["{", "BlockComment", "LineComment", "PreprocDirective"]);
// Indentation of the nearest item above 'pos' in this braced node that starts
// its own line below the opening brace, or null if there is none.
function siblingIndent(context) {
    const doc = context.state.doc;
    const openLine = doc.lineAt(context.node.from).number;
    for (let child = context.node.childBefore(context.pos); child; child = child.prevSibling) {
        if (skipSiblings.has(child.name) || child.type.isError)
            continue;
        const line = doc.lineAt(child.from);
        if (line.number <= openLine)
            break;
        if (/^\s*$/.test(line.text.slice(0, child.from - line.from)))
            return context.lineIndent(child.from);
    }
    return null;
}
// Closing brace aligns with the opener; other lines match the item above.
function bracedIndent(context) {
    if (!/^\s*\}/.test(context.textAfter)) {
        const indent = siblingIndent(context);
        if (indent != null)
            return indent;
    }
    return blockIndent(context);
}
exports.cLanguage = codemirror_lang_c_1.cLanguage.configure({
    props: [
        language_1.indentNodeProp.add({
            IfStatement: (0, language_1.continuedIndent)({ except: /^\s*({|else\b)/ }),
            // In a switch body, lines after "case x:" indent one unit past the label.
            CompoundStatement: (context) => {
                var _a;
                if (((_a = context.node.parent) === null || _a === void 0 ? void 0 : _a.name) == "SwitchStatement" && !caseLabel.test(context.textAfter)) {
                    const last = context.node.childBefore(context.pos);
                    if ((last === null || last === void 0 ? void 0 : last.name) == "CaseStatement")
                        return context.lineIndent(last.from) + context.unit;
                }
                return bracedIndent(context);
            },
            FieldDeclarationList: bracedIndent,
            EnumeratorList: bracedIndent,
            InitializerList: bracedIndent,
            CaseStatement: (context) => context.baseIndent + (caseLabel.test(context.textAfter) ? 0 : context.unit),
        }),
    ],
});
function c() {
    return new language_1.LanguageSupport(exports.cLanguage);
}
//# sourceMappingURL=lang-c.js.map