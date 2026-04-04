export const opcodes = new Set([
    // 6809 instructions
    "abx", "adca", "adcb", "adda", "addb", "addd", "anda", "andb", "andcc", "asr", "asra",
    "asrb", "beq", "bge", "bgt", "bhi", "bhs", "bita", "bitb", "ble", "blo", "bls", "blt",
    "bmi", "bne", "bpl", "bra", "brn", "bsr", "bvc", "bvs", "clr", "clra", "clrb", "cmpa",
    "cmpb", "cmpd", "cmps", "cmpu", "cmpx", "cmpy", "com", "coma", "comb", "cwai", "daa",
    "dec", "deca", "decb", "eora", "eorb", "exg", "inc", "inca", "incb", "jmp", "jsr",
    "lbeq", "lbge", "lbgt", "lbhi", "lbhs", "lble", "lbls", "lblt", "lbmi", "lbne",
    "lbra", "lbrn", "lbsr", "lbvc", "lbvs", "lda", "ldb", "ldd", "lds", "ldu", "ldx",
    "ldy", "leas", "leau", "leax", "leay", "lpbl", "lsl", "lsla", "lslb", "lsr", "lsra",
    "lsrb", "mul", "neg", "nega", "negb", "nop", "ora", "orb", "orcc", "page", "pshs",
    "pshu", "puls", "pulu", "rol", "rola", "rolb", "ror", "rora", "rorb", "rti", "rts",
    "sbca", "sbcb", "sex", "sta", "stb", "std", "sts", "stu", "stx", "sty", "suba",
    "subb", "subd", "swi", "swi2", "swi3", "sync", "tfr", "tst", "tsta", "tstb"
]);