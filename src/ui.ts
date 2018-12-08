"use strict";

// 8bitworkshop IDE user interface

import $ = require("jquery");
import * as bootstrap from "bootstrap";
import { CodeProject } from "./project";
import { WorkerResult, WorkerOutput, VerilogOutput, SourceFile, WorkerError, FileData } from "./workertypes";
import { ProjectWindows } from "./windows";
import { Platform, Preset, DebugSymbols, DebugEvalCondition } from "./baseplatform";
import { PLATFORMS } from "./emu";
import * as Views from "./views";
import { createNewPersistentStore } from "./store";
import { getFilenameForPath, getFilenamePrefix, highlightDifferences, invertMap, byteArrayToString, compressLZG,
         byteArrayToUTF8, isProbablyBinary } from "./util";
import { StateRecorderImpl } from "./recorder";

// external libs (TODO)
declare var ga, Tour, GIF, saveAs, JSZip, Mousetrap, Split;
// in index.html
declare var exports;

// make sure VCS doesn't start
if (window['Javatari']) window['Javatari'].AUTO_START = false;

var PRESETS : Preset[];		// presets array

export var platform_id : string;	// platform ID string
export var platform : Platform;	// platform object

var toolbar = $("#controls_top");

export var current_project : CodeProject;	// current CodeProject object

var projectWindows : ProjectWindows;	// window manager

var stateRecorder : StateRecorderImpl;

// TODO: codemirror multiplex support?
var TOOL_TO_SOURCE_STYLE = {
  'dasm': '6502',
  'acme': '6502',
  'cc65': 'text/x-csrc',
  'ca65': '6502',
  'z80asm': 'z80',
  'sdasz80': 'z80',
  'sdcc': 'text/x-csrc',
  'verilator': 'verilog',
  'jsasm': 'z80',
  'zmac': 'z80',
  'bataribasic': 'bataribasic',
  'markdown': 'markdown',
}

function newWorker() : Worker {
  return new Worker("./src/worker/loader.js");
}

var userPaused : boolean;		// did user explicitly pause?

var current_output : WorkerOutput;  // current ROM
var current_preset_entry : Preset;	// current preset object (if selected)
var main_file_id : string;	// main file ID
var store;			// persistent store

export var compparams;			// received build params from worker
export var lastDebugState;		// last debug state (object)

var lastDebugInfo;		// last debug info (CPU text)
var debugCategory;		// current debug category

function getCurrentPresetTitle() : string {
  if (!current_preset_entry)
    return main_file_id || "ROM";
  else
    return current_preset_entry.title || current_preset_entry.name || main_file_id || "ROM";
}

function setLastPreset(id:string) {
  if (platform_id != 'base_z80') { // TODO
    localStorage.setItem("__lastplatform", platform_id);
    localStorage.setItem("__lastid_"+platform_id, id);
  }
}

function initProject() {
  current_project = new CodeProject(newWorker(), platform_id, platform, store);
  projectWindows = new ProjectWindows($("#workspace")[0] as HTMLElement, current_project);
  current_project.callbackGetRemote = $.get;
  current_project.callbackBuildResult = (result:WorkerResult) => {
    setCompileOutput(result);
    refreshWindowList();
  };
  current_project.callbackBuildStatus = (busy:boolean) => {
    if (busy) {
      toolbar.addClass("is-busy");
    } else {
      toolbar.removeClass("is-busy");
      toolbar.removeClass("has-errors"); // may be added in next callback
      projectWindows.setErrors(null);
      $("#error_alert").hide();
    }
    $('#compile_spinner').css('visibility', busy ? 'visible' : 'hidden');
  };
}

function refreshWindowList() {
  var ul = $("#windowMenuList").empty();
  var separate = false;

  function addWindowItem(id, name, createfn) {
    if (separate) {
      ul.append(document.createElement("hr"));
      separate = false;
    }
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.setAttribute("class", "dropdown-item");
    a.setAttribute("href", "#");
    if (id == projectWindows.getActiveID())
      $(a).addClass("dropdown-item-checked");
    a.appendChild(document.createTextNode(name));
    li.appendChild(a);
    ul.append(li);
    if (createfn) {
      projectWindows.setCreateFunc(id, createfn);
      $(a).click(function(e) {
        projectWindows.createOrShow(id);
        ul.find('a').removeClass("dropdown-item-checked");
        ul.find(e.target).addClass("dropdown-item-checked");
      });
    }
  }

  function loadEditor(path:string) {
    var tool = platform.getToolForFilename(path);
    var mode = tool && TOOL_TO_SOURCE_STYLE[tool];
    return new Views.SourceEditor(path, mode);
  }
  
  function addEditorItem(id:string) {
    var data = current_project.getFile(id);
    if (typeof data === 'string')
      addWindowItem(id, getFilenameForPath(id), loadEditor);
    else if (data instanceof Uint8Array)
      addWindowItem(id, getFilenameForPath(id), () => { return new Views.BinaryFileView(id, data as Uint8Array); });
  }

  // add main file editor
  addEditorItem(main_file_id);

  // add other source files
  current_project.iterateFiles(function(id, text) {
    if (text && id != main_file_id)
      addEditorItem(id);
  });

  // add listings
  // TODO: update listing when recompiling
  separate = true;
  var listings = current_project.getListings();
  if (listings) {
    for (var lstfn in listings) {
      var lst = listings[lstfn];
      // TODO: add assembly listings? (lines, macrolines, sourcefile)
      if (lst.assemblyfile) {
        addWindowItem(lstfn, getFilenameForPath(lstfn), (path) => {
          return new Views.ListingView(path);
        });
      }
    }
  }

  // add other tools
  separate = true;
  if (platform.disassemble) {
    addWindowItem("#disasm", "Disassembly", function() {
      return new Views.DisassemblerView();
    });
  }
  if (platform.readAddress) {
    addWindowItem("#memory", "Memory Browser", function() {
      return new Views.MemoryView();
    });
  }
}

// can pass integer or string id
function loadProject(preset_id:string) {
  var index = parseInt(preset_id+""); // might fail -1
  for (var i=0; i<PRESETS.length; i++)
    if (PRESETS[i].id == preset_id)
      index = i;
  index = (index + PRESETS.length) % PRESETS.length;
  if (index >= 0) {
    // load the preset
    current_preset_entry = PRESETS[index];
    preset_id = current_preset_entry.id;
  }
  // set current file ID
  main_file_id = preset_id;
  setLastPreset(preset_id);
  current_project.mainPath = preset_id;
  // load files from storage or web URLs
  current_project.loadFiles([preset_id], function(err, result) {
    if (err) {
      alert(err);
    } else if (result && result.length) {
      // we need this to build create functions for the editor
      refreshWindowList();
      // show main file
      projectWindows.createOrShow(preset_id);
      // build project
      current_project.setMainFile(preset_id);
    }
  });
}

function reloadPresetNamed(id:string) {
  qs['platform'] = platform_id;
  qs['file'] = id;
  gotoNewLocation();
}

function getSkeletonFile(fileid:string, callback) {
  var ext = platform.getToolForFilename(fileid);
  // TODO: .mame
  $.get( "presets/"+platform_id+"/skeleton."+ext, function( text ) {
    callback(null, text);
  }, 'text')
  .fail(function() {
    alert("Could not load skeleton for " + platform_id + "/" + ext + "; using blank file");
    callback(null, '\n');
  });
}

function _createNewFile(e) {
  // TODO: support spaces
  var filename = prompt("Create New File", "newfile" + platform.getDefaultExtension());
  if (filename && filename.trim().length > 0) {
    if (filename.indexOf(" ") >= 0) {
      alert("No spaces, please.");
      return;
    }
    if (filename.indexOf(".") < 0) {
      filename += platform.getDefaultExtension();
    }
    var path = "local/" + filename;
    getSkeletonFile(path, function(err, result) {
      if (result) {
        store.setItem(path, result, function(err, result) {
          if (err)
            alert(err+"");
          if (result != null)
            reloadPresetNamed("local/" + filename);
        });
      }
    });
  }
  return true;
}

function _uploadNewFile(e) {
  $("#uploadFileElem").click();
}

function handleFileUpload(files: File[]) {
  console.log(files);
  var index = 0;
  var gotoMainFile = (files.length == 1);
  function uploadNextFile() {
    var f = files[index++];
    if (!f) {
      console.log("Done uploading");
      if (gotoMainFile) {
        gotoNewLocation();
      } else {
        updateSelector();
        alert("Files uploaded.");
      }
    } else {
      var path = "local/" + f.name;
      var reader = new FileReader();
      reader.onload = function(e) {
        var arrbuf = (<any>e.target).result as ArrayBuffer;
        var data : FileData = new Uint8Array(arrbuf);
        // convert to UTF8, unless it's a binary file
        if (isProbablyBinary(data)) { // path.endsWith("bin")) {
          gotoMainFile = false;
        } else {
          data = byteArrayToUTF8(data);
        }
        // store in local forage
        store.setItem(path, data, function(err, result) {
          if (err)
            alert("Error uploading " + path + ": " + err);
          else {
            console.log("Uploaded " + path + " " + data.length + " bytes");
            if (index == 1)
              qs['file'] = path;
            uploadNextFile();
          }
        });
      }
      reader.readAsArrayBuffer(f); // read as binary
    }
  }
  if (files) uploadNextFile();
}

function getCurrentMainFilename() : string {
  return getFilenameForPath(main_file_id);
}

function getCurrentEditorFilename() : string {
  return getFilenameForPath(projectWindows.getActiveID());
}

function _shareFileAsGist(e) {
 loadScript("octokat.js/dist/octokat.js", () => {
  if (current_output == null) { // TODO
    alert("Please fix errors before sharing.");
    return true;
  }
  var text = projectWindows.getCurrentText();
  if (!text) return false;
  var github = new exports['Octokat']();
  var files = {};
  files[getCurrentEditorFilename()] = {"content": text};
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
 });
}

function _shareEmbedLink(e) {
  if (current_output == null) { // TODO
    alert("Please fix errors before sharing.");
    return true;
  }
  if (!(current_output instanceof Uint8Array)) {
    alert("Can't share a Verilog executable yet. (It's not actually a ROM...)");
    return true;
  }
  loadScript('lib/clipboard.min.js', () => {
    var ClipboardJS = exports['ClipboardJS'];
    new ClipboardJS(".btn");
  });
  loadScript('lib/liblzg.js', () => {
    // TODO: Module is bad var name (conflicts with MAME)
    var lzgrom = compressLZG( window['Module'], Array.from(<Uint8Array>current_output) );
    window['Module'] = null; // so we load it again next time
    var lzgb64 = btoa(byteArrayToString(lzgrom));
    var embed = {
      p: platform_id,
      //n: main_file_id,
      r: lzgb64
    };
    var linkqs = $.param(embed);
    console.log(linkqs);
    var loc = window.location;
    var prefix = loc.pathname.replace('index.html','');
    var protocol = (loc.host == '8bitworkshop.com') ? 'https:' : loc.protocol;
    var fulllink = protocol+'//'+loc.host+prefix+'embed.html?' + linkqs;
    var iframelink = '<iframe width=640 height=600 src="' + fulllink + '">';
    $("#embedLinkTextarea").text(fulllink);
    $("#embedIframeTextarea").text(iframelink);
    $("#embedLinkModal").modal('show');
    $("#embedAdviceWarnAll").hide();
    $("#embedAdviceWarnIE").hide();
    if (fulllink.length >= 65536) $("#embedAdviceWarnAll").show();
    else if (fulllink.length >= 5120) $("#embedAdviceWarnIE").show();
  });
  return true;
}

function _downloadCassetteFile(e) {
  if (current_output == null) { // TODO
    alert("Please fix errors before exporting.");
    return true;
  }
  var addr = compparams && compparams.code_start;
  if (addr === undefined) {
    alert("Cassette export is not supported on this platform.");
    return true;
  }
  loadScript('lib/c2t.js', () => {
    var stdout = '';
    var print_fn = function(s) { stdout += s + "\n"; }
    var c2t = window['c2t']({
      noInitialRun:true,
      print:print_fn,
      printErr:print_fn
    });
    var FS = c2t['FS'];
    var rompath = getCurrentMainFilename() + ".bin";
    var audpath = getCurrentMainFilename() + ".wav";
    FS.writeFile(rompath, current_output, {encoding:'binary'});
    var args = ["-2bc", rompath+','+addr.toString(16), audpath];
    c2t.callMain(args);
    var audout = FS.readFile(audpath, {'encoding':'binary'});
    if (audout) {
      var blob = new Blob([audout], {type: "audio/wav"});
      saveAs(blob, audpath);
      stdout += "Then connect your audio output to the cassette input, turn up the volume, and play the audio file.";
      alert(stdout);
    }
  });
}

function fixFilename(fn : string) : string {
  if (platform_id.startsWith('vcs') && fn.indexOf('.') <= 0)
    fn += ".a"; // legacy stuff
  return fn;
}

function _revertFile(e) {
  var wnd = projectWindows.getActive();
  if (wnd && wnd.setText) {
    var fn = fixFilename(projectWindows.getActiveID());
    // TODO: .mame
    $.get( "presets/"+platform_id+"/"+fn, function(text) {
      if (confirm("Reset '" + fn + "' to default?")) {
        wnd.setText(text);
      }
    }, 'text')
    .fail(function() {
      // TODO: delete file
      alert("Can only revert built-in files.");
    });
  } else {
    alert("Cannot revert the active window.");
  }
}

function _deleteFile(e) {
  var wnd = projectWindows.getActive();
  if (wnd && wnd.getPath) {
    var fn = projectWindows.getActiveID();
    if (fn.startsWith("local/")) {
      if (confirm("Delete '" + fn + "'?")) {
        store.removeItem(fn, () => {
          alert("Deleted " + fn);
          updateSelector();
          // TODO: rebuild?
          //gotoNewLocation();
        });
      }
    } else {
      alert("Can only delete local files.");
    }
  } else {
    alert("Cannot delete the active window.");
  }
}

function _renameFile(e) {
  var wnd = projectWindows.getActive();
  if (wnd && wnd.getPath && current_project.getFile(wnd.getPath())) {
    var fn = projectWindows.getActiveID();
    var newfn = prompt("Rename '" + fn + "' to?", fn);
    var data = current_project.getFile(wnd.getPath());
    if (newfn && data && newfn.startsWith("local/")) {
      store.removeItem(fn, () => {
        store.setItem(newfn, data, () => {
          alert("Renamed " + fn + " to " + newfn);
          updateSelector();
          // TODO: rebuild?
          //gotoNewLocation();
        });
      });
    }
  } else {
    alert("Cannot rename the active window.");
  }
}

function _downloadROMImage(e) {
  if (current_output == null) {
    alert("Please finish compiling with no errors before downloading ROM.");
    return true;
  }
  if (current_output instanceof Uint8Array) {
    var blob = new Blob([current_output], {type: "application/octet-stream"});
    saveAs(blob, getCurrentMainFilename()+".rom");
  } else {
    var blob = new Blob([(<VerilogOutput>current_output).code], {type: "text/plain"});
    saveAs(blob, getCurrentMainFilename()+".js");
  }
}

function _downloadSourceFile(e) {
  var text = projectWindows.getCurrentText();
  if (!text) return false;
  var blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  saveAs(blob, getCurrentEditorFilename(), {autoBom:false});
}

function _downloadProjectZipFile(e) {
  loadScript('lib/jszip.min.js', () => {
    var zip = new JSZip();
    current_project.iterateFiles(function(id, text) {
      if (text)
        zip.file(getFilenameForPath(id), text);
    });
    zip.generateAsync({type:"blob"}).then( (content) => {
      saveAs(content, getCurrentMainFilename() + ".zip");
    });
  });
}

function _downloadAllFilesZipFile(e) {
  loadScript('lib/jszip.min.js', () => {
    var zip = new JSZip();
    var count = 0;
    store.keys( (err, keys : string[]) => {
      if (err) throw err;
      keys.forEach((path) => {
        // TODO: handle binary files
        store.getItem(path, (err, text) => {
          if (text) {
            zip.file(fixFilename(getFilenameForPath(path)), text);
          }
          if (++count == keys.length) {
            zip.generateAsync({type:"blob"}).then( (content) => {
              saveAs(content, platform_id + "-all.zip");
            });
          }
        });
      });
    });
  });
}

function populateExamples(sel) {
  // make sure to use callback so it follows other sections
  store.length(function(err, len) {
    sel.append($("<option />").text("--------- Examples ---------").attr('disabled','true'));
    for (var i=0; i<PRESETS.length; i++) {
      var preset = PRESETS[i];
      var name = preset.chapter ? (preset.chapter + ". " + preset.name) : preset.name;
      sel.append($("<option />").val(preset.id).text(name).attr('selected',(preset.id==main_file_id)?'selected':null));
    }
  });
}

function populateFiles(sel, category, prefix) {
  store.keys(function(err, keys : string[]) {
    var foundSelected = false;
    var numFound = 0;
    if (!keys) keys = [];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key.startsWith(prefix)) {
        if (numFound++ == 0)
          sel.append($("<option />").text("------- " + category + " -------").attr('disabled','true'));
        var name = key.substring(prefix.length);
        sel.append($("<option />").val(key).text(name).attr('selected',(key==main_file_id)?'selected':null));
        if (key == main_file_id) foundSelected = true;
      }
    }
    if (!foundSelected && main_file_id && main_file_id.startsWith(prefix)) {
      var name = main_file_id.substring(prefix.length);
      var key = prefix + name;
      sel.append($("<option />").val(key).text(name).attr('selected','true'));
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
    reloadPresetNamed($(this).val().toString());
  });
}

function showErrorAlert(errors : WorkerError[]) {
  var div = $("#error_alert_msg").empty();
  for (var err of errors.slice(0,10)) {
    var s = '';
    if (err.path) s += err.path + ":";
    if (err.line) s += err.line + ":";
    s += err.msg;
    div.append($("<p>").text(s));
  }
  $("#error_alert").show();
}

function setCompileOutput(data: WorkerResult) {
  // errors? mark them in editor
  if (data.errors && data.errors.length > 0) {
    toolbar.addClass("has-errors");
    projectWindows.setErrors(data.errors);
    showErrorAlert(data.errors);
  } else {
    // process symbol map
    platform.debugSymbols = new DebugSymbols(data.symbolmap);
    compparams = data.params;
    // load ROM
    var rom = data.output;
    if (rom) { // TODO instanceof Uint8Array) {
      try {
        clearBreakpoint(); // so we can replace memory (TODO: change toolbar btn)
        _resetRecording();
        platform.loadROM(getCurrentPresetTitle(), rom);
        current_output = rom;
        if (!userPaused) _resume();
        // TODO: reset profiler etc? (Tell views?)
      } catch (e) {
        console.log(e);
        toolbar.addClass("has-errors");
        showErrorAlert([{msg:e+"",line:0}]);
        current_output = null;
        return;
      }
    }
    // update all windows (listings)
    projectWindows.refresh(false);
  }
}

function showDebugInfo(state?) {
  var meminfo = $("#mem_info");
  var allcats = platform.getDebugCategories && platform.getDebugCategories();
  if (allcats && !debugCategory)
    debugCategory = allcats[0];
  var s = state && platform.getDebugInfo && platform.getDebugInfo(debugCategory, state);
  if (s) {
    var hs = lastDebugInfo ? highlightDifferences(lastDebugInfo, s) : s;
    meminfo.show().html(hs);
    var catspan = $('<div class="mem_info_links">');
    var addCategoryLink = (cat:string) => {
      var catlink = $('<a>'+cat+'</a>');
      if (cat == debugCategory)
        catlink.addClass('selected');
      catlink.click((e) => {
        debugCategory = cat;
        lastDebugInfo = null;
        showDebugInfo(lastDebugState);
      });
      catspan.append(catlink);
      catspan.append('<span> </span>');
    }
    for (var cat of allcats) {
      addCategoryLink(cat);
    }
    meminfo.append('<br>');
    meminfo.append(catspan);
    lastDebugInfo = s;
  } else {
    meminfo.hide();
    lastDebugInfo = null;
  }
}

function setDebugButtonState(btnid:string, btnstate:string) {
  $("#debug_bar").find("button").removeClass("btn_active").removeClass("btn_stopped");
  $("#dbg_"+btnid).addClass("btn_"+btnstate);
}

function checkRunReady() {
  if (current_output == null) {
    alert("Can't resume emulation until ROM is successfully built.");
    return false;
  } else
    return true;
}

function setupDebugCallback(btnid? : string) {
  if (platform.setupDebug) platform.setupDebug((state) => {
    lastDebugState = state;
    showDebugInfo(state);
    projectWindows.refresh(true);
    setDebugButtonState(btnid||"pause", "stopped");
  });
}

function setupBreakpoint(btnid? : string) {
  if (!checkRunReady()) return;
  _disableRecording();
  setupDebugCallback(btnid);
  if (btnid) setDebugButtonState(btnid, "active");
}

function _pause() {
  if (platform.isRunning()) {
    platform.pause();
    console.log("Paused");
  }
  setDebugButtonState("pause", "stopped");
}

function pause() {
  clearBreakpoint();
  _pause();
  userPaused = true;
}

function _resume() {
  if (!checkRunReady()) return;
  if (!platform.isRunning()) {
    platform.resume();
    console.log("Resumed");
  }
  setDebugButtonState("go", "active");
}

function resume() {
  clearBreakpoint();
  if (! platform.isRunning() ) {
    projectWindows.refresh(false);
  }
  _resume();
  userPaused = false;
}

function togglePause() {
  if (platform.isRunning())
    pause();
  else
    resume();
}

function singleStep() {
  setupBreakpoint("step");
  platform.step();
}

function singleFrameStep() {
  setupBreakpoint("tovsync");
  platform.runToVsync();
}

function getEditorPC() : number {
  var wnd = projectWindows.getActive();
  return wnd && wnd.getCursorPC && wnd.getCursorPC();
}

function runToCursor() {
  if (!checkRunReady()) return;
  setupBreakpoint("toline");
  var pc = getEditorPC();
  if (pc >= 0) {
    console.log("Run to", pc.toString(16));
    if (platform.runToPC) {
      platform.runToPC(pc);
    } else {
      platform.runEval((c) => {
        return c.PC == pc;
      });
    }
  }
}

function runUntilReturn() {
  setupBreakpoint("stepout");
  platform.runUntilReturn();
}

function runStepBackwards() {
  setupBreakpoint("stepback");
  platform.stepBack();
}

function clearBreakpoint() {
  lastDebugState = null;
  if (platform.clearDebug) platform.clearDebug();
  setupDebugCallback(); // in case of BRK/trap
  showDebugInfo();
}

function resetAndDebug() {
  _disableRecording();
  if (platform.setupDebug && platform.readAddress) { // TODO??
    clearBreakpoint();
    _resume();
    platform.reset();
    setupBreakpoint("reset");
    if (platform.runEval)
      platform.runEval((c) => { return true; }); // break immediately
    else
      ; // TODO???
  } else {
    platform.reset();
  }
}

var lastBreakExpr = "c.PC == 0x6000";
function _breakExpression() {
  var exprs = window.prompt("Enter break expression", lastBreakExpr);
  if (exprs) {
    var fn = new Function('c', 'return (' + exprs + ');').bind(platform);
    setupBreakpoint();
    platform.runEval(fn as DebugEvalCondition);
    lastBreakExpr = exprs;
  }
}

function getSymbolAtAddress(a : number) {
  var addr2symbol = platform.debugSymbols && platform.debugSymbols.addr2symbol;
  if (addr2symbol) {
    if (addr2symbol[a]) return addr2symbol[a];
    var i=0;
    while (--a >= 0) {
      i++;
      if (addr2symbol[a]) return addr2symbol[a] + '+' + i;
    }
  }
  return '';
}

function updateDebugWindows() {
  if (platform.isRunning()) {
    projectWindows.tick();
  }
  setTimeout(updateDebugWindows, 200);
}

function _recordVideo() {
 loadScript("gif.js/dist/gif.js", () => {
  var canvas = $("#emulator").find("canvas")[0] as HTMLElement;
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
  // TODO: recording indicator?
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
  var maxFrames = 420;
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
 });
}

function setFrameRateUI(fps:number) {
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
  _resume();
  setFrameRateUI(60);
}

function _openBitmapEditor() {
  var wnd = projectWindows.getActive();
  if (wnd && wnd.openBitmapEditorAtCursor)
    wnd.openBitmapEditorAtCursor();
}

function traceTiming() {
  projectWindows.refresh(false);
  var wnd = projectWindows.getActive();
  if (wnd.getSourceFile && wnd.setTimingResult) { // is editor active?
    var analyzer = platform.newCodeAnalyzer();
    analyzer.showLoopTimingForPC(0);
    wnd.setTimingResult(analyzer);
  }
}

var recorderActive = false;

function _disableRecording() {
  if (recorderActive) {
    platform.setRecorder(null);
    $("#dbg_record").removeClass("btn_recording");
    $("#replaydiv").hide();
    recorderActive = false;
  }
}

function _resetRecording() {
  if (recorderActive) {
    stateRecorder.reset();
  }
}

function _enableRecording() {
  stateRecorder.reset();
  platform.setRecorder(stateRecorder);
  $("#dbg_record").addClass("btn_recording");
  $("#replaydiv").show();
  recorderActive = true;
}

function _toggleRecording() {
  if (recorderActive) {
    _disableRecording();
  } else {
    _enableRecording();
  }
}

function _lookupHelp() {
  if (platform.showHelp) {
    let tool = platform.getToolForFilename(main_file_id);
    platform.showHelp(tool); // TODO: tool, identifier
  }
}

function addFileToProject(type, ext, linefn) {
  var wnd = projectWindows.getActive();
  if (wnd && wnd.insertText) {
    var filename = prompt("Add "+type+" File to Project", "filename"+ext);
    if (filename && filename.trim().length > 0) {
      var path = "local/" + filename;
      var newline = "\n" + linefn(filename) + "\n";
      current_project.loadFiles([path], (err, result) => {
        if (result && result.length) {
          alert(filename + " already exists; including anyway");
        } else {
          current_project.updateFile(path, "\n");
        }
        wnd.insertText(newline);
        refreshWindowList();
      });
    }
  } else {
    alert("Can't insert text in this window -- switch back to main file");
  }
}

function _addIncludeFile() {
  var fn = getCurrentMainFilename();
  var tool = platform.getToolForFilename(fn);
  if (fn.endsWith(".c") || tool == 'sdcc' || tool == 'cc65')
    addFileToProject("Header", ".h", (s) => { return '#include "'+s+'"' });
  else if (tool == 'dasm' || tool == 'zmac')
    addFileToProject("Include File", ".inc", (s) => { return '\tinclude "'+s+'"' });
  else if (tool == 'ca65' || tool == 'sdasz80')
    addFileToProject("Include File", ".inc", (s) => { return '\t.include "'+s+'"' });
  else if (tool == 'verilator')
    addFileToProject("Verilog File", ".v", (s) => { return '`include "'+s+'"' });
  else
    alert("Can't add include file to this project type (" + tool + ")");
}

function _addLinkFile() {
  var fn = getCurrentMainFilename();
  var tool = platform.getToolForFilename(fn);
  if (fn.endsWith(".c") || tool == 'sdcc' || tool == 'cc65')
    addFileToProject("Linked C", ".c", (s) => { return '//#link "'+s+'"' });
  else
    alert("Can't add linked file to this project type (" + tool + ")");
}

function setupDebugControls(){

  $("#dbg_reset").click(resetAndDebug);
  $("#dbg_pause").click(pause);
  $("#dbg_go").click(resume);
  Mousetrap.bindGlobal('ctrl+alt+p', pause);
  Mousetrap.bindGlobal('ctrl+alt+r', resume);
  Mousetrap.bindGlobal('ctrl+alt+.', resetAndDebug);

  if (platform.step) {
    $("#dbg_step").click(singleStep).show();
    Mousetrap.bindGlobal('ctrl+alt+s', singleStep);
  } else
    $("#dbg_step").hide();

  if (platform.runToVsync) {
    $("#dbg_tovsync").click(singleFrameStep).show();
    Mousetrap.bindGlobal('ctrl+alt+v', singleFrameStep);
  } else
    $("#dbg_tovsync").hide();

  if ((platform.runEval || platform.runToPC) && !platform_id.startsWith('verilog')) {
    $("#dbg_toline").click(runToCursor).show();
    Mousetrap.bindGlobal('ctrl+alt+l', runToCursor);
  } else
    $("#dbg_toline").hide();

  if (platform.runUntilReturn) {
    $("#dbg_stepout").click(runUntilReturn).show();
    Mousetrap.bindGlobal('ctrl+alt+o', runUntilReturn);
  } else
    $("#dbg_stepout").hide();

  if (platform.stepBack) {
    $("#dbg_stepback").click(runStepBackwards).show();
    Mousetrap.bindGlobal('ctrl+alt+b', runStepBackwards);
  } else
    $("#dbg_stepback").hide();

  if (platform.newCodeAnalyzer) {
    $("#dbg_timing").click(traceTiming).show();
  }
  $("#disassembly").hide();
  $("#dbg_bitmap").click(_openBitmapEditor);
  $(".dropdown-menu").collapse({toggle: false});
  $("#item_new_file").click(_createNewFile);
  $("#item_upload_file").click(_uploadNewFile);
  $("#item_share_file").click(_shareEmbedLink);
  $("#item_reset_file").click(_revertFile);
  $("#item_rename_file").click(_renameFile);
  $("#item_delete_file").click(_deleteFile);
  if (platform.runEval)
    $("#item_debug_expr").click(_breakExpression).show();
  else
    $("#item_debug_expr").hide();
  $("#item_download_rom").click(_downloadROMImage);
  $("#item_download_file").click(_downloadSourceFile);
  $("#item_download_zip").click(_downloadProjectZipFile);
  $("#item_download_allzip").click(_downloadAllFilesZipFile);
  $("#item_record_video").click(_recordVideo);
  if (platform_id == 'apple2')
    $("#item_export_cassette").click(_downloadCassetteFile);
  else
    $("#item_export_cassette").hide();
  if (platform.setFrameRate && platform.getFrameRate) {
    $("#dbg_slower").click(_slowerFrameRate);
    $("#dbg_faster").click(_fasterFrameRate);
    $("#dbg_slowest").click(_slowestFrameRate);
    $("#dbg_fastest").click(_fastestFrameRate);
  }
  if (platform.showHelp) {
    $("#dbg_help").show().click(_lookupHelp);
  }
  $("#item_addfile_include").click(_addIncludeFile);
  $("#item_addfile_link").click(_addLinkFile);
  updateDebugWindows();
  // setup replay slider
  if (platform.setRecorder && platform.advance) {
    setupReplaySlider();
  }
}

function setupReplaySlider() {
    var replayslider = $("#replayslider");
    var replayframeno = $("#replay_frame");
    var updateFrameNo = (n) => {
      replayframeno.text(n+"");
    };
    var sliderChanged = (e) => {
      _pause();
      var frame = (<any>e.target).value;
      if (stateRecorder.loadFrame(frame)) {
        updateFrameNo(frame);
      }
    };
    var setFrameTo = (frame:number) => {
      _pause();
      if (stateRecorder.loadFrame(frame)) {
        replayslider.val(frame);
        updateFrameNo(frame);
        console.log('seek to frame',frame);
      }
    };
    stateRecorder.callbackStateChanged = () => {
      replayslider.attr('min', 1);
      replayslider.attr('max', stateRecorder.numFrames());
      replayslider.val(stateRecorder.currentFrame());
      updateFrameNo(stateRecorder.currentFrame());
    };
    replayslider.on('input', sliderChanged);
    replayslider.on('change', sliderChanged);
    $("#replay_min").click(() => { setFrameTo(1) });
    $("#replay_max").click(() => { setFrameTo(stateRecorder.numFrames()); });
    $("#replay_back").click(() => { setFrameTo(parseInt(replayslider.val().toString()) - 1); });
    $("#replay_fwd").click(() => { setFrameTo(parseInt(replayslider.val().toString()) + 1); });
    $("#replay_bar").show();
    $("#dbg_record").click(_toggleRecording).show();
}

function showWelcomeMessage() {
  if (!localStorage.getItem("8bitworkshop.hello")) {
    // Instance the tour
    var is_vcs = platform_id == 'vcs';
    var steps = [
        {
          element: "#workspace",
          title: "Welcome to 8bitworkshop!",
          content: is_vcs ? "Type your 6502 assembly code into the editor, and it'll be assembled in real-time. All changes are saved to browser local storage."
                          : "Type your source code into the editor, and it'll be compiled in real-time. All changes are saved to browser local storage."
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
          content: "Click the menu to download your code, switch between platforms, create new files, or share your work with others."
        }];
    if (!is_vcs) {
      steps.push({
        element: "#windowMenuButton",
        title: "Window List",
        content: "Switch between editor windows, assembly listings, and other tools like disassembler and memory dump."
      });
    }
    steps.push({
      element: "#booksMenuButton",
      placement: 'left',
      title: "Bookstore",
      content: "Get some books that explain how to program all of this stuff!"
    });
    var tour = new Tour({
      autoscroll:false,
      //storage:false,
      steps:steps
    });
    tour.init();
    setTimeout(function() { tour.start(); }, 2000);
  }
}

///////////////////////////////////////////////////

var qs = (function (a : string[]) {
    if (!a || a.length == 0)
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

// catch errors
function installErrorHandler() {
  if (typeof window.onerror == "object") {
      window.onerror = function (msgevent, url, line, col, error) {
        console.log(msgevent, url, line, col);
        console.log(error);
        ga('send', 'exception', {
          'exDescription': msgevent + " " + url + " " + " " + line + ":" + col + ", " + error,
          'exFatal': true
        });
        alert(msgevent+"");
        _pause();
      };
  }
}

function uninstallErrorHandler() {
  window.onerror = null;
}

function gotoNewLocation() {
  uninstallErrorHandler();
  window.location.href = "?" + $.param(qs);
}

function replaceURLState() {
  if (platform_id) qs['platform'] = platform_id;
  history.replaceState({}, "", "?" + $.param(qs));
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
  if (!PLATFORMS[platform_id]) throw Error("Invalid platform '" + platform_id + "'.");
  platform = new PLATFORMS[platform_id]($("#emulator")[0]);
  stateRecorder = new StateRecorderImpl(platform);
  PRESETS = platform.getPresets();
  if (!qs['file']) {
    // try to load last file (redirect)
    var lastid = localStorage.getItem("__lastid_"+platform_id) || localStorage.getItem("__lastid");
    localStorage.removeItem("__lastid");
    qs['file'] = lastid || PRESETS[0].id;
    replaceURLState();
  }
  // start platform and load file
  platform.start();
  initProject();
  loadProject(qs['file']);
  setupDebugControls();
  updateSelector();
  showBookLink();
  addPageFocusHandlers();
  return true;
}

function loadSharedFile(sharekey : string) {
 loadScript("octokat.js/dist/octokat.js", () => {
  var github = new exports['Octokat']();
  var gist = github.gists(sharekey);
  gist.fetch().done(function(val) {
    var filename;
    for (filename in val.files) { break; }
    var newid = 'shared/' + filename;
    var json = JSON.parse(val.description.slice(val.description.indexOf(' ')+1));
    console.log("Fetched " + newid, json);
    platform_id = json['platform'];
    store = createNewPersistentStore(platform_id, () => {
      // runs after migration, if it happens
      current_project.updateFile(newid, val.files[filename].content);
      reloadPresetNamed(newid);
      delete qs['sharekey'];
      gotoNewLocation();
    });
  }).fail(function(err) {
    alert("Error loading share file: " + err.message);
  });
 });
}

function loadScript(scriptfn, onload) {
  var script = document.createElement('script');
  script.onload = onload;
  script.src = scriptfn;
  document.getElementsByTagName('head')[0].appendChild(script);
}

export function setupSplits() {
  const splitName = 'workspace-split3-' + platform_id;
  var sizes = [0, 50, 50];
  var sizesStr = localStorage.getItem(splitName)
  if (sizesStr) {
    try {
      sizes = JSON.parse(sizesStr);
    } catch (e) { console.log(e); }
  }
  var split;
  split = Split(['#sidebar', '#workspace', '#emulator'], {
    sizes: sizes,
    minSize: [0, 250, 250],
    onDrag: () => {
      if (platform && platform.resize) platform.resize();
    },
    onDragEnd: () => {
      localStorage.setItem(splitName, JSON.stringify(split.getSizes()))
    },
  });
}

// start
export function startUI(loadplatform : boolean) {
  installErrorHandler();
  // add default platform?
  platform_id = qs['platform'] || localStorage.getItem("__lastplatform");
  if (!platform_id) {
    platform_id = qs['platform'] = "vcs";
  }
  $("#item_platform_"+platform_id).addClass("dropdown-item-checked");
  setupSplits();
  // parse query string
  // is this a share URL?
  if (qs['sharekey']) {
    loadSharedFile(qs['sharekey']);
  } else {
    store = createNewPersistentStore(platform_id, null);
    // reset file?
    if (qs['file'] && qs['reset']) {
      store.removeItem(qs['fileview'] || qs['file']);
      qs['reset'] = '';
      gotoNewLocation();
    } else {
      // load and start platform object
      if (loadplatform) {
        var scriptfn = 'gen/platform/' + platform_id.split(/[.-]/)[0] + '.js';
        loadScript(scriptfn, () => {
          console.log("loaded platform", platform_id);
          startPlatform();
          showWelcomeMessage();
        });
      } else {
        startPlatform();
        showWelcomeMessage();
      }
    }
  }
}

