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
const testlib_1 = require("../../src/tools/testlib");
const toolselect_1 = require("../../src/common/toolselect");
const emutarget_1 = require("../../src/tools/emutarget");
const emu_1 = require("../../src/common/emu");
// The CLI picks the tool for every file of a build the way the IDE's platform
// objects do (the getToolForFilename members in src/platform/*.ts). It gets
// there from the platform's arch, so an arch the table doesn't name would send
// that platform's linked files to the fallback -- sdcc, for a z80 -- and the
// build would fail on the second file rather than the first.
(0, mocha_1.describe)('tool selection by platform', () => {
    (0, mocha_1.it)('should use the 6502 tools for the PC Engine', () => {
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('pcegfx.c', 'pce'), 'cc65');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('pcegfx_tia.s', 'pce'), 'ca65');
    });
    (0, mocha_1.it)('should use the ARM tools for arm32', () => {
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('serialout.c', 'arm32'), 'armtcc');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('boot.vasm', 'arm32'), 'vasmarm');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('boot.armips', 'arm32'), 'armips');
    });
    (0, mocha_1.it)('should use the tools of the other architectures', () => {
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('main.c', 'c64'), 'cc65');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('main.c', 'coleco'), 'sdcc');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('main.c', 'williams'), 'cmoc');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('main.c', 'x86'), 'smlrc');
        assert_1.default.strictEqual((0, testlib_1.getToolForFilename)('main.v', 'verilog'), 'verilator');
    });
});
// Every platform object answers getToolForFilename from the shared table
// (src/common/toolselect.ts), so the IDE and the CLI can't disagree.
(0, mocha_1.describe)('tool selection table', () => {
    const EXTS = ['.c', '.h', '.s', '.a', '.asm', '.inc', '.ca65', '.dasm', '.acme', '.xa', '.wiz', '.ecs',
        '.cpp', '.cc', '.o64', '.bb', '.bas', '.fb', '.cc2600', '.cc7800', '.c78', '.lnk', '.nesasm',
        '-llvm.c', '.z', '.ns', '.scc', '.sgb', '.xasm', '.lwasm', '.vasm', '.armips', '.v', '.ice',
        '.dg', '.inf'];
    (0, mocha_1.it)('should agree with every platform object', async () => {
        (0, emutarget_1.installNodeMocks)();
        for (const entry of fs.readdirSync('src/platform')) {
            if (!entry.endsWith('.ts') || entry.startsWith('_'))
                continue;
            try {
                await Promise.resolve(`${'../../src/platform/' + entry.replace(/\.ts$/, '')}`).then(s => __importStar(require(s)));
            }
            catch (e) { }
        }
        const diffs = [];
        let checked = 0;
        for (const id of Object.keys(emu_1.PLATFORMS)) {
            let plat;
            try {
                plat = new emu_1.PLATFORMS[id](null);
            }
            catch (e) {
                continue;
            }
            if (!plat.getToolForFilename)
                continue;
            assert_1.default.ok((0, toolselect_1.getToolSelector)(id), `platform ${id} is not in the tool table`);
            checked++;
            for (const ext of EXTS) {
                const fn = 'main' + ext;
                const want = plat.getToolForFilename(fn), got = (0, toolselect_1.getToolForPlatform)(id, fn);
                if (want !== got)
                    diffs.push(`${id} ${fn}: platform=${want} table=${got}`);
            }
        }
        assert_1.default.ok(checked > 40, 'checked ' + checked + ' platforms');
        assert_1.default.deepStrictEqual(diffs, []);
    });
    (0, mocha_1.it)('should cover the platforms the old CLI table got wrong', () => {
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('atari7800', 'game.c78'), 'cc7800');
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('exidy', 'main.c'), 'cc65');
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('channelf', 'main.c'), 'cc65');
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('vcs', 'game-llvm.c'), 'remote:llvm-mos');
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('williams-z80', 'main.c'), 'sdcc');
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('williams', 'main.c'), 'cmoc');
    });
});
//# sourceMappingURL=testtoolselect.js.map