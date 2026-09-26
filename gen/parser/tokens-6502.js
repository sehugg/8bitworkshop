"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hexTokenizer = exports.illegalOpcodes = exports.opcodes = void 0;
exports.pseudoOpSpecializer = pseudoOpSpecializer;
exports.macSpecializer = macSpecializer;
exports.controlOpSpecializer = controlOpSpecializer;
exports.localIdentifierSpecializer = localIdentifierSpecializer;
exports.opcodeSpecializer = opcodeSpecializer;
exports.registerSpecializer = registerSpecializer;
exports.onOffSpecializer = onOffSpecializer;
exports.hexOpSpecializer = hexOpSpecializer;
const lr_1 = require("@lezer/lr");
const asmkeywords_1 = require("./asmkeywords");
const lang_6502_grammar_terms_1 = require("../../gen/parser/lang-6502.grammar.terms");
function isHexDigit(ch) {
    return (ch >= 48 && ch <= 57) || // 0-9
        (ch >= 65 && ch <= 70) || // A-F
        (ch >= 97 && ch <= 102); // a-f
}
exports.opcodes = new Set(asmkeywords_1.opcodes6502);
exports.illegalOpcodes = new Set(asmkeywords_1.illegalOpcodes6502);
const registers = new Set(asmkeywords_1.registers6502);
const pseudoOps = new Set(asmkeywords_1.dasmPseudoOps);
const macKeywords = {
    "mac": lang_6502_grammar_terms_1.Mac, "macro": lang_6502_grammar_terms_1.Mac,
    "endm": lang_6502_grammar_terms_1.MacEnd,
    "mexit": lang_6502_grammar_terms_1.ControlOp,
    "repeat": lang_6502_grammar_terms_1.Repeat,
    "repend": lang_6502_grammar_terms_1.RepEnd,
};
const controlOps = new Set(asmkeywords_1.dasmControlOps);
const onOffValues = new Set(["on", "off"]);
function pseudoOpSpecializer(value) {
    let normalized = value.startsWith(".") ? value.slice(1) : value;
    return pseudoOps.has(normalized.toLowerCase()) ? lang_6502_grammar_terms_1.PseudoOp : -1;
}
function macSpecializer(value) {
    var _a;
    let normalized = value.startsWith(".") ? value.slice(1) : value;
    return (_a = macKeywords[normalized.toLowerCase()]) !== null && _a !== void 0 ? _a : -1;
}
function controlOpSpecializer(value) {
    let normalized = value.startsWith(".") ? value.slice(1) : value;
    return controlOps.has(normalized.toLowerCase()) ? lang_6502_grammar_terms_1.ControlOp : -1;
}
function localIdentifierSpecializer(value) {
    if (!value.startsWith(".") || value.length <= 1)
        return -1;
    // Don't claim dot-prefixed keywords that other specializers handle
    const bare = value.slice(1).toLowerCase();
    if (pseudoOps.has(bare) || bare in macKeywords || controlOps.has(bare))
        return -1;
    return lang_6502_grammar_terms_1.LocalIdentifier;
}
function opcodeSpecializer(value) {
    let lower = value.toLowerCase();
    if (exports.opcodes.has(lower))
        return lang_6502_grammar_terms_1.Opcode;
    if (exports.illegalOpcodes.has(lower))
        return lang_6502_grammar_terms_1.IllegalOpcode;
    return -1;
}
function registerSpecializer(value) {
    return registers.has(value.toLowerCase()) ? lang_6502_grammar_terms_1.Register : -1;
}
function onOffSpecializer(value) {
    return onOffValues.has(value.toLowerCase()) ? lang_6502_grammar_terms_1.OnOff : -1;
}
function hexOpSpecializer(value) {
    return value.toLowerCase() === "hex" ? lang_6502_grammar_terms_1.HexOp : -1;
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