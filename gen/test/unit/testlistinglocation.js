"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const workertypes_1 = require("../../src/common/workertypes");
const listinglocation_1 = require("../../src/ide/search/listinglocation");
const LOOKAHEAD = 64;
function makeFile(lines) {
    return new workertypes_1.SourceFile(lines, '');
}
// a context where every candidate window id is "known" and file-prefix
// lookup just strips a trailing extension, like the real IDE's windows
function makeContext(overrides = {}) {
    return Object.assign({ listings: {}, filename2path: {}, isWindow: () => true, findWindowWithFilePrefix: (fn) => fn.replace(/\.lst$/, '') }, overrides);
}
(0, mocha_1.describe)('findListingLocation', function () {
    (0, mocha_1.it)('returns null when there are no listings', function () {
        const ctx = makeContext({ listings: {} });
        assert_1.default.strictEqual((0, listinglocation_1.findListingLocation)(0x100, ctx, LOOKAHEAD), null);
    });
    (0, mocha_1.it)('returns null when the PC matches no line in any listing', function () {
        const ctx = makeContext({
            listings: {
                'game.c': { lines: [], sourcefile: makeFile([{ line: 1, offset: 0 }]) },
            },
        });
        assert_1.default.strictEqual((0, listinglocation_1.findListingLocation)(0x9999, ctx, LOOKAHEAD), null);
    });
    (0, mocha_1.it)('resolves a sourcefile-only listing via findWindowWithFilePrefix', function () {
        const ctx = makeContext({
            listings: {
                'game.c.lst': { lines: [], sourcefile: makeFile([{ line: 1, offset: 0x10 }]) },
            },
        });
        const loc = (0, listinglocation_1.findListingLocation)(0x10, ctx, LOOKAHEAD);
        assert_1.default.ok(loc);
        assert_1.default.strictEqual(loc.wndid, 'game.c'); // .lst stripped by findWindowWithFilePrefix
        assert_1.default.strictEqual(loc.line, 1);
    });
    (0, mocha_1.it)('prefers the assembly listing over the source file when both are present', function () {
        const ctx = makeContext({
            listings: {
                'game.c.lst': {
                    lines: [],
                    sourcefile: makeFile([{ line: 1, offset: 0x10 }]),
                    assemblyfile: makeFile([{ line: 7, offset: 0x10 }]),
                },
            },
            filename2path: { 'game.c.lst': 'game.c.lst' },
        });
        const loc = (0, listinglocation_1.findListingLocation)(0x10, ctx, LOOKAHEAD);
        assert_1.default.ok(loc);
        assert_1.default.strictEqual(loc.wndid, 'game.c.lst'); // resolved via filename2path, not findWindowWithFilePrefix
        assert_1.default.strictEqual(loc.line, 7);
    });
    (0, mocha_1.it)('skips a listing whose window is not known', function () {
        const ctx = makeContext({
            listings: {
                'unknown.c.lst': { lines: [], sourcefile: makeFile([{ line: 1, offset: 0x10 }]) },
            },
            isWindow: () => false,
        });
        assert_1.default.strictEqual((0, listinglocation_1.findListingLocation)(0x10, ctx, LOOKAHEAD), null);
    });
    (0, mocha_1.it)('picks the closest match among several listings', function () {
        const ctx = makeContext({
            listings: {
                'far.c.lst': { lines: [], sourcefile: makeFile([{ line: 1, offset: 0x00 }]) },
                'near.c.lst': { lines: [], sourcefile: makeFile([{ line: 1, offset: 0x0e }]) },
            },
        });
        // pc=0x10: 'near' (offset 0x0e, score 2) beats 'far' (offset 0x00, score 16)
        const loc = (0, listinglocation_1.findListingLocation)(0x10, ctx, LOOKAHEAD);
        assert_1.default.ok(loc);
        assert_1.default.strictEqual(loc.wndid, 'near.c');
    });
    (0, mocha_1.it)('finds the line closely preceding the PC when there is no exact match', function () {
        const ctx = makeContext({
            listings: {
                'game.c.lst': { lines: [], sourcefile: makeFile([{ line: 5, offset: 0x100 }]) },
            },
        });
        const loc = (0, listinglocation_1.findListingLocation)(0x103, ctx, LOOKAHEAD);
        assert_1.default.ok(loc);
        assert_1.default.strictEqual(loc.line, 5);
    });
    (0, mocha_1.it)('does not look further behind the PC than the given lookahead', function () {
        const ctx = makeContext({
            listings: {
                'game.c.lst': { lines: [], sourcefile: makeFile([{ line: 5, offset: 0x100 }]) },
            },
        });
        assert_1.default.strictEqual((0, listinglocation_1.findListingLocation)(0x100 + 5, ctx, 4), null);
    });
});
//# sourceMappingURL=testlistinglocation.js.map