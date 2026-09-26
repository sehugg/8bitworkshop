
import { SampledAudioSink } from "../common/devices";

import { setScriptLoader } from "../common/util";

import fs from 'fs';
import path from 'path';
import vm from 'vm';

export function mockGlobals() {
    global.atob = require('atob');
    global.btoa = require('btoa');
    (global as any).window = global;
    (global as any).window.addEventListener = (global as any).window.addEventListener || function () { };
    (global as any).window.removeEventListener = (global as any).window.removeEventListener || function () { };
    (global as any).document = (global as any).document || { addEventListener() { }, removeEventListener() { } };
    try { (global as any).navigator = (global as any).navigator || {}; } catch (e) { }
    // Node's own localStorage warns unless given a file; scripts only need a stub
    Object.defineProperty(global, 'localStorage', { value: memoryStorage(), configurable: true, writable: true });
}

function memoryStorage() {
    const items = new Map<string, string>();
    return {
        get length() { return items.size; },
        key: (i: number) => [...items.keys()][i] ?? null,
        getItem: (k: string) => items.has(k) ? items.get(k) : null,
        setItem: (k: string, v: string) => { items.set(k, String(v)); },
        removeItem: (k: string) => { items.delete(k); },
        clear: () => { items.clear(); },
    };
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
        readRegister() { return 0; }
    }
    class NullMasterChannel {
        addChannel() { }
    }
    global.MasterChannel = NullMasterChannel;
    global.PsgDeviceChannel = NullPsgDeviceChannel;
}

/** Serve fetch() from the filesystem, relative to `rootDir`. */
export function mockFetch(rootDir: string = process.cwd()) {
    global.fetch = async (url, init) => {
        let bin = fs.readFileSync(path.resolve(rootDir, String(url)));
        let blob = new Blob([bin]);
        return new Response(blob);
    }
}

/**
 * Make loadScript() evaluate files from `rootDir` in the global scope, the
 * way a <script> tag would. Each script loads once.
 */
export function mockScripts(rootDir: string = process.cwd()) {
    const loaded = new Map<string, Promise<void>>();
    setScriptLoader((url) => {
        const file = path.resolve(rootDir, url);
        if (!loaded.has(file)) {
            loaded.set(file, (async () => {
                vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
            })());
        }
        return loaded.get(file);
    });
}

export function mockDOM() {
  const jsdom = require('jsdom');
  const { JSDOM } = jsdom;
  const dom = new JSDOM(`<!DOCTYPE html><div id="emulator"><div id="javatari-div"><div id="javatari-screen"></div><div id="javatari-console-panel"></div></div></div>`);
  global.window = dom.window;
  global.document = dom.window.document;
  // scripts loaded by loadScript() (Javatari) use these as bare globals
  global.Image ??= dom.window.Image;
  // jsdom has no 2D context without the canvas package
  dom.window.HTMLCanvasElement.prototype.getContext = function () {
    return this._ctx2d ??= mockContext2D(this);
  };
  //global['$'] = require("jquery/jquery.min.js");
  dom.window.Audio = null;
  //global.Image = function () { };
  return dom;
}

/** A 2D context that draws nothing but hands out real ImageData buffers. */
function mockContext2D(canvas: { width: number, height: number }) {
  const imageData = (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
  return {
    canvas,
    fillStyle: '', strokeStyle: '', globalAlpha: 1, globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true, font: '', lineWidth: 1,
    createImageData: imageData,
    getImageData: (_x: number, _y: number, w: number, h: number) => imageData(w, h),
    putImageData() { }, drawImage() { }, fillRect() { }, clearRect() { }, strokeRect() { },
    fillText() { }, measureText: () => ({ width: 0 }),
    beginPath() { }, closePath() { }, moveTo() { }, lineTo() { }, stroke() { }, fill() { }, arc() { }, rect() { },
    save() { }, restore() { }, translate() { }, scale() { }, rotate() { }, setTransform() { },
  };
}
