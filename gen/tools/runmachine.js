"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
exports.MachineRunner = void 0;
const baseplatform_1 = require("../common/baseplatform");
global.atob = require('atob');
global.btoa = require('btoa');
class NullAudio {
    feedSample(value, count) {
    }
}
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
            this.machine.connectAudio(new NullAudio());
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
async function loadMachine(modname, clsname) {
    var mod = await Promise.resolve().then(() => __importStar(require('../machine/' + modname)));
    var cls = mod[clsname];
    var machine = new cls();
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