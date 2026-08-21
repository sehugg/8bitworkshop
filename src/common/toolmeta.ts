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

export type ToolKind =
  | 'compiler'      // source -> object/output (cc65, sdcc, cmoc, oscar64, ...)
  | 'assembler'     // asm -> object (dasm, acme, ca65, ...)
  | 'linker'        // object(s) -> binary (ld65, sdldz80, lwlink, ...)
  | 'interpreter'   // e.g. BASIC
  | 'hdl'           // hardware description (verilator, yosys, silice)
  | 'remote'        // builds on a remote server (llvm-mos)

export type ToolArch =
  | '6502' | 'z80' | '6809' | 'arm32' | 'x86' | 'gbz80' | 'verilog' | 'zmachine';

export interface PlatformToolConfig {
  /** preload filesystem name for this platform (was TOOL_PRELOADFS compound keys) */
  preloadFS?: string;
  /** skeleton filename override (defaults to tool id) */
  skeleton?: string;
  /** library args for this platform (was PLATFORM_PARAMS.libargs) */
  libargs?: string[];
  /** linker config filename (was PLATFORM_PARAMS.cfgfile) */
  cfgfile?: string;
  /** extra compiler args (was PLATFORM_PARAMS.extra_compile_args) */
  extraCompileArgs?: string[];
  /** default output filename (was server buildenv platform_configs.outfile) */
  defaultOutput?: string;
}

export interface ServerToolConfig {
  version?: string;
  /** platforms this tool supports on the remote server */
  platforms: string[];
  binpath: string;
  command: string;
  args: string[];
}

export interface ToolIncludePattern {
  re: RegExp;
  group?: number;
  suffix?: string;
  /** true for system includes (#include <foo.h>) -- resolved from the
   *  toolchain filesystem, not the project; used for UI links only,
   *  not for build dependency scanning */
  system?: boolean;
}
   
export interface ToolMeta {
  /** join key, e.g. 'cc65', 'dasm', 'llvm-mos'. Note: 'remote:' is a transport
   *  prefix, not part of the id -- getToolMeta() strips it. */
  id: string;
  /** human-readable display name */
  name: string;
  kind: ToolKind;
  /** CPU architecture the tool targets (helps disambiguate ambiguous extensions) */
  arch?: ToolArch;

  // ---- tool-global metadata (same on every platform) ----

  /** filename extensions this tool consumes (explicit ones; fallback/default
   *  selection is still the platform's job) */
  extensions: string[];
  /** CodeMirror editor mode (was TOOL_TO_SOURCE_STYLE) */
  editorStyle?: string;
  /** documentation URL (was TOOL_TO_HELPURL) */
  helpURL?: string;
  /** skeleton filename in presets/<platform>/, defaults to tool id */
  skeleton?: string;
  /** wasm/emscripten module name loaded by the worker (was loadNative() arg) */
  wasmModule?: string;
  /** regexes matching include directives, used for dependency parsing */
  includePatterns?: (RegExp | ToolIncludePattern)[];
  /** regexes matching link directives, used for dependency parsing */
  linkPatterns?: (RegExp | ToolIncludePattern)[];
  /** directories inside the preload FS containing searchable shared code
   *  (headers, asm includes). Paths are relative to the FS root as they appear
   *  in the filesystem package metadata, e.g. ['/include', '/asminc'].
   *  Only meaningful when paired with platforms[].preloadFS. */
  includeDirs?: string[];

  // ---- per-platform metadata (was TOOL_PRELOADFS / PLATFORM_PARAMS) ----

  /** platform id -> config overrides */
  platforms?: { [platform: string]: PlatformToolConfig };

  // ---- remote/server metadata (was ServerBuildTool in buildenv.ts) ----

  /** true if this tool builds on a remote server (llvm-mos) */
  remote?: boolean;
  /** remote server build config */
  server?: ServerToolConfig;

  /** true if the id is registered here but has no worker build fn yet
   *  (sccz80, naken) -- tolerated by the TOOLS <-> TOOL_META cross-check */
  noWorkerBuild?: boolean;
}

//// shared dependency-parsing patterns (from src/ide/project.ts)

// C / most assemblers: [.#%]?include|incbin|embed "file", //#resource "file"
export const SHARED_INCLUDE_PATTERNS: RegExp[] = [
  /^\s*[.#%]?(include|incbin|embed)\s+"(.+?)"/gmi,
  /^\s*([;']|[/][/])#(resource)\s+"(.+?)"/gm,
];

// C / most assemblers: //#link "file" (or ;link)
export const SHARED_LINK_PATTERNS: RegExp[] = [
  /^\s*([;]|[/][/])#link\s+"(.+?)"/gm,
];

// Verilog family: `include/.include, $include/$dofile/$write_image_in_table,
// .arch json, $readmem[bh]
export const VERILOG_INCLUDE_PATTERNS: (RegExp | ToolIncludePattern)[] = [
  /^\s*(`include|[.]include)\s+"(.+?)"/gmi,
  /^\s*\$(include|\$dofile|\$write_image_in_table)\('(.+?)'/gmi,
  { re: /^\s*([.]arch)\s+(\w+)/gmi, suffix: '.json' },
  /\$readmem[bh]\("(.+?)"/gmi,
];

// C system includes: #include <file.h> -- resolved from the toolchain
// preload filesystem rather than the project. Deliberately NOT part of
// SHARED_INCLUDE_PATTERNS, so build dependency scanning skips them.
export const SYSTEM_INCLUDE_PATTERNS: ToolIncludePattern[] = [
  { re: /^\s*[.#%]?\s*include\s+<(.+?)>/gmi, system: true },
];

/**
 * System include patterns (#include <foo.h>) for UI linking, for tools that
 * have a bundled filesystem to search. Empty otherwise.
 */
export function getSystemIncludePatterns(tool?: string): ToolIncludePattern[] {
  let meta = tool && getToolMeta(tool);
  return (meta && meta.includeDirs && meta.includeDirs.length) ? SYSTEM_INCLUDE_PATTERNS : [];
}

// xasm6809 (USE) and merlin32 (ASM): "  USE file.ext"
export const USE_ASM_INCLUDE_PATTERNS: RegExp[] = [
  /^\s+(USE|ASM)\s+(\S+[.]\S+)/gm,
];

// acme: !src "file"
export const ACME_INCLUDE_PATTERNS: RegExp[] = [
  /^[!]src\s+"(.+?)"/gmi,
];

// wiz: import "file"; (implicit .wiz extension) / embed "file";
export const WIZ_INCLUDE_PATTERNS: (RegExp | ToolIncludePattern)[] = [
  { re: /^\s*import\s*"(.+?)";/gmi, suffix: '.wiz' },
  /^\s*embed\s*"(.+?)";/gmi,
];

// ecs: import "file"
export const ECS_INCLUDE_PATTERNS: RegExp[] = [
  /^\s*(import)\s*"(.+?)"/gmi,
];

// dialog: %% #include "file" (comment directive)
export const DIALOG_INCLUDE_PATTERNS: RegExp[] = [
  /^\s*%%\s*#include\s+"(.+?)"/gm,
];

//// preload filesystem names per tool/platform (was TOOL_PRELOADFS)

const CC65_PRELOADFS: { [platform: string]: PlatformToolConfig } = {
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

export const TOOL_META: { [id: string]: ToolMeta } = {

  // ---- 6502 assemblers ----

  dasm: {
    id: 'dasm', name: 'DASM', kind: 'assembler', arch: '6502',
    extensions: ['.dasm'],
    editorStyle: '6502',
    helpURL: 'https://raw.githubusercontent.com/sehugg/dasm/master/doc/dasm.txt',
    wasmModule: 'dasm',
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  acme: {
    id: 'acme', name: 'ACME', kind: 'assembler', arch: '6502',
    extensions: ['.acme'],
    editorStyle: '6502',
    helpURL: 'https://raw.githubusercontent.com/sehugg/acme/main/docs/QuickRef.txt',
    wasmModule: 'acme',
    includePatterns: [...SHARED_INCLUDE_PATTERNS, ...ACME_INCLUDE_PATTERNS],
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  xa: {
    id: 'xa', name: 'XA', kind: 'assembler', arch: '6502',
    extensions: ['.xa'],
    editorStyle: '6502',
    helpURL: 'https://www.floodgap.com/retrotech/xa/',
    wasmModule: 'xa',
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  nesasm: {
    id: 'nesasm', name: 'NESASM', kind: 'assembler', arch: '6502',
    extensions: ['.nesasm'],
    editorStyle: '6502',
    wasmModule: 'nesasm',
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  merlin32: {
    id: 'merlin32', name: 'Merlin 32', kind: 'assembler', arch: '6502',
    extensions: ['.lnk'],
    editorStyle: '6502',
    wasmModule: 'merlin32',
    includePatterns: [...SHARED_INCLUDE_PATTERNS, ...USE_ASM_INCLUDE_PATTERNS],
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  // ---- cc65 toolchain ----

  cc65: {
    id: 'cc65', name: 'cc65', kind: 'compiler', arch: '6502',
    extensions: ['.c', '.h'],
    includeDirs: ['/include', '/asminc'],
    editorStyle: 'text/x-csrc',
    helpURL: 'https://cc65.github.io/doc/cc65.html',
    wasmModule: 'cc65',
    platforms: CC65_PRELOADFS,
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  ca65: {
    id: 'ca65', name: 'ca65', kind: 'assembler', arch: '6502',
    extensions: ['.s', '.ca65'],
    includeDirs: ['/include', '/asminc'],
    editorStyle: '6502',
    helpURL: 'https://cc65.github.io/doc/ca65.html',
    wasmModule: 'ca65',
    platforms: CC65_PRELOADFS,
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
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
    includeDirs: ['/include'],
    editorStyle: 'text/x-csrc',
    helpURL: 'http://sdcc.sourceforge.net/doc/sdccman.pdf',
    wasmModule: 'sdcc',
    platforms: { default: { preloadFS: 'sdcc' } },
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  sdasz80: {
    id: 'sdasz80', name: 'sdasz80', kind: 'assembler', arch: 'z80',
    extensions: ['.s'],
    includeDirs: ['/include'],
    editorStyle: 'z80',
    wasmModule: 'sdasz80',
    platforms: { default: { preloadFS: 'sdcc' } },
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  sdasgb: {
    id: 'sdasgb', name: 'sdasgb', kind: 'assembler', arch: 'gbz80',
    extensions: ['.sgb'],
    includeDirs: ['/include'],
    editorStyle: 'z80',
    wasmModule: 'sdasgb',
    platforms: { default: { preloadFS: 'sdcc' } },
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
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
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  jsasm: {
    id: 'jsasm', name: 'JSASM', kind: 'assembler',
    extensions: ['.asm'],
    editorStyle: 'z80',
    // pure JS assembler, no wasm module. Only used on the verilog platform,
    // where .asm files pull in .v modules and name a CPU with '.arch'.
    includePatterns: VERILOG_INCLUDE_PATTERNS,
    linkPatterns: [],
  },

  // ---- 6809 toolchain ----

  xasm6809: {
    id: 'xasm6809', name: 'XASM6809', kind: 'assembler', arch: '6809',
    extensions: ['.xasm'],
    editorStyle: '6809',
    wasmModule: 'xasm6809',
    includePatterns: [...SHARED_INCLUDE_PATTERNS, ...USE_ASM_INCLUDE_PATTERNS],
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  cmoc: {
    id: 'cmoc', name: 'CMOC', kind: 'compiler', arch: '6809',
    extensions: ['.c', '.h'],
    includeDirs: ['/include'],
    editorStyle: 'text/x-csrc',
    helpURL: 'http://perso.b2b2c.ca/~sarrazip/dev/cmoc.html',
    wasmModule: 'cmoc',
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  lwasm: {
    id: 'lwasm', name: 'LWASM', kind: 'assembler', arch: '6809',
    extensions: ['.lwasm'],
    wasmModule: 'lwasm',
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
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
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  armips: {
    id: 'armips', name: 'armips', kind: 'assembler', arch: 'arm32',
    extensions: ['.armips'],
    editorStyle: 'vasm',
    wasmModule: 'armips',
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  armtcc: {
    id: 'armtcc', name: 'TCC (ARM)', kind: 'compiler', arch: 'arm32',
    extensions: ['.c', '.s'],
    includeDirs: ['/include'],
    editorStyle: 'text/x-csrc',
    wasmModule: 'arm-tcc',
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
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
    includeDirs: ['/include'],
    editorStyle: 'text/x-csrc',
    wasmModule: 'smlrc',
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  yasm: {
    id: 'yasm', name: 'YASM', kind: 'assembler', arch: 'x86',
    extensions: ['.asm'],
    editorStyle: 'gas',
    wasmModule: 'yasm',
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  // ---- 6502 C compilers / BASIC dialects ----

  oscar64: {
    id: 'oscar64', name: 'Oscar64', kind: 'compiler', arch: '6502',
    extensions: ['.c', '.cpp', '.cc', '.o64'],
    includeDirs: ['/include'],
    editorStyle: 'text/x-csrc',
    helpURL: 'https://github.com/drmortalwombat/oscar64/blob/main/oscar64.md',
    wasmModule: 'oscar64',
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  bataribasic: {
    id: 'bataribasic', name: 'batari Basic', kind: 'compiler', arch: '6502',
    extensions: ['.bb', '.bas'],
    includeDirs: ['/includes'],
    editorStyle: 'bataribasic',
    helpURL: 'help/bataribasic/manual.html',
    wasmModule: 'bb2600basic',
    platforms: { default: { preloadFS: '2600basic' } },
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  fastbasic: {
    id: 'fastbasic', name: 'FastBasic', kind: 'compiler', arch: '6502',
    extensions: ['.bas', '.fb', '.fbi'],
    editorStyle: 'fastbasic',
    helpURL: 'https://github.com/dmsc/fastbasic/blob/master/manual.md',
    wasmModule: 'fastbasic-int',
    platforms: { default: { preloadFS: '65-atari8' } },
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  cc2600: {
    id: 'cc2600', name: 'CC2600', kind: 'compiler', arch: '6502',
    extensions: ['.cc2600'],
    editorStyle: 'text/x-csrc',
    wasmModule: 'cc2600',
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
  },

  cc7800: {
    id: 'cc7800', name: 'CC7800', kind: 'compiler', arch: '6502',
    extensions: ['.cc7800', '.c78'],
    editorStyle: 'text/x-csrc',
    wasmModule: 'cc7800',
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
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
    includeDirs: ['/common'],
    editorStyle: 'text/x-wiz',
    helpURL: 'https://github.com/wiz-lang/wiz/blob/master/readme.md#wiz',
    wasmModule: 'wiz',
    platforms: { default: { preloadFS: 'wiz' } },
    includePatterns: WIZ_INCLUDE_PATTERNS,
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
    includePatterns: [...SHARED_INCLUDE_PATTERNS, ...ECS_INCLUDE_PATTERNS],
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
    includePatterns: DIALOG_INCLUDE_PATTERNS,
  },

  // ---- verilog / HDL ----

  verilator: {
    id: 'verilator', name: 'Verilator', kind: 'hdl', arch: 'verilog',
    extensions: ['.v'],
    editorStyle: 'verilog',
    helpURL: 'https://www.veripool.org/ftp/verilator_doc.pdf',
    wasmModule: 'verilator_bin',
    includePatterns: VERILOG_INCLUDE_PATTERNS,
    linkPatterns: [],
  },

  yosys: {
    id: 'yosys', name: 'Yosys', kind: 'hdl', arch: 'verilog',
    extensions: [],
    wasmModule: 'yosys',
    includePatterns: VERILOG_INCLUDE_PATTERNS,
    linkPatterns: [],
  },

  silice: {
    id: 'silice', name: 'Silice', kind: 'hdl', arch: 'verilog',
    extensions: ['.ice'],
    editorStyle: 'verilog',
    helpURL: 'https://github.com/sylefeb/Silice',
    wasmModule: 'silice',
    platforms: { default: { preloadFS: 'Silice' } },
    includePatterns: VERILOG_INCLUDE_PATTERNS,
    linkPatterns: [],
  },

  // ---- remote / server ----

  'llvm-mos': {
    id: 'llvm-mos', name: 'LLVM-MOS', kind: 'compiler', arch: '6502',
    extensions: ['.c', '.cpp', '.s', '.S', '.C'],
    editorStyle: 'text/x-csrc', // used as 'remote:llvm-mos' in the IDE
    helpURL: 'https://llvm-mos.org/wiki/Welcome',
    remote: true,
    includePatterns: SHARED_INCLUDE_PATTERNS,
    linkPatterns: SHARED_LINK_PATTERNS,
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
export function getToolMeta(id: string): ToolMeta | undefined {
  return TOOL_META[id.replace(/^remote:/, '')];
}

/**
 * Return all tools that consume the given filename (longest extension match
 * first). Ambiguity is resolved by the platform, which picks from these.
 */
export function getToolMetaForFilename(fn: string): ToolMeta[] {
  let matches: { meta: ToolMeta, len: number }[] = [];
  for (let id in TOOL_META) {
    let meta = TOOL_META[id];
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
export function getPreloadFSName(tool: string, platform?: string): string | undefined {
  let meta = getToolMeta(tool);
  if (!meta) return undefined;
  if (meta.platforms) {
    if (platform) {
      let p = meta.platforms[platform];
      if (p && p.preloadFS) return p.preloadFS;
    }
    let d = meta.platforms['default'];
    if (d && d.preloadFS) return d.preloadFS;
  }
  return undefined;
}

/** Skeleton filename in presets/<platform>/, defaults to tool id. */
export function getSkeletonName(tool: string): string {
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
export function getIncludePatterns(tool?: string, platform?: string): (RegExp | ToolIncludePattern)[] {
  let meta = tool && getToolMeta(tool);
  if (meta && meta.includePatterns) return meta.includePatterns;
  if (platform && platform.startsWith('verilog')) return VERILOG_INCLUDE_PATTERNS;
  return SHARED_INCLUDE_PATTERNS;
}

/** Link patterns ("//#link") to use when scanning a source file. */
export function getLinkPatterns(tool?: string, platform?: string): (RegExp | ToolIncludePattern)[] {
  let meta = tool && getToolMeta(tool);
  if (meta && meta.linkPatterns) return meta.linkPatterns;
  if (platform && platform.startsWith('verilog')) return [];
  return SHARED_LINK_PATTERNS;
}

/**
 * Directories containing shared code (headers etc.) for this tool's preload
 * filesystem, e.g. ['/include','/asminc'] -- empty if none/unknown.
 */
export function getIncludeDirs(tool?: string): string[] {
  let meta = tool && getToolMeta(tool);
  return (meta && meta.includeDirs) || [];
}

/**
 * Run a set of include/link patterns over source text, returning the
 * referenced filenames. The filename comes from the pattern's `group`, or
 * from the last capture group if unspecified, plus any implicit `suffix`.
 */
export function matchDependencyPatterns(text: string, patterns: (RegExp | ToolIncludePattern)[]): string[] {
  let files: string[] = [];
  for (let pat of patterns || []) {
    let p: ToolIncludePattern = pat instanceof RegExp ? { re: pat } : pat;
    let m;
    p.re.lastIndex = 0; // patterns are shared and global, so rewind first
    while (m = p.re.exec(text)) {
      let fn = m[p.group != null ? p.group : m.length - 1];
      if (fn) files.push(p.suffix ? fn + p.suffix : fn);
    }
  }
  return files;
}
