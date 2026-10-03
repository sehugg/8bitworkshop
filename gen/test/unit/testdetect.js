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
const path = __importStar(require("path"));
const detect_1 = require("../../src/common/detect");
const platforms_1 = require("../../src/worker/platforms");
const PRESETS = 'presets';
const PLATFORMS = Object.keys(platforms_1.PLATFORM_PARAMS).filter(p => p.indexOf('.') < 0);
function listing() {
    var out = {};
    for (var dir of fs.readdirSync(PRESETS)) {
        if (!PLATFORMS.includes(dir))
            continue;
        out[dir] = fs.readdirSync(path.join(PRESETS, dir));
    }
    return out;
}
function files(map) {
    return { files: Object.keys(map), read: (fn) => { var _a; return (_a = map[fn]) !== null && _a !== void 0 ? _a : null; }, platforms: PLATFORMS };
}
(0, mocha_1.describe)('detect', () => {
    (0, mocha_1.it)('reads the README badge', async () => {
        var badge = (0, detect_1.parseReadmeBadge)('Game\n\n[Open](http://8bitworkshop.com/redir.html?platform=vcs&githubURL=x&file=game.dasm).\n');
        assert_1.default.deepStrictEqual(badge, { platform: 'vcs', mainFile: 'game.dasm' });
        var d = await (0, detect_1.detectProject)(files({ 'README.md': '[x](https://8bitworkshop.com/?platform=nes&file=main.c)', 'main.c': '' }));
        assert_1.default.strictEqual(d[0].platform, 'nes');
        assert_1.default.strictEqual(d[0].mainFile, 'main.c');
        assert_1.default.strictEqual(d[0].score, 1);
    });
    (0, mocha_1.it)('finds NES from a header, with the line', async () => {
        var d = await (0, detect_1.detectProject)(files({ 'game.c': '\n#include "neslib.h"\nvoid main() {}\n' }));
        assert_1.default.strictEqual(d[0].platform, 'nes');
        assert_1.default.ok((0, detect_1.isClearWinner)(d));
        assert_1.default.strictEqual((0, detect_1.classifyFinding)(d), 'project');
        assert_1.default.deepStrictEqual(d[0].evidence[0], { file: 'game.c', line: 2, reason: 'includes "neslib.h"', kind: 'code' });
        assert_1.default.strictEqual(d[0].mainFile, 'game.c');
    });
    (0, mocha_1.it)('finds the VCS from TIA registers', async () => {
        var d = await (0, detect_1.detectProject)(files({ 'game.dasm': '  processor 6502\n  sta WSYNC\n  sta COLUBK\n' }));
        assert_1.default.strictEqual(d[0].platform, 'vcs');
    });
    (0, mocha_1.it)('tells the Atari 8-bit family apart by header', async () => {
        // atari.h is guarded by __ATARI__ (800); atari5200.h by __ATARI5200__
        var d = await (0, detect_1.detectProject)(files({ 'game.c': '#include <atari.h>\nvoid main() {}\n' }));
        assert_1.default.strictEqual(d[0].platform, 'atari8-800');
        d = await (0, detect_1.detectProject)(files({ 'game.c': '#include <atari5200.h>\nvoid main() {}\n' }));
        assert_1.default.strictEqual(d[0].platform, 'atari8-5200');
    });
    (0, mocha_1.it)('prefers the folder name over a shared Atari library header', async () => {
        var map = {
            'game.c': '#include <atari.h>\nvoid main() {}\n',
            'a8lib.h': '#if defined(__ATARI5200__)\n#include <atari5200.h>\n#else\n#include <atari.h>\n#endif\n',
        };
        var d = await (0, detect_1.detectProject)({ files: Object.keys(map), read: (fn) => map[fn], platforms: PLATFORMS, dirName: 'atari8-800' });
        assert_1.default.strictEqual(d[0].platform, 'atari8-800');
        assert_1.default.ok((0, detect_1.isClearWinner)(d));
    });
    (0, mocha_1.it)('says nothing about plain C', async () => {
        var d = await (0, detect_1.detectProject)(files({ 'util.c': 'int add(int a, int b) { return a + b; }\n', 'util.h': 'int add(int, int);\n' }));
        assert_1.default.ok(d.every(x => x.score < 0.5), JSON.stringify(d));
        assert_1.default.ok(!(0, detect_1.isClearWinner)(d));
    });
    (0, mocha_1.it)('reads a cc65 target from a Makefile', async () => {
        var d = await (0, detect_1.detectProject)(files({ 'Makefile': 'all:\n\tcl65 -t c64 -o game.prg game.c\n', 'game.c': 'void main() {}\n' }));
        assert_1.default.strictEqual(d[0].platform, 'c64');
    });
    (0, mocha_1.it)('knows assembler dialects', () => {
        assert_1.default.strictEqual((0, detect_1.detectDialect)('.segment "CODE"\n  lda #0\n'), 'ca65');
        assert_1.default.strictEqual((0, detect_1.detectDialect)('  processor 6502\n  seg code\n'), 'dasm');
        assert_1.default.strictEqual((0, detect_1.detectDialect)('  lda #0\n'), null);
        // .asm builds with dasm on the NES; ca65 code needs ca65
        assert_1.default.strictEqual((0, detect_1.toolForDialect)('nes', 'game.asm', '.segment "CODE"\n'), 'ca65');
        assert_1.default.strictEqual((0, detect_1.toolForDialect)('nes', 'game.s', '.segment "CODE"\n'), undefined);
        assert_1.default.strictEqual((0, detect_1.toolForDialect)('nes', 'game.asm', '  processor 6502\n'), undefined);
    });
    (0, mocha_1.it)('picks one main file, or none for a directory of programs', () => {
        var texts = new Map([['main.c', '#include "util.h"\n//#link "sprites.c"\nvoid main() {}\n'], ['sprites.c', 'void draw() {}\n']]);
        assert_1.default.deepStrictEqual((0, detect_1.findMainCandidates)('nes', [...texts.keys()], texts), { candidates: ['main.c'], mainFile: 'main.c' });
        texts = new Map([['a.c', 'void main() {}\n'], ['b.c', 'void main() {}\n']]);
        assert_1.default.deepStrictEqual((0, detect_1.findMainCandidates)('nes', [...texts.keys()], texts), { candidates: ['a.c', 'b.c'], mainFile: undefined });
        // C without main() is a library, whatever links it
        texts = new Map([['game.s', 'reset: jmp reset\n'], ['util.c', 'int add(int a, int b) { return a + b; }\n']]);
        assert_1.default.deepStrictEqual((0, detect_1.findMainCandidates)('nes', [...texts.keys()], texts), { candidates: ['game.s'], mainFile: 'game.s' });
    });
    (0, mocha_1.it)('downweights a fingerprint found in a header', async () => {
        var _a;
        // the GBDK calls are library declarations, not a program using the hardware
        var header = 'void display_off();\nvoid SHOW_BKG();\nvoid set_bkg_data();\n';
        var d = await (0, detect_1.detectProject)({ files: ['gb.h'], read: () => header, platforms: PLATFORMS, dirName: 'gb' });
        assert_1.default.ok(d.every(x => x.score < 0.5), JSON.stringify(d));
        assert_1.default.ok(d[0].score > 0, 'the header still counts for something');
        assert_1.default.strictEqual((0, detect_1.classifyFinding)(d), undefined, 'but a header alone is no project');
        assert_1.default.ok((0, detect_1.isHeaderFile)('gb/gb.h'));
        assert_1.default.ok(!(0, detect_1.isHeaderFile)('gb/gb.sgb'));
        assert_1.default.strictEqual((_a = (0, detect_1.mainEvidence)(d[0])) === null || _a === void 0 ? void 0 : _a.reason, 'calls GBDK functions');
    });
    (0, mocha_1.it)('passes over a toolchain library folder', async () => {
        // src/worker/lib/vcs: a linker config and startup code, in a folder named for the platform
        var d = await (0, detect_1.detectProject)(Object.assign(Object.assign({}, files({ 'atari2600.cfg': 'MEMORY {}\n', 'crt0.s': '  .export _init\n_init: rts\n' })), { dirName: 'vcs' }));
        assert_1.default.strictEqual(d[0].platform, 'vcs');
        assert_1.default.ok(d[0].score >= 0.5, 'enough score...');
        assert_1.default.notStrictEqual((0, detect_1.classifyFinding)(d), 'project', '...but no program code');
        assert_1.default.strictEqual(d[0].mainFile, undefined, 'crt0 is not a program');
        // src/worker/lib/vectrex: headers including headers
        d = await (0, detect_1.detectProject)(Object.assign(Object.assign({}, files({ 'bios.h': '#include "vectrex.h"\n' })), { dirName: 'vectrex' }));
        assert_1.default.ok(d[0].score >= 0.5);
        assert_1.default.strictEqual((0, detect_1.classifyFinding)(d), undefined);
    });
    (0, mocha_1.it)('offers a folder of ROMs only as potential', async () => {
        var d = await (0, detect_1.detectProject)({ files: ['croom.nes'], read: () => null, platforms: PLATFORMS });
        assert_1.default.ok((0, detect_1.isClearWinner)(d), 'the CLI can still run it');
        assert_1.default.strictEqual((0, detect_1.classifyFinding)(d), 'potential');
    });
    (0, mocha_1.it)('offers an ambiguous strong detection as potential', async () => {
        var d = await (0, detect_1.detectProject)(files({ 'game.c': '#include <cbm.h>\nvoid main() { POKE(0xd020, 0); VIC.bgcolor0 = 1; }\n' }));
        assert_1.default.ok(d[0].score >= 0.5 && d[1].score >= 0.5, JSON.stringify(d));
        assert_1.default.ok(!(0, detect_1.isClearWinner)(d));
        assert_1.default.strictEqual((0, detect_1.classifyFinding)(d), 'potential');
    });
    (0, mocha_1.it)('keeps subfolders part of their project', () => {
        var main = { platform: 'vcs', score: 1, evidence: [], mainFile: 'main.asm' };
        var part = { platform: 'vcs', score: 0.5, evidence: [], mainFile: 'kernel.asm' };
        var programs = { platform: 'nes', score: 1, evidence: [], mainCandidates: ['a.c', 'b.c'] };
        var kept = (0, detect_1.dropNestedFindings)([
            { dir: 'nyancat', detection: main },
            { dir: 'nyancat/bank1/code', detection: part },
            { dir: 'nyancat2', detection: part },
            { dir: 'presets/nes', detection: programs },
            { dir: 'presets/nes/chase', detection: part },
            { dir: 'presets/nes/lib', detection: Object.assign(Object.assign({}, part), { mainFile: undefined }) },
        ]).map(f => f.dir);
        assert_1.default.deepStrictEqual(kept, ['nyancat', 'nyancat2', 'presets/nes', 'presets/nes/chase']);
    });
    (0, mocha_1.it)('prompts for a folder made of projects, not a big repo', () => {
        // ~/emu/workspace: a folder of cloned project repos
        var repos = ['2048', 'chase', 'falling', 'genemedic', 'guntner', 'mango', 'pacman'];
        assert_1.default.ok((0, detect_1.isMadeOfProjects)(repos, [...repos, 'guntner/exports', 'scripts']));
        // the 8bitworkshop repo: projects under a few of many top-level folders
        var projects = ['src/worker/lib/verilog', 'test/ecs', 'tmp', 'presets/nes', 'presets/c64', 'presets/vcs', 'presets/gb', 'presets/apple2', 'presets/zx'];
        var dirs = [...projects, 'src/common', 'css', 'res', 'gen', 'doc', 'scripts', 'extension', 'images', 'web', 'meta'];
        assert_1.default.ok(!(0, detect_1.isMadeOfProjects)(projects, dirs));
        assert_1.default.ok((0, detect_1.isMadeOfProjects)(['presets/nes', 'presets/c64'], dirs), 'a few projects anywhere still count');
    });
    (0, mocha_1.it)('lists every program in a folder of programs', async () => {
        var programs = ['chase.c', 'climber.c', 'testphys.c'];
        var map = {};
        for (var fn of programs)
            map[fn] = '#include "gb/gb.h"\nvoid main() {}\n';
        var d = await (0, detect_1.detectProject)({ files: programs, read: (fn) => { var _a; return (_a = map[fn]) !== null && _a !== void 0 ? _a : null; }, platforms: PLATFORMS, headers: { 'gb/gb.h': ['gb'] }, dirName: 'gb' });
        assert_1.default.strictEqual(d[0].platform, 'gb');
        assert_1.default.strictEqual(d[0].mainFile, undefined);
        assert_1.default.deepStrictEqual(d[0].mainCandidates, programs);
        assert_1.default.ok((0, detect_1.isFolderOfPrograms)(d[0]));
        assert_1.default.strictEqual((0, detect_1.detectionSummary)(d[0]), '3 programs');
        assert_1.default.strictEqual((0, detect_1.describeFinding)(d[0]), '3 programs — chase.c:1 includes "gb/gb.h"');
    });
    // Every preset's true platform is its directory. Track how often the top
    // guess for a lone preset file is right, and fail if it gets worse.
    (0, mocha_1.it)('guesses the platform of the presets', async function () {
        this.timeout(60000);
        var dirs = listing();
        var headers = (0, detect_1.headersFromPresets)(dirs);
        var total = 0, right = 0, wrong = [];
        for (var dir in dirs) {
            for (var fn of dirs[dir]) {
                if (fn.endsWith('~') || fn.startsWith('skeleton.'))
                    continue;
                if (!/\.(c|s|asm|dasm|ca65|acme|z|wiz|bas|v|xasm|cc2600|cc7800)$/.test(fn))
                    continue;
                var text = fs.readFileSync(path.join(PRESETS, dir, fn), 'utf-8');
                var d = await (0, detect_1.detectProject)({ files: [fn], read: () => text, platforms: PLATFORMS, headers });
                total++;
                // members of a family that share every header count as right
                var family = (p) => p.replace(/^(sms-.*|msx-libcv|coleco)$/, 'libcv').replace(/^(atari8|astrocade|williams).*$/, '$1');
                // a tie for first place still puts the right platform in the pick list
                var top = d.length ? d[0].score : 0;
                if (d.length && d.some(x => x.score === top && family(x.platform) === family(dir)))
                    right++;
                else
                    wrong.push(`${dir}/${fn} -> ${d.length ? d[0].platform + ' ' + d[0].score : 'nothing'}`);
            }
        }
        var accuracy = right / total;
        console.log(`detect: ${right}/${total} presets (${Math.round(accuracy * 100)}%)`);
        if (process.env.DETECT_VERBOSE)
            console.log(wrong.join('\n'));
        assert_1.default.ok(accuracy >= ACCURACY_BASELINE, `accuracy ${accuracy} < ${ACCURACY_BASELINE}\n` + wrong.slice(0, 40).join('\n'));
    });
});
// raise this when detection improves
const ACCURACY_BASELINE = 0.7;
//# sourceMappingURL=testdetect.js.map