"use strict";
// Terminal output helpers for the 8bws CLI.
//
// Every command returns a CLIResult; output() renders it either as JSON
// (--json) or as colorized text. Keeping this out of 8bws.ts leaves the
// command implementations free of ANSI noise.
Object.defineProperty(exports, "__esModule", { value: true });
exports.c = void 0;
exports.setJsonMode = setJsonMode;
exports.isJsonMode = isJsonMode;
exports.write = write;
exports.note = note;
exports.hasOutput = hasOutput;
exports.output = output;
exports.fail = fail;
exports.hexdump = hexdump;
const util_1 = require("../common/util");
exports.c = {
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
let jsonMode = false;
let emit = console.log;
/**
 * In --json mode stdout carries the CLIResult and nothing else, so the
 * compiler's chatter (plain console.log from the worker) is pushed to stderr.
 */
function setJsonMode(on) {
    jsonMode = on;
    if (!on)
        return;
    emit = console.log.bind(console);
    console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
}
function isJsonMode() { return jsonMode; }
/** Human-facing output: stdout normally, stderr in --json mode. */
function write(s) {
    (jsonMode ? process.stderr : process.stdout).write(s);
}
// progress/status chatter -- suppressed in --json mode so stdout stays parseable
function note(msg) {
    if (!jsonMode)
        process.stderr.write(`${exports.c.dim}${msg}${exports.c.reset}\n`);
}
let emitted = false;
/** True once a CLIResult has been printed -- lets main() detect a silent exit. */
function hasOutput() { return emitted; }
function output(result) {
    emitted = true;
    if (jsonMode) {
        emit(JSON.stringify(result, null, 2));
        return;
    }
    process.stderr.write(result.success
        ? `${exports.c.bgGreen}${exports.c.bold}${exports.c.white} OK ${exports.c.reset} `
        : `${exports.c.bgRed}${exports.c.bold}${exports.c.white} FAIL ${exports.c.reset} `);
    process.stderr.write(`${exports.c.bold}${exports.c.cyan}${result.command}${exports.c.reset}\n`);
    if (result.error) {
        process.stderr.write(`${exports.c.red}Error: ${result.error}${exports.c.reset}\n`);
    }
    if (result.data) {
        (FORMATTERS[result.command] || formatGeneric)(result.data);
    }
}
// exit with a formatted error message
function fail(command, error, data) {
    output({ success: false, command, error, data });
    process.exit(1);
}
const FORMATTERS = {
    help: formatHelp,
    build: formatBuild,
    run: formatRun,
    'list-tools': formatList('tools', 'Available tools'),
    'list-platforms': formatPlatforms,
};
function formatHelp(data) {
    console.log(`\n${exports.c.bold}Usage:${exports.c.reset} 8bws <command> [options] <file>\n`);
    console.log(`${exports.c.bold}Commands:${exports.c.reset}`);
    for (const [cmd, usage] of Object.entries(data.commands || {})) {
        console.log(`  ${exports.c.green}${cmd.padEnd(14)}${exports.c.reset}${exports.c.dim}${usage}${exports.c.reset}`);
    }
    if (data.options) {
        for (const [section, opts] of Object.entries(data.options)) {
            console.log(`\n${exports.c.bold}${section}:${exports.c.reset}`);
            for (const [flag, desc] of Object.entries(opts)) {
                console.log(`  ${exports.c.yellow}${flag.padEnd(22)}${exports.c.reset}${exports.c.dim}${desc}${exports.c.reset}`);
            }
        }
    }
    if (data.script) {
        console.log(`\n${exports.c.bold}Script commands${exports.c.reset} ${exports.c.dim}(-e / --script)${exports.c.reset}\n${data.script}`);
    }
    console.log();
}
function formatBuild(data) {
    if (data.errors) {
        for (const err of data.errors) {
            let loc = '';
            if (err.path)
                loc += `${exports.c.cyan}${err.path}${exports.c.reset}`;
            if (err.line)
                loc += `${exports.c.dim}:${exports.c.reset}${exports.c.yellow}${err.line}${exports.c.reset}`;
            if (loc)
                loc += ` ${exports.c.dim}-${exports.c.reset} `;
            console.log(`  ${exports.c.red}●${exports.c.reset} ${loc}${err.msg || err.message || JSON.stringify(err)}`);
        }
        return;
    }
    field('Tool', data.tool, exports.c.green);
    field('Platform', data.platform, exports.c.green);
    field('Source', data.source, exports.c.cyan);
    if (data.outputSize != null)
        field('Size', `${data.outputSize} bytes`, exports.c.yellow);
    field('Output', data.outputFile, exports.c.cyan);
    if (data.symbolmap) {
        console.log(`\n${exports.c.bold}Symbols${exports.c.reset} ${exports.c.dim}(${Object.keys(data.symbolmap).length})${exports.c.reset}`);
        for (const [name, addr] of Object.entries(data.symbolmap).sort((a, b) => a[1] - b[1])) {
            console.log(`  ${exports.c.cyan}$${(0, util_1.hex)(addr, 4)}${exports.c.reset}  ${name}`);
        }
    }
    if (data.segments) {
        console.log(`\n${exports.c.bold}Segments${exports.c.reset} ${exports.c.dim}(${data.segments.length})${exports.c.reset}`);
        for (const seg of data.segments) {
            console.log(`  ${exports.c.green}${seg.name.padEnd(16)}${exports.c.reset} ${exports.c.cyan}$${(0, util_1.hex)(seg.start, 4)}${exports.c.reset}  ${exports.c.dim}size${exports.c.reset} ${exports.c.yellow}${seg.size}${exports.c.reset}`);
        }
    }
    if (data.saveDir) {
        console.log(`\n${exports.c.bold}Saved to${exports.c.reset} ${exports.c.cyan}${data.saveDir}${exports.c.reset} ${exports.c.dim}(${data.savedFiles.length} files)${exports.c.reset}`);
        for (const f of data.savedFiles)
            console.log(`  ${exports.c.dim}●${exports.c.reset} ${f}`);
    }
}
function formatRun(data) {
    field('Platform', data.platform, exports.c.green);
    field('ROM', data.rom, exports.c.cyan);
    if (data.frames != null)
        field('Frames', data.frames, exports.c.yellow);
    if (data.width)
        field('Video', `${data.width}x${data.height}`, exports.c.yellow);
    field('Screenshot', data.png, exports.c.cyan);
}
function formatList(key, title) {
    return (data) => {
        console.log(`\n${exports.c.bold}${title}${exports.c.reset} ${exports.c.dim}(${data[key].length})${exports.c.reset}\n`);
        for (const item of data[key])
            console.log(`  ${exports.c.green}●${exports.c.reset} ${item}`);
        console.log();
    };
}
function formatPlatforms(data) {
    var _a;
    console.log(`\n${exports.c.bold}Available platforms${exports.c.reset} ${exports.c.dim}(${data.count})${exports.c.reset}\n`);
    const byArch = {};
    for (const [name, info] of Object.entries(data.platforms)) {
        (byArch[_a = info.arch || 'unknown'] || (byArch[_a] = [])).push(name);
    }
    for (const [arch, platforms] of Object.entries(byArch).sort()) {
        console.log(`  ${exports.c.bold}${exports.c.magenta}${arch}${exports.c.reset}`);
        for (const p of platforms.sort())
            console.log(`    ${exports.c.green}●${exports.c.reset} ${p}`);
    }
    console.log();
}
function formatGeneric(data) {
    for (const [key, value] of Object.entries(data)) {
        const v = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : value;
        console.log(`  ${exports.c.dim}${key}:${exports.c.reset} ${v}`);
    }
}
function field(label, value, color) {
    if (value == null || value === false)
        return;
    console.log(`  ${exports.c.dim}${(label + ':').padEnd(11)}${exports.c.reset}${color}${value}${exports.c.reset}`);
}
// shared hexdump used by 'mem' and --memdump
function hexdump(read, start, end, out = write) {
    for (let ofs = 0; start + ofs <= end; ofs += 16) {
        let line = `${(0, util_1.hex)(start + ofs, 4)}:`;
        let ascii = '';
        for (let i = 0; i < 16 && start + ofs + i <= end; i++) {
            if (i === 8)
                line += ' ';
            const byte = read(start + ofs + i);
            line += ` ${(0, util_1.hex)(byte)}`;
            ascii += (byte >= 0x20 && byte < 0x7f) ? String.fromCharCode(byte) : '.';
        }
        out(`${line.padEnd(60)} ${ascii}\n`);
    }
}
//# sourceMappingURL=cliformat.js.map