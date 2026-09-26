"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullAudio = void 0;
exports.mockGlobals = mockGlobals;
exports.mockAudio = mockAudio;
exports.mockFetch = mockFetch;
exports.mockScripts = mockScripts;
exports.mockDOM = mockDOM;
const util_1 = require("../common/util");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const vm_1 = __importDefault(require("vm"));
function mockGlobals() {
    global.atob = require('atob');
    global.btoa = require('btoa');
    global.window = global;
    global.window.addEventListener = global.window.addEventListener || function () { };
    global.window.removeEventListener = global.window.removeEventListener || function () { };
    global.document = global.document || { addEventListener() { }, removeEventListener() { } };
    try {
        global.navigator = global.navigator || {};
    }
    catch (e) { }
    // Node's own localStorage warns unless given a file; scripts only need a stub
    Object.defineProperty(global, 'localStorage', { value: memoryStorage(), configurable: true, writable: true });
}
function memoryStorage() {
    const items = new Map();
    return {
        get length() { return items.size; },
        key: (i) => { var _a; return (_a = [...items.keys()][i]) !== null && _a !== void 0 ? _a : null; },
        getItem: (k) => items.has(k) ? items.get(k) : null,
        setItem: (k, v) => { items.set(k, String(v)); },
        removeItem: (k) => { items.delete(k); },
        clear: () => { items.clear(); },
    };
}
class NullAudio {
    feedSample(value, count) {
    }
}
exports.NullAudio = NullAudio;
function mockAudio() {
    class NullPsgDeviceChannel {
        setMode() { }
        setDevice() { }
        generate() { }
        setBufferLength() { }
        setSampleRate() { }
        getBuffer() { return []; }
        writeRegister() { }
        writeRegisterSN() { }
        writeRegisterAY() { }
        readRegister() { return 0; }
    }
    class NullMasterChannel {
        addChannel() { }
    }
    global.MasterChannel = NullMasterChannel;
    global.PsgDeviceChannel = NullPsgDeviceChannel;
}
/** Serve fetch() from the filesystem, relative to `rootDir`. */
function mockFetch(rootDir = process.cwd()) {
    global.fetch = async (url, init) => {
        let bin = fs_1.default.readFileSync(path_1.default.resolve(rootDir, String(url)));
        let blob = new Blob([bin]);
        return new Response(blob);
    };
}
/**
 * Make loadScript() evaluate files from `rootDir` in the global scope, the
 * way a <script> tag would. Each script loads once.
 */
function mockScripts(rootDir = process.cwd()) {
    const loaded = new Map();
    (0, util_1.setScriptLoader)((url) => {
        const file = path_1.default.resolve(rootDir, url);
        if (!loaded.has(file)) {
            loaded.set(file, (async () => {
                vm_1.default.runInThisContext(fs_1.default.readFileSync(file, 'utf8'), { filename: file });
            })());
        }
        return loaded.get(file);
    });
}
function mockDOM() {
    var _a;
    const jsdom = require('jsdom');
    const { JSDOM } = jsdom;
    const dom = new JSDOM(`<!DOCTYPE html><div id="emulator"><div id="javatari-div"><div id="javatari-screen"></div><div id="javatari-console-panel"></div></div></div>`);
    global.window = dom.window;
    global.document = dom.window.document;
    // scripts loaded by loadScript() (Javatari) use these as bare globals
    (_a = global.Image) !== null && _a !== void 0 ? _a : (global.Image = dom.window.Image);
    // jsdom has no 2D context without the canvas package
    dom.window.HTMLCanvasElement.prototype.getContext = function () {
        var _a;
        return (_a = this._ctx2d) !== null && _a !== void 0 ? _a : (this._ctx2d = mockContext2D(this));
    };
    //global['$'] = require("jquery/jquery.min.js");
    dom.window.Audio = null;
    //global.Image = function () { };
    return dom;
}
/** A 2D context that draws nothing but hands out real ImageData buffers. */
function mockContext2D(canvas) {
    const imageData = (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
    return {
        canvas,
        fillStyle: '', strokeStyle: '', globalAlpha: 1, globalCompositeOperation: 'source-over',
        imageSmoothingEnabled: true, font: '', lineWidth: 1,
        createImageData: imageData,
        getImageData: (_x, _y, w, h) => imageData(w, h),
        putImageData() { }, drawImage() { }, fillRect() { }, clearRect() { }, strokeRect() { },
        fillText() { }, measureText: () => ({ width: 0 }),
        beginPath() { }, closePath() { }, moveTo() { }, lineTo() { }, stroke() { }, fill() { }, arc() { }, rect() { },
        save() { }, restore() { }, translate() { }, scale() { }, rotate() { }, setTransform() { },
    };
}
//# sourceMappingURL=nodemock.js.map