#!/usr/bin/env node
"use strict";
// 8bws - 8bitworkshop CLI tool for compilation, ROM execution, and platform info
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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const testlib_1 = require("./testlib");
function outputJSON(result) {
    console.log(JSON.stringify(result, null, 2));
}
function usage() {
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
function parseArgs(argv) {
    var command = argv[2];
    var args = {};
    var positional = [];
    for (var i = 3; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            var key = argv[i].substring(2);
            if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
                args[key] = argv[++i];
            }
            else {
                args[key] = 'true';
            }
        }
        else {
            positional.push(argv[i]);
        }
    }
    return { command, args, positional };
}
async function doCompile(args, positional, checkOnly) {
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
        tool = (0, testlib_1.getToolForFilename)(sourceFile, platform);
    }
    if (!testlib_1.TOOLS[tool]) {
        outputJSON({
            success: false,
            command: checkOnly ? 'check' : 'compile',
            error: `Unknown tool: ${tool}. Use list-tools to see available tools.`
        });
        process.exit(1);
    }
    // Preload the tool's filesystem if needed
    var preloadKey = tool;
    if (testlib_1.TOOL_PRELOADFS[tool + '-' + platform]) {
        preloadKey = tool;
    }
    await (0, testlib_1.preload)(tool, platform);
    var result = await (0, testlib_1.compileSourceFile)(tool, platform, sourceFile);
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
        }
        else if (typeof outData === 'object') {
            fs.writeFileSync(outputFile, JSON.stringify(outData));
        }
        else {
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
async function doRun(args, positional) {
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
    }
    catch (e) {
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
function doListTools() {
    var tools = (0, testlib_1.listTools)();
    outputJSON({
        success: true,
        command: 'list-tools',
        data: {
            tools: tools,
            count: tools.length
        }
    });
}
function doListPlatforms() {
    var platforms = (0, testlib_1.listPlatforms)();
    var details = {};
    for (var p of platforms) {
        details[p] = {
            arch: testlib_1.PLATFORM_PARAMS[p].arch || 'unknown',
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
                await (0, testlib_1.initialize)();
                await doCompile(args, positional, false);
                break;
            case 'check':
                await (0, testlib_1.initialize)();
                await doCompile(args, positional, true);
                break;
            case 'run':
                await doRun(args, positional);
                break;
            case 'list-tools':
                await (0, testlib_1.initialize)();
                doListTools();
                break;
            case 'list-platforms':
                await (0, testlib_1.initialize)();
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
    }
    catch (e) {
        outputJSON({
            success: false,
            command: command,
            error: e.message || String(e)
        });
        process.exit(1);
    }
}
main();
//# sourceMappingURL=8bws.js.map