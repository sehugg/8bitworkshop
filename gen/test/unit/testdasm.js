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
const wasishim_1 = require("../../src/common/wasi/wasishim");
const dasm_1 = require("../../src/worker/tools/dasm");
function runDASM(files, mainfile, args = []) {
    const wasi = new wasishim_1.WASIRunner();
    wasi.initSync(new WebAssembly.Module(fs.readFileSync('./src/worker/wasm/dasm-wasisdk.wasm')));
    for (const path in files) {
        wasi.fs.putFile("./" + path, files[path]);
    }
    wasi.addPreopenDirectory(".");
    wasi.setArgs(['dasm', mainfile, '-f3', '-la.lst', '-sa.sym', '-oa.bin', ...args]);
    let errno = 0;
    try {
        errno = wasi.run();
    }
    catch (e) {
        errno = -1;
    }
    function read(path) {
        try {
            return wasi.fs.getFile("./" + path).getBytesAsString();
        }
        catch (e) {
            return null;
        }
    }
    let output = null;
    try {
        output = wasi.fs.getFile("./a.bin").getBytes();
    }
    catch (e) { }
    return { errno, stdout: wasi.fds[1].getBytesAsString(), listing: read('a.lst'), symbols: read('a.sym'), output };
}
// parse a run the way the worker's assembleDASM() does
function parseRun(run, paths) {
    const errors = [];
    const unresolved = {};
    const fatal = (0, dasm_1.parseDASMOutput)(run.stdout, errors, unresolved);
    const listings = {};
    for (const path of paths)
        listings[path] = { lines: [] };
    (0, dasm_1.parseDASMListing)('a.lst', run.listing, listings, errors, unresolved);
    return { errors: (0, dasm_1.dedupeErrors)(errors), listings, unresolved, fatal };
}
const MACRO_SRC = '\tprocessor 6502\n' +
    '\torg $f000\n' +
    ' MAC mack\n' +
    ' lda #0\n' +
    ' ENDM\n' +
    'foo: mack\n' +
    ' mack\n';
describe('DASM listing parser', function () {
    it('expands tabs to 8-column stops', function () {
        assert_1.default.strictEqual((0, dasm_1.expandTabs)('a\tb'), 'a       b');
        assert_1.default.strictEqual((0, dasm_1.expandTabs)('12345678\tx'), '12345678        x');
        assert_1.default.strictEqual((0, dasm_1.expandTabs)('\t\t|'), '                |');
    });
    it('splits a listing line into its columns', function () {
        const l = (0, dasm_1.parseDASMListingLine)('     10  f009\t\t       d0 fb\t\t      bne\t.CLEAR_STACK');
        assert_1.default.strictEqual(l.linenum, 10);
        assert_1.default.strictEqual(l.offset, 0xf009);
        assert_1.default.strictEqual(l.insns, 'd0 fb');
        assert_1.default.strictEqual(l.op.split(/\s+/)[0], 'bne');
    });
    it('ignores the bytes of unresolved and uninitialized lines', function () {
        // an equate: address is ???? even though a value is shown
        const equ = (0, dasm_1.parseDASMListingLine)('      4  0000 ????\t       00 6a\t   VERSION_MACRO =\t106');
        assert_1.default.strictEqual(equ.insns, null);
        // a ds in an uninitialized segment
        const ds = (0, dasm_1.parseDASMListingLine)('    146 U0006\t\t       00\t   CXBLPF     ds\t1\t; $06');
        assert_1.default.strictEqual(ds.insns, null);
        // an equate outside any segment gets the 5-digit address 10000, which
        // pushes "????" over a column but leaves the later columns alone
        const abs = (0, dasm_1.parseDASMListingLine)('      4  10000 ????\t\t00 69\t    VERSION_VCS =\t105');
        assert_1.default.strictEqual(abs.insns, null);
        assert_1.default.strictEqual(abs.offset, 0x10000);
        assert_1.default.strictEqual(abs.op, '=       105');
    });
    it('separates a label that overflows its column', function () {
        const l = (0, dasm_1.parseDASMListingLine)('      3  f000\t\t       a9 00\t   AVeryLongLabelName123456 lda\t#0');
        assert_1.default.strictEqual(l.insns, 'a9 00');
        assert_1.default.strictEqual(l.op, 'lda #0');
        // a byte field that overflows keeps only the bytes, not the '*' marker
        const many = (0, dasm_1.parseDASMListingLine)('      5  f002\t\t       01 02 03 04*\t      dc.b\t1,2,3');
        assert_1.default.strictEqual(many.insns, '01 02 03 04');
    });
    it('is not confused by non-listing lines', function () {
        assert_1.default.strictEqual((0, dasm_1.parseDASMListingLine)('------- FILE src.dasm LEVEL 1 PASS 1'), null);
        assert_1.default.strictEqual((0, dasm_1.parseDASMListingLine)("src.dasm (3): error: Unknown Mnemonic 'asl a'."), null);
        assert_1.default.strictEqual((0, dasm_1.parseDASMListingLine)(''), null);
    });
    it('maps macro expansions back to the macro definition', function () {
        const run = runDASM({ 'src.dasm': MACRO_SRC }, 'src.dasm');
        assert_1.default.strictEqual(run.errno, 0, run.stdout);
        const { errors, listings } = parseRun(run, ['src.dasm']);
        assert_1.default.deepStrictEqual(errors, []);
        const lines = listings['src.dasm'].lines;
        // two invocations (source lines 6 and 7), each expanding "lda #0" on line 4
        assert_1.default.deepStrictEqual(lines.map((l) => l.line), [6, 4, 7, 4]);
        assert_1.default.deepStrictEqual(lines.map((l) => l.offset), [0xf000, 0xf000, 0xf002, 0xf002]);
        assert_1.default.deepStrictEqual(lines.map((l) => l.insns), [null, 'a9 00', null, 'a9 00']);
    });
    it('tracks include files and their line numbers', function () {
        const files = {
            'main.dasm': '\tprocessor 6502\n\torg $f000\n\tinclude "sub.asm"\nfoo:\tlda #2\n',
            'sub.asm': '\tlda #1\n\tnop\n',
        };
        const run = runDASM(files, 'main.dasm');
        assert_1.default.strictEqual(run.errno, 0, run.stdout);
        const { errors, listings } = parseRun(run, ['main.dasm', 'sub.asm']);
        assert_1.default.deepStrictEqual(errors, []);
        // lines from the include land in the include's listing, not the main file
        assert_1.default.deepStrictEqual(listings['sub.asm'].lines.map((l) => l.line), [1, 2]);
        assert_1.default.deepStrictEqual(listings['sub.asm'].lines.map((l) => l.insns), ['a9 01', 'ea']);
        // and the main file resumes at the line after the include
        assert_1.default.deepStrictEqual(listings['main.dasm'].lines.map((l) => l.line), [4]);
        assert_1.default.deepStrictEqual(listings['main.dasm'].lines.map((l) => l.offset), [0xf003]);
    });
    it('follows nested macros and REPEAT blocks', function () {
        const src = '\tprocessor 6502\n' + // 1
            '\torg $f000\n' + // 2
            '\tMAC inner\n' + // 3
            '\tlda #$11\n' + // 4
            '\tENDM\n' + // 5
            '\tMAC outer\n' + // 6
            '\tldx #$22\n' + // 7
            '\tinner\n' + // 8
            '\tREPEAT 2\n' + // 9
            '\tnop\n' + // 10
            '\tREPEND\n' + // 11
            '\tENDM\n' + // 12
            '\touter\n' + // 13
            'done:\tldy #$33\n'; // 14
        const run = runDASM({ 'src.dasm': src }, 'src.dasm');
        assert_1.default.strictEqual(run.errno, 0, run.stdout);
        const { errors, listings } = parseRun(run, ['src.dasm']);
        assert_1.default.deepStrictEqual(errors, []);
        const lines = listings['src.dasm'].lines;
        // outer invoked at 13 -> ldx (7), inner's lda (4), two nops (10), then ldy (14)
        assert_1.default.deepStrictEqual(lines.map((l) => l.line), [13, 7, 4, 10, 10, 14]);
        assert_1.default.deepStrictEqual(lines.map((l) => l.insns), [null, 'a2 22', 'a9 11', 'ea', 'ea', 'a0 33']);
    });
    it('reports an unknown mnemonic once, at its source line', function () {
        const src = '\tprocessor 6502\n\torg $f000 ; this is a comment\nfoo asl a\n';
        const run = runDASM({ 'src.dasm': src }, 'src.dasm');
        assert_1.default.notStrictEqual(run.errno, 0);
        const { errors, unresolved } = parseRun(run, ['src.dasm']);
        assert_1.default.deepStrictEqual(Object.keys(unresolved), ['a']);
        assert_1.default.strictEqual(errors.length, 2, JSON.stringify(errors));
        for (const err of errors) {
            assert_1.default.strictEqual(err.path, 'src.dasm');
            assert_1.default.strictEqual(err.line, 3);
        }
        assert_1.default.ok(errors.some((e) => /Unknown Mnemonic/.test(e.msg)), JSON.stringify(errors));
        assert_1.default.ok(errors.some((e) => /Unresolved symbol 'a'/.test(e.msg)), JSON.stringify(errors));
    });
    it('keeps the fatal summary out of the way of real errors', function () {
        const errors = [];
        const fatal = (0, dasm_1.parseDASMOutput)("src.dasm (3): error: Unknown Mnemonic 'asl a'.\n\nFatal assembly error: Source is not resolvable.\n", errors, {});
        assert_1.default.strictEqual(fatal, 'Fatal assembly error: Source is not resolvable.');
        assert_1.default.deepStrictEqual(errors, [{ path: 'src.dasm', line: 3, msg: "Unknown Mnemonic 'asl a'." }]);
    });
    // DASM 2.20.16 asserts in ShowSymbols() when there are no symbols to show,
    // but only after it has written the listing and the binary, so the tool
    // treats the trap as non-fatal when those files are there.
    it('still produces a listing and a binary when it traps on an empty symbol table', function () {
        const run = runDASM({ 'src.dasm': '\tprocessor 6502\n\torg $f000\n\tlda #1\n' }, 'src.dasm');
        assert_1.default.notStrictEqual(run.errno, 0);
        assert_1.default.strictEqual(run.symbols, ''); // written, but never filled in
        assert_1.default.deepStrictEqual(Array.from(run.output), [0xa9, 0x01]);
        const { errors, listings } = parseRun(run, ['src.dasm']);
        assert_1.default.deepStrictEqual(errors, []);
        assert_1.default.deepStrictEqual(listings['src.dasm'].lines.map((l) => l.line), [3]);
    });
    it('maps a real preset onto its sources', function () {
        const names = ['fullgame.a', 'vcs.h', 'macro.h', 'xmacro.h'];
        const files = {};
        files['fullgame.a'] = fs.readFileSync('./presets/vcs/examples/fullgame.a', 'utf8');
        for (const inc of ['vcs.h', 'macro.h', 'xmacro.h']) {
            files[inc] = fs.readFileSync('./presets/vcs/' + inc, 'utf8');
        }
        const run = runDASM(files, 'fullgame.a');
        assert_1.default.strictEqual(run.errno, 0, run.stdout);
        const { errors, listings } = parseRun(run, names);
        assert_1.default.deepStrictEqual(errors, []);
        let mincode = Infinity;
        for (const path of names) {
            const nlines = files[path].split('\n').length;
            for (const l of listings[path].lines) {
                // every mapped line has to exist in the file it points at
                assert_1.default.ok(l.line >= 1 && l.line <= nlines, `${l.path || path}:${l.line} is outside ${path} (${nlines} lines)`);
                // and every address has to be inside the 4K cartridge
                assert_1.default.ok(l.offset >= 0xf000 && l.offset <= 0xffff, `${l.path || path}:${l.line} is at $${l.offset.toString(16)}`);
                if (l.iscode && l.offset > 0)
                    mincode = Math.min(mincode, l.offset);
            }
        }
        // the origin the debugger infers from the listing
        assert_1.default.strictEqual(mincode, 0xf000);
        // the main file's own lines run forwards, in step with the addresses
        const own = listings['fullgame.a'].lines.filter((l) => !l.path);
        assert_1.default.ok(own.length > 200, `only ${own.length} lines mapped`);
        for (let i = 1; i < own.length; i++) {
            assert_1.default.ok(own[i].line > own[i - 1].line, `line ${own[i].line} follows ${own[i - 1].line}`);
        }
    });
    it('parses the symbol table', function () {
        const run = runDASM({ 'src.dasm': MACRO_SRC }, 'src.dasm');
        const symbolmap = (0, dasm_1.parseSymbolMap)(run.symbols);
        assert_1.default.strictEqual(symbolmap['foo'], 0xf000);
    });
});
//# sourceMappingURL=testdasm.js.map