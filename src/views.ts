"use strict";

// TODO: move to different namespace
var CodeMirror;
var platform;
var platform_id : string;
var compparams;
var addr2symbol : {[addr:number]:string};
var current_project;
var VirtualList;
var lastDebugState;
var pixeditframe;

// TODO: functions
var inspectVariable;
var jumpToLine;

// TODO: remove some calls of global functions
function SourceEditor(path, mode) {
  var self = this;
  var editor;
  var dirtylisting = true;
  var sourcefile;
  var currentDebugLine;
  
  self.createDiv = function(parent, text) {
    var div = document.createElement('div');
    div.setAttribute("class", "editor");
    parent.appendChild(div);
    newEditor(div);
    if (text)
      self.setText(text); // TODO: this calls setCode() and builds... it shouldn't
    return div;
  }

  function newEditor(parent) {
    var isAsm = mode=='6502' || mode =='z80' || mode=='verilog' || mode=='gas'; // TODO
    editor = CodeMirror(parent, {
      theme: 'mbo',
      lineNumbers: true,
      matchBrackets: true,
      tabSize: 8,
      indentAuto: true,
      gutters: isAsm ? ["CodeMirror-linenumbers", "gutter-offset", "gutter-bytes", "gutter-clock", "gutter-info"]
                     : ["CodeMirror-linenumbers", "gutter-offset", "gutter-info"],
    });
    var timer;
    editor.on('changes', function(ed, changeobj) {
      clearTimeout(timer);
      timer = setTimeout(function() {
        current_project.updateFile(path, editor.getValue(), false);
      }, 200);
    });
    editor.on('cursorActivity', function(ed) {
      var start = editor.getCursor(true);
      var end = editor.getCursor(false);
      if (start.line == end.line && start.ch < end.ch) {
        var name = editor.getSelection();
        inspectVariable(editor, name);
      } else {
        inspectVariable(editor);
      }
    });
    //scrollProfileView(editor);
    editor.setOption("mode", mode);
  }

  self.setText = function(text) {
    editor.setValue(text); // calls setCode()
    editor.clearHistory();
  }
  
  self.getValue = function() {
    return editor.getValue();
  }
  
  self.getPath = function() { return path; }

  var lines2errmsg = [];
  self.addErrorMarker = function(line, msg) {
    var div = document.createElement("div");
    div.setAttribute("class", "tooltipbox tooltiperror");
    div.appendChild(document.createTextNode("\u24cd"));
    var tooltip = document.createElement("span");
    tooltip.setAttribute("class", "tooltiptext");
    if (lines2errmsg[line])
      msg = lines2errmsg[line] + "\n" + msg;
    tooltip.appendChild(document.createTextNode(msg));
    lines2errmsg[line] = msg;
    div.appendChild(tooltip);
    editor.setGutterMarker(line, "gutter-info", div);
  }
  
  self.markErrors = function(errors) {
    // TODO: move cursor to error line if offscreen?
    self.clearErrors();
    var numLines = editor.lineCount();
    for (var info of errors) {
      // only mark errors with this filename, or without any filename
      if (!info.path || path.endsWith(info.path)) {
        var line = info.line-1;
        if (line < 0 || line >= numLines) line = 0;
        self.addErrorMarker(line, info.msg);
      }
    }
  }
  
  self.clearErrors = function() {
    editor.clearGutter("gutter-info");
    refreshDebugState();
    dirtylisting = true;
  }
  
  self.getSourceFile = function() { return sourcefile; }

  // TODO: update gutter only when refreshing this window
  self.updateListing = function(_sourcefile) {
    sourcefile = _sourcefile;
    // update editor annotations
    editor.clearGutter("gutter-info");
    editor.clearGutter("gutter-bytes");
    editor.clearGutter("gutter-offset");
    editor.clearGutter("gutter-clock");
    var lstlines = sourcefile.lines || [];
    for (var info of lstlines) {
      if (info.offset >= 0) {
        var textel = document.createTextNode(hex(info.offset,4));
        editor.setGutterMarker(info.line-1, "gutter-offset", textel);
      }
      if (info.insns) {
        var insnstr = info.insns.length > 9 ? ("...") : info.insns;
        var textel = document.createTextNode(insnstr);
        editor.setGutterMarker(info.line-1, "gutter-bytes", textel);
        if (info.iscode) {
          var opcode = parseInt(info.insns.split()[0], 16);
          if (platform.getOpcodeMetadata) {
            var meta = platform.getOpcodeMetadata(opcode, info.offset);
            var clockstr = meta.minCycles+"";
            var textel = document.createTextNode(clockstr);
            editor.setGutterMarker(info.line-1, "gutter-clock", textel);
          }
        }
      }
    }
  }
  
  self.setGutterBytes = function(line, s) {
    var textel = document.createTextNode(s);
    editor.setGutterMarker(line-1, "gutter-bytes", textel);
  }
  
  self.setCurrentLine = function(line) {
    function addCurrentMarker(line) {
      var div = document.createElement("div");
      div.style.color = '#66ffff';
      div.appendChild(document.createTextNode("\u25b6"));
      editor.setGutterMarker(line, "gutter-info", div);
    }
    self.clearCurrentLine();
    if (line>0) {
      addCurrentMarker(line-1);
      editor.setSelection({line:line,ch:0}, {line:line-1,ch:0}, {scroll:true});
      currentDebugLine = line;
    }
  }

  self.clearCurrentLine = function() {
    if (currentDebugLine) {
      editor.clearGutter("gutter-info");
      editor.setSelection(editor.getCursor());
      currentDebugLine = 0;
    }
  }
  
  function refreshDebugState() {
    self.clearCurrentLine();
    var state = lastDebugState;
    if (state && state.c) {
      var PC = state.c.PC;
      var line = sourcefile.findLineForOffset(PC);
      if (line >= 0) {
        self.setCurrentLine(line);
        // TODO: switch to disasm?
      }
    }
  }
  
  function refreshListing() {
    if (!dirtylisting) return;
    dirtylisting = false;
    var lst = current_project.getListingForFile(path);
    if (lst && lst.sourcefile) {
      self.updateListing(lst.sourcefile); // updates sourcefile variable
    }
  }

  self.refresh = function() {
    refreshListing();
    refreshDebugState();
  }
  
  self.getLine = function(line) {
    return editor.getLine(line-1);
  }
  
  self.getCurrentLine = function() {
    return editor.getCursor().line+1;
  }
  
  self.getCursorPC = function() {
    var line = self.getCurrentLine();
    while (sourcefile && line >= 0) {
      var pc = sourcefile.line2offset[line];
      if (pc >= 0) return pc;
      line--;
    }
    return -1;
  }

  // bitmap editor (TODO: refactor)

  function handleWindowMessage(e) { 
    //console.log("window message", e.data);
    if (e.data.bytes) {
      editor.replaceSelection(e.data.bytestr);
    }
    if (e.data.close) {
      $("#pixeditback").hide();
    }
  }

  function openBitmapEditorWithParams(fmt, bytestr, palfmt, palstr) {
    $("#pixeditback").show();
    window.addEventListener("message", handleWindowMessage, false); // TODO: remove listener
    pixeditframe.contentWindow.postMessage({fmt:fmt, bytestr:bytestr, palfmt:palfmt, palstr:palstr}, '*');
  }

  function lookBackwardsForJSONComment(line, req) {
    var re = /[/;][*;]([{].+[}])[*;][/;]/;
    while (--line >= 0) {
      var s = editor.getLine(line);
      var m = re.exec(s);
      if (m) {
        var jsontxt = m[1].replace(/([A-Za-z]+):/g, '"$1":'); // fix lenient JSON
        var obj = JSON.parse(jsontxt);
        if (obj[req]) {
          var start = {obj:obj, line:line, ch:s.indexOf(m[0])+m[0].length};
          var line0 = line;
          var pos0 = start.ch;
          line--;
          while (++line < editor.lineCount()) {
            var l = editor.getLine(line);
            var endsection;
            if (platform_id == 'verilog')
              endsection = l.indexOf('end') >= pos0;
            else
              endsection = l.indexOf(';') >= pos0;
            if (endsection) {
              var end = {line:line, ch:editor.getLine(line).length};
              return {obj:obj, start:start, end:end};
            }
            pos0 = 0;
          }
          line = line0;
        }
      }
    }
  }

  self.openBitmapEditorAtCursor = function() {
    if ($("#pixeditback").is(":visible")) {
      $("#pixeditback").hide(250);
      return;
    }
    var line = editor.getCursor().line + 1;
    var data = lookBackwardsForJSONComment(self.getCurrentLine(), 'w');
    if (data && data.obj && data.obj.w>0 && data.obj.h>0) {
      var paldata = lookBackwardsForJSONComment(data.start.line-1, 'pal');
      var palbytestr;
      if (paldata) {
        palbytestr = editor.getRange(paldata.start, paldata.end);
        paldata = paldata.obj;
      }
      editor.setSelection(data.end, data.start);
      openBitmapEditorWithParams(data.obj, editor.getSelection(), paldata, palbytestr);
    } else {
      alert("To edit graphics, move cursor to a constant array preceded by a comment in the format:\n\n/*{w:,h:,bpp:,count:...}*/\n\n(See code examples)");
    }
  }
}

///

function DisassemblerView() {
  var self = this;
  var disasmview;
  
  self.getDisasmView = function() { return disasmview; }
 
  self.createDiv = function(parent) {
    var div = document.createElement('div');
    div.setAttribute("class", "editor");
    parent.appendChild(div);
    newEditor(div);
    return div;
  }
  
  function newEditor(parent) {
    disasmview = CodeMirror(parent, {
      mode: 'z80', // TODO: pick correct one
      theme: 'cobalt',
      tabSize: 8,
      readOnly: true,
      styleActiveLine: true
    });
  }

  // TODO: too many globals
  self.refresh = function() {
    var state = lastDebugState || platform.saveState();
    var pc = state.c ? state.c.PC : 0;
    var curline = 0;
    var selline = 0;
    // TODO: not perfect disassembler
    function disassemble(start, end) {
      if (start < 0) start = 0;
      if (end > 0xffff) end = 0xffff;
      // TODO: use pc2visits
      var a = start;
      var s = "";
      while (a < end) {
        var disasm = platform.disassemble(a, platform.readAddress);
        /* TODO: look thru all source files
        var srclinenum = sourcefile && sourcefile.offset2line[a];
        if (srclinenum) {
          var srcline = getActiveEditor().getLine(srclinenum);
          if (srcline && srcline.trim().length) {
            s += "; " + srclinenum + ":\t" + srcline + "\n";
            curline++;
          }
        }
        */
        var bytes = "";
        for (var i=0; i<disasm.nbytes; i++)
          bytes += hex(platform.readAddress(a+i));
        while (bytes.length < 14)
          bytes += ' ';
        var dline = hex(parseInt(a)) + "\t" + bytes + "\t" + disasm.line + "\n";
        s += dline;
        if (a == pc) selline = curline;
        curline++;
        a += disasm.nbytes || 1;
      }
      return s;
    }
    var text = disassemble(pc-96, pc) + disassemble(pc, pc+96);
    disasmview.setValue(text);
    disasmview.setCursor(selline, 0);
    jumpToLine(disasmview, selline);
  }

  self.getCursorPC = function() {
    var line = disasmview.getCursor().line;
    if (line >= 0) {
      var toks = disasmview.getLine(line).split(/\s+/);
      if (toks && toks.length >= 1) {
        var pc = parseInt(toks[0], 16);
        if (pc >= 0) return pc;
      }
    }
    return -1;
  }
}

///

function ListingView(assemblyfile) {
  var self = this;
  this.__proto__ = new DisassemblerView();

  self.refresh = function() {
    var state = lastDebugState || platform.saveState();
    var pc = state.c ? state.c.PC : 0;
    var asmtext = assemblyfile.text;
    var disasmview = self.getDisasmView();
    if (platform_id == 'base_z80') { // TODO
      asmtext = asmtext.replace(/[ ]+\d+\s+;.+\n/g, '');
      asmtext = asmtext.replace(/[ ]+\d+\s+.area .+\n/g, '');
    }
    disasmview.setValue(asmtext);
    var findPC = platform.getDebugCallback() ? pc : -1;
    if (findPC >= 0) {
      var lineno = assemblyfile.findLineForOffset(findPC);
      if (lineno) {
        // set cursor while debugging
        if (platform.getDebugCallback())
          disasmview.setCursor(lineno-1, 0);
        jumpToLine(disasmview, lineno-1);
      }
    }
  }
}

///

function MemoryView() {
  var self = this;
  var memorylist;
  var dumplines;
  var div;

  // TODO?
  function getVisibleEditorLineHeight() {
    return $(".CodeMirror-line:visible").first().height();
  }

  self.createDiv = function(parent) {
    div = document.createElement('div');
    div.setAttribute("class", "memdump");
    parent.appendChild(div);
    showMemoryWindow(div);
    return div;
  }
  
  function showMemoryWindow(parent) {
    memorylist = new VirtualList({
      w:$("#workspace").width(),
      h:$("#workspace").height(),
      itemHeight: getVisibleEditorLineHeight(),
      totalRows: 0x1000,
      generatorFn: function(row) {
        var s = getMemoryLineAt(row);
        var div = document.createElement("div");
        if (dumplines) {
          var dlr = dumplines[row];
          if (dlr) div.classList.add('seg_' + getMemorySegment(dumplines[row].a));
        }
        div.appendChild(document.createTextNode(s));
        return div;
      }
    });
    $(parent).append(memorylist.container);
    self.tick();
    if (compparams && dumplines)
      memorylist.scrollToItem(findMemoryWindowLine(compparams.data_start));
  }
  
  self.tick = function() {
    if (memorylist) {
      $(div).find('[data-index]').each(function(i,e) {
        var div = $(e);
        var row = div.attr('data-index');
        var oldtext = div.text();
        var newtext = getMemoryLineAt(row);
        if (oldtext != newtext)
          div.text(newtext);
      });
    }
  }

  function getMemoryLineAt(row) {
    var offset = row * 16;
    var n1 = 0;
    var n2 = 16;
    var sym;
    if (getDumpLines()) {
      var dl = dumplines[row];
      if (dl) {
        offset = dl.a & 0xfff0;
        n1 = dl.a - offset;
        n2 = n1 + dl.l;
        sym = dl.s;
      } else {
        return '.';
      }
    }
    var s = hex(offset,4) + ' ';
    for (var i=0; i<n1; i++) s += '   ';
    if (n1 > 8) s += ' ';
    for (var i=n1; i<n2; i++) {
      var read = platform.readAddress(offset+i);
      if (i==8) s += ' ';
      s += ' ' + (read>=0?hex(read,2):'??');
    }
    for (var i=n2; i<16; i++) s += '   ';
    if (sym) s += '  ' + sym;
    return s;
  }

  function getDumpLineAt(line) {
    var d = dumplines[line];
    if (d) {
      return d.a + " " + d.s;
    }
  }

  var IGNORE_SYMS = {s__INITIALIZER:true, /* s__GSINIT:true, */ _color_prom:true};

  // TODO: addr2symbol for ca65; and make it work without symbols
  function getDumpLines() {
    if (!dumplines && addr2symbol) {
      dumplines = [];
      var ofs = 0;
      var sym;
      for (const _nextofs of Object.keys(addr2symbol)) { 
        var nextofs = parseInt(_nextofs); // convert from string (stupid JS)
        var nextsym = addr2symbol[nextofs];
        if (sym) {
          if (IGNORE_SYMS[sym]) {
            ofs = nextofs;
          } else {
            while (ofs < nextofs) {
              var ofs2 = (ofs + 16) & 0xffff0;
              if (ofs2 > nextofs) ofs2 = nextofs;
              //if (ofs < 1000) console.log(ofs, ofs2, nextofs, sym);
              dumplines.push({a:ofs, l:ofs2-ofs, s:sym});
              ofs = ofs2;
            }
          }
        }
        sym = nextsym;
      }
    }
    return dumplines;
  }

  function getMemorySegment(a) {
    if (!compparams) return 'unknown';
    if (a >= compparams.data_start && a < compparams.data_start+compparams.data_size) {
      if (platform.getSP && a >= platform.getSP() - 15)
        return 'stack';
      else
        return 'data';
    }
    else if (a >= compparams.code_start && a < compparams.code_start+compparams.code_size)
      return 'code';
    else
      return 'unknown';
  }

  function findMemoryWindowLine(a) {
    for (var i=0; i<dumplines.length; i++)
      if (dumplines[i].a >= a)
        return i;
  }
}

