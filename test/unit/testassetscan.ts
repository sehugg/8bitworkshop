
import assert from "assert";
import { describe, it } from "mocha";
import {
  scanTextForAssetFragments, resolveEmbedPath, validateAssetByteLength
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
