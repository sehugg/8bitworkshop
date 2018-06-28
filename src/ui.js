"use strict";

// catch errors
function installErrorHandler() {
  if (typeof window.onerror == "object") {
      window.onerror = function (msgevent, url, line, col, error) {
        console.log(msgevent, url, line, col);
        console.log(error);
        if (window.location.host.endsWith('8bitworkshop.com')) {
          ga('send', 'exception', {
            'exDescription': msgevent + " " + url + " " + " " + line + ":" + col + ", " + error,
            'exFatal': true
          });
        }
        alert(msgevent+"");
      };
  }
}

function uninstallErrorHandler() {
  window.onerror = null;
}

function gotoNewLocation() {
  uninstallErrorHandler();
  window.location = "?" + $.param(qs);
}

// make sure VCS doesn't start
if (window.Javatari) Javatari.AUTO_START = false;

// 8bitworkshop IDE user interface

var PRESETS; // presets array
var platform_id;
var platform; // platform object
var originalFileID;
var originalText;
var userPaused;

var toolbar = $("#controls_top");

var SourceFile = function(lines, text) {
  lines = lines || [];
  this.lines = lines;
  this.text = text;
  this.offset2line = {};
  this.line2offset = {};
  for (var info of lines) {
    if (info.offset >= 0) {
      this.offset2line[info.offset] = info.line;
      this.line2offset[info.line] = info.offset;
    }
  }
  this.findLineForOffset = function(PC) {
    if (this.offset2line) {
      for (var i=0; i<16; i++) {
        var line = this.offset2line[PC];
        if (line >= 0) {
          return line;
        }
        PC--;
      }
    }
    return 0;
  }
  this.lineCount = function() { return this.line2offset.length; }
}

var TOOL_TO_SOURCE_STYLE = {
  'dasm': '6502',
  'acme': '6502',
  'cc65': 'text/x-csrc',
  'ca65': '6502',
  'z80asm': 'z80',
  'sdasz80': 'z80',
  'sdcc': 'text/x-csrc',
  'verilator': 'verilog',
  'jsasm': 'z80'
}

var worker = new Worker("./src/worker/workermain.js");
var editor;
var current_output;
var current_preset_entry;
var current_file_id;
var assemblyfile;
var sourcefile;
var symbolmap;
var addr2symbol;
var compparams;
var trace_pending_at_pc;
var store;
var pendingWorkerMessages = 0;
var disasmview = CodeMirror(document.getElementById('disassembly'), {
  mode: 'z80',
  theme: 'cobalt',
  tabSize: 8,
  readOnly: true,
  styleActiveLine: true
});
//scrollProfileView(disasmview);

var currentDebugLine;
var lastDebugInfo;
var lastDebugState;

var memorylist;

function newEditor(mode) {
  var isAsm = mode=='6502' || mode =='z80' || mode=='verilog' || mode=='gas'; // TODO
  editor = CodeMirror(document.getElementById('editor'), {
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
      setCode(editor.getValue());
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

function inspectVariable(ed, name) {
  var val;
  if (platform.inspect) {
    platform.inspect(name);
  }
}

function getCurrentPresetTitle() {
  if (!current_preset_entry)
    return "ROM";
  else
    return current_preset_entry.title || current_preset_entry.name || "ROM";
}

function setLastPreset(id) {
  if (platform_id != 'base_z80') { // TODO
    localStorage.setItem("__lastplatform", platform_id);
    localStorage.setItem("__lastid_"+platform_id, id);
  }
}

function updatePreset(fileid, text) {
  // TODO: do we have to save all Verilog thingies?
  if (text.trim().length &&
    (originalFileID != fileid || text != originalText || platform_id=='verilog')) {
    store.setItem(fileid, text);
  }
}

function loadCode(text, fileid) {
  var tool = platform.getToolForFilename(fileid);
  newEditor(tool && TOOL_TO_SOURCE_STYLE[tool]);
  editor.setValue(text); // calls setCode()
  editor.clearHistory();
  current_output = null;
  setLastPreset(fileid);
  originalFileID = fileid;
  originalText = text;
}

function loadFile(fileid, filename, preset) {
  current_file_id = fileid;
  current_preset_entry = preset;
  store.getItem(fileid, function(err, text) {
    if (err) console.log(err);
    if (!text) text = '';
    if (text) {
      loadCode(text, fileid);
    } else if (!text && preset) {
      if (filename.indexOf('.') <= 0)
        filename += ".a"; // TODO?
      console.log("Loading preset", fileid, filename, preset);
      if (text.length == 0) {
        console.log("Fetching", filename);
        $.get( filename, function( text ) {
          console.log("GET",text.length,'bytes');
          loadCode(text, fileid);
        }, 'text')
        .fail(function() {
          alert("Could not load preset " + fileid);
          loadCode("", fileid);
        });
      }
    } else {
      var ext = platform.getToolForFilename(fileid);
      $.get( "presets/"+platform_id+"/skeleton."+ext, function( text ) {
        loadCode(text, fileid);
      }, 'text')
      .fail(function() {
        alert("Could not load skeleton for " + platform_id + "/" + ext);
        loadCode("", fileid);
      });
    }
  });
}

function loadPreset(preset_id) {
  // TODO
  var index = parseInt(preset_id+"");
  for (var i=0; i<PRESETS.length; i++)
    if (PRESETS[i].id == preset_id)
      index = i;
  index = (index + PRESETS.length) % PRESETS.length;
  if (index >= 0) {
    // load the preset
    loadFile(preset_id, "presets/" + platform_id + "/" + PRESETS[index].id, PRESETS[index]);
  } else {
    // no preset found? load local
    loadFile(preset_id, "local/" + platform_id + "/" + preset_id);
  }
}

function gotoPresetAt(index) {
  var index = (index + PRESETS.length) % PRESETS.length;
  qs['file'] = PRESETS[index].id;
  gotoNewLocation();
}

function gotoPresetNamed(id) {
  qs['platform'] = platform_id;
  qs['file'] = id;
  gotoNewLocation();
}

function _createNewFile(e) {
  var filename = prompt("Create New File", "newfile" + platform.getDefaultExtension());
  if (filename && filename.length) {
    if (filename.indexOf(".") < 0) {
      filename += platform.getDefaultExtension();
    }
    qs['file'] = "local/" + filename;
    gotoNewLocation();
  }
  return true;
}

function _uploadNewFile(e) {
  $("#uploadFileElem").click();
}

function handleFileUpload(files) {
  console.log(files);
  var index = 0;
  function uploadNextFile() { 
    var f = files[index++];
    if (!f) {
      console.log("Done uploading");
      gotoNewLocation();
    } else {
      var path = "local/" + f.name;
      var reader = new FileReader();
      reader.onload = function(e) {
        var data = e.target.result;
        store.setItem(path, data, function(err, result) {
          if (err)
            console.log(err);
          else {
            console.log("Uploaded " + path + " " + data.length + " bytes");
            if (index == 1)
              qs['file'] = path;
            uploadNextFile();
          }
        });
      }
      reader.readAsText(f);
    }
  }
  if (files) uploadNextFile();
}

function getCurrentFilename() {
  var toks = current_file_id.split("/");
  return toks[toks.length-1];
}

function _shareFile(e) {
  if (current_output == null) {
    alert("Please fix errors before sharing.");
    return true;
  }
  var github = new Octokat();
  var files = {};
  var text = editor.getValue();
  files[getCurrentFilename()] = {"content": text};
  var gistdata = {
    "description": '8bitworkshop.com {"platform":"' + platform_id + '"}',
    "public": true,
    "files": files
  };
  var gist = github.gists.create(gistdata).done(function(val) {
    var url = "http://8bitworkshop.com/?sharekey=" + val.id;
    window.prompt("Copy link to clipboard (Ctrl+C, Enter)", url);
  }).fail(function(err) {
    alert("Error sharing file: " + err.message);
  });
  return true;
}

function _resetPreset(e) {
  if (!current_preset_entry) {
    alert("Can only reset built-in file examples.")
  } else if (confirm("Reset '" + current_preset_entry.name + "' to default?")) {
    qs['reset'] = '1';
    gotoNewLocation();
  }
  return true;
}

function _downloadROMImage(e) {
  if (current_output == null) {
    alert("Please fix errors before downloading ROM.");
    return true;
  }
  var blob = new Blob([current_output], {type: "application/octet-stream"});
  saveAs(blob, getCurrentFilename()+".rom");
}

function _downloadSourceFile(e) {
  var blob = new Blob([editor.getValue()], {type: "text/plain;charset=utf-8"});
  saveAs(blob, getCurrentFilename());
}

function populateExamples(sel) {
  // make sure to use callback so it follows other sections
  store.length(function(err, len) {
    sel.append($("<option />").text("--------- Examples ---------").attr('disabled',true));
    for (var i=0; i<PRESETS.length; i++) {
      var preset = PRESETS[i];
      var name = preset.chapter ? (preset.chapter + ". " + preset.name) : preset.name;
      sel.append($("<option />").val(preset.id).text(name).attr('selected',preset.id==current_file_id));
    }
  });
}

function populateFiles(sel, category, prefix) {
  store.keys(function(err, keys) {
    var foundSelected = false;
    var numFound = 0;
    if (!keys) keys = [];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key.startsWith(prefix)) {
        if (numFound++ == 0)
          sel.append($("<option />").text("------- " + category + " -------").attr('disabled',true));
        var name = key.substring(prefix.length);
        sel.append($("<option />").val(key).text(name).attr('selected',key==current_file_id));
        if (key == current_file_id) foundSelected = true;
      }
    }
    if (!foundSelected && current_file_id && current_file_id.startsWith(prefix)) {
      var name = current_file_id.slice(prefix.length);
      var key = prefix + name;
      sel.append($("<option />").val(key).text(name).attr('selected',true));
    }
  });
}

function updateSelector() {
  var sel = $("#preset_select").empty();
  if (platform_id != 'base_z80') { // TODO
    populateFiles(sel, "Local Files", "local/");
    populateFiles(sel, "Shared", "shared/");
  }
  populateExamples(sel);
  // set click handlers
  sel.off('change').change(function(e) {
    gotoPresetNamed($(this).val());
  });
}

function loadFileDependencies(text, callback) {
  var filenames = [];
  if (platform_id == 'verilog') {
    var re = /^(`include|[.]include)\s+"(.+?)"/gm;
    var m;
    while (m = re.exec(text)) {
      filenames.push(m[2]);
    }
  }
  var result = [];
  function loadNextDependency() {
    var fn = filenames.shift();
    if (!fn) {
      callback(result);
    } else {
      store.getItem(fn, function(err, value) {
        result.push({
          filename:fn,
          prefix:platform_id,
          text:value // might be null, that's ok
        });
        loadNextDependency();
      });
    }
  }
  loadNextDependency(); // load first dependency
}

function setCode(text) {
  if (pendingWorkerMessages++ > 0)
    return;
  toolbar.addClass("is-busy");
  $('#compile_spinner').css('visibility', 'visible');
  loadFileDependencies(text, function(depends) {
    worker.postMessage({
      code:text,
      dependencies:depends,
      platform:platform_id,
      tool:platform.getToolForFilename(current_file_id)
    });
  });
}

function setCompileOutput(data) {
  if (data.unchanged) return;
  // TODO: kills current selection
  // choose first listing (TODO:support multiple source files)
  sourcefile = null;
  assemblyfile = null;
  if (data.listings) {
    var lst;
    for (var lstname in data.listings) {
      lst = data.listings[lstname];
      break;
    }
    if (lst) {
      sourcefile = new SourceFile(lst.lines);
      if (lst.asmlines) {
        assemblyfile = new SourceFile(lst.asmlines, lst.text);
      }
    }
  }
  if (!sourcefile)  sourcefile = new SourceFile();
  symbolmap = data.symbolmap;
  addr2symbol = invertMap(symbolmap);
  addr2symbol[0x10000] = '__END__'; // TODO?
  compparams = data.params;
  updatePreset(current_file_id, editor.getValue()); // update persisted entry
  // errors?
  var lines2errmsg = [];
  function addErrorMarker(line, msg) {
    var div = document.createElement("div");
    div.setAttribute("class", "tooltipbox tooltiperror");
    div.style.color = '#ff3333'; // TODO
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
  if (data.errors && data.errors.length > 0) {
    // TODO: move cursor to error line if offscreen?
    toolbar.addClass("has-errors");
    editor.clearGutter("gutter-info");
    var numLines = editor.lineCount();
    for (info of data.errors) {
      var line = info.line-1;
      if (line < 0 || line >= numLines) line = numLines-1;
      addErrorMarker(line, info.msg);
    }
    current_output = null;
  } else {
    // load ROM
    // TODO: don't have to compare anymore; worker does it
    var rom = data.output;
    var rom_changed = false;
    if (rom && rom.code)
      rom_changed = !current_output || rom.code != current_output.code;
    else if (rom)
      rom_changed = !arrayCompare(rom, current_output);
    if (rom_changed) {
      try {
        //console.log("Loading ROM length", rom.length);
        platform.loadROM(getCurrentPresetTitle(), rom);
        if (!userPaused) resume();
        current_output = rom;
        //resetProfiler();
        toolbar.removeClass("has-errors");
      } catch (e) {
        console.log(e); // TODO: show error
        toolbar.addClass("has-errors");
        addErrorMarker(0, e+"");
        current_output = null;
      }
    } else if (rom.program_rom_variable) { //TODO: a little wonky...
      platform.loadROM(rom.program_rom_variable, rom.program_rom);
      rom_changed = true;
    }
    if (rom_changed || trace_pending_at_pc) {
      // update editor annotations
      // TODO: do incrementally for performance
      editor.clearGutter("gutter-info");
      editor.clearGutter("gutter-bytes");
      editor.clearGutter("gutter-offset");
      editor.clearGutter("gutter-clock");
      // TODO: support multiple files
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
    updateDisassembly();
    if (trace_pending_at_pc) {
      showLoopTimingForPC(trace_pending_at_pc);
    }
  }
  trace_pending_at_pc = null;
}

worker.onmessage = function(e) {
  toolbar.removeClass("is-busy");
  $('#compile_spinner').css('visibility', 'hidden');
  if (pendingWorkerMessages > 1) {
    pendingWorkerMessages = 0;
    setCode(editor.getValue());
  } else {
    pendingWorkerMessages = 0;
  }
  setCompileOutput(e.data);
}

function setCurrentLine(line) {
  function addCurrentMarker(line) {
    var div = document.createElement("div");
    div.style.color = '#66ffff'; // TODO
    div.appendChild(document.createTextNode("\u25b6"));
    editor.setGutterMarker(line, "gutter-info", div);
  }
  clearCurrentLine();
  if (line>0) {
    addCurrentMarker(line-1);
    editor.setSelection({line:line,ch:0}, {line:line-1,ch:0}, {scroll:true});
    currentDebugLine = line;
  }
}

function clearCurrentLine() {
  if (currentDebugLine) {
    editor.clearGutter("gutter-info");
    editor.setSelection(editor.getCursor()); // TODO??
    currentDebugLine = 0;
  }
}

function showMemory(state) {
  var s = state && platform.cpuStateToLongString && platform.cpuStateToLongString(state.c);
  if (s) {
    if (platform.getRasterPosition) {
      var pos = platform.getRasterPosition();
      s += "H:" + pos.x + "  V:" + pos.y + "\n"; // TODO: padding
    }
    if (platform.ramStateToLongString) {
      s += platform.ramStateToLongString(state);
    }
    var hs = lastDebugInfo ? highlightDifferences(lastDebugInfo, s) : s;
    $("#mem_info").show().html(hs);
    lastDebugInfo = s;
  } else {
    $("#mem_info").hide();
    lastDebugInfo = null;
  }
}

function setupBreakpoint() {
  // TODO
  platform.setupDebug(function(state) {
    lastDebugState = state;
    if (state.c) {
      var PC = state.c.PC;
      var line = sourcefile.findLineForOffset(PC);
      if (line >= 0) {
        console.log("BREAKPOINT", hex(PC), line);
        setCurrentLine(line);
      } else {
        console.log("BREAKPOINT", hex(PC));
        // TODO: switch to disasm
      }
    }
    showMemory(state);
    updateDisassembly();
  });
}

function _pause() {
  if (platform.isRunning()) {
    platform.pause();
    console.log("Paused");
  }
  $("#dbg_pause").addClass("btn_stopped");
  $("#dbg_go").removeClass("btn_active");
}

function pause() {
  clearBreakpoint();
  _pause();
  userPaused = true;
}

function _resume() {
  if (! platform.isRunning()) {
    platform.resume();
    console.log("Resumed");
  }
  $("#dbg_pause").removeClass("btn_stopped");
  $("#dbg_go").addClass("btn_active");
}

function resume() {
  clearBreakpoint();
  if (! platform.isRunning() ) {
    clearCurrentLine();
  }
  _resume();
  userPaused = false;
}

function singleStep() {
  setupBreakpoint();
  platform.step();
}

function singleFrameStep() {
  setupBreakpoint();
  platform.runToVsync();
}

function getCurrentLine() {
  return editor.getCursor().line+1;
}

function getDisasmViewPC() {
  var line = disasmview.getCursor().line;
  if (line >= 0) {
    var toks = disasmview.getLine(line).split(/\s+/);
    if (toks && toks[0].length == 4) {
      return parseInt(toks[0], 16);
    }
  }
}

function getCurrentPC() {
  var line = getCurrentLine();
  while (line >= 0) {
    // TODO: what if in disassembler?
    var pc = sourcefile.line2offset[line];
    if (pc >= 0) return pc;
    line--;
  }
  return getDisasmViewPC();
}

function runToCursor() {
  setupBreakpoint();
  var pc = getCurrentPC();
  if (pc >= 0) {
    console.log("Run to", pc.toString(16));
    if (platform.runToPC) {
      platform.runToPC(pc);
    } else {
      platform.runEval(function(c) {
        return c.PC == pc;
      });
    }
  }
}

function runUntilReturn() {
  setupBreakpoint();
  platform.runUntilReturn();
}

function runStepBackwards() {
  setupBreakpoint();
  platform.stepBack();
}

function clearBreakpoint() {
  lastDebugState = null;
  if (platform.clearDebug) platform.clearDebug();
  showMemory();
}

function jumpToLine(ed, i) {
    var t = ed.charCoords({line: i, ch: 0}, "local").top;
    var middleHeight = ed.getScrollerElement().offsetHeight / 2;
    ed.scrollTo(null, t - middleHeight - 5);
}

function getVisibleSourceFile() {
  var div = $("#disassembly");
  return div.is(':visible') ? assemblyfile : sourcefile;
}

function updateDisassembly() {
  var div = $("#disassembly");
  if (div.is(':visible')) {
    var state = lastDebugState || platform.saveState();
    var pc = state.c ? state.c.PC : 0;
    // do we have an assembly listing?
    if (assemblyfile && assemblyfile.text) {
      var asmtext = assemblyfile.text;
      if (platform_id == 'base_z80') { // TODO
        asmtext = asmtext.replace(/[ ]+\d+\s+;.+\n/g, '');
        asmtext = asmtext.replace(/[ ]+\d+\s+.area .+\n/g, '');
      }
      disasmview.setValue(asmtext);
      var findPC = platform.getDebugCallback() ? pc : getCurrentPC();
      if (findPC) {
        var lineno = assemblyfile.findLineForOffset(findPC);
        if (lineno) {
          // set cursor while debugging
          if (platform.getDebugCallback()) disasmview.setCursor(lineno-1, 0);
          jumpToLine(disasmview, lineno-1);
          return; // success, don't disassemble in next step
        }
      }
    }
    // fall through to platform disassembler?
    if (platform.disassemble) {
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
          var srclinenum = sourcefile.offset2line[a];
          if (srclinenum) {
            var srcline = editor.getLine(srclinenum-1);
            if (srcline && srcline.trim().length) {
              s += "; " + srclinenum + ":\t" + srcline + "\n";
              curline++;
            }
          }
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
    } else if (current_output && current_output.code) {
      // show verilog javascript
      disasmview.setValue(current_output.code);
    }
  }
}

function toggleDisassembly() {
  $("#disassembly").toggle();
  $("#editor").toggle();
  updateDisassembly();
  //if (profilelist) createProfileWindow();
}

function resetAndDebug() {
  if (platform.setupDebug && platform.readAddress) { // TODO??
    clearBreakpoint();
    _resume();
    platform.reset();
    setupBreakpoint();
    if (platform.runEval)
      platform.runEval(function(c) { return true; }); // break immediately
    else
      ; // TODO???
  } else {
    platform.reset();
  }
}

var lastBreakExpr = "c.PC = 0x6000";
function _breakExpression() {
  var exprs = window.prompt("Enter break expression", lastBreakExpr);
  if (exprs) {
    var fn = new Function('c', 'return (' + exprs + ');');
    setupBreakpoint();
    platform.runEval(fn);
    lastBreakExpr = exprs;
  }
}

function getSymbolAtAddress(a) {
  if (addr2symbol[a]) return addr2symbol[a];
  var i=0;
  while (--a >= 0) {
    i++;
    if (addr2symbol[a]) return addr2symbol[a] + '+' + i;
  }
  return '';
}

function updateDebugWindows() {
  if (platform.isRunning()) {
    updateMemoryWindow();
    //updateProfileWindow();
  }
  setTimeout(updateDebugWindows, 200);
}

function updateMemoryWindow() {
  if (memorylist) {
    $("#memoryview").find('[data-index]').each(function(i,e) {
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

function getVisibleEditorLineHeight() {
  return $(".CodeMirror-line:visible").first().height();
}

function getDumpLineAt(line) {
  var d = dumplines[line];
  if (d) {
    return d.a + " " + d.s;
  }
}

var IGNORE_SYMS = {s__INITIALIZER:true, /* s__GSINIT:true, */ _color_prom:true};

function getDumpLines() {
  if (!dumplines && addr2symbol) {
    dumplines = [];
    var ofs = 0;
    var sym;
    for (var nextofs in addr2symbol) {
      nextofs |= 0;
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

function showMemoryWindow() {
  memorylist = new VirtualList({
    w:$("#emulator").width(),
    h:$("#emulator").height(),
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
  $("#memoryview").empty().append(memorylist.container);
  updateMemoryWindow();
  if (compparams && dumplines)
    memorylist.scrollToItem(findMemoryWindowLine(compparams.data_start));
}

function toggleMemoryWindow() {
  //if ($("#profileview").is(':visible')) toggleProfileWindow();
  if ($("#memoryview").is(':visible')) {
    memorylist = null;
    $("#emulator").show();
    $("#memoryview").hide();
  } else {
    showMemoryWindow();
    $("#emulator").hide();
    $("#memoryview").show();
  }
}

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

function openBitmapEditorAtCursor() {
  if ($("#pixeditback").is(":visible")) {
    $("#pixeditback").hide(250);
    return;
  }
  var data = lookBackwardsForJSONComment(getCurrentLine(), 'w');
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

function _recordVideo() {
  var canvas = $("#emulator").find("canvas")[0];
  if (!canvas) {
    alert("Could not find canvas element to record video!");
    return;
  }
  var rotate = 0;
  if (canvas.style && canvas.style.transform) {
    if (canvas.style.transform.indexOf("rotate(-90deg)") >= 0)
      rotate = -1;
    else if (canvas.style.transform.indexOf("rotate(90deg)") >= 0)
      rotate = 1;
  }
  var gif = new GIF({
    workerScript: 'gif.js/dist/gif.worker.js',
    workers: 4,
    quality: 10,
    rotate: rotate
  });
  var img = $('#videoPreviewImage');
  //img.attr('src', 'https://articulate-heroes.s3.amazonaws.com/uploads/rte/kgrtehja_DancingBannana.gif');
  gif.on('finished', function(blob) {
    img.attr('src', URL.createObjectURL(blob));
    $("#pleaseWaitModal").modal('hide');
    _resume();
    $("#videoPreviewModal").modal('show');
  });
  var intervalMsec = 17;
  var maxFrames = 500;
  var nframes = 0;
  console.log("Recording video", canvas);
  var f = function() {
    if (nframes++ > maxFrames) {
      console.log("Rendering video");
      $("#pleaseWaitModal").modal('show');
      _pause();
      gif.render();
    } else {
      gif.addFrame(canvas, {delay: intervalMsec, copy: true});
      setTimeout(f, intervalMsec);
    }
  };
  f();
}

function setFrameRateUI(fps) {
  platform.setFrameRate(fps);
  if (fps > 0.01)
    $("#fps_label").text(fps.toFixed(2));
  else
    $("#fps_label").text("1/"+Math.round(1/fps));
}

function _slowerFrameRate() {
  var fps = platform.getFrameRate();
  fps = fps/2;
  if (fps > 0.00001) setFrameRateUI(fps);
}

function _fasterFrameRate() {
  var fps = platform.getFrameRate();
  fps = Math.min(60, fps*2);
  setFrameRateUI(fps);
}

function _slowestFrameRate() {
  setFrameRateUI(60/65536);
}

function _fastestFrameRate() {
  setFrameRateUI(60);
}

function setupDebugControls(){
  $("#dbg_reset").click(resetAndDebug);
  $("#dbg_pause").click(pause);
  $("#dbg_go").click(resume);

  if (platform.step)
    $("#dbg_step").click(singleStep).show();
  else
    $("#dbg_step").hide();
  if (platform.runToVsync)
    $("#dbg_tovsync").click(singleFrameStep).show();
  else
    $("#dbg_tovsync").hide();
  if ((platform.runEval || platform.runToPC) && platform_id != 'verilog')
    $("#dbg_toline").click(runToCursor).show();
  else
    $("#dbg_toline").hide();
  if (platform.runUntilReturn)
    $("#dbg_stepout").click(runUntilReturn).show();
  else
    $("#dbg_stepout").hide();
  if (platform.stepBack)
    $("#dbg_stepback").click(runStepBackwards).show();
  else
    $("#dbg_stepback").hide();

  if (window.traceTiming) {
    $("#dbg_timing").click(traceTiming).show();
  } else if (platform.readAddress) {
    $("#dbg_memory").click(toggleMemoryWindow).show();
  }
  /*if (platform.getProbe) {
    $("#dbg_profile").click(toggleProfileWindow).show();
  }*/
  if (platform.saveState) { // TODO: only show if listing or disasm available
    $("#dbg_disasm").click(toggleDisassembly).show();
  }
  $("#disassembly").hide();
  $("#dbg_bitmap").click(openBitmapEditorAtCursor);
  $(".dropdown-menu").collapse({toggle: false});
  $("#item_new_file").click(_createNewFile);
  $("#item_upload_file").click(_uploadNewFile);
  $("#item_share_file").click(_shareFile);
  $("#item_reset_file").click(_resetPreset);
  if (platform.runEval)
    $("#item_debug_expr").click(_breakExpression).show();
  else
    $("#item_debug_expr").hide();
  $("#item_download_rom").click(_downloadROMImage);
  $("#item_download_file").click(_downloadSourceFile);
  $("#item_record_video").click(_recordVideo);
  if (platform.setFrameRate && platform.getFrameRate) {
    $("#speed_bar").show();
    $("#dbg_slower").click(_slowerFrameRate);
    $("#dbg_faster").click(_fasterFrameRate);
    $("#dbg_slowest").click(_slowestFrameRate);
    $("#dbg_fastest").click(_fastestFrameRate);
  }
  updateDebugWindows();
}

function showWelcomeMessage() {
  if (!localStorage.getItem("8bitworkshop.hello")) {
    // Instance the tour
    var is_vcs = platform_id == 'vcs';
    var tour = new Tour({
      autoscroll:false,
      //storage:false,
      steps: [
        {
          element: "#editor",
          title: "Welcome to 8bitworkshop!",
          content: is_vcs ? "Type your 6502 assembly code into the editor, and it'll be assembled in real-time. All changes are saved to browser local storage."
                          : "Type your C source code into the editor, and it'll be compiled in real-time. All changes are saved to browser local storage."
        },
        {
          element: "#emulator",
          placement: 'left',
          title: "Emulator",
          content: "This is an emulator for the \"" + platform_id + "\" platform. We'll load your compiled code into the emulator whenever you make changes."
        },
        {
          element: "#preset_select",
          title: "File Selector",
          content: "Pick a code example from the book, or access your own files and files shared by others."
        },
        {
          element: "#debug_bar",
          placement: 'bottom',
          title: "Debug Tools",
          content: "Use these buttons to set breakpoints, single step through code, pause/resume, and use debugging tools."
        },
        {
          element: "#dropdownMenuButton",
          title: "Main Menu",
          content: "Click the menu to switch between platforms, create new files, or share your work with others."
        },
    ]});
    tour.init();
    setTimeout(function() { tour.start(); }, 2000);
  }
}

///////////////////////////////////////////////////

var qs = (function (a) {
    if (!a || a == "")
        return {};
    var b = {};
    for (var i = 0; i < a.length; ++i) {
        var p = a[i].split('=', 2);
        if (p.length == 1)
            b[p[0]] = "";
        else
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
    }
    return b;
})(window.location.search.substr(1).split('&'));

// TODO: what if multiple files/tools?
function preloadWorker(fileid) {
  var tool = platform.getToolForFilename(fileid);
  if (tool) worker.postMessage({preload:tool, platform:platform_id});
}

function initPlatform() {
  store = createNewPersistentStore(platform_id);
}

function showBookLink() {
  if (platform_id == 'vcs')
    $("#booklink_vcs").show();
  else if (platform_id == 'mw8080bw' || platform_id == 'vicdual' || platform_id == 'galaxian-scramble' || platform_id == 'vector-z80color' || platform_id == 'williams-z80')
    $("#booklink_arcade").show();
}

function addPageFocusHandlers() {
  var hidden = false;
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState == 'hidden' && platform.isRunning()) {
      _pause();
      hidden = true;
    } else if (document.visibilityState == 'visible' && hidden) {
      _resume();
      hidden = false;
    }
  });
  $(window).on("focus", function() {
    if (hidden) {
      _resume();
      hidden = false;
    }
  });
  $(window).on("blur", function() {
    if (platform.isRunning()) {
      _pause();
      hidden = true;
    }
  });
}

function startPlatform() {
  initPlatform();
  if (!PLATFORMS[platform_id]) throw Error("Invalid platform '" + platform_id + "'.");
  platform = new PLATFORMS[platform_id]($("#emulator")[0]);
  PRESETS = platform.getPresets();
  if (qs['file']) {
    // start platform and load file
    preloadWorker(qs['file']);
    platform.start();
    setupDebugControls();
    loadPreset(qs['file']);
    updateSelector();
    showBookLink();
    addPageFocusHandlers();
    return true;
  } else {
    // try to load last file (redirect)
    var lastid = localStorage.getItem("__lastid_"+platform_id) || localStorage.getItem("__lastid");
    localStorage.removeItem("__lastid");
    gotoPresetNamed(lastid || PRESETS[0].id);
    return false;
  }
}

function loadSharedFile(sharekey) {
  var github = new Octokat();
  var gist = github.gists(sharekey);
  gist.fetch().done(function(val) {
    var filename;
    for (filename in val.files) { break; }
    var newid = 'shared/' + filename;
    var json = JSON.parse(val.description.slice(val.description.indexOf(' ')+1));
    console.log("Fetched " + newid, json);
    platform_id = json['platform'];
    initPlatform();
    updatePreset(newid, val.files[filename].content);
    qs['file'] = newid;
    qs['platform'] = platform_id;
    delete qs['sharekey'];
    gotoNewLocation();
  }).fail(function(err) {
    alert("Error loading share file: " + err.message);
  });
  return true;
}

// start
function startUI(loadplatform) {
  installErrorHandler();
  window.addEventListener("message", handleWindowMessage, false);
  // add default platform?
  platform_id = qs['platform'] || localStorage.getItem("__lastplatform");
  if (!platform_id) {
    platform_id = qs['platform'] = "vcs";
  }
  // parse query string
  // is this a share URL?
  if (qs['sharekey']) {
    loadSharedFile(qs['sharekey']);
  } else {
    // reset file?
    if (qs['file'] && qs['reset']) {
      initPlatform();
      store.removeItem(qs['file']);
      qs['reset'] = '';
      gotoNewLocation();
    } else {
      // load and start platform object
      if (loadplatform) {
        var scriptfn = 'src/platform/' + platform_id.split('-')[0] + '.js';
        var script = document.createElement('script');
        script.onload = function() {
          console.log("loaded platform", platform_id);
          startPlatform();
          showWelcomeMessage();
        };
        script.src = scriptfn;
        document.getElementsByTagName('head')[0].appendChild(script);
      } else {
        startPlatform();
        showWelcomeMessage();
      }
    }
  }
}
