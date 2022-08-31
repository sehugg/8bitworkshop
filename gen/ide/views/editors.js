"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingView = exports.DisassemblerView = exports.SourceEditor = exports.textMapFunctions = exports.PC_LINE_LOOKAHEAD = void 0;
const baseviews_1 = require("./baseviews");
const ui_1 = require("../ui");
const util_1 = require("../../common/util");
// helper function for editor
function jumpToLine(ed, i) {
    var t = ed.charCoords({ line: i, ch: 0 }, "local").top;
    var middleHeight = ed.getScrollerElement().offsetHeight / 2;
    ed.scrollTo(null, t - middleHeight - 5);
}
function createTextSpan(text, className) {
    var span = document.createElement("span");
    span.setAttribute("class", className);
    span.appendChild(document.createTextNode(text));
    return span;
}
/////
// look ahead this many bytes when finding source lines for a PC
exports.PC_LINE_LOOKAHEAD = 64;
const MAX_ERRORS = 200;
const MODEDEFS = {
    default: { theme: 'mbo' },
    '6502': { isAsm: true },
    z80: { isAsm: true },
    jsasm: { isAsm: true },
    gas: { isAsm: true },
    vasm: { isAsm: true },
    inform6: { theme: 'cobalt' },
    markdown: { lineWrap: true },
    fastbasic: { noGutters: true },
    basic: { noLineNumbers: true, noGutters: true },
    ecs: { theme: 'mbo', isAsm: true },
};
exports.textMapFunctions = {
    input: null
};
class SourceEditor {
    constructor(path, mode) {
        this.updateTimer = null;
        this.dirtylisting = true;
        this.errormsgs = [];
        this.errorwidgets = [];
        this.errormarks = [];
        this.path = path;
        this.mode = mode;
    }
    createDiv(parent) {
        var div = document.createElement('div');
        div.setAttribute("class", "editor");
        parent.appendChild(div);
        var text = ui_1.current_project.getFile(this.path);
        var asmOverride = text && this.mode == 'verilog' && /__asm\b([\s\S]+?)\b__endasm\b/.test(text);
        this.newEditor(div, asmOverride);
        if (text) {
            this.setText(text); // TODO: this calls setCode() and builds... it shouldn't
            this.editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 0 }, { scroll: true }); // move cursor to start
        }
        this.setupEditor();
        return div;
    }
    setVisible(showing) {
        if (showing) {
            this.editor.focus(); // so that keyboard works when moving between files
        }
    }
    newEditor(parent, isAsmOverride) {
        var modedef = MODEDEFS[this.mode] || MODEDEFS.default;
        var isAsm = isAsmOverride || modedef.isAsm;
        var lineWrap = !!modedef.lineWrap;
        var theme = modedef.theme || MODEDEFS.default.theme;
        var lineNums = !modedef.noLineNumbers && !baseviews_1.isMobileDevice;
        if (ui_1.qs['embed']) {
            lineNums = false; // no line numbers while embedded
            isAsm = false; // no opcode bytes either
        }
        var gutters = ["CodeMirror-linenumbers", "gutter-offset", "gutter-info"];
        if (isAsm)
            gutters = ["CodeMirror-linenumbers", "gutter-offset", "gutter-bytes", "gutter-clock", "gutter-info"];
        if (modedef.noGutters || baseviews_1.isMobileDevice)
            gutters = ["gutter-info"];
        this.editor = CodeMirror(parent, {
            theme: theme,
            lineNumbers: lineNums,
            matchBrackets: true,
            tabSize: 8,
            indentAuto: true,
            lineWrapping: lineWrap,
            gutters: gutters
        });
    }
    editorChanged() {
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            ui_1.current_project.updateFile(this.path, this.editor.getValue());
        }, 300);
        if (this.markHighlight) {
            this.markHighlight.clear();
            this.markHighlight = null;
        }
    }
    setupEditor() {
        // update file in project (and recompile) when edits made
        this.editor.on('changes', (ed, changeobj) => {
            this.editorChanged();
        });
        // inspect symbol when it's highlighted (double-click)
        this.editor.on('cursorActivity', (ed) => {
            this.inspectUnderCursor();
        });
        // gutter clicked
        this.editor.on("gutterClick", (cm, n) => {
            this.toggleBreakpoint(n);
        });
        // set editor mode for highlighting, etc
        this.editor.setOption("mode", this.mode);
        // change text?
        this.editor.on('beforeChange', (cm, chgobj) => {
            if (exports.textMapFunctions.input && chgobj.text)
                chgobj.text = chgobj.text.map(exports.textMapFunctions.input);
        });
    }
    inspectUnderCursor() {
        var start = this.editor.getCursor(true);
        var end = this.editor.getCursor(false);
        if (start.line == end.line && start.ch < end.ch && end.ch - start.ch < 80) {
            var name = this.editor.getSelection();
            this.inspect(name);
        }
        else {
            this.inspect(null);
        }
    }
    inspect(ident) {
        var result;
        if (ui_1.platform.inspect) {
            result = ui_1.platform.inspect(ident);
        }
        if (this.inspectWidget) {
            this.inspectWidget.clear();
            this.inspectWidget = null;
        }
        if (result) {
            var infospan = createTextSpan(result, "tooltipinfoline");
            var line = this.editor.getCursor().line;
            this.inspectWidget = this.editor.addLineWidget(line, infospan, { above: false });
        }
    }
    setText(text) {
        var i, j;
        var oldtext = this.editor.getValue();
        if (oldtext != text) {
            this.editor.setValue(text);
            /*
            // find minimum range to undo
            for (i=0; i<oldtext.length && i<text.length && text[i] == oldtext[i]; i++) { }
            for (j=0; j<oldtext.length && j<text.length && text[text.length-1-j] == oldtext[oldtext.length-1-j]; j++) { }
            //console.log(i,j,oldtext.substring(i,oldtext.length-j));
            this.replaceSelection(i, oldtext.length-j, text.substring(i, text.length-j)); // calls setCode()
            */
            // clear history if setting empty editor
            if (oldtext == '') {
                this.editor.clearHistory();
            }
        }
    }
    insertText(text) {
        var cur = this.editor.getCursor();
        this.editor.replaceRange(text, cur, cur);
    }
    highlightLines(start, end) {
        //this.editor.setSelection({line:start, ch:0}, {line:end, ch:0});
        var cls = 'hilite-span';
        var markOpts = { className: cls, inclusiveLeft: true };
        this.markHighlight = this.editor.markText({ line: start, ch: 0 }, { line: end, ch: 0 }, markOpts);
        this.editor.scrollIntoView({ from: { line: start, ch: 0 }, to: { line: end, ch: 0 } });
    }
    replaceSelection(start, end, text) {
        this.editor.setSelection(this.editor.posFromIndex(start), this.editor.posFromIndex(end));
        this.editor.replaceSelection(text);
    }
    getValue() {
        return this.editor.getValue();
    }
    getPath() { return this.path; }
    addError(info) {
        // only mark errors with this filename, or without any filename
        if (!info.path || this.path.endsWith(info.path)) {
            var numLines = this.editor.lineCount();
            var line = info.line - 1;
            if (isNaN(line) || line < 0 || line >= numLines)
                line = 0;
            this.addErrorMarker(line, info.msg);
            if (info.start != null) {
                var markOpts = { className: "mark-error", inclusiveLeft: true };
                var start = { line: line, ch: info.end ? info.start : info.start - 1 };
                var end = { line: line, ch: info.end ? info.end : info.start };
                var mark = this.editor.markText(start, end, markOpts);
                this.errormarks.push(mark);
            }
        }
    }
    addErrorMarker(line, msg) {
        var div = document.createElement("div");
        div.setAttribute("class", "tooltipbox tooltiperror");
        div.appendChild(document.createTextNode("\u24cd"));
        this.editor.setGutterMarker(line, "gutter-info", div);
        this.errormsgs.push({ line: line, msg: msg });
        // expand line widgets when mousing over errors
        $(div).mouseover((e) => {
            this.expandErrors();
        });
    }
    addErrorLine(line, msg) {
        var errspan = createTextSpan(msg, "tooltiperrorline");
        this.errorwidgets.push(this.editor.addLineWidget(line, errspan));
    }
    expandErrors() {
        var e;
        while (e = this.errormsgs.shift()) {
            this.addErrorLine(e.line, e.msg);
        }
    }
    markErrors(errors) {
        // TODO: move cursor to error line if offscreen?
        this.clearErrors();
        errors = errors.slice(0, MAX_ERRORS);
        for (var info of errors) {
            this.addError(info);
        }
    }
    clearErrors() {
        this.dirtylisting = true;
        // clear line widgets
        this.editor.clearGutter("gutter-info");
        this.errormsgs = [];
        while (this.errorwidgets.length)
            this.errorwidgets.shift().clear();
        while (this.errormarks.length)
            this.errormarks.shift().clear();
    }
    getSourceFile() { return this.sourcefile; }
    updateListing() {
        // update editor annotations
        // TODO: recreate editor if gutter-bytes is used (verilog)
        this.clearErrors();
        this.editor.clearGutter("gutter-bytes");
        this.editor.clearGutter("gutter-offset");
        this.editor.clearGutter("gutter-clock");
        var lstlines = this.sourcefile.lines || [];
        for (var info of lstlines) {
            //if (info.path && info.path != this.path) continue;
            if (info.offset >= 0) {
                this.setGutter("gutter-offset", info.line - 1, (0, util_1.hex)(info.offset & 0xffff, 4));
            }
            if (info.insns) {
                var insnstr = info.insns.length > 9 ? ("...") : info.insns;
                this.setGutter("gutter-bytes", info.line - 1, insnstr);
                if (info.iscode) {
                    // TODO: labels trick this part?
                    if (info.cycles) {
                        this.setGutter("gutter-clock", info.line - 1, info.cycles + "");
                    }
                    else if (ui_1.platform.getOpcodeMetadata) {
                        var opcode = parseInt(info.insns.split(" ")[0], 16);
                        var meta = ui_1.platform.getOpcodeMetadata(opcode, info.offset);
                        if (meta && meta.minCycles) {
                            var clockstr = meta.minCycles + "";
                            this.setGutter("gutter-clock", info.line - 1, clockstr);
                        }
                    }
                }
            }
        }
    }
    setGutter(type, line, text) {
        var lineinfo = this.editor.lineInfo(line);
        if (lineinfo && lineinfo.gutterMarkers && lineinfo.gutterMarkers[type]) {
            // do not replace existing marker
        }
        else {
            var textel = document.createTextNode(text);
            this.editor.setGutterMarker(line, type, textel);
        }
    }
    setGutterBytes(line, s) {
        this.setGutter("gutter-bytes", line - 1, s);
    }
    setTimingResult(result) {
        this.editor.clearGutter("gutter-bytes");
        if (this.sourcefile == null)
            return;
        // show the lines
        for (const line of Object.keys(this.sourcefile.line2offset)) {
            var pc = this.sourcefile.line2offset[line];
            var minclocks = result.pc2minclocks[pc];
            var maxclocks = result.pc2maxclocks[pc];
            if (minclocks >= 0 && maxclocks >= 0) {
                var s;
                if (maxclocks == minclocks)
                    s = minclocks + "";
                else
                    s = minclocks + "-" + maxclocks;
                if (maxclocks == result.MAX_CLOCKS)
                    s += "+";
                this.setGutterBytes(parseInt(line), s);
            }
        }
    }
    setCurrentLine(line, moveCursor) {
        var blocked = ui_1.platform.isBlocked && ui_1.platform.isBlocked();
        var addCurrentMarker = (line) => {
            var div = document.createElement("div");
            var cls = blocked ? 'currentpc-marker-blocked' : 'currentpc-marker';
            div.classList.add(cls);
            div.appendChild(document.createTextNode("\u25b6"));
            this.editor.setGutterMarker(line.line - 1, "gutter-info", div);
        };
        this.clearCurrentLine(moveCursor);
        if (line) {
            addCurrentMarker(line);
            if (moveCursor) {
                this.editor.setCursor({ line: line.line - 1, ch: line.start || 0 }, { scroll: true });
            }
            var cls = blocked ? 'currentpc-span-blocked' : 'currentpc-span';
            var markOpts = { className: cls, inclusiveLeft: true };
            if (line.start || line.end)
                this.markCurrentPC = this.editor.markText({ line: line.line - 1, ch: line.start }, { line: line.line - 1, ch: line.end || line.start + 1 }, markOpts);
            else
                this.markCurrentPC = this.editor.markText({ line: line.line - 1, ch: 0 }, { line: line.line, ch: 0 }, markOpts);
            this.currentDebugLine = line;
        }
    }
    clearCurrentLine(moveCursor) {
        if (this.currentDebugLine) {
            this.editor.clearGutter("gutter-info");
            if (moveCursor)
                this.editor.setSelection(this.editor.getCursor());
            this.currentDebugLine = null;
        }
        if (this.markCurrentPC) {
            this.markCurrentPC.clear();
            this.markCurrentPC = null;
        }
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
        return this.editor.getLine(line - 1);
    }
    getCurrentLine() {
        return this.editor.getCursor().line + 1;
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
        this.editor.execCommand('undo');
    }
    toggleBreakpoint(lineno) {
        // TODO: we have to always start at beginning of frame
        if (this.sourcefile != null) {
            var targetPC = this.sourcefile.line2offset[lineno + 1];
            /*
            var bpid = "pc" + targetPC;
            if (platform.hasBreakpoint(bpid)) {
              platform.clearBreakpoint(bpid);
            } else {
              platform.setBreakpoint(bpid, () => {
                return platform.getPC() == targetPC;
              });
            }
            */
            (0, ui_1.runToPC)(targetPC);
        }
    }
}
exports.SourceEditor = SourceEditor;
///
const disasmWindow = 1024; // disassemble this many bytes around cursor
class DisassemblerView {
    getDisasmView() { return this.disasmview; }
    createDiv(parent) {
        var div = document.createElement('div');
        div.setAttribute("class", "editor");
        parent.appendChild(div);
        this.newEditor(div);
        return div;
    }
    newEditor(parent) {
        this.disasmview = CodeMirror(parent, {
            mode: 'z80',
            theme: 'cobalt',
            tabSize: 8,
            readOnly: true,
            styleActiveLine: true
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
        this.disasmview.setValue(text);
        if (moveCursor) {
            this.disasmview.setCursor(selline, 0);
        }
        jumpToLine(this.disasmview, selline);
    }
    getCursorPC() {
        var line = this.disasmview.getCursor().line;
        if (line >= 0) {
            var toks = this.disasmview.getLine(line).trim().split(/\s+/);
            if (toks && toks.length >= 1) {
                var pc = parseInt(toks[0], 16);
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
        var disasmview = this.getDisasmView();
        // TODO: sometimes it picks one without a text file
        disasmview.setValue(asmtext);
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
                    disasmview.setCursor(res.line - 1, 0);
                }
                jumpToLine(disasmview, res.line - 1);
            }
        }
    }
}
exports.ListingView = ListingView;
//# sourceMappingURL=editors.js.map