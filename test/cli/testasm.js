
// not really femto8
var EXAMPLE_SPEC = {
  name:'femto8',
  vars:{
    reg:{bits:2, toks:['a', 'b', 'ip', 'none']},
    unop:{bits:3, toks:['mova','movb','inc','dec','asl','lsr','rol','ror']},
    binop:{bits:3, toks:['or','and','xor','zero','add','sub','adc','sbb']},
    imm4:{bits:4},
    imm8:{bits:8},
    rel:{bits:8, iprel:true, ipofs:1},
  },
  rules:[
    {fmt:'~binop ~reg,b', bits:['00',1,'1',0]},
    {fmt:'~binop ~reg,#~imm8', bits:['01',1,'1',0,2]},
    {fmt:'~binop ~reg,[b]', bits:['11',1,'1',0]},
    {fmt:'~unop ~reg', bits:['00',1,'0',0]},
    {fmt:'mov ~reg,[b]', bits:['11',0,'0001']},
    {fmt:'zero ~reg', bits:['00',0,'1011']},
    {fmt:'lda #~imm8', bits:['01','00','0001',0]},
    {fmt:'ldb #~imm8', bits:['01','01','0001',0]},
    {fmt:'jmp ~imm8',  bits:['01','10','0001',0]},
    {fmt:'sta ~imm4',  bits:['1001',0]},
    {fmt:'bcc ~imm8', bits:['1010','0001',0]},
    {fmt:'bcs ~imm8', bits:['1010','0011',0]},
    {fmt:'bz ~imm8',  bits:['1010','1100',0]},
    {fmt:'bnz ~imm8', bits:['1010','0100',0]},
    {fmt:'clc', bits:['10001000']},
    {fmt:'swapab', bits:['10000001']},
    {fmt:'reset', bits:['10001111']},
  ]
}

var BEAKER8_SPEC = {
  "name": "Beaker8",
  "width": 8,
  "vars": {
    "cb": { "bits": 3, "toks": ["0", "1", "2", "4", "8", "10", "♦", "255"]},
    "cv": { "bits": 3, "toks": ["0", "1", "2", "3", "4", "5", "6", "♦"]},
    "cond": { "bits": 3, "toks": ["♦", "♦", ".z", ".nz", ".c", ".nc", ".s", ".ns"] },
    "ic": { "bits": 3 },
    "abs8": { "bits": 8 },
    "abs16": { "bits": 16, "endian": "little" },
    "rel8": { "bits": 8, "iprel": true, "ipofs": 2 }
  },
  "rules": [
    { "fmt": "const.~cb",              "bits": ["00000", 0] },
    { "fmt": "const.b.~cb",            "bits": ["00000", 0] },
    { "fmt": "const ~abs8",            "bits": ["00000110", 0] },
    { "fmt": "const.b ~abs8",          "bits": ["00000110", 0] },
    { "fmt": "const.b ~abs8",          "bits": ["00000110", 0] },
    { "fmt": "const.w.~cb",            "bits": ["00001", 0] },
    { "fmt": "const.w ~abs16",	       "bits": ["00001110", 0] },
    { "fmt": "peek.~cv",	       "bits": ["00010", 0] },
    { "fmt": "peek.b.~cv",	       "bits": ["00010", 0] },
    { "fmt": "peek ~abs8",	       "bits": ["00010111", 0] },
    { "fmt": "peek.b ~abs8",	       "bits": ["00010111", 0] },
    { "fmt": "peek.w.~cv",	       "bits": ["00011", 0] },
    { "fmt": "peek.w ~abs8",	       "bits": ["00011111", 0] },
    { "fmt": "drop.~cv",	       "bits": ["00101", 0] },
    { "fmt": "drop ~abs8",	       "bits": ["00101111", 0] },
    { "fmt": "send",     	       "bits": ["00101000"] },
    { "fmt": "send.b",     	       "bits": ["00101000"] },
    { "fmt": "send ~abs8",  	       "bits": ["00101001", 0] },
    { "fmt": "send.b ~abs8",  	       "bits": ["00101001", 0] },
    { "fmt": "send.~cb ~abs8",         "bits": ["00000", 0, "00101001", 0] },
    { "fmt": "send.b.~cb ~abs8",       "bits": ["00000", 0, "00101001", 0] },
    { "fmt": "send ~abs8, ~abs8",      "bits": ["00000110", 0, "00101001", 0] },
    { "fmt": "send.b ~abs8, ~abs8",    "bits": ["00000110", 0, "00101001", 0] },
    { "fmt": "receive",     	       "bits": ["00101010"] },
    { "fmt": "receive.b",     	       "bits": ["00101010"] },
    { "fmt": "receive.b ~abs8",        "bits": ["00101011", 0] },
    { "fmt": "copy",                   "bits": ["00101100"] },
    { "fmt": "copy.b",                 "bits": ["00101100"] },
    { "fmt": "copy.inc",               "bits": ["00101110"] },
    { "fmt": "copy.b.inc",             "bits": ["00101110"] },
    { "fmt": "copy.dec",               "bits": ["00101111"] },
    { "fmt": "copy.b.dec",             "bits": ["00101111"] },
    { "fmt": "read",                   "bits": ["00110000"] },
    { "fmt": "read.b",                 "bits": ["00110000"] },
    { "fmt": "read ~abs16",            "bits": ["00110001", 0] },
    { "fmt": "read.b ~abs16",          "bits": ["00110001", 0] },
    { "fmt": "read.inc",               "bits": ["00110010"] },
    { "fmt": "read.b.inc",             "bits": ["00110010"] },
    { "fmt": "read.dec",               "bits": ["00110011"] },
    { "fmt": "read.b.dec",             "bits": ["00110011"] },
    { "fmt": "write",                  "bits": ["00110100"] },
    { "fmt": "write.b",                "bits": ["00110100"] },
    { "fmt": "write ~abs16",           "bits": ["00110101", 0] },
    { "fmt": "write.b ~abs16",         "bits": ["00110101", 0] },
    { "fmt": "write.inc",              "bits": ["00110110"] },
    { "fmt": "write.b.inc",            "bits": ["00110110"] },
    { "fmt": "write.dec",              "bits": ["00110111"] },
    { "fmt": "write.b.dec",            "bits": ["00110111"] },
    { "fmt": "read.w",                 "bits": ["00111000"] },
    { "fmt": "read.w ~abs16",          "bits": ["00111001", 0] },
    { "fmt": "read.w.inc",             "bits": ["00111010"] },
    { "fmt": "read.w.dec",             "bits": ["00111011"] },
    { "fmt": "write.w",                "bits": ["00111100"] },
    { "fmt": "write.w ~abs16",         "bits": ["00111101", 0] },
    { "fmt": "write.w.inc",            "bits": ["00111110"] },
    { "fmt": "write.w.dec",            "bits": ["00111111"] },
    { "fmt": "nop",                    "bits": ["11100000"] },
    { "fmt": "halt",                   "bits": ["11100001"] },
    { "fmt": "break",                  "bits": ["11100010"] },
    { "fmt": "di",                     "bits": ["11100100"] },
    { "fmt": "ei",                     "bits": ["11100101"] },
    { "fmt": "jump",                   "bits": ["11101000"] },
    { "fmt": "jump ~abs16",            "bits": ["11101001", 0] },
    { "fmt": "call",                   "bits": ["11101010"] },
    { "fmt": "call ~abs16",            "bits": ["11101011", 0] },
    { "fmt": "read.pc",		       "bits": ["11101100"] },
    { "fmt": "djr.nz ~abs8",	       "bits": ["11101110"] },
    { "fmt": "djr.b.nz ~abs8",	       "bits": ["11101110"] },
    { "fmt": "djr.w.nz ~abs8",	       "bits": ["11101111"] },
    { "fmt": "jr", 	               "bits": ["11110000"] },
    { "fmt": "jr~cond", 	       "bits": ["11110", 0] },
    { "fmt": "ret", 	               "bits": ["11111000"] },
    { "fmt": "ret~cond", 	       "bits": ["11111", 0] }
  ]
};

var vm = require('vm');
var fs = require('fs');
var assert = require('assert');
var includeInThisContext = function(path) {
    var code = fs.readFileSync(path);
    vm.runInThisContext(code, path);
};

var femto8_spec = JSON.parse(fs.readFileSync('presets/verilog/femto8.json'));
var femto16_spec = JSON.parse(fs.readFileSync('presets/verilog/femto16.json'));
var riscv_spec = JSON.parse(fs.readFileSync('presets/verilog/riscv.json'));


var assembler = require("gen/worker/assembler.js");

describe('Assemble', function() {
  it('Should assemble femto8', function() {
      let source = `.arch femto8
.org 128
.len 128

.define VPU_LO 8
.define VPU_HI 9
.define VPU_WRITE 10
.define VPU_MOVE 11
.define IN_FLAGS $42
.define F_VSYNC 16

Start:
       	zero	A    ; comment
        sta	VPU_LO
        sta    VPU_HI
        sta	0

DisplayLoop:zero	B
        mov	A,[b]
        sta	VPU_WRITE
        sta	VPU_MOVE
        lda	#F_VSYNC
      	ldb	#IN_FLAGS
        and	none,[B]
        bz	DisplayLoop
WaitVsync:
        and	none,[B]
        bnz	WaitVsync
      	zero B
        mov	A,[b]
        inc	A
        sta	0
	      jmp	DisplayLoop
`;
    let asm = new assembler.Assembler(EXAMPLE_SPEC);
    let result = asm.assembleFile(source);
    //console.log(result);
    //assert.equal(result, {});
    assert.equal(128, result.origin);
    assert.equal(152, result.ip);
    assert.deepEqual([], result.errors);
    assert.deepEqual({
            insns: "0B",
            line: 13,
            nbits: 8,
            offset: 128
          }, result.lines[0]);
    assert.deepEqual(
   [ { line: 13, offset: 128, nbits: 8, insns: '0B' },
     { line: 14, offset: 129, nbits: 8, insns: '98' },
     { line: 15, offset: 130, nbits: 8, insns: '99' },
     { line: 16, offset: 131, nbits: 8, insns: '90' },
     { line: 18, offset: 132, nbits: 8, insns: '1B' },
     { line: 19, offset: 133, nbits: 8, insns: 'C1' },
     { line: 20, offset: 134, nbits: 8, insns: '9A' },
     { line: 21, offset: 135, nbits: 8, insns: '9B' },
     { line: 22, offset: 136, nbits: 16, insns: '41 10' },
     { line: 23, offset: 138, nbits: 16, insns: '51 42' },
     { line: 24, offset: 140, nbits: 8, insns: 'F9' },
     { line: 25, offset: 141, nbits: 16, insns: 'AC 84' },
     { line: 27, offset: 143, nbits: 8, insns: 'F9' },
     { line: 28, offset: 144, nbits: 16, insns: 'A4 8F' },
     { line: 29, offset: 146, nbits: 8, insns: '1B' },
     { line: 30, offset: 147, nbits: 8, insns: 'C1' },
     { line: 31, offset: 148, nbits: 8, insns: '02' },
     { line: 32, offset: 149, nbits: 8, insns: '90' },
     { line: 33, offset: 150, nbits: 16, insns: '61 84' },
   ], result.lines);
   assert.equal(11, result.output[0]);
   assert.equal(128, result.output.length);
  });

  it('Should fail', function() {
    let source = `.arch femto8
    zero C
`;
    let asm = new assembler.Assembler(EXAMPLE_SPEC);
    let result = asm.assembleFile(source);
    assert.deepEqual(
      [ { msg: "Can't use 'c' here, only one of: a, b, ip, none", line: 2 } ],
      result.errors);
  });

  it('Should assemble femto16', function() {
    let source = `
    .arch femto16
    .org 0x8000
    .len 256
          mov	sp,@$6fff
          mov	dx,@Fib
          jsr	dx
          reset
    Fib:
          mov	ax,#1
          mov	bx,#0
    Loop:
          mov	cx,ax
          add	ax,bx
          mov	bx,cx
          push	ax
          pop	ax
          mov	[42],ax
          mov	ax,[42]
          bcc	Loop
          rts    
`;
    let asm = new assembler.Assembler(femto16_spec);
    let result = asm.assembleFile(source);
    assert.deepEqual([], result.errors);
    assert.deepEqual(result.lines, [
      { line: 5, offset: 32768, nbits: 32, insns: '1E58 6FFF' },
      { line: 6, offset: 32770, nbits: 32, insns: '1B58 8006' },
      { line: 7, offset: 32772, nbits: 16, insns: '771E' },
      { line: 8, offset: 32773, nbits: 16, insns: 'B8FF' },
      { line: 10, offset: 32774, nbits: 16, insns: 'D801' },
      { line: 11, offset: 32775, nbits: 16, insns: 'D900' },
      { line: 13, offset: 32776, nbits: 16, insns: '0258' },
      { line: 14, offset: 32777, nbits: 16, insns: '0061' },
      { line: 15, offset: 32778, nbits: 16, insns: '015A' },
      { line: 16, offset: 32779, nbits: 16, insns: '5006' },
      { line: 17, offset: 32780, nbits: 16, insns: '480E' },
      { line: 18, offset: 32781, nbits: 16, insns: '302A' },
      { line: 19, offset: 32782, nbits: 16, insns: '282A' },
      { line: 20, offset: 32783, nbits: 16, insns: '81F8' },
      { line: 21, offset: 32784, nbits: 16, insns: '4F0E' }
    ]);
  });

  it('Should assemble riscv', function() {
    let source = `
    .arch riscv
    .org 0
    .len 2048
    .width 32
    FOO:
          add x1,x2,x2
          sub x3,x0,x2
          xor x4,x3,x2
          addi x5,x4,1234
          beq x10,x11,FOO3
    ;     .data 0x7cb504e3
    FOO3:
          beq x10,x11,FOO   ;7CB504E3
    FOO2:
          lw x6,12(x6)
          sb x7,64(x6)
          sh x7,68(x7)
          sw x7,72(x7)
          lui x12,12    
`;
    let asm = new assembler.Assembler(riscv_spec);
    let result = asm.assembleFile(source);
    assert.deepEqual([], result.errors);
    assert.deepEqual(result.lines, [
        { line: 7, offset: 0, nbits: 32, insns: '002100B3' },
        { line: 8, offset: 1, nbits: 32, insns: '402001B3' },
        { line: 9, offset: 2, nbits: 32, insns: '0021C233' },
        { line: 10, offset: 3, nbits: 32, insns: '4D220293' },
        { line: 11, offset: 4, nbits: 32, insns: '00B50263' },
        { line: 14, offset: 5, nbits: 32, insns: 'FEB506E3' },
        { line: 16, offset: 6, nbits: 32, insns: '00C32303' },
        { line: 17, offset: 7, nbits: 32, insns: '04638023' },
        { line: 18, offset: 8, nbits: 32, insns: '04739223' },
        { line: 19, offset: 9, nbits: 32, insns: '0473A423' },
        { line: 20, offset: 10, nbits: 32, insns: '0000C637' }
    ]);
  });

  it('Should assemble multiword little endian constants', function() {
    let source = `
.arch   Beaker8
.org    0
.len    0x4000

.define vramWrite $00
.define vramRead $01

.define	vdpReg0 $40
.define vdpReg1 $41
.define vdpReg2 $42
      
boot:   di
        jump Init

init:   call setTextMode
        halt
        
setTextMode:
        send vdpReg0, $14
        const.w $2000         ;// length
        const.w.0             ;// address
        const.w init          ;// symbol
        call clrVram
        ret
clrVram:       
        send vdpReg1
        send vdpReg2

_loop:
        const.0
        send vramWrite
        djr.w.nz _loop
        ret 
`;
    let asm = new assembler.Assembler(BEAKER8_SPEC);
    let result = asm.assembleFile(source);
    assert.deepEqual([], result.errors);
    assert.deepEqual(result.lines, [
      { line: 13, offset: 0, nbits: 8, insns: 'E4' },
      { line: 14, offset: 1, nbits: 24, insns: 'E9 04 00' },
      { line: 16, offset: 4, nbits: 24, insns: 'EB 08 00' },
      { line: 17, offset: 7, nbits: 8, insns: 'E1' },
      { line: 20, offset: 8, nbits: 32, insns: '06 40 29 40' },
      { line: 21, offset: 12, nbits: 24, insns: '0E 00 20' },
      { line: 22, offset: 15, nbits: 8, insns: '08' },
      { line: 23, offset: 16, nbits: 24, insns: '0E 04 00' },
      { line: 24, offset: 19, nbits: 24, insns: 'EB 17 00' },
      { line: 25, offset: 22, nbits: 8, insns: 'F8' },
      { line: 27, offset: 23, nbits: 16, insns: '29 41' },
      { line: 28, offset: 25, nbits: 16, insns: '29 42' },
      { line: 31, offset: 27, nbits: 8, insns: '00' },
      { line: 32, offset: 28, nbits: 16, insns: '29 00' },
      { line: 33, offset: 30, nbits: 8, insns: 'EF' },
      { line: 34, offset: 31, nbits: 8, insns: 'F8' }
    ]);
  })

});
