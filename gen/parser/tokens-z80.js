"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.opcodes = void 0;
exports.pseudoOpSpecializer = pseudoOpSpecializer;
exports.macSpecializer = macSpecializer;
exports.controlOpSpecializer = controlOpSpecializer;
exports.opcodeSpecializer = opcodeSpecializer;
exports.registerSpecializer = registerSpecializer;
exports.conditionSpecializer = conditionSpecializer;
const lang_z80_grammar_terms_1 = require("../../gen/parser/lang-z80.grammar.terms");
const asmkeywords_1 = require("./asmkeywords");
const pseudoOps = new Set(asmkeywords_1.zmacPseudoOps);
const macKeywords = {
    "macro": lang_z80_grammar_terms_1.Mac,
    "endm": lang_z80_grammar_terms_1.MacEnd,
    "exitm": lang_z80_grammar_terms_1.ControlOp,
    "rept": lang_z80_grammar_terms_1.Repeat,
};
const controlOps = new Set(asmkeywords_1.zmacControlOps);
exports.opcodes = new Set(asmkeywords_1.opcodesZ80);
const registers = new Set(asmkeywords_1.registersZ80);
const conditions = new Set(asmkeywords_1.conditionsZ80);
function pseudoOpSpecializer(value) {
    let normalized = value.startsWith(".") ? value.slice(1) : value;
    return pseudoOps.has(normalized.toLowerCase()) ? lang_z80_grammar_terms_1.PseudoOp : -1;
}
function macSpecializer(value) {
    var _a;
    let normalized = value.startsWith(".") ? value.slice(1) : value;
    return (_a = macKeywords[normalized.toLowerCase()]) !== null && _a !== void 0 ? _a : -1;
}
function controlOpSpecializer(value) {
    let normalized = value.startsWith(".") ? value.slice(1) : value;
    return controlOps.has(normalized.toLowerCase()) ? lang_z80_grammar_terms_1.ControlOp : -1;
}
function opcodeSpecializer(value) {
    return exports.opcodes.has(value.toLowerCase()) ? lang_z80_grammar_terms_1.Opcode : -1;
}
function registerSpecializer(value) {
    return registers.has(value.toLowerCase()) ? lang_z80_grammar_terms_1.Register : -1;
}
function conditionSpecializer(value) {
    return conditions.has(value.toLowerCase()) ? lang_z80_grammar_terms_1.Condition : -1;
}
//# sourceMappingURL=tokens-z80.js.map