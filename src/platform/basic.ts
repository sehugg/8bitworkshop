
import { Platform, BreakpointCallback } from "../common/baseplatform";
import { PLATFORMS, AnimationTimer } from "../common/emu";
import { loadScript } from "../ide/ui";
import { BASICRuntime } from "../common/basic/runtime";
import { BASICProgram } from "../common/basic/compiler";

const BASIC_PRESETS = [
    { id: 'hello.bas', name: 'Hello World' }
];

class TeleType {
    page: HTMLElement;
    fixed: boolean;
    scrolldiv: HTMLElement;

    curline: HTMLElement;
    curstyle: number;
    reverse: boolean;
    col: number;
    row: number;
    lines: HTMLElement[];
    ncharsout : number;

    constructor(page: HTMLElement, fixed: boolean) {
        this.page = page;
        this.fixed = fixed;
        this.clear();
    }
    clear() {
        this.curline = null;
        this.curstyle = 0;
        this.reverse = false;
        this.col = 0;
        this.row = -1;
        this.lines = [];
        this.ncharsout = 0;
        $(this.page).empty();
    }
    ensureline() {
        if (this.curline == null) {
            this.curline = this.lines[++this.row];
            if (this.curline == null) {
                this.curline = $('<div class="transcript-line"/>')[0];
                this.page.appendChild(this.curline);
                this.lines[this.row] = this.curline;
                this.scrollToBottom();
            }
        }
    }
    flushline() {
        this.curline = null;
    }
    // TODO: support fixed-width window (use CSS grid?)
    addtext(line: string, style: number) {
        this.ensureline();
        if (line.length) {
            // in fixed mode, only do characters
            if (this.fixed && line.length > 1) {
                for (var i = 0; i < line.length; i++)
                    this.addtext(line[i], style);
                return;
            }
            var span = $("<span/>").text(line);
            for (var i = 0; i < 8; i++) {
                if (style & (1 << i))
                    span.addClass("transcript-style-" + (1 << i));
            }
            if (this.reverse) span.addClass("transcript-reverse");
            //span.data('vmip', this.vm.pc);
            // in fixed mode, we can overwrite individual characters
            if (this.fixed && line.length == 1 && this.col < this.curline.childNodes.length) {
                this.curline.replaceChild(span[0], this.curline.childNodes[this.col]);
            } else {
                span.appendTo(this.curline);
            }
            this.col += line.length;
            this.ncharsout += line.length;
            //this.movePrintHead();
        }
    }
    newline() {
        this.flushline();
        this.col = 0;
    }
    // TODO: bug in interpreter where it tracks cursor position but maybe doesn't do newlines?
    print(val: string) {
        // split by newlines
        var lines = val.split("\n");
        for (var i = 0; i < lines.length; i++) {
            if (i > 0) this.newline();
            this.addtext(lines[i], this.curstyle);
        }
    }
    move_cursor(col: number, row: number) {
        if (!this.fixed) return; // fixed windows only
        // ensure enough row elements
        while (this.lines.length <= row) {
            this.flushline();
            this.ensureline();
        }
        // select row element
        this.curline = this.lines[row];
        this.row = row;
        // get children in row (individual text cells)
        var children = $(this.curline).children();
        // add whitespace to line?
        if (children.length > col) {
            this.col = col;
        } else {
            while (this.col < col)
                this.addtext(' ', this.curstyle);
        }
    }
    setrows(size: number) {
        if (!this.fixed) return; // fixed windows only
        // truncate rows?
        var allrows = $(this.page).children();
        if (allrows.length > size) {
            this.flushline();
            allrows.slice(size).remove();
            this.lines = this.lines.slice(0, size);
            //this.move_cursor(0,0); 
        }
    }
    formfeed() {
        this.newline();
    }
    scrollToBottom() {
        this.curline.scrollIntoView();
    }
    movePrintHead() {
        var x = $(this.page).position().left + this.col * ($(this.page).width() / 80);
        $("#printhead").offset({left: x});
    }
}

class TeleTypeWithKeyboard extends TeleType {
    input : HTMLInputElement;
    runtime : BASICRuntime;
    platform : BASICPlatform;
    keepinput : boolean = true;

    focused : boolean = true;
    scrolling : number = 0;
    waitingfor : string;
    resolveInput;

    constructor(page: HTMLElement, fixed: boolean, input: HTMLInputElement, platform: BASICPlatform) {
        super(page, fixed);
        this.input = input;
        this.platform = platform;
        this.runtime = platform.runtime;
        this.runtime.input = async (prompt:string) => {
            return new Promise( (resolve, reject) => {
                this.addtext(prompt, 0);
                this.addtext('? ', 0);
                this.waitingfor = 'line';
                this.focusinput();
                this.resolveInput = resolve;
            });
        }
        this.input.onkeypress = (e) => {
            this.sendkey(e);
        };
        this.input.onfocus = (e) => {
            this.focused = true;
            console.log('inputline gained focus');
        };
        $("#workspace").on('click', (e) => {
            this.focused = false;
            console.log('inputline lost focus');
        });
        this.page.onclick = (e) => {
            this.input.focus();
        };
        this.hideinput();
    }
    focusinput() {
        this.ensureline();
        // don't steal focus while editing
        if (this.keepinput)
            $(this.input).css('visibility', 'visible');
        else
            $(this.input).appendTo(this.curline).show()[0];
        this.scrollToBottom();
        if (this.focused) {
            $(this.input).focus();
        }
        // change size
        if (this.waitingfor == 'char')
            $(this.input).addClass('transcript-input-char')
        else
            $(this.input).removeClass('transcript-input-char')
    }
    hideinput() {
        if (this.keepinput)
            $(this.input).css('visibility','hidden');
        else
            $(this.input).appendTo($(this.page).parent()).hide();
    }
    clearinput() {
        this.input.value = '';
        this.waitingfor = null;
    }
    sendkey(e: KeyboardEvent) {
        if (this.waitingfor == 'line') {
            if (e.key == "Enter") {
                this.sendinput(this.input.value.toString());
            }
        } else if (this.waitingfor == 'char') {
            this.sendchar(e.keyCode);
            e.preventDefault();
        }
    }
    sendinput(s: string) {
        if (this.resolveInput) {
            s = s.toUpperCase();
            this.addtext(s, 4);
            this.flushline();
            this.resolveInput(s.split(','));
            this.resolveInput = null;
        }
        this.clearinput();
        this.hideinput(); // keep from losing input handlers
    }
    sendchar(code: number) {
    }
    ensureline() {
        if (!this.keepinput) $(this.input).hide();
        super.ensureline();
    }
    scrollToBottom() {
        // TODO: fails when lots of lines are scrolled
        if (this.scrolldiv) {
            this.scrolling++;
            $(this.scrolldiv).stop().animate({scrollTop: $(this.page).height()}, 200, 'swing', () => {
                this.scrolling = 0;
                this.ncharsout = 0;
            });
        } else {
            this.input.scrollIntoView();
        }
    }
    isBusy() {
        // stop execution when scrolling and printing non-newlines
        return this.scrolling > 0 && this.ncharsout > 0;
    }
}

class BASICPlatform implements Platform {
    mainElement: HTMLElement;
    program: BASICProgram;
    runtime: BASICRuntime;
    timer: AnimationTimer;
    tty: TeleTypeWithKeyboard;
    ips: number = 500;
    clock: number = 0;

    constructor(mainElement: HTMLElement) {
        //super();
        this.mainElement = mainElement;
        mainElement.style.overflowY = 'auto';
        mainElement.style.backgroundColor = 'white';
    }

    async start() {
        await loadScript('./gen/common/basic/runtime.js');
        // create runtime
        this.runtime = new BASICRuntime();
        this.runtime.reset();
        // create divs
        var parent = this.mainElement;
        // TODO: input line should be always flush left
        var gameport = $('<div id="gameport" style="margin-top:80vh"/>').appendTo(parent);
        var windowport = $('<div id="windowport" class="transcript transcript-style-2"/>').appendTo(gameport);
        var inputline = $('<input class="transcript-input transcript-style-2" type="text" style="max-width:95%"/>').appendTo(parent);
        //var printhead = $('<div id="printhead" class="transcript-print-head"/>').appendTo(parent);
        this.tty = new TeleTypeWithKeyboard(windowport[0], true, inputline[0] as HTMLInputElement, this);
        this.tty.scrolldiv = parent;
        this.timer = new AnimationTimer(60, this.advance1_60.bind(this));
        this.resize = () => {
            // set font size proportional to window width
            var charwidth = $(gameport).width() * 1.6 / 80;
            $(windowport).css('font-size', charwidth + 'px');
            this.tty.scrollToBottom();
        }
        this.resize();
        this.runtime.print = this.tty.print.bind(this.tty);
        this.runtime.resume = this.resume.bind(this);
    }

    advance1_60() {
        if (this.tty.isBusy()) return;
        this.clock += this.ips/60;
        while (!this.runtime.exited && this.clock-- > 0) {
            this.advance();
        }
    }

    advance(novideo?: boolean) : number {
        if (this.runtime.running) {
            try {
                var more = this.runtime.step();
                if (!more) {
                    this.pause();
                    if (this.runtime.exited) {
                        this.tty.print("\n\n");
                        this.tty.addtext("*** END OF PROGRAM ***", 1);
                    }
                }
            } catch (e) {
                this.break();
                throw e;
            }
            return 1;
        } else {
            return 0;
        }
    }

    resize: () => void;

    loadROM(title, data) {
        this.reset();
        this.program = data;
        this.runtime.load(data);
    }

    getROMExtension() {
        return ".json";
    }

    reset(): void {
        var didExit = this.runtime.exited;
        this.tty.clear();
        this.runtime.reset();
        // restart program if it's finished, otherwise reset and hold
        if (didExit) {
            this.resume();
        }
    }

    pause(): void {
        this.timer.stop();
    }

    resume(): void {
        this.clock = 0;
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
        this.pause();
        this.advance();
        this.break();
    }
    break() {
        if (this.onBreakpointHit) {
            this.onBreakpointHit(this.saveState());
        }
    }
}

//

PLATFORMS['basic'] = BASICPlatform;
