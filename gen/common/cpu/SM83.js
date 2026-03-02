"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SM83 = void 0;
// SM83 CPU — the Game Boy's modified Z80
// No IX/IY, no shadow registers, no I/R, no IO bus
// 4 flags only: Z(7), N(6), H(5), C(4) in F register
// CB prefix for bit ops + SWAP
// Single IME flag, memory-mapped IF/IE
class SM83 {
    constructor() {
        // Registers
        this.A = 0;
        this.F = 0;
        this.B = 0;
        this.C = 0;
        this.D = 0;
        this.E = 0;
        this.H = 0;
        this.L = 0;
        this.SP = 0xFFFE;
        this.PC = 0x0100;
        // Interrupt master enable
        this.ime = false;
        this.imeDelay = false; // EI delays by one instruction
        this.halted = false;
        // Pending interrupt request (set by machine via interrupt())
        this.interruptFlags = 0;
        this.cyclesPerInsn = 0;
        this.o = 0; // last opcode
        this.stable = true;
    }
    connectMemoryBus(bus) {
        this.bus = bus;
    }
    reset() {
        // After boot ROM, typical state:
        this.A = 0x01;
        this.F = 0xB0;
        this.B = 0x00;
        this.C = 0x13;
        this.D = 0x00;
        this.E = 0xD8;
        this.H = 0x01;
        this.L = 0x4D;
        this.SP = 0xFFFE;
        this.PC = 0x0100;
        this.ime = false;
        this.imeDelay = false;
        this.halted = false;
        this.interruptFlags = 0;
    }
    interrupt(type) {
        this.interruptFlags |= type;
    }
    getPC() { return this.PC; }
    getSP() { return this.SP; }
    isStable() { return this.stable; }
    saveState() {
        return {
            PC: this.PC,
            SP: this.SP,
            AF: (this.A << 8) | this.F,
            BC: (this.B << 8) | this.C,
            DE: (this.D << 8) | this.E,
            HL: (this.H << 8) | this.L,
            o: this.o,
            ime: this.ime ? 1 : 0,
            halted: this.halted,
            interrupt: this.interruptFlags,
        };
    }
    loadState(state) {
        this.PC = state.PC;
        this.SP = state.SP;
        this.A = (state.AF >> 8) & 0xFF;
        this.F = state.AF & 0xF0; // lower 4 bits always 0
        this.B = (state.BC >> 8) & 0xFF;
        this.C = state.BC & 0xFF;
        this.D = (state.DE >> 8) & 0xFF;
        this.E = state.DE & 0xFF;
        this.H = (state.HL >> 8) & 0xFF;
        this.L = state.HL & 0xFF;
        this.o = state.o;
        this.ime = !!state.ime;
        this.halted = state.halted;
        this.interruptFlags = state.interrupt;
    }
    // Helper accessors for 16-bit register pairs
    getAF() { return (this.A << 8) | (this.F & 0xF0); }
    getBC() { return (this.B << 8) | this.C; }
    getDE() { return (this.D << 8) | this.E; }
    getHL() { return (this.H << 8) | this.L; }
    setAF(v) { this.A = (v >> 8) & 0xFF; this.F = v & 0xF0; }
    setBC(v) { this.B = (v >> 8) & 0xFF; this.C = v & 0xFF; }
    setDE(v) { this.D = (v >> 8) & 0xFF; this.E = v & 0xFF; }
    setHL(v) { this.H = (v >> 8) & 0xFF; this.L = v & 0xFF; }
    // Memory helpers
    read(addr) {
        return this.bus.read(addr & 0xFFFF);
    }
    write(addr, val) {
        this.bus.write(addr & 0xFFFF, val & 0xFF);
    }
    readWord(addr) {
        return this.read(addr) | (this.read(addr + 1) << 8);
    }
    writeWord(addr, val) {
        this.write(addr, val & 0xFF);
        this.write(addr + 1, (val >> 8) & 0xFF);
    }
    // Fetch byte at PC, advance PC
    fetchByte() {
        var v = this.read(this.PC);
        this.PC = (this.PC + 1) & 0xFFFF;
        return v;
    }
    fetchWord() {
        var lo = this.fetchByte();
        var hi = this.fetchByte();
        return (hi << 8) | lo;
    }
    fetchSignedByte() {
        var v = this.fetchByte();
        return v < 128 ? v : v - 256;
    }
    // Stack helpers
    pushWord(val) {
        this.SP = (this.SP - 1) & 0xFFFF;
        this.write(this.SP, (val >> 8) & 0xFF);
        this.SP = (this.SP - 1) & 0xFFFF;
        this.write(this.SP, val & 0xFF);
    }
    popWord() {
        var lo = this.read(this.SP);
        this.SP = (this.SP + 1) & 0xFFFF;
        var hi = this.read(this.SP);
        this.SP = (this.SP + 1) & 0xFFFF;
        return (hi << 8) | lo;
    }
    // Flag helpers
    getZ() { return !!(this.F & SM83.FLAG_Z); }
    getN() { return !!(this.F & SM83.FLAG_N); }
    getH() { return !!(this.F & SM83.FLAG_H); }
    getC() { return !!(this.F & SM83.FLAG_C); }
    setZ(b) { if (b)
        this.F |= SM83.FLAG_Z;
    else
        this.F &= ~SM83.FLAG_Z; }
    setN(b) { if (b)
        this.F |= SM83.FLAG_N;
    else
        this.F &= ~SM83.FLAG_N; }
    setH(b) { if (b)
        this.F |= SM83.FLAG_H;
    else
        this.F &= ~SM83.FLAG_H; }
    setC(b) { if (b)
        this.F |= SM83.FLAG_C;
    else
        this.F &= ~SM83.FLAG_C; }
    setFlags(z, n, h, c) {
        this.F = (z ? SM83.FLAG_Z : 0) | (n ? SM83.FLAG_N : 0) | (h ? SM83.FLAG_H : 0) | (c ? SM83.FLAG_C : 0);
    }
    // Get/set register by index (for opcode decoding)
    // 0=B 1=C 2=D 3=E 4=H 5=L 6=(HL) 7=A
    getReg(i) {
        switch (i) {
            case 0: return this.B;
            case 1: return this.C;
            case 2: return this.D;
            case 3: return this.E;
            case 4: return this.H;
            case 5: return this.L;
            case 6: return this.read(this.getHL());
            case 7: return this.A;
        }
        return 0;
    }
    setReg(i, v) {
        v &= 0xFF;
        switch (i) {
            case 0:
                this.B = v;
                break;
            case 1:
                this.C = v;
                break;
            case 2:
                this.D = v;
                break;
            case 3:
                this.E = v;
                break;
            case 4:
                this.H = v;
                break;
            case 5:
                this.L = v;
                break;
            case 6:
                this.write(this.getHL(), v);
                break;
            case 7:
                this.A = v;
                break;
        }
    }
    // Get/set 16-bit register pair by index
    // 0=BC 1=DE 2=HL 3=SP (for most opcodes)
    getReg16(i) {
        switch (i) {
            case 0: return this.getBC();
            case 1: return this.getDE();
            case 2: return this.getHL();
            case 3: return this.SP;
        }
        return 0;
    }
    setReg16(i, v) {
        v &= 0xFFFF;
        switch (i) {
            case 0:
                this.setBC(v);
                break;
            case 1:
                this.setDE(v);
                break;
            case 2:
                this.setHL(v);
                break;
            case 3:
                this.SP = v;
                break;
        }
    }
    // Get/set 16-bit register pair for PUSH/POP (AF instead of SP)
    getReg16AF(i) {
        switch (i) {
            case 0: return this.getBC();
            case 1: return this.getDE();
            case 2: return this.getHL();
            case 3: return this.getAF();
        }
        return 0;
    }
    setReg16AF(i, v) {
        v &= 0xFFFF;
        switch (i) {
            case 0:
                this.setBC(v);
                break;
            case 1:
                this.setDE(v);
                break;
            case 2:
                this.setHL(v);
                break;
            case 3:
                this.setAF(v);
                break;
        }
    }
    // Check condition code
    // 0=NZ 1=Z 2=NC 3=C
    checkCondition(cc) {
        switch (cc) {
            case 0: return !this.getZ();
            case 1: return this.getZ();
            case 2: return !this.getC();
            case 3: return this.getC();
        }
        return false;
    }
    // ALU operations
    addA(val) {
        var result = this.A + val;
        this.setFlags((result & 0xFF) === 0, false, ((this.A & 0xF) + (val & 0xF)) > 0xF, result > 0xFF);
        this.A = result & 0xFF;
    }
    adcA(val) {
        var carry = this.getC() ? 1 : 0;
        var result = this.A + val + carry;
        this.setFlags((result & 0xFF) === 0, false, ((this.A & 0xF) + (val & 0xF) + carry) > 0xF, result > 0xFF);
        this.A = result & 0xFF;
    }
    subA(val) {
        var result = this.A - val;
        this.setFlags((result & 0xFF) === 0, true, (this.A & 0xF) < (val & 0xF), result < 0);
        this.A = result & 0xFF;
    }
    sbcA(val) {
        var carry = this.getC() ? 1 : 0;
        var result = this.A - val - carry;
        this.setFlags((result & 0xFF) === 0, true, (this.A & 0xF) < (val & 0xF) + carry, result < 0);
        this.A = result & 0xFF;
    }
    andA(val) {
        this.A &= val;
        this.setFlags(this.A === 0, false, true, false);
    }
    xorA(val) {
        this.A ^= val;
        this.A &= 0xFF;
        this.setFlags(this.A === 0, false, false, false);
    }
    orA(val) {
        this.A |= val;
        this.A &= 0xFF;
        this.setFlags(this.A === 0, false, false, false);
    }
    cpA(val) {
        var result = this.A - val;
        this.setFlags((result & 0xFF) === 0, true, (this.A & 0xF) < (val & 0xF), result < 0);
    }
    // ALU dispatch by operation index (bits 5-3 of opcode for 0x80-0xBF range)
    aluOp(op, val) {
        switch (op) {
            case 0:
                this.addA(val);
                break;
            case 1:
                this.adcA(val);
                break;
            case 2:
                this.subA(val);
                break;
            case 3:
                this.sbcA(val);
                break;
            case 4:
                this.andA(val);
                break;
            case 5:
                this.xorA(val);
                break;
            case 6:
                this.orA(val);
                break;
            case 7:
                this.cpA(val);
                break;
        }
    }
    // Increment 8-bit register
    inc8(val) {
        var result = (val + 1) & 0xFF;
        this.setZ(result === 0);
        this.setN(false);
        this.setH((val & 0xF) === 0xF);
        // C flag not affected
        return result;
    }
    // Decrement 8-bit register
    dec8(val) {
        var result = (val - 1) & 0xFF;
        this.setZ(result === 0);
        this.setN(true);
        this.setH((val & 0xF) === 0x0);
        // C flag not affected
        return result;
    }
    // Add to HL (16-bit)
    addHL(val) {
        var hl = this.getHL();
        var result = hl + val;
        this.setN(false);
        this.setH(((hl & 0xFFF) + (val & 0xFFF)) > 0xFFF);
        this.setC(result > 0xFFFF);
        this.setHL(result & 0xFFFF);
    }
    // DAA instruction
    daa() {
        var a = this.A;
        if (!this.getN()) {
            if (this.getC() || a > 0x99) {
                a += 0x60;
                this.setC(true);
            }
            if (this.getH() || (a & 0x0F) > 0x09) {
                a += 0x06;
            }
        }
        else {
            if (this.getC()) {
                a -= 0x60;
            }
            if (this.getH()) {
                a -= 0x06;
            }
        }
        a &= 0xFF;
        this.setZ(a === 0);
        this.setH(false);
        this.A = a;
    }
    // CB-prefix operations
    cbOp(opcode) {
        var op = (opcode >> 3) & 0x1F;
        var reg = opcode & 0x07;
        var val = this.getReg(reg);
        var cycles = reg === 6 ? 4 : 2; // (HL) takes longer
        var result;
        if (opcode < 0x40) {
            // Rotate/shift operations (0x00-0x3F)
            switch (op) {
                case 0: // RLC
                    result = ((val << 1) | (val >> 7)) & 0xFF;
                    this.setFlags(result === 0, false, false, !!(val & 0x80));
                    break;
                case 1: // RRC
                    result = ((val >> 1) | (val << 7)) & 0xFF;
                    this.setFlags(result === 0, false, false, !!(val & 0x01));
                    break;
                case 2: // RL
                    result = ((val << 1) | (this.getC() ? 1 : 0)) & 0xFF;
                    this.setFlags(result === 0, false, false, !!(val & 0x80));
                    break;
                case 3: // RR
                    result = ((val >> 1) | (this.getC() ? 0x80 : 0)) & 0xFF;
                    this.setFlags(result === 0, false, false, !!(val & 0x01));
                    break;
                case 4: // SLA
                    result = (val << 1) & 0xFF;
                    this.setFlags(result === 0, false, false, !!(val & 0x80));
                    break;
                case 5: // SRA
                    result = ((val >> 1) | (val & 0x80)) & 0xFF;
                    this.setFlags(result === 0, false, false, !!(val & 0x01));
                    break;
                case 6: // SWAP
                    result = ((val & 0x0F) << 4) | ((val & 0xF0) >> 4);
                    this.setFlags(result === 0, false, false, false);
                    break;
                case 7: // SRL
                    result = (val >> 1) & 0xFF;
                    this.setFlags(result === 0, false, false, !!(val & 0x01));
                    break;
                default:
                    result = val;
            }
            this.setReg(reg, result);
            if (reg === 6)
                cycles = 4; // write back to (HL)
        }
        else if (opcode < 0x80) {
            // BIT n,r (0x40-0x7F)
            var bit = (opcode >> 3) & 7;
            this.setZ(!(val & (1 << bit)));
            this.setN(false);
            this.setH(true);
            // C not affected
            // No write-back for BIT, so (HL) is only 3 cycles
            if (reg === 6)
                cycles = 3;
        }
        else if (opcode < 0xC0) {
            // RES n,r (0x80-0xBF)
            var bit = (opcode >> 3) & 7;
            this.setReg(reg, val & ~(1 << bit));
            if (reg === 6)
                cycles = 4;
        }
        else {
            // SET n,r (0xC0-0xFF)
            var bit = (opcode >> 3) & 7;
            this.setReg(reg, val | (1 << bit));
            if (reg === 6)
                cycles = 4;
        }
        return cycles;
    }
    // Handle interrupts. Returns cycles consumed, 0 if no interrupt taken.
    handleInterrupts() {
        if (this.interruptFlags === 0)
            return 0;
        // Any pending interrupt wakes from HALT, even if IME is off
        if (this.halted) {
            this.halted = false;
        }
        if (!this.ime)
            return 0;
        // Check each interrupt bit: VBlank(0), STAT(1), Timer(2), Serial(3), Joypad(4)
        for (var i = 0; i < 5; i++) {
            if (this.interruptFlags & (1 << i)) {
                this.ime = false;
                this.interruptFlags &= ~(1 << i);
                this.pushWord(this.PC);
                this.PC = 0x40 + (i * 8); // 0x40, 0x48, 0x50, 0x58, 0x60
                return 5; // interrupt dispatch takes 5 M-cycles = 20 T-cycles
            }
        }
        return 0;
    }
    advanceInsn() {
        // Handle pending EI delay
        if (this.imeDelay) {
            this.ime = true;
            this.imeDelay = false;
        }
        // Handle interrupts
        var intCycles = this.handleInterrupts();
        if (intCycles > 0)
            return intCycles;
        // HALT: wait 1 cycle
        if (this.halted) {
            return 1;
        }
        this.stable = true;
        var op = this.fetchByte();
        this.o = op;
        this.stable = false;
        var cycles = this.executeOpcode(op);
        this.stable = true;
        return cycles;
    }
    executeOpcode(op) {
        // Decode based on quadrants and sub-groups
        var x = (op >> 6) & 3;
        var y = (op >> 3) & 7;
        var z = op & 7;
        var p = (y >> 1) & 3;
        var q = y & 1;
        switch (x) {
            case 0:
                return this.execX0(y, z, p, q, op);
            case 1:
                // LD r,r' (and HALT)
                if (z === 6 && y === 6) {
                    // HALT
                    this.halted = true;
                    return 1;
                }
                this.setReg(y, this.getReg(z));
                return (y === 6 || z === 6) ? 2 : 1;
            case 2:
                // ALU A,r
                this.aluOp(y, this.getReg(z));
                return z === 6 ? 2 : 1;
            case 3:
                return this.execX3(y, z, p, q, op);
        }
        return 1;
    }
    execX0(y, z, p, q, op) {
        switch (z) {
            case 0:
                switch (y) {
                    case 0: return 1; // NOP
                    case 1: // LD (nn),SP
                        var addr = this.fetchWord();
                        this.writeWord(addr, this.SP);
                        return 5;
                    case 2: // STOP
                        // STOP 0 — skip next byte
                        this.PC = (this.PC + 1) & 0xFFFF;
                        return 1;
                    case 3: // JR e
                        var e = this.fetchSignedByte();
                        this.PC = (this.PC + e) & 0xFFFF;
                        return 3;
                    case 4:
                    case 5:
                    case 6:
                    case 7: // JR cc,e
                        var e = this.fetchSignedByte();
                        if (this.checkCondition(y - 4)) {
                            this.PC = (this.PC + e) & 0xFFFF;
                            return 3;
                        }
                        return 2;
                }
                break;
            case 1:
                if (q === 0) {
                    // LD rr,nn
                    this.setReg16(p, this.fetchWord());
                    return 3;
                }
                else {
                    // ADD HL,rr
                    this.addHL(this.getReg16(p));
                    return 2;
                }
            case 2:
                if (q === 0) {
                    switch (p) {
                        case 0:
                            this.write(this.getBC(), this.A);
                            return 2; // LD (BC),A
                        case 1:
                            this.write(this.getDE(), this.A);
                            return 2; // LD (DE),A
                        case 2: // LD (HL+),A
                            this.write(this.getHL(), this.A);
                            this.setHL((this.getHL() + 1) & 0xFFFF);
                            return 2;
                        case 3: // LD (HL-),A
                            this.write(this.getHL(), this.A);
                            this.setHL((this.getHL() - 1) & 0xFFFF);
                            return 2;
                    }
                }
                else {
                    switch (p) {
                        case 0:
                            this.A = this.read(this.getBC());
                            return 2; // LD A,(BC)
                        case 1:
                            this.A = this.read(this.getDE());
                            return 2; // LD A,(DE)
                        case 2: // LD A,(HL+)
                            this.A = this.read(this.getHL());
                            this.setHL((this.getHL() + 1) & 0xFFFF);
                            return 2;
                        case 3: // LD A,(HL-)
                            this.A = this.read(this.getHL());
                            this.setHL((this.getHL() - 1) & 0xFFFF);
                            return 2;
                    }
                }
                break;
            case 3:
                if (q === 0) {
                    // INC rr
                    this.setReg16(p, (this.getReg16(p) + 1) & 0xFFFF);
                    return 2;
                }
                else {
                    // DEC rr
                    this.setReg16(p, (this.getReg16(p) - 1) & 0xFFFF);
                    return 2;
                }
            case 4:
                // INC r
                this.setReg(y, this.inc8(this.getReg(y)));
                return y === 6 ? 3 : 1;
            case 5:
                // DEC r
                this.setReg(y, this.dec8(this.getReg(y)));
                return y === 6 ? 3 : 1;
            case 6:
                // LD r,n
                this.setReg(y, this.fetchByte());
                return y === 6 ? 3 : 2;
            case 7:
                switch (y) {
                    case 0: // RLCA
                        var bit7 = (this.A >> 7) & 1;
                        this.A = ((this.A << 1) | bit7) & 0xFF;
                        this.setFlags(false, false, false, !!bit7);
                        return 1;
                    case 1: // RRCA
                        var bit0 = this.A & 1;
                        this.A = ((this.A >> 1) | (bit0 << 7)) & 0xFF;
                        this.setFlags(false, false, false, !!bit0);
                        return 1;
                    case 2: // RLA
                        var bit7 = (this.A >> 7) & 1;
                        this.A = ((this.A << 1) | (this.getC() ? 1 : 0)) & 0xFF;
                        this.setFlags(false, false, false, !!bit7);
                        return 1;
                    case 3: // RRA
                        var bit0 = this.A & 1;
                        this.A = ((this.A >> 1) | (this.getC() ? 0x80 : 0)) & 0xFF;
                        this.setFlags(false, false, false, !!bit0);
                        return 1;
                    case 4: // DAA
                        this.daa();
                        return 1;
                    case 5: // CPL
                        this.A = (~this.A) & 0xFF;
                        this.setN(true);
                        this.setH(true);
                        return 1;
                    case 6: // SCF
                        this.setN(false);
                        this.setH(false);
                        this.setC(true);
                        return 1;
                    case 7: // CCF
                        this.setN(false);
                        this.setH(false);
                        this.setC(!this.getC());
                        return 1;
                }
                break;
        }
        return 1;
    }
    execX3(y, z, p, q, op) {
        switch (z) {
            case 0:
                switch (y) {
                    case 0:
                    case 1:
                    case 2:
                    case 3: // RET cc
                        if (this.checkCondition(y)) {
                            this.PC = this.popWord();
                            return 5;
                        }
                        return 2;
                    case 4: // LDH (n),A — LD (FF00+n),A
                        var n = this.fetchByte();
                        this.write(0xFF00 + n, this.A);
                        return 3;
                    case 5: // ADD SP,e
                        var e = this.fetchSignedByte();
                        var result = (this.SP + e) & 0xFFFF;
                        this.setFlags(false, false, ((this.SP & 0xF) + (e & 0xF)) > 0xF, ((this.SP & 0xFF) + (e & 0xFF)) > 0xFF);
                        this.SP = result;
                        return 4;
                    case 6: // LDH A,(n) — LD A,(FF00+n)
                        var n = this.fetchByte();
                        this.A = this.read(0xFF00 + n);
                        return 3;
                    case 7: // LD HL,SP+e
                        var e = this.fetchSignedByte();
                        var result = (this.SP + e) & 0xFFFF;
                        this.setFlags(false, false, ((this.SP & 0xF) + (e & 0xF)) > 0xF, ((this.SP & 0xFF) + (e & 0xFF)) > 0xFF);
                        this.setHL(result);
                        return 3;
                }
                break;
            case 1:
                if (q === 0) {
                    // POP rr
                    this.setReg16AF(p, this.popWord());
                    return 3;
                }
                else {
                    switch (p) {
                        case 0: // RET
                            this.PC = this.popWord();
                            return 4;
                        case 1: // RETI
                            this.PC = this.popWord();
                            this.ime = true;
                            return 4;
                        case 2: // JP HL
                            this.PC = this.getHL();
                            return 1;
                        case 3: // LD SP,HL
                            this.SP = this.getHL();
                            return 2;
                    }
                }
                break;
            case 2:
                switch (y) {
                    case 0:
                    case 1:
                    case 2:
                    case 3: // JP cc,nn
                        var addr = this.fetchWord();
                        if (this.checkCondition(y)) {
                            this.PC = addr;
                            return 4;
                        }
                        return 3;
                    case 4: // LD (FF00+C),A
                        this.write(0xFF00 + this.C, this.A);
                        return 2;
                    case 5: // LD (nn),A
                        this.write(this.fetchWord(), this.A);
                        return 4;
                    case 6: // LD A,(FF00+C)
                        this.A = this.read(0xFF00 + this.C);
                        return 2;
                    case 7: // LD A,(nn)
                        this.A = this.read(this.fetchWord());
                        return 4;
                }
                break;
            case 3:
                switch (y) {
                    case 0: // JP nn
                        this.PC = this.fetchWord();
                        return 4;
                    case 1: // CB prefix
                        var cbop = this.fetchByte();
                        return 2 + this.cbOp(cbop); // 2 for CB fetch + op cycles
                    case 6: // DI
                        this.ime = false;
                        this.imeDelay = false;
                        return 1;
                    case 7: // EI
                        this.imeDelay = true;
                        return 1;
                    default:
                        // Undefined opcodes (0xD3, 0xDB, 0xDD, 0xE3, 0xE4, 0xEB, 0xEC, 0xED, 0xF4, 0xFD)
                        return 1;
                }
            case 4:
                switch (y) {
                    case 0:
                    case 1:
                    case 2:
                    case 3: // CALL cc,nn
                        var addr = this.fetchWord();
                        if (this.checkCondition(y)) {
                            this.pushWord(this.PC);
                            this.PC = addr;
                            return 6;
                        }
                        return 3;
                    default:
                        // Undefined opcodes
                        return 1;
                }
            case 5:
                if (q === 0) {
                    // PUSH rr
                    this.pushWord(this.getReg16AF(p));
                    return 4;
                }
                else {
                    if (p === 0) {
                        // CALL nn
                        var addr = this.fetchWord();
                        this.pushWord(this.PC);
                        this.PC = addr;
                        return 6;
                    }
                    // Undefined opcodes
                    return 1;
                }
            case 6:
                // ALU A,n
                this.aluOp(y, this.fetchByte());
                return 2;
            case 7:
                // RST n
                this.pushWord(this.PC);
                this.PC = y * 8;
                return 4;
        }
        return 1;
    }
}
exports.SM83 = SM83;
// Flag bit positions in F register
SM83.FLAG_Z = 0x80;
SM83.FLAG_N = 0x40;
SM83.FLAG_H = 0x20;
SM83.FLAG_C = 0x10;
//# sourceMappingURL=SM83.js.map