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
exports.cpuRegisters = cpuRegisters;
exports.formatRegs = formatRegs;
const emu_1 = require("../common/emu");
const callprofile_1 = require("../common/callprofile");
const probe_1 = require("../common/probe");
const util_1 = require("../common/util");
const debugtree_1 = require("../common/debugtree");
const symbolfile_1 = require("../common/symbols/symbolfile");
const timeline_1 = require("../common/timeline");
const debugcontroller_1 = require("../common/debugcontroller");
const cliformat_1 = require("./cliformat");
const emutarget_1 = require("./emutarget");
exports.RUN_SCRIPT_HELP = [
    'Execution:',
    '  run N | wait N              - advance N frames (default 1)',
    '  break ADDR [MAXFRAMES]      - stop when PC==ADDR (alias: runto)',
    '  step [N]                    - execute N instructions (default 1)',
    '  over [N]                    - step over N source lines, or instructions',
    '                                without source, running calls through',
    '  out                         - run until the current routine returns',
    '  trace [MAXLINES] ADDR       - run until PC==ADDR, then log every',
    '                                instruction until the routine returns',
    '  hist [MAXLINES]             - last N instructions from the trace buffer',
    '  profile N [ADDR [DEPTH]]    - run N frames, print a call tree with clocks per',
    '                                subtree (rooted at routine ADDR if given)',
    'Time travel (replays the recording; output is labeled [frame:step]):',
    '  back [N]                    - step back N instructions (default 1)',
    '  rewind [N]                  - back to the start of the Nth frame before (default 1)',
    '  seek FRAME[:STEP]           - go to a recorded moment',
    '  rbreak ADDR                 - run back to the last time PC==ADDR',
    '  now                         - print the current moment and the recorded range',
    '  (run and step in the past replay the recording; a key starts a new future)',
    'Inspection & input:',
    '  key KEY                     - press key (down, 3 frames, up)',
    '  keydown KEY / keyup KEY     - raw key down/up events',
    '  png FILE                    - write the current frame as a PNG',
    '  capture N DIR               - advance N frames, writing DIR/frame_NNNNN.png each',
    '                                (a frame sequence for ffmpeg)',
    '  mem START [LEN]             - hexdump memory (default 16 bytes)',
    '  screen [START] [COLS] [ROWS]- decode screen RAM to text (default $0400 40x25)',
    '  serial                      - print what the program sent to its serial port (devel-6502)',
    '  pc [N]                      - print PC + disassembly of N instructions',
    '  info                        - platform/machine debug info',
    '  paddle X Y [BUTTONS]        - move the paddle to X,Y (0-255); BUTTONS is a list of 0/1, like 1 0 0',
    '  signals [PATH]              - HDL signals under PATH (modules separated by dots; default the top)',
    '  vcd FILE [MAXMB] | vcd off  - record every clock\'s signal changes to a VCD file; .gz compresses; stops at MAXMB (default 1024, 0 = no limit); 8bws only',
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
    // More specific sets first: the 6809 shares A/X/Y with the 6502.
    { when: ['A', 'B', 'DP'], show: ['A', 'B', 'X', 'Y', 'U', 'SP', 'DP', 'CC'] }, // 6809
    { when: ['AF', 'HL'], show: ['AF', 'BC', 'DE', 'HL', 'IX', 'IY', 'SP'] }, // Z80 / SM83
    { when: ['A', 'X', 'Y'], show: ['A', 'X', 'Y', 'SP'], flags: 'NVDIZC' }, // 6502
];
function findRegSet(state) {
    return REG_SETS.find((s) => s.when.every((f) => state[f] != null));
}
/**
 * The registers a CPU state carries, in display order (PC first). Recognized
 * CPUs show only their register set; others fall back to the leading
 * uppercase state fields. Non-register state (opcodes, cycle counts, IRQ
 * bookkeeping) is left out. This is the single source of truth for what
 * counts as a register.
 */
function cpuRegisters(state) {
    if (!state)
        return [];
    const set = findRegSet(state);
    const names = set ? set.show : Object.keys(state).filter((k) => /^[A-Z]/.test(k) && k !== 'PC').slice(0, 6);
    const out = [];
    const add = (name, flag = false) => {
        const v = state[name];
        if (typeof v !== 'number' && typeof v !== 'boolean')
            return;
        out.push({ name, value: flag || typeof v === 'boolean' ? (v ? 1 : 0) : v, flag: flag || undefined });
    };
    add('PC');
    names.forEach((name) => add(name));
    if (set === null || set === void 0 ? void 0 : set.flags)
        for (const flag of set.flags)
            add(flag, true);
    return out;
}
function formatRegs(state) {
    const regs = cpuRegisters(state);
    // the disassembly line already shows the address, so omit PC
    const parts = regs
        .filter((r) => r.name !== 'PC' && !r.flag)
        .map((r) => `${r.name}=$${(0, util_1.hex)(r.value, r.value > 0xff ? 4 : 2)}`);
    // set flags uppercase, clear flags lowercase
    const flags = regs.filter((r) => r.flag).map((r) => (r.value ? r.name : r.name.toLowerCase())).join('');
    if (flags)
        parts.push(flags);
    return parts.join(' ');
}
// Trace buffer size; the most recent half is kept once it fills up.
const PROBE_BUFFER_SIZE = 0x400000;
class RunScript {
    constructor(target, out = cliformat_1.write, debug = new debugcontroller_1.DebugController(target)) {
        this.target = target;
        this.out = out;
        this.debug = debug;
        this.symbols = {};
        this.addr2symbol = {};
        this.probe = null;
        this.vcdFile = null;
        // running count for the `capture` command's file names
        this.frameIndex = 0;
    }
    addSymbols(symbols) {
        Object.assign(this.symbols, symbols);
        for (const [name, addr] of Object.entries(this.symbols))
            this.addr2symbol[addr] = name;
        this.debug.setContext(Object.assign(Object.assign({}, this.debug.context), { symbols: this.symbols }));
    }
    /** Source lines (and symbols) from the build, for `over` and for output. */
    setDebugContext(ctx) {
        this.debug.setContext(ctx);
        this.addSymbols(ctx.symbols || {});
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
    /** Finish what the script left open (a VCD recording). Call when it is done. */
    finish() {
        if (this.vcdFile)
            this.cmdVcd(['vcd', 'off']);
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
    log(msg) { this.out(`[${(0, timeline_1.formatTimestamp)(this.target.now())}] ${msg}\n`); }
    addr(tok) {
        try {
            return parseNum(tok);
        }
        catch (e) {
            const v = (0, symbolfile_1.lookupSymbol)(this.symbols, tok);
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
    requireRewind() {
        if (!this.target.supportsRewind) {
            throw new Error(`'${this.target.id}' cannot rewind (it can't save its state)`);
        }
    }
    parseTimestamp(tok) {
        const [f, st] = tok.split(':');
        return (0, timeline_1.timestamp)(parseNum(f), st ? parseNum(st) : 0);
    }
    /** "PC=$ADDR", and the source line if the build has one */
    pcAt() {
        const loc = this.debug.location();
        const pc = loc.pc != null ? '$' + (0, util_1.hex)(loc.pc, 4) : '?';
        return `PC=${pc}` + (loc.source ? ` (${loc.source.path}:${loc.source.line})` : '');
    }
    /** Run the controller's goal to a stop. A halt is an error, as when running. */
    runToStop(maxFrames = emutarget_1.DEFAULT_MAX_FRAMES) {
        const stop = this.debug.runToStop(maxFrames);
        if (stop && (stop.reason === 'halt' || stop.reason === 'exception'))
            throw new Error(stop.message);
        return stop;
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
        this.target.stepInsn(n, () => { this.out(this.disasmLine(this.target.getPC(), true) + '\n'); });
        this.log(this.pcAt());
    }
    cmdOver(tokens) {
        const n = tokens[1] ? parseNum(tokens[1]) : 1;
        for (let i = 0; i < n; i++) {
            this.debug.stepOver();
            if (!this.runToStop())
                throw new Error(`no next line within ${emutarget_1.DEFAULT_MAX_FRAMES} frames`);
        }
        this.log(this.pcAt());
    }
    cmdOut() {
        this.debug.stepOut();
        if (!this.runToStop())
            throw new Error(`no return within ${emutarget_1.DEFAULT_MAX_FRAMES} frames`);
        this.log(this.pcAt());
    }
    cmdBreak(tokens) {
        if (!tokens[1])
            throw new Error('break requires an address');
        const addr = this.addr(tokens[1]);
        const maxFrames = tokens[2] ? parseNum(tokens[2]) : emutarget_1.DEFAULT_MAX_FRAMES;
        const start = this.target.frameCount;
        this.debug.runTo(addr);
        const hit = this.runToStop(maxFrames) != null;
        const pc = this.target.getPC();
        const where = pc != null ? '$' + (0, util_1.hex)(pc, 4) : '?';
        this.log(`break $${(0, util_1.hex)(addr, 4)}: ${hit ? 'HIT' : 'MISSED'} (pc=${where} after ${this.target.frameCount - start} frames)`);
        if (!hit && !this.target.supportsTrap) {
            this.out(`  (note: '${this.target.id}' only checks the PC at frame boundaries)\n`);
        }
    }
    cmdTrace(tokens) {
        var _a, _b;
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
        // one run, logging each instruction before it executes
        this.target.stepInsn(maxLines, () => {
            var _a;
            // the routine returned once the stack has popped back past entry level
            const sp = (_a = this.target.getCPUState()) === null || _a === void 0 ? void 0 : _a.SP;
            if (lines > 0 && sp != null && sp > entrySP) {
                done = `returned after ${lines} instructions`;
                return true;
            }
            this.out(this.disasmLine(this.target.getPC(), true) + '\n');
            if (++lines >= maxLines)
                done = `line cap (${maxLines}) reached`;
        });
        this.log(`--- trace OFF: ${done} ---`);
    }
    cmdProfile(tokens) {
        const n = tokens[1] ? parseNum(tokens[1]) : 1;
        const start = tokens[2] ? this.addr(tokens[2]) : null;
        const depth = tokens[3] ? parseNum(tokens[3]) : 8;
        const name = (a) => this.addr2symbol[a] || '$' + (0, util_1.hex)(a, 4);
        const kinds = new Map(); // code rarely changes, so classify once
        const classify = (pc) => {
            let k = kinds.get(pc);
            if (k == null) {
                const d = this.target.disassemble(pc);
                k = !d ? 'unknown' : (0, debugcontroller_1.isCallInsn)(d.line) ? 'call' : (0, debugcontroller_1.isReturnInsn)(d.line) ? 'return' : 'other';
                kinds.set(pc, k);
            }
            return k;
        };
        const prof = new callprofile_1.CallProfiler(classify, name);
        if (!this.target.connectProbe(prof))
            throw new Error(`'${this.target.id}' does not support probing`);
        try {
            this.advance(n);
        }
        finally {
            this.target.connectProbe(this.probe);
        } // put the trace recorder back
        this.out(prof.report(start, depth));
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
    cmdBack(tokens) {
        this.requireRewind();
        this.requireStep();
        const n = tokens[1] ? parseNum(tokens[1]) : 1;
        if (!this.target.stepBack(n))
            throw new Error(`the recording doesn't reach back ${n} instruction${n == 1 ? '' : 's'}`);
        this.log(`back ${n}: ${this.pcAt()}`);
        this.out(this.disasmLine(this.target.getPC(), true) + '\n');
    }
    cmdSeek(tokens) {
        this.requireRewind();
        if (!tokens[1])
            throw new Error('seek requires FRAME[:STEP]');
        this.target.seek(this.parseTimestamp(tokens[1]));
        this.log(this.where());
    }
    cmdRewind(tokens) {
        this.requireRewind();
        const n = tokens[1] ? parseNum(tokens[1]) : 1;
        const t = this.target.now();
        // from partway into a frame, its own start counts as the first
        const frame = t.step > 0 ? t.frame - n + 1 : t.frame - n;
        const first = this.target.history.first();
        this.target.seek((0, timeline_1.timestamp)(Math.max(frame, first.frame), 0));
        this.log(this.where());
    }
    cmdReverseBreak(tokens) {
        this.requireRewind();
        if (!tokens[1])
            throw new Error('rbreak requires an address');
        const addr = this.addr(tokens[1]);
        const hit = this.target.reverseRunUntil(() => this.target.getPC() === addr);
        const pc = this.target.getPC();
        this.log(`rbreak $${(0, util_1.hex)(addr, 4)}: ${hit ? 'HIT' : 'MISSED'} (pc=${pc != null ? '$' + (0, util_1.hex)(pc, 4) : '?'})`);
    }
    cmdNow() {
        this.log(this.where());
    }
    /** "at F:S (past; recorded A to B)" */
    where() {
        const t = this.target;
        const h = t.history;
        if (!h)
            return `at frame ${t.frameCount} (no recording)`;
        const range = `recorded ${(0, timeline_1.formatTimestamp)(h.first())} to ${(0, timeline_1.formatTimestamp)(h.last())}`;
        return `at ${(0, timeline_1.formatTimestamp)(t.now())} (${t.isInPast() ? 'past' : 'present'}; ${range})`;
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
    cmdSerial() {
        const text = this.target.getSerialOutput();
        if (text == null)
            throw new Error(`'${this.target.id}' has no serial output`);
        this.log(`serial output (${text.length} bytes):`);
        this.out(text.endsWith('\n') ? text : text + '\n');
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
    cmdPaddle(tokens) {
        if (!this.target.acceptsPaddles())
            throw new Error(`'${this.target.id}' has no paddles`);
        const [x, y] = [tokens[1], tokens[2]].map(t => parseInt(t));
        if (isNaN(x) || isNaN(y))
            throw new Error('usage: paddle X Y [BUTTONS]');
        this.target.setPaddles(x, y, tokens.slice(3).map(t => t === '1'));
    }
    cmdSignals(tokens) {
        this.target.settle();
        const root = this.target.getSignals();
        if (!root)
            throw new Error(`'${this.target.id}' has no signals`);
        const path = tokens[1] ? tokens[1].split('.') : [];
        const clock = this.target.getClockCount();
        if (!path.length && clock != null)
            this.out(`(clock ${clock})\n`);
        for (const e of (0, debugtree_1.treeChildren)(root, path))
            this.out(`${e.name}${e.expandable ? '/' : ''} ${e.value}\n`);
    }
    cmdPNG(tokens) {
        if (!tokens[1])
            throw new Error('usage: png FILE');
        if (!this.writeFrame)
            throw new Error("'png' is not available here");
        const video = this.target.getVideo();
        if (!video)
            throw new Error(`'${this.target.id}' has no video to capture`);
        this.writeFrame(tokens[1], video);
        this.log(`wrote ${tokens[1]}`);
    }
    cmdCapture(tokens) {
        const n = tokens[1] ? parseNum(tokens[1]) : 1;
        const dir = tokens[2];
        if (!dir)
            throw new Error('usage: capture N DIR');
        if (!this.writeFrame)
            throw new Error("'capture' is not available here");
        const base = dir.replace(/[\\/]+$/, '');
        for (let i = 0; i < n; i++) {
            this.advance(1);
            const video = this.target.getVideo();
            if (!video)
                throw new Error(`'${this.target.id}' has no video to capture`);
            this.writeFrame(`${base}/frame_${String(this.frameIndex++).padStart(5, '0')}.png`, video);
        }
        this.log(`wrote ${n} frame${n == 1 ? '' : 's'} to ${dir}`);
    }
    cmdVcd(tokens) {
        if (tokens[1] === 'off' || tokens[1] === 'stop') {
            const file = this.vcdFile;
            if (!file)
                throw new Error('no VCD recording is on');
            this.vcdFile = null;
            const clocks = this.target.stopVcd();
            file.close();
            this.out(`wrote ${clocks} clocks to ${file.path}${file.full ? ' (stopped at the size limit)' : ''}\n`);
            return;
        }
        if (!tokens[1])
            throw new Error('usage: vcd FILE [MAXMB] | vcd off');
        if (!this.openFile)
            throw new Error("'vcd' is not available here");
        if (!this.target.supportsVcd)
            throw new Error(`'${this.target.id}' has no signals to record`);
        this.finish();
        // MAXMB: stop at about this size; 0 for no limit
        const maxMB = tokens[2] != null ? parseFloat(tokens[2]) : NaN;
        if (tokens[2] != null && !(maxMB >= 0))
            throw new Error('usage: vcd FILE [MAXMB] | vcd off');
        const file = this.openFile(tokens[1], isNaN(maxMB) ? undefined : maxMB * 1048576);
        this.target.startVcd(chunk => file.write(chunk), () => file.full);
        this.vcdFile = { path: tokens[1], close: () => file.close(), get full() { return file.full; } };
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
    'over': RunScript.prototype.cmdOver,
    'next': RunScript.prototype.cmdOver,
    'out': RunScript.prototype.cmdOut,
    'finish': RunScript.prototype.cmdOut,
    'break': RunScript.prototype.cmdBreak,
    'runto': RunScript.prototype.cmdBreak,
    'trace': RunScript.prototype.cmdTrace,
    'hist': RunScript.prototype.cmdHist,
    'profile': RunScript.prototype.cmdProfile,
    'prof': RunScript.prototype.cmdProfile,
    'key': RunScript.prototype.cmdKey,
    'press': RunScript.prototype.cmdKey,
    'keydown': RunScript.prototype.cmdKeyDown,
    'keyup': RunScript.prototype.cmdKeyUp,
    'mem': RunScript.prototype.cmdMem,
    'screen': RunScript.prototype.cmdScreen,
    'serial': RunScript.prototype.cmdSerial,
    'pc': RunScript.prototype.cmdPC,
    'info': RunScript.prototype.cmdInfo,
    'signals': RunScript.prototype.cmdSignals,
    'png': RunScript.prototype.cmdPNG,
    'capture': RunScript.prototype.cmdCapture,
    'vcd': RunScript.prototype.cmdVcd,
    'paddle': RunScript.prototype.cmdPaddle,
    'reset': RunScript.prototype.cmdReset,
    'back': RunScript.prototype.cmdBack,
    'seek': RunScript.prototype.cmdSeek,
    'rewind': RunScript.prototype.cmdRewind,
    'rbreak': RunScript.prototype.cmdReverseBreak,
    'now': RunScript.prototype.cmdNow,
    'echo': RunScript.prototype.cmdEcho,
};
//# sourceMappingURL=runscript.js.map