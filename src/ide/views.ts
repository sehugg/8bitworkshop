
//import CodeMirror = require("codemirror");
import { SourceFile, WorkerError, Segment, FileData, SourceLocation, SourceLine } from "../common/workertypes";
import { BaseZ80MachinePlatform, BaseZ80Platform } from "../common/baseplatform";
import { hex, lpad, rpad, safeident, rgb2bgr } from "../common/util";
import { CodeAnalyzer } from "../common/analysis";
import { platform, platform_id, compparams, current_project, lastDebugState, projectWindows, runToPC, qs } from "./ui";
import { ProbeRecorder, ProbeFlags } from "../common/recorder";
import { getMousePos, dumpRAM } from "../common/emu";
import * as pixed from "./pixeleditor";
declare var Mousetrap;

export interface ProjectView {
  createDiv(parent:HTMLElement) : HTMLElement;
  setVisible?(showing : boolean) : void;
  refresh(moveCursor:boolean) : void;
  tick?() : void;
  getPath?() : string;
  getValue?() : string;
  setText?(text : string) : void;
  insertText?(text : string) : void;
  getCursorPC?() : number;
  getSourceFile?() : SourceFile;
  setGutterBytes?(line:number, s:string) : void;
  markErrors?(errors:WorkerError[]) : void;
  clearErrors?() : void;
  setTimingResult?(result:CodeAnalyzer) : void;
  recreateOnResize? : boolean;
  undoStep?() : void;
};

// detect mobile (https://stackoverflow.com/questions/3514784/what-is-the-best-way-to-detect-a-mobile-device)
export var isMobileDevice = window.matchMedia && window.matchMedia("only screen and (max-width: 760px)").matches;

declare var CodeMirror;
declare var VirtualList;

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

// TODO: https://stackoverflow.com/questions/10463518/converting-em-to-px-in-javascript-and-getting-default-font-size
function getVisibleEditorLineHeight() : number{
  return $("#booksMenuButton").first().height();
}

function newDiv(parent?, cls? : string) {
  var div = $(document.createElement("div"));
  if (parent) div.appendTo(parent)
  if (cls) div.addClass(cls);
  return div;
}

/////

const MAX_ERRORS = 200;

const MODEDEFS = {
  default: { theme: 'mbo' }, // NOTE: Not merged w/ other modes
  '6502': { isAsm: true },
  z80: { isAsm: true },
  jsasm: { isAsm: true },
  gas: { isAsm: true },
  inform6: { theme: 'cobalt' },
  markdown: { lineWrap: true },
  fastbasic: { noGutters: true },
  basic: { noLineNumbers: true, noGutters: true }, // TODO: not used?
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
  dirtylisting = true;
  sourcefile : SourceFile;
  currentDebugLine : SourceLocation;
  markCurrentPC; // TextMarker
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

  newEditor(parent:HTMLElement, isAsmOverride?:boolean) {
    var modedef = MODEDEFS[this.mode] || MODEDEFS.default;
    var isAsm = isAsmOverride || modedef.isAsm;
    var lineWrap = !!modedef.lineWrap;
    var theme = modedef.theme || MODEDEFS.default.theme;
    var lineNums = !modedef.noLineNumbers && !isMobileDevice;
    if (qs['embed']) lineNums = false; // no line numbers while embedded
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

  setupEditor() {
    var timer;
    // update file in project (and recompile) when edits made
    this.editor.on('changes', (ed, changeobj) => {
      clearTimeout(timer);
      timer = setTimeout( () => {
        current_project.updateFile(this.path, this.editor.getValue());
      }, 300);
    });
    // inspect symbol when it's highlighted (double-click)
    this.editor.on('cursorActivity', (ed) => {
      var start = this.editor.getCursor(true);
      var end = this.editor.getCursor(false);
      if (start.line == end.line && start.ch < end.ch && end.ch-start.ch < 80) {
        var name = this.editor.getSelection();
        this.inspect(name);
      } else {
        this.inspect(null);
      }
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
      if (line < 0 || line >= numLines) line = 0;
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
            if (meta) {
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
        var res = this.sourcefile.findLineForOffset(EPC, 15);
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
    var state = lastDebugState || platform.saveState(); // TODO?
    var pc = state.c ? state.c.PC : 0;
    var curline = 0;
    var selline = 0;
    var addr2symbol = (platform.debugSymbols && platform.debugSymbols.addr2symbol) || {};
    // TODO: not perfect disassembler
    var disassemble = (start, end) => {
      if (start < 0) start = 0;
      if (end > 0xffff) end = 0xffff;
      // TODO: use pc2visits
      var a = start;
      var s = "";
      while (a < end) {
        var disasm = platform.disassemble(a, platform.readAddress.bind(platform));
        /* TODO: look thru all source files
        var srclinenum = sourcefile && this.sourcefile.offset2line[a];
        if (srclinenum) {
          var srcline = getActiveEditor().getLine(srclinenum);
          if (srcline && srcline.trim().length) {
            s += "; " + srclinenum + ":\t" + srcline + "\n";
            curline++;
          }
        }
        */
        var bytes = "";
        var comment = "";
        for (var i=0; i<disasm.nbytes; i++)
          bytes += hex(platform.readAddress(a+i));
        while (bytes.length < 14)
          bytes += ' ';
        var dstr = disasm.line;
        if (addr2symbol && disasm.isaddr) { // TODO: move out
          dstr = dstr.replace(/([^#])[$]([0-9A-F]+)/, (substr:string, ...args:any[]):string => {
            var addr = parseInt(args[1], 16);
            var sym = addr2symbol[addr];
            if (sym) return (args[0] + sym);
            sym = addr2symbol[addr-1];
            if (sym) return (args[0] + sym + "+1");
            return substr;
          });
        }
        if (addr2symbol) {
          var sym = addr2symbol[a];
          if (sym) {
            comment = "; " + sym;
          }
        }
        var dline = hex(parseInt(a), 4) + "\t" + rpad(bytes,14) + "\t" + rpad(dstr,30) + comment + "\n";
        s += dline;
        if (a == pc) selline = curline;
        curline++;
        a += disasm.nbytes || 1;
      }
      return s;
    }
    var text = disassemble(pc-disasmWindow, pc) + disassemble(pc, pc+disasmWindow);
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
    disasmview.setValue(asmtext);
    // go to PC
    if (!platform.saveState) return;
    var state = lastDebugState || platform.saveState();
    var pc = state.c ? (state.c.EPC || state.c.PC) : 0;
    if (pc >= 0 && this.assemblyfile) {
      var res = this.assemblyfile.findLineForOffset(pc, 15);
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

///

interface VirtualTextLine {
  text : string;
  clas? : string;
}

class VirtualTextScroller {
  memorylist;
  maindiv : HTMLElement;
  getLineAt : (row:number) => VirtualTextLine;

  constructor(parent : HTMLElement) {
    var div = document.createElement('div');
    div.setAttribute("class", "memdump");
    parent.appendChild(div);
    this.maindiv = div;
  }
  
  create(workspace : HTMLElement, maxRowCount : number, fn : (row:number) => VirtualTextLine) {
    this.getLineAt = fn;
    this.memorylist = new VirtualList({
      w: $(workspace).width(),
      h: $(workspace).height(),
      itemHeight: getVisibleEditorLineHeight(),
      totalRows: maxRowCount, // TODO?
      generatorFn: (row : number) => {
        var line = fn(row);
        var linediv = document.createElement("div");
        linediv.appendChild(document.createTextNode(line.text));
        if (line.clas != null) linediv.className = line.clas;
        return linediv;
      }
    });
    $(this.maindiv).append(this.memorylist.container);
  }

  // TODO: refactor with elsewhere
  refresh() {
    if (this.memorylist) {
      $(this.maindiv).find('[data-index]').each( (i,e) => {
        var div = e;
        var row = parseInt(div.getAttribute('data-index'));
        var oldtext = div.innerText;
        var line = this.getLineAt(row);
        var newtext = line.text;
        if (oldtext != newtext) {
          div.innerText = newtext;
          if (line.clas != null && !div.classList.contains(line.clas)) {
            var oldclasses = Array.from(div.classList);
            oldclasses.forEach((c) => div.classList.remove(c));
            div.classList.add('vrow');
            div.classList.add(line.clas);
          }
        }
      });
    }
  }
}

///

function ignoreSymbol(sym:string) {
  return sym.endsWith('_SIZE__') || sym.endsWith('_LAST__') || sym.endsWith('STACKSIZE__') || sym.endsWith('FILEOFFS__') 
  || sym.startsWith('l__') || sym.startsWith('s__') || sym.startsWith('.__.');
}

// TODO: make it use debug state
// TODO: make it safe (load/restore state?)
// TODO: refactor w/ VirtualTextLine
export class MemoryView implements ProjectView {
  memorylist;
  dumplines;
  maindiv : HTMLElement;
  recreateOnResize = true;
  totalRows = 0x1400;

  createDiv(parent : HTMLElement) {
    var div = document.createElement('div');
    div.setAttribute("class", "memdump");
    parent.appendChild(div);
    this.showMemoryWindow(parent, div);
    return this.maindiv = div;
  }

  showMemoryWindow(workspace:HTMLElement, parent:HTMLElement) {
    this.memorylist = new VirtualList({
      w: $(workspace).width(),
      h: $(workspace).height(),
      itemHeight: getVisibleEditorLineHeight(),
      totalRows: this.totalRows,
      generatorFn: (row : number) => {
        var s = this.getMemoryLineAt(row);
        var linediv = document.createElement("div");
        if (this.dumplines) {
          var dlr = this.dumplines[row];
          if (dlr) linediv.classList.add('seg_' + this.getMemorySegment(this.dumplines[row].a));
        }
        linediv.appendChild(document.createTextNode(s));
        return linediv;
      }
    });
    $(parent).append(this.memorylist.container);
    this.tick();
    if (compparams && this.dumplines)
      this.scrollToAddress(compparams.data_start);
  }

  scrollToAddress(addr : number) {
    if (this.dumplines) {
      this.memorylist.scrollToItem(this.findMemoryWindowLine(addr));
    }
  }

  refresh() {
    this.dumplines = null;
    this.tick();
  }

  tick() {
    if (this.memorylist) {
      $(this.maindiv).find('[data-index]').each( (i,e) => {
        var div = $(e);
        var row = parseInt(div.attr('data-index'));
        var oldtext = div.text();
        var newtext = this.getMemoryLineAt(row);
        if (oldtext != newtext)
          div.text(newtext);
      });
    }
  }

  getMemoryLineAt(row : number) : string {
    var offset = row * 16;
    var n1 = 0;
    var n2 = 16;
    var sym;
    if (this.getDumpLines()) {
      var dl = this.dumplines[row];
      if (dl) {
        offset = dl.a & 0xfff0;
        n1 = dl.a - offset;
        n2 = n1 + dl.l;
        sym = dl.s;
      } else {
        return '.';
      }
    }
    var s = hex(offset+n1,4) + ' ';
    for (var i=0; i<n1; i++) s += '   ';
    if (n1 > 8) s += ' ';
    for (var i=n1; i<n2; i++) {
      var read = this.readAddress(offset+i);
      if (i==8) s += ' ';
      s += ' ' + (typeof read == 'number' ? hex(read,2) : '??');
    }
    for (var i=n2; i<16; i++) s += '   ';
    if (sym) s += '  ' + sym;
    return s;
  }

  readAddress(n : number) {
    return platform.readAddress(n);
  }

  getDumpLineAt(line : number) {
    var d = this.dumplines[line];
    if (d) {
      return d.a + " " + d.s;
    }
  }

  // TODO: addr2symbol for ca65; and make it work without symbols
  getDumpLines() {
    var addr2sym = (platform.debugSymbols && platform.debugSymbols.addr2symbol) || {};
    if (!this.dumplines) {
      this.dumplines = [];
      var ofs = 0;
      var sym;
      for (const _nextofs of Object.keys(addr2sym)) {
        var nextofs = parseInt(_nextofs); // convert from string (stupid JS)
        var nextsym = addr2sym[nextofs];
        if (sym) {
          // ignore certain symbols
          if (ignoreSymbol(sym)) {
            sym = '';
          }
          while (ofs < nextofs) {
            var ofs2 = (ofs + 16) & 0xffff0;
            if (ofs2 > nextofs) ofs2 = nextofs;
            //if (ofs < 1000) console.log(ofs, ofs2, nextofs, sym);
            this.dumplines.push({a:ofs, l:ofs2-ofs, s:sym});
            ofs = ofs2;
          }
        }
        sym = nextsym;
      }
    }
    return this.dumplines;
  }

  // TODO: use segments list?
  getMemorySegment(a:number) : string {
    if (compparams) {
      if (a >= compparams.data_start && a < compparams.data_start+compparams.data_size) {
        if (platform.getSP && a >= platform.getSP() - 15)
          return 'stack';
        else
          return 'data';
      }
      else if (a >= compparams.code_start && a < compparams.code_start+(compparams.code_size||compparams.rom_size))
        return 'code';
    }
    var segments = current_project.segments;
    if (segments) {
      for (var seg of segments) {
        if (a >= seg.start && a < seg.start+seg.size) {
          if (seg.type == 'rom') return 'code';
          if (seg.type == 'ram') return 'data';
          if (seg.type == 'io') return 'io';
        }
      }
    }
    return 'unknown';
  }

  findMemoryWindowLine(a:number) : number {
    for (var i=0; i<this.dumplines.length; i++)
      if (this.dumplines[i].a >= a)
        return i;
  }
}

export class VRAMMemoryView extends MemoryView {
  totalRows = 0x800;
  readAddress(n : number) {
    return platform.readVRAMAddress(n);
  }
  getMemorySegment(a:number) : string {
    return 'video';
  }
  getDumpLines() {
    return null;
  }
}

///

export class BinaryFileView implements ProjectView {
  vlist : VirtualTextScroller;
  maindiv : HTMLElement;
  path:string;
  data:Uint8Array;
  recreateOnResize = true;

  constructor(path:string, data:Uint8Array) {
    this.path = path;
    this.data = data;
  }

  createDiv(parent : HTMLElement) {
    this.vlist = new VirtualTextScroller(parent);
    this.vlist.create(parent, ((this.data.length+15) >> 4), this.getMemoryLineAt.bind(this));
    return this.vlist.maindiv;
  }

  getMemoryLineAt(row : number) : VirtualTextLine {
    var offset = row * 16;
    var n1 = 0;
    var n2 = 16;
    var s = hex(offset+n1,4) + ' ';
    for (var i=0; i<n1; i++) s += '   ';
    if (n1 > 8) s += ' ';
    for (var i=n1; i<n2; i++) {
      var read = this.data[offset+i];
      if (i==8) s += ' ';
      s += ' ' + (read>=0?hex(read,2):'  ');
    }
    return {text:s};
  }

  refresh() {
    this.vlist.refresh();
  }
  
  getPath() { return this.path; }
}

///

export class MemoryMapView implements ProjectView {
  maindiv : JQuery;

  createDiv(parent : HTMLElement) {
    this.maindiv = newDiv(parent, 'vertical-scroll');
    this.maindiv.css('display', 'grid');
    this.maindiv.css('grid-template-columns', '5em 40% 40%');
    return this.maindiv[0];
  }

  // TODO: overlapping segments (e.g. ROM + LC)
  addSegment(seg : Segment, newrow : boolean) {
    if (newrow) {
      var offset = $('<div class="segment-offset" style="grid-column-start:1"/>');
      offset.text('$'+hex(seg.start,4));
      this.maindiv.append(offset);
    }
    var segdiv = $('<div class="segment"/>');
    if (!newrow)
      segdiv.css('grid-column-start', 3); // make sure it's on right side
    if (seg.last)
      segdiv.text(seg.name+" ("+(seg.last-seg.start)+" / "+seg.size+" bytes used)");
    else
      segdiv.text(seg.name+" ("+seg.size+" bytes)");
    if (seg.size >= 256) {
      var pad = (Math.log(seg.size) - Math.log(256)) * 0.5;
      segdiv.css('padding-top', pad+'em');
      segdiv.css('padding-bottom', pad+'em');
    }
    if (seg.type) {
      segdiv.addClass('segment-'+seg.type);
    }
    this.maindiv.append(segdiv);
    //var row = $('<div class="row"/>').append(offset, segdiv);
    //var container = $('<div class="container"/>').append(row);
    //this.maindiv.append(container);
    segdiv.click(() => {
      // TODO: what if memory browser does not exist?
      var memview = projectWindows.createOrShow('#memory') as MemoryView;
      memview.scrollToAddress(seg.start);
    });
  }

  refresh() {
    this.maindiv.empty();
    var segments = current_project.segments;
    if (segments) {
      var curofs = 0;
      var laststart = -1;
      for (var seg of segments) {
        //var used = seg.last ? (seg.last-seg.start) : seg.size;
        if (seg.start > curofs)
          this.addSegment({name:'',start:curofs, size:seg.start-curofs}, true);
        this.addSegment(seg, laststart != seg.start);
        laststart = seg.start;
        curofs = seg.start + seg.size;
      }
    }
  }

}

///

// TODO: clear buffer when scrubbing

abstract class ProbeViewBaseBase {
  probe : ProbeRecorder;
  tooldiv : HTMLElement;
  cumulativeData : boolean = false;

  abstract tick() : void;

  addr2symbol(addr : number) : string {
    var _addr2sym = (platform.debugSymbols && platform.debugSymbols.addr2symbol) || {};
    return _addr2sym[addr];
  }

  addr2str(addr : number) : string {
    var sym = this.addr2symbol(addr);
    if (typeof sym === 'string')
      return '$' + hex(addr) + ' (' + sym + ')';
    else
      return '$' + hex(addr);
  }

  showTooltip(s:string) {
    if (s) {
      if (!this.tooldiv) {
        this.tooldiv = document.createElement("div");
        this.tooldiv.setAttribute("class", "tooltiptrack");
        document.body.appendChild(this.tooldiv);
      }
      $(this.tooldiv).text(s).show();
    } else {
      $(this.tooldiv).hide();
    }
  }

  setVisible(showing : boolean) : void {
    if (showing) {
      this.probe = platform.startProbing();
      this.probe.singleFrame = !this.cumulativeData;
      this.tick();
    } else {
      if (this.probe) this.probe.singleFrame = true;
      platform.stopProbing();
      this.probe = null;
    }
  }

  redraw( eventfn:(op,addr,col,row,clk,value) => void ) {
    var p = this.probe;
    if (!p || !p.idx) return; // if no probe, or if empty
    var row=0;
    var col=0;
    var clk=0;
    for (var i=0; i<p.idx; i++) {
      var word = p.buf[i];
      var addr = word & 0xffff;
      var value = (word >> 16) & 0xff;
      var op = word & 0xff000000;
      switch (op) {
        case ProbeFlags.SCANLINE:	row++; col=0; break;
        case ProbeFlags.FRAME:		row=0; col=0; break;
        case ProbeFlags.CLOCKS:		col += addr; clk += addr; break;
        default:
          eventfn(op, addr, col, row, clk, value);
          break;
      }
    }
  }

  opToString(op:number, addr?:number, value?:number) {
    var s = "";
    switch (op) {
      case ProbeFlags.EXECUTE:		s = "Exec"; break;
      case ProbeFlags.MEM_READ:		s = "Read"; break;
      case ProbeFlags.MEM_WRITE:	s = "Write"; break;
      case ProbeFlags.IO_READ:		s = "IO Read"; break;
      case ProbeFlags.IO_WRITE:		s = "IO Write"; break;
      case ProbeFlags.VRAM_READ:	s = "VRAM Read"; break;
      case ProbeFlags.VRAM_WRITE:	s = "VRAM Write"; break;
      case ProbeFlags.INTERRUPT:	s = "Interrupt"; break;
      case ProbeFlags.ILLEGAL:		s = "Error"; break;
      case ProbeFlags.SP_PUSH:		s = "Stack Push"; break;
      case ProbeFlags.SP_POP:     s = "Stack Pop"; break;
      default:				            return "";
    }
    if (typeof addr == 'number') s += " " + this.addr2str(addr);
    if ((op & ProbeFlags.HAS_VALUE) && typeof value == 'number') s += " = $" + hex(value,2);
    return s;
  }
  
  getOpRGB(op:number) : number {
    switch (op) {
      case ProbeFlags.EXECUTE:		return 0x018001;
      case ProbeFlags.MEM_READ:		return 0x800101;
      case ProbeFlags.MEM_WRITE:	return 0x010180;
      case ProbeFlags.IO_READ:		return 0x018080;
      case ProbeFlags.IO_WRITE:		return 0xc00180;
      case ProbeFlags.VRAM_READ:	return 0x808001;
      case ProbeFlags.VRAM_WRITE:	return 0x4080c0;
      case ProbeFlags.INTERRUPT:	return 0xcfcfcf;
      case ProbeFlags.ILLEGAL:		return 0x3f3fff;
      default:				            return 0;
    }
  }
}

abstract class ProbeViewBase extends ProbeViewBaseBase {

  maindiv : HTMLElement;
  canvas : HTMLCanvasElement;
  ctx : CanvasRenderingContext2D;
  recreateOnResize = true;
    
  abstract drawEvent(op, addr, col, row);

  createCanvas(parent:HTMLElement, width:number, height:number) {
    var div = document.createElement('div');
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.classList.add('pixelated');
    canvas.style.width = '100%';
    canvas.style.height = '90vh'; // i hate css
    canvas.style.backgroundColor = 'black';
    canvas.style.cursor = 'crosshair';
    canvas.onmousemove = (e) => {
      var pos = getMousePos(canvas, e);
      this.showTooltip(this.getTooltipText(pos.x, pos.y));
      $(this.tooldiv).css('left',e.pageX+10).css('top',e.pageY-30);
    }
    canvas.onmouseout = (e) => {
      $(this.tooldiv).hide();
    }
    parent.appendChild(div);
    div.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.initCanvas();
    return this.maindiv = div;
  }

  initCanvas() {
  }
  
  getTooltipText(x:number, y:number) : string {
    return null;
  }
  
  clear() {
  }
  
  tick() {
    this.clear();
    this.redraw(this.drawEvent.bind(this));
  }
}

abstract class ProbeBitmapViewBase extends ProbeViewBase {

  imageData : ImageData;
  datau32 : Uint32Array;
  recreateOnResize = false;
  
  createDiv(parent : HTMLElement) {
    var width = 160;
    var height = 262;
    try {
      width = Math.ceil(platform['machine']['cpuCyclesPerLine']) || 256; // TODO
      height = Math.ceil(platform['machine']['numTotalScanlines']) || 262; // TODO
    } catch (e) {
    }
    return this.createCanvas(parent, width, height);
  }
  initCanvas() {
    this.imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    this.datau32 = new Uint32Array(this.imageData.data.buffer);
  }
  getTooltipText(x:number, y:number) : string {
    x = x|0;
    y = y|0;
    var s = "";
    var lastroutine = null;
    var symstack = [];
    var lastcol = -1;
    this.redraw( (op,addr,col,row,clk,value) => {
      switch (op) {
        case ProbeFlags.EXECUTE:
          lastroutine = this.addr2symbol(addr) || lastroutine;
          break;
        case ProbeFlags.SP_PUSH:
          symstack.push(lastroutine);
          break;
        case ProbeFlags.SP_POP:
          lastroutine = symstack.pop();
          break;
      }
      if (row == y && col <= x) {
        if (col != lastcol) {
          s = "";
          lastcol = col;
        }
        if (s == "" && lastroutine) { s += "\n" + lastroutine; }
        s += "\n" + this.opToString(op, addr, value);
      }
    } );
    return 'X: ' + x + '  Y: ' + y + ' ' + s;
  }

  refresh() {
    this.tick();
    this.datau32.fill(0xff000000);
  }
  tick() {
    super.tick();
    this.ctx.putImageData(this.imageData, 0, 0);
  }
  clear() {
    this.datau32.fill(0xff000000);
  }
}

export class AddressHeatMapView extends ProbeBitmapViewBase implements ProjectView {

  createDiv(parent : HTMLElement) {
    return this.createCanvas(parent, 256, 256);
  }
  
  clear() {
    for (var i=0; i<=0xffff; i++) {
      var v = platform.readAddress(i);
      var rgb = (v >> 2) | (v & 0x1f);
      rgb |= (rgb<<8) | (rgb<<16);
      this.datau32[i] = rgb | 0xff000000;
    }
  }
  
  drawEvent(op, addr, col, row) {
    var rgb = this.getOpRGB(op);
    if (!rgb) return;
    var x = addr & 0xff;
    var y = (addr >> 8) & 0xff;
    var data = this.datau32[addr & 0xffff];
    data = data | rgb | 0xff000000;
    this.datau32[addr & 0xffff] = data;
  }
  
  getTooltipText(x:number, y:number) : string {
    var a = (x & 0xff) + (y << 8);
    var s = "";
    var pc = -1;
    var already = {};
    var lastroutine = null;
    var symstack = [];
    this.redraw( (op,addr,col,row,clk,value) => {
      switch (op) {
        case ProbeFlags.EXECUTE:
          pc = addr;
          lastroutine = this.addr2symbol(addr) || lastroutine;
          break;
        case ProbeFlags.SP_PUSH:
          symstack.push(lastroutine);
          break;
        case ProbeFlags.SP_POP:
          lastroutine = symstack.pop();
          break;
      }
      var key = op|pc;
      if (addr == a && !already[key]) {
        if (s == "" && lastroutine) { s += "\n" + lastroutine; }
        s += "\nPC " + this.addr2str(pc) + " " + this.opToString(op, null, value);
        already[key] = 1;
      }
    } );
    return this.addr2str(a) + s;
  }
}

export class RasterPCHeatMapView extends ProbeBitmapViewBase implements ProjectView {

  drawEvent(op, addr, col, row) {
    var iofs = col + row * this.canvas.width;
    var rgb = this.getOpRGB(op);
    if (!rgb) return;
    var data = this.datau32[iofs];
    data = data | rgb | 0xff000000;
    this.datau32[iofs] = data;
  }
}

export class ProbeLogView extends ProbeViewBaseBase {
  vlist : VirtualTextScroller;
  maindiv : HTMLElement;
  recreateOnResize = true;
  dumplines;

  createDiv(parent : HTMLElement) {
    this.vlist = new VirtualTextScroller(parent);
    this.vlist.create(parent, 160*262, this.getMemoryLineAt.bind(this));
    return this.vlist.maindiv;
  }
  getMemoryLineAt(row : number) : VirtualTextLine {
    var s : string = "";
    var c : string = "seg_data";
    var line = this.dumplines && this.dumplines[row];
    if (line != null) {
      var xtra : string = line.info.join(", ");
      s = "(" + lpad(line.row,4) + ", " + lpad(line.col,4) + ")  " + rpad(line.asm||"",20) + xtra;
      if (xtra.indexOf("Write ") >= 0) c = "seg_io";
      // if (xtra.indexOf("Stack ") >= 0) c = "seg_code";
    }
    return {text:s, clas:c};
  }
  refresh() {
    this.tick();
  }
  tick() {
    const isz80 = platform instanceof BaseZ80MachinePlatform || platform instanceof BaseZ80Platform; // TODO?
    // cache each line in frame
    this.dumplines = {};
    this.redraw((op,addr,col,row,clk,value) => {
      if (isz80) clk >>= 2;
      var line = this.dumplines[clk];
      if (line == null) {
        line = {op:op, addr:addr, row:row, col:col, asm:null, info:[]};
        this.dumplines[clk] = line;
      }
      switch (op) {
        case ProbeFlags.EXECUTE:
          if (platform.disassemble) {
            var disasm = platform.disassemble(addr, platform.readAddress.bind(platform));
            line.asm = disasm && disasm.line;
          }
          break;
        default:
          var xtra = this.opToString(op, addr, value);
          if (xtra != "") line.info.push(xtra);
          break;
      }
    });
    this.vlist.refresh();
  }
}

///

export class ProbeSymbolView extends ProbeViewBaseBase {
  vlist : VirtualTextScroller;
  keys : string[];
  recreateOnResize = true;
  dumplines;
  cumulativeData = true;

  // TODO: auto resize
  createDiv(parent : HTMLElement) {
    // TODO: what if symbol list changes?
    if (platform.debugSymbols && platform.debugSymbols.symbolmap) {
      this.keys = Array.from(Object.keys(platform.debugSymbols.symbolmap).filter(sym => !ignoreSymbol(sym)));
    } else {
      this.keys = ['no symbols defined'];
    }
    this.vlist = new VirtualTextScroller(parent);
    this.vlist.create(parent, this.keys.length + 1, this.getMemoryLineAt.bind(this));
    return this.vlist.maindiv;
  }

  getMemoryLineAt(row : number) : VirtualTextLine {
    // header line
    if (row == 0) {
      return {text: lpad("Symbol",35)+lpad("Reads",8)+lpad("Writes",8)};
    }
    var sym = this.keys[row-1];
    var line = this.dumplines && this.dumplines[sym];
    function getop(op) {
      var n = line[op] | 0;
      return lpad(n ? n.toString() : "", 8);
    }
    var s : string;
    var c : string;
    if (line != null) {
      s = lpad(sym, 35) 
        + getop(ProbeFlags.MEM_READ)
        + getop(ProbeFlags.MEM_WRITE);
      if (line[ProbeFlags.EXECUTE])
        c = 'seg_code';
      else if (line[ProbeFlags.IO_READ] || line[ProbeFlags.IO_WRITE])
        c = 'seg_io';
      else
        c = 'seg_data';
    } else {
      s = lpad(sym, 35);
      c = 'seg_unknown';
    }
    return {text:s, clas:c};
  }

  refresh() {
    this.tick();
  }

  tick() {
    // cache each line in frame
    this.dumplines = {};
    this.redraw((op,addr,col,row,clk,value) => {
      var sym = platform.debugSymbols.addr2symbol[addr];
      if (sym != null) {
        var line = this.dumplines[sym];
        if (line == null) {
          line = {};
          this.dumplines[sym] = line;
        }
        line[op] = (line[op] | 0) + 1;
      }
    });
    this.vlist.refresh();
    if (this.probe) this.probe.clear(); // clear cumulative data (TODO: doesnt work with seeking or debugging)
  }
}

///

const MAX_CHILDREN = 256;
const MAX_STRING_LEN = 100;

var TREE_SHOW_DOLLAR_IDENTS = false;

class TreeNode {
  parent : TreeNode;
  name : string;
  _div : HTMLElement;
  _header : HTMLElement;
  _inline : HTMLElement;
  _content : HTMLElement;
  children : Map<string,TreeNode>;
  expanded = false;
  level : number;
  view : ProjectView;

  constructor(parent : TreeNode, name : string) {
    this.parent = parent;
    this.name = name;
    this.children = new Map();
    this.level = parent ? (parent.level+1) : -1;
    this.view = parent ? parent.view : null;
  }
  getDiv() {
    if (this._div == null) {
      this._div = document.createElement("div");
      this._div.classList.add("vertical-scroll");
      this._div.classList.add("tree-content");
      this._header = document.createElement("div");
      this._header.classList.add("tree-header");
      this._header.classList.add("tree-level-" + this.level);
      this._header.append(this.name);
      this._inline = document.createElement("span");
      this._inline.classList.add("tree-value");
      this._header.append(this._inline);
      this._div.append(this._header);
      this.parent._content.append(this._div);
      this._header.onclick = (e) => {
        this.toggleExpanded();
      };
    }
    if (this.expanded && this._content == null) {
      this._content = document.createElement("div");
      this._div.append(this._content);
    }
    else if (!this.expanded && this._content != null) {
      this._content.remove();
      this._content = null;
      this.children.clear();
    }
    return this._div;
  }
  toggleExpanded() {
    this.expanded = !this.expanded;
    this.view.tick();
  }
  remove() {
    this._div.remove();
    this._div = null;
  }
  update(obj : any) {
    this.getDiv();
    var text = "";
    // is it a function? call it first, if we are expanded
    // TODO: only call functions w/ signature
    if (obj && obj.$$ && typeof obj.$$ == 'function' && this._content != null) {
      obj = obj.$$();
    }
    // check null first
    if (obj == null) {
      text = obj+"";
    // primitive types
    } else if (typeof obj == 'number') {
      if (obj != (obj|0)) text = obj.toString(); // must be a float
      else text = obj + "\t($" + hex(obj) + ")";
    } else if (typeof obj == 'boolean') {
      text = obj.toString();
    } else if (typeof obj == 'string') {
      if (obj.length < MAX_STRING_LEN)
        text = obj;
      else
        text = obj.substring(0, MAX_STRING_LEN) + "...";
    // typed byte array (TODO: other kinds)
    } else if (obj.buffer && obj.length <= MAX_CHILDREN) {
      text = dumpRAM(obj, 0, obj.length);
    // recurse into object? (or function)
    } else if (typeof obj == 'object' || typeof obj == 'function') {
      // only if expanded
      if (this._content != null) {
        // split big arrays
        if (obj.slice && obj.length > MAX_CHILDREN) {
          let newobj = {};
          let oldobj = obj;
          var slicelen = MAX_CHILDREN;
          while (obj.length / slicelen > MAX_CHILDREN) slicelen *= 2;
          for (let ofs=0; ofs<oldobj.length; ofs+=slicelen) {
            newobj["$"+hex(ofs)] = {$$: () => { return oldobj.slice(ofs, ofs+slicelen); }}
          }
          obj = newobj;
        }
        // get object keys
        let names = obj instanceof Array ? Array.from(obj.keys()) : Object.getOwnPropertyNames(obj);
        if (names.length > MAX_CHILDREN) { // max # of child objects
          let newobj = {};
          let oldobj = obj;
          var slicelen = 100;
          while (names.length / slicelen > 100) slicelen *= 2;
          for (let ofs=0; ofs<names.length; ofs+=slicelen) {
            var newdict = {};
            for (var i=ofs; i<ofs+slicelen; i++)
              newdict[names[i]] = oldobj[names[i]];
            newobj["["+ofs+"...]"] = newdict;
          }
          obj = newobj;
          names = Object.getOwnPropertyNames(obj);
        }
        // track deletions
        let orphans = new Set(this.children.keys());
        // visit all children
        names.forEach((name) => {
          // hide $xxx idents?
          var hidden = !TREE_SHOW_DOLLAR_IDENTS && typeof name === 'string' && name.startsWith("$$");
          if (!hidden) {
            let childnode = this.children.get(name);
            if (childnode == null) {
              childnode = new TreeNode(this, name);
              this.children.set(name, childnode);
            }
            childnode.update(obj[name]);
          }
          orphans.delete(name);
        });
        // remove orphans
        orphans.forEach((delname) => {
          let childnode = this.children.get(delname);
          childnode.remove();
          this.children.delete(delname);
        });
        this._header.classList.add("tree-expanded");
        this._header.classList.remove("tree-collapsed");
      } else {
        this._header.classList.add("tree-collapsed");
        this._header.classList.remove("tree-expanded");
      }
    } else {
      text = typeof obj; // fallthrough
    }
    // change DOM object if needed
    if (this._inline.innerText != text) {
      this._inline.innerText = text;
    }
  }
}

function createTreeRootNode(parent : HTMLElement, view : ProjectView) : TreeNode {
  var mainnode = new TreeNode(null, null);
  mainnode.view = view;
  mainnode._content = parent;
  var root = new TreeNode(mainnode, "/");
  root.expanded = true;
  root.getDiv(); // create it
  root._div.style.padding = '0px';
  return root; // should be cached
}

export abstract class TreeViewBase implements ProjectView {
  root : TreeNode;

  createDiv(parent : HTMLElement) : HTMLElement {
    this.root = createTreeRootNode(parent, this);
    return this.root.getDiv();
  }

  refresh() {
    this.tick();
  }

  tick() {
    this.root.update(this.getRootObject());
  }

  abstract getRootObject() : Object;
}

export class StateBrowserView extends TreeViewBase implements ProjectView {
  getRootObject() { return platform.saveState(); }
}

export class DebugBrowserView extends TreeViewBase implements ProjectView {
  getRootObject() { return platform.getDebugTree(); }
}

interface CallGraphNode {
  $$SP : number;
  $$PC : number;
  count : number;
  startLine : number;
  endLine : number;
  calls : {[id:string] : CallGraphNode};
}

// TODO: clear stack data when reset?
export class CallStackView extends ProbeViewBaseBase implements ProjectView {
  treeroot : TreeNode;
  graph : CallGraphNode;
  stack : CallGraphNode[];
  lastsp : number;
  lastpc : number;
  jsr : boolean;
  rts : boolean;
  cumulativeData = true;

  createDiv(parent : HTMLElement) : HTMLElement {
    this.clear();
    this.treeroot = createTreeRootNode(parent, this);
    return this.treeroot.getDiv();
  }

  refresh() {
    this.tick();
  }

  tick() {
    this.treeroot.update(this.getRootObject());
    if (this.probe) this.probe.clear(); // clear cumulative data (TODO: doesnt work with seeking or debugging)
  }

  clear() {
    this.graph = null;
    this.reset();
  }

  reset() {
    this.stack = [];
    this.lastsp = -1;
    this.lastpc = 0;
    this.jsr = false;
    this.rts = false;
  }

  newNode(pc : number, sp : number) {
    return {$$SP:sp, $$PC:pc, count:0, startLine:null, endLine:null, calls:{}};
  }

  newRoot(pc : number, sp : number) {
    if (this.stack.length == 0) {
      this.graph = this.newNode(null, sp);
      this.stack.unshift(this.graph);
    } else if (sp > this.stack[0].$$SP) {
      this.graph = this.newNode(null, sp);
      this.graph.calls[this.addr2str(pc)] = this.stack[0];
      this.stack.unshift(this.graph);
    }
  }

  getRootObject() : Object {
    // TODO: we don't capture every frame, so if we don't start @ the top frame we may have problems
    this.redraw((op,addr,col,row,clk,value) => {
      switch (op) {
        case ProbeFlags.SP_POP:
          this.newRoot(this.lastpc, this.lastsp);
        case ProbeFlags.SP_PUSH:
          if (this.stack.length) {
            let top = this.stack[this.stack.length-1];
            var delta = this.lastsp - addr;
            if ((delta == 2 || delta == 3) && addr < top.$$SP) { // TODO: look for opcode?
              this.jsr = true;
            }
            if ((delta == -2 || delta == -3) && this.stack.length > 1 && addr > top.$$SP) {
              this.rts = true;
            }
          }
          this.lastsp = addr;
          break;
        case ProbeFlags.EXECUTE:
          // TODO: better check for CALL/RET opcodes
          if (Math.abs(addr - this.lastpc) >= 4) { // make sure we're jumping a distance (TODO)
            if (this.jsr && this.stack.length) {
              let top = this.stack[this.stack.length-1];
              let sym = this.addr2str(addr);
              let child = top.calls[sym];
              if (child == null) { 
                child = top.calls[sym] = this.newNode(addr, this.lastsp);
              }
              else if (child.$$PC == null) child.$$PC = addr;
              //this.stack.forEach((node) => node.count++);
              this.stack.push(child);
              child.count++;
              child.startLine = row;
            }
            this.jsr = false;
            if (this.rts && this.stack.length) {
              this.stack.pop().endLine = row;
            }
            this.rts = false;
          }
          this.lastpc = addr;
          break;
      }
    });
    if (this.graph) this.graph['$$Stack'] = this.stack;
    return TREE_SHOW_DOLLAR_IDENTS ? this.graph : this.graph && this.graph.calls;
  }
}

export class FrameCallsView extends ProbeViewBaseBase implements ProjectView {
  treeroot : TreeNode;

  createDiv(parent : HTMLElement) : HTMLElement {
    this.treeroot = createTreeRootNode(parent, this);
    return this.treeroot.getDiv();
  }

  refresh() {
    this.tick();
  }

  tick() {
    this.treeroot.update(this.getRootObject());
  }

  getRootObject() : Object {
    var frame = {};
    this.redraw((op,addr,col,row,clk,value) => {
      switch (op) {
        case ProbeFlags.EXECUTE:
          let sym = this.addr2symbol(addr);
          if (sym) {
            if (!frame[sym]) {
              frame[sym] = row;
            }
          }
          break;
      }
    });
    return frame;
  }
}


///

export class AssetEditorView implements ProjectView, pixed.EditorContext {
  maindiv : JQuery;
  cureditordiv : JQuery;
  cureditelem : JQuery;
  cureditnode : pixed.PixNode;
  rootnodes : pixed.PixNode[];
  deferrednodes : pixed.PixNode[];

  createDiv(parent : HTMLElement) {
    this.maindiv = newDiv(parent, "vertical-scroll");
    return this.maindiv[0];
  }

  clearAssets() {
    this.rootnodes = [];
    this.deferrednodes = [];
  }

  registerAsset(type:string, node:pixed.PixNode, deferred:number) {
    this.rootnodes.push(node);
    if (deferred) {
      if (deferred > 1)
        this.deferrednodes.push(node);
      else
        this.deferrednodes.unshift(node);
    } else {
      node.refreshRight();
    }
  }

  getPalettes(matchlen : number) : pixed.SelectablePalette[] {
    var result = [];
    this.rootnodes.forEach((node) => {
      while (node != null) {
        if (node instanceof pixed.PaletteFormatToRGB) {
          // TODO: move to node class?
          var palette = node.palette;
          // match full palette length?
          if (matchlen == palette.length) {
            result.push({node:node, name:"Palette", palette:palette});
          }
          // look at palette slices
          if (node.layout) {
            node.layout.forEach(([name, start, len]) => {
              if (start < palette.length) {
                if (len == matchlen) {
                  var rgbs = palette.slice(start, start+len);
                  result.push({node:node, name:name, palette:rgbs});
                } else if (-len == matchlen) { // reverse order
                  var rgbs = palette.slice(start, start-len);
                  rgbs.reverse();
                  result.push({node:node, name:name, palette:rgbs});
                } else if (len+1 == matchlen) {
                  var rgbs = new Uint32Array(matchlen);
                  rgbs[0] = palette[0];
                  rgbs.set(palette.slice(start, start+len), 1);
                  result.push({node:node, name:name, palette:rgbs});
                }
              }
            });
          }
          break;
        }
        node = node.right;
      }
    });
    return result;
  }

  getTilemaps(matchlen : number) : pixed.SelectableTilemap[] {
    var result = [];
    this.rootnodes.forEach((node) => {
      while (node != null) {
        if (node instanceof pixed.Palettizer) {
          var rgbimgs = node.rgbimgs;
          if (rgbimgs && rgbimgs.length >= matchlen) {
            result.push({node:node, name:"Tilemap", images:node.images, rgbimgs:rgbimgs}); // TODO
          }
        }
        node = node.right;
      }
    });
    return result;
  }
  
  isEditing() {
    return this.cureditordiv != null;
  }
  
  getCurrentEditNode() {
    return this.cureditnode;
  }

  setCurrentEditor(div:JQuery, editing:JQuery, node:pixed.PixNode) {
    const timeout = 250;
    if (this.cureditordiv != div) {
      if (this.cureditordiv) {
        this.cureditordiv.hide(timeout);
        this.cureditordiv = null;
      }
      if (div) {
        this.cureditordiv = div;
        this.cureditordiv.show();
        this.cureditordiv[0].scrollIntoView({behavior: "smooth", block: "center"});
        //setTimeout(() => { this.cureditordiv[0].scrollIntoView({behavior: "smooth", block: "center"}) }, timeout);
      }
    }
    if (this.cureditelem) {
      this.cureditelem.removeClass('selected');
      this.cureditelem = null;
    }
    if (editing) {
      this.cureditelem = editing;
      this.cureditelem.addClass('selected');
    }
    while (node.left) {
      node = node.left;
    }
    this.cureditnode = node;
  }

  scanFileTextForAssets(id : string, data : string) {
    // scan file for assets
    // /*{json}*/ or ;;{json};;
    // TODO: put before ident, look for = {
    var result = [];
    var re1 = /[/;][*;]([{].+[}])[*;][/;]/g;
    var m;
    while (m = re1.exec(data)) {
      var start = m.index + m[0].length;
      var end;
      // TODO: verilog end
      if (platform_id == 'verilog') {
        end = data.indexOf("end", start); // asm
      } else if (m[0].startsWith(';;')) {
        end = data.indexOf(';;', start); // asm
      } else {
        end = data.indexOf(';', start); // C
      }
      //console.log(id, start, end, m[1], data.substring(start,end));
      if (end > start) {
        try {
          var jsontxt = m[1].replace(/([A-Za-z]+):/g, '"$1":'); // fix lenient JSON
          var json = JSON.parse(jsontxt);
          // TODO: name?
          result.push({fileid:id,fmt:json,start:start,end:end});
        } catch (e) {
          console.log(e);
        }
      }
    }
    // look for DEF_METASPRITE_2x2(playerRStand, 0xd8, 0)
    // TODO: could also look in ROM
    var re2 = /DEF_METASPRITE_(\d+)x(\d+)[(](\w+),\s*(\w+),\s*(\w+)/gi;
    while (m = re2.exec(data)) {
      var width = parseInt(m[1]);
      var height = parseInt(m[2]);
      var ident = m[3];
      var tile = parseInt(m[4]);
      var attr = parseInt(m[5]);
      var metadefs = [];
      for (var x=0; x<width; x++) {
        for (var y=0; y<height; y++) {
          metadefs.push({x:x*8, y:y*8, tile:tile, attr:attr});
        }
      }
      var meta = {defs:metadefs,width:width*8,height:height*8};
      result.push({fileid:id,label:ident,meta:meta});
    }
    return result;
  }

  // TODO: move to pixeleditor.ts?
  addPaletteEditorViews(parentdiv:JQuery, pal2rgb:pixed.PaletteFormatToRGB, callback) {
    var adual = $('<div class="asset_dual"/>').appendTo(parentdiv);
    var aeditor = $('<div class="asset_editor"/>').hide(); // contains editor, when selected
    // TODO: they need to update when refreshed from right
    var allrgbimgs = [];
    pal2rgb.getAllColors().forEach((rgba) => { allrgbimgs.push(new Uint32Array([rgba])); }); // array of array of 1 rgb color (for picker)
    var atable = $('<table/>').appendTo(adual);
    aeditor.appendTo(adual);
    // make default layout if not exists
    var layout = pal2rgb.layout;
    if (!layout) {
      var len = pal2rgb.palette.length;
      var imgsperline = len > 32 ? 8 : 4; // TODO: use 'n'?
      layout = [];
      for (var i=0; i<len; i+=imgsperline) {
        layout.push(["", i, Math.min(len-i,imgsperline)]);
      }
    }
    function updateCell(cell, j) {
      var val = pal2rgb.words[j];
      var rgb = pal2rgb.palette[j];
      var hexcol = '#'+hex(rgb2bgr(rgb),6);
      var textcol = (rgb & 0x008000) ? 'black' : 'white';
      cell.text(hex(val,2)).css('background-color',hexcol).css('color',textcol);
    }
    // iterate over each row of the layout
    layout.forEach( ([name, start, len]) => {
      if (start < pal2rgb.palette.length) { // skip row if out of range
        var arow = $('<tr/>').appendTo(atable);
        $('<td/>').text(name).appendTo(arow);
        var inds = [];
        for (var k=start; k<start+Math.abs(len); k++)
          inds.push(k);
        if (len < 0)
          inds.reverse();
        inds.forEach( (i) => {
          var cell = $('<td/>').addClass('asset_cell asset_editable').appendTo(arow);
          updateCell(cell, i);
          cell.click((e) => {
            var chooser = new pixed.ImageChooser();
            chooser.rgbimgs = allrgbimgs;
            chooser.width = 1;
            chooser.height = 1;
            chooser.recreate(aeditor, (index, newvalue) => {
              callback(i, index);
              updateCell(cell, i);
            });
            this.setCurrentEditor(aeditor, cell, pal2rgb);
          });
        });
      }
    });
  }

  addPixelEditor(parentdiv:JQuery, firstnode:pixed.PixNode, fmt:pixed.PixelEditorImageFormat) {
    // data -> pixels
    fmt.xform = 'scale(2)';
    var mapper = new pixed.Mapper(fmt);
    // TODO: rotate node?
    firstnode.addRight(mapper);
    // pixels -> RGBA
    var palizer = new pixed.Palettizer(this, fmt);
    mapper.addRight(palizer);
    // add view objects
    palizer.addRight(new pixed.CharmapEditor(this, newDiv(parentdiv), fmt));
  }

  addPaletteEditor(parentdiv:JQuery, firstnode:pixed.PixNode, palfmt?) {
    // palette -> RGBA
    var pal2rgb = new pixed.PaletteFormatToRGB(palfmt);
    firstnode.addRight(pal2rgb);
    // TODO: refresh twice?
    firstnode.refreshRight();
    // TODO: add view objects
    // TODO: show which one is selected?
    this.addPaletteEditorViews(parentdiv, pal2rgb,
      (index, newvalue) => {
        console.log('set entry', index, '=', newvalue);
        // TODO: this forces update of palette rgb colors and file data
        firstnode.words[index] = newvalue;
        pal2rgb.words = null;
        pal2rgb.updateRight();
        pal2rgb.refreshLeft();
      });
  }

  ensureFileDiv(fileid : string) : JQuery<HTMLElement> {
    var divid = this.getFileDivId(fileid);
    var body = $(document.getElementById(divid));
    if (body.length === 0) {
      var filediv = newDiv(this.maindiv, 'asset_file');
      var header = newDiv(filediv, 'asset_file_header').text(fileid);
      body = newDiv(filediv).attr('id',divid).addClass('disable-select');
    }
    return body;
  }

  refreshAssetsInFile(fileid : string, data : FileData) : number {
    let nassets = 0;
    // TODO: check fmt w/h/etc limits
    // TODO: defer editor creation
    // TODO: only refresh when needed
    if (platform_id.startsWith('nes') && fileid.endsWith('.chr') && data instanceof Uint8Array) {
      // is this a NES CHR?
      let node = new pixed.FileDataNode(projectWindows, fileid);
      const neschrfmt = {w:8,h:8,bpp:1,count:(data.length>>4),brev:true,np:2,pofs:8,remap:[0,1,2,4,5,6,7,8,9,10,11,12]}; // TODO
      this.addPixelEditor(this.ensureFileDiv(fileid), node, neschrfmt);
      this.registerAsset("charmap", node, 1);
      nassets++;
    } else if (platform_id.startsWith('nes') && fileid.endsWith('.pal') && data instanceof Uint8Array) {
      // is this a NES PAL?
      let node = new pixed.FileDataNode(projectWindows, fileid);
      const nespalfmt = {pal:"nes",layout:"nes"};
      this.addPaletteEditor(this.ensureFileDiv(fileid), node, nespalfmt);
      this.registerAsset("palette", node, 0);
      nassets++;
    } else if (typeof data === 'string') {
      let textfrags = this.scanFileTextForAssets(fileid, data);
      for (let frag of textfrags) {
        if (frag.fmt) {
          let label = fileid; // TODO: label
          let node : pixed.PixNode = new pixed.TextDataNode(projectWindows, fileid, label, frag.start, frag.end);
          let first = node;
          // rle-compressed? TODO: how to edit?
          if (frag.fmt.comp == 'rletag') {
            node = node.addRight(new pixed.Compressor());
          }
          // is this a nes nametable?
          if (frag.fmt.map == 'nesnt') {
            node = node.addRight(new pixed.NESNametableConverter(this));
            node = node.addRight(new pixed.Palettizer(this, {w:8,h:8,bpp:4}));
            const fmt = {w:8*(frag.fmt.w||32),h:8*(frag.fmt.h||30),count:1}; // TODO: can't do custom sizes
            node = node.addRight(new pixed.MapEditor(this, newDiv(this.ensureFileDiv(fileid)), fmt));
            this.registerAsset("nametable", first, 2);
            nassets++;
          }
          // is this a bitmap?
          else if (frag.fmt.w > 0 && frag.fmt.h > 0) {
            this.addPixelEditor(this.ensureFileDiv(fileid), node, frag.fmt);
            this.registerAsset("charmap", first, 1);
            nassets++;
          }
          // is this a palette?
          else if (frag.fmt.pal) {
            this.addPaletteEditor(this.ensureFileDiv(fileid), node, frag.fmt);
            this.registerAsset("palette", first, 0);
            nassets++;
          }
          else {
            // TODO: other kinds of resources?
          }
        }
      }
    }
    return nassets;
  }

  getFileDivId(id : string) {
    return '__asset__' + safeident(id);
  }

// TODO: recreate editors when refreshing
// TODO: look for changes, not moveCursor
  refresh(moveCursor : boolean) {
    // clear and refresh all files/nodes?
    if (moveCursor) {
      this.maindiv.empty();
      this.clearAssets();
      current_project.iterateFiles((fileid, data) => {
        try {
          var nassets = this.refreshAssetsInFile(fileid, data);
        } catch (e) {
          console.log(e);
          this.ensureFileDiv(fileid).text(e+""); // TODO: error msg?
        }
      });
      console.log("Found " + this.rootnodes.length + " assets");
      this.deferrednodes.forEach((node) => {
        try {
          node.refreshRight();
        } catch (e) {
          console.log(e);
          alert(e+"");
        }
      });
      this.deferrednodes = [];
    } else {
      // only refresh nodes if not actively editing
      // since we could be in the middle of an operation that hasn't been committed
      for (var node of this.rootnodes) {
        if (node !== this.getCurrentEditNode()) {
          node.refreshRight();
        }
      }
    }
  }

  setVisible?(showing : boolean) : void {
    // TODO: make into toolbar?
    if (showing) {
      Mousetrap.bind('ctrl+z', projectWindows.undoStep.bind(projectWindows));
    } else {
      Mousetrap.unbind('ctrl+z');
    }
  }

}
