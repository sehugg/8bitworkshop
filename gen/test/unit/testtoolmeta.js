"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const toolmeta_1 = require("../../src/common/toolmeta");
// Node-friendly worker entry point (re-exports TOOLS without Worker wiring)
const workerlib_1 = require("../../src/worker/workerlib");
(0, mocha_1.describe)('Tool metadata registry', function () {
    (0, mocha_1.it)('every registry key matches its tool id', function () {
        for (let id in toolmeta_1.TOOL_META) {
            assert_1.default.strictEqual(toolmeta_1.TOOL_META[id].id, id, `TOOL_META['${id}'].id mismatch`);
        }
    });
    (0, mocha_1.it)('every worker build tool is registered (and vice versa)', function () {
        // worker TOOLS -> must exist in registry
        for (let id of Object.keys(workerlib_1.TOOLS)) {
            assert_1.default.ok(toolmeta_1.TOOL_META[id], `worker TOOLS['${id}'] missing from TOOL_META`);
        }
        // registry -> must have a worker build fn, unless explicitly deferred
        // or built on a remote server (llvm-mos)
        for (let id in toolmeta_1.TOOL_META) {
            let meta = toolmeta_1.TOOL_META[id];
            if (meta.noWorkerBuild || meta.remote)
                continue;
            assert_1.default.ok(workerlib_1.TOOLS[id], `TOOL_META['${id}'] missing from worker TOOLS`);
        }
    });
    (0, mocha_1.it)('getToolMeta strips the remote: transport prefix', function () {
        assert_1.default.strictEqual((0, toolmeta_1.getToolMeta)('remote:llvm-mos'), toolmeta_1.TOOL_META['llvm-mos']);
        assert_1.default.strictEqual((0, toolmeta_1.getToolMeta)('llvm-mos'), toolmeta_1.TOOL_META['llvm-mos']);
        assert_1.default.strictEqual((0, toolmeta_1.getToolMeta)('bogus'), undefined);
    });
    (0, mocha_1.it)('getToolMetaForFilename finds tools by extension', function () {
        assert_1.default.ok((0, toolmeta_1.getToolMetaForFilename)('foo.c').some(m => m.id === 'cc65'));
        assert_1.default.ok((0, toolmeta_1.getToolMetaForFilename)('foo.s').some(m => m.id === 'ca65'));
        assert_1.default.ok((0, toolmeta_1.getToolMetaForFilename)('foo.wiz').some(m => m.id === 'wiz'));
        assert_1.default.ok((0, toolmeta_1.getToolMetaForFilename)('foo.ecs').some(m => m.id === 'ecs'));
        assert_1.default.ok((0, toolmeta_1.getToolMetaForFilename)('foo.dg').some(m => m.id === 'dialog'));
        // unknown extension -> no matches
        assert_1.default.deepStrictEqual((0, toolmeta_1.getToolMetaForFilename)('foo.xyz'), []);
    });
    (0, mocha_1.it)('getPreloadFSName resolves per-platform filesystems', function () {
        assert_1.default.strictEqual((0, toolmeta_1.getPreloadFSName)('cc65', 'nes'), undefined); // WASI zip, not preloadFS
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('cc65', 'nes'), 'wasi:cc65-fs-nes.zip');
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('cc65', 'c64'), 'wasi:cc65-fs-c64.zip');
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('cc65', 'nonexistent'), undefined);
        // the 'default' config leads with whichever SDCC the project defaults to
        // (getSharedFileSystemName prefers preloadFS); platforms whose libraries
        // were built by 3.x always keep the 3.6.5 preloadFS.
        const defaultPreload = toolmeta_1.SDCC_DEFAULT_VERSION === 3 ? 'sdcc' : undefined;
        const defaultShared = toolmeta_1.SDCC_DEFAULT_VERSION === 3 ? 'sdcc' : 'wasi:sdcc-fs.zip';
        assert_1.default.strictEqual((0, toolmeta_1.getPreloadFSName)('sdcc'), defaultPreload);
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('sdcc', 'mw8080bw'), defaultShared);
        assert_1.default.strictEqual((0, toolmeta_1.getPreloadFSName)('sdcc', 'gb'), 'sdcc');
        assert_1.default.strictEqual((0, toolmeta_1.getPreloadFSName)('sdcc', 'msx-libcv'), 'sdcc');
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('sdcc', 'msx'), defaultShared);
        assert_1.default.strictEqual((0, toolmeta_1.getPreloadFSName)('dasm'), undefined);
    });
    (0, mocha_1.it)('getSharedFileSystemName resolves suffixed platform ids to their root base', function () {
        // atari8 runs as 'atari8-800' / 'atari8-5200' / *.xlmame variants
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('cc65', 'atari8'), 'wasi:cc65-fs-atari8.zip');
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('cc65', 'atari8-800'), 'wasi:cc65-fs-atari8.zip');
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('cc65', 'atari8-800.xlmame'), 'wasi:cc65-fs-atari8.zip');
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('cc65', 'atari8-5200'), 'wasi:cc65-fs-atari8.zip');
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('fastbasic', 'atari8-800'), 'wasi:cc65-fs-atari8.zip');
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('ecs', 'nes'), 'wasi:cc65-fs-nes.zip');
    });
    (0, mocha_1.it)('getSkeletonName defaults to the tool id', function () {
        assert_1.default.strictEqual((0, toolmeta_1.getSkeletonName)('dasm'), 'dasm');
        assert_1.default.strictEqual((0, toolmeta_1.getSkeletonName)('remote:llvm-mos'), 'llvm-mos');
    });
    (0, mocha_1.it)('getToolVersionLabel shows an alternate version when there is one', function () {
        // both SDCC releases are selectable, so show both (default first)
        let sdcc = toolmeta_1.SDCC_DEFAULT_VERSION === 3 ? '3.6.5 (default) / 4.6.0' : '4.6.0 (default) / 3.6.5';
        assert_1.default.strictEqual((0, toolmeta_1.getToolVersionLabel)(toolmeta_1.TOOL_META['sdcc']), sdcc);
        // single-version tools show just their version, unknown ones a dash
        assert_1.default.strictEqual((0, toolmeta_1.getToolVersionLabel)(toolmeta_1.TOOL_META['dasm']), '2.20.17');
        assert_1.default.strictEqual((0, toolmeta_1.getToolVersionLabel)(toolmeta_1.TOOL_META['basic']), '—');
        assert_1.default.strictEqual((0, toolmeta_1.getToolVersionLabel)(undefined), '—');
    });
    (0, mocha_1.it)('covers the previously-scattered editor styles and help URLs', function () {
        // spot-check ids that used to live in TOOL_TO_SOURCE_STYLE / TOOL_TO_HELPURL
        for (let id of ['dasm', 'acme', 'cc65', 'ca65', 'sdcc', 'cmoc', 'zmac',
            'nesasm', 'bataribasic', 'fastbasic', 'wiz', 'silice', 'ecs', 'dialog']) {
            assert_1.default.ok(toolmeta_1.TOOL_META[id], `expected tool '${id}' in registry`);
        }
        assert_1.default.strictEqual(toolmeta_1.TOOL_META['cc65'].editorStyle, 'text/x-csrc');
        assert_1.default.strictEqual(toolmeta_1.TOOL_META['ca65'].editorStyle, '6502');
        assert_1.default.ok(toolmeta_1.TOOL_META['dasm'].helpURL);
    });
    (0, mocha_1.it)('include patterns exist for tools that do dependency parsing', function () {
        assert_1.default.ok(toolmeta_1.TOOL_META['cc65'].includePatterns.length > 0);
        assert_1.default.ok(toolmeta_1.TOOL_META['verilator'].includePatterns.length > 0);
        assert_1.default.ok(toolmeta_1.TOOL_META['acme'].includePatterns.length > 0);
        assert_1.default.ok(toolmeta_1.TOOL_META['dialog'].includePatterns.length > 0);
        assert_1.default.ok(toolmeta_1.TOOL_META['wiz'].includePatterns.length > 0);
    });
    (0, mocha_1.it)('matches include directives for the tool that builds the file', function () {
        let deps = (text, tool, platform) => (0, toolmeta_1.matchDependencyPatterns)(text, (0, toolmeta_1.getIncludePatterns)(tool, platform));
        assert_1.default.deepStrictEqual(deps('#include "foo.h"\n', 'cc65'), ['foo.h']);
        assert_1.default.deepStrictEqual(deps('\t.include "foo.inc"\n', 'ca65'), ['foo.inc']);
        assert_1.default.deepStrictEqual(deps('//#resource "foo.bin"\n', 'dasm'), ['foo.bin']);
        // dasm also accepts unquoted include/incbin names
        assert_1.default.deepStrictEqual(deps('\tINCLUDE VCS.h\n\tINCLUDE macro.h\n', 'dasm'), ['VCS.h', 'macro.h']);
        assert_1.default.deepStrictEqual(deps(' .include foo.inc\n  incbin table.bin\n', 'dasm'), ['foo.inc', 'table.bin']);
        // quoted names stay matched by the shared pattern only (no duplicates)
        assert_1.default.deepStrictEqual(deps('\tinclude "vcs.h"\n', 'dasm'), ['vcs.h']);
        assert_1.default.deepStrictEqual(deps('!src "foo.acme"\n', 'acme'), ['foo.acme']);
        assert_1.default.deepStrictEqual(deps('%% #include "foo.dg"\n', 'dialog'), ['foo.dg']);
        assert_1.default.deepStrictEqual(deps('  USE foo.xasm\n', 'xasm6809'), ['foo.xasm']);
        // ecs uses both its own import and the shared .include directive
        assert_1.default.deepStrictEqual(deps('.include "vcs.h"\nimport "lib.ecs"\n', 'ecs'), ['vcs.h', 'lib.ecs']);
        // wiz: import gets an implicit .wiz extension, embed does not
        assert_1.default.deepStrictEqual(deps('import "nes";\nembed "map.bin";\n', 'wiz'), ['nes.wiz', 'map.bin']);
        // verilog: .arch names a .json file
        assert_1.default.deepStrictEqual(deps('`include "hvsync.v"\n.arch mynes\n', 'verilator'), ['hvsync.v', 'mynes.json']);
        // unknown tool falls back to the platform
        assert_1.default.deepStrictEqual(deps('`include "hvsync.v"\n', null, 'verilog'), ['hvsync.v']);
        assert_1.default.deepStrictEqual(deps('#include "foo.h"\n', null, 'c64'), ['foo.h']);
        // system includes (<foo.h>) are NOT build dependencies
        assert_1.default.deepStrictEqual(deps('#include <stdio.h>\n', 'cc65'), []);
        assert_1.default.deepStrictEqual(deps('#include <stdio.h>\n', 'sdcc'), []);
    });
    (0, mocha_1.it)('matches system include patterns for UI links only', function () {
        // tools with a bundled filesystem get system-include link patterns
        assert_1.default.deepStrictEqual((0, toolmeta_1.getSystemIncludePatterns)('cc65'), toolmeta_1.SYSTEM_INCLUDE_PATTERNS);
        assert_1.default.deepStrictEqual((0, toolmeta_1.getSystemIncludePatterns)('sdcc'), toolmeta_1.SYSTEM_INCLUDE_PATTERNS);
        // tools without one do not (dasm has no includeDirs)
        assert_1.default.deepStrictEqual((0, toolmeta_1.getSystemIncludePatterns)('dasm'), []);
        assert_1.default.deepStrictEqual((0, toolmeta_1.getSystemIncludePatterns)('bogus'), []);
        // ...and they extract the filename from <...>
        let deps = (text, tool) => (0, toolmeta_1.matchDependencyPatterns)(text, (0, toolmeta_1.getSystemIncludePatterns)(tool));
        assert_1.default.deepStrictEqual(deps('#include <stdio.h>\n', 'cc65'), ['stdio.h']);
        assert_1.default.deepStrictEqual(deps('  # include <atari7800.h>\n', 'cc65'), ['atari7800.h']);
        // quoted includes are not matched by the system patterns
        assert_1.default.deepStrictEqual(deps('#include "foo.h"\n', 'cc65'), []);
    });
    (0, mocha_1.it)('resolves shared filesystem names for all tools with includeDirs', function () {
        assert_1.default.equal((0, toolmeta_1.getSharedFileSystemName)('cc65', 'nes'), 'wasi:cc65-fs-nes.zip');
        // preloadFS-backed tools
        assert_1.default.equal((0, toolmeta_1.getSharedFileSystemName)('sdcc', 'coleco'), 'sdcc');
        assert_1.default.equal((0, toolmeta_1.getSharedFileSystemName)('bataribasic', 'vcs'), 'wasi:bb-fs.zip');
        assert_1.default.equal((0, toolmeta_1.getSharedFileSystemName)('wiz'), 'wiz');
        // WASI zip-backed tools (cc2600/cc7800/armtcc/oscar64/dialog)
        assert_1.default.equal((0, toolmeta_1.getSharedFileSystemName)('cc2600'), 'wasi:cc2600-fs.zip');
        assert_1.default.equal((0, toolmeta_1.getSharedFileSystemName)('cc7800'), 'wasi:cc7800-fs.zip');
        assert_1.default.equal((0, toolmeta_1.getSharedFileSystemName)('armtcc'), 'wasi:arm32-fs.zip');
        assert_1.default.equal((0, toolmeta_1.getSharedFileSystemName)('oscar64'), 'wasi:oscar64-fs.zip');
        assert_1.default.equal((0, toolmeta_1.getSharedFileSystemName)('dialog'), 'wasi:dialog-fs.zip');
        // tools without a bundled filesystem
        assert_1.default.equal((0, toolmeta_1.getSharedFileSystemName)('cmoc'), undefined);
        assert_1.default.equal((0, toolmeta_1.getSharedFileSystemName)('smlrc'), undefined);
        assert_1.default.equal((0, toolmeta_1.getSharedFileSystemName)('dasm'), undefined);
    });
    (0, mocha_1.it)('matches link directives only for tools that link', function () {
        let deps = (text, tool, platform) => (0, toolmeta_1.matchDependencyPatterns)(text, (0, toolmeta_1.getLinkPatterns)(tool, platform));
        assert_1.default.deepStrictEqual(deps('//#link "foo.c"\n', 'cc65'), ['foo.c']);
        assert_1.default.deepStrictEqual(deps(';#link "foo.s"\n', 'ca65'), ['foo.s']);
        assert_1.default.deepStrictEqual(deps('//#link "foo.v"\n', 'verilator'), []); // hdl tools don't link
        assert_1.default.deepStrictEqual(deps('//#link "foo.v"\n', null, 'verilog'), []);
    });
    (0, mocha_1.it)('parses verilog directives in .asm files built by jsasm', function () {
        // presets/verilog/test2.asm: .include "*.v" plus ".arch femto16"
        let text = '.include "cpu16.v"\n.arch femto16\n';
        let files = (0, toolmeta_1.matchDependencyPatterns)(text, (0, toolmeta_1.getIncludePatterns)('jsasm', 'verilog'));
        assert_1.default.deepStrictEqual(files, ['cpu16.v', 'femto16.json']);
        // and no shared-pattern duplicate of the .include
        assert_1.default.strictEqual(files.filter(f => f == 'cpu16.v').length, 1);
    });
    (0, mocha_1.it)('falls back to the platform when a tool declares no patterns', function () {
        // 'basic' has no includePatterns of its own -> platform default
        assert_1.default.deepStrictEqual((0, toolmeta_1.matchDependencyPatterns)('#include "foo.h"\n', (0, toolmeta_1.getIncludePatterns)('basic', 'c64')), ['foo.h']);
        // an explicit empty list means "this tool has no such directives"
        assert_1.default.deepStrictEqual((0, toolmeta_1.getLinkPatterns)('jsasm', 'verilog'), []);
    });
    (0, mocha_1.it)('resolves platform-specific tool help pages', function () {
        // cc65 publishes per-platform manuals; those win over the generic page
        assert_1.default.strictEqual((0, toolmeta_1.getToolHelpURL)('cc65', 'atari8'), 'https://cc65.github.io/doc/atari.html');
        assert_1.default.strictEqual((0, toolmeta_1.getToolHelpURL)('cc65', 'c64'), 'https://cc65.github.io/doc/c64.html');
        // suffixed platform ids resolve through their root base
        assert_1.default.strictEqual((0, toolmeta_1.getToolHelpURL)('cc65', 'atari8-800.xlmame'), 'https://cc65.github.io/doc/atari.html');
        // no platform-specific page -> the tool's generic helpURL
        assert_1.default.strictEqual((0, toolmeta_1.getToolHelpURL)('cc65', 'vector'), toolmeta_1.TOOL_META['cc65'].helpURL);
        assert_1.default.strictEqual((0, toolmeta_1.getToolHelpURL)('dasm', 'atari8'), toolmeta_1.TOOL_META['dasm'].helpURL);
        // tools with no docs at all, or unknown tools
        assert_1.default.strictEqual((0, toolmeta_1.getToolHelpURL)('ld65', 'atari8'), undefined);
        assert_1.default.strictEqual((0, toolmeta_1.getToolHelpURL)('bogus', 'atari8'), undefined);
    });
    (0, mocha_1.it)('getPlatformToolHelpURL only returns platform-specific pages', function () {
        assert_1.default.strictEqual((0, toolmeta_1.getPlatformToolHelpURL)('cc65', 'atari8'), 'https://cc65.github.io/doc/atari.html');
        assert_1.default.strictEqual((0, toolmeta_1.getPlatformToolHelpURL)('cc65', 'atari8-800.xlmame'), 'https://cc65.github.io/doc/atari.html');
        // generic-only tools have no platform-specific page
        assert_1.default.strictEqual((0, toolmeta_1.getPlatformToolHelpURL)('dasm', 'atari8'), undefined);
        assert_1.default.strictEqual((0, toolmeta_1.getPlatformToolHelpURL)('cc65', 'vector'), undefined);
        assert_1.default.strictEqual((0, toolmeta_1.getPlatformToolHelpURL)('bogus', 'atari8'), undefined);
    });
    (0, mocha_1.it)('rewinds shared global patterns between files', function () {
        // patterns are shared between tools and have the /g flag, so a stale
        // lastIndex would make the second scan miss the directive
        let pats = (0, toolmeta_1.getIncludePatterns)('cc65');
        assert_1.default.deepStrictEqual((0, toolmeta_1.matchDependencyPatterns)('#include "a.h"\n', pats), ['a.h']);
        assert_1.default.deepStrictEqual((0, toolmeta_1.matchDependencyPatterns)('#include "b.h"\n', pats), ['b.h']);
    });
});
//# sourceMappingURL=testtoolmeta.js.map