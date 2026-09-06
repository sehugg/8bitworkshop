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
import { KeyFlags } from '../common/emu';
import { History } from '../common/history';
import { createCore, isRewindable, PlatformFrameInput } from '../common/platformcore';
import { hashState } from '../common/statehash';
import { formatTimestamp, timestamp } from '../common/timeline';
import { isProbablyBinary } from '../common/util';
import { fail, hasOutput, note, output, setJsonMode } from './cliformat';
import { EmuTarget, loadPlatform } from './emutarget';
import { RUN_SCRIPT_HELP, RunScript, parseNum, parseSymbolFile } from './runscript';
import type { CompileResult } from './testlib';

interface Args {
  [key: string]: string | true;
}

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
  'verify-replay': ['verbose'],
};

const ALIASES: { [alias: string]: string } = {
  compile: 'build',
  check: 'build',
  compilerun: 'run',
  verify: 'verify-replay',
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
    if (!booleans.has(key) && next != null && !next.startsWith('--')) args[key] = argv[++i];
    else args[key] = true;
  }
  return { command: resolved, args, positional };
}

function str(args: Args, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
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
  const result = await compileSourceFile(tool, platform, source);
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
// determinism

/**
 * Keys worth mashing: the directions and the fire/start buttons, which is what
 * a joystick-driven platform reads. Pressing arbitrary keyboard keys would be
 * noisier without testing anything more.
 */
const EXERCISE_KEYS = [37, 38, 39, 40, 32, 13];   // left up right down space enter

/**
 * A seeded button masher. Verification is only meaningful if the recording has
 * input in it -- without input the controls path is never exercised, and a
 * platform whose loadControlsState() is not the inverse of saveControlsState()
 * passes for the wrong reason. Seeded so a failure is reproducible.
 */
class InputExerciser {
  private state = 1;
  private held = new Map<number, boolean>();
  /** Where delivered events are logged so the replay can redeliver them. */
  log: PlatformFrameInput | null = null;

  constructor(readonly target: EmuTarget, seed: number) {
    this.state = seed | 0 || 1;
  }

  private next(): number {
    // xorshift32, same shape as the emulator's own noise()
    let x = this.state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (this.state = x) >>> 0;
  }

  /** Press or release a key or two, as if a player were at the controls. */
  frame(): void {
    for (const key of EXERCISE_KEYS) {
      if ((this.next() & 7) !== 0) continue;         // ~1 change per key per 8 frames
      const down = !this.held.get(key);
      this.held.set(key, down);
      const flags = down ? KeyFlags.KeyDown : KeyFlags.KeyUp;
      this.target.setKeyInput(key, key, flags);
      this.log?.recordKey(key, key, flags);
    }
  }
}

/**
 * Record a run, then replay it from the first checkpoint and check that every
 * frame comes back bit for bit. This is what keeps the deterministic debugger
 * honest: rewinding is only meaningful on platforms that reproduce, and a
 * platform that quietly picks up entropy (an unseeded Math.random, a clock)
 * shows up here as a diverging frame rather than as a mystery months later.
 */
async function doVerifyReplay(args: Args, positional: string[]): Promise<void> {
  const input = positional[0];
  const platformId = str(args, 'platform') || (input ? ROM_PLATFORMS[path.extname(input).toLowerCase()] : null);
  if (!platformId) fail('verify-replay', 'Required: verify-replay --platform <id> [rom]');

  const target = await openTarget(args, platformId);
  if (input) {
    if (!fs.existsSync(input)) fail('verify-replay', `No such file: ${input}`);
    target.loadROM(new Uint8Array(fs.readFileSync(input)), path.basename(input));
  }
  const platform = target.platform;
  if (!isRewindable(platform)) {
    fail('verify-replay', `'${platformId}' cannot save and restore state`);
  }

  const frames = parseInt(str(args, 'frames') ?? '') || 60;
  const wantInput = (str(args, 'input') ?? 'keys') !== 'none';
  const seed = parseInt(str(args, 'seed') ?? '') || 12345;
  let exerciser: InputExerciser | null = null;
  let inputMode = 'none';
  if (wantInput) {
    exerciser = new InputExerciser(target, seed);
    try {
      exerciser.frame();          // fails fast if the target takes no key input
      inputMode = 'keys';
    } catch (e) {
      exerciser = null;
      inputMode = 'unsupported';
    }
  }
  const core = createCore(platform);
  const input_ = new PlatformFrameInput(platform, {
    currentFrame: () => core.now().frame,
    dispatchKey: (key, code, flags) => target.setKeyInput(key, code, flags),
  });
  if (exerciser) exerciser.log = input_;
  // one checkpoint only, so the replay re-runs the whole span rather than
  // being handed a fresh state part way through
  const hist = new History(core, { checkpointInterval: frames + 1, input: input_ });

  // record, hashing the state at every frame boundary
  const recorded: number[] = [];
  // distinct control states seen; 1 means the input never reached the machine,
  // which would make a passing verification meaningless
  const controlStates = new Set<number>();
  for (let i = 0; i < frames; i++) {
    // input goes in before recordFrame(), so the frame's captured controls
    // include it -- that is what the replay has to reproduce
    exerciser?.frame();
    if (platform.saveControlsState) controlStates.add(hashState(platform.saveControlsState()));
    hist.recordFrame();
    recorded.push(hashState(core.snapshot()));
  }

  // replay the same span and compare
  const diverged: { frame: number }[] = [];
  hist.seek(hist.first());
  for (let i = 0; i < frames; i++) {
    hist.seek(timestamp(i + 1, 0));
    const h = hashState(core.snapshot());
    if (h !== recorded[i]) {
      diverged.push({ frame: i + 1 });
      if (diverged.length >= 5) break;
    }
  }

  const ok = diverged.length === 0;
  if (!ok) {
    note(`first divergence at frame ${diverged[0].frame} of ${frames}`);
  }
  output({
    success: ok,
    command: 'verify-replay',
    error: ok ? undefined : `replay diverged at frame ${diverged[0].frame}`,
    data: {
      platform: platformId,
      rom: input ?? null,
      frames,
      input: inputMode === 'keys' && controlStates.size < 2 ? 'keys (no effect)' : inputMode,
      controlStates: controlStates.size,
      keyEvents: input_.keyEventCount,
      seed: inputMode === 'keys' ? seed : null,
      granularity: core.granularity,
      deterministic: ok,
      firstDivergentFrame: ok ? null : diverged[0].frame,
      divergentFrames: diverged.map((d) => d.frame),
      recordedTo: formatTimestamp(hist.last()),
    }
  });
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
      case 'verify-replay': await doVerifyReplay(args, positional); break;
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
