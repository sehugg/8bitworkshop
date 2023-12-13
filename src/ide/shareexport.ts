import { OutputSoundFile, TAPFile } from '../common/audio/CommodoreTape';
import { byteArrayToString, compressLZG, getBasePlatform, getFilenameForPath, getFilenamePrefix, loadScript } from '../common/util';
import { alertError, alertInfo, setWaitDialog, setWaitProgress } from './dialogs';
import { getCurrentEditorFilename, getCurrentMainFilename, getCurrentOutput, getCurrentProject, getPlatformStore, getWorkerParams, platform, platform_id, projectWindows } from './ui';
import { saveAs } from "file-saver";

declare var GIF;

export function _shareEmbedLink(e) {
    if (getCurrentOutput() == null) {
        alertError("Please fix errors before sharing.");
        return true;
    }
    if (!(getCurrentOutput() instanceof Uint8Array)) {
        alertError("Can't share a Verilog executable yet. (It's not actually a ROM...)");
        return true;
    }
    loadClipboardLibrary();
    loadScript('lib/liblzg.js').then(() => {
        // TODO: Module is bad var name (conflicts with MAME)
        var lzgrom = compressLZG(window['Module'], Array.from(<Uint8Array>getCurrentOutput()));
        window['Module'] = null; // so we load it again next time
        var lzgb64 = btoa(byteArrayToString(lzgrom));
        var embed = {
            p: platform_id,
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
        if (fulllink.length >= 65536) $("#embedAdviceWarnAll").show();
        else if (fulllink.length >= 5120) $("#embedAdviceWarnIE").show();
    });
    return true;
}

function loadClipboardLibrary() {
    // can happen in background because it won't be used until user clicks
    console.log('clipboard');
    import('clipboard').then((clipmod) => {
        let ClipboardJS = clipmod.default;
        new ClipboardJS(".btn");
    });
}

function get8bitworkshopLink(linkqs: string, fn: string) {
    console.log(linkqs);
    var loc = window.location;
    var prefix = loc.pathname.replace('index.html', '');
    var protocol = (loc.host == '8bitworkshop.com') ? 'https:' : loc.protocol;
    var fulllink = protocol + '//' + loc.host + prefix + fn + '?' + linkqs;
    return fulllink;
}

function _downloadCassetteFile_apple2(e) {
    var addr = getWorkerParams()?.code_start;
    loadScript('lib/c2t.js').then(() => {
        var stdout = '';
        var print_fn = function (s) { stdout += s + "\n"; }
        var c2t = window['c2t']({
            noInitialRun: true,
            print: print_fn,
            printErr: print_fn
        });
        var FS = c2t['FS'];
        var rompath = getCurrentMainFilename() + ".bin";
        var audpath = getCurrentMainFilename() + ".wav";
        FS.writeFile(rompath, getCurrentOutput(), { encoding: 'binary' });
        var args = ["-2bc", rompath + ',' + addr.toString(16), audpath];
        c2t.callMain(args);
        var audout = FS.readFile(audpath, { 'encoding': 'binary' });
        if (audout) {
            var blob = new Blob([audout], { type: "audio/wav" });
            saveAs(blob, audpath);
            stdout += "Then connect your audio output to the cassette input, turn up the volume, and play the audio file.";
            alertInfo(stdout);
        }
    });
}

export function _downloadCassetteFile_vcs(e) {
    loadScript('lib/makewav.js').then(() => {
        let stdout = '';
        let print_fn = function (s) { stdout += s + "\n"; }
        var prefix = getFilenamePrefix(getCurrentMainFilename());
        let rompath = prefix + ".bin";
        let audpath = prefix + ".wav";
        let _makewav = window['makewav']({
            noInitialRun: false,
            print: print_fn,
            printErr: print_fn,
            arguments: ['-ts', '-f0', '-v10', rompath],
            preRun: (mod) => {
                let FS = mod['FS'];
                FS.writeFile(rompath, getCurrentOutput(), { encoding: 'binary' });
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
                saveAs(blob, audpath);
                stdout += "\nConnect your audio output to the SuperCharger input, turn up the volume, and play the audio file.";
                alertInfo(stdout);
            }
        });
    });
}

function _downloadCassetteFile_c64(e) {
    var prefix = getFilenamePrefix(getCurrentMainFilename());
    let audpath = prefix + ".tap";
    let tapmaker = new TAPFile(prefix);
    let outfile = new OutputSoundFile({ sine_wave: true });
    let data = getCurrentOutput();
    let startAddress = data[0] + data[1] * 256;
    data = data.slice(2); // remove header
    tapmaker.setContent({ data, startAddress, type: TAPFile.FILE_TYPE_NON_RELOCATABLE });
    tapmaker.generateSound(outfile);
    let tapout = outfile.getTAPData();
    //let audout = outfile.getSoundData();
    if (tapout) {
        //let blob = new Blob([audout], { type: "audio/wav" });
        let blob = new Blob([tapout], { type: "application/octet-stream" });
        saveAs(blob, audpath);
    }
}

export function _getCassetteFunction() {
    switch (getBasePlatform(platform_id)) {
        case 'vcs': return _downloadCassetteFile_vcs;
        case 'apple2': return _downloadCassetteFile_apple2;
        case 'c64': return _downloadCassetteFile_c64;
    }
}

export function _downloadCassetteFile(e) {
    if (getCurrentOutput() == null) {
        alertError("Please fix errors before exporting.");
        return true;
    }
    var fn = _getCassetteFunction();
    if (fn === undefined) {
        alertError("Cassette export is not supported on this platform.");
        return true;
    }
    fn(e);
}

export function _downloadROMImage(e) {
    if (getCurrentOutput() == null) {
        alertError("Please finish compiling with no errors before downloading ROM.");
        return true;
    }
    var prefix = getFilenamePrefix(getCurrentMainFilename());
    if (platform.getDownloadFile) {
        var dl = platform.getDownloadFile();
        var prefix = getFilenamePrefix(getCurrentMainFilename());
        saveAs(dl.blob, prefix + dl.extension);
    } else if (getCurrentOutput() instanceof Uint8Array) {
        var blob = new Blob([getCurrentOutput()], { type: "application/octet-stream" });
        var suffix = (platform.getROMExtension && platform.getROMExtension(getCurrentOutput()))
            || "-" + getBasePlatform(platform_id) + ".bin";
        saveAs(blob, prefix + suffix);
    } else {
        alertError(`The "${platform_id}" platform doesn't have downloadable ROMs.`);
    }
}

export function _downloadSourceFile(e) {
    var text = projectWindows.getCurrentText();
    if (!text) return false;
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    saveAs(blob, getCurrentEditorFilename(), { autoBom: false });
}

async function newJSZip() {
    let JSZip = (await import('jszip')).default;
    return new JSZip();
}

export async function _downloadProjectZipFile(e) {
    var zip = await newJSZip();
    getCurrentProject().iterateFiles((id, data) => {
        if (data) {
            zip.file(getFilenameForPath(id), data);
        }
    });
    zip.generateAsync({ type: "blob" }).then((content) => {
        saveAs(content, getCurrentMainFilename() + "-" + getBasePlatform(platform_id) + ".zip");
    });
}

export function _downloadSymFile(e) {
    let symfile = platform.getDebugSymbolFile && platform.getDebugSymbolFile();
    if (!symfile) {
        alertError("This project does not have debug information.");
        return;
    }
    var prefix = getFilenamePrefix(getCurrentMainFilename());
    saveAs(symfile.blob, prefix + symfile.extension, { autoBom: false });
}

export async function _downloadAllFilesZipFile(e) {
    var zip = await newJSZip();
    var keys = await getPlatformStore().keys();
    setWaitDialog(true);
    try {
        var i = 0;
        await Promise.all(keys.map((path) => {
            return getPlatformStore().getItem(path).then((text) => {
                setWaitProgress(i++ / (keys.length + 1));
                if (text) {
                    zip.file(path, text as any);
                }
            });
        }));
        var content = await zip.generateAsync({ type: "blob" });
        saveAs(content, getBasePlatform(platform_id) + "-all.zip");
    } finally {
        setWaitDialog(false);
    }
}

var recordingVideo = false;

export function _recordVideo() {
    if (recordingVideo) return;
    loadScript("lib/gif.js").then(() => {
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
            platform.resume();
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
                setWaitDialog(true);
                platform.pause();
                gif.render();
                recordingVideo = false;
            } else {
                gif.addFrame(canvas, { delay: intervalMsec, copy: true });
                setTimeout(f, intervalMsec);
                recordingVideo = true;
            }
        };
        f();
    });
}

