#!/usr/bin/env node

// 8bws - 8bitworkshop CLI tool for compilation, ROM execution, and platform info

import * as fs from 'fs';
import { initialize, compile, compileSourceFile, preload, listTools, listPlatforms, getToolForFilename, PLATFORM_PARAMS, TOOLS, TOOL_PRELOADFS } from './testlib';

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
    console.log(`  ${c.yellow}--json${c.reset}${c.dim}  Output raw JSON instead of formatted text${c.reset}`);
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

function parseArgs(argv: string[]): { command: string; args: { [key: string]: string }; positional: string[] } {
  var command = argv[2];
  var args: { [key: string]: string } = {};
  var positional: string[] = [];

  for (var i = 3; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      var key = argv[i].substring(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
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
        'compile': 'compile --platform <platform> [--tool <tool>] [--output <file>] <source>',
        'check': 'check --platform <platform> [--tool <tool>] <source>',
        'run': 'run (--platform <id> | --machine <module:ClassName>) [--frames N] [--output <file.png>] <rom>',
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
  var preloadKey = tool;
  if (TOOL_PRELOADFS[tool + '-' + platform]) {
    preloadKey = tool;
  }
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

  output({
    success: true,
    command: 'compile',
    data: {
      tool: tool,
      platform: platform,
      source: sourceFile,
      outputSize: outputSize,
      outputFile: outputFile || null,
      hasListings: result.listings ? Object.keys(result.listings).length > 0 : false,
      hasSymbolmap: !!result.symbolmap,
    }
  });
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

  if (platformId) {
    // Platform mode: load platform module, mock video, run via Platform API
    var { PlatformRunner, loadPlatform } = await import('./runmachine');
    var platformRunner = new PlatformRunner(await loadPlatform(platformId));
    await platformRunner.start();
    platformRunner.loadROM("ROM", romData);
    for (var i = 0; i < frames; i++) {
      platformRunner.run();
    }
    pixels = platformRunner.pixels;
    vid = platformRunner.videoParams;
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
    var machineInstance = await loadMachine(modname, clsname);
    var runner = new MachineRunner(machineInstance);
    runner.setup();
    machineInstance.loadROM(romData);
    for (var i = 0; i < frames; i++) {
      runner.run();
    }
    pixels = runner.pixels;
    vid = pixels ? (machineInstance as any).getVideoParams() : null;
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
    output({
      success: false,
      command: command,
      error: e.message || String(e)
    });
    process.exit(1);
  }
}

main();
