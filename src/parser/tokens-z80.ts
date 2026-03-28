import { PseudoOp, Mac, MacEnd, ControlOp, Opcode, Register, Condition } from "../../gen/parser/lang-z80.grammar.terms"

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
    "rept", "irp", "irpc", "local",
    "sett", "tstate", "setocf",
    "rsym", "wsym",
    "aseg", "cseg", "dseg", "common",
    "comment", "pragma", "subttl",
    "z80", "8080", "z180",
    "min", "max",
])

const macKeywords: Record<string, number> = {
    "macro": Mac,
    "endm": MacEnd, "exitm": MacEnd,
}

const controlOps = new Set([
    "if", "else", "endif",
    "ifdef", "ifndef",
    "cond", "endc",
    "ifeq", "ifne", "iflt", "ifgt",
])

const opcodes = new Set([
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
])

const registers = new Set([
    "a", "b", "c", "d", "e", "h", "l", "i", "r",
    "af", "bc", "de", "hl", "ix", "iy", "sp", "pc", "psw",
    "ixh", "ixl", "iyh", "iyl", "xh", "xl", "yh", "yl", "hx", "lx", "hy", "ly",
])

const conditions = new Set([
    "nz", "z", "nc", "po", "pe", "p", "m",
])

export function pseudoOpSpecializer(value: string) {
    let normalized = value.startsWith(".") ? value.slice(1) : value
    return pseudoOps.has(normalized.toLowerCase()) ? PseudoOp : -1
}

export function macSpecializer(value: string) {
    let normalized = value.startsWith(".") ? value.slice(1) : value
    return macKeywords[normalized.toLowerCase()] ?? -1
}

export function controlOpSpecializer(value: string) {
    let normalized = value.startsWith(".") ? value.slice(1) : value
    return controlOps.has(normalized.toLowerCase()) ? ControlOp : -1
}

export function opcodeSpecializer(value: string) {
    return opcodes.has(value.toLowerCase()) ? Opcode : -1
}

export function registerSpecializer(value: string) {
    return registers.has(value.toLowerCase()) ? Register : -1
}

export function conditionSpecializer(value: string) {
    return conditions.has(value.toLowerCase()) ? Condition : -1
}
