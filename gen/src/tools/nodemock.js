"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullAudio = void 0;
exports.mockGlobals = mockGlobals;
exports.mockAudio = mockAudio;
exports.mockFetch = mockFetch;
exports.mockDOM = mockDOM;
const fs_1 = __importDefault(require("fs"));
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
    }
    class NullMasterChannel {
        addChannel() { }
    }
    global.MasterChannel = NullMasterChannel;
    global.PsgDeviceChannel = NullPsgDeviceChannel;
}
function mockFetch() {
    global.fetch = async (path, init) => {
        let bin = fs_1.default.readFileSync(path);
        let blob = new Blob([bin]);
        return new Response(blob);
    };
}
function mockDOM() {
    const jsdom = require('jsdom');
    const { JSDOM } = jsdom;
    const dom = new JSDOM(`<!DOCTYPE html><div id="emulator"><div id="javatari-screen"></div></div>`);
    global.window = dom.window;
    global.document = dom.window.document;
    //global['$'] = require("jquery/jquery.min.js");
    dom.window.Audio = null;
    //global.Image = function () { };
    return dom;
}
//# sourceMappingURL=nodemock.js.map