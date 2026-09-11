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
//# sourceMappingURL=testpixelpalette.js.map