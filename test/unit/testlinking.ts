import assert from "assert";
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
