"use strict";

// catch errors
function installErrorHandler() {
  if (typeof window.onerror == "object") {
      window.onerror = function (msgevent, url, line, col, error) {
        console.log(msgevent, url, line, col);
        console.log(error);
        //$("#editor").hide();
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
Javatari.AUTO_START = false;

// 8bitworkshop IDE user interface

var PRESETS; // presets array
var platform_id;
var platform; // platform object

var FileStore = function(storage, prefix) {
  var self = this;
  this.saveFile = function(name, text) {
    storage.setItem(prefix + name, text);
  }
  this.loadFile = function(name) {
    return storage.getItem(prefix + name) || storage.getItem(name);
  }
  this.getFiles = function(prefix2) {
    // rename items for compatibility
    for (var i = 0; i < storage.length; i++) {
      var key = storage.key(i);
      if (key.startsWith(prefix2) && platform_id == 'vcs') {
        this.saveFile(key, storage.getItem(key));
        storage.removeItem(key);
        console.log("Renamed",key,'to',prefix+key);
        i=-1; // reset loop
      }
    }
    // iterate over files with <platform>/<dir> prefix
    var files = [];
    for (var i = 0; i < storage.length; i++) {
      var key = storage.key(i);
      if (key.startsWith(prefix + prefix2)) {
        var name = key.substring(prefix.length + prefix2.length);
        files.push(name);
      }
    }
    return files;
  }
  this.deleteFile = function(name) {
    storage.removeItem(name);
    storage.removeItem('local/' + name);
  }
}

var SourceFile = function(lines, text) {
  lines = lines || [];
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
}

var TOOL_TO_SOURCE_STYLE = {
  'dasm': '6502',
  'acme': '6502',
  'cc65': 'text/x-csrc',
  'ca65': '6502',
  'z80asm': 'z80',
  'sdasz80': 'z80',
  'sdcc': 'text/x-csrc',
}

var worker = new Worker("./src/worker/workermain.js");
var current_output = null;
var current_preset_index = -1; // TODO: use URL
var current_preset_id = null;
var assemblyfile = null;
var sourcefile = null;
var pcvisits;
var trace_pending_at_pc;
var store;
var pendingWorkerMessages = 0;

var editor = CodeMirror(document.getElementById('editor'), {
  theme: 'mbo',
  lineNumbers: true,
  matchBrackets: true,
  tabSize: 8,
  gutters: ["CodeMirror-linenumbers", "gutter-offset", "gutter-bytes", "gutter-clock", "gutter-info"],
});
var disasmview = CodeMirror(document.getElementById('disassembly'), {
  mode: 'z80',
  theme: 'cobalt',
  tabSize: 8,
  readOnly: true,
  styleActiveLine: true
});

editor.on('changes', function(ed, changeobj) {
  var text = editor.getValue() || "";
  setCode(text);
});

function getCurrentPresetTitle() {
  if (current_preset_index < 0)
    return "ROM";
  else
    return PRESETS[current_preset_index].title || PRESETS[current_preset_index].name || "ROM";
}

function setLastPreset(id) {
  localStorage.setItem("__lastplatform", platform_id);
  localStorage.setItem("__lastid_"+platform_id, id);
}

function updatePreset(current_preset_id, text) {
  if (text.trim().length) {
    store.saveFile(current_preset_id, text);
  }
}

function loadCode(text, fileid) {
  var tool = platform.getToolForFilename(fileid);
  editor.setOption("mode", tool && TOOL_TO_SOURCE_STYLE[tool]);
  editor.setValue(text);
  editor.clearHistory();
  current_output = null;
  setCode(text);
  setLastPreset(fileid);
}

function loadFile(fileid, filename, index) {
  current_preset_id = fileid;
  current_preset_index = index;
  var text = store.loadFile(fileid) || "";
  if (text) {
    loadCode(text, fileid);
  } else if (!text && index >= 0) {
    filename += ".a";
    console.log("Loading preset", fileid, filename, index, PRESETS[index]);
    if (text.length == 0) {
      console.log("Fetching", filename);
      $.get( filename, function( text ) {
        console.log("GET",text.length,'bytes');
        loadCode(text, fileid);
      }, 'text');
    }
  } else {
    $.get( "presets/"+platform_id+"/skeleton.a", function( text ) {
      loadCode(text, fileid);
      updatePreset(fileid, text);
    }, 'text');
  }
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
    loadFile(preset_id, "presets/" + platform_id + "/" + PRESETS[index].id, index);
  } else {
    // no preset found? load local
    loadFile(preset_id, "local/" + platform_id + "/" + preset_id, -1);
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
  var filename = prompt("Create New File", "newfile.a");
  if (filename && filename.length) {
    if (filename.indexOf(".") < 0) {
      filename += ".a";
    }
    qs['file'] = "local/" + filename;
    gotoNewLocation();
  }
  return true;
}

function _shareFile(e) {
  if (current_output == null) {
    alert("Please fix errors before sharing.");
    return true;
  }
  if (!current_preset_id.startsWith("local/")) {
    alert("Can only share files created with New File.");
    return true;
  }
  var github = new Octokat();
  var files = {};
  var text = editor.getValue();
  files[current_preset_id.slice(6)] = {"content": text};
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
  if (current_preset_index < 0) {
    alert("Can only reset built-in file examples.")
  } else if (confirm("Reset '" + PRESETS[current_preset_index].name + "' to default?")) {
    qs['reset'] = '1';
    gotoNewLocation();
  }
  return true;
}

function populateExamples(sel) {
  sel.append($("<option />").text("--------- Chapters ---------").attr('disabled',true));
  for (var i=0; i<PRESETS.length; i++) {
    var preset = PRESETS[i];
    var name = preset.chapter + ". " + preset.name;
    sel.append($("<option />").val(preset.id).text(name).attr('selected',preset.id==current_preset_id));
  }
}

function populateFiles(sel, name, prefix) {
  sel.append($("<option />").text("------- " + name + " -------").attr('disabled',true));
  var filenames = store.getFiles(prefix);
  var foundSelected = false;
  for (var i = 0; i < filenames.length; i++) {
    var name = filenames[i];
    var key = prefix + name;
    sel.append($("<option />").val(key).text(name).attr('selected',key==current_preset_id));
    if (key == current_preset_id) foundSelected = true;
  }
  if (!foundSelected && current_preset_id && current_preset_id.startsWith(prefix)) {
    var name = current_preset_id.slice(prefix.length);
    var key = prefix + name;
    sel.append($("<option />").val(key).text(name).attr('selected',true));
  }
}

function updateSelector() {
  var sel = $("#preset_select").empty();
  populateFiles(sel, "Local Files", "local/");
  populateFiles(sel, "Shared", "shared/");
  populateExamples(sel);
  // set click handlers
  sel.off('change').change(function(e) {
    gotoPresetNamed($(this).val());
  });
  $("#preset_prev").off('click').click(function() {
    gotoPresetAt(current_preset_index - 1);
  });
  $("#preset_next").off('click').click(function() {
    gotoPresetAt(current_preset_index + 1);
  });
}

function setCode(text) {
  if (pendingWorkerMessages++ > 0)
    return;
  worker.postMessage({code:text, platform:platform_id,
    tool:platform.getToolForFilename(current_preset_id)});
}

function arrayCompare(a,b) {
  if (a == null && b == null) return true;
  if (a == null) return false;
  if (b == null) return false;
  if (a.length != b.length) return false;
  for (var i=0; i<a.length; i++)
    if (a[i] != b[i])
      return false;
  return true;
}

worker.onmessage = function(e) {
  if (pendingWorkerMessages > 1) {
    pendingWorkerMessages = 0;
    setCode(editor.getValue());
  }
  pendingWorkerMessages = 0;
  // errors?
  var toolbar = $("#controls_top");
  function addErrorMarker(line, msg) {
    var div = document.createElement("div");
    div.setAttribute("class", "tooltipbox tooltiperror");
    div.style.color = '#ff3333'; // TODO
    div.appendChild(document.createTextNode("\u24cd"));
    var tooltip = document.createElement("span");
    tooltip.setAttribute("class", "tooltiptext");
    tooltip.appendChild(document.createTextNode(msg));
    div.appendChild(tooltip);
    editor.setGutterMarker(line, "gutter-info", div);
  }
  sourcefile = new SourceFile(e.data.lines);
  if (e.data.asmlines) {
    assemblyfile = new SourceFile(e.data.asmlines, e.data.intermediate.listing);
  }
  if (e.data.errors.length > 0) {
    toolbar.addClass("has-errors");
    editor.clearGutter("gutter-info");
    for (info of e.data.errors) {
      addErrorMarker(info.line-1, info.msg);
    }
    current_output = null;
  } else {
    updatePreset(current_preset_id, editor.getValue()); // update persisted entry
    // load ROM
    var rom = e.data.output;
    var rom_changed = rom && !arrayCompare(rom, current_output);
    if (rom_changed) {
      try {
        //console.log("Loading ROM length", rom.length);
        platform.loadROM(getCurrentPresetTitle(), rom);
        resume();
        current_output = rom;
        pcvisits = {};
        toolbar.removeClass("has-errors");
      } catch (e) {
        console.log(e); // TODO: show error
        toolbar.addClass("has-errors");
        addErrorMarker(0, e+"");
        current_output = null;
      }
    }
    if (rom_changed || trace_pending_at_pc) {
      // update editor annotations
      // TODO: do incrementally for performance
      editor.clearGutter("gutter-info");
      editor.clearGutter("gutter-bytes");
      editor.clearGutter("gutter-offset");
      editor.clearGutter("gutter-clock");
      for (var info of e.data.lines) {
        if (info.offset >= 0) {
          var textel = document.createTextNode(hex(info.offset,4));
          editor.setGutterMarker(info.line-1, "gutter-offset", textel);
        }
        if (info.insns) {
          var insnstr = info.insns.length > 8 ? ("...") : info.insns;
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
    if (trace_pending_at_pc) {
      showLoopTimingForPC(trace_pending_at_pc);
    }
  }
  trace_pending_at_pc = null;
}

function setCurrentLine(line) {
  editor.setSelection({line:line,ch:0}, {line:line-1,ch:0}, {scroll:true});
}

var lastDebugInfo;
var lastDebugState;

function highlightDifferences(s1, s2) {
  var split1 = s1.split(/(\S+\s+)/).filter(function(n) {return n});
  var split2 = s2.split(/(\S+\s+)/).filter(function(n) {return n});
  var i = 0;
  var j = 0;
  var result = "";
  while (i < split1.length && j < split2.length) {
    var w1 = split1[i];
    var w2 = split2[j];
    if (w2 && w2.indexOf("\n") >= 0) {
      while (i < s1.length && split1[i].indexOf("\n") < 0)
        i++;
    }
    if (w1 != w2) {
      w2 = '<span class="hilite">' + w2 + '</span>';
    }
    result += w2;
    i++;
    j++;
  }
  while (j < split2.length) {
      result += split2[j++];
  }
  return result;
}

function showMemory(state) {
  var s = "";
  if (state) {
    s = platform.cpuStateToLongString(state.c);
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
    var PC = state.c.PC;
    var line = sourcefile.findLineForOffset(PC);
    if (line >= 0) {
      console.log("BREAKPOINT", hex(PC), line);
      setCurrentLine(line);
    } else {
      console.log("BREAKPOINT", hex(PC));
      // TODO: switch to disasm
    }
    pcvisits[PC] = pcvisits[PC] ? pcvisits[PC]+1 : 1;
    showMemory(state);
    updateDisassembly();
  });
}

function pause() {
  clearBreakpoint();
  if (platform.isRunning()) {
    platform.pause();
  }
}

function resume() {
  clearBreakpoint();
  if (! platform.isRunning()) {
    platform.resume();
    editor.setSelection(editor.getCursor());
  }
}

function singleStep() {
  setupBreakpoint();
  platform.step();
}

function getCurrentLine() {
  return editor.getCursor().line+1;
}

function runToCursor() {
  setupBreakpoint();
  var line = getCurrentLine();
  var pc = sourcefile.line2offset[line];
  if (pc >= 0) {
    console.log("Run to", line, pc.toString(16));
    platform.runEval(function(c) {
      return c.PC == pc;
    });
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
  platform.clearDebug();
  $("#dbg_info").empty();
  showMemory();
}

function getClockCountsAtPC(pc) {
  var opcode = platform.readAddress(pc);
  var meta = platform.getOpcodeMetadata(opcode, pc);
  return meta; // minCycles, maxCycles
}

var pc2minclocks = {};
var pc2maxclocks = {};
var jsrresult = {};
var MAX_CLOCKS = 76*2;

function byte2signed(b) {
  b &= 0xff;
  return (b < 0x80) ? b : -(256-b);
}

// [taken, not taken]
var BRANCH_CONSTRAINTS = [
  [{N:0},{N:1}],
  [{N:1},{N:0}],
  [{V:0},{V:1}],
  [{V:1},{V:0}],
  [{C:0},{C:1}],
  [{C:1},{C:0}],
  [{Z:0},{Z:1}],
  [{Z:1},{Z:0}]
];

function constraintEquals(a,b) {
  if (a == null || b == null)
    return null;
  for (var n in a) {
    if (b[n] !== 'undefined')
      return a[n] == b[n];
  }
  for (var n in b) {
    if (a[n] !== 'undefined')
      return a[n] == b[n];
  }
  return null;
}

function _traceInstructions(pc, minclocks, maxclocks, subaddr, constraints) {
  //console.log("trace", hex(pc), minclocks, maxclocks);
  if (!minclocks) minclocks = 0;
  if (!maxclocks) maxclocks = 0;
  if (!constraints) constraints = {};
  var modified = true;
  var abort = false;
  for (var i=0; i<1000 && modified && !abort; i++) {
    modified = false;
    var meta = getClockCountsAtPC(pc);
    var lob = platform.readAddress(pc+1);
    var hib = platform.readAddress(pc+2);
    var addr = lob + (hib << 8);
    var pc0 = pc;
    if (!pc2minclocks[pc0] || minclocks < pc2minclocks[pc0]) {
      pc2minclocks[pc0] = minclocks;
      modified = true;
    }
    if (!pc2maxclocks[pc0] || maxclocks > pc2maxclocks[pc0]) {
      pc2maxclocks[pc0] = maxclocks;
      modified = true;
    }
    //console.log(hex(pc),minclocks,maxclocks,meta);
    if (!meta.insnlength) {
      console.log("Illegal instruction!", hex(pc), hex(meta.opcode), meta);
      break;
    }
    pc += meta.insnlength;
    var oldconstraints = constraints;
    constraints = null;
    // TODO: if jump to zero-page, maybe assume RTS?
    switch (meta.opcode) {
      /*
      case 0xb9: // TODO: hack for zero page,y
        if (addr < 0x100)
          meta.maxCycles -= 1;
        break;
      */
      case 0x85:
        if (lob == 0x2) { // STA WSYNC
          minclocks = maxclocks = 0;
          meta.minCycles = meta.maxCycles = 0;
        }
        break;
      case 0x20: // JSR
        _traceInstructions(addr, minclocks, maxclocks, addr, constraints);
        var result = jsrresult[addr];
        if (result) {
          minclocks = result.minclocks;
          maxclocks = result.maxclocks;
        } else {
          console.log("No JSR result!", hex(pc), hex(addr));
          return;
        }
        break;
      case 0x4c: // JMP
        pc = addr; // TODO: make sure in ROM space
        break;
      case 0x60: // RTS
        if (subaddr) {
          // TODO: combine with previous result
          var result = jsrresult[subaddr];
          if (!result) {
            result = {minclocks:minclocks, maxclocks:maxclocks};
          } else {
            result = {
              minclocks:Math.min(minclocks,result.minclocks),
              maxclocks:Math.max(maxclocks,result.maxclocks)
            }
          }
          jsrresult[subaddr] = result;
          console.log("RTS", hex(pc), hex(subaddr), jsrresult[subaddr]);
        }
        return;
      case 0x10: case 0x30: // branch
      case 0x50: case 0x70:
      case 0x90: case 0xB0:
      case 0xD0: case 0xF0:
        var newpc = pc + byte2signed(lob);
        var crosspage = (pc>>8) != (newpc>>8);
        if (!crosspage) meta.maxCycles--;
        // TODO: other instructions might modify flags too
        var cons = BRANCH_CONSTRAINTS[Math.floor((meta.opcode-0x10)/0x20)];
        var cons0 = constraintEquals(oldconstraints, cons[0]);
        var cons1 = constraintEquals(oldconstraints, cons[1]);
        if (cons0 !== false) {
          _traceInstructions(newpc, minclocks+meta.maxCycles, maxclocks+meta.maxCycles, subaddr, cons[0]);
        }
        if (cons1 === false) {
          console.log("abort", hex(pc), oldconstraints, cons[1]);
          abort = true;
        }
        constraints = cons[1]; // not taken
        meta.maxCycles = meta.minCycles; // branch not taken, no extra clock(s)
        break;
      case 0x6c:
        console.log("Instruction not supported!", hex(pc), hex(meta.opcode), meta); // TODO
        return;
    }
    // TODO: wraparound?
    minclocks = Math.min(MAX_CLOCKS, minclocks + meta.minCycles);
    maxclocks = Math.min(MAX_CLOCKS, maxclocks + meta.maxCycles);
  }
}

function showLoopTimingForPC(pc) {
  pc2minclocks = {};
  pc2maxclocks = {};
  jsrresult = {};
  // recurse through all traces
  _traceInstructions(pc | platform.getOriginPC(), MAX_CLOCKS, MAX_CLOCKS);
  // show the lines
  for (var line in sourcefile.line2offset) {
    var pc = sourcefile.line2offset[line];
    var minclocks = pc2minclocks[pc];
    var maxclocks = pc2maxclocks[pc];
    if (minclocks>=0 && maxclocks>=0) {
      var s;
      if (maxclocks == minclocks)
        s = minclocks + "";
      else
        s = minclocks + "-" + maxclocks;
      if (maxclocks == MAX_CLOCKS)
        s += "+";
      var textel = document.createTextNode(s);
      editor.setGutterMarker(line-1, "gutter-bytes", textel);
    }
  }
}

function traceTiming() {
  trace_pending_at_pc = platform.getOriginPC();
  setCode(editor.getValue());
}

/*
function showLoopTimingForCurrentLine() {
  var line = getCurrentLine();
  var pc = line2offset[line];
  if (pc) {
    showLoopTimingForPC(pc);
  }
}
*/

function jumpToLine(ed, i) {
    var t = ed.charCoords({line: i, ch: 0}, "local").top;
    var middleHeight = ed.getScrollerElement().offsetHeight / 2;
    ed.scrollTo(null, t - middleHeight - 5);
}

function updateDisassembly() {
  var div = $("#disassembly");
  if (div.is(':visible')) {
    var state = lastDebugState || platform.saveState();
    var pc = state.c.PC;
    if (assemblyfile && assemblyfile.text) {
      disasmview.setValue(assemblyfile.text);
      if (platform.getDebugCallback()) {
        var lineno = assemblyfile.findLineForOffset(pc);
        if (lineno) {
          disasmview.setCursor(lineno-1, 0);
          jumpToLine(disasmview, lineno-1);
        }
      }
      return;
    }
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
        a += disasm.nbytes;
      }
      return s;
    }
    var text = disassemble(pc-96, pc) + disassemble(pc, pc+96);
    disasmview.setValue(text);
    disasmview.setCursor(selline, 0);
    jumpToLine(disasmview, selline);
  }
}

function toggleDisassembly() {
  $("#disassembly").toggle();
  $("#editor").toggle();
  updateDisassembly();
}

function resetAndDebug() {
  clearBreakpoint();
  platform.resume();
  platform.reset();
  setupBreakpoint();
  platform.runEval(function(c) { return true; });
}

function _breakExpression() {
  var exprs = window.prompt("Enter break expression", "c.PC == 0x6000"); // TODO
  if (exprs) {
    var fn = new Function('c', 'return (' + exprs + ');');
    setupBreakpoint();
    platform.runEval(fn);
  }
}

function setupDebugControls(){
  $("#dbg_reset").click(resetAndDebug);
  $("#dbg_pause").click(pause);
  $("#dbg_go").click(resume);
  $("#dbg_step").click(singleStep);
  $("#dbg_toline").click(runToCursor);
  $("#dbg_stepout").click(runUntilReturn);
  $("#dbg_stepback").click(runStepBackwards);
  // TODO: vcs platform seems to show them regardless
  if (platform_id == 'vcs') {
    $("#dbg_timing").click(traceTiming).show();
  }
  if (platform.saveState) { // TODO: only show if listing or disasm available
    $("#dbg_disasm").click(toggleDisassembly).show();
  }
  $("#disassembly").hide();
  $(".dropdown-menu").collapse({toggle: false});
  $("#item_new_file").click(_createNewFile);
  $("#item_share_file").click(_shareFile);
  $("#item_reset_file").click(_resetPreset);
  $("#item_debug_expr").click(_breakExpression);
}

function showWelcomeMessage() {
  if (!localStorage.getItem("8bitworkshop.hello"))
  {
    // Instance the tour
    var tour = new Tour({
      autoscroll:false,
      //storage:false,
      steps: [
        {
          element: "#editor",
          title: "Welcome to 8bitworkshop!",
          content: "Type your 6502 code on the left side, and it'll be assembled in real-time. All changes are saved to browser local storage.",
        },
        {
          element: "#emulator",
          placement: 'left',
          title: "Atari VCS Emulator",
          content: "This is an emulator for the Atari VCS/2600. We'll load your assembled code into the emulator whenever you make changes.",
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
          content: "Use these buttons to set breakpoints, single step through code, pause/resume, and perform timing analysis."
        },
        {
          element: "#dropdownMenuButton",
          title: "Main Menu",
          content: "Click the menu to create new files and share your work with others."
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

function preloadWorker(fileid) {
  var tool = platform.getToolForFilename(fileid);
  if (tool) worker.postMessage({preload:tool});
}

function initPlatform() {
  store = new FileStore(localStorage, platform_id + '/');
}

function startPlatform() {
  initPlatform();
  platform = new PLATFORMS[platform_id]($("#emulator")[0]);
  PRESETS = platform.getPresets();
  if (qs['file']) {
    // start platform and load file
    preloadWorker(qs['file']);
    setupDebugControls();
    platform.start();
    loadPreset(qs['file']);
    updateSelector();
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
      store.deleteFile(qs['file']);
      qs['reset'] = '';
      gotoNewLocation();
    } else {
      // load and start platform object
      if (loadplatform) {
        $.getScript('src/platform/' + platform_id + '.js', function() {
          console.log("loaded platform", platform_id);
          startPlatform();
        });
      } else {
        startPlatform();
      }
    }
  }
}
