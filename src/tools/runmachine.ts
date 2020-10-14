
import { hasAudio, hasVideo, Machine } from "../common/baseplatform";
import { SampledAudioSink } from "../common/devices";

class NullAudio implements SampledAudioSink {
    feedSample(value: number, count: number): void {
    }    
}

class MachineRunner {
    machine: Machine;
    pixels: Uint32Array;

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
        this.machine.reset();
    }
    run() {
        this.machine.advanceFrame(null);
    }
}

async function loadMachine(modname: string, clsname: string) : Promise<Machine> {
    var mod = await import('../machine/'+modname);
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

global.atob = require('atob');
global.btoa = require('btoa');
runMachine();

