"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const util_1 = require("../common/util");
const analysis_1 = require("../common/analysis");
const disasm6502_1 = require("../common/cpu/disasm6502");
const probe_1 = require("../common/probe");
const devices_1 = require("../common/devices");
const mameplatform_1 = require("../common/mameplatform");
const VCS_PRESETS = [
    { id: 'examples/hello.a', chapter: 4, name: 'Hello 6502 and TIA' },
    { id: 'examples/vsync.a', chapter: 5, name: 'Painting on the CRT', title: 'Color Bars' },
    { id: 'examples/playfield.a', chapter: 6, name: 'Playfield Graphics' },
    { id: 'examples/sprite.a', chapter: 7, name: 'Players and Sprites' },
    { id: 'examples/colorsprites.a', chapter: 8, name: 'Color Sprites' },
    { id: 'examples/timing2.a', chapter: 9, name: 'Fine Positioning', title: 'Fine Position' },
    { id: 'examples/missiles.a', chapter: 10, name: 'Player/Missile Graphics', title: 'Player/Missile' },
    { id: 'examples/sethorizpos.a', chapter: 11, name: 'SetHorizPos Routine' },
    { id: 'examples/piatimer.a', chapter: 12, name: 'PIA Timer' },
    { id: 'examples/controls.a', chapter: 13, name: 'Joysticks' },
    { id: 'examples/complexscene.a', chapter: 15, name: 'Complex Scene I' },
    { id: 'examples/complexscene2.a', chapter: 16, name: 'Complex Scene II' },
    { id: 'examples/scoreboard.a', chapter: 18, name: 'Scoreboard' },
    { id: 'examples/collisions.a', chapter: 19, name: 'Collisions' },
    { id: 'examples/bitmap.a', chapter: 20, name: 'Async Playfield: Bitmap', title: 'Async PF Bitmap' },
    { id: 'examples/brickgame.a', chapter: 21, name: 'Async Playfield: Bricks', title: 'Async PF Bricks' },
    //  {id:'examples/multisprite1.a', chapter:8, name:'Sprite Kernel'},
    { id: 'examples/bigsprite.a', chapter: 22, name: 'A Big 48-Pixel Sprite', title: '48-Pixel Sprite' },
    { id: 'examples/tinyfonts2.a', chapter: 23, name: 'Tiny Text' },
    { id: 'examples/score6.a', chapter: 24, name: '6-Digit Score' },
    { id: 'examples/retrigger.a', chapter: 26, name: 'Sprite Formations' },
    //  {id:'examples/tinyfonts.a', chapter:23, name:'Tiny Fonts, Slow'},
    { id: 'examples/multisprite3.a', chapter: 28, name: 'Multisprites' },
    { id: 'examples/procgen1.a', chapter: 30, name: 'Procedural Generation' },
    { id: 'examples/lines.a', chapter: 31, name: 'Drawing Lines' },
    //  {id:'examples/piatable.a', name:'Timer Table'},
    { id: 'examples/musicplayer.a', chapter: 32, name: 'Music Player' },
    { id: 'examples/road.a', chapter: 33, name: 'Pseudo 3D Road' },
    { id: 'examples/bankswitching.a', chapter: 35, name: 'Bankswitching' },
    { id: 'examples/wavetable.a', chapter: 36, name: 'Wavetable Sound' },
    { id: 'examples/fracpitch.a', name: 'Fractional Pitch' },
    { id: 'examples/pal.a', name: 'PAL Video Output' },
    //  {id:'examples/testlibrary.a', name:'VCS Library Demo'},
    //  {id:'examples/music2.a', name:'Pitch-Accurate Music'},
    //  {id:'examples/fullgame.a', name:'Thru Hike: The Game', title:'Thru Hike'},
    { id: 'bb/helloworld.bas', name: 'Hello World (batariBASIC)' },
    { id: 'bb/draw.bas', name: 'Playfield Draw (batariBASIC)' },
    { id: 'bb/sample.bas', name: 'Sprite Test (batariBASIC)' },
    { id: 'bb/FIFA1977.bas', name: '2P Soccer Game (batariBASIC)' },
    { id: 'bb/duck_chase.bas', name: 'Duck Chase (batariBASIC)' },
    { id: 'wiz/finalduck.wiz', name: 'Final Duck (Wiz)' },
    //  {id:'bb/rblast106.bas', name:'Road Blasters (batariBASIC)'},
];
function getToolForFilename_vcs(fn) {
    if (fn.endsWith(".wiz"))
        return "wiz";
    if (fn.endsWith(".bb") || fn.endsWith(".bas"))
        return "bataribasic";
    if (fn.endsWith(".ca65"))
        return "ca65";
    if (fn.endsWith(".ecs"))
        return "ecs";
    return "dasm";
}
class VCSPlatform extends baseplatform_1.BasePlatform {
    constructor() {
        super(...arguments);
        // TODO: super hack for ProbeBitmap view
        this.machine = {
            cpuCyclesPerLine: 76 // NTSC
        };
        this.getToolForFilename = getToolForFilename_vcs;
        this.getMemoryMap = function () {
            return { main: [
                    { name: 'TIA Registers', start: 0x00, size: 0x80, type: 'io' },
                    { name: 'PIA RAM', start: 0x80, size: 0x80, type: 'ram' },
                    { name: 'PIA Ports and Timer', start: 0x280, size: 0x18, type: 'io' },
                    { name: 'Cartridge ROM', start: 0xf000, size: 0x1000, type: 'rom' },
                ] };
        };
        // probing
        this.nullProbe = new devices_1.NullProbe();
        this.probe = this.nullProbe;
    }
    getPresets() { return VCS_PRESETS; }
    async start() {
        var self = this;
        // load Javatari and configure settings
        await (0, util_1.loadScript)("javatari/javatari.js");
        Javatari.AUTO_START = false;
        Javatari.SHOW_ERRORS = false;
        Javatari.CARTRIDGE_CHANGE_DISABLED = true;
        Javatari.DEBUG_SCANLINE_OVERFLOW = false; // TODO: integrate into probe API
        Javatari.AUDIO_BUFFER_SIZE = 256;
        // show console div and start
        $("#javatari-div").show();
        Javatari.start();
        var console = Javatari.room.console;
        // intercept clockPulse function
        console.oldClockPulse = console.clockPulse;
        console.clockPulse = function () {
            self.updateRecorder();
            self.probe.logNewFrame();
            this.oldClockPulse();
            // look for KIL instruction
            if (Javatari.room.console.getCPUState().o == 0x02 && Javatari.room.console.onBreakpointHit != null) {
                Javatari.room.console.onBreakpointHit(Javatari.room.console.saveState());
                //throw new EmuHalt("CPU STOPPED"); // TODO: requires browser reload
            }
        };
        // intercept TIA end of line
        var videoSignal = console.tia.getVideoOutput();
        videoSignal.oldNextLine = videoSignal.nextLine;
        videoSignal.nextLine = function (pixels, vsync) {
            self.probe.logNewScanline();
            return this.oldNextLine(pixels, vsync);
        };
        // resize after added to dom tree
        var jacanvas = $("#javatari-screen").find("canvas");
        const resizeObserver = new ResizeObserver(entries => {
            this.resize();
        });
        resizeObserver.observe(jacanvas[0]);
    }
    loadROM(title, data) {
        if (data.length == 0 || ((data.length & 0x3ff) != 0))
            throw new emu_1.EmuHalt("Invalid ROM length: " + data.length);
        // TODO: parse Log messages from Javatari?
        var wasrunning = this.isRunning();
        Javatari.loadROM(title, data);
        if (!this.isRunning())
            throw Error("Could not load ROM");
        if (!wasrunning)
            this.pause();
    }
    getOpcodeMetadata(opcode, offset) {
        return Javatari.getOpcodeMetadata(opcode, offset);
    }
    getRasterPosition() {
        var clkfs = Javatari.room.console.getClocksFromFrameStart() - 1;
        var row = Math.floor(clkfs / 76);
        var col = clkfs - row * 76;
        var xpos = col * 3;
        var ypos = row;
        return { x: xpos, y: ypos, clk: clkfs % 76 };
    }
    getRasterScanline() {
        return this.getRasterPosition().y;
    }
    getRasterLineClock() {
        return this.getRasterPosition().x;
    }
    // TODO: Clock changes this on event, so it may not be current
    isRunning() {
        //console.log(Javatari.room.console.isRunning(), Javatari.room.console.isPowerOn);
        return Javatari.room && Javatari.room.console.isRunning();
    }
    pause() {
        Javatari.room.console.pause();
        Javatari.room.speaker.mute();
    }
    resume() {
        Javatari.room.console.go();
        // for browser autostart
        Javatari.room.speaker.powerOff();
        Javatari.room.speaker.powerOn();
    }
    advance() {
        Javatari.room.console.clockPulse();
        return 0; // TODO: advanceFrameClock() and return 76*262 (or PAL)
    }
    /*
    advanceFrameClock?(trap: DebugCondition, step: number) : number {
      this.runEval( (c) => {
        var clkfs = Javatari.room.console.getClocksFromFrameStart() - 1;
        return clkfs >= step;
      });
      return step;
    }
    */
    // for unit test
    nextFrame() {
        Javatari.room.console.clockPulse();
    }
    step() { Javatari.room.console.debugSingleStepCPUClock(); }
    stepBack() { Javatari.room.console.debugStepBackInstruction(); }
    runEval(evalfunc) { Javatari.room.console.debugEval(evalfunc); }
    setupDebug(callback) {
        Javatari.room.console.onBreakpointHit = (state) => {
            state.c.PC = (state.c.PC - 1) & 0xffff;
            this.fixState(state);
            Javatari.room.console.pause();
            Javatari.room.speaker.mute();
            this.lastBreakState = state;
            callback(state);
        };
        Javatari.room.speaker.mute();
    }
    isDebugging() {
        // TODO: always true
        return Javatari.room.console.onBreakpointHit != null;
    }
    clearDebug() {
        this.lastBreakState = null;
        Javatari.room.console.disableDebug();
        Javatari.room.console.onBreakpointHit = null;
        if (this.isRunning())
            Javatari.room.speaker.play();
    }
    reset() {
        Javatari.room.console.powerOff();
        Javatari.room.console.resetDebug();
        Javatari.room.console.powerOn();
        Javatari.room.speaker.play();
    }
    getOriginPC() {
        return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
    }
    newCodeAnalyzer() {
        return new analysis_1.CodeAnalyzer_vcs(this);
    }
    saveState() {
        var state = Javatari.room.console.saveState();
        this.fixState(state);
        return state;
    }
    fixState(state) {
        var ofs = (state.ca && state.ca.bo) || 0;
        if (state.ca && state.ca.fo && (state.c.PC & 0xfff) >= 2048)
            ofs = state.ca.fo; // 3E/3F fixed-slice formats
        // TODO: for batari BASIC
        state.c.EPC = state.c.PC + ofs; // EPC = effective PC for ROM
    }
    loadState(state) {
        return Javatari.room.console.loadState(state);
    }
    getCPUState() {
        return Javatari.room.console.getCPUState();
    }
    saveControlsState() {
        return Javatari.room.console.saveControlsState();
    }
    loadControlsState(state) {
        Javatari.room.console.loadControlsState(state);
    }
    readAddress(addr) {
        // TODO: shouldn't have to do this when debugging
        if (this.lastBreakState && addr >= 0x80 && addr < 0x100)
            return this.getRAMForState(this.lastBreakState)[addr & 0x7f];
        else if ((addr & 0x1280) === 0x280)
            return 0; // don't read PIA
        else
            return Javatari.room.console.readAddress(addr);
    }
    writeAddress(addr, value) {
        Javatari.room.console.writeAddress(addr, value);
    }
    runUntilReturn() {
        var depth = 1;
        this.runEval((c) => {
            if (depth <= 0 && c.T == 0)
                return true;
            if (c.o == 0x20)
                depth++;
            else if (c.o == 0x60 || c.o == 0x40)
                --depth;
            return false;
        });
    }
    runToVsync() {
        this.advance();
        this.runEval((c) => { return true; });
    }
    cpuStateToLongString(c) {
        return (0, baseplatform_1.cpuStateToLongString_6502)(c);
    }
    getRAMForState(state) {
        return jt.Util.byteStringToUInt8Array(atob(state.r.b));
    }
    ramStateToLongString(state) {
        var ram = this.getRAMForState(state);
        return "\n" + (0, emu_1.dumpRAM)(ram, 0x80, 0x80);
    }
    getDefaultExtension() { return ".dasm"; }
    getROMExtension() { return ".a26"; }
    getDebugCategories() {
        return ['CPU', 'Stack', 'PIA', 'TIA'];
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'CPU': return this.cpuStateToLongString(state.c) + this.bankSwitchStateToString(state);
            case 'Stack': return (0, baseplatform_1.dumpStackToString)(this, this.getRAMForState(state), 0x100, 0x1ff, 0x100 + state.c.SP, 0x20);
            case 'PIA': return this.ramStateToLongString(state) + "\n" + this.piaStateToLongString(state.p);
            case 'TIA': return this.tiaStateToLongString(state.t);
        }
    }
    bankSwitchStateToString(state) {
        return (state.ca && state.ca.bo !== undefined) ? "BankOffset " + (0, util_1.hex)(state.ca.bo, 4) + "\n" : "";
    }
    piaStateToLongString(p) {
        return "Timer  " + p.t + "/" + p.c + "\nINTIM  $" + (0, util_1.hex)(p.IT, 2) + " (" + p.IT + ")\nINSTAT $" + (0, util_1.hex)(p.IS, 2) + "\n";
    }
    tiaStateToLongString(t) {
        var pos = this.getRasterPosition();
        var s = '';
        s += "H" + (0, util_1.lpad)(pos.x.toString(), 5) + " (clk " + (0, util_1.lpad)(pos.clk.toString(), 3) + ") V" + (0, util_1.lpad)(pos.y.toString(), 5) + "   ";
        s += (t.vs ? "VSYNC " : "- ") + (t.vb ? "VBLANK " : "- ") + "\n";
        s += "\n";
        s += "Playfield " + t.f + "\n";
        s += "          " + (t.fr ? "REFLECT " : "- ") + (t.fs ? "SCOREMODE " : "- ") + (t.ft ? "PRIORITY " : "- ") + "\n";
        for (var j = 0; j < 2; j++) {
            var i = "p" + j;
            s += "Player" + j + (0, util_1.lpad)((0, util_1.tobin)(t[i]), 11) + (0, util_1.lpad)((0, util_1.tobin)(t[i + 'd']), 11) + "\n";
        }
        s += "\n";
        // TODO? s += "    Color {color:0x" + hex(t.fc)  + "} {color:0x" + hex(t.fb) + "}\n";
        s += "          Count Scan Speed\n";
        for (var j = 0; j < 2; j++) {
            var i = "p" + j;
            s += "Player" + j + (0, util_1.lpad)(t[i + 'co'], 8) + (0, util_1.lpad)(nonegstr(t[i + 'sc']), 5) + (0, util_1.lpad)(t[i + 'ss'], 6);
            s += " " + (t[i + 'rr'] ? "RESET" : "") + " " + (t[i + 'v'] ? "DELAY" : "") + " " + (t[i + 'cc'] ? "CLOSECOPY" : "") + " " + (t[i + 'mc'] ? "MEDCOPY" : "") + " " + (t[i + 'wc'] ? "WIDECOPY" : "") + " " + (t[i + 'r'] ? "REFLECT" : "") + "\n";
        }
        for (var j = 0; j < 2; j++) {
            var i = "m" + j;
            s += "Missile" + j + (0, util_1.lpad)(t[i + 'co'], 7) + (0, util_1.lpad)(nonegstr(t[i + 'sc']), 5) + (0, util_1.lpad)(t[i + 'ss'], 6);
            s += " " + (t[i + 'rr'] ? "RESET" : "") + " " + (t[i + 'r'] ? "RESET2PLAYER" : "") + "\n";
        }
        s += "Ball" + (0, util_1.lpad)(t['bco'], 11) + (0, util_1.lpad)(nonegstr(t['bsc']), 5) + (0, util_1.lpad)(t['bss'], 6) + "\n";
        return s;
    }
    disassemble(pc, read) {
        return (0, disasm6502_1.disassemble6502)(pc, read(pc), read(pc + 1), read(pc + 2));
    }
    showHelp() {
        return "https://8bitworkshop.com/docs/platforms/vcs/";
    }
    startProbing() {
        var self = this;
        var rec = new probe_1.ProbeRecorder(this);
        this.connectProbe(rec);
        var probe = this.probe;
        // intercept CPU clock pulse
        var cpu = Javatari.room.console.cpu;
        if (cpu.oldCPUClockPulse == null) {
            cpu.oldCPUClockPulse = cpu.clockPulse;
            cpu.clockPulse = function () {
                if (cpu.isPCStable())
                    probe.logExecute(cpu.getPC(), cpu.getSP());
                this.oldCPUClockPulse();
                probe.logClocks(1);
            };
        }
        // intercept bus read/write
        var bus = Javatari.room.console.bus;
        if (bus.oldRead == null) {
            bus.oldRead = bus.read;
            bus.read = function (a) {
                var v = this.oldRead(a);
                if (a < 0x80)
                    probe.logIORead(a, v);
                else if (a > 0x280 && a < 0x300)
                    probe.logIORead(a, v);
                else
                    probe.logRead(a, v);
                return v;
            };
            bus.oldWrite = bus.write;
            bus.write = function (a, v) {
                this.oldWrite(a, v);
                if (a == 0x02)
                    probe.logWait(a); // WSYNC
                else if (a < 0x80)
                    probe.logIOWrite(a, v);
                else if (a > 0x280 && a < 0x300)
                    probe.logIOWrite(a, v);
                else
                    probe.logWrite(a, v);
            };
        }
        return rec;
    }
    stopProbing() {
        this.connectProbe(null);
        var cpu = Javatari.room.console.cpu;
        if (cpu.oldCPUClockPulse != null) {
            cpu.clockPulse = cpu.oldCPUClockPulse;
            cpu.oldCPUClockPulse = null;
        }
        var bus = Javatari.room.console.bus;
        if (bus.oldRead) {
            bus.read = bus.oldRead;
            bus.oldRead = null;
        }
        if (bus.oldWrite) {
            bus.write = bus.oldWrite;
            bus.oldWrite = null;
        }
    }
    connectProbe(probe) {
        this.probe = probe || this.nullProbe;
    }
    // resizing
    resize() {
        var scale = Math.min(1, ($('#emulator').width() - 24) / 640);
        var xt = (1 - scale) * 50;
        $('#javatari-div').css('transform', `translateX(-${xt}%) translateY(-${xt}%) scale(${scale})`);
    }
}
;
// TODO: mixin for Base6502Platform?
function nonegstr(n) {
    return n < 0 ? "-" : n.toString();
}
///////////////
class VCSMAMEPlatform extends mameplatform_1.BaseMAME6502Platform {
    constructor() {
        //  MCFG_SCREEN_RAW_PARAMS( MASTER_CLOCK_NTSC, 228, 26, 26 + 160 + 16, 262, 24 , 24 + 192 + 31 )
        super(...arguments);
        this.start = function () {
            this.startModule(this.mainElement, {
                jsfile: 'mame8bitws.js',
                driver: 'a2600',
                width: 176 * 2,
                height: 223,
                romfn: '/emulator/cart.rom',
                romsize: 0x1000,
            });
        };
        this.loadROM = function (title, data) {
            this.loadROMFile(data);
            this.loadRegion(":cartslot:cart:rom", data);
        };
        this.getPresets = function () { return VCS_PRESETS; };
        this.getToolForFilename = getToolForFilename_vcs;
        this.getOriginPC = function () {
            return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
        };
    }
    getDefaultExtension() { return ".dasm"; }
    getROMExtension() { return ".a26"; }
}
////////////////
class VCSStellaPlatform {
    constructor(mainElement) {
        this.running = false;
        this.getToolForFilename = getToolForFilename_vcs;
        this.mainElement = mainElement;
    }
    async start() {
        await (0, util_1.loadScript)('lib/stellerator/stellerator-embedded.min.js');
        const $6502 = window['$6502'];
        this.Stellerator = $6502.Stellerator;
        // create a canvas, stellerator will override width/height but we need CSS aspect ratio
        const canvas = (0, emu_1.__createCanvas)(window.document, this.mainElement, 28, 20);
        // stellerator adds overscan, we don't need as much
        canvas.style.padding = '10px';
        this.stellerator = new this.Stellerator(canvas, 'lib/stellerator/stellerator.min.js', {
            gamma: 0.8,
            scalingMode: this.Stellerator.ScalingMode.qis,
            tvEmulation: this.Stellerator.TvEmulation.composite,
            phosphorLevel: 0.25,
            scanlineLevel: 0.2,
            keyboardTarget: this.mainElement
        });
    }
    loadROM(title, data) {
        this.stellerator.run(data, this.Stellerator.TvMode.ntsc);
    }
    reset() {
        this.stellerator.reset();
    }
    pause() {
        this.running = false;
        this.stellerator.pause();
    }
    resume() {
        this.running = true;
        this.stellerator.resume();
    }
    isRunning() {
        return this.running;
    }
    getDefaultExtension() { return ".dasm"; }
    getROMExtension() { return ".a26"; }
    getPresets() { return VCS_PRESETS; }
}
////////////////
emu_1.PLATFORMS['vcs'] = VCSPlatform;
emu_1.PLATFORMS['vcs.mame'] = VCSMAMEPlatform;
emu_1.PLATFORMS['vcs.stellerator'] = VCSStellaPlatform;
//# sourceMappingURL=vcs.js.map