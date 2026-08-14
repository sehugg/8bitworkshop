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
const pseudoOps = new Set([
    "org", "equ", "defl", "end",
    "phase", "dephase",
    "defb", "db", "byte", "ascii", "text", "defm", "dm",
    "defw", "dw", "word",
    "defd", "dword", "def3", "d3",
    "defs", "ds", "block", "rmem",
    "dc", "incbin", "include", "read", "maclib", "import",
    "public", "global", "entry", "extern", "ext", "extrn",
    "assert", "list", "nolist", "title", "name", "eject", "space",
    "jrpromote", "jperror",
    "irp", "irpc", "local",
    "sett", "tstate", "setocf",
    "rsym", "wsym",
    "aseg", "cseg", "dseg", "common",
    "comment", "pragma", "subttl",
    "z80", "8080", "z180",
    "min", "max",
]);
const macKeywords = {
    "macro": lang_z80_grammar_terms_1.Mac,
    "endm": lang_z80_grammar_terms_1.MacEnd,
    "exitm": lang_z80_grammar_terms_1.ControlOp,
    "rept": lang_z80_grammar_terms_1.Repeat,
};
const controlOps = new Set([
    "if", "else", "endif",
    "ifdef", "ifndef",
    "cond", "endc",
    "ifeq", "ifne", "iflt", "ifgt",
]);
exports.opcodes = new Set([
    // Z80 instructions
    "ld", "push", "pop", "inc", "dec", "add", "adc", "sub", "sbc", "and", "or", "xor",
    "cp", "ret", "jp", "jr", "call", "rst", "nop", "halt", "di", "ei",
    "im", "ex", "exx", "neg", "cpl", "ccf", "scf", "rlca", "rla", "rrca", "rra",
    "rlc", "rl", "rrc", "rr", "sla", "sra", "srl", "sl1", "bit", "set", "res",
    "out", "in", "djnz", "rld", "rrd", "ldi", "ldir", "ldd", "lddr", "cpi", "cpir", "cpd", "cpdr",
    "ini", "inir", "ind", "indr", "outi", "otir", "outd", "otdr",
    "daa", "reti", "retn", "pfix", "pfiy",
    // 8080 instructions
    "mov", "mvi", "lxi", "lda", "sta", "lhld", "shld", "ldax", "stax",
    "adi", "aci", "sui", "sbi", "sbb", "ana", "ani", "xra", "xri", "ora", "ori", "cmp",
    "inr", "dcr", "inx", "dcx", "dad",
    "cma", "stc", "cmc", "ral", "rar",
    "jmp", "jnz", "jz", "jnc", "jc", "jpo", "jpe", "jm",
    "cnz", "cz", "cnc", "cc", "cpo", "cpe", "cm",
    "rnz", "rz", "rnc", "rc", "rpo", "rpe", "rp", "rm",
    "pchl", "sphl", "xthl", "xchg", "hlt",
]);
const registers = new Set([
    "a", "b", "c", "d", "e", "h", "l", "i", "r",
    "af", "bc", "de", "hl", "ix", "iy", "sp", "pc", "psw",
    "ixh", "ixl", "iyh", "iyl", "xh", "xl", "yh", "yl", "hx", "lx", "hy", "ly",
]);
const conditions = new Set([
    "nz", "z", "nc", "c", "po", "pe", "p", "m",
]);
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