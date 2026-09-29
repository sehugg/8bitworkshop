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
const mocha_1 = require("mocha");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const buildpresets_1 = require("../../src/tools/buildpresets");
const platforms_1 = require("../../src/worker/platforms");
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
// Library headers live in src/worker/lib only; a preset copy would be copied
// into new projects and shadow the one the worker stages.
(0, mocha_1.describe)('buildpresets library collisions', function () {
    (0, mocha_1.it)('finds none in the presets tree', function () {
        assert_1.default.deepStrictEqual((0, buildpresets_1.libraryCollisions)('presets', platforms_1.PLATFORM_PARAMS), []);
    });
    (0, mocha_1.it)('reports a preset that shadows a library file', function () {
        const params = { nes: { extra_compile_files: ['neslib.h'] }, 'gb.color': { extra_compile_files: ['gb/gb.h'] } };
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'presets-'));
        try {
            fs.mkdirSync(path.join(dir, 'gb/gb'), { recursive: true });
            fs.writeFileSync(path.join(dir, 'gb/gb/gb.h'), '');
            assert_1.default.deepStrictEqual((0, buildpresets_1.libraryCollisions)(dir, params), [`${dir}/gb/gb/gb.h shadows library file src/worker/lib/gb/gb/gb.h`]);
        }
        finally {
            fs.rmSync(dir, { recursive: true });
        }
    });
});
//# sourceMappingURL=testbuildpresetrun.js.map