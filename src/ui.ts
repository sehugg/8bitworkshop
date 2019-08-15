"use strict";

// 8bitworkshop IDE user interface

import $ = require("jquery");
import * as bootstrap from "bootstrap";
import { CodeProject } from "./project";
import { WorkerResult, WorkerOutput, VerilogOutput, SourceFile, WorkerError, FileData } from "./workertypes";
import { ProjectWindows } from "./windows";
import { Platform, Preset, DebugSymbols, DebugEvalCondition } from "./baseplatform";
import { PLATFORMS, EmuHalt, Toolbar } from "./emu";
import * as Views from "./views";
import { createNewPersistentStore } from "./store";
import { getFilenameForPath, getFilenamePrefix, highlightDifferences, invertMap, byteArrayToString, compressLZG,
         byteArrayToUTF8, isProbablyBinary, getWithBinary, getBasePlatform, getRootBasePlatform, hex } from "./util";
import { StateRecorderImpl } from "./recorder";
import { GHSession, GithubService, getRepos, parseGithubURL } from "./services";

// external libs (TODO)
declare var Tour, GIF, saveAs, JSZip, Mousetrap, Split, firebase;
declare var ga;
// in index.html
declare var exports;

// make sure VCS doesn't start
if (window['Javatari']) window['Javatari'].AUTO_START = false;

var PRESETS : Preset[];			// presets array

export var platform_id : string;	// platform ID string (platform)
export var store_id : string;		// store ID string (repo || platform)
export var repo_id : string;		// repository ID (repo)
export var platform : Platform;		// emulator object

var toolbar = $("#controls_top");

var uitoolbar : Toolbar;

export var current_project : CodeProject;	// current CodeProject object

export var projectWindows : ProjectWindows;	// window manager

var stateRecorder : StateRecorderImpl;

var userPaused : boolean;		// did user explicitly pause?

var current_output : WorkerOutput;  // current ROM
var current_preset_entry : Preset;	// current preset object (if selected)
var store;			// persistent store

export var compparams;			// received build params from worker
export var lastDebugState;		// last debug state (object)

var lastDebugInfo;		// last debug info (CPU text)
var debugCategory;		// current debug category
var debugTickPaused = false;
var recorderActive = false;

var lastBreakExpr = "c.PC == 0x6000";

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
  'xasm6809': 'z80'
}

function alertError(s:string) {
  if (ga) ga('send', 'event', 'error', 'error', s);
  setWaitDialog(false);
  bootbox.alert(s);
}
function alertInfo(s:string) {
  setWaitDialog(false);
  bootbox.alert(s);
}

function newWorker() : Worker {
  return new Worker("./src/worker/loader.js");
}

var hasLocalStorage : boolean = function() {
  try {
    const key = "__some_random_key_you_are_not_going_to_use__";
    localStorage.setItem(key, key);
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}();

function getCurrentPresetTitle() : string {
  if (!current_preset_entry)
    return current_project.mainPath || "ROM";
  else
    return current_preset_entry.title || current_preset_entry.name || current_project.mainPath || "ROM";
}

function setLastPreset(id:string) {
  if (hasLocalStorage) {
    if (repo_id && platform_id)
      localStorage.setItem("__lastrepo_" + platform_id, repo_id);
    else
      localStorage.removeItem("__lastrepo_" + platform_id);
    localStorage.setItem("__lastplatform", platform_id);
    localStorage.setItem("__lastid_" + store_id, id);
  }
}

function unsetLastPreset() {
  if (hasLocalStorage) {
    delete qs['file'];
    localStorage.removeItem("__lastid_"+store_id);
  }
}

function initProject() {
  current_project = new CodeProject(newWorker(), platform_id, platform, store);
  projectWindows = new ProjectWindows($("#workspace")[0] as HTMLElement, current_project);
  current_project.callbackGetRemote = getWithBinary;
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
      $(a).click( (e) => {
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
  addEditorItem(current_project.mainPath);

  // add other source files
  current_project.iterateFiles( (id, text) => {
    if (text && id != current_project.mainPath)
      addEditorItem(id);
  });

  // add listings
  // TODO: update listing when recompiling
  separate = true;
  var listings = current_project.getListings();
  if (listings) {
    for (var lstfn in listings) {
      var lst = listings[lstfn];
      // add listing if source/assembly file exists and has text
      if ((lst.assemblyfile && lst.assemblyfile.text) || (lst.sourcefile && lst.sourcefile.text)) {
        addWindowItem(lstfn, getFilenameForPath(lstfn), (path) => {
          return new Views.ListingView(path);
        });
      }
    }
  }

  // add other tools
  separate = true;
  if (platform.disassemble) {
    addWindowItem("#disasm", "Disassembly", () => {
      return new Views.DisassemblerView();
    });
  }
  if (platform.readAddress) {
    addWindowItem("#memory", "Memory Browser", () => {
      return new Views.MemoryView();
    });
  }
  if (platform.readVRAMAddress) {
    addWindowItem("#memvram", "VRAM Browser", () => {
      return new Views.VRAMMemoryView();
    });
  }
  if (current_project.segments) {
    addWindowItem("#memmap", "Memory Map", () => {
      return new Views.MemoryMapView();
    });
  }
  if (platform.getRasterScanline && platform.setBreakpoint && platform.getCPUState) { // TODO: use profiler class to determine compat
    addWindowItem("#profiler", "Profiler", () => {
      return new Views.ProfileView();
    });
  }
  addWindowItem('#asseteditor', 'Asset Editor', () => {
    return new Views.AssetEditorView();
  });
}

function loadMainWindow(preset_id:string) {
  // we need this to build create functions for the editor
  refreshWindowList();
  // show main file
  projectWindows.createOrShow(preset_id);
  // build project
  current_project.setMainFile(preset_id);
}

function loadProject(preset_id:string) {
  // set current file ID
  // TODO: this is done twice
  current_project.mainPath = preset_id;
  setLastPreset(preset_id);
  // load files from storage or web URLs
  current_project.loadFiles([preset_id]).then((result) => {
    if (result && result.length) {
      // file found; continue
      loadMainWindow(preset_id);
    } else {
      // no file data, load skeleton file
      getSkeletonFile(preset_id).then((skel) => {
        current_project.filedata[preset_id] = skel || "\n";
        loadMainWindow(preset_id);
      });
    }
  });
}

function reloadProject(id:string) {
  // leave repository == '/'
  if (id == '/') {
    qs = {repo:'/'};
  } else if (id.indexOf('://') >= 0) {
    var urlparse = parseGithubURL(id);
    if (urlparse) {
      qs = {repo:urlparse.repopath};
    }
  } else {
    qs['platform'] = platform_id;
    qs['file'] = id;
  }
  gotoNewLocation();
}

function getSkeletonFile(fileid:string) : Promise<string> {
  var ext = platform.getToolForFilename(fileid);
  return $.get( "presets/"+getBasePlatform(platform_id)+"/skeleton."+ext, 'text').catch((e) => {
    alertError("Could not load skeleton for " + platform_id + "/" + ext + "; using blank file");
  });
}

function checkEnteredFilename(fn : string) : boolean {
  if (fn.indexOf(" ") >= 0) {
    alertError("No spaces in filenames, please.");
    return false;
  }
  return true;
}

function _createNewFile(e) {
  // TODO: support spaces
  bootbox.prompt({
    title:"Enter the name of your new main source file.",
    placeholder:"newfile" + platform.getDefaultExtension(),
    callback:(filename) => {
      if (filename && filename.trim().length > 0) {
        if (!checkEnteredFilename(filename)) return;
        if (filename.indexOf(".") < 0) {
          filename += platform.getDefaultExtension();
        }
        var path = filename;
        reloadProject(path);
      }
    }
  } as any);
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
        alertInfo("Files uploaded.");
      }
    } else {
      var path = f.name;
      var reader = new FileReader();
      reader.onload = function(e) {
        var arrbuf = (<any>e.target).result as ArrayBuffer;
        var data : FileData = new Uint8Array(arrbuf);
        // convert to UTF8, unless it's a binary file
        if (isProbablyBinary(path, data)) {
          gotoMainFile = false;
        } else {
          data = byteArrayToUTF8(data).replace('\r\n','\n'); // convert CRLF to LF
        }
        // store in local forage
        // TODO: use projectWindows uploadFile()
        store.setItem(path, data, function(err, result) {
          if (err)
            alertError("Error uploading " + path + ": " + err);
          else {
            console.log("Uploaded " + path + " " + data.length + " bytes");
            if (index == 1) {
              qs['file'] = path; // TODO?
            }
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
  return getFilenameForPath(current_project.mainPath);
}

function getCurrentEditorFilename() : string {
  return getFilenameForPath(projectWindows.getActiveID());
}

// GITHUB stuff (TODO: move)

var githubService : GithubService;

function getCookie(name) : string {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function getGithubService() {
  if (!githubService) {
    // get github API key from cookie
    // TODO: move to service?
    var ghkey = getCookie('__github_key');
    githubService = new GithubService(exports['Octokat'], ghkey, store, current_project);
    console.log("loaded github service");
  }
  return githubService;
}

function getBoundGithubURL() : string {
  var toks = (repo_id||'').split('/');
  if (toks.length != 2) {
    alertError("<p>You are not in a GitHub repository.</p><p>Choose one from the pulldown, or Import or Publish one.</p>");
    return null;
  }
  return 'https://github.com/' + toks[0] + '/' + toks[1];
}

function importProjectFromGithub(githuburl:string, replaceURL:boolean) {
  var sess : GHSession;
  var urlparse = parseGithubURL(githuburl);
  if (!urlparse) {
    alertError('Could not parse Github URL.');
    return;
  }
  // redirect to repo if exists
  var existing = getRepos()[urlparse.repopath];
  if (existing && !confirm("You've already imported " + urlparse.repopath + " -- do you want to replace all local files?")) {
    return;
  }
  // create new store for imported repository
  setWaitDialog(true);
  var newstore = createNewPersistentStore(urlparse.repopath, () => { });
  // import into new store
  setWaitProgress(0.25);
  return getGithubService().import(githuburl).then( (sess1:GHSession) => {
    sess = sess1;
    setWaitProgress(0.75);
    return getGithubService().pull(githuburl, newstore);
  }).then( (sess2:GHSession) => {
    // TODO: only first session has mainPath?
    // reload repo
    qs = {repo:sess.repopath}; // file:sess.mainPath, platform:sess.platform_id};
    setWaitDialog(false);
    gotoNewLocation(replaceURL);
  }).catch( (e) => {
    setWaitDialog(false);
    console.log(e);
    alertError("<p>Could not import " + githuburl + ".</p>" + e);
  });
}

function _loginToGithub(e) {
  getGithubService().login().then(() => {
    alertInfo("You are signed in to Github.");
  }).catch( (e) => {
    alertError("<p>Could not sign in.</p>" + e);
  });
}

function _logoutOfGithub(e) {
  getGithubService().logout().then(() => {
    alertInfo("You are logged out of Github.");
  });
}

function _importProjectFromGithub(e) {
  var modal = $("#importGithubModal");
  var btn = $("#importGithubButton");
  modal.modal('show');
  btn.off('click').on('click', () => {
    var githuburl = $("#importGithubURL").val()+"";
    modal.modal('hide');
    importProjectFromGithub(githuburl, false);
  });
}

function _publishProjectToGithub(e) {
  if (repo_id) {
    alertError("This project (" + current_project.mainPath + ") is already bound to a Github repository. Choose 'Push Changes' to update.");
    return;
  }
  var modal = $("#publishGithubModal");
  var btn = $("#publishGithubButton");
  $("#githubRepoName").val(getFilenamePrefix(getFilenameForPath(current_project.mainPath)));
  modal.modal('show');
  btn.off('click').on('click', () => {
    var name = $("#githubRepoName").val()+"";
    var desc = $("#githubRepoDesc").val()+"";
    var priv = $("#githubRepoPrivate").val() == 'private';
    var license = $("#githubRepoLicense").val()+"";
    var sess;
    if (!name) {
      alertError("You did not enter a project name.");
      return;
    }
    modal.modal('hide');
    setWaitDialog(true);
    getGithubService().login().then( () => {
      setWaitProgress(0.25);
      return getGithubService().publish(name, desc, license, priv);
    }).then( (sess) => {
      setWaitProgress(0.5);
      repo_id = qs['repo'] = sess.repopath;
      return pushChangesToGithub('initial import from 8bitworkshop.com');
    }).then( () => {
      setWaitProgress(1.0);
      reloadProject(current_project.stripLocalPath(current_project.mainPath));
    }).catch( (e) => {
      setWaitDialog(false);
      console.log(e);
      alertError("Could not publish GitHub repository: " + e);
    });
  });
}

function _pushProjectToGithub(e) {
  var ghurl = getBoundGithubURL();
  if (!ghurl) return;
  var modal = $("#pushGithubModal");
  var btn = $("#pushGithubButton");
  modal.modal('show');
  btn.off('click').on('click', () => {
    var commitMsg = $("#githubCommitMsg").val()+"";
    modal.modal('hide');
    pushChangesToGithub(commitMsg);
  });
}

function _pullProjectFromGithub(e) {
  var ghurl = getBoundGithubURL();
  if (!ghurl) return;
  bootbox.confirm("Pull from repository and replace all local files? Any changes you've made will be overwritten.", (ok) => {
    if (ok) {
      setWaitDialog(true);
      getGithubService().pull(ghurl).then( (sess:GHSession) => {
        setWaitDialog(false);
        projectWindows.updateAllOpenWindows(store);
      });
    }
  });
}

function confirmCommit(sess) : Promise<GHSession> {
  return new Promise( (resolve, reject) => {
    var files = sess.commit.files;
    console.log(files);
    // anything changed?
    if (files.length == 0) {
      setWaitDialog(false);
      bootbox.alert("No files changed.");
    }
    // build commit confirm message
    var msg = "";
    for (var f of files) {
      msg += f.filename + ": " + f.status;
      if (f.additions || f.deletions || f.changes) {
        msg += " (" + f.additions + " additions, " + f.deletions + " deletions, " + f.changes + " changes)";
      };
      msg += "<br/>";
    }
    // show dialog, continue when yes
    bootbox.confirm(msg, (ok) => {
      if (ok) {
        resolve(sess);
      } else {
        setWaitDialog(false);
      }
    });
  });
}

function pushChangesToGithub(message:string) {
  var ghurl = getBoundGithubURL();
  if (!ghurl) return;
  // build file list for push
  var files = [];
  for (var path in current_project.filedata) {
    var newpath = current_project.stripLocalPath(path);
    var data = current_project.filedata[path];
    if (newpath && data) {
      files.push({path:newpath, data:data});
    }
  }
  // include built ROM file in bin/[mainfile].rom
  if (current_output instanceof Uint8Array) {
    let binpath = "bin/"+getCurrentMainFilename()+".rom";
    files.push({path:binpath, data:current_output});
  }
  // push files
  setWaitDialog(true);
  return getGithubService().login().then( () => {
    setWaitProgress(0.5);
    return getGithubService().commit(ghurl, message, files);
  }).then( (sess) => {
    return confirmCommit(sess);
  }).then( (sess) => {
    return getGithubService().push(sess);
  }).then( (sess) => {
    setWaitDialog(false);
    alertInfo("Pushed files to " + ghurl);
    return sess;
  }).catch( (e) => {
    setWaitDialog(false);
    console.log(e);
    alertError("Could not push GitHub repository: " + e);
  });
}

function _deleteRepository() {
  var ghurl = getBoundGithubURL();
  if (!ghurl) return;
  bootbox.prompt("<p>Are you sure you want to delete this repository (" + ghurl + ") from browser storage?</p><p>All changes since last commit will be lost.</p><p>Type DELETE to proceed.<p>", (yes) => {
    if (yes.trim().toUpperCase() == "DELETE") {
      deleteRepository();
    }
  });
}

function deleteRepository() {
  var ghurl = getBoundGithubURL();
  var gh;
  setWaitDialog(true);
  // delete all keys in storage
  store.keys().then((keys:string[]) => {
    return Promise.all(keys.map((key) => {
      return store.removeItem(key);
    }));
  }).then(() => {
    gh = getGithubService();
    return gh.getGithubSession(ghurl);
  }).then((sess) => {
    // un-bind repo from list
    gh.bind(sess, false);
  }).then(() => {
    setWaitDialog(false);
    // leave repository
    qs = {repo:'/'};
    gotoNewLocation();
  });
}

function _shareEmbedLink(e) {
  if (current_output == null) { // TODO
    alertError("Please fix errors before sharing.");
    return true;
  }
  if (!(current_output instanceof Uint8Array)) {
    alertError("Can't share a Verilog executable yet. (It's not actually a ROM...)");
    return true;
  }
  loadClipboardLibrary();
  loadScript('lib/liblzg.js', () => {
    // TODO: Module is bad var name (conflicts with MAME)
    var lzgrom = compressLZG( window['Module'], Array.from(<Uint8Array>current_output) );
    window['Module'] = null; // so we load it again next time
    var lzgb64 = btoa(byteArrayToString(lzgrom));
    var embed = {
      p: platform_id,
      //n: current_project.mainPath,
      r: lzgb64
    };
    var linkqs = $.param(embed);
    var fulllink = get8bitworkshopLink(linkqs, 'embed.html');
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

function loadClipboardLibrary() {
  loadScript('lib/clipboard.min.js', () => {
    var ClipboardJS = exports['ClipboardJS'];
    new ClipboardJS(".btn");
  });
}

function get8bitworkshopLink(linkqs : string, fn : string) {
  console.log(linkqs);
  var loc = window.location;
  var prefix = loc.pathname.replace('index.html','');
  var protocol = (loc.host == '8bitworkshop.com') ? 'https:' : loc.protocol;
  var fulllink = protocol+'//'+loc.host+prefix+fn+'?' + linkqs;
  return fulllink;
}

function _downloadCassetteFile(e) {
  if (current_output == null) {
    alertError("Please fix errors before exporting.");
    return true;
  }
  var addr = compparams && compparams.code_start;
  if (addr === undefined) {
    alertError("Cassette export is not supported on this platform.");
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
      alertInfo(stdout);
    }
  });
}

function _revertFile(e) {
  var wnd = projectWindows.getActive();
  if (wnd && wnd.setText) {
    var fn = projectWindows.getActiveID();
    $.get( "presets/"+getBasePlatform(platform_id)+"/"+fn, (text) => {
      bootbox.confirm("Reset '" + fn + "' to default?", (ok) => {
        if (ok) {
          wnd.setText(text);
        }
      });
    }, 'text')
    .fail(() => {
      alertError("Can only revert built-in files.");
    });
  } else {
    alertError("Cannot revert the active window. Please choose a text file.");
  }
}

function _deleteFile(e) {
  var wnd = projectWindows.getActive();
  if (wnd && wnd.getPath) {
    var fn = projectWindows.getActiveID();
    bootbox.confirm("Delete '" + fn + "'?", (ok) => {
      if (ok) {
        store.removeItem(fn).then( () => {
          // if we delete what is selected
          if (qs['file'] == fn) {
            unsetLastPreset();
            gotoNewLocation();
          } else {
            updateSelector();
            alertInfo("Deleted " + fn);
          }
        });
      }
    });
  } else {
    alertError("Cannot delete the active window.");
  }
}

function _renameFile(e) {
  var wnd = projectWindows.getActive();
  if (wnd && wnd.getPath && current_project.getFile(wnd.getPath())) {
    var fn = projectWindows.getActiveID();
    bootbox.prompt({
      title: "Rename '" + fn + "' to?", 
      value: fn,
      callback: (newfn) => {
        var data = current_project.getFile(wnd.getPath());
        if (newfn && newfn != fn && data) {
          if (!checkEnteredFilename(newfn)) return;
          store.removeItem(fn).then( () => {
            return store.setItem(newfn, data);
          }).then( () => {
            updateSelector();
            alert("Renamed " + fn + " to " + newfn); // need alert() so it pauses
            if (fn == current_project.mainPath) {
              reloadProject(newfn);
            }
          });
        }
      }
    });
  } else {
    alertError("Cannot rename the active window.");
  }
}

function _downloadROMImage(e) {
  if (current_output == null) {
    alertError("Please finish compiling with no errors before downloading ROM.");
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
    current_project.iterateFiles( (id, data) => {
      if (data) {
        zip.file(getFilenameForPath(id), data);
      }
    });
    zip.generateAsync({type:"blob"}).then( (content) => {
      saveAs(content, getCurrentMainFilename() + ".zip");
    });
  });
}

function _downloadAllFilesZipFile(e) {
  loadScript('lib/jszip.min.js', () => {
    var zip = new JSZip();
    store.keys( (err, keys : string[]) => {
      return Promise.all(keys.map( (path) => {
        return store.getItem(path).then( (text) => {
          if (text) {
            zip.file(path, text);
          }
        });
      })).then(() => {
        return zip.generateAsync({type:"blob"});
      }).then( (content) => {
        return saveAs(content, platform_id + "-all.zip");
      });
    });
  });
}

function populateExamples(sel) {
  var files = {};
  sel.append($("<option />").text("--------- Examples ---------").attr('disabled','true'));
  for (var i=0; i<PRESETS.length; i++) {
    var preset = PRESETS[i];
    var name = preset.chapter ? (preset.chapter + ". " + preset.name) : preset.name;
    sel.append($("<option />").val(preset.id).text(name).attr('selected',(preset.id==current_project.mainPath)?'selected':null));
    files[preset.id] = name;
  }
  return files;
}

function populateRepos(sel) {
  if (hasLocalStorage) {
    var n = 0;
    var repos = getRepos();
    if (repos) {
      for (let repopath in repos) {
        var repo = repos[repopath];
        if (repo.platform_id && getBasePlatform(repo.platform_id) == getBasePlatform(platform_id)) {
          if (n++ == 0)
            sel.append($("<option />").text("------ Repositories ------").attr('disabled','true'));
          sel.append($("<option />").val(repo.url).text(repo.url.substring(repo.url.indexOf('/'))));
        }
      }
    }
  }
}

function populateFiles(sel:JQuery, category:string, prefix:string, foundFiles:{}, callback:() => void) {
  store.keys().then( (keys:string[]) => {
    var numFound = 0;
    if (!keys) keys = [];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key.startsWith(prefix) && !foundFiles[key]) {
        if (numFound++ == 0)
          sel.append($("<option />").text("------- " + category + " -------").attr('disabled','true'));
        var name = key.substring(prefix.length);
        sel.append($("<option />").val(key).text(name).attr('selected',(key==current_project.mainPath)?'selected':null));
      }
    }
    if (callback) { callback(); }
  });
}

function finishSelector(sel) {
  sel.css('visibility','visible');
  // create option if not selected
  var main = current_project.mainPath;
  if (sel.val() != main) {
    sel.append($("<option />").val(main).text(main).attr('selected','selected'));
  }
}

function updateSelector() {
  var sel = $("#preset_select").empty();
  if (!repo_id) {
    // normal: populate repos, examples, and local files
    populateRepos(sel);
    var foundFiles = populateExamples(sel);
    populateFiles(sel, "Local Files", "", foundFiles, () => {
      finishSelector(sel);
    });
  } else {
    sel.append($("<option />").val('/').text('Leave Repository'));
    // repo: populate all files
    populateFiles(sel, repo_id, "", {}, () => {
      finishSelector(sel);
    });
  }
  // set click handlers
  sel.off('change').change(function(e) {
    reloadProject($(this).val().toString());
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

function loadBIOSFromProject() {
  if (platform.loadBIOS) {
    var biospath = platform_id + '.rom';
    store.getItem(biospath).then( (biosdata) => {
      if (biosdata instanceof Uint8Array) {
        console.log('loading BIOS')
        platform.loadBIOS('BIOS', biosdata);
      }
    });
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
    alertError("Can't do this until build successfully completes.");
    return false;
  } else
    return true;
}

function uiDebugCallback(state) {
  lastDebugState = state;
  showDebugInfo(state);
  projectWindows.refresh(true);
  debugTickPaused = true;
}

function setupDebugCallback(btnid? : string) {
  if (platform.setupDebug) platform.setupDebug((state) => {
    uiDebugCallback(state);
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
  if (platform && platform.isRunning()) {
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
  if (!checkRunReady()) return;
  setupBreakpoint("step");
  platform.step();
}

function singleFrameStep() {
  if (!checkRunReady()) return;
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
  if (!checkRunReady()) return;
  setupBreakpoint("stepout");
  platform.runUntilReturn();
}

function runStepBackwards() {
  if (!checkRunReady()) return;
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
  if (!checkRunReady()) return;
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

function _breakExpression() {
  var modal = $("#debugExprModal");
  var btn = $("#debugExprSubmit");
  $("#debugExprInput").val(lastBreakExpr);
  $("#debugExprExamples").text(getDebugExprExamples());
  modal.modal('show');
  btn.off('click').on('click', () => {
    var exprs = $("#debugExprInput").val()+"";
    modal.modal('hide');
    breakExpression(exprs);
  });
}

function getDebugExprExamples() : string {
  var state = platform.saveState && platform.saveState();
  var cpu = state.c;
  console.log(cpu, state);
  var s = '';
  if (cpu.PC) s += "c.PC == 0x" + hex(cpu.PC) + "\n";
  if (cpu.SP) s += "c.SP < 0x" + hex(cpu.SP) + "\n";
  if (cpu['HL']) s += "c.HL == 0x4000\n";
  if (platform.readAddress) s += "this.readAddress(0x1234) == 0x0\n";
  if (platform.readVRAMAddress) s += "this.readVRAMAddress(0x1234) != 0x80\n";
  if (platform['getRasterScanline']) s += "this.getRasterScanline() > 222\n";
  return s;
}

function breakExpression(exprs : string) {
  var fn = new Function('c', 'return (' + exprs + ');').bind(platform);
  setupBreakpoint();
  platform.runEval(fn as DebugEvalCondition);
  lastBreakExpr = exprs;
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
    debugTickPaused = false;
  } else if (!debugTickPaused) { // final tick after pausing
    projectWindows.tick();
    debugTickPaused = true;
  }
  setTimeout(updateDebugWindows, 200);
}

function setWaitDialog(b : boolean) {
  if (b) {
    setWaitProgress(0);
    $("#pleaseWaitModal").modal('show');
  } else {
    setWaitProgress(1);
    $("#pleaseWaitModal").modal('hide');
  }
}

function setWaitProgress(prog : number) {
  $("#pleaseWaitProgressBar").css('width', (prog*100)+'%').show();
}

var recordingVideo = false;
function _recordVideo() {
  if (recordingVideo) return;
 loadScript("gif.js/dist/gif.js", () => {
  var canvas = $("#emulator").find("canvas")[0] as HTMLElement;
  if (!canvas) {
    alertError("Could not find canvas element to record video!");
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
  gif.on('progress', (prog) => {
    setWaitProgress(prog);
  });
  gif.on('finished', (blob) => {
    img.attr('src', URL.createObjectURL(blob));
    setWaitDialog(false);
    _resume();
    $("#videoPreviewModal").modal('show');
  });
  var intervalMsec = 33;
  var maxFrames = 200;
  var nframes = 0;
  console.log("Recording video", canvas);
  $("#emulator").css('backgroundColor', '#cc3333');
  var f = () => {
    if (nframes++ > maxFrames) {
      console.log("Rendering video");
      $("#emulator").css('backgroundColor', 'inherit');
      setWaitDialog(true);
      _pause();
      gif.render();
      recordingVideo = false;
    } else {
      gif.addFrame(canvas, {delay: intervalMsec, copy: true});
      setTimeout(f, intervalMsec);
      recordingVideo = true;
    }
  };
  f();
 });
}

export function setFrameRateUI(fps:number) {
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

function traceTiming() {
  projectWindows.refresh(false);
  var wnd = projectWindows.getActive();
  if (wnd.getSourceFile && wnd.setTimingResult) { // is editor active?
    var analyzer = platform.newCodeAnalyzer();
    analyzer.showLoopTimingForPC(0);
    wnd.setTimingResult(analyzer);
  }
}

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
    let tool = platform.getToolForFilename(current_project.mainPath);
    platform.showHelp(tool); // TODO: tool, identifier
  }
}

function addFileToProject(type, ext, linefn) {
  var wnd = projectWindows.getActive();
  if (wnd && wnd.insertText) {
    bootbox.prompt({
      title:"Add "+type+" File to Project",
      value:"filename"+ext,
      callback:(filename:string) => {
        if (filename && filename.trim().length > 0) {
          if (!checkEnteredFilename(filename)) return;
          var path = filename;
          var newline = "\n" + linefn(filename) + "\n";
          current_project.loadFiles([path]).then((result) => {
            if (result && result.length) {
              alertError(filename + " already exists; including anyway");
            } else {
              current_project.updateFile(path, "\n");
            }
            wnd.insertText(newline);
            refreshWindowList();
          });
        }
      }
    });
  } else {
    alertError("Can't insert text in this window -- switch back to main file");
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
    alertError("Can't add include file to this project type (" + tool + ")");
}

function _addLinkFile() {
  var fn = getCurrentMainFilename();
  var tool = platform.getToolForFilename(fn);
  if (fn.endsWith(".c") || tool == 'sdcc' || tool == 'cc65')
    addFileToProject("Linked C (or .s)", ".c", (s) => { return '//#link "'+s+'"' });
  else if (fn.endsWith("asm") || fn.endsWith(".s") || tool == 'ca65')
    addFileToProject("Linked ASM", ".inc", (s) => { return ';#link "'+s+'"' });
  else
    alertError("Can't add linked file to this project type (" + tool + ")");
}

function setupDebugControls() {
  // create toolbar buttons
  uitoolbar = new Toolbar($("#toolbar")[0], null);
  uitoolbar.grp.prop('id','debug_bar');
  uitoolbar.add('ctrl+alt+r', 'Reset', 'glyphicon-refresh', resetAndDebug).prop('id','dbg_reset');
  uitoolbar.add('ctrl+alt+,', 'Pause', 'glyphicon-pause', pause).prop('id','dbg_pause');
  uitoolbar.add('ctrl+alt+.', 'Resume', 'glyphicon-play', resume).prop('id','dbg_go');
  if (platform.step) {
    uitoolbar.add('ctrl+alt+s', 'Single Step', 'glyphicon-step-forward', singleStep).prop('id','dbg_step');
  }
  if (platform.runToVsync) {
    uitoolbar.add('ctrl+alt+n', 'Next Frame/Interrupt', 'glyphicon-forward', singleFrameStep).prop('id','dbg_tovsync');
  }
  if ((platform.runEval || platform.runToPC) && !platform_id.startsWith('verilog')) {
    uitoolbar.add('ctrl+alt+l', 'Run To Line', 'glyphicon-save', runToCursor).prop('id','dbg_toline');
  }
  if (platform.runUntilReturn) {
    uitoolbar.add('ctrl+alt+o', 'Step Out of Subroutine', 'glyphicon-hand-up', runUntilReturn).prop('id','dbg_stepout');
  }
  if (platform.stepBack) {
    uitoolbar.add('ctrl+alt+b', 'Step Backwards', 'glyphicon-step-backward', runStepBackwards).prop('id','dbg_stepback');
  }
  uitoolbar.newGroup();
  if (platform.newCodeAnalyzer) {
    uitoolbar.add(null, 'Analyze CPU Timing', 'glyphicon-time', traceTiming);
  }
  // add menu clicks
  $(".dropdown-menu").collapse({toggle: false});
  $("#item_new_file").click(_createNewFile);
  $("#item_upload_file").click(_uploadNewFile);
  $("#item_github_login").click(_loginToGithub);
  $("#item_github_logout").click(_logoutOfGithub);
  $("#item_github_import").click(_importProjectFromGithub);
  $("#item_github_publish").click(_publishProjectToGithub);
  $("#item_github_push").click(_pushProjectToGithub);
  $("#item_github_pull").click(_pullProjectFromGithub);
  $("#item_repo_delete").click(_deleteRepository);
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
  if (platform_id.startsWith('apple2'))
    $("#item_export_cassette").click(_downloadCassetteFile);
  else
    $("#item_export_cassette").hide();
  if (platform.setFrameRate && platform.getFrameRate) {
    $("#dbg_slower").click(_slowerFrameRate);
    $("#dbg_faster").click(_fasterFrameRate);
    $("#dbg_slowest").click(_slowestFrameRate);
    $("#dbg_fastest").click(_fastestFrameRate);
  }
  $("#item_addfile_include").click(_addIncludeFile);
  $("#item_addfile_link").click(_addLinkFile);
  updateDebugWindows();
  // show help button?
  if (platform.showHelp) {
    uitoolbar.add('ctrl+alt+?', 'Show Help', 'glyphicon-question-sign', _lookupHelp);
  }
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
        projectWindows.tick();
      }
    };
    var setFrameTo = (frame:number) => {
      _pause();
      if (stateRecorder.loadFrame(frame)) {
        replayslider.val(frame);
        updateFrameNo(frame);
        projectWindows.tick();
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
    uitoolbar.add('ctrl+alt+0', 'Start/Stop Replay Recording', 'glyphicon-record', _toggleRecording).prop('id','dbg_record');
}


function isLandscape() {
  try {
    var object = window.screen['orientation'] || window.screen['msOrientation'] || window.screen['mozOrientation'] || null;
    if (object) {
      if (object.type.indexOf('landscape') !== -1) { return true; }
      if (object.type.indexOf('portrait') !== -1) { return false; }
    }
    if ('orientation' in window) {
      var value = window.orientation;
      if (value === 0 || value === 180) {
        return false;
      } else if (value === 90 || value === 270) {
        return true;
      }
    }
  } catch (e) { }
  // fallback to comparing width to height
  return window.innerWidth > window.innerHeight;
}

function showWelcomeMessage() {
  if (hasLocalStorage && !localStorage.getItem("8bitworkshop.hello")) {
    // Instance the tour
    var is_vcs = platform_id.startsWith('vcs');
    var steps = [
        {
          element: "#platformsMenuButton",
          placement: 'right',
          title: "Welcome to 8bitworkshop!",
          content: "You are currently on the \"<b>" + platform_id + "</b>\" platform. You can choose a different one from the menu."
        },
        {
          element: "#workspace",
          title: "Code Editor",
          content: is_vcs ? "Type your 6502 assembly code into the editor, and it'll be assembled in real-time. All changes are saved to browser local storage."
                          : "Type your source code into the editor, and it'll be compiled in real-time. All changes are saved to browser local storage."
        },
        {
          element: "#emulator",
          placement: 'left',
          title: "Emulator",
          content: "We'll load your compiled code into the emulator whenever you make changes."
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
          content: "Click the menu to create new files, download your code, or share your work with others."
        },
        {
          element: "#sidebar",
          title: "Sidebar",
          content: "Pull right to expose the sidebar. It lets you switch between source files, view assembly listings, and use other tools like Disassembler, Memory Browser, and Asset Editor."
        }
      ];
    steps.push({
      element: "#booksMenuButton",
      placement: 'right',
      title: "Bookstore",
      content: "Get some books that explain how to program all of this stuff, and write some games!"
    });
    if (!isLandscape()) {
      steps.unshift({
        element: "#controls_top",
        placement: 'bottom',
        title: "Portrait mode detected",
        content: "This site works best on desktop browsers. For best results, rotate your device to landscape orientation."
      });
    }
    var tour = new Tour({
      autoscroll:false,
      //storage:false,
      steps:steps
    });
    setTimeout(() => { tour.start(); }, 2000);
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
        var msgstr = msgevent+"";
        console.log(msgevent, url, line, col, error);
        // emulation threw EmuHalt
        if (error instanceof EmuHalt || msgstr.indexOf("CPU STOP") >= 0) {
          showErrorAlert([ {msg:msgstr, line:0} ]);
          uiDebugCallback(platform.saveState());
          setDebugButtonState("pause", "stopped");
        } else {
          // send exception msg to GA
          var msg = msgstr;
          //if (typeof error == 'string') msg += ": " + error;
          if (line) msg += " (" + line + ":" + col + ")";
          if (msg.length > 256) { msg = msg.substring(0, 256); }
          if (ga) ga('send', 'exception', {
            'exDescription': msg,
            'exFatal': true
          });
          $.get("/error?msg=" + encodeURIComponent(msg), "text");
          alertError(msg);
        }
        _pause();
      };
      window.onunhandledrejection = window.onerror;
    }
}

function uninstallErrorHandler() {
  window.onerror = null;
}

function gotoNewLocation(replaceHistory? : boolean) {
  uninstallErrorHandler();
  if (replaceHistory)
    window.location.replace("?" + $.param(qs));
  else
    window.location.href = "?" + $.param(qs);
}

function replaceURLState() {
  if (platform_id) qs['platform'] = platform_id;
  history.replaceState({}, "", "?" + $.param(qs));
}

function addPageFocusHandlers() {
  var hidden = false;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState == 'hidden' && platform.isRunning()) {
      _pause();
      hidden = true;
    } else if (document.visibilityState == 'visible' && hidden) {
      _resume();
      hidden = false;
    }
  });
  $(window).on("focus", () => {
    if (hidden) {
      _resume();
      hidden = false;
    }
  });
  $(window).on("blur", () => {
    if (platform.isRunning()) {
      _pause();
      hidden = true;
    }
  });
}

function showInstructions() {
  var div = $(document).find(".emucontrols-" + getRootBasePlatform(platform_id));
  var vcanvas = $("#emulator").find("canvas");
  if (vcanvas) {
    vcanvas.on('focus', () => {
      if (platform.isRunning()) div.fadeIn(200);
    });
    vcanvas.on('blur', () => {
      div.fadeOut(200);
    });
  }
}

function installGAHooks() {
  if (ga) {
    $(".dropdown-item").click((e) => {
      if (e.target && e.target.id) {
        ga('send', 'event', 'menu', 'click', e.target.id);
      }
    });
  }
}

function startPlatform() {
  if (!PLATFORMS[platform_id]) throw Error("Invalid platform '" + platform_id + "'.");
  platform = new PLATFORMS[platform_id]($("#emuscreen")[0]);
  stateRecorder = new StateRecorderImpl(platform);
  PRESETS = platform.getPresets();
  if (!qs['file']) {
    // try to load last file (redirect)
    var lastid;
    if (hasLocalStorage) {
      lastid = localStorage.getItem("__lastid_"+store_id);
    }
    // load first preset file, unless we're in a repo
    var defaultfile = lastid || (repo_id ? null : PRESETS[0].id);
    qs['file'] = defaultfile || 'DEFAULT';
    if (!defaultfile) {
      alertError("There is no default main file for this project. Try selecting one from the pulldown.");
    }
  }
  // legacy vcs stuff
  if (platform_id == 'vcs' && qs['file'].startsWith('examples/') && !qs['file'].endsWith('.a')) {
    qs['file'] += '.a';
  }
  // start platform and load file
  replaceURLState();
  platform.start();
  // TODO: ordering of loads?
  loadBIOSFromProject();
  initProject();
  loadProject(qs['file']);
  setupDebugControls();
  updateSelector();
  addPageFocusHandlers();
  installGAHooks();
  showInstructions();
  revealTopBar();
  return true;
}

function revealTopBar() {
  setTimeout(() => { $("#controls_dynamic").css('visibility','inherit'); }, 250);
}

export function loadScript(scriptfn, onload, onerror?) {
  var script = document.createElement('script');
  script.onload = onload;
  script.onerror = onerror;
  script.src = scriptfn;
  document.getElementsByTagName('head')[0].appendChild(script);
}

export function setupSplits() {
  const splitName = 'workspace-split3-' + platform_id;
  var sizes = [0, 50, 50];
  if (!platform_id.startsWith('vcs'))
    sizes = [12, 44, 44];
  var sizesStr = hasLocalStorage && localStorage.getItem(splitName);
  if (sizesStr) {
    try {
      sizes = JSON.parse(sizesStr);
    } catch (e) { console.log(e); }
  }
  var split = Split(['#sidebar', '#workspace', '#emulator'], {
    sizes: sizes,
    minSize: [0, 250, 250],
    onDrag: () => {
      if (platform && platform.resize) platform.resize();
    },
    onDragEnd: () => {
      if (hasLocalStorage)
        localStorage.setItem(splitName, JSON.stringify(split.getSizes()))
      projectWindows.resize();
    },
  });
}

function loadImportedURL(url : string) {
  // TODO: zip file?
  setWaitDialog(true);
  getWithBinary(url, (data) => {
    if (data) {
      var path = 'shared/' + getFilenameForPath(url); // TODO: shared prefix?
      // TODO: progress dialog
      console.log("Importing " + data.length + " bytes as " + path);
      store.getItem(path, (err, olddata) => {
        setWaitDialog(false);
        if (!olddata || confirm("Replace existing file '" + path + "'?")) {
          store.setItem(path, data, (err, result) => {
            if (err)
              alert(err+""); // need to wait
            if (result != null) {
              delete qs['importURL'];
              qs['file'] = path;
              replaceURLState();
              loadAndStartPlatform();
            }
          });
        }
      });
    } else {
      alertError("Could not load source code from URL: " + url);
      setWaitDialog(false);
    }
  }, 'text');
}

// start
export function startUI(loadplatform : boolean) {
  installErrorHandler();
  // import from github?
  if (qs['githubURL']) {
    importProjectFromGithub(qs['githubURL'], true);
    return;
  }
  // add default platform?
  platform_id = qs['platform'] || (hasLocalStorage && localStorage.getItem("__lastplatform"));
  if (!platform_id) {
    platform_id = qs['platform'] = "vcs";
  }
  // lookup repository
  repo_id = qs['repo'] || (hasLocalStorage && localStorage.getItem("__lastrepo_" + platform_id));
  if (hasLocalStorage && repo_id && repo_id !== '/') {
    var repo = getRepos()[repo_id];
    if (repo) {
      qs['repo'] = repo_id;
      if (repo.platform_id)
        qs['platform'] = platform_id = repo.platform_id;
      if (!qs['file'])
        qs['file'] = repo.mainPath;
    }
  } else {
    repo_id = '';
    delete qs['repo'];
  }
  // update UI
  $("#item_platform_"+platform_id).addClass("dropdown-item-checked");
  $("#platform_name").text(platform_id);
  setupSplits();
  // create store
  store_id = repo_id || getBasePlatform(platform_id);
  store = createNewPersistentStore(store_id, (store) => {
    // is this an importURL?
    if (qs['importURL']) {
      loadImportedURL(qs['importURL']);
      return;
    }
    // is vcs? convert legacy stuff
    convertLegacyVCS(store);
    // load and start platform object
    if (loadplatform) {
      loadAndStartPlatform();
    } else {
      startPlatform();
      revealTopBar();
    }
  });
}

function loadAndStartPlatform() {
  var scriptfn = 'gen/platform/' + platform_id.split(/[.-]/)[0] + '.js';
  loadScript(scriptfn, () => {
    console.log("starting platform", platform_id);
    try {
      startPlatform();
      showWelcomeMessage();
      document.title = document.title + " [" + platform_id + "] - " + (repo_id?('['+repo_id+'] - '):'') + current_project.mainPath;
    } finally {
      revealTopBar();
    }
  }, () => {
    alertError('Platform "' + platform_id + '" not supported.');
  });
}

// TODO: remove eventually
function convertLegacyVCS(store) {
  if (platform_id == 'vcs' && hasLocalStorage && !localStorage.getItem("__migratevcs")) {
    store.keys().then((keys:string[]) => {
      keys.forEach((key) => {
        if (key.startsWith('examples/') && !key.endsWith('.a')) {
          store.getItem(key).then( (val) => {
            if (val) {
              return store.setItem(key+'.a', val);
            }
          });
        }
      });
      localStorage.setItem("__migratevcs", "1");
    })
  }
}

// HTTPS REDIRECT

const useHTTPSCookieName = "__use_https";

function setHTTPSCookie(val : number) {
  document.cookie = useHTTPSCookieName + "=" + val + ";domain=8bitworkshop.com;path=/;max-age=315360000";
}

function shouldRedirectHTTPS() : boolean {
  // cookie set? either true or false
  var shouldRedir = getCookie(useHTTPSCookieName);
  if (typeof shouldRedir === 'string') {
    return !!shouldRedir; // convert to bool
  }
  // set a 10yr cookie, value depends on if it's our first time here
  var val = hasLocalStorage && !localStorage.getItem("__lastplatform") ? 1 : 0;
  setHTTPSCookie(val);
  return !!val;
}

function _switchToHTTPS() {
  bootbox.confirm('<p>Do you want to force the browser to use HTTPS from now on?</p>'+
  '<p>WARNING: This will make all of your local files unavailable, so you should "Download All Changes" first for each platform where you have done work.</p>'+
  '<p>You can go back to HTTP by setting the "'+useHTTPSCookieName+'" cookie to 0.</p>', (ok) => {
    if (ok) {
      setHTTPSCookie(1);
      redirectToHTTPS();
    }
  });
}

function redirectToHTTPS() {
  if (window.location.protocol == 'http:' && window.location.host == '8bitworkshop.com') {
    if (shouldRedirectHTTPS()) {
      window.location.replace(window.location.href.replace(/^http:/, 'https:'));
    } else {
      $("#item_switch_https").click(_switchToHTTPS).show();
    }
  }
}

// redirect to HTTPS after script loads?
redirectToHTTPS();
