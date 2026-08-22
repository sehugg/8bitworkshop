import { defaultKeymap, history, historyKeymap, isolateHistory, redo, undo } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, foldGutter, indentOnInput, indentService, indentUnit } from "@codemirror/language";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { EditorState, Extension, StateEffect, StateField } from "@codemirror/state";
import { crosshairCursor, drawSelection, dropCursor, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, rectangularSelection, ViewUpdate } from "@codemirror/view";
import { CodeAnalyzer } from "../../common/analysis";
import { ProbeFlags, ProbeRecorder } from "../../common/probe";
import { getFilenameForPath, getFolderForPath, hex, rpad } from "../../common/util";
import { getIncludeDirs, getIncludePatterns, getLinkPatterns, getSharedFileSystemName, getSystemIncludePatterns } from "../../common/toolmeta";
import { WorkerMessage } from "../../common/workertypes";
import { SourceFile, SourceLocation, WorkerError } from "../../common/workertypes";
import { asm6502 } from "../../parser/lang-6502";
import { basic } from "../../parser/lang-basic";
import { batariBasic } from "../../parser/lang-bataribasic";
import { dialog } from "../../parser/lang-dialog";
import { fastBasic } from "../../parser/lang-fastbasic";
import { inform6 } from "../../parser/lang-inform6";
import { verilog } from "../../parser/lang-verilog";
import { wiz } from "../../parser/lang-wiz";
import { asmZ80 } from "../../parser/lang-z80";
import { cobalt } from "../../themes/cobalt";
import { disassemblyTheme } from "../../themes/disassemblyTheme";
import { editorTheme } from "../../themes/editorTheme";
import { mbo } from "../../themes/mbo";
import { loadSettings, registerEditor, settingsExtensions } from "../settings";
import { asmSpacesKeymap } from "./tabs";
import { clearBreakpoint, current_project, lastDebugState, openHeaderFile, platform, qs, runToPC } from "../ui";
import { createAssetHeaderPlugin } from "./assetdecorations";
import { createIncludeLinkPlugin } from "./includedecorations";
import { isMobileDevice, ProjectView } from "./baseviews";
import { createTextTransformFilterEffect, textTransformFilterCompartment } from "./filters";
import { breakpointMarkers, bytes, clock, currentPcMarker, errorMarkers, offset, statusMarkers } from "./gutter";
import { currentPc, errorMessages, errorSpans, highlightLines, showValue, tracedLines } from "./visuals";

// look ahead this many bytes when finding source lines for a PC
export const PC_LINE_LOOKAHEAD = 64;

// Asset range tracking. Positions are automatically remapped through
// document changes (edits, undo, redo) by CodeMirror's transaction system.
const setAssetRangesEffect = StateEffect.define<{id: string, from: number, to: number}[]>();
const clearAssetRangesEffect = StateEffect.define<void>();

const assetRangesField = StateField.define<Map<string, {from: number, to: number}>>({
  create() { return new Map(); },
  update(ranges, tr) {
    let result = ranges;
    for (let e of tr.effects) {
      if (e.is(clearAssetRangesEffect)) {
        result = new Map();
      } else if (e.is(setAssetRangesEffect)) {
        if (result === ranges) result = new Map(ranges);
        for (let r of e.value) {
          result.set(r.id, { from: r.from, to: r.to });
        }
      }
    }
    if (!tr.changes.empty) {
      const mapped = new Map<string, {from: number, to: number}>();
      for (const [id, r] of result) {
        mapped.set(id, {
          from: tr.changes.mapPos(r.from, -1),
          to: tr.changes.mapPos(r.to, 1)
        });
      }
      return mapped;
    }
    return result;
  }
});

const MAX_ERRORS = 200;

const MODEDEFS = {
  default: { theme: mbo }, // NOTE: Not merged w/ other modes
  '6502': { isAsm: true },
  z80: { isAsm: true },
  jsasm: { isAsm: true },
  gas: { isAsm: true },
  vasm: { isAsm: true },
  inform6: { theme: cobalt },
  dialog: { theme: cobalt, lineWrap: true },
  markdown: { lineWrap: true },
  fastbasic: { noGutters: true },
  basic: { noGutters: true },
  ecs: { theme: mbo }, // TODO: is actually mixed-mode, as is verilog
}

export var textMapFunctions = {
  input: null as ((text: string) => string) | null
};

export function setUppercaseOnly(uppercaseOnly: boolean) {
  textMapFunctions.input = uppercaseOnly ? (s) => s.toUpperCase() : null;
}

export class SourceEditor implements ProjectView {
  // Whether to highlight recently-executed lines from live trace data.
  // Off by default (probing has a runtime cost); toggled via toolbar button.
  static tracingEnabled = false;

  constructor(path: string, mode: string) {
    this.path = path;
    this.mode = mode;
  }
  path: string;
  mode: string;
  editor;
  updateTimer = null;
  dirtylisting = true;
  sourcefile: SourceFile;
  currentDebugLine: SourceLocation;
  refreshDelayMsec = 300;
  probe: ProbeRecorder = null;

  createDiv(parent: HTMLElement) {
    var div = document.createElement('div');
    div.setAttribute("class", "editor");
    parent.appendChild(div);
    var text = current_project.getFile(this.path) as string;
    var asmOverride = text && this.mode == 'verilog' && /__asm\b([\s\S]+?)\b__endasm\b/.test(text);
    this.newEditor(div, text, asmOverride);
    this.editor.dispatch({
      effects: createTextTransformFilterEffect(textMapFunctions),
    });
    if (current_project.getToolForFilename(this.path).startsWith("remote:")) {
      this.refreshDelayMsec = 1000; // remote URLs get slower refresh
    }
    return div;
  }

  setVisible(showing: boolean): void {
    if (showing) {
      this.editor.focus(); // so that keyboard works when moving between files
      if (SourceEditor.tracingEnabled) this.startTracing();
    } else {
      this.stopTracing();
    }
  }

  startTracing() {
    if (!this.probe && platform.startProbing) {
      this.probe = platform.startProbing();
      this.probe.singleFrame = false; // accumulate between our polls, we clear it ourselves
      this.probe.clear();
    }
  }

  stopTracing() {
    if (this.probe) {
      platform.stopProbing();
      this.probe = null;
    }
    this.editor.dispatch({ effects: tracedLines.effect.of([]) });
  }

  setTracingEnabled(enabled: boolean) {
    SourceEditor.tracingEnabled = enabled;
    if (enabled) this.startTracing();
    else this.stopTracing();
  }

  newEditor(parent: HTMLElement, text: string, isAsmOverride?: boolean) {
    var modedef = MODEDEFS[this.mode] || MODEDEFS.default;
    var isAsm = isAsmOverride || modedef.isAsm;
    var lineWrap = !!modedef.lineWrap;
    var theme = modedef.theme || MODEDEFS.default.theme;
    var lineNums = modedef.useLineNumbers && !isMobileDevice;
    if (qs['embed']) {
      lineNums = false; // no line numbers while embedded
      isAsm = false; // no opcode bytes either
    }
    const minimalGutters = modedef.noGutters || isMobileDevice;

    var parser: Extension;
    switch (this.mode) {
      case '6502':
        parser = asm6502();
        break;
      case 'basic':
        parser = basic();
        break;
      case 'bataribasic':
        parser = batariBasic();
        break;
      case 'fastbasic':
        parser = fastBasic();
        break;
      case 'dialog':
        parser = dialog();
        break;
      case 'inform6':
        parser = inform6();
        break;
      case 'markdown':
        parser = markdown();
        break;
      case 'text/x-csrc':
        parser = cpp();
        break;
      case 'text/x-wiz':
        parser = wiz();
        break;
      case 'verilog':
        parser = verilog();
        break;
      case 'z80':
        parser = asmZ80();
        break;
      default:
        console.warn("Unknown mode: " + this.mode);
        break;
    }
    this.editor = new EditorView({
      parent: parent,
      doc: text,
      extensions: [

        // Non-asm: 2-space indent (placed before settings so it takes precedence over tabSize-based indentUnit)
        isAsm ? [] : indentUnit.of("  "),
        // Asm: copy previous line's indentation since asm parsers lack proper indent rules
        isAsm ? indentService.of((context, pos) => {
          let lineNum = context.state.doc.lineAt(pos).number;
          if (lineNum >= 0) {
            let prevLine = context.state.doc.line(lineNum);
            if (prevLine.text.trim()) {
              return context.lineIndent(prevLine.from);
            }
          }
          return 0;
        }) : [],

        // Asm files: tab/backspace work on inferred tab stops when
        // "insert spaces when pressing tab" is enabled. Placed before the
        // settings keymap so it takes precedence over indentMore/insertTab.
        ...(isAsm ? [keymap.of(asmSpacesKeymap(() => loadSettings().tabsToSpaces))] : []),
        // Keybindings from settings must appear before default keymap.
        ...settingsExtensions(loadSettings()),
        // https://codemirror.net/docs/ref/#commands.defaultKeymap includes
        // https://codemirror.net/docs/ref/#commands.standardKeymap
        keymap.of(defaultKeymap),

        lineNums ? lineNumbers() : [],

        // Undo history.
        history(),
        keymap.of(historyKeymap),

        // Code fold gutter.
        foldGutter(),

        dropCursor(),

        EditorState.allowMultipleSelections.of(true),
        drawSelection(),

        indentOnInput(),
        bracketMatching(),

        // Rectangular selection and crosshair cursor.
        rectangularSelection(),
        crosshairCursor(),

        highlightActiveLine(),
        highlightActiveLineGutter(),
        highlightSelectionMatches(),

        search({ top: true }),
        keymap.of(searchKeymap),

        // lintGutter(),
        // autocompletion(),

        parser || [],
        theme,
        editorTheme,
        lineWrap ? EditorView.lineWrapping : [],

        currentPc.field,

        !minimalGutters ? [
          offset.field,
          offset.gutter,
        ] : [],

        isAsm && !minimalGutters ? [
          bytes.field,
          bytes.gutter,

          clock.field,
          clock.gutter,
        ] : [],

        breakpointMarkers.field,
        statusMarkers.gutter,
        EditorView.updateListener.of(update => {
          for (let effect of update.transactions.flatMap(tr => tr.effects)) {
            if (effect.is(breakpointMarkers.set)) {
              if (platform.isRunning()) {
                this.runToBreakpoints(update.state);
              }
            }
            if (effect.is(currentPcMarker.runToLine)) {
              const lineNum = effect.value;
              if (this.sourcefile && this.sourcefile.line2offset) {
                const pc = this.sourcefile.line2offset[lineNum];
                if (pc >= 0) {
                  runToPC([pc]);
                }
              }
            }
          }
        }),

        errorMarkers.field,

        errorMessages.field,

        errorSpans.field,

        currentPcMarker.field,
        currentPcMarker.gutter,

        highlightLines.field,

        tracedLines.field,

        assetRangesField,

        createAssetHeaderPlugin((lineNumber: number) => {
          window.location.hash = 'asseteditor/' + encodeURIComponent(this.path) + '/' + lineNumber;
        }),

        // badges on include lines (#include, .include, ...) -> read-only view
        qs['embed'] ? [] : createIncludeLinkPlugin(
          () => {
            var tool = current_project && current_project.getToolForFilename(this.path);
            var platform_id = current_project && current_project.platform_id;
            return [...getIncludePatterns(tool, platform_id),
                    ...getLinkPatterns(tool, platform_id),
                    ...getSystemIncludePatterns(tool)];
          },
          (filename: string, system: boolean) => {
            // quoted includes: project files (presets/local) link to their own
            // editor window; fall through to the read-only viewer otherwise
            if (!system) {
              var path = resolveIncludeFile(filename);
              if (path) {
                window.location.hash = '#' + encodeURIComponent(path);
                return;
              }
            }
            // system headers (<foo.h>) and unresolved files: toolchain
            // filesystem via the read-only viewer
            openHeaderFile(filename);
          },
        ),

        textTransformFilterCompartment.of([]),

        // update file in project (and recompile) when edits made
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            this.editorChanged();
          }
        }),

        // inspect symbol when it's highlighted (double-click)
        showValue.field,
        EditorView.updateListener.of(update => {
          if (update.selectionSet) {
            this.inspectUnderCursor(update);
          }
        }),
      ],
    });
    // TODO: unregister when editor is destroyed
    registerEditor(this.editor);
  }

  editorChanged() {
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      current_project.updateFile(this.path, this.editor.state.doc.toString());
    }, this.refreshDelayMsec);
  }

  flushChanges() {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
      current_project.updateFile(this.path, this.editor.state.doc.toString());
    }
  }

  inspectUnderCursor(update: ViewUpdate) {
    // TODO: handle multi-select
    const range = update.state.selection.main;
    const selectedText = update.state.sliceDoc(range.from, range.to).trim();

    var result;
    if (platform.inspect) {
      result = platform.inspect(selectedText);
    }

    if (!range.empty && result && result.length < 80) {
      update.view.dispatch({
        effects: showValue.effect.of({ range: range, val: result })
      });
    } else {
      update.view.dispatch({
        effects: showValue.effect.of(null)
      });
    }
  }

  setText(text: string) {
    var oldtext = this.editor.state.doc.toString();
    if (oldtext != text) {
      this.editor.dispatch({
        changes: { from: 0, to: this.editor.state.doc.length, insert: text },
        annotations: isolateHistory.of("full")
      });
    }
  }

  replaceTextRange(from: number, to: number, text: string) {
    const lineStart = this.editor.state.doc.lineAt(from).from;
    this.editor.dispatch({
      changes: { from, to, insert: text },
      annotations: isolateHistory.of("full"),
      selection: { anchor: from + text.length, head: from },
      effects: [
        EditorView.scrollIntoView(lineStart, { y: "start", yMargin: 100/*pixels*/ }),
      ]
    });
  }

  setAssetRange(id: string, from: number, to: number) {
    this.editor.dispatch({
      effects: setAssetRangesEffect.of([{ id, from, to }])
    });
  }

  getAssetText(id: string): string | null {
    var range = this.editor.state.field(assetRangesField).get(id);
    if (!range) return null;
    return this.editor.state.doc.sliceString(range.from, range.to);
  }

  replaceAssetText(id: string, text: string) {
    var range = this.editor.state.field(assetRangesField).get(id);
    if (!range) return;
    this.replaceTextRange(range.from, range.to, text);
  }

  clearAssetRanges() {
    this.editor.dispatch({
      effects: clearAssetRangesEffect.of(undefined)
    });
  }

  insertLinesBefore(text: string) {
    const pos = this.editor.state.selection.main.from;
    const lineNum = this.editor.state.doc.lineAt(pos).number;
    const lineFrom = this.editor.state.doc.lineAt(pos).from;
    const insertedLineCount = text.split("\n").length - 1;
    this.editor.dispatch({
      changes: { from: lineFrom, insert: text },
    });
    this.highlightLines(lineNum - 1, lineNum + insertedLineCount - 2);
  }

  highlightLines(start: number, end: number) {
    const startLine = this.editor.state.doc.line(start + 1);
    this.editor.dispatch({
      effects: [
        highlightLines.effect.of({ start: start + 1, end: end + 1 }),
        EditorView.scrollIntoView(startLine.from, { y: "start", yMargin: 100/*pixels*/ }),
      ]
    });
  }

  navigateToLine(line: number) {
    if (line < 1 || line > this.editor.state.doc.lines) return;
    const targetLine = this.editor.state.doc.line(line);
    this.editor.dispatch({
      selection: { anchor: targetLine.from },
      effects: [
        highlightLines.effect.of({ start: line, end: line }),
        EditorView.scrollIntoView(targetLine.from, { y: "center" }),
      ],
    });
    this.editor.focus();
  }

  getValue(): string {
    return this.editor.state.doc.toString();
  }

  getPath(): string { return this.path; }

  markErrors(errors: WorkerError[]) {
    // TODO: move cursor to error line if offscreen?
    this.clearErrors();
    errors = errors.slice(0, MAX_ERRORS);
    const newErrors = new Map<number, string>();
    const spans: { line: number, start: number, end: number }[] = [];
    for (var info of errors) {
      // only mark errors with this filename, or without any filename
      if (!info.path || this.path.endsWith(info.path)) {
        var numLines = this.editor.state.doc.lines;
        var line = info.line;
        if (isNaN(line) || line < 1 || line > numLines) line = 1;
        newErrors.set(line, info.msg);
        // collect column-level spans
        if (info.start != null && info.end != null && info.end > info.start) {
          spans.push({ line, start: info.start, end: info.end });
        }
      }
    }
    this.editor.dispatch({
      effects: [
        errorMarkers.set.of(newErrors),
        errorSpans.effect.of(spans.length > 0 ? spans : null),
      ],
    });
  }

  clearErrors() {
    this.dirtylisting = true;
    this.editor.dispatch({
      effects: [
        errorMarkers.set.of(new Map()),
        errorMarkers.showMessage.of(null),
        errorSpans.effect.of(null),
      ],
    });
  }

  getSourceFile(): SourceFile { return this.sourcefile; }

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
        newOffsets.set(info.line, hex(info.offset & 0xffff, 4));
      }
      if (info.insns) {
        var insnstr = info.insns.length > 9 ? ("...") : info.insns;
        newBytes.set(info.line, insnstr);
        if (info.iscode) {
          // TODO: labels trick this part?
          if (info.cycles) {
            newClocks.set(info.line, info.cycles + "");
          } else if (platform.getOpcodeMetadata) {
            var opcode = parseInt(info.insns.split(" ")[0], 16);
            var meta = platform.getOpcodeMetadata(opcode, info.offset);
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
        offset.set.of(newOffsets),
        bytes.set.of(newBytes),
        clock.set.of(newClocks),
      ],
    });
  }

  setTimingResult(result: CodeAnalyzer): void {
    if (this.sourcefile == null) return;
    var newBytes = new Map<number, string>();
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
        bytes.set.of(newBytes),
      ],
    });
  }

  setCurrentLine(line: SourceLocation, moveCursor: boolean) {
    var addCurrentMarker = (line: SourceLocation) => {
      this.editor.dispatch({
        effects: [
          currentPcMarker.set.of(line.line),
          currentPc.effect.of(line.line),
          // Follow the execution point when stepping/hitting breakpoints.
          ...(moveCursor ? [EditorView.scrollIntoView(this.editor.state.doc.line(line.line).from, { y: "center" })] : []),
        ]
      });
    }

    this.clearCurrentLine(moveCursor);
    if (line) {
      // Validate line number is within document range (TODO: open disassembler)
      if (line.line < 1 || line.line > this.editor.state.doc.lines) {
        return;
      }
      addCurrentMarker(line);
      if (moveCursor) {
        const targetLine = this.editor.state.doc.line(line.line);
        const pos = targetLine.from + (line.start || 0);
        this.editor.dispatch({
          selection: { anchor: pos, head: pos },
          effects: EditorView.scrollIntoView(pos, { y: "center" })
        });
      }
      this.currentDebugLine = line;
    }
  }

  clearCurrentLine(moveCursor: boolean) {
    if (this.currentDebugLine) {
      if (moveCursor) {
        const pos = this.editor.state.selection.main.head;
        this.editor.dispatch({ selection: { anchor: pos, head: pos } });
      }
      this.currentDebugLine = null;
    }
    this.editor.dispatch({
      effects: [
        currentPcMarker.set.of(null),
        currentPc.effect.of(null),
      ]
    });
  }

  getActiveLine(): SourceLocation {
    if (this.sourcefile) {
      var cpustate = lastDebugState && lastDebugState.c;
      if (!cpustate && platform.getCPUState && !platform.isRunning())
        cpustate = platform.getCPUState();
      if (cpustate) {
        var EPC = (cpustate && (cpustate.EPC || cpustate.PC));
        var res = this.sourcefile.findLineForOffset(EPC, PC_LINE_LOOKAHEAD);
        return res;
      }
    }
  }

  refreshDebugState(moveCursor: boolean) {
    var line = this.getActiveLine();
    if (!moveCursor && (line === this.currentDebugLine || (!line && !this.currentDebugLine))) {
      return;
    }

    this.setCurrentLine(line, moveCursor);
  }

  refreshListing() {
    // lookup corresponding sourcefile for this file, using listing
    var lst = current_project.getListingForFile(this.path);
    if (lst && lst.sourcefile && lst.sourcefile !== this.sourcefile) {
      this.sourcefile = lst.sourcefile;
      this.dirtylisting = true;
    }
    if (!this.sourcefile || !this.dirtylisting) return;
    this.updateListing();
    this.dirtylisting = false;
  }

  refresh(moveCursor: boolean) {
    this.refreshListing();
    this.refreshDebugState(moveCursor);
  }

  tick() {
    this.refreshDebugState(false);
    this.updateTracedLines();
  }

  updateTracedLines() {
    const p = this.probe;
    if (!p || !p.idx || !this.sourcefile) return;
    const lines = new Set<number>();
    for (let i = 0; i < p.idx; i++) {
      const word = p.buf[i];
      if ((word & 0xff000000) === ProbeFlags.EXECUTE) {
        const loc = this.sourcefile.findLineForOffset(word & 0xffff, PC_LINE_LOOKAHEAD);
        if (loc) lines.add(loc.line);
      }
    }
    p.clear();
    this.editor.dispatch({
      effects: tracedLines.effect.of(Array.from(lines)),
    });
  }

  getLine(line: number) {
    return this.editor.state.doc.line(line).text;
  }

  getCurrentLine(): number {
    const pos = this.editor.state.selection.main.head;
    return this.editor.state.doc.lineAt(pos).number;
  }

  getCursorPC(): number {
    var line = this.getCurrentLine();
    while (this.sourcefile && line >= 0) {
      var pc = this.sourcefile.line2offset[line];
      if (pc >= 0) return pc;
      line--;
    }
    return -1;
  }

  undoStep() {
    undo(this.editor);
  }

  redoStep() {
    redo(this.editor);
  }

  getBreakpointPCs(): number[] {
    if (this.sourcefile == null) return [];
    const pcs: number[] = [];
    const bpField = this.editor.state.field(breakpointMarkers.field);
    const cursor = bpField.iter();
    while (cursor.value) {
      const line = this.editor.state.doc.lineAt(cursor.from).number;
      const pc = this.sourcefile.line2offset[line];
      if (pc >= 0) pcs.push(pc);
      cursor.next();
    }
    return pcs;
  }

  runToBreakpoints(state: EditorState) {
    const pcs = this.getBreakpointPCs();
    if (pcs.length > 0) {
      runToPC(pcs);
    } else {
      clearBreakpoint();
    }
  }
}

///

const disasmWindow = 1024; // disassemble this many bytes around cursor

export class DisassemblerView implements ProjectView {
  disasmview: EditorView;

  createDiv(parent: HTMLElement) {
    var div = document.createElement('div');
    div.setAttribute("class", "editor");
    parent.appendChild(div);
    this.newEditor(div);
    return div;
  }

  newEditor(parent: HTMLElement) {
    this.disasmview = new EditorView({
      parent: parent,
      extensions: [
        rectangularSelection(),
        crosshairCursor(),
        EditorState.allowMultipleSelections.of(true),
        drawSelection(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        disassemblyTheme,
        cobalt,
        currentPc.field,
        EditorState.tabSize.of(8),
        EditorState.readOnly.of(true),
      ],
      // mode: 'z80', // TODO: pick correct one
    });
  }

  // TODO: too many globals
  refresh(moveCursor: boolean) {
    let state = lastDebugState || platform.saveState(); // TODO?
    let pc = state.c ? state.c.PC : 0;
    let curline = 0;
    let selline = 0;
    let addr2symbol = (platform.debugSymbols && platform.debugSymbols.addr2symbol) || {};
    // TODO: not perfect disassembler
    let disassemble = (start, len) => {
      // TODO: use pc2visits
      let s = "";
      let ofs = 0;
      while (ofs < len) {
        let a = (start + ofs) | 0;
        let disasm = platform.disassemble(a, platform.readAddress.bind(platform));
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
          bytes += hex(platform.readAddress(a + i));
        while (bytes.length < 14)
          bytes += ' ';
        let dstr = disasm.line;
        if (addr2symbol && disasm.isaddr) { // TODO: move out
          dstr = dstr.replace(/([^#])[$]([0-9A-F]+)/, (substr: string, ...args: any[]): string => {
            let addr = parseInt(args[1], 16);
            let sym = addr2symbol[addr];
            if (sym) return (args[0] + sym);
            sym = addr2symbol[addr - 1];
            if (sym) return (args[0] + sym + "+1");
            return substr;
          });
        }
        if (addr2symbol) {
          let sym = addr2symbol[a];
          if (sym) {
            comment = "; " + sym;
          }
        }
        let dline = hex(a, 4) + "\t" + rpad(bytes, 14) + "\t" + rpad(dstr, 30) + comment + "\n";
        s += dline;
        if (a == pc) selline = curline;
        curline++;
        ofs += disasm.nbytes || 1;
      }
      return s;
    }
    var startpc = pc < 0 ? pc - disasmWindow : Math.max(0, pc - disasmWindow); // for 32-bit PCs w/ hi bit set
    let text = disassemble(startpc, pc - startpc) + disassemble(pc, disasmWindow);
    this.disasmview.dispatch({
      changes: { from: 0, to: this.disasmview.state.doc.length, insert: text }
    })
    if (moveCursor) {
      const line = this.disasmview.state.doc.line(selline + 1);
      this.disasmview.dispatch({
        selection: { anchor: line.from, head: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      });
    }
  }

  getCursorPC(): number {
    const pos = this.disasmview.state.selection.main.head;
    const lineNum = this.disasmview.state.doc.lineAt(pos).number;
    if (lineNum >= 0) {
      const lineText = this.disasmview.state.doc.line(lineNum).text;
      const toks = lineText.trim().split(/\s+/);
      if (toks && toks.length >= 1) {
        const pc = parseInt(toks[0], 16);
        console.log("getCursorPC", pc);
        if (pc >= 0) return pc;
      }
    }
    return -1;
  }
}

///

export class ListingView extends DisassemblerView implements ProjectView {
  assemblyfile: SourceFile;
  path: string;

  constructor(lstfn: string) {
    super();
    this.path = lstfn;
  }

  refreshListing() {
    // lookup corresponding assemblyfile for this file, using listing
    var lst = current_project.getListingForFile(this.path);
    // TODO?
    this.assemblyfile = lst && (lst.assemblyfile || lst.sourcefile);
  }

  refresh(moveCursor: boolean) {
    this.refreshListing();
    // load listing text into editor
    if (!this.assemblyfile) return;
    var asmtext = this.assemblyfile.text;

    // TODO: sometimes it picks one without a text file
    this.disasmview.dispatch({
      changes: { from: 0, to: this.disasmview.state.doc.length, insert: asmtext }
    })
    // go to PC
    if (!platform.saveState) return;
    var state = lastDebugState || platform.saveState();
    var pc = state.c ? (state.c.EPC || state.c.PC) : 0;
    if (pc >= 0 && this.assemblyfile) {
      var res = this.assemblyfile.findLineForOffset(pc, PC_LINE_LOOKAHEAD);
      if (res) {
        // set cursor while debugging
        if (moveCursor) {
          const line = this.disasmview.state.doc.line(res.line);
          this.disasmview.dispatch({
            selection: { anchor: line.from, head: line.from },
            effects: EditorView.scrollIntoView(line.from, { y: "center" }),
          });
        }
      }
    }
  }

}

///

// Resolve an include filename (e.g. from `#include "foo.h"`) against the files
// loaded in the current project. Tries the bare filename, then relative to the
// main file's folder (same logic as CodeProject.pushAllFiles).
export function resolveIncludeFile(fn: string): string | null {
  let candidates = [fn];
  try {
    var dir = getFolderForPath(current_project.mainPath);
    if (dir.length > 0 && dir != 'local') candidates.push(dir + '/' + fn);
  } catch (e) {
    // no main path yet; bare filename only
  }
  for (var c of candidates) {
    var data = current_project && current_project.getFile(c);
    if (typeof data === 'string') return c;
  }
  return null;
}

// Look up an include file inside the toolchain's preload filesystem
// (e.g. /include/nes.h inside the cc65 package), via the worker.
// Results are cached per filesystem+filename.
const sharedFileCache = new Map<string, Promise<string | null>>();

export function lookupSharedFileText(fn: string): Promise<string | null> {
  const tool = current_project.getToolForFilename(current_project.mainPath);
  const fsName = getSharedFileSystemName(tool, current_project.platform_id);
  const dirs = getIncludeDirs(tool, current_project.platform_id);
  if (!fsName || !dirs.length) return Promise.resolve(null);
  const key = fsName + ':' + fn;
  if (!sharedFileCache.has(key)) {
    sharedFileCache.set(key, (async () => {
      // try the include under each known dir (e.g. /headers/vcs.h for "vcs.h"),
      // then the filename as-is (some includes already carry the dir,
      // e.g. "headers/vcs.h")
      var candidates = [...dirs.map(dir => dir + '/' + fn), fn];
      for (var path of candidates) {
        var msg = { preload_fs: fsName, readshared: path, updates: [], buildsteps: [] } as WorkerMessage;
        var result = await current_project.queryWorker(msg);
        var output = result && (result as any).output;
        if (output instanceof Uint8Array && output.length > 0) {
          return new TextDecoder().decode(output);
        }
      }
      return null;
    })());
  }
  return sharedFileCache.get(key);
}

// Read-only viewer for toolchain include files (headers inside the tool's
// preload filesystem), opened by clicking the badge next to an #include line.
// Project files are linked to their own editor windows instead.
// Each opened header gets its own window, id '#headerview/<filename>'.
export class HeaderView implements ProjectView {
  view: EditorView;
  currentPath: string;

  constructor(public fn?: string) {
  }

  createDiv(parent: HTMLElement) {
    var div = document.createElement('div');
    div.setAttribute("class", "editor");
    parent.appendChild(div);
    const parser: Extension = cpp();
    this.view = new EditorView({
      parent: div,
      extensions: [
        rectangularSelection(),
        crosshairCursor(),
        EditorState.allowMultipleSelections.of(true),
        drawSelection(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        search({ top: true }),
        keymap.of(searchKeymap),
        parser,
        mbo,
        editorTheme,
        EditorState.readOnly.of(true),
      ],
    });
    this.refresh(false);
    return div;
  }

  setVisible(showing: boolean) {
    if (showing) this.refresh(false);
  }

  setHeaderText(text: string) {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: text }
    });
  }

  refresh(moveCursor: boolean) {
    var fn = this.fn;
    if (!fn) {
      // direct hash navigation: get filename from #headerview/<filename>
      var hash = window.location.hash;
      if (!hash || !hash.startsWith('#headerview/')) return;
      fn = this.fn = decodeURIComponent(hash.substring('#headerview/'.length));
    }
    this.loadIncludeFile(fn);
  }

  async loadIncludeFile(fn: string) {
    this.requestedFn = fn;
    // 1) project files (local storage / presets)
    var path = resolveIncludeFile(fn);
    if (path) {
      this.currentPath = path;
      this.setHeaderText(current_project.getFile(path) as string);
      return;
    }
    // 2) toolchain preload filesystem (via worker)
    var text = await lookupSharedFileText(fn);
    if (this.requestedFn !== fn) return; // a newer request superseded us
    if (text != null) {
      this.currentPath = fn;
      this.setHeaderText(text);
      return;
    }
    // not found
    this.currentPath = fn;
    this.setHeaderText('// ' + fn + ' was not found.\n'
      + '// Project include files are loaded during a build -- try building first.\n'
      + '// Toolchain headers are only available when the tool has a bundled filesystem.');
  }
  // track the most recent request so stale async lookups don't overwrite it
  private requestedFn: string;
}
