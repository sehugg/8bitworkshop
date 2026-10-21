"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const links_1 = require("../../src/common/links");
const detect_1 = require("../../src/common/detect");
(0, mocha_1.describe)('links', () => {
    (0, mocha_1.it)('points at the IDE under /latest/', () => {
        assert_1.default.strictEqual(links_1.IDE_BASE_URL, 'https://8bitworkshop.com/latest/');
        // the trailing slash matters: /latest is a 404
        assert_1.default.ok(links_1.IDE_BASE_URL.endsWith('/latest/'));
    });
    (0, mocha_1.it)('builds IDE links', () => {
        assert_1.default.strictEqual((0, links_1.ideLink)({ platform: 'nes', file: 'game.c' }), 'https://8bitworkshop.com/latest/?platform=nes&file=game.c');
        assert_1.default.strictEqual((0, links_1.ideLink)({ platform: 'nes', file: 'src/my game.c' }), 'https://8bitworkshop.com/latest/?platform=nes&file=src%2Fmy%20game.c');
        assert_1.default.strictEqual((0, links_1.ideLink)({ platform: 'nes', file: undefined }), 'https://8bitworkshop.com/latest/?platform=nes');
        assert_1.default.strictEqual((0, links_1.ideLink)({}), 'https://8bitworkshop.com/latest/');
    });
    (0, mocha_1.it)('writes a README badge the detector can read', () => {
        var readme = (0, links_1.githubReadme)('my-game', 'nes', 'https://github.com/me/my-game', 'game.c');
        assert_1.default.ok(readme.includes('https://8bitworkshop.com/latest/?platform=nes&githubURL=https%3A%2F%2Fgithub.com%2Fme%2Fmy-game&file=game.c'), readme);
        assert_1.default.deepStrictEqual((0, detect_1.parseReadmeBadge)(readme), { platform: 'nes', mainFile: 'game.c' });
    });
});
//# sourceMappingURL=testlinks.js.map