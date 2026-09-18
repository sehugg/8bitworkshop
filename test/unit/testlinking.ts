import assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it } from "mocha";
import { compileSourceFile, preload } from "../../src/tools/testlib";

// A hand-written ca65 program for the VCS is a plain 4K cartridge: it supplies
// its own reset code and vectors, so it must not be linked against the C
// runtime (crt0.o + atari2600.lib) or laid out with the bank-switched
// atari2600.cfg that vcslib's C programs use -- crt0 has a VECTORS segment of
// its own, and two of them overflow the $FFFA..$FFFF the config pins them to.
describe('vcs link configuration', () => {
    it('should link a ca65 project as a plain 4K cart', async () => {
        await preload('ca65', 'vcs');
        const result: any = await compileSourceFile('ca65', 'vcs', 'presets/vcs/skeleton.ca65', 'skeleton.s');
        assert.deepStrictEqual(result.errors || [], []);
        assert.strictEqual(result.output.length, 4096);
    });
    it('should link a cc65 project with the bank-switched config', async () => {
        await preload('cc65', 'vcs');
        const result: any = await compileSourceFile('cc65', 'vcs', 'presets/vcs/skeleton.cc65', 'skeleton.c');
        assert.deepStrictEqual(result.errors || [], []);
        assert.strictEqual(result.output.length, 18432);
    });
});

// sdcc's linker also emits records for whatever it placed outside the ROM --
// here a GSINIT area that landed in the _DATA area's RAM at $e5b0. Those bytes
// are not part of the cartridge, and checking them for an overlap used to read
// past the end of the ROM image and report one that wasn't there.
describe('sdcc IHX output', () => {
    it('should ignore records outside the ROM image', async () => {
        await preload('sdcc', 'vector-z80color');
        const result: any = await compileSourceFile('sdcc', 'vector-z80color', 'presets/vector-z80color/game.c');
        assert.deepStrictEqual(result.errors || [], []);
        assert.strictEqual(result.output.length, 32768);
    });
});

// oscar64 compiles and links a whole program in one invocation. A linked
// source ("//#link") must be handed to that same invocation -- a .c file would
// otherwise be routed to cc65, which never runs because oscar64 emits the
// final binary first, leaving the symbol undefined. oscar64's own
// "#pragma compile("file.c")" is handled by the compiler, so that file only
// has to be a build dependency.
async function compileOscar64With(directive: string, libSource: string): Promise<any> {
    await preload('oscar64', 'c64');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oscar64-'));
    try {
        const main = path.join(dir, 'main.cpp');
        fs.writeFileSync(main,
            '#include <stdio.h>\n' +
            'extern int addnums(int a, int b);\n' +
            directive + '\n' +
            'int main(void) { printf("%d", addnums(2, 3)); return 0; }\n');
        fs.writeFileSync(path.join(dir, 'addnums.c'), libSource);
        return await compileSourceFile('oscar64', 'c64', main);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe('oscar64 linked sources', () => {
    it('should compile a //#link .c file as oscar64', async () => {
        const result = await compileOscar64With('//#link "addnums.c"',
            'int addnums(int a, int b) { return a + b; }\n');
        assert.deepStrictEqual(result.errors || [], []);
        assert.strictEqual(result.success, true);
        assert.ok(result.output.length > 0);
    });
    it('should compile a #pragma compile .c file as oscar64', async () => {
        const result = await compileOscar64With('#pragma compile("addnums.c")',
            'int addnums(int a, int b) { return a + b; }\n');
        assert.deepStrictEqual(result.errors || [], []);
        assert.strictEqual(result.success, true);
        assert.ok(result.output.length > 0);
    });
    it('should report errors in the linked file, not the main file', async () => {
        const result = await compileOscar64With('//#link "addnums.c"',
            'int addnums(int a, int b) {\n  return a + undefined_symbol;\n}\n');
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.errors.length, 1);
        assert.strictEqual(result.errors[0].path, 'addnums.c');
        assert.strictEqual(result.errors[0].line, 2);
    });
    it('should report errors in a #pragma compile file, not the main file', async () => {
        const result = await compileOscar64With('#pragma compile("addnums.c")',
            'int addnums(int a, int b) {\n  return a + undefined_symbol;\n}\n');
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.errors.length, 1);
        assert.strictEqual(result.errors[0].path, 'addnums.c');
        assert.strictEqual(result.errors[0].line, 2);
    });
    // The linked file is compiled into the same listing as the main file; it
    // has to carry its own line markers (tagged with its path) so the editor
    // and source breakpoints can map addresses back to the linked source.
    it('should emit source lines for a linked file', async () => {
        const result = await compileOscar64With('//#link "addnums.c"',
            'int addnums(int a, int b) {\n' +
            '  if (a <= 0) return b;\n' +
            '  return addnums(a-1, b+a) + addnums(a-2, b-a) + 1;\n' +
            '}\n');
        assert.deepStrictEqual(result.errors || [], []);
        const lines = result.listings['main.lst'].lines;
        const liblines = lines.filter(l => l.path === 'addnums.c');
        assert.ok(liblines.length > 0, 'expected source lines for the linked file');
        assert.ok(liblines.some(l => l.line === 3), 'expected line 3 of the linked file');
    });
});
