
import { SampledAudioSink } from "../common/devices";

import fs from 'fs';

export function mockGlobals() {
    global.atob = require('atob');
    global.btoa = require('btoa');
    (global as any).window = global;
    (global as any).window.addEventListener = (global as any).window.addEventListener || function () { };
    (global as any).window.removeEventListener = (global as any).window.removeEventListener || function () { };
    (global as any).document = (global as any).document || { addEventListener() { }, removeEventListener() { } };
    try { (global as any).navigator = (global as any).navigator || {}; } catch (e) { }
}

export class NullAudio implements SampledAudioSink {
    feedSample(value: number, count: number): void {
    }
}

export function mockAudio() {
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

export function mockFetch() {
    global.fetch = async (path, init) => {
        let bin = fs.readFileSync(path);
        let blob = new Blob([bin]);
        return new Response(blob);
    }
}

export function mockDOM() {
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
