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
const path = __importStar(require("path"));
const testlib_1 = require("./testlib");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const util_1 = require("../common/util");
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
function output(result) {
    if (jsonMode) {
        console.log(JSON.stringify(result, null, 2));
    }
    else {
        outputPretty(result);
    }
}
function outputPretty(result) {
    // Status badge
    if (result.success) {
        process.stderr.write(`${c.bgGreen}${c.bold}${c.white} OK ${c.reset} `);
    }
    else {
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
function formatData(command, data) {
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
function formatHelp(data) {
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
function formatCompile(data) {
    if (data.errors) {
        for (var err of data.errors) {
            var loc = '';
            if (err.path)
                loc += `${c.cyan}${err.path}${c.reset}`;
            if (err.line)
                loc += `${c.dim}:${c.reset}${c.yellow}${err.line}${c.reset}`;
            if (loc)
                loc += ` ${c.dim}-${c.reset} `;
            console.log(`  ${c.red}●${c.reset} ${loc}${err.msg || err.message || JSON.stringify(err)}`);
        }
        return;
    }
    if (data.tool)
        console.log(`  ${c.dim}Tool:${c.reset}     ${c.green}${data.tool}${c.reset}`);
    if (data.platform)
        console.log(`  ${c.dim}Platform:${c.reset} ${c.green}${data.platform}${c.reset}`);
    if (data.source)
        console.log(`  ${c.dim}Source:${c.reset}   ${c.cyan}${data.source}${c.reset}`);
    if (data.outputSize != null)
        console.log(`  ${c.dim}Size:${c.reset}     ${c.yellow}${data.outputSize}${c.reset} bytes`);
    if (data.outputFile)
        console.log(`  ${c.dim}Output:${c.reset}   ${c.cyan}${data.outputFile}${c.reset}`);
    if (data.hasListings)
        console.log(`  ${c.dim}Listings:${c.reset} ${c.green}yes${c.reset}`);
    if (data.hasSymbolmap)
        console.log(`  ${c.dim}Symbols:${c.reset}  ${c.green}yes${c.reset}`);
    // --symbols: dump symbol map
    if (data.symbolmap) {
        console.log(`\n${c.bold}Symbols${c.reset} ${c.dim}(${Object.keys(data.symbolmap).length})${c.reset}`);
        var sorted = Object.entries(data.symbolmap).sort((a, b) => a[1] - b[1]);
        for (var [name, addr] of sorted) {
            console.log(`  ${c.cyan}$${(0, util_1.hex)(addr, 4)}${c.reset}  ${name}`);
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
            console.log(`  ${c.green}${seg.name.padEnd(16)}${c.reset} ${c.cyan}$${(0, util_1.hex)(seg.start, 4)}${c.reset}  ${c.dim}size${c.reset} ${c.yellow}${seg.size}${c.reset}`);
        }
    }
}
function formatListTools(data) {
    console.log(`\n${c.bold}Available tools${c.reset} ${c.dim}(${data.count})${c.reset}\n`);
    for (var tool of data.tools) {
        console.log(`  ${c.green}●${c.reset} ${tool}`);
    }
    console.log();
}
function formatListPlatforms(data) {
    console.log(`\n${c.bold}Available platforms${c.reset} ${c.dim}(${data.count})${c.reset}\n`);
    // Group by arch
    let byArch = {};
    for (let [name, info] of Object.entries(data.platforms)) {
        let arch = info.arch || 'unknown';
        if (!byArch[arch])
            byArch[arch] = [];
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
function formatGeneric(data) {
    for (var [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && value !== null) {
            console.log(`  ${c.dim}${key}:${c.reset} ${JSON.stringify(value)}`);
        }
        else {
            console.log(`  ${c.dim}${key}:${c.reset} ${value}`);
        }
    }
}
var BOOLEAN_FLAGS = new Set(['json', 'info', 'symbols', 'save']);
function parseArgs(argv) {
    var command = argv[2];
    var args = {};
    var positional = [];
    for (var i = 3; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            var key = argv[i].substring(2);
            if (BOOLEAN_FLAGS.has(key)) {
                args[key] = 'true';
            }
            else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
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
function usage() {
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
async function doCompile(args, positional, checkOnly) {
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
        tool = (0, testlib_1.getToolForFilename)(sourceFile, platform);
    }
    if (!testlib_1.TOOLS[tool]) {
        output({
            success: false,
            command: checkOnly ? 'check' : 'compile',
            error: `Unknown tool: ${tool}. Use list-tools to see available tools.`
        });
        process.exit(1);
    }
    // Preload the tool's filesystem if needed
    await (0, testlib_1.preload)(tool, platform);
    var result = await (0, testlib_1.compileSourceFile)(tool, platform, sourceFile);
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
    var compileData = {
        tool: tool,
        platform: platform,
        source: sourceFile,
        outputSize: outputSize,
        outputFile: outputFile || null,
        hasListings: result.listings ? Object.keys(result.listings).length > 0 : false,
        hasSymbolmap: !!result.symbolmap,
    };
    if (args['symbols'] === 'true') {
        if (result.symbolmap)
            compileData.symbolmap = result.symbolmap;
        if (result.segments)
            compileData.segments = result.segments;
    }
    // --save: write all intermediate build files to /tmp/<dirname>
    if (args['save'] === 'true') {
        var baseName = path.basename(sourceFile, path.extname(sourceFile));
        var saveDir = path.join('/tmp', `8bws-${baseName}`);
        fs.mkdirSync(saveDir, { recursive: true });
        var savedFiles = [];
        for (var [filePath, entry] of Object.entries(testlib_1.store.workfs)) {
            var outPath = path.join(saveDir, filePath);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            if (entry.data instanceof Uint8Array) {
                fs.writeFileSync(outPath, entry.data);
            }
            else {
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
const KEY_NAMES = {
    'ENTER': 13, 'RETURN': 13, 'CR': 13,
    'SPACE': 32, 'ESC': 27, 'TAB': 9, 'BACKSPACE': 8, 'BS': 8,
    'DELETE': 46, 'DEL': 46, 'INSERT': 45,
    'LEFT': 37, 'UP': 38, 'RIGHT': 39, 'DOWN': 40,
    'HOME': 36, 'END': 35, 'PAGEUP': 33, 'PAGEDOWN': 34,
    'F1': 112, 'F2': 113, 'F3': 114, 'F4': 115, 'F5': 116, 'F6': 117,
    'F7': 118, 'F8': 119, 'F9': 120, 'F10': 121, 'F11': 122, 'F12': 123,
};
function parseNum(s) {
    s = s.trim();
    if (s.startsWith('$'))
        return parseInt(s.substring(1), 16);
    if (/^0x[0-9a-f]+$/i.test(s))
        return parseInt(s, 16);
    if (/^\d+$/.test(s))
        return parseInt(s, 10);
    throw new Error(`bad number '${s}'`);
}
function parseKeyValue(tok) {
    var flags = 0;
    var t = tok.toUpperCase();
    for (;;) {
        if (t.startsWith('SHIFT+')) {
            flags |= emu_1.KeyFlags.Shift;
            t = t.substring(6);
        }
        else if (t.startsWith('CTRL+')) {
            flags |= emu_1.KeyFlags.Ctrl;
            t = t.substring(5);
        }
        else
            break;
    }
    if (KEY_NAMES[t] != null)
        return { key: KEY_NAMES[t], flags };
    if (t.length == 1)
        return { key: t.charCodeAt(0), flags };
    if (/^0X[0-9A-F]+$/.test(t))
        return { key: parseInt(t, 16), flags };
    if (/^\d+$/.test(t))
        return { key: parseInt(t, 10), flags };
    throw new Error(`unknown key '${tok}'`);
}
// C64-style screen code -> ASCII (also close enough for VIC-20 et al)
function screenCodeToChar(code) {
    code &= 0xff;
    if (code >= 0x40)
        code &= 0x3f; // reverse-video / graphics variants
    if (code < 0x20) {
        const special = '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[£]^_';
        return special[code];
    }
    return String.fromCharCode(code); // $20-$3F identical to ASCII
}
function hexdumpMem(readFn, start, end) {
    var len = end - start + 1;
    for (var ofs = 0; ofs < len; ofs += 16) {
        var line = `${(0, util_1.hex)(start + ofs, 4)}:`;
        var ascii = '';
        for (var i = 0; i < 16 && ofs + i < len; i++) {
            if (i === 8)
                line += ' ';
            var byte = readFn(start + ofs + i);
            line += ` ${(0, util_1.hex)(byte)}`;
            ascii += (byte >= 0x20 && byte < 0x7f) ? String.fromCharCode(byte) : '.';
        }
        process.stdout.write(`${line}  ${ascii}\n`);
    }
}
function executeRunScript(script, ctx) {
    var lines = script.split(/\r?\n|;/);
    for (var ln of lines) {
        ln = ln.trim();
        if (!ln || ln.startsWith('#') || ln.startsWith('//'))
            continue;
        var tokens = ln.split(/\s+/);
        var cmd = tokens[0].toLowerCase();
        try {
            switch (cmd) {
                case 'run':
                case 'wait':
                case 'frames': {
                    var n = tokens[1] ? parseNum(tokens[1]) : 1;
                    for (var i = 0; i < n; i++)
                        ctx.advance();
                    process.stdout.write(`[frame ${ctx.frameno()}] ran ${n} frame${n == 1 ? '' : 's'}\n`);
                    break;
                }
                case 'runto': {
                    if (!tokens[1])
                        throw new Error('runto requires an address');
                    var addr = parseNum(tokens[1]);
                    var maxf = tokens[2] ? parseNum(tokens[2]) : 1000;
                    var startFrame = ctx.frameno();
                    while (ctx.frameno() - startFrame < maxf) {
                        ctx.advance();
                        var pc = ctx.getPC();
                        if (pc == null || pc === addr)
                            break;
                    }
                    var pc = ctx.getPC();
                    var hit = pc != null && pc === addr;
                    process.stdout.write(`[frame ${ctx.frameno()}] runto $${(0, util_1.hex)(addr, 4)}: ${hit ? 'HIT' : 'MISSED'} (pc=${pc != null ? '$' + (0, util_1.hex)(pc, 4) : '?'} after ${ctx.frameno() - startFrame} frames)\n`);
                    break;
                }
                case 'key':
                case 'press': {
                    if (!tokens[1])
                        throw new Error('key requires a key name');
                    var { key, flags } = parseKeyValue(tokens[1]);
                    ctx.sendKey(key, flags | emu_1.KeyFlags.KeyDown);
                    for (var i = 0; i < 3; i++)
                        ctx.advance();
                    ctx.sendKey(key, flags | emu_1.KeyFlags.KeyUp);
                    ctx.advance();
                    process.stdout.write(`[frame ${ctx.frameno()}] pressed ${tokens[1]} ($${(0, util_1.hex)(key, 2)})\n`);
                    break;
                }
                case 'keydown': {
                    if (!tokens[1])
                        throw new Error('keydown requires a key name');
                    var { key, flags } = parseKeyValue(tokens[1]);
                    ctx.sendKey(key, flags | emu_1.KeyFlags.KeyDown);
                    process.stdout.write(`[frame ${ctx.frameno()}] keydown ${tokens[1]} ($${(0, util_1.hex)(key, 2)})\n`);
                    break;
                }
                case 'keyup': {
                    if (!tokens[1])
                        throw new Error('keyup requires a key name');
                    var { key, flags } = parseKeyValue(tokens[1]);
                    ctx.sendKey(key, flags | emu_1.KeyFlags.KeyUp);
                    process.stdout.write(`[frame ${ctx.frameno()}] keyup ${tokens[1]} ($${(0, util_1.hex)(key, 2)})\n`);
                    break;
                }
                case 'mem': {
                    if (!tokens[1])
                        throw new Error('mem requires START [LEN]');
                    var start = parseNum(tokens[1]);
                    var len = tokens[2] ? parseNum(tokens[2]) : 16;
                    process.stdout.write(`[frame ${ctx.frameno()}] mem $${(0, util_1.hex)(start, 4)}+$${(0, util_1.hex)(len, 4)}:\n`);
                    hexdumpMem(ctx.readMem, start, start + len - 1);
                    break;
                }
                case 'screen': {
                    var start = tokens[1] ? parseNum(tokens[1]) : 0x400;
                    var cols = tokens[2] ? parseNum(tokens[2]) : 40;
                    var rows = tokens[3] ? parseNum(tokens[3]) : 25;
                    process.stdout.write(`[frame ${ctx.frameno()}] screen at $${(0, util_1.hex)(start, 4)} (${cols}x${rows}):\n`);
                    for (var y = 0; y < rows; y++) {
                        var line = '';
                        for (var x = 0; x < cols; x++)
                            line += screenCodeToChar(ctx.readMem(start + y * cols + x));
                        process.stdout.write(`|${line.replace(/\s+$/, '')}|\n`);
                    }
                    break;
                }
                case 'pc': {
                    var pc = ctx.getPC();
                    if (pc == null)
                        throw new Error('no PC available');
                    process.stdout.write(`[frame ${ctx.frameno()}] PC=$${(0, util_1.hex)(pc, 4)}\n`);
                    var addr = pc;
                    for (var i = 0; i < 8; i++) {
                        var d = ctx.disassemble(addr);
                        if (!d)
                            break;
                        var bytesStr = '';
                        for (var b = 0; b < d.nbytes; b++)
                            bytesStr += (0, util_1.hex)(ctx.readMem(addr + b)) + ' ';
                        process.stdout.write(`  $${(0, util_1.hex)(addr, 4)}  ${bytesStr.padEnd(12)} ${d.line}\n`);
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
        }
        catch (e) {
            throw new Error(`script error on '${ln}': ${e.message}\nCommands:\n${RUN_SCRIPT_HELP}`);
        }
    }
}
async function doRun(args, positional) {
    var _a, _b, _c;
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
    var pixels = null;
    var vid = null;
    var platformRunner = null;
    var machineInstance = null;
    var runner = null;
    if (platformId) {
        // Platform mode: load platform module, mock video, run via Platform API
        var { PlatformRunner, loadPlatform } = await Promise.resolve().then(() => __importStar(require('./runmachine')));
        platformRunner = new PlatformRunner(await loadPlatform(platformId));
        await platformRunner.start();
        platformRunner.loadROM("ROM", romData);
    }
    else {
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
        var { MachineRunner, loadMachine } = await Promise.resolve().then(() => __importStar(require('./runmachine')));
        machineInstance = await loadMachine(modname, clsname);
        runner = new MachineRunner(machineInstance);
        runner.setup();
        machineInstance.loadROM(romData);
    }
    // Build the execution context for frame loop / run-script
    var frameno = 0;
    var advance = () => {
        if (platformRunner)
            platformRunner.run();
        else
            runner.run();
        frameno++;
    };
    var debugTarget = platformRunner ? platformRunner.platform : machineInstance;
    var keyTarget = platformRunner ? platformRunner.platform.machine : machineInstance;
    var readMem = (addr) => {
        if (platformRunner)
            return platformRunner.platform.readAddress(addr);
        var m = machineInstance;
        return typeof m.readAddress === 'function' ? m.readAddress(addr) : m.readConst(addr);
    };
    var getPC = () => {
        try {
            return typeof debugTarget.getPC === 'function' ? debugTarget.getPC() : null;
        }
        catch (e) {
            return null;
        }
    };
    var sendKey = (key, flags) => {
        if (keyTarget && typeof keyTarget.setKeyInput === 'function')
            keyTarget.setKeyInput(key, key, flags);
        else if (typeof debugTarget.setKeyInput === 'function')
            debugTarget.setKeyInput(key, key, flags);
        else
            throw new Error('platform/machine does not support setKeyInput');
    };
    var disassemble = (addr) => {
        try {
            return typeof debugTarget.disassemble === 'function' ? debugTarget.disassemble(addr, readMem) : null;
        }
        catch (e) {
            return null;
        }
    };
    if (args['script']) {
        // --script: inline commands or a path to a script file
        var scriptText = args['script'];
        if (fs.existsSync(scriptText))
            scriptText = fs.readFileSync(scriptText, 'utf8');
        executeRunScript(scriptText, {
            advance,
            frameno: () => frameno,
            readMem,
            getPC,
            sendKey,
            reset: () => debugTarget.reset(),
            disassemble,
        });
    }
    else {
        for (var i = 0; i < frames; i++)
            advance();
    }
    pixels = platformRunner ? platformRunner.pixels : runner.pixels;
    vid = pixels ? (platformRunner ? platformRunner.videoParams : machineInstance.getVideoParams()) : null;
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
        var debugTarget = plat || mach;
        if (debugTarget && (0, baseplatform_1.isDebuggable)(debugTarget)) {
            var state = (_b = (_a = plat === null || plat === void 0 ? void 0 : plat.saveState) === null || _a === void 0 ? void 0 : _a.call(plat)) !== null && _b !== void 0 ? _b : (_c = mach === null || mach === void 0 ? void 0 : mach.saveState) === null || _c === void 0 ? void 0 : _c.call(mach);
            if (state) {
                var categories = debugTarget.getDebugCategories();
                for (var cat of categories) {
                    var info = debugTarget.getDebugInfo(cat, state);
                    if (info) {
                        process.stderr.write(`${c.bold}${c.magenta}[${cat}]${c.reset}\n`);
                        process.stderr.write(info);
                        if (!info.endsWith('\n'))
                            process.stderr.write('\n');
                    }
                }
            }
        }
        // Disassembly around current PC
        if ((debugTarget === null || debugTarget === void 0 ? void 0 : debugTarget.getPC) && (debugTarget === null || debugTarget === void 0 ? void 0 : debugTarget.disassemble) && (debugTarget === null || debugTarget === void 0 ? void 0 : debugTarget.readAddress)) {
            var pc = debugTarget.getPC();
            var readFn = (addr) => debugTarget.readAddress(addr);
            process.stderr.write(`${c.bold}${c.magenta}[Disassembly]${c.reset}\n`);
            var addr = pc;
            for (var i = 0; i < 16; i++) {
                var disasm = debugTarget.disassemble(addr, readFn);
                var prefix = (addr === pc) ? `${c.green}>${c.reset}` : ' ';
                // show hex bytes
                var bytesStr = '';
                for (var b = 0; b < disasm.nbytes; b++) {
                    bytesStr += (0, util_1.hex)(readFn(addr + b)) + ' ';
                }
                process.stderr.write(`${prefix}${c.cyan}$${(0, util_1.hex)(addr, 4)}${c.reset}  ${c.dim}${bytesStr.padEnd(12)}${c.reset} ${disasm.line}\n`);
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
        var readFn2 = null;
        if (plat2 === null || plat2 === void 0 ? void 0 : plat2.readAddress)
            readFn2 = (addr) => plat2.readAddress(addr);
        else if (mach2 && typeof mach2.read === 'function')
            readFn2 = (addr) => mach2.read(addr);
        if (!readFn2) {
            output({ success: false, command: 'run', error: 'Platform/machine does not support readAddress' });
            process.exit(1);
        }
        process.stdout.write(`memdump $${(0, util_1.hex)(start, 4)}-$${(0, util_1.hex)(end, 4)}:\n`);
        hexdumpMem(readFn2, start, end);
    }
    // Encode framebuffer as PNG if video is available
    var pngData = null;
    if (pixels && vid) {
        var { encode } = await Promise.resolve().then(() => __importStar(require('fast-png')));
        var rgba = new Uint8Array(pixels.buffer);
        pngData = encode({ width: vid.width, height: vid.height, data: rgba, channels: 4 });
    }
    // Write PNG to file if requested
    if (outputFile && pngData) {
        fs.writeFileSync(outputFile, pngData);
    }
    // Display image in terminal if connected to a TTY
    if (pngData && process.stdout.isTTY) {
        var { displayImageInTerminal } = await Promise.resolve().then(() => __importStar(require('./termimage')));
        displayImageInTerminal(pngData, vid.width, vid.height);
    }
}
function doListTools() {
    var tools = (0, testlib_1.listTools)();
    output({
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
                output({
                    success: false,
                    command: command,
                    error: `Unknown command: ${command}`
                });
                process.exit(1);
        }
    }
    catch (e) {
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
//# sourceMappingURL=8bws.js.map