"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const pixeleditor_1 = require("../../src/ide/pixeleditor");
(0, mocha_1.describe)('Asset scanner', function () {
    (0, mocha_1.it)('should scan a plain C-style asset header', function () {
        var src = '/*{w:8,h:8,bpp:1}*/\nbyte tiles[] = {1,2,3};\n';
        var frags = (0, pixeleditor_1.scanTextForAssetFragments)(src, false);
        assert_1.default.equal(frags.length, 1);
        assert_1.default.equal(frags[0].error, undefined);
        assert_1.default.deepEqual(frags[0].fmt, { w: 8, h: 8, bpp: 1 });
        assert_1.default.equal(frags[0].embedFile, undefined);
        assert_1.default.equal(src.substring(frags[0].start, frags[0].end), '\nbyte tiles[] = {1,2,3}');
    });
    (0, mocha_1.it)('should detect a C23 #embed directive inside the data block', function () {
        var src = '/*{w:12,h:21,bpp:2,brev:1,wpimg:64,aspect:2,count:1}*/\nbyte landerbody[] = {\n#embed "landerbody.bin"\n};\n';
        var frags = (0, pixeleditor_1.scanTextForAssetFragments)(src, false);
        assert_1.default.equal(frags.length, 1);
        assert_1.default.equal(frags[0].error, undefined);
        assert_1.default.equal(frags[0].embedFile, 'landerbody.bin');
        assert_1.default.deepEqual(frags[0].fmt, { w: 12, h: 21, bpp: 2, brev: 1, wpimg: 64, aspect: 2, count: 1 });
    });
    (0, mocha_1.it)('should scan multiple independent asset headers in one file', function () {
        var src = '/*{pal:"c64"}*/\nconst byte pal[4] = {0,1,2,3};\n' +
            '/*{w:24,h:21,bpp:1,brev:1,wpimg:64,count:1}*/\nbyte outline[] = {\n#embed "outline.bin"\n};\n';
        var frags = (0, pixeleditor_1.scanTextForAssetFragments)(src, false);
        assert_1.default.equal(frags.length, 2);
        assert_1.default.deepEqual(frags[0].fmt, { pal: "c64" });
        assert_1.default.equal(frags[0].embedFile, undefined);
        assert_1.default.deepEqual(frags[1].fmt, { w: 24, h: 21, bpp: 1, brev: 1, wpimg: 64, count: 1 });
        assert_1.default.equal(frags[1].embedFile, 'outline.bin');
    });
    (0, mocha_1.it)('should report an error when no closing delimiter is found', function () {
        var src = '/*{w:8,h:8}*/\nbyte tiles[] = {1,2,3}\n'; // no trailing ;
        var frags = (0, pixeleditor_1.scanTextForAssetFragments)(src, false);
        assert_1.default.equal(frags.length, 1);
        assert_1.default.ok(frags[0].error);
        assert_1.default.ok(/No closing/.test(frags[0].error));
    });
    (0, mocha_1.it)('should report an error on invalid JSON in the header', function () {
        var src = '/*{w:8,h:}*/\nbyte tiles[] = {1,2,3};\n';
        var frags = (0, pixeleditor_1.scanTextForAssetFragments)(src, false);
        assert_1.default.equal(frags.length, 1);
        assert_1.default.ok(/Invalid asset format/.test(frags[0].error));
    });
    (0, mocha_1.it)('should use "end" as the closing delimiter for verilog', function () {
        var src = '/*{w:8,h:8}*/\n5\'h01;\nend\n';
        var frags = (0, pixeleditor_1.scanTextForAssetFragments)(src, true);
        assert_1.default.equal(frags.length, 1);
        assert_1.default.equal(frags[0].error, undefined);
    });
});
(0, mocha_1.describe)('#embed path resolution', function () {
    (0, mocha_1.it)('should resolve a plain filename that exists in the project root', function () {
        var files = { 'main.c': true, 'data.bin': true };
        var exists = (p) => !!files[p];
        assert_1.default.equal((0, pixeleditor_1.resolveEmbedPath)('main.c', 'data.bin', exists), 'data.bin');
    });
    (0, mocha_1.it)("should resolve relative to the including file's directory", function () {
        var files = { 'sub/main.c': true, 'sub/data.bin': true };
        var exists = (p) => !!files[p];
        assert_1.default.equal((0, pixeleditor_1.resolveEmbedPath)('sub/main.c', 'data.bin', exists), 'sub/data.bin');
    });
    (0, mocha_1.it)('should return null when the file cannot be found', function () {
        var files = { 'main.c': true };
        var exists = (p) => !!files[p];
        assert_1.default.equal((0, pixeleditor_1.resolveEmbedPath)('main.c', 'missing.bin', exists), null);
    });
});
(0, mocha_1.describe)('validateAssetByteLength (for #embed binary files)', function () {
    (0, mocha_1.it)('should accept a C64 hires sprite (24x21 1bpp, 64-byte hw stride)', function () {
        var fmt = { w: 24, h: 21, bpp: 1, brev: 1, wpimg: 64, count: 1 };
        assert_1.default.equal((0, pixeleditor_1.validateAssetByteLength)(64, fmt), null);
    });
    (0, mocha_1.it)('should accept a C64 multicolor sprite (12x21 2bpp, 64-byte hw stride)', function () {
        var fmt = { w: 12, h: 21, bpp: 2, brev: 1, wpimg: 64, aspect: 2, count: 1 };
        assert_1.default.equal((0, pixeleditor_1.validateAssetByteLength)(64, fmt), null);
    });
    (0, mocha_1.it)('should scale required length with count', function () {
        var fmt = { w: 24, h: 21, bpp: 1, brev: 1, wpimg: 64, count: 3 };
        assert_1.default.equal((0, pixeleditor_1.validateAssetByteLength)(192, fmt), null);
    });
    (0, mocha_1.it)('should reject a mismatched byte length with a descriptive error', function () {
        var fmt = { w: 24, h: 21, bpp: 1, brev: 1, wpimg: 64, count: 1 };
        var err = (0, pixeleditor_1.validateAssetByteLength)(63, fmt);
        assert_1.default.ok(err);
        assert_1.default.ok(/Expected 64 byte/.test(err));
    });
    (0, mocha_1.it)('should require at least 1 byte for a palette block', function () {
        assert_1.default.equal((0, pixeleditor_1.validateAssetByteLength)(4, { pal: "c64" }), null);
        assert_1.default.ok((0, pixeleditor_1.validateAssetByteLength)(0, { pal: "c64" }));
    });
});
//# sourceMappingURL=testassetscan.js.map