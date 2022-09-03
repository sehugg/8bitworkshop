"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicScanlineMachine = exports.BasicMachine = exports.BasicHeadlessMachine = exports.NullProbe = void 0;
class NullProbe {
    logClocks() { }
    logNewScanline() { }
    logNewFrame() { }
    logExecute() { }
    logInterrupt() { }
    logRead() { }
    logWrite() { }
    logIORead() { }
    logIOWrite() { }
    logVRAMRead() { }
    logVRAMWrite() { }
    logIllegal() { }
    logWait() { }
    logDMARead() { }
    logDMAWrite() { }
    logData() { }
    addLogBuffer(src) { }
}
exports.NullProbe = NullProbe;
class BasicHeadlessMachine {
    constructor() {
        this.inputs = new Uint8Array(32);
        this.nullProbe = new NullProbe();
        this.probe = this.nullProbe;
    }
    setKeyInput(key, code, flags) {
        this.handler && this.handler(key, code, flags);
    }
    connectProbe(probe) {
        this.probe = probe || this.nullProbe;
    }
    reset() {
        this.cpu.reset();
    }
    loadROM(data, title) {
        if (!this.rom)
            this.rom = new Uint8Array(this.defaultROMSize);
        this.rom.set(data);
    }
    loadState(state) {
        this.cpu.loadState(state.c);
        this.ram.set(state.ram);
        this.inputs.set(state.inputs);
    }
    saveState() {
        return {
            c: this.cpu.saveState(),
            ram: this.ram.slice(0),
            inputs: this.inputs.slice(0),
        };
    }
    loadControlsState(state) {
        this.inputs.set(state.inputs);
    }
    saveControlsState() {
        return {
            inputs: this.inputs.slice(0)
        };
    }
    advanceCPU() {
        var c = this.cpu;
        var n = 1;
        if (this.cpu.isStable()) {
            this.probe.logExecute(this.cpu.getPC(), this.cpu.getSP());
        }
        if (c.advanceClock) {
            c.advanceClock();
        }
        else if (c.advanceInsn) {
            n = c.advanceInsn(1);
        }
        this.probe.logClocks(n);
        return n;
    }
    probeMemoryBus(membus) {
        return {
            read: (a) => {
                let val = membus.read(a);
                this.probe.logRead(a, val);
                return val;
            },
            write: (a, v) => {
                this.probe.logWrite(a, v);
                membus.write(a, v);
            }
        };
    }
    connectCPUMemoryBus(membus) {
        this.cpu.connectMemoryBus(this.probeMemoryBus(membus));
    }
    probeIOBus(iobus) {
        return {
            read: (a) => {
                let val = iobus.read(a);
                this.probe.logIORead(a, val);
                return val;
            },
            write: (a, v) => {
                this.probe.logIOWrite(a, v);
                iobus.write(a, v);
            }
        };
    }
    probeDMABus(iobus) {
        return {
            read: (a) => {
                let val = iobus.read(a);
                this.probe.logDMARead(a, val);
                return val;
            },
            write: (a, v) => {
                this.probe.logDMAWrite(a, v);
                iobus.write(a, v);
            }
        };
    }
    connectCPUIOBus(iobus) {
        this.cpu['connectIOBus'](this.probeIOBus(iobus));
    }
}
exports.BasicHeadlessMachine = BasicHeadlessMachine;
class BasicMachine extends BasicHeadlessMachine {
    constructor() {
        super(...arguments);
        this.overscan = false;
        this.rotate = 0;
    }
    getAudioParams() {
        return { sampleRate: this.sampleRate, stereo: false };
    }
    connectAudio(audio) {
        this.audio = audio;
    }
    getVideoParams() {
        return { width: this.canvasWidth,
            height: this.numVisibleScanlines,
            aspect: this.aspectRatio,
            overscan: this.overscan,
            rotate: this.rotate };
    }
    connectVideo(pixels) {
        this.pixels = pixels;
    }
}
exports.BasicMachine = BasicMachine;
class BasicScanlineMachine extends BasicMachine {
    advanceFrame(trap) {
        this.preFrame();
        var endLineClock = 0;
        var steps = 0;
        this.probe.logNewFrame();
        this.frameCycles = 0;
        for (var sl = 0; sl < this.numTotalScanlines; sl++) {
            endLineClock += this.cpuCyclesPerLine; // could be fractional
            this.scanline = sl;
            this.startScanline();
            while (this.frameCycles < endLineClock) {
                if (trap && trap()) {
                    sl = 999;
                    break;
                }
                this.frameCycles += this.advanceCPU();
                steps++;
            }
            this.drawScanline();
            this.probe.logNewScanline();
            this.probe.logClocks(Math.floor(this.frameCycles - endLineClock)); // remainder of prev. line
        }
        this.postFrame();
        return steps; // TODO: return steps, not clock? for recorder
    }
    preFrame() { }
    postFrame() { }
    getRasterY() { return this.scanline; }
    getRasterX() { return this.frameCycles % this.cpuCyclesPerLine; }
}
exports.BasicScanlineMachine = BasicScanlineMachine;
//# sourceMappingURL=devices.js.map