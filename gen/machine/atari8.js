"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Atari8_WASMMachine = exports.Atari5200 = exports.Atari800 = void 0;
const audio_1 = require("../common/audio");
const MOS6502_1 = require("../common/cpu/MOS6502");
const devices_1 = require("../common/devices");
const emu_1 = require("../common/emu");
const wasmplatform_1 = require("../common/wasmplatform");
const antic_1 = require("./chips/antic");
const gtia_1 = require("./chips/gtia");
const pokey_1 = require("./chips/pokey");
const ATARI8_KEYMATRIX_INTL_NOSHIFT = [
    emu_1.Keys.VK_L, emu_1.Keys.VK_J, emu_1.Keys.VK_SEMICOLON, emu_1.Keys.VK_F1, emu_1.Keys.VK_F2, emu_1.Keys.VK_K, emu_1.Keys.VK_BACK_SLASH, emu_1.Keys.VK_TILDE,
    emu_1.Keys.VK_O, null, emu_1.Keys.VK_P, emu_1.Keys.VK_U, emu_1.Keys.VK_ENTER, emu_1.Keys.VK_I, emu_1.Keys.VK_MINUS2, emu_1.Keys.VK_EQUALS2,
    emu_1.Keys.VK_V, emu_1.Keys.VK_F8, emu_1.Keys.VK_C, emu_1.Keys.VK_F3, emu_1.Keys.VK_F4, emu_1.Keys.VK_B, emu_1.Keys.VK_X, emu_1.Keys.VK_Z,
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
    [emu_1.Keys.VK_SHIFT, 2, 0x1],
    /*
      [Keys.P2_UP, 0, 0x10],
      [Keys.P2_DOWN, 0, 0x20],
      [Keys.P2_LEFT, 0, 0x40],
      [Keys.P2_RIGHT, 0, 0x80],
      [Keys.P2_A, 3, 0x1],
    */
    [emu_1.Keys.START, 3, 0x1],
    [emu_1.Keys.SELECT, 3, 0x2],
    [emu_1.Keys.OPTION, 3, 0x4], // OPTION
]);
class Atari800 extends devices_1.BasicScanlineMachine {
    // TODO: save/load vars
    constructor() {
        super();
        // http://www.ataripreservation.org/websites/freddy.offenga/megazine/ISSUE5-PALNTSC.html
        this.cpuFrequency = 1789773;
        this.numTotalScanlines = 262;
        this.cpuCyclesPerLine = 114;
        this.canvasWidth = 348; // TODO?
        this.numVisibleScanlines = 224;
        this.aspectRatio = 240 / 172;
        this.firstVisibleScanline = 16;
        this.firstVisibleClock = 44 * 2; // ... to 215 * 2
        // TODO: for 400/800/5200
        this.defaultROMSize = 0x8000;
        this.overscan = true;
        this.audioOversample = 4;
        this.sampleRate = this.numTotalScanlines * 60 * this.audioOversample;
        this.inputs = new Uint8Array(4);
        this.linergb = new Uint32Array(this.canvasWidth);
        this.lastdmabyte = 0;
        this.keycode = 0;
        this.cart_80 = false;
        this.cart_a0 = false;
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
            // TODO: https://github.com/dmlloyd/atari800/blob/master/DOC/cart.txt
            read: (0, emu_1.newAddressDecoder)([
                [0x0000, 0x7fff, 0xffff, (a) => { return this.ram[a]; }],
                [0x8000, 0x9fff, 0xffff, (a) => { return this.cart_80 ? this.rom[a - 0x8000] : this.ram[a]; }],
                [0xa000, 0xbfff, 0xffff, (a) => { return this.cart_a0 ? this.rom[a - 0x8000] : this.ram[a]; }],
                [0xd000, 0xd0ff, 0x1f, (a) => { return this.gtia.readReg(a); }],
                [0xd200, 0xd2ff, 0xf, (a) => { return this.readPokey(a); }],
                [0xd300, 0xd3ff, 0xf, (a) => { return this.readPIA(a); }],
                [0xd400, 0xd4ff, 0xf, (a) => { return this.antic.readReg(a); }],
                [0xd800, 0xffff, 0xffff, (a) => { return this.bios[a - 0xd800]; }],
            ]),
            write: (0, emu_1.newAddressDecoder)([
                [0x0000, 0xbfff, 0xffff, (a, v) => { this.ram[a] = v; }],
                [0xd000, 0xd0ff, 0x1f, (a, v) => { this.gtia.setReg(a, v); }],
                [0xd200, 0xd2ff, 0xf, (a, v) => { this.writePokey(a, v); }],
                [0xd400, 0xd4ff, 0xf, (a, v) => { this.antic.setReg(a, v); }],
            ]),
        };
    }
    loadBIOS(bios) {
        this.bios.set(bios);
    }
    reset() {
        console.log(this.saveState());
        super.reset();
        this.antic.reset();
        this.gtia.reset();
        this.keycode = 0;
    }
    read(a) {
        // TODO: lastdmabyte?
        return this.bus.read(a);
    }
    // used by ANTIC
    readDMA(a) {
        let v = this.bus.read(a);
        this.probe.logVRAMRead(a, v);
        this.lastdmabyte = v;
        return v;
    }
    readConst(a) {
        return a < 0xd000 || a >= 0xe000 ? this.bus.read(a) : 0xff;
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
            this.gtia.updateGfx(this.antic.h - 1, this.lastdmabyte); // HALT pin
            this.probe.logClocks(1);
        }
        else {
            super.advanceCPU();
        }
        // update GTIA
        // get X coordinate within scanline
        let xofs = this.antic.h * 4 - this.firstVisibleClock;
        // correct for HSCROL
        if (this.antic.dliop & 0x10)
            xofs += (this.antic.regs[4] & 1) << 1;
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
        let bp = antic_1.MODE_SHIFT[this.antic.mode];
        if (bp < 8 || (xofs & 4) == 0) {
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
        this.cpu.loadState(state.c);
        this.ram.set(state.ram);
        this.antic.loadState(state.antic);
        this.gtia.loadState(state.gtia);
        this.irq_pokey.loadState(state.pokey);
        this.loadControlsState(state);
        this.lastdmabyte = state.lastdmabyte;
        this.keycode = state.keycode;
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
            keycode: this.keycode, // TODO: inputs?
        };
    }
    loadControlsState(state) {
        this.inputs.set(state.inputs);
    }
    saveControlsState() {
        return {
            inputs: this.inputs.slice(0)
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
    loadROM(rom) {
        if (rom.length != 0x2000 && rom.length != 0x4000 && rom.length != 0x8000)
            throw new Error("Sorry, this platform can only load 8/16/32 KB cartridges at the moment.");
        // TODO: support other than 8 KB carts
        // support 4/8/16/32 KB carts
        let rom2 = new Uint8Array(0x8000);
        for (let i = 0; i <= rom2.length - rom.length; i += rom.length) {
            rom2.set(rom, i);
        }
        this.cart_a0 = true; // TODO
        if (rom.length == 0x4000) {
            this.cart_80 = true;
        }
        super.loadROM(rom2);
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
///
class Atari8_WASMMachine extends wasmplatform_1.BaseWASIMachine {
    constructor() {
        super(...arguments);
        this.numTotalScanlines = 312;
        this.cpuCyclesPerLine = 63;
        this.joymask0 = 0;
        this.joymask1 = 0;
    }
    loadROM(rom) {
        super.loadROM(rom);
        this.reloadROM();
    }
    reloadROM() {
        if (this.sys) {
            var result = this.exports.machine_load_rom(this.sys, this.romptr, this.romlen);
            console.log('machine_load_rom', result);
            //console.log(this.wasmFs.fs.existsSync('atari8.img'), result);
        }
    }
    loadBIOS(srcArray) {
        super.loadBIOS(srcArray);
    }
    reset() {
        this.reloadROM();
    }
    advanceFrame(trap) {
        // TODO
        this.exports.machine_start_frame(this.sys);
        if (trap) {
            this.advanceFrameClock(trap, 999999); // TODO?
        }
        else {
            this.exports.machine_advance_frame(this.sys);
        }
        this.syncVideo();
        this.syncAudio();
        return 1;
    }
    getCPUState() {
        this.exports.machine_save_cpu_state(this.sys, this.stateptr);
        var s = this.statearr;
        var pc = s[6] + (s[7] << 8);
        return {
            PC: pc,
            SP: s[2],
            A: s[0],
            X: s[3],
            Y: s[4],
            C: s[1] & 1,
            Z: s[1] & 2,
            I: s[1] & 4,
            D: s[1] & 8,
            V: s[1] & 64,
            N: s[1] & 128,
            o: this.readConst(pc),
        };
    }
    saveState() {
        var cpu = this.getCPUState();
        this.exports.machine_save_state(this.sys, this.stateptr);
        return {
            c: cpu,
            state: this.statearr.slice(0),
            //ram:this.statearr.slice(18640, 18640+0x200), // ZP and stack
        };
    }
    loadState(state) {
        this.statearr.set(state.state);
        this.exports.machine_load_state(this.sys, this.stateptr);
    }
    getVideoParams() {
        return { width: 384, height: 240, overscan: true, videoFrequency: 60 };
    }
    pollControls() {
    }
    setKeyInput(key, code, flags) {
        // modifier flags
        if (flags & emu_1.KeyFlags.Shift)
            key |= 0x100;
        if (flags & emu_1.KeyFlags.Ctrl)
            key |= 0x200;
        // keyboard -> joystick
        var mask = 0;
        if (key == 37) {
            key = 0x8;
            mask = 0x4;
        } // LEFT
        if (key == 38) {
            key = 0xb;
            mask = 0x1;
        } // UP
        if (key == 39) {
            key = 0x9;
            mask = 0x8;
        } // RIGHT
        if (key == 40) {
            key = 0xa;
            mask = 0x2;
        } // DOWN
        if (key == 32) {
            mask = 0x100;
        } // FIRE
        // set machine inputs
        if (flags & emu_1.KeyFlags.KeyDown) {
            this.exports.machine_key_down(this.sys, key);
            this.joymask0 |= mask;
        }
        else if (flags & emu_1.KeyFlags.KeyUp) {
            this.exports.machine_key_up(this.sys, key);
            this.joymask0 &= ~mask;
        }
        this.setJoyInput(0, this.joymask0);
        this.setJoyInput(1, this.joymask1);
    }
    setJoyInput(joy, mask) {
        this.exports.machine_joy_set(this.sys, joy, mask);
    }
    setPaddleInput(controller, value) {
        this.exports.machine_paddle_set(this.sys, controller, value);
    }
}
exports.Atari8_WASMMachine = Atari8_WASMMachine;
//# sourceMappingURL=atari8.js.map