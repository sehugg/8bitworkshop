import assert from "assert";
import { describe, it } from "mocha";
import {
  getDirectColorChannels, encodeDirectColorWord, decodeDirectColorWord,
  convertPaletteFormat, getPaletteLength
} from "../../src/ide/pixeleditor";

describe('Direct-color palette formats', function () {

  it('should describe channel layout for pal:444', function () {
    assert.deepEqual(getDirectColorChannels({ pal: 444 }),
      { r: 4, g: 4, b: 4, rshift: 0, gshift: 4, bshift: 8 });
  });

  it('should describe channel layout for pal:332', function () {
    assert.deepEqual(getDirectColorChannels({ pal: 332 }),
      { r: 3, g: 3, b: 2, rshift: 0, gshift: 3, bshift: 6 });
  });

  it('should return null for indexed palettes and non-numeric formats', function () {
    assert.equal(getDirectColorChannels({ pal: "nes" }), null);
    assert.equal(getDirectColorChannels({ pal: "pacman" }), null);
    assert.equal(getDirectColorChannels({}), null);
  });

  it('should pack and unpack channel values', function () {
    var word = encodeDirectColorWord({ pal: 444 }, 0xF, 0x0, 0xA);
    assert.equal(word, 0xA0F);
    assert.deepEqual(decodeDirectColorWord({ pal: 444 }, word), { r: 0xF, g: 0x0, b: 0xA });
  });

  it('should round-trip every color in a pal:444 palette', function () {
    var words = getPaletteLength({ pal: 444 });
    assert.equal(words, 4096);
    for (var i = 0; i < words; i++) {
      var c = decodeDirectColorWord({ pal: 444 }, i);
      assert.equal(encodeDirectColorWord({ pal: 444 }, c.r, c.g, c.b), i);
    }
  });

  it('should match convertPaletteFormat for encoded words', function () {
    var word = encodeDirectColorWord({ pal: 444 }, 0xF, 0x0, 0xA);
    assert.equal(convertPaletteFormat([word], { pal: 444 })[0] >>> 0, 0xffa000f0);
  });

  it('should round-trip a pal:332 word', function () {
    var word = encodeDirectColorWord({ pal: 332 }, 5, 3, 2);
    var c = decodeDirectColorWord({ pal: 332 }, word);
    assert.deepEqual(c, { r: 5, g: 3, b: 2 });
  });

});
