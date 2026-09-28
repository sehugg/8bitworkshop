"use strict";
// Atari 2600 (VCS) Machine, built from the Javatari core
// (javatari.js/release/core/javatari-core.js, built with `grunt core`).
//
// The components are assembled here without Javatari's AtariConsole or its
// room/DOM layer, so the machine runs headlessly like the other src/machine/*
// Machines. Tia.frame(trap) asks the trap before every CPU clock, so a step is
// one CPU clock and MachineCore can stop, rewind and replay at any cycle.
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavatariMachine = exports.VCS_RANDOM_SEED = exports.VCS_SAMPLE_RATE = exports.VCS_KEYCODE_MAP = void 0;
const emu_1 = require("../common/emu");
const devices_1 = require("../common/devices");
// resolved through the package's "imports" map so the same specifier works in
// the source tree, the compiled test tree (gen/src/machine) and the bundle
const { jt } = require('#javatari-core');
// store savestate arrays as plain copies, not deflated base64 strings
jt.Util.rawStates = true;
jt.Util.log = () => { };
// ConsoleControls ids
const C = jt.ConsoleControls;
exports.VCS_KEYCODE_MAP = (0, emu_1.makeKeycodeMap)([
    [emu_1.Keys.UP, 0, C.JOY0_UP],
    [emu_1.Keys.DOWN, 0, C.JOY0_DOWN],
    [emu_1.Keys.LEFT, 0, C.JOY0_LEFT],
    [emu_1.Keys.RIGHT, 0, C.JOY0_RIGHT],
    [emu_1.Keys.A, 0, C.JOY0_BUTTON],
    [emu_1.Keys.P2_UP, 0, C.JOY1_UP],
    [emu_1.Keys.P2_DOWN, 0, C.JOY1_DOWN],
    [emu_1.Keys.P2_LEFT, 0, C.JOY1_LEFT],
    [emu_1.Keys.P2_RIGHT, 0, C.JOY1_RIGHT],
    [emu_1.Keys.P2_A, 0, C.JOY1_BUTTON],
    // console switches, on Javatari's keys
    [emu_1.Keys.VK_F2, 0, C.BLACK_WHITE],
    [emu_1.Keys.VK_F4, 0, C.DIFFICULTY0],
    [emu_1.Keys.VK_F9, 0, C.DIFFICULTY1],
    [emu_1.Keys.VK_F11, 0, C.SELECT],
    [emu_1.Keys.VK_F12, 0, C.RESET],
]);
// NTSC frame: 262 lines, synced within Javatari's Monitor tolerances
const NTSC = jt.VideoStandard.NTSC;
const LINE_WIDTH = NTSC.totalWidth; // 228 TIA clocks
const HBLANK = 68;
const VISIBLE_WIDTH = LINE_WIDTH - HBLANK; // 160
const VISIBLE_ORIGIN_Y = Math.floor(NTSC.defaultOriginYPct / 100 * NTSC.totalHeight);
const VISIBLE_HEIGHT = Math.floor(NTSC.defaultHeightPct / 100 * NTSC.totalHeight);
const MIN_LINES_TO_SYNC = NTSC.totalHeight - 16;
const MAX_LINES_TO_SYNC = NTSC.totalHeight + 16 + 5;
exports.VCS_SAMPLE_RATE = 31440; // TIA audio clock, 2 pulses per line
const AUDIO_VOLUME = 0.4;
/**
 * The core draws a random number when a component is created: the 128 bytes of
 * RAM, the PIA's INTIM (which some games read to seed their own PRNG), the bus's
 * open-bus register and the tape cartridges' delay-line seeds. Real hardware
 * does come up with whatever is in the RAM, but a machine that can be replayed
 * is worth more here than one that is faithful, so the draw is seeded. Pass a
 * different seed to get a different power-on state.
 */
exports.VCS_RANDOM_SEED = 0x26001977;
/** A seeded generator, so power-on noise is the same on every run. */
function newRandom(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// Cartridge addresses (masked to 0xfff) whose reads may switch banks or
// clock a coprocessor. readConst() puts the cartridge back after reading them.
function isCartHotspot(format, a) {
    a &= 0xfff;
    if (a >= 0xfe0 && a <= 0xffb)
        return true;
    // DPC and FA2 registers, AR write latch
    return a < 0x100 && (format == 'DPC' || format == 'FA2' || format == 'FA2cu' || format == 'AR');
}
class JavatariMachine {
    constructor(seed = exports.VCS_RANDOM_SEED) {
        this.seed = seed;
        this.cpuCyclesPerLine = 76;
        this.cpuFrequency = 1193182;
        this.numTotalScanlines = NTSC.totalHeight;
        this.cart = null;
        this.cpu = {
            getPC: () => this.m6502.getPC(),
            getSP: () => this.m6502.getSP(),
            // a WSYNC halt stops the CPU with T=0 for the rest of the line
            isStable: () => this.m6502.isStable() && this.m6502.isRDY(),
            reset: () => this.reset(),
            saveState: () => this.m6502.saveState(),
            loadState: (s) => this.m6502.loadState(s),
            // the bus is wired up in the constructor, so there is nothing to connect
            connectMemoryBus: () => { },
        };
        this.probe = new devices_1.NullProbe();
        this.probing = false;
        this.line = 0; // scanline within the frame, from the last vsync
        /**
         * A 2600 port takes a joystick or a pair of paddles, never both, and the
         * core aliases the paddle triggers onto the joystick directions: PADDLE0_BUTTON
         * falls through to JOY0_RIGHT and PADDLE1_BUTTON to JOY0_LEFT. The platform
         * polls the paddles every frame, so a declared setPaddleButton() would
         * release a held direction every frame. The only safe answer is to keep the
         * paddles switched off until something asks for them.
         */
        this.paddlesConnected = false;
        /**
         * The joystick and switch positions live in the PIA and TIA states, so they
         * rewind with everything else; these record which controls are held, for
         * hosts that save and restore the input on their own.
         */
        this.controlsDown = new Set();
        this.seeded(() => {
            this.m6502 = new jt.M6502();
            this.pia = new jt.Pia();
            this.tia = new jt.Tia(this.m6502, this.pia);
            this.ram = new jt.Ram();
            this.bus = new jt.Bus(this.m6502, this.tia, this.pia, this.ram);
        });
        const video = this.tia.getVideoOutput();
        video.connectMonitor({
            nextLine: (pixels, vsync) => this.nextLine(pixels, vsync),
            refresh: () => { },
            setVideoStandard: () => { },
            videoSignalOff: () => { },
            showOSD: () => { },
        });
        const tiaAudio = this.tia.getAudioOutput();
        tiaAudio.connectAudioSocket({
            connectAudioSignal: () => { },
            disconnectAudioSignal: () => { },
            // always take the sample: the DPC cartridge's audio is clocked by it
            audioClockPulse: () => {
                const s = tiaAudio.nextSample() * AUDIO_VOLUME;
                if (this.audio)
                    this.audio.feedSample(s, 1);
            },
        });
        this.tia.setVideoStandard(NTSC);
        this.m6502.onHalt = (pc) => {
            throw new emu_1.EmuHalt(`CPU halted at $${pc.toString(16)}`);
        };
        this.probeBus();
    }
    /**
     * Run `body` with the core drawing its power-on noise from this machine's
     * seed. The core's generator is global to it, so it is only swapped for the
     * duration: two machines built in the same process must not share a stream.
     */
    seeded(body) {
        const outer = jt.Util.random;
        jt.Util.random = newRandom(this.seed);
        try {
            body();
        }
        finally {
            jt.Util.random = outer;
        }
    }
    loadROM(data, title) {
        // MD5 of the ROM wants a plain Array
        const rom = new jt.ROM(title || 'rom', Array.from(data));
        // the tape cartridges draw their delay-line seeds as well
        this.seeded(() => {
            this.insertCartridge(jt.CartridgeCreator.createCartridgeFromRom(rom));
        });
        this.reset();
    }
    insertCartridge(cart) {
        this.cart = cart;
        this.bus.setCartridge(cart);
        this.tia.getAudioOutput().cartridgeInserted(cart);
    }
    getCartridgeFormat() {
        var _a;
        return (_a = this.cart) === null || _a === void 0 ? void 0 : _a.format.name;
    }
    reset() {
        this.bus.powerOn();
        this.line = 0;
    }
    // VIDEO
    getVideoParams() {
        // a 2600's picture is 4:3 whatever the pixel grid happens to be -- with
        // overscan showing 223 lines, the pixels are about 1.86:1, so the ratio
        // has to be stated rather than derived from the width and height
        return { width: VISIBLE_WIDTH, height: VISIBLE_HEIGHT, aspect: 4 / 3, overscan: true };
    }
    connectVideo(pixels) {
        this.pixels = pixels;
    }
    // Monitor.nextLine(): returns true to end the frame
    nextLine(linePixels, vsync) {
        const y = this.line - VISIBLE_ORIGIN_Y;
        if (this.pixels && y >= 0 && y < VISIBLE_HEIGHT) {
            this.pixels.set(linePixels.subarray(HBLANK, LINE_WIDTH), y * VISIBLE_WIDTH);
        }
        this.line++;
        this.probe.logNewScanline();
        if ((vsync && this.line >= MIN_LINES_TO_SYNC) || this.line > MAX_LINES_TO_SYNC) {
            this.line = 0;
            return true;
        }
        return false;
    }
    getRasterY() { return this.line; }
    getRasterX() { return this.tia.getCPUClockInLine(); }
    // AUDIO
    getAudioParams() {
        return { sampleRate: exports.VCS_SAMPLE_RATE, stereo: false };
    }
    connectAudio(audio) {
        this.audio = audio;
    }
    // EXECUTION
    advanceFrame(trap) {
        this.probe.logNewFrame();
        let steps = 0;
        if (this.probing) {
            // log each CPU clock, and the instruction boundaries
            this.tia.frame(() => {
                if (trap && trap())
                    return true;
                if (this.cpu.isStable())
                    this.probe.logExecute(this.cpu.getPC(), this.cpu.getSP());
                this.probe.logClocks(1);
                steps++;
                return false;
            });
        }
        else if (trap) {
            this.tia.frame(() => {
                if (trap())
                    return true;
                steps++;
                return false;
            });
        }
        else {
            this.tia.frame(); // the fast path, which doesn't count steps
        }
        return steps;
    }
    // MEMORY
    read(a) {
        return this.bus.read(a & 0x1fff);
    }
    write(a, v) {
        this.bus.write(a & 0x1fff, v);
    }
    // no side effects: skips PIA reads, and undoes bank switches
    readConst(a) {
        a &= 0x1fff;
        if (a & 0x1000) {
            if (!this.cart)
                return 0;
            if (isCartHotspot(this.cart.format.name, a)) {
                const s = this.cart.saveState();
                const v = this.cart.read(a);
                this.cart.loadState(s);
                return v;
            }
            return this.cart.read(a);
        }
        if ((a & 0x280) === 0x80)
            return this.ram.read(a);
        return 0; // TIA and PIA
    }
    // wraps the CPU's view of the bus, so the probe sees its accesses
    probeBus() {
        const bus = this.bus;
        const read = bus.read, write = bus.write;
        const isIO = (a) => (a & 0x1080) === 0 || (a & 0x1280) === 0x280;
        const probed = {
            read: (a) => {
                const v = read(a);
                if (isIO(a))
                    this.probe.logIORead(a, v);
                else
                    this.probe.logRead(a, v);
                return v;
            },
            write: (a, v) => {
                if (isIO(a)) {
                    this.probe.logIOWrite(a, v);
                    if ((a & 0x3f) === 0x02)
                        this.probe.logWait(a); // WSYNC
                }
                else
                    this.probe.logWrite(a, v);
                write(a, v);
            },
        };
        this.setProbedBus = (on) => {
            // the CPU and cartridges call bus.read/bus.write through the bus object
            bus.read = on ? probed.read : read;
            bus.write = on ? probed.write : write;
        };
    }
    connectProbe(probe) {
        this.probe = probe || new devices_1.NullProbe();
        this.probing = !!probe;
        this.setProbedBus(this.probing);
    }
    // INPUT
    setKeyInput(key, code, flags) {
        const o = exports.VCS_KEYCODE_MAP[key];
        if (o && (flags & (emu_1.KeyFlags.KeyDown | emu_1.KeyFlags.KeyUp)))
            this.setControl(o.mask, !!(flags & emu_1.KeyFlags.KeyDown));
    }
    setControl(control, pressed) {
        this.pia.controlStateChanged(control, pressed);
        this.tia.controlStateChanged(control, pressed);
        if (pressed)
            this.controlsDown.add(control);
        else
            this.controlsDown.delete(control);
    }
    setPaddlesConnected(connected) {
        if (connected === this.paddlesConnected)
            return;
        this.paddlesConnected = connected;
        // the core's own "disconnected" value, so the POTs stop charging. The
        // trigger bits are left alone: they are the joystick's bits too.
        if (!connected) {
            this.tia.controlValueChanged(C.PADDLE0_POSITION, -1);
            this.tia.controlValueChanged(C.PADDLE1_POSITION, -1);
        }
    }
    setPaddleInput(port, value) {
        if (!this.paddlesConnected)
            return;
        if (!isFinite(value))
            return; // the headless video has no mouse to track
        // 8bitworkshop hands a paddle over as 0 (far left) to 255 (far right); the
        // core counts the charge the other way, 380 (left) to 0 (right)
        this.tia.controlValueChanged(port === 0 ? C.PADDLE0_POSITION : C.PADDLE1_POSITION, 380 - Math.round(value * 380 / 255));
    }
    setPaddleButton(port, pressed) {
        if (!this.paddlesConnected)
            return;
        this.setControl(port === 0 ? C.PADDLE0_BUTTON : C.PADDLE1_BUTTON, pressed);
    }
    saveControlsState() {
        return Array.from(this.controlsDown);
    }
    loadControlsState(controls) {
        this.controlsDown = new Set(controls || []);
    }
    // STATE
    saveState() {
        return {
            c: this.m6502.saveState(),
            p: this.pia.saveState(),
            t: this.tia.saveState(),
            r: this.ram.saveState(),
            b: this.bus.saveState(),
            ca: this.cart && this.cart.saveState(),
            line: this.line,
        };
    }
    loadState(s) {
        if (s.ca && (!this.cart || this.cart.format.name != s.ca.f)) {
            this.seeded(() => {
                this.insertCartridge(jt.CartridgeCreator.recreateCartridgeFromSaveState(s.ca, this.cart));
            });
        }
        this.m6502.loadState(s.c);
        this.pia.loadState(s.p);
        this.tia.loadState(s.t);
        this.ram.loadState(s.r);
        this.bus.loadState(s.b);
        if (this.cart && s.ca)
            this.cart.loadState(s.ca);
        this.line = s.line;
    }
}
exports.JavatariMachine = JavatariMachine;
//# sourceMappingURL=vcs.js.map