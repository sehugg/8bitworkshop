"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WilliamsMachine = void 0;
const audio_1 = require("../common/audio");
const _6809_1 = require("../common/cpu/6809");
const devices_1 = require("../common/devices");
const emu_1 = require("../common/emu");
const INITIAL_WATCHDOG = 8;
const SCREEN_HEIGHT = 304;
class WilliamsMachine extends devices_1.BasicScanlineMachine {
    constructor(isDefender) {
        super();
        this.isDefender = isDefender;
        this.xtal = 12000000;
        this.cpuFrequency = this.xtal / 3 / 4;
        //cpuCyclesPerLine = 64;
        this.cpuCyclesPerLine = 54; // TODO: becuse we swapped width and height
        this.canvasWidth = 256;
        this.numTotalScanlines = 304;
        this.numVisibleScanlines = 304;
        this.defaultROMSize = 0xc000;
        this.rotate = -90;
        this.sampleRate = 1;
        this.ram = new Uint8Array(0xc000);
        this.nvram = new Uint8Array(0x400);
        this.rom = new Uint8Array(0xc000);
        this.portsel = 0;
        this.banksel = 0;
        this.watchdog_counter = 0;
        this.watchdog_enabled = false;
        this.pia6821 = new Uint8Array(8);
        this.blitregs = new Uint8Array(8);
        this.palette = new Uint32Array(16);
        this.screenNeedsRefresh = false;
        this.cpuScale = 1;
        this.waitCycles = 0;
        this.palette.fill(0xff000000);
        this.initBus(isDefender);
        this.initInputs(isDefender);
        this.initAudio();
        this.initCPU();
    }
    initInputs(isDefender) {
        var DEFENDER_KEYCODE_MAP = (0, emu_1.makeKeycodeMap)([
            [emu_1.Keys.A, 4, 0x1],
            [emu_1.Keys.RIGHT, 4, 0x2],
            [emu_1.Keys.B, 4, 0x4],
            [emu_1.Keys.VK_X, 4, 0x8],
            [emu_1.Keys.P2_START, 4, 0x10],
            [emu_1.Keys.START, 4, 0x20],
            [emu_1.Keys.LEFT, 4, 0x40],
            [emu_1.Keys.DOWN, 4, 0x80],
            [emu_1.Keys.UP, 6, 0x1],
            [emu_1.Keys.SELECT, 0, 0x4],
            [emu_1.Keys.VK_7, 0, 0x1],
            [emu_1.Keys.VK_8, 0, 0x2],
            [emu_1.Keys.VK_9, 0, 0x8],
        ]);
        var ROBOTRON_KEYCODE_MAP = (0, emu_1.makeKeycodeMap)([
            [emu_1.Keys.P2_UP, 0, 0x1],
            [emu_1.Keys.P2_DOWN, 0, 0x2],
            [emu_1.Keys.P2_LEFT, 0, 0x4],
            [emu_1.Keys.P2_RIGHT, 0, 0x8],
            [emu_1.Keys.START, 0, 0x10],
            [emu_1.Keys.P2_START, 0, 0x20],
            [emu_1.Keys.UP, 0, 0x40],
            [emu_1.Keys.DOWN, 0, 0x80],
            [emu_1.Keys.LEFT, 2, 0x1],
            [emu_1.Keys.RIGHT, 2, 0x2],
            [emu_1.Keys.VK_7, 4, 0x1],
            [emu_1.Keys.VK_8, 4, 0x2],
            [emu_1.Keys.VK_6, 4, 0x4],
            [emu_1.Keys.VK_9, 4, 0x8],
            [emu_1.Keys.SELECT, 4, 0x10],
        ]);
        var KEYCODE_MAP = isDefender ? DEFENDER_KEYCODE_MAP : ROBOTRON_KEYCODE_MAP;
        //this.inputs.set(this.pia6821);
        this.handler = (0, emu_1.newKeyboardHandler)(this.pia6821, KEYCODE_MAP);
    }
    initBus(isDefender) {
        var ioread_defender = (0, emu_1.newAddressDecoder)([
            [0x400, 0x5ff, 0x1ff, (a) => { return this.nvram[a]; }],
            [0x800, 0x800, 0, (a) => { return this.scanline; }],
            [0xc00, 0xc07, 0x7, (a) => { return this.pia6821[a]; }],
            [0x0, 0xfff, 0, (a) => { }],
        ]);
        var iowrite_defender = (0, emu_1.newAddressDecoder)([
            [0x0, 0xf, 0xf, this.setPalette.bind(this)],
            [0x3fc, 0x3ff, 0, (a, v) => { if (v == 0x38)
                    this.watchdog_counter = INITIAL_WATCHDOG; this.watchdog_enabled = true; }],
            [0x400, 0x5ff, 0x1ff, (a, v) => { this.nvram[a] = v; }],
            [0xc02, 0xc02, 0x1, (a, v) => { if (this.worker)
                    this.worker.postMessage({ command: v & 0x3f }); }],
            [0xc00, 0xc07, 0x7, (a, v) => { this.pia6821[a] = v; }],
            [0x0, 0xfff, 0, (a, v) => { }],
        ]);
        var memread_defender = (0, emu_1.newAddressDecoder)([
            [0x0000, 0xbfff, 0xffff, (a) => { return this.ram[a]; }],
            [0xc000, 0xcfff, 0x0fff, (a) => {
                    switch (this.banksel) {
                        case 0: return ioread_defender(a);
                        case 1: return this.rom[a + 0x3000];
                        case 2: return this.rom[a + 0x4000];
                        case 3: return this.rom[a + 0x5000];
                        case 7: return this.rom[a + 0x6000];
                        default: return 0; // TODO: error light
                    }
                }],
            [0xd000, 0xffff, 0xffff, (a) => { return this.rom ? this.rom[a - 0xd000] : 0; }],
        ]);
        var memwrite_defender = (0, emu_1.newAddressDecoder)([
            [0x0000, 0x97ff, 0, this.write_display_byte.bind(this)],
            [0x9800, 0xbfff, 0, (a, v) => { this.ram[a] = v; }],
            [0xc000, 0xcfff, 0x0fff, iowrite_defender.bind(this)],
            [0xd000, 0xdfff, 0, (a, v) => { this.banksel = v & 0x7; }],
            [0, 0xffff, 0, (a, v) => { }],
        ]);
        // Robotron, Joust, Bubbles, Stargate
        var ioread_robotron = (0, emu_1.newAddressDecoder)([
            [0x804, 0x807, 0x3, (a) => { return this.pia6821[a]; }],
            [0x80c, 0x80f, 0x3, (a) => { return this.pia6821[a + 4]; }],
            [0xb00, 0xbff, 0, (a) => { return this.scanline; }],
            [0xc00, 0xfff, 0x3ff, (a) => { return this.nvram[a]; }],
            [0x0, 0xfff, 0, (a) => { }],
        ]);
        var iowrite_robotron = (0, emu_1.newAddressDecoder)([
            [0x0, 0xf, 0xf, this.setPalette.bind(this)],
            [0x80c, 0x80c, 0xf, (a, v) => { if (this.worker)
                    this.worker.postMessage({ command: v }); }],
            //[0x804, 0x807, 0x3,   function(a,v) { console.log('iowrite',a); }], // TODO: sound
            //[0x80c, 0x80f, 0x3,   function(a,v) { console.log('iowrite',a+4); }], // TODO: sound
            [0x900, 0x9ff, 0, (a, v) => { this.banksel = v & 0x1; }],
            [0xa00, 0xa07, 0x7, this.setBlitter.bind(this)],
            [0xbff, 0xbff, 0, (a, v) => { if (v == 0x39) {
                    this.watchdog_counter = INITIAL_WATCHDOG;
                    this.watchdog_enabled = true;
                } }],
            [0xc00, 0xfff, 0x3ff, (a, v) => { this.nvram[a] = v; }],
            //[0x0,   0xfff, 0,     function(a,v) { console.log('iowrite',hex(a),hex(v)); }],
        ]);
        var memread_robotron = (0, emu_1.newAddressDecoder)([
            [0x0000, 0x8fff, 0xffff, (a) => { return this.banksel ? this.rom[a] : this.ram[a]; }],
            [0x9000, 0xbfff, 0xffff, (a) => { return this.ram[a]; }],
            [0xc000, 0xcfff, 0x0fff, ioread_robotron],
            [0xd000, 0xffff, 0xffff, (a) => { return this.rom ? this.rom[a - 0x4000] : 0; }],
        ]);
        var memwrite_robotron = (0, emu_1.newAddressDecoder)([
            [0x0000, 0x97ff, 0, this.write_display_byte.bind(this)],
            [0x9800, 0xbfff, 0, (a, v) => { this.ram[a] = v; }],
            [0xc000, 0xcfff, 0x0fff, iowrite_robotron.bind(this)],
            //[0x0000, 0xffff, 0,      function(a,v) { console.log(hex(a), hex(v)); }],
        ]);
        var memread_williams = isDefender ? memread_defender : memread_robotron;
        var memwrite_williams = isDefender ? memwrite_defender : memwrite_robotron;
        this.membus = {
            read: memread_williams,
            write: memwrite_williams,
        };
        this.membus = this.probeMemoryBus(this.membus);
        this.readAddress = this.membus.read;
    }
    initAudio() {
        this.master = new audio_1.MasterAudio();
        this.worker = new Worker("./src/common/audio/z80worker.js");
        let workerchannel = new audio_1.WorkerSoundChannel(this.worker);
        this.master.master.addChannel(workerchannel);
    }
    initCPU() {
        this.rom = new Uint8Array(this.defaultROMSize);
        this.cpu = this.newCPU(this.membus);
        //this.connectCPUMemoryBus(this);
    }
    newCPU(membus) {
        var cpu = Object.create((0, _6809_1.CPU6809)());
        cpu.init(membus.write, membus.read, 0);
        return cpu;
    }
    // d1d6 ldu $11 / beq $d1ed
    setPalette(a, v) {
        // RRRGGGBB
        var color = 0xff000000 | ((v & 7) << 5) | (((v >> 3) & 7) << 13) | (((v >> 6) << 22));
        if (color != this.palette[a]) {
            this.palette[a] = color;
            this.screenNeedsRefresh = true;
        }
    }
    write_display_byte(a, v) {
        this.ram[a] = v;
        this.drawDisplayByte(a, v);
        if (this.displayPCs)
            this.displayPCs[a] = this.cpu.getPC(); // save program counter
    }
    drawDisplayByte(a, v) {
        var ofs = ((a & 0xff00) << 1) | ((a & 0xff) ^ 0xff);
        this.pixels[ofs] = this.palette[v >> 4];
        this.pixels[ofs + 256] = this.palette[v & 0xf];
    }
    setBlitter(a, v) {
        if (a) {
            this.blitregs[a] = v;
        }
        else {
            var cycles = this.doBlit(v);
            this.waitCycles -= cycles * this.cpuScale; // wait CPU cycles
        }
    }
    doBlit(flags) {
        //console.log(hex(flags), blitregs);
        flags &= 0xff;
        var offs = SCREEN_HEIGHT - this.blitregs[7];
        var sstart = (this.blitregs[2] << 8) + this.blitregs[3];
        var dstart = (this.blitregs[4] << 8) + this.blitregs[5];
        var w = this.blitregs[6] ^ 4; // blitter bug fix
        var h = this.blitregs[7] ^ 4;
        if (w == 0)
            w++;
        if (h == 0)
            h++;
        if (h == 255)
            h++;
        var sxinc = (flags & 0x1) ? 256 : 1;
        var syinc = (flags & 0x1) ? 1 : w;
        var dxinc = (flags & 0x2) ? 256 : 1;
        var dyinc = (flags & 0x2) ? 1 : w;
        var pixdata = 0;
        for (var y = 0; y < h; y++) {
            var source = sstart & 0xffff;
            var dest = dstart & 0xffff;
            for (var x = 0; x < w; x++) {
                var data = this.membus.read(source);
                if (flags & 0x20) {
                    pixdata = (pixdata << 8) | data;
                    this.blit_pixel(dest, (pixdata >> 4) & 0xff, flags);
                }
                else {
                    this.blit_pixel(dest, data, flags);
                }
                source += sxinc;
                source &= 0xffff;
                dest += dxinc;
                dest &= 0xffff;
            }
            if (flags & 0x2)
                dstart = (dstart & 0xff00) | ((dstart + dyinc) & 0xff);
            else
                dstart += dyinc;
            if (flags & 0x1)
                sstart = (sstart & 0xff00) | ((sstart + syinc) & 0xff);
            else
                sstart += syinc;
        }
        return w * h * (2 + ((flags & 0x4) >> 2)); // # of memory accesses
    }
    blit_pixel(dstaddr, srcdata, flags) {
        var curpix = dstaddr < 0xc000 ? this.ram[dstaddr] : this.membus.read(dstaddr);
        var solid = this.blitregs[1];
        var keepmask = 0xff; //what part of original dst byte should be kept, based on NO_EVEN and NO_ODD flags
        //even pixel (D7-D4)
        if ((flags & 0x8) && !(srcdata & 0xf0)) { //FG only and src even pixel=0
            if (flags & 0x80)
                keepmask &= 0x0f; // no even
        }
        else {
            if (!(flags & 0x80))
                keepmask &= 0x0f; // not no even
        }
        //odd pixel (D3-D0)
        if ((flags & 0x8) && !(srcdata & 0x0f)) { //FG only and src odd pixel=0
            if (flags & 0x40)
                keepmask &= 0xf0; // no odd
        }
        else {
            if (!(flags & 0x40))
                keepmask &= 0xf0; // not no odd
        }
        curpix &= keepmask;
        if (flags & 0x10) // solid bit
            curpix |= (solid & ~keepmask);
        else
            curpix |= (srcdata & ~keepmask);
        if (dstaddr < 0x9800) // can cause recursion otherwise
            this.membus.write(dstaddr, curpix);
    }
    startScanline() {
        this.audio && this.audioadapter && this.audioadapter.generate(this.audio);
        // TODO: line-by-line
        if (this.screenNeedsRefresh && this.scanline == 0) {
            for (var i = 0; i < 0x9800; i++)
                this.drawDisplayByte(i, this.ram[i]);
            this.screenNeedsRefresh = false;
        }
        if (this.scanline == 0 && this.watchdog_enabled && this.watchdog_counter-- <= 0) {
            console.log("WATCHDOG FIRED, PC =", this.cpu.getPC().toString(16)); // TODO: alert on video
            // TODO: this.breakpointHit(cpu.T());
            this.reset();
        }
    }
    drawScanline() {
        // interrupts happen every 1/4 of the screen
        let sl = this.scanline;
        if (sl == 0 || sl == 0x3c || sl == 0xbc || sl == 0xfc) {
            if (!this.isDefender || this.pia6821[7] == 0x3c) { // TODO?
                if (this.cpu.interrupt)
                    this.cpu.interrupt();
                if (this.cpu.requestInterrupt)
                    this.cpu.requestInterrupt();
            }
        }
    }
    read(a) {
        return this.membus.read(a);
    }
    write(a, v) {
        this.membus.write(a, v);
    }
    readConst(a) {
        if (a >= 0xc000 && a <= 0xcbff)
            return 0xff;
        else
            return this.membus.read(a); // TODO
    }
    reset() {
        super.reset();
        this.watchdog_counter = INITIAL_WATCHDOG;
        this.watchdog_enabled = false;
        this.banksel = 1;
    }
    loadSoundROM(data) {
        console.log("loading sound ROM " + data.length + " bytes");
        var soundrom = (0, emu_1.padBytes)(data, 0x4000);
        this.worker.postMessage({ rom: soundrom });
    }
    loadROM(data) {
        if (data.length > 2) {
            if (this.isDefender) {
                this.loadSoundROM(data.slice(0x6800));
                data = this.rom.slice(0, 0x6800);
            }
            else if (data.length > 0xc000) {
                this.loadSoundROM(data.slice(0xc000));
                data = this.rom.slice(0, 0xc000);
            }
            else if (data.length > 0x9000 && data[0x9000]) {
                this.loadSoundROM(data.slice(0x9000));
            }
            data = (0, emu_1.padBytes)(data, 0xc000);
        }
        super.loadROM(data);
    }
    loadState(state) {
        this.cpu.loadState(state.c);
        this.ram.set(state.ram);
        this.nvram.set(state.nvram);
        this.pia6821.set(state.inputs);
        this.blitregs.set(state.blt);
        this.watchdog_counter = state.wdc;
        this.banksel = state.bs;
        this.portsel = state.ps;
    }
    saveState() {
        return {
            c: this.cpu.saveState(),
            ram: this.ram.slice(0),
            nvram: this.nvram.slice(0),
            inputs: this.pia6821.slice(0),
            blt: this.blitregs.slice(0),
            wdc: this.watchdog_counter,
            bs: this.banksel,
            ps: this.portsel,
        };
    }
    loadControlsState(state) {
        this.pia6821.set(state.inputs);
    }
    saveControlsState() {
        return {
            inputs: this.pia6821.slice(0),
        };
    }
}
exports.WilliamsMachine = WilliamsMachine;
//# sourceMappingURL=williams.js.map