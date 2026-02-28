"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingView = exports.DisassemblerView = exports.SourceEditor = exports.textMapFunctions = exports.PC_LINE_LOOKAHEAD = void 0;
const autocomplete_1 = require("@codemirror/autocomplete");
const commands_1 = require("@codemirror/commands");
const lang_cpp_1 = require("@codemirror/lang-cpp");
const lang_markdown_1 = require("@codemirror/lang-markdown");
const language_1 = require("@codemirror/language");
const search_1 = require("@codemirror/search");
const state_1 = require("@codemirror/state");
const view_1 = require("@codemirror/view");
const util_1 = require("../../common/util");
const lang_6502_1 = require("../../parser/lang-6502");
const lang_basic_1 = require("../../parser/lang-basic");
const lang_bataribasic_1 = require("../../parser/lang-bataribasic");
const lang_fastbasic_1 = require("../../parser/lang-fastbasic");
const lang_inform6_1 = require("../../parser/lang-inform6");
const lang_verilog_1 = require("../../parser/lang-verilog");
const lang_wiz_1 = require("../../parser/lang-wiz");
const lang_z80_1 = require("../../parser/lang-z80");
const cobalt_1 = require("../../themes/cobalt");
const disassemblyTheme_1 = require("../../themes/disassemblyTheme");
const editorTheme_1 = require("../../themes/editorTheme");
const mbo_1 = require("../../themes/mbo");
const ui_1 = require("../ui");
const baseviews_1 = require("./baseviews");
const debug_1 = require("./debug");
const filters_1 = require("./filters");
const gutter_1 = require("./gutter");
const visuals_1 = require("./visuals");
// TODO: make this an easily toggleable debug setting.
// Debug syntax highlighting. Useful when developing new parsers and themes.
const debugHighlightTags = false;
/////
// look ahead this many bytes when finding source lines for a PC
exports.PC_LINE_LOOKAHEAD = 64;
const MAX_ERRORS = 200;
const MODEDEFS = {
    default: { theme: mbo_1.mbo }, // NOTE: Not merged w/ other modes
    '6502': { isAsm: true },
    z80: { isAsm: true },
    jsasm: { isAsm: true },
    gas: { isAsm: true },
    vasm: { isAsm: true },
    inform6: { theme: cobalt_1.cobalt },
    markdown: { lineWrap: true },
    fastbasic: { noGutters: true },
    basic: { noLineNumbers: true, noGutters: true }, // TODO: not used?
    ecs: { theme: mbo_1.mbo, isAsm: true },
};
exports.textMapFunctions = {
    input: null
};
class SourceEditor {
    constructor(path, mode) {
        this.updateTimer = null;
        this.dirtylisting = true;
        this.refreshDelayMsec = 300;
        this.path = path;
        this.mode = mode;
    }
    createDiv(parent) {
        var div = document.createElement('div');
        div.setAttribute("class", "editor");
        parent.appendChild(div);
        var text = ui_1.current_project.getFile(this.path);
        var asmOverride = text && this.mode == 'verilog' && /__asm\b([\s\S]+?)\b__endasm\b/.test(text);
        this.newEditor(div, text, asmOverride);
        this.editor.dispatch({
            effects: (0, filters_1.createTextTransformFilterEffect)(exports.textMapFunctions),
        });
        if (ui_1.current_project.getToolForFilename(this.path).startsWith("remote:")) {
            this.refreshDelayMsec = 1000; // remote URLs get slower refresh
        }
        return div;
    }
    setVisible(showing) {
        if (showing) {
            this.editor.focus(); // so that keyboard works when moving between files
        }
    }
    newEditor(parent, text, isAsmOverride) {
        var modedef = MODEDEFS[this.mode] || MODEDEFS.default;
        var isAsm = isAsmOverride || modedef.isAsm;
        var lineWrap = !!modedef.lineWrap;
        var theme = modedef.theme || MODEDEFS.default.theme;
        var lineNums = !modedef.noLineNumbers && !baseviews_1.isMobileDevice;
        if (ui_1.qs['embed']) {
            lineNums = false; // no line numbers while embedded
            isAsm = false; // no opcode bytes either
        }
        const minimalGutters = modedef.noGutters || baseviews_1.isMobileDevice;
        var parser;
        switch (this.mode) {
            case '6502':
                parser = (0, lang_6502_1.asm6502)();
                break;
            case 'basic':
                parser = (0, lang_basic_1.basic)();
                break;
            case 'bataribasic':
                parser = (0, lang_bataribasic_1.batariBasic)();
                break;
            case 'fastbasic':
                parser = (0, lang_fastbasic_1.fastBasic)();
                break;
            case 'inform6':
                parser = (0, lang_inform6_1.inform6)();
                break;
            case 'markdown':
                parser = (0, lang_markdown_1.markdown)();
                break;
            case 'text/x-csrc':
                parser = (0, lang_cpp_1.cpp)();
                break;
            case 'text/x-wiz':
                parser = (0, lang_wiz_1.wiz)();
                break;
            case 'verilog':
                parser = (0, lang_verilog_1.verilog)();
                break;
            case 'z80':
                parser = (0, lang_z80_1.asmZ80)();
                break;
            default:
                console.warn("Unknown mode: " + this.mode);
                break;
        }
        this.editor = new view_1.EditorView({
            parent: parent,
            doc: text,
            extensions: [
                // Custom keybindings must appear before default keybindings.
                view_1.keymap.of([
                    { key: "Backspace", run: autocomplete_1.deleteBracketPair },
                ]),
                view_1.keymap.of(commands_1.defaultKeymap),
                lineNums ? (0, view_1.lineNumbers)() : [],
                (0, view_1.highlightSpecialChars)(),
                // Undo history.
                (0, commands_1.history)(),
                view_1.keymap.of(commands_1.historyKeymap),
                // Code fold gutter.
                (0, language_1.foldGutter)(),
                (0, view_1.dropCursor)(),
                state_1.EditorState.allowMultipleSelections.of(true),
                (0, view_1.drawSelection)(),
                (0, language_1.indentOnInput)(),
                (0, language_1.bracketMatching)(),
                (0, autocomplete_1.closeBrackets)(),
                // Rectangular selection and crosshair cursor.
                (0, view_1.rectangularSelection)(),
                (0, view_1.crosshairCursor)(),
                (0, view_1.highlightActiveLine)(),
                (0, view_1.highlightActiveLineGutter)(),
                (0, search_1.highlightSelectionMatches)(),
                (0, search_1.search)({ top: true }),
                view_1.keymap.of(search_1.searchKeymap),
                // lintGutter(),
                // autocompletion(),
                parser || [],
                theme,
                editorTheme_1.editorTheme,
                debugHighlightTags ? debug_1.debugHighlightTagsTooltip : [],
                state_1.EditorState.tabSize.of(8),
                language_1.indentUnit.of("        "),
                view_1.keymap.of([commands_1.indentWithTab]),
                lineWrap ? view_1.EditorView.lineWrapping : [],
                visuals_1.currentPc.field,
                !minimalGutters ? [
                    gutter_1.offset.field,
                    gutter_1.offset.gutter,
                ] : [],
                isAsm && !minimalGutters ? [
                    gutter_1.bytes.field,
                    gutter_1.bytes.gutter,
                    gutter_1.clock.field,
                    gutter_1.clock.gutter,
                ] : [],
                gutter_1.breakpointMarkers.field,
                gutter_1.statusMarkers.gutter,
                view_1.EditorView.updateListener.of(update => {
                    for (let effect of update.transactions.flatMap(tr => tr.effects)) {
                        if (effect.is(gutter_1.breakpointMarkers.set)) {
                            if (ui_1.platform.isRunning()) {
                                this.runToBreakpoints(update.state);
                            }
                        }
                        if (effect.is(gutter_1.currentPcMarker.runToLine)) {
                            const lineNum = effect.value;
                            if (this.sourcefile && this.sourcefile.line2offset) {
                                const pc = this.sourcefile.line2offset[lineNum];
                                if (pc >= 0) {
                                    (0, ui_1.runToPC)([pc]);
                                }
                            }
                        }
                    }
                }),
                gutter_1.errorMarkers.field,
                visuals_1.errorMessages.field,
                gutter_1.currentPcMarker.field,
                gutter_1.currentPcMarker.gutter,
                visuals_1.highlightLines.field,
                filters_1.textTransformFilterCompartment.of([]),
                // update file in project (and recompile) when edits made
                view_1.EditorView.updateListener.of(update => {
                    if (update.docChanged) {
                        this.editorChanged();
                    }
                }),
                // inspect symbol when it's highlighted (double-click)
                visuals_1.showValue.field,
                view_1.EditorView.updateListener.of(update => {
                    if (update.selectionSet) {
                        this.inspectUnderCursor(update);
                    }
                }),
            ],
        });
    }
    editorChanged() {
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            ui_1.current_project.updateFile(this.path, this.editor.state.doc.toString());
        }, this.refreshDelayMsec);
    }
    inspectUnderCursor(update) {
        // TODO: handle multi-select
        const range = update.state.selection.main;
        const selectedText = update.state.sliceDoc(range.from, range.to).trim();
        var result;
        if (ui_1.platform.inspect) {
            result = ui_1.platform.inspect(selectedText);
        }
        if (!range.empty && result && result.length < 80) {
            update.view.dispatch({
                effects: visuals_1.showValue.effect.of({ range: range, val: result })
            });
        }
        else {
            update.view.dispatch({
                effects: visuals_1.showValue.effect.of(null)
            });
        }
    }
    setText(text) {
        var oldtext = this.editor.state.doc.toString();
        if (oldtext != text) {
            this.editor.dispatch({
                changes: { from: 0, to: this.editor.state.doc.length, insert: text }
            });
        }
    }
    insertText(text) {
        const main = this.editor.state.selection.main;
        this.editor.dispatch({
            changes: { from: main.from, to: main.to, insert: text },
            selection: { anchor: main.from + text.length },
            userEvent: "input.paste"
        });
    }
    highlightLines(start, end) {
        const startLine = this.editor.state.doc.line(start + 1);
        this.editor.dispatch({
            effects: [
                visuals_1.highlightLines.effect.of({ start: start + 1, end: end + 1 }),
                view_1.EditorView.scrollIntoView(startLine.from, { y: "start", yMargin: 100 /*pixels*/ }),
            ]
        });
    }
    getValue() {
        return this.editor.state.doc.toString();
    }
    getPath() { return this.path; }
    markErrors(errors) {
        // TODO: move cursor to error line if offscreen?
        this.clearErrors();
        errors = errors.slice(0, MAX_ERRORS);
        const newErrors = new Map();
        for (var info of errors) {
            // only mark errors with this filename, or without any filename
            if (!info.path || this.path.endsWith(info.path)) {
                var numLines = this.editor.state.doc.lines;
                var line = info.line;
                if (isNaN(line) || line < 1 || line > numLines)
                    line = 1;
                newErrors.set(line, info.msg);
            }
        }
        this.editor.dispatch({
            effects: [
                gutter_1.errorMarkers.set.of(newErrors),
            ],
        });
    }
    clearErrors() {
        this.dirtylisting = true;
        this.editor.dispatch({
            effects: [
                gutter_1.errorMarkers.set.of(new Map()),
                gutter_1.errorMarkers.showMessage.of(null),
            ],
        });
    }
    getSourceFile() { return this.sourcefile; }
    updateListing() {
        // update editor annotations
        // TODO: recreate editor if gutter-bytes is used (verilog)
        this.clearErrors();
        var lstlines = this.sourcefile.lines || [];
        const newOffsets = new Map();
        const newBytes = new Map();
        const newClocks = new Map();
        for (var info of lstlines) {
            //if (info.path && info.path != this.path) continue;
            if (info.offset >= 0) {
                newOffsets.set(info.line, (0, util_1.hex)(info.offset & 0xffff, 4));
            }
            if (info.insns) {
                var insnstr = info.insns.length > 9 ? ("...") : info.insns;
                newBytes.set(info.line, insnstr);
                if (info.iscode) {
                    // TODO: labels trick this part?
                    if (info.cycles) {
                        newClocks.set(info.line, info.cycles + "");
                    }
                    else if (ui_1.platform.getOpcodeMetadata) {
                        var opcode = parseInt(info.insns.split(" ")[0], 16);
                        var meta = ui_1.platform.getOpcodeMetadata(opcode, info.offset);
                        if (meta && meta.minCycles) {
                            var clockstr = meta.minCycles + "";
                            newClocks.set(info.line, clockstr);
                        }
                    }
                }
            }
        }
        this.editor.dispatch({
            effects: [
                gutter_1.offset.set.of(newOffsets),
                gutter_1.bytes.set.of(newBytes),
                gutter_1.clock.set.of(newClocks),
            ],
        });
    }
    setTimingResult(result) {
        if (this.sourcefile == null)
            return;
        var newBytes = new Map();
        for (const line of Object.keys(this.sourcefile.line2offset)) {
            let pc = this.sourcefile.line2offset[line];
            let clocks = result.pc2clockrange[pc];
            var minclocks = clocks && clocks.minclocks;
            var maxclocks = clocks && clocks.maxclocks;
            if (minclocks >= 0 && maxclocks >= 0) {
                var s;
                if (maxclocks == minclocks)
                    s = minclocks + "";
                else
                    s = minclocks + "-" + maxclocks;
                if (maxclocks == result.MAX_CLOCKS)
                    s += "+";
                newBytes.set(parseInt(line), s);
            }
        }
        this.editor.dispatch({
            effects: [
                gutter_1.bytes.set.of(newBytes),
            ],
        });
    }
    setCurrentLine(line, moveCursor) {
        var addCurrentMarker = (line) => {
            this.editor.dispatch({
                effects: [
                    gutter_1.currentPcMarker.set.of(line.line),
                    visuals_1.currentPc.effect.of(line.line),
                    // Optional: follow the execution point
                    view_1.EditorView.scrollIntoView(this.editor.state.doc.line(line.line).from, { y: "center" }),
                ]
            });
        };
        this.clearCurrentLine(moveCursor);
        if (line) {
            addCurrentMarker(line);
            if (moveCursor) {
                const targetLine = this.editor.state.doc.line(line.line);
                const pos = targetLine.from + (line.start || 0);
                this.editor.dispatch({
                    selection: { anchor: pos, head: pos },
                    effects: view_1.EditorView.scrollIntoView(pos, { y: "center" })
                });
            }
            this.currentDebugLine = line;
        }
    }
    clearCurrentLine(moveCursor) {
        if (this.currentDebugLine) {
            if (moveCursor) {
                const pos = this.editor.state.selection.main.head;
                this.editor.dispatch({ selection: { anchor: pos, head: pos } });
            }
            this.currentDebugLine = null;
        }
        this.editor.dispatch({
            effects: [
                gutter_1.currentPcMarker.set.of(null),
                visuals_1.currentPc.effect.of(null),
            ]
        });
    }
    getActiveLine() {
        if (this.sourcefile) {
            var cpustate = ui_1.lastDebugState && ui_1.lastDebugState.c;
            if (!cpustate && ui_1.platform.getCPUState && !ui_1.platform.isRunning())
                cpustate = ui_1.platform.getCPUState();
            if (cpustate) {
                var EPC = (cpustate && (cpustate.EPC || cpustate.PC));
                var res = this.sourcefile.findLineForOffset(EPC, exports.PC_LINE_LOOKAHEAD);
                return res;
            }
        }
    }
    refreshDebugState(moveCursor) {
        // TODO: only if line changed
        // TODO: remove after compilation
        this.clearCurrentLine(moveCursor);
        var line = this.getActiveLine();
        if (line) {
            this.setCurrentLine(line, moveCursor);
        }
    }
    refreshListing() {
        // lookup corresponding sourcefile for this file, using listing
        var lst = ui_1.current_project.getListingForFile(this.path);
        if (lst && lst.sourcefile && lst.sourcefile !== this.sourcefile) {
            this.sourcefile = lst.sourcefile;
            this.dirtylisting = true;
        }
        if (!this.sourcefile || !this.dirtylisting)
            return;
        this.updateListing();
        this.dirtylisting = false;
    }
    refresh(moveCursor) {
        this.refreshListing();
        this.refreshDebugState(moveCursor);
    }
    tick() {
        this.refreshDebugState(false);
    }
    getLine(line) {
        return this.editor.state.doc.line(line).text;
    }
    getCurrentLine() {
        const pos = this.editor.state.selection.main.head;
        return this.editor.state.doc.lineAt(pos).number;
    }
    getCursorPC() {
        var line = this.getCurrentLine();
        while (this.sourcefile && line >= 0) {
            var pc = this.sourcefile.line2offset[line];
            if (pc >= 0)
                return pc;
            line--;
        }
        return -1;
    }
    undoStep() {
        (0, commands_1.undo)(this.editor);
    }
    getBreakpointPCs() {
        if (this.sourcefile == null)
            return [];
        const pcs = [];
        const bpField = this.editor.state.field(gutter_1.breakpointMarkers.field);
        const cursor = bpField.iter();
        while (cursor.value) {
            const line = this.editor.state.doc.lineAt(cursor.from).number;
            const pc = this.sourcefile.line2offset[line];
            if (pc >= 0)
                pcs.push(pc);
            cursor.next();
        }
        return pcs;
    }
    runToBreakpoints(state) {
        const pcs = this.getBreakpointPCs();
        if (pcs.length > 0) {
            (0, ui_1.runToPC)(pcs);
        }
        else {
            (0, ui_1.clearBreakpoint)();
        }
    }
}
exports.SourceEditor = SourceEditor;
///
const disasmWindow = 1024; // disassemble this many bytes around cursor
class DisassemblerView {
    createDiv(parent) {
        var div = document.createElement('div');
        div.setAttribute("class", "editor");
        parent.appendChild(div);
        this.newEditor(div);
        return div;
    }
    newEditor(parent) {
        this.disasmview = new view_1.EditorView({
            parent: parent,
            extensions: [
                (0, view_1.rectangularSelection)(),
                (0, view_1.crosshairCursor)(),
                state_1.EditorState.allowMultipleSelections.of(true),
                (0, view_1.drawSelection)(),
                (0, view_1.highlightActiveLine)(),
                (0, search_1.highlightSelectionMatches)(),
                debugHighlightTags ? debug_1.debugHighlightTagsTooltip : [],
                disassemblyTheme_1.disassemblyTheme,
                cobalt_1.cobalt,
                visuals_1.currentPc.field,
                state_1.EditorState.tabSize.of(8),
                state_1.EditorState.readOnly.of(true),
            ],
            // mode: 'z80', // TODO: pick correct one
        });
    }
    // TODO: too many globals
    refresh(moveCursor) {
        let state = ui_1.lastDebugState || ui_1.platform.saveState(); // TODO?
        let pc = state.c ? state.c.PC : 0;
        let curline = 0;
        let selline = 0;
        let addr2symbol = (ui_1.platform.debugSymbols && ui_1.platform.debugSymbols.addr2symbol) || {};
        // TODO: not perfect disassembler
        let disassemble = (start, len) => {
            // TODO: use pc2visits
            let s = "";
            let ofs = 0;
            while (ofs < len) {
                let a = (start + ofs) | 0;
                let disasm = ui_1.platform.disassemble(a, ui_1.platform.readAddress.bind(ui_1.platform));
                /* TODO: look thru all source files
                let srclinenum = sourcefile && this.sourcefile.offset2line[a];
                if (srclinenum) {
                  let srcline = getActiveEditor().getLine(srclinenum);
                  if (srcline && srcline.trim().length) {
                    s += "; " + srclinenum + ":\t" + srcline + "\n";
                    curline++;
                  }
                }
                */
                let bytes = "";
                let comment = "";
                for (let i = 0; i < disasm.nbytes; i++)
                    bytes += (0, util_1.hex)(ui_1.platform.readAddress(a + i));
                while (bytes.length < 14)
                    bytes += ' ';
                let dstr = disasm.line;
                if (addr2symbol && disasm.isaddr) { // TODO: move out
                    dstr = dstr.replace(/([^#])[$]([0-9A-F]+)/, (substr, ...args) => {
                        let addr = parseInt(args[1], 16);
                        let sym = addr2symbol[addr];
                        if (sym)
                            return (args[0] + sym);
                        sym = addr2symbol[addr - 1];
                        if (sym)
                            return (args[0] + sym + "+1");
                        return substr;
                    });
                }
                if (addr2symbol) {
                    let sym = addr2symbol[a];
                    if (sym) {
                        comment = "; " + sym;
                    }
                }
                let dline = (0, util_1.hex)(a, 4) + "\t" + (0, util_1.rpad)(bytes, 14) + "\t" + (0, util_1.rpad)(dstr, 30) + comment + "\n";
                s += dline;
                if (a == pc)
                    selline = curline;
                curline++;
                ofs += disasm.nbytes || 1;
            }
            return s;
        };
        var startpc = pc < 0 ? pc - disasmWindow : Math.max(0, pc - disasmWindow); // for 32-bit PCs w/ hi bit set
        let text = disassemble(startpc, pc - startpc) + disassemble(pc, disasmWindow);
        this.disasmview.dispatch({
            changes: { from: 0, to: this.disasmview.state.doc.length, insert: text }
        });
        if (moveCursor) {
            const line = this.disasmview.state.doc.line(selline + 1);
            this.disasmview.dispatch({
                selection: { anchor: line.from, head: line.from },
                effects: view_1.EditorView.scrollIntoView(line.from, { y: "center" }),
            });
        }
    }
    getCursorPC() {
        const pos = this.disasmview.state.selection.main.head;
        const lineNum = this.disasmview.state.doc.lineAt(pos).number;
        if (lineNum >= 0) {
            const lineText = this.disasmview.state.doc.line(lineNum).text;
            const toks = lineText.trim().split(/\s+/);
            if (toks && toks.length >= 1) {
                const pc = parseInt(toks[0], 16);
                console.log("getCursorPC", pc);
                if (pc >= 0)
                    return pc;
            }
        }
        return -1;
    }
}
exports.DisassemblerView = DisassemblerView;
///
class ListingView extends DisassemblerView {
    constructor(lstfn) {
        super();
        this.path = lstfn;
    }
    refreshListing() {
        // lookup corresponding assemblyfile for this file, using listing
        var lst = ui_1.current_project.getListingForFile(this.path);
        // TODO?
        this.assemblyfile = lst && (lst.assemblyfile || lst.sourcefile);
    }
    refresh(moveCursor) {
        this.refreshListing();
        // load listing text into editor
        if (!this.assemblyfile)
            return;
        var asmtext = this.assemblyfile.text;
        // TODO: sometimes it picks one without a text file
        this.disasmview.dispatch({
            changes: { from: 0, to: this.disasmview.state.doc.length, insert: asmtext }
        });
        // go to PC
        if (!ui_1.platform.saveState)
            return;
        var state = ui_1.lastDebugState || ui_1.platform.saveState();
        var pc = state.c ? (state.c.EPC || state.c.PC) : 0;
        if (pc >= 0 && this.assemblyfile) {
            var res = this.assemblyfile.findLineForOffset(pc, exports.PC_LINE_LOOKAHEAD);
            if (res) {
                // set cursor while debugging
                if (moveCursor) {
                    const line = this.disasmview.state.doc.line(res.line);
                    this.disasmview.dispatch({
                        selection: { anchor: line.from, head: line.from },
                        effects: view_1.EditorView.scrollIntoView(line.from, { y: "center" }),
                    });
                }
            }
        }
    }
}
exports.ListingView = ListingView;
//# sourceMappingURL=editors.js.map