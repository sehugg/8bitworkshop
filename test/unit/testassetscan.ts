
import assert from "assert";
import * as fs from "fs";
import { describe, it } from "mocha";
import {
  scanTextForAssetFragments, resolveEmbedPath, validateAssetByteLength,
  parseHexWords, validateAssetData, findNamedArray, validateCharpadFormat, renderCharpadMap
} from "../../src/ide/pixeleditor";

describe('Asset scanner', function () {

  it('should scan a plain C-style asset header', function () {
    var src = '/*{w:8,h:8,bpp:1}*/\nbyte tiles[] = {1,2,3};\n';
    var frags = scanTextForAssetFragments(src, false);
    assert.equal(frags.length, 1);
    assert.equal(frags[0].error, undefined);
    assert.deepEqual(frags[0].fmt, { w: 8, h: 8, bpp: 1 });
    assert.equal(frags[0].embedFile, undefined);
    assert.equal(src.substring(frags[0].start, frags[0].end), '\nbyte tiles[] = {1,2,3}');
  });

  it('should detect a C23 #embed directive inside the data block', function () {
    var src = '/*{w:12,h:21,bpp:2,brev:1,wpimg:64,aspect:2,count:1}*/\nbyte landerbody[] = {\n#embed "landerbody.bin"\n};\n';
    var frags = scanTextForAssetFragments(src, false);
    assert.equal(frags.length, 1);
    assert.equal(frags[0].error, undefined);
    assert.equal(frags[0].embedFile, 'landerbody.bin');
    assert.deepEqual(frags[0].fmt, { w: 12, h: 21, bpp: 2, brev: 1, wpimg: 64, aspect: 2, count: 1 });
  });

  it('should scan multiple independent asset headers in one file', function () {
    var src =
      '/*{pal:"c64"}*/\nconst byte pal[4] = {0,1,2,3};\n' +
      '/*{w:24,h:21,bpp:1,brev:1,wpimg:64,count:1}*/\nbyte outline[] = {\n#embed "outline.bin"\n};\n';
    var frags = scanTextForAssetFragments(src, false);
    assert.equal(frags.length, 2);
    assert.deepEqual(frags[0].fmt, { pal: "c64" });
    assert.equal(frags[0].embedFile, undefined);
    assert.deepEqual(frags[1].fmt, { w: 24, h: 21, bpp: 1, brev: 1, wpimg: 64, count: 1 });
    assert.equal(frags[1].embedFile, 'outline.bin');
  });

  it('should parse palette display names and bitmap palette references', function () {
    var src =
      '/*{pal:555,n:16,name:"Background"}*/\npalette_color_t bkg[1][4] = { 0x2062, 0x318E, 0x6A28, 0x7714 };\n' +
      '/*{w:8,h:8,bpp:1,np:2,pofs:1,sl:2,palname:"Background"}*/\nbyte tiles[] = { 0xff };\n';
    var frags = scanTextForAssetFragments(src, false);
    assert.equal(frags.length, 2);
    assert.deepEqual(frags[0].fmt, { pal: 555, n: 16, name: "Background" });
    assert.deepEqual(frags[1].fmt, { w: 8, h: 8, bpp: 1, np: 2, pofs: 1, sl: 2, palname: "Background" });
  });

  it('should report an error when no closing delimiter is found', function () {
    var src = '/*{w:8,h:8}*/\nbyte tiles[] = {1,2,3}\n'; // no trailing ;
    var frags = scanTextForAssetFragments(src, false);
    assert.equal(frags.length, 1);
    assert.ok(frags[0].error);
    assert.ok(/No closing/.test(frags[0].error));
  });

  it('should report an error on invalid JSON in the header', function () {
    var src = '/*{w:8,h:}*/\nbyte tiles[] = {1,2,3};\n';
    var frags = scanTextForAssetFragments(src, false);
    assert.equal(frags.length, 1);
    assert.ok(/Invalid asset format/.test(frags[0].error));
  });

  it('should use "end" as the closing delimiter for verilog', function () {
    var src = '/*{w:8,h:8}*/\n5\'h01;\nend\n';
    var frags = scanTextForAssetFragments(src, true);
    assert.equal(frags.length, 1);
    assert.equal(frags[0].error, undefined);
  });

});

describe('#embed path resolution', function () {
  it('should resolve a plain filename that exists in the project root', function () {
    var files: { [path: string]: boolean } = { 'main.c': true, 'data.bin': true };
    var exists = (p: string) => !!files[p];
    assert.equal(resolveEmbedPath('main.c', 'data.bin', exists), 'data.bin');
  });

  it("should resolve relative to the including file's directory", function () {
    var files: { [path: string]: boolean } = { 'sub/main.c': true, 'sub/data.bin': true };
    var exists = (p: string) => !!files[p];
    assert.equal(resolveEmbedPath('sub/main.c', 'data.bin', exists), 'sub/data.bin');
  });

  it('should return null when the file cannot be found', function () {
    var files: { [path: string]: boolean } = { 'main.c': true };
    var exists = (p: string) => !!files[p];
    assert.equal(resolveEmbedPath('main.c', 'missing.bin', exists), null);
  });
});

describe('Asset data literal radix prefixes', function () {

  it('should recognize every documented radix-prefixed form', function () {
    assert.deepEqual(
      parseHexWords("0x18, $3c, #$7e, %0101, 0b0101, 8'hff, 8'b1010"),
      [0x18, 0x3c, 0x7e, 5, 5, 0xff, 0x0a]);
  });

  it('should treat plain decimal literals as unmatched (no radix prefix)', function () {
    assert.deepEqual(parseHexWords('{24,60,126,255}'), []);
  });

  it('should report "found 0" for a decimal-only asset data block', function () {
    var src = '/*{w:8,h:8,bpp:1,count:1,brev:1}*/\nbyte tiles[] = {24,60,126,255,24,60,126,255};\n';
    var frags = scanTextForAssetFragments(src, false);
    assert.equal(frags.length, 1);
    assert.equal(frags[0].error, undefined);
    var err = validateAssetData(src.substring(frags[0].start, frags[0].end), frags[0].fmt);
    assert.equal(err, 'Expected 8 value(s), found 0');
  });

});

describe('validateAssetByteLength (for #embed binary files)', function () {
  it('should accept a C64 hires sprite (24x21 1bpp, 64-byte hw stride)', function () {
    var fmt = { w: 24, h: 21, bpp: 1, brev: 1, wpimg: 64, count: 1 };
    assert.equal(validateAssetByteLength(64, fmt), null);
  });

  it('should accept a C64 multicolor sprite (12x21 2bpp, 64-byte hw stride)', function () {
    var fmt = { w: 12, h: 21, bpp: 2, brev: 1, wpimg: 64, aspect: 2, count: 1 };
    assert.equal(validateAssetByteLength(64, fmt), null);
  });

  it('should scale required length with count', function () {
    var fmt = { w: 24, h: 21, bpp: 1, brev: 1, wpimg: 64, count: 3 };
    assert.equal(validateAssetByteLength(192, fmt), null);
  });

  it('should reject a mismatched byte length with a descriptive error', function () {
    var fmt = { w: 24, h: 21, bpp: 1, brev: 1, wpimg: 64, count: 1 };
    var err = validateAssetByteLength(63, fmt);
    assert.ok(err);
    assert.ok(/Expected 64 byte/.test(err));
  });

  it('should require at least 1 byte for a palette block', function () {
    assert.equal(validateAssetByteLength(4, { pal: "c64" }), null);
    assert.ok(validateAssetByteLength(0, { pal: "c64" }));
  });
});

describe('C64 level2-data.c preset', function () {
  it('should expose the multicolor charset as a valid bitmap asset', function () {
    var src = fs.readFileSync('presets/c64/level2-data.c', 'utf8');
    var frags = scanTextForAssetFragments(src, false);
    assert.equal(frags.length, 2); // charset bitmap + charpad map
    assert.equal(frags[0].error, undefined);
    assert.equal(validateAssetData(src.substring(frags[0].start, frags[0].end), frags[0].fmt), null);
  });
});

describe('CharPad tile maps', function () {
  const src = () => fs.readFileSync('presets/c64/level2-data.c', 'utf8');

  it('should find named arrays in C and asm source', function () {
    assert.deepEqual(findNamedArray('const byte a[2] = { 0x01, 0x02 /* x */ };\nbyte b[1]={0x03};', 'b'), [3]);
    assert.deepEqual(findNamedArray('a[2] = { // $99\n 0x01, 0x02 };', 'a'), [1, 2]);
    assert.deepEqual(findNamedArray('.global _t\n_t:\n.byte $01,$02 ; $ff\n_u:\n.byte $09\n', 't'), [1, 2]);
    assert.equal(findNamedArray('byte a[1]={1};', 'zzz'), null);
  });

  it('should accept lenient JSON keys containing digits', function () {
    var frags = scanTextForAssetFragments('/*{w:1,mc1:2,name:"x_y"}*/\nbyte a[1]={0x01};', false);
    assert.equal(frags[0].error, undefined);
    assert.deepEqual(frags[0].fmt, { w: 1, mc1: 2, name: 'x_y' });
  });

  it('should validate the level2 map and resolve its source arrays', function () {
    var frags = scanTextForAssetFragments(src(), false);
    assert.equal(frags.length, 2);
    var fmt = frags[1].fmt;
    assert.equal(fmt.map, 'charpad');
    assert.equal(validateAssetData(src().substring(frags[1].start, frags[1].end), fmt), null);
    assert.equal(validateCharpadFormat(fmt, (n) => findNamedArray(src(), n)), null);
    assert.ok(validateCharpadFormat(fmt, () => null));
  });

  it('should render a multicolor and a hires cell', function () {
    var fmt: any = { w: 2, h: 1, tw: 1, th: 1, chars: 'c', tiles: 't', colors: 'k', bg: 11, mca: 5, mcb: 6 };
    // char 0: row0 = 00 01 10 11 pixels; char 1: row0 = 10000001
    var chars = [0x1b, 0, 0, 0, 0, 0, 0, 0, 0x81, 0, 0, 0, 0, 0, 0, 0];
    var r = renderCharpadMap(fmt, [0, 1], chars, [0, 1], [8 | 2, 3]);
    assert.equal(r.width, 16);
    assert.equal(r.height, 8);
    assert.deepEqual(Array.from(r.pixels.slice(0, 16)), [11, 11, 5, 5, 6, 6, 2, 2, 3, 11, 11, 11, 11, 11, 11, 3]);
    assert.throws(() => renderCharpadMap(fmt, [0, 2], chars, [0, 1], [10, 3]), /out of range/);
  });
});
