"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const audio_1 = require("../common/audio");
const waveform_1 = require("../ide/waveform");
const hdltypes_1 = require("../common/hdl/hdltypes");
const hdlruntime_1 = require("../common/hdl/hdlruntime");
const hdlwasm_1 = require("../common/hdl/hdlwasm");
const Split = require("split.js");
var VERILOG_PRESETS = [
    { id: 'clock_divider.v', name: 'Clock Divider' },
    { id: 'binary_counter.v', name: 'Binary Counter' },
    { id: 'hvsync_generator.v', name: 'Video Sync Generator' },
    { id: 'test_hvsync.v', name: 'Test Pattern' },
    { id: '7segment.v', name: '7-Segment Decoder' },
    { id: 'digits10.v', name: 'Bitmapped Digits' },
    { id: 'scoreboard.v', name: 'Scoreboard' },
    { id: 'ball_absolute.v', name: 'Ball Motion (absolute position)' },
    { id: 'ball_slip_counter.v', name: 'Ball Motion (slipping counter)' },
    { id: 'ball_paddle.v', name: 'Brick Smash Game' },
    { id: 'chardisplay.v', name: 'RAM Text Display' },
    { id: 'switches.v', name: 'Switch Inputs' },
    { id: 'paddles.v', name: 'Paddle Inputs' },
    { id: 'sprite_bitmap.v', name: 'Sprite Bitmaps' },
    { id: 'sprite_renderer.v', name: 'Sprite Rendering' },
    { id: 'racing_game.v', name: 'Racing Game' },
    { id: 'sprite_rotation.v', name: 'Sprite Rotation' },
    { id: 'tank.v', name: 'Tank Game' },
    { id: 'sound_generator.v', name: 'Sound Generator' },
    { id: 'lfsr.v', name: 'Linear Feedback Shift Register' },
    { id: 'starfield.v', name: 'Scrolling Starfield' },
    { id: 'alu.v', name: 'ALU' },
    { id: 'cpu8.v', name: 'Simple 8-Bit CPU' },
    { id: 'racing_game_cpu.v', name: 'Racing Game with CPU' },
    { id: 'framebuffer.v', name: 'Frame Buffer' },
    { id: 'tile_renderer.v', name: 'Tile Renderer' },
    { id: 'sprite_scanline_renderer.v', name: 'Sprite Scanline Renderer' },
    { id: 'cpu16.v', name: '16-Bit CPU' },
    { id: 'cpu_platform.v', name: 'CPU Platform' },
    { id: 'test2.asm', name: '16-bit ASM Game' },
    { id: 'cpu6502.v', name: '6502 CPU' },
    { id: 'test_pattern.ice', name: 'Test Pattern (Silice)' },
    { id: 'copperbars.ice', name: 'Animated Bars (Silice)' },
    { id: 'rototexture.ice', name: 'Rotating Texture (Silice)' },
    //{id:'life.ice', name:'Conway\'s Life (Silice)'},
];
var VERILOG_KEYCODE_MAP = (0, emu_1.makeKeycodeMap)([
    [emu_1.Keys.LEFT, 0, 0x1],
    [emu_1.Keys.RIGHT, 0, 0x2],
    [emu_1.Keys.UP, 0, 0x4],
    [emu_1.Keys.DOWN, 0, 0x8],
    [emu_1.Keys.A, 0, 0x10],
    [emu_1.Keys.B, 0, 0x20],
    [emu_1.Keys.P2_LEFT, 1, 0x1],
    [emu_1.Keys.P2_RIGHT, 1, 0x2],
    [emu_1.Keys.P2_UP, 1, 0x4],
    [emu_1.Keys.P2_DOWN, 1, 0x8],
    [emu_1.Keys.P2_A, 1, 0x10],
    [emu_1.Keys.P2_B, 1, 0x20],
    [emu_1.Keys.START, 2, 0x1],
    [emu_1.Keys.P2_START, 2, 0x2],
    [emu_1.Keys.SELECT, 2, 0x4],
    [emu_1.Keys.P2_SELECT, 2, 0x8],
    [emu_1.Keys.VK_7, 2, 0x10],
]);
const TRACE_BUFFER_DWORDS = 0x40000;
const CYCLES_PER_FILL = 20;
const SHOW_INTERNAL_SIGNALS = false; // TODO: make this a config value
// PLATFORM
var VerilogPlatform = function (mainElement, options) {
    this.__proto__ = new baseplatform_1.BasePlatform();
    var video;
    var audio;
    var poller;
    var useAudio = false;
    var usePaddles = false;
    var videoWidth = 292;
    var videoHeight = 256;
    var maxVideoLines = 262 + 40; // vertical hold
    var idata;
    var timer;
    var timerCallback;
    var top;
    var cyclesPerFrame = (256 + 23 + 7 + 23) * 262; // 4857480/60 Hz
    // control inputs
    var switches = [0, 0, 0];
    var keycode = 0;
    // inspect feature  
    var inspect_obj, inspect_sym;
    var inspect_data = new Uint32Array(videoWidth * videoHeight);
    // for scope
    var module_name;
    //var trace_ports;
    var trace_signals;
    var trace_buffer;
    var trace_index;
    // for virtual CRT
    var framex = 0;
    var framey = 0;
    var frameidx = 0;
    var framehsync = false;
    var framevsync = false;
    var scanlineCycles = 0;
    var RGBLOOKUP = [
        0xff222222,
        0xff2222ff,
        0xff22ff22,
        0xff22ffff,
        0xffff2222,
        0xffff22ff,
        0xffffff22,
        0xffffffff,
        0xff999999,
        0xff9999ff,
        0xff99ff99,
        0xff99ffff,
        0xffff9999,
        0xffff99ff,
        0xffffff99,
        0xff666666,
    ];
    var debugCond;
    var frameRate = 0;
    function vidtick() {
        top.tick2(1);
        if (useAudio) {
            audio.feedSample(top.state.spkr, 1);
        }
        resetKbdStrobe();
        if (debugCond && debugCond()) {
            debugCond = null;
        }
    }
    function resetKbdStrobe() {
        if (keycode && keycode >= 128 && top.state.keystrobe) { // keystrobe = clear hi bit of key buffer
            keycode = keycode & 0x7f;
            top.state.keycode = keycode;
        }
    }
    // inner Platform class
    class _VerilogPlatform extends baseplatform_1.BasePlatform {
        getPresets() { return VERILOG_PRESETS; }
        setVideoParams(width, height, clock) {
            videoWidth = width;
            videoHeight = height;
            cyclesPerFrame = clock;
            maxVideoLines = height + 40;
        }
        async start() {
            //await loadScript('./lib/binaryen.js'); // TODO: remove
            video = new emu_1.RasterVideo(mainElement, videoWidth, videoHeight, { overscan: true });
            video.create();
            poller = (0, emu_1.setKeyboardFromMap)(video, switches, VERILOG_KEYCODE_MAP, (o, key, code, flags) => {
                if (flags & emu_1.KeyFlags.KeyDown) {
                    keycode = code | 0x80;
                }
            }, true); // true = always send function
            var vcanvas = $(video.canvas);
            idata = video.getFrameData();
            timerCallback = () => {
                if (!this.isRunning())
                    return;
                if (top)
                    top.state.switches = switches[0];
                this.updateFrame();
            };
            this.setFrameRate(60);
            // setup scope
            trace_buffer = new Uint32Array(TRACE_BUFFER_DWORDS);
            var overlay = $("#emuoverlay").show();
            this.topdiv = $('<div class="emuspacer">').appendTo(overlay);
            vcanvas.appendTo(this.topdiv);
            this.wavediv = $('<div class="emuscope">').appendTo(overlay);
            this.split = Split([this.topdiv[0], this.wavediv[0]], {
                minSize: [0, 0],
                sizes: [99, 1],
                direction: 'vertical',
                gutterSize: 16,
                onDrag: () => {
                    this.resize();
                    //if (this.waveview) this.waveview.recreate();
                    //vcanvas.css('position','relative');
                    //vcanvas.css('top', -this.wavediv.height()+'px');
                },
            });
            // setup mouse events
            video.setupMouseEvents();
        }
        // TODO: pollControls() { poller.poll(); }
        resize() {
            if (this.waveview)
                this.waveview.recreate();
        }
        setGenInputs() {
            useAudio = audio != null && top.state.spkr != null;
            usePaddles = top.state.hpaddle != null || top.state.vpaddle != null;
            //TODO debugCond = this.getDebugCallback();
            top.state.switches_p1 = switches[0];
            top.state.switches_p2 = switches[1];
            top.state.switches_gen = switches[2];
            top.state.keycode = keycode;
        }
        updateVideoFrame() {
            //this.topdiv.show(); //show crt
            this.setGenInputs();
            var fps = this.getFrameRate();
            // darken the previous frame?
            var sync = fps > 45;
            if (!sync) {
                var mask = fps > 5 ? 0xe7ffffff : 0x7fdddddd;
                for (var i = 0; i < idata.length; i++)
                    idata[i] &= mask;
            }
            // paint into frame, synched with vsync if full speed
            var trace = this.isScopeVisible();
            this.updateVideoFrameCycles(Math.ceil(cyclesPerFrame * fps / 60), sync, trace);
            if (fps < 0.25) {
                idata[frameidx] = -1;
            }
            //this.restartDebugState();
            this.refreshVideoFrame();
            // set scope offset
            if (trace && this.waveview) {
                this.waveview.setCurrentTime(Math.floor(trace_index / trace_signals.length));
            }
        }
        isScopeVisible() {
            return this.split.getSizes()[1] > 2; // TODO?
        }
        // TODO: merge with prev func  
        advance(novideo) {
            this.setGenInputs();
            this.updateVideoFrameCycles(cyclesPerFrame, true, false);
            if (!novideo) {
                this.refreshVideoFrame();
            }
            if (this.isBlocked()) {
                this.pause();
            }
            return cyclesPerFrame; //TODO?
        }
        refreshVideoFrame() {
            this.updateInspectionFrame();
            video.updateFrame();
            this.updateInspectionPostFrame();
        }
        refreshScopeOverlay() {
            // TODO
        }
        updateScopeFrame() {
            this.split.setSizes([0, 100]); // ensure scope visible
            //this.topdiv.hide();// hide crt
            var done = this.fillTraceBuffer(CYCLES_PER_FILL * trace_signals.length);
            if (done)
                this.pause(); // TODO?
            // TODO
        }
        updateScope() {
            // create scope, if visible
            if (this.isScopeVisible()) {
                if (!this.waveview) {
                    this.waveview = new waveform_1.WaveformView(this.wavediv[0], this);
                }
                else {
                    this.waveview.refresh();
                }
            }
        }
        updateFrame() {
            if (!top)
                return;
            if (this.hasvideo)
                this.updateVideoFrame();
            else
                this.updateScopeFrame();
            this.updateScope();
        }
        updateInspectionFrame() {
            useAudio = false;
            if (inspect_obj && inspect_sym) {
                var COLOR_BIT_OFF = 0xffff6666;
                var COLOR_BIT_ON = 0xffff9999;
                var i = videoWidth;
                for (var y = 0; y < videoHeight - 2; y++) {
                    for (var x = 0; x < videoWidth; x++) {
                        var val = inspect_data[i];
                        idata[i++] = (val & 1) ? COLOR_BIT_ON : COLOR_BIT_OFF;
                    }
                }
            }
        }
        updateInspectionPostFrame() {
            if (inspect_obj && inspect_sym) {
                var ctx = video.getContext();
                var val = inspect_data[inspect_data.length - 1];
                ctx.fillStyle = "black";
                ctx.fillRect(18, videoHeight - 8, 100, 8);
                ctx.fillStyle = "white";
                ctx.fillText(val.toString(10) + " $" + val.toString(16), 20, videoHeight - 1);
            }
        }
        updateVideoFrameCycles(ncycles, sync, trace) {
            ncycles |= 0;
            var inspect = inspect_obj != null && inspect_sym != null;
            // use fast trace buffer-based update?
            if (sync && !trace && !inspect && top.trace != null && scanlineCycles > 0) {
                this.updateVideoFrameFast(top);
                this.updateRecorder();
                return;
            }
            // use slow cycle-by-cycle version (needed on 1st frame to set scanlineCycles anyway)
            if (!sync)
                scanlineCycles = 0;
            var trace0 = trace_index;
            while (ncycles--) {
                if (trace) {
                    this.snapshotTrace();
                    if (trace_index == trace0)
                        trace = false; // kill trace when wraps around
                }
                vidtick();
                if (framex++ < videoWidth) {
                    if (framey < videoHeight) {
                        if (inspect) {
                            inspect_data[frameidx] = inspect_obj[inspect_sym];
                        }
                        let rgb = top.state.rgb;
                        idata[frameidx] = rgb & 0x80000000 ? rgb : RGBLOOKUP[rgb & 15];
                        frameidx++;
                    }
                }
                else if (!framehsync && top.state.hsync) {
                    framehsync = true;
                }
                else if ((framehsync && !top.state.hsync) || framex > videoWidth * 2) {
                    if (sync && framehsync)
                        scanlineCycles = framex; // set cycles/scanline for fast update function
                    framehsync = false;
                    framex = 0;
                    framey++;
                    top.state.hpaddle = framey > video.paddle_x ? 1 : 0;
                    top.state.vpaddle = framey > video.paddle_y ? 1 : 0;
                }
                if (framey > maxVideoLines || top.state.vsync) {
                    framevsync = true;
                    framey = 0;
                    framex = 0;
                    frameidx = 0;
                    top.state.hpaddle = 0;
                    top.state.vpaddle = 0;
                }
                else {
                    var wasvsync = framevsync;
                    framevsync = false;
                    if (sync && wasvsync) {
                        this.updateRecorder();
                        return; // exit when vsync ends
                    }
                }
            }
        }
        tick2(cycles) {
            // if a key is pressed, check for strobe after every cycle
            if (keycode >= 128) {
                while (cycles-- > 0) {
                    top.tick2(1);
                    resetKbdStrobe();
                }
            }
            else {
                top.tick2(cycles);
            }
        }
        // use trace buffer to update video
        updateVideoFrameFast(tmod) {
            if (scanlineCycles <= 0)
                throw new Error(`scanlineCycles must be > 0`);
            var maxLineCycles = 1009; // prime number so we eventually sync up
            var nextlineCycles = scanlineCycles || maxLineCycles;
            frameidx = 0;
            // audio feed
            function spkr() { if (useAudio)
                audio.feedSample(tmod.trace.spkr, 1); }
            // iterate through a frame of scanlines + room for vsync
            for (framey = 0; framey < videoHeight * 2; framey++) {
                if (usePaddles && framey < videoHeight) {
                    top.state.hpaddle = framey > video.paddle_x ? 1 : 0;
                    top.state.vpaddle = framey > video.paddle_y ? 1 : 0;
                }
                // generate frames in trace buffer
                if (nextlineCycles > 0) {
                    this.tick2(nextlineCycles);
                }
                // convert trace buffer to video/audio
                var n = 0;
                // draw scanline visible pixels
                if (framey < videoHeight) {
                    for (framex = 0; framex < videoWidth; framex++) {
                        var rgb = tmod.trace.rgb;
                        //if (tmod.trace.hsync) rgb ^= Math.random() * 15;
                        idata[frameidx++] = rgb & 0x80000000 ? rgb : RGBLOOKUP[rgb & 15];
                        spkr();
                        tmod.nextTrace();
                    }
                    n += videoWidth;
                }
                // find hsync
                var hsyncStart = 0, hsyncEnd = 0;
                while (n < nextlineCycles) {
                    if (tmod.trace.hsync) {
                        if (!hsyncStart)
                            hsyncStart = n;
                        hsyncEnd = n;
                    }
                    else if (hsyncEnd) {
                        break;
                    }
                    spkr();
                    tmod.nextTrace();
                    n++;
                }
                // see if our scanline cycle count is stable (can't read tmod.trace after end of line)
                if (hsyncStart < hsyncEnd && hsyncEnd == nextlineCycles - 1) {
                    // scanline cycle count locked in, reset buffer to improve cache locality
                    nextlineCycles = scanlineCycles;
                }
                else if (hsyncEnd > 0) {
                    // our cycle count is not in sync with scanline
                    // say our scanline lasts 100 cycles
                    // we just read 300 cycles, and hsync ended at 80
                    // we'll toss the extra cycles in the buffer
                    // next scanline should end @ (80 + 100*N) cycles
                    // could be 180, 280, 380 ...
                    // so we should read 100*N - 300 cycles where N > 2
                    // TODO: determine scanlineCycles here instead of letting slow loop do it
                    let newCycles = scanlineCycles * 2 - ((nextlineCycles - n) % scanlineCycles);
                    //console.log('scanline', framey, scanlineCycles, nextlineCycles, n, hsyncStart, hsyncEnd, newCycles);
                    nextlineCycles = newCycles;
                }
                else {
                    nextlineCycles = maxLineCycles;
                }
                tmod.resetTrace();
                // exit when vsync starts and then stops
                if (tmod.trace.vsync) {
                    framevsync = true;
                    top.state.hpaddle = 0;
                    top.state.vpaddle = 0;
                    framex = framey = frameidx = 0;
                }
                else if (framevsync) {
                    framevsync = false;
                    break;
                }
            }
        }
        snapshotTrace() {
            var arr = trace_signals;
            for (var i = 0; i < arr.length; i++) {
                var v = arr[i];
                var z = top.state[v.name];
                trace_buffer[trace_index] = z + 0;
                trace_index++;
            }
            if (trace_index >= trace_buffer.length - arr.length)
                trace_index = 0;
        }
        fillTraceBuffer(count) {
            var max_index = Math.min(trace_buffer.length - trace_signals.length, trace_index + count);
            while (trace_index < max_index) {
                this.snapshotTrace();
                if (!top.isStopped() && !top.isFinished()) {
                    top.tick();
                }
                if (trace_index == 0)
                    break;
            }
            top.state.reset = 0; // need to de-assert reset when using no-video mode
            return (trace_index == 0);
        }
        getSignalMetadata() {
            return trace_signals;
        }
        getSignalData(index, start, len) {
            // TODO: not efficient
            var skip = this.getSignalMetadata().length;
            var last = trace_buffer.length - trace_signals.length; // TODO: refactor, and not correct
            var wrap = this.hasvideo; // TODO?
            var a = [];
            index += skip * start;
            while (index < last && a.length < len) {
                a.push(trace_buffer[index]);
                index += skip;
                if (wrap && index >= last) // TODO: what if starts with index==last
                    index = 0;
            }
            return a;
        }
        setSignalValue(index, value) {
            var meta = this.getSignalMetadata()[index];
            top.state[meta.label] = value;
            this.reset();
        }
        printErrorCodeContext(e, code) {
            if (e.lineNumber && e.message) {
                var lines = code.split('\n');
                var s = e.message + '\n';
                for (var i = 0; i < lines.length; i++) {
                    if (i > e.lineNumber - 5 && i < e.lineNumber + 5) {
                        s += lines[i] + '\n';
                    }
                }
                console.log(s);
            }
        }
        dispose() {
            if (top) {
                top.dispose();
                top = null;
            }
        }
        async loadROM(title, output) {
            var unit = output;
            var topmod = unit.modules['TOP'];
            if (unit.modules && topmod) {
                {
                    // initialize top module and constant pool
                    var useWASM = true;
                    var topcons = useWASM ? hdlwasm_1.HDLModuleWASM : hdlruntime_1.HDLModuleJS;
                    var _top = new topcons(topmod, unit.modules['@CONST-POOL@']);
                    _top.getFileData = this.sourceFileFetch;
                    await _top.init();
                    this.dispose();
                    top = _top;
                    // create signal array
                    var signals = [];
                    for (var key in topmod.vardefs) {
                        var vardef = topmod.vardefs[key];
                        if ((0, hdltypes_1.isLogicType)(vardef.dtype)) {
                            signals.push({
                                name: key,
                                label: vardef.origName,
                                input: vardef.isInput,
                                output: vardef.isOutput,
                                len: vardef.dtype.left + 1
                            });
                        }
                    }
                    trace_signals = signals;
                    if (!SHOW_INTERNAL_SIGNALS) {
                        trace_signals = trace_signals.filter((v) => { return !v.label.startsWith("__V"); }); // remove __Vclklast etc
                    }
                    trace_index = 0;
                    // reset
                    if (top instanceof hdlwasm_1.HDLModuleWASM) {
                        top.randomizeOnReset = true;
                    }
                    // query output signals -- video or not?
                    this.hasvideo = top.state.vsync != null && top.state.hsync != null && top.state.rgb != null;
                    if (this.hasvideo) {
                        const IGNORE_SIGNALS = ['clk', 'reset'];
                        trace_signals = trace_signals.filter((v) => { return IGNORE_SIGNALS.indexOf(v.name) < 0; }); // remove clk, reset
                        this.showVideoControls();
                    }
                    else {
                        this.hideVideoControls();
                    }
                }
            }
            // randomize values
            top.powercycle();
            // replace program ROM, if using the assembler
            // TODO: fix this, it ain't good
            if (output.program_rom && output.program_rom_variable) {
                if (top.state[output.program_rom_variable]) {
                    if (top.state[output.program_rom_variable].length != output.program_rom.length)
                        alert("ROM size mismatch -- expected " + top.state[output.program_rom_variable].length + " got " + output.program_rom.length);
                    else
                        top.state[output.program_rom_variable].set(output.program_rom);
                }
                else {
                    alert("No program_rom variable found (" + output.program_rom_variable + ")");
                }
            }
            // restart audio
            this.restartAudio();
            if (this.waveview) {
                this.waveview.recreate();
            }
            // assert reset pin, wait 100 cycles if using video
            this.reset();
        }
        showVideoControls() {
            $("#speed_bar").show();
            $("#run_bar").show();
            $("#dbg_record").show();
        }
        hideVideoControls() {
            $("#speed_bar").hide();
            $("#run_bar").hide();
            $("#dbg_record").hide();
        }
        restartAudio() {
            // stop/start audio
            var hasAudio = top && top.state.spkr != null && frameRate > 1;
            if (audio && !hasAudio) {
                audio.stop();
                audio = null;
            }
            else if (!audio && hasAudio) {
                audio = new audio_1.SampleAudio(cyclesPerFrame * this.getFrameRate());
                if (this.isRunning())
                    audio.start();
            }
        }
        isRunning() {
            return timer && timer.isRunning();
        }
        pause() {
            timer.stop();
            if (audio)
                audio.stop();
        }
        resume() {
            timer.start();
            if (audio)
                audio.start();
        }
        isBlocked() {
            return top && top.isFinished();
        }
        isStopped() {
            return top && top.isStopped();
        }
        setFrameRate(rateHz) {
            frameRate = rateHz;
            var fps = Math.min(60, rateHz * cyclesPerFrame);
            if (!timer || timer.frameRate != fps) {
                var running = this.isRunning();
                if (timer)
                    timer.stop();
                timer = new emu_1.AnimationTimer(fps, timerCallback);
                if (running)
                    timer.start();
            }
            if (audio) {
                audio.stop();
                audio = null;
            }
            this.restartAudio();
        }
        getFrameRate() { return frameRate; }
        reset() {
            if (!top)
                return;
            // TODO: how do we avoid clobbering user-modified signals?
            trace_index = 0;
            if (trace_buffer)
                trace_buffer.fill(0);
            if (video)
                video.setRotate(top.state.rotate ? -90 : 0);
            $("#verilog_bar").hide();
            if (this.hasvideo) {
                top.state.reset = 1;
                top.tick2(100);
                top.state.reset = 0;
            }
            else {
                top.state.reset = 1; // reset will be de-asserted later
                this.resume(); // TODO?
            }
        }
        tick() {
            if (!top)
                return;
            top.tick2(1);
        }
        getToolForFilename(fn) {
            if (fn.endsWith(".asm"))
                return "jsasm";
            else if (fn.endsWith(".ice"))
                return "silice";
            else
                return "verilator";
        }
        getDefaultExtension() { return ".v"; }
        ;
        inspect(name) {
            if (!top)
                return;
            // check for valid identifier
            if (!name || !name.match(/^\w+$/)) {
                inspect_obj = inspect_sym = null;
                return;
            }
            // search for partial name
            var val;
            for (let key in top.state) {
                if (key == name || key.endsWith("$" + name)) {
                    name = key;
                    val = top.state[name];
                }
            }
            // did we find a number?
            if (typeof (val) === 'number') {
                inspect_obj = top.state;
                inspect_sym = name;
            }
            else {
                inspect_obj = inspect_sym = null;
            }
        }
        // DEBUGGING
        getDebugTree() {
            return {
                runtime: top,
                state: top && top.getGlobals()
            };
        }
        saveState() {
            return { o: top && top.saveState() };
        }
        loadState(state) {
            if (state.o)
                top.loadState(state.o);
        }
        saveControlsState() {
            return {
                p1x: video.paddle_x,
                p1y: video.paddle_y,
                sw0: switches[0],
                sw1: switches[1],
                sw2: switches[2],
                keycode: keycode
            };
        }
        loadControlsState(state) {
            video.paddle_x = state.p1x;
            video.paddle_y = state.p1y;
            switches[0] = state.sw0;
            switches[1] = state.sw1;
            switches[2] = state.sw2;
            keycode = state.keycode;
        }
        getDownloadFile() {
            if (top instanceof hdlruntime_1.HDLModuleJS) {
                return {
                    extension: ".js",
                    blob: new Blob([top.getJSCode()], { type: "text/plain" })
                };
            }
            else if (top instanceof hdlwasm_1.HDLModuleWASM) {
                return {
                    extension: ".wat",
                    blob: new Blob([top.bmod.emitText()], { type: "text/plain" })
                };
            }
        }
        getHDLModuleRunner() {
            return top;
        }
        showHelp() {
            return "https://8bitworkshop.com/docs/platforms/verilog/";
        }
    } // end of inner class
    return new _VerilogPlatform();
};
////////////////
var VERILOG_VGA_PRESETS = [
    { id: 'hvsync_generator.v', name: 'Video Sync Generator' },
    { id: 'test_hvsync.v', name: 'Test Pattern' },
    { id: 'chardisplay.v', name: 'RAM Text Display' },
    { id: 'starfield.v', name: 'Scrolling Starfield' },
    { id: 'ball_paddle.v', name: 'Brick Smash Game' },
];
var VerilogVGAPlatform = function (mainElement, options) {
    this.__proto__ = new VerilogPlatform(mainElement, options);
    this.getPresets = function () { return VERILOG_VGA_PRESETS; };
    this.setVideoParams(800 - 64, 520, 25000000);
};
////////////////
emu_1.PLATFORMS['verilog'] = VerilogPlatform;
emu_1.PLATFORMS['verilog-vga'] = VerilogVGAPlatform;
emu_1.PLATFORMS['verilog-test'] = VerilogPlatform;
//# sourceMappingURL=verilog.js.map