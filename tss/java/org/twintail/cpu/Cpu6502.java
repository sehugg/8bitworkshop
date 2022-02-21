/**
 * CPU Emulation Suites for Java
 */
package org.twintail.cpu;

import org.twintail.Log;

/**
 * class Cpu6502
 *
 * This class emulates MOS 6502 processor.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public final class Cpu6502 implements Cpu {
    public static final int REG_A = 0;
    public static final int REG_B = 1;
    public static final int REG_X = 2;
    public static final int REG_Y = 3;
    public static final int REG_Z = 4;
    public static final int REG_P = 5;
    public static final int REG_S = 6;
    public static final int REG_PC = 7;
    public static final int NUM_OF_REGS = 8;

    private static final int INST_BRK = 0x00;
    private static final int INST_ORA_IND_X = 0x01;
    private static final int INST_CLE = 0x02;
    private static final int INST_SEE = 0x03;
    private static final int INST_TSB_BP = 0x04;
    private static final int INST_ORA_BP = 0x05;
    private static final int INST_ASL_BP = 0x06;
    private static final int INST_RMB0_BP = 0x07;
    private static final int INST_PHP = 0x08;
    private static final int INST_ORA_IMM = 0x09;
    private static final int INST_ASL_ACCUM = 0x0a;
    private static final int INST_TSY = 0x0b;
    private static final int INST_TSB_ABS = 0x0c;
    private static final int INST_ORA_ABS = 0x0d;
    private static final int INST_ASL_ABS = 0x0e;
    private static final int INST_BBR0_BP = 0x0f;
    private static final int INST_BPL_REL = 0x10;
    private static final int INST_ORA_IND_Y = 0x11;
    private static final int INST_ORA_IND_Z = 0x12;
    private static final int INST_BPL_W_REL = 0x13;
    private static final int INST_TRB_BP = 0x14;
    private static final int INST_ORA_BP_X = 0x15;
    private static final int INST_ASL_BP_X = 0x16;
    private static final int INST_RMB1_BP = 0x17;
    private static final int INST_CLC = 0x18;
    private static final int INST_ORA_ABS_Y = 0x19;
    private static final int INST_INC = 0x1a;
    private static final int INST_INZ = 0x1b;
    private static final int INST_TRB_ABS = 0x1c;
    private static final int INST_ORA_ABS_X = 0x1d;
    private static final int INST_ASL_ABS_X = 0x1e;
    private static final int INST_BBR1_BP = 0x1f;
    private static final int INST_JSR_ABS = 0x20;
    private static final int INST_AND_IND_X = 0x21;
    private static final int INST_JSR_ABS_IND = 0x22;
    private static final int INST_JSR_ABS_IND_X = 0x23;
    private static final int INST_BIT_BP = 0x24;
    private static final int INST_AND_BP = 0x25;
    private static final int INST_ROL_BP = 0x26;
    private static final int INST_RMB2_BP = 0x27;
    private static final int INST_PLP = 0x28;
    private static final int INST_AND_IMM = 0x29;
    private static final int INST_ROL_ACCUM = 0x2a;
    private static final int INST_TYS = 0x2b;
    private static final int INST_BIT_ABS = 0x2c;
    private static final int INST_AND_ABS = 0x2d;
    private static final int INST_ROL_ABS = 0x2e;
    private static final int INST_BBR2_BP = 0x2f;
    private static final int INST_BMI_REL = 0x30;
    private static final int INST_AND_IND_Y = 0x31;
    private static final int INST_AND_IND_Z = 0x32;
    private static final int INST_BMI_W_REL = 0x33;
    private static final int INST_BIT_BP_X = 0x34;
    private static final int INST_AND_BP_X = 0x35;
    private static final int INST_ROL_BP_X = 0x36;
    private static final int INST_RMB3_BP = 0x37;
    private static final int INST_SEC = 0x38;
    private static final int INST_AND_ABS_Y = 0x39;
    private static final int INST_DEC_ACCUM = 0x3a;
    private static final int INST_DEZ = 0x3b;
    private static final int INST_BIT_ABS_X = 0x3c;
    private static final int INST_AND_ABS_X = 0x3d;
    private static final int INST_ROL_ABS_X = 0x3e;
    private static final int INST_BBR3_BP = 0x3f;
    private static final int INST_RTI = 0x40;
    private static final int INST_EOR_IND_X = 0x41;
    private static final int INST_NEG_ACCUM = 0x42;
    private static final int INST_ASR_ACCUM = 0x43;
    private static final int INST_ASR_BP = 0x44;
    private static final int INST_EOR_BP = 0x45;
    private static final int INST_LSR_BP = 0x46;
    private static final int INST_RMB4_BP = 0x47;
    private static final int INST_PHA = 0x48;
    private static final int INST_EOR_IMM = 0x49;
    private static final int INST_LSR_ACCUM = 0x4a;
    private static final int INST_TAZ = 0x4b;
    private static final int INST_JMP_ABS = 0x4c;
    private static final int INST_EOR_ABS = 0x4d;
    private static final int INST_LSR_ABS = 0x4e;
    private static final int INST_BBR4_BP = 0x4f;
    private static final int INST_BVC_REL = 0x50;
    private static final int INST_EOR_IND_Y = 0x51;
    private static final int INST_EOR_IND_Z = 0x52;
    private static final int INST_BVC_W_REL = 0x53;
    private static final int INST_ASR_BP_X = 0x54;
    private static final int INST_EOR_BP_X = 0x55;
    private static final int INST_LSR_BP_X = 0x56;
    private static final int INST_RMB5_BP = 0x57;
    private static final int INST_CLI = 0x58;
    private static final int INST_EOR_ABS_Y = 0x59;
    private static final int INST_PHY = 0x5a;
    private static final int INST_TAB = 0x5b;
    private static final int INST_AUG = 0x5c;
    private static final int INST_EOR_ABS_X = 0x5d;
    private static final int INST_LSR_ABS_X = 0x5e;
    private static final int INST_BBR5_BP = 0x5f;
    private static final int INST_RTS = 0x60;
    private static final int INST_ADC_IND_X = 0x61;
    private static final int INST_RTN = 0x62;
    private static final int INST_BSR_W_REL = 0x63;
    private static final int INST_STZ_BP = 0x64;
    private static final int INST_ADC_BP = 0x65;
    private static final int INST_ROR_BP = 0x66;
    private static final int INST_RMB6_BP = 0x67;
    private static final int INST_PLA = 0x68;
    private static final int INST_ADC_IMM = 0x69;
    private static final int INST_ROR_ACCUM = 0x6a;
    private static final int INST_TZA = 0x6b;
    private static final int INST_JMP_ABS_IND = 0x6c;
    private static final int INST_ADC_ABS = 0x6d;
    private static final int INST_ROR_ABS = 0x6e;
    private static final int INST_BBR6_BP = 0x6f;
    private static final int INST_BVS_REL = 0x70;
    private static final int INST_ADC_IND_Y = 0x71;
    private static final int INST_ADC_IND_Z = 0x72;
    private static final int INST_BVS_W_REL = 0x73;
    private static final int INST_STZ_BP_X = 0x74;
    private static final int INST_ADC_BP_X = 0x75;
    private static final int INST_ROR_BP_X = 0x76;
    private static final int INST_RMB7_BP = 0x77;
    private static final int INST_SEI = 0x78;
    private static final int INST_ADC_ABS_Y = 0x79;
    private static final int INST_PLY = 0x7a;
    private static final int INST_TBA = 0x7b;
    private static final int INST_JMP_ABS_IND_X = 0x7c;
    private static final int INST_ADC_ABS_X = 0x7d;
    private static final int INST_ROR_ABS_X = 0x7e;
    private static final int INST_BBR7_BP = 0x7f;
    private static final int INST_BRU_REL = 0x80;
    private static final int INST_STA_IND_X = 0x81;
    private static final int INST_STA_DSP_Y = 0x82;
    private static final int INST_BRU_W_REL = 0x83;
    private static final int INST_STY_BP = 0x84;
    private static final int INST_STA_BP = 0x85;
    private static final int INST_STX_BP = 0x86;
    private static final int INST_SMB0_BP = 0x87;
    private static final int INST_DEY = 0x88;
    private static final int INST_BIT_IMM = 0x89;
    private static final int INST_TXA = 0x8a;
    private static final int INST_STY_ABS_X = 0x8b;
    private static final int INST_STY_ABS = 0x8c;
    private static final int INST_STA_ABS = 0x8d;
    private static final int INST_STX_ABS = 0x8e;
    private static final int INST_BBS0_BP = 0x8f;
    private static final int INST_BCC_REL = 0x90;
    private static final int INST_STA_IND_Y = 0x91;
    private static final int INST_STA_IND_Z = 0x92;
    private static final int INST_BCC_W_REL = 0x93;
    private static final int INST_STY_BP_X = 0x94;
    private static final int INST_STA_BP_X = 0x95;
    private static final int INST_STX_BP_Y = 0x96;
    private static final int INST_SMB1_BP = 0x97;
    private static final int INST_TYA = 0x98;
    private static final int INST_STA_ABS_Y = 0x99;
    private static final int INST_TXS = 0x9a;
    private static final int INST_STX_ABS_Y = 0x9b;
    private static final int INST_STZ_ABS = 0x9c;
    private static final int INST_STA_ABS_X = 0x9d;
    private static final int INST_STZ_ABS_X = 0x9e;
    private static final int INST_BBS1_BP = 0x9f;
    private static final int INST_LDY_IMM = 0xa0;
    private static final int INST_LDA_IND_X = 0xa1;
    private static final int INST_LDX_IMM = 0xa2;
    private static final int INST_LDZ_IMM = 0xa3;
    private static final int INST_LDY_BP = 0xa4;
    private static final int INST_LDA_BP = 0xa5;
    private static final int INST_LDX_BP = 0xa6;
    private static final int INST_SMB2_BP = 0xa7;
    private static final int INST_TAY = 0xa8;
    private static final int INST_LDA_IMM = 0xa9;
    private static final int INST_TAX = 0xaa;
    private static final int INST_LDZ_ABS = 0xab;
    private static final int INST_LDY_ABS = 0xac;
    private static final int INST_LDA_ABS = 0xad;
    private static final int INST_LDX_ABS = 0xae;
    private static final int INST_BBS2_BP = 0xaf;
    private static final int INST_BCS_REL = 0xb0;
    private static final int INST_LDA_IND_Y = 0xb1;
    private static final int INST_LDA_IND_Z = 0xb2;
    private static final int INST_BCS_W_REL = 0xb3;
    private static final int INST_LDY_BP_X = 0xb4;
    private static final int INST_LDA_BP_X = 0xb5;
    private static final int INST_LDX_BP_Y = 0xb6;
    private static final int INST_SMB3_BP = 0xb7;
    private static final int INST_CLV = 0xb8;
    private static final int INST_LDA_ABS_Y = 0xb9;
    private static final int INST_TSX = 0xba;
    private static final int INST_LDZ_ABS_X = 0xbb;
    private static final int INST_LDY_ABS_X = 0xbc;
    private static final int INST_LDA_ABS_X = 0xbd;
    private static final int INST_LDX_ABS_Y = 0xbe;
    private static final int INST_BBS3_BP = 0xbf;
    private static final int INST_CPY_IMM = 0xc0;
    private static final int INST_CMP_IND_X = 0xc1;
    private static final int INST_CPZ_IMM = 0xc2;
    private static final int INST_DEW_BP = 0xc3;
    private static final int INST_CPY_BP = 0xc4;
    private static final int INST_CMP_BP = 0xc5;
    private static final int INST_DEC_BP = 0xc6;
    private static final int INST_SMB4_BP = 0xc7;
    private static final int INST_INY = 0xc8;
    private static final int INST_CMP_IMM = 0xc9;
    private static final int INST_DEX = 0xca;
    private static final int INST_ASW_ABS = 0xcb;
    private static final int INST_CPY_ABS = 0xcc;
    private static final int INST_CMP_ABS = 0xcd;
    private static final int INST_DEC_ABS = 0xce;
    private static final int INST_BBS4_BP = 0xcf;
    private static final int INST_BNE_REL = 0xd0;
    private static final int INST_CMP_IND_Y = 0xd1;
    private static final int INST_CMP_IND_Z = 0xd2;
    private static final int INST_BNE_W_REL = 0xd3;
    private static final int INST_CPZ_BP = 0xd4;
    private static final int INST_CMP_BP_X = 0xd5;
    private static final int INST_DEC_BP_X = 0xd6;
    private static final int INST_SMB5_BP = 0xd7;
    private static final int INST_CLD = 0xd8;
    private static final int INST_CMP_ABS_Y = 0xd9;
    private static final int INST_PHX = 0xda;
    private static final int INST_PHZ = 0xdb;
    private static final int INST_CPZ_ABS = 0xdc;
    private static final int INST_CMP_ABS_X = 0xdd;
    private static final int INST_DEC_ABS_X = 0xde;
    private static final int INST_BBS5_BP = 0xdf;
    private static final int INST_CPX_IMM = 0xe0;
    private static final int INST_SBC_IND_X = 0xe1;
    private static final int INST_LDA_DSP_Y = 0xe2;
    private static final int INST_INW_BP = 0xe3;
    private static final int INST_CPX_BP = 0xe4;
    private static final int INST_SBC_BP = 0xe5;
    private static final int INST_INC_BP = 0xe6;
    private static final int INST_SMB6_BP = 0xe7;
    private static final int INST_INX = 0xe8;
    private static final int INST_SBC_IMM = 0xe9;
    private static final int INST_NOP = 0xea;
    private static final int INST_ROW_ABS = 0xeb;
    private static final int INST_CPX_ABS = 0xec;
    private static final int INST_SBC_ABS = 0xed;
    private static final int INST_INC_ABS = 0xee;
    private static final int INST_BBS6_BP = 0xef;
    private static final int INST_BEQ_REL = 0xf0;
    private static final int INST_SBC_IND_Y = 0xf1;
    private static final int INST_SBC_IND_Z = 0xf2;
    private static final int INST_BEQ_W_REL = 0xf3;
    private static final int INST_PHW_IMM_W = 0xf4;
    private static final int INST_SBC_BP_X = 0xf5;
    private static final int INST_INC_BP_X = 0xf6;
    private static final int INST_SMB7_BP = 0xf7;
    private static final int INST_SED = 0xf8;
    private static final int INST_SBC_ABS_Y = 0xf9;
    private static final int INST_PLX = 0xfa;
    private static final int INST_PLZ = 0xfb;
    private static final int INST_PHW_ABS_W = 0xfc;
    private static final int INST_SBC_ABS_X = 0xfd;
    private static final int INST_INC_ABS_X = 0xfe;
    private static final int INST_BBS7_BP = 0xff;

    private static final int[] CYCLES = {
        7, 5, 2, 2, 4, 3, 4, 4, 3, 2, 1, 1, 5, 4, 5, 4, // 0x0x
        2, 5, 5, 3, 4, 3, 4, 4, 1, 4, 1, 1, 5, 4, 5, 4, // 0x1x
        5, 5, 7, 7, 4, 3, 4, 4, 3, 2, 1, 1, 5, 4, 5, 4, // 0x2x
        2, 5, 5, 3, 4, 3, 4, 4, 1, 4, 1, 1, 5, 4, 5, 4, // 0x3x
        5, 5, 2, 2, 4, 3, 4, 4, 3, 2, 1, 1, 3, 4, 5, 4, // 0x4x
        2, 5, 5, 3, 4, 3, 4, 4, 1, 4, 3, 1, 4, 4, 5, 4, // 0x5x
        4, 5, 7, 5, 3, 3, 4, 4, 3, 2, 1, 1, 5, 4, 5, 4, // 0x6x
        2, 5, 5, 3, 3, 3, 4, 4, 2, 4, 3, 1, 5, 4, 5, 4, // 0x7x
        2, 5, 6, 3, 3, 3, 3, 4, 1, 2, 1, 4, 4, 4, 4, 4, // 0x8x
        2, 5, 5, 3, 3, 3, 3, 4, 1, 4, 1, 4, 4, 4, 4, 4, // 0x9x
        2, 5, 2, 2, 3, 3, 3, 4, 1, 2, 1, 4, 4, 4, 4, 4, // 0xAx
        2, 5, 5, 3, 3, 3, 3, 4, 1, 4, 1, 4, 4, 4, 4, 4, // 0xBx
        2, 5, 2, 6, 3, 3, 4, 4, 1, 2, 1, 7, 4, 4, 5, 4, // 0xCx
        2, 5, 5, 3, 3, 3, 4, 4, 1, 4, 3, 3, 4, 4, 5, 4, // 0xDx
        2, 5, 6, 6, 3, 3, 4, 4, 1, 2, 1, 6, 4, 4, 5, 4, // 0xEx
        2, 5, 5, 3, 5, 3, 4, 4, 1, 4, 3, 3, 7, 4, 5, 4, // 0xFx
    };

    private static final int BYTE_MASK = 0xff;
    private static final int WORD_MASK = 0xffff;
    private static final int BYTE_SHIFT = 8;
    private static final int BYTE_MAX = 0xff;
    private static final int STACK_BASE = 0x0100;

    private static final int BIT15 = 0x8000;
    private static final char BIT7 = (char) 0x80;
    private static final char BIT6 = (char) 0x40;
    private static final char BIT5 = (char) 0x20;
    private static final char BIT4 = (char) 0x10;
    private static final char BIT3 = (char) 0x08;
    private static final char BIT2 = (char) 0x04;
    private static final char BIT1 = (char) 0x02;
    private static final char BIT0 = (char) 0x01;

    private static final char P_N = BIT7;
    private static final char P_V = BIT6;
    private static final char P_E = BIT5;
    private static final char P_B = BIT4;
    private static final char P_D = BIT3;
    private static final char P_I = BIT2;
    private static final char P_Z = BIT1;
    private static final char P_C = BIT0;

    private static final int VECTOR_NMI = 0xfffa;
    private static final int VECTOR_RESET = 0xfffc;
    private static final int VECTOR_IRQ = 0xfffe;
    private static final int VECTOR_BRK = 0xfffe;

    private Memory memory;
    private char registerA;
    private char registerB;
    private char registerX;
    private char registerY;
    private char registerZ;
    private char registerS;
    private char registerP;
    private short registerPC;

    private int cycles;

    private boolean enableMos65ce02 = false;

    /**
     * Class constructor.
     */
    public Cpu6502() {
        init();
    }

    /**
     * Set memory access object.
     * @param newMemory Memory object to set
     */
    public void setMemory(final Memory newMemory) {
        memory = newMemory;
    }

    /**
     * Initialize the processor.
     */
    public void init() {
        registerA = 0;
        registerB = 0;
        registerX = 0;
        registerY = 0;
        registerZ = 0;
        registerS = 0;
        registerP = 0;
        registerPC = 0;

        cycles = 0;
    }

    /**
     * @see Cpu
     * @param index register index
     * @return register value
     */
    public int readRegister(final int index) {
        switch (index) {
        case REG_A:
            return registerA & BYTE_MASK;
        case REG_B:
            return registerB & BYTE_MASK;
        case REG_X:
            return registerX & BYTE_MASK;
        case REG_Y:
            return registerY & BYTE_MASK;
        case REG_Z:
            return registerZ & BYTE_MASK;
        case REG_P:
            return registerP & BYTE_MASK;
        case REG_S:
            return registerS & BYTE_MASK;
        case REG_PC:
            return registerPC & WORD_MASK;
        default:
            throw new ArrayIndexOutOfBoundsException();
        }
    }

    /**
     * Skip a byte.
     */
    private void skip() {
        registerPC++;
    }

    /**
     * Fetch a byte data from PC.
     * @return read data
     */
    private int fetch() {
        int data = memory.readChar(((int) registerPC) & WORD_MASK);
        registerPC++;
        return data & BYTE_MASK;
    }

    /**
     * Get absolute address.
     * @param index address index (unsigned 8-bit offset)
     * @return absolute address
     */
    private int getAbsoluteAddress(final char index) {
        int low = ((int) fetch()) & BYTE_MASK;
        int high = ((int) fetch()) & BYTE_MASK;
        int address = (high << BYTE_SHIFT) | low;
        address = (address + (index & BYTE_MASK)) & WORD_MASK;
        return address;
    }

    /**
     * Get absolute indirect address.
     * @param index address index (unsigned 8-bit offset)
     * @return absolute indirect address
     */
    private int getAbsoluteIndirectAddress(final char index) {
        int low = ((int) fetch()) & BYTE_MASK;
        int high = ((int) fetch()) & BYTE_MASK;
        int address = (high << BYTE_SHIFT) | low;
        address = (address + (index & BYTE_MASK)) & WORD_MASK;
        low = ((int) memory.readChar(address + 0)) & BYTE_MASK;
        high = ((int) memory.readChar(address + 1)) & BYTE_MASK;
        address = ((high << BYTE_SHIFT) | low) & WORD_MASK;
        return address;
    }

    /**
     * Get base page address.
     * @param index address index
     * @return base page address
     */
    private int getBasePageAddress(final char index) {
        int address = (fetch() + index) & BYTE_MASK;
        return address;
    }

    /**
     * Get indexed indirect address by X.
     * @return indexed indirect address
     */
    private int getIndexedIndirectAddress() {
        int address = (fetch() + registerX) & BYTE_MASK;
        int low = ((int) memory.readChar(address + 0)) & BYTE_MASK;
        int high = ((int) memory.readChar(address + 1)) & BYTE_MASK;
        address = (high << BYTE_SHIFT) | low;
        return address;
    }

    /**
     * Get indirect indexed address by Y or Z.
     * @param index address index (unsigned 8-bit offset)
     * @return indirect address
     */
    private int getIndirectIndexedAddress(final char index) {
        int address = fetch() & BYTE_MASK;
        int low = ((int) memory.readChar(address + 0)) & BYTE_MASK;
        int high = ((int) memory.readChar(address + 1)) & BYTE_MASK;
        address = (high << BYTE_SHIFT) | low;
        address = (address + (index & BYTE_MASK)) & WORD_MASK;
        return address;
    }

    /**
     * Get relative address.
     * @return relative address
     */
    private int getRelativeAddress() {
        // relative offset is signed value exceptionally
        char offset = (char) fetch();
        return (registerPC + offset) & WORD_MASK;
    }

    /**
     * Get stack address.
     * @param s stack index
     * @return stack address
     */
    private int getStackAddress(final char s) {
        return STACK_BASE | (s & BYTE_MASK);
    }

    /**
     * Get stack page indirect indexed address.
     * @param index address index
     * @return stack page indirect indexed address
     */
    private int getStackPageIndirectIndexedAddress(final char index) {
        int address = getStackAddress((char) (registerS + fetch()));
        int low = ((int) memory.readChar(address + 0)) & BYTE_MASK;
        int high = ((int) memory.readChar(address + 1)) & BYTE_MASK;
        address = (high << BYTE_SHIFT) | low;
        address += (index & BYTE_MASK);
        return address;
    }

    /**
     * Get absolute word address.
     * @return absolute address
     */
    private int getWordAbsoluteAddress() {
        int low = ((int) fetch()) & BYTE_MASK;
        int high = ((int) fetch()) & BYTE_MASK;
        int address = (high << BYTE_SHIFT) | low;
        return address;
    }

    /**
     * Get relative byte address.
     * @return relative address
     */
    private int getWordRelativeAddress() {
        int low = ((int) fetch()) & BYTE_MASK;
        int high = ((int) fetch()) & BYTE_MASK;
        // relative offset is signed value exceptionally
        short offset = (short) ((high << BYTE_SHIFT) | low);
        return (registerPC + offset) & WORD_MASK;
    }

    /**
     * Get absolute addressing value.
     * @param index address index
     * @return absolute addressing value
     */
    private char getAbsoluteValue(final char index) {
        int address = getAbsoluteAddress(index);
        return memory.readChar(address);

    }

    /**
     * Get base page addressing value.
     * @param index address index
     * @return base page addressing value
     */
    private char getBasePageValue(final char index) {
        int address = getBasePageAddress(index);
        return memory.readChar(address);
    }

    /**
     * Get immediate addressing value.
     * @return immediate addressing value
     */
    private char getImmediateValue() {
        return (char) (fetch() & BYTE_MASK);
    }

    /**
     * Get immediate addressing word value.
     * @return immediate addressing value
     */
    private short getImmediateWordValue() {
        int low = ((int) fetch()) & BYTE_MASK;
        int high = ((int) fetch()) & BYTE_MASK;
        return (short) ((high << BYTE_SHIFT) | low);
    }

    /**
     * Get indexed indirect addressing value by X.
     * @return indexed indirect addressing value
     */
    private char getIndexedIndirectValue() {
        int address = getIndexedIndirectAddress();
        return memory.readChar(address);
    }

    /**
     * Get indexed indirect addressing value by Y or Z.
     * @param index offset value (Y or Z)
     * @return indexed indirect addressing value
     */
    private char getIndirectIndexedValue(final char index) {
        int address = getIndirectIndexedAddress(index);
        return memory.readChar(address);
    }

    /**
     * Set status flags on P register.
     * @param flags flags to set
     */
    private void setStatus(final int flags) {
        registerP |= flags;
    }

    /**
     * Reset status flags on P register.
     * @param flags flags to reset
     */
    private void resetStatus(final int flags) {
        registerP &= ~flags;
    }

    /**
     * Execute ADC operation.
     * @param value operand
     */
    private void executeAdc(final char value) {
        boolean plus = true;
        if (0 != (registerA & BIT7)) {
            plus = false;
        }
        int result = 0;
        if (0 != (registerP & P_C)) {
            result = 1;
        }
        result += registerA & BYTE_MASK;
        result += value & BYTE_MASK;
        resetStatus(P_N | P_V | P_Z | P_C);
        if (0 != (result & ~BYTE_MASK)) {
            setStatus(P_C);
        }
        if (0 != (result & BIT7)) {
            setStatus(P_N);
            if (plus) {
                setStatus(P_V);
            }
        } else {
            if (0 == result) {
                setStatus(P_Z);
            }
            if (!plus) {
                setStatus(P_V);
            }
        }
    }

    /**
     * Execute AND operation.
     * @param value operand
     */
    private void executeAnd(final char value) {
        registerA = (char) (registerA & value);
        resetStatus(P_N | P_Z);
        if (0 == registerA) {
            setStatus(P_Z);
        } else if (0 != (registerA & BIT7)) {
            setStatus(P_N);
        }
    }

    /**
     * Execute ASL operation.
     * @param address operand address
     */
    private void executeAsl(final int address) {
        int value = memory.readChar(address);
        resetStatus(P_N | P_Z | P_C);
        if (0 != (value & BIT7)) {
            setStatus(P_C);
        }
        value = (value << 1) & BYTE_MASK;
        if (0 == value) {
            setStatus(P_Z);
        } else if (0 != (value & BIT7)) {
            setStatus(P_N);
        }
        memory.writeChar(address, (char) value);
    }

    /**
     * Execute ASL operation to A.
     */
    private void executeAslA() {
        resetStatus(P_N | P_Z | P_C);
        if (0 != (registerA & BIT7)) {
            setStatus(P_C);
        }
        registerA = (char) ((registerA << 1) & BYTE_MASK);
        if (0 == registerA) {
            setStatus(P_Z);
        } else if (0 != (registerA & BIT7)) {
            setStatus(P_N);
        }
    }

    /**
     * Execute ASR operation.
     * @param address operand address
     */
    private void executeAsr(final int address) {
        char value = memory.readChar(address);
        int carry = 0;
        if (0 != (registerP & P_C)) {
            carry = BIT7;
        }
        resetStatus(P_N | P_Z | P_C);
        if (0 != (value & BIT0)) {
            setStatus(P_C);
        }
        value = (char) ((value >> 1) | carry);
        if (0 == value) {
            setStatus(P_Z);
        } else if (0 != (value & BIT7)) {
            setStatus(P_N);
        }
        memory.writeChar(address, value);
    }

    /**
     * Execute ASR operation to A.
     */
    private void executeAsrA() {
        int carry = 0;
        if (0 != (registerP & P_C)) {
            carry = BIT7;
        }
        resetStatus(P_N | P_Z | P_C);
        if (0 != (registerA & BIT0)) {
            setStatus(P_C);
        }
        registerA = (char) ((registerA >> 1) | carry);
        if (0 == registerA) {
            setStatus(P_Z);
        } else if (0 != (registerA & BIT7)) {
            setStatus(P_N);
        }
    }

    /**
     * Execute ASW operation.
     * @param address operand address
     */
    private void executeAsw(final int address) {
        int low = ((int) memory.readChar(address + 0)) & BYTE_MASK;
        int high = ((int) memory.readChar(address + 1)) & BYTE_MASK;
        int value = ((high << BYTE_SHIFT) | low) & WORD_MASK;
        resetStatus(P_N | P_Z | P_C);
        if (0 != (value & BIT15)) {
            setStatus(P_C);
        }
        value = (value << 1) & WORD_MASK;
        if (0 == value) {
            setStatus(P_Z);
        } else if (0 != (value & BIT15)) {
            setStatus(P_N);
        }
        memory.writeChar(address + 0, (char) value);
        memory.writeChar(address + 1, (char) (value >> BYTE_SHIFT));
    }

    /**
     * Execute BBR operation.
     * @param mask bit mask to test
     * @param address address to test
     * @param target branch target
     */
    public void executeBbr(final int mask, final int address,
            final int target) {
        int value = memory.readChar(address);
        if (0 == (mask & value)) {
            registerPC = (short) target;
        }
    }

    /**
     * Execute BBS operation.
     * @param mask bit mask to test
     * @param address address to test
     * @param target branch target
     */
    public void executeBbs(final int mask, final int address,
            final int target) {
        int value = memory.readChar(address);
        if (0 != (mask & value)) {
            registerPC = (short) target;
        }
    }

    /**
     * Execute BIT operation.
     * @param mask bit mask to test
     */
    public void executeBit(final int mask) {
        int result = registerA & mask;
        resetStatus(BIT7 | BIT6 | P_Z);
        if (0 != (mask & BIT7)) {
            setStatus(BIT7);
        }
        if (0 != (mask & BIT6)) {
            setStatus(BIT6);
        }
        if (0 == result) {
            setStatus(P_Z);
        }
    }

    /**
     * Execute BRK operation.
     */
    public void executeBrk() {
        skip();
        memory.writeChar(getStackAddress(registerS--),
                ((char) (registerPC >> BYTE_SHIFT)));
        memory.writeChar(getStackAddress(registerS--), ((char) registerPC));
        setStatus(P_B);
        memory.writeChar(getStackAddress(registerS--), registerP);
        setStatus(P_I);
        int low = memory.readChar(VECTOR_BRK + 0) & BYTE_MASK;
        int high = memory.readChar(VECTOR_BRK + 1) & BYTE_MASK;
        registerPC = (short) ((high << BYTE_SHIFT) | low);
    }

    /**
     * Execute B** operation.
     * @param taken execute branch on true
     * @param target branch target
     */
    public void executeBxx(final boolean taken, final int target) {
        if (taken) {
            registerPC = (short) target;
        }
    }

    /**
     * Execute CMP/CP* operation.
     * @param src comparer operand
     * @param dst compared operand
     */
    public void executeCmp(final char src, final char dst) {
        int result = (src & BYTE_MASK) - (dst & BYTE_MASK);
        resetStatus(P_N | P_Z | P_C);
        if (0 == result) {
            setStatus(P_Z);
        } else if (0 != (result & BIT7)) {
            setStatus(P_N);
        }
        if ((src & BYTE_MASK) >= (dst & BYTE_MASK)) {
            setStatus(P_C);
        }
    }

    /**
     * Execute DEC operation.
     * @param source operand
     * @return result
     */
    private char executeDec(final char source) {
        char result = (char) (source - 1);
        resetStatus(P_N | P_Z);
        if (0 == result) {
            setStatus(P_Z);
        } else if (0 != (result & BIT7)) {
            setStatus(P_N);
        }
        return result;
    }

    /**
     * Execute DEC operation to memory.
     * @param address operand address
     */
    private void executeDecP(final int address) {
        char value = memory.readChar(address);
        char result = (char) (value - 1);
        resetStatus(P_N | P_Z);
        if (0 == result) {
            setStatus(P_Z);
        } else if (0 != (result & BIT7)) {
            setStatus(P_N);
        }
        memory.writeChar(address, result);
    }

    /**
     * Execute DEW operation.
     * @param address operand address
     */
    private void executeDew(final int address) {
        int low = ((int) memory.readChar(address + 0)) & BYTE_MASK;
        int high = ((int) memory.readChar(address + 1)) & BYTE_MASK;
        int value = (high << BYTE_SHIFT) | low;
        value = (value - 1) & WORD_MASK;
        resetStatus(P_N | P_Z);
        if (0 == value) {
            setStatus(P_Z);
        } else if (0 != (value & BIT15)) {
            setStatus(P_N);
        }
        memory.writeChar(address + 0, (char) value);
        memory.writeChar(address + 1, (char) (value >> BYTE_SHIFT));
    }

    /**
     * Execute EOR operation.
     * @param value operand
     */
    private void executeEor(final char value) {
        registerA = (char) (registerA ^ value);
        resetStatus(P_N | P_Z);
        if (0 == registerA) {
            setStatus(P_Z);
        } else if (0 != (registerA & BIT7)) {
            setStatus(P_N);
        }
    }

    /**
     * Execute INC operation.
     * @param source operand
     * @return result
     */
    private char executeInc(final char source) {
        char result = (char) (source + 1);
        resetStatus(P_N | P_Z);
        if (0 == result) {
            setStatus(P_Z);
        } else if (0 != (result & BIT7)) {
            setStatus(P_N);
        }
        return result;
    }

    /**
     * Execute INC operation.
     * @param address operand address
     */
    private void executeIncP(final int address) {
        char value = memory.readChar(address);
        char result = (char) (value + 1);
        resetStatus(P_N | P_Z);
        if (0 == result) {
            setStatus(P_Z);
        } else if (0 != (result & BIT7)) {
            setStatus(P_N);
        }
        memory.writeChar(address, result);
    }

    /**
     * Execute INW operation.
     * @param address operand address
     */
    private void executeInw(final int address) {
        int low = ((int) memory.readChar(address + 0)) & BYTE_MASK;
        int high = ((int) memory.readChar(address + 1)) & BYTE_MASK;
        int value = (high << BYTE_SHIFT) | low;
        value = (value + 1) & WORD_MASK;
        resetStatus(P_N | P_Z);
        if (0 == value) {
            setStatus(P_Z);
        } else if (0 != (value & BIT15)) {
            setStatus(P_N);
        }
        memory.writeChar(address + 0, (char) value);
        memory.writeChar(address + 1, (char) (value >> BYTE_SHIFT));
    }

    /**
     * Execute JSR operation.
     * @param target subroutine address
     */
    public void executeJsr(final int target) {
        registerPC--;
        memory.writeChar(getStackAddress(registerS--),
                ((char) (registerPC >> BYTE_SHIFT)));
        memory.writeChar(getStackAddress(registerS--), ((char) registerPC));
        registerPC = (short) target;
    }

    /**
     * Execute LD* operations.
     * @param value operand
     * @return result
     */
    public char executeLd(final char value) {
        resetStatus(P_N | P_Z);
        if (0 == value) {
            setStatus(P_Z);
        } else if (0 != (value & BIT7)) {
            setStatus(P_N);
        }
        return value;
    }

    /**
     * Execute LSR operation.
     * @param address operand address
     */
    private void executeLsr(final int address) {
        char value = memory.readChar(address);
        resetStatus(P_N | P_Z | P_C);
        if (0 != (value & BIT0)) {
            setStatus(P_C);
        }
        value = (char) (value >> 1);
        if (0 == value) {
            setStatus(P_Z);
        }
        memory.writeChar(address, value);
    }

    /**
     * Execute LSR operation to A.
     */
    private void executeLsrA() {
        resetStatus(P_N | P_Z | P_C);
        if (0 != (registerA & BIT0)) {
            setStatus(P_C);
        }
        registerA = (char) (registerA >> 1);
        if (0 == registerA) {
            setStatus(P_Z);
        }
    }

    /**
     * Execute NEG operation.
     */
    private void executeNeg() {
        registerA = (char) -registerA;
    }

    /**
     * Execute ORA operation.
     * @param value operand
     */
    private void executeOra(final char value) {
        registerA |= value;
        resetStatus(P_N | P_Z);
        if (0 == registerA) {
            setStatus(P_Z);
        } else if (0 != (registerA & BIT7)) {
            setStatus(P_N);
        }
    }

    /**
     * Execute PH* operation.
     * @param value operand
     */
    private void executePh(final char value) {
        memory.writeChar(getStackAddress(registerS--), value);
    }

    /**
     * Execute PHW operation.
     * @param value operand
     */
    private void executePhw(final short value) {
        memory.writeChar(getStackAddress(registerS--),
                (char) (value >> BYTE_SHIFT));
        memory.writeChar(getStackAddress(registerS--), (char) value);
    }

    /**
     * Execute PL* operation.
     * @return result
     */
    private char executePl() {
        registerS++;
        char result = memory.readChar(getStackAddress(registerS));
        resetStatus(P_N | P_Z);
        if (0 == result) {
            setStatus(P_Z);
        } else if (0 != (result & BIT7)) {
            setStatus(P_N);
        }
        return result;
    }

    /**
     * Execute RMB operation.
     * @param address operand address
     * @param mask bit mask to reset
     */
    private void executeRmb(final int address, final int mask) {
        int value = memory.readChar(address);
        value = value & ~mask;
        memory.writeChar(address, (char) value);
    }

    /**
     * Execute ROL operation.
     * @param address operand address
     */
    private void executeRol(final int address) {
        char value = memory.readChar(address);
        char carry = (char) (registerP & P_C);
        resetStatus(P_N | P_Z | P_C);
        if (0 != (value & BIT7)) {
            setStatus(P_C);
        }
        value = (char) ((value << 1) & BYTE_MASK | carry);
        if (0 == value) {
            setStatus(P_Z);
        } else if (0 != (value & BIT7)) {
            setStatus(P_N);
        }
        memory.writeChar(address, value);
    }

    /**
     * Execute ROL operation to A.
     */
    private void executeRolA() {
        char carry = (char) (registerP & P_C);
        resetStatus(P_N | P_Z | P_C);
        if (0 != (registerA & BIT7)) {
            setStatus(P_C);
        }
        registerA = (char) ((registerA << 1) & BYTE_MASK | carry);
        if (0 == registerA) {
            setStatus(P_Z);
        } else if (0 != (registerA & BIT7)) {
            setStatus(P_N);
        }
    }

    /**
     * Execute ROR operation.
     * @param address operand address
     */
    private void executeRor(final int address) {
        char value = memory.readChar(address);
        char carry = (char) (registerP & P_C);
        resetStatus(P_N | P_Z | P_C);
        if (0 != (value & BIT0)) {
            setStatus(P_C);
        }
        value = (char) ((value >> 1) & (BYTE_MASK ^ BIT7));
        if (0 != carry) {
            value = (char) ((value | BIT7) & BYTE_MASK);
        }
        if (0 == value) {
            setStatus(P_Z);
        } else if (0 != (value & BIT7)) {
            setStatus(P_N);
        }
        memory.writeChar(address, value);
    }

    /**
     * Execute ROR operation to A.
     */
    private void executeRorA() {
        char carry = (char) (registerP & P_C);
        resetStatus(P_N | P_Z | P_C);
        if (0 != (registerA & BIT0)) {
            setStatus(P_C);
        }
        registerA = (char) ((registerA >> 1) & (BYTE_MASK ^ BIT7));
        if (0 != carry) {
            registerA = (char) ((registerA | BIT7) & BYTE_MASK);
        }
        if (0 == registerA) {
            setStatus(P_Z);
        } else if (0 != (registerA & BIT7)) {
            setStatus(P_N);
        }
    }

    /**
     * Execute ROW operation.
     * @param address operand address
     */
    private void executeRow(final int address) {
        int low = ((int) memory.readChar(address + 0)) & BYTE_MASK;
        int high = ((int) memory.readChar(address + 1)) & BYTE_MASK;
        int value = ((high << BYTE_SHIFT) | low) & WORD_MASK;
        int carry = registerP & P_C;
        resetStatus(P_N | P_Z | P_C);
        if (0 != (value & BIT15)) {
            setStatus(P_C);
        }
        value = (value << 1) & WORD_MASK | carry;
        if (0 == value) {
            setStatus(P_Z);
        } else if (0 != (value & BIT15)) {
            setStatus(P_N);
        }
        memory.writeChar(address + 0, (char) value);
        memory.writeChar(address + 1, (char) (value >> BYTE_SHIFT));
    }

    /**
     * Execute RTI operation.
     */
    private void executeRti() {
        registerP = memory.readChar(getStackAddress(++registerS));
        int low = memory.readChar(getStackAddress(++registerS)) & BYTE_MASK;
        int high = memory.readChar(getStackAddress(++registerS)) & BYTE_MASK;
        registerPC = (short) ((high << BYTE_SHIFT) | low);
    }

    /**
     * Execute RTS operation.
     */
    private void executeRts() {
        int low = memory.readChar(getStackAddress(++registerS)) & BYTE_MASK;
        int high = memory.readChar(getStackAddress(++registerS)) & BYTE_MASK;
        registerPC = (short) (((high << BYTE_SHIFT) | low) + 1);
    }

    /**
     * Execute SBC operation.
     * @param value operand
     */
    private void executeSbc(final char value) {
        boolean plus = true;
        if (0 != (registerA & BIT7)) {
            plus = false;
        }
        int result = 0;
        if (0 == (registerP & P_C)) {
            result = -1;
        }
        result += registerA & BYTE_MASK;
        result -= value & BYTE_MASK;
        resetStatus(P_N | P_V | P_Z | P_C);
        if (registerA >= value) {
            setStatus(P_C);
        }
        if (0 != (result & BIT7)) {
            setStatus(P_N);
            if (plus) {
                setStatus(P_V);
            }
        } else {
            if (0 == result) {
                setStatus(P_Z);
            }
            if (!plus) {
                setStatus(P_V);
            }
        }
        registerA = (char) result;
    }

    /**
     * Execute SMB operation.
     * @param address operand address
     * @param mask bit mask to set
     */
    private void executeSmb(final int address, final int mask) {
        int value = memory.readChar(address);
        value = value | mask;
        memory.writeChar(address, (char) value);
    }

    /**
     * Execute ST* operation.
     * @param value data to write
     * @param address address to write
     */
    private void executeSt(final char value, final int address) {
        memory.writeChar(address, value);
    }

    /**
     * Execute TA* operation.
     * @return result
     */
    private char executeTax() {
        resetStatus(P_N | P_Z);
        if (0 == registerA) {
            setStatus(P_Z);
        } else if (0 != (registerA & BIT7)) {
            setStatus(P_N);
        }
        return registerA;
    }

    /**
     * Execute TRB operation.
     * This operation realizes test and reset bit.
     * @param address operand address
     */
    private void executeTrb(final int address) {
        int result = ~registerA & memory.readChar(address);
        if (0 == result) {
            setStatus(P_Z);
        } else {
            resetStatus(P_Z);
        }
        memory.writeChar(address, (char) result);
    }

    /**
     * Execute TSB operation.
     * This operation realizes test and set bit.
     * @param address operand address
     */
    private void executeTsb(final int address) {
        int result = registerA | memory.readChar(address);
        if (0 == result) {
            setStatus(P_Z);
        } else {
            resetStatus(P_Z);
        }
        memory.writeChar(address, (char) result);
    }

    /**
     * Execute TS* operation.
     * @return result
     */
    private char executeTsx() {
        resetStatus(P_N | P_Z);
        if (0 == registerS) {
            setStatus(P_Z);
        } else if (0 != (registerS & BIT7)) {
            setStatus(P_N);
        }
        return registerS;
    }

    /**
     * ExecuteT*A operation.
     * @param value operand
     */
    private void executeTxa(final char value) {
        registerA = value;
        resetStatus(P_N | P_Z);
        if (0 == registerA) {
            setStatus(P_Z);
        } else if (0 != (registerA & BIT7)) {
            setStatus(P_N);
        }
    }

    /**
     * Execute T*S operation.
     * @param value operand
     */
    private void executeTxs(final char value) {
        registerS = value;
        resetStatus(P_N | P_Z);
        if (0 == registerS) {
            setStatus(P_Z);
        } else if (0 != (registerS & BIT7)) {
            setStatus(P_N);
        }
    }

    /**
     * Execute Unknown operation.
     * @param inst instruction code
     */
    private void executeUnknown(final int inst) {
        /*
        Log.getLog().warn(String.format("%s: %02x",
                "Cpu6502: unknown instruction",
                inst));
        */
    }

    /**
     * Execute one step.
     */
    public void runStep() {
        int inst = fetch();
        cycles += CYCLES[inst];
        switch (inst) {
        case INST_BRK:
            executeBrk();
            break;
        case INST_ORA_IND_X:
            executeOra(getIndexedIndirectValue());
            break;
        case INST_CLE:
            if (enableMos65ce02) {
                resetStatus(P_E);
                Log.getLog().warn(
                    "Cpu6502 not impl: CLear Extend disable (16-bit SP mode)");
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_SEE:
            if (enableMos65ce02) {
                setStatus(P_E);
                Log.getLog().error(
                    "Cpu6502 not impl: SEt Extend disable (8-bit SP mode)");
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_TSB_BP:
            executeTsb(getBasePageAddress((char) 0));
            break;
        case INST_ORA_BP:
            executeOra(getBasePageValue((char) 0));
            break;
        case INST_ASL_BP:
            executeAsl(getBasePageAddress((char) 0));
            break;
        case INST_RMB0_BP:
            if (enableMos65ce02) {
                executeRmb(getBasePageAddress((char) 0), BIT0);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_PHP:
            executePh(registerP);
            break;
        case INST_ORA_IMM:
            executeOra(getImmediateValue());
            break;
        case INST_ASL_ACCUM:
            executeAslA();
            break;
        case INST_TSY:
            registerY = executeTsx();
            break;
        case INST_TSB_ABS:
            executeTsb(getAbsoluteAddress((char) 0));
            break;
        case INST_ORA_ABS:
            executeOra(getAbsoluteValue((char) 0));
            break;
        case INST_ASL_ABS:
            executeAsl(getAbsoluteAddress((char) 0));
            break;
        case INST_BBR0_BP:
            executeBbr(BIT0, getBasePageAddress((char) 0),
                    getRelativeAddress());
            break;
        case INST_BPL_REL:
            executeBxx(0 == (registerP & P_N), getRelativeAddress());
            break;
        case INST_ORA_IND_Y:
            executeOra(getIndirectIndexedValue(registerY));
            break;
        case INST_ORA_IND_Z:
            executeOra(getIndirectIndexedValue(registerZ));
            break;
        case INST_BPL_W_REL:
            executeBxx(0 == (registerP & P_N), getWordRelativeAddress());
            break;
        case INST_TRB_BP:
            executeTrb(getBasePageAddress((char) 0));
            break;
        case INST_ORA_BP_X:
            executeOra(getBasePageValue(registerX));
            break;
        case INST_ASL_BP_X:
            executeAsl(getBasePageAddress(registerX));
            break;
        case INST_RMB1_BP:
            if (enableMos65ce02) {
                executeRmb(getBasePageAddress((char) 0), BIT1);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_CLC:
            resetStatus(P_C);
            break;
        case INST_ORA_ABS_Y:
            executeOra(getAbsoluteValue(registerY));
            break;
        case INST_INC:
            registerA = executeInc(registerA);
            break;
        case INST_INZ:
            registerZ = executeInc(registerZ);
            break;
        case INST_TRB_ABS:
            executeTrb(getAbsoluteAddress((char) 0));
            break;
        case INST_ORA_ABS_X:
            executeOra(getAbsoluteValue(registerX));
            break;
        case INST_ASL_ABS_X:
            executeAsl(getAbsoluteAddress(registerX));
            break;
        case INST_BBR1_BP:
            if (enableMos65ce02) {
                executeBbr(BIT1, getBasePageAddress((char) 0),
                        getRelativeAddress());
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_JSR_ABS:
            executeJsr(getAbsoluteAddress((char) 0));
            break;
        case INST_AND_IND_X:
            executeAnd(getIndirectIndexedValue(registerX));
            break;
        case INST_JSR_ABS_IND:
            if (enableMos65ce02) {
                executeJsr(getAbsoluteIndirectAddress((char) 0));
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_JSR_ABS_IND_X:
            if (enableMos65ce02) {
                executeJsr(getAbsoluteIndirectAddress(registerX));
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_BIT_BP:
            executeBit(getBasePageValue((char) 0));
            break;
        case INST_AND_BP:
            executeAnd(getBasePageValue((char) 0));
            break;
        case INST_ROL_BP:
            executeRol(getBasePageAddress((char) 0));
            break;
        case INST_RMB2_BP:
            if (enableMos65ce02) {
                executeRmb(getBasePageAddress((char) 0), BIT2);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_PLP:
            registerP = (char) ((executePl() & ~(BIT5 | BIT4))
                    | (registerP & (BIT5 | BIT4)));
            break;
        case INST_AND_IMM:
            executeAnd(getImmediateValue());
            break;
        case INST_ROL_ACCUM:
            executeRolA();
            break;
        case INST_TYS:
            executeTxs(registerY);
            break;
        case INST_BIT_ABS:
            executeBit(getAbsoluteValue((char) 0));
            break;
        case INST_AND_ABS:
            executeAnd(getAbsoluteValue((char) 0));
            break;
        case INST_ROL_ABS:
            executeRol(getAbsoluteAddress((char) 0));
            break;
        case INST_BBR2_BP:
            executeBbr(BIT2, getBasePageAddress((char) 0),
                    getRelativeAddress());
            break;
        case INST_BMI_REL:
            executeBxx(0 != (registerP & P_N), getRelativeAddress());
            break;
        case INST_AND_IND_Y:
            executeAnd(getIndirectIndexedValue(registerY));
            break;
        case INST_AND_IND_Z:
            executeAnd(getIndirectIndexedValue(registerZ));
            break;
        case INST_BMI_W_REL:
            if (enableMos65ce02) {
                executeBxx(0 != (registerP & P_N), getWordRelativeAddress());
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_BIT_BP_X:
            executeBit(getBasePageValue(registerX));
            break;
        case INST_AND_BP_X:
            executeAnd(getBasePageValue(registerX));
            break;
        case INST_ROL_BP_X:
            executeRol(getBasePageAddress(registerX));
            break;
        case INST_RMB3_BP:
            if (enableMos65ce02) {
                executeRmb(getBasePageAddress((char) 0), BIT3);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_SEC:
            setStatus(P_C);
            break;
        case INST_AND_ABS_Y:
            executeAnd(getAbsoluteValue(registerY));
            break;
        case INST_DEC_ACCUM:
            registerA = executeDec(registerA);
            break;
        case INST_DEZ:
            if (enableMos65ce02) {
                registerZ = executeDec(registerZ);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_BIT_ABS_X:
            executeBit(getAbsoluteValue(registerX));
            break;
        case INST_AND_ABS_X:
            executeAnd(getAbsoluteValue(registerX));
            break;
        case INST_ROL_ABS_X:
            executeRol(getAbsoluteAddress(registerX));
            break;
        case INST_BBR3_BP:
            executeBbr(BIT3, getBasePageAddress((char) 0),
                    getRelativeAddress());
            break;
        case INST_RTI:
            executeRti();
            break;
        case INST_EOR_IND_X:
            executeEor(getIndexedIndirectValue());
            break;
        case INST_NEG_ACCUM:
            executeNeg();
            break;
        case INST_ASR_ACCUM:
            executeAsrA();
            break;
        case INST_ASR_BP:
            if (enableMos65ce02) {
                executeAsr(getBasePageAddress((char) 0));
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_EOR_BP:
            executeEor(getBasePageValue((char) 0));
            break;
        case INST_LSR_BP:
            executeLsr(getBasePageAddress((char) 0));
            break;
        case INST_RMB4_BP:
            if (enableMos65ce02) {
                executeRmb(getBasePageAddress((char) 0), BIT4);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_PHA:
            executePh(registerA);
            break;
        case INST_EOR_IMM:
            executeEor(getImmediateValue());
            break;
        case INST_LSR_ACCUM:
            executeLsrA();
            break;
        case INST_TAZ:
            registerZ = executeTax();
            break;
        case INST_JMP_ABS:
            executeBxx(true, getAbsoluteValue((char) 0));
            break;
        case INST_EOR_ABS:
            executeEor(getAbsoluteValue((char) 0));
            break;
        case INST_LSR_ABS:
            executeLsr(getAbsoluteAddress((char) 0));
            break;
        case INST_BBR4_BP:
            executeBbr(BIT4, getBasePageAddress((char) 0),
                    getRelativeAddress());
            break;
        case INST_BVC_REL:
            executeBxx(0 == (registerP & P_V), getRelativeAddress());
            break;
        case INST_EOR_IND_Y:
            executeEor(getIndirectIndexedValue(registerY));
            break;
        case INST_EOR_IND_Z:
            executeEor(getIndirectIndexedValue(registerZ));
            break;
        case INST_BVC_W_REL:
            executeBxx(0 == (registerP & P_V), getWordRelativeAddress());
            break;
        case INST_ASR_BP_X:
            executeEor(getBasePageValue(registerX));
            break;
        case INST_EOR_BP_X:
            executeEor(getBasePageValue(registerX));
            break;
        case INST_LSR_BP_X:
            executeLsr(getBasePageAddress(registerX));
            break;
        case INST_RMB5_BP:
            if (enableMos65ce02) {
                executeRmb(getBasePageAddress((char) 0), BIT5);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_CLI:
            resetStatus(P_I);
            break;
        case INST_EOR_ABS_Y:
            executeEor(getAbsoluteValue(registerY));
            break;
        case INST_PHY:
            executePh(registerY);
            break;
        case INST_TAB:
            registerB = executeTax();
            break;
        case INST_AUG:
            // 4-Bytes NOP for future instruction set expansion
            skip();
            skip();
            skip();
            break;
        case INST_EOR_ABS_X:
            executeEor(getAbsoluteValue(registerX));
            break;
        case INST_LSR_ABS_X:
            executeLsr(getAbsoluteAddress(registerX));
            break;
        case INST_BBR5_BP:
            executeBbr(BIT5, getBasePageAddress((char) 0),
                    getRelativeAddress());
            break;
        case INST_RTS:
            executeRts();
            break;
        case INST_ADC_IND_X:
            executeAdc(getIndexedIndirectValue());
            break;
        case INST_RTN:
            executeRts();
            skip();
            break;
        case INST_BSR_W_REL:
            executeJsr(getWordRelativeAddress());
            break;
        case INST_STZ_BP:
            executeSt(registerZ, getBasePageAddress((char) 0));
            break;
        case INST_ADC_BP:
            executeAdc(getBasePageValue((char) 0));
            break;
        case INST_ROR_BP:
            executeRor(getBasePageAddress((char) 0));
            break;
        case INST_RMB6_BP:
            if (enableMos65ce02) {
                executeRmb(getBasePageAddress((char) 0), BIT6);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_PLA:
            registerA = executePl();
            break;
        case INST_ADC_IMM:
            executeAdc(getImmediateValue());
            break;
        case INST_ROR_ACCUM:
            executeRorA();
            break;
        case INST_TZA:
            executeTxa(registerZ);
            break;
        case INST_JMP_ABS_IND:
            executeBxx(true, getAbsoluteIndirectAddress((char) 0));
            break;
        case INST_ADC_ABS:
            executeAdc(getAbsoluteValue((char) 0));
            break;
        case INST_ROR_ABS:
            executeRor(getAbsoluteAddress((char) 0));
            break;
        case INST_BBR6_BP:
            if (enableMos65ce02) {
                executeBbr(BIT6, getBasePageAddress((char) 0),
                        getRelativeAddress());
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_BVS_REL:
            executeBxx(0 != (registerP & P_V), getRelativeAddress());
            break;
        case INST_ADC_IND_Y:
            if (enableMos65ce02) {
                executeAdc(getIndirectIndexedValue(registerY));
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_ADC_IND_Z:
            if (enableMos65ce02) {
                executeAdc(getIndirectIndexedValue(registerZ));
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_BVS_W_REL:
            if (enableMos65ce02) {
                executeBxx(0 != (registerP & P_V), getWordRelativeAddress());
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_STZ_BP_X:
            executeSt(registerZ, getBasePageAddress(registerX));
            break;
        case INST_ADC_BP_X:
            executeAdc(getBasePageValue(registerX));
            break;
        case INST_ROR_BP_X:
            executeRor(getBasePageValue(registerX));
            break;
        case INST_RMB7_BP:
            if (enableMos65ce02) {
                executeRmb(getBasePageAddress((char) 0), BIT7);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_SEI:
            setStatus(P_I);
            break;
        case INST_ADC_ABS_Y:
            executeAdc(getAbsoluteValue(registerY));
            break;
        case INST_PLY:
            registerY = executePl();
            break;
        case INST_TBA:
            executeTxa(registerB);
            break;
        case INST_JMP_ABS_IND_X:
            executeBxx(true, getAbsoluteIndirectAddress(registerX));
            break;
        case INST_ADC_ABS_X:
            executeAdc(getAbsoluteValue(registerX));
            break;
        case INST_ROR_ABS_X:
            executeRor(getAbsoluteAddress(registerX));
            break;
        case INST_BBR7_BP:
            executeBbr(BIT7, getBasePageAddress((char) 0),
                    getRelativeAddress());
            break;
        case INST_BRU_REL:
            executeBxx(true, getRelativeAddress());
            break;
        case INST_STA_IND_X:
            executeSt(registerA, getIndexedIndirectAddress());
            break;
        case INST_STA_DSP_Y:
            executeSt(registerA, getStackPageIndirectIndexedAddress(registerY));
            break;
        case INST_BRU_W_REL:
            executeBxx(true, getWordRelativeAddress());
            break;
        case INST_STY_BP:
            executeSt(registerY, getBasePageAddress((char) 0));
            break;
        case INST_STA_BP:
            executeSt(registerA, getBasePageAddress((char) 0));
            break;
        case INST_STX_BP:
            executeSt(registerX, getBasePageAddress((char) 0));
            break;
        case INST_SMB0_BP:
            if (enableMos65ce02) {
                executeSmb(getBasePageAddress((char) 0), BIT0);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_DEY:
            registerY = executeDec(registerY);
            break;
        case INST_BIT_IMM:
            executeBit(getImmediateValue());
            break;
        case INST_TXA:
            executeTxa(registerX);
            break;
        case INST_STY_ABS_X:
            executeSt(registerY, getAbsoluteAddress(registerX));
            break;
        case INST_STY_ABS:
            executeSt(registerY, getAbsoluteAddress((char) 0));
            break;
        case INST_STA_ABS:
            executeSt(registerA, getAbsoluteAddress((char) 0));
            break;
        case INST_STX_ABS:
            executeSt(registerX, getAbsoluteAddress((char) 0));
            break;
        case INST_BBS0_BP:
            if (enableMos65ce02) {
                executeBbs(BIT0, getBasePageAddress((char) 0),
                        getRelativeAddress());
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_BCC_REL:
            executeBxx(0 == (registerP & P_C), getRelativeAddress());
            break;
        case INST_STA_IND_Y:
            executeSt(registerA, getIndirectIndexedAddress(registerY));
            break;
        case INST_STA_IND_Z:
            executeSt(registerA, getIndirectIndexedAddress(registerZ));
            break;
        case INST_BCC_W_REL:
            if (enableMos65ce02) {
                executeBxx(0 == (registerP & P_C), getWordRelativeAddress());
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_STY_BP_X:
            executeSt(registerY, getBasePageAddress(registerX));
            break;
        case INST_STA_BP_X:
            executeSt(registerA, getBasePageAddress(registerX));
            break;
        case INST_STX_BP_Y:
            executeSt(registerX, getBasePageAddress(registerY));
            break;
        case INST_SMB1_BP:
            if (enableMos65ce02) {
                executeSmb(getBasePageAddress((char) 0), BIT1);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_TYA:
            executeTxa(registerY);
            break;
        case INST_STA_ABS_Y:
            executeSt(registerA, getAbsoluteAddress(registerY));
            break;
        case INST_TXS:
            executeTxs(registerX);
            break;
        case INST_STX_ABS_Y:
            executeSt(registerX, getAbsoluteAddress(registerY));
            break;
        case INST_STZ_ABS:
            executeSt(registerZ, getAbsoluteAddress((char) 0));
            break;
        case INST_STA_ABS_X:
            executeSt(registerA, getAbsoluteAddress(registerX));
            break;
        case INST_STZ_ABS_X:
            executeSt(registerZ, getAbsoluteAddress(registerX));
            break;
        case INST_BBS1_BP:
            executeBbs(BIT1, getBasePageAddress((char) 0),
                    getRelativeAddress());
            break;
        case INST_LDY_IMM:
            registerY = executeLd(getImmediateValue());
            break;
        case INST_LDA_IND_X:
            registerA = executeLd(getIndexedIndirectValue());
            break;
        case INST_LDX_IMM:
            registerX = executeLd(getImmediateValue());
            break;
        case INST_LDZ_IMM:
            registerZ = executeLd(getImmediateValue());
            break;
        case INST_LDY_BP:
            registerY = executeLd(getBasePageValue((char) 0));
            break;
        case INST_LDA_BP:
            registerA = executeLd(getBasePageValue((char) 0));
            break;
        case INST_LDX_BP:
            registerX = executeLd(getBasePageValue((char) 0));
            break;
        case INST_SMB2_BP:
            if (enableMos65ce02) {
                executeSmb(getBasePageAddress((char) 0), BIT2);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_TAY:
            registerY = executeTax();
            break;
        case INST_LDA_IMM:
            registerA = executeLd(getImmediateValue());
            break;
        case INST_TAX:
            registerX = executeTax();
            break;
        case INST_LDZ_ABS:
            if (enableMos65ce02) {
                registerZ = executeLd(getAbsoluteValue((char) 0));
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_LDY_ABS:
            registerY = executeLd(getAbsoluteValue((char) 0));
            break;
        case INST_LDA_ABS:
            registerA = executeLd(getAbsoluteValue((char) 0));
            break;
        case INST_LDX_ABS:
            registerX = executeLd(getAbsoluteValue((char) 0));
            break;
        case INST_BBS2_BP:
            executeBbs(BIT2, getBasePageAddress((char) 0),
                    getRelativeAddress());
            break;
        case INST_BCS_REL:
            executeBxx(0 != (registerP & P_C), getRelativeAddress());
            break;
        case INST_LDA_IND_Y:
            registerA = executeLd(getIndirectIndexedValue(registerY));
            break;
        case INST_LDA_IND_Z:
            registerA = executeLd(getIndirectIndexedValue(registerZ));
            break;
        case INST_BCS_W_REL:
            executeBxx(0 != (registerP & P_C), getWordRelativeAddress());
            break;
        case INST_LDY_BP_X:
            registerY = executeLd(getBasePageValue(registerX));
            break;
        case INST_LDA_BP_X:
            registerA = executeLd(getBasePageValue(registerX));
            break;
        case INST_LDX_BP_Y:
            registerX = executeLd(getBasePageValue(registerY));
            break;
        case INST_SMB3_BP:
            if (enableMos65ce02) {
                executeSmb(getBasePageAddress((char) 0), BIT3);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_CLV:
            resetStatus(P_V);
            break;
        case INST_LDA_ABS_Y:
            registerA = executeLd(getAbsoluteValue(registerY));
            break;
        case INST_TSX:
            registerS = executeTax();
            break;
        case INST_LDZ_ABS_X:
            if (enableMos65ce02) {
                registerZ = executeLd(getAbsoluteValue(registerX));
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_LDY_ABS_X:
            registerY = executeLd(getAbsoluteValue(registerX));
            break;
        case INST_LDA_ABS_X:
            registerA = executeLd(getAbsoluteValue(registerX));
            break;
        case INST_LDX_ABS_Y:
            registerX = executeLd(getAbsoluteValue(registerY));
            break;
        case INST_BBS3_BP:
            executeBbs(BIT3, getBasePageAddress((char) 0),
                    getRelativeAddress());
            break;
        case INST_CPY_IMM:
            executeCmp(registerY, getImmediateValue());
            break;
        case INST_CMP_IND_X:
            executeCmp(registerA, getIndexedIndirectValue());
            break;
        case INST_CPZ_IMM:
            executeCmp(registerZ, getImmediateValue());
            break;
        case INST_DEW_BP:
            executeDew(getBasePageAddress((char) 0));
            break;
        case INST_CPY_BP:
            executeCmp(registerY, getBasePageValue((char) 0));
            break;
        case INST_CMP_BP:
            executeCmp(registerA, getBasePageValue((char) 0));
            break;
        case INST_DEC_BP:
            executeDecP(getBasePageAddress((char) 0));
            break;
        case INST_SMB4_BP:
            if (enableMos65ce02) {
                executeSmb(getBasePageAddress((char) 0), BIT4);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_INY:
            registerY = executeInc(registerY);
            break;
        case INST_CMP_IMM:
            executeCmp(registerA, getImmediateValue());
            break;
        case INST_DEX:
            registerX = executeDec(registerX);
            break;
        case INST_ASW_ABS:
            if (enableMos65ce02) {
                executeAsw(getAbsoluteAddress((char) 0));
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_CPY_ABS:
            executeCmp(registerY, getAbsoluteValue((char) 0));
            break;
        case INST_CMP_ABS:
            executeCmp(registerA, getAbsoluteValue((char) 0));
            break;
        case INST_DEC_ABS:
            executeDecP(getAbsoluteAddress((char) 0));
            break;
        case INST_BBS4_BP:
            executeBbs(BIT4, getBasePageAddress((char) 0),
                    getRelativeAddress());
            break;
        case INST_BNE_REL:
            executeBxx(0 == (registerP & P_Z), getRelativeAddress());
            break;
        case INST_CMP_IND_Y:
            executeCmp(registerA, getIndirectIndexedValue(registerY));
            break;
        case INST_CMP_IND_Z:
            executeCmp(registerA, getIndirectIndexedValue(registerZ));
            break;
        case INST_BNE_W_REL:
            executeBxx(0 == (registerP & P_Z), getWordRelativeAddress());
        case INST_CPZ_BP:
            executeCmp(registerZ, getBasePageValue((char) 0));
            break;
        case INST_CMP_BP_X:
            executeCmp(registerA, getBasePageValue(registerX));
            break;
        case INST_DEC_BP_X:
            executeDecP(getBasePageAddress(registerX));
            break;
        case INST_SMB5_BP:
            if (enableMos65ce02) {
                executeSmb(getBasePageAddress((char) 0), BIT5);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_CLD:
            resetStatus(P_D);
            break;
        case INST_CMP_ABS_Y:
            executeCmp(registerA, getAbsoluteValue(registerY));
            break;
        case INST_PHX:
            executePh(registerX);
            break;
        case INST_PHZ:
            executePh(registerZ);
            break;
        case INST_CPZ_ABS:
            if (enableMos65ce02) {
                executeCmp(registerZ, getAbsoluteValue((char) 0));
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_CMP_ABS_X:
            executeCmp(registerA, getAbsoluteValue(registerX));
            break;
        case INST_DEC_ABS_X:
            executeDecP(getAbsoluteAddress(registerX));
            break;
        case INST_BBS5_BP:
            if (enableMos65ce02) {
                executeBbs(BIT5, getBasePageAddress((char) 0),
                        getRelativeAddress());
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_CPX_IMM:
            executeCmp(registerX, getImmediateValue());
            break;
        case INST_SBC_IND_X:
            executeSbc(getIndexedIndirectValue());
            break;
        case INST_LDA_DSP_Y:
            registerA = executeLd(memory.readChar(
                    getStackPageIndirectIndexedAddress(registerY)));
            break;
        case INST_INW_BP:
            if (enableMos65ce02) {
                executeInw(getBasePageAddress((char) 0));
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_CPX_BP:
            executeCmp(registerX, getBasePageValue((char) 0));
            break;
        case INST_SBC_BP:
            executeSbc(getBasePageValue((char) 0));
            break;
        case INST_INC_BP:
            executeIncP(getBasePageAddress((char) 0));
            break;
        case INST_SMB6_BP:
            if (enableMos65ce02) {
                executeSmb(getBasePageAddress((char) 0), BIT6);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_INX:
            registerX = executeInc(registerX);
            break;
        case INST_SBC_IMM:
            executeSbc(getImmediateValue());
            break;
        case INST_NOP:
            break;
        case INST_ROW_ABS:
            if (enableMos65ce02) {
                executeRow(getAbsoluteAddress((char) 0));
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_CPX_ABS:
            executeCmp(registerX, getAbsoluteValue((char) 0));
            break;
        case INST_SBC_ABS:
            executeSbc(getAbsoluteValue((char) 0));
            break;
        case INST_INC_ABS:
            executeIncP(getAbsoluteAddress((char) 0));
            break;
        case INST_BBS6_BP:
            executeBbs(BIT6, getBasePageAddress((char) 0),
                    getRelativeAddress());
            break;
        case INST_BEQ_REL:
            executeBxx(0 != (registerP & P_Z), getRelativeAddress());
            break;
        case INST_SBC_IND_Y:
            executeSbc(getIndirectIndexedValue(registerY));
            break;
        case INST_SBC_IND_Z:
            executeSbc(getIndirectIndexedValue(registerZ));
            break;
        case INST_BEQ_W_REL:
            executeBxx(0 != (registerP & P_Z), getWordRelativeAddress());
            break;
        case INST_PHW_IMM_W:
            executePhw(getImmediateWordValue());
            break;
        case INST_SBC_BP_X:
            executeSbc(getBasePageValue(registerX));
            break;
        case INST_INC_BP_X:
            executeIncP(getBasePageAddress(registerX));
            break;
        case INST_SMB7_BP:
            if (enableMos65ce02) {
                executeSmb(getBasePageAddress((char) 0), BIT7);
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_SED:
            setStatus(P_D);
            break;
        case INST_SBC_ABS_Y:
            executeSbc(getAbsoluteValue(registerY));
            break;
        case INST_PLX:
            registerX = executePl();
            break;
        case INST_PLZ:
            if (enableMos65ce02) {
                registerZ = executePl();
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_PHW_ABS_W:
            if (enableMos65ce02) {
                executePhw((short) getWordAbsoluteAddress());
            } else {
                executeUnknown(inst);
            }
            break;
        case INST_SBC_ABS_X:
            executeSbc(getAbsoluteValue(registerX));
            break;
        case INST_INC_ABS_X:
            executeIncP(getAbsoluteAddress(registerX));
            break;
        case INST_BBS7_BP:
            if (enableMos65ce02) {
                executeBbs(BIT7, getBasePageAddress((char) 0),
                        getRelativeAddress());
            } else {
                executeUnknown(inst);
            }
            break;
        default: // all your cases are belong to us!
            Log.getLog().fatal("Cpu6502: should not be reached");
            break;
        }
    }
}
