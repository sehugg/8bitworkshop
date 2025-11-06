"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const assert_1 = __importDefault(require("assert"));
const assembler_1 = require("../worker/assembler");
(0, mocha_1.describe)('Assembler', function () {
    (0, mocha_1.describe)('Basic Assembly', function () {
        (0, mocha_1.it)('Should assemble simple 8-bit instructions', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {
                    reg: { bits: 3, toks: ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'] },
                    imm8: { bits: 8 }
                },
                rules: [
                    { fmt: 'nop', bits: ['00000000'] },
                    { fmt: 'mov ~reg,~reg', bits: ['10', 0, 1] },
                    { fmt: 'add ~reg,~imm8', bits: ['00001', 0, 1] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('nop');
            asm.assemble('mov r1,r2');
            asm.assemble('add r3,$42');
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 0, 'Should have no errors');
            assert_1.default.equal(state.output[0], 0x00, 'NOP should be 0x00');
            assert_1.default.equal(state.output[1], 0b10001010, 'MOV r1,r2');
            assert_1.default.equal(state.output[2], 0b00001011, 'ADD r3,imm first byte');
            assert_1.default.equal(state.output[3], 0x42, 'ADD r3,imm second bytes');
        });
        (0, mocha_1.it)('Should handle labels', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {
                    imm8: { bits: 8 }
                },
                rules: [
                    { fmt: 'jmp ~imm8', bits: ['11110000', 0] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('jmp target');
            asm.assemble('nop: jmp nop');
            asm.assemble('target: jmp target');
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 0, 'Should have no errors');
            assert_1.default.equal(state.output[0], 0xf0, 'JMP opcode');
            assert_1.default.equal(state.output[1], 4, 'Should jump to address 4');
            assert_1.default.equal(state.output[2], 0xf0, 'JMP opcode');
            assert_1.default.equal(state.output[3], 2, 'Should jump to itself (address 2)');
            assert_1.default.equal(state.output[4], 0xf0, 'JMP opcode');
            assert_1.default.equal(state.output[5], 4, 'Should jump to itself (address 4)');
        });
    });
    (0, mocha_1.describe)('PC-Relative Addressing', function () {
        (0, mocha_1.it)('Should handle simple PC-relative branches', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {
                    rel8: { bits: 8, iprel: true, ipofs: 0, ipmul: 1 }
                },
                rules: [
                    { fmt: 'br ~rel8', bits: ['10000000', 0] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('br forward'); // offset 0
            asm.assemble('br forward'); // offset 2
            asm.assemble('br forward'); // offset 4
            asm.assemble('forward: br forward'); // offset 6
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 0, 'Should have no errors');
            assert_1.default.equal(state.output[1], 6, 'First branch offset should be 6');
            assert_1.default.equal(state.output[3], 4, 'Second branch offset should be 4');
            assert_1.default.equal(state.output[5], 2, 'Third branch offset should be 2');
            assert_1.default.equal(state.output[7], 0, 'Fourth branch offset should be 0 (self)');
        });
        (0, mocha_1.it)('Should handle PC-relative with instruction multiplier', function () {
            // Simulate word-addressed architecture where PC increments by 4
            const spec = {
                name: 'test32',
                width: 32,
                vars: {
                    rel13: { bits: 13, iprel: true, ipofs: 0, ipmul: 4 }
                },
                rules: [
                    { fmt: 'beq ~rel13', bits: ['1100011000000000000', 0] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('beq target'); // offset 0
            asm.assemble('beq target'); // offset 4
            asm.assemble('target: beq target'); // offset 8
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 0, 'Should have no errors');
            // PC-relative offset = (target - current) * ipmul
            // First: (8 - 0) * 1 = 8
            // Second: (8 - 4) * 1 = 4
            // Third: (8 - 8) * 1 = 0
            const first = state.output[0];
            const second = state.output[1];
            const third = state.output[2];
            // Extract the 13-bit immediate from the instruction
            // It's in the lower 13 bits
            const offset1 = first & 0x1fff;
            const offset2 = second & 0x1fff;
            const offset3 = third & 0x1fff;
            assert_1.default.equal(offset1, 8, 'First branch offset should be 8');
            assert_1.default.equal(offset2, 4, 'Second branch offset should be 4');
            assert_1.default.equal(offset3, 0, 'Third branch offset should be 0');
        });
    });
    (0, mocha_1.describe)('Bit Slicing', function () {
        (0, mocha_1.it)('Should extract bit slices correctly', function () {
            // RISC-V style branch with scrambled immediate
            const spec = {
                name: 'riscv',
                width: 32,
                vars: {
                    reg: { bits: 5, toks: ['x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7'] },
                    rel13: { bits: 13, iprel: true, ipofs: 0, ipmul: 1 }
                },
                rules: [
                    // beq rs1, rs2, offset
                    // Format: imm[12] | imm[10:5] | rs2 | rs1 | 000 | imm[4:1] | imm[11] | 1100011
                    {
                        fmt: 'beq ~reg,~reg,~rel13',
                        bits: [
                            { a: 2, b: 12, n: 1 }, // imm[12]
                            { a: 2, b: 5, n: 6 }, // imm[10:5]
                            1, // rs2
                            0, // rs1
                            '000', // funct3
                            { a: 2, b: 1, n: 4 }, // imm[4:1]
                            { a: 2, b: 11, n: 1 }, // imm[11]
                            '1100011' // opcode
                        ]
                    }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('target: beq x1,x2,target'); // Self-branch with offset 0
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 0, 'Should have no errors');
            const insn = state.output[0];
            // Decode the instruction to verify bit positions
            const opcode = insn & 0x7f;
            const imm_11 = (insn >> 7) & 1;
            const imm_4_1 = (insn >> 8) & 0xf;
            const funct3 = (insn >> 12) & 0x7;
            const rs1 = (insn >> 15) & 0x1f;
            const rs2 = (insn >> 20) & 0x1f;
            const imm_10_5 = (insn >> 25) & 0x3f;
            const imm_12 = (insn >> 31) & 1;
            assert_1.default.equal(opcode, 0x63, 'Opcode should be 0x63 (branch)');
            assert_1.default.equal(funct3, 0, 'funct3 should be 0 (BEQ)');
            assert_1.default.equal(rs1, 1, 'rs1 should be 1 (x1)');
            assert_1.default.equal(rs2, 2, 'rs2 should be 2 (x2)');
            // All immediate bits should be 0 for self-branch
            assert_1.default.equal(imm_12, 0, 'imm[12] should be 0');
            assert_1.default.equal(imm_11, 0, 'imm[11] should be 0');
            assert_1.default.equal(imm_10_5, 0, 'imm[10:5] should be 0');
            assert_1.default.equal(imm_4_1, 0, 'imm[4:1] should be 0');
        });
        (0, mocha_1.it)('Should handle non-zero bit slice offsets', function () {
            const spec = {
                name: 'riscv',
                width: 32,
                vars: {
                    brop: { bits: 3, toks: ["beq", "bne", "bx2", "bx3", "blt", "bge", "bltu", "bgeu"] },
                    reg: { bits: 5, toks: ['x0', 'x1', 'x2'] },
                    rel13: { bits: 13, iprel: true, ipofs: 0, ipmul: 4 }
                },
                rules: [
                    {
                        fmt: '~brop ~reg,~reg,~rel13',
                        bits: [
                            { a: 3, b: 12, n: 1 },
                            { a: 3, b: 5, n: 6 },
                            2,
                            1,
                            '000',
                            { a: 3, b: 1, n: 4 },
                            { a: 3, b: 11, n: 1 },
                            '1100011'
                        ]
                    }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 4096');
            asm.assemble('.len 1024');
            asm.assemble('beq x1,x2,target'); // offset 0
            asm.assemble('beq x1,x2,target'); // offset 4
            asm.assemble('beq x1,x2,target'); // offset 8
            asm.assemble('target: beq x1,x2,target'); // offset 12 (self)
            asm.assemble('beq x1,x2,target'); // offset 16
            asm.assemble('beq x1,x2,target'); // offset 20
            /*
            00208663
            00208463
            00208263
            00208063
            fe208ee3
            fe208ce3
            */
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 0, 'Should have no errors');
            assert_1.default.equal(state.output[0], 0x208663, 'insn 0');
            assert_1.default.equal(state.output[1], 0x208463, 'insn 1');
            assert_1.default.equal(state.output[2], 0x208263, 'insn 2');
            assert_1.default.equal(state.output[3], 0x208063, 'insn 3');
            assert_1.default.equal(state.output[4], 0xfe208ee3 | 0, 'insn 4');
            assert_1.default.equal(state.output[5], 0xfe208ce3 | 0, 'insn 5');
            // Check that offset 12 was correctly calculated and sliced
            const insn0 = state.output[0];
            // Reconstruct the immediate from the instruction
            const imm_11 = (insn0 >> 7) & 1;
            const imm_4_1 = (insn0 >> 8) & 0xf;
            const imm_10_5 = (insn0 >> 25) & 0x3f;
            const imm_12 = (insn0 >> 31) & 1;
            //console.log('insn0: $', insn0.toString(16), 'imm_12:', imm_12, 'imm_11:', imm_11, 'imm_10_5:', imm_10_5, 'imm_4_1:', imm_4_1);
            // Reconstruct the 13-bit signed offset (bit 0 is implicit 0)
            const offset = (imm_12 << 12) | (imm_11 << 11) | (imm_10_5 << 5) | (imm_4_1 << 1);
            assert_1.default.equal(offset, 12, 'Offset should be 12 bytes');
        });
    });
    (0, mocha_1.describe)('Endianness', function () {
        (0, mocha_1.it)('Should handle little-endian values', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {
                    imm16: { bits: 16, endian: 'little' }
                },
                rules: [
                    { fmt: 'ldi ~imm16', bits: ['10000000', 0] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('ldi $1234');
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 0, 'Should have no errors');
            assert_1.default.equal(state.output[0], 0x80, 'Opcode');
            assert_1.default.equal(state.output[1], 0x34, 'Low byte first (little-endian)');
            assert_1.default.equal(state.output[2], 0x12, 'High byte second');
        });
        (0, mocha_1.it)('Should handle big-endian values', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {
                    imm16: { bits: 16, endian: 'big' }
                },
                rules: [
                    { fmt: 'ldi ~imm16', bits: ['10000000', 0] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('ldi $1234');
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 0, 'Should have no errors');
            assert_1.default.equal(state.output[0], 0x80, 'Opcode');
            assert_1.default.equal(state.output[1], 0x12, 'High byte first (big-endian)');
            assert_1.default.equal(state.output[2], 0x34, 'Low byte second');
        });
    });
    (0, mocha_1.describe)('Directives', function () {
        (0, mocha_1.it)('Should handle .org directive', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {},
                rules: [
                    { fmt: 'nop', bits: ['00000000'] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 100');
            asm.assemble('.len 256');
            asm.assemble('nop');
            const state = asm.finish();
            assert_1.default.equal(state.origin, 100, 'Origin should be 100');
            assert_1.default.equal(state.ip, 101, 'IP should be at 101');
            assert_1.default.equal(state.output[0], 0x00, 'NOP at origin');
        });
        (0, mocha_1.it)('Should handle .data directive', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {},
                rules: []
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('.data 10 20 $30');
            const state = asm.finish();
            assert_1.default.equal(state.output[0], 10);
            assert_1.default.equal(state.output[1], 20);
            assert_1.default.equal(state.output[2], 0x30);
        });
        (0, mocha_1.it)('Should handle .string directive', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {},
                rules: []
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('.string HELLO');
            const state = asm.finish();
            assert_1.default.equal(state.output[0], 'H'.charCodeAt(0));
            assert_1.default.equal(state.output[1], 'E'.charCodeAt(0));
            assert_1.default.equal(state.output[2], 'L'.charCodeAt(0));
            assert_1.default.equal(state.output[3], 'L'.charCodeAt(0));
            assert_1.default.equal(state.output[4], 'O'.charCodeAt(0));
        });
        (0, mocha_1.it)('Should handle .align directive', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {},
                rules: [
                    { fmt: 'nop', bits: ['00000000'] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('nop'); // offset 0
            asm.assemble('nop'); // offset 1
            asm.assemble('.align 4'); // align to 4
            asm.assemble('nop'); // offset 4
            const state = asm.finish();
            assert_1.default.equal(state.lines[2].offset, 4, 'Should align to offset 4');
        });
    });
    (0, mocha_1.describe)('Error Handling', function () {
        (0, mocha_1.it)('Should detect undefined labels', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {
                    imm8: { bits: 8 }
                },
                rules: [
                    { fmt: 'jmp ~imm8', bits: ['11110000', 0] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('jmp undefined_label');
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 1, 'Should have one error');
            (0, assert_1.default)(state.errors[0].msg.includes('undefined_label'), 'Error should mention undefined_label');
        });
        (0, mocha_1.it)('Should detect value overflow', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {
                    imm4: { bits: 4 }
                },
                rules: [
                    { fmt: 'mov ~imm4', bits: ['1111', 0] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('mov 20'); // 20 > 15 (max 4-bit value)
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 1, 'Should have one error');
            (0, assert_1.default)(state.errors[0].msg.includes('does not fit'), 'Error should mention overflow');
        });
        (0, mocha_1.it)('Should detect invalid instructions', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {},
                rules: [
                    { fmt: 'nop', bits: ['00000000'] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('invalid_instruction');
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 1, 'Should have one error');
            (0, assert_1.default)(state.errors[0].msg.includes('Could not decode'), 'Error should mention decode failure');
        });
    });
    (0, mocha_1.describe)('32-bit Width', function () {
        (0, mocha_1.it)('Should handle 32-bit instructions', function () {
            const spec = {
                name: 'test32',
                width: 32,
                vars: {
                    reg: { bits: 5, toks: ['r0', 'r1', 'r2', 'r3', 'r4'] },
                    imm12: { bits: 12 }
                },
                rules: [
                    // RISC-V ADDI format: imm[11:0] | rs1 | 000 | rd | 0010011
                    {
                        fmt: 'addi ~reg,~reg,~imm12',
                        bits: [2, 1, '000', 0, '0010011']
                    }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('addi r1,r2,$123');
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 0, 'Should have no errors');
            const insn = state.output[0];
            const opcode = insn & 0x7f;
            const rd = (insn >> 7) & 0x1f;
            const funct3 = (insn >> 12) & 0x7;
            const rs1 = (insn >> 15) & 0x1f;
            const imm = (insn >> 20) & 0xfff;
            assert_1.default.equal(opcode, 0x13, 'Opcode should be 0x13 (OP-IMM)');
            assert_1.default.equal(rd, 1, 'rd should be 1');
            assert_1.default.equal(rs1, 2, 'rs1 should be 2');
            assert_1.default.equal(funct3, 0, 'funct3 should be 0 (ADDI)');
            assert_1.default.equal(imm, 0x123, 'Immediate should be 0x123');
        });
    });
    (0, mocha_1.describe)('Symbol Definition', function () {
        (0, mocha_1.it)('Should allow symbol definition with .define', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {
                    imm8: { bits: 8 }
                },
                rules: [
                    { fmt: 'ldi ~imm8', bits: ['10000000', 0] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('.define MYCONST 42');
            asm.assemble('ldi MYCONST');
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 0, 'Should have no errors');
            assert_1.default.equal(state.output[1], 42, 'Should use defined constant');
        });
    });
    (0, mocha_1.describe)('Complex Fixups', function () {
        (0, mocha_1.it)('Should handle multiple fixups to same location', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {
                    imm8: { bits: 8 }
                },
                rules: [
                    { fmt: 'jmp ~imm8', bits: ['11110000', 0] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('jmp target');
            asm.assemble('jmp target');
            asm.assemble('target: jmp target');
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 0, 'Should have no errors');
            assert_1.default.equal(state.output[1], 4, 'First jump to target');
            assert_1.default.equal(state.output[3], 4, 'Second jump to target');
            assert_1.default.equal(state.output[5], 4, 'Third jump to itself');
        });
        (0, mocha_1.it)('Should handle backward references', function () {
            const spec = {
                name: 'test8',
                width: 8,
                vars: {
                    rel8: { bits: 8, iprel: true, ipofs: 0, ipmul: 1 }
                },
                rules: [
                    { fmt: 'br ~rel8', bits: ['10000000', 0] }
                ]
            };
            const asm = new assembler_1.Assembler(spec);
            asm.assemble('.org 0');
            asm.assemble('.len 256');
            asm.assemble('start: br forward'); // offset 0
            asm.assemble('br start'); // offset 2 (backward)
            asm.assemble('forward: br start'); // offset 4 (backward)
            const state = asm.finish();
            assert_1.default.equal(state.errors.length, 0, 'Should have no errors');
            assert_1.default.equal(state.output[1], 4, 'Forward branch');
            // Backward branches: offset = target - current
            // For offset 2: target=0, current=2, offset=-2 (0xfe in 8-bit signed)
            assert_1.default.equal(state.output[3] & 0xff, 0xfe, 'Backward branch from offset 2');
            // For offset 4: target=0, current=4, offset=-4 (0xfc in 8-bit signed)
            assert_1.default.equal(state.output[5] & 0xff, 0xfc, 'Backward branch from offset 4');
        });
    });
});
//# sourceMappingURL=testassembler.js.map