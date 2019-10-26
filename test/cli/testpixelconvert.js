
var assert = require('assert');
var pixed = require("gen/ide/pixeleditor.js");

function dumbEqual(a,b) {
  if (a instanceof Uint32Array || a instanceof Uint8Array) {
    a = Array.from(a);
  }
  return assert.deepEqual(a,b);
}

describe('Pixel editor', function() {
  it('Should decode', function() {

    var fmt = {w:14,h:16,bpp:4,brev:1};
    var palfmt = {pal:332,n:16};

    var paldatastr =  " 0x00, 0x03, 0x19, 0x50, 0x52, 0x07, 0x1f, 0x37, 0xe0, 0xa4, 0xfd, 0xff, 0x38, 0x70, 0x7f, 0x7f, "; // test two entries the same
    var node4 = new pixed.TextDataNode(null, null, null, 0, paldatastr.length);
    node4.text = paldatastr;
    var node5 = new pixed.PaletteFormatToRGB(palfmt);
    node4.addRight(node5);
    node4.refreshRight();

    var expectedPalette = [0xff000000,
      0xff000060,
      0xff006020,
      0xff404000,
      0xff404040,
      0xff0000e0,
      0xff0060e0,
      0xff00c0e0,
      0xffc08000,
      0xff808080,
      0xffc0e0a0,
      0xffc0e0e0,
      0xff00e000,
      0xff40c000,
      0xff40e0e0,
      0xff40e0e1,
    ];
    dumbEqual(node5.palette, expectedPalette);
    
    var ctx = {
      getPalettes: function(ncolors) {
        assert.equal(ncolors, node5.palette.length);
        return [{palette:node5.palette}];
      }
    };

    var datastr = "1,2, 0x00,0x00,0xef,0xef,0xe0,0x00,0x00, 0x00,0xee,0xee,0xfe,0xee,0xe0,0x00, 0x0e,0xed,0xef,0xef,0xed,0xee,0x00, 0x0e,0xee,0xdd,0xdd,0xde,0xee,0x00, 0x0e,0xee,0xed,0xde,0xee,0xee,0x00, 0x00,0xee,0xee,0xde,0xee,0xe0,0x00, 0x00,0xee,0xee,0xde,0xee,0xe0,0x00, 0x00,0x00,0xed,0xdd,0xe0,0x00,0x0d, 0xdd,0xdd,0xee,0xee,0xed,0xdd,0xd0, 0x0d,0xee,0xee,0xee,0xee,0xee,0x00, 0x0e,0xe0,0xee,0xee,0xe0,0xee,0x00, 0x0e,0xe0,0xee,0xee,0xe0,0xee,0x00, 0x0e,0xe0,0xdd,0xdd,0xd0,0xde,0x00, 0x0d,0x00,0xee,0x0e,0xe0,0x0d,0x00, 0x00,0x00,0xed,0x0e,0xe0,0x00,0x00, 0x00,0x0d,0xdd,0x0d,0xdd,0x00,0x18,";
    var node1 = new pixed.TextDataNode(null, null, null, 0, datastr.length);
    node1.text = datastr;
    var node2 = new pixed.Mapper(fmt);
    node1.addRight(node2);
    var node3 = new pixed.Palettizer(ctx, fmt);
    node2.addRight(node3);
    node1.refreshRight();
    dumbEqual(node3.palette, expectedPalette);

    dumbEqual(node2.images[0], [0,0,0,0,14,15,14,15,14,0,0,0,0,0,0,0,14,14,14,14,15,14,14,14,14,0,0,0,0,14,14,13,14,15,14,15,14,13,14,14,0,0,0,14,14,14,13,13,13,13,13,14,14,14,0,0,0,14,14,14,14,13,13,14,14,14,14,14,0,0,0,0,14,14,14,14,13,14,14,14,14,0,0,0,0,0,14,14,14,14,13,14,14,14,14,0,0,0,0,0,0,0,14,13,13,13,14,0,0,0,0,13,13,13,13,13,14,14,14,14,14,13,13,13,13,0,0,13,14,14,14,14,14,14,14,14,14,14,0,0,0,14,14,0,14,14,14,14,14,0,14,14,0,0,0,14,14,0,14,14,14,14,14,0,14,14,0,0,0,14,14,0,13,13,13,13,13,0,13,14,0,0,0,13,0,0,14,14,0,14,14,0,0,13,0,0,0,0,0,0,14,13,0,14,14,0,0,0,0,0,0,0,0,13,13,13,0,13,13,13,0,0,1,8]);
    assert.equal(" 0x00, 0x03, 0x19, 0x50, 0x52, 0x07, 0x1F, 0x37, 0xE0, 0xA4, 0xFD, 0xFF, 0x38, 0x70, 0x7F, 0x7F, ",
      pixed.replaceHexWords(paldatastr, pixed.parseHexWords(paldatastr)));
    node3.refreshLeft();
    dumbEqual(node2.images[0], [0,0,0,0,14,15,14,15,14,0,0,0,0,0,0,0,14,14,14,14,15,14,14,14,14,0,0,0,0,14,14,13,14,15,14,15,14,13,14,14,0,0,0,14,14,14,13,13,13,13,13,14,14,14,0,0,0,14,14,14,14,13,13,14,14,14,14,14,0,0,0,0,14,14,14,14,13,14,14,14,14,0,0,0,0,0,14,14,14,14,13,14,14,14,14,0,0,0,0,0,0,0,14,13,13,13,14,0,0,0,0,13,13,13,13,13,14,14,14,14,14,13,13,13,13,0,0,13,14,14,14,14,14,14,14,14,14,14,0,0,0,14,14,0,14,14,14,14,14,0,14,14,0,0,0,14,14,0,14,14,14,14,14,0,14,14,0,0,0,14,14,0,13,13,13,13,13,0,13,14,0,0,0,13,0,0,14,14,0,14,14,0,0,13,0,0,0,0,0,0,14,13,0,14,14,0,0,0,0,0,0,0,0,13,13,13,0,13,13,13,0,0,1,8]);
    
    var datastr2 = "const char PALETTE[32] = { \n  0x03,			// screen color\n\n  0x11,0x30,0x27,0x0,	// background palette 0\n  0x1c,0x20,0x2c,0x0,	// background palette 1\n};";
    var words2 = pixed.parseHexWords(datastr2);
    dumbEqual(words2, [0x03,0x11,0x30,0x27,0x00,0x1c,0x20,0x2c,0x00]);

    // test verilog
    var datastr3 = "      7'o00: bits = 5'b11111; ";
    var words3 = pixed.parseHexWords(datastr3);
    dumbEqual(words3, [31]);
    assert.equal(datastr3, pixed.replaceHexWords(datastr3, pixed.parseHexWords(datastr3)));
    // TODO: test (nplanes > 0 && fmt.sl)

    // test comments
    var datastr4 = "        .byte #%01111110;$7E \n .byte #%01111111;$7F";
    var words4 = pixed.parseHexWords(datastr4);
    dumbEqual(words4, [0x7E,0x7F]);
    assert.notEqual(datastr4, pixed.replaceHexWords(datastr4, pixed.parseHexWords(datastr4))); // removed comment
  });
});
