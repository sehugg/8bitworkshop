import { closeBrackets, deleteBracketPair } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab, undo } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, foldGutter, indentOnInput, indentUnit } from "@codemirror/language";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { EditorState, Extension } from "@codemirror/state";
import { crosshairCursor, drawSelection, dropCursor, EditorView, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers, rectangularSelection, ViewUpdate } from "@codemirror/view";
import { CodeAnalyzer } from "../../common/analysis";
import { hex, rpad } from "../../common/util";
import { SourceFile, SourceLocation, WorkerError } from "../../common/workertypes";
import { asm6502 } from "../../parser/lang-6502";
import { basic } from "../../parser/lang-basic";
import { batariBasic } from "../../parser/lang-bataribasic";
import { fastBasic } from "../../parser/lang-fastbasic";
import { inform6 } from "../../parser/lang-inform6";
import { verilog } from "../../parser/lang-verilog";
import { wiz } from "../../parser/lang-wiz";
import { asmZ80 } from "../../parser/lang-z80";
import { cobalt } from "../../themes/cobalt";
import { disassemblyTheme } from "../../themes/disassemblyTheme";
import { editorTheme } from "../../themes/editorTheme";
import { mbo } from "../../themes/mbo";
import { current_project, lastDebugState, platform, qs, runToPC } from "../ui";
import { isMobileDevice, ProjectView } from "./baseviews";
import { debugHighlightTagsTooltip } from "./debug";
import { createTextTransformFilterEffect, textTransformFilterCompartment } from "./filters";
import { breakpointMarkers, bytes, clock, currentPcMarker, errorMarkers, offset } from "./gutter";
import { currentPc, errorMessages, highlightLines, showValue } from "./visuals";

// TODO: make this an easily toggleable debug setting.
// Debug syntax highlighting. Useful when developing new parsers and themes.
const debugHighlightTags = false;


/////

// look ahead this many bytes when finding source lines for a PC
export const PC_LINE_LOOKAHEAD = 64;

const MAX_ERRORS = 200;

const MODEDEFS = {
  default: { theme: mbo }, // NOTE: Not merged w/ other modes
  '6502': { isAsm: true },
  z80: { isAsm: true },
  jsasm: { isAsm: true },
  gas: { isAsm: true },
  vasm: { isAsm: true },
  inform6: { theme: cobalt },
  markdown: { lineWrap: true },
  fastbasic: { noGutters: true },
  basic: { noLineNumbers: true, noGutters: true }, // TODO: not used?
  ecs: { theme: mbo, isAsm: true },
}

export var textMapFunctions = {
  input: null as ((text: string) => string) | null
};

export class SourceEditor implements ProjectView {
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
    }
  }

  newEditor(parent: HTMLElement, text: string, isAsmOverride?: boolean) {
    var modedef = MODEDEFS[this.mode] || MODEDEFS.default;
    var isAsm = isAsmOverride || modedef.isAsm;
    var lineWrap = !!modedef.lineWrap;
    var theme = modedef.theme || MODEDEFS.default.theme;
    var lineNums = !modedef.noLineNumbers && !isMobileDevice;
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

        // Custom keybindings must appear before default keybindings.
        keymap.of([
          { key: "Backspace", run: deleteBracketPair },
        ]),
        keymap.of(defaultKeymap),

        lineNums ? lineNumbers() : [],

        highlightSpecialChars(),

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
        closeBrackets(),

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
        debugHighlightTags ? debugHighlightTagsTooltip : [],
        EditorState.tabSize.of(8),
        indentUnit.of("        "),
        keymap.of([indentWithTab]),
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
        breakpointMarkers.gutter,
        EditorView.updateListener.of(update => {
          for (let effect of update.transactions.flatMap(tr => tr.effects)) {
            if (effect.is(breakpointMarkers.set) && effect.value != null) {
              this.toggleBreakpoint(effect.value - 1);
            }
          }
        }),

        errorMarkers.field,
        errorMarkers.gutter,
        errorMarkers.shownLinesField,
        errorMessages.field,

        currentPcMarker.field,
        currentPcMarker.gutter,

        highlightLines.field,

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
  }

  editorChanged() {
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      current_project.updateFile(this.path, this.editor.state.doc.toString());
    }, this.refreshDelayMsec);
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
        effects: showValue.effect.of({ pos: range.to, val: result })
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
        changes: { from: 0, to: this.editor.state.doc.length, insert: text }
      });
    }
  }

  insertText(text: string) {
    const main = this.editor.state.selection.main;
    this.editor.dispatch({
      changes: { from: main.from, to: main.to, insert: text },
      selection: { anchor: main.from + text.length },
      userEvent: "input.paste"
    });
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

  getValue(): string {
    return this.editor.state.doc.toString();
  }

  getPath(): string { return this.path; }

  markErrors(errors: WorkerError[]) {
    // TODO: move cursor to error line if offscreen?
    this.clearErrors();
    errors = errors.slice(0, MAX_ERRORS);
    const newErrors = new Map<number, string>();
    for (var info of errors) {
      // only mark errors with this filename, or without any filename
      if (!info.path || this.path.endsWith(info.path)) {
        var numLines = this.editor.state.doc.lines;
        var line = info.line;
        if (isNaN(line) || line < 1 || line > numLines) line = 1;
        newErrors.set(line, info.msg);
      }
    }
    this.editor.dispatch({
      effects: [
        errorMarkers.set.of(newErrors),
      ],
    });
  }

  clearErrors() {
    this.dirtylisting = true;
    this.editor.dispatch({
      effects: [
        errorMarkers.set.of(new Map()),
        errorMarkers.showMessage.of(null),
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
          // Optional: follow the execution point
          EditorView.scrollIntoView(this.editor.state.doc.line(line.line).from, { y: "center" }),
        ]
      });
    }

    this.clearCurrentLine(moveCursor);
    if (line) {
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

  toggleBreakpoint(lineno: number) {
    // TODO: we have to always start at beginning of frame
    if (this.sourcefile != null) {
      var targetPC = this.sourcefile.line2offset[lineno + 1];
      runToPC(targetPC);
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
        debugHighlightTags ? debugHighlightTagsTooltip : [],
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
