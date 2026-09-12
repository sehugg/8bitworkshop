#!/usr/bin/env node

// 8bws - 8bitworkshop command line tool.
//
//   8bws build --platform c64 hello.c -o hello.prg
//   8bws run   --platform c64 hello.c -e "run 100; screen"
//   8bws run   --platform c64 hello.prg --png shot.png
//
// Two verbs: `build` compiles a source file, `run` executes a ROM -- or a
// source file, which it builds first. Emulation goes through EmuTarget
// (emutarget.ts).

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isProbablyBinary } from '../common/util';
import { fail, hasOutput, note, output, setJsonMode } from './cliformat';
import { EmuTarget, loadPlatform } from './emutarget';
import { RUN_SCRIPT_HELP, RunScript, parseNum, parseSymbolFile } from './runscript';
import type { CompileResult } from './testlib';

interface Args {
  [key: string]: string | true | string[];
}

/** Options that may be repeated; each occurrence adds to a list. */
const REPEATABLE_FLAGS = new Set([
  'define', 'as-define', 'ld-define', 'cflag', 'asflag', 'ldflag',
]);

/** ROM extensions that name exactly one platform. */
const ROM_PLATFORMS: { [ext: string]: string } = {
  '.nes': 'nes', '.gb': 'gb', '.gbc': 'gb', '.a26': 'vcs', '.a78': 'atari7800',
  '.sms': 'sms', '.col': 'coleco', '.vec': 'vector',
};

/** Extensions always treated as ROMs, even if the contents look like text. */
const ROM_EXTS = new Set(['.rom', '.bin', ...Object.keys(ROM_PLATFORMS)]);

const SHORT_FLAGS: { [short: string]: string } = {
  p: 'platform', t: 'tool', o: 'output', f: 'frames', e: 'eval',
};

// Flags that never take a value, per command. Everything else consumes the
// next argument unless that argument is another flag.
const BOOLEAN_FLAGS: { [command: string]: string[] } = {
  build: ['check', 'symbols', 'save'],
  run: ['info'],
};

const ALIASES: { [alias: string]: string } = {
  compile: 'build',
  check: 'build',
  compilerun: 'run',
};

function parseArgs(argv: string[]): { command: string; args: Args; positional: string[] } {
  let command = argv[2] || 'help';
  if (command.startsWith('-')) command = 'help';
  const resolved = ALIASES[command] || command;
  const booleans = new Set(['json', ...(BOOLEAN_FLAGS[resolved] || [])]);
  const args: Args = {};
  const positional: string[] = [];
  if (command === 'check') args['check'] = true;

  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('-') || arg === '-') { positional.push(arg); continue; }
    const key = arg.startsWith('--') ? arg.substring(2) : (SHORT_FLAGS[arg.substring(1)] || arg.substring(1));
    const next = argv[i + 1];
    if (!booleans.has(key) && next != null && !next.startsWith('--')) {
      const val = argv[++i];
      if (REPEATABLE_FLAGS.has(key)) {
        const cur = args[key];
        if (cur == null) args[key] = [val];
        else if (Array.isArray(cur)) cur.push(val);
        else args[key] = [cur as string, val];
      } else args[key] = val;
    } else args[key] = true;
  }
  return { command: resolved, args, positional };
}

function str(args: Args, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

/** All values for a repeatable option (empty if absent). */
function list(args: Args, key: string): string[] {
  const v = args[key];
  if (v == null) return [];
  return Array.isArray(v) ? v : [v as string];
}

/** Build-symbol / build-arg overrides from the command line. */
function buildOverrides(args: Args) {
  return {
    symbols: {
      compiler: list(args, 'define'),
      assembler: list(args, 'as-define'),
      linker: list(args, 'ld-define'),
    },
    buildArgs: {
      compiler: list(args, 'cflag'),
      assembler: list(args, 'asflag'),
      linker: list(args, 'ldflag'),
    },
  };
}

////////////////////////////////////////////////////////////////////////
// build

interface Build {
  rom: Uint8Array;
  symbolmap: { [name: string]: number };
  tool: string;
  platform: string;
  source: string;
}

/** Compile one source file. Exits with the compiler's errors if it fails. */
async function compileSource(args: Args, source: string, platform: string): Promise<Build & { result: CompileResult }> {
  const { compileSourceFile, getToolForFilename, initialize, preload, TOOLS } = await import('./testlib');
  await initialize();
  const tool = str(args, 'tool') || getToolForFilename(source, platform);
  if (!TOOLS[tool]) {
    fail('build', `Unknown tool: ${tool}. Use list-tools to see available tools.`);
  }
  await preload(tool, platform);
  const result = await compileSourceFile(tool, platform, source, undefined, buildOverrides(args));
  if (!result.success) {
    fail('build', `${tool} failed on ${source}`, { errors: result.errors });
  }
  return { rom: romBytes(result), symbolmap: result.symbolmap || {}, tool, platform, source, result };
}

async function doBuild(args: Args, positional: string[]): Promise<void> {
  const source = positional[0];
  const platform = str(args, 'platform');
  const checkOnly = !!args['check'];
  if (!platform || !source) {
    fail('build', 'Required: build --platform <platform> <source> [--tool <tool>] [-o <file>]');
  }
  const built = await compileSource(args, source, platform);

  const outputFile = str(args, 'output');
  if (outputFile && !checkOnly) fs.writeFileSync(outputFile, Buffer.from(built.rom));

  const data: any = {
    tool: built.tool, platform, source,
    outputSize: built.rom.length,
    outputFile: outputFile || null,
  };
  if (args['symbols']) {
    if (built.result.symbolmap) data.symbolmap = built.result.symbolmap;
    if (built.result.segments) data.segments = built.result.segments;
  }
  if (args['save']) await saveBuildFiles(source, data);
  output({ success: true, command: checkOnly ? 'check' : 'build', data });
}

/** Dump every intermediate file the build produced to a temp directory. */
async function saveBuildFiles(source: string, data: any): Promise<void> {
  const { store } = await import('./testlib');
  const saveDir = path.join(os.tmpdir(), `8bws-${path.basename(source, path.extname(source))}`);
  fs.mkdirSync(saveDir, { recursive: true });
  data.savedFiles = [];
  for (const [filePath, entry] of Object.entries(store.workfs)) {
    const outPath = path.join(saveDir, filePath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, entry.data as any);
    data.savedFiles.push(filePath);
  }
  data.saveDir = saveDir;
}

function romBytes(result: CompileResult): Uint8Array {
  const out = result.output?.code ?? result.output;
  if (out instanceof Uint8Array) return out;
  if (typeof out === 'string') return new TextEncoder().encode(out);
  throw new Error('compiler produced no ROM image');
}

////////////////////////////////////////////////////////////////////////
// run

/** A source file is anything that isn't obviously a ROM image. */
function looksLikeROM(file: string): boolean {
  if (ROM_EXTS.has(path.extname(file).toLowerCase())) return true;
  return isProbablyBinary(file, fs.readFileSync(file));
}

async function openTarget(args: Args, platformId: string): Promise<EmuTarget> {
  const target = await loadPlatform(platformId);
  await target.start();
  const bios = str(args, 'bios');
  if (bios && !target.loadBIOS(new Uint8Array(fs.readFileSync(bios)))) {
    fail('run', `'${target.id}' does not accept a BIOS image`);
  }
  return target;
}

/** Turn the run flags into script commands, appended to any --script/-e text. */
function buildScript(args: Args): string {
  const parts: string[] = [];
  if (args['frames']) parts.push(`run ${str(args, 'frames') ?? 1}`);
  const script = str(args, 'eval') ?? str(args, 'script');
  if (script) parts.push(fs.existsSync(script) ? fs.readFileSync(script, 'utf8') : script);
  if (args['info']) parts.push('info');
  const memdump = str(args, 'memdump');
  if (memdump) {
    const [start, end] = memdump.split(',').map((s) => parseNum(s.startsWith('$') || /^0x/i.test(s) ? s : '$' + s));
    if (isNaN(start) || isNaN(end) || end < start) {
      fail('run', `Invalid --memdump range: ${memdump} (use hex addresses like 0000,00ff)`);
    }
    parts.push(`mem $${start.toString(16)} ${end - start + 1}`);
  }
  return parts.length ? parts.join('\n') : 'run 1';
}

async function doRun(args: Args, positional: string[]): Promise<void> {
  const input = positional[0];
  if (!input) {
    fail('run', 'Required: run --platform <id> <rom-or-source>');
  }
  if (!fs.existsSync(input)) fail('run', `No such file: ${input}`);

  // A source file is built first; a ROM is loaded as-is.
  let romFile = input;
  let symbols: { [name: string]: number } = {};
  let platformId = str(args, 'platform') || ROM_PLATFORMS[path.extname(input).toLowerCase()];
  if (!looksLikeROM(input)) {
    if (!platformId) fail('run', `Building ${input} requires --platform`);
    const built = await compileSource(args, input, platformId);
    romFile = path.join(os.tmpdir(), '8bws-' + path.basename(input).replace(/\.\w+$/, '') + '.rom');
    fs.writeFileSync(romFile, Buffer.from(built.rom));
    symbols = built.symbolmap;
    note(`built ${input} with ${built.tool} -> ${romFile} (${built.rom.length} bytes)`);
  } else if (!platformId) {
    fail('run', `Cannot infer a platform from '${path.basename(input)}': pass --platform`);
  }

  const target = await openTarget(args, platformId);
  target.loadROM(new Uint8Array(fs.readFileSync(romFile)), path.basename(romFile));

  const script = new RunScript(target);
  script.addSymbols(symbols);
  const symbolFile = str(args, 'symbols');
  if (symbolFile) script.addSymbols(parseSymbolFile(fs.readFileSync(symbolFile, 'utf8')));
  script.startTracing();
  script.run(buildScript(args));

  const video = target.getVideo();
  output({
    success: true,
    command: 'run',
    data: {
      platform: target.id,
      rom: romFile,
      frames: target.frameCount,
      width: video?.width ?? null,
      height: video?.height ?? null,
      png: str(args, 'png') || null,
    }
  });
  await writeScreenshot(video, str(args, 'png'));
}

async function writeScreenshot(video: ReturnType<EmuTarget['getVideo']>, pngFile?: string): Promise<void> {
  if (!video) return;
  const showInTerminal = process.stdout.isTTY;
  if (!pngFile && !showInTerminal) return;
  const { encode } = await import('fast-png');
  const png = encode({
    width: video.width, height: video.height,
    data: new Uint8Array(video.pixels.buffer), channels: 4
  });
  if (pngFile) fs.writeFileSync(pngFile, png);
  if (showInTerminal) {
    const { displayImageInTerminal } = await import('./termimage');
    displayImageInTerminal(png, video.width, video.height);
  }
}

////////////////////////////////////////////////////////////////////////
// listings & help

async function doList(command: string): Promise<void> {
  const { initialize, listPlatforms, listTools, PLATFORM_PARAMS } = await import('./testlib');
  await initialize();
  if (command === 'list-tools') {
    output({ success: true, command, data: { tools: listTools() } });
    return;
  }
  const platforms: { [key: string]: any } = {};
  for (const p of listPlatforms()) platforms[p] = { arch: PLATFORM_PARAMS[p].arch || 'unknown' };
  output({ success: true, command, data: { platforms, count: Object.keys(platforms).length } });
}

function usage(error?: string): never {
  output({
    success: !error,
    command: 'help',
    error,
    data: {
      commands: {
        'build': 'compile a source file to a ROM',
        'run': 'run a ROM -- or a source file, built first',
        'list-platforms': 'platforms available to --platform',
        'list-tools': 'compilers and assemblers available to --tool',
      },
      options: {
        'build options': {
          '-p, --platform <id>': 'target platform (required)',
          '-t, --tool <tool>': 'compiler/assembler (default: from file extension)',
          '-o, --output <file>': 'write the ROM here',
          '--check': 'compile without writing anything',
          '--symbols': 'dump the symbol table and segments',
          '--save': 'save all intermediate build files to a temp dir',
          '--define <N[=V]>': 'preprocessor define for the compiler (repeatable)',
          '--as-define <N[=V]>': 'symbol for the assembler (repeatable)',
          '--ld-define <N=INT>': 'linker symbol, integer expression (repeatable)',
          '--cflag <arg>': 'extra compiler argument (repeatable)',
          '--asflag <arg>': 'extra assembler argument (repeatable)',
          '--ldflag <arg>': 'extra linker argument (repeatable)',
        },
        'run options': {
          '-p, --platform <id>': 'platform emulator (Platform interface)',
          '-f, --frames <n>': 'advance N frames',
          '-e <commands>': 'inline run-script, e.g. -e "run 60; screen"',
          '--script <file>': 'run-script file',
          '--png <file>': 'write a screenshot of the last frame',
          '--symbols <file>': 'load a .lbl/.sym file for symbolic addresses',
          '--bios <file>': 'load a BIOS image',
          '--info': 'dump debug info and disassembly when done',
          '--memdump <a,b>': 'hexdump a hex address range',
        },
        'global options': {
          '--json': 'machine-readable output on stdout',
        },
      },
      script: RUN_SCRIPT_HELP,
    }
  });
  process.exit(error ? 1 : 0);
}

////////////////////////////////////////////////////////////////////////

async function main() {
  const { command, args, positional } = parseArgs(process.argv);
  if (args['json']) setJsonMode(true);
  // A platform whose start() never settles (usually one that needs a
  // browser-only library) drains the event loop and would otherwise exit 0.
  process.on('exit', () => {
    if (hasOutput()) return;
    output({ success: false, command, error: `${command} did not run to completion -- the emulator never finished starting` });
    process.exitCode = 1;
  });
  try {
    switch (command) {
      case 'build': await doBuild(args, positional); break;
      case 'run': await doRun(args, positional); break;
      case 'list-tools':
      case 'list-platforms': await doList(command); break;
      case 'help': usage(); break;
      default: usage(`Unknown command: ${command}`);
    }
  } catch (e: any) {
    if (process.env.DEBUG) console.error(e);
    output({ success: false, command, error: e.message || String(e) });
    process.exit(1);
  }
}

main();
