import { Z80, Z80State } from "../common/cpu/ZilogZ80";
import { BasicScanlineMachine } from "../common/devices";
import { padBytes, Keys, makeKeycodeMap, newKeyboardHandler, EmuHalt } from "../common/emu";

const PACMAN_KEYCODE_MAP = makeKeycodeMap([
    [Keys.UP,    0, 0x1],
    [Keys.LEFT,  0, 0x2],
    [Keys.RIGHT, 0, 0x4],
    [Keys.DOWN,  0, 0x8],
    [Keys.VK_5,  0, 0x20],  // COIN1
    [Keys.VK_6,  0, 0x40],  // COIN2
    [Keys.A,     0, 0x80],  // FIRE (Space) — homebrew
    [Keys.START, 1, 0x20],  // START1
    [Keys.VK_2,  1, 0x40],  // START2
]);

const SCREEN_W = 224;
const SCREEN_H = 288;

/**
 * Pacman video — ported from pac-c's proven decode/draw path.
 * ROM layout in combined image:
 *   0x4000 tile ROM (4KB), 0x5000 sprite ROM (4KB),
 *   0x6000 color PROM (32B), 0x6100 palette PROM (256B)
 */
class PacmanVideo {
    tiles = new Uint8Array(256 * 64);     // decoded 8x8 tiles, 2bpp index per pixel
    sprites = new Uint8Array(64 * 256);   // decoded 16x16 sprites
    colors = new Uint32Array(32);         // RGB from color PROM
    paletteRom = new Uint8Array(0x100);   // 64 palettes × 4 pens
    spritePos = new Uint8Array(16);       // coords at 0x5060-0x506f

    constructor(
        public rom: Uint8Array,
        public vram: Uint8Array,
        public cram: Uint8Array,
        public ram: Uint8Array,
    ) {
        this.rebuild();
    }

    rebuild() {
        // Color PROM → RGBA (MAME resistor weights; must match pixeleditor pal:"pacman")
        for (var i = 0; i < 32; i++) {
            var d = this.rom[0x6000 + i];
            var r = ((d >> 0) & 1) * 0x21 + ((d >> 1) & 1) * 0x47 + ((d >> 2) & 1) * 0x97;
            var g = ((d >> 3) & 1) * 0x21 + ((d >> 4) & 1) * 0x47 + ((d >> 5) & 1) * 0x97;
            var b = ((d >> 6) & 1) * 0x51 + ((d >> 7) & 1) * 0xae;
            this.colors[i] = 0xff000000 | (b << 16) | (g << 8) | r;
        }
        this.paletteRom.set(this.rom.subarray(0x6100, 0x6200));

        // Decode tiles (pac-c decode_strip, mirrored)
        var tileRom = this.rom.subarray(0x4000, 0x5000);
        for (var t = 0; t < 256; t++) {
            var out = this.tiles.subarray(t * 64, t * 64 + 64);
            var src = tileRom.subarray(t * 16, t * 16 + 16);
            this.decodeStrip(src, 0, out, 0, 4, 8);
            this.decodeStrip(src, 8, out, 0, 0, 8);
        }

        // Decode sprites
        var sprRom = this.rom.subarray(0x5000, 0x6000);
        for (var s = 0; s < 64; s++) {
            var sout = this.sprites.subarray(s * 256, s * 256 + 256);
            var ssrc = sprRom.subarray(s * 64, s * 64 + 64);
            this.decodeStrip(ssrc, 0 * 8, sout, 8, 12, 16);
            this.decodeStrip(ssrc, 1 * 8, sout, 8, 0, 16);
            this.decodeStrip(ssrc, 2 * 8, sout, 8, 4, 16);
            this.decodeStrip(ssrc, 3 * 8, sout, 8, 8, 16);
            this.decodeStrip(ssrc, 4 * 8, sout, 0, 12, 16);
            this.decodeStrip(ssrc, 5 * 8, sout, 0, 0, 16);
            this.decodeStrip(ssrc, 6 * 8, sout, 0, 4, 16);
            this.decodeStrip(ssrc, 7 * 8, sout, 0, 8, 16);
        }
    }

    // Exact port of pac-c decode_strip — bitmaps are stored mirrored
    decodeStrip(input: Uint8Array, inOff: number, output: Uint8Array, bx: number, by: number, imgWidth: number) {
        var base = by * imgWidth + bx;
        for (var x = 0; x < 8; x++) {
            var strip = input[inOff + x];
            for (var y = 0; y < 4; y++) {
                var i = (3 - y) * imgWidth + (7 - x);
                var pen = ((strip >> y) & 1) | (((strip >> (y + 4)) & 1) << 1);
                output[base + i] = pen;
            }
        }
    }

    getPalette(palNo: number, out: Uint8Array) {
        palNo &= 0x3f;
        var o = palNo * 4;
        out[0] = this.paletteRom[o];
        out[1] = this.paletteRom[o + 1];
        out[2] = this.paletteRom[o + 2];
        out[3] = this.paletteRom[o + 3];
    }

    drawTile(pixels: Uint32Array, tileNo: number, pal: Uint8Array, x: number, y: number) {
        if (x < 0 || x >= SCREEN_W) return;
        var tile = this.tiles.subarray(tileNo * 64, tileNo * 64 + 64);
        for (var i = 0; i < 64; i++) {
            var px = i & 7;
            var py = i >> 3;
            var sx = x + px;
            if (sx < 0 || sx >= SCREEN_W) continue;
            var pen = pal[tile[i] & 3];
            pixels[(y + py) * SCREEN_W + sx] = this.colors[pen & 31];
        }
    }

    drawSprite(pixels: Uint32Array, spriteNo: number, pal: Uint8Array, x: number, y: number, flipX: boolean, flipY: boolean) {
        if (x <= -16 || x > SCREEN_W) return;
        var spr = this.sprites.subarray(spriteNo * 256, spriteNo * 256 + 256);
        for (var i = 0; i < 256; i++) {
            var px = i & 15;
            var py = i >> 4;
            var penIdx = spr[i] & 3;
            if (pal[penIdx] === 0) continue; // transparent
            var xPos = flipX ? 15 - px : px;
            var yPos = flipY ? 15 - py : py;
            var sx = x + xPos;
            var sy = y + yPos;
            if (sx < 0 || sx >= SCREEN_W || sy < 0 || sy >= SCREEN_H) continue;
            pixels[sy * SCREEN_W + sx] = this.colors[pal[penIdx] & 31];
        }
    }

    // Full-frame draw matching pac-c pac_draw()
    drawFrame(pixels: Uint32Array) {
        pixels.fill(0xff000000);
        var pal = new Uint8Array(4);

        // Bottom two rows (VRAM 0x00-0x3f): right→left, y=34..35
        var addr = 0;
        for (var y = 34; y < 36; y++) {
            for (var x = 31; x >= 0; x--) {
                this.getPalette(this.cram[addr], pal);
                this.drawTile(pixels, this.vram[addr], pal, (x - 2) * 8, y * 8);
                addr++;
            }
        }

        // Middle playfield (VRAM 0x40-0x3bf): columns right→left, rows top→bottom
        addr = 0x40;
        for (var x = 29; x >= 2; x--) {
            for (var y = 2; y <= 33; y++) {
                this.getPalette(this.cram[addr], pal);
                this.drawTile(pixels, this.vram[addr], pal, (x - 2) * 8, y * 8);
                addr++;
            }
        }

        // Top two rows (VRAM 0x3c0-0x3ff): right→left, y=0..1
        addr = 0x3c0;
        for (var y = 0; y < 2; y++) {
            for (var x = 31; x >= 0; x--) {
                this.getPalette(this.cram[addr], pal);
                this.drawTile(pixels, this.vram[addr], pal, (x - 2) * 8, y * 8);
                addr++;
            }
        }

        // 8 sprites (reverse order). Coords are from bottom-right origin.
        for (var s = 7; s >= 0; s--) {
            var info = this.ram[0x3f0 + s * 2];       // 0x4ff0
            var palNo = this.ram[0x3f0 + s * 2 + 1];
            var sx = SCREEN_W - this.spritePos[s * 2] + 15;
            var sy = SCREEN_H - this.spritePos[s * 2 + 1] - 16;
            this.getPalette(palNo, pal);
            this.drawSprite(pixels, info >> 2, pal, sx, sy, !!(info & 2), !!(info & 1));
        }
    }
}

const XTAL = 18432000.0;
const cpuFrequency = XTAL / 6;
const hsyncFrequency = XTAL / 3 / 192 / 2;
const cpuCyclesPerLine = cpuFrequency / hsyncFrequency;
const INITIAL_WATCHDOG = 256;

export class PacmanMachine extends BasicScanlineMachine {

    cpuFrequency = cpuFrequency;
    canvasWidth = SCREEN_W;
    numTotalScanlines = SCREEN_H;
    numVisibleScanlines = SCREEN_H;
    defaultROMSize = 0x8000;
    cpuCyclesPerLine = cpuCyclesPerLine | 0;
    sampleRate = 60 * 264;
    rotate = 0;

    cpu: Z80 = new Z80();
    /** Work RAM 0x4C00-0x4FFF (real PCB; 0x4800-0x4BFF is open bus). */
    ram = new Uint8Array(0x400);
    vram = new Uint8Array(0x400);
    cram = new Uint8Array(0x400);
    oram = new Uint8Array(0x100); // kept for platform debug tree compat
    gfx: PacmanVideo;

    interruptEnabled = 0;
    interruptVector = 0xff;
    /** VBlank ISR vectored at end of frame; drained before next frame's audio. */
    pendingVBlankIsr = false;
    watchdog_counter = INITIAL_WATCHDOG;
    flipScreen = 0;
    soundEnabled = 0;
    soundRegs = new Uint8Array(0x20);
    soundAcc = new Uint32Array(3);
    waveforms: Uint8Array = PacmanMachine.WAVEFORMS;
    keyMap = PACMAN_KEYCODE_MAP;
    frameDrawn = false;

    // Built-in 8 × 32 4-bit waveforms (stand-in for missing 82s126.1m/.3m)
    static WAVEFORMS = PacmanMachine.buildWaveforms();

    static buildWaveforms(): Uint8Array {
        var waves = new Uint8Array(8 * 32);
        for (var s = 0; s < 32; s++) {
            var t = s / 32;
            // 0: sine-ish
            waves[0 * 32 + s] = (8 + Math.sin(t * Math.PI * 2) * 7.5) | 0;
            // 1: square
            waves[1 * 32 + s] = s < 16 ? 15 : 0;
            // 2: triangle
            waves[2 * 32 + s] = s < 16 ? s : (31 - s);
            // 3: saw
            waves[3 * 32 + s] = (s >> 1);
            // 4-7: variants
            waves[4 * 32 + s] = s < 8 ? 15 : (s < 16 ? 0 : (s < 24 ? 10 : 0));
            waves[5 * 32 + s] = (8 + Math.sin(t * Math.PI * 4) * 7.5) | 0;
            waves[6 * 32 + s] = s & 1 ? 12 : 2;
            waves[7 * 32 + s] = ((s * 3) & 15);
        }
        return waves;
    }

    constructor() {
        super();
        this.cpu.connectIOBus({
            read: (_p) => 0xff,
            write: (port, val) => { if ((port & 0xff) === 0) this.interruptVector = val & 0xff; }
        });
        this.cpu.connectMemoryBus({ read: this.readByte, write: this.writeByte });
        this.cpu.retryInterrupts = true;
        this.rom = new Uint8Array(this.defaultROMSize);
        this.gfx = new PacmanVideo(this.rom, this.vram, this.cram, this.ram);
        this.inputs.fill(0);
        this.handler = newKeyboardHandler(this.inputs, this.keyMap);
    }

    readByte = (a: number): number => {
        a &= 0xffff;
        if (a < 0x4000) return this.rom[a];
        if (a < 0x4400) return this.vram[a - 0x4000];
        if (a < 0x4800) return this.cram[a - 0x4400];
        // 0x4800-0x4BFF: open bus on real Pac-Man (MAME returns 0xBF / nop)
        if (a < 0x4c00) return 0xbf;
        if (a < 0x5000) return this.ram[a - 0x4c00];
        if (a < 0x5100) {
            var io = a & 0xc0;
            if (io === 0x00) return ((~this.inputs[0]) & 0xff) | 0x10;       // IN0
            if (io === 0x40) return ((~this.inputs[1]) & 0x6f) | 0x90;       // IN1 upright, service off
            if (io === 0x80) return 0xc9;                                     // DSW1
            return 0xff;
        }
        if (a >= 0x8000) return this.rom[a & 0x3fff];
        return 0xff;
    }

    writeByte = (a: number, v: number): void => {
        a &= 0xffff;
        if (a < 0x4000) return;
        if (a < 0x4400) { this.vram[a - 0x4000] = v; return; }
        if (a < 0x4800) { this.cram[a - 0x4400] = v; return; }
        if (a < 0x4c00) return; // open bus — writes discarded (matches MAME nopw)
        if (a < 0x5000) { this.ram[a - 0x4c00] = v; return; }
        if ((a & 0xfff8) === 0x5000) {
            var bit = a & 7;
            if (bit === 0) this.interruptEnabled = v & 1;
            if (bit === 1) this.soundEnabled = v & 1;
            if (bit === 3) this.flipScreen = v & 1;
        } else if (a >= 0x5040 && a <= 0x505f) {
            this.soundRegs[a - 0x5040] = v & 0x0f;
        } else if ((a & 0xfff0) === 0x5060) {
            this.gfx.spritePos[a & 0xf] = v;
        } else if ((a & 0xffc0) === 0x50c0) {
            this.watchdog_counter = INITIAL_WATCHDOG;
        }
    }

    reset() {
        super.reset();
        this.cpu.reset();
        this.watchdog_counter = INITIAL_WATCHDOG;
        this.interruptEnabled = 0;
        this.interruptVector = 0xff;
        this.pendingVBlankIsr = false;
        this.soundEnabled = 0;
        this.soundRegs.fill(0);
        this.soundAcc.fill(0);
        this.extractROMData();
    }

    loadROM(data) {
        this.rom.set(padBytes(data, this.defaultROMSize));
        this.extractROMData();
    }

    extractROMData() {
        this.gfx = new PacmanVideo(this.rom, this.vram, this.cram, this.ram);
        // Prefer editable wave ROM at 0x6200 (8×32 samples); fall back to built-ins
        var custom = this.rom.subarray(0x6200, 0x6300);
        var hasCustom = false;
        for (var i = 0; i < custom.length; i++) {
            if (custom[i]) { hasCustom = true; break; }
        }
        this.waveforms = hasCustom ? custom : PacmanMachine.WAVEFORMS;
    }

    advanceCPU() { return this.cpu.advanceInsn(); }

    /** Rebuild voice frequency from low-nibble registers. Voice 0 is 20-bit; 1/2 are 16-bit. */
    private voiceFreq(v: number): number {
        var r = this.soundRegs;
        if (v === 0) {
            return r[0x10] | (r[0x11] << 4) | (r[0x12] << 8) | (r[0x13] << 12) | (r[0x14] << 16);
        }
        if (v === 1) {
            return (r[0x16] | (r[0x17] << 4) | (r[0x18] << 8) | (r[0x19] << 12)) << 4;
        }
        return (r[0x1b] | (r[0x1c] << 4) | (r[0x1d] << 8) | (r[0x1e] << 12)) << 4;
    }

    private voiceVol(v: number): number {
        if (v === 0) return this.soundRegs[0x15];
        if (v === 1) return this.soundRegs[0x1a];
        return this.soundRegs[0x1f];
    }

    private voiceWave(v: number): number {
        if (v === 0) return this.soundRegs[0x05] & 7;
        if (v === 1) return this.soundRegs[0x0a] & 7;
        return this.soundRegs[0x0f] & 7;
    }

    startScanline() {
        if (!this.audio || !this.soundEnabled) return;
        // sampleRate = 60*264 ≈ one sample per scanline; WSG runs faster — step acc multiple times
        var steps = 6; // ~96kHz / (60*264) ≈ 6
        var sum = 0;
        for (var step = 0; step < steps; step++) {
            var mix = 0;
            for (var v = 0; v < 3; v++) {
                var vol = this.voiceVol(v);
                if (!vol) continue;
                var freq = this.voiceFreq(v);
                if (!freq) continue;
                this.soundAcc[v] = (this.soundAcc[v] + freq) & 0xfffff;
                var idx = (this.soundAcc[v] >> 15) & 31; // top 5 of 20 bits
                var samp = this.waveforms[this.voiceWave(v) * 32 + idx] & 0x0f;
                mix += (samp - 8) * vol;
            }
            sum += mix;
        }
        // Normalize to roughly [-1, 1]
        this.audio.feedSample(sum / (steps * 3 * 15 * 8), 1);
    }

    drawScanline() {
        // Render the full frame once on the first scanline (pac-c style full-frame draw)
        if (this.scanline === 0) {
            this.gfx.drawFrame(this.pixels);
        }
    }

    /**
     * Z80 interrupt()/NMI() only vector PC — the ISR body runs on later advanceCPU().
     * If we leave that until mid-frame, music register writes land on uneven scanlines
     * and notes sound early/late. Drain the ISR here, between frames, before audio.
     */
    private drainVBlankIsr() {
        if (!this.pendingVBlankIsr) return;
        this.pendingVBlankIsr = false;
        // After vectoring, return PC is on the stack; RETI restores SP to this value.
        var spDone = this.cpu.getSP() + 2;
        var guard = 100000;
        while (this.cpu.getSP() !== spDone && --guard > 0) {
            this.advanceCPU();
        }
    }

    advanceFrame(trap) {
        this.drainVBlankIsr();

        var steps = super.advanceFrame(trap);
        if (--this.watchdog_counter <= 0) {
            throw new EmuHalt("WATCHDOG FIRED");
        }
        if (this.interruptEnabled) {
            // Real hardware / MAME: maskable VBLANK IRQ (IM2 + OUT vector).
            // Only mark pending if the CPU actually took the IRQ (IFF1 set).
            var spBefore = this.cpu.getSP();
            this.cpu.interrupt(this.interruptVector);
            if (this.cpu.getSP() !== spBefore) {
                this.pendingVBlankIsr = true;
            }
        }
        return steps;
    }

    loadState(state) {
        this.cpu.loadState(state.c);
        this.ram.set(state.ram);
        this.vram.set(state.vr);
        this.cram.set(state.cr);
        this.gfx.spritePos.set(state.sp || []);
        this.watchdog_counter = state.wdc;
        this.interruptEnabled = state.ie;
        this.pendingVBlankIsr = !!state.pvi;
        this.loadControlsState(state);
    }

    saveState() {
        return {
            c: this.cpu.saveState(),
            ram: this.ram.slice(0),
            vr: this.vram.slice(0),
            cr: this.cram.slice(0),
            or: this.oram.slice(0),
            sp: this.gfx.spritePos.slice(0),
            wdc: this.watchdog_counter,
            ie: this.interruptEnabled,
            pvi: this.pendingVBlankIsr,
            inputs: this.inputs.slice(0),
        };
    }

    read(a: number) { return this.readByte(a); }
    write(a: number, v: number) { this.writeByte(a, v); }
    readConst(a: number) { return this.readByte(a); }
}
