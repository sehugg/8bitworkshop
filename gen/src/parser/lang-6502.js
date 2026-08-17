"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lezer6502 = void 0;
exports.asm6502 = asm6502;
const language_1 = require("@codemirror/language");
const highlight_1 = require("@lezer/highlight");
const lang_6502_grammar_js_1 = require("../../gen/parser/lang-6502.grammar.js");
exports.Lezer6502 = language_1.LRLanguage.define({
    parser: lang_6502_grammar_js_1.parser.configure({
        props: [
            language_1.foldNodeProp.add({
                MacroDef: language_1.foldInside,
                RepeatBlock: language_1.foldInside
            }),
            (0, highlight_1.styleTags)({
                Identifier: highlight_1.tags.variableName,
                LocalIdentifier: highlight_1.tags.local(highlight_1.tags.variableName),
                CurrentAddress: highlight_1.tags.self,
                PseudoOp: highlight_1.tags.keyword,
                Equals: highlight_1.tags.keyword,
                Opcode: highlight_1.tags.standard(highlight_1.tags.keyword),
                IllegalOpcode: highlight_1.tags.special(highlight_1.tags.keyword),
                Label: highlight_1.tags.labelName,
                String: highlight_1.tags.string,
                Char: highlight_1.tags.character,
                Number: highlight_1.tags.number,
                OnOff: highlight_1.tags.bool,
                Register: highlight_1.tags.standard(highlight_1.tags.modifier),
                ImmediatePrefix: highlight_1.tags.constant(highlight_1.tags.modifier),
                Comment: highlight_1.tags.comment,
                ArithOp: highlight_1.tags.arithmeticOperator,
                Plus: highlight_1.tags.arithmeticOperator,
                Minus: highlight_1.tags.arithmeticOperator,
                Percent: highlight_1.tags.arithmeticOperator,
                BitOp: highlight_1.tags.bitwiseOperator,
                Tilde: highlight_1.tags.bitwiseOperator,
                LogicOp: highlight_1.tags.logicOperator,
                Not: highlight_1.tags.logicOperator,
                CompareOp: highlight_1.tags.compareOperator,
                BinaryLt: highlight_1.tags.compareOperator,
                BinaryGt: highlight_1.tags.compareOperator,
                UnaryLt: highlight_1.tags.arithmeticOperator,
                UnaryGt: highlight_1.tags.arithmeticOperator,
                HexOp: highlight_1.tags.keyword,
                HexByte: highlight_1.tags.number,
                Mac: highlight_1.tags.definitionKeyword,
                MacEnd: highlight_1.tags.definitionKeyword,
                Repeat: highlight_1.tags.controlKeyword,
                RepEnd: highlight_1.tags.controlKeyword,
                "MacroDef/Identifier": highlight_1.tags.macroName,
                ControlOp: highlight_1.tags.controlKeyword,
                Comma: highlight_1.tags.separator,
                Colon: highlight_1.tags.separator,
                "( )": highlight_1.tags.paren
            })
        ]
    }),
    languageData: {
        commentTokens: { line: ";" }
    }
});
function asm6502() {
    return new language_1.LanguageSupport(exports.Lezer6502);
}
//# sourceMappingURL=lang-6502.js.map