
var assert = require('assert');
var fs = require('fs');

var disassembleZ80 = require("gen/cpu/disasmz80.js").disassembleZ80;

describe('Z80 disassembler', function() {
  it('Should work', function() {
    assert.deepEqual({line:"LD SP,$E800",nbytes:3}, disassembleZ80(0, 0x31, 0x00, 0xe8, 0));
    assert.deepEqual({line:"DI",nbytes:1}, disassembleZ80(0, 0xF3, 0, 0, 0));
    assert.deepEqual({line:"JP $0007",nbytes:3}, disassembleZ80(0, 0xC3, 0x07, 0x00, 0));
    assert.deepEqual({line:"LD A,$01",nbytes:2}, disassembleZ80(0, 0x3E, 0x01, 0, 0));
    assert.deepEqual({line:"LDIR",nbytes:2}, disassembleZ80(0, 0xED, 0xB0, 0, 0));
    assert.deepEqual({line:"JR C,$0027",nbytes:2}, disassembleZ80(0x4e, 0x38, 0xD7, 0, 0));
    assert.deepEqual({line:"XOR A",nbytes:2}, disassembleZ80(0, 0xaf, 0xd3, 0, 0));
    assert.deepEqual({line:"LD IX,$41E0",nbytes:4}, disassembleZ80(0, 0xdd, 0x21, 0xe0, 0x41));
  });
});
