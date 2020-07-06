
import { Platform, BasePlatform, BaseDebugPlatform, Preset, EmuState, inspectSymbol } from "../common/baseplatform";
import { PLATFORMS, EmuHalt } from "../common/emu";
import { loadScript } from "../ide/ui";

const ZMACHINE_PRESETS = [
    { id: 'hello.inf', name: 'Hello World' },
    { id: 'house01.inf', name: 'House Tutorial #1' },
    { id: 'house02.inf', name: 'House Tutorial #2' },
    { id: 'house03.inf', name: 'House Tutorial #3' },
    { id: 'house04.inf', name: 'House Tutorial #4' },
    { id: 'house05.inf', name: 'House Tutorial #5' },
    { id: 'house06.inf', name: 'House Tutorial #6' },
    { id: 'house07.inf', name: 'House Tutorial #7' },
    { id: 'alice.inf', name: 'Through the Looking-Glass' },
    { id: 'aloneice.inf', name: 'Alone on the Ice' },
    { id: 'adventureland.inf', name: 'Adventureland' },
    { id: 'toyshop.inf', name: 'Toyshop' },
    { id: 'ruins1.inf', name: 'Ruins #1' },
    { id: 'ruins2.inf', name: 'Ruins #2' },
    { id: 'ruins3.inf', name: 'Ruins #3' },
    { id: 'balances.inf', name: 'Balances' },
    { id: 'museum.inf', name: 'Museum of Inform' },
    { id: 'advent.inf', name: 'Colossal Cave Adventure' },
];

declare var ZVM;

// https://github.com/erkyrath/quixe/wiki/Quixe-Without-GlkOte#quixes-api
// https://eblong.com/zarf/glk/glkote/docs.html
// https://inform-fiction.org/zmachine/standards/z1point0/sect15.html#read_char
// https://manpages.debian.org/testing/inform6-compiler/inform6.1.en.html

class GlkWindow {
    //area: HTMLElement;
    // TODO
}

interface IFZVM {
    start();
    run();
    version : number;
    pc : number;
    ram : DataView;
    stack : DataView;
    read_data : {buffer?};
    handle_line_input(len:number);
    handle_char_input(charcode:number);
}

class GlkImpl {
    vm : IFZVM;
    page: HTMLElement;
    input: HTMLInputElement;
    curline: HTMLElement;
    curstyle: number;
    reverse: boolean;
    windows: GlkWindow[];
    wnd: GlkWindow;
    waitingfor: "line" | "char" | null;
    focused = false;

    constructor(page: HTMLElement, input: HTMLInputElement) {
        this.page = page;
        this.input = input;
        this.reset();
    }
    reset() {
        this.windows = [];
        this.wnd = null;
        this.clear();
    }
    clear() {
        this.curline = null;
        this.curstyle = 0;
        this.reverse = false;
        // keep from losing input handlers
        this.hideinput();
        $(this.page).empty();
    }
    init(options) {
        this.vm = options.vm;
        this.vm.start();
    }
    fatal_error(s:string) {
        throw new EmuHalt(s);
    }
    update() {
        // TODO
    }
    glk_exit() {
        this.flushline();
        this.addtext("** Game exited **", 1);
    }
    glk_window_clear(win) {
        console.log('glk_window_clear', arguments);
        this.clear();
    }
    glk_request_line_event_uni(win, buf, initlen) {
        this.waitingfor = 'line';
        this.focusinput();
    }
    glk_request_char_event_uni(win, buf, initlen) {
        this.waitingfor = 'char';
        this.focusinput();
    }
    focusinput() {
        this.ensureline();
        // don't steal focus while editing
        $(this.input).appendTo(this.curline).show()[0].scrollIntoView();
        if (this.focused) {
            $(this.input).focus();
        }
    }
    hideinput() {
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
            this.vm.handle_char_input(e.keyCode);
            this.vm.run();
            e.preventDefault();
        }
    }
    sendinput(s: string) {
        this.addtext(s, Const.style_Input);
        this.flushline();
        if (this.vm.read_data.buffer) {
            for (var i = 0; i < s.length; i++) {
                this.vm.read_data.buffer[i] = s.charCodeAt(i) & 0xff;
            }
            this.vm.handle_line_input(s.length);
        }
        this.clearinput();
        this.vm.run();
    }
    ensureline() {
        $(this.input).hide();
        if (this.curline == null) {
            this.curline = $('<div class="transcript-line"/>')[0];
            this.page.appendChild(this.curline);
        }
    }
    flushline() {
        this.curline = null;
    }
    addtext(line: string, style: number) {
        this.ensureline();
        if (line.length) {
            var span = $("<span/>").text(line).appendTo(this.curline);
            for (var i=0; i<8; i++) {
                if (style & (1<<i))
                    span.addClass("transcript-style-" + (1<<i));
            }
            if (this.reverse) span.addClass("transcript-reverse");
            span.data('vmip', this.vm.pc);
        }
    }
    glk_put_jstring(val: string, allbytes) {
        var lines = val.split("\n");
        for (var i = 0; i < lines.length; i++) {
            if (i > 0) this.flushline();
            this.addtext(lines[i], this.curstyle);
        }
    }
    glk_put_char(ch) {
        console.log('glk_put_char', arguments);
    }
    glk_put_char_stream(str, ch) {
        console.log('glk_put_char_stream', arguments);
    }
    glk_put_string(val) {
        console.log('glk_put_string', arguments);
    }
    glk_put_string_stream(str, val) {
        console.log('glk_put_string_stream', arguments);
    }
    glk_put_buffer(arr) {
        console.log('glk_put_buffer', arguments);
    }
    glk_put_buffer_stream(str, arr) {
        console.log('glk_put_buffer_stream', arguments);
    }
    glk_set_style(val) {
        this.curstyle = val;
    }
    glk_set_style_stream(str, val) {
        console.log('glk_set_style_stream', arguments);
    }
    glk_get_char_stream(str) {
        console.log('glk_get_char_stream', arguments);
    }
    glk_get_line_stream(str, buf) {
        console.log('glk_get_line_stream', arguments);
    }
    glk_get_buffer_stream(str, buf) {
        console.log('glk_get_buffer_stream', arguments);
    }
    glk_char_to_lower(val) {
        if (val >= 0x41 && val <= 0x5A)
            return val + 0x20;
        if (val >= 0xC0 && val <= 0xDE && val != 0xD7)
            return val + 0x20;
        return val;
    }
    glk_char_to_upper(val) {
        if (val >= 0x61 && val <= 0x7A)
            return val - 0x20;
        if (val >= 0xE0 && val <= 0xFE && val != 0xF7)
            return val - 0x20;
        return val;
    }
    glk_stylehint_set(wintype, styl, hint, value) {
        console.log('glk_stylehint_set', arguments);
    }
    glk_stylehint_clear(wintype, styl, hint) {
        console.log('glk_stylehint_clear', arguments);
    }
    glk_style_distinguish(win, styl1, styl2) {
        return 0;
    }
    glk_style_measure(win, styl, hint, resultref) {
        if (resultref)
            resultref.set_value(0);
        return 0;
    }
    glk_select(eventref) {
        console.log('glk_select', arguments);
    }
    glk_window_open(splitwin, method, size, wintype, rock) {
        console.log('glk_window_open', arguments);
        if (splitwin) console.log("split windows are not supported");
        return splitwin ? 0 : 1; // 0 = no window, 1 = main window
    }
    /*
    glk_window_close(win) {
        console.log('glk_window_close', arguments);
        this.windows.pop(); // TODO
    }
    glk_window_get_parent(win) {
        console.log('glk_window_get_parent', arguments);
    }
    glk_window_set_arrangement(win) {
        console.log('glk_window_set_arrangement', arguments);
    }
    glk_window_get_stream(win) {
        console.log('glk_window_get_stream', arguments);
    }
    */
    glk_set_window(win) {
        console.log('glk_set_window', arguments);
        //if (!win) gli_currentstr = null;
        //else gli_currentstr = win.str;
    }
    glk_window_get_size(win, widthref, heightref) {
        console.log('glk_window_get_size', arguments);
    }
    garglk_set_reversevideo(val) {
        this.reverse = !!val;
    }
    glk_gestalt(sel, val) {
        return this.glk_gestalt_ext(sel, val, null);
    }
    glk_gestalt_ext(sel, val, arr) {
        console.log('glk_gestalt_ext', arguments);
        switch (sel) {

            case 0: // gestalt_Version
                /* This implements Glk spec version 0.7.4? */
                return 0x00000101; // 0.1.1

            case 1: // gestalt_CharInput
                /* This is not a terrific approximation. Return false for function
                   keys, control keys, and the high-bit non-printables. For
                   everything else in the Unicode range, return true. */
                if (val <= Const.keycode_Left && val >= Const.keycode_End)
                    return 1;
                if (val >= 0x100000000 - Const.keycode_MAXVAL)
                    return 0;
                if (val > 0x10FFFF)
                    return 0;
                if ((val >= 0 && val < 32) || (val >= 127 && val < 160))
                    return 0;
                return 1;

            case 2: // gestalt_LineInput
                /* Same as the above, except no special keys. */
                if (val > 0x10FFFF)
                    return 0;
                if ((val >= 0 && val < 32) || (val >= 127 && val < 160))
                    return 0;
                return 1;

            case 3: // gestalt_CharOutput
                /* Same thing again. We assume that all printable characters,
                   as well as the placeholders for nonprintables, are one character
                   wide. */
                if ((val > 0x10FFFF)
                    || (val >= 0 && val < 32)
                    || (val >= 127 && val < 160)) {
                    if (arr)
                        arr[0] = 1;
                    return 0; // gestalt_CharOutput_CannotPrint
                }
                if (arr)
                    arr[0] = 1;
                return 2; // gestalt_CharOutput_ExactPrint

            case 4: // gestalt_MouseInput
                if (val == Const.wintype_TextBuffer)
                    return 0;
                if (val == Const.wintype_Graphics && has_canvas)
                    return 0;
                return 0;

            case 5: // gestalt_Timer
                return 0;

            case 6: // gestalt_Graphics
                return 0;

            case 7: // gestalt_DrawImage
                if (val == Const.wintype_TextBuffer)
                    return 0;
                if (val == Const.wintype_Graphics && has_canvas)
                    return 0;
                return 0;

            case 8: // gestalt_Sound
                return 0;

            case 9: // gestalt_SoundVolume
                return 0;

            case 10: // gestalt_SoundNotify
                return 0;

            case 11: // gestalt_Hyperlinks
                return 0;

            case 12: // gestalt_HyperlinkInput
                if (val == 3 || val == 4) // TextBuffer or TextGrid
                    return 0;
                else
                    return 0;

            case 13: // gestalt_SoundMusic
                return 0;

            case 14: // gestalt_GraphicsTransparency
                return 0;

            case 15: // gestalt_Unicode
                return 1;

            case 16: // gestalt_UnicodeNorm
                return 1;

            case 17: // gestalt_LineInputEcho
                return 1;

            case 18: // gestalt_LineTerminators
                return 1;

            case 19: // gestalt_LineTerminatorKey
                /* Really this result should be inspected from glkote.js. Since it
                   isn't, be sure to keep these values in sync with 
                   terminator_key_names. */
                if (val == Const.keycode_Escape)
                    return 0;
                if (val >= Const.keycode_Func12 && val <= Const.keycode_Func1)
                    return 0;
                return 0;

            case 20: // gestalt_DateTime
                return 0;

            case 21: // gestalt_Sound2
                return 0;

            case 22: // gestalt_ResourceStream
                return 0;

            case 23: // gestalt_GraphicsCharInput
                return 0;

            case 0x1100: // reverse video, color
                return 0;
        }

        return 0;
    }

    /* RefBox: Simple class used for "call-by-reference" Glk arguments. The object
       is just a box containing a single value, which can be written and read.
    */
    RefBox = function () {
        this.value = undefined;
        this.set_value = function (val) {
            this.value = val;
        }
        this.get_value = function () {
            return this.value;
        }
    }

    /* RefStruct: Used for struct-type Glk arguments. After creating the
       object, you should call push_field() the appropriate number of times,
       to set the initial field values. Then set_field() can be used to
       change them, and get_fields() retrieves the list of all fields.
    
       (The usage here is loose, since Javascript is forgiving about arrays.
       Really the caller could call set_field() instead of push_field() --
       or skip that step entirely, as long as the Glk function later calls
       set_field() for each field. Which it should.)
    */
    RefStruct = function (numels) {
        this.fields = [];
        this.push_field = function (val) {
            this.fields.push(val);
        }
        this.set_field = function (pos, val) {
            this.fields[pos] = val;
        }
        this.get_field = function (pos) {
            return this.fields[pos];
        }
        this.get_fields = function () {
            return this.fields;
        }
    }

    /* Dummy return value, which means that the Glk call is still in progress,
       or will never return at all. This is used by glk_exit(), glk_select(),
       and glk_fileref_create_by_prompt().
    */
    DidNotReturn = { dummy: 'Glk call has not yet returned' };
}

const has_canvas = typeof window === 'object';

const Const = {
    gestalt_Version: 0,
    gestalt_CharInput: 1,
    gestalt_LineInput: 2,
    gestalt_CharOutput: 3,
    gestalt_CharOutput_CannotPrint: 0,
    gestalt_CharOutput_ApproxPrint: 1,
    gestalt_CharOutput_ExactPrint: 2,
    gestalt_MouseInput: 4,
    gestalt_Timer: 5,
    gestalt_Graphics: 6,
    gestalt_DrawImage: 7,
    gestalt_Sound: 8,
    gestalt_SoundVolume: 9,
    gestalt_SoundNotify: 10,
    gestalt_Hyperlinks: 11,
    gestalt_HyperlinkInput: 12,
    gestalt_SoundMusic: 13,
    gestalt_GraphicsTransparency: 14,
    gestalt_Unicode: 15,
    gestalt_UnicodeNorm: 16,
    gestalt_LineInputEcho: 17,
    gestalt_LineTerminators: 18,
    gestalt_LineTerminatorKey: 19,
    gestalt_DateTime: 20,
    gestalt_Sound2: 21,
    gestalt_ResourceStream: 22,
    gestalt_GraphicsCharInput: 23,

    keycode_Unknown: 0xffffffff,
    keycode_Left: 0xfffffffe,
    keycode_Right: 0xfffffffd,
    keycode_Up: 0xfffffffc,
    keycode_Down: 0xfffffffb,
    keycode_Return: 0xfffffffa,
    keycode_Delete: 0xfffffff9,
    keycode_Escape: 0xfffffff8,
    keycode_Tab: 0xfffffff7,
    keycode_PageUp: 0xfffffff6,
    keycode_PageDown: 0xfffffff5,
    keycode_Home: 0xfffffff4,
    keycode_End: 0xfffffff3,
    keycode_Func1: 0xffffffef,
    keycode_Func2: 0xffffffee,
    keycode_Func3: 0xffffffed,
    keycode_Func4: 0xffffffec,
    keycode_Func5: 0xffffffeb,
    keycode_Func6: 0xffffffea,
    keycode_Func7: 0xffffffe9,
    keycode_Func8: 0xffffffe8,
    keycode_Func9: 0xffffffe7,
    keycode_Func10: 0xffffffe6,
    keycode_Func11: 0xffffffe5,
    keycode_Func12: 0xffffffe4,
    /* The last keycode is always (0x100000000 - keycode_MAXVAL) */
    keycode_MAXVAL: 28,

    evtype_None: 0,
    evtype_Timer: 1,
    evtype_CharInput: 2,
    evtype_LineInput: 3,
    evtype_MouseInput: 4,
    evtype_Arrange: 5,
    evtype_Redraw: 6,
    evtype_SoundNotify: 7,
    evtype_Hyperlink: 8,
    evtype_VolumeNotify: 9,

    style_Normal: 0,
    style_Emphasized: 1,
    style_Preformatted: 2,
    style_Header: 3,
    style_Subheader: 4,
    style_Alert: 5,
    style_Note: 6,
    style_BlockQuote: 7,
    style_Input: 8,
    style_User1: 9,
    style_User2: 10,
    style_NUMSTYLES: 11,

    wintype_AllTypes: 0,
    wintype_Pair: 1,
    wintype_Blank: 2,
    wintype_TextBuffer: 3,
    wintype_TextGrid: 4,
    wintype_Graphics: 5,

    winmethod_Left: 0x00,
    winmethod_Right: 0x01,
    winmethod_Above: 0x02,
    winmethod_Below: 0x03,
    winmethod_DirMask: 0x0f,

    winmethod_Fixed: 0x10,
    winmethod_Proportional: 0x20,
    winmethod_DivisionMask: 0xf0,

    winmethod_Border: 0x000,
    winmethod_NoBorder: 0x100,
    winmethod_BorderMask: 0x100,

    fileusage_Data: 0x00,
    fileusage_SavedGame: 0x01,
    fileusage_Transcript: 0x02,
    fileusage_InputRecord: 0x03,
    fileusage_TypeMask: 0x0f,

    fileusage_TextMode: 0x100,
    fileusage_BinaryMode: 0x000,

    filemode_Write: 0x01,
    filemode_Read: 0x02,
    filemode_ReadWrite: 0x03,
    filemode_WriteAppend: 0x05,

    seekmode_Start: 0,
    seekmode_Current: 1,
    seekmode_End: 2,

    stylehint_Indentation: 0,
    stylehint_ParaIndentation: 1,
    stylehint_Justification: 2,
    stylehint_Size: 3,
    stylehint_Weight: 4,
    stylehint_Oblique: 5,
    stylehint_Proportional: 6,
    stylehint_TextColor: 7,
    stylehint_BackColor: 8,
    stylehint_ReverseColor: 9,
    stylehint_NUMHINTS: 10,

    stylehint_just_LeftFlush: 0,
    stylehint_just_LeftRight: 1,
    stylehint_just_Centered: 2,
    stylehint_just_RightFlush: 3,

    imagealign_InlineUp: 1,
    imagealign_InlineDown: 2,
    imagealign_InlineCenter: 3,
    imagealign_MarginLeft: 4,
    imagealign_MarginRight: 5

};

//

class ZmachinePlatform implements Platform {
    mainElement: HTMLElement;
    zfile : Uint8Array;
    zvm;
    glk;
    focused = false;

    constructor(mainElement: HTMLElement) {
        this.mainElement = mainElement;
        $(mainElement).css('overflowY', 'auto');
    }

    async start() {
        await loadScript('./lib/zvm/ifvms.min.js');
        //await loadScript('./lib/zvm/glkote.min.js');
        //await loadScript('./lib/zvm/glkapi.js');
        //await loadScript('./lib/zvm/parchment.debug.js');

        // create divs
        var parent = this.mainElement;
        var gameport = $('<div id="gameport"/>').appendTo(parent);
        var windowport = $('<div id="windowport" class="transcript"/>').appendTo(gameport);
        var inputline = $('<input class="transcript-input" type="text"/>').appendTo(gameport).hide();
        this.glk = new GlkImpl(windowport[0], inputline[0] as HTMLInputElement);
        inputline.on('keypress', (e) => {
            this.glk.sendkey(e);
        });
        inputline.on('focus', (e) => {
            this.glk.focused = true;
        });
        inputline.on('blur', (e) => {
            this.glk.focused = false;
        });
        windowport.on('click', (e) => {
            inputline.focus();
        });
    }

    loadROM(title, data) {
        this.zfile = data;
        this.reset();
    }

    reset(): void {
        if (this.zfile == null) return;
        //this.glk = Glk;
        //this.glk = new Object();
        //Object.setPrototypeOf(this.glk, Glk);
        this.zvm = new ZVM();
        this.zvm.prepare(this.zfile.slice(0), {
            Glk: this.glk,
        });
        this.glk.reset();
        this.glk.init({
            vm: this.zvm,
        });
        console.log(this.zvm);
    }

    pause(): void {
    }
    resume(): void {
    }

    readAddress(a: number) {
        return this.zvm && a < this.zvm.ram.byteLength ? this.zvm.ram.getUint8(a) : this.zfile[a];
    }

    getPC() {
        return this.zvm.pc;
    }
    /*
    loadState(state): void {
        throw new Error("Method not implemented.");
    }
    saveState() {
        return {
            //glk: this.Glk.save_allstate(),
            io: $.extend(true, {}, this.zvm.io),
            ram: this.zvm.save_file(this.zvm.pc, 1),
            read_data: $.extend(true, {}, this.zvm.read_data),
            xorshift_seed: this.zvm.xorshift_seed,
        }
    }
    */
   
    isRunning(): boolean {
        return this.zvm != null;
    }
    advance(novideo?: boolean): number {
        // TODO?
        return 0;
    }

    getToolForFilename(s: string): string {
        return "inform6";
    }
    getDefaultExtension(): string {
        return ".inf";
    }
    showHelp(tool:string, ident?:string) {
        switch (tool) {
            case 'inform6': window.open("https://www.inform-fiction.org/manual/html/"); break;
        }
    }
    getPresets(): Preset[] {
        return ZMACHINE_PRESETS;
    }

    inspect(ident:string) {
        return inspectSymbol(this, ident);
    }

}

//

PLATFORMS['zmachine'] = ZmachinePlatform;
