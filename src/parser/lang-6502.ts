import { LRLanguage, LanguageSupport, delimitedIndent, foldInside, foldNodeProp, indentNodeProp } from "@codemirror/language"
import { styleTags, tags as t } from "@lezer/highlight"
import { parser } from "../../gen/parser/lang-6502.grammar.js"

export const Lezer6502: LRLanguage = LRLanguage.define({
    parser: parser.configure({
        props: [
            indentNodeProp.add({
                Application: delimitedIndent({ closing: ")", align: false })
            }),
            foldNodeProp.add({
                Application: foldInside
            }),
            styleTags({
                Identifier: t.variableName,
                CurrentAddress: t.self,
                PseudoOp: t.definition(t.variableName),
                Opcode: t.keyword,
                Label: t.labelName,
                String: t.string,
                Char: t.number,
                Number: t.number,
                Register: t.typeName,
                Comment: t.lineComment,
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
                ErrorOp: t.keyword,
                Comma: t.separator,
                "( )": t.paren
            })
        ]
    }),
    languageData: {
        commentTokens: { line: ";" }
    }
})

export function asm6502(): LanguageSupport {
    return new LanguageSupport(Lezer6502)
}
