"use strict";
/*
 * Tool metadata registry.
 *
 * Single source of truth for declarative (data-only) metadata about every
 * build tool, keyed by tool id. Both the IDE (src/ide) and the worker
 * (src/worker) import this module.
 *
 * What lives here:
 *   - extension -> tool selection hints
 *   - editor (CodeMirror) styles and help URLs        (was TOOL_TO_SOURCE_STYLE/HELPURL in src/ide/ui.ts)
 *   - preload filesystem names per platform            (was TOOL_PRELOADFS in src/worker/workertools.ts)
 *   - wasm module names                                (was loadNative() args in src/worker/tools/*.ts)
 *   - include/link dependency patterns                 (was parseIncludeDependencies in src/ide/project.ts)
 *   - remote/server tool config                        (was ServerBuildTool in src/worker/server/buildenv.ts)
 *
 * What stays OUT of this module (behavior cannot cross the worker boundary):
 *   - build functions (src/worker/workertools.ts `TOOLS` map)
 *   - error matchers, listing parsers (src/worker/tools/*.ts)
 *   - machine layout params (code_start, rom_size, ... -> src/worker/platforms.ts PLATFORM_PARAMS)
 *
 * A unit test cross-checks that every id in TOOL_META has a worker build fn
 * (unless noWorkerBuild) and vice versa.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_META = exports.DIALOG_INCLUDE_PATTERNS = exports.ECS_INCLUDE_PATTERNS = exports.WIZ_INCLUDE_PATTERNS = exports.ACME_INCLUDE_PATTERNS = exports.USE_ASM_INCLUDE_PATTERNS = exports.VERILOG_INCLUDE_PATTERNS = exports.SHARED_LINK_PATTERNS = exports.SHARED_INCLUDE_PATTERNS = void 0;
exports.getToolMeta = getToolMeta;
exports.getToolMetaForFilename = getToolMetaForFilename;
exports.getPreloadFSName = getPreloadFSName;
exports.getSkeletonName = getSkeletonName;
exports.getIncludePatterns = getIncludePatterns;
exports.getLinkPatterns = getLinkPatterns;
exports.matchDependencyPatterns = matchDependencyPatterns;
//// shared dependency-parsing patterns (from src/ide/project.ts)
// C / most assemblers: [.#%]?include|incbin|embed "file", //#resource "file"
exports.SHARED_INCLUDE_PATTERNS = [
    /^\s*[.#%]?(include|incbin|embed)\s+"(.+?)"/gmi,
    /^\s*([;']|[/][/])#(resource)\s+"(.+?)"/gm,
];
// C / most assemblers: //#link "file" (or ;link)
exports.SHARED_LINK_PATTERNS = [
    /^\s*([;]|[/][/])#link\s+"(.+?)"/gm,
];
// Verilog family: `include/.include, $include/$dofile/$write_image_in_table,
// .arch json, $readmem[bh]
exports.VERILOG_INCLUDE_PATTERNS = [
    /^\s*(`include|[.]include)\s+"(.+?)"/gmi,
    /^\s*\$(include|\$dofile|\$write_image_in_table)\('(.+?)'/gmi,
    { re: /^\s*([.]arch)\s+(\w+)/gmi, suffix: '.json' },
    /\$readmem[bh]\("(.+?)"/gmi,
];
// xasm6809 (USE) and merlin32 (ASM): "  USE file.ext"
exports.USE_ASM_INCLUDE_PATTERNS = [
    /^\s+(USE|ASM)\s+(\S+[.]\S+)/gm,
];
// acme: !src "file"
exports.ACME_INCLUDE_PATTERNS = [
    /^[!]src\s+"(.+?)"/gmi,
];
// wiz: import "file"; (implicit .wiz extension) / embed "file";
exports.WIZ_INCLUDE_PATTERNS = [
    { re: /^\s*import\s*"(.+?)";/gmi, suffix: '.wiz' },
    /^\s*embed\s*"(.+?)";/gmi,
];
// ecs: import "file"
exports.ECS_INCLUDE_PATTERNS = [
    /^\s*(import)\s*"(.+?)"/gmi,
];
// dialog: %% #include "file" (comment directive)
exports.DIALOG_INCLUDE_PATTERNS = [
    /^\s*%%\s*#include\s+"(.+?)"/gm,
];
//// preload filesystem names per tool/platform (was TOOL_PRELOADFS)
const CC65_PRELOADFS = {
    'apple2': { preloadFS: '65-apple2' },
    'c64': { preloadFS: '65-c64' },
    'vic20': { preloadFS: '65-vic20' },
    'nes': { preloadFS: '65-nes' },
    'atari8': { preloadFS: '65-atari8' },
    'vector': { preloadFS: '65-none' },
    'atari7800': { preloadFS: '65-none' },
    'devel': { preloadFS: '65-none' },
    'vcs': { preloadFS: '65-atari2600' },
    'pce': { preloadFS: '65-pce' },
    'exidy': { preloadFS: '65-none' },
};
//// tool registry
exports.TOOL_META = {
    // ---- 6502 assemblers ----
    dasm: {
        id: 'dasm', name: 'DASM', kind: 'assembler', arch: '6502',
        extensions: ['.dasm'],
        editorStyle: '6502',
        helpURL: 'https://raw.githubusercontent.com/sehugg/dasm/master/doc/dasm.txt',
        wasmModule: 'dasm',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    acme: {
        id: 'acme', name: 'ACME', kind: 'assembler', arch: '6502',
        extensions: ['.acme'],
        editorStyle: '6502',
        helpURL: 'https://raw.githubusercontent.com/sehugg/acme/main/docs/QuickRef.txt',
        wasmModule: 'acme',
        includePatterns: [...exports.SHARED_INCLUDE_PATTERNS, ...exports.ACME_INCLUDE_PATTERNS],
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    xa: {
        id: 'xa', name: 'XA', kind: 'assembler', arch: '6502',
        extensions: ['.xa'],
        editorStyle: '6502',
        helpURL: 'https://www.floodgap.com/retrotech/xa/',
        wasmModule: 'xa',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    nesasm: {
        id: 'nesasm', name: 'NESASM', kind: 'assembler', arch: '6502',
        extensions: ['.nesasm'],
        editorStyle: '6502',
        wasmModule: 'nesasm',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    merlin32: {
        id: 'merlin32', name: 'Merlin 32', kind: 'assembler', arch: '6502',
        extensions: ['.lnk'],
        editorStyle: '6502',
        wasmModule: 'merlin32',
        includePatterns: [...exports.SHARED_INCLUDE_PATTERNS, ...exports.USE_ASM_INCLUDE_PATTERNS],
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    // ---- cc65 toolchain ----
    cc65: {
        id: 'cc65', name: 'cc65', kind: 'compiler', arch: '6502',
        extensions: ['.c', '.h'],
        editorStyle: 'text/x-csrc',
        helpURL: 'https://cc65.github.io/doc/cc65.html',
        wasmModule: 'cc65',
        platforms: CC65_PRELOADFS,
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    ca65: {
        id: 'ca65', name: 'ca65', kind: 'assembler', arch: '6502',
        extensions: ['.s', '.ca65'],
        editorStyle: '6502',
        helpURL: 'https://cc65.github.io/doc/ca65.html',
        wasmModule: 'ca65',
        platforms: CC65_PRELOADFS,
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    ld65: {
        id: 'ld65', name: 'ld65', kind: 'linker', arch: '6502',
        extensions: [],
        wasmModule: 'ld65',
    },
    // ---- SDCC toolchain (z80) ----
    sdcc: {
        id: 'sdcc', name: 'SDCC', kind: 'compiler', arch: 'z80',
        extensions: ['.c', '.h'],
        editorStyle: 'text/x-csrc',
        helpURL: 'http://sdcc.sourceforge.net/doc/sdccman.pdf',
        wasmModule: 'sdcc',
        platforms: { default: { preloadFS: 'sdcc' } },
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    sdasz80: {
        id: 'sdasz80', name: 'sdasz80', kind: 'assembler', arch: 'z80',
        extensions: ['.s'],
        editorStyle: 'z80',
        wasmModule: 'sdasz80',
        platforms: { default: { preloadFS: 'sdcc' } },
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    sdasgb: {
        id: 'sdasgb', name: 'sdasgb', kind: 'assembler', arch: 'gbz80',
        extensions: ['.sgb'],
        editorStyle: 'z80',
        wasmModule: 'sdasgb',
        platforms: { default: { preloadFS: 'sdcc' } },
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    sdldz80: {
        id: 'sdldz80', name: 'sdldz80', kind: 'linker', arch: 'z80',
        extensions: [],
        wasmModule: 'sdldz80',
    },
    sccz80: {
        id: 'sccz80', name: 'sccz80', kind: 'compiler', arch: 'z80',
        extensions: ['.scc'],
        platforms: { default: { preloadFS: 'sccz80' } },
        noWorkerBuild: true,
    },
    naken: {
        id: 'naken', name: 'Naken', kind: 'assembler',
        extensions: ['.ns'],
        noWorkerBuild: true,
    },
    // ---- z80 assemblers ----
    zmac: {
        id: 'zmac', name: 'zmac', kind: 'assembler', arch: 'z80',
        extensions: ['.z'],
        editorStyle: 'z80',
        helpURL: 'https://raw.githubusercontent.com/sehugg/zmac/master/doc.txt',
        wasmModule: 'zmac',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    jsasm: {
        id: 'jsasm', name: 'JSASM', kind: 'assembler',
        extensions: ['.asm'],
        editorStyle: 'z80',
        // pure JS assembler, no wasm module. Only used on the verilog platform,
        // where .asm files pull in .v modules and name a CPU with '.arch'.
        includePatterns: exports.VERILOG_INCLUDE_PATTERNS,
        linkPatterns: [],
    },
    // ---- 6809 toolchain ----
    xasm6809: {
        id: 'xasm6809', name: 'XASM6809', kind: 'assembler', arch: '6809',
        extensions: ['.xasm'],
        editorStyle: '6809',
        wasmModule: 'xasm6809',
        includePatterns: [...exports.SHARED_INCLUDE_PATTERNS, ...exports.USE_ASM_INCLUDE_PATTERNS],
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    cmoc: {
        id: 'cmoc', name: 'CMOC', kind: 'compiler', arch: '6809',
        extensions: ['.c', '.h'],
        editorStyle: 'text/x-csrc',
        helpURL: 'http://perso.b2b2c.ca/~sarrazip/dev/cmoc.html',
        wasmModule: 'cmoc',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    lwasm: {
        id: 'lwasm', name: 'LWASM', kind: 'assembler', arch: '6809',
        extensions: ['.lwasm'],
        wasmModule: 'lwasm',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    lwlink: {
        id: 'lwlink', name: 'LWLINK', kind: 'linker', arch: '6809',
        extensions: [],
        wasmModule: 'lwlink',
    },
    // ---- ARM ----
    vasmarm: {
        id: 'vasmarm', name: 'vasm (ARM)', kind: 'assembler', arch: 'arm32',
        extensions: ['.vasm'],
        editorStyle: 'vasm',
        wasmModule: 'vasmarm_std',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    armips: {
        id: 'armips', name: 'armips', kind: 'assembler', arch: 'arm32',
        extensions: ['.armips'],
        editorStyle: 'vasm',
        wasmModule: 'armips',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    armtcc: {
        id: 'armtcc', name: 'TCC (ARM)', kind: 'compiler', arch: 'arm32',
        extensions: ['.c', '.s'],
        editorStyle: 'text/x-csrc',
        wasmModule: 'arm-tcc',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    armtcclink: {
        id: 'armtcclink', name: 'TCC (ARM) link', kind: 'linker', arch: 'arm32',
        extensions: [],
        wasmModule: 'arm-tcc',
    },
    // ---- x86 ----
    smlrc: {
        id: 'smlrc', name: 'SmallerC', kind: 'compiler', arch: 'x86',
        extensions: ['.c'],
        editorStyle: 'text/x-csrc',
        wasmModule: 'smlrc',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    yasm: {
        id: 'yasm', name: 'YASM', kind: 'assembler', arch: 'x86',
        extensions: ['.asm'],
        editorStyle: 'gas',
        wasmModule: 'yasm',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    // ---- 6502 C compilers / BASIC dialects ----
    oscar64: {
        id: 'oscar64', name: 'Oscar64', kind: 'compiler', arch: '6502',
        extensions: ['.c', '.cpp', '.cc', '.o64'],
        editorStyle: 'text/x-csrc',
        helpURL: 'https://github.com/drmortalwombat/oscar64/blob/main/oscar64.md',
        wasmModule: 'oscar64',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    bataribasic: {
        id: 'bataribasic', name: 'batari Basic', kind: 'compiler', arch: '6502',
        extensions: ['.bb', '.bas'],
        editorStyle: 'bataribasic',
        helpURL: 'help/bataribasic/manual.html',
        wasmModule: 'bb2600basic',
        platforms: { default: { preloadFS: '2600basic' } },
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    fastbasic: {
        id: 'fastbasic', name: 'FastBasic', kind: 'compiler', arch: '6502',
        extensions: ['.bas', '.fb', '.fbi'],
        editorStyle: 'fastbasic',
        helpURL: 'https://github.com/dmsc/fastbasic/blob/master/manual.md',
        wasmModule: 'fastbasic-int',
        platforms: { default: { preloadFS: '65-atari8' } },
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    cc2600: {
        id: 'cc2600', name: 'CC2600', kind: 'compiler', arch: '6502',
        extensions: ['.cc2600'],
        editorStyle: 'text/x-csrc',
        wasmModule: 'cc2600',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    cc7800: {
        id: 'cc7800', name: 'CC7800', kind: 'compiler', arch: '6502',
        extensions: ['.cc7800', '.c78'],
        editorStyle: 'text/x-csrc',
        wasmModule: 'cc7800',
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
    },
    // ---- other languages ----
    basic: {
        id: 'basic', name: 'BASIC', kind: 'interpreter',
        extensions: ['.bas'],
        editorStyle: 'basic',
    },
    wiz: {
        id: 'wiz', name: 'wiz', kind: 'compiler',
        extensions: ['.wiz'],
        editorStyle: 'text/x-wiz',
        helpURL: 'https://github.com/wiz-lang/wiz/blob/master/readme.md#wiz',
        wasmModule: 'wiz',
        platforms: { default: { preloadFS: 'wiz' } },
        includePatterns: exports.WIZ_INCLUDE_PATTERNS,
    },
    ecs: {
        id: 'ecs', name: 'ECS', kind: 'assembler', arch: '6502',
        extensions: ['.ecs'],
        editorStyle: 'ecs',
        platforms: {
            vcs: { preloadFS: '65-atari2600' },
            nes: { preloadFS: '65-nes' },
            c64: { preloadFS: '65-c64' },
        },
        includePatterns: [...exports.SHARED_INCLUDE_PATTERNS, ...exports.ECS_INCLUDE_PATTERNS],
    },
    inform6: {
        id: 'inform6', name: 'Inform 6', kind: 'compiler', arch: 'zmachine',
        extensions: ['.inf'],
        editorStyle: 'inform6',
        wasmModule: 'inform',
        platforms: { default: { preloadFS: 'inform' } },
    },
    dialog: {
        id: 'dialog', name: 'Dialog', kind: 'compiler', arch: 'zmachine',
        extensions: ['.dg'],
        editorStyle: 'dialog',
        helpURL: 'https://linusakesson.net/dialog/docs/',
        wasmModule: 'dialogc',
        includePatterns: exports.DIALOG_INCLUDE_PATTERNS,
    },
    // ---- verilog / HDL ----
    verilator: {
        id: 'verilator', name: 'Verilator', kind: 'hdl', arch: 'verilog',
        extensions: ['.v'],
        editorStyle: 'verilog',
        helpURL: 'https://www.veripool.org/ftp/verilator_doc.pdf',
        wasmModule: 'verilator_bin',
        includePatterns: exports.VERILOG_INCLUDE_PATTERNS,
        linkPatterns: [],
    },
    yosys: {
        id: 'yosys', name: 'Yosys', kind: 'hdl', arch: 'verilog',
        extensions: [],
        wasmModule: 'yosys',
        includePatterns: exports.VERILOG_INCLUDE_PATTERNS,
        linkPatterns: [],
    },
    silice: {
        id: 'silice', name: 'Silice', kind: 'hdl', arch: 'verilog',
        extensions: ['.ice'],
        editorStyle: 'verilog',
        helpURL: 'https://github.com/sylefeb/Silice',
        wasmModule: 'silice',
        platforms: { default: { preloadFS: 'Silice' } },
        includePatterns: exports.VERILOG_INCLUDE_PATTERNS,
        linkPatterns: [],
    },
    // ---- remote / server ----
    'llvm-mos': {
        id: 'llvm-mos', name: 'LLVM-MOS', kind: 'compiler', arch: '6502',
        extensions: ['.c', '.cpp', '.s', '.S', '.C'],
        editorStyle: 'text/x-csrc', // used as 'remote:llvm-mos' in the IDE
        helpURL: 'https://llvm-mos.org/wiki/Welcome',
        remote: true,
        includePatterns: exports.SHARED_INCLUDE_PATTERNS,
        linkPatterns: exports.SHARED_LINK_PATTERNS,
        server: {
            version: 'latest',
            platforms: ['atari8', 'c64', 'nes', 'pce', 'vcs'],
            binpath: 'llvm-mos/bin',
            command: 'mos-clang',
            args: ['-Os', '-g', '-D', '__8BITWORKSHOP__', '-o', '$OUTFILE', '$INFILES'],
        },
    },
    // TODO: do we need this too?
    remote: {
        id: 'remote', name: 'Remote build', kind: 'remote',
        extensions: [],
        remote: true,
    },
};
//// helpers
/**
 * Look up tool metadata by tool id. Tolerates the 'remote:' transport prefix
 * used in build steps (e.g. 'remote:llvm-mos' -> 'llvm-mos').
 */
function getToolMeta(id) {
    return exports.TOOL_META[id.replace(/^remote:/, '')];
}
/**
 * Return all tools that consume the given filename (longest extension match
 * first). Ambiguity is resolved by the platform, which picks from these.
 */
function getToolMetaForFilename(fn) {
    let matches = [];
    for (let id in exports.TOOL_META) {
        let meta = exports.TOOL_META[id];
        for (let ext of meta.extensions) {
            if (ext && fn.endsWith(ext)) {
                matches.push({ meta, len: ext.length });
                break;
            }
        }
    }
    return matches.sort((a, b) => b.len - a.len).map(m => m.meta);
}
/**
 * Resolve the preload filesystem name for a tool on a platform
 * (was TOOL_PRELOADFS, including compound 'tool-platform' keys).
 */
function getPreloadFSName(tool, platform) {
    let meta = getToolMeta(tool);
    if (!meta)
        return undefined;
    if (meta.platforms) {
        if (platform) {
            let p = meta.platforms[platform];
            if (p && p.preloadFS)
                return p.preloadFS;
        }
        let d = meta.platforms['default'];
        if (d && d.preloadFS)
            return d.preloadFS;
    }
    return undefined;
}
/** Skeleton filename in presets/<platform>/, defaults to tool id. */
function getSkeletonName(tool) {
    let meta = getToolMeta(tool);
    return (meta && meta.skeleton) ? meta.skeleton : tool.replace(/^remote:/, '');
}
/**
 * Include patterns to use when scanning a source file for dependencies.
 * Falls back to the platform (verilog vs. everything else) when the tool is
 * unknown or declares no patterns of its own, which is how dependency parsing
 * worked before this registry. A tool that really has no include directives
 * says so with an explicit empty list.
 */
function getIncludePatterns(tool, platform) {
    let meta = tool && getToolMeta(tool);
    if (meta && meta.includePatterns)
        return meta.includePatterns;
    if (platform && platform.startsWith('verilog'))
        return exports.VERILOG_INCLUDE_PATTERNS;
    return exports.SHARED_INCLUDE_PATTERNS;
}
/** Link patterns ("//#link") to use when scanning a source file. */
function getLinkPatterns(tool, platform) {
    let meta = tool && getToolMeta(tool);
    if (meta && meta.linkPatterns)
        return meta.linkPatterns;
    if (platform && platform.startsWith('verilog'))
        return [];
    return exports.SHARED_LINK_PATTERNS;
}
/**
 * Run a set of include/link patterns over source text, returning the
 * referenced filenames. The filename comes from the pattern's `group`, or
 * from the last capture group if unspecified, plus any implicit `suffix`.
 */
function matchDependencyPatterns(text, patterns) {
    let files = [];
    for (let pat of patterns || []) {
        let p = pat instanceof RegExp ? { re: pat } : pat;
        let m;
        p.re.lastIndex = 0; // patterns are shared and global, so rewind first
        while (m = p.re.exec(text)) {
            let fn = m[p.group != null ? p.group : m.length - 1];
            if (fn)
                files.push(p.suffix ? fn + p.suffix : fn);
        }
    }
    return files;
}
//# sourceMappingURL=toolmeta.js.map