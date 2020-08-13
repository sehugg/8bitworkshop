
import { Platform, BreakpointCallback, DebugCondition, DebugEvalCondition } from "../common/baseplatform";
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
    clock: number = 0;
    timer: AnimationTimer;
    tty: TeleTypeWithKeyboard;
    hotReload: boolean = false;
    animcount: number = 0;

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
        this.tty.bell = new Audio('res/ttybell.mp3');
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
            this.tty.resize(80);
        }
        this.resize();
        this.runtime.print = (s:string) => {
            // TODO: why null sometimes?
            this.animcount = 0; // exit advance loop when printing
            this.tty.print(s);
        }
        this.runtime.resume = this.resume.bind(this);
    }

    animate() {
        if (this.tty.isBusy()) return;
        var ips = this.program.opts.commandsPerSec || 1000;
        this.animcount += ips / 60;
        while (!this.runtime.exited && this.animcount-- > 0) {
            this.advance();
        }
    }

    // should not depend on tty state
    advance(novideo?: boolean) : number {
        if (this.runtime.running) {
            if (this.checkDebugTrap())
                return 0;
            var more = this.runtime.step();
            if (!more) {
                this.pause();
                if (this.runtime.exited) {
                    this.exitmsg();
                }
            }
            this.clock++;
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
        this.clock = 0;
    }

    pause(): void {
        this.timer.stop();
    }

    resume(): void {
        if (this.isBlocked()) return;
        this.animcount = 0;
        this.timer.start();
    }

    isBlocked() { return this.tty.waitingfor != null; } // is blocked for input?
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
            rt: this.runtime.saveState(),
        }
    }
    loadState(state) {
        this.runtime.loadState(state);
    }
    getDebugTree() {
        return {
            CurrentLine: this.runtime.getCurrentLabel(),
            Variables: this.runtime.vars,
            Arrays: this.runtime.arrays,
            Functions: this.runtime.defs,
            ForLoops: this.runtime.forLoops,
            WhileLoops: this.runtime.whileLoops,
            ReturnStack: this.runtime.returnStack,
            NextDatum: this.runtime.datums[this.runtime.dataptr],
            Clock: this.clock,
            Options: this.runtime.opts,
            Internals: this.runtime,
        }
    }
    inspect(sym: string) {
        var o = this.runtime.vars[sym];
        if (o != null) {
            return o.toString();
        }
    }

    // TODO: debugging (get running state, etc)

    onBreakpointHit : BreakpointCallback;
    debugTrap : DebugCondition;

    setupDebug(callback : BreakpointCallback) : void {
        this.onBreakpointHit = callback;
    }
    clearDebug() {
        this.onBreakpointHit = null;
        this.debugTrap = null;
    }
    checkDebugTrap() : boolean {
        if (this.debugTrap && this.debugTrap()) {
            this.pause();
            this.break();
            return true;
        }
        return false;
    }
    break() {
        // TODO: why doesn't highlight go away on resume?
        if (this.onBreakpointHit) {
            this.onBreakpointHit(this.saveState());
        }
    }
    step() {
        var prevClock = this.clock;
        this.debugTrap = () => {
            return this.clock > prevClock;
        };
        this.resume();
    }
    stepOver() {
        var stmt = this.runtime.getStatement();
        if (stmt && (stmt.command == 'GOSUB' || stmt.command == 'ONGOSUB')) {
            var nextPC = this.getPC() + 1;
            this.runEval(() => this.getPC() == nextPC);
        } else {
            this.step();
        }
    }
    runUntilReturn() {
        var prevSP = this.getSP();
        this.runEval(() => this.getSP() > prevSP);
    }
    runEval(evalfunc : DebugEvalCondition) {
        this.debugTrap = () => evalfunc(this.getCPUState());
        this.resume();
    }
}

//

PLATFORMS['basic'] = BASICPlatform;
