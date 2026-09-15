"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const pixeleditor_1 = require("../../src/ide/pixeleditor");
(0, mocha_1.describe)('Direct-color palette formats', function () {
    (0, mocha_1.it)('should describe channel layout for pal:444', function () {
        assert_1.default.deepEqual((0, pixeleditor_1.getDirectColorChannels)({ pal: 444 }), { r: 4, g: 4, b: 4, rshift: 0, gshift: 4, bshift: 8 });
    });
    (0, mocha_1.it)('should describe channel layout for pal:332', function () {
        assert_1.default.deepEqual((0, pixeleditor_1.getDirectColorChannels)({ pal: 332 }), { r: 3, g: 3, b: 2, rshift: 0, gshift: 3, bshift: 6 });
    });
    (0, mocha_1.it)('should return null for indexed palettes and non-numeric formats', function () {
        assert_1.default.equal((0, pixeleditor_1.getDirectColorChannels)({ pal: "nes" }), null);
        assert_1.default.equal((0, pixeleditor_1.getDirectColorChannels)({ pal: "pacman" }), null);
        assert_1.default.equal((0, pixeleditor_1.getDirectColorChannels)({}), null);
    });
    (0, mocha_1.it)('should pack and unpack channel values', function () {
        var word = (0, pixeleditor_1.encodeDirectColorWord)({ pal: 444 }, 0xF, 0x0, 0xA);
        assert_1.default.equal(word, 0xA0F);
        assert_1.default.deepEqual((0, pixeleditor_1.decodeDirectColorWord)({ pal: 444 }, word), { r: 0xF, g: 0x0, b: 0xA });
    });
    (0, mocha_1.it)('should round-trip every color in a pal:444 palette', function () {
        var words = (0, pixeleditor_1.getPaletteLength)({ pal: 444 });
        assert_1.default.equal(words, 4096);
        for (var i = 0; i < words; i++) {
            var c = (0, pixeleditor_1.decodeDirectColorWord)({ pal: 444 }, i);
            assert_1.default.equal((0, pixeleditor_1.encodeDirectColorWord)({ pal: 444 }, c.r, c.g, c.b), i);
        }
    });
    (0, mocha_1.it)('should match convertPaletteFormat for encoded words', function () {
        var word = (0, pixeleditor_1.encodeDirectColorWord)({ pal: 444 }, 0xF, 0x0, 0xA);
        assert_1.default.equal((0, pixeleditor_1.convertPaletteFormat)([word], { pal: 444 })[0] >>> 0, 0xffa000f0);
    });
    (0, mocha_1.it)('should round-trip a pal:332 word', function () {
        var word = (0, pixeleditor_1.encodeDirectColorWord)({ pal: 332 }, 5, 3, 2);
        var c = (0, pixeleditor_1.decodeDirectColorWord)({ pal: 332 }, word);
        assert_1.default.deepEqual(c, { r: 5, g: 3, b: 2 });
    });
});
(0, mocha_1.describe)('Palettizer preferred palette', function () {
    var palettes = [
        { node: null, name: "Background", palette: new Uint32Array([1, 2, 3, 4]) },
        { node: null, name: "Sprite", palette: new Uint32Array([5, 6, 7, 8]) },
    ];
    var context = {
        setCurrentEditor: () => { },
        getTilemaps: () => [],
        getPalettes: () => palettes,
    };
    (0, mocha_1.it)('should default to the first palette when no name is given', function () {
        var p = new pixeleditor_1.Palettizer(context, { w: 8, h: 8, bpp: 2 });
        p.updateRefs();
        assert_1.default.equal(p.palindex, 0);
        assert_1.default.deepEqual(Array.from(p.palette), [1, 2, 3, 4]);
    });
    (0, mocha_1.it)('should select the palette named by fmt.palname', function () {
        var p = new pixeleditor_1.Palettizer(context, { w: 8, h: 8, bpp: 2, palname: "Sprite" });
        p.updateRefs();
        assert_1.default.equal(p.palindex, 1);
        assert_1.default.deepEqual(Array.from(p.palette), [5, 6, 7, 8]);
    });
    (0, mocha_1.it)('should fall back to the first palette when the name does not match', function () {
        var p = new pixeleditor_1.Palettizer(context, { w: 8, h: 8, bpp: 2, palname: "Missing" });
        p.updateRefs();
        assert_1.default.equal(p.palindex, 0);
    });
});
(0, mocha_1.describe)('Palette name disambiguation', function () {
    function entry(name, group) {
        return { node: null, name, group, palette: new Uint32Array([0, 1, 2, 3]) };
    }
    (0, mocha_1.it)('should leave unique names alone', function () {
        var pals = [entry("Background"), entry("Sprite")];
        (0, pixeleditor_1.disambiguatePaletteNames)(pals);
        assert_1.default.deepEqual(pals.map((p) => p.name), ["Background", "Sprite"]);
    });
    (0, mocha_1.it)('should prefix only the duplicated slice names with their owner', function () {
        var pals = [
            entry("Background 0", "Palette 1"),
            entry("Sprite 0", "Palette 1"),
            entry("Background 0", "Palette 2"),
            entry("Sprite 0", "Palette 2"),
        ];
        (0, pixeleditor_1.disambiguatePaletteNames)(pals);
        assert_1.default.deepEqual(pals.map((p) => p.name), [
            "Palette 1: Background 0",
            "Palette 1: Sprite 0",
            "Palette 2: Background 0",
            "Palette 2: Sprite 0",
        ]);
    });
    (0, mocha_1.it)('should not prefix a unique name even if its owner is set', function () {
        var pals = [entry("Background 0", "Palette 1"), entry("Screen Color", "Palette 1")];
        (0, pixeleditor_1.disambiguatePaletteNames)(pals);
        assert_1.default.deepEqual(pals.map((p) => p.name), ["Background 0", "Screen Color"]);
    });
});
(0, mocha_1.describe)('Palette layouts', function () {
    // 32 distinct colors so slice membership is easy to check.
    function ramp(n) {
        var a = new Uint32Array(n);
        for (var i = 0; i < n; i++)
            a[i] = 0xff000000 | i;
        return a;
    }
    (0, mocha_1.it)('should register sms and gg with the 16+16 mode-4 split', function () {
        assert_1.default.deepEqual(pixeleditor_1.PREDEF_LAYOUTS['sms'], [['Background', 0, 16], ['Sprite', 16, 16]]);
        assert_1.default.deepEqual(pixeleditor_1.PREDEF_LAYOUTS['gg'], pixeleditor_1.PREDEF_LAYOUTS['sms']);
    });
    (0, mocha_1.it)('should slice an sms palette into background and sprite', function () {
        var pal = ramp(32);
        var slices = (0, pixeleditor_1.computePaletteSlices)(pal, pixeleditor_1.PREDEF_LAYOUTS['sms'], 16, null, 'Palette 1');
        assert_1.default.deepEqual(slices.map((s) => s.name), ['Background', 'Sprite']);
        assert_1.default.deepEqual(slices.map((s) => s.group), ['Palette 1', 'Palette 1']);
        assert_1.default.deepEqual(Array.from(slices[0].palette), Array.from(pal.slice(0, 16)));
        assert_1.default.deepEqual(Array.from(slices[1].palette), Array.from(pal.slice(16, 32)));
    });
    (0, mocha_1.it)('should drop slices whose size does not match the image pen count', function () {
        // 4bpp images match the 16-color slices; 2bpp images (4 pens) do not.
        assert_1.default.equal((0, pixeleditor_1.computePaletteSlices)(ramp(32), pixeleditor_1.PREDEF_LAYOUTS['sms'], 4, null).length, 0);
    });
    (0, mocha_1.it)('should reverse slices with negative length', function () {
        var pal = ramp(8);
        var slices = (0, pixeleditor_1.computePaletteSlices)(pal, pixeleditor_1.PREDEF_LAYOUTS['astrocade'], 4, null);
        assert_1.default.deepEqual(slices.map((s) => s.name), ['Left', 'Right']);
        assert_1.default.deepEqual(Array.from(slices[0].palette), [0xff000003, 0xff000002, 0xff000001, 0xff000000]);
        assert_1.default.deepEqual(Array.from(slices[1].palette), [0xff000007, 0xff000006, 0xff000005, 0xff000004]);
    });
    (0, mocha_1.it)('should prepend the shared color for nes backdrop palettes', function () {
        var pal = ramp(64);
        var slices = (0, pixeleditor_1.computePaletteSlices)(pal, pixeleditor_1.PREDEF_LAYOUTS['nes'], 4, null);
        var bg0 = slices.find((s) => s.name === 'Background 0');
        assert_1.default.deepEqual(Array.from(bg0.palette), [0xff000000, 0xff000001, 0xff000002, 0xff000003]); // shared color 0 + 3 entries
    });
    (0, mocha_1.it)('should ignore slices that start past the end of the palette', function () {
        // 16-entry palette: Background (0-16) is in range, Sprite (16-32) is not.
        var slices = (0, pixeleditor_1.computePaletteSlices)(ramp(16), pixeleditor_1.PREDEF_LAYOUTS['sms'], 16, null);
        assert_1.default.deepEqual(slices.map((s) => s.name), ['Background']);
    });
});
//# sourceMappingURL=testpixelpalette.js.map