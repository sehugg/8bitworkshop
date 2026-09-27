"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const buildpresets_1 = require("../../src/tools/buildpresets");
// buildpresets --run flags the frames that look like nothing drew: a blank
// (untouched) screen or one color covering everything. screenStats is the pure
// part of that check, kept here so it runs without an emulator.
const BLACK = 0x00000000;
const BLUE = 0xff0000ff;
const RED = 0xffff0000;
function fill(color, n = 100) {
    return new Uint32Array(n).fill(color);
}
(0, mocha_1.describe)('buildpresets screen check', function () {
    (0, mocha_1.it)('flags an untouched (blank) screen', function () {
        const s = (0, buildpresets_1.screenStats)(fill(BLACK), 10, 10);
        assert_1.default.strictEqual(s.verdict, 'blank');
        assert_1.default.strictEqual(s.colors, 1);
    });
    (0, mocha_1.it)('flags a single drawn color as solid', function () {
        const s = (0, buildpresets_1.screenStats)(fill(BLUE), 10, 10);
        assert_1.default.strictEqual(s.verdict, 'solid');
        assert_1.default.strictEqual(s.color, BLUE);
    });
    (0, mocha_1.it)('flags a nearly single-color screen as solid', function () {
        const px = fill(BLUE, 1000);
        px[0] = RED; // one stray pixel out of 1000
        assert_1.default.strictEqual((0, buildpresets_1.screenStats)(px).verdict, 'solid');
    });
    (0, mocha_1.it)('passes a screen with a real background and foreground', function () {
        const px = fill(BLUE);
        for (let i = 0; i < 30; i++)
            px[i] = RED;
        const s = (0, buildpresets_1.screenStats)(px, 10, 10);
        assert_1.default.strictEqual(s.verdict, 'ok');
        assert_1.default.strictEqual(s.colors, 2);
        assert_1.default.strictEqual(s.dominant, 0.7);
    });
    (0, mocha_1.it)('carries the dimensions through', function () {
        const s = (0, buildpresets_1.screenStats)(fill(BLUE, 96), 16, 6);
        assert_1.default.strictEqual(s.width, 16);
        assert_1.default.strictEqual(s.height, 6);
    });
});
//# sourceMappingURL=testbuildpresetrun.js.map