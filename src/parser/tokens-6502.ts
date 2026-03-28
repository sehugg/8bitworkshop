import { ExternalTokenizer } from "@lezer/lr"
import { HexByte, PseudoOp, Mac, MacEnd, ControlOp, LocalIdentifier, Opcode, Register, OnOff, HexOp } from "../../gen/parser/lang-6502.grammar.terms"

function isHexDigit(ch: number) {
    return (ch >= 48 && ch <= 57) ||  // 0-9
        (ch >= 65 && ch <= 70) ||     // A-F
        (ch >= 97 && ch <= 102)       // a-f
}

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
    "echo", "repeat", "repend", "set",
    "list",
    "err",
])

const macKeywords: Record<string, number> = {
    "mac": Mac, "macro": Mac,
    "endm": MacEnd, "mexit": MacEnd,
}

const controlOps = new Set([
    "if", "else", "endif", "ifconst", "ifnconst",
])

const opcodes = new Set([
    "adc", "and", "asl", "bcc", "bcs", "beq", "bit", "bmi",
    "bne", "bpl", "brk", "bvc", "bvs", "clc", "cld", "cli",
    "clv", "cmp", "cpx", "cpy", "dec", "dex", "dey", "eor",
    "inc", "inx", "iny", "jmp", "jsr", "lda", "ldx", "ldy",
    "lsr", "nop", "ora", "pha", "php", "pla", "plp", "rol",
    "ror", "rti", "rts", "sbc", "sec", "sed", "sei", "sta",
    "stx", "sty", "tax", "tay", "tsx", "txa", "txs", "tya",
])

const registers = new Set(["a", "x", "y"])

const onOffValues = new Set(["on", "off"])

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

export function localIdentifierSpecializer(value: string) {
    return value.startsWith(".") && value.length > 1 ? LocalIdentifier : -1
}

export function opcodeSpecializer(value: string) {
    return opcodes.has(value.toLowerCase()) ? Opcode : -1
}

export function registerSpecializer(value: string) {
    return registers.has(value.toLowerCase()) ? Register : -1
}

export function onOffSpecializer(value: string) {
    return onOffValues.has(value.toLowerCase()) ? OnOff : -1
}

export function hexOpSpecializer(value: string) {
    return value.toLowerCase() === "hex" ? HexOp : -1
}

export const hexTokenizer = new ExternalTokenizer((input) => {
    if (!isHexDigit(input.peek(0)) || !isHexDigit(input.peek(1))) return
    let len = 2
    while (isHexDigit(input.peek(len))) len++
    if (len % 2 === 0) input.acceptToken(HexByte, len)
})
