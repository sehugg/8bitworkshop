
import { Platform, BreakpointCallback } from "../common/baseplatform";
import { PLATFORMS, AnimationTimer, EmuHalt } from "../common/emu";
import { loadScript } from "../ide/ui";
import * as views from "../ide/views";
import { BASICRuntime } from "../common/basic/runtime";
import { BASICProgram } from "../common/basic/compiler";
import { TeleTypeWithKeyboard } from "../common/teletype";

const BASIC_PRESETS = [
    { id: 'hello.bas', name: 'Hello World' },
    { id: 'sieve.bas', name: 'Sieve Benchmark' },
    { id: '23match.bas', name: '23 Matches' },
    { id: 'wumpus.bas', name: 'Hunt The Wumpus' },
    { id: 'hamurabi.bas', name: 'Hammurabi' },
];

class BASICPlatform implements Platform {
    mainElement: HTMLElement;
    program: BASICProgram;
    runtime: BASICRuntime;
    timer: AnimationTimer;
    tty: TeleTypeWithKeyboard;
    clock: number = 0;
    hotReload: boolean = false;
    debugstop: boolean = false; // TODO: should be higher-level support

    constructor(mainElement: HTMLElement) {
        //super();
        this.mainElement = mainElement;
        mainElement.style.overflowY = 'auto';
    }

    async start() {
        await loadScript('./gen/common/basic/runtime.js');
        await loadScript('./gen/common/teletype.js');
        // create runtime
        this.runtime = new BASICRuntime();
        this.runtime.reset();
        // create divs
        var parent = this.mainElement;
        // TODO: input line should be always flush left
        var gameport = $('<div id="gameport" style="margin-top:calc(100vh - 8em)"/>').appendTo(parent);
        var windowport = $('<div id="windowport" class="transcript transcript-style-2"/>').appendTo(gameport);
        var inputport = $('<div id="inputport" class="transcript-bottom"/>').appendTo(gameport);
        var inputline = $('<input class="transcript-input transcript-style-2" type="text" style="max-width:95%"/>').appendTo(inputport);
        //var printhead = $('<div id="printhead" class="transcript-print-head"/>').appendTo(parent);
        //var printshield = $('<div id="printhead" class="transcript-print-shield"/>').appendTo(parent);
        this.tty = new TeleTypeWithKeyboard(windowport[0], true, inputline[0] as HTMLInputElement);
        this.tty.scrolldiv = parent;
        this.runtime.input = async (prompt:string, nargs:number) => {
            return new Promise( (resolve, reject) => {
                if (prompt != null) {
                    this.tty.addtext(prompt, 0);
                    this.tty.addtext('? ', 0);
                    this.tty.waitingfor = 'line';
                } else {
                    this.tty.waitingfor = 'char';
                }
                this.tty.focusinput();
                this.tty.resolveInput = resolve;
            });
        }
        this.timer = new AnimationTimer(60, this.animate.bind(this));
        this.resize = () => {
            // set font size proportional to window width
            var charwidth = $(gameport).width() * 1.6 / 80;
            $(windowport).css('font-size', charwidth + 'px');
            this.tty.scrollToBottom();
        }
        this.resize();
        this.runtime.print = (s:string) => {
            // TODO: why null sometimes?
            this.clock = 0; // exit advance loop when printing
            this.tty.print(s);
        }
        this.runtime.resume = this.resume.bind(this);
    }

    animate() {
        if (this.tty.isBusy()) return;
        var ips = this.program.opts.commandsPerSec || 1000;
        this.clock += ips / 60;
        while (!this.runtime.exited && this.clock-- > 0) {
            this.advance();
        }
    }

    // should not depend on tty state
    advance(novideo?: boolean) : number {
        if (this.runtime.running) {
            var more = this.runtime.step();
            if (!more) {
                this.pause();
                if (this.runtime.exited) {
                    this.exitmsg();
                }
            }
            // TODO: break() when EmuHalt at location?
            return 1;
        } else {
            return 0;
        }
    }
    
    exitmsg() {
        this.tty.print("\n\n");
        this.tty.addtext("*** END OF PROGRAM ***", 1);
        this.tty.showPrintHead(false);
    }

    resize: () => void;

    loadROM(title, data) {
        // TODO: only hot reload when we hit a label?
        var didExit = this.runtime.exited;
        this.program = data;
        this.runtime.load(data);
        this.tty.uppercaseOnly = this.program.opts.uppercaseOnly;
        views.textMapFunctions.input = this.program.opts.uppercaseOnly ? (s) => s.toUpperCase() : null;
        // only reset if we exited, otherwise we try to resume
        if (!this.hotReload || didExit) this.reset();
    }

    getROMExtension() {
        return ".json";
    }

    reset(): void {
        this.tty.clear();
        this.runtime.reset();
        if (this.debugstop)
            this.break();
        else
            this.resume();
    }

    pause(): void {
        this.timer.stop();
    }

    resume(): void {
        this.clock = 0;
        this.debugstop = false;
        this.timer.start();
    }

    isRunning() { return this.timer.isRunning(); }
    getDefaultExtension() { return ".bas"; }
    getToolForFilename() { return "basic"; }
    getPresets() { return BASIC_PRESETS; }

    getPC() {
        return this.runtime.curpc;
    }
    getSP() {
        return 0x1000 - this.runtime.returnStack.length;
    }
    isStable() {
        return true;
    }
    
    getCPUState() {
        return { PC: this.getPC(), SP: this.getSP() }
    }
    saveState() {
        return {
            c: this.getCPUState(),
            rt: $.extend(true, {}, this.runtime) // TODO: don't take all
        }
    }
    loadState(state) {
        $.extend(true, this.runtime, state);
    }
    getDebugTree() {
        return this.runtime;
    }
    inspect(sym: string) {
        var o = this.runtime.vars[sym];
        if (o != null) {
            return o.toString();
        }
    }

    // TODO: debugging (get running state, etc)

    onBreakpointHit : BreakpointCallback;

    setupDebug(callback : BreakpointCallback) : void {
        this.onBreakpointHit = callback;
    }
    clearDebug() {
        this.onBreakpointHit = null;
    }
    step() {
        if (this.tty.waitingfor == null) {
            this.pause();
            this.advance();
            this.break();
        }
    }
    break() {
        // TODO: why doesn't highlight go away on resume?
        if (this.onBreakpointHit) {
            this.onBreakpointHit(this.saveState());
            this.debugstop = true;
        }
    }
}

//

PLATFORMS['basic'] = BASICPlatform;
