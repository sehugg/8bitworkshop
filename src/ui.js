"use strict";

var FileStore = function(storage, prefix) {
  var self = this;
  this.saveFile = function(name, text) {
    storage.setItem(prefix + name, text);
  }
  this.loadFile = function(name) {
    return storage.getItem(prefix + name) || storage.getItem(name);
  }
  this.getFiles = function(prefix2) {
    var files = [];
    for (var i = 0; i < storage.length; i++) {
      var key = storage.key(i);
      if (key.startsWith(prefix + prefix2)) {
        var name = key.substring(prefix.length + prefix2.length);
        files.push(name);
      }
      else if (key.startsWith(prefix2)) {
        var name = key.substring(prefix2.length);
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

// 8bitworkshop IDE user interface

var worker = new Worker("./src/worker/workermain.js");
var current_output = null;
var current_preset_index = -1; // TODO: use URL
var current_preset_id = null;
var offset2line = null;
var line2offset = null;
var pcvisits;
var trace_pending_at_pc;
var store;

var PRESETS, platform, platform_id;

var CODE = 'code1';
var editor = CodeMirror(document.getElementById('editor'), {
  mode: '6502',
  theme: 'mbo',
  lineNumbers: true,
  tabSize: 8,
  gutters: ["CodeMirror-linenumbers", "gutter-offset", "gutter-bytes", "gutter-clock", "gutter-info"],
});
//editor.setSize("100%", "95%"); // TODO
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
  localStorage.setItem("__lastid", id);
  localStorage.setItem("__lastplatform", platform_id);
}

function updatePreset(current_preset_id, text) {
  if (text.trim().length) {
    store.saveFile(current_preset_id, text);
  }
}

function loadCode(text) {
  editor.setValue(text);
  current_output = null;
  setCode(text);
}

function loadFile(fileid, filename, index) {
  current_preset_id = fileid;
  current_preset_index = index;
  var text = store.loadFile(fileid)|| "";
  if (text) {
    loadCode(text);
    setLastPreset(fileid);
  } else if (!text && index >= 0) {
    filename += ".a";
    console.log("Loading preset", fileid, filename, index, PRESETS[index]);
    if (text.length == 0) {
      console.log("Fetching", filename);
      $.get( filename, function( text ) {
        console.log("GET",text.length,'bytes');
        loadCode(text);
        setLastPreset(fileid);
      }, 'text');
    }
  } else {
    $.get( "presets/"+platform_id+"/skeleton.a", function( text ) {
      loadCode(text);
      setLastPreset(fileid);
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
  window.location = "?" + $.param(qs);
}

function gotoPresetNamed(id) {
  if (id.startsWith("_")) {
    var result = eval(id+"()");
    console.log(id, result);
    if (!result) {
      updateSelector();
    }
  } else {
    qs['platform'] = platform_id;
    qs['file'] = id;
    window.location = "?" + $.param(qs);
  }
}

function _createNewFile(e) {
  var filename = prompt("Create New File", "newfile.a");
  if (filename && filename.length) {
    if (filename.indexOf(".") < 0) {
      filename += ".a";
    }
    qs['file'] = "local/" + filename;
    window.location = "?" + $.param(qs);
  }
  return true;
}

function _shareFile(e) {
  if (current_output == null) {
    alert("Please fix errors before sharing.");
    return true;
  }
  var text = editor.getValue();
  console.log("POST",text.length,'bytes');
  $.post({
    url: 'share.php',
    data: {
      'platform':'vcs', /// TODO
      'filename':current_preset_id.split('/').pop(),
      'text':text,
    },
    error: function(e) {
      console.log(e);
      alert("Error sharing file.");
    },
    success: function(result) {
      var sharekey = result['key'];
      var url = "http://8bitworkshop.com/?sharekey=" + sharekey;
      window.prompt("Copy link to clipboard (Ctrl+C, Enter)", url);
    }
  });
  return true;
}

function _resetPreset(e) {
  if (current_preset_index < 0) {
    alert("Can only reset built-in file examples.")
  } else if (confirm("Reset '" + PRESETS[current_preset_index].name + "' to default?")) {
    qs['reset'] = '1';
    window.location = "?" + $.param(qs);
  }
  return true;
}

function populateExamples(sel) {
  sel.append($("<option />").text("--------- Chapters ---------"));
  for (var i=0; i<PRESETS.length; i++) {
    var preset = PRESETS[i];
    var name = preset.chapter + ". " + preset.name;
    sel.append($("<option />").val(preset.id).text(name).attr('selected',preset.id==current_preset_id));
  }
}

function populateLocalFiles(sel) {
  sel.append($("<option />").text("------- Local Files -------"));
  var filenames = store.getFiles("local/");
  for (var i = 0; i < filenames.length; i++) {
    var name = filenames[i];
    var key = "local/" + name;
    sel.append($("<option />").val(key).text(name).attr('selected',key==current_preset_id));
  }
}

function populateSharedFiles(sel) {
  sel.append($("<option />").text("--------- Shared ---------"));
  var filenames = store.getFiles("shared/");
  for (var i = 0; i < filenames.length; i++) {
    var name = filenames[i];
    var key = "shared/" + name;
    sel.append($("<option />").val(key).text(name).attr('selected',key==current_preset_id));
  }
}

function updateSelector() {
  var sel = $("#preset_select").empty();
  populateLocalFiles(sel);
  populateSharedFiles(sel);
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

function getToolForFilename(fn) {
  if (fn.endsWith(".pla")) return "plasm";
  if (fn.endsWith(".c")) return "cc65";
  if (fn.endsWith(".s")) return "ca65";
  return "dasm";
}

function setCode(text) {
  worker.postMessage({code:text, tool:getToolForFilename(current_preset_id)});
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
  // errors?
  var toolbar = $("#notebook");
  if (e.data.listing.errors.length > 0) {
    toolbar.addClass("has-errors");
    editor.clearGutter("gutter-info");
    for (info of e.data.listing.errors) {
      var div = document.createElement("div");
      div.setAttribute("class", "tooltipbox tooltiperror");
      div.style.color = '#ff3333'; // TODO
      div.appendChild(document.createTextNode("\u24cd"));
      var tooltip = document.createElement("span");
      tooltip.setAttribute("class", "tooltiptext");
      tooltip.appendChild(document.createTextNode(info.msg));
      div.appendChild(tooltip);
      editor.setGutterMarker(info.line-1, "gutter-info", div);
    }
    current_output = null;
  } else {
    toolbar.removeClass("has-errors");
    updatePreset(current_preset_id, editor.getValue()); // update persisted entry
    // load ROM
    var rom = e.data.output;
    var rom_changed = rom && !arrayCompare(rom, current_output);
    if (rom_changed) {
      try {
        resume();
        //console.log("Loading ROM length", rom.length);
        platform.loadROM(getCurrentPresetTitle(), rom);
        current_output = rom;
        pcvisits = {};
      } catch (e) {
        console.log(e); // TODO
        current_output = null;
      }
    }
    if (rom_changed || trace_pending_at_pc) {
      // update editor annotations
      editor.clearGutter("gutter-info");
      editor.clearGutter("gutter-bytes");
      editor.clearGutter("gutter-offset");
      editor.clearGutter("gutter-clock");
      offset2line = {};
      line2offset = {};
      for (var info of e.data.listing.lines) {
        if (info.offset) {
          var textel = document.createTextNode(info.offset.toString(16));
          editor.setGutterMarker(info.line-1, "gutter-offset", textel);
          offset2line[info.offset] = info.line;
          line2offset[info.line] = info.offset;
        }
        if (info.insns) {
          var insnstr = info.insns.length > 8 ? ("...") : info.insns;
          var textel = document.createTextNode(insnstr);
          editor.setGutterMarker(info.line-1, "gutter-bytes", textel);
          if (info.iscode) {
            var opcode = parseInt(info.insns.split()[0], 16);
            var meta = platform.getOpcodeMetadata(opcode, info.offset);
            var clockstr = meta.minCycles+"";
            var textel = document.createTextNode(clockstr);
            editor.setGutterMarker(info.line-1, "gutter-clock", textel);
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

function findLineForOffset(PC) {
  if (offset2line) {
    for (var i=0; i<256; i++) {
      var line = offset2line[PC];
      if (line) {
        return line;
      }
      PC--;
    }
  }
  return 0;
}

function setCurrentLine(line) {
  editor.setSelection({line:line,ch:0}, {line:line-1,ch:0}, {scroll:true});
}

function hex(v, nd) {
  try {
    if (!nd) nd = 2;
    var s = v.toString(16).toUpperCase();
    while (s.length < nd)
      s = "0" + s;
    return s;
  } catch (e) {
    return v+"";
  }
}
function decodeFlags(c, flags) {
  var s = "";
  s += c.N ? " N" : " -";
  s += c.V ? " V" : " -";
  s += c.D ? " D" : " -";
  s += c.Z ? " Z" : " -";
  s += c.C ? " C" : " -";
//  s += c.I ? " I" : " -";
  return s;
}
function cpuStateToLongString(c) {
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c) + "  " + getTIAPosString() + "\n"
       + " A " + hex(c.A)    + "     " + (c.R ? "" : "BUSY") + "\n"
       + " X " + hex(c.X)    + "\n"
       + " Y " + hex(c.Y)    + "     " + "SP " + hex(c.SP) + "\n";
}
function getTIAPosString() {
  var pos = platform.getRasterPosition();
  return "V" + pos.y + " H" + pos.x;
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
    s = cpuStateToLongString(state.c);
    s += "\n";
    var ram = platform.getRAMForState(state);
    // TODO: show scrollable RAM for other platforms
    for (var ofs=0; ofs<0x80; ofs+=0x10) {
      s += '$' + hex(ofs+0x80) + ':';
      for (var i=0; i<0x10; i++) {
        if (i == 8) s += " ";
        s += " " + hex(ram[ofs+i]);
      }
      s += "\n";
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
    var line = findLineForOffset(PC);
    if (line) {
      console.log("BREAKPOINT", hex(PC), line);
      setCurrentLine(line);
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
  var pc = line2offset[line];
  if (pc) {
    console.log("Run to", line, pc.toString(16));
    platform.runEval(function(c) {
      return c.PC == pc;
    });
  }
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
  for (var line in line2offset) {
    var pc = line2offset[line];
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

function updateDisassembly() {
  var div = $("#disassembly");
  if (div.is(':visible')) {
    div.empty();
    var state = lastDebugState || platform.saveState();
    var mem = state.b;
    var pc = state.c.PC;
    var disasm = new Disassembler6502().disassemble(mem, pc, pc+128, pcvisits);
    var s = "";
    for (a in disasm) {
      var line = hex(parseInt(a)) + " " + disasm[a] + "\n";
      s += line;
    }
    $("<pre></pre>").appendTo(div).text(s);
  }
}

function toggleDisassembly() {
  $("#disassembly").toggle();
  $("#editor").toggle();
  updateDisassembly();
}

function resetAndDebug() {
  clearBreakpoint();
  platform.reset();
  runToCursor();
}

function setupDebugControls(){
  $("#dbg_reset").click(resetAndDebug);
  $("#dbg_pause").click(pause);
  $("#dbg_go").click(resume);
  $("#dbg_step").click(singleStep);
  $("#dbg_toline").click(runToCursor);
  $("#dbg_timing").click(traceTiming);
  $("#dbg_disasm").click(toggleDisassembly);
  $("#disassembly").hide();
  $(".dropdown-menu").collapse({toggle: false});
  $("#item_new_file").click(_createNewFile);
  $("#item_share_file").click(_shareFile);
  $("#item_reset_file").click(_resetPreset);
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

// start
setupDebugControls();
showWelcomeMessage();
// parse query string
try {
  // is this a share URL?
  if (qs['sharekey']) {
    var sharekey = qs['sharekey'];
    console.log("Loading shared file ", sharekey);
    $.getJSON( ".storage/" + sharekey, function( result ) {
      console.log(result);
      var newid = 'shared/' + result['filename'];
      updatePreset(newid, result['text']);
      qs['file'] = newid;
      delete qs['sharekey'];
      window.location = "?" + $.param(qs);
    }, 'text');
  } else {
    // add default platform?
    platform_id = qs['platform'] || localStorage.getItem("__lastplatform");
    if (!platform_id) {
      platform_id = qs['platform'] = "vcs";
    }
    // load and start platform object
    if (platform_id == 'vcs') {
      platform = new VCSPlatform();
      $("#booklink_vcs").show();
    } else if (platform_id == 'apple2') {
      platform = new Apple2Platform($("#emulator")[0]);
    } else if (platform_id == 'atarivec') {
      platform = new AtariVectorPlatform($("#emulator")[0]);
    } else {
      alert("Platform " + platform_id + " not recognized");
    }
    store = new FileStore(localStorage, platform_id + '/');
    PRESETS = platform.getPresets();
    platform.start();
    // reset file?
    if (qs['file'] && qs['reset']) {
      store.deleteFile(qs['file']);
      qs['reset'] = '';
      window.location = "?" + $.param(qs);
    } else if (qs['file']) {
      // load file
      loadPreset(qs['file']);
      updateSelector();
    } else {
      // try to load last file
      var lastid = localStorage.getItem("__lastid");
      gotoPresetNamed(lastid || PRESETS[0].id);
    }
  }
} catch (e) {
  alert(e+""); // TODO?
}
