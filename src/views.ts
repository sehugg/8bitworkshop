"use strict";

import $ = require("jquery");
//import CodeMirror = require("codemirror");
import { SourceFile, WorkerError, Segment, FileData } from "./workertypes";
import { Platform, EmuState, ProfilerOutput, lookupSymbol } from "./baseplatform";
import { hex, lpad, rpad, safeident, rgb2bgr } from "./util";
import { CodeAnalyzer } from "./analysis";
import { platform, platform_id, compparams, current_project, lastDebugState, projectWindows } from "./ui";
import * as pixed from "./pixed/pixeleditor";

export interface ProjectView {
  createDiv(parent:HTMLElement, text:string) : HTMLElement;
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
};

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
  currentDebugLine : number;
  errormsgs = [];
  errorwidgets = [];
  inspectWidget;

  createDiv(parent:HTMLElement, text:string) {
    var div = document.createElement('div');
    div.setAttribute("class", "editor");
    parent.appendChild(div);
    var asmOverride = text && this.mode=='verilog' && /__asm\b([\s\S]+?)\b__endasm\b/.test(text);
    this.newEditor(div, asmOverride);
    if (text)
      this.setText(text); // TODO: this calls setCode() and builds... it shouldn't
    this.setupEditor();
    return div;
  }

  newEditor(parent:HTMLElement, isAsmOverride?:boolean) {
    var isAsm = isAsmOverride || this.mode=='6502' || this.mode =='z80' || this.mode=='jsasm' || this.mode=='gas'; // TODO
    var lineWrap = this.mode=='markdown';
    this.editor = CodeMirror(parent, {
      theme: 'mbo',
      lineNumbers: true,
      matchBrackets: true,
      tabSize: 8,
      indentAuto: true,
      lineWrapping: lineWrap,
      gutters: isAsm ? ["CodeMirror-linenumbers", "gutter-offset", "gutter-bytes", "gutter-clock", "gutter-info"]
                     : ["CodeMirror-linenumbers", "gutter-offset", "gutter-info"],
    });
  }

  setupEditor() {
    var timer;
    this.editor.on('changes', (ed, changeobj) => {
      clearTimeout(timer);
      timer = setTimeout( () => {
        current_project.updateFile(this.path, this.editor.getValue());
      }, 300);
    });
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
    //scrollProfileView(editor);
    this.editor.setOption("mode", this.mode);
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
    this.editor.setValue(text); // calls setCode()
    this.editor.clearHistory();
  }

  insertText(text:string) {
    var cur = this.editor.getCursor();
    this.editor.replaceRange(text, cur, cur);
  }

  getValue() : string {
    return this.editor.getValue();
  }

  getPath() : string { return this.path; }

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
    var numLines = this.editor.lineCount();
    errors = errors.slice(0, MAX_ERRORS);
    for (var info of errors) {
      // only mark errors with this filename, or without any filename
      if (!info.path || this.path.endsWith(info.path)) {
        var line = info.line-1;
        if (line < 0 || line >= numLines) line = 0;
        this.addErrorMarker(line, info.msg);
      }
    }
  }

  clearErrors() {
    this.editor.clearGutter("gutter-info");
    this.refreshDebugState(false);
    this.dirtylisting = true;
    // clear line widgets
    this.errormsgs = [];
    while (this.errorwidgets.length)
      this.errorwidgets.shift().clear();
  }

  getSourceFile() : SourceFile { return this.sourcefile; }

  updateListing() {
    // update editor annotations
    // TODO: recreate editor if gutter-bytes is used (verilog)
    this.editor.clearGutter("gutter-info");
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
          var opcode = parseInt(info.insns.split(" ")[0], 16);
          if (platform.getOpcodeMetadata) {
            var meta = platform.getOpcodeMetadata(opcode, info.offset);
            var clockstr = meta.minCycles+"";
            this.setGutter("gutter-clock", info.line-1, clockstr);
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

  setCurrentLine(line:number, moveCursor:boolean) {

    var addCurrentMarker = (line:number) => {
      var div = document.createElement("div");
      div.style.color = '#66ffff';
      div.appendChild(document.createTextNode("\u25b6"));
      this.editor.setGutterMarker(line, "gutter-info", div);
    }

    this.clearCurrentLine();
    if (line>0) {
      addCurrentMarker(line-1);
      if (moveCursor)
        this.editor.setSelection({line:line,ch:0}, {line:line-1,ch:0}, {scroll:true});
      this.currentDebugLine = line;
    }
  }

  clearCurrentLine() {
    if (this.currentDebugLine) {
      this.editor.clearGutter("gutter-info");
      this.editor.setSelection(this.editor.getCursor());
      this.currentDebugLine = 0;
    }
  }

  getActiveLine() {
    var state = lastDebugState;
    if (state && state.c && this.sourcefile) {
      var EPC = state.c.EPC || state.c.PC;
      var line = this.sourcefile.findLineForOffset(EPC, 15);
      return line;
    } else
      return -1;
  }

  refreshDebugState(moveCursor:boolean) {
    var line = this.getActiveLine();
    if (line >= 0) {
      this.clearCurrentLine();
      this.setCurrentLine(line, moveCursor);
      // TODO: switch to disasm?
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
    this.dirtylisting = false;
    this.updateListing();
  }

  refresh(moveCursor: boolean) {
    this.refreshListing();
    this.refreshDebugState(moveCursor);
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

  replaceSelection(start:number, end:number, text:string) {
    this.editor.setSelection(end, start);
    this.editor.replaceSelection(text);
  }

}

///

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
    var state = lastDebugState || platform.saveState();
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
        if (addr2symbol && disasm.isaddr) {
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
    var text = disassemble(pc-96, pc) + disassemble(pc, pc+96);
    this.disasmview.setValue(text);
    if (moveCursor) {
      this.disasmview.setCursor(selline, 0);
      jumpToLine(this.disasmview, selline);
    }
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
    if (lst && lst.assemblyfile && lst.assemblyfile !== this.assemblyfile) {
      this.assemblyfile = lst.assemblyfile;
    }
    else if (lst && lst.sourcefile && lst.sourcefile !== this.assemblyfile) {
      this.assemblyfile = lst.sourcefile;
    }
  }

  refresh(moveCursor: boolean) {
    this.refreshListing();
    if (!this.assemblyfile) return; // TODO?
    var state = lastDebugState || platform.saveState();
    var pc = state.c ? (state.c.EPC || state.c.PC) : 0;
    var asmtext = this.assemblyfile.text;
    var disasmview = this.getDisasmView();
    disasmview.setValue(asmtext);
    var debugging = true; // TODO: platform.isDebugging && platform.isDebugging();
    var findPC = debugging ? pc : -1;
    if (findPC >= 0 && this.assemblyfile) {
      var lineno = this.assemblyfile.findLineForOffset(findPC, 15);
      if (lineno && moveCursor) {
        // set cursor while debugging
        if (debugging)
          disasmview.setCursor(lineno-1, 0);
        jumpToLine(disasmview, lineno-1);
      }
    }
  }
}

///

// TODO: make it use debug state
// TODO: make it safe (load/restore state?)
export class MemoryView implements ProjectView {
  memorylist;
  dumplines;
  maindiv : HTMLElement;
  static IGNORE_SYMS = {s__INITIALIZER:true, /* s__GSINIT:true, */ _color_prom:true};
  recreateOnResize = true;
  /*
  read(addr:number) {
    // TODO: b offset ?
    if (lastDebugState && lastDebugState.b && addr < lastDebugState.b.length)
      return lastDebugState.b[addr];
    else
      return this.platform.readMemory(addr);
  }
  */

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
      totalRows: 0x2000,
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
    this.memorylist.scrollToItem(this.findMemoryWindowLine(addr));
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
      s += ' ' + (read!==null?hex(read,2):'??');
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
          if (MemoryView.IGNORE_SYMS[sym]) {
            ofs = nextofs;
          } else {
            while (ofs < nextofs) {
              var ofs2 = (ofs + 16) & 0xffff0;
              if (ofs2 > nextofs) ofs2 = nextofs;
              //if (ofs < 1000) console.log(ofs, ofs2, nextofs, sym);
              this.dumplines.push({a:ofs, l:ofs2-ofs, s:sym});
              ofs = ofs2;
            }
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
  memorylist;
  maindiv : HTMLElement;
  path:string;
  data:Uint8Array;
  recreateOnResize = true;

  constructor(path:string, data:Uint8Array) {
    this.path = path;
    this.data = data;
  }

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
      totalRows: ((this.data.length+15) >> 4),
      generatorFn: (row : number) => {
        var s = this.getMemoryLineAt(row);
        var linediv = document.createElement("div");
        linediv.appendChild(document.createTextNode(s));
        return linediv;
      }
    });
    $(parent).append(this.memorylist.container);
  }

  getMemoryLineAt(row : number) : string {
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
    return s;
  }

  refresh() {
  }

  getPath() { return this.path; }
}

///

export class MemoryMapView implements ProjectView {
  maindiv : JQuery;

  createDiv(parent : HTMLElement) {
    this.maindiv = newDiv(parent, 'vertical-scroll');
    return this.maindiv[0];
  }

  // TODO: overlapping segments (e.g. ROM + LC)
  addSegment(seg : Segment) {
    var offset = $('<div class="col-md-1 segment-offset"/>');
    offset.text('$'+hex(seg.start,4));
    var segdiv = $('<div class="col-md-4 segment"/>');
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
    var row = $('<div class="row"/>').append(offset, segdiv);
    var container = $('<div class="container"/>').append(row);
    this.maindiv.append(container);
    segdiv.click(() => {
      var memview = projectWindows.createOrShow('#memory') as MemoryView;
      memview.scrollToAddress(seg.start);
      // TODO: this doesn't update nav bar
    });
  }

  refresh() {
    this.maindiv.empty();
    var segments = current_project.segments;
    if (segments) {
      var curofs = 0;
      for (var seg of segments) {
        //var used = seg.last ? (seg.last-seg.start) : seg.size;
        if (seg.start > curofs)
          this.addSegment({name:'',start:curofs, size:seg.start-curofs});
        this.addSegment(seg);
        curofs = seg.start + seg.size;
      }
    }
  }

}

///

export class ProfileView implements ProjectView {
  profilelist;
  prof : ProfilerOutput;
  maindiv : HTMLElement;
  symcache : {};
  recreateOnResize = true;

  createDiv(parent : HTMLElement) {
    var div = document.createElement('div');
    div.setAttribute("class", "profiler");
    parent.appendChild(div);
    this.showMemoryWindow(parent, div);
    return this.maindiv = div;
  }

  showMemoryWindow(workspace:HTMLElement, parent:HTMLElement) {
    this.profilelist = new VirtualList({
      w: $(workspace).width(),
      h: $(workspace).height(),
      itemHeight: getVisibleEditorLineHeight(),
      totalRows: 262,
      generatorFn: (row : number) => {
        var linediv = document.createElement("div");
        this.addProfileLine(linediv, row);
        return linediv;
      }
    });
    $(parent).append(this.profilelist.container);
    this.symcache = {};
    this.tick();
  }

  addProfileLine(div : HTMLElement, row : number) : void {
    div.appendChild(createTextSpan(lpad(row+':',4), "profiler-lineno"));
    if (!this.prof) return;
    var f = this.prof.frame;
    if (!f) return;
    var l = f.lines[row];
    if (!l) return;
    var lastsym = '';
    for (var i=l.start; i<=l.end; i++) {
      var pc = f.iptab[i];
      var sym = this.symcache[pc];
      if (!sym) {
        sym = lookupSymbol(platform, pc, false);
        this.symcache[pc] = sym;
      }
      if (sym != lastsym) {
        var cls = "profiler";
        if (sym.startsWith('_')) cls = "profiler-cident";
        else if (sym.startsWith('@')) cls = "profiler-local";
        else if (/^\d*[.]/.exec(sym)) cls = "profiler-local";
        div.appendChild(createTextSpan(' '+sym, cls));
        lastsym = sym;
      }
    }
  }

  refresh() {
    this.tick();
  }

  tick() {
    if (this.profilelist) {
      $(this.maindiv).find('[data-index]').each( (i,e) => {
        var div = $(e);
        var row = parseInt(div.attr('data-index'));
        div.empty();
        this.addProfileLine(div[0], row);
      });
    }
  }

  setVisible(showing : boolean) : void {
    if (showing)
      this.prof = platform.startProfiling();
    else
      platform.stopProfiling();
  }
}

///

export class AssetEditorView implements ProjectView, pixed.EditorContext {
  maindiv : JQuery;
  cureditordiv : JQuery;
  cureditelem : JQuery;
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

  registerAsset(type:string, node:pixed.PixNode, deferred:boolean) {
    this.rootnodes.push(node);
    if (deferred) {
      this.deferrednodes.push(node);
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
          // TODO: move to node class?
          var rgbimgs = node.rgbimgs; // TODO: why is null?
          if (rgbimgs && rgbimgs.length >= matchlen) {
            result.push({node:node, name:"Tilemap", images:node.images, rgbimgs:rgbimgs}); // TODO
          }
        }
        node = node.right;
      }
    });
    return result;
  }

  setCurrentEditor(div : JQuery, editing : JQuery) {
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
        for (var k=start; k<start+len; k++)
          inds.push(k);
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
            this.setCurrentEditor(aeditor, cell);
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

  refreshAssetsInFile(fileid : string, data : FileData) : number {
    let nassets = 0;
    let filediv = $('#'+this.getFileDivId(fileid)).empty();
    // TODO: check fmt w/h/etc limits
    // TODO: defer editor creation
    // TODO: only refresh when needed
    if (fileid.endsWith('.chr') && data instanceof Uint8Array) {
      // is this a NES CHR?
      let node = new pixed.FileDataNode(projectWindows, fileid);
      const neschrfmt = {w:8,h:8,bpp:1,count:(data.length>>4),brev:true,np:2,pofs:8,remap:[0,1,2,4,5,6,7,8,9,10,11,12]}; // TODO
      this.addPixelEditor(filediv, node, neschrfmt);
      this.registerAsset("charmap", node, true);
      nassets++;
    } else if (typeof data === 'string') {
      let textfrags = this.scanFileTextForAssets(fileid, data);
      for (let frag of textfrags) {
        if (frag.fmt) {
          let label = fileid; // TODO: label
          let node : pixed.PixNode = new pixed.TextDataNode(projectWindows, fileid, label, frag.start, frag.end);
          let first = node;
          // rle-compressed?
          if (frag.fmt.comp == 'rletag') {
            node = node.addRight(new pixed.Compressor());
          }
          // is this a nes nametable?
          if (frag.fmt.map == 'nesnt') {
            node = node.addRight(new pixed.NESNametableConverter(this)); // TODO?
            node = node.addRight(new pixed.Palettizer(this, {w:8,h:8,bpp:4})); // TODO?
            const fmt = {w:8*32,h:8*30,count:1}; // TODO
            node = node.addRight(new pixed.CharmapEditor(this, newDiv(filediv), fmt));
            this.registerAsset("nametable", first, true);
            nassets++;
          }
          // is this a bitmap?
          else if (frag.fmt.w > 0 && frag.fmt.h > 0) {
            this.addPixelEditor(filediv, node, frag.fmt);
            this.registerAsset("charmap", first, true);
            nassets++;
          }
          // is this a palette?
          else if (frag.fmt.pal) {
            this.addPaletteEditor(filediv, node, frag.fmt);
            this.registerAsset("palette", first, false);
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
  refresh(moveCursor : boolean) {
    if (moveCursor) {
      this.maindiv.empty();
      this.clearAssets();
      current_project.iterateFiles((id, data) => {
        var divid = this.getFileDivId(id);
        var filediv = newDiv(this.maindiv, 'asset_file');
        var header = newDiv(filediv, 'asset_file_header').text(id);
        var body = newDiv(filediv).attr('id',divid);
        try {
          var nassets = this.refreshAssetsInFile(id, data);
          if (nassets == 0) filediv.hide();
        } catch (e) {
          console.log(e);
          filediv.text(e+""); // TODO: error msg?
        }
      });
      console.log("Found " + this.rootnodes.length + " assets");
      this.deferrednodes.forEach((node) => { node.refreshRight(); });
      this.deferrednodes = [];
    } else {
      for (var node of this.rootnodes) {
        node.refreshRight();
      }
    }
  }

// TODO: scroll editors into view

}
