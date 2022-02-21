
import { hasAudio, hasSerialIO, hasVideo, Machine } from "../common/baseplatform";
import { SampledAudioSink, SerialIOInterface } from "../common/devices";

global.atob = require('atob');
global.btoa = require('btoa');

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

async function loadMachine(modname: string, clsname: string): Promise<Machine> {
    var mod = await import('../machine/' + modname);
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
