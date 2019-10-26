
var assert = require('assert');
var fs = require('fs');

var disassembleZ80 = require("gen/common/cpu/disasmz80.js").disassembleZ80;

describe('Z80 disassembler', function() {
  it('Should work', function() {
    assert.deepEqual({line:"LD SP,$E800",nbytes:3,isaddr:true}, disassembleZ80(0, 0x31, 0x00, 0xe8, 0));
    assert.deepEqual({line:"DI",nbytes:1,isaddr:false}, disassembleZ80(0, 0xF3, 0, 0, 0));
    assert.deepEqual({line:"JP $0007",nbytes:3,isaddr:true}, disassembleZ80(0, 0xC3, 0x07, 0x00, 0));
    assert.deepEqual({line:"LD A,$01",nbytes:2,isaddr:false}, disassembleZ80(0, 0x3E, 0x01, 0, 0));
    assert.deepEqual({line:"LDIR",nbytes:2,isaddr:false}, disassembleZ80(0, 0xED, 0xB0, 0, 0));
    assert.deepEqual({line:"JR C,$0027",nbytes:2,isaddr:true}, disassembleZ80(0x4e, 0x38, 0xD7, 0, 0));
    assert.deepEqual({line:"XOR A",nbytes:1,isaddr:false}, disassembleZ80(0, 0xaf, 0, 0, 0));
    assert.deepEqual({line:"LD IX,$41E0",nbytes:4,isaddr:true}, disassembleZ80(0, 0xdd, 0x21, 0xe0, 0x41));
    assert.deepEqual({line:"PUSH IX",nbytes:2,isaddr:false}, disassembleZ80(0, 0xdd, 0xe5, 0, 0));
    assert.deepEqual({line:"LD C,(IX+$81)",nbytes:3,isaddr:false}, disassembleZ80(0, 0xdd, 0x4e, 0x81, 0));
    assert.deepEqual({line:"LD E,(IY+$82)",nbytes:3,isaddr:false}, disassembleZ80(0, 0xfd, 0x5e, 0x82, 0));
    assert.deepEqual({line:"RES 4,(IX+$02)",nbytes:4,isaddr:false}, disassembleZ80(0, 0xdd, 0xcb, 0x02, 0xa6));
    assert.deepEqual({line:"RES 4,(IY+$02)",nbytes:4,isaddr:false}, disassembleZ80(0, 0xfd, 0xcb, 0x02, 0xa6));
  });
});
