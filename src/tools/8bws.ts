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

function outputJSON(result: CLIResult): void {
  console.log(JSON.stringify(result, null, 2));
}

function usage(): void {
  outputJSON({
    success: false,
    command: 'help',
    data: {
      commands: {
        'compile': 'compile --platform <platform> [--tool <tool>] [--output <file>] <source>',
        'check': 'check --platform <platform> [--tool <tool>] <source>',
        'run': 'run --platform <platform> [--frames N] <rom>',
        'list-tools': 'list-tools',
        'list-platforms': 'list-platforms',
      }
    },
    error: 'No command specified'
  });
  process.exit(1);
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

async function doCompile(args: { [key: string]: string }, positional: string[], checkOnly: boolean): Promise<void> {
  var tool = args['tool'];
  var platform = args['platform'];
  var outputFile = args['output'];
  var sourceFile = positional[0];

  if (!platform || !sourceFile) {
    outputJSON({
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
    outputJSON({
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
    outputJSON({
      success: false,
      command: checkOnly ? 'check' : 'compile',
      data: { errors: result.errors }
    });
    process.exit(1);
  }

  if (checkOnly) {
    outputJSON({
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

  outputJSON({
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
  var platform = args['platform'];
  var frames = parseInt(args['frames'] || '1');
  var romFile = positional[0];

  if (!platform || !romFile) {
    outputJSON({
      success: false,
      command: 'run',
      error: 'Required: --platform <platform> <rom>'
    });
    process.exit(1);
  }

  // Dynamic import of MachineRunner
  try {
    var runmachine = require('./runmachine.js');
    var MachineRunner = runmachine.MachineRunner;
  } catch (e) {
    outputJSON({
      success: false,
      command: 'run',
      error: `Could not load MachineRunner: ${e.message}`
    });
    process.exit(1);
  }

  outputJSON({
    success: false,
    command: 'run',
    error: 'Run command not yet fully implemented (requires platform machine loading)'
  });
}

function doListTools(): void {
  var tools = listTools();
  outputJSON({
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
  outputJSON({
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
        outputJSON({
          success: false,
          command: command,
          error: `Unknown command: ${command}`
        });
        process.exit(1);
    }
  } catch (e) {
    outputJSON({
      success: false,
      command: command,
      error: e.message || String(e)
    });
    process.exit(1);
  }
}

main();
