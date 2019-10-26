
var assert = require('assert');
var fs = require('fs');

var disassemble6502 = require("gen/common/cpu/disasm6502.js").disassemble6502;

describe('6502 disassembler', function() {
  it('Should work', function() {
    assert.deepEqual({line:"BRK ",nbytes:1,isaddr:false}, disassemble6502(0, 0, 0, 0));
    assert.deepEqual({line:"LDA #$A9",nbytes:2,isaddr:false}, disassemble6502(0, 0xa9, 0xa9, 0xa9));
    assert.deepEqual({line:"JMP $6010",nbytes:3,isaddr:true}, disassemble6502(0, 0x4c, 0x10, 0x60));
    assert.deepEqual({line:"BPL $FFF2",nbytes:2,isaddr:true}, disassemble6502(0, 0x10, 0xf0, 0));
    assert.deepEqual({line:"BMI $0012",nbytes:2,isaddr:true}, disassemble6502(0, 0x30, 0x10, 0));
  });
});
