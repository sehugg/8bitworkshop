
var worker = new Worker("./src/worker/workermain.js");
var current_output = null;
var current_preset_idx = -1; // TODO: use URL
var current_preset_id = null;
var offset2line = null;
var line2offset = null;
var trace_pending_at_pc;

var PRESETS = [
  {id:'examples/hello', chapter:4, name:'Hello 6502 and TIA'},
  {id:'examples/vsync', chapter:5, name:'Painting on the CRT', title:'Color Bars'},
  {id:'examples/playfield', chapter:6, name:'Playfield Graphics'},
  {id:'examples/sprite', chapter:7, name:'Players and Sprites'},
  {id:'examples/timing2', chapter:9, name:'Fine Positioning', title:'Fine Position'},
  {id:'examples/missiles', chapter:10, name:'Player/Missile Graphics', title:'Player/Missile'},
  {id:'examples/complexscene', chapter:15, name:'Complex Scene I'},
  {id:'examples/complexscene2', chapter:16, name:'Complex Scene II'},
  {id:'examples/scoreboard', chapter:18, name:'Scoreboard'},
  {id:'examples/collisions', chapter:19, name:'Collisions'},
  {id:'examples/bitmap', chapter:20, name:'Async Playfield: Bitmap', title:'Async PF Bitmap'},
  {id:'examples/brickgame', chapter:21, name:'Async Playfield: Bricks', title:'Async PF Bricks'},
//  {id:'examples/multisprite1', chapter:8, name:'Sprite Kernel'},
  {id:'examples/bigsprite', chapter:22, name:'A Big 48-Pixel Sprite', title:'48-Pixel Sprite'},
  {id:'examples/tinyfonts2', chapter:23, name:'Tiny Text'},
  {id:'examples/score6', chapter:24, name:'6-Digit Score'},
  {id:'examples/retrigger', chapter:26, name:'Sprite Formations'},
//  {id:'examples/tinyfonts', chapter:23, name:'Tiny Fonts, Slow'},
  {id:'examples/multisprite3', chapter:28, name:'Multisprites'},
  {id:'examples/procgen1', chapter:30, name:'Procedural Generation'},
  {id:'examples/lines', chapter:31, name:'Drawing Lines'},
//  {id:'examples/piatable', name:'Timer Table'},
  {id:'examples/musicplayer', chapter:32, name:'Music Player'},
  {id:'examples/road', chapter:33, name:'Pseudo 3D Road'},
  {id:'examples/bankswitching', chapter:35, name:'Bankswitching'},
  {id:'examples/wavetable', chapter:36, name:'Wavetable Sound'},
//  {id:'examples/fullgame', name:'Thru Hike: The Game', title:'Thru Hike'},
];

Javatari.SHOW_ERRORS = false;
Javatari.CARTRIDGE_CHANGE_DISABLED = true;
Javatari.DEBUG_SCANLINE_OVERFLOW = false; // TODO: make a switch
Javatari.AUDIO_BUFFER_SIZE = 256;

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
  text = editor.getValue() || "";
  setCode(text);
});

function getCurrentPresetTitle() {
  if (current_preset_idx < 0)
    return "ROM";
  else
    return PRESETS[current_preset_idx].title || PRESETS[current_preset_idx].name || "ROM";
}

function setLastPreset(id) {
  localStorage.setItem("__lastid", id);
}

function updatePreset(current_preset_id, text) {
  if (text.trim().length) {
    localStorage.setItem(current_preset_id, text);
  }
}

function loadCode(text) {
  editor.setValue(text);
  current_output = null;
  setCode(text);
}

function loadFile(fileid, filename, index) {
  current_preset_id = fileid;
  current_preset_idx = index;
  var text = (localStorage.getItem(fileid) || "");
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
    $.get( "presets/skeleton.a", function( text ) {
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
    loadFile(preset_id, "presets/" + PRESETS[index].id, index);
  } else {
    // no preset found? load local
    loadFile(preset_id, "local/" + preset_id, -1);
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
    return true;
  } else {
    return false;
  }
}

function _shareFile(e) {
  if (current_output == null) {
    alert("Cannot share until errors are fixed.");
    return false;
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
      if (confirm("Share link to file?")) {
        console.log(result);
        var sharekey = result['key'];
        var url = "http://8bitworkshop.com/?sharekey=" + sharekey;
        alert("Copy this link to your clipboard:\n\n" + url);
      }
    }
  });
  return false;
}

function _resetPreset(e) {
  if (current_preset_idx >= 0
    && confirm("Reset '" + PRESETS[current_preset_idx].name + "' to default?")) {
    qs['reset'] = '1';
    window.location = "?" + $.param(qs);
    return true;
  } else {
    return false;
  }
}

function populateExamples(sel) {
  sel.append($("<option />").text("--------- Chapters ---------"));
  for (var i=0; i<PRESETS.length; i++) {
    var preset = PRESETS[i];
    var name = preset.chapter + ". " + preset.name;
    sel.append($("<option />").val(preset.id).text(name).attr('selected',preset.id==current_preset_id));
  }
  sel.append($("<option />").val("_resetPreset").text("<< Reset to Default >>"));
}

function populateLocalFiles(sel) {
  sel.append($("<option />").text("------- Local Files -------"));
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key.startsWith("local/")) {
      var name = key.substring(6);
      sel.append($("<option />").val("local/"+name).text(name).attr('selected',key==current_preset_id));
    }
  }
  sel.append($("<option />").val("_createNewFile").text("<< Create New File >>"));
  //sel.append($("<option />").val("_shareFile").text("<< Share File >>"));
}

function populateSharedFiles(sel) {
  sel.append($("<option />").text("--------- Shared ---------"));
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key.startsWith("shared/")) {
      var name = key.substring(6);
      sel.append($("<option />").val("shared/"+name).text(name).attr('selected',key==current_preset_id));
    }
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
    gotoPresetAt(current_preset_idx - 1);
  });
  $("#preset_next").off('click').click(function() {
    gotoPresetAt(current_preset_idx + 1);
  });
}

function setCode(text) {
  worker.postMessage({code:text});
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
  //console.log(e.data);
  // errors?
  var gutters = $("#editor"); //.find(".CodeMirror-linenumber");
  if (e.data.listing.errors.length > 0) {
    gutters.addClass("has-errors");
    editor.clearGutter("gutter-info");
    for (info of e.data.listing.errors) {
      var div = document.createElement("div");
      div.setAttribute("class", "tooltip tooltiperror");
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
    gutters.removeClass("has-errors");
    updatePreset(current_preset_id, text);
    // load ROM
    var rom = e.data.output.slice(2);
    var rom_changed = rom && !arrayCompare(rom, current_output);
    if (rom_changed) {
      try {
        resume();
        //console.log("Loading ROM length", rom.length);
        Javatari.loadROM(getCurrentPresetTitle(), rom);
        current_output = rom;
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
      for (info of e.data.listing.lines) {
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
            var meta = Javatari.getOpcodeMetadata(opcode, info.offset);
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
  var clkfs = Javatari.room.console.getClocksFromFrameStart() - 1;
  var row = Math.floor(clkfs/76);
  var col = clkfs - row*76;
  return "V" + (row-39) + " H" + (col*3-68);
}

var lastDebugInfo;

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
    var ram = jt.Util.byteStringToUInt8Array(atob(state.r.b));
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
  Javatari.room.console.onBreakpointHit = function(state) {
    var PC = state.c.PC;
    var line = findLineForOffset(PC);
    if (line) {
      console.log("BREAKPOINT", hex(PC), line);
      setCurrentLine(line);
    }
    showMemory(state);
  }
}

function pause() {
  clearBreakpoint();
  if (Javatari.room.console.isRunning()) {
    Javatari.room.console.pause();
  }
}

function resume() {
  clearBreakpoint();
  if (! Javatari.room.console.isRunning()) {
    Javatari.room.console.go();
    editor.setSelection(editor.getCursor());
  }
}

function singleStep() {
  setupBreakpoint();
  Javatari.room.console.debugSingleStepCPUClock();
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
    Javatari.room.console.debugToPC(pc);
  }
}

function clearBreakpoint() {
  Javatari.room.console.disableDebug();
  Javatari.room.console.onBreakpointHit = null;
  $("#dbg_info").empty();
  showMemory();
}

function getClockCountsAtPC(pc) {
  // TODO
  var opcode = current_output[pc - 0xf000];
  var meta = Javatari.getOpcodeMetadata(opcode, pc);
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
    var lob = current_output[pc - 0xf000 + 1];
    var hib = current_output[pc - 0xf000 + 2];
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
  _traceInstructions(pc | 0xf000, MAX_CLOCKS, MAX_CLOCKS);
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
  trace_pending_at_pc = 0xf000;
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

function reset() {
  Javatari.room.console.powerOff();
  Javatari.room.console.resetDebug();
  Javatari.room.console.powerOn();
}

function resetAndDebug() {
  reset();
  runToCursor();
}

function setupDebugControls(){
  $("#dbg_reset").click(resetAndDebug);
  $("#dbg_pause").click(pause);
  $("#dbg_go").click(resume);
  $("#dbg_step").click(singleStep);
  $("#dbg_toline").click(runToCursor);
  $("#dbg_timing").click(traceTiming);
  $("#btn_share").click(_shareFile);
}

function showWelcomeMessage() {
  if (!localStorage.getItem("8bitworkshop.hello"))
  {
          $('#dlg_intro').dialog({
                  title: 'Welcome!',
                  buttons: [{
                          text: "Continue",
                          click: function() { $(this).dialog("close"); },
                          beforeClose: function() { localStorage.setItem("8bitworkshop.hello","true"); }
                  }]
          });
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

setupDebugControls();
setTimeout(function() {
  showWelcomeMessage();
}, 3000);
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
    if (!qs['platform']) {
      qs['platform'] = 'vcs';
    }
    // reset file?
    if (qs['file'] && qs['reset']) {
      localStorage.removeItem(qs['file']);
      localStorage.removeItem('local/' + qs['file']);
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
