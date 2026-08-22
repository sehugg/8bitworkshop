#!/usr/bin/env node

// 8bws - 8bitworkshop CLI tool for compilation, ROM execution, and platform info

import * as fs from 'fs';
import * as path from 'path';
import { initialize, compile, compileSourceFile, preload, listTools, listPlatforms, getToolForFilename, PLATFORM_PARAMS, TOOLS, store } from './testlib';
import { isDebuggable } from '../common/baseplatform';
import { KeyFlags } from '../common/emu';
import { hex } from '../common/util';

interface CLIResult {
  success: boolean;
  command: string;
  data?: any;
  error?: string;
}

// ANSI color helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

var jsonMode = false;

function output(result: CLIResult): void {
  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    outputPretty(result);
  }
}

function outputPretty(result: CLIResult): void {
  // Status badge
  if (result.success) {
    process.stderr.write(`${c.bgGreen}${c.bold}${c.white} OK ${c.reset} `);
  } else {
    process.stderr.write(`${c.bgRed}${c.bold}${c.white} FAIL ${c.reset} `);
  }
  // Command name
  process.stderr.write(`${c.bold}${c.cyan}${result.command}${c.reset}\n`);

  // Error message
  if (result.error) {
    process.stderr.write(`${c.red}Error: ${result.error}${c.reset}\n`);
  }

  // Data
  if (result.data) {
    formatData(result.command, result.data);
  }
}

function formatData(command: string, data: any): void {
  switch (command) {
    case 'help':
      formatHelp(data);
      break;
    case 'compile':
    case 'check':
      formatCompile(data);
      break;
    case 'list-tools':
      formatListTools(data);
      break;
    case 'list-platforms':
      formatListPlatforms(data);
      break;
    default:
      // Fallback: print as indented key-value pairs
      formatGeneric(data);
      break;
  }
}

function formatHelp(data: any): void {
  if (data.commands) {
    console.log(`\n${c.bold}Usage:${c.reset} 8bws <command> [options]\n`);
    console.log(`${c.bold}Commands:${c.reset}`);
    for (var [cmd, usage] of Object.entries(data.commands)) {
      console.log(`  ${c.green}${cmd}${c.reset}${c.dim} - ${usage}${c.reset}`);
    }
    console.log(`\n${c.bold}Global options:${c.reset}`);
    console.log(`  ${c.yellow}--json${c.reset}${c.dim}   Output raw JSON instead of formatted text${c.reset}`);
    console.log(`  ${c.yellow}--save${c.reset}${c.dim}   Save all intermediate build files to /tmp/8bws-<name>${c.reset}`);
    console.log();
  }
}

function formatCompile(data: any): void {
  if (data.errors) {
    for (var err of data.errors) {
      var loc = '';
      if (err.path) loc += `${c.cyan}${err.path}${c.reset}`;
      if (err.line) loc += `${c.dim}:${c.reset}${c.yellow}${err.line}${c.reset}`;
      if (loc) loc += ` ${c.dim}-${c.reset} `;
      console.log(`  ${c.red}●${c.reset} ${loc}${err.msg || err.message || JSON.stringify(err)}`);
    }
    return;
  }
  if (data.tool) console.log(`  ${c.dim}Tool:${c.reset}     ${c.green}${data.tool}${c.reset}`);
  if (data.platform) console.log(`  ${c.dim}Platform:${c.reset} ${c.green}${data.platform}${c.reset}`);
  if (data.source) console.log(`  ${c.dim}Source:${c.reset}   ${c.cyan}${data.source}${c.reset}`);
  if (data.outputSize != null) console.log(`  ${c.dim}Size:${c.reset}     ${c.yellow}${data.outputSize}${c.reset} bytes`);
  if (data.outputFile) console.log(`  ${c.dim}Output:${c.reset}   ${c.cyan}${data.outputFile}${c.reset}`);
  if (data.hasListings) console.log(`  ${c.dim}Listings:${c.reset} ${c.green}yes${c.reset}`);
  if (data.hasSymbolmap) console.log(`  ${c.dim}Symbols:${c.reset}  ${c.green}yes${c.reset}`);

  // --symbols: dump symbol map
  if (data.symbolmap) {
    console.log(`\n${c.bold}Symbols${c.reset} ${c.dim}(${Object.keys(data.symbolmap).length})${c.reset}`);
    var sorted = Object.entries(data.symbolmap).sort((a: any, b: any) => a[1] - b[1]);
    for (var [name, addr] of sorted) {
      console.log(`  ${c.cyan}$${hex(addr as number, 4)}${c.reset}  ${name}`);
    }
  }

  // --save: show saved files
  if (data.saveDir) {
    console.log(`\n${c.bold}Saved to${c.reset} ${c.cyan}${data.saveDir}${c.reset} ${c.dim}(${data.savedFiles.length} files)${c.reset}`);
    for (var f of data.savedFiles) {
      console.log(`  ${c.dim}●${c.reset} ${f}`);
    }
  }

  // --symbols: dump segments
  if (data.segments) {
    console.log(`\n${c.bold}Segments${c.reset} ${c.dim}(${data.segments.length})${c.reset}`);
    for (var seg of data.segments) {
      console.log(`  ${c.green}${seg.name.padEnd(16)}${c.reset} ${c.cyan}$${hex(seg.start, 4)}${c.reset}  ${c.dim}size${c.reset} ${c.yellow}${seg.size}${c.reset}`);
    }
  }
}

function formatListTools(data: any): void {
  console.log(`\n${c.bold}Available tools${c.reset} ${c.dim}(${data.count})${c.reset}\n`);
  for (var tool of data.tools) {
    console.log(`  ${c.green}●${c.reset} ${tool}`);
  }
  console.log();
}

function formatListPlatforms(data: any): void {
  console.log(`\n${c.bold}Available platforms${c.reset} ${c.dim}(${data.count})${c.reset}\n`);
  // Group by arch
  let byArch: { [arch: string]: string[] } = {};
  for (let [name, info] of Object.entries(data.platforms) as [string, any][]) {
    let arch = info.arch || 'unknown';
    if (!byArch[arch]) byArch[arch] = [];
    byArch[arch].push(name);
  }
  for (let [arch, platforms] of Object.entries(byArch).sort()) {
    console.log(`  ${c.bold}${c.magenta}${arch}${c.reset}`);
    for (let p of platforms.sort()) {
      console.log(`    ${c.green}●${c.reset} ${p}`);
    }
  }
  console.log();
}

function formatGeneric(data: any): void {
  for (var [key, value] of Object.entries(data)) {
    if (typeof value === 'object' && value !== null) {
      console.log(`  ${c.dim}${key}:${c.reset} ${JSON.stringify(value)}`);
    } else {
      console.log(`  ${c.dim}${key}:${c.reset} ${value}`);
    }
  }
}

var BOOLEAN_FLAGS = new Set(['json', 'info', 'symbols', 'save']);

function parseArgs(argv: string[]): { command: string; args: { [key: string]: string }; positional: string[] } {
  var command = argv[2];
  var args: { [key: string]: string } = {};
  var positional: string[] = [];

  for (var i = 3; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      var key = argv[i].substring(2);
      if (BOOLEAN_FLAGS.has(key)) {
        args[key] = 'true';
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[key] = argv[++i];
      } else {
        args[key] = 'true';
      }
    } else {
      positional.push(argv[i]);
    }
  }

  return { command, args, positional };
}

function usage(): void {
  output({
    success: false,
    command: 'help',
    data: {
      commands: {
        'compile': 'compile --platform <platform> [--tool <tool>] [--output <file>] [--symbols] [--save] <source>',
        'check': 'check --platform <platform> [--tool <tool>] <source>',
        'run': 'run (--platform <id> | --machine <module:ClassName>) [--frames N] [--script "cmds"|file] [--output <file.png>] [--memdump start,end] [--info] <rom>',
        'script-cmds': RUN_SCRIPT_HELP,
        'list-tools': 'list-tools',
        'list-platforms': 'list-platforms',
      }
    },
    error: 'No command specified'
  });
  process.exit(1);
}

async function doCompile(args: { [key: string]: string }, positional: string[], checkOnly: boolean): Promise<void> {
  var tool = args['tool'];
  var platform = args['platform'];
  var outputFile = args['output'];
  var sourceFile = positional[0];

  if (!platform || !sourceFile) {
    output({
      success: false,
      command: checkOnly ? 'check' : 'compile',
      error: 'Required: --platform <platform> <source> [--tool <tool>]'
    });
    process.exit(1);
  }

  // Auto-detect tool from filename if not specified
  if (!tool) {
    tool = getToolForFilename(sourceFile, platform);
  }

  if (!TOOLS[tool]) {
    output({
      success: false,
      command: checkOnly ? 'check' : 'compile',
      error: `Unknown tool: ${tool}. Use list-tools to see available tools.`
    });
    process.exit(1);
  }

  // Preload the tool's filesystem if needed
  await preload(tool, platform);

  var result = await compileSourceFile(tool, platform, sourceFile);

  if (!result.success) {
    output({
      success: false,
      command: checkOnly ? 'check' : 'compile',
      data: { errors: result.errors }
    });
    process.exit(1);
  }

  if (checkOnly) {
    output({
      success: true,
      command: 'check',
      data: {
        tool: tool,
        platform: platform,
        source: sourceFile,
        outputSize: result.output ? (result.output.code ? result.output.code.length : result.output.length) : 0,
      }
    });
    return;
  }

  // Write output if requested
  if (outputFile && result.output) {
    var outData = result.output.code || result.output;
    if (outData instanceof Uint8Array) {
      fs.writeFileSync(outputFile, outData);
    } else if (typeof outData === 'object') {
      fs.writeFileSync(outputFile, JSON.stringify(outData));
    } else {
      fs.writeFileSync(outputFile, outData);
    }
  }

  var outputSize = 0;
  if (result.output) {
    outputSize = result.output.code ? result.output.code.length : result.output.length;
  }

  var compileData: any = {
    tool: tool,
    platform: platform,
    source: sourceFile,
    outputSize: outputSize,
    outputFile: outputFile || null,
    hasListings: result.listings ? Object.keys(result.listings).length > 0 : false,
    hasSymbolmap: !!result.symbolmap,
  };

  if (args['symbols'] === 'true') {
    if (result.symbolmap) compileData.symbolmap = result.symbolmap;
    if (result.segments) compileData.segments = result.segments;
  }

  // --save: write all intermediate build files to /tmp/<dirname>
  if (args['save'] === 'true') {
    var baseName = path.basename(sourceFile, path.extname(sourceFile));
    var saveDir = path.join('/tmp', `8bws-${baseName}`);
    fs.mkdirSync(saveDir, { recursive: true });
    var savedFiles: string[] = [];
    for (var [filePath, entry] of Object.entries(store.workfs)) {
      var outPath = path.join(saveDir, filePath);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      if (entry.data instanceof Uint8Array) {
        fs.writeFileSync(outPath, entry.data);
      } else {
        fs.writeFileSync(outPath, entry.data);
      }
      savedFiles.push(filePath);
    }
    compileData.saveDir = saveDir;
    compileData.savedFiles = savedFiles;
  }

  output({
    success: true,
    command: 'compile',
    data: compileData,
  });
}

//
// Run-script interpreter
//
// A simple command language for driving headless emulation, one command per
// line (separated by newlines or ';'). '#' starts a comment.
//
//   run N | wait N | frames N   advance N frames (default 1)
//   runto ADDR [maxframes]      advance until PC == ADDR (default cap 1000 frames)
//   key KEY                     press key (down, 3 frames, up)
//   keydown KEY | keyup KEY     raw key events
//   mem START LEN               hexdump memory
//   screen [START] [COLS] [ROWS]  decode screen RAM to text (default $0400 40x25)
//   pc                          print PC + disassembly at PC
//   reset                       reset the platform/machine
//   echo TEXT                   print a message
//
// KEY can be a single character ('A', '5'), a name (ENTER, SPACE, LEFT, F1...),
// or numeric ($41 / 65). Modifier prefixes: SHIFT+, CTRL+
// Numbers can be decimal, $hex or 0xhex.

interface RunScriptContext {
  advance(): void;
  frameno(): number;
  readMem(addr: number): number;
  getPC(): number | null;
  sendKey(key: number, flags: number): void;
  reset(): void;
  disassemble(addr: number): { line: string; nbytes: number } | null;
}

const RUN_SCRIPT_HELP = [
  'run N | wait N | frames N     - advance N frames (default 1)',
  'runto ADDR [maxframes]        - run until PC==ADDR (cap default 1000 frames)',
  'key KEY                       - press key (down, 3 frames, up)',
  'keydown KEY / keyup KEY       - raw key down/up events',
  'mem START LEN                 - hexdump memory',
  'screen [START] [COLS] [ROWS]  - decode screen RAM to text (default $0400 40x25)',
  'pc                            - print PC + disassembly at PC',
  'reset                         - reset platform/machine',
  'echo TEXT                     - print message',
  '(KEY: char, ENTER/SPACE/LEFT/UP/RIGHT/DOWN/F1.., $hex; prefixes SHIFT+, CTRL+)',
].join('\n');

const KEY_NAMES: { [name: string]: number } = {
  'ENTER': 13, 'RETURN': 13, 'CR': 13,
  'SPACE': 32, 'ESC': 27, 'TAB': 9, 'BACKSPACE': 8, 'BS': 8,
  'DELETE': 46, 'DEL': 46, 'INSERT': 45,
  'LEFT': 37, 'UP': 38, 'RIGHT': 39, 'DOWN': 40,
  'HOME': 36, 'END': 35, 'PAGEUP': 33, 'PAGEDOWN': 34,
  'F1': 112, 'F2': 113, 'F3': 114, 'F4': 115, 'F5': 116, 'F6': 117,
  'F7': 118, 'F8': 119, 'F9': 120, 'F10': 121, 'F11': 122, 'F12': 123,
};

function parseNum(s: string): number {
  s = s.trim();
  if (s.startsWith('$')) return parseInt(s.substring(1), 16);
  if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16);
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  throw new Error(`bad number '${s}'`);
}

function parseKeyValue(tok: string): { key: number; flags: number } {
  var flags = 0;
  var t = tok.toUpperCase();
  for (;;) {
    if (t.startsWith('SHIFT+')) { flags |= KeyFlags.Shift; t = t.substring(6); }
    else if (t.startsWith('CTRL+')) { flags |= KeyFlags.Ctrl; t = t.substring(5); }
    else break;
  }
  if (KEY_NAMES[t] != null) return { key: KEY_NAMES[t], flags };
  if (t.length == 1) return { key: t.charCodeAt(0), flags };
  if (/^0X[0-9A-F]+$/.test(t)) return { key: parseInt(t, 16), flags };
  if (/^\d+$/.test(t)) return { key: parseInt(t, 10), flags };
  throw new Error(`unknown key '${tok}'`);
}

// C64-style screen code -> ASCII (also close enough for VIC-20 et al)
function screenCodeToChar(code: number): string {
  code &= 0xff;
  if (code >= 0x40) code &= 0x3f; // reverse-video / graphics variants
  if (code < 0x20) {
    const special = '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[£]^_';
    return special[code];
  }
  return String.fromCharCode(code); // $20-$3F identical to ASCII
}

function hexdumpMem(readFn: (addr: number) => number, start: number, end: number): void {
  var len = end - start + 1;
  for (var ofs = 0; ofs < len; ofs += 16) {
    var line = `${hex(start + ofs, 4)}:`;
    var ascii = '';
    for (var i = 0; i < 16 && ofs + i < len; i++) {
      if (i === 8) line += ' ';
      var byte = readFn(start + ofs + i);
      line += ` ${hex(byte)}`;
      ascii += (byte >= 0x20 && byte < 0x7f) ? String.fromCharCode(byte) : '.';
    }
    process.stdout.write(`${line}  ${ascii}\n`);
  }
}

function executeRunScript(script: string, ctx: RunScriptContext): void {
  var lines = script.split(/\r?\n|;/);
  for (var ln of lines) {
    ln = ln.trim();
    if (!ln || ln.startsWith('#') || ln.startsWith('//')) continue;
    var tokens = ln.split(/\s+/);
    var cmd = tokens[0].toLowerCase();
    try {
      switch (cmd) {
        case 'run': case 'wait': case 'frames': {
          var n = tokens[1] ? parseNum(tokens[1]) : 1;
          for (var i = 0; i < n; i++) ctx.advance();
          process.stdout.write(`[frame ${ctx.frameno()}] ran ${n} frame${n == 1 ? '' : 's'}\n`);
          break;
        }
        case 'runto': {
          if (!tokens[1]) throw new Error('runto requires an address');
          var addr = parseNum(tokens[1]);
          var maxf = tokens[2] ? parseNum(tokens[2]) : 1000;
          var startFrame = ctx.frameno();
          while (ctx.frameno() - startFrame < maxf) {
            ctx.advance();
            var pc = ctx.getPC();
            if (pc == null || pc === addr) break;
          }
          var pc = ctx.getPC();
          var hit = pc != null && pc === addr;
          process.stdout.write(`[frame ${ctx.frameno()}] runto $${hex(addr, 4)}: ${hit ? 'HIT' : 'MISSED'} (pc=${pc != null ? '$' + hex(pc, 4) : '?'} after ${ctx.frameno() - startFrame} frames)\n`);
          break;
        }
        case 'key': case 'press': {
          if (!tokens[1]) throw new Error('key requires a key name');
          var { key, flags } = parseKeyValue(tokens[1]);
          ctx.sendKey(key, flags | KeyFlags.KeyDown);
          for (var i = 0; i < 3; i++) ctx.advance();
          ctx.sendKey(key, flags | KeyFlags.KeyUp);
          ctx.advance();
          process.stdout.write(`[frame ${ctx.frameno()}] pressed ${tokens[1]} ($${hex(key, 2)})\n`);
          break;
        }
        case 'keydown': {
          if (!tokens[1]) throw new Error('keydown requires a key name');
          var { key, flags } = parseKeyValue(tokens[1]);
          ctx.sendKey(key, flags | KeyFlags.KeyDown);
          process.stdout.write(`[frame ${ctx.frameno()}] keydown ${tokens[1]} ($${hex(key, 2)})\n`);
          break;
        }
        case 'keyup': {
          if (!tokens[1]) throw new Error('keyup requires a key name');
          var { key, flags } = parseKeyValue(tokens[1]);
          ctx.sendKey(key, flags | KeyFlags.KeyUp);
          process.stdout.write(`[frame ${ctx.frameno()}] keyup ${tokens[1]} ($${hex(key, 2)})\n`);
          break;
        }
        case 'mem': {
          if (!tokens[1]) throw new Error('mem requires START [LEN]');
          var start = parseNum(tokens[1]);
          var len = tokens[2] ? parseNum(tokens[2]) : 16;
          process.stdout.write(`[frame ${ctx.frameno()}] mem $${hex(start, 4)}+$${hex(len, 4)}:\n`);
          hexdumpMem(ctx.readMem, start, start + len - 1);
          break;
        }
        case 'screen': {
          var start = tokens[1] ? parseNum(tokens[1]) : 0x400;
          var cols = tokens[2] ? parseNum(tokens[2]) : 40;
          var rows = tokens[3] ? parseNum(tokens[3]) : 25;
          process.stdout.write(`[frame ${ctx.frameno()}] screen at $${hex(start, 4)} (${cols}x${rows}):\n`);
          for (var y = 0; y < rows; y++) {
            var line = '';
            for (var x = 0; x < cols; x++) line += screenCodeToChar(ctx.readMem(start + y * cols + x));
            process.stdout.write(`|${line.replace(/\s+$/, '')}|\n`);
          }
          break;
        }
        case 'pc': {
          var pc = ctx.getPC();
          if (pc == null) throw new Error('no PC available');
          process.stdout.write(`[frame ${ctx.frameno()}] PC=$${hex(pc, 4)}\n`);
          var addr = pc;
          for (var i = 0; i < 8; i++) {
            var d = ctx.disassemble(addr);
            if (!d) break;
            var bytesStr = '';
            for (var b = 0; b < d.nbytes; b++) bytesStr += hex(ctx.readMem(addr + b)) + ' ';
            process.stdout.write(`  $${hex(addr, 4)}  ${bytesStr.padEnd(12)} ${d.line}\n`);
            addr += d.nbytes;
          }
          break;
        }
        case 'reset': {
          ctx.reset();
          process.stdout.write(`[frame ${ctx.frameno()}] reset\n`);
          break;
        }
        case 'echo': {
          process.stdout.write(ln.substring(cmd.length).trim() + '\n');
          break;
        }
        default:
          throw new Error(`unknown command (try: ${RUN_SCRIPT_HELP.split('\n')[0].split(' ')[0]}, ...)`);
      }
    } catch (e: any) {
      throw new Error(`script error on '${ln}': ${e.message}\nCommands:\n${RUN_SCRIPT_HELP}`);
    }
  }
}

async function doRun(args: { [key: string]: string }, positional: string[]): Promise<void> {
  var platformId = args['platform'];
  var machine = args['machine'];
  var frames = parseInt(args['frames'] || '1');
  var outputFile = args['output'];
  var romFile = positional[0];

  if ((!machine && !platformId) || !romFile) {
    output({
      success: false,
      command: 'run',
      error: 'Required: (--platform <id> | --machine <module:ClassName>) [--frames N] [--output <file.png>] <rom>'
    });
    process.exit(1);
  }

  var romData = new Uint8Array(fs.readFileSync(romFile));
  var pixels: Uint32Array | null = null;
  var vid: { width: number; height: number } | null = null;
  var platformRunner: any = null;
  var machineInstance: any = null;
  var runner: any = null;

  if (platformId) {
    // Platform mode: load platform module, mock video, run via Platform API
    var { PlatformRunner, loadPlatform } = await import('./runmachine');
    platformRunner = new PlatformRunner(await loadPlatform(platformId));
    await platformRunner.start();
    platformRunner.loadROM("ROM", romData);
  } else {
    // Machine mode: load machine class directly
    var parts = machine.split(':');
    if (parts.length !== 2) {
      output({
        success: false,
        command: 'run',
        error: 'Machine must be in format module:ClassName (e.g. apple2:AppleII)'
      });
      process.exit(1);
    }
    var [modname, clsname] = parts;
    var { MachineRunner, loadMachine } = await import('./runmachine');
    machineInstance = await loadMachine(modname, clsname);
    runner = new MachineRunner(machineInstance);
    runner.setup();
    machineInstance.loadROM(romData);
  }

  // Build the execution context for frame loop / run-script
  var frameno = 0;
  var advance = () => {
    if (platformRunner) platformRunner.run(); else runner.run();
    frameno++;
  };
  var debugTarget: any = platformRunner ? platformRunner.platform : machineInstance;
  var keyTarget: any = platformRunner ? (platformRunner.platform as any).machine : machineInstance;
  var readMem = (addr: number): number => {
    if (platformRunner) return platformRunner.platform.readAddress(addr);
    var m = machineInstance as any;
    return typeof m.readAddress === 'function' ? m.readAddress(addr) : m.readConst(addr);
  };
  var getPC = (): number | null => {
    try { return typeof debugTarget.getPC === 'function' ? debugTarget.getPC() : null; }
    catch (e) { return null; }
  };
  var sendKey = (key: number, flags: number) => {
    if (keyTarget && typeof keyTarget.setKeyInput === 'function') keyTarget.setKeyInput(key, key, flags);
    else if (typeof debugTarget.setKeyInput === 'function') debugTarget.setKeyInput(key, key, flags);
    else throw new Error('platform/machine does not support setKeyInput');
  };
  var disassemble = (addr: number) => {
    try { return typeof debugTarget.disassemble === 'function' ? debugTarget.disassemble(addr, readMem) : null; }
    catch (e) { return null; }
  };

  if (args['script']) {
    // --script: inline commands or a path to a script file
    var scriptText = args['script'];
    if (fs.existsSync(scriptText)) scriptText = fs.readFileSync(scriptText, 'utf8');
    executeRunScript(scriptText, {
      advance,
      frameno: () => frameno,
      readMem,
      getPC,
      sendKey,
      reset: () => debugTarget.reset(),
      disassemble,
    });
  } else {
    for (var i = 0; i < frames; i++) advance();
  }

  pixels = platformRunner ? platformRunner.pixels : runner.pixels;
  vid = pixels ? (platformRunner ? platformRunner.videoParams : (machineInstance as any).getVideoParams()) : null;

  output({
    success: true,
    command: 'run',
    data: {
      platform: platformId || null,
      machine: machine || null,
      rom: romFile,
      frames: frames,
      width: vid ? vid.width : null,
      height: vid ? vid.height : null,
      outputFile: outputFile || null,
    }
  });

  // --info: print debug info for all categories + disassembly at PC
  if (args['info'] === 'true') {
    var plat = platformId ? platformRunner.platform : null;
    var mach = machine ? machineInstance : null;
    var debugTarget: any = plat || mach;
    if (debugTarget && isDebuggable(debugTarget)) {
      var state = plat?.saveState?.() ?? mach?.saveState?.();
      if (state) {
        var categories = debugTarget.getDebugCategories();
        for (var cat of categories) {
          var info = debugTarget.getDebugInfo(cat, state);
          if (info) {
            process.stderr.write(`${c.bold}${c.magenta}[${cat}]${c.reset}\n`);
            process.stderr.write(info);
            if (!info.endsWith('\n')) process.stderr.write('\n');
          }
        }
      }
    }
    // Disassembly around current PC
    if (debugTarget?.getPC && debugTarget?.disassemble && debugTarget?.readAddress) {
      var pc = debugTarget.getPC();
      var readFn = (addr: number) => debugTarget.readAddress(addr);
      process.stderr.write(`${c.bold}${c.magenta}[Disassembly]${c.reset}\n`);
      var addr = pc;
      for (var i = 0; i < 16; i++) {
        var disasm = debugTarget.disassemble(addr, readFn);
        var prefix = (addr === pc) ? `${c.green}>${c.reset}` : ' ';
        // show hex bytes
        var bytesStr = '';
        for (var b = 0; b < disasm.nbytes; b++) {
          bytesStr += hex(readFn(addr + b)) + ' ';
        }
        process.stderr.write(`${prefix}${c.cyan}$${hex(addr, 4)}${c.reset}  ${c.dim}${bytesStr.padEnd(12)}${c.reset} ${disasm.line}\n`);
        addr += disasm.nbytes;
      }
    }
  }

  // --memdump start,end: hexdump memory range
  if (args['memdump']) {
    var mdparts = args['memdump'].split(',');
    var start = parseInt(mdparts[0], 16);
    var end = parseInt(mdparts[1], 16);
    if (isNaN(start) || isNaN(end) || end < start) {
      output({ success: false, command: 'run', error: `Invalid --memdump range: ${args['memdump']} (use hex addresses like 0000,00ff)` });
      process.exit(1);
    }
    var plat2 = platformId ? platformRunner.platform : null;
    var mach2 = machine ? machineInstance : null;
    var readFn2: ((addr: number) => number) | null = null;
    if (plat2?.readAddress) readFn2 = (addr) => plat2.readAddress(addr);
    else if (mach2 && typeof (mach2 as any).read === 'function') readFn2 = (addr) => (mach2 as any).read(addr);
    if (!readFn2) {
      output({ success: false, command: 'run', error: 'Platform/machine does not support readAddress' });
      process.exit(1);
    }
    process.stdout.write(`memdump $${hex(start, 4)}-$${hex(end, 4)}:\n`);
    hexdumpMem(readFn2, start, end);
  }

  // Encode framebuffer as PNG if video is available
  var pngData: Uint8Array | null = null;
  if (pixels && vid) {
    var { encode } = await import('fast-png');
    var rgba = new Uint8Array(pixels.buffer);
    pngData = encode({ width: vid.width, height: vid.height, data: rgba, channels: 4 });
  }

  // Write PNG to file if requested
  if (outputFile && pngData) {
    fs.writeFileSync(outputFile, pngData);
  }

  // Display image in terminal if connected to a TTY
  if (pngData && process.stdout.isTTY) {
    var { displayImageInTerminal } = await import('./termimage');
    displayImageInTerminal(pngData, vid.width, vid.height);
  }
}

function doListTools(): void {
  var tools = listTools();
  output({
    success: true,
    command: 'list-tools',
    data: {
      tools: tools,
      count: tools.length
    }
  });
}

function doListPlatforms(): void {
  var platforms = listPlatforms();
  var details: { [key: string]: any } = {};
  for (var p of platforms) {
    details[p] = {
      arch: PLATFORM_PARAMS[p].arch || 'unknown',
    };
  }
  output({
    success: true,
    command: 'list-platforms',
    data: {
      platforms: details,
      count: platforms.length
    }
  });
}

async function main() {
  if (process.argv.length < 3) {
    usage();
  }

  var { command, args, positional } = parseArgs(process.argv);

  // Check for --json flag (can appear before or after the command)
  if (args['json'] === 'true' || process.argv.includes('--json')) {
    jsonMode = true;
  }

  try {
    switch (command) {
      case 'compile':
        await initialize();
        await doCompile(args, positional, false);
        break;
      case 'check':
        await initialize();
        await doCompile(args, positional, true);
        break;
      case 'run':
        await doRun(args, positional);
        break;
      case 'list-tools':
        await initialize();
        doListTools();
        break;
      case 'list-platforms':
        await initialize();
        doListPlatforms();
        break;
      default:
        output({
          success: false,
          command: command,
          error: `Unknown command: ${command}`
        });
        process.exit(1);
    }
  } catch (e) {
    console.log(e);
    output({
      success: false,
      command: command,
      error: e.message || String(e)
    });
    process.exit(1);
  }
}

main();
