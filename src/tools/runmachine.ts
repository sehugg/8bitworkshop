
import { hasAudio, hasSerialIO, hasVideo, Machine, Platform } from "../common/baseplatform";
import { SampledAudioSink, SerialIOInterface } from "../common/devices";
import { PLATFORMS } from "../common/emu";
import * as emu from "../common/emu";
import { getRootBasePlatform } from "../common/util";

global.atob = require('atob');
global.btoa = require('btoa');
if (typeof window === 'undefined') {
    (global as any).window = global;
    (global as any).window.addEventListener = (global as any).window.addEventListener || function () { };
    (global as any).window.removeEventListener = (global as any).window.removeEventListener || function () { };
    (global as any).document = (global as any).document || { addEventListener() { }, removeEventListener() { } };
}
try { (global as any).navigator = (global as any).navigator || {}; } catch (e) { }

class NullAudio implements SampledAudioSink {
    feedSample(value: number, count: number): void {
    }
}

// TODO: merge with platform
class SerialTestHarness implements SerialIOInterface {

    bufferedRead: boolean = true;
    cyclesPerByte = 1000000 / (57600 / 8); // 138.88888 cycles
    maxOutputBytes = 4096;
    inputBytes: Uint8Array;

    outputBytes: number[];
    inputIndex: number;
    clk: number;
    bufin: string;

    clearToSend(): boolean {
        return this.outputBytes.length < this.maxOutputBytes;
    }
    sendByte(b: number) {
        if (this.clearToSend()) {
            this.outputBytes.push(b);
        }
    }
    byteAvailable(): boolean {
        return this.readIndex() > this.inputIndex;
    }
    recvByte(): number {
        var index = this.readIndex();
        this.inputIndex = index;
        var b = this.inputBytes[index] | 0;
        return b;
    }
    readIndex(): number {
        return this.bufferedRead ? (this.inputIndex + 1) : Math.floor(this.clk / this.cyclesPerByte);
    }

    reset() {
        this.inputIndex = -1;
        this.clk = 0;
        this.outputBytes = [];
        this.bufin = '';
    }

    advance(clocks: number) {
        this.clk += clocks;
    }
}

///

// Headless mock for RasterVideo/VectorVideo (used by Platform.start() in Node)
// Patches the emu module exports so that platform modules pick up the mock.
function installHeadlessVideo() {
    var lastPixels: Uint32Array | null = null;
    var lastVideoParams: { width: number; height: number } | null = null;
    (emu as any).RasterVideo = function (_mainElement: any, width: number, height: number, _options?: any) {
        var buffer = new ArrayBuffer(width * height * 4);
        var datau8 = new Uint8Array(buffer);
        var datau32 = new Uint32Array(buffer);
        lastVideoParams = { width, height };
        lastPixels = datau32;
        this.create = function () { this.width = width; this.height = height; };
        this.setKeyboardEvents = function () { };
        this.getFrameData = function () { return datau32; };
        this.getImageData = function () { return { data: datau8, width, height }; };
        this.updateFrame = function () { };
        this.clearRect = function () { };
        this.setupMouseEvents = function () { };
        this.canvas = this;
        this.getContext = function () { return this; };
        this.fillRect = function () { };
        this.fillStyle = '';
        this.putImageData = function () { };
    };
    (emu as any).VectorVideo = function (_mainElement: any, _width: number, _height: number, _options?: any) {
        this.create = function () { this.drawops = 0; };
        this.setKeyboardEvents = function () { };
        this.clear = function () { };
        this.drawLine = function () { this.drawops++; };
    };
    // Also mock AnimationTimer to be a no-op in headless mode
    (emu as any).AnimationTimer = function (_fps: number, _callback: any) {
        this.running = false;
        this.start = function () { };
        this.stop = function () { };
        this.isRunning = function () { return this.running; };
    };
    return { getPixels: () => lastPixels, getVideoParams: () => lastVideoParams };
}

///

export class PlatformRunner {
    platform: Platform;
    private headless: ReturnType<typeof installHeadlessVideo>;

    constructor(platform: Platform) {
        this.platform = platform;
        this.headless = installHeadlessVideo();
    }
    async start() {
        await this.platform.start();
    }
    loadROM(title: string, data: Uint8Array) {
        this.platform.loadROM(title, data);
    }
    run() {
        // nextFrame() is on BaseDebugPlatform, not the Platform interface
        if ((this.platform as any).nextFrame) {
            (this.platform as any).nextFrame();
        } else if (this.platform.advance) {
            this.platform.advance(false);
        }
    }
    get pixels(): Uint32Array | null {
        return this.headless.getPixels();
    }
    get videoParams(): { width: number; height: number } | null {
        return this.headless.getVideoParams();
    }
}

export async function loadPlatform(platformId: string): Promise<Platform> {
    // Derive the base module name (e.g. "nes" from "nes-asm", "c64" from "c64.wasm")
    var baseId = getRootBasePlatform(platformId);
    // Dynamically load the platform module which registers into PLATFORMS
    await import('../platform/' + baseId);
    var PlatformClass = PLATFORMS[platformId];
    if (!PlatformClass) {
        // Try the base platform ID
        PlatformClass = PLATFORMS[baseId];
    }
    if (!PlatformClass) {
        var available = Object.keys(PLATFORMS).join(', ');
        throw new Error(`Platform '${platformId}' not found. Available: ${available}`);
    }
    var platform = new PlatformClass(null);
    return platform;
}

///

export class MachineRunner {
    machine: Machine;
    pixels: Uint32Array;
    serial: SerialTestHarness;

    constructor(machine: Machine) {
        this.machine = machine;
    }
    setup() {
        if (hasVideo(this.machine)) {
            var vid = this.machine.getVideoParams();
            this.pixels = new Uint32Array(vid.width * vid.height);
            this.machine.connectVideo(this.pixels);
        }
        if (hasAudio(this.machine)) {
            this.machine.connectAudio(new NullAudio());
        }
        if (hasSerialIO(this.machine)) {
            this.serial = new SerialTestHarness();
            this.machine.connectSerialIO(this.serial);
        }
        this.machine.reset();
    }
    run() {
        this.machine.advanceFrame(null);
    }
}

export async function loadMachine(modname: string, clsname: string, ...ctorArgs: any[]): Promise<Machine> {
    var mod = await import('../machine/' + modname);
    var cls = mod[clsname];
    if (!cls) {
        throw new Error(`Class '${clsname}' not found in module '../machine/${modname}'`);
    }
    var machine = new cls(...ctorArgs);
    return machine;
}

async function runMachine() {
    var machine = await loadMachine(process.argv[2], process.argv[3]);
    var runner = new MachineRunner(machine);
    runner.setup();
    runner.run();
    console.log(runner.machine.saveState());
}

if (require.main === module) {
    runMachine();
}
