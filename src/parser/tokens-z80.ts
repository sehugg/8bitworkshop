import { PseudoOp, Mac, MacEnd, Repeat, ControlOp, Opcode, Register, Condition } from "../../gen/parser/lang-z80.grammar.terms"
import { zmacPseudoOps, zmacControlOps, opcodesZ80, registersZ80, conditionsZ80 } from "./asmkeywords"

const pseudoOps = new Set(zmacPseudoOps)

const macKeywords: Record<string, number> = {
    "macro": Mac,
    "endm": MacEnd,
    "exitm": ControlOp,
    "rept": Repeat,
}

const controlOps = new Set(zmacControlOps)

export const opcodes = new Set(opcodesZ80)

const registers = new Set(registersZ80)

const conditions = new Set(conditionsZ80)

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
