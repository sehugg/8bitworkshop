#!/usr/bin/env node
"use strict";
// 8bws - 8bitworkshop command line tool.
//
//   8bws build --platform c64 hello.c -o hello.prg
//   8bws run   --platform c64 hello.c -e "run 100; screen"
//   8bws run   --platform c64 hello.prg --png shot.png
//
// Two verbs: `build` compiles a source file, `run` executes a ROM -- or a
// source file, which it builds first. Emulation goes through EmuTarget
// (emutarget.ts).
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
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const util_1 = require("../common/util");
const cliformat_1 = require("./cliformat");
const emutarget_1 = require("./emutarget");
const runscript_1 = require("./runscript");
/** ROM extensions that name exactly one platform. */
const ROM_PLATFORMS = {
    '.nes': 'nes', '.gb': 'gb', '.gbc': 'gb', '.a26': 'vcs', '.a78': 'atari7800',
    '.sms': 'sms', '.col': 'coleco', '.vec': 'vector',
};
/** Extensions always treated as ROMs, even if the contents look like text. */
const ROM_EXTS = new Set(['.rom', '.bin', ...Object.keys(ROM_PLATFORMS)]);
const SHORT_FLAGS = {
    p: 'platform', t: 'tool', o: 'output', f: 'frames', e: 'eval',
};
// Flags that never take a value, per command. Everything else consumes the
// next argument unless that argument is another flag.
const BOOLEAN_FLAGS = {
    build: ['check', 'symbols', 'save'],
    run: ['info'],
};
const ALIASES = {
    compile: 'build',
    check: 'build',
    compilerun: 'run',
};
function parseArgs(argv) {
    let command = argv[2] || 'help';
    if (command.startsWith('-'))
        command = 'help';
    const resolved = ALIASES[command] || command;
    const booleans = new Set(['json', ...(BOOLEAN_FLAGS[resolved] || [])]);
    const args = {};
    const positional = [];
    if (command === 'check')
        args['check'] = true;
    for (let i = 3; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('-') || arg === '-') {
            positional.push(arg);
            continue;
        }
        const key = arg.startsWith('--') ? arg.substring(2) : (SHORT_FLAGS[arg.substring(1)] || arg.substring(1));
        const next = argv[i + 1];
        if (!booleans.has(key) && next != null && !next.startsWith('--'))
            args[key] = argv[++i];
        else
            args[key] = true;
    }
    return { command: resolved, args, positional };
}
function str(args, key) {
    const v = args[key];
    return typeof v === 'string' ? v : undefined;
}
/** Compile one source file. Exits with the compiler's errors if it fails. */
async function compileSource(args, source, platform) {
    const { compileSourceFile, getToolForFilename, initialize, preload, TOOLS } = await Promise.resolve().then(() => __importStar(require('./testlib')));
    await initialize();
    const tool = str(args, 'tool') || getToolForFilename(source, platform);
    if (!TOOLS[tool]) {
        (0, cliformat_1.fail)('build', `Unknown tool: ${tool}. Use list-tools to see available tools.`);
    }
    await preload(tool, platform);
    const result = await compileSourceFile(tool, platform, source);
    if (!result.success) {
        (0, cliformat_1.fail)('build', `${tool} failed on ${source}`, { errors: result.errors });
    }
    return { rom: romBytes(result), symbolmap: result.symbolmap || {}, tool, platform, source, result };
}
async function doBuild(args, positional) {
    const source = positional[0];
    const platform = str(args, 'platform');
    const checkOnly = !!args['check'];
    if (!platform || !source) {
        (0, cliformat_1.fail)('build', 'Required: build --platform <platform> <source> [--tool <tool>] [-o <file>]');
    }
    const built = await compileSource(args, source, platform);
    const outputFile = str(args, 'output');
    if (outputFile && !checkOnly)
        fs.writeFileSync(outputFile, Buffer.from(built.rom));
    const data = {
        tool: built.tool, platform, source,
        outputSize: built.rom.length,
        outputFile: outputFile || null,
    };
    if (args['symbols']) {
        if (built.result.symbolmap)
            data.symbolmap = built.result.symbolmap;
        if (built.result.segments)
            data.segments = built.result.segments;
    }
    if (args['save'])
        await saveBuildFiles(source, data);
    (0, cliformat_1.output)({ success: true, command: checkOnly ? 'check' : 'build', data });
}
/** Dump every intermediate file the build produced to a temp directory. */
async function saveBuildFiles(source, data) {
    const { store } = await Promise.resolve().then(() => __importStar(require('./testlib')));
    const saveDir = path.join(os.tmpdir(), `8bws-${path.basename(source, path.extname(source))}`);
    fs.mkdirSync(saveDir, { recursive: true });
    data.savedFiles = [];
    for (const [filePath, entry] of Object.entries(store.workfs)) {
        const outPath = path.join(saveDir, filePath);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, entry.data);
        data.savedFiles.push(filePath);
    }
    data.saveDir = saveDir;
}
function romBytes(result) {
    var _a, _b;
    const out = (_b = (_a = result.output) === null || _a === void 0 ? void 0 : _a.code) !== null && _b !== void 0 ? _b : result.output;
    if (out instanceof Uint8Array)
        return out;
    if (typeof out === 'string')
        return new TextEncoder().encode(out);
    throw new Error('compiler produced no ROM image');
}
////////////////////////////////////////////////////////////////////////
// run
/** A source file is anything that isn't obviously a ROM image. */
function looksLikeROM(file) {
    if (ROM_EXTS.has(path.extname(file).toLowerCase()))
        return true;
    return (0, util_1.isProbablyBinary)(file, fs.readFileSync(file));
}
async function openTarget(args, platformId) {
    const target = await (0, emutarget_1.loadPlatform)(platformId);
    await target.start();
    const bios = str(args, 'bios');
    if (bios && !target.loadBIOS(new Uint8Array(fs.readFileSync(bios)))) {
        (0, cliformat_1.fail)('run', `'${target.id}' does not accept a BIOS image`);
    }
    return target;
}
/** Turn the run flags into script commands, appended to any --script/-e text. */
function buildScript(args) {
    var _a, _b;
    const parts = [];
    if (args['frames'])
        parts.push(`run ${(_a = str(args, 'frames')) !== null && _a !== void 0 ? _a : 1}`);
    const script = (_b = str(args, 'eval')) !== null && _b !== void 0 ? _b : str(args, 'script');
    if (script)
        parts.push(fs.existsSync(script) ? fs.readFileSync(script, 'utf8') : script);
    if (args['info'])
        parts.push('info');
    const memdump = str(args, 'memdump');
    if (memdump) {
        const [start, end] = memdump.split(',').map((s) => (0, runscript_1.parseNum)(s.startsWith('$') || /^0x/i.test(s) ? s : '$' + s));
        if (isNaN(start) || isNaN(end) || end < start) {
            (0, cliformat_1.fail)('run', `Invalid --memdump range: ${memdump} (use hex addresses like 0000,00ff)`);
        }
        parts.push(`mem $${start.toString(16)} ${end - start + 1}`);
    }
    return parts.length ? parts.join('\n') : 'run 1';
}
async function doRun(args, positional) {
    var _a, _b;
    const input = positional[0];
    if (!input) {
        (0, cliformat_1.fail)('run', 'Required: run --platform <id> <rom-or-source>');
    }
    if (!fs.existsSync(input))
        (0, cliformat_1.fail)('run', `No such file: ${input}`);
    // A source file is built first; a ROM is loaded as-is.
    let romFile = input;
    let symbols = {};
    let platformId = str(args, 'platform') || ROM_PLATFORMS[path.extname(input).toLowerCase()];
    if (!looksLikeROM(input)) {
        if (!platformId)
            (0, cliformat_1.fail)('run', `Building ${input} requires --platform`);
        const built = await compileSource(args, input, platformId);
        romFile = path.join(os.tmpdir(), '8bws-' + path.basename(input).replace(/\.\w+$/, '') + '.rom');
        fs.writeFileSync(romFile, Buffer.from(built.rom));
        symbols = built.symbolmap;
        (0, cliformat_1.note)(`built ${input} with ${built.tool} -> ${romFile} (${built.rom.length} bytes)`);
    }
    else if (!platformId) {
        (0, cliformat_1.fail)('run', `Cannot infer a platform from '${path.basename(input)}': pass --platform`);
    }
    const target = await openTarget(args, platformId);
    target.loadROM(new Uint8Array(fs.readFileSync(romFile)), path.basename(romFile));
    const script = new runscript_1.RunScript(target);
    script.addSymbols(symbols);
    const symbolFile = str(args, 'symbols');
    if (symbolFile)
        script.addSymbols((0, runscript_1.parseSymbolFile)(fs.readFileSync(symbolFile, 'utf8')));
    script.startTracing();
    script.run(buildScript(args));
    const video = target.getVideo();
    (0, cliformat_1.output)({
        success: true,
        command: 'run',
        data: {
            platform: target.id,
            rom: romFile,
            frames: target.frameCount,
            width: (_a = video === null || video === void 0 ? void 0 : video.width) !== null && _a !== void 0 ? _a : null,
            height: (_b = video === null || video === void 0 ? void 0 : video.height) !== null && _b !== void 0 ? _b : null,
            png: str(args, 'png') || null,
        }
    });
    await writeScreenshot(video, str(args, 'png'));
}
async function writeScreenshot(video, pngFile) {
    if (!video)
        return;
    const showInTerminal = process.stdout.isTTY;
    if (!pngFile && !showInTerminal)
        return;
    const { encode } = await Promise.resolve().then(() => __importStar(require('fast-png')));
    const png = encode({
        width: video.width, height: video.height,
        data: new Uint8Array(video.pixels.buffer), channels: 4
    });
    if (pngFile)
        fs.writeFileSync(pngFile, png);
    if (showInTerminal) {
        const { displayImageInTerminal } = await Promise.resolve().then(() => __importStar(require('./termimage')));
        displayImageInTerminal(png, video.width, video.height);
    }
}
////////////////////////////////////////////////////////////////////////
// listings & help
async function doList(command) {
    const { initialize, listPlatforms, listTools, PLATFORM_PARAMS } = await Promise.resolve().then(() => __importStar(require('./testlib')));
    await initialize();
    if (command === 'list-tools') {
        (0, cliformat_1.output)({ success: true, command, data: { tools: listTools() } });
        return;
    }
    const platforms = {};
    for (const p of listPlatforms())
        platforms[p] = { arch: PLATFORM_PARAMS[p].arch || 'unknown' };
    (0, cliformat_1.output)({ success: true, command, data: { platforms, count: Object.keys(platforms).length } });
}
function usage(error) {
    (0, cliformat_1.output)({
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
            script: runscript_1.RUN_SCRIPT_HELP,
        }
    });
    process.exit(error ? 1 : 0);
}
////////////////////////////////////////////////////////////////////////
async function main() {
    const { command, args, positional } = parseArgs(process.argv);
    if (args['json'])
        (0, cliformat_1.setJsonMode)(true);
    // A platform whose start() never settles (usually one that needs a
    // browser-only library) drains the event loop and would otherwise exit 0.
    process.on('exit', () => {
        if ((0, cliformat_1.hasOutput)())
            return;
        (0, cliformat_1.output)({ success: false, command, error: `${command} did not run to completion -- the emulator never finished starting` });
        process.exitCode = 1;
    });
    try {
        switch (command) {
            case 'build':
                await doBuild(args, positional);
                break;
            case 'run':
                await doRun(args, positional);
                break;
            case 'list-tools':
            case 'list-platforms':
                await doList(command);
                break;
            case 'help':
                usage();
                break;
            default: usage(`Unknown command: ${command}`);
        }
    }
    catch (e) {
        if (process.env.DEBUG)
            console.error(e);
        (0, cliformat_1.output)({ success: false, command, error: e.message || String(e) });
        process.exit(1);
    }
}
main();
//# sourceMappingURL=8bws.js.map