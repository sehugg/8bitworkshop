import { MOS6502 } from "../common/cpu/MOS6502";
import { BasicScanlineMachine, CPU } from "../common/devices";
import { KeyFlags, Keys, makeKeycodeMap, newAddressDecoder, newKeyboardHandler } from "../common/emu";

// https://github.com/mamedev/mame/blob/e9ac85ca86a873c67d6bc8d7cf2e37bc7696b379/src/mame/exidy/exidy.cpp#L327
// http://www.arcaderestoration.com/games/9089/Targ.aspx
// http://www.arcaderestoration.com/memorymap/9089/Targ.aspx
// http://www.arcaderestoration.com/memorymap/3933/Hard+Hat.aspx
// https://github.com/mamedev/mame/blob/74c4a0c3774e3aeb4895eb13f3c47773d34ce270/src/mame/shared/exidysound.cpp#L13

const EXIDY_KEYCODE_MAP = makeKeycodeMap([
    [Keys.START, 1, -0x1],
    //[Keys.START, 1, -0x2],
    [Keys.RIGHT, 1, -0x4],
    [Keys.LEFT, 1, -0x8],
    [Keys.A, 1, -0x10],
    [Keys.UP, 1, -0x20],
    [Keys.DOWN, 1, -0x40],
    [Keys.SELECT, 1, -0x80],
]);

export interface ExidyGameConfig {
    collision_mask: number;     // which collision bits are active
    collision_invert: number;   // which collision bits are inverted
    scrnbase: number;           // screen RAM base address
    charbase: number;           // character generator RAM base address
}

const GAME_CONFIG_DEFAULT: ExidyGameConfig = {
    collision_mask: 0x00,
    collision_invert: 0x00,
    scrnbase: 0x4000,
    charbase: 0x4800,
};

const GAME_CONFIG_VENTURE: ExidyGameConfig = {
    collision_mask: 0x04,   // M1CHAR only
    collision_invert: 0x04, // bit 2 inverted (set = no collision)
    scrnbase: 0x4000,
    charbase: 0x4800,
};

const GAME_CONFIG_MOUSETRAP: ExidyGameConfig = {
    collision_mask: 0x14,   // M1CHAR + M1M2
    collision_invert: 0x00,
    scrnbase: 0x4000,
    charbase: 0x4800,
};

const GAME_CONFIG_PEPPER2: ExidyGameConfig = {
    collision_mask: 0x14,
    collision_invert: 0x04,
    scrnbase: 0x4000,
    charbase: 0x6000,
};

/*
ROM layout (for homebrew / full-size ROMs):
0x0000 - 0x7fff: program ROM (mapped at $8000-$FFFF)
0x8000 - 0x87ff: sprite ROM (2KB, 64 sprites)
*/

export class ExidyUGBv2 extends BasicScanlineMachine {
    cpuFrequency = 705562;
    sampleRate = 894886;
    numVisibleScanlines = 256;
    numTotalScanlines = 262;
    cpuCyclesPerLine = 0x150 >> 3;
    canvasWidth = 256;
    defaultROMSize = 0x8000 + 0x2800 + 0x800; // PRG + audio ROM + CHR
    cpu = new MOS6502();
    ram = new Uint8Array(0x7000);
    color_latch = [0x54, 0xee, 0x6b]; // RGB
    palette = [
        0xff000000, 0xff0000ff, 0xffff0000, 0xffff00ff,
        0xff00ff00, 0xff00ffff, 0xffffff00, 0xffffffff,
    ];
    sprite_gfx: Uint8Array;
    inputs = new Uint8Array(4);
    keyMap = EXIDY_KEYCODE_MAP;
    handler = newKeyboardHandler(this.inputs, this.keyMap);
    scrnbase = 0x4000;
    charbase = 0x4800;

    // per-game collision configuration
    collision_mask = 0x00;
    collision_invert = 0x00;
    current_collision = 0x00;

    // PIA 6821 stub registers (for Venture sound board communication)
    pia_regs = new Uint8Array(4);

    bus = {
        read: newAddressDecoder([
            [0x0000, 0x03ff, 0, (a) => { return this.ram[a]; }],
            [0x1000, 0x3fff, 0, (a) => { return this.rom[a - 0x1000]; }],
            [0x4000, 0x4fff, 0, (a) => { return this.ram[a]; }],
            [0x5100, 0x51ff, 0x03, (a) => { return a == 3 ? this.int_latch() : this.inputs[a] }],
            [0x5200, 0x520f, 0x03, (a) => { return this.readPIA(a); }],
            [0x6000, 0x6fff, 0, (a) => { return this.ram[a]; }],
            [0x8000, 0xffff, 0, (a) => { return this.rom[a - 0x8000]; }],
        ]),
        write: newAddressDecoder([
            [0x0000, 0x03ff, 0, (a, v) => { this.ram[a] = v; }],
            [0x4000, 0x4fff, 0, (a, v) => { this.ram[a] = v; }],
            [0x5000, 0x5101, 0, (a, v) => { this.ram[a] = v; }],
            [0x5200, 0x520f, 0x03, (a, v) => { this.writePIA(a, v); }],
            [0x5210, 0x5212, 3, (a, v) => { this.setColorLatch(a, v); }],
            [0x6000, 0x6fff, 0, (a, v) => { this.ram[a] = v; }],
        ]),
    }

    constructor() {
        super();
        this.connectCPUMemoryBus(this);
        this.updatePalette();
        this.inputs[0] = 0b11101010; // dip switch
        this.inputs[1] = 0b11111111; // active low
    }

    configure(config: ExidyGameConfig) {
        this.collision_mask = config.collision_mask;
        this.collision_invert = config.collision_invert;
        this.scrnbase = config.scrnbase;
        this.charbase = config.charbase;
    }

    loadROM(rom: Uint8Array) {
        super.loadROM(rom);
        if (rom.length < 0x8000) {
            if (rom.length == 11616) { // targ
                this.rom.set(rom.slice(0x2800, 0x3000), 0x8000); // copy sprites
                this.rom.set(rom.slice(0x2700, 0x2800), 0x7f00); // copy ff00-ffff
                this.rom.set(rom.slice(0x0000, 0x2800), 0x0800); // ROM starts @ 0x1800
                this.scrnbase = 0x4000;
                this.charbase = 0x4800;
            } else if (rom.length == 14336) { // spectar
                this.rom.set(rom.slice(0x3400, 0x3800), 0x8000); // copy sprites
                this.rom.set(rom.slice(0x2f00, 0x3000), 0x7f00); // copy ff00-ffff
                this.scrnbase = 0x4000;
                this.charbase = 0x4800;
            } else {
                console.log("Warning: ROM is too small", rom.length);
            }
        }
        // sprite ROM follows program ROM at offset 0x8000
        let sprite_ofs = 0x8000;
        this.sprite_gfx = this.rom.subarray(sprite_ofs, sprite_ofs + 64 * 32);
    }

    read(a: number): number {
        return this.bus.read(a);
    }
    readConst(a: number): number {
        if (a == 0x5103) return this.inputs[3];
        return this.bus.read(a);
    }
    write(a: number, v: number): void {
        this.bus.write(a, v);
    }

    // PIA 6821 stub for sound board communication
    readPIA(a: number): number {
        return this.pia_regs[a & 3];
    }
    writePIA(a: number, v: number): void {
        this.pia_regs[a & 3] = v;
    }

    int_latch() {
        let intsrc = this.inputs[3];
        intsrc |= (this.inputs[1] & 0x80) ? 0 : 0x40; // coin 1
        // apply collision result
        let collision = this.current_collision ^ this.collision_invert;
        collision &= this.collision_mask;
        intsrc |= collision;
        this.inputs[3] = 0x80; // clear int latch
        return intsrc;
    }

    // Check if sprite 1 pixel overlaps a non-zero background character pixel
    checkCollisionM1CHAR(): boolean {
        let xpos = this.ram[0x5000];
        let ypos = this.ram[0x5040];
        let sx = 236 - xpos - 4;
        let sy = 244 - ypos - 4;
        let sprite_enable = this.ram[0x5101];
        // sprite 1 enabled check: not enabled if bit 7 set AND bit 4 clear
        if ((sprite_enable & 0x80) && !(sprite_enable & 0x10)) {
            if (this.collision_mask != 0) return false;
        }
        let set = (sprite_enable & 0x20) ? 1 : 0;
        let sprite = (this.ram[0x5100] & 0x0f) + 16 * set;
        let ofs = sprite * 32;
        for (let row = 0; row < 16; row++) {
            let py = sy + row;
            if (py < 0 || py >= 256) continue;
            let tileRow = py >> 3;
            let charY = py & 7;
            let pixL = this.sprite_gfx[ofs + row];
            let pixR = this.sprite_gfx[ofs + row + 16];
            for (let col = 0; col < 16; col++) {
                let pix = col < 8 ? pixL : pixR;
                let bit = col < 8 ? (0x80 >> col) : (0x80 >> (col - 8));
                if (!(pix & bit)) continue;
                let px = sx + col;
                if (px < 0 || px >= 256) continue;
                let tileCol = px >> 3;
                let code = this.ram[this.scrnbase + tileRow * 32 + tileCol];
                let charPix = this.ram[this.charbase + code * 8 + charY];
                if (charPix & (0x80 >> (px & 7))) {
                    return true;
                }
            }
        }
        return false;
    }

    // Check if sprite 1 and sprite 2 overlap (M1M2)
    checkCollisionM1M2(): boolean {
        let x1 = 236 - this.ram[0x5000] - 4;
        let y1 = 244 - this.ram[0x5040] - 4;
        let x2 = 236 - this.ram[0x5080] - 4;
        let y2 = 244 - this.ram[0x50c0] - 4;
        // bounding box overlap check first
        if (x1 + 16 <= x2 || x2 + 16 <= x1 || y1 + 16 <= y2 || y2 + 16 <= y1) {
            return false;
        }
        let sprite_enable = this.ram[0x5101];
        let set1 = (sprite_enable & 0x20) ? 1 : 0;
        let spr1 = ((this.ram[0x5100] & 0x0f) + 16 * set1) * 32;
        let set2 = (sprite_enable & 0x40) ? 1 : 0;
        let spr2 = ((this.ram[0x5100] >> 4) + 32 + 16 * set2) * 32;
        // pixel-level collision
        let overlapX0 = Math.max(x1, x2);
        let overlapX1 = Math.min(x1 + 16, x2 + 16);
        let overlapY0 = Math.max(y1, y2);
        let overlapY1 = Math.min(y1 + 16, y2 + 16);
        for (let py = overlapY0; py < overlapY1; py++) {
            let row1 = py - y1;
            let row2 = py - y2;
            for (let px = overlapX0; px < overlapX1; px++) {
                let col1 = px - x1;
                let col2 = px - x2;
                let pix1 = col1 < 8 ? this.sprite_gfx[spr1 + row1] : this.sprite_gfx[spr1 + row1 + 16];
                let bit1 = col1 < 8 ? (0x80 >> col1) : (0x80 >> (col1 - 8));
                let pix2 = col2 < 8 ? this.sprite_gfx[spr2 + row2] : this.sprite_gfx[spr2 + row2 + 16];
                let bit2 = col2 < 8 ? (0x80 >> col2) : (0x80 >> (col2 - 8));
                if ((pix1 & bit1) && (pix2 & bit2)) {
                    return true;
                }
            }
        }
        return false;
    }

    updatePalette() {
        /* motion object 1 */
        this.set_1_color(0, 0);
        this.set_1_color(1, 7);

        /* motion object 2 */
        this.set_1_color(2, 0);
        this.set_1_color(3, 6);

        /* characters */
        this.set_1_color(4, 4);
        this.set_1_color(5, 3);
        this.set_1_color(6, 2);
        this.set_1_color(7, 1);
    }
    set_1_color(index: number, dipsw: number) {
        let r = (this.color_latch[0] & (1 << dipsw)) ? 1 : 0;
        let g = (this.color_latch[1] & (1 << dipsw)) ? 2 : 0;
        let b = (this.color_latch[2] & (1 << dipsw)) ? 4 : 0;
        this.palette[index] = RGB8[r | g | b];
    }
    setColorLatch(a: number, v: number): void {
        this.color_latch[a & 3] = v;
        this.updatePalette();
    }
    drawSprite(xpos: number, ypos: number, ofs: number, palind: number) {
        var sx = 236 - xpos - 4;
        var sy = 244 - ypos - 4;
        sy += 15;
        sy -= this.scanline;
        if (sy >= 0 && sy < 16) {
            sy = 15 - sy;
            let yofs = this.scanline * this.canvasWidth;
            let pix = this.sprite_gfx[ofs + sy];
            for (let x = 0; x < 8; x++) {
                if (pix & (0x80 >> x)) {
                    let dx = sx + x;
                    if (dx >= 0 && dx < 256)
                        this.pixels[yofs + dx] = this.palette[palind];
                }
            }
            pix = this.sprite_gfx[ofs + sy + 16];
            for (let x = 0; x < 8; x++) {
                if (pix & (0x80 >> x)) {
                    let dx = sx + x + 8;
                    if (dx >= 0 && dx < 256)
                        this.pixels[yofs + dx] = this.palette[palind];
                }
            }
        }
    }
    drawSprite1() {
        let sprite_enable = this.ram[0x5101];
        // sprite 1 enabled check
        if ((sprite_enable & 0x80) && !(sprite_enable & 0x10)) {
            if (this.collision_mask != 0) return;
        }
        let xpos = this.ram[0x5000];
        let ypos = this.ram[0x5040];
        let set = (sprite_enable & 0x20) ? 1 : 0;
        let sprite = (this.ram[0x5100] & 0x0f) + 16 * set;
        this.drawSprite(xpos, ypos, sprite * 32, 1);
    }
    drawSprite2() {
        let sprite_enable = this.ram[0x5101];
        // sprite 2 enabled if bit 6 clear (or collision_mask == 0 for old hw)
        if ((sprite_enable & 0x40) && this.collision_mask != 0) return;
        let xpos = this.ram[0x5080];
        let ypos = this.ram[0x50c0];
        let set = (sprite_enable & 0x40) ? 1 : 0;
        let sprite = (this.ram[0x5100] >> 4) + 32*0 /* TODO? */ + 16 * set;
        this.drawSprite(xpos, ypos, sprite * 32, 3);
    }
    startScanline(): void {
    }
    drawScanline(): void {
        const y = this.scanline;
        const row = y >> 3;
        const yofs = y * this.canvasWidth;
        for (let x = 0; x < 256; x++) {
            const col = x >> 3;
            let code = this.ram[this.scrnbase + row * 32 + col];
            let color1 = 4 + ((code >> 6) & 0x03);
            let pix = this.ram[this.charbase + code * 8 + (y & 7)];
            let palind = (pix & (0x80 >> (x & 7))) ? color1 : 0;
            this.pixels[yofs + x] = this.palette[palind];
        }
        this.drawSprite2();
        this.drawSprite1();
    }
    postFrame() {
        // compute collisions once per frame
        this.current_collision = 0;
        if (this.collision_mask & 0x04) { // M1CHAR
            if (this.checkCollisionM1CHAR()) this.current_collision |= 0x04;
        }
        if (this.collision_mask & 0x10) { // M1M2
            if (this.checkCollisionM1M2()) this.current_collision |= 0x10;
        }
        this.inputs[3] &= 0x7f;
        this.cpu.IRQ();
    }
    getVideoParams() {
        return { width: 256, height: 256, aspect: 6/5 };
    }
}

export { GAME_CONFIG_DEFAULT, GAME_CONFIG_VENTURE, GAME_CONFIG_MOUSETRAP, GAME_CONFIG_PEPPER2 };

const RGB8 = [
    0xff000000, 0xff0000ff, 0xff00ff00, 0xff00ffff,
    0xffff0000, 0xffff00ff, 0xffffff00, 0xffffffff,
];


/*
    0000-00FF R/W Zero Page RAM
    0100-01FF R/W Stack RAM
    0200-03FF R/W Scratchpad RAM
    0800-3FFF  R  Program ROM              (Targ, Spectar only)
    1A00       R  PX3 (Player 2 inputs)    (Fax only)
                  bit 4  D
                  bit 5  C
                  bit 6  B
                  bit 7  A
    1C00       R  PX2 (Player 1 inputs)    (Fax only)
                  bit 0  2 player start
                  bit 1  1 player start
                  bit 4  D
                  bit 5  C
                  bit 6  B
                  bit 7  A
    2000-3FFF  R  Banked question ROM      (Fax only)
    4000-43FF R/W Screen RAM
    4800-4FFF R/W Character Generator RAM (except Pepper II and Fax)
    5000       W  Motion Object 1 Horizontal Position Latch (sprite 1 X)
    5040       W  Motion Object 1 Vertical Position Latch   (sprite 1 Y)
    5080       W  Motion Object 2 Horizontal Position Latch (sprite 2 X)
    50C0       W  Motion Object 2 Vertical Position Latch   (sprite 2 Y)
    5100       R  Option Dipswitch Port
                  bit 0  coin 2 (NOT inverted) (must activate together with $5103 bit 5)
                  bit 1-2  bonus
                  bit 3-4  coins per play
                  bit 5-6  lives
                  bit 7  US/UK coins
    5100       W  Motion Objects Image Latch
                  Sprite number  bits 0-3 Sprite #1  4-7 Sprite #2
    5101       R  Control Inputs Port
                  bit 0  start 1
                  bit 1  start 2
                  bit 2  right
                  bit 3  left
                  bit 5  up
                  bit 6  down
                  bit 7  coin 1 (must activate together with $5103 bit 6)
    5101       W  Output Control Latch (not used in PEPPER II upright)
                  bit 5  Sprite set select for sprite #1
                  bit 6  Sprite set select for sprite #2
                  bit 7  Enable sprite #1
    5103       R  Interrupt Condition Latch
                  bit 0  LNG0 - supposedly a language DIP switch
                  bit 1  LNG1 - supposedly a language DIP switch
                  bit 2  M1CHAR collision (sprite 1 vs background)
                  bit 3  TABLE - supposedly a cocktail table DIP switch
                  bit 4  M1M2 collision (sprite 1 vs sprite 2)
                  bit 5  coin 2 (must activate together with $5100 bit 0)
                  bit 6  coin 1 (must activate together with $5101 bit 7)
                  bit 7  L256 - VBlank?
    5200-520F R/W PIA 6821 (Venture, Mouse Trap, Pepper II, Fax)
    5200-5201  W  Sound board control (Targ, Spectar)
    5210-5212  W  Color Latches (active for all games)
    6000-6FFF R/W Character Generator RAM (Pepper II, Fax only)
    8000-FFF9  R  Program memory space
    FFFA-FFFF  R  Interrupt and Reset Vectors
*/
