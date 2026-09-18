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
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const mocha_1 = require("mocha");
const testlib_1 = require("../../src/tools/testlib");
// A hand-written ca65 program for the VCS is a plain 4K cartridge: it supplies
// its own reset code and vectors, so it must not be linked against the C
// runtime (crt0.o + atari2600.lib) or laid out with the bank-switched
// atari2600.cfg that vcslib's C programs use -- crt0 has a VECTORS segment of
// its own, and two of them overflow the $FFFA..$FFFF the config pins them to.
(0, mocha_1.describe)('vcs link configuration', () => {
    (0, mocha_1.it)('should link a ca65 project as a plain 4K cart', async () => {
        await (0, testlib_1.preload)('ca65', 'vcs');
        const result = await (0, testlib_1.compileSourceFile)('ca65', 'vcs', 'presets/vcs/skeleton.ca65', 'skeleton.s');
        assert_1.default.deepStrictEqual(result.errors || [], []);
        assert_1.default.strictEqual(result.output.length, 4096);
    });
    (0, mocha_1.it)('should link a cc65 project with the bank-switched config', async () => {
        await (0, testlib_1.preload)('cc65', 'vcs');
        const result = await (0, testlib_1.compileSourceFile)('cc65', 'vcs', 'presets/vcs/skeleton.cc65', 'skeleton.c');
        assert_1.default.deepStrictEqual(result.errors || [], []);
        assert_1.default.strictEqual(result.output.length, 18432);
    });
});
// sdcc's linker also emits records for whatever it placed outside the ROM --
// here a GSINIT area that landed in the _DATA area's RAM at $e5b0. Those bytes
// are not part of the cartridge, and checking them for an overlap used to read
// past the end of the ROM image and report one that wasn't there.
(0, mocha_1.describe)('sdcc IHX output', () => {
    (0, mocha_1.it)('should ignore records outside the ROM image', async () => {
        await (0, testlib_1.preload)('sdcc', 'vector-z80color');
        const result = await (0, testlib_1.compileSourceFile)('sdcc', 'vector-z80color', 'presets/vector-z80color/game.c');
        assert_1.default.deepStrictEqual(result.errors || [], []);
        assert_1.default.strictEqual(result.output.length, 32768);
    });
});
// oscar64 compiles and links a whole program in one invocation. A linked
// source ("//#link") must be handed to that same invocation -- a .c file would
// otherwise be routed to cc65, which never runs because oscar64 emits the
// final binary first, leaving the symbol undefined. oscar64's own
// "#pragma compile("file.c")" is handled by the compiler, so that file only
// has to be a build dependency.
async function compileOscar64With(directive, libSource) {
    await (0, testlib_1.preload)('oscar64', 'c64');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oscar64-'));
    try {
        const main = path.join(dir, 'main.cpp');
        fs.writeFileSync(main, '#include <stdio.h>\n' +
            'extern int addnums(int a, int b);\n' +
            directive + '\n' +
            'int main(void) { printf("%d", addnums(2, 3)); return 0; }\n');
        fs.writeFileSync(path.join(dir, 'addnums.c'), libSource);
        return await (0, testlib_1.compileSourceFile)('oscar64', 'c64', main);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
(0, mocha_1.describe)('oscar64 linked sources', () => {
    (0, mocha_1.it)('should compile a //#link .c file as oscar64', async () => {
        const result = await compileOscar64With('//#link "addnums.c"', 'int addnums(int a, int b) { return a + b; }\n');
        assert_1.default.deepStrictEqual(result.errors || [], []);
        assert_1.default.strictEqual(result.success, true);
        assert_1.default.ok(result.output.length > 0);
    });
    (0, mocha_1.it)('should compile a #pragma compile .c file as oscar64', async () => {
        const result = await compileOscar64With('#pragma compile("addnums.c")', 'int addnums(int a, int b) { return a + b; }\n');
        assert_1.default.deepStrictEqual(result.errors || [], []);
        assert_1.default.strictEqual(result.success, true);
        assert_1.default.ok(result.output.length > 0);
    });
    (0, mocha_1.it)('should report errors in the linked file, not the main file', async () => {
        const result = await compileOscar64With('//#link "addnums.c"', 'int addnums(int a, int b) {\n  return a + undefined_symbol;\n}\n');
        assert_1.default.strictEqual(result.success, false);
        assert_1.default.strictEqual(result.errors.length, 1);
        assert_1.default.strictEqual(result.errors[0].path, 'addnums.c');
        assert_1.default.strictEqual(result.errors[0].line, 2);
    });
    (0, mocha_1.it)('should report errors in a #pragma compile file, not the main file', async () => {
        const result = await compileOscar64With('#pragma compile("addnums.c")', 'int addnums(int a, int b) {\n  return a + undefined_symbol;\n}\n');
        assert_1.default.strictEqual(result.success, false);
        assert_1.default.strictEqual(result.errors.length, 1);
        assert_1.default.strictEqual(result.errors[0].path, 'addnums.c');
        assert_1.default.strictEqual(result.errors[0].line, 2);
    });
    // The linked file is compiled into the same listing as the main file; it
    // has to carry its own line markers (tagged with its path) so the editor
    // and source breakpoints can map addresses back to the linked source.
    (0, mocha_1.it)('should emit source lines for a linked file', async () => {
        const result = await compileOscar64With('//#link "addnums.c"', 'int addnums(int a, int b) {\n' +
            '  if (a <= 0) return b;\n' +
            '  return addnums(a-1, b+a) + addnums(a-2, b-a) + 1;\n' +
            '}\n');
        assert_1.default.deepStrictEqual(result.errors || [], []);
        const lines = result.listings['main.lst'].lines;
        const liblines = lines.filter(l => l.path === 'addnums.c');
        assert_1.default.ok(liblines.length > 0, 'expected source lines for the linked file');
        assert_1.default.ok(liblines.some(l => l.line === 3), 'expected line 3 of the linked file');
    });
});
//# sourceMappingURL=testlinking.js.map