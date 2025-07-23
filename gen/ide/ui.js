"use strict";
// 8bitworkshop IDE user interface
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lastDebugState = exports.projectWindows = exports.current_project = exports.platform = exports.repo_id = exports.store_id = exports.platform_id = exports.qs = void 0;
exports.getPlatformStore = getPlatformStore;
exports.getCurrentProject = getCurrentProject;
exports.getCurrentOutput = getCurrentOutput;
exports.getWorkerParams = getWorkerParams;
exports.getCurrentMainFilename = getCurrentMainFilename;
exports.getCurrentEditorFilename = getCurrentEditorFilename;
exports.setupBreakpoint = setupBreakpoint;
exports.runToPC = runToPC;
exports.clearBreakpoint = clearBreakpoint;
exports.setFrameRateUI = setFrameRateUI;
exports.haltEmulation = haltEmulation;
exports.gotoNewLocation = gotoNewLocation;
exports.setupSplits = setupSplits;
exports.getPlatformAndRepo = getPlatformAndRepo;
exports.startUI = startUI;
exports.setTestInput = setTestInput;
exports.getTestOutput = getTestOutput;
exports.getSaveState = getSaveState;
exports.emulationHalted = emulationHalted;
exports.reloadWorkspaceFile = reloadWorkspaceFile;
exports.highlightSearch = highlightSearch;
const localforage = __importStar(require("localforage"));
const project_1 = require("./project");
const windows_1 = require("./windows");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const toolbar_1 = require("./toolbar");
const util_1 = require("../common/util");
const recorder_1 = require("../common/recorder");
const services_1 = require("./services");
const Split = require("split.js");
const _index_1 = require("../platform/_index");
const editors_1 = require("./views/editors");
const debugviews_1 = require("./views/debugviews");
const asseteditor_1 = require("./views/asseteditor");
const baseviews_1 = require("./views/baseviews");
const treeviews_1 = require("./views/treeviews");
const DOMPurify = require("dompurify");
const dialogs_1 = require("./dialogs");
const sync_1 = require("./sync");
const analytics_1 = require("./analytics");
const shareexport_1 = require("./shareexport");
/// EXPORTED GLOBALS (TODO: remove)
exports.qs = (0, util_1.decodeQueryString)(window.location.search || '?');
// private globals
var compparams; // received build params from worker
var platform_name; // platform name (after setPlatformUI)
var toolbar = $("#controls_top");
var uitoolbar;
var stateRecorder;
var userPaused; // did user explicitly pause?
var current_output; // current ROM (or other object)
var current_preset; // current preset object (if selected)
var store; // persistent store
const isElectron = (0, util_1.parseBool)(exports.qs.electron);
const isEmbed = (0, util_1.parseBool)(exports.qs.embed);
var lastDebugInfo; // last debug info (CPU text)
var debugCategory; // current debug category
var debugTickPaused = false;
var recorderActive = false;
var lastViewClicked = null;
var lastDebugCommand = null;
var errorWasRuntime = false;
var lastBreakExpr = "c.PC == 0x6000";
function getPlatformStore() {
    return store;
}
function getCurrentProject() {
    return exports.current_project;
}
function getCurrentOutput() {
    return current_output;
}
function getWorkerParams() {
    return compparams;
}
// TODO: codemirror multiplex support?
// TODO: move to views.ts?
const TOOL_TO_SOURCE_STYLE = {
    'dasm': '6502',
    'acme': '6502',
    'cc65': 'text/x-csrc',
    'ca65': '6502',
    'nesasm': '6502',
    'z80asm': 'z80',
    'sdasz80': 'z80',
    'sdasgb': 'z80',
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
    'wiz': 'text/x-wiz',
    'vasmarm': 'vasm',
    'armips': 'vasm',
    'ecs': 'ecs',
    'remote:llvm-mos': 'text/x-csrc',
    'cc7800': 'text/x-csrc',
    'armtcc': 'text/x-csrc',
    'oscar64': 'text/x-csrc',
};
// TODO: move into tool class
const TOOL_TO_HELPURL = {
    'dasm': 'https://raw.githubusercontent.com/sehugg/dasm/master/doc/dasm.txt',
    'cc65': 'https://cc65.github.io/doc/cc65.html',
    'ca65': 'https://cc65.github.io/doc/ca65.html',
    'sdcc': 'http://sdcc.sourceforge.net/doc/sdccman.pdf',
    'verilator': 'https://www.veripool.org/ftp/verilator_doc.pdf',
    'fastbasic': 'https://github.com/dmsc/fastbasic/blob/master/manual.md',
    'bataribasic': "help/bataribasic/manual.html",
    'wiz': "https://github.com/wiz-lang/wiz/blob/master/readme.md#wiz",
    'silice': "https://github.com/sylefeb/Silice",
    'zmac': "https://raw.githubusercontent.com/sehugg/zmac/master/doc.txt",
    'cmoc': "http://perso.b2b2c.ca/~sarrazip/dev/cmoc.html",
    'remote:llvm-mos': 'https://llvm-mos.org/wiki/Welcome',
    'acme': 'https://raw.githubusercontent.com/sehugg/acme/main/docs/QuickRef.txt',
};
function newWorker() {
    // TODO: return new Worker("https://8bitworkshop.com.s3-website-us-east-1.amazonaws.com/dev/gen/worker/bundle.js");
    return new Worker("./gen/worker/bundle.js");
}
const hasLocalStorage = function () {
    try {
        const key = "__some_random_key_you_are_not_going_to_use__";
        localStorage.setItem(key, key);
        var has = localStorage.getItem(key) == key;
        localStorage.removeItem(key);
        return has;
    }
    catch (e) {
        return false;
    }
}();
// wrapper for localstorage
class UserPrefs {
    setLastPreset(id) {
        if (hasLocalStorage && !isEmbed) {
            if (exports.repo_id && exports.platform_id && !isElectron)
                localStorage.setItem("__lastrepo_" + exports.platform_id, exports.repo_id);
            else
                localStorage.removeItem("__lastrepo_" + exports.platform_id);
            localStorage.setItem("__lastplatform", exports.platform_id);
            localStorage.setItem("__lastid_" + exports.store_id, id);
        }
    }
    unsetLastPreset() {
        if (hasLocalStorage && !isEmbed) {
            delete exports.qs.file;
            localStorage.removeItem("__lastid_" + exports.store_id);
        }
    }
    getLastPreset() {
        return hasLocalStorage && !isEmbed && localStorage.getItem("__lastid_" + exports.store_id);
    }
    getLastPlatformID() {
        return hasLocalStorage && !isEmbed && localStorage.getItem("__lastplatform");
    }
    getLastRepoID(platform) {
        return hasLocalStorage && !isEmbed && platform && localStorage.getItem("__lastrepo_" + platform);
    }
    shouldCompleteTour() {
        return hasLocalStorage && !isEmbed && !localStorage.getItem("8bitworkshop.hello");
    }
    completedTour() {
        if (hasLocalStorage && !isEmbed)
            localStorage.setItem("8bitworkshop.hello", "true");
    }
}
var userPrefs = new UserPrefs();
// https://developers.google.com/web/updates/2016/06/persistent-storage
function requestPersistPermission(interactive, failureonly) {
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(persistent => {
            console.log("requestPersistPermission =", persistent);
            if (persistent) {
                interactive && !failureonly && (0, dialogs_1.alertInfo)("Your browser says it will persist your local file edits, but you may want to back up your work anyway.");
            }
            else {
                interactive && (0, dialogs_1.alertError)("Your browser refused to expand the peristent storage quota. Your edits may not be preserved after closing the page.");
            }
        });
    }
    else {
        interactive && (0, dialogs_1.alertError)("Your browser may not persist edits after closing the page. Try a different browser.");
    }
}
function getCurrentPresetTitle() {
    if (!current_preset)
        return exports.current_project.mainPath || "ROM";
    else
        return current_preset.title || current_preset.name || exports.current_project.mainPath || "ROM";
}
async function newFilesystem() {
    var basefs = new project_1.WebPresetsFileSystem(exports.platform_id);
    if (isElectron) {
        console.log('using electron with local filesystem', alternateLocalFilesystem);
        return new project_1.OverlayFilesystem(basefs, alternateLocalFilesystem);
    }
    else if (exports.qs.localfs != null) {
        return new project_1.OverlayFilesystem(basefs, await getLocalFilesystem(exports.qs.localfs));
    }
    else {
        return new project_1.OverlayFilesystem(basefs, new project_1.LocalForageFilesystem(store));
    }
}
async function initProject() {
    var filesystem = await newFilesystem();
    exports.current_project = new project_1.CodeProject(newWorker(), exports.platform_id, exports.platform, filesystem);
    exports.current_project.remoteTool = exports.qs.tool || null;
    exports.projectWindows = new windows_1.ProjectWindows($("#workspace")[0], exports.current_project);
    exports.current_project.callbackBuildResult = (result) => {
        setCompileOutput(result);
    };
    exports.current_project.callbackBuildStatus = (busy) => {
        setBusyStatus(busy);
    };
}
function setBusyStatus(busy) {
    if (busy) {
        toolbar.addClass("is-busy");
    }
    else {
        toolbar.removeClass("is-busy");
    }
    $('#compile_spinner').css('visibility', busy ? 'visible' : 'hidden');
}
function newDropdownListItem(id, text) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.setAttribute("class", "dropdown-item");
    a.setAttribute("href", "#");
    a.setAttribute("data-wndid", id);
    if (id == exports.projectWindows.getActiveID())
        $(a).addClass("dropdown-item-checked");
    a.appendChild(document.createTextNode(text));
    li.appendChild(a);
    return { li, a };
}
function refreshWindowList() {
    var ul = $("#windowMenuList").empty();
    var separate = false;
    function addWindowItem(id, name, createfn) {
        if (separate) {
            ul.append(document.createElement("hr"));
            separate = false;
        }
        let { li, a } = newDropdownListItem(id, name);
        ul.append(li);
        if (createfn) {
            var onopen = (id, wnd) => {
                ul.find('a').removeClass("dropdown-item-checked");
                $(a).addClass("dropdown-item-checked");
            };
            exports.projectWindows.setCreateFunc(id, createfn);
            exports.projectWindows.setShowFunc(id, onopen);
            $(a).click((e) => {
                exports.projectWindows.createOrShow(id);
                lastViewClicked = id;
            });
        }
    }
    function loadEditor(path) {
        var tool = exports.platform.getToolForFilename(path);
        // hack because .h files can be DASM or CC65
        if (tool == 'dasm' && path.endsWith(".h") && getCurrentMainFilename().endsWith(".c")) {
            tool = 'cc65';
        }
        var mode = tool && TOOL_TO_SOURCE_STYLE[tool];
        return new editors_1.SourceEditor(path, mode);
    }
    function addEditorItem(id) {
        addWindowItem(id, (0, util_1.getFilenameForPath)(id), () => {
            var data = exports.current_project.getFile(id);
            if (typeof data === 'string')
                return loadEditor(id);
            else if (data instanceof Uint8Array)
                return new debugviews_1.BinaryFileView(id, data);
        });
    }
    // add main file editor
    addEditorItem(exports.current_project.mainPath);
    // add other source files
    exports.current_project.iterateFiles((id, text) => {
        if (text && id != exports.current_project.mainPath) {
            addEditorItem(id);
        }
    });
    // add listings
    separate = true;
    var listings = exports.current_project.getListings();
    if (listings) {
        for (var lstfn in listings) {
            var lst = listings[lstfn];
            // add listing if source/assembly file exists and has text
            if ((lst.assemblyfile && lst.assemblyfile.text) || (lst.sourcefile && lst.sourcefile.text) || lst.text) {
                addWindowItem(lstfn, (0, util_1.getFilenameForPath)(lstfn), (path) => {
                    return new editors_1.ListingView(path);
                });
            }
        }
    }
    // add other tools
    separate = true;
    if (exports.platform.disassemble && exports.platform.saveState) {
        addWindowItem("#disasm", "Disassembly", () => {
            return new editors_1.DisassemblerView();
        });
    }
    if (exports.platform.readAddress) {
        addWindowItem("#memory", "Memory Browser", () => {
            return new debugviews_1.MemoryView();
        });
    }
    if (exports.current_project.segments && exports.current_project.segments.length) {
        addWindowItem("#memmap", "Memory Map", () => {
            return new debugviews_1.MemoryMapView();
        });
    }
    if (exports.platform.readVRAMAddress) {
        addWindowItem("#memvram", "VRAM Browser", () => {
            return new debugviews_1.VRAMMemoryView();
        });
    }
    if (exports.platform.startProbing) {
        addWindowItem("#memheatmap", "Memory Probe", () => {
            return new debugviews_1.AddressHeatMapView();
        });
        // TODO: only if raster
        addWindowItem("#crtheatmap", "CRT Probe", () => {
            //return new RasterPCHeatMapView();
            return new debugviews_1.RasterStackMapView();
        });
        addWindowItem("#probelog", "Probe Log", () => {
            return new debugviews_1.ProbeLogView();
        });
        addWindowItem("#scanlineio", "Scanline I/O", () => {
            return new debugviews_1.ScanlineIOView();
        });
        addWindowItem("#symbolprobe", "Symbol Profiler", () => {
            return new debugviews_1.ProbeSymbolView();
        });
        addWindowItem("#callstack", "Call Stack", () => {
            return new treeviews_1.CallStackView();
        });
        /*
        addWindowItem("#framecalls", "Frame Profiler", () => {
          return new FrameCallsView();
        });
        */
    }
    if (exports.platform.getDebugTree) {
        addWindowItem("#debugview", "Debug Tree", () => {
            return new treeviews_1.DebugBrowserView();
        });
    }
    addWindowItem('#asseteditor', 'Asset Editor', () => {
        return new asseteditor_1.AssetEditorView();
    });
}
function highlightLines(path, hispec) {
    if (hispec) {
        var toks = exports.qs.highlight.split(',');
        var start = parseInt(toks[0]) - 1;
        var end = parseInt(toks[1]) - 1;
        var editor = exports.projectWindows.createOrShow(path);
        editor.highlightLines(start, end);
    }
}
function loadMainWindow(preset_id) {
    // we need this to build create functions for the editor
    refreshWindowList();
    // show main file
    exports.projectWindows.createOrShow(preset_id);
    // build project
    exports.current_project.setMainFile(preset_id);
    // highlighting?
    highlightLines(preset_id, exports.qs.highlight);
}
async function loadProject(preset_id) {
    // set current file ID
    // TODO: this is done twice (mainPath and mainpath!)
    exports.current_project.mainPath = preset_id;
    userPrefs.setLastPreset(preset_id);
    // load files from storage or web URLs
    var result = await exports.current_project.loadFiles([preset_id]);
    if (result && result.length) {
        // file found; continue
        loadMainWindow(preset_id);
    }
    else {
        var skel = await getSkeletonFile(preset_id);
        exports.current_project.filedata[preset_id] = skel || "\n";
        loadMainWindow(preset_id);
        // don't alert if we selected "new file"
        if (!exports.qs.newfile) {
            (0, dialogs_1.alertInfo)("Could not find file \"" + preset_id + "\". Loading default file.");
        }
        else {
            requestPersistPermission(true, true);
        }
        delete exports.qs.newfile;
        replaceURLState();
    }
}
function reloadProject(id) {
    // leave repository == '/'
    if (id == '/') {
        exports.qs = { repo: '/' };
    }
    else if (id.indexOf('://') >= 0) {
        var urlparse = (0, services_1.parseGithubURL)(id);
        if (urlparse) {
            exports.qs = { repo: urlparse.repopath };
        }
    }
    else {
        exports.qs.platform = exports.platform_id;
        exports.qs.file = id;
    }
    gotoNewLocation();
}
async function getSkeletonFile(fileid) {
    var ext = exports.platform.getToolForFilename(fileid);
    try {
        return await $.get("presets/" + (0, util_1.getBasePlatform)(exports.platform_id) + "/skeleton." + ext, 'text');
    }
    catch (e) {
        (0, dialogs_1.alertError)("Could not load skeleton for " + exports.platform_id + "/" + ext + "; using blank file");
    }
}
function checkEnteredFilename(fn) {
    if (fn.indexOf(" ") >= 0) {
        (0, dialogs_1.alertError)("No spaces in filenames, please.");
        return false;
    }
    return true;
}
function _createNewFile(e) {
    // TODO: support spaces
    bootbox.prompt({
        title: "Enter the name of your new main source file.",
        placeholder: "newfile" + exports.platform.getDefaultExtension(),
        callback: (filename) => {
            if (filename && filename.trim().length > 0) {
                if (!checkEnteredFilename(filename))
                    return;
                if (filename.indexOf(".") < 0) {
                    filename += exports.platform.getDefaultExtension();
                }
                var path = filename;
                (0, analytics_1.gaEvent)('workspace', 'file', 'new');
                exports.qs.newfile = '1';
                reloadProject(path);
            }
        }
    });
    return true;
}
function _uploadNewFile(e) {
    const uploadFileElem = $(`<input type="file" multiple accept="*" style="display:none">`);
    const file = uploadFileElem[0];
    uploadFileElem.change((e) => { handleFileUpload(file.files); });
    uploadFileElem.click();
}
// called from index.html
function handleFileUpload(files) {
    console.log(files);
    var index = 0;
    function uploadNextFile() {
        var f = files[index++];
        if (!f) {
            console.log("Done uploading", index);
            if (index > 2) {
                (0, dialogs_1.alertInfo)("Files uploaded.");
                setTimeout(updateSelector, 1000); // TODO: wait for files to upload
            }
            else {
                exports.qs.file = files[0].name;
                bootbox.confirm({
                    message: "Open '" + DOMPurify.sanitize(exports.qs.file) + "' as main project file?",
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
            (0, analytics_1.gaEvent)('workspace', 'file', 'upload');
        }
        else {
            var path = f.name;
            var reader = new FileReader();
            reader.onload = function (e) {
                var arrbuf = e.target.result;
                var data = new Uint8Array(arrbuf);
                // convert to UTF8, unless it's a binary file
                if ((0, util_1.isProbablyBinary)(path, data)) {
                    //gotoMainFile = false;
                }
                else {
                    data = (0, util_1.byteArrayToUTF8)(data).replace('\r\n', '\n'); // convert CRLF to LF
                }
                // store in local forage
                exports.projectWindows.updateFile(path, data);
                console.log("Uploaded " + path + " " + data.length + " bytes");
                uploadNextFile();
            };
            reader.readAsArrayBuffer(f); // read as binary
        }
    }
    if (files)
        uploadNextFile();
}
async function _openLocalDirectory(e) {
    var pickerfn = window['showDirectoryPicker'];
    if (!pickerfn) {
        (0, dialogs_1.alertError)(`This browser can't open local files on your computer, yet. Try Chrome.`);
    }
    var dirHandle = await pickerfn();
    var repoid = dirHandle.name;
    var storekey = '__localfs__' + repoid;
    var fsdata = {
        handle: dirHandle,
    };
    var lstore = localforage.createInstance({
        name: storekey,
        version: 2.0
    });
    await lstore.setItem(storekey, fsdata);
    exports.qs = { localfs: repoid };
    gotoNewLocation(true);
}
async function promptUser(message) {
    return new Promise((resolve, reject) => {
        bootbox.prompt(DOMPurify.sanitize(message), (result) => {
            resolve(result);
        });
    });
}
async function getLocalFilesystem(repoid) {
    const options = { mode: 'readwrite' };
    var storekey = '__localfs__' + repoid;
    var lstore = localforage.createInstance({
        name: storekey,
        version: 2.0
    });
    var fsdata = await lstore.getItem(storekey);
    var dirHandle = fsdata.handle;
    console.log(fsdata, dirHandle);
    var granted = await dirHandle.queryPermission(options);
    console.log(granted);
    if (granted !== 'granted') {
        await promptUser(`Request permissions to access filesystem?`);
        granted = await dirHandle.requestPermission(options);
    }
    if (granted !== 'granted') {
        (0, dialogs_1.alertError)(`Could not get permission to access filesystem.`);
        return;
    }
    return {
        getFileData: async (path) => {
            console.log('getFileData', path);
            let fileHandle = await dirHandle.getFileHandle(path, { create: false });
            console.log('getFileData', fileHandle);
            let file = await fileHandle.getFile();
            console.log('getFileData', file);
            let contents = await ((0, util_1.isProbablyBinary)(path) ? file.binary() : file.text());
            console.log(fileHandle, file, contents);
            return contents;
        },
        setFileData: async (path, data) => {
            //let vh = await dirHandle.getFileHandle(path, { create: true });
        }
    };
}
function getCurrentMainFilename() {
    return (0, util_1.getFilenameForPath)(exports.current_project.mainPath);
}
function getCurrentEditorFilename() {
    return (0, util_1.getFilenameForPath)(exports.projectWindows.getActiveID());
}
function _revertFile(e) {
    var wnd = exports.projectWindows.getActive();
    if (wnd && wnd.setText) {
        var fn = exports.projectWindows.getActiveID();
        $.get("presets/" + (0, util_1.getBasePlatform)(exports.platform_id) + "/" + fn, (text) => {
            bootbox.confirm("Reset '" + DOMPurify.sanitize(fn) + "' to default?", (ok) => {
                if (ok) {
                    wnd.setText(text);
                }
            });
        }, 'text')
            .fail(() => {
            if (exports.repo_id)
                (0, dialogs_1.alertError)("Can only revert built-in examples. If you want to revert all files, You can pull from the repository.");
            else
                (0, dialogs_1.alertError)("Can only revert built-in examples.");
        });
    }
    else {
        (0, dialogs_1.alertError)("Cannot revert the active window. Please choose a text file.");
    }
}
function _deleteFile(e) {
    var wnd = exports.projectWindows.getActive();
    if (wnd && wnd.getPath) {
        var fn = exports.projectWindows.getActiveID();
        bootbox.confirm("Delete '" + DOMPurify.sanitize(fn) + "'?", (ok) => {
            if (ok) {
                store.removeItem(fn).then(() => {
                    // if we delete what is selected
                    if (exports.qs.file == fn) {
                        userPrefs.unsetLastPreset();
                        gotoNewLocation();
                    }
                    else {
                        updateSelector();
                        (0, dialogs_1.alertInfo)("Deleted " + fn);
                    }
                });
            }
        });
    }
    else {
        (0, dialogs_1.alertError)("Cannot delete the active window.");
    }
}
function _renameFile(e) {
    var wnd = exports.projectWindows.getActive();
    if (wnd && wnd.getPath && exports.current_project.getFile(wnd.getPath())) {
        var fn = exports.projectWindows.getActiveID();
        bootbox.prompt({
            title: "Rename '" + DOMPurify.sanitize(fn) + "' to?",
            value: fn,
            callback: (newfn) => {
                var data = exports.current_project.getFile(wnd.getPath());
                if (newfn && newfn != fn && data) {
                    if (!checkEnteredFilename(newfn))
                        return;
                    store.removeItem(fn).then(() => {
                        return store.setItem(newfn, data);
                    }).then(() => {
                        updateSelector();
                        alert("Renamed " + fn + " to " + newfn); // need alert() so it pauses
                        if (fn == exports.current_project.mainPath) {
                            reloadProject(newfn);
                        }
                    });
                }
            }
        });
    }
    else {
        (0, dialogs_1.alertError)("Cannot rename the active window.");
    }
}
function populateExamples(sel) {
    let files = {};
    let optgroup;
    const PRESETS = exports.platform.getPresets ? exports.platform.getPresets() : [];
    for (var i = 0; i < PRESETS.length; i++) {
        var preset = PRESETS[i];
        var name = preset.chapter ? (preset.chapter + ". " + preset.name) : preset.name;
        var isCurrentPreset = preset.id == exports.current_project.mainPath;
        if (preset.category) {
            optgroup = $("<optgroup />").attr('label', 'Examples: ' + preset.category).appendTo(sel);
        }
        else if (!optgroup) {
            optgroup = $("<optgroup />").attr('label', 'Examples').appendTo(sel);
        }
        optgroup.append($("<option />").val(preset.id).text(name).attr('selected', isCurrentPreset ? 'selected' : null));
        if (isCurrentPreset)
            current_preset = preset;
        files[preset.id] = name;
    }
    return files;
}
function populateRepos(sel) {
    if (hasLocalStorage && !isElectron) {
        var n = 0;
        var repos = (0, services_1.getRepos)();
        if (repos) {
            let optgroup = $("<optgroup />").attr('label', 'Repositories').appendTo(sel);
            for (let repopath in repos) {
                var repo = repos[repopath];
                if (repo.platform_id && (0, util_1.getBasePlatform)(repo.platform_id) == (0, util_1.getBasePlatform)(exports.platform_id)) {
                    optgroup.append($("<option />").val(repo.url).text(repo.url.substring(repo.url.indexOf('/'))));
                }
            }
        }
    }
}
async function populateFiles(sel, category, prefix, foundFiles) {
    let keys = await store.keys();
    if (!keys)
        keys = [];
    let optgroup;
    for (var i = 0; i < keys.length; i++) {
        let key = keys[i];
        if (key.startsWith(prefix) && !foundFiles[key]) {
            if (!optgroup)
                optgroup = $("<optgroup />").attr('label', category).appendTo(sel);
            let name = key.substring(prefix.length);
            optgroup.append($("<option />").val(key).text(name).attr('selected', (key == exports.current_project.mainPath) ? 'selected' : null));
        }
    }
}
function finishSelector(sel) {
    sel.css('visibility', 'visible');
    // create option if not selected
    var main = exports.current_project.mainPath;
    if (sel.val() != main) {
        sel.append($("<option />").val(main).text(main).attr('selected', 'selected'));
    }
}
async function updateSelector() {
    var sel = $("#preset_select").empty();
    if (!exports.repo_id) {
        // normal: populate repos, examples, and local files
        populateRepos(sel);
        var foundFiles = populateExamples(sel);
        await populateFiles(sel, "Local Files", "", foundFiles);
        finishSelector(sel);
    }
    else {
        sel.append($("<option />").val('/').text('Leave Repository'));
        $("#repo_name").text((0, util_1.getFilenameForPath)(exports.repo_id) + '/').show();
        // repo: populate all files
        await populateFiles(sel, exports.repo_id, "", {});
        finishSelector(sel);
    }
    // set click handlers
    sel.off('change').change(function (e) {
        reloadProject($(this).val().toString());
    });
}
function getErrorElement(err) {
    var span = $('<p/>');
    if (err.path != null) {
        var s = err.line ? err.label ? `(${err.path} @ ${err.label})` : `(${err.path}:${err.line})` : `(${err.path})`;
        var link = $('<a/>').text(s);
        var path = err.path;
        // TODO: hack because examples/foo.a only gets listed as foo.a
        if (path == getCurrentMainFilename())
            path = exports.current_project.mainPath;
        // click link to open file, if it's available...
        if (exports.projectWindows.isWindow(path)) {
            link.click((ev) => {
                var wnd = exports.projectWindows.createOrShow(path);
                if (wnd instanceof editors_1.SourceEditor) {
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
    errorWasRuntime = false;
}
function showErrorAlert(errors, runtime) {
    var div = $("#error_alert_msg").empty();
    for (var err of errors.slice(0, 10)) {
        div.append(getErrorElement(err));
    }
    $("#error_alert").show();
    errorWasRuntime = runtime;
}
function showExceptionAsError(err, msg) {
    if (msg != null) {
        var werr = { msg: msg, line: 0 };
        if (err instanceof emu_1.EmuHalt && err.$loc) {
            werr = Object.create(err.$loc);
            werr.msg = msg;
            console.log(werr);
        }
        showErrorAlert([werr], true);
    }
}
async function setCompileOutput(data) {
    // errors? mark them in editor
    if ('errors' in data && data.errors.length > 0) {
        toolbar.addClass("has-errors");
        exports.projectWindows.setErrors(data.errors);
        refreshWindowList(); // to make sure windows are created for showErrorAlert()
        showErrorAlert(data.errors, false);
    }
    else {
        toolbar.removeClass("has-errors"); // may be added in next callback
        exports.projectWindows.setErrors(null);
        hideErrorAlerts();
        // exit if compile output unchanged
        if (data == null || ('unchanged' in data && data.unchanged))
            return;
        // make sure it's a WorkerOutputResult
        if (!('output' in data))
            return;
        // process symbol map
        exports.platform.debugSymbols = new baseplatform_1.DebugSymbols(data.symbolmap, data.debuginfo);
        compparams = data.params;
        // load ROM
        var rom = data.output;
        if (rom != null) {
            try {
                clearBreakpoint(); // so we can replace memory (TODO: change toolbar btn)
                _resetRecording();
                await exports.platform.loadROM(getCurrentPresetTitle(), rom);
                current_output = rom;
                if (!userPaused)
                    _resume();
                writeOutputROMFile();
            }
            catch (e) {
                console.log(e);
                toolbar.addClass("has-errors");
                showExceptionAsError(e, e + "");
                current_output = null;
                refreshWindowList();
                return;
            }
        }
        // update all windows (listings)
        refreshWindowList();
        exports.projectWindows.refresh(false);
    }
}
async function loadBIOSFromProject() {
    if (exports.platform.loadBIOS) {
        var biospath = exports.platform_id + '.rom';
        var biosdata = await store.getItem(biospath);
        if (biosdata instanceof Uint8Array) {
            console.log('loading BIOS', biospath, biosdata.length + " bytes");
            exports.platform.loadBIOS(biospath, biosdata);
        }
        else {
            console.log('BIOS file must be binary');
        }
    }
}
function hideDebugInfo() {
    var meminfo = $("#mem_info");
    meminfo.hide();
    lastDebugInfo = null;
}
function showDebugInfo(state) {
    if (!(0, baseplatform_1.isDebuggable)(exports.platform))
        return;
    var meminfo = $("#mem_info");
    var meminfomsg = $("#mem_info_msg");
    var allcats = exports.platform.getDebugCategories();
    if (allcats && !debugCategory)
        debugCategory = allcats[0];
    var s = state && exports.platform.getDebugInfo(debugCategory, state);
    if (typeof s === 'string') {
        var hs = lastDebugInfo ? (0, util_1.highlightDifferences)(lastDebugInfo, s) : s;
        meminfo.show();
        meminfomsg.html(hs);
        var catspan = $('<div class="mem_info_links">');
        var addCategoryLink = (cat) => {
            var catlink = $('<a>' + cat + '</a>');
            if (cat == debugCategory)
                catlink.addClass('selected');
            catlink.click((e) => {
                debugCategory = cat;
                lastDebugInfo = null;
                showDebugInfo(exports.lastDebugState);
            });
            catspan.append(catlink);
            catspan.append('<span> </span>');
        };
        for (var cat of allcats) {
            addCategoryLink(cat);
        }
        meminfomsg.append('<br>');
        meminfomsg.append(catspan);
        lastDebugInfo = s;
    }
    else {
        hideDebugInfo();
    }
}
function setDebugButtonState(btnid, btnstate) {
    $("#debug_bar, #run_bar").find("button").removeClass("btn_active").removeClass("btn_stopped");
    $("#dbg_" + btnid).addClass("btn_" + btnstate);
}
function isPlatformReady() {
    return exports.platform && current_output != null;
}
function checkRunReady() {
    if (!isPlatformReady()) {
        (0, dialogs_1.alertError)("Can't do this until build successfully completes.");
        return false;
    }
    else
        return true;
}
function openRelevantListing(state) {
    // if we clicked on a specific tool, don't switch windows
    if (lastViewClicked && lastViewClicked.startsWith('#'))
        return;
    // don't switch windows for specific debug commands
    if (['toline', 'restart', 'tovsync', 'stepover'].includes(lastDebugCommand))
        return;
    // has to support disassembly, at least
    if (!exports.platform.disassemble)
        return;
    // search through listings
    let listings = exports.current_project.getListings();
    let bestid = "#disasm";
    let bestscore = 256;
    if (listings) {
        let pc = state.c ? (state.c.EPC || state.c.PC) : 0;
        for (let lstfn in listings) {
            let lst = listings[lstfn];
            let file = lst.assemblyfile || lst.sourcefile;
            // pick either listing or source file
            let wndid = exports.current_project.filename2path[lstfn] || lstfn;
            if (file == lst.sourcefile)
                wndid = exports.projectWindows.findWindowWithFilePrefix(lstfn);
            // does this window exist?
            if (exports.projectWindows.isWindow(wndid)) {
                // find the source line at the PC or closely before it
                let srcline1 = file && file.findLineForOffset(pc, editors_1.PC_LINE_LOOKAHEAD);
                if (srcline1) {
                    // try to find the next line and bound the PC
                    let srcline2 = file.lines[srcline1.line + 1];
                    if (!srcline2 || pc < srcline2.offset) {
                        let score = pc - srcline1.offset;
                        if (score < bestscore) {
                            bestid = wndid;
                            bestscore = score;
                        }
                    }
                    //console.log(hex(pc,4), srcline1, srcline2, wndid, lstfn, bestid, bestscore);
                }
            }
        }
    }
    // if no appropriate listing found, use disassembly view
    exports.projectWindows.createOrShow(bestid, true);
}
function uiDebugCallback(state) {
    exports.lastDebugState = state;
    showDebugInfo(state);
    openRelevantListing(state);
    exports.projectWindows.refresh(true); // move cursor
    debugTickPaused = true;
}
function setupDebugCallback(btnid) {
    if (exports.platform.setupDebug) {
        exports.platform.setupDebug((state, msg) => {
            uiDebugCallback(state);
            setDebugButtonState(btnid || "pause", "stopped");
            msg && showErrorAlert([{ msg: "STOPPED: " + msg, line: 0 }], true);
        });
        lastDebugCommand = btnid;
    }
}
function setupBreakpoint(btnid) {
    if (!checkRunReady())
        return;
    _disableRecording();
    setupDebugCallback(btnid);
    if (btnid)
        setDebugButtonState(btnid, "active");
}
function _pause() {
    if (exports.platform && exports.platform.isRunning()) {
        exports.platform.pause();
        console.log("Paused");
    }
    setDebugButtonState("pause", "stopped");
}
function pause() {
    if (!checkRunReady())
        return;
    clearBreakpoint();
    _pause();
    userPaused = true;
}
function _resume() {
    if (!exports.platform.isRunning()) {
        exports.platform.resume();
        console.log("Resumed");
    }
    setDebugButtonState("go", "active");
    if (errorWasRuntime) {
        hideErrorAlerts();
    }
}
function resume() {
    if (!checkRunReady())
        return;
    clearBreakpoint();
    if (!exports.platform.isRunning()) {
        exports.projectWindows.refresh(false);
    }
    _resume();
    userPaused = false;
    lastViewClicked = null;
}
function singleStep() {
    if (!checkRunReady())
        return;
    setupBreakpoint("step");
    exports.platform.step();
}
function stepOver() {
    if (!checkRunReady())
        return;
    setupBreakpoint("stepover");
    exports.platform.stepOver();
}
function singleFrameStep() {
    if (!checkRunReady())
        return;
    setupBreakpoint("tovsync");
    exports.platform.runToVsync();
}
function getEditorPC() {
    var wnd = exports.projectWindows.getActive();
    return wnd && wnd.getCursorPC && wnd.getCursorPC();
}
function runToPC(pc) {
    if (!checkRunReady() || !(pc >= 0))
        return;
    setupBreakpoint("toline");
    console.log("Run to", pc.toString(16));
    if (exports.platform.runToPC) {
        exports.platform.runToPC(pc);
    }
    else {
        exports.platform.runEval((c) => {
            return c.PC == pc;
        });
    }
}
function restartAtCursor() {
    if (exports.platform.restartAtPC(getEditorPC())) {
        resume();
    }
    else
        (0, dialogs_1.alertError)(`Could not restart program at selected line.`);
}
function runToCursor() {
    runToPC(getEditorPC());
}
function runUntilReturn() {
    if (!checkRunReady())
        return;
    setupBreakpoint("stepout");
    exports.platform.runUntilReturn();
}
function runStepBackwards() {
    if (!checkRunReady())
        return;
    setupBreakpoint("stepback");
    exports.platform.stepBack();
}
function clearBreakpoint() {
    exports.lastDebugState = null;
    if (exports.platform.clearDebug)
        exports.platform.clearDebug();
    setupDebugCallback(); // in case of BRK/trap
    showDebugInfo();
}
function resetPlatform() {
    exports.platform.reset();
    _resetRecording();
}
function resetAndRun() {
    if (!checkRunReady())
        return;
    clearBreakpoint();
    resetPlatform();
    _resume();
}
function resetAndDebug() {
    if (!checkRunReady())
        return;
    var wasRecording = recorderActive;
    _disableRecording();
    if (exports.platform.setupDebug && exports.platform.runEval) { // TODO??
        clearBreakpoint();
        _resume();
        resetPlatform();
        setupBreakpoint("restart");
        exports.platform.runEval((c) => { return true; }); // break immediately
    }
    else {
        resetPlatform();
        _resume();
    }
    if (wasRecording)
        _enableRecording();
}
function _breakExpression() {
    var modal = $("#debugExprModal");
    var btn = $("#debugExprSubmit");
    $("#debugExprInput").val(lastBreakExpr);
    $("#debugExprExamples").text(getDebugExprExamples());
    modal.modal('show');
    btn.off('click').on('click', () => {
        var exprs = $("#debugExprInput").val() + "";
        modal.modal('hide');
        breakExpression(exprs);
    });
}
function getDebugExprExamples() {
    var state = exports.platform.saveState && exports.platform.saveState();
    var cpu = state.c;
    console.log(cpu, state);
    var s = '';
    if (cpu.PC)
        s += "c.PC == 0x" + (0, util_1.hex)(cpu.PC) + "\n";
    if (cpu.SP)
        s += "c.SP < 0x" + (0, util_1.hex)(cpu.SP) + "\n";
    if (cpu['HL'])
        s += "c.HL == 0x4000\n";
    if (exports.platform.readAddress)
        s += "this.readAddress(0x1234) == 0x0\n";
    if (exports.platform.readVRAMAddress)
        s += "this.readVRAMAddress(0x1234) != 0x80\n";
    if (exports.platform['getRasterScanline'])
        s += "this.getRasterScanline() > 222\n";
    return s;
}
function breakExpression(exprs) {
    var fn = new Function('c', 'return (' + exprs + ');').bind(exports.platform);
    setupBreakpoint();
    exports.platform.runEval(fn);
    lastBreakExpr = exprs;
}
function updateDebugWindows() {
    if (exports.platform.isRunning()) {
        exports.projectWindows.tick();
        debugTickPaused = false;
    }
    else if (!debugTickPaused) { // final tick after pausing
        exports.projectWindows.tick();
        debugTickPaused = true;
    }
    setTimeout(updateDebugWindows, 100);
}
function setFrameRateUI(fps) {
    exports.platform.setFrameRate(fps);
    if (fps > 0.01)
        $("#fps_label").text(fps.toFixed(2));
    else
        $("#fps_label").text("1/" + Math.round(1 / fps));
}
function _slowerFrameRate() {
    var fps = exports.platform.getFrameRate();
    fps = fps / 2;
    if (fps > 0.00001)
        setFrameRateUI(fps);
}
function _fasterFrameRate() {
    var fps = exports.platform.getFrameRate();
    fps = Math.min(60, fps * 2);
    setFrameRateUI(fps);
}
function _slowestFrameRate() {
    setFrameRateUI(60 / 65536);
}
function _fastestFrameRate() {
    _resume();
    setFrameRateUI(60);
}
function traceTiming() {
    exports.projectWindows.refresh(false);
    var wnd = exports.projectWindows.getActive();
    if (wnd.getSourceFile && wnd.setTimingResult) { // is editor active?
        var analyzer = exports.platform.newCodeAnalyzer();
        analyzer.showLoopTimingForPC(0);
        wnd.setTimingResult(analyzer);
    }
}
function _disableRecording() {
    if (recorderActive) {
        exports.platform.setRecorder(null);
        $("#dbg_record").removeClass("btn_recording");
        $("#replaydiv").hide();
        hideDebugInfo();
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
    exports.platform.setRecorder(stateRecorder);
    $("#dbg_record").addClass("btn_recording");
    $("#replaydiv").show();
    recorderActive = true;
}
function _toggleRecording() {
    if (recorderActive) {
        _disableRecording();
    }
    else {
        _enableRecording();
    }
}
function addFileToProject(type, ext, linefn) {
    var wnd = exports.projectWindows.getActive();
    if (wnd && wnd.insertText) {
        bootbox.prompt({
            title: "Add " + DOMPurify.sanitize(type) + " File to Project",
            value: "filename" + DOMPurify.sanitize(ext),
            callback: (filename) => {
                if (filename && filename.trim().length > 0) {
                    if (!checkEnteredFilename(filename))
                        return;
                    var path = filename;
                    var newline = "\n" + linefn(filename) + "\n";
                    exports.current_project.loadFiles([path]).then((result) => {
                        if (result && result.length) {
                            (0, dialogs_1.alertError)(filename + " already exists; including anyway");
                        }
                        else {
                            exports.current_project.updateFile(path, "\n");
                        }
                        wnd.insertText(newline);
                        refreshWindowList();
                    });
                }
            }
        });
    }
    else {
        (0, dialogs_1.alertError)("Can't insert text in this window -- switch back to main file");
    }
}
// TODO: lwtools and smaller c
function _addIncludeFile() {
    var fn = getCurrentMainFilename();
    var tool = exports.platform.getToolForFilename(fn);
    // TODO: more tools? make this a function of the platform / tool provider
    if (fn.endsWith(".c") || tool == 'sdcc' || tool == 'cc65' || tool == 'cmoc' || tool == 'smlrc')
        addFileToProject("Header", ".h", (s) => { return '#include "' + s + '"'; });
    else if (tool == 'dasm' || tool == 'zmac')
        addFileToProject("Include", ".inc", (s) => { return '\tinclude "' + s + '"'; });
    else if (tool == 'ca65' || tool == 'sdasz80' || tool == 'vasm' || tool == 'armips')
        addFileToProject("Include", ".inc", (s) => { return '\t.include "' + s + '"'; });
    else if (tool == 'verilator')
        addFileToProject("Verilog", ".v", (s) => { return '`include "' + s + '"'; });
    else if (tool == 'wiz')
        addFileToProject("Include", ".wiz", (s) => { return 'import "' + s + '";'; });
    else if (tool == 'ecs')
        addFileToProject("Include", ".ecs", (s) => { return 'import "' + s + '"'; });
    else if (tool == 'acme')
        addFileToProject("Include", ".acme", (s) => { return '!src "' + s + '"'; });
    else
        (0, dialogs_1.alertError)("Can't add include file to this project type (" + tool + ")");
}
function _addLinkFile() {
    var fn = getCurrentMainFilename();
    var tool = exports.platform.getToolForFilename(fn);
    if (fn.endsWith(".c") || tool == 'sdcc' || tool == 'cc65' || tool == 'cmoc' || tool == 'smlrc')
        addFileToProject("Linked C (or .s)", ".c", (s) => { return '//#link "' + s + '"'; });
    else if (fn.endsWith("asm") || fn.endsWith(".s") || tool == 'ca65' || tool == 'lwasm')
        addFileToProject("Linked ASM", ".inc", (s) => { return ';#link "' + s + '"'; });
    else
        (0, dialogs_1.alertError)("Can't add linked file to this project type (" + tool + ")");
}
function setupDebugControls() {
    // create toolbar buttons
    uitoolbar = new toolbar_1.Toolbar($("#toolbar")[0], null);
    uitoolbar.grp.prop('id', 'run_bar');
    uitoolbar.add('ctrl+alt+r', 'Reset', 'glyphicon-refresh', resetAndRun).prop('id', 'dbg_reset');
    uitoolbar.add('ctrl+alt+,', 'Pause', 'glyphicon-pause', pause).prop('id', 'dbg_pause');
    uitoolbar.add('ctrl+alt+.', 'Resume', 'glyphicon-play', resume).prop('id', 'dbg_go');
    if (exports.platform.restartAtPC) {
        uitoolbar.add('ctrl+alt+/', 'Restart at Cursor', 'glyphicon-play-circle', restartAtCursor).prop('id', 'dbg_restartatline');
    }
    uitoolbar.newGroup();
    uitoolbar.grp.prop('id', 'debug_bar');
    if (exports.platform.runEval) {
        uitoolbar.add('ctrl+alt+e', 'Reset and Debug', 'glyphicon-fast-backward', resetAndDebug).prop('id', 'dbg_restart');
    }
    if (exports.platform.stepBack) {
        uitoolbar.add('ctrl+alt+b', 'Step Backwards', 'glyphicon-step-backward', runStepBackwards).prop('id', 'dbg_stepback');
    }
    if (exports.platform.step) {
        uitoolbar.add('ctrl+alt+s', 'Single Step', 'glyphicon-step-forward', singleStep).prop('id', 'dbg_step');
    }
    if (exports.platform.stepOver) {
        uitoolbar.add('ctrl+alt+t', 'Step Over', 'glyphicon-hand-right', stepOver).prop('id', 'dbg_stepover');
    }
    if (exports.platform.runUntilReturn) {
        uitoolbar.add('ctrl+alt+o', 'Step Out of Subroutine', 'glyphicon-hand-up', runUntilReturn).prop('id', 'dbg_stepout');
    }
    if (exports.platform.runToVsync) {
        uitoolbar.add('ctrl+alt+n', 'Next Frame/Interrupt', 'glyphicon-forward', singleFrameStep).prop('id', 'dbg_tovsync');
    }
    if ((exports.platform.runEval || exports.platform.runToPC) && !exports.platform_id.startsWith('verilog')) {
        uitoolbar.add('ctrl+alt+l', 'Run To Line', 'glyphicon-save', runToCursor).prop('id', 'dbg_toline');
    }
    uitoolbar.newGroup();
    uitoolbar.grp.prop('id', 'xtra_bar');
    // add menu clicks
    $(".dropdown-menu").collapse({ toggle: false });
    $("#item_new_file").click(_createNewFile);
    $("#item_upload_file").click(_uploadNewFile);
    $("#item_open_directory").click(_openLocalDirectory);
    $("#item_github_login").click(sync_1._loginToGithub);
    $("#item_github_logout").click(sync_1._logoutOfGithub);
    $("#item_github_import").click(sync_1._importProjectFromGithub);
    $("#item_github_publish").click(sync_1._publishProjectToGithub);
    $("#item_github_push").click(sync_1._pushProjectToGithub);
    $("#item_github_pull").click(sync_1._pullProjectFromGithub);
    $("#item_repo_delete").click(sync_1._removeRepository);
    $("#item_share_file").click(shareexport_1._shareEmbedLink);
    $("#item_reset_file").click(_revertFile);
    $("#item_rename_file").click(_renameFile);
    $("#item_delete_file").click(_deleteFile);
    if (exports.platform.runEval)
        $("#item_debug_expr").click(_breakExpression).show();
    else
        $("#item_debug_expr").hide();
    $("#item_download_rom").click(shareexport_1._downloadROMImage);
    $("#item_download_file").click(shareexport_1._downloadSourceFile);
    $("#item_download_zip").click(shareexport_1._downloadProjectZipFile);
    if (exports.platform.getDebugSymbolFile) {
        $("#item_download_sym").click(shareexport_1._downloadSymFile);
    }
    else {
        $("#item_download_sym").hide();
    }
    $("#item_download_allzip").click(shareexport_1._downloadAllFilesZipFile);
    $("#item_record_video").click(shareexport_1._recordVideo);
    if ((0, shareexport_1._getCassetteFunction)())
        $("#item_export_cassette").click(shareexport_1._downloadCassetteFile);
    else
        $("#item_export_cassette").hide();
    if (exports.platform.setFrameRate && exports.platform.getFrameRate) {
        $("#dbg_slower").click(_slowerFrameRate);
        $("#dbg_faster").click(_fasterFrameRate);
        $("#dbg_slowest").click(_slowestFrameRate);
        $("#dbg_fastest").click(_fastestFrameRate);
    }
    $("#item_addfile_include").click(_addIncludeFile);
    $("#item_addfile_link").click(_addLinkFile);
    $("#item_request_persist").click(() => requestPersistPermission(true, false));
    updateDebugWindows();
    // code analyzer?
    if (exports.platform.newCodeAnalyzer) {
        uitoolbar.add(null, 'Analyze CPU Timing', 'glyphicon-time', traceTiming);
    }
    // setup replay slider
    if (exports.platform.setRecorder && exports.platform.advance) {
        setupReplaySlider();
    }
    // help menu items
    if (exports.platform.showHelp) {
        let { li, a } = newDropdownListItem('help__' + exports.platform_id, platform_name + ' Help');
        $("#help_menu").append(li);
        $(a).click(() => window.open(exports.platform.showHelp(), '_8bws_help'));
    }
    // tool help
    let tool = exports.platform.getToolForFilename(getCurrentMainFilename());
    let toolhelpurl = TOOL_TO_HELPURL[tool];
    if (toolhelpurl) {
        let { li, a } = newDropdownListItem('help__' + tool, tool + ' Help');
        $("#help_menu").append(li);
        $(a).click(() => window.open(toolhelpurl, '_8bws_help'));
    }
}
function setupReplaySlider() {
    var replayslider = $("#replayslider");
    var clockslider = $("#clockslider");
    var replayframeno = $("#replay_frame");
    var clockno = $("#replay_clock");
    if (!exports.platform.advanceFrameClock)
        $("#clockdiv").hide(); // TODO: put this test in recorder?
    var updateFrameNo = () => {
        replayframeno.text(stateRecorder.lastSeekFrame + "");
        clockno.text(stateRecorder.lastSeekStep + "");
    };
    var sliderChanged = (e) => {
        _pause();
        var frame = parseInt(replayslider.val().toString());
        var step = parseInt(clockslider.val().toString());
        if (stateRecorder.loadFrame(frame, step) >= 0) {
            clockslider.attr('min', 0);
            clockslider.attr('max', stateRecorder.lastStepCount);
            updateFrameNo();
            uiDebugCallback(exports.platform.saveState());
        }
    };
    var setFrameTo = (frame) => {
        _pause();
        if (stateRecorder.loadFrame(frame) >= 0) {
            replayslider.val(frame);
            updateFrameNo();
            uiDebugCallback(exports.platform.saveState());
        }
    };
    var setClockTo = (clock) => {
        _pause();
        var frame = parseInt(replayslider.val().toString());
        if (stateRecorder.loadFrame(frame, clock) >= 0) {
            clockslider.val(clock);
            updateFrameNo();
            uiDebugCallback(exports.platform.saveState());
        }
    };
    stateRecorder.callbackStateChanged = () => {
        replayslider.attr('min', 0);
        replayslider.attr('max', stateRecorder.numFrames());
        replayslider.val(stateRecorder.currentFrame());
        clockslider.val(stateRecorder.currentStep());
        updateFrameNo();
        showDebugInfo(exports.platform.saveState());
    };
    replayslider.on('input', sliderChanged);
    clockslider.on('input', sliderChanged);
    //replayslider.on('change', sliderChanged);
    $("#replay_min").click(() => { setFrameTo(1); });
    $("#replay_max").click(() => { setFrameTo(stateRecorder.numFrames()); });
    $("#replay_back").click(() => { setFrameTo(parseInt(replayslider.val().toString()) - 1); });
    $("#replay_fwd").click(() => { setFrameTo(parseInt(replayslider.val().toString()) + 1); });
    $("#clock_back").click(() => { setClockTo(parseInt(clockslider.val().toString()) - 1); });
    $("#clock_fwd").click(() => { setClockTo(parseInt(clockslider.val().toString()) + 1); });
    $("#replay_bar").show();
    uitoolbar.add('ctrl+alt+0', 'Start/Stop Replay Recording', 'glyphicon-record', _toggleRecording).prop('id', 'dbg_record');
}
function isLandscape() {
    try {
        var object = window.screen['orientation'] || window.screen['msOrientation'] || window.screen['mozOrientation'] || null;
        if (object) {
            if (object.type.indexOf('landscape') !== -1) {
                return true;
            }
            if (object.type.indexOf('portrait') !== -1) {
                return false;
            }
        }
        if ('orientation' in window) {
            var value = window.orientation;
            if (value === 0 || value === 180) {
                return false;
            }
            else if (value === 90 || value === 270) {
                return true;
            }
        }
    }
    catch (e) { }
    // fallback to comparing width to height
    return window.innerWidth > window.innerHeight;
}
async function showWelcomeMessage() {
    if (userPrefs.shouldCompleteTour()) {
        await (0, util_1.loadScript)('lib/bootstrap-tourist.js');
        var is_vcs = exports.platform_id.startsWith('vcs');
        var steps = [
            {
                element: "#platformsMenuButton",
                placement: 'right',
                title: "Platform Selector",
                content: "You're currently on the \"<b>" + exports.platform_id + "</b>\" platform. You can choose a different one from the menu."
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
        if (isElectron) {
            steps.unshift({
                element: "#dropdownMenuButton",
                placement: 'right',
                title: "Developer Analytics",
                content: 'BTW, we send stack traces to sentry.io when exceptions are thrown. Hope that\'s ok.'
            });
            steps.unshift({
                element: "#dropdownMenuButton",
                placement: 'right',
                title: "Welcome to 8bitworkshop Desktop!",
                content: 'The directory "~/8bitworkshop" contains all of your file edits and built ROM images. You can create new projects under the platform directories (e.g. "c64/myproject")'
            });
        }
        var tour = new Tour({
            autoscroll: false,
            //storage:false,
            steps: steps,
            onEnd: () => {
                userPrefs.completedTour();
                //requestPersistPermission(false, true);
            }
        });
        setTimeout(() => { tour.start(); }, 2500);
    }
}
///////////////////////////////////////////////////
function globalErrorHandler(msgevent) {
    var msg = (msgevent.message || msgevent.error || msgevent) + "";
    // storage quota full? (Chrome) try to expand it
    if (msg.indexOf("QuotaExceededError") >= 0) {
        requestPersistPermission(false, false);
    }
    else {
        var err = msgevent.error || msgevent.reason;
        if (err != null && err instanceof emu_1.EmuHalt) {
            haltEmulation(err);
        }
    }
}
function haltEmulation(err) {
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
function gotoNewLocation(replaceHistory, newQueryString) {
    if (newQueryString) {
        exports.qs = newQueryString;
    }
    uninstallErrorHandler();
    if (replaceHistory)
        window.location.replace("?" + $.param(exports.qs));
    else
        window.location.href = "?" + $.param(exports.qs);
}
function replaceURLState() {
    if (exports.platform_id)
        exports.qs.platform = exports.platform_id;
    delete exports.qs['']; // remove null parameter
    history.replaceState({}, "", "?" + $.param(exports.qs));
}
function addPageFocusHandlers() {
    var hidden = false;
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState == 'hidden' && exports.platform && exports.platform.isRunning()) {
            _pause();
            hidden = true;
        }
        else if (document.visibilityState == 'visible' && hidden) {
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
        if (exports.platform && exports.platform.isRunning()) {
            _pause();
            hidden = true;
        }
    });
    $(window).on("orientationchange", () => {
        if (exports.platform && exports.platform.resize)
            setTimeout(exports.platform.resize.bind(exports.platform), 200);
    });
}
// TODO: merge w/ player.html somehow?
function showInstructions() {
    var div = $(document).find(".emucontrols-" + (0, util_1.getRootBasePlatform)(exports.platform_id));
    if (exports.platform_id.endsWith(".mame"))
        div.show(); // TODO: MAME seems to eat the focus() event
    var vcanvas = $("#emulator").find("canvas");
    if (vcanvas) {
        vcanvas.on('focus', () => {
            if (exports.platform.isRunning()) {
                div.fadeIn(200);
                // toggle sound for browser autoplay
                exports.platform.pause();
                exports.platform.resume();
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
                (0, analytics_1.gaEvent)('menu', e.target.id);
            }
        });
        (0, analytics_1.gaPageView)(location.pathname + '?platform=' + exports.platform_id + (exports.repo_id ? ('&repo=' + exports.repo_id) : ('&file=' + exports.qs.file)));
    }
}
async function startPlatform() {
    if (!emu_1.PLATFORMS[exports.platform_id])
        throw Error("Invalid platform '" + exports.platform_id + "'.");
    let emudiv = $("#emuscreen")[0];
    let options = (0, util_1.decodeQueryString)(exports.qs.options || '');
    exports.platform = new emu_1.PLATFORMS[exports.platform_id](emudiv, options);
    setPlatformUI();
    stateRecorder = new recorder_1.StateRecorderImpl(exports.platform);
    const PRESETS = exports.platform.getPresets ? exports.platform.getPresets() : [];
    if (!exports.qs.file) {
        // try to load last file (redirect)
        var lastid = userPrefs.getLastPreset();
        // load first preset file, unless we're in a repo
        var defaultfile = lastid || (exports.repo_id ? null : PRESETS[0].id);
        exports.qs.file = defaultfile || 'DEFAULT';
        if (!defaultfile) {
            (0, dialogs_1.alertError)("There is no default main file for this project. Try selecting one from the pulldown.");
        }
    }
    // legacy vcs stuff
    if (exports.platform_id == 'vcs' && exports.qs.file.startsWith('examples/') && !exports.qs.file.endsWith('.a')) {
        exports.qs.file += '.a';
    }
    // start platform and load file
    replaceURLState();
    installErrorHandler();
    installGAHooks();
    await exports.platform.start();
    await loadBIOSFromProject();
    await initProject();
    await loadProject(exports.qs.file);
    exports.platform.sourceFileFetch = (path) => exports.current_project.filedata[path];
    setupDebugControls();
    addPageFocusHandlers();
    showInstructions();
    if (isEmbed) {
        hideControlsForEmbed();
    }
    else {
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
    if ((0, util_1.getRootBasePlatform)(exports.platform_id) == 'nes')
        $(".book-nes").addClass("book-active");
    else if ((0, util_1.getRootBasePlatform)(exports.platform_id) == 'vcs')
        $(".book-vcs").addClass("book-active");
    else if ((0, util_1.getRootBasePlatform)(exports.platform_id) == 'verilog')
        $(".book-verilog").addClass("book-active");
    else if ((0, util_1.getRootBasePlatform)(exports.platform_id) == 'c64')
        $(".book-c64").addClass("book-active");
    else if (exports.platform.getToolForFilename(getCurrentMainFilename()) == 'sdcc')
        $(".book-arcade").addClass("book-active");
}
function revealTopBar() {
    setTimeout(() => { $("#controls_dynamic").css('visibility', 'inherit'); }, 250);
}
function setupSplits() {
    var splitName = 'workspace-split3-' + exports.platform_id;
    if (isEmbed)
        splitName = 'embed-' + splitName;
    var sizes;
    if (exports.platform_id.startsWith('vcs'))
        sizes = [0, 50, 50];
    else if (isEmbed || baseviews_1.isMobileDevice)
        sizes = [0, 55, 45];
    else
        sizes = [12, 44, 44];
    var sizesStr = hasLocalStorage && localStorage.getItem(splitName);
    if (sizesStr) {
        try {
            sizes = JSON.parse(sizesStr);
        }
        catch (e) {
            console.log(e);
        }
    }
    var split = Split(['#sidebar', '#workspace', '#emulator'], {
        sizes: sizes,
        minSize: [0, 250, 250],
        onDrag: () => {
            if (exports.platform && exports.platform.resize)
                exports.platform.resize();
        },
        onDragEnd: () => {
            if (hasLocalStorage)
                localStorage.setItem(splitName, JSON.stringify(split.getSizes()));
            if (exports.projectWindows)
                exports.projectWindows.resize();
        },
    });
}
function loadImportedURL(url) {
    // TODO: zip file?
    const ignore = (0, util_1.parseBool)(exports.qs.ignore) || isEmbed;
    (0, dialogs_1.setWaitDialog)(true);
    (0, util_1.getWithBinary)(url, async (data) => {
        if (data) {
            var path = (0, util_1.getFilenameForPath)(url);
            console.log("Importing " + data.length + " bytes as " + path);
            try {
                var olddata = await store.getItem(path);
                (0, dialogs_1.setWaitDialog)(false);
                if (olddata != null && ignore) {
                    // ignore=1, do nothing
                }
                else if (olddata == null || confirm("Replace existing file '" + path + "'?")) {
                    await store.setItem(path, data);
                }
                delete exports.qs.importURL;
                exports.qs.file = path;
                replaceURLState();
                loadAndStartPlatform();
            }
            finally {
                (0, dialogs_1.setWaitDialog)(false);
            }
        }
        else {
            (0, dialogs_1.alertError)("Could not load source code from URL: " + url);
            (0, dialogs_1.setWaitDialog)(false);
        }
    }, 'text');
}
async function loadFormDataUpload() {
    var ignore = (0, util_1.parseBool)(exports.qs.ignore);
    var force = (0, util_1.parseBool)(exports.qs.force);
    if (isEmbed) {
        ignore = !force; // ignore is default when embed=1 unless force=1
    }
    else {
        force = false; // can't use force w/o embed=1
    }
    for (var i = 0; i < 20; i++) {
        let path = exports.qs['file' + i + '_name'];
        let dataenc = exports.qs['file' + i + '_data'];
        if (path == null || dataenc == null)
            break;
        var olddata = await store.getItem(path);
        if (!(ignore && olddata)) {
            let value = dataenc;
            if (exports.qs['file' + i + '_type'] == 'binary') {
                value = (0, util_1.stringToByteArray)(atob(value));
            }
            if (!olddata || force || confirm("Replace existing file '" + path + "'?")) {
                await store.setItem(path, value);
            }
        }
        if (i == 0) {
            exports.qs.file = path;
        } // set main filename
        delete exports.qs['file' + i + '_name'];
        delete exports.qs['file' + i + '_data'];
        delete exports.qs['file' + i + '_type'];
    }
    delete exports.qs.ignore;
    delete exports.qs.force;
    replaceURLState();
}
function setPlatformUI() {
    var name = exports.platform.getPlatformName && exports.platform.getPlatformName();
    var menuitem = $('a[href="?platform=' + exports.platform_id + '"]');
    if (menuitem.length) {
        menuitem.addClass("dropdown-item-checked");
        name = name || menuitem.text() || name;
    }
    platform_name = name || exports.platform_id;
    $(".platform_name").text(platform_name);
}
function getPlatformAndRepo() {
    // lookup repository for this platform (TODO: enable cross-platform repos)
    exports.platform_id = exports.qs.platform || userPrefs.getLastPlatformID();
    exports.repo_id = exports.qs.repo;
    // only look at cached repo_id if file= is not present, so back button works
    if (!exports.qs.repo && !exports.qs.file)
        exports.repo_id = userPrefs.getLastRepoID(exports.platform_id);
    // are we in a repo?
    if (hasLocalStorage && exports.repo_id && exports.repo_id !== '/') {
        var repo = (0, services_1.getRepos)()[exports.repo_id];
        // override query string params w/ repo settings
        if (repo) {
            console.log(exports.platform_id, exports.qs, repo);
            exports.qs.repo = exports.repo_id;
            if (repo.platform_id && !exports.qs.platform)
                exports.qs.platform = exports.platform_id = repo.platform_id;
            if (repo.mainPath && !exports.qs.file)
                exports.qs.file = repo.mainPath;
            // TODO: update repo definition if new main file compiles successfully
            //requestPersistPermission(true, true);
        }
    }
    else {
        exports.repo_id = '';
        delete exports.qs.repo;
    }
    // add default platform
    if (!exports.platform_id) {
        if (isEmbed)
            (0, dialogs_1.fatalError)(`The 'platform' must be specified when embed=1`);
        exports.platform_id = exports.qs.platform = "vcs";
    }
}
// start
async function startUI() {
    // import from github?
    if (exports.qs.githubURL) {
        (0, sync_1.importProjectFromGithub)(exports.qs.githubURL, true);
        return;
    }
    getPlatformAndRepo();
    setupSplits();
    // get store ID, repo id or platform id
    exports.store_id = exports.repo_id || (0, util_1.getBasePlatform)(exports.platform_id);
    // are we embedded?
    if (isEmbed) {
        exports.store_id = (document.referrer || document.location.href) + exports.store_id;
    }
    // create store
    store = (0, project_1.createNewPersistentStore)(exports.store_id);
    // is this an importURL?
    if (exports.qs.importURL) {
        loadImportedURL(exports.qs.importURL);
        return; // TODO: make async
    }
    // is this a file POST?
    if (exports.qs.file0_name) {
        await loadFormDataUpload();
    }
    // load and start platform object
    loadAndStartPlatform();
}
async function loadAndStartPlatform() {
    try {
        var module = await (0, _index_1.importPlatform)((0, util_1.getRootBasePlatform)(exports.platform_id));
        console.log("starting platform", exports.platform_id); // loaded required <platform_id>.js file
        await startPlatform();
        document.title = document.title + " [" + exports.platform_id + "] - " + (exports.repo_id ? ('[' + exports.repo_id + '] - ') : '') + exports.current_project.mainPath;
    }
    catch (e) {
        console.log(e);
        (0, dialogs_1.alertError)('Platform "' + exports.platform_id + '" failed to load.');
    }
    finally {
        revealTopBar();
    }
}
// HTTPS REDIRECT
const useHTTPSCookieName = "__use_https";
function setHTTPSCookie(val) {
    document.cookie = useHTTPSCookieName + "=" + val + ";domain=8bitworkshop.com;path=/;max-age=315360000";
}
function shouldRedirectHTTPS() {
    // cookie set? either true or false
    var shouldRedir = (0, util_1.getCookie)(useHTTPSCookieName);
    if (typeof shouldRedir === 'string') {
        return !!shouldRedir; // convert to bool
    }
    // set a 10yr cookie, value depends on if it's our first time here
    var val = hasLocalStorage && !localStorage.getItem("__lastplatform") ? 1 : 0;
    setHTTPSCookie(val);
    return !!val;
}
function _switchToHTTPS() {
    bootbox.confirm('<p>Do you want to force the browser to use HTTPS from now on?</p>' +
        '<p>WARNING: This will make all of your local files unavailable, so you should "Download All Changes" first for each platform where you have done work.</p>' +
        '<p>You can go back to HTTP by setting the "' + useHTTPSCookieName + '" cookie to 0.</p>', (ok) => {
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
        }
        else {
            $("#item_switch_https").click(_switchToHTTPS).show();
        }
    }
}
// redirect to HTTPS after script loads?
redirectToHTTPS();
//// ELECTRON (and other external) STUFF
function setTestInput(path, data) {
    exports.platform.writeFile(path, data);
}
function getTestOutput(path) {
    return exports.platform.readFile(path);
}
function getSaveState() {
    return exports.platform.saveState();
}
function emulationHalted(err) {
    var msg = (err && err.message) || msg;
    showExceptionAsError(err, msg);
    exports.projectWindows.refresh(false); // don't mess with cursor
    if (exports.platform.saveState)
        showDebugInfo(exports.platform.saveState());
}
async function reloadWorkspaceFile(path) {
    var oldval = exports.current_project.filedata[path];
    if (oldval != null) {
        exports.projectWindows.updateFile(path, await alternateLocalFilesystem.getFileData(path));
        console.log('updating file', path);
    }
}
function writeOutputROMFile() {
    if (isElectron && current_output instanceof Uint8Array) {
        var prefix = (0, util_1.getFilenamePrefix)(getCurrentMainFilename());
        var suffix = (exports.platform.getROMExtension && exports.platform.getROMExtension(current_output))
            || "-" + (0, util_1.getBasePlatform)(exports.platform_id) + ".bin";
        alternateLocalFilesystem.setFileData(`bin/${prefix}${suffix}`, current_output);
    }
}
function highlightSearch(query) {
    var wnd = exports.projectWindows.getActive();
    if (wnd instanceof editors_1.SourceEditor) {
        var sc = wnd.editor.getSearchCursor(query);
        if (sc.findNext()) {
            wnd.editor.setSelection(sc.pos.to, sc.pos.from);
        }
    }
}
function startUIWhenVisible() {
    let started = false;
    let observer = new IntersectionObserver((entries, observer) => {
        for (var entry of entries) {
            if (entry.isIntersecting && !started) {
                startUI();
                started = true;
            }
            if (entry.intersectionRatio == 0 && isPlatformReady() && exports.platform.isRunning()) {
                _pause();
            }
            if (entry.intersectionRatio > 0 && isPlatformReady() && !exports.platform.isRunning()) {
                _resume();
            }
        }
    }, {});
    observer.observe($("#emulator")[0]); //window.document.body);
}
/// start UI if in browser (not node)
if (typeof process === 'undefined') {
    // if embedded, do not start UI until we scroll past it
    if (isEmbed && typeof IntersectionObserver === 'function') {
        startUIWhenVisible();
    }
    else {
        startUI();
    }
}
//# sourceMappingURL=ui.js.map