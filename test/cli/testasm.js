
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

var vm = require('vm');
var fs = require('fs');
var assert = require('assert');
var includeInThisContext = function(path) {
    var code = fs.readFileSync(path);
    vm.runInThisContext(code, path);
};

var assembler = require("gen/worker/assembler.js");

describe('Assemble', function() {
  it('Should assemble', function() {
      var source = `.arch femto8
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
    var asm = new assembler.Assembler(EXAMPLE_SPEC);
    var result = asm.assembleFile(source);
    //console.log(result);
    //assert.equal(result, {});
    assert.equal(128, result.origin);
    assert.equal(152, result.ip);
    console.log(result);
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
    var source = `.arch femto8
    zero C
`;
    var asm = new assembler.Assembler(EXAMPLE_SPEC);
    var result = asm.assembleFile(source);
    console.log(result);
    assert.deepEqual(
      [ { msg: "Can't use 'c' here, only one of: a, b, ip, none", line: 2 } ],
      result.errors);
  });
/*
  it('Should fail 2', function() {
    var source = `.arch femto8
    mov A, [b]
`;
    var asm = new assembler.Assembler(EXAMPLE_SPEC);
    var result = asm.assembleFile(source);
    console.log(result);
    assert.deepEqual(
      [ { msg: "Can't use 'c' here, only one of: a, b, ip, none", line: 2 } ],
      result.errors);
  });
*/
});
