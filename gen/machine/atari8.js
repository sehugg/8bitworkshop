"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Atari5200 = exports.Atari800 = void 0;
const audio_1 = require("../common/audio");
const MOS6502_1 = require("../common/cpu/MOS6502");
const devices_1 = require("../common/devices");
const emu_1 = require("../common/emu");
const util_1 = require("../common/util");
const antic_1 = require("./chips/antic");
const gtia_1 = require("./chips/gtia");
const pokey_1 = require("./chips/pokey");
const ATARI8_KEYMATRIX_INTL_NOSHIFT = [
    emu_1.Keys.VK_L, emu_1.Keys.VK_J, emu_1.Keys.VK_SEMICOLON, emu_1.Keys.VK_F4, emu_1.Keys.VK_F5, emu_1.Keys.VK_K, emu_1.Keys.VK_BACK_SLASH, emu_1.Keys.VK_TILDE,
    emu_1.Keys.VK_O, null, emu_1.Keys.VK_P, emu_1.Keys.VK_U, emu_1.Keys.VK_ENTER, emu_1.Keys.VK_I, emu_1.Keys.VK_MINUS2, emu_1.Keys.VK_EQUALS2,
    emu_1.Keys.VK_V, emu_1.Keys.VK_F7, emu_1.Keys.VK_C, emu_1.Keys.VK_F6, emu_1.Keys.VK_F4, emu_1.Keys.VK_B, emu_1.Keys.VK_X, emu_1.Keys.VK_Z,
    emu_1.Keys.VK_4, null, emu_1.Keys.VK_3, emu_1.Keys.VK_6, emu_1.Keys.VK_ESCAPE, emu_1.Keys.VK_5, emu_1.Keys.VK_2, emu_1.Keys.VK_1,
    emu_1.Keys.VK_COMMA, emu_1.Keys.VK_SPACE, emu_1.Keys.VK_PERIOD, emu_1.Keys.VK_N, null, emu_1.Keys.VK_M, emu_1.Keys.VK_SLASH, null /*invert*/,
    emu_1.Keys.VK_R, null, emu_1.Keys.VK_E, emu_1.Keys.VK_Y, emu_1.Keys.VK_TAB, emu_1.Keys.VK_T, emu_1.Keys.VK_W, emu_1.Keys.VK_Q,
    emu_1.Keys.VK_9, null, emu_1.Keys.VK_0, emu_1.Keys.VK_7, emu_1.Keys.VK_BACK_SPACE, emu_1.Keys.VK_8, null, null,
    emu_1.Keys.VK_F, emu_1.Keys.VK_H, emu_1.Keys.VK_D, null, emu_1.Keys.VK_CAPS_LOCK, emu_1.Keys.VK_G, emu_1.Keys.VK_S, emu_1.Keys.VK_A,
];
//TODO
var ATARI8_KEYCODE_MAP = (0, emu_1.makeKeycodeMap)([
    [emu_1.Keys.UP, 0, 0x1],
    [emu_1.Keys.DOWN, 0, 0x2],
    [emu_1.Keys.LEFT, 0, 0x4],
    [emu_1.Keys.RIGHT, 0, 0x8],
    [{ c: 16, n: "Shift", plyr: 0, button: 0 }, 2, 0x1],
    /*
      [Keys.P2_UP, 0, 0x10],
      [Keys.P2_DOWN, 0, 0x20],
      [Keys.P2_LEFT, 0, 0x40],
      [Keys.P2_RIGHT, 0, 0x80],
      [Keys.P2_A, 3, 0x1],
    */
    [emu_1.Keys.VK_F1, 3, 0x1],
    [emu_1.Keys.VK_F2, 3, 0x2],
    [emu_1.Keys.VK_F3, 3, 0x4], // OPTION
]);
class Atari800 extends devices_1.BasicScanlineMachine {
    // TODO: save/load vars
    constructor() {
        super();
        // http://www.ataripreservation.org/websites/freddy.offenga/megazine/ISSUE5-PALNTSC.html
        this.cpuFrequency = 1789773;
        this.numTotalScanlines = 262;
        this.cpuCyclesPerLine = 114;
        this.canvasWidth = 336;
        this.numVisibleScanlines = 224;
        this.aspectRatio = this.canvasWidth / this.numVisibleScanlines * 0.857;
        this.firstVisibleScanline = 16;
        this.firstVisibleClock = (44 - 6) * 2; // ... to 215 * 2
        this.defaultROMSize = 0x8000;
        this.overscan = true;
        this.audioOversample = 2;
        this.sampleRate = this.numTotalScanlines * 60 * this.audioOversample;
        this.run_address = -1;
        this.inputs = new Uint8Array(4);
        this.linergb = new Uint32Array(this.canvasWidth);
        this.lastdmabyte = 0;
        this.keycode = 0;
        this.cart_80 = false;
        this.cart_a0 = false;
        this.xexdata = null;
        this.keyboard_active = true;
        this.d500 = new Uint8Array(0x100);
        this.cpu = new MOS6502_1.MOS6502();
        this.ram = new Uint8Array(0x10000);
        this.bios = new Uint8Array(0x2800);
        this.bus = this.newBus();
        this.connectCPUMemoryBus(this.bus);
        // create support chips
        this.antic = new antic_1.ANTIC(this.readDMA.bind(this), this.antic_nmi.bind(this));
        this.gtia = new gtia_1.GTIA();
        this.irq_pokey = new pokey_1.POKEY(this.pokey_irq.bind(this), () => this.antic.h);
        this.audio_pokey = (0, audio_1.newPOKEYAudio)(1);
        this.audioadapter = new audio_1.TssChannelAdapter(this.audio_pokey.pokey1, this.audioOversample, this.sampleRate);
        this.handler = (0, emu_1.newKeyboardHandler)(this.inputs, ATARI8_KEYCODE_MAP, this.getKeyboardFunction(), true);
    }
    newBus() {
        return {
            read: (0, emu_1.newAddressDecoder)([
                [0x0000, 0x7fff, 0xffff, (a) => { return this.ram[a]; }],
                [0x8000, 0x9fff, 0xffff, (a) => { return this.cart_80 ? this.rom[a - 0x8000] : this.ram[a]; }],
                [0xa000, 0xbfff, 0xffff, (a) => { return this.cart_a0 ? this.rom[a - 0x8000] : this.ram[a]; }],
                [0xd000, 0xd0ff, 0x1f, (a) => { return this.gtia.readReg(a); }],
                [0xd200, 0xd2ff, 0xf, (a) => { return this.readPokey(a); }],
                [0xd300, 0xd3ff, 0xf, (a) => { return this.readPIA(a); }],
                [0xd400, 0xd4ff, 0xf, (a) => { return this.antic.readReg(a); }],
                [0xd500, 0xd5ff, 0xff, (a) => { return this.d500[a]; }],
                [0xd800, 0xffff, 0xffff, (a) => { return this.bios[a - 0xd800]; }],
            ]),
            write: (0, emu_1.newAddressDecoder)([
                [0x0000, 0xbffa, 0xffff, (a, v) => { this.ram[a] = v; }],
                [0xbffb, 0xbfff, 0xffff, (a, v) => { this.ram[a] = v; this.initCartA(); }],
                [0xd000, 0xd0ff, 0x1f, (a, v) => { this.gtia.setReg(a, v); }],
                [0xd200, 0xd2ff, 0xf, (a, v) => { this.writePokey(a, v); }],
                [0xd400, 0xd4ff, 0xf, (a, v) => { this.antic.setReg(a, v); }],
                [0xd500, 0xd5ff, 0xff, (a, v) => { this.writeMapper(a, v); }],
            ]),
        };
    }
    loadBIOS(bios) {
        this.bios.set(bios);
    }
    reset() {
        super.reset();
        this.antic.reset();
        this.gtia.reset();
        this.keycode = 0;
        //if (this.xexdata) this.cart_a0 = true; // TODO
    }
    read(a) {
        // TODO: lastdmabyte?
        return this.bus.read(a);
    }
    // used by ANTIC
    readDMA(a) {
        let v = this.bus.read(a);
        this.probe.logDMARead(a, v);
        this.lastdmabyte = v;
        return v;
    }
    readConst(a) {
        return a < 0xd000 || a >= 0xd500 ? this.bus.read(a) : 0xff;
    }
    write(a, v) {
        this.bus.write(a, v);
    }
    readPokey(a) {
        switch (a & 0xf) {
            case 9: // KBCODE
                return this.keycode & 0xff;
            case 15: // SKSTAT
                return ((~this.keycode >> 6) & 0x4) | ((~this.keycode >> 3) & 0x8) | 0x12;
            default:
                return this.irq_pokey.read(a);
        }
    }
    readPIA(a) {
        if (a == 0 || a == 1) {
            return ~this.inputs[a];
        }
    }
    writePokey(a, v) {
        this.audio_pokey.pokey1.setRegister(a, v);
        this.irq_pokey.write(a, v);
    }
    startScanline() {
        // TODO: if (this.antic.h != 0) throw new Error(this.antic.h+"");
        //if (this.cpu.isHalted()) throw new EmuHalt("CPU HALTED");
        // set GTIA switch inputs
        this.gtia.sync();
        // TODO: trigger latching mode
        for (let i = 0; i < 4; i++)
            this.gtia.readregs[gtia_1.TRIG0 + i] = (~this.inputs[2] >> i) & 1;
        // console switches
        this.gtia.readregs[gtia_1.CONSOL] = ~this.inputs[3] & 0x7;
        // advance POKEY audio
        this.audio && this.audioadapter.generate(this.audio);
        // advance POKEY IRQ timers
        this.irq_pokey.advanceScanline();
    }
    drawScanline() {
        // TODO
        let y = this.antic.v - this.firstVisibleScanline;
        if (y >= 0 && y < this.numVisibleScanlines) {
            this.pixels.set(this.linergb, y * this.canvasWidth);
        }
    }
    advanceCPU() {
        // update ANTIC
        if (this.antic.clockPulse()) {
            // ANTIC DMA cycle, update GTIA
            if (this.antic.h < 8)
                this.gtia.updateGfx(this.antic.h - 1, this.antic.v, this.lastdmabyte); // HALT pin
            if (this.antic.isWSYNC())
                this.probe.logWait(0);
            this.probe.logClocks(1);
        }
        else {
            super.advanceCPU();
        }
        // update GTIA
        // get X coordinate within scanline
        let xofs = this.antic.h * 4 - this.firstVisibleClock;
        // GTIA tick functions
        let gtiatick1 = () => {
            this.gtia.clockPulse1();
            this.linergb[xofs++] = this.gtia.rgb;
        };
        let gtiatick2 = () => {
            this.gtia.clockPulse2();
            this.linergb[xofs++] = this.gtia.rgb;
        };
        // tick 4 GTIA clocks for each CPU/ANTIC cycle
        this.gtia.clockPulse4();
        // correct for HSCROL -- bias antic +2, bias gtia -1
        if ((this.antic.dliop & 0x10) && (this.antic.regs[4] & 1)) {
            xofs += 2;
            this.gtia.setBias(-1);
        }
        else {
            this.gtia.setBias(0);
        }
        let bp = antic_1.MODE_SHIFT[this.antic.mode];
        let odd = this.antic.h & 1;
        if (bp < 8 || odd) {
            this.gtia.an = this.antic.shiftout();
        }
        gtiatick1();
        if (bp == 1) {
            this.gtia.an = this.antic.shiftout();
        }
        gtiatick2();
        if (bp <= 2) {
            this.gtia.an = this.antic.shiftout();
        }
        gtiatick1();
        if (bp == 1) {
            this.gtia.an = this.antic.shiftout();
        }
        gtiatick2();
        return 1;
    }
    loadState(state) {
        this.loadControlsState(state);
        this.cpu.loadState(state.c);
        this.ram.set(state.ram);
        this.antic.loadState(state.antic);
        this.gtia.loadState(state.gtia);
        this.irq_pokey.loadState(state.pokey);
        this.lastdmabyte = state.lastdmabyte;
        this.cart_80 = state.cart_80;
        this.cart_a0 = state.cart_a0;
    }
    saveState() {
        return {
            c: this.cpu.saveState(),
            ram: this.ram.slice(0),
            antic: this.antic.saveState(),
            gtia: this.gtia.saveState(),
            pokey: this.irq_pokey.saveState(),
            inputs: this.inputs.slice(0),
            lastdmabyte: this.lastdmabyte,
            keycode: this.keycode,
            cart_80: this.cart_80,
            cart_a0: this.cart_a0,
        };
    }
    loadControlsState(state) {
        this.inputs.set(state.inputs);
        this.keycode = state.keycode;
    }
    saveControlsState() {
        return {
            inputs: this.inputs.slice(0),
            keycode: this.keycode,
        };
    }
    getRasterScanline() {
        return this.antic.v;
    }
    getRasterLineClock() {
        return this.antic.h;
    }
    getDebugCategories() {
        return ['CPU', 'Stack', 'ANTIC', 'GTIA', 'POKEY'];
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'ANTIC': return antic_1.ANTIC.stateToLongString(state.antic);
            case 'GTIA': return gtia_1.GTIA.stateToLongString(state.gtia);
            case 'POKEY': return pokey_1.POKEY.stateToLongString(state.pokey);
        }
    }
    getKeyboardFunction() {
        return (o, key, code, flags) => {
            if (!this.keyboard_active)
                return false;
            if (flags & (emu_1.KeyFlags.KeyDown | emu_1.KeyFlags.KeyUp)) {
                //console.log(o, key, code, flags, hex(this.keycode));
                var keymap = ATARI8_KEYMATRIX_INTL_NOSHIFT;
                if (key == emu_1.Keys.VK_F9.c) {
                    this.irq_pokey.generateIRQ(0x80); // break IRQ
                    return true;
                }
                for (var i = 0; i < keymap.length; i++) {
                    if (keymap[i] && keymap[i].c == key) {
                        this.keycode = i;
                        if (flags & emu_1.KeyFlags.Shift) {
                            this.keycode |= 0x40;
                        }
                        if (flags & emu_1.KeyFlags.Ctrl) {
                            this.keycode |= 0x80;
                        }
                        if (flags & emu_1.KeyFlags.KeyDown) {
                            this.keycode |= 0x100;
                            this.irq_pokey.generateIRQ(0x40); // key pressed IRQ
                            return true;
                        }
                    }
                }
            }
            ;
        };
    }
    pokey_irq() {
        this.cpu.IRQ();
        this.probe.logInterrupt(2);
    }
    antic_nmi() {
        this.cpu.NMI();
        this.probe.logInterrupt(1);
    }
    loadROM(rom, title) {
        if ((rom[0] == 0xff && rom[1] == 0xff) && !(title === null || title === void 0 ? void 0 : title.endsWith('.rom'))) {
            // XEX file, chill out and wait for BIOS hook
            this.xexdata = rom;
        }
        else {
            this.loadCartridge(rom);
        }
    }
    loadCartridge(rom) {
        // TODO: https://github.com/dmlloyd/atari800/blob/master/DOC/cart.txt
        // strip off header
        if (rom[0] == 0x43 && rom[1] == 0x41 && rom[2] == 0x52 && rom[3] == 0x54) {
            rom = rom.slice(16);
        }
        if (rom.length != 0x1000 && rom.length != 0x2000 && rom.length != 0x4000 && rom.length != 0x8000)
            throw new Error("Sorry, this platform can only load 4/8/16/32 KB cartridges at the moment.");
        // TODO: support other than 8 KB carts
        // support 4/8/16/32 KB carts
        let rom2 = new Uint8Array(0x8000);
        for (let i = 0; i <= rom2.length - rom.length; i += rom.length) {
            rom2.set(rom, i);
        }
        this.run_address = rom2[0x7ffe] + rom2[0x7fff] * 256;
        this.cart_a0 = true; // TODO
        this.cart_80 = rom.length == 0x4000;
        super.loadROM(rom2);
    }
    writeMapper(addr, value) {
        // TODO
        if (addr == 0xff) {
            if (value == 0x80)
                this.cart_80 = false;
            if (value == 0xa0)
                this.cart_a0 = false;
        }
    }
    loadXEX(rom) {
        let ofs = 2;
        let stub = this.d500;
        let stubofs = 0; // stub routine 
        var runaddr = -1;
        // load segments into RAM
        while (ofs < rom.length) {
            let start = rom[ofs + 0] + rom[ofs + 1] * 256;
            let end = rom[ofs + 2] + rom[ofs + 3] * 256;
            console.log('XEX', (0, util_1.hex)(ofs), (0, util_1.hex)(start), (0, util_1.hex)(end));
            ofs += 4;
            for (let i = start; i <= end; i++) {
                this.ram[i] = rom[ofs++];
            }
            if (start == 0x2e0 && end == 0x2e1) {
                runaddr = this.ram[0x2e0] + this.ram[0x2e1] * 256;
                console.log('XEX run', (0, util_1.hex)(runaddr));
            }
            if (start == 0x2e2 && end == 0x2e3) {
                var initaddr = this.ram[0x2e2] + this.ram[0x2e3] * 256;
                console.log('XEX init', (0, util_1.hex)(initaddr));
                stub[stubofs++] = 0x20;
                stub[stubofs++] = initaddr & 0xff;
                stub[stubofs++] = initaddr >> 8;
            }
            if (ofs > rom.length)
                throw new Error("Bad .XEX file format");
        }
        if (runaddr >= 0) {
            // build stub routine at 0xd500
            stub[stubofs++] = 0xa9; // lda #$a0
            stub[stubofs++] = 0xa0;
            stub[stubofs++] = 0x8d; // sta $d5ff (disable cart)
            stub[stubofs++] = 0xff;
            stub[stubofs++] = 0xd5;
            stub[stubofs++] = 0x4c; // jmp runaddr
            stub[stubofs++] = runaddr & 0xff;
            stub[stubofs++] = runaddr >> 8;
            // set DOSVEC to 0xd500
            this.ram[0xa] = 0x00;
            this.ram[0xb] = 0xd5;
            this.run_address = 0xd500;
        }
    }
    initCartA() {
        if (this.cpu.getPC() == 0xf17f && this.xexdata) {
            this.loadXEX(this.xexdata);
        }
    }
}
exports.Atari800 = Atari800;
class Atari5200 extends Atari800 {
    newBus() {
        return {
            read: (0, emu_1.newAddressDecoder)([
                [0x0000, 0x3fff, 0xffff, (a) => { return this.ram[a]; }],
                [0x4000, 0xbfff, 0xffff, (a) => { return this.rom ? this.rom[a - 0x4000] : 0; }],
                [0xc000, 0xcfff, 0x1f, (a) => { return this.gtia.readReg(a); }],
                [0xd400, 0xd4ff, 0xf, (a) => { return this.antic.readReg(a); }],
                [0xe800, 0xefff, 0xf, (a) => { return this.readPokey(a); }],
                [0xf800, 0xffff, 0x7ff, (a) => { return this.bios[a]; }],
            ]),
            write: (0, emu_1.newAddressDecoder)([
                [0x0000, 0x3fff, 0xffff, (a, v) => { this.ram[a] = v; }],
                [0xc000, 0xcfff, 0x1f, (a, v) => { this.gtia.setReg(a, v); }],
                [0xd400, 0xd4ff, 0xf, (a, v) => { this.antic.setReg(a, v); }],
                [0xe800, 0xefff, 0xf, (a, v) => { this.writePokey(a, v); }],
            ]),
        };
    }
}
exports.Atari5200 = Atari5200;
//# sourceMappingURL=atari8.js.map