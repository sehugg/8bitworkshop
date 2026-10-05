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
const verifyreplay_1 = require("./verifyreplay");
const vcdfile_1 = require("./vcdfile");
const debugcontroller_1 = require("../common/debugcontroller");
const workertypes_1 = require("../common/workertypes");
const symbolfile_1 = require("../common/symbols/symbolfile");
const testlib_1 = require("./testlib");
const detect_1 = require("../common/detect");
const toolroot_1 = require("./toolroot");
const toolmeta_1 = require("../common/toolmeta");
/** Options that may be repeated; each occurrence adds to a list. */
const REPEATABLE_FLAGS = new Set([
    'define', 'as-define', 'ld-define', 'cflag', 'asflag', 'ldflag',
]);
/** Extensions always treated as ROMs, even if the contents look like text. */
const ROM_EXTS = new Set(['.rom', '.bin', ...Object.keys(detect_1.ROM_PLATFORMS)]);
const SHORT_FLAGS = {
    p: 'platform', t: 'tool', o: 'output', f: 'frames', e: 'eval',
};
// Flags that never take a value, per command. Everything else consumes the
// next argument unless that argument is another flag.
const BOOLEAN_FLAGS = {
    build: ['check', 'symbols', 'save', 'no-warnings'],
    run: ['info', 'no-warnings'],
    'verify-replay': ['verbose'],
};
const ALIASES = {
    compile: 'build',
    check: 'build',
    compilerun: 'run',
    verify: 'verify-replay',
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
        if (!booleans.has(key) && next != null && !next.startsWith('--')) {
            const val = argv[++i];
            if (REPEATABLE_FLAGS.has(key)) {
                const cur = args[key];
                if (cur == null)
                    args[key] = [val];
                else if (Array.isArray(cur))
                    cur.push(val);
                else
                    args[key] = [cur, val];
            }
            else
                args[key] = val;
        }
        else
            args[key] = true;
    }
    return { command: resolved, args, positional };
}
function str(args, key) {
    const v = args[key];
    return typeof v === 'string' ? v : undefined;
}
/** All values for a repeatable option (empty if absent). */
function list(args, key) {
    const v = args[key];
    if (v == null)
        return [];
    return Array.isArray(v) ? v : [v];
}
/** Build-symbol / build-arg overrides from the command line. */
function buildOverrides(args) {
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
/** Compile one source file. Exits with the compiler's errors if it fails. */
async function compileSource(args, source, platform) {
    const { compileSourceFile, getToolForFilename, initialize, preload, TOOLS } = await Promise.resolve().then(() => __importStar(require('./testlib')));
    await initialize();
    const tool = str(args, 'tool') || getToolForFilename(source, platform);
    if (!TOOLS[tool]) {
        (0, cliformat_1.fail)('build', `Unknown tool: ${tool}. Use list-tools to see available tools.`);
    }
    await (0, toolroot_1.ensureToolchains)(platform, tool, fs.readFileSync(source, 'utf8'));
    await preload(tool, platform);
    const result = await compileSourceFile(tool, platform, source, undefined, buildOverrides(args));
    if (result.internal) {
        (0, cliformat_1.warn)(`${result.internal.tool} crashed; the IDE would send an error report: ${result.internal.msg}`);
        if (process.env.DEBUG)
            console.error(result.internal.stack);
    }
    if (!result.success) {
        (0, cliformat_1.fail)('build', `${tool} failed on ${source}`, { errors: result.errors, internal: result.internal });
    }
    if (result.warnings && result.warnings.length && !args['no-warnings']) {
        for (const w of result.warnings)
            (0, cliformat_1.warn)(`${w.path || source}:${w.line}: ${w.msg}`);
    }
    return { rom: (0, testlib_1.romBytes)(result), symbolmap: result.symbolmap || {}, tool, platform, source, result };
}
async function doBuild(args, positional) {
    var _a;
    let source = positional[0];
    const checkOnly = !!args['check'];
    if (!source) {
        (0, cliformat_1.fail)('build', 'Required: build [--platform <platform>] <source> [--tool <tool>] [-o <file>]');
    }
    if (!fs.existsSync(source))
        (0, cliformat_1.fail)('build', `No such file: ${source}`);
    const platformArg = str(args, 'platform');
    let resolvedPlatform;
    if (fs.statSync(source).isDirectory()) {
        const resolved = await resolveDirectory('build', source, platformArg);
        source = resolved.source;
        resolvedPlatform = resolved.platform;
    }
    const platform = platformArg || resolvedPlatform || await inferPlatform('build', source);
    const built = await compileSource(args, source, platform);
    const outputFile = str(args, 'output');
    if (outputFile && !checkOnly) {
        if (!built.rom)
            (0, cliformat_1.fail)('build', `${built.tool} produces no ROM image to write`);
        fs.writeFileSync(outputFile, Buffer.from(built.rom));
    }
    const data = {
        tool: built.tool, platform, source,
        outputSize: built.rom ? built.rom.length : null,
        outputFile: outputFile || null,
    };
    if ((_a = built.result.warnings) === null || _a === void 0 ? void 0 : _a.length)
        data.warnings = built.result.warnings;
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
    const vectorSize = str(args, 'vector-size');
    if (vectorSize)
        target.vectorSize = parseInt(vectorSize);
    await target.start();
    const bios = str(args, 'bios');
    if (bios && !target.loadBIOS(new Uint8Array(fs.readFileSync(bios)))) {
        (0, cliformat_1.fail)('run', `'${target.id}' does not accept a BIOS image`);
    }
    return target;
}
/** Turn the run flags into script commands, appended to any --script/-e text. */
function buildScript(args) {
    var _a, _b, _c;
    const parts = [];
    const frameDir = str(args, 'frames-dir');
    // --frames-dir records frames instead of just advancing, so it goes last,
    // after any --script/-e setup (e.g. `run 60` to reach the title screen)
    if (args['frames'] && !frameDir)
        parts.push(`run ${(_a = str(args, 'frames')) !== null && _a !== void 0 ? _a : 1}`);
    const script = (_b = str(args, 'eval')) !== null && _b !== void 0 ? _b : str(args, 'script');
    if (script)
        parts.push(fs.existsSync(script) ? fs.readFileSync(script, 'utf8') : script);
    if (frameDir)
        parts.push(`capture ${(_c = str(args, 'frames')) !== null && _c !== void 0 ? _c : 60} ${frameDir}`);
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
/** Build `input` if it's source, and load it into a new emulator. */
async function openProgram(command, args, input) {
    if (!input) {
        (0, cliformat_1.fail)(command, `Required: ${command} --platform <id> <rom-or-source>`);
    }
    if (!fs.existsSync(input))
        (0, cliformat_1.fail)(command, `No such file: ${input}`);
    const platformArg = str(args, 'platform');
    let resolvedPlatform;
    if (fs.statSync(input).isDirectory()) {
        const resolved = await resolveDirectory(command, input, platformArg);
        input = resolved.source;
        resolvedPlatform = resolved.platform;
    }
    // A source file is built first; a ROM is loaded as-is.
    let romFile = input;
    let symbols = {};
    let built;
    let platformId = platformArg || resolvedPlatform || detect_1.ROM_PLATFORMS[path.extname(input).toLowerCase()];
    if (!looksLikeROM(input)) {
        if (!platformId)
            platformId = await inferPlatform(command, input);
        built = await compileSource(args, input, platformId);
        symbols = built.symbolmap;
        if (built.rom) {
            romFile = path.join(os.tmpdir(), '8bws-' + path.basename(input).replace(/\.\w+$/, '') + '.rom');
            fs.writeFileSync(romFile, Buffer.from(built.rom));
            (0, cliformat_1.note)(`built ${input} with ${built.tool} -> ${romFile} (${built.rom.length} bytes)`);
        }
        else {
            romFile = null; // loaded straight from the build
            (0, cliformat_1.note)(`built ${input} with ${built.tool}`);
        }
    }
    else if (!platformId) {
        (0, cliformat_1.fail)(command, `Cannot infer a platform from '${path.basename(input)}': pass --platform`);
    }
    const target = await openTarget(args, platformId);
    // The temp file is always written as .rom, but some platforms use the title
    // to pick a load format -- an Atari XEX named .rom would load as a cartridge.
    if (built)
        target.setFileData(built.result.files || {});
    if (romFile) {
        let romTitle = path.basename(romFile);
        if (built && target.platform.getROMExtension) {
            romTitle = path.basename(romFile, '.rom') + target.platform.getROMExtension(new Uint8Array(built.rom));
        }
        await target.loadROM(new Uint8Array(fs.readFileSync(romFile)), romTitle);
    }
    else {
        await target.loadROM(built.result.output, path.basename(input));
    }
    let debugInfo;
    if (built) {
        const mainPath = path.basename(input);
        debugInfo = Object.assign(Object.assign({}, (0, workertypes_1.buildProducts)(built.result)), { mainPath, paths: [mainPath] });
    }
    return { target, source: input, romFile, built, symbols, debugInfo };
}
async function doRun(args, positional) {
    var _a, _b, _c;
    const input = positional[0];
    const { target, romFile, symbols, debugInfo } = await openProgram('run', args, input);
    const script = new runscript_1.RunScript(target);
    script.addSymbols(symbols);
    if (debugInfo)
        script.setDebugContext((0, debugcontroller_1.buildDebugContext)(debugInfo));
    const symbolFile = str(args, 'symbols');
    if (symbolFile)
        script.addSymbols((0, symbolfile_1.parseSymbolFile)(fs.readFileSync(symbolFile, 'utf8')));
    script.startTracing();
    // `vcd FILE` writes as it goes, so a long recording doesn't sit in memory
    script.openFile = vcdfile_1.openVcdFile;
    // `capture N DIR` / `png FILE`: encode each frame with the same PNG writer as --png
    const { encode } = await Promise.resolve().then(() => __importStar(require('fast-png')));
    script.writeFrame = (file, video) => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, encodePNG(encode, video));
    };
    try {
        script.run(buildScript(args));
    }
    finally {
        script.finish();
    }
    const video = target.getVideo();
    const frameDir = str(args, 'frames-dir');
    const fps = parseInt((_a = str(args, 'fps')) !== null && _a !== void 0 ? _a : '') || target.frameRate;
    (0, cliformat_1.output)({
        success: true,
        command: 'run',
        data: {
            platform: target.id,
            rom: romFile,
            frames: target.frameCount,
            width: (_b = video === null || video === void 0 ? void 0 : video.width) !== null && _b !== void 0 ? _b : null,
            height: (_c = video === null || video === void 0 ? void 0 : video.height) !== null && _c !== void 0 ? _c : null,
            png: str(args, 'png') || null,
            framesDir: frameDir || null,
            fps: frameDir ? fps : null,
            ffmpeg: frameDir
                ? `ffmpeg -framerate ${fps} -i ${frameDir.replace(/[\\/]+$/, '')}/frame_%05d.png -pix_fmt yuv420p out.mp4`
                : null,
        }
    });
    await writeScreenshot(video, str(args, 'png'));
}
/** Encode a frame as a 4-channel PNG (the pixel view is already RGBA bytes). */
function encodePNG(encode, video) {
    return encode({
        width: video.width, height: video.height,
        data: new Uint8Array(video.pixels.buffer, video.pixels.byteOffset, video.width * video.height * 4),
        channels: 4,
    });
}
async function writeScreenshot(video, pngFile) {
    if (!video)
        return;
    const showInTerminal = process.stdout.isTTY;
    if (!pngFile && !showInTerminal)
        return;
    const { encode } = await Promise.resolve().then(() => __importStar(require('fast-png')));
    const png = encodePNG(encode, video);
    if (pngFile)
        fs.writeFileSync(pngFile, png);
    if (showInTerminal) {
        const { displayImageInTerminal } = await Promise.resolve().then(() => __importStar(require('./termimage')));
        displayImageInTerminal(png, video.width, video.height);
    }
}
////////////////////////////////////////////////////////////////////////
// platform detection
function presetsDir() {
    for (const dir of [path.resolve((0, toolroot_1.toolRoot)(), 'presets'), path.resolve(__dirname, '../../presets')]) {
        if (fs.existsSync(dir))
            return dir;
    }
    return null;
}
/** Ranked platform guesses for a source file (and its neighbors) or a directory. */
async function detectPath(input) {
    const { detectProject, headersFromPresets } = await Promise.resolve().then(() => __importStar(require('../common/detect')));
    const { PLATFORM_PARAMS } = await Promise.resolve().then(() => __importStar(require('../worker/platforms')));
    const isDir = fs.statSync(input).isDirectory();
    const dir = isDir ? input : path.dirname(input);
    let files = fs.readdirSync(dir).filter((f) => !f.endsWith('~') && fs.statSync(path.join(dir, f)).isFile());
    // for a file, only it and the files that could be its libraries or build files
    if (!isDir) {
        const main = path.basename(input);
        files = [main, ...files.filter((f) => f !== main && (/\.(h|inc|i|cfg|mk)$/i.test(f) || /^(makefile|readme(\.md)?)$/i.test(f)))];
    }
    const listing = {};
    const presets = presetsDir();
    const platforms = Object.keys(PLATFORM_PARAMS).filter((p) => p.indexOf('.') < 0);
    if (presets) {
        for (const p of fs.readdirSync(presets)) {
            if (platforms.includes(p))
                listing[p] = fs.readdirSync(path.join(presets, p));
        }
    }
    const read = (f) => {
        const full = path.join(dir, f);
        if ((0, util_1.isProbablyBinary)(f))
            return null;
        try {
            return fs.readFileSync(full, 'utf8');
        }
        catch (e) {
            return null;
        }
    };
    return detectProject({ files, read, platforms, headers: headersFromPresets(listing), dirName: path.basename(path.resolve(dir)) });
}
/** The platform for a source file given without --platform, or fail with the candidates. */
async function inferPlatform(command, input) {
    const { isClearWinner } = await Promise.resolve().then(() => __importStar(require('../common/detect')));
    const found = await detectPath(input);
    if (!isClearWinner(found)) {
        const list = found.slice(0, 5).map((d) => `${d.platform} (${d.score})`).join(', ');
        (0, cliformat_1.fail)(command, `Cannot tell the platform of ${input}${list ? '; candidates: ' + list : ''}. Pass --platform.`);
    }
    const ev = found[0].evidence[0];
    (0, cliformat_1.note)(`platform ${found[0].platform}: ${ev.file}${ev.line ? ':' + ev.line : ''} ${ev.reason}`);
    return found[0].platform;
}
/**
 * Resolve a directory to its main source file and platform with detect.
 * Fails when no platform is clear or no main file stands out.
 */
async function resolveDirectory(command, input, platformArg) {
    var _a;
    const { isClearWinner } = await Promise.resolve().then(() => __importStar(require('../common/detect')));
    const detections = await detectPath(input);
    const d = (platformArg && detections.find((x) => x.platform === platformArg)) || detections[0];
    if (!d) {
        const list = detections.slice(0, 5).map((x) => `${x.platform} (${x.score})`).join(', ');
        (0, cliformat_1.fail)(command, `Cannot tell the platform of ${input}${list ? '; candidates: ' + list : ''}. Pass --platform.`);
    }
    if (!platformArg && !isClearWinner(detections)) {
        const list = detections.slice(0, 5).map((x) => `${x.platform} (${x.score})`).join(', ');
        (0, cliformat_1.fail)(command, `Cannot tell the platform of ${input}${list ? '; candidates: ' + list : ''}. Pass --platform.`);
    }
    if (!d.mainFile) {
        const n = ((_a = d.mainCandidates) === null || _a === void 0 ? void 0 : _a.length) || 0;
        const hint = n > 1 ? ` (${n} programs: ${d.mainCandidates.slice(0, 5).join(', ')}${n > 5 ? ', ...' : ''})` : '';
        (0, cliformat_1.fail)(command, `No main file detected in ${input}${hint}. Pass a source file.`);
    }
    const source = findProjectFile(input, d.mainFile);
    if (!source)
        (0, cliformat_1.fail)(command, `Main file '${d.mainFile}' not found under ${input}.`);
    (0, cliformat_1.note)(`detected ${d.platform}: ${source}`);
    return { source, platform: d.platform };
}
/**
 * Locate a detection's main file under `root`. A README link names the file
 * relative to its own subfolder (the githubURL path), so it may live in a
 * subdirectory rather than at the top level.
 */
function findProjectFile(root, rel) {
    const direct = path.join(root, rel);
    if (fs.existsSync(direct))
        return direct;
    const suffix = path.sep + rel.split('/').join(path.sep);
    const base = path.basename(rel);
    let byBase;
    const stack = [root];
    while (stack.length) {
        const dir = stack.pop();
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules')
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory())
                stack.push(full);
            else if (entry.name === base) {
                if (full.endsWith(suffix))
                    return full;
                byBase = byBase || full;
            }
        }
    }
    return byBase;
}
async function doDetect(positional) {
    const input = positional[0] || '.';
    if (!fs.existsSync(input))
        (0, cliformat_1.fail)('detect', `No such file or directory: ${input}`);
    const { isClearWinner } = await Promise.resolve().then(() => __importStar(require('../common/detect')));
    const detections = await detectPath(input);
    (0, cliformat_1.output)({ success: true, command: 'detect', data: { input, clear: isClearWinner(detections), detections: detections.slice(0, 8) } });
}
////////////////////////////////////////////////////////////////////////
// determinism
/**
 * Serve the Debug Adapter Protocol on stdin/stdout. A launch request names
 * the program (and platform); flags given here (--tool, --bios, --define)
 * apply to every launch.
 */
async function doDap(args) {
    (0, cliformat_1.setServerMode)();
    const { EmuDebugSession } = await Promise.resolve().then(() => __importStar(require('./dapsession')));
    const { LocalDebugBackend } = await Promise.resolve().then(() => __importStar(require('./daplocal')));
    const backend = new LocalDebugBackend(async (launch) => {
        const launchArgs = Object.assign({}, args);
        if (launch.platform)
            launchArgs['platform'] = launch.platform;
        const prog = await openProgram('dap', launchArgs, launch.program || launch.mainFile);
        return { target: prog.target, debugInfo: prog.debugInfo, root: path.dirname(path.resolve(prog.source)) };
    });
    new EmuDebugSession(backend).start(process.stdin, process.stdout);
    await new Promise(resolve => process.stdin.on('end', resolve));
    process.exit(0);
}
/** Record a run with random key input, replay it, and check every frame matches. */
async function doVerifyReplay(args, positional) {
    var _a, _b, _c;
    const input = positional[0];
    const platformId = str(args, 'platform') || (input ? detect_1.ROM_PLATFORMS[path.extname(input).toLowerCase()] : null);
    if (!platformId)
        (0, cliformat_1.fail)('verify-replay', 'Required: verify-replay --platform <id> [rom]');
    const target = await openTarget(args, platformId);
    if (input) {
        if (!fs.existsSync(input))
            (0, cliformat_1.fail)('verify-replay', `No such file: ${input}`);
        await target.loadROM(new Uint8Array(fs.readFileSync(input)), path.basename(input));
    }
    if (!target.history)
        (0, cliformat_1.fail)('verify-replay', `'${platformId}' cannot save and restore state`);
    const frames = parseInt((_a = str(args, 'frames')) !== null && _a !== void 0 ? _a : '') || 60;
    const seed = parseInt((_b = str(args, 'seed')) !== null && _b !== void 0 ? _b : '') || 12345;
    const keys = ((_c = str(args, 'input')) !== null && _c !== void 0 ? _c : 'keys') !== 'none';
    const r = (0, verifyreplay_1.verifyReplay)(target, { frames, keys, seed });
    const ok = r.diverged.length === 0;
    if (!ok)
        (0, cliformat_1.note)(`first divergence at frame ${r.diverged[0]} of ${frames}`);
    (0, cliformat_1.output)({
        success: ok,
        command: 'verify-replay',
        error: ok ? undefined : `replay diverged at frame ${r.diverged[0]}`,
        data: {
            platform: platformId,
            rom: input !== null && input !== void 0 ? input : null,
            frames,
            input: r.input === 'keys' && r.controlStates < 2 ? 'keys (no effect)' : r.input,
            controlStates: r.controlStates,
            keyEvents: r.keyEvents,
            seed: r.input === 'keys' ? seed : null,
            granularity: r.granularity,
            deterministic: ok,
            firstDivergentFrame: ok ? null : r.diverged[0],
            divergentFrames: r.diverged,
            recordedTo: r.recordedTo,
        }
    });
}
////////////////////////////////////////////////////////////////////////
// listings & help
async function doList(command) {
    const { initialize, listPlatforms, listTools, PLATFORM_PARAMS } = await Promise.resolve().then(() => __importStar(require('./testlib')));
    await initialize();
    if (command === 'list-tools') {
        // an install made from packs leaves some toolchains out (see assetpacks.ts)
        const tools = listTools().filter((t) => { var _a; return (0, toolroot_1.toolchainProvidesTool)(t, (_a = toolmeta_1.TOOL_META[t]) === null || _a === void 0 ? void 0 : _a.wasmModule); });
        (0, cliformat_1.output)({ success: true, command, data: { tools } });
        return;
    }
    const platforms = {};
    for (const p of listPlatforms().filter(toolroot_1.toolchainSupportsPlatform))
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
                'build': 'compile a source file or folder to a ROM',
                'run': 'run a ROM -- or a source file or folder, built first',
                'detect': 'guess the platform and main file of a source file or directory',
                'dap': 'serve the Debug Adapter Protocol on stdin/stdout, for editors',
                'verify-replay': 'record a run with random key input, replay it, and check every frame matches',
                'list-platforms': 'platforms available to --platform',
                'list-tools': 'compilers and assemblers available to --tool',
            },
            options: {
                'build options': {
                    '-p, --platform <id>': 'target platform (default: detected from the source or folder)',
                    '-t, --tool <tool>': 'compiler/assembler (default: from file extension)',
                    '-o, --output <file>': 'write the ROM here',
                    '--check': 'compile without writing anything',
                    '--symbols': 'dump the symbol table and segments',
                    '--save': 'save all intermediate build files to a temp dir',
                    '--no-warnings': 'don\'t print compiler warnings',
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
                    '--frames-dir <dir>': 'write each frame as DIR/frame_NNNNN.png, for ffmpeg',
                    '--fps <n>': 'frame rate for --frames-dir (default: the platform\'s)',
                    '--symbols <file>': 'load a .lbl/.sym file for symbolic addresses',
                    '--bios <file>': 'load a BIOS image',
                    '--vector-size <px>': 'long side of a vector platform\'s screen (default 512)',
                    '--info': 'dump debug info and disassembly when done',
                    '--no-warnings': 'don\'t print compiler warnings',
                    '--memdump <a,b>': 'hexdump a hex address range',
                },
                'verify-replay options': {
                    '-p, --platform <id>': 'platform emulator',
                    '-f, --frames <n>': 'frames to record (default 60)',
                    '--input <keys|none>': 'press random keys while recording (default keys)',
                    '--seed <n>': 'seed for the random keys',
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
        // dap answers over its protocol, not with a result
        if ((0, cliformat_1.hasOutput)() || command === 'dap')
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
            case 'detect':
                await doDetect(positional);
                break;
            case 'verify-replay':
                await doVerifyReplay(args, positional);
                break;
            case 'dap':
                await doDap(args);
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
// Exit once the result is out: emulator libraries (Javatari's on-screen
// messages) leave timers behind that would keep node running for seconds.
main().then(() => {
    process.stdout.write('', () => process.stderr.write('', () => process.exit()));
});
//# sourceMappingURL=8bws.js.map