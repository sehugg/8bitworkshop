
import { Z80, Z80State } from "../common/cpu/ZilogZ80";
import { BasicScanlineMachine } from "../common/devices";
import { KeyFlags, newAddressDecoder, padBytes, noise, Keys, makeKeycodeMap, newKeyboardHandler, EmuHalt } from "../common/emu";
import { TssChannelAdapter, MasterAudio, AY38910_Audio } from "../common/audio";
import { hex } from "../common/util";

const GALAXIAN_KEYCODE_MAP = makeKeycodeMap([
    [Keys.A, 0, 0x10], // P1
    [Keys.LEFT, 0, 0x4],
    [Keys.RIGHT, 0, 0x8],
    [Keys.P2_A, 1, 0x10], // P2
    [Keys.P2_LEFT, 1, 0x4],
    [Keys.P2_RIGHT, 1, 0x8],
    [Keys.SELECT, 0, 0x1],
    [Keys.START, 1, 0x1],
    [Keys.VK_2, 1, 0x2],
]);

const SCRAMBLE_KEYCODE_MAP = makeKeycodeMap([
    [Keys.UP, 0, -0x1], // P1
    [Keys.B, 0, -0x2], // fire
    [Keys.VK_7, 0, -0x4], // credit
    [Keys.A, 0, -0x8], // bomb
    [Keys.RIGHT, 0, -0x10],
    [Keys.LEFT, 0, -0x20],
    [Keys.VK_6, 0, -0x40],
    [Keys.SELECT, 0, -0x80],
    [Keys.START, 1, -0x80],
    [Keys.VK_2, 1, -0x40],
    [Keys.DOWN, 2, -0x40],
    //[Keys.VK_UP,    2, -0x10],
]);

const bitcolors = [
    0x000021, 0x000047, 0x000097, // red
    0x002100, 0x004700, 0x009700, // green
    0x510000, 0xae0000            // blue
];

const GalaxianVideo = function (rom: Uint8Array, vram: Uint8Array, oram: Uint8Array, palette: Uint32Array, options) {

    var gfxBase = options.gfxBase || 0x2800;
    this.missileWidth = options.missileWidth || 4;
    this.missileOffset = options.missileOffset || 0;
    this.showOffscreenObjects = false;
    this.frameCounter = 0;
    this.starsEnabled = 0;
    var stars = [];
    for (var i = 0; i < 256; i++)
        stars[i] = noise();

    this.advanceFrame = function () {
        this.frameCounter = (this.frameCounter + 1) & 0xff;
    }

    this.drawScanline = function (pixels, sl) {
        var pixofs = sl * 264;
        // hide offscreen on left + right (b/c rotated)
        if (!this.showOffscreenObjects && (sl < 16 || sl >= 240)) {
            for (var i = 0; i < 264; i++)
                pixels[pixofs + i] = 0xff000000;
            return; // offscreen
        }
        // draw tiles
        var outi = pixofs; // starting output pixel in frame buffer
        for (var xx = 0; xx < 32; xx++) {
            var xofs = xx;
            var scroll = oram[xofs * 2]; // even entries control scroll position
            var attrib = oram[xofs * 2 + 1]; // odd entries control the color base
            var sl2 = (sl + scroll) & 0xff;
            var vramofs = (sl2 >> 3) << 5; // offset in VRAM
            var yy = sl2 & 7; // y offset within tile
            var tile = vram[vramofs + xofs]; // TODO: why undefined?
            var color0 = (attrib & 7) << 2;
            var addr = gfxBase + (tile << 3) + yy;
            var data1 = rom[addr];
            var data2 = rom[addr + 0x800];
            for (var i = 0; i < 8; i++) {
                var bm = 128 >> i;
                var color = color0 + ((data1 & bm) ? 1 : 0) + ((data2 & bm) ? 2 : 0);
                pixels[outi] = palette[color];
                outi++;
            }
        }
        // draw sprites
        for (var sprnum = 7; sprnum >= 0; sprnum--) {
            var base = (sprnum << 2) + 0x40;
            var base0 = oram[base];
            var sy = 240 - (base0 - ((sprnum < 3) ? 1 : 0)); // the first three sprites match against y-1
            var yy = (sl - sy);
            if (yy >= 0 && yy < 16) {
                var sx = oram[base + 3] + 1; // +1 pixel offset from tiles
                if (sx == 0 && !this.showOffscreenObjects) {
                    continue; // drawn off-buffer
                }
                var code = oram[base + 1];
                var flipx = code & 0x40; // TODO: flipx
                if (code & 0x80) // flipy
                    yy = 15 - yy;
                code &= 0x3f;
                var color0 = (oram[base + 2] & 7) << 2;
                var addr = gfxBase + (code << 5) + (yy < 8 ? yy : yy + 8);
                outi = pixofs + sx; //<< 1
                var data1 = rom[addr];
                var data2 = rom[addr + 0x800];
                for (var i = 0; i < 8; i++) {
                    var bm = 128 >> i;
                    var color = ((data1 & bm) ? 1 : 0) + ((data2 & bm) ? 2 : 0);
                    if (color)
                        pixels[flipx ? (outi + 15 - i) : (outi + i)] = palette[color0 + color];
                }
                var data1 = rom[addr + 8];
                var data2 = rom[addr + 0x808];
                for (var i = 0; i < 8; i++) {
                    var bm = 128 >> i;
                    var color = ((data1 & bm) ? 1 : 0) + ((data2 & bm) ? 2 : 0);
                    if (color)
                        pixels[flipx ? (outi + 7 - i) : (outi + i + 8)] = palette[color0 + color];
                }
            }
        }
        // draw bullets/shells
        var shell = 0xff;
        var missile = 0xff;
        for (var which = 0; which < 8; which++) {
            var sy = oram[0x60 + (which << 2) + 1];
            if (((sy + sl - ((which < 3) ? 1 : 0)) & 0xff) == 0xff) {
                if (which != 7)
                    shell = which;
                else
                    missile = which;
            }
        }
        for (var i = 0; i < 2; i++) {
            which = i ? missile : shell;
            if (which != 0xff) {
                var sx = 255 - oram[0x60 + (which << 2) + 3];
                var outi = pixofs + sx - this.missileOffset;
                var col = which == 7 ? 0xffffff00 : 0xffffffff;
                for (var j = 0; j < this.missileWidth; j++)
                    pixels[outi++] = col;
            }
        }
        // draw stars
        if (this.starsEnabled) {
            var starx = ((this.frameCounter + stars[sl & 0xff]) & 0xff);
            if ((starx + sl) & 0x10) {
                var outi = pixofs + starx;
                if ((pixels[outi] & 0xffffff) == 0) {
                    pixels[outi] = palette[sl & 0x1f];
                }
            }
        }
    }

}

const XTAL = 18432000.0;
const scanlinesPerFrame = 264;
const cpuFrequency = XTAL / 6; // 3.072 MHz
const hsyncFrequency = XTAL / 3 / 192 / 2; // 16 kHz
const vsyncFrequency = hsyncFrequency / 132 / 2; // 60.606060 Hz
const vblankDuration = 1 / vsyncFrequency * (20 / 132); // 2500 us
const cpuCyclesPerLine = cpuFrequency / hsyncFrequency;
const INITIAL_WATCHDOG = 8;

const audioOversample = 2;
const audioSampleRate = 60 * scanlinesPerFrame; // why not hsync?

export class GalaxianMachine extends BasicScanlineMachine {

    options = {};
    palBase = 0x3800;
    keyMap = GALAXIAN_KEYCODE_MAP;

    cpuFrequency = cpuFrequency;
    canvasWidth = 264;
    numTotalScanlines = 264;
    numVisibleScanlines = 264;
    defaultROMSize = 0x4000;
    sampleRate = audioSampleRate * audioOversample;
    cpuCyclesPerLine = cpuCyclesPerLine | 0;
    rotate = 90;

    cpu: Z80 = new Z80();
    ram = new Uint8Array(0x800);
    vram = new Uint8Array(0x400);
    oram = new Uint8Array(0x100);
    palette: Uint32Array;
    gfx; // GalaxianVideo
    audioadapter;
    psg1: AY38910_Audio;
    psg2: AY38910_Audio;
    watchdog_counter: number = 0;
    interruptEnabled: number = 0;
    defaultInputs: number[] = [0xe, 0x8, 0x0];

    constructor() {
        super();
        var audio = new MasterAudio();
        this.psg1 = new AY38910_Audio(audio);
        this.psg2 = new AY38910_Audio(audio);
        this.audioadapter = new TssChannelAdapter([this.psg1.psg, this.psg2.psg], audioOversample, this.sampleRate);
        this.init();
    }

    init() {
        this.rom = new Uint8Array(this.defaultROMSize);
        this.palette = new Uint32Array(new ArrayBuffer(32 * 4));
        this.gfx = new GalaxianVideo(this.rom, this.vram, this.oram, this.palette, this.options);
        this.connectCPUMemoryBus(this);
        this.connectCPUIOBus(this.newIOBus());
        this.inputs.set(this.defaultInputs);
        this.handler = newKeyboardHandler(this.inputs, this.keyMap);
    }

    read = newAddressDecoder([
        [0x0000, 0x3fff, 0, (a) => { return this.rom ? this.rom[a] : null; }],
        [0x4000, 0x47ff, 0x3ff, (a) => { return this.ram[a]; }],
        [0x5000, 0x57ff, 0x3ff, (a) => { return this.vram[a]; }],
        [0x5800, 0x5fff, 0xff, (a) => { return this.oram[a]; }],
        [0x6000, 0x6000, 0, (a) => { return this.inputs[0]; }],
        [0x6800, 0x6800, 0, (a) => { return this.inputs[1]; }],
        [0x7000, 0x7000, 0, (a) => { return this.inputs[2]; }],
        [0x7800, 0x7800, 0, (a) => { this.watchdog_counter = INITIAL_WATCHDOG; }],
    ]);
    
    readConst(a : number) {
        return (a < 0x7000) ? this.read(a) : null;
    }

    write = newAddressDecoder([
        [0x4000, 0x47ff, 0x3ff, (a, v) => { this.ram[a] = v; }],
        [0x5000, 0x57ff, 0x3ff, (a, v) => { this.vram[a] = v; }],
        [0x5800, 0x5fff, 0xff, (a, v) => { this.oram[a] = v; }],
        //[0x6004, 0x6007, 0x3,    function(a,v) => { }], // lfo freq
        //[0x6800, 0x6807, 0x7,    function(a,v) => { }], // sound
        //[0x7800, 0x7800, 0x7,    function(a,v) => { }], // pitch
        //[0x6000, 0x6003, 0x3, (a, v) => { this.outlatches[a] = v; }],
        [0x7001, 0x7001, 0, (a, v) => { this.interruptEnabled = v & 1; }],
        [0x7004, 0x7004, 0, (a, v) => { this.gfx.starsEnabled = v & 1; }],
    ]);

    newIOBus() {
        return {
            read: (addr) => {
                return 0;
            },
            write: (addr, val) => {
                if (addr & 0x1) { this.psg1.selectRegister(val & 0xf); };
                if (addr & 0x2) { this.psg1.setData(val); };
                if (addr & 0x4) { this.psg2.selectRegister(val & 0xf); };
                if (addr & 0x8) { this.psg2.setData(val); };
            }
        };
    }

    reset() {
        super.reset();
        this.psg1.reset();
        this.psg2.reset();
        this.watchdog_counter = INITIAL_WATCHDOG;
    }

    startScanline() {
        this.audio && this.audioadapter && this.audioadapter.generate(this.audio);
    }

    drawScanline() {
        this.gfx.drawScanline(this.pixels, this.scanline);
    }

    advanceFrame(trap) {
        var steps = super.advanceFrame(trap);

        // advance graphics
        this.gfx.advanceFrame();
        // clear bottom of screen?
        if (!this.gfx.showOffscreenObjects) {
            for (var i = 0; i < 264; i++)
                this.pixels.fill(0xff000000, 256 + i * 264, 264 + i * 264);
        }
        // watchdog fired?
        if (this.watchdog_counter-- <= 0) {
            throw new EmuHalt("WATCHDOG FIRED");
        }
        // NMI interrupt @ 0x66
        if (this.interruptEnabled) { this.cpu.NMI(); }

        return steps;
    }

    loadROM(data) {
        this.rom.set(padBytes(data, this.defaultROMSize));
        for (var i = 0; i < 32; i++) {
            var b = this.rom[this.palBase + i];
            this.palette[i] = 0xff000000;
            for (var j = 0; j < 8; j++)
                if (((1 << j) & b))
                    this.palette[i] += bitcolors[j];
        }
    }

    loadState(state) {
        super.loadState(state);
        this.vram.set(state.bv);
        this.oram.set(state.bo);
        this.watchdog_counter = state.wdc;
        this.interruptEnabled = state.ie;
        this.gfx.starsEnabled = state.se;
        this.gfx.frameCounter = state.fc;
    }

    saveState() {
        var state = super.saveState();
        state['bv'] = this.vram.slice(0);
        state['bo'] = this.oram.slice(0);
        state['fc'] = this.gfx.frameCounter;
        state['ie'] = this.interruptEnabled;
        state['se'] = this.gfx.starsEnabled;
        state['wdc'] = this.watchdog_counter;
        return state;
    }

}

export class GalaxianScrambleMachine extends GalaxianMachine {

    defaultROMSize = 0x5020;
    palBase = 0x5000;
    scramble = true;
    keyMap = SCRAMBLE_KEYCODE_MAP;
    options = {
        gfxBase: 0x4000,
        missileWidth: 1,
        missileOffset: 6,
    };
    defaultInputs = [0xff, 0xfc, 0xf1];

    constructor() {
        super();
        this.init(); // TODO: why do we have to call twice?
    }

    read = newAddressDecoder([
        [0x0000, 0x3fff, 0, (a) => { return this.rom[a]; }],
        [0x4000, 0x47ff, 0x7ff, (a) => { return this.ram[a]; }],
        [0x4800, 0x4fff, 0x3ff, (a) => { return this.vram[a]; }],
        [0x5000, 0x5fff, 0xff, (a) => { return this.oram[a]; }],
        [0x7000, 0x7000, 0, (a) => { this.watchdog_counter = INITIAL_WATCHDOG; }],
        [0x7800, 0x7800, 0, (a) => { this.watchdog_counter = INITIAL_WATCHDOG; }],
        //[0x8000, 0x820f, 0,      function(a) { return noise(); }], // TODO: remove
        [0x8100, 0x8100, 0, (a) => { return this.inputs[0]; }],
        [0x8101, 0x8101, 0, (a) => { return this.inputs[1]; }],
        [0x8102, 0x8102, 0, (a) => { return this.inputs[2] | this.scramble_protection_alt_r(); }],
        [0x8202, 0x8202, 0, (a) => { return this.m_protection_result; }], // scramble (protection)
        [0x9100, 0x9100, 0, (a) => { return this.inputs[0]; }],
        [0x9101, 0x9101, 0, (a) => { return this.inputs[1]; }],
        [0x9102, 0x9102, 0, (a) => { return this.inputs[2] | this.scramble_protection_alt_r(); }],
        [0x9212, 0x9212, 0, (a) => { return this.m_protection_result; }], // scramble (protection)
        //[0, 0xffff, 0, function(a) { console.log(hex(a)); return 0; }]
    ]);
    write = newAddressDecoder([
        [0x4000, 0x47ff, 0x7ff, (a, v) => { this.ram[a] = v; }],
        [0x4800, 0x4fff, 0x3ff, (a, v) => { this.vram[a] = v; }],
        [0x5000, 0x5fff, 0xff, (a, v) => { this.oram[a] = v; }],
        [0x6801, 0x6801, 0, (a, v) => { this.interruptEnabled = v & 1; /*console.log(a,v,cpu.getPC().toString(16));*/ }],
        [0x6802, 0x6802, 0, (a, v) => { /* TODO: coin counter */ }],
        [0x6803, 0x6803, 0, (a, v) => { /* TODO: backgroundColor = (v & 1) ? 0xFF000056 : 0xFF000000; */ }],
        [0x6804, 0x6804, 0, (a, v) => { this.gfx.starsEnabled = v & 1; }],
        [0x6808, 0x6808, 0, (a, v) => { this.gfx.missileWidth = v; }], // not on h/w
        [0x6809, 0x6809, 0, (a, v) => { this.gfx.missileOffset = v; }], // not on h/w
        [0x8202, 0x8202, 0, this.scramble_protection_w.bind(this)],
        //[0x8100, 0x8103, 0, function(a,v){ /* PPI 0 */ }],
        //[0x8200, 0x8203, 0, function(a,v){ /* PPI 1 */ }],
        //[0, 0xffff, 0, function(a,v) { console.log(hex(a),hex(v)); }]
    ]);

    m_protection_state = 0;
    m_protection_result = 0;
    scramble_protection_w(addr, data) {
        /*
            This is not fully understood; the low 4 bits of port C are
            inputs; the upper 4 bits are outputs. Scramble main set always
            writes sequences of 3 or more nibbles to the low port and
            expects certain results in the upper nibble afterwards.
        */
        this.m_protection_state = (this.m_protection_state << 4) | (data & 0x0f);
        switch (this.m_protection_state & 0xfff) {
            /* scramble */
            case 0xf09: this.m_protection_result = 0xff; break;
            case 0xa49: this.m_protection_result = 0xbf; break;
            case 0x319: this.m_protection_result = 0x4f; break;
            case 0x5c9: this.m_protection_result = 0x6f; break;

            /* scrambls */
            case 0x246: this.m_protection_result ^= 0x80; break;
            case 0xb5f: this.m_protection_result = 0x6f; break;
        }
    }
    scramble_protection_alt_r() {
        var bit = (this.m_protection_result >> 7) & 1;
        return (bit << 5) | ((bit ^ 1) << 7);
    }
}
