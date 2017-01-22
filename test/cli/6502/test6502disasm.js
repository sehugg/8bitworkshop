
var assert = require('assert');
var vm = require('vm');
var fs = require('fs');
var includeInThisContext = function(path) {
    var code = fs.readFileSync(path);
    vm.runInThisContext(code, path);
};

includeInThisContext("src/disasm.js");

describe('6502 disassembler', function() {
  it('Should work', function() {
    assert.deepEqual({line:"BRK ",nbytes:1}, disassemble6502(0, 0, 0, 0));
    assert.deepEqual({line:"LDA #$A9",nbytes:2}, disassemble6502(0, 0xa9, 0xa9, 0xa9));
    assert.deepEqual({line:"JMP $6010",nbytes:3}, disassemble6502(0, 0x4c, 0x10, 0x60));
    assert.deepEqual({line:"BPL $FFF0",nbytes:2}, disassemble6502(0, 0x10, 0xf0, 0));
    assert.deepEqual({line:"BMI $0010",nbytes:2}, disassemble6502(0, 0x30, 0x10, 0));
  });
});
