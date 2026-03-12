
import { Z80, Z80State } from "../common/cpu/ZilogZ80";
import { BasicScanlineMachine } from "../common/devices";
import { KeyFlags, newAddressDecoder, padBytes, Keys, makeKeycodeMap, newKeyboardHandler, EmuHalt } from "../common/emu";
import { MasterAudio, AY38910_Audio, TssChannelAdapter } from "../common/audio";

// MCR-II constants (91490 CPU board)
const MCR2_XTAL = 19968000;
const MCR2_CPU_FREQ = MCR2_XTAL / 4; // ~4.992 MHz
const MCR2_NUM_VISIBLE_SCANLINES = 480;
const MCR2_NUM_TOTAL_SCANLINES = 525;
const MCR2_CANVAS_WIDTH = 512;
const MCR2_FPS = 30;
const MCR2_CYCLES_PER_LINE = Math.floor(MCR2_CPU_FREQ / (MCR2_NUM_TOTAL_SCANLINES * MCR2_FPS));

const MCR2_TILE_COLS = 32;
const MCR2_TILE_ROWS = 30;
const MCR2_TILE_SIZE = 16;

const INITIAL_WATCHDOG = 16;

function pal3bit(v: number): number {
    v &= 7;
    return (v << 5) | (v << 2) | (v >> 1);
}

const MCR2_KEYCODE_MAP = makeKeycodeMap([
    [Keys.SELECT, 0, 0x1],    // Coin 1
    [Keys.START, 0, 0x4],     // 1P Start
    [Keys.VK_2, 0, 0x8],      // 2P Start
    [Keys.UP, 1, 0x1],        // P1 Up
    [Keys.DOWN, 1, 0x2],      // P1 Down
    [Keys.LEFT, 1, 0x4],      // P1 Left
    [Keys.RIGHT, 1, 0x8],     // P1 Right
    [Keys.A, 1, 0x10],        // P1 Button 1
    [Keys.B, 1, 0x20],        // P1 Button 2
    [Keys.P2_UP, 2, 0x1],     // P2 Up
    [Keys.P2_DOWN, 2, 0x2],   // P2 Down
    [Keys.P2_LEFT, 2, 0x4],   // P2 Left
    [Keys.P2_RIGHT, 2, 0x8],  // P2 Right
    [Keys.P2_A, 2, 0x10],     // P2 Button 1
    [Keys.P2_B, 2, 0x20],     // P2 Button 2
]);

// ROM blob layout
const ROM_PROGRAM_START = 0x0;
const ROM_PROGRAM_SIZE = 0xC000;
const ROM_BG_GFX_START = 0xC000;
const ROM_BG_GFX_SIZE = 0x4000;    // 16KB background tiles (2 bitplanes × 8KB)
const ROM_SPR_GFX_START = 0x12000;
const ROM_SPR_GFX_SIZE = 2 * 0x8000;   // 32KB sprites (4 bitplanes × 8KB)
const SSIO_ROM_SIZE = 0x4000;
const ROM_TOTAL_SIZE = ROM_PROGRAM_SIZE + ROM_BG_GFX_SIZE + ROM_SPR_GFX_SIZE + SSIO_ROM_SIZE;

export class MCR2Machine extends BasicScanlineMachine {

    cpuFrequency = MCR2_CPU_FREQ;
    canvasWidth = MCR2_CANVAS_WIDTH;
    numVisibleScanlines = MCR2_NUM_VISIBLE_SCANLINES;
    numTotalScanlines = MCR2_NUM_TOTAL_SCANLINES;
    cpuCyclesPerLine = MCR2_CYCLES_PER_LINE;
    defaultROMSize = ROM_TOTAL_SIZE;
    sampleRate = MCR2_FPS * MCR2_NUM_TOTAL_SCANLINES * 2;

    cpu = new Z80();
    ram = new Uint8Array(0x800);      // E000-E7FF (NVRAM)
    sprram = new Uint8Array(0x200);   // E800-E9FF (sprite RAM)
    vram = new Uint8Array(0x800);     // F000-F7FF (video RAM)
    palram = new Uint8Array(0x80);    // F800-F87F (palette RAM)

    palette = new Uint32Array(64);

    interruptEnabled = false;
    watchdog_counter = INITIAL_WATCHDOG;
    ctcVector = 0;

    audioadapter: TssChannelAdapter;
    psg1: AY38910_Audio;
    psg2: AY38910_Audio;

    constructor() {
        super();
        var audio = new MasterAudio();
        this.psg1 = new AY38910_Audio(audio);
        this.psg2 = new AY38910_Audio(audio);
        this.audioadapter = new TssChannelAdapter(
            [this.psg1.psg, this.psg2.psg], 2, this.sampleRate
        );

        this.connectCPUMemoryBus(this);
        this.connectCPUIOBus(this.newIOBus());
        this.inputs.set([0, 0, 0, 0xff, 0xff]); // inputs + DIP switches
        this.handler = newKeyboardHandler(this.inputs, MCR2_KEYCODE_MAP);
    }

    // Main CPU memory read
    read = newAddressDecoder([
        [0x0000, 0xBFFF, 0xFFFF, (a) => { return this.rom ? this.rom[a] : 0; }],
        [0xC000, 0xDFFF, 0x7FF, (a) => { return this.ram[a]; }],
        [0xE000, 0xE7FF, 0x1FF, (a) => { return this.sprram[a]; }],
        [0xF000, 0xF7FF, 0x7FF, (a) => { return this.vram[a]; }],
        [0xF800, 0xFFFF, 0x7F, (a) => { return this.palram[a]; }],
    ]);

    readConst(a: number): number | null {
        return this.read(a);
    }

    // Main CPU memory write
    write = newAddressDecoder([
        [0xC000, 0xDFFF, 0x7FF, (a, v) => { this.ram[a] = v; }],
        [0xE000, 0xE7FF, 0x1FF, (a, v) => { this.sprram[a] = v; }],
        [0xF000, 0xF7FF, 0x7FF, (a, v) => { this.vram[a] = v; }],
        [0xF800, 0xFFFF, 0x7F, (a, v) => {
            this.palram[a] = v;
            this.updatePalette(a);
        }],
    ]);

    // I/O bus
    newIOBus() {
        return {
            read: (addr: number) => {
                addr &= 0xFF;
                if (addr <= 0x04) {
                    return this.inputs[addr]; // SSIO input ports
                }
                if (addr >= 0x08 && addr <= 0x0F) {
                    return this.inputs[3]; // DIP switches
                }
                if (addr >= 0xF0 && addr <= 0xF3) {
                    return 0; // CTC read
                }
                return 0;
            },
            write: (addr: number, val: number) => {
                addr &= 0xFF;
                if (addr == 0xE0) {
                    this.watchdog_counter = INITIAL_WATCHDOG;
                }
                if (addr >= 0xF0 && addr <= 0xF3) {
                    // Z80 CTC write
                    // Track vector base for IM2 interrupts
                    if ((addr & 3) == 0 && !(val & 1)) {
                        // Channel 0 control word, not a vector
                    } else if ((val & 1) == 0) {
                        // Interrupt vector (even, bit 0 = 0)
                        this.ctcVector = val & 0xF8;
                    }
                }
                // SSIO sound output (ports 0x00-0x07)
                if (addr >= 0x00 && addr <= 0x07) {
                    // Sound commands - ignored for now
                }
            }
        };
    }

    // Palette: MCR 9-bit format
    // From MAME: R = ((offset&1)<<2) | (pal>>6), G = pal&7, B = (pal>>3)&7
    // Each color entry = 2 bytes; only odd byte carries color data
    updatePalette(offset: number) {
        let i = offset >> 1;
        if (i >= 64) return;
        let pal = this.palram[i * 2 + 1]; // odd byte has color data
        let r = pal3bit((pal >> 6) & 3);        // R low 2 bits from pal[7:6]
        let g = pal3bit(pal & 7);                // G from pal[2:0]
        let b = pal3bit((pal >> 3) & 7);         // B from pal[5:3]
        // R MSB comes from even byte bit 0
        let r_msb = (this.palram[i * 2] & 1) << 2;
        r = pal3bit(r_msb | ((pal >> 6) & 3));
        this.palette[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
    }

    // Draw one scanline
    drawScanline() {
        let sl = this.scanline;
        if (sl >= MCR2_NUM_VISIBLE_SCANLINES) return;

        let pixofs = sl * MCR2_CANVAS_WIDTH;
        let tileRow = Math.floor(sl / MCR2_TILE_SIZE);
        let tileY = sl % MCR2_TILE_SIZE;

        // Draw background tiles
        if (tileRow < MCR2_TILE_ROWS) {
            for (let tileCol = 0; tileCol < MCR2_TILE_COLS; tileCol++) {
                let vramOfs = (tileRow * MCR2_TILE_COLS + tileCol) * 2;
                let byte0 = this.vram[vramOfs];
                let byte1 = this.vram[vramOfs + 1];

                // 91490 tile format
                let tileCode = byte0 | ((byte1 & 0x03) << 8);
                let tilePalette = (byte1 >> 4) & 0x03;
                let flipX = (byte1 & 0x04) != 0;
                let flipY = (byte1 & 0x08) != 0;

                let ty = flipY ? (15 - tileY) : tileY;
                let pixX = tileCol * MCR2_TILE_SIZE;
                this.drawTileLine(pixofs + pixX, tileCode, ty, tilePalette, flipX);
            }
        }

        // Draw sprites on this scanline
        this.drawSpriteScanline(sl, pixofs);
    }

    // Render one row of a 16×16 background tile (2 bitplanes)
    drawTileLine(outOfs: number, tileCode: number, row: number, palette: number, flipX: boolean) {
        let gfxBase = ROM_BG_GFX_START;
        let halfSize = ROM_BG_GFX_SIZE / 2; // 8KB per bitplane

        // Tile layout: 32 bytes per tile per bitplane
        // Left 8 pixels in bytes 0-15 (one byte per row), right 8 pixels in bytes 16-31
        let tileOfs = tileCode * 32;
        let leftByteOfs = tileOfs + (row < 8 ? row : row); // rows 0-15
        let rightByteOfs = tileOfs + 16 + (row < 8 ? row : row);

        let p0L = this.rom[gfxBase + leftByteOfs] || 0;
        let p1L = this.rom[gfxBase + halfSize + leftByteOfs] || 0;
        let p0R = this.rom[gfxBase + rightByteOfs] || 0;
        let p1R = this.rom[gfxBase + halfSize + rightByteOfs] || 0;

        let colorBase = palette * 4;

        // Draw 16 pixels (left 8 + right 8)
        for (let x = 0; x < 8; x++) {
            let bit = 7 - x;
            let srcX = flipX ? (15 - x) : x;
            let color = ((p0L >> bit) & 1) | (((p1L >> bit) & 1) << 1);
            this.pixels[outOfs + srcX] = this.palette[colorBase + color];
        }
        for (let x = 0; x < 8; x++) {
            let bit = 7 - x;
            let srcX = flipX ? (7 - x) : (8 + x);
            let color = ((p0R >> bit) & 1) | (((p1R >> bit) & 1) << 1);
            this.pixels[outOfs + srcX] = this.palette[colorBase + color];
        }
    }

    // Render sprites intersecting a given scanline (91464 sprite board, 4bpp)
    drawSpriteScanline(scanline: number, pixofs: number) {
        let gfxBase = ROM_SPR_GFX_START;
        let planeSize = ROM_SPR_GFX_SIZE / 4; // 8KB per bitplane

        // Iterate sprites back-to-front (last sprite = highest priority)
        for (let sprNum = 31; sprNum >= 0; sprNum--) {
            let base = sprNum * 4;
            let sy = (this.sprram[base] - 2) & 0xFF;
            sy = 496 - sy; // Y is inverted

            let attrib = this.sprram[base + 1];
            let code = this.sprram[base + 2] | ((attrib & 0x08) ? 0x100 : 0);
            let sx = (this.sprram[base + 3] - 3) & 0x1FF;

            let flipX = (attrib & 0x10) != 0;
            let flipY = (attrib & 0x20) != 0;
            let sprPalette = (attrib & 0x03);
            let colorBase = 16 + sprPalette * 16; // sprites use palette entries 16-63

            // Check scanline intersection with 32-pixel tall sprite
            let relY = scanline - sy;
            if (relY < 0 || relY >= 32) continue;

            let row = flipY ? (31 - relY) : relY;

            // Sprite GFX layout: 4 bitplanes, each 8KB
            // Each sprite = 128 bytes per plane (32 rows × 4 columns × 1 byte)
            // x: 4 columns of 8 pixels = {col*32 + row, ...}
            let sprOfs = code * 128 + row;

            for (let col = 0; col < 4; col++) {
                let byteOfs = sprOfs + col * 32;
                let p0 = this.rom[gfxBase + byteOfs] || 0;
                let p1 = this.rom[gfxBase + planeSize + byteOfs] || 0;
                let p2 = this.rom[gfxBase + planeSize * 2 + byteOfs] || 0;
                let p3 = this.rom[gfxBase + planeSize * 3 + byteOfs] || 0;

                for (let x = 0; x < 8; x++) {
                    let bit = 7 - x;
                    let color = ((p0 >> bit) & 1) |
                                (((p1 >> bit) & 1) << 1) |
                                (((p2 >> bit) & 1) << 2) |
                                (((p3 >> bit) & 1) << 3);
                    if (color == 0) continue; // transparent

                    let px: number;
                    if (flipX) {
                        px = sx + 31 - (col * 8 + x);
                    } else {
                        px = sx + col * 8 + x;
                    }

                    if (px >= 0 && px < MCR2_CANVAS_WIDTH) {
                        this.pixels[pixofs + px] = this.palette[colorBase + color];
                    }
                }
            }
        }
    }

    startScanline() {
        this.audio && this.audioadapter && this.audioadapter.generate(this.audio);
    }

    advanceFrame(trap) {
        var steps = super.advanceFrame(trap);

        // Watchdog
        if (this.watchdog_counter-- <= 0) {
            throw new EmuHalt("WATCHDOG FIRED");
        }

        // Generate IM2 interrupt at vblank via CTC channel 0
        this.cpu.interrupt(this.ctcVector);

        return steps;
    }

    reset() {
        super.reset();
        this.watchdog_counter = INITIAL_WATCHDOG;
        this.interruptEnabled = false;
        this.ctcVector = 0;
        this.psg1.reset();
        this.psg2.reset();
    }

    loadROM(data) {
        this.rom = padBytes(data, this.defaultROMSize);
        // Rebuild palette
        for (let i = 0; i < 64; i++) {
            this.updatePalette(i * 2);
        }
    }

    loadState(state) {
        super.loadState(state);
        this.sprram.set(state.sprram);
        this.vram.set(state.vram);
        this.palram.set(state.palram);
        this.watchdog_counter = state.wdc;
        this.interruptEnabled = state.ie;
        this.ctcVector = state.ctcv;
        for (let i = 0; i < 64; i++) {
            this.updatePalette(i * 2);
        }
    }

    saveState() {
        var state = super.saveState();
        state['sprram'] = this.sprram.slice(0);
        state['vram'] = this.vram.slice(0);
        state['palram'] = this.palram.slice(0);
        state['wdc'] = this.watchdog_counter;
        state['ie'] = this.interruptEnabled;
        state['ctcv'] = this.ctcVector;
        return state;
    }
}
