import { LRLanguage, LanguageSupport } from "@codemirror/language"
import { styleTags, tags as t } from "@lezer/highlight"
import { parser } from "../../gen/parser/lang-z80.grammar.js"

export const LezerZ80: LRLanguage = LRLanguage.define({
    parser: parser.configure({
        props: [
            styleTags({
                Identifier: t.variableName,
                PseudoOp: t.keyword,
                Opcode: t.standard(t.keyword),
                Register: t.standard(t.modifier),
                Condition: t.standard(t.modifier),
                Label: t.labelName,
                String: t.string,
                Char: t.character,
                Number: t.number,
                Comment: t.comment,
                ArithOp: t.arithmeticOperator,
                Plus: t.arithmeticOperator,
                Minus: t.arithmeticOperator,
                Percent: t.arithmeticOperator,
                BitOp: t.bitwiseOperator,
                Tilde: t.bitwiseOperator,
                LogicOp: t.logicOperator,
                Not: t.logicOperator,
                CompareOp: t.compareOperator,
                BinaryLt: t.compareOperator,
                BinaryGt: t.compareOperator,
                UnaryLt: t.arithmeticOperator,
                UnaryGt: t.arithmeticOperator,
                Mac: t.definitionKeyword,
                MacEnd: t.definitionKeyword,
                "MacroDef/Identifier": t.macroName,
                ControlOp: t.controlKeyword,
                Comma: t.separator,
                Colon: t.separator,
                "( )": t.paren
            })
        ]
    }),
    languageData: {
        commentTokens: { line: ";" }
    }
})

export function asmZ80(): LanguageSupport {
    return new LanguageSupport(LezerZ80)
}
