"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs = __importStar(require("fs"));
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
    (0, mocha_1.it)('should parse palette display names and bitmap palette references', function () {
        var src = '/*{pal:555,n:16,name:"Background"}*/\npalette_color_t bkg[1][4] = { 0x2062, 0x318E, 0x6A28, 0x7714 };\n' +
            '/*{w:8,h:8,bpp:1,np:2,pofs:1,sl:2,palname:"Background"}*/\nbyte tiles[] = { 0xff };\n';
        var frags = (0, pixeleditor_1.scanTextForAssetFragments)(src, false);
        assert_1.default.equal(frags.length, 2);
        assert_1.default.deepEqual(frags[0].fmt, { pal: 555, n: 16, name: "Background" });
        assert_1.default.deepEqual(frags[1].fmt, { w: 8, h: 8, bpp: 1, np: 2, pofs: 1, sl: 2, palname: "Background" });
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
(0, mocha_1.describe)('Asset data literal radix prefixes', function () {
    (0, mocha_1.it)('should recognize every documented radix-prefixed form', function () {
        assert_1.default.deepEqual((0, pixeleditor_1.parseHexWords)("0x18, $3c, #$7e, %0101, 0b0101, 8'hff, 8'b1010"), [0x18, 0x3c, 0x7e, 5, 5, 0xff, 0x0a]);
    });
    (0, mocha_1.it)('should treat plain decimal literals as unmatched (no radix prefix)', function () {
        assert_1.default.deepEqual((0, pixeleditor_1.parseHexWords)('{24,60,126,255}'), []);
    });
    (0, mocha_1.it)('should report "found 0" for a decimal-only asset data block', function () {
        var src = '/*{w:8,h:8,bpp:1,count:1,brev:1}*/\nbyte tiles[] = {24,60,126,255,24,60,126,255};\n';
        var frags = (0, pixeleditor_1.scanTextForAssetFragments)(src, false);
        assert_1.default.equal(frags.length, 1);
        assert_1.default.equal(frags[0].error, undefined);
        var err = (0, pixeleditor_1.validateAssetData)(src.substring(frags[0].start, frags[0].end), frags[0].fmt);
        assert_1.default.equal(err, 'Expected 8 value(s), found 0');
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
(0, mocha_1.describe)('C64 level2-data.c preset', function () {
    (0, mocha_1.it)('should expose the multicolor charset as a valid bitmap asset', function () {
        var src = fs.readFileSync('presets/c64/level2-data.c', 'utf8');
        var frags = (0, pixeleditor_1.scanTextForAssetFragments)(src, false);
        assert_1.default.equal(frags.length, 2); // charset bitmap + charpad map
        assert_1.default.equal(frags[0].error, undefined);
        assert_1.default.equal((0, pixeleditor_1.validateAssetData)(src.substring(frags[0].start, frags[0].end), frags[0].fmt), null);
    });
});
(0, mocha_1.describe)('CharPad tile maps', function () {
    const src = () => fs.readFileSync('presets/c64/level2-data.c', 'utf8');
    (0, mocha_1.it)('should find named arrays in C and asm source', function () {
        assert_1.default.deepEqual((0, pixeleditor_1.findNamedArray)('const byte a[2] = { 0x01, 0x02 /* x */ };\nbyte b[1]={0x03};', 'b'), [3]);
        assert_1.default.deepEqual((0, pixeleditor_1.findNamedArray)('a[2] = { // $99\n 0x01, 0x02 };', 'a'), [1, 2]);
        assert_1.default.deepEqual((0, pixeleditor_1.findNamedArray)('.global _t\n_t:\n.byte $01,$02 ; $ff\n_u:\n.byte $09\n', 't'), [1, 2]);
        assert_1.default.equal((0, pixeleditor_1.findNamedArray)('byte a[1]={1};', 'zzz'), null);
    });
    (0, mocha_1.it)('should accept lenient JSON keys containing digits', function () {
        var frags = (0, pixeleditor_1.scanTextForAssetFragments)('/*{w:1,mc1:2,name:"x_y"}*/\nbyte a[1]={0x01};', false);
        assert_1.default.equal(frags[0].error, undefined);
        assert_1.default.deepEqual(frags[0].fmt, { w: 1, mc1: 2, name: 'x_y' });
    });
    (0, mocha_1.it)('should validate the level2 map and resolve its source arrays', function () {
        var frags = (0, pixeleditor_1.scanTextForAssetFragments)(src(), false);
        assert_1.default.equal(frags.length, 2);
        var fmt = frags[1].fmt;
        assert_1.default.equal(fmt.map, 'charpad');
        assert_1.default.equal((0, pixeleditor_1.validateAssetData)(src().substring(frags[1].start, frags[1].end), fmt), null);
        assert_1.default.equal((0, pixeleditor_1.validateCharpadFormat)(fmt, (n) => (0, pixeleditor_1.findNamedArray)(src(), n)), null);
        assert_1.default.ok((0, pixeleditor_1.validateCharpadFormat)(fmt, () => null));
    });
    (0, mocha_1.it)('should render a multicolor and a hires cell', function () {
        var fmt = { w: 2, h: 1, tw: 1, th: 1, chars: 'c', tiles: 't', colors: 'k', bg: 11, mca: 5, mcb: 6 };
        // char 0: row0 = 00 01 10 11 pixels; char 1: row0 = 10000001
        var chars = [0x1b, 0, 0, 0, 0, 0, 0, 0, 0x81, 0, 0, 0, 0, 0, 0, 0];
        var r = (0, pixeleditor_1.renderCharpadMap)(fmt, [0, 1], chars, [0, 1], [8 | 2, 3]);
        assert_1.default.equal(r.width, 16);
        assert_1.default.equal(r.height, 8);
        assert_1.default.deepEqual(Array.from(r.pixels.slice(0, 16)), [11, 11, 5, 5, 6, 6, 2, 2, 3, 11, 11, 11, 11, 11, 11, 3]);
        assert_1.default.throws(() => (0, pixeleditor_1.renderCharpadMap)(fmt, [0, 2], chars, [0, 1], [10, 3]), /out of range/);
    });
});
(0, mocha_1.describe)('Generic tile maps', function () {
    const src = () => fs.readFileSync('presets/gb/bigmap.h', 'utf8');
    (0, mocha_1.it)('should find 2D named arrays', function () {
        assert_1.default.deepEqual((0, pixeleditor_1.findNamedArray)('const unsigned char m[2][2] = {\n {0x01,0x02},\n {0x03,0x04},\n};', 'm'), [1, 2, 3, 4]);
    });
    (0, mocha_1.it)('should validate the Game Boy bigmap and its attribute array', function () {
        var frags = (0, pixeleditor_1.scanTextForAssetFragments)(src(), false);
        var frag = frags.find((f) => f.fmt && f.fmt.map == 'tilemap');
        assert_1.default.ok(frag);
        assert_1.default.equal(frag.error, undefined);
        assert_1.default.equal((0, pixeleditor_1.validateAssetData)(src().substring(frag.start, frag.end), frag.fmt), null);
        assert_1.default.equal((0, pixeleditor_1.validateTilemapFormat)(frag.fmt, (n) => (0, pixeleditor_1.findNamedArray)(src(), n)), null);
        assert_1.default.ok((0, pixeleditor_1.validateTilemapFormat)(frag.fmt, () => null));
        assert_1.default.ok((0, pixeleditor_1.validateTilemapFormat)({ w: 2, h: 2, attrs: 'a' }, () => [0]));
    });
    (0, mocha_1.it)('should render palette and flip attributes', function () {
        var t0 = [1, 2, 3, 0, 0, 0, 0, 0].concat(new Array(56).fill(0)); // row 0 = 1,2,3,0...
        var fmt = { w: 3, h: 1 };
        var r = (0, pixeleditor_1.renderTilemap)(fmt, [0, 0, 0], [0, 1, 0x20 | 0x40 | 2], [t0]);
        assert_1.default.equal(r.width, 24);
        assert_1.default.equal(r.height, 8);
        assert_1.default.deepEqual(Array.from(r.pixels.slice(0, 4)), [1, 2, 3, 0]);
        assert_1.default.deepEqual(Array.from(r.pixels.slice(8, 12)), [5, 6, 7, 0]); // palette 1: +4, zero stays 0
        // X+Y flipped: the top row lands at the bottom, mirrored; palette 2: +8
        assert_1.default.deepEqual(Array.from(r.pixels.slice(7 * 24 + 16, 7 * 24 + 24)), [0, 0, 0, 0, 0, 11, 10, 9]);
        assert_1.default.throws(() => (0, pixeleditor_1.renderTilemap)(fmt, [0, 1, 0], null, [t0]), /out of range/);
    });
});
//# sourceMappingURL=testassetscan.js.map