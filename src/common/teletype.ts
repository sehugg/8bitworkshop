
import { InputResponse } from "./basic/runtime";

export class TeleType {
    page: HTMLElement;
    fixed: boolean;
    ncols: number = 80;
    scrolldiv: HTMLElement;
    bell; // Audio

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
        this.showPrintHead(true);
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
        this.col = 0;
        this.movePrintHead(false);
    }
    addtext(line: string, style: number) {
        this.ensureline();
        if (line.length) {
            // in fixed mode, only do characters
            if (this.fixed && line.length > 1) {
                for (var i = 0; i < line.length; i++)
                    this.addtext(line[i], style);
                return;
            }
            // process control codes
            if (line.length == 1) {
                var ch = line.charCodeAt(0);
                switch (ch) {
                    case 7: if (this.bell) this.bell.play(); break;
                    case 8: if (this.col > 0) this.col--; break;
                    case 12: this.formfeed(); break;
                    case 13: this.col = 0; break;
                }
                if (ch < 32) return; // ignore non-printables
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
            // wrap @ 80 columns (TODO: const)
            if (this.fixed && this.col >= this.ncols) this.flushline();
            this.ncharsout += line.length;
            this.movePrintHead(true);
        }
    }
    newline() {
        this.flushline();
        this.ensureline();
    }
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
        for (var i=0; i<60; i++) { this.newline(); this.ensureline(); }
    }
    scrollToBottom() {
        this.curline.scrollIntoView();
    }
    movePrintHead(printing: boolean) {
        /*
        var ph = $("#printhead"); // TODO: speed?
        var x = $(this.page).position().left + this.col * ($(this.page).width() / 80) - 200;
        ph.stop().animate({left: x}, {duration:20});
        //ph.offset({left: x});
        if (printing) ph.addClass("printing");
        else ph.removeClass("printing");
        */
    }
    showPrintHead(show: boolean) {
        /*
        var ph = $("#printhead"); // TODO: speed?
        if (show) ph.show(); else ph.hide();
        */
    }
    resize(columns: number) {
        // set font size proportional to window width
        var charwidth = $(this.page).width() * 1.6 / columns;
        $(this.page).css('font-size', charwidth + 'px');
        this.scrollToBottom();
    }
    saveState() {
        return {
            curstyle: this.curstyle,
            reverse: this.reverse,
            col: this.col,
            row: this.row,
            ncharsout : this.ncharsout,
            lines: this.lines.map((line) => line.cloneNode(true)),
        }
    }
    loadState(state) {
        this.curstyle = state.curstyle;
        this.reverse = state.reverse;
        this.col = state.col;
        this.row = state.row;
        this.ncharsout = state.ncharsout;
        $(this.page).empty();
        for (var i=0; i<state.lines.length; i++) {
            this.page.appendChild(state.lines[i]);
        }
        this.lines = state.lines;
        this.curline = state.lines[this.row];
    }
}

export class TeleTypeWithKeyboard extends TeleType {
    input : HTMLInputElement;
    msecPerLine : number = 100; // IBM 1403
    keepinput : boolean = true;
    keephandler : boolean = true;
    uppercaseOnly : boolean = false;
    splitInput : boolean = false;
    resolveInput : (InputResponse) => void;

    focused : boolean = true;
    scrolling : number = 0;
    waitingfor : string;
    lastInputRequestTime : number;

    constructor(page: HTMLElement, fixed: boolean, input: HTMLInputElement) {
        super(page, fixed);
        this.input = input;
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
    }
    clear() {
        super.clear();
        this.hideinput();
        this.waitingfor = null;
    }
    focusinput() {
        this.ensureline();
        this.showPrintHead(false);
        // don't steal focus while editing
        if (this.keepinput)
            $(this.input).css('visibility', 'visible');
        else
            $(this.input).appendTo(this.curline).show()[0];
        // scroll to bottom
        this.scrollToBottom();
        // refocus?
        if (this.focused) {
            $(this.input).focus();
        }
        // change size
        if (this.waitingfor == 'char')
            $(this.input).addClass('transcript-input-char')
        else
            $(this.input).removeClass('transcript-input-char')
        this.lastInputRequestTime = Date.now();
    }
    hideinput() {
        this.showPrintHead(true);
        if (this.keepinput)
            $(this.input).css('visibility','hidden');
        else
            $(this.input).appendTo($(this.page).parent()).hide();
    }
    clearinput() {
        this.input.value = '';
        this.waitingfor = null;
    }
    cancelinput() {
        this.sendinput('');
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
            var elapsed = Date.now() - this.lastInputRequestTime;
            if (this.uppercaseOnly) s = s.toUpperCase(); // TODO: always uppercase?
            this.addtext(s, 4);
            this.flushline();
            this.clearinput();
            this.hideinput(); // keep from losing input handlers
            var vals = this.splitInput ? s.split(',') : null;
            this.resolveInput({line:s, vals:vals, elapsed:elapsed/1000});
            if (!this.keephandler) this.resolveInput = null;
        }
    }
    sendchar(code: number) {
        this.sendinput(String.fromCharCode(code));
    }
    ensureline() {
        if (!this.keepinput) $(this.input).hide();
        super.ensureline();
    }
    scrollToBottom() {
        if (this.scrolldiv) {
            this.scrolling++;
            var top = $(this.page).height() + $(this.input).height();
            $(this.scrolldiv).stop().animate({scrollTop: top}, this.msecPerLine, 'swing', () => {
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
