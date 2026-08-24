import assert from "assert";
import * as fs from "fs";
import { WASIRunner } from "../../src/common/wasi/wasishim";
import { CodeListingMap, WorkerError } from "../../src/common/workertypes";
import { dedupeErrors, expandTabs, parseDASMListing, parseDASMListingLine, parseDASMOutput, parseSymbolMap } from "../../src/worker/tools/dasm";

// Assemble sources with the same DASM build the worker uses, and hand the
// listing back so the parser is always tested against real DASM output.
interface DASMRun {
    errno: number;
    stdout: string;
    listing: string;
    symbols: string;
    output: Uint8Array;
}

function runDASM(files: { [path: string]: string }, mainfile: string, args: string[] = []): DASMRun {
    const wasi = new WASIRunner();
    wasi.initSync(new WebAssembly.Module(fs.readFileSync('./src/worker/wasm/dasm-wasisdk.wasm')));
    for (const path in files) {
        wasi.fs.putFile("./" + path, files[path]);
    }
    wasi.addPreopenDirectory(".");
    wasi.setArgs(['dasm', mainfile, '-f3', '-la.lst', '-sa.sym', '-oa.bin', ...args]);
    let errno = 0;
    try {
        errno = wasi.run();
    } catch (e) {
        errno = -1;
    }
    function read(path: string) {
        try { return wasi.fs.getFile("./" + path).getBytesAsString(); } catch (e) { return null; }
    }
    let output: Uint8Array = null;
    try { output = wasi.fs.getFile("./a.bin").getBytes(); } catch (e) { }
    return { errno, stdout: wasi.fds[1].getBytesAsString(), listing: read('a.lst'), symbols: read('a.sym'), output };
}

// parse a run the way the worker's assembleDASM() does
function parseRun(run: DASMRun, paths: string[]) {
    const errors: WorkerError[] = [];
    const unresolved = {};
    const fatal = parseDASMOutput(run.stdout, errors, unresolved);
    const listings: CodeListingMap = {};
    for (const path of paths) listings[path] = { lines: [] };
    parseDASMListing('a.lst', run.listing, listings, errors, unresolved);
    return { errors: dedupeErrors(errors), listings, unresolved, fatal };
}

const MACRO_SRC =
    '\tprocessor 6502\n' +
    '\torg $f000\n' +
    ' MAC mack\n' +
    ' lda #0\n' +
    ' ENDM\n' +
    'foo: mack\n' +
    ' mack\n';

describe('DASM listing parser', function () {

    it('expands tabs to 8-column stops', function () {
        assert.strictEqual(expandTabs('a\tb'), 'a       b');
        assert.strictEqual(expandTabs('12345678\tx'), '12345678        x');
        assert.strictEqual(expandTabs('\t\t|'), '                |');
    });

    it('splits a listing line into its columns', function () {
        const l = parseDASMListingLine('     10  f009\t\t       d0 fb\t\t      bne\t.CLEAR_STACK');
        assert.strictEqual(l.linenum, 10);
        assert.strictEqual(l.offset, 0xf009);
        assert.strictEqual(l.insns, 'd0 fb');
        assert.strictEqual(l.op.split(/\s+/)[0], 'bne');
    });

    it('ignores the bytes of unresolved and uninitialized lines', function () {
        // an equate: address is ???? even though a value is shown
        const equ = parseDASMListingLine('      4  0000 ????\t       00 6a\t   VERSION_MACRO =\t106');
        assert.strictEqual(equ.insns, null);
        // a ds in an uninitialized segment
        const ds = parseDASMListingLine('    146 U0006\t\t       00\t   CXBLPF     ds\t1\t; $06');
        assert.strictEqual(ds.insns, null);
        // an equate outside any segment gets the 5-digit address 10000, which
        // pushes "????" over a column but leaves the later columns alone
        const abs = parseDASMListingLine('      4  10000 ????\t\t00 69\t    VERSION_VCS =\t105');
        assert.strictEqual(abs.insns, null);
        assert.strictEqual(abs.offset, 0x10000);
        assert.strictEqual(abs.op, '=       105');
    });

    it('separates a label that overflows its column', function () {
        const l = parseDASMListingLine('      3  f000\t\t       a9 00\t   AVeryLongLabelName123456 lda\t#0');
        assert.strictEqual(l.insns, 'a9 00');
        assert.strictEqual(l.op, 'lda #0');
        // a byte field that overflows keeps only the bytes, not the '*' marker
        const many = parseDASMListingLine('      5  f002\t\t       01 02 03 04*\t      dc.b\t1,2,3');
        assert.strictEqual(many.insns, '01 02 03 04');
    });

    it('is not confused by non-listing lines', function () {
        assert.strictEqual(parseDASMListingLine('------- FILE src.dasm LEVEL 1 PASS 1'), null);
        assert.strictEqual(parseDASMListingLine("src.dasm (3): error: Unknown Mnemonic 'asl a'."), null);
        assert.strictEqual(parseDASMListingLine(''), null);
    });

    it('maps macro expansions back to the macro definition', function () {
        const run = runDASM({ 'src.dasm': MACRO_SRC }, 'src.dasm');
        assert.strictEqual(run.errno, 0, run.stdout);
        const { errors, listings } = parseRun(run, ['src.dasm']);
        assert.deepStrictEqual(errors, []);
        const lines = listings['src.dasm'].lines;
        // two invocations (source lines 6 and 7), each expanding "lda #0" on line 4
        assert.deepStrictEqual(lines.map((l) => l.line), [6, 4, 7, 4]);
        assert.deepStrictEqual(lines.map((l) => l.offset), [0xf000, 0xf000, 0xf002, 0xf002]);
        assert.deepStrictEqual(lines.map((l) => l.insns), [null, 'a9 00', null, 'a9 00']);
    });

    it('tracks include files and their line numbers', function () {
        const files = {
            'main.dasm': '\tprocessor 6502\n\torg $f000\n\tinclude "sub.asm"\nfoo:\tlda #2\n',
            'sub.asm': '\tlda #1\n\tnop\n',
        };
        const run = runDASM(files, 'main.dasm');
        assert.strictEqual(run.errno, 0, run.stdout);
        const { errors, listings } = parseRun(run, ['main.dasm', 'sub.asm']);
        assert.deepStrictEqual(errors, []);
        // lines from the include land in the include's listing, not the main file
        assert.deepStrictEqual(listings['sub.asm'].lines.map((l) => l.line), [1, 2]);
        assert.deepStrictEqual(listings['sub.asm'].lines.map((l) => l.insns), ['a9 01', 'ea']);
        // and the main file resumes at the line after the include
        assert.deepStrictEqual(listings['main.dasm'].lines.map((l) => l.line), [4]);
        assert.deepStrictEqual(listings['main.dasm'].lines.map((l) => l.offset), [0xf003]);
    });

    it('follows nested macros and REPEAT blocks', function () {
        const src =
            '\tprocessor 6502\n' +      // 1
            '\torg $f000\n' +           // 2
            '\tMAC inner\n' +           // 3
            '\tlda #$11\n' +            // 4
            '\tENDM\n' +                // 5
            '\tMAC outer\n' +           // 6
            '\tldx #$22\n' +            // 7
            '\tinner\n' +               // 8
            '\tREPEAT 2\n' +            // 9
            '\tnop\n' +                 // 10
            '\tREPEND\n' +              // 11
            '\tENDM\n' +                // 12
            '\touter\n' +               // 13
            'done:\tldy #$33\n';         // 14
        const run = runDASM({ 'src.dasm': src }, 'src.dasm');
        assert.strictEqual(run.errno, 0, run.stdout);
        const { errors, listings } = parseRun(run, ['src.dasm']);
        assert.deepStrictEqual(errors, []);
        const lines = listings['src.dasm'].lines;
        // outer invoked at 13 -> ldx (7), inner's lda (4), two nops (10), then ldy (14)
        assert.deepStrictEqual(lines.map((l) => l.line), [13, 7, 4, 10, 10, 14]);
        assert.deepStrictEqual(lines.map((l) => l.insns),
            [null, 'a2 22', 'a9 11', 'ea', 'ea', 'a0 33']);
    });

    it('reports an unknown mnemonic once, at its source line', function () {
        const src = '\tprocessor 6502\n\torg $f000 ; this is a comment\nfoo asl a\n';
        const run = runDASM({ 'src.dasm': src }, 'src.dasm');
        assert.notStrictEqual(run.errno, 0);
        const { errors, unresolved } = parseRun(run, ['src.dasm']);
        assert.deepStrictEqual(Object.keys(unresolved), ['a']);
        assert.strictEqual(errors.length, 2, JSON.stringify(errors));
        for (const err of errors) {
            assert.strictEqual(err.path, 'src.dasm');
            assert.strictEqual(err.line, 3);
        }
        assert.ok(errors.some((e) => /Unknown Mnemonic/.test(e.msg)), JSON.stringify(errors));
        assert.ok(errors.some((e) => /Unresolved symbol 'a'/.test(e.msg)), JSON.stringify(errors));
    });

    it('keeps the fatal summary out of the way of real errors', function () {
        const errors: WorkerError[] = [];
        const fatal = parseDASMOutput(
            "src.dasm (3): error: Unknown Mnemonic 'asl a'.\n\nFatal assembly error: Source is not resolvable.\n",
            errors, {});
        assert.strictEqual(fatal, 'Fatal assembly error: Source is not resolvable.');
        assert.deepStrictEqual(errors, [{ path: 'src.dasm', line: 3, msg: "Unknown Mnemonic 'asl a'." }]);
    });

    // DASM 2.20.16 asserts in ShowSymbols() when there are no symbols to show,
    // but only after it has written the listing and the binary, so the tool
    // treats the trap as non-fatal when those files are there.
    it('still produces a listing and a binary when it traps on an empty symbol table', function () {
        const run = runDASM({ 'src.dasm': '\tprocessor 6502\n\torg $f000\n\tlda #1\n' }, 'src.dasm');
        assert.notStrictEqual(run.errno, 0);
        assert.strictEqual(run.symbols, ''); // written, but never filled in
        assert.deepStrictEqual(Array.from(run.output), [0xa9, 0x01]);
        const { errors, listings } = parseRun(run, ['src.dasm']);
        assert.deepStrictEqual(errors, []);
        assert.deepStrictEqual(listings['src.dasm'].lines.map((l) => l.line), [3]);
    });

    it('maps a real preset onto its sources', function () {
        const names = ['fullgame.a', 'vcs.h', 'macro.h', 'xmacro.h'];
        const files = {};
        files['fullgame.a'] = fs.readFileSync('./presets/vcs/examples/fullgame.a', 'utf8');
        for (const inc of ['vcs.h', 'macro.h', 'xmacro.h']) {
            files[inc] = fs.readFileSync('./presets/vcs/' + inc, 'utf8');
        }
        const run = runDASM(files, 'fullgame.a');
        assert.strictEqual(run.errno, 0, run.stdout);
        const { errors, listings } = parseRun(run, names);
        assert.deepStrictEqual(errors, []);
        let mincode = Infinity;
        for (const path of names) {
            const nlines = files[path].split('\n').length;
            for (const l of listings[path].lines) {
                // every mapped line has to exist in the file it points at
                assert.ok(l.line >= 1 && l.line <= nlines,
                    `${l.path || path}:${l.line} is outside ${path} (${nlines} lines)`);
                // and every address has to be inside the 4K cartridge
                assert.ok(l.offset >= 0xf000 && l.offset <= 0xffff,
                    `${l.path || path}:${l.line} is at $${l.offset.toString(16)}`);
                if (l.iscode && l.offset > 0) mincode = Math.min(mincode, l.offset);
            }
        }
        // the origin the debugger infers from the listing
        assert.strictEqual(mincode, 0xf000);
        // the main file's own lines run forwards, in step with the addresses
        const own = listings['fullgame.a'].lines.filter((l) => !l.path);
        assert.ok(own.length > 200, `only ${own.length} lines mapped`);
        for (let i = 1; i < own.length; i++) {
            assert.ok(own[i].line > own[i - 1].line,
                `line ${own[i].line} follows ${own[i - 1].line}`);
        }
    });

    it('parses the symbol table', function () {
        const run = runDASM({ 'src.dasm': MACRO_SRC }, 'src.dasm');
        const symbolmap = parseSymbolMap(run.symbols);
        assert.strictEqual(symbolmap['foo'], 0xf000);
    });
});
