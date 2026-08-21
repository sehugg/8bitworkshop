"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertTabKeymap = exports.smartIndentKeymap = void 0;
exports.inferAsmTabStops = inferAsmTabStops;
exports.asmTabChange = asmTabChange;
exports.asmBackspaceRange = asmBackspaceRange;
exports.asmSpacesKeymap = asmSpacesKeymap;
const commands_1 = require("@codemirror/commands");
const state_1 = require("@codemirror/state");
exports.smartIndentKeymap = [
    { key: "Tab", run: commands_1.indentMore },
    { key: "Shift-Tab", run: commands_1.indentLess },
];
exports.insertTabKeymap = [
    { key: "Tab", run: commands_1.insertTab },
    { key: "Shift-Tab", run: commands_1.indentLess },
];
// Number of lines scanned in each direction when inferring tab stops.
const ASM_TABSTOP_SCAN_LINES = 50;
// Existing tab characters are assumed to advance to the next multiple of this column.
const TAB_EXPAND_WIDTH = 8;
// Print tab stop inference results to the browser console (for debugging).
const ASM_TAB_DEBUG = true;
function dbgTab(msg) {
    if (ASM_TAB_DEBUG)
        console.log("[asm-tab] " + msg);
}
// Compute the visual column of character position 'index' within a line,
// expanding tab characters to the next multiple of TAB_EXPAND_WIDTH.
function visualCol(text, index) {
    let col = 0;
    for (let i = 0; i < index; i++) {
        col = text.charCodeAt(i) == 9 ? (Math.floor(col / TAB_EXPAND_WIDTH) + 1) * TAB_EXPAND_WIDTH : col + 1;
    }
    return col;
}
// Add a candidate stop column to the frequency tally.
function addStop(col, freq) {
    if (col > 0)
        freq.set(col, (freq.get(col) || 0) + 1);
}
// Collect candidate tab stops from one asm line: the opcode start, operand
// start, and comment start columns (in visual columns, tabs expanded to 8).
// Lines starting at column 0 are assumed to have a label, so the opcode is the
// second word on those lines.
function collectStopsFromLine(text, freq) {
    // Visual columns of word starts, stopping at the comment.
    const words = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (text[m.index] == ';')
            break;
        words.push(visualCol(text, m.index));
    }
    // Comment start column (';' preceded by whitespace or line start).
    const cm = /(^|\s);/.exec(text);
    if (cm)
        addStop(visualCol(text, cm.index + cm[1].length), freq);
    // Skip the label if the line starts in column 0.
    const fields = words.length && words[0] == 0 ? words.slice(1) : words;
    if (fields.length >= 1)
        addStop(fields[0], freq); // opcode column
    if (fields.length >= 2)
        addStop(fields[1], freq); // operand column
}
// Minimum number of non-empty lines scanned after the cursor before we also
// merge in lines from before it (e.g. when the cursor is near the end of file).
const ASM_TABSTOP_MIN_LINES = 3;
// Infer tab stops for asm files: scan the lines after the current line first;
// if there aren't many of them (or they yield no stops), also merge in the lines
// before it. Returns a frequency tally of stop columns (in visual columns,
// with tabs expanded to 8).
function inferAsmTabStops(state, pos) {
    const cur = state.doc.lineAt(pos);
    const total = state.doc.lines;
    const scan = (from, to, step, freq) => {
        let lines = 0;
        for (let n = from; n != to && lines < ASM_TABSTOP_SCAN_LINES; n += step) {
            const line = state.doc.line(n);
            if (line.text.trim()) {
                collectStopsFromLine(line.text, freq);
                lines++;
            }
        }
        return lines;
    };
    const freq = new Map();
    // Prefer lines after the current line, but merge in lines before it when
    // there are too few lines below (cursor near end of file).
    const after = scan(cur.number + 1, Math.min(total, cur.number + ASM_TABSTOP_SCAN_LINES) + 1, 1, freq);
    if (after < ASM_TABSTOP_MIN_LINES) {
        scan(cur.number - 1, Math.max(1, cur.number - ASM_TABSTOP_SCAN_LINES) - 1, -1, freq);
    }
    return freq;
}
// Most frequent stop greater than col (ties: smallest column),
// or the next grid stop as a fallback.
function nextStop(freq, col, grid) {
    let best = -1, bestFreq = 0;
    for (const [s, f] of freq) {
        if (s > col && (f > bestFreq || (f == bestFreq && s < best))) {
            best = s;
            bestFreq = f;
        }
    }
    if (best >= 0)
        return best;
    return (Math.floor(col / grid) + 1) * grid;
}
// Most frequent stop less than col (ties: largest column),
// or the previous grid stop as a fallback.
function prevStop(freq, col, grid) {
    let best = -1, bestFreq = 0;
    for (const [s, f] of freq) {
        if (s < col && (f > bestFreq || (f == bestFreq && s > best))) {
            best = s;
            bestFreq = f;
        }
    }
    if (best >= 0)
        return best;
    return Math.max(0, Math.min(Math.floor((col - 1) / grid) * grid, col - 1));
}
// True if the document region near pos contains literal tab characters;
// in that case tab stops fall back to a hard grid of 8 columns.
function docHasTabs(state, pos) {
    const cur = state.doc.lineAt(pos);
    const fromLine = Math.max(1, cur.number - ASM_TABSTOP_SCAN_LINES);
    const toLine = Math.min(state.doc.lines, cur.number + ASM_TABSTOP_SCAN_LINES);
    for (let n = fromLine; n <= toLine; n++) {
        if (state.doc.line(n).text.includes('\t'))
            return true;
    }
    return false;
}
// Compute the insertion needed for pressing Tab at document position 'head':
// spaces from the cursor up to the next inferred tab stop.
function fmtStops(freq) {
    return "[" + [...freq.entries()].sort((a, b) => a[0] - b[0]).map(([s, f]) => `${s}:${f}`).join(" ") + "]";
}
function asmTabChange(state, head) {
    const line = state.doc.lineAt(head);
    const col = visualCol(line.text, head - line.from);
    const hasTabs = docHasTabs(state, head);
    const grid = hasTabs ? TAB_EXPAND_WIDTH : state.tabSize;
    const stops = inferAsmTabStops(state, head);
    const target = nextStop(stops, col, grid);
    dbgTab(`Tab @ line ${line.number} col ${col}: stops(col:freq)=${fmtStops(stops)} ${hasTabs ? "grid=8 (file has tabs)" : `grid=${state.tabSize}`} -> target=${target}`
        + ` | line=${JSON.stringify(line.text.slice(0, col))}+CURSOR`);
    if (target <= col)
        return null;
    return { from: head, insert: " ".repeat(target - col) };
}
// Compute the deletion range for Backspace at document position 'head'
// (spaces removed back to the previous inferred tab stop, or a single tab char),
// or null if default backspace behavior should apply.
function asmBackspaceRange(state, head) {
    const line = state.doc.lineAt(head);
    const index = head - line.from;
    if (index == 0) {
        dbgTab(`Backspace @ line ${line.number} col 0: start of line, using default`);
        return null;
    }
    // If the character before the cursor is a tab, just delete it.
    if (line.text[index - 1] == '\t') {
        dbgTab(`Backspace @ line ${line.number} col ${visualCol(line.text, index)}: deleting one tab char`);
        return { from: head - 1, to: head };
    }
    // Only handle cursors inside a pure-whitespace indent region.
    if (!/^[ \t]+$/.test(line.text.slice(0, index))) {
        dbgTab(`Backspace @ line ${line.number} col ${visualCol(line.text, index)}: cursor not in leading whitespace, using default`);
        return null;
    }
    const hasTabs = docHasTabs(state, head);
    const grid = hasTabs ? TAB_EXPAND_WIDTH : state.tabSize;
    const col = visualCol(line.text, index);
    const stops = inferAsmTabStops(state, head);
    const target = prevStop(stops, col, grid);
    if (target >= col) {
        dbgTab(`Backspace @ line ${line.number} col ${col}: no stop before cursor, using default`);
        return null;
    }
    // Convert target visual column back to a character index (only spaces ahead of us).
    const from = head - (col - target);
    dbgTab(`Backspace @ line ${line.number} col ${col}: stops(col:freq)=${fmtStops(stops)} ${hasTabs ? "grid=8 (file has tabs)" : `grid=${state.tabSize}`} -> deleting cols ${target}..${col}`
        + ` | line=${JSON.stringify(line.text.slice(0, index))}+CURSOR`);
    return { from, to: head };
}
// Insert spaces from the cursor up to the next inferred tab stop.
function asmInsertSpaces(view) {
    const state = view.state;
    if (state.selection.ranges.some(r => !r.empty))
        return false; // let indentMore handle selections
    const tr = state.changeByRange(range => {
        const change = asmTabChange(state, range.head);
        if (!change)
            return { range };
        return {
            changes: change,
            range: state_1.EditorSelection.cursor(range.head + change.insert.length),
        };
    });
    view.dispatch(tr);
    return true;
}
// Delete spaces from the cursor back to the previous inferred tab stop,
// but only when the cursor sits in leading whitespace.
function asmDeleteSpacesBackward(view) {
    const state = view.state;
    const range = state.selection.main;
    if (!range.empty)
        return false;
    const del = asmBackspaceRange(state, range.head);
    if (!del)
        return false;
    view.dispatch(state.update({
        changes: del,
        selection: state_1.EditorSelection.cursor(del.from),
    }));
    return true;
}
// Keymap for asm editors when "insert spaces when pressing tab" is enabled.
// The callback lets the caller gate the behavior on current settings.
function asmSpacesKeymap(tabsToSpaces) {
    return [
        { key: "Tab", run: v => tabsToSpaces() && asmInsertSpaces(v) },
        { key: "Backspace", run: v => tabsToSpaces() && asmDeleteSpacesBackward(v) },
    ];
}
//# sourceMappingURL=tabs.js.map