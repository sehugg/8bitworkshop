"use strict";
// Run-script interpreter: a small command language for driving a headless
// emulator. One command per line, separated by newlines or ';'; '#' or '//'
// starts a comment.
//
// Everything here talks to an EmuTarget, so the same script works against a
// Platform (--platform) or a bare Machine (--machine). Commands that need a
// capability the target lacks report that instead of failing silently.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunScript = exports.RUN_SCRIPT_HELP = void 0;
exports.parseNum = parseNum;
exports.formatRegs = formatRegs;
exports.parseSymbolFile = parseSymbolFile;
const emu_1 = require("../common/emu");
const probe_1 = require("../common/probe");
const util_1 = require("../common/util");
const cliformat_1 = require("./cliformat");
const emutarget_1 = require("./emutarget");
exports.RUN_SCRIPT_HELP = [
    'Execution:',
    '  run N | wait N              - advance N frames (default 1)',
    '  break ADDR [MAXFRAMES]      - stop when PC==ADDR (alias: runto)',
    '  step [N]                    - execute N instructions (default 1)',
    '  trace [MAXLINES] ADDR       - run until PC==ADDR, then log every',
    '                                instruction until the routine returns',
    '  hist [MAXLINES]             - last N instructions from the trace buffer',
    'Inspection & input:',
    '  key KEY                     - press key (down, 3 frames, up)',
    '  keydown KEY / keyup KEY     - raw key down/up events',
    '  mem START [LEN]             - hexdump memory (default 16 bytes)',
    '  screen [START] [COLS] [ROWS]- decode screen RAM to text (default $0400 40x25)',
    '  pc [N]                      - print PC + disassembly of N instructions',
    '  info                        - platform/machine debug info',
    '  reset                       - reset the emulator',
    '  echo TEXT                   - print message',
    '(ADDR: number or symbol name; KEY: char, ENTER/SPACE/arrows/F1.., $hex;',
    ' prefixes SHIFT+, CTRL+)',
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
    if (/^-?\d+$/.test(s))
        return parseInt(s, 10);
    throw new Error(`bad number '${s}'`);
}
function parseKeyValue(tok) {
    let flags = 0;
    let t = tok.toUpperCase();
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
    if (code < 0x20)
        return '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[£]^_'[code];
    return String.fromCharCode(code); // $20-$3F identical to ASCII
}
/**
 * Registers as "A=$12 X=$34 SP=$ff". CpuState carries whatever fields the CPU
 * happens to save, including internals, so pick the set that matches.
 */
const REG_SETS = [
    { when: ['A', 'X', 'Y'], show: ['A', 'X', 'Y', 'SP'], flags: 'NVDIZC' }, // 6502
    { when: ['AF', 'HL'], show: ['AF', 'BC', 'DE', 'HL', 'IX', 'IY', 'SP'] }, // Z80 / SM83
    { when: ['A', 'B', 'DP'], show: ['A', 'B', 'X', 'Y', 'U', 'S', 'DP', 'CC'] }, // 6809
];
function formatRegs(state) {
    if (!state)
        return '';
    const set = REG_SETS.find((s) => s.when.every((f) => state[f] != null));
    const names = set ? set.show : Object.keys(state).filter((k) => /^[A-Z]/.test(k) && k !== 'PC').slice(0, 6);
    const parts = [];
    for (const name of names) {
        const value = state[name];
        if (typeof value === 'number')
            parts.push(`${name}=$${(0, util_1.hex)(value, value > 0xff ? 4 : 2)}`);
    }
    if (set === null || set === void 0 ? void 0 : set.flags) {
        // set flags uppercase, clear flags lowercase
        const flags = [...set.flags].map((f) => (state[f] ? f : f.toLowerCase())).join('');
        parts.push(flags);
    }
    return parts.join(' ');
}
// Trace buffer size; the most recent half is kept once it fills up.
const PROBE_BUFFER_SIZE = 0x400000;
class RunScript {
    constructor(target, out = cliformat_1.write) {
        this.target = target;
        this.out = out;
        this.symbols = {};
        this.addr2symbol = {};
        this.probe = null;
    }
    addSymbols(symbols) {
        Object.assign(this.symbols, symbols);
        for (const [name, addr] of Object.entries(this.symbols))
            this.addr2symbol[addr] = name;
    }
    /** Start recording executed instructions, for the 'hist' command. */
    startTracing() {
        if (!this.target.machine)
            return false;
        const rec = new probe_1.ProbeRecorder(this.target.machine, PROBE_BUFFER_SIZE);
        rec.singleFrame = false; // accumulate across frames
        if (!this.target.connectProbe(rec))
            return false;
        this.probe = rec;
        return true;
    }
    run(script) {
        for (let line of script.split(/\r?\n|;/)) {
            line = line.trim();
            if (!line || line.startsWith('#') || line.startsWith('//'))
                continue;
            const tokens = line.split(/\s+/);
            const cmd = tokens[0].toLowerCase();
            const handler = COMMANDS[cmd];
            if (!handler) {
                throw new Error(`unknown command '${cmd}'\nCommands:\n${exports.RUN_SCRIPT_HELP}`);
            }
            try {
                handler.call(this, tokens, line);
            }
            catch (e) {
                throw new Error(`script error on '${line}': ${e.message}`);
            }
        }
    }
    //// helpers used by the commands
    log(msg) { this.out(`[frame ${this.target.frameCount}] ${msg}\n`); }
    addr(tok) {
        var _a;
        try {
            return parseNum(tok);
        }
        catch (e) {
            const v = (_a = this.symbols[tok]) !== null && _a !== void 0 ? _a : this.symbols[tok.replace(/^\./, '')];
            if (v == null)
                throw new Error(`unknown address or symbol '${tok}'`);
            return v;
        }
    }
    advance(n) {
        // Keep the trace buffer from overflowing: drop the oldest half.
        for (let i = 0; i < n; i++) {
            const p = this.probe;
            if (p && p.idx >= p.buf.length - 0x1000) {
                const half = p.buf.length >> 1;
                p.buf.copyWithin(0, p.idx - half, p.idx);
                p.idx = half;
            }
            this.target.advanceFrame();
        }
    }
    /** One disassembly line: "$ADDR  bytes  mnemonic" plus optional registers. */
    disasmLine(addr, withRegs) {
        const d = this.target.disassemble(addr);
        let bytes = '';
        if (d)
            for (let b = 0; b < d.nbytes; b++)
                bytes += (0, util_1.hex)(this.target.read(addr + b)) + ' ';
        const label = this.addr2symbol[addr] ? `${this.addr2symbol[addr]}:\n` : '';
        let line = `${label}  $${(0, util_1.hex)(addr, 4)}  ${bytes.padEnd(12)} ${(d ? d.line : '???').padEnd(20)}`;
        if (withRegs)
            line += ' ' + formatRegs(this.target.getCPUState());
        return line.replace(/\s+$/, '');
    }
    disasmBlock(addr, count) {
        for (let i = 0; i < count; i++) {
            const d = this.target.disassemble(addr);
            if (!d) {
                this.out(`  $${(0, util_1.hex)(addr, 4)}  (no disassembler for this target)\n`);
                return;
            }
            this.out(this.disasmLine(addr, false) + '\n');
            addr += d.nbytes;
        }
    }
    requireStep() {
        if (!this.target.supportsStep) {
            throw new Error(`'${this.target.id}' does not support instruction stepping`);
        }
    }
    //// commands
    cmdRun(tokens) {
        const n = tokens[1] ? parseNum(tokens[1]) : 1;
        this.advance(n);
        this.log(`ran ${n} frame${n == 1 ? '' : 's'}`);
    }
    cmdStep(tokens) {
        this.requireStep();
        this.target.settle();
        const n = tokens[1] ? parseNum(tokens[1]) : 1;
        for (let i = 0; i < n; i++) {
            this.out(this.disasmLine(this.target.getPC(), true) + '\n');
            this.target.stepInsn();
        }
        this.log(`PC=$${(0, util_1.hex)(this.target.getPC(), 4)}`);
    }
    cmdBreak(tokens) {
        if (!tokens[1])
            throw new Error('break requires an address');
        const addr = this.addr(tokens[1]);
        const maxFrames = tokens[2] ? parseNum(tokens[2]) : emutarget_1.DEFAULT_MAX_FRAMES;
        const start = this.target.frameCount;
        const hit = this.target.runToPC(new Set([addr]), maxFrames);
        const pc = this.target.getPC();
        const where = pc != null ? '$' + (0, util_1.hex)(pc, 4) : '?';
        this.log(`break $${(0, util_1.hex)(addr, 4)}: ${hit ? 'HIT' : 'MISSED'} (pc=${where} after ${this.target.frameCount - start} frames)`);
        if (!hit && !this.target.supportsTrap) {
            this.out(`  (note: '${this.target.id}' only checks the PC at frame boundaries)\n`);
        }
    }
    cmdTrace(tokens) {
        var _a, _b, _c;
        this.requireStep();
        let i = 1;
        let maxLines = 5000;
        if (tokens.length > 2 && /^\d+$/.test(tokens[1]))
            maxLines = parseNum(tokens[i++]);
        if (!tokens[i])
            throw new Error('trace requires an address (trace [MAXLINES] ADDR)');
        const targets = new Set();
        for (; i < tokens.length; i++)
            targets.add(this.addr(tokens[i]));
        const start = this.target.frameCount;
        if (!this.target.runToPC(targets)) {
            this.log(`trace: address not reached within ${this.target.frameCount - start} frames`);
            return;
        }
        const entrySP = (_b = (_a = this.target.getCPUState()) === null || _a === void 0 ? void 0 : _a.SP) !== null && _b !== void 0 ? _b : 0;
        this.log(`--- trace ON at $${(0, util_1.hex)(this.target.getPC(), 4)} ---`);
        let lines = 0;
        let done = 'ran out of frames';
        while (this.target.frameCount - start < emutarget_1.DEFAULT_MAX_FRAMES) {
            this.out(this.disasmLine(this.target.getPC(), true) + '\n');
            if (++lines >= maxLines) {
                done = `line cap (${maxLines}) reached`;
                break;
            }
            this.target.stepInsn();
            // the routine returned once the stack has popped back past entry level
            const sp = (_c = this.target.getCPUState()) === null || _c === void 0 ? void 0 : _c.SP;
            if (sp != null && sp > entrySP) {
                done = `returned after ${lines} instructions`;
                break;
            }
        }
        this.log(`--- trace OFF: ${done} ---`);
    }
    cmdHist(tokens) {
        const p = this.probe;
        if (!p)
            throw new Error(`'${this.target.id}' has no trace buffer (needs Probeable)`);
        if (p.idx === 0) {
            this.out('(no trace buffer data)\n');
            return;
        }
        const maxlines = tokens[1] ? parseNum(tokens[1]) : 20;
        // scan backwards for the start of the last `maxlines` events
        let start = p.idx, count = 0;
        while (start > 0 && count < maxlines) {
            start--;
            const op = p.buf[start] & 0xff000000;
            if (op === probe_1.ProbeFlags.EXECUTE || op === probe_1.ProbeFlags.INTERRUPT)
                count++;
        }
        let shown = 0;
        for (let i = start; i < p.idx && shown < maxlines; i++) {
            const w = p.buf[i];
            const op = w & 0xff000000;
            if (op === probe_1.ProbeFlags.EXECUTE) {
                this.out(this.disasmLine(w & 0xffffff, false) + '\n');
                shown++;
            }
            else if (op === probe_1.ProbeFlags.INTERRUPT) {
                this.out('  --- INTERRUPT ---\n');
                shown++;
            }
        }
        this.out(`(${shown} instructions shown, ${p.idx} events recorded)\n`);
    }
    cmdKey(tokens) {
        if (!tokens[1])
            throw new Error('key requires a key name');
        const { key, flags } = parseKeyValue(tokens[1]);
        this.target.setKeyInput(key, key, flags | emu_1.KeyFlags.KeyDown);
        this.advance(3);
        this.target.setKeyInput(key, key, flags | emu_1.KeyFlags.KeyUp);
        this.advance(1);
        this.log(`pressed ${tokens[1]} ($${(0, util_1.hex)(key, 2)})`);
    }
    cmdKeyDown(tokens) { this.keyEvent(tokens, emu_1.KeyFlags.KeyDown, 'keydown'); }
    cmdKeyUp(tokens) { this.keyEvent(tokens, emu_1.KeyFlags.KeyUp, 'keyup'); }
    keyEvent(tokens, flag, name) {
        if (!tokens[1])
            throw new Error(`${name} requires a key name`);
        const { key, flags } = parseKeyValue(tokens[1]);
        this.target.setKeyInput(key, key, flags | flag);
        this.log(`${name} ${tokens[1]} ($${(0, util_1.hex)(key, 2)})`);
    }
    cmdMem(tokens) {
        if (!tokens[1])
            throw new Error('mem requires START [LEN]');
        const start = this.addr(tokens[1]);
        const len = tokens[2] ? parseNum(tokens[2]) : 16;
        this.log(`mem $${(0, util_1.hex)(start, 4)}+$${(0, util_1.hex)(len, 4)}:`);
        (0, cliformat_1.hexdump)((a) => this.target.read(a), start, start + len - 1, this.out);
    }
    cmdScreen(tokens) {
        const start = tokens[1] ? this.addr(tokens[1]) : 0x400;
        const cols = tokens[2] ? parseNum(tokens[2]) : 40;
        const rows = tokens[3] ? parseNum(tokens[3]) : 25;
        this.log(`screen at $${(0, util_1.hex)(start, 4)} (${cols}x${rows}):`);
        for (let y = 0; y < rows; y++) {
            let line = '';
            for (let x = 0; x < cols; x++)
                line += screenCodeToChar(this.target.read(start + y * cols + x));
            this.out(`|${line.replace(/\s+$/, '')}|\n`);
        }
    }
    cmdPC(tokens) {
        this.target.settle();
        const pc = this.target.getPC();
        if (pc == null)
            throw new Error(`'${this.target.id}' does not report a PC`);
        this.log(`PC=$${(0, util_1.hex)(pc, 4)}`);
        this.disasmBlock(pc, tokens[1] ? parseNum(tokens[1]) : 8);
    }
    cmdInfo() {
        this.target.settle();
        const sections = this.target.getDebugInfo();
        if (!sections.length)
            this.out(`(no debug info for '${this.target.id}')\n`);
        for (const { category, text } of sections) {
            this.out(`[${category}]\n${text}${text.endsWith('\n') ? '' : '\n'}`);
        }
        const pc = this.target.getPC();
        if (pc != null && this.target.disassemble(pc)) {
            this.out('[Disassembly]\n');
            this.disasmBlock(pc, 16);
        }
    }
    cmdReset() { this.target.reset(); this.log('reset'); }
    cmdEcho(tokens, line) { this.out(line.substring(tokens[0].length).trim() + '\n'); }
}
exports.RunScript = RunScript;
const COMMANDS = {
    'run': RunScript.prototype.cmdRun,
    'wait': RunScript.prototype.cmdRun,
    'frames': RunScript.prototype.cmdRun,
    'step': RunScript.prototype.cmdStep,
    'break': RunScript.prototype.cmdBreak,
    'runto': RunScript.prototype.cmdBreak,
    'trace': RunScript.prototype.cmdTrace,
    'hist': RunScript.prototype.cmdHist,
    'key': RunScript.prototype.cmdKey,
    'press': RunScript.prototype.cmdKey,
    'keydown': RunScript.prototype.cmdKeyDown,
    'keyup': RunScript.prototype.cmdKeyUp,
    'mem': RunScript.prototype.cmdMem,
    'screen': RunScript.prototype.cmdScreen,
    'pc': RunScript.prototype.cmdPC,
    'info': RunScript.prototype.cmdInfo,
    'reset': RunScript.prototype.cmdReset,
    'echo': RunScript.prototype.cmdEcho,
};
/** Parse a cc65/ca65 or VICE label file into a symbol map. */
function parseSymbolFile(text) {
    const symbols = {};
    for (const line of text.split(/\r?\n/)) {
        const m1 = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*\$?([0-9A-Fa-f]+)\s*;/); // ca65/cc65 list
        const m2 = line.match(/^\s*(?:al|add_label)\s+([0-9A-Fa-f]+)\s+\.?([A-Za-z_][\w]*)/); // VICE
        if (m1)
            symbols[m1[1]] = parseInt(m1[2], 16);
        else if (m2)
            symbols[m2[2]] = parseInt(m2[1], 16);
    }
    return symbols;
}
//# sourceMappingURL=runscript.js.map