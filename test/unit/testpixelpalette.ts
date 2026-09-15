import assert from "assert";
import { describe, it } from "mocha";
import {
  getDirectColorChannels, encodeDirectColorWord, decodeDirectColorWord,
  convertPaletteFormat, getPaletteLength, Palettizer, SelectablePalette,
  disambiguatePaletteNames
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

describe('Palettizer preferred palette', function () {
  var palettes: SelectablePalette[] = [
    { node: null, name: "Background", palette: new Uint32Array([1, 2, 3, 4]) },
    { node: null, name: "Sprite", palette: new Uint32Array([5, 6, 7, 8]) },
  ];
  var context = {
    setCurrentEditor: () => {},
    getTilemaps: () => [],
    getPalettes: () => palettes,
  } as any;

  it('should default to the first palette when no name is given', function () {
    var p = new Palettizer(context, { w: 8, h: 8, bpp: 2 });
    p.updateRefs();
    assert.equal(p.palindex, 0);
    assert.deepEqual(Array.from(p.palette), [1, 2, 3, 4]);
  });

  it('should select the palette named by fmt.palname', function () {
    var p = new Palettizer(context, { w: 8, h: 8, bpp: 2, palname: "Sprite" });
    p.updateRefs();
    assert.equal(p.palindex, 1);
    assert.deepEqual(Array.from(p.palette), [5, 6, 7, 8]);
  });

  it('should fall back to the first palette when the name does not match', function () {
    var p = new Palettizer(context, { w: 8, h: 8, bpp: 2, palname: "Missing" });
    p.updateRefs();
    assert.equal(p.palindex, 0);
  });
});

describe('Palette name disambiguation', function () {
  function entry(name: string, group?: string): SelectablePalette {
    return { node: null, name, group, palette: new Uint32Array([0, 1, 2, 3]) };
  }

  it('should leave unique names alone', function () {
    var pals = [entry("Background"), entry("Sprite")];
    disambiguatePaletteNames(pals);
    assert.deepEqual(pals.map((p) => p.name), ["Background", "Sprite"]);
  });

  it('should prefix only the duplicated slice names with their owner', function () {
    var pals = [
      entry("Background 0", "Palette 1"),
      entry("Sprite 0", "Palette 1"),
      entry("Background 0", "Palette 2"),
      entry("Sprite 0", "Palette 2"),
    ];
    disambiguatePaletteNames(pals);
    assert.deepEqual(pals.map((p) => p.name), [
      "Palette 1: Background 0",
      "Palette 1: Sprite 0",
      "Palette 2: Background 0",
      "Palette 2: Sprite 0",
    ]);
  });

  it('should not prefix a unique name even if its owner is set', function () {
    var pals = [entry("Background 0", "Palette 1"), entry("Screen Color", "Palette 1")];
    disambiguatePaletteNames(pals);
    assert.deepEqual(pals.map((p) => p.name), ["Background 0", "Screen Color"]);
  });
});
