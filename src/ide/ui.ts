
// 8bitworkshop IDE user interface

import $ = require("jquery");
import * as bootstrap from "bootstrap";
import { CodeProject } from "./project";
import { WorkerResult, WorkerOutput, VerilogOutput, SourceFile, WorkerError, FileData } from "../common/workertypes";
import { ProjectWindows } from "./windows";
import { Platform, Preset, DebugSymbols, DebugEvalCondition, isDebuggable, EmuState } from "../common/baseplatform";
import { PLATFORMS, EmuHalt, Toolbar } from "../common/emu";
import * as Views from "./views";
import { createNewPersistentStore } from "./store";
import { getFilenameForPath, getFilenamePrefix, highlightDifferences, invertMap, byteArrayToString, compressLZG, stringToByteArray,
         byteArrayToUTF8, isProbablyBinary, getWithBinary, getBasePlatform, getRootBasePlatform, hex } from "../common/util";
import { StateRecorderImpl } from "../common/recorder";
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
var current_preset : Preset;	// current preset object (if selected)
var store;			// persistent store

export var compparams;			// received build params from worker
export var lastDebugState : EmuState;	// last debug state (object)

var lastDebugInfo;		// last debug info (CPU text)
var debugCategory;		// current debug category
var debugTickPaused = false;
var recorderActive = false;
var lastViewClicked = null;

var lastBreakExpr = "c.PC == 0x6000";

// TODO: codemirror multiplex support?
// TODO: move to views.ts?
var TOOL_TO_SOURCE_STYLE = {
  'dasm': '6502',
  'acme': '6502',
  'cc65': 'text/x-csrc',
  'ca65': '6502',
  'nesasm': '6502',
  'z80asm': 'z80',
  'sdasz80': 'z80',
  'sdcc': 'text/x-csrc',
  'verilator': 'verilog',
  'jsasm': 'z80',
  'zmac': 'z80',
  'bataribasic': 'bataribasic',
  'markdown': 'markdown',
  'js': 'javascript',
  'xasm6809': 'z80',
  'cmoc': 'text/x-csrc',
  'yasm': 'gas',
  'smlrc': 'text/x-csrc',
  'inform6': 'inform6',
  'fastbasic': 'fastbasic',
  'basic': 'basic',
  'silice': 'verilog',
}

function gaEvent(category:string, action:string, label?:string, value?:string) {
  if (window['ga']) ga('send', 'event', category, action, label, value);
}
function alertError(s:string) {
  gaEvent('error', platform_id||'error', s);
  setWaitDialog(false);
  bootbox.alert({
    title: '<span class="glyphicon glyphicon-alert" aria-hidden="true"></span> Alert',
    message: s
  });
}
function alertInfo(s:string) {
  setWaitDialog(false);
  bootbox.alert(s);
}

export function loadScript(scriptfn:string) : Promise<Event> {
  return new Promise( (resolve, reject) => {
    var script = document.createElement('script');
    script.onload = resolve;
    script.onerror = reject;
    script.src = scriptfn;
    document.getElementsByTagName('head')[0].appendChild(script);
  });
}

function newWorker() : Worker {
  return new Worker("./src/worker/loader.js");
}

const hasLocalStorage : boolean = function() {
  try {
    const key = "__some_random_key_you_are_not_going_to_use__";
    localStorage.setItem(key, key);
    var has = localStorage.getItem(key) == key;
    localStorage.removeItem(key);
    return has;
  } catch (e) {
    return false;
  }
}();

// https://developers.google.com/web/updates/2016/06/persistent-storage
function requestPersistPermission(interactive: boolean, failureonly: boolean) {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(persistent=>{
      console.log("requestPersistPermission =", persistent);
      if (persistent) {
        interactive && !failureonly && alertInfo("Your browser says it will persist your local file edits, but you may want to back up your work anyway.");
      } else {
        interactive && alertError("Your browser refused to expand the peristent storage quota. Your edits may not be preserved after closing the page.");
      }
    });
  } else {
    interactive && alertError("Your browser may not persist edits after closing the page. Try a different browser.");
  }
}

function getCurrentPresetTitle() : string {
  if (!current_preset)
    return current_project.mainPath || "ROM";
  else
    return current_preset.title || current_preset.name || current_project.mainPath || "ROM";
}

function setLastPreset(id:string) {
  if (hasLocalStorage) {
    if (repo_id && platform_id && !isElectron)
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
  if (isElectronWorkspace) {
    current_project.persistent = false;
    current_project.callbackGetRemote = getElectronFile;
    current_project.callbackStoreFile = putWorkspaceFile;
  } else {
    current_project.callbackGetRemote = getWithBinary;
  }
  current_project.callbackBuildResult = (result:WorkerResult) => {
    setCompileOutput(result);
  };
  current_project.callbackBuildStatus = (busy:boolean) => {
    setBusyStatus(busy);
  };
}

function setBusyStatus(busy: boolean) {
  if (busy) {
    toolbar.addClass("is-busy");
  } else {
    toolbar.removeClass("is-busy");
  }
  $('#compile_spinner').css('visibility', busy ? 'visible' : 'hidden');
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
    a.setAttribute("data-wndid", id);
    if (id == projectWindows.getActiveID())
      $(a).addClass("dropdown-item-checked");
    a.appendChild(document.createTextNode(name));
    li.appendChild(a);
    ul.append(li);
    if (createfn) {
      var onopen = (id, wnd) => {
        ul.find('a').removeClass("dropdown-item-checked");
        $(a).addClass("dropdown-item-checked");
      };
      projectWindows.setCreateFunc(id, createfn);
      projectWindows.setShowFunc(id, onopen);
      $(a).click( (e) => {
        projectWindows.createOrShow(id);
        lastViewClicked = id;
      });
    }
  }

  function loadEditor(path:string) {
    var tool = platform.getToolForFilename(path);
    var mode = tool && TOOL_TO_SOURCE_STYLE[tool];
    return new Views.SourceEditor(path, mode);
  }

  function addEditorItem(id:string) {
    addWindowItem(id, getFilenameForPath(id), () => {
      var data = current_project.getFile(id);
      if (typeof data === 'string')
        return loadEditor(id);
      else if (data instanceof Uint8Array)
        return new Views.BinaryFileView(id, data as Uint8Array);
    });
  }

  // add main file editor
  addEditorItem(current_project.mainPath);

  // add other source files
  current_project.iterateFiles( (id, text) => {
    if (text && id != current_project.mainPath) {
      addEditorItem(id);
    }
  });

  // add listings
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
  if (platform.disassemble && platform.saveState) {
    addWindowItem("#disasm", "Disassembly", () => {
      return new Views.DisassemblerView();
    });
  }
  if (platform.readAddress) {
    addWindowItem("#memory", "Memory Browser", () => {
      return new Views.MemoryView();
    });
  }
  if (current_project.segments && current_project.segments.length) {
    addWindowItem("#memmap", "Memory Map", () => {
      return new Views.MemoryMapView();
    });
  }
  if (platform.readVRAMAddress) {
    addWindowItem("#memvram", "VRAM Browser", () => {
      return new Views.VRAMMemoryView();
    });
  }
  if (platform.startProbing) {
    addWindowItem("#memheatmap", "Memory Probe", () => {
      return new Views.AddressHeatMapView();
    });
    // TODO: only if raster
    addWindowItem("#crtheatmap", "CRT Probe", () => {
      return new Views.RasterPCHeatMapView();
    });
    addWindowItem("#probelog", "Probe Log", () => {
      return new Views.ProbeLogView();
    });
    addWindowItem("#symbolprobe", "Symbol Profiler", () => {
      return new Views.ProbeSymbolView();
    });
    addWindowItem("#callstack", "Call Stack", () => {
      return new Views.CallStackView();
    });
    /*
    addWindowItem("#framecalls", "Frame Profiler", () => {
      return new Views.FrameCallsView();
    });
    */
  }
  if (platform.getDebugTree) {
    addWindowItem("#debugview", "Debug Tree", () => {
      return new Views.DebugBrowserView();
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

async function loadProject(preset_id:string) {
  // set current file ID
  // TODO: this is done twice (mainPath and mainpath!)
  current_project.mainPath = preset_id;
  setLastPreset(preset_id);
  // load files from storage or web URLs
  var result = await current_project.loadFiles([preset_id]);
  measureTimeLoad = new Date(); // for timing calc.
  if (result && result.length) {
    // file found; continue
    loadMainWindow(preset_id);
  } else {
    var skel = await getSkeletonFile(preset_id);
    current_project.filedata[preset_id] = skel || "\n";
    loadMainWindow(preset_id);
    // don't alert if we selected "new file"
    if (!qs['newfile']) {
      alertInfo("Could not find file \"" + preset_id + "\". Loading default file.");
    } else {
      requestPersistPermission(true, true);
    }
    delete qs['newfile'];
    replaceURLState();
  }
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

async function getSkeletonFile(fileid:string) : Promise<string> {
  var ext = platform.getToolForFilename(fileid);
  try {
    return await $.get( "presets/"+getBasePlatform(platform_id)+"/skeleton."+ext, 'text');
  } catch(e) {
    alertError("Could not load skeleton for " + platform_id + "/" + ext + "; using blank file");
  }
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
        gaEvent('workspace', 'file', 'new');
        qs['newfile'] = '1';
        reloadProject(path);
      }
    }
  } as any);
  return true;
}

function _uploadNewFile(e) {
  $("#uploadFileElem").click();
}

// called from index.html
function handleFileUpload(files: File[]) {
  console.log(files);
  var index = 0;
  function uploadNextFile() {
    var f = files[index++];
    if (!f) {
      console.log("Done uploading", index);
      if (index > 2) {
        alertInfo("Files uploaded.");
        setTimeout(updateSelector, 1000); // TODO: wait for files to upload
      } else {
        qs['file'] = files[0].name;
        bootbox.confirm({
          message: "Open '" + qs['file'] + "' as main project file?",
          buttons: {
            confirm: { label: "Open As New Project" },
            cancel: { label: "Include/Link With Project Later" },
          },
          callback: (result) => {
            if (result)
              gotoNewLocation();
            else
              setTimeout(updateSelector, 1000); // TODO: wait for files to upload
          }
        });
      }
      gaEvent('workspace', 'file', 'upload');
    } else {
      var path = f.name;
      var reader = new FileReader();
      reader.onload = function(e) {
        var arrbuf = (<any>e.target).result as ArrayBuffer;
        var data : FileData = new Uint8Array(arrbuf);
        // convert to UTF8, unless it's a binary file
        if (isProbablyBinary(path, data)) {
          //gotoMainFile = false;
        } else {
          data = byteArrayToUTF8(data).replace('\r\n','\n'); // convert CRLF to LF
        }
        // store in local forage
        projectWindows.updateFile(path, data);
        console.log("Uploaded " + path + " " + data.length + " bytes");
        uploadNextFile();
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
  var newstore = createNewPersistentStore(urlparse.repopath);
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
    gaEvent('sync', 'import', githuburl);
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
    if (!confirm("This project (" + current_project.mainPath + ") is already bound to a Github repository. Do you want to re-publish to a new repository? (You can instead choose 'Push Changes' to update files in the existing repository.)"))
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
    }).then( (_sess) => {
      sess = _sess;
      setWaitProgress(0.5);
      repo_id = qs['repo'] = sess.repopath;
      return pushChangesToGithub('initial import from 8bitworkshop.com');
    }).then( () => {
      gaEvent('sync', 'publish', priv?"":name);
      importProjectFromGithub(sess.url, false);
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
      return;
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
  if (current_output == null) {
    alertError("Please fix errors before sharing.");
    return true;
  }
  if (!(current_output instanceof Uint8Array)) {
    alertError("Can't share a Verilog executable yet. (It's not actually a ROM...)");
    return true;
  }
  loadClipboardLibrary();
  loadScript('lib/liblzg.js').then( () => {
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
  loadScript('lib/clipboard.min.js').then( () => {
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

function _downloadCassetteFile_apple2(e) {
  var addr = compparams && compparams.code_start;
  loadScript('lib/c2t.js').then( () => {
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
      alertInfo('<pre style="white-space: pre-wrap">'+stdout+'</pre>');
    }
  });
}

function _downloadCassetteFile_vcs(e) {
  loadScript('lib/makewav.js').then( () => {
    let stdout = '';
    let print_fn = function(s) { stdout += s + "\n"; }
    var prefix = getFilenamePrefix(getCurrentMainFilename());
    let rompath = prefix + ".bin";
    let audpath = prefix + ".wav";
    let _makewav = window['makewav']({
      noInitialRun:false,
      print:print_fn,
      printErr:print_fn,
      arguments:['-ts', '-f0', '-v10', rompath],
      preRun: (mod) => {
        let FS = mod['FS'];
        FS.writeFile(rompath, current_output, {encoding:'binary'});
      }
    });
    _makewav.ready.then((makewav) => {
      let args = [rompath];
      makewav.run(args);
      console.log(stdout);
      let FS = makewav['FS'];
      let audout = FS.readFile(audpath, {'encoding':'binary'});
      if (audout) {
        let blob = new Blob([audout], {type: "audio/wav"});
        saveAs(blob, audpath);
        stdout += "\nConnect your audio output to the SuperCharger input, turn up the volume, and play the audio file.";
        alertInfo('<pre style="white-space: pre-wrap">'+stdout+'</pre>');
      }
    });
  });
}

function _downloadCassetteFile(e) {
  if (current_output == null) {
    alertError("Please fix errors before exporting.");
    return true;
  }
  var fn = window['_downloadCassetteFile_' + getBasePlatform(platform_id)];
  if (fn === undefined) {
    alertError("Cassette export is not supported on this platform.");
    return true;
  }
  fn(e);
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
      if (repo_id) alertError("Can only revert built-in examples. If you want to revert all files, You can pull from the repository.");
      else alertError("Can only revert built-in examples.");
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
  var prefix = getFilenamePrefix(getCurrentMainFilename());
  if (current_output instanceof Uint8Array) {
    var blob = new Blob([current_output], {type: "application/octet-stream"});
    var suffix = (platform.getROMExtension && platform.getROMExtension(current_output)) 
      || "-" + getBasePlatform(platform_id) + ".bin";
    saveAs(blob, prefix + suffix);
  } else if (current_output.code != null) {
    var blob = new Blob([(<VerilogOutput>current_output).code], {type: "text/plain"});
    saveAs(blob, prefix + ".js");
  } else {
    alertError(`The "${platform_id}" platform doesn't have downloadable ROMs.`);
  }
}

function _downloadSourceFile(e) {
  var text = projectWindows.getCurrentText();
  if (!text) return false;
  var blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  saveAs(blob, getCurrentEditorFilename(), {autoBom:false});
}

function _downloadProjectZipFile(e) {
  loadScript('lib/jszip.min.js').then( () => {
    var zip = new JSZip();
    current_project.iterateFiles( (id, data) => {
      if (data) {
        zip.file(getFilenameForPath(id), data);
      }
    });
    zip.generateAsync({type:"blob"}).then( (content) => {
      saveAs(content, getCurrentMainFilename() + "-" + getBasePlatform(platform_id) + ".zip");
    });
  });
}

function _downloadAllFilesZipFile(e) {
  loadScript('lib/jszip.min.js').then( () => {
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
        return saveAs(content, getBasePlatform(platform_id) + "-all.zip");
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
    var isCurrentPreset = preset.id==current_project.mainPath;
    sel.append($("<option />").val(preset.id).text(name).attr('selected',isCurrentPreset?'selected':null));
    if (isCurrentPreset) current_preset = preset;
    files[preset.id] = name;
  }
  return files;
}

function populateRepos(sel) {
  if (hasLocalStorage && !isElectron) {
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

async function populateFiles(sel:JQuery, category:string, prefix:string, foundFiles:{}) {
  var keys = await store.keys();
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
}

function finishSelector(sel) {
  sel.css('visibility','visible');
  // create option if not selected
  var main = current_project.mainPath;
  if (sel.val() != main) {
    sel.append($("<option />").val(main).text(main).attr('selected','selected'));
  }
}

async function updateSelector() {
  var sel = $("#preset_select").empty();
  if (!repo_id) {
    // normal: populate repos, examples, and local files
    populateRepos(sel);
    var foundFiles = populateExamples(sel);
    await populateFiles(sel, "Local Files", "", foundFiles);
    finishSelector(sel);
  } else {
    if (!isElectronWorkspace) {
      sel.append($("<option />").val('/').text('Leave Repository'));
    }
    $("#repo_name").text(getFilenameForPath(repo_id)+'/').show();
    // repo: populate all files
    await populateFiles(sel, repo_id, "", {});
    finishSelector(sel);
  }
  // set click handlers
  sel.off('change').change(function(e) {
    reloadProject($(this).val().toString());
  });
}

function getErrorElement(err : WorkerError) {
  var span = $('<p/>');
  if (err.path != null) {
    var s = err.line ? err.label ? `(${err.path} @ ${err.label})` : `(${err.path}:${err.line})` : `(${err.path})`
    var link = $('<a/>').text(s);
    var path = err.path;
    // TODO: hack because examples/foo.a only gets listed as foo.a
    if (path == getCurrentMainFilename()) path = current_project.mainPath;
    // click link to open file, if it's available...
    if (projectWindows.isWindow(path)) {
      link.click((ev) => {
        var wnd = projectWindows.createOrShow(path);
        if (wnd instanceof Views.SourceEditor) {
          wnd.setCurrentLine(err, true);
        }
      });
    }
    span.append(link);
    span.append('&nbsp;');
  }
  span.append($('<span/>').text(err.msg));
  return span;
}

function hideErrorAlerts() {
  $("#error_alert").hide();
}

function showErrorAlert(errors : WorkerError[]) {
  var div = $("#error_alert_msg").empty();
  for (var err of errors.slice(0,10)) {
    div.append(getErrorElement(err));
  }
  $("#error_alert").show();
}

function showExceptionAsError(err, msg:string) {
  var werr : WorkerError = {msg:msg, line:0};
  if (err instanceof EmuHalt && err.$loc) {
    werr = Object.create(err.$loc);
    werr.msg = msg;
    console.log(werr);
    projectWindows.refresh(false);
  }
  showErrorAlert([werr]);
}

var measureTimeStart : Date = new Date();
var measureTimeLoad : Date;
function measureBuildTime() {
  if (window['ga'] && measureTimeLoad) {
    var measureTimeBuild = new Date();
    ga('send', 'timing', 'load', platform_id, (measureTimeLoad.getTime() - measureTimeStart.getTime()));
    ga('send', 'timing', 'build', platform_id, (measureTimeBuild.getTime() - measureTimeLoad.getTime()));
    measureTimeLoad = null; // only measure once
  }
  //gaEvent('build', platform_id);
}

function setCompileOutput(data: WorkerResult) {
  // errors? mark them in editor
  if (data && data.errors && data.errors.length > 0) {
    toolbar.addClass("has-errors");
    projectWindows.setErrors(data.errors);
    showErrorAlert(data.errors);
  } else {
    toolbar.removeClass("has-errors"); // may be added in next callback
    projectWindows.setErrors(null);
    hideErrorAlerts();
    // exit if compile output unchanged
    if (data == null || data.unchanged) return;
    // process symbol map
    platform.debugSymbols = new DebugSymbols(data.symbolmap, data.debuginfo);
    compparams = data.params;
    // load ROM
    var rom = data.output;
    if (rom) {
      try {
        clearBreakpoint(); // so we can replace memory (TODO: change toolbar btn)
        _resetRecording();
        platform.loadROM(getCurrentPresetTitle(), rom);
        current_output = rom;
        if (!userPaused) _resume();
        measureBuildTime();
        writeOutputROMFile();
      } catch (e) {
        console.log(e);
        toolbar.addClass("has-errors");
        showExceptionAsError(e, e+"");
        current_output = null;
        return;
      }
    }
    // update all windows (listings)
    refreshWindowList();
    projectWindows.refresh(false);
  }
}

async function loadBIOSFromProject() {
  if (platform.loadBIOS) {
    var biospath = platform_id + '.rom';
    var biosdata = await store.getItem(biospath);
    if (biosdata instanceof Uint8Array) {
      console.log('loading BIOS', biospath, biosdata.length + " bytes")
      platform.loadBIOS(biospath, biosdata);
    } else {
      console.log('BIOS file must be binary')
    }
  }
}

function showDebugInfo(state?) {
  if (!isDebuggable(platform)) return;
  var meminfo = $("#mem_info");
  var allcats = platform.getDebugCategories();
  if (allcats && !debugCategory)
    debugCategory = allcats[0];
  var s = state && platform.getDebugInfo(debugCategory, state);
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
  $("#debug_bar, #run_bar").find("button").removeClass("btn_active").removeClass("btn_stopped");
  $("#dbg_"+btnid).addClass("btn_"+btnstate);
}

function checkRunReady() {
  if (current_output == null) {
    alertError("Can't do this until build successfully completes.");
    return false;
  } else
    return true;
}

function openRelevantListing(state: EmuState) {
  // if we clicked on another window, retain it
  if (lastViewClicked != null) return;
  // has to support disassembly, at least
  if (!platform.disassemble) return;
  // search through listings
  var listings = current_project.getListings();
  var bestid = "#disasm";
  var bestscore = 32;
  if (listings) {
    var pc = state.c ? (state.c.EPC || state.c.PC) : 0;
    for (var lstfn in listings) {
      var lst = listings[lstfn];
      var file = lst.assemblyfile || lst.sourcefile;
      // pick either listing or source file
      var wndid = current_project.filename2path[lstfn] || lstfn;
      if (file == lst.sourcefile) wndid = projectWindows.findWindowWithFilePrefix(lstfn);
      // does this window exist?
      if (projectWindows.isWindow(wndid)) {
        var res = file && file.findLineForOffset(pc, 32); // TODO: const
        if (res && pc-res.offset < bestscore) {
          bestid = wndid;
          bestscore = pc-res.offset;
        }
        //console.log(hex(pc,4), wndid, lstfn, bestid, bestscore);
      }
    }
  }
  // if no appropriate listing found, use disassembly view
  projectWindows.createOrShow(bestid, true);
}

function uiDebugCallback(state: EmuState) {
  lastDebugState = state;
  showDebugInfo(state);
  openRelevantListing(state);
  projectWindows.refresh(true); // move cursor
  debugTickPaused = true;
}

function setupDebugCallback(btnid? : string) {
  if (platform.setupDebug) platform.setupDebug((state:EmuState, msg:string) => {
    uiDebugCallback(state);
    setDebugButtonState(btnid||"pause", "stopped");
    msg && showErrorAlert([{msg:"STOPPED: " + msg, line:0}]);
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
  // TODO: hide alerts, but only if exception generated them
}

function resume() {
  clearBreakpoint();
  if (! platform.isRunning() ) {
    projectWindows.refresh(false);
  }
  _resume();
  userPaused = false;
  lastViewClicked = null;
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

function stepOver() {
  if (!checkRunReady()) return;
  setupBreakpoint("stepover");
  platform.stepOver();
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

export function runToPC(pc: number) {
  if (!checkRunReady() || !(pc >= 0)) return;
  setupBreakpoint("toline");
  console.log("Run to", pc.toString(16));
  if (platform.runToPC) {
    platform.runToPC(pc);
  } else {
    platform.runEval((c) => {
      return c.PC == pc;
    });
  }
}

function restartAtCursor() {
  if (platform.restartAtPC(getEditorPC())) {
    resume();
  } else alertError(`Could not restart program at selected line.`);
}

function runToCursor() {
  runToPC(getEditorPC());
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

function resetPlatform() {
  platform.reset();
}

function resetAndRun() {
  if (!checkRunReady()) return;
  clearBreakpoint();
  resetPlatform();
  _resume();
}

function resetAndDebug() {
  if (!checkRunReady()) return;
  var wasRecording = recorderActive;
  _disableRecording();
  if (platform.setupDebug && platform.runEval) { // TODO??
    clearBreakpoint();
    _resume();
    resetPlatform();
    setupBreakpoint("restart");
    platform.runEval((c) => { return true; }); // break immediately
  } else {
    resetPlatform();
    _resume();
  }
  if (wasRecording) _enableRecording();
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

function updateDebugWindows() {
  if (platform.isRunning()) {
    projectWindows.tick();
    debugTickPaused = false;
  } else if (!debugTickPaused) { // final tick after pausing
    projectWindows.tick();
    debugTickPaused = true;
  }
  setTimeout(updateDebugWindows, 100);
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
 loadScript("lib/gif.js").then( () => {
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
    workerScript: 'lib/gif.worker.js',
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
// TODO: lwtools and smaller c
function _addIncludeFile() {
  var fn = getCurrentMainFilename();
  var tool = platform.getToolForFilename(fn);
  if (fn.endsWith(".c") || tool == 'sdcc' || tool == 'cc65' || tool == 'cmoc' || tool == 'smlrc')
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
  if (fn.endsWith(".c") || tool == 'sdcc' || tool == 'cc65' || tool == 'cmoc' || tool == 'smlrc')
    addFileToProject("Linked C (or .s)", ".c", (s) => { return '//#link "'+s+'"' });
  else if (fn.endsWith("asm") || fn.endsWith(".s") || tool == 'ca65' || tool == 'lwasm')
    addFileToProject("Linked ASM", ".inc", (s) => { return ';#link "'+s+'"' });
  else
    alertError("Can't add linked file to this project type (" + tool + ")");
}

function setupDebugControls() {
  // create toolbar buttons
  uitoolbar = new Toolbar($("#toolbar")[0], null);
  uitoolbar.grp.prop('id','run_bar');
  uitoolbar.add('ctrl+alt+r', 'Reset', 'glyphicon-refresh', resetAndRun).prop('id','dbg_reset');
  uitoolbar.add('ctrl+alt+,', 'Pause', 'glyphicon-pause', pause).prop('id','dbg_pause');
  uitoolbar.add('ctrl+alt+.', 'Resume', 'glyphicon-play', resume).prop('id','dbg_go');
  if (platform.restartAtPC) {
    uitoolbar.add('ctrl+alt+/', 'Restart at Cursor', 'glyphicon-play-circle', restartAtCursor).prop('id','dbg_restartatline');
  }
  uitoolbar.newGroup();
  uitoolbar.grp.prop('id','debug_bar');
  if (platform.runEval) {
    uitoolbar.add('ctrl+alt+e', 'Reset and Debug', 'glyphicon-fast-backward', resetAndDebug).prop('id','dbg_restart');
  }
  if (platform.stepBack) {
    uitoolbar.add('ctrl+alt+b', 'Step Backwards', 'glyphicon-step-backward', runStepBackwards).prop('id','dbg_stepback');
  }
  if (platform.step) {
    uitoolbar.add('ctrl+alt+s', 'Single Step', 'glyphicon-step-forward', singleStep).prop('id','dbg_step');
  }
  if (platform.stepOver) {
    uitoolbar.add('ctrl+alt+t', 'Step Over', 'glyphicon-hand-right', stepOver).prop('id','dbg_stepover');
  }
  if (platform.runUntilReturn) {
    uitoolbar.add('ctrl+alt+o', 'Step Out of Subroutine', 'glyphicon-hand-up', runUntilReturn).prop('id','dbg_stepout');
  }
  if (platform.runToVsync) {
    uitoolbar.add('ctrl+alt+n', 'Next Frame/Interrupt', 'glyphicon-forward', singleFrameStep).prop('id','dbg_tovsync');
  }
  if ((platform.runEval || platform.runToPC) && !platform_id.startsWith('verilog')) {
    uitoolbar.add('ctrl+alt+l', 'Run To Line', 'glyphicon-save', runToCursor).prop('id','dbg_toline');
  }
  uitoolbar.newGroup();
  uitoolbar.grp.prop('id','xtra_bar');
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
  if (platform_id.startsWith('apple2') || platform_id.startsWith('vcs')) // TODO: look for function
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
  $("#item_request_persist").click(() => requestPersistPermission(true, false));
  updateDebugWindows();
  // show help button?
  if (platform.showHelp) {
    uitoolbar.add('ctrl+alt+?', 'Show Help', 'glyphicon-question-sign', _lookupHelp);
  }
  if (platform.newCodeAnalyzer) {
    uitoolbar.add(null, 'Analyze CPU Timing', 'glyphicon-time', traceTiming);
  }
  // setup replay slider
  if (platform.setRecorder && platform.advance) {
    setupReplaySlider();
  }
}

function setupReplaySlider() {
    var replayslider = $("#replayslider");
    var clockslider = $("#clockslider");
    var replayframeno = $("#replay_frame");
    var clockno = $("#replay_clock");
    if (!platform.advanceFrameClock) $("#clockdiv").hide(); // TODO: put this test in recorder?
    var updateFrameNo = () => {
      replayframeno.text(stateRecorder.lastSeekFrame+"");
      clockno.text(stateRecorder.lastSeekStep+"");
    };
    var sliderChanged = (e) => {
      _pause();
      var frame : number = parseInt(replayslider.val().toString());
      var step : number = parseInt(clockslider.val().toString());
      if (stateRecorder.loadFrame(frame, step) >= 0) {
        clockslider.attr('min', 0);
        clockslider.attr('max', stateRecorder.lastStepCount);
        updateFrameNo();
        uiDebugCallback(platform.saveState());
      }
    };
    var setFrameTo = (frame:number) => {
      _pause();
      if (stateRecorder.loadFrame(frame) >= 0) {
        replayslider.val(frame);
        updateFrameNo();
        uiDebugCallback(platform.saveState());
      }
    };
    var setClockTo = (clock:number) => {
      _pause();
      var frame : number = parseInt(replayslider.val().toString());
      if (stateRecorder.loadFrame(frame, clock) >= 0) {
        clockslider.val(clock);
        updateFrameNo();
        uiDebugCallback(platform.saveState());
      }
    };
    stateRecorder.callbackStateChanged = () => {
      replayslider.attr('min', 0);
      replayslider.attr('max', stateRecorder.numFrames());
      replayslider.val(stateRecorder.currentFrame());
      clockslider.val(stateRecorder.currentStep());
      updateFrameNo();
      showDebugInfo(platform.saveState());
    };
    replayslider.on('input', sliderChanged);
    clockslider.on('input', sliderChanged);
    //replayslider.on('change', sliderChanged);
    $("#replay_min").click(() => { setFrameTo(1) });
    $("#replay_max").click(() => { setFrameTo(stateRecorder.numFrames()); });
    $("#replay_back").click(() => { setFrameTo(parseInt(replayslider.val().toString()) - 1); });
    $("#replay_fwd").click(() => { setFrameTo(parseInt(replayslider.val().toString()) + 1); });
    $("#clock_back").click(() => { setClockTo(parseInt(clockslider.val().toString()) - 1); });
    $("#clock_fwd").click(() => { setClockTo(parseInt(clockslider.val().toString()) + 1); });
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
          title: "Platform Selector",
          content: "You're currently on the \"<b>" + platform_id + "</b>\" platform. You can choose a different one from the menu."
        },
        {
          element: "#preset_select",
          title: "Project Selector",
          content: "You can choose different code examples, create your own files, or import projects from GitHub."
        },
        {
          element: "#workspace",
          title: "Code Editor",
          content: is_vcs ? "Type your 6502 assembly code into the editor, and it'll be assembled in real-time."
                          : "Type your source code into the editor, and it'll be compiled in real-time."
        },
        {
          element: "#emulator",
          placement: 'left',
          title: "Emulator",
          content: "We'll load your compiled code into the emulator whenever you make changes."
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
    if (!isLandscape()) {
      steps.unshift({
        element: "#controls_top",
        placement: 'bottom',
        title: "Portrait mode detected",
        content: "This site works best on desktop browsers. For best results, rotate your device to landscape orientation."
      });
    }
    if (window.location.host.endsWith('8bitworkshop.com')) {
      steps.unshift({
        element: "#dropdownMenuButton",
        placement: 'right',
        title: "Cookie Consent",
        content: 'Before we start, we should tell you that this website stores cookies and other data in your browser. You can review our <a href="/privacy.html" target="_new">privacy policy</a>.'
      });
      steps.push({
        element: "#booksMenuButton",
        placement: 'left',
        title: "Books",
        content: "Get some books that explain how to program all of this stuff, and write some games!"
      });
    }
    var tour = new Tour({
      autoscroll:false,
      //storage:false,
      steps:steps,
      onEnd: () => {
        //requestPersistPermission(false, true);
      }
    });
    setTimeout(() => { tour.start(); }, 2000);
  }
}

///////////////////////////////////////////////////

export var qs = (function (a : string[]) {
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

const isElectronWorkspace = qs['electron_ws'];
const isElectron = qs['electron'] || isElectronWorkspace;

function globalErrorHandler(msgevent) {
  var msg = (msgevent.message || msgevent.error || msgevent)+"";
  // storage quota full? (Chrome) try to expand it
  if (msg.indexOf("QuotaExceededError") >= 0) {
    requestPersistPermission(false, false);
  } else {
    var err = msgevent.error || msgevent.reason;
    if (err != null && err instanceof EmuHalt) {
      haltEmulation(err);
    }
  }
}

export function haltEmulation(err?: EmuHalt) {
  console.log("haltEmulation");
  _pause();
  emulationHalted(err);
  // TODO: reset platform?
}

// catch errors
function installErrorHandler() {
  window.addEventListener('error', globalErrorHandler);
  window.addEventListener('unhandledrejection', globalErrorHandler);
}
  
function uninstallErrorHandler() {
  window.removeEventListener('error', globalErrorHandler);
  window.removeEventListener('unhandledrejection', globalErrorHandler);
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
  delete qs['']; // remove null parameter
  history.replaceState({}, "", "?" + $.param(qs));
}

function addPageFocusHandlers() {
  var hidden = false;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState == 'hidden' && platform && platform.isRunning()) {
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
    if (platform && platform.isRunning()) {
      _pause();
      hidden = true;
    }
  });
  $(window).on("orientationchange", () => {
    if (platform && platform.resize) setTimeout(platform.resize.bind(platform), 200);
  });
}

// TODO: merge w/ embed.html somehow?
function showInstructions() {
  var div = $(document).find(".emucontrols-" + getRootBasePlatform(platform_id));
  if (platform_id.endsWith(".mame")) div.show(); // TODO: MAME seems to eat the focus() event
  var vcanvas = $("#emulator").find("canvas");
  if (vcanvas) {
    vcanvas.on('focus', () => {
      if (platform.isRunning()) {
        div.fadeIn(200);
        // toggle sound for browser autoplay
        platform.resume();
      }
    });
    vcanvas.on('blur', () => {
      div.fadeOut(200);
    });
  }
}

function installGAHooks() {
  if (window['ga']) {
    $(".dropdown-item").click((e) => {
      if (e.target && e.target.id) {
        gaEvent('menu', e.target.id);
      }
    });
    ga('send', 'pageview', location.pathname+'?platform='+platform_id+(repo_id?('&repo='+repo_id):('&file='+qs['file'])));
  }
}

async function startPlatform() {
  if (!PLATFORMS[platform_id]) throw Error("Invalid platform '" + platform_id + "'.");
  platform = new PLATFORMS[platform_id]($("#emuscreen")[0]);
  setPlatformUI();
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
  installErrorHandler();
  installGAHooks();
  await platform.start();
  await loadBIOSFromProject();
  await initProject();
  await loadProject(qs['file']);
  setupDebugControls();
  addPageFocusHandlers();
  showInstructions();
  if (qs['embed']) {
    hideControlsForEmbed();
  } else {
    updateSelector();
    updateBooksMenu();
    showWelcomeMessage();
  }
  revealTopBar();
}

function hideControlsForEmbed() {
  $('#dropdownMenuButton').hide();
  $('#platformsMenuButton').hide();
  $('#booksMenuButton').hide();
}

function updateBooksMenu() {
  if (getRootBasePlatform(platform_id) == 'nes') $(".book-nes").addClass("book-active");
  else if (getRootBasePlatform(platform_id) == 'vcs') $(".book-vcs").addClass("book-active");
  else if (getRootBasePlatform(platform_id) == 'verilog') $(".book-verilog").addClass("book-active");
  else if (platform.getToolForFilename(getCurrentMainFilename()) == 'sdcc') $(".book-arcade").addClass("book-active");
}

function revealTopBar() {
  setTimeout(() => { $("#controls_dynamic").css('visibility','inherit'); }, 250);
}

export function setupSplits() {
  const splitName = 'workspace-split3-' + platform_id;
  var sizes;
  if (platform_id.startsWith('vcs'))
    sizes = [0, 50, 50];
  else if (qs['embed'] || Views.isMobileDevice)
    sizes = [0, 60, 40];
  else
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
      if (projectWindows) projectWindows.resize();
    },
  });
}

function loadImportedURL(url : string) {
  // TODO: zip file?
  setWaitDialog(true);
  getWithBinary(url, (data) => {
    if (data) {
      var path = 'shared/' + getFilenameForPath(url);
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

async function loadFormDataUpload() {
  var ignore = !!qs['ignore'];
  var force = !!qs['force'];
  for (var i=0; i<20; i++) {
    let path = qs['file'+i+'_name'];
    let dataenc = qs['file'+i+'_data'];
    if (path == null || dataenc == null) break;
    var olddata = await store.getItem(path);
    if (!(ignore && olddata)) {
      let value = dataenc;
      if (qs['file'+i+'_type'] == 'binary') {
        value = stringToByteArray(atob(value));
      }
      if (!olddata || force || confirm("Replace existing file '" + path + "'?")) {
        await store.setItem(path, value);
      }
    }
    if (i == 0) { qs['file'] = path; } // set main filename
    delete qs['file'+i+'_name'];
    delete qs['file'+i+'_data'];
    delete qs['file'+i+'_type'];
  }
  delete qs['ignore'];
  delete qs['force'];
  replaceURLState();
}

function setPlatformUI() {
  var name = platform.getPlatformName && platform.getPlatformName();
  var menuitem = $('a[href="?platform='+platform_id+'"]');
  if (menuitem.length) {
    menuitem.addClass("dropdown-item-checked");
    name = name || menuitem.text() || name;
  }
  $(".platform_name").text(name || platform_id);
}

// start
export async function startUI() {
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
  // lookup repository for this platform
  repo_id = qs['repo'] || (hasLocalStorage && localStorage.getItem("__lastrepo_" + platform_id));
  if (hasLocalStorage && repo_id && repo_id !== '/') {
    var repo = getRepos()[repo_id];
    if (repo) {
      qs['repo'] = repo_id;
      if (repo.platform_id)
        qs['platform'] = platform_id = repo.platform_id;
      if (!qs['file'])
        qs['file'] = repo.mainPath;
      requestPersistPermission(true, true);
    }
  } else {
    repo_id = '';
    delete qs['repo'];
  }
  setupSplits();
  // create store
  store_id = repo_id || getBasePlatform(platform_id);
  store = createNewPersistentStore(store_id);
  // is this an importURL?
  if (qs['importURL']) {
    loadImportedURL(qs['importURL']);
    return; // TODO: make async
  }
  // is this a file POST?
  if (qs['file0_name']) {
    await loadFormDataUpload();
  }
  // load and start platform object
  loadAndStartPlatform();
}

async function loadAndStartPlatform() {
  var platformfn = 'gen/platform/' + platform_id.split(/[.-]/)[0] + '.js'; // required file
  var machinefn  = platformfn.replace('/platform/', '/machine/'); // optional file
  try {
    await loadScript(platformfn); // load platform file
  } catch (e) {
    console.log(e);
    alertError('Platform "' + platform_id + '" not supported.');
    return;
  }
  try {
    await loadScript(machinefn); // load machine file
  } catch (e) {
    console.log('skipped',machinefn); // optional file skipped
  }
  try {
    console.log("starting platform", platform_id); // loaded required <platform_id>.js file
    try {
      await startPlatform();
      document.title = document.title + " [" + platform_id + "] - " + (repo_id?('['+repo_id+'] - '):'') + current_project.mainPath;
    } finally {
      revealTopBar();
    }
  } catch (e) {
    console.log(e);
    alertError('Platform "' + platform_id + '" failed to load.');
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
      uninstallErrorHandler();
      window.location.replace(window.location.href.replace(/^http:/, 'https:'));
    } else {
      $("#item_switch_https").click(_switchToHTTPS).show();
    }
  }
}

// redirect to HTTPS after script loads?
redirectToHTTPS();

//// ELECTRON STUFF

export function setTestInput(path: string, data: FileData) {
  platform.writeFile(path, data);
}

export function getTestOutput(path: string) : FileData {
  return platform.readFile(path);
}

export function getSaveState() {
  return platform.saveState();
}

export function emulationHalted(err: EmuHalt) {
  var msg = (err && err.message) || msg;
  showExceptionAsError(err, msg);
}

// get remote file from local fs
declare var getWorkspaceFile, putWorkspaceFile;
export function getElectronFile(url:string, success:(text:string|Uint8Array)=>void, datatype:'text'|'arraybuffer') {
  // TODO: we have to split() to strip off presets/platform, yukky
  var contents = getWorkspaceFile(url.split('/',3)[2], datatype);
  if (contents != null) {
    success(contents); // return result
  } else {
    getWithBinary(url, success, datatype); // try to load from presets/platform via GET
  }
}
export function reloadWorkspaceFile(path: string) {
  var oldval = current_project.filedata[path];
  if (oldval != null) {
    var datatype = typeof oldval == 'string' ? 'text' : 'arraybuffer';
    projectWindows.updateFile(path, getWorkspaceFile(path, datatype));
  }
}
function writeOutputROMFile() {
  if (isElectronWorkspace && current_output instanceof Uint8Array) {
    var prefix = getFilenamePrefix(getCurrentMainFilename());
    var suffix = (platform.getROMExtension && platform.getROMExtension(current_output)) 
      || "-" + getBasePlatform(platform_id) + ".bin";
    putWorkspaceFile(`bin/${prefix}${suffix}`, current_output);
  }
}
export function highlightSearch(query: string) { // TODO: filename?
  var wnd = projectWindows.getActive();
  if (wnd instanceof Views.SourceEditor) {
    var sc = wnd.editor.getSearchCursor(query);
    if (sc.findNext()) {
      wnd.editor.setSelection(sc.pos.to, sc.pos.from);
    }
  }
}
