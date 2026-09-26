"use strict";
// Assembler keyword tables, shared by the IDE's Lezer tokenizers
// (tokens-*.ts) and the VS Code TextMate grammar generator
// (extension/src/syntaxgen.ts). Plain data: no Lezer imports.
// All names are lowercase; matching is case-insensitive.
Object.defineProperty(exports, "__esModule", { value: true });
exports.motorolaPseudoOps = exports.registers6809 = exports.opcodes6809 = exports.zmacControlOps = exports.zmacMacroOps = exports.zmacPseudoOps = exports.conditionsZ80 = exports.registersZ80 = exports.opcodesGBZ80 = exports.opcodesZ80 = exports.sdasDirectives = exports.ca65Functions = exports.ca65Directives = exports.dasmControlOps = exports.dasmMacroOps = exports.dasmPseudoOps = exports.registers6502 = exports.opcodes65C02 = exports.illegalOpcodes6502 = exports.opcodes6502 = void 0;
//// 6502
exports.opcodes6502 = [
    "adc", "and", "asl", "bcc", "bcs", "beq", "bit", "bmi",
    "bne", "bpl", "brk", "bvc", "bvs", "clc", "cld", "cli",
    "clv", "cmp", "cpx", "cpy", "dec", "dex", "dey", "eor",
    "inc", "inx", "iny", "jmp", "jsr", "lda", "ldx", "ldy",
    "lsr", "nop", "ora", "pha", "php", "pla", "plp", "rol",
    "ror", "rti", "rts", "sbc", "sec", "sed", "sei", "sta",
    "stx", "sty", "tax", "tay", "tsx", "txa", "txs", "tya",
];
// Undocumented/illegal opcodes (canonical names plus common dasm/ca65
// aliases for the same underlying instruction). Highly unstable ones
// (behavior varies by chip revision) are commented out.
exports.illegalOpcodes6502 = [
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
];
// 65C02 additions (ca65 .pc02/.psc02); not in the IDE's 6502 parser
exports.opcodes65C02 = [
    "bra", "phx", "phy", "plx", "ply", "stz", "trb", "tsb", "ina", "dea",
    "bbr0", "bbr1", "bbr2", "bbr3", "bbr4", "bbr5", "bbr6", "bbr7",
    "bbs0", "bbs1", "bbs2", "bbs3", "bbs4", "bbs5", "bbs6", "bbs7",
    "rmb0", "rmb1", "rmb2", "rmb3", "rmb4", "rmb5", "rmb6", "rmb7",
    "smb0", "smb1", "smb2", "smb3", "smb4", "smb5", "smb6", "smb7",
    "stp", "wai",
];
exports.registers6502 = ["a", "x", "y"];
// dasm directives, with or without a leading dot
exports.dasmPseudoOps = [
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
];
exports.dasmMacroOps = ["mac", "macro", "endm", "mexit", "repeat", "repend"];
exports.dasmControlOps = ["if", "else", "endif", "ifconst", "ifnconst"];
// ca65 control commands; always written with a leading dot
exports.ca65Directives = [
    "a16", "a8", "addr", "align", "asciiz", "assert", "autoimport",
    "bankbytes", "bss", "byt", "byte", "case", "charmap", "code", "condes",
    "constructor", "cpu", "data", "dbyt", "debuginfo", "define", "delmac",
    "delmacro", "destructor", "dword", "else", "elseif", "end", "endenum",
    "endif", "endmac", "endmacro", "endproc", "endrep", "endrepeat",
    "endscope", "endstruct", "endunion", "enum", "error", "exitmac",
    "exitmacro", "export", "exportzp", "faraddr", "fatal", "feature",
    "fileopt", "fopt", "forceimport", "global", "globalzp", "hibytes", "i16",
    "i8", "if", "ifblank", "ifconst", "ifdef", "ifnblank", "ifndef",
    "ifnref", "ifp02", "ifp4510", "ifp816", "ifpc02", "ifpsc02", "ifref",
    "import", "importzp", "incbin", "include", "interruptor", "linecont",
    "list", "listbytes", "literal", "lobytes", "local", "localchar",
    "macpack", "mac", "macro", "org", "out", "p02", "p4510", "p816",
    "pagelen", "pagelength", "pc02", "popcharmap", "popcpu", "popseg",
    "proc", "psc02", "pushcharmap", "pushcpu", "pushseg", "reloc", "repeat",
    "res", "rodata", "scope", "segment", "set", "setcpu", "smart", "struct",
    "tag", "undef", "undefine", "union", "warning", "word", "zeropage",
];
// ca65 pseudo functions and variables, used inside expressions
exports.ca65Functions = [
    "addrsize", "asize", "bank", "bankbyte", "blank", "concat", "const",
    "cpu", "def", "defined", "definedmacro", "hibyte", "hiword", "ident",
    "isize", "ismnem", "ismnemonic", "left", "lobyte", "loword", "match",
    "max", "mid", "min", "paramcount", "ref", "referenced", "right",
    "sizeof", "sprintf", "strat", "string", "strlen", "tcount", "time",
    "version", "xmatch",
];
//// sdas (ASxxxx), used by sdcc and cmoc; always written with a leading dot
exports.sdasDirectives = [
    "area", "ascii", "asciz", "ascis", "blkb", "blkw", "blk3", "blk4",
    "bndry", "byte", "db", "dw", "ds", "else", "endif", "endm", "equ",
    "even", "fcb", "fdb", "gblequ", "globl", "if", "ifdef", "ifndef",
    "include", "incbin", "lclequ", "list", "macro", "module", "nlist",
    "odd", "optsdcc", "org", "page", "radix", "rmb", "sbttl", "setdp",
    "str", "strz", "title", "word",
];
//// Z80 (zmac, sdasz80)
exports.opcodesZ80 = [
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
];
// Game Boy (sdasgb) additions
exports.opcodesGBZ80 = ["ldh", "ldhl", "stop", "swap"];
exports.registersZ80 = [
    "a", "b", "c", "d", "e", "h", "l", "i", "r",
    "af", "bc", "de", "hl", "ix", "iy", "sp", "pc", "psw",
    "ixh", "ixl", "iyh", "iyl", "xh", "xl", "yh", "yl", "hx", "lx", "hy", "ly",
];
exports.conditionsZ80 = ["nz", "z", "nc", "c", "po", "pe", "p", "m"];
// zmac directives, with or without a leading dot
exports.zmacPseudoOps = [
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
];
exports.zmacMacroOps = ["macro", "endm", "exitm", "rept"];
exports.zmacControlOps = [
    "if", "else", "endif",
    "ifdef", "ifndef",
    "cond", "endc",
    "ifeq", "ifne", "iflt", "ifgt",
];
//// 6809 (xasm6809, lwasm)
exports.opcodes6809 = [
    "abx", "adca", "adcb", "adda", "addb", "addd", "anda", "andb", "andcc", "asr", "asra",
    "asrb", "beq", "bge", "bgt", "bhi", "bhs", "bita", "bitb", "ble", "blo", "bls", "blt",
    "bmi", "bne", "bpl", "bra", "brn", "bsr", "bvc", "bvs", "clr", "clra", "clrb", "cmpa",
    "cmpb", "cmpd", "cmps", "cmpu", "cmpx", "cmpy", "com", "coma", "comb", "cwai", "daa",
    "dec", "deca", "decb", "eora", "eorb", "exg", "inc", "inca", "incb", "jmp", "jsr",
    "lbcc", "lbcs", "lbeq", "lbge", "lbgt", "lbhi", "lbhs", "lble", "lblo", "lbls", "lblt",
    "lbmi", "lbne", "lbpl", "lbra", "lbrn", "lbsr", "lbvc", "lbvs", "lda", "ldb", "ldd",
    "lds", "ldu", "ldx", "ldy", "leas", "leau", "leax", "leay", "lsl", "lsla", "lslb",
    "lsr", "lsra", "lsrb", "mul", "neg", "nega", "negb", "nop", "ora", "orb", "orcc",
    "pshs", "pshu", "puls", "pulu", "rol", "rola", "rolb", "ror", "rora", "rorb", "rti",
    "rts", "sbca", "sbcb", "sex", "sta", "stb", "std", "sts", "stu", "stx", "sty", "suba",
    "subb", "subd", "swi", "swi2", "swi3", "sync", "tfr", "tst", "tsta", "tstb",
    "bcc", "bcs",
    "cpx", "cpy", // xasm6809 aliases for cmpx, cmpy
];
exports.registers6809 = ["a", "b", "d", "x", "y", "u", "s", "pc", "pcr", "cc", "dp"];
// Motorola-style directives (xasm6809, lwasm), with or without a leading dot
exports.motorolaPseudoOps = [
    "org", "equ", "set", "setdp", "end", "rmb", "rmd", "rmq", "zmb", "zmd", "bsz",
    "fcb", "fdb", "fqb", "fcc", "fcs", "fcn", "fill", "align",
    "include", "includebin", "use", "section", "endsection", "sect", "endsect",
    "export", "import", "extern", "public", "pragma", "opt", "nam", "ttl", "page",
    "macro", "endm", "struct", "endstruct", "rept", "endr",
    "if", "ifdef", "ifndef", "ifeq", "ifne", "ifgt", "ifge", "iflt", "ifle",
    "else", "endc", "endif",
];
//# sourceMappingURL=asmkeywords.js.map