"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startEmbed = exports.stateRecorder = exports.platform = exports.platform_id = void 0;
const util_1 = require("../common/util");
const emu_1 = require("../common/emu");
const util_2 = require("../common/util");
const recorder_1 = require("../common/recorder");
const _index_1 = require("../platform/_index");
const file_saver_1 = require("file-saver");
var _qs = (function (a) {
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
            var msg = msgevent + " " + url + " " + " " + line + ":" + col + ", " + error;
            $.get("/error?msg=" + encodeURIComponent(msg), "text");
        };
    }
}
function uninstallErrorHandler() {
    window.onerror = null;
}
function addPageFocusHandlers() {
    var hidden = false;
    document.addEventListener("visibilitychange", function (e) {
        if (document.visibilityState == 'hidden' && exports.platform.isRunning()) {
            exports.platform.pause();
            hidden = true;
        }
        else if (document.visibilityState == 'visible' && hidden) {
            exports.platform.resume();
            hidden = false;
        }
    });
    $(window).on("focus", function () {
        if (hidden) {
            exports.platform.resume();
            hidden = false;
        }
    });
    $(window).on("blur", function () {
        if (exports.platform.isRunning()) {
            exports.platform.pause();
            hidden = true;
        }
    });
}
async function startROM(title, rom) {
    if (!rom) {
        alert("No ROM found.");
        return;
    }
    console.log(rom.length + ' bytes');
    await exports.platform.loadROM(title, rom);
    exports.platform.resume();
}
function enableRecording() {
    exports.stateRecorder = new recorder_1.StateRecorderImpl(exports.platform);
    exports.stateRecorder.reset();
    exports.stateRecorder.checkpointInterval = 60 * 5; // every 5 sec
    exports.stateRecorder.maxCheckpoints = 360; // 30 minutes
    exports.platform.setRecorder(exports.stateRecorder);
    console.log('start recording');
}
function findPrimaryCanvas() {
    return $("#emulator").find('canvas');
}
function recordVideo(intervalMsec, maxFrames, callback) {
    (0, util_2.loadScript)("gif.js/dist/gif.js").then(() => {
        var canvas = findPrimaryCanvas()[0];
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
        gif.on('finished', function (blob) {
            console.log('finished encoding GIF');
            callback(blob);
        });
        intervalMsec = intervalMsec || (100 + ((Math.random() * 256) & 3));
        maxFrames = maxFrames || (100 + ((Math.random() * 256) & 15));
        var nframes = 0;
        console.log("Recording video", canvas);
        var f = () => {
            if (nframes++ > maxFrames) {
                console.log("Rendering video");
                gif.render();
            }
            else {
                gif.addFrame(canvas, { delay: intervalMsec, copy: true });
                setTimeout(f, intervalMsec);
            }
        };
        f();
    });
}
async function startPlatform(qs) {
    if (!emu_1.PLATFORMS[exports.platform_id])
        throw Error("Invalid platform '" + exports.platform_id + "'.");
    exports.platform = new emu_1.PLATFORMS[exports.platform_id]($("#emuscreen")[0]);
    await exports.platform.start();
    // start recorder when click on canvas (TODO?)
    if (qs['rec']) {
        findPrimaryCanvas().on('focus', () => {
            //if (!stateRecorder) { enableRecording(); }
            // toggle sound for browser autoplay
            exports.platform.resume();
        });
    }
    var title = qs['n'] || 'Game';
    var rom;
    var romurl = qs['url'];
    var lzgvar = qs['r'];
    if (romurl) {
        // load rom url remotely
        console.log(romurl);
        (0, util_2.getWithBinary)(romurl, (data) => {
            startROM(title, data);
        }, 'arraybuffer');
        return true;
    }
    else if (lzgvar) {
        // decompress from lzg
        var lzgrom = (0, util_2.stringToByteArray)(atob(lzgvar));
        rom = new util_1.lzgmini().decode(lzgrom);
    }
    addPageFocusHandlers();
    startROM(title, rom);
    return true;
}
// TODO: merge with ui
async function loadPlatform(qs) {
    if (qs.data)
        qs = qs.data;
    exports.platform_id = qs['p'];
    if (!exports.platform_id)
        throw new Error('No platform variable!');
    try {
        var module = await (0, _index_1.importPlatform)((0, util_2.getRootBasePlatform)(exports.platform_id));
        console.log("starting platform", exports.platform_id); // loaded required <platform_id>.js file
        await startPlatform(qs);
    }
    catch (e) {
        console.log(e);
        alert('Platform "' + exports.platform_id + '" not supported.');
    }
}
// start
function startEmbed() {
    installErrorHandler();
    if (_qs['p']) {
        loadPlatform(_qs);
    }
}
exports.startEmbed = startEmbed;
// iframe API
window.addEventListener("message", receiveMessage, false);
function receiveMessage(event) {
    if (event.data) {
        var cmd = event.data.cmd;
        if (cmd == 'start' && !exports.platform) {
            loadPlatform(event);
        }
        else if (cmd == 'reset') {
            exports.platform.reset();
            exports.stateRecorder.reset();
        }
        else if (cmd == 'getReplay') {
            var replay = {
                frameCount: exports.stateRecorder.frameCount,
                checkpoints: exports.stateRecorder.checkpoints,
                framerecs: exports.stateRecorder.framerecs,
                checkpointInterval: exports.stateRecorder.checkpointInterval,
                maxCheckpoints: exports.stateRecorder.maxCheckpoints,
            };
            event.source.postMessage({ ack: cmd, replay: replay }, event.origin);
        }
        else if (cmd == 'watchState') {
            var watchfn = new Function('platform', 'state', event.data.fn);
            exports.stateRecorder.callbackNewCheckpoint = (state) => {
                event.source.postMessage({ ack: cmd, state: watchfn(exports.platform, state) }, event.origin);
            };
        }
        else if (cmd == 'recordVideo') {
            recordVideo(event.data.intervalMsec, event.data.maxFrames, function (blob) {
                if (event.data.filename) {
                    (0, file_saver_1.saveAs)(blob, event.data.filename);
                }
                event.source.postMessage({ ack: cmd, gif: blob }, event.origin);
            });
        }
        else {
            console.log("Unknown data.cmd: " + cmd);
        }
    }
}
/////
// are we not in an iframe?
if (self === top) {
    document.body.style.backgroundColor = '#555';
}
startEmbed();
//# sourceMappingURL=embedui.js.map