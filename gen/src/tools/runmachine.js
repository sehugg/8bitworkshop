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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MachineRunner = exports.PlatformRunner = void 0;
exports.loadPlatform = loadPlatform;
exports.loadMachine = loadMachine;
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const emu = __importStar(require("../common/emu"));
const util_1 = require("../common/util");
const nodemock_1 = require("./nodemock");
// TODO: merge with platform
class SerialTestHarness {
    constructor() {
        this.bufferedRead = true;
        this.cyclesPerByte = 1000000 / (57600 / 8); // 138.88888 cycles
        this.maxOutputBytes = 4096;
    }
    clearToSend() {
        return this.outputBytes.length < this.maxOutputBytes;
    }
    sendByte(b) {
        if (this.clearToSend()) {
            this.outputBytes.push(b);
        }
    }
    byteAvailable() {
        return this.readIndex() > this.inputIndex;
    }
    recvByte() {
        var index = this.readIndex();
        this.inputIndex = index;
        var b = this.inputBytes[index] | 0;
        return b;
    }
    readIndex() {
        return this.bufferedRead ? (this.inputIndex + 1) : Math.floor(this.clk / this.cyclesPerByte);
    }
    reset() {
        this.inputIndex = -1;
        this.clk = 0;
        this.outputBytes = [];
        this.bufin = '';
    }
    advance(clocks) {
        this.clk += clocks;
    }
}
///
// Headless mock for RasterVideo/VectorVideo (used by Platform.start() in Node)
// Patches the emu module exports so that platform modules pick up the mock.
function installHeadlessVideo() {
    var lastPixels = null;
    var lastVideoParams = null;
    emu.RasterVideo = function (_mainElement, width, height, _options) {
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
        this.style = {};
    };
    emu.VectorVideo = function (_mainElement, _width, _height, _options) {
        this.create = function () { this.drawops = 0; };
        this.setKeyboardEvents = function () { };
        this.clear = function () { };
        this.drawLine = function () { this.drawops++; };
    };
    // Also mock AnimationTimer to be a no-op in headless mode
    emu.AnimationTimer = function (_fps, _callback) {
        this.running = false;
        this.start = function () { };
        this.stop = function () { };
        this.isRunning = function () { return this.running; };
    };
    return { getPixels: () => lastPixels, getVideoParams: () => lastVideoParams };
}
///
class PlatformRunner {
    constructor(platform) {
        (0, nodemock_1.mockGlobals)();
        (0, nodemock_1.mockAudio)();
        (0, nodemock_1.mockFetch)();
        (0, nodemock_1.mockDOM)();
        this.platform = platform;
        this.headless = installHeadlessVideo();
    }
    async start() {
        await this.platform.start();
    }
    loadROM(title, data) {
        this.platform.loadROM(title, data);
    }
    run() {
        // nextFrame() is on BaseDebugPlatform, not the Platform interface
        if (this.platform.nextFrame) {
            this.platform.nextFrame();
        }
        else if (this.platform.advance) {
            this.platform.advance(false);
        }
    }
    get pixels() {
        return this.headless.getPixels();
    }
    get videoParams() {
        return this.headless.getVideoParams();
    }
}
exports.PlatformRunner = PlatformRunner;
async function loadPlatform(platformId) {
    // Derive the base module name (e.g. "nes" from "nes-asm", "c64" from "c64.wasm")
    var baseId = (0, util_1.getRootBasePlatform)(platformId);
    // Dynamically load the platform module which registers into PLATFORMS
    await Promise.resolve(`${'../platform/' + baseId}`).then(s => __importStar(require(s)));
    var PlatformClass = emu_1.PLATFORMS[platformId];
    if (!PlatformClass) {
        // Try the base platform ID
        PlatformClass = emu_1.PLATFORMS[baseId];
    }
    if (!PlatformClass) {
        var available = Object.keys(emu_1.PLATFORMS).join(', ');
        throw new Error(`Platform '${platformId}' not found. Available: ${available}`);
    }
    var platform = new PlatformClass(null);
    return platform;
}
///
class MachineRunner {
    constructor(machine) {
        this.machine = machine;
    }
    setup() {
        if ((0, baseplatform_1.hasVideo)(this.machine)) {
            var vid = this.machine.getVideoParams();
            this.pixels = new Uint32Array(vid.width * vid.height);
            this.machine.connectVideo(this.pixels);
        }
        if ((0, baseplatform_1.hasAudio)(this.machine)) {
            this.machine.connectAudio(new nodemock_1.NullAudio());
        }
        if ((0, baseplatform_1.hasSerialIO)(this.machine)) {
            this.serial = new SerialTestHarness();
            this.machine.connectSerialIO(this.serial);
        }
        this.machine.reset();
    }
    run() {
        this.machine.advanceFrame(null);
    }
}
exports.MachineRunner = MachineRunner;
async function loadMachine(modname, clsname, ...ctorArgs) {
    var mod = await Promise.resolve(`${'../machine/' + modname}`).then(s => __importStar(require(s)));
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
//# sourceMappingURL=runmachine.js.map