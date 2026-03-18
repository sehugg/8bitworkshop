"use strict";
// based on https://github.com/mamedev/mame/blob/master/src/devices/cpu/f8/f8.cpp
// license:BSD-3-Clause
// copyright-holders:Juergen Buchmueller
// and https://raw.githubusercontent.com/mamedev/mame/master/src/mame/fairchild/channelf.cpp
// license:GPL-2.0+
// copyright-holders:Juergen Buchmueller, Frank Palazzolo, Sean Riddle
Object.defineProperty(exports, "__esModule", { value: true });
exports.F8CPU = void 0;
// Status register flag bits
const FLAG_S = 0x01; // Sign (complementary: set when positive)
const FLAG_C = 0x02; // Carry
const FLAG_Z = 0x04; // Zero
const FLAG_O = 0x08; // Overflow
const FLAG_I = 0x10; // Interrupt Control Bit
class F8CPU {
    constructor() {
        // Registers
        this.PC0 = 0; // active program counter
        this.PC1 = 0; // saved program counter
        this.DC0 = 0; // active data counter
        this.DC1 = 0; // alternate data counter
        this.A = 0; // accumulator
        this.W = 0; // status/flags
        this.IS = 0; // indirect scratchpad address (6-bit)
        this.R = new Uint8Array(64); // scratchpad RAM
        this.o = 0; // last opcode
        this.stable = true;
        this.irqRequest = false;
    }
    connectMemoryBus(bus) {
        this.bus = bus;
    }
    connectIOBus(bus) {
        this.iobus = bus;
    }
    reset() {
        this.PC0 = 0;
        this.PC1 = 0;
        this.DC0 = 0;
        this.DC1 = 0;
        this.A = 0;
        this.W = 0;
        this.IS = 0;
        this.R.fill(0);
        this.irqRequest = false;
    }
    interrupt(type) {
        this.irqRequest = true;
    }
    getPC() { return this.PC0; }
    getSP() { return this.PC1; }
    isStable() { return this.stable; }
    saveState() {
        return {
            PC: this.PC0,
            PC0: this.PC0,
            PC1: this.PC1,
            DC0: this.DC0,
            DC1: this.DC1,
            A: this.A,
            W: this.W,
            IS: this.IS,
            R: Array.from(this.R),
            o: this.o,
            irq: this.irqRequest,
        };
    }
    loadState(state) {
        var _a;
        this.PC0 = (_a = state.PC0) !== null && _a !== void 0 ? _a : state.PC;
        this.PC1 = state.PC1;
        this.DC0 = state.DC0;
        this.DC1 = state.DC1;
        this.A = state.A;
        this.W = state.W;
        this.IS = state.IS;
        for (let i = 0; i < 64; i++)
            this.R[i] = state.R[i];
        this.o = state.o;
        this.irqRequest = state.irq;
    }
    // Read byte at PC0, increment PC0
    fetchPC0() {
        const val = this.bus.read(this.PC0);
        this.PC0 = (this.PC0 + 1) & 0xFFFF;
        return val;
    }
    // Read byte at DC0, increment DC0
    fetchDC0() {
        const val = this.bus.read(this.DC0);
        this.DC0 = (this.DC0 + 1) & 0xFFFF;
        return val;
    }
    // Write byte at DC0, increment DC0
    storeDC0(val) {
        this.bus.write(this.DC0, val);
        this.DC0 = (this.DC0 + 1) & 0xFFFF;
    }
    // Clear O, Z, C, S flags
    clrOZCS() {
        this.W &= ~(FLAG_O | FLAG_Z | FLAG_C | FLAG_S);
    }
    // Set Sign and Zero flags from value
    // Note: F8 sign flag is COMPLEMENTARY - set when bit 7 is CLEAR (positive)
    setSZ(val) {
        if ((val & 0xFF) === 0)
            this.W |= FLAG_Z;
        if ((val & 0x80) === 0)
            this.W |= FLAG_S; // complementary sign
    }
    // Addition with carry/overflow detection
    doAdd(a, b, carry = 0) {
        const result = (a & 0xFF) + (b & 0xFF) + (carry & 1);
        // Set carry if overflow past 8 bits
        if (result & 0x100)
            this.W |= FLAG_C;
        // Set overflow using XOR method
        if (((a ^ result) & (b ^ result) & 0x80) !== 0)
            this.W |= FLAG_O;
        return result & 0xFF;
    }
    // BCD addition
    doAddDecimal(augend, addend) {
        let tmp = (augend & 0x0F) + (addend & 0x0F);
        let c1 = (tmp > 9) ? 1 : 0;
        tmp = (augend >> 4) + (addend >> 4) + c1;
        let c2 = (tmp > 9) ? 1 : 0;
        // Do binary add for flags
        this.clrOZCS();
        let result = this.doAdd(augend, addend);
        this.setSZ(result);
        // Apply BCD correction
        let correction = 0;
        if (c2)
            correction |= 0xA0;
        if (c1)
            correction |= 0x0A;
        if (correction) {
            this.clrOZCS();
            result = this.doAdd(result, correction);
            this.setSZ(result);
        }
        return result;
    }
    // Get scratchpad register for operand (0-11 direct, 12=ISAR, 13=ISAR++, 14=ISAR--)
    getScratchpadIndex(r) {
        if (r < 12)
            return r;
        if (r === 12)
            return this.IS & 0x3F;
        if (r === 13) {
            const idx = this.IS & 0x3F;
            // Increment lower 3 bits of IS
            this.IS = (this.IS & 0x38) | ((this.IS + 1) & 0x07);
            return idx;
        }
        if (r === 14) {
            const idx = this.IS & 0x3F;
            // Decrement lower 3 bits of IS
            this.IS = (this.IS & 0x38) | ((this.IS - 1) & 0x07);
            return idx;
        }
        return 0; // illegal
    }
    advanceInsn() {
        // Check for interrupts
        if (this.irqRequest && (this.W & FLAG_I)) {
            this.irqRequest = false;
            // Save PC0 to PC1
            this.PC1 = this.PC0;
            // Load interrupt vector (at address 0x0020 typically)
            this.PC0 = (this.bus.read(0x0FFE) << 8) | this.bus.read(0x0FFF);
            // Clear interrupt enable
            this.W &= ~FLAG_I;
            return 6;
        }
        const opcode = this.fetchPC0();
        this.o = opcode;
        this.stable = true;
        let cycles = 4; // short cycle default
        let tmp;
        let r;
        switch (opcode) {
            // 0x00: LR A,KU
            case 0x00:
                this.A = this.R[12];
                break;
            // 0x01: LR A,KL
            case 0x01:
                this.A = this.R[13];
                break;
            // 0x02: LR A,QU
            case 0x02:
                this.A = this.R[14];
                break;
            // 0x03: LR A,QL
            case 0x03:
                this.A = this.R[15];
                break;
            // 0x04: LR KU,A
            case 0x04:
                this.R[12] = this.A;
                break;
            // 0x05: LR KL,A
            case 0x05:
                this.R[13] = this.A;
                break;
            // 0x06: LR QU,A
            case 0x06:
                this.R[14] = this.A;
                break;
            // 0x07: LR QL,A
            case 0x07:
                this.R[15] = this.A;
                break;
            // 0x08: LR K,P (K <- PC1)
            case 0x08:
                this.R[12] = (this.PC1 >> 8) & 0xFF;
                this.R[13] = this.PC1 & 0xFF;
                cycles = 8;
                break;
            // 0x09: LR P,K (PC1 <- K)
            case 0x09:
                this.PC1 = (this.R[12] << 8) | this.R[13];
                cycles = 8;
                break;
            // 0x0A: LR A,IS
            case 0x0A:
                this.A = this.IS & 0x3F;
                break;
            // 0x0B: LR IS,A
            case 0x0B:
                this.IS = this.A & 0x3F;
                break;
            // 0x0C: PK (Push K to PC: PC1<-PC0+1, PC0<-K)
            case 0x0C:
                this.PC1 = this.PC0;
                this.PC0 = (this.R[12] << 8) | this.R[13];
                cycles = 8;
                break;
            // 0x0D: LR P0,Q (PC0 <- Q)
            case 0x0D:
                this.PC0 = (this.R[14] << 8) | this.R[15];
                cycles = 8;
                break;
            // 0x0E: LR Q,DC (Q <- DC0)
            case 0x0E:
                this.R[14] = (this.DC0 >> 8) & 0xFF;
                this.R[15] = this.DC0 & 0xFF;
                cycles = 8;
                break;
            // 0x0F: LR DC,Q (DC0 <- Q)
            case 0x0F:
                this.DC0 = (this.R[14] << 8) | this.R[15];
                cycles = 8;
                break;
            // 0x10: LR DC,H (DC0 <- H)
            case 0x10:
                this.DC0 = (this.R[10] << 8) | this.R[11];
                cycles = 8;
                break;
            // 0x11: LR H,DC (H <- DC0)
            case 0x11:
                this.R[10] = (this.DC0 >> 8) & 0xFF;
                this.R[11] = this.DC0 & 0xFF;
                cycles = 8;
                break;
            // 0x12: SR 1 (shift right 1)
            case 0x12:
                this.A = (this.A >> 1) & 0xFF;
                this.clrOZCS();
                this.setSZ(this.A);
                break;
            // 0x13: SL 1 (shift left 1)
            case 0x13:
                this.A = (this.A << 1) & 0xFF;
                this.clrOZCS();
                this.setSZ(this.A);
                break;
            // 0x14: SR 4 (shift right 4)
            case 0x14:
                this.A = (this.A >> 4) & 0xFF;
                this.clrOZCS();
                this.setSZ(this.A);
                break;
            // 0x15: SL 4 (shift left 4)
            case 0x15:
                this.A = (this.A << 4) & 0xFF;
                this.clrOZCS();
                this.setSZ(this.A);
                break;
            // 0x16: LM (load A from memory at DC0, increment DC0)
            case 0x16:
                this.A = this.fetchDC0();
                cycles = 6;
                break;
            // 0x17: ST (store A to memory at DC0, increment DC0)
            case 0x17:
                this.storeDC0(this.A);
                cycles = 6;
                break;
            // 0x18: COM (complement A)
            case 0x18:
                this.A = (~this.A) & 0xFF;
                this.clrOZCS();
                this.setSZ(this.A);
                break;
            // 0x19: LNK (add carry to A)
            case 0x19:
                tmp = (this.W & FLAG_C) ? 1 : 0;
                this.clrOZCS();
                this.A = this.doAdd(this.A, tmp);
                this.setSZ(this.A);
                break;
            // 0x1A: DI (disable interrupts)
            case 0x1A:
                this.W &= ~FLAG_I;
                break;
            // 0x1B: EI (enable interrupts)
            case 0x1B:
                this.W |= FLAG_I;
                break;
            // 0x1C: POP (PC0 <- PC1)
            case 0x1C:
                this.PC0 = this.PC1;
                break;
            // 0x1D: LR W,J (W <- scratchpad[9])
            case 0x1D:
                this.W = this.R[9] & 0x1F;
                break;
            // 0x1E: LR J,W (scratchpad[9] <- W)
            case 0x1E:
                this.R[9] = this.W & 0x1F;
                break;
            // 0x1F: INC (increment A)
            case 0x1F:
                this.clrOZCS();
                this.A = this.doAdd(this.A, 1);
                this.setSZ(this.A);
                break;
            // 0x20: LI immediate
            case 0x20:
                this.A = this.fetchPC0();
                cycles = 6;
                break;
            // 0x21: NI immediate (AND)
            case 0x21:
                tmp = this.fetchPC0();
                this.A = this.A & tmp;
                this.clrOZCS();
                this.setSZ(this.A);
                cycles = 6;
                break;
            // 0x22: OI immediate (OR)
            case 0x22:
                tmp = this.fetchPC0();
                this.A = this.A | tmp;
                this.clrOZCS();
                this.setSZ(this.A);
                cycles = 6;
                break;
            // 0x23: XI immediate (XOR)
            case 0x23:
                tmp = this.fetchPC0();
                this.A = this.A ^ tmp;
                this.clrOZCS();
                this.setSZ(this.A);
                cycles = 6;
                break;
            // 0x24: AI immediate (ADD)
            case 0x24:
                tmp = this.fetchPC0();
                this.clrOZCS();
                this.A = this.doAdd(this.A, tmp);
                this.setSZ(this.A);
                cycles = 6;
                break;
            // 0x25: CI immediate (compare: sets flags from ~A + immediate + 1)
            case 0x25:
                tmp = this.fetchPC0();
                this.clrOZCS();
                this.doAdd((~this.A) & 0xFF, tmp, 1);
                this.setSZ(this.doAdd((~this.A) & 0xFF, tmp, 1));
                cycles = 6;
                break;
            // 0x26: IN immediate (input from port)
            case 0x26:
                tmp = this.fetchPC0();
                this.A = this.iobus.read(tmp) & 0xFF;
                this.clrOZCS();
                this.setSZ(this.A);
                cycles = 8;
                break;
            // 0x27: OUT immediate (output to port)
            case 0x27:
                tmp = this.fetchPC0();
                this.iobus.write(tmp, this.A);
                cycles = 8;
                break;
            // 0x28: PI (push and jump immediate: PC1<-PC0, PC0<-address)
            case 0x28: {
                const hi = this.fetchPC0();
                const lo = this.fetchPC0();
                this.PC1 = this.PC0;
                this.PC0 = (hi << 8) | lo;
                cycles = 12;
                break;
            }
            // 0x29: JMP (jump immediate)
            case 0x29: {
                const hi = this.fetchPC0();
                const lo = this.fetchPC0();
                this.PC0 = (hi << 8) | lo;
                cycles = 10;
                break;
            }
            // 0x2A: DCI (load DC0 immediate)
            case 0x2A: {
                const hi = this.fetchPC0();
                const lo = this.fetchPC0();
                this.DC0 = (hi << 8) | lo;
                cycles = 10;
                break;
            }
            // 0x2B: NOP
            case 0x2B: break;
            // 0x2C: XDC (exchange DC0 and DC1)
            case 0x2C:
                tmp = this.DC0;
                this.DC0 = this.DC1;
                this.DC1 = tmp;
                break;
            // 0x2D-0x2F: illegal
            case 0x2D:
            case 0x2E:
            case 0x2F: break;
            // 0x30-0x3E: DS (decrement scratchpad register, skip if zero)
            case 0x30:
            case 0x31:
            case 0x32:
            case 0x33:
            case 0x34:
            case 0x35:
            case 0x36:
            case 0x37:
            case 0x38:
            case 0x39:
            case 0x3A:
            case 0x3B:
            case 0x3C:
            case 0x3D:
            case 0x3E:
                r = this.getScratchpadIndex(opcode & 0x0F);
                this.clrOZCS();
                this.R[r] = this.doAdd(this.R[r], 0xFF);
                this.setSZ(this.R[r]);
                cycles = 6;
                break;
            case 0x3F: break; // illegal
            // 0x40-0x4E: LR A,r (load A from scratchpad)
            case 0x40:
            case 0x41:
            case 0x42:
            case 0x43:
            case 0x44:
            case 0x45:
            case 0x46:
            case 0x47:
            case 0x48:
            case 0x49:
            case 0x4A:
            case 0x4B:
            case 0x4C:
            case 0x4D:
            case 0x4E:
                r = this.getScratchpadIndex(opcode & 0x0F);
                this.A = this.R[r];
                break;
            case 0x4F: break; // illegal
            // 0x50-0x5E: LR r,A (store A to scratchpad)
            case 0x50:
            case 0x51:
            case 0x52:
            case 0x53:
            case 0x54:
            case 0x55:
            case 0x56:
            case 0x57:
            case 0x58:
            case 0x59:
            case 0x5A:
            case 0x5B:
            case 0x5C:
            case 0x5D:
            case 0x5E:
                r = this.getScratchpadIndex(opcode & 0x0F);
                this.R[r] = this.A;
                break;
            case 0x5F: break; // illegal
            // 0x60-0x67: LISU (load IS upper 3 bits)
            case 0x60:
            case 0x61:
            case 0x62:
            case 0x63:
            case 0x64:
            case 0x65:
            case 0x66:
            case 0x67:
                this.IS = (this.IS & 0x07) | ((opcode & 0x07) << 3);
                break;
            // 0x68-0x6F: LISL (load IS lower 3 bits)
            case 0x68:
            case 0x69:
            case 0x6A:
            case 0x6B:
            case 0x6C:
            case 0x6D:
            case 0x6E:
            case 0x6F:
                this.IS = (this.IS & 0x38) | (opcode & 0x07);
                break;
            // 0x70-0x7F: LIS (load A with 4-bit immediate)
            case 0x70:
            case 0x71:
            case 0x72:
            case 0x73:
            case 0x74:
            case 0x75:
            case 0x76:
            case 0x77:
            case 0x78:
            case 0x79:
            case 0x7A:
            case 0x7B:
            case 0x7C:
            case 0x7D:
            case 0x7E:
            case 0x7F:
                this.A = opcode & 0x0F;
                break;
            // 0x80-0x87: BT (branch if flag test true)
            case 0x80:
            case 0x81:
            case 0x82:
            case 0x83:
            case 0x84:
            case 0x85:
            case 0x86:
            case 0x87: {
                const mask = opcode & 0x07;
                const offset = this.fetchPC0();
                if (this.W & mask) {
                    // Sign-extend offset and add to PC0
                    this.PC0 = (this.PC0 + ((offset & 0x80) ? (offset - 256) : offset)) & 0xFFFF;
                    cycles = 6;
                }
                else {
                    cycles = 6;
                }
                break;
            }
            // 0x88: AM (add memory at DC0 to A)
            case 0x88:
                tmp = this.fetchDC0();
                this.clrOZCS();
                this.A = this.doAdd(this.A, tmp);
                this.setSZ(this.A);
                cycles = 6;
                break;
            // 0x89: AMD (decimal add memory at DC0 to A)
            case 0x89:
                tmp = this.fetchDC0();
                this.A = this.doAddDecimal(this.A, tmp);
                cycles = 6;
                break;
            // 0x8A: NM (AND memory at DC0)
            case 0x8A:
                tmp = this.fetchDC0();
                this.A = this.A & tmp;
                this.clrOZCS();
                this.setSZ(this.A);
                cycles = 6;
                break;
            // 0x8B: OM (OR memory at DC0)
            case 0x8B:
                tmp = this.fetchDC0();
                this.A = this.A | tmp;
                this.clrOZCS();
                this.setSZ(this.A);
                cycles = 6;
                break;
            // 0x8C: XM (XOR memory at DC0)
            case 0x8C:
                tmp = this.fetchDC0();
                this.A = this.A ^ tmp;
                this.clrOZCS();
                this.setSZ(this.A);
                cycles = 6;
                break;
            // 0x8D: CM (compare memory at DC0)
            case 0x8D:
                tmp = this.fetchDC0();
                this.clrOZCS();
                {
                    const cmp = this.doAdd((~this.A) & 0xFF, tmp, 1);
                    this.setSZ(cmp);
                }
                cycles = 6;
                break;
            // 0x8E: ADC (add accumulator to DC0)
            case 0x8E:
                this.DC0 = (this.DC0 + ((this.A & 0x80) ? (this.A - 256) : this.A)) & 0xFFFF;
                cycles = 6;
                break;
            // 0x8F: BR7 (branch if IS lower 3 bits != 7)
            case 0x8F: {
                const offset = this.fetchPC0();
                if ((this.IS & 0x07) !== 7) {
                    this.PC0 = (this.PC0 + ((offset & 0x80) ? (offset - 256) : offset)) & 0xFFFF;
                }
                cycles = 6;
                break;
            }
            // 0x90-0x9F: BF (branch if flag false)
            case 0x90:
            case 0x91:
            case 0x92:
            case 0x93:
            case 0x94:
            case 0x95:
            case 0x96:
            case 0x97:
            case 0x98:
            case 0x99:
            case 0x9A:
            case 0x9B:
            case 0x9C:
            case 0x9D:
            case 0x9E:
            case 0x9F: {
                const mask = opcode & 0x0F;
                const offset = this.fetchPC0();
                if (mask === 0 || !(this.W & mask)) {
                    // BF 0 is unconditional branch (BR)
                    this.PC0 = (this.PC0 + ((offset & 0x80) ? (offset - 256) : offset)) & 0xFFFF;
                }
                cycles = 6;
                break;
            }
            // 0xA0-0xA1: INS 0-1 (input from port 0/1, direct)
            case 0xA0:
            case 0xA1:
                this.A = this.iobus.read(opcode & 0x01) & 0xFF;
                this.clrOZCS();
                this.setSZ(this.A);
                break;
            // 0xA2-0xA3: illegal
            case 0xA2:
            case 0xA3: break;
            // 0xA4-0xAF: INS 4-F (input from addressed port)
            case 0xA4:
            case 0xA5:
            case 0xA6:
            case 0xA7:
            case 0xA8:
            case 0xA9:
            case 0xAA:
            case 0xAB:
            case 0xAC:
            case 0xAD:
            case 0xAE:
            case 0xAF:
                this.A = this.iobus.read(opcode & 0x0F) & 0xFF;
                this.clrOZCS();
                this.setSZ(this.A);
                cycles = 8;
                break;
            // 0xB0-0xB1: OUTS 0-1 (output to port 0/1, direct)
            case 0xB0:
            case 0xB1:
                this.iobus.write(opcode & 0x01, this.A);
                break;
            // 0xB2-0xB3: illegal
            case 0xB2:
            case 0xB3: break;
            // 0xB4-0xBF: OUTS 4-F (output to addressed port)
            case 0xB4:
            case 0xB5:
            case 0xB6:
            case 0xB7:
            case 0xB8:
            case 0xB9:
            case 0xBA:
            case 0xBB:
            case 0xBC:
            case 0xBD:
            case 0xBE:
            case 0xBF:
                this.iobus.write(opcode & 0x0F, this.A);
                cycles = 8;
                break;
            // 0xC0-0xCE: AS (add scratchpad to A)
            case 0xC0:
            case 0xC1:
            case 0xC2:
            case 0xC3:
            case 0xC4:
            case 0xC5:
            case 0xC6:
            case 0xC7:
            case 0xC8:
            case 0xC9:
            case 0xCA:
            case 0xCB:
            case 0xCC:
            case 0xCD:
            case 0xCE:
                r = this.getScratchpadIndex(opcode & 0x0F);
                this.clrOZCS();
                this.A = this.doAdd(this.A, this.R[r]);
                this.setSZ(this.A);
                break;
            case 0xCF: break; // illegal
            // 0xD0-0xDE: ASD (decimal add scratchpad to A)
            case 0xD0:
            case 0xD1:
            case 0xD2:
            case 0xD3:
            case 0xD4:
            case 0xD5:
            case 0xD6:
            case 0xD7:
            case 0xD8:
            case 0xD9:
            case 0xDA:
            case 0xDB:
            case 0xDC:
            case 0xDD:
            case 0xDE:
                r = this.getScratchpadIndex(opcode & 0x0F);
                this.A = this.doAddDecimal(this.A, this.R[r]);
                cycles = 8;
                break;
            case 0xDF: break; // illegal
            // 0xE0-0xEE: XS (XOR scratchpad with A)
            case 0xE0:
            case 0xE1:
            case 0xE2:
            case 0xE3:
            case 0xE4:
            case 0xE5:
            case 0xE6:
            case 0xE7:
            case 0xE8:
            case 0xE9:
            case 0xEA:
            case 0xEB:
            case 0xEC:
            case 0xED:
            case 0xEE:
                r = this.getScratchpadIndex(opcode & 0x0F);
                this.A = (this.A ^ this.R[r]) & 0xFF;
                this.clrOZCS();
                this.setSZ(this.A);
                break;
            case 0xEF: break; // illegal
            // 0xF0-0xFE: NS (AND scratchpad with A)
            case 0xF0:
            case 0xF1:
            case 0xF2:
            case 0xF3:
            case 0xF4:
            case 0xF5:
            case 0xF6:
            case 0xF7:
            case 0xF8:
            case 0xF9:
            case 0xFA:
            case 0xFB:
            case 0xFC:
            case 0xFD:
            case 0xFE:
                r = this.getScratchpadIndex(opcode & 0x0F);
                this.A = (this.A & this.R[r]) & 0xFF;
                this.clrOZCS();
                this.setSZ(this.A);
                break;
            case 0xFF: break; // illegal
        }
        return cycles;
    }
}
exports.F8CPU = F8CPU;
//# sourceMappingURL=F8.js.map