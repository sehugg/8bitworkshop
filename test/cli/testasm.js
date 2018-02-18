
var vm = require('vm');
var fs = require('fs');
var assert = require('assert');
var includeInThisContext = function(path) {
    var code = fs.readFileSync(path);
    vm.runInThisContext(code, path);
};

includeInThisContext("src/worker/assembler.js");

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
       	zero	A
        sta	VPU_LO
        sta    VPU_HI
        sta	0
DisplayLoop:
      	zero	B
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
    var asm = new Assembler(EXAMPLE_SPEC);
    var result = asm.assembleFile(source);
    //console.log(result);
    //assert.equal(result, {});
    assert.equal(128, result.origin);
    assert.equal(152, result.ip);
    assert.deepEqual({
            insns: "0B",
            line: 13,
            nbits: 8,
            offset: 128
          }, result.asmlines[0]);
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
   ], result.asmlines);
   assert.equal(11, result.output[0]);
   assert.equal(128, result.output.length);
  });
});
