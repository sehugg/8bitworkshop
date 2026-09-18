"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const project_1 = require("../../src/ide/project");
// oscar64 compiles the main file and its "//#link" sources in one invocation,
// so it emits a single .asm listing that mixes source lines from every file,
// each tagged with its own path. The editor and source breakpoints look up
// the listing for a given file, so each file must get a SourceFile holding
// only its own lines -- otherwise the linked files get no line info at all.
function makeProject(mainPath) {
    const proj = new project_1.CodeProject({}, 'c64', {}, { onFileSystemUpdate: () => { } });
    proj.mainPath = mainPath;
    return proj;
}
function mixedListing() {
    return {
        'main.lst': {
            lines: [
                { line: 1, path: 'main.cpp', offset: 0x100, iscode: true },
                { line: 2, path: 'main.cpp', offset: 0x102, iscode: true },
                { line: 5, path: 'lib.c', offset: 0x200, iscode: true },
                { line: 6, path: 'lib.c', offset: 0x205, iscode: true },
            ],
            asmlines: [
                { line: 1, path: 'main.cpp', offset: 0x100, insns: 'a9 00 LDA #$00', iscode: true },
            ],
            text: 'main.lst text',
        },
    };
}
(0, mocha_1.describe)('CodeProject.getListingForFile', function () {
    (0, mocha_1.it)('returns only the main file lines for the main file', function () {
        const proj = makeProject('presets/c64/main.cpp');
        proj.processBuildListings({ listings: mixedListing() });
        const lst = proj.getListingForFile('presets/c64/main.cpp');
        assert_1.default.ok(lst, 'expected a listing for the main file');
        assert_1.default.ok(lst.sourcefile, 'expected a sourcefile for the main file');
        assert_1.default.deepStrictEqual(lst.sourcefile.lines.map(l => l.line), [1, 2]);
        assert_1.default.strictEqual(lst.sourcefile.line2offset.get(2), 0x102);
    });
    (0, mocha_1.it)('returns the linked file lines for a linked file', function () {
        const proj = makeProject('presets/c64/main.cpp');
        proj.processBuildListings({ listings: mixedListing() });
        const lst = proj.getListingForFile('presets/c64/lib.c');
        assert_1.default.ok(lst, 'expected a listing for the linked file');
        assert_1.default.ok(lst.sourcefile, 'expected a sourcefile for the linked file');
        assert_1.default.deepStrictEqual(lst.sourcefile.lines.map(l => l.line), [5, 6]);
        assert_1.default.strictEqual(lst.sourcefile.line2offset.get(5), 0x200);
    });
});
//# sourceMappingURL=testlistingfiles.js.map