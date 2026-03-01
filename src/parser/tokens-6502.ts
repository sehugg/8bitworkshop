import { ExternalTokenizer } from "@lezer/lr"
import { HexByte } from "../../gen/parser/lang-6502.grammar.terms"

function isHexDigit(ch: number) {
    return (ch >= 48 && ch <= 57) ||  // 0-9
        (ch >= 65 && ch <= 70) ||     // A-F
        (ch >= 97 && ch <= 102)       // a-f
}

export const hexTokenizer = new ExternalTokenizer((input) => {
    if (!isHexDigit(input.peek(0)) || !isHexDigit(input.peek(1))) return
    let len = 2
    while (isHexDigit(input.peek(len))) len++
    if (len % 2 === 0) input.acceptToken(HexByte, len)
})
