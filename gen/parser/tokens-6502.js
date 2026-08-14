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
const lang_6502_grammar_terms_1 = require("../../gen/parser/lang-6502.grammar.terms");
function isHexDigit(ch) {
    return (ch >= 48 && ch <= 57) || // 0-9
        (ch >= 65 && ch <= 70) || // A-F
        (ch >= 97 && ch <= 102); // a-f
}
exports.opcodes = new Set([
    "adc", "and", "asl", "bcc", "bcs", "beq", "bit", "bmi",
    "bne", "bpl", "brk", "bvc", "bvs", "clc", "cld", "cli",
    "clv", "cmp", "cpx", "cpy", "dec", "dex", "dey", "eor",
    "inc", "inx", "iny", "jmp", "jsr", "lda", "ldx", "ldy",
    "lsr", "nop", "ora", "pha", "php", "pla", "plp", "rol",
    "ror", "rti", "rts", "sbc", "sec", "sed", "sei", "sta",
    "stx", "sty", "tax", "tay", "tsx", "txa", "txs", "tya",
]);
// Undocumented/illegal opcodes (canonical names plus common dasm/ca65
// aliases for the same underlying instruction). Highly unstable ones
// (behavior varies by chip revision) are commented out.
exports.illegalOpcodes = new Set([
    "slo", "aso", "rla", "sre", "lse", "rra",
    "sax", "aax", "lax",
    //"lxa",
    "dcp", "dcm", "isc", "isb",
    "anc", "alr", "asr", "arr",
    //"xaa", "ane",
    "sbx", "axs",
    //"sha", "shx", "shy", "tas", "sxa", "xas",
    //"ahx", "axa", "sya", "shs",
    "las", "lar",
    //"jam", "kil", "hlt",
]);
const registers = new Set(["a", "x", "y"]);
const pseudoOps = new Set([
    "org", "rorg", "rend",
    "equ", "eqm",
    "end",
    "seg", "seg.u",
    "align",
    "dc", "dc.b", "dc.w", "dc.l", "dc.s",
    "ds", "ds.b", "ds.w", "ds.l", "ds.s",
    "dv", "dv.b", "dv.w", "dv.l", "dv.s",
    "byte", "word", "long",
    "subroutine", "processor",
    "include", "incbin", "incdir",
    "echo", "set",
    "list",
    "err",
]);
const macKeywords = {
    "mac": lang_6502_grammar_terms_1.Mac, "macro": lang_6502_grammar_terms_1.Mac,
    "endm": lang_6502_grammar_terms_1.MacEnd,
    "mexit": lang_6502_grammar_terms_1.ControlOp,
    "repeat": lang_6502_grammar_terms_1.Repeat,
    "repend": lang_6502_grammar_terms_1.RepEnd,
};
const controlOps = new Set([
    "if", "else", "endif", "ifconst", "ifnconst",
]);
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