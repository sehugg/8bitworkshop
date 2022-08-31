
import { isMobileDevice, ProjectView } from "./baseviews";
import { SourceFile, WorkerError, SourceLocation } from "../../common/workertypes";
import { CodeAnalyzer } from "../../common/analysis";
import { platform, current_project, lastDebugState, runToPC, qs } from "../ui";
import { hex, rpad } from "../../common/util";

declare var CodeMirror;

// helper function for editor
function jumpToLine(ed, i:number) {
  var t = ed.charCoords({line: i, ch: 0}, "local").top;
  var middleHeight = ed.getScrollerElement().offsetHeight / 2;
  ed.scrollTo(null, t - middleHeight - 5);
}

function createTextSpan(text:string, className:string) : HTMLElement {
  var span = document.createElement("span");
  span.setAttribute("class", className);
  span.appendChild(document.createTextNode(text));
  return span;
}

/////

// look ahead this many bytes when finding source lines for a PC
export const PC_LINE_LOOKAHEAD = 64;

const MAX_ERRORS = 200;

const MODEDEFS = {
  default: { theme: 'mbo' }, // NOTE: Not merged w/ other modes
  '6502': { isAsm: true },
  z80: { isAsm: true },
  jsasm: { isAsm: true },
  gas: { isAsm: true },
  vasm: { isAsm: true },
  inform6: { theme: 'cobalt' },
  markdown: { lineWrap: true },
  fastbasic: { noGutters: true },
  basic: { noLineNumbers: true, noGutters: true }, // TODO: not used?
  ecs: { theme: 'mbo', isAsm: true },
}

export var textMapFunctions = {
  input: null
};

export class SourceEditor implements ProjectView {
  constructor(path:string, mode:string) {
    this.path = path;
    this.mode = mode;
  }
  path : string;
  mode : string;
  editor;
  updateTimer = null;
  dirtylisting = true;
  sourcefile : SourceFile;
  currentDebugLine : SourceLocation;
  markCurrentPC; // TextMarker
  markHighlight; // TextMarker
  errormsgs = [];
  errorwidgets = [];
  errormarks = [];
  inspectWidget;

  createDiv(parent:HTMLElement) {
    var div = document.createElement('div');
    div.setAttribute("class", "editor");
    parent.appendChild(div);
    var text = current_project.getFile(this.path) as string;
    var asmOverride = text && this.mode=='verilog' && /__asm\b([\s\S]+?)\b__endasm\b/.test(text);
    this.newEditor(div, asmOverride);
    if (text) {
      this.setText(text); // TODO: this calls setCode() and builds... it shouldn't
      this.editor.setSelection({line:0,ch:0}, {line:0,ch:0}, {scroll:true}); // move cursor to start
    }
    this.setupEditor();
    return div;
  }

  setVisible(showing: boolean): void {
    if (showing) {
      this.editor.focus(); // so that keyboard works when moving between files
    }
  }

  newEditor(parent:HTMLElement, isAsmOverride?:boolean) {
    var modedef = MODEDEFS[this.mode] || MODEDEFS.default;
    var isAsm = isAsmOverride || modedef.isAsm;
    var lineWrap = !!modedef.lineWrap;
    var theme = modedef.theme || MODEDEFS.default.theme;
    var lineNums = !modedef.noLineNumbers && !isMobileDevice;
    if (qs['embed']) {
      lineNums = false; // no line numbers while embedded
      isAsm = false; // no opcode bytes either
    }
    var gutters = ["CodeMirror-linenumbers", "gutter-offset", "gutter-info"];
    if (isAsm) gutters = ["CodeMirror-linenumbers", "gutter-offset", "gutter-bytes", "gutter-clock", "gutter-info"];
    if (modedef.noGutters || isMobileDevice) gutters = ["gutter-info"];
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
    this.updateTimer = setTimeout( () => {
      current_project.updateFile(this.path, this.editor.getValue());
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
      if (textMapFunctions.input && chgobj.text) chgobj.text = chgobj.text.map(textMapFunctions.input);
    });
  }

  inspectUnderCursor() {
    var start = this.editor.getCursor(true);
    var end = this.editor.getCursor(false);
    if (start.line == end.line && start.ch < end.ch && end.ch-start.ch < 80) {
      var name = this.editor.getSelection();
      this.inspect(name);
    } else {
      this.inspect(null);
    }
  }

  inspect(ident : string) : void {
    var result;
    if (platform.inspect) {
      result = platform.inspect(ident);
    }
    if (this.inspectWidget) {
      this.inspectWidget.clear();
      this.inspectWidget = null;
    }
    if (result) {
      var infospan = createTextSpan(result, "tooltipinfoline");
      var line = this.editor.getCursor().line;
      this.inspectWidget = this.editor.addLineWidget(line, infospan, {above:false});
    }
  }

  setText(text:string) {
    var i,j;
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

  insertText(text:string) {
    var cur = this.editor.getCursor();
    this.editor.replaceRange(text, cur, cur);
  }

  highlightLines(start:number, end:number) {
    //this.editor.setSelection({line:start, ch:0}, {line:end, ch:0});
    var cls = 'hilite-span'
    var markOpts = {className:cls, inclusiveLeft:true};
    this.markHighlight = this.editor.markText({line:start,ch:0}, {line:end,ch:0}, markOpts);
    this.editor.scrollIntoView({from:{line:start,ch:0}, to:{line:end,ch:0}});
  }

  replaceSelection(start:number, end:number, text:string) {
    this.editor.setSelection(this.editor.posFromIndex(start), this.editor.posFromIndex(end));
    this.editor.replaceSelection(text);
  }

  getValue() : string {
    return this.editor.getValue();
  }

  getPath() : string { return this.path; }

  addError(info: WorkerError) {
    // only mark errors with this filename, or without any filename
    if (!info.path || this.path.endsWith(info.path)) {
      var numLines = this.editor.lineCount();
      var line = info.line-1;
      if (isNaN(line) || line < 0 || line >= numLines) line = 0;
      this.addErrorMarker(line, info.msg);
      if (info.start != null) {
        var markOpts = {className:"mark-error", inclusiveLeft:true};
        var start = {line:line, ch:info.end?info.start:info.start-1};
        var end = {line:line, ch:info.end?info.end:info.start};
        var mark = this.editor.markText(start, end, markOpts);
        this.errormarks.push(mark);
      }
    }
  }

  addErrorMarker(line:number, msg:string) {
    var div = document.createElement("div");
    div.setAttribute("class", "tooltipbox tooltiperror");
    div.appendChild(document.createTextNode("\u24cd"));
    this.editor.setGutterMarker(line, "gutter-info", div);
    this.errormsgs.push({line:line, msg:msg});
    // expand line widgets when mousing over errors
    $(div).mouseover((e) => {
      this.expandErrors();
    });
  }

  addErrorLine(line:number, msg:string) {
    var errspan = createTextSpan(msg, "tooltiperrorline");
    this.errorwidgets.push(this.editor.addLineWidget(line, errspan));
  }

  expandErrors() {
    var e;
    while (e = this.errormsgs.shift()) {
      this.addErrorLine(e.line, e.msg);
    }
  }

  markErrors(errors:WorkerError[]) {
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
    while (this.errorwidgets.length) this.errorwidgets.shift().clear();
    while (this.errormarks.length) this.errormarks.shift().clear();
  }

  getSourceFile() : SourceFile { return this.sourcefile; }

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
        this.setGutter("gutter-offset", info.line-1, hex(info.offset&0xffff,4));
      }
      if (info.insns) {
        var insnstr = info.insns.length > 9 ? ("...") : info.insns;
        this.setGutter("gutter-bytes", info.line-1, insnstr);
        if (info.iscode) {
          // TODO: labels trick this part?
          if (info.cycles) {
            this.setGutter("gutter-clock", info.line-1, info.cycles+"");
          } else if (platform.getOpcodeMetadata) {
            var opcode = parseInt(info.insns.split(" ")[0], 16);
            var meta = platform.getOpcodeMetadata(opcode, info.offset);
            if (meta && meta.minCycles) {
              var clockstr = meta.minCycles+"";
              this.setGutter("gutter-clock", info.line-1, clockstr);
            }
          }
        }
      }
    }
  }

  setGutter(type:string, line:number, text:string) {
    var lineinfo = this.editor.lineInfo(line);
    if (lineinfo && lineinfo.gutterMarkers && lineinfo.gutterMarkers[type]) {
      // do not replace existing marker
    } else {
      var textel = document.createTextNode(text);
      this.editor.setGutterMarker(line, type, textel);
    }
  }

  setGutterBytes(line:number, s:string) {
    this.setGutter("gutter-bytes", line-1, s);
  }

  setTimingResult(result:CodeAnalyzer) : void {
    this.editor.clearGutter("gutter-bytes");
    if (this.sourcefile == null) return;
    // show the lines
    for (const line of Object.keys(this.sourcefile.line2offset)) {
      var pc = this.sourcefile.line2offset[line];
      var minclocks = result.pc2minclocks[pc];
      var maxclocks = result.pc2maxclocks[pc];
      if (minclocks>=0 && maxclocks>=0) {
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

  setCurrentLine(line:SourceLocation, moveCursor:boolean) {
    var blocked = platform.isBlocked && platform.isBlocked();

    var addCurrentMarker = (line:SourceLocation) => {
      var div = document.createElement("div");
      var cls = blocked ? 'currentpc-marker-blocked' : 'currentpc-marker';
      div.classList.add(cls);
      div.appendChild(document.createTextNode("\u25b6"));
      this.editor.setGutterMarker(line.line-1, "gutter-info", div);
    }

    this.clearCurrentLine(moveCursor);
    if (line) {
      addCurrentMarker(line);
      if (moveCursor) {
        this.editor.setCursor({line:line.line-1,ch:line.start||0}, {scroll:true});
      }
      var cls = blocked ? 'currentpc-span-blocked' : 'currentpc-span';
      var markOpts = {className:cls, inclusiveLeft:true};
      if (line.start || line.end)
        this.markCurrentPC = this.editor.markText({line:line.line-1,ch:line.start}, {line:line.line-1,ch:line.end||line.start+1}, markOpts);
      else
        this.markCurrentPC = this.editor.markText({line:line.line-1,ch:0}, {line:line.line,ch:0}, markOpts);
      this.currentDebugLine = line;
    }
  }

  clearCurrentLine(moveCursor:boolean) {
    if (this.currentDebugLine) {
      this.editor.clearGutter("gutter-info");
      if (moveCursor) this.editor.setSelection(this.editor.getCursor());
      this.currentDebugLine = null;
    }
    if (this.markCurrentPC) {
      this.markCurrentPC.clear();
      this.markCurrentPC = null;
    }
  }

  getActiveLine() : SourceLocation {
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

  refreshDebugState(moveCursor:boolean) {
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

  getLine(line : number) {
    return this.editor.getLine(line-1);
  }

  getCurrentLine() : number {
    return this.editor.getCursor().line+1;
  }

  getCursorPC() : number {
    var line = this.getCurrentLine();
    while (this.sourcefile && line >= 0) {
      var pc = this.sourcefile.line2offset[line];
      if (pc >= 0) return pc;
      line--;
    }
    return -1;
  }

  undoStep() {
    this.editor.execCommand('undo');
  }

  toggleBreakpoint(lineno: number) {
    // TODO: we have to always start at beginning of frame
    if (this.sourcefile != null) {
      var targetPC = this.sourcefile.line2offset[lineno+1];
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
      runToPC(targetPC);
    }
  }
}

///

const disasmWindow = 1024; // disassemble this many bytes around cursor

export class DisassemblerView implements ProjectView {
  disasmview;

  getDisasmView() { return this.disasmview; }

  createDiv(parent : HTMLElement) {
    var div = document.createElement('div');
    div.setAttribute("class", "editor");
    parent.appendChild(div);
    this.newEditor(div);
    return div;
  }

  newEditor(parent : HTMLElement) {
    this.disasmview = CodeMirror(parent, {
      mode: 'z80', // TODO: pick correct one
      theme: 'cobalt',
      tabSize: 8,
      readOnly: true,
      styleActiveLine: true
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
        for (let i=0; i<disasm.nbytes; i++)
          bytes += hex(platform.readAddress(a+i));
        while (bytes.length < 14)
          bytes += ' ';
        let dstr = disasm.line;
        if (addr2symbol && disasm.isaddr) { // TODO: move out
          dstr = dstr.replace(/([^#])[$]([0-9A-F]+)/, (substr:string, ...args:any[]):string => {
            let addr = parseInt(args[1], 16);
            let sym = addr2symbol[addr];
            if (sym) return (args[0] + sym);
            sym = addr2symbol[addr-1];
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
        let dline = hex(a, 4) + "\t" + rpad(bytes,14) + "\t" + rpad(dstr,30) + comment + "\n";
        s += dline;
        if (a == pc) selline = curline;
        curline++;
        ofs += disasm.nbytes || 1;
      }
      return s;
    }
    var startpc = pc < 0 ? pc-disasmWindow : Math.max(0, pc-disasmWindow); // for 32-bit PCs w/ hi bit set
    let text = disassemble(startpc, pc-startpc) + disassemble(pc, disasmWindow);
    this.disasmview.setValue(text);
    if (moveCursor) { 
      this.disasmview.setCursor(selline, 0);
    }
    jumpToLine(this.disasmview, selline);
  }

  getCursorPC() : number {
    var line = this.disasmview.getCursor().line;
    if (line >= 0) {
      var toks = this.disasmview.getLine(line).trim().split(/\s+/);
      if (toks && toks.length >= 1) {
        var pc = parseInt(toks[0], 16);
        if (pc >= 0) return pc;
      }
    }
    return -1;
  }
}

///

export class ListingView extends DisassemblerView implements ProjectView {
  assemblyfile : SourceFile;
  path : string;

  constructor(lstfn : string) {
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
    var disasmview = this.getDisasmView();
    // TODO: sometimes it picks one without a text file
    disasmview.setValue(asmtext);
    // go to PC
    if (!platform.saveState) return;
    var state = lastDebugState || platform.saveState();
    var pc = state.c ? (state.c.EPC || state.c.PC) : 0;
    if (pc >= 0 && this.assemblyfile) {
      var res = this.assemblyfile.findLineForOffset(pc, PC_LINE_LOOKAHEAD);
      if (res) {
        // set cursor while debugging
        if (moveCursor) {
          disasmview.setCursor(res.line-1, 0);
        }
        jumpToLine(disasmview, res.line-1);
      }
    }
  }

}
