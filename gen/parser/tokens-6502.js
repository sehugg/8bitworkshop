"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hexTokenizer = void 0;
const lr_1 = require("@lezer/lr");
const lang_6502_grammar_terms_1 = require("../../gen/parser/lang-6502.grammar.terms");
function isHexDigit(ch) {
    return (ch >= 48 && ch <= 57) || // 0-9
        (ch >= 65 && ch <= 70) || // A-F
        (ch >= 97 && ch <= 102); // a-f
}
exports.hexTokenizer = new lr_1.ExternalTokenizer((input) => {
    if (!isHexDigit(input.peek(0)) || !isHexDigit(input.peek(1)))
        return;
    let len = 2;
    while (isHexDigit(input.peek(len)))
        len++;
    if (len % 2 === 0)
        input.acceptToken(lang_6502_grammar_terms_1.HexByte, len);
});
//# sourceMappingURL=tokens-6502.js.map