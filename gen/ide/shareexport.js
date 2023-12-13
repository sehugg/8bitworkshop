"use strict";
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
exports._recordVideo = exports._downloadAllFilesZipFile = exports._downloadSymFile = exports._downloadProjectZipFile = exports._downloadSourceFile = exports._downloadROMImage = exports._downloadCassetteFile = exports._getCassetteFunction = exports._downloadCassetteFile_vcs = exports._shareEmbedLink = void 0;
const CommodoreTape_1 = require("../common/audio/CommodoreTape");
const util_1 = require("../common/util");
const dialogs_1 = require("./dialogs");
const ui_1 = require("./ui");
const file_saver_1 = require("file-saver");
function _shareEmbedLink(e) {
    if ((0, ui_1.getCurrentOutput)() == null) {
        (0, dialogs_1.alertError)("Please fix errors before sharing.");
        return true;
    }
    if (!((0, ui_1.getCurrentOutput)() instanceof Uint8Array)) {
        (0, dialogs_1.alertError)("Can't share a Verilog executable yet. (It's not actually a ROM...)");
        return true;
    }
    loadClipboardLibrary();
    (0, util_1.loadScript)('lib/liblzg.js').then(() => {
        // TODO: Module is bad var name (conflicts with MAME)
        var lzgrom = (0, util_1.compressLZG)(window['Module'], Array.from((0, ui_1.getCurrentOutput)()));
        window['Module'] = null; // so we load it again next time
        var lzgb64 = btoa((0, util_1.byteArrayToString)(lzgrom));
        var embed = {
            p: ui_1.platform_id,
            //n: current_project.mainPath,
            r: lzgb64
        };
        var linkqs = $.param(embed);
        var fulllink = get8bitworkshopLink(linkqs, 'player.html');
        var iframelink = '<iframe width=640 height=600 src="' + fulllink + '">';
        $("#embedLinkTextarea").text(fulllink);
        $("#embedIframeTextarea").text(iframelink);
        $("#embedLinkModal").modal('show');
        $("#embedAdviceWarnAll").hide();
        $("#embedAdviceWarnIE").hide();
        if (fulllink.length >= 65536)
            $("#embedAdviceWarnAll").show();
        else if (fulllink.length >= 5120)
            $("#embedAdviceWarnIE").show();
    });
    return true;
}
exports._shareEmbedLink = _shareEmbedLink;
function loadClipboardLibrary() {
    // can happen in background because it won't be used until user clicks
    console.log('clipboard');
    Promise.resolve().then(() => __importStar(require('clipboard'))).then((clipmod) => {
        let ClipboardJS = clipmod.default;
        new ClipboardJS(".btn");
    });
}
function get8bitworkshopLink(linkqs, fn) {
    console.log(linkqs);
    var loc = window.location;
    var prefix = loc.pathname.replace('index.html', '');
    var protocol = (loc.host == '8bitworkshop.com') ? 'https:' : loc.protocol;
    var fulllink = protocol + '//' + loc.host + prefix + fn + '?' + linkqs;
    return fulllink;
}
function _downloadCassetteFile_apple2(e) {
    var _a;
    var addr = (_a = (0, ui_1.getWorkerParams)()) === null || _a === void 0 ? void 0 : _a.code_start;
    (0, util_1.loadScript)('lib/c2t.js').then(() => {
        var stdout = '';
        var print_fn = function (s) { stdout += s + "\n"; };
        var c2t = window['c2t']({
            noInitialRun: true,
            print: print_fn,
            printErr: print_fn
        });
        var FS = c2t['FS'];
        var rompath = (0, ui_1.getCurrentMainFilename)() + ".bin";
        var audpath = (0, ui_1.getCurrentMainFilename)() + ".wav";
        FS.writeFile(rompath, (0, ui_1.getCurrentOutput)(), { encoding: 'binary' });
        var args = ["-2bc", rompath + ',' + addr.toString(16), audpath];
        c2t.callMain(args);
        var audout = FS.readFile(audpath, { 'encoding': 'binary' });
        if (audout) {
            var blob = new Blob([audout], { type: "audio/wav" });
            (0, file_saver_1.saveAs)(blob, audpath);
            stdout += "Then connect your audio output to the cassette input, turn up the volume, and play the audio file.";
            (0, dialogs_1.alertInfo)(stdout);
        }
    });
}
function _downloadCassetteFile_vcs(e) {
    (0, util_1.loadScript)('lib/makewav.js').then(() => {
        let stdout = '';
        let print_fn = function (s) { stdout += s + "\n"; };
        var prefix = (0, util_1.getFilenamePrefix)((0, ui_1.getCurrentMainFilename)());
        let rompath = prefix + ".bin";
        let audpath = prefix + ".wav";
        let _makewav = window['makewav']({
            noInitialRun: false,
            print: print_fn,
            printErr: print_fn,
            arguments: ['-ts', '-f0', '-v10', rompath],
            preRun: (mod) => {
                let FS = mod['FS'];
                FS.writeFile(rompath, (0, ui_1.getCurrentOutput)(), { encoding: 'binary' });
            }
        });
        _makewav.ready.then((makewav) => {
            let args = [rompath];
            makewav.run(args);
            console.log(stdout);
            let FS = makewav['FS'];
            let audout = FS.readFile(audpath, { 'encoding': 'binary' });
            if (audout) {
                let blob = new Blob([audout], { type: "audio/wav" });
                (0, file_saver_1.saveAs)(blob, audpath);
                stdout += "\nConnect your audio output to the SuperCharger input, turn up the volume, and play the audio file.";
                (0, dialogs_1.alertInfo)(stdout);
            }
        });
    });
}
exports._downloadCassetteFile_vcs = _downloadCassetteFile_vcs;
function _downloadCassetteFile_c64(e) {
    var prefix = (0, util_1.getFilenamePrefix)((0, ui_1.getCurrentMainFilename)());
    let audpath = prefix + ".tap";
    let tapmaker = new CommodoreTape_1.TAPFile(prefix);
    let outfile = new CommodoreTape_1.OutputSoundFile({ sine_wave: true });
    let data = (0, ui_1.getCurrentOutput)();
    let startAddress = data[0] + data[1] * 256;
    data = data.slice(2); // remove header
    tapmaker.setContent({ data, startAddress, type: CommodoreTape_1.TAPFile.FILE_TYPE_NON_RELOCATABLE });
    tapmaker.generateSound(outfile);
    let tapout = outfile.getTAPData();
    //let audout = outfile.getSoundData();
    if (tapout) {
        //let blob = new Blob([audout], { type: "audio/wav" });
        let blob = new Blob([tapout], { type: "application/octet-stream" });
        (0, file_saver_1.saveAs)(blob, audpath);
    }
}
function _getCassetteFunction() {
    switch ((0, util_1.getBasePlatform)(ui_1.platform_id)) {
        case 'vcs': return _downloadCassetteFile_vcs;
        case 'apple2': return _downloadCassetteFile_apple2;
        case 'c64': return _downloadCassetteFile_c64;
    }
}
exports._getCassetteFunction = _getCassetteFunction;
function _downloadCassetteFile(e) {
    if ((0, ui_1.getCurrentOutput)() == null) {
        (0, dialogs_1.alertError)("Please fix errors before exporting.");
        return true;
    }
    var fn = _getCassetteFunction();
    if (fn === undefined) {
        (0, dialogs_1.alertError)("Cassette export is not supported on this platform.");
        return true;
    }
    fn(e);
}
exports._downloadCassetteFile = _downloadCassetteFile;
function _downloadROMImage(e) {
    if ((0, ui_1.getCurrentOutput)() == null) {
        (0, dialogs_1.alertError)("Please finish compiling with no errors before downloading ROM.");
        return true;
    }
    var prefix = (0, util_1.getFilenamePrefix)((0, ui_1.getCurrentMainFilename)());
    if (ui_1.platform.getDownloadFile) {
        var dl = ui_1.platform.getDownloadFile();
        var prefix = (0, util_1.getFilenamePrefix)((0, ui_1.getCurrentMainFilename)());
        (0, file_saver_1.saveAs)(dl.blob, prefix + dl.extension);
    }
    else if ((0, ui_1.getCurrentOutput)() instanceof Uint8Array) {
        var blob = new Blob([(0, ui_1.getCurrentOutput)()], { type: "application/octet-stream" });
        var suffix = (ui_1.platform.getROMExtension && ui_1.platform.getROMExtension((0, ui_1.getCurrentOutput)()))
            || "-" + (0, util_1.getBasePlatform)(ui_1.platform_id) + ".bin";
        (0, file_saver_1.saveAs)(blob, prefix + suffix);
    }
    else {
        (0, dialogs_1.alertError)(`The "${ui_1.platform_id}" platform doesn't have downloadable ROMs.`);
    }
}
exports._downloadROMImage = _downloadROMImage;
function _downloadSourceFile(e) {
    var text = ui_1.projectWindows.getCurrentText();
    if (!text)
        return false;
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    (0, file_saver_1.saveAs)(blob, (0, ui_1.getCurrentEditorFilename)(), { autoBom: false });
}
exports._downloadSourceFile = _downloadSourceFile;
async function newJSZip() {
    let JSZip = (await Promise.resolve().then(() => __importStar(require('jszip')))).default;
    return new JSZip();
}
async function _downloadProjectZipFile(e) {
    var zip = await newJSZip();
    (0, ui_1.getCurrentProject)().iterateFiles((id, data) => {
        if (data) {
            zip.file((0, util_1.getFilenameForPath)(id), data);
        }
    });
    zip.generateAsync({ type: "blob" }).then((content) => {
        (0, file_saver_1.saveAs)(content, (0, ui_1.getCurrentMainFilename)() + "-" + (0, util_1.getBasePlatform)(ui_1.platform_id) + ".zip");
    });
}
exports._downloadProjectZipFile = _downloadProjectZipFile;
function _downloadSymFile(e) {
    let symfile = ui_1.platform.getDebugSymbolFile && ui_1.platform.getDebugSymbolFile();
    if (!symfile) {
        (0, dialogs_1.alertError)("This project does not have debug information.");
        return;
    }
    var prefix = (0, util_1.getFilenamePrefix)((0, ui_1.getCurrentMainFilename)());
    (0, file_saver_1.saveAs)(symfile.blob, prefix + symfile.extension, { autoBom: false });
}
exports._downloadSymFile = _downloadSymFile;
async function _downloadAllFilesZipFile(e) {
    var zip = await newJSZip();
    var keys = await (0, ui_1.getPlatformStore)().keys();
    (0, dialogs_1.setWaitDialog)(true);
    try {
        var i = 0;
        await Promise.all(keys.map((path) => {
            return (0, ui_1.getPlatformStore)().getItem(path).then((text) => {
                (0, dialogs_1.setWaitProgress)(i++ / (keys.length + 1));
                if (text) {
                    zip.file(path, text);
                }
            });
        }));
        var content = await zip.generateAsync({ type: "blob" });
        (0, file_saver_1.saveAs)(content, (0, util_1.getBasePlatform)(ui_1.platform_id) + "-all.zip");
    }
    finally {
        (0, dialogs_1.setWaitDialog)(false);
    }
}
exports._downloadAllFilesZipFile = _downloadAllFilesZipFile;
var recordingVideo = false;
function _recordVideo() {
    if (recordingVideo)
        return;
    (0, util_1.loadScript)("lib/gif.js").then(() => {
        var canvas = $("#emulator").find("canvas")[0];
        if (!canvas) {
            (0, dialogs_1.alertError)("Could not find canvas element to record video!");
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
            (0, dialogs_1.setWaitProgress)(prog);
        });
        gif.on('finished', (blob) => {
            img.attr('src', URL.createObjectURL(blob));
            (0, dialogs_1.setWaitDialog)(false);
            ui_1.platform.resume();
            $("#videoPreviewModal").modal('show');
        });
        var intervalMsec = 20;
        var maxFrames = 300;
        var nframes = 0;
        console.log("Recording video", canvas);
        $("#emulator").css('backgroundColor', '#cc3333');
        var f = () => {
            if (nframes++ > maxFrames) {
                console.log("Rendering video");
                $("#emulator").css('backgroundColor', 'inherit');
                (0, dialogs_1.setWaitDialog)(true);
                ui_1.platform.pause();
                gif.render();
                recordingVideo = false;
            }
            else {
                gif.addFrame(canvas, { delay: intervalMsec, copy: true });
                setTimeout(f, intervalMsec);
                recordingVideo = true;
            }
        };
        f();
    });
}
exports._recordVideo = _recordVideo;
//# sourceMappingURL=shareexport.js.map