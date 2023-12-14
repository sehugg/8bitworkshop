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

/*
ROM layout:
0x0000 - 0x5fff: program ROM
0x6000 - 0x67ff: sprite ROM
0x6800 - 0x7fff: audio ROM
*/

export class ExidyUGBv2 extends BasicScanlineMachine {
    cpuFrequency = 705562;
    sampleRate = 894886;
    numVisibleScanlines = 256;
    numTotalScanlines = 262;
    cpuCyclesPerLine = 0x150 >> 3;
    canvasWidth = 256;
    defaultROMSize = 0x8000 + 0x800 + 0x2800; // PRG + CHR + SOUND
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
    handler = newKeyboardHandler(this.inputs, this.keyMap); /*, (o,k,c,f) => {
        // coin inserted?
        if (o.index == 1 && o.mask == 128 && (f & KeyFlags.KeyDown)) {
            this.inputs[3] |= 0x40;
            //this.cpu.IRQ();
            //this.ram[0xa2] += 8; // TODO
        }
    });
    */
    scrnbase = 0x4000;
    charbase = 0x6800;

    bus = {
        read: newAddressDecoder([
            [0x0000, 0x03ff, 0, (a) => { return this.ram[a]; }],
            [0x1000, 0x3fff, 0, (a) => { return this.rom[a - 0x1000]; }],
            [0x4000, 0x4fff, 0, (a) => { return this.ram[a]; }],
            [0x5100, 0x51ff, 0x03, (a) => { return a == 3 ? this.int_latch() : this.inputs[a] }],
            [0x6000, 0x6fff, 0, (a) => { return this.ram[a]; }],
            [0x8000, 0xffff, 0, (a) => { return this.rom[a - 0x8000]; }],
        ]),
        write: newAddressDecoder([
            [0x0000, 0x03ff, 0, (a, v) => { this.ram[a] = v; }],
            [0x4000, 0x4fff, 0, (a, v) => { this.ram[a] = v; }],
            [0x5000, 0x5101, 0, (a, v) => { this.ram[a] = v; }], // TODO: sprite latch
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
        let sprite_ofs = 0x8000;
        this.sprite_gfx = this.rom.subarray(sprite_ofs, sprite_ofs + 32 * 32);
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

    int_latch() {
        let intsrc = this.inputs[3];
        intsrc |= (this.inputs[1] & 0x80) ? 0 : 0x40; // coin 1
        this.inputs[3] = 0x80; // clear int latch
        return intsrc; // TODO
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
        /*
        	m_gfxdecode->gfx(0)->transpen(bitmap,cliprect,
			((*m_spriteno >> 4) & 0x0f) + 32 + 16 * sprite_set_2, 1,
			0, 0, sx, sy, 0);*/
        sy += 15;
        sy -= this.scanline;
        if (sy >= 0 && sy < 16) {
            sy = 15 - sy;
            //console.log("draw sprite", sx, sy, ofs);
            let yofs = this.scanline * this.canvasWidth;
            let pix = this.sprite_gfx[ofs + sy];
            for (let x = 0; x < 8; x++) {
                if (pix & (0x80 >> x)) {
                    this.pixels[yofs + sx + x] = this.palette[palind];
                }
            }
            pix = this.sprite_gfx[ofs + sy + 16];
            for (let x = 0; x < 8; x++) {
                if (pix & (0x80 >> x)) {
                    this.pixels[yofs + sx + x + 8] = this.palette[palind];
                }
            }
        }
    }
    drawSprite1() {
        let xpos = this.ram[0x5000];
        let ypos = this.ram[0x5040];
        let set = (this.ram[0x5101] & 0x20) ? 1 : 0;
        let sprite = (this.ram[0x5100] & 0x0f) + 16 * set;
        this.drawSprite(xpos, ypos, sprite * 32, 1);
    }
    drawSprite2() {
        let xpos = this.ram[0x5080];
        let ypos = this.ram[0x50c0];
        let set = (this.ram[0x5101] & 0x40) ? 1 : 0;
        let sprite = (this.ram[0x5100] >> 4) + 16 * set;
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
        this.inputs[3] &= 0x7f; // TODO?
        this.cpu.IRQ();
    }
    getVideoParams() {
        return { width: 256, height: 256, aspect: 6/5 };
    }
}

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
                  bit 7  Enable sprite #1
                  bit 6  Enable sprite #2
    5103       R  Interrupt Condition Latch
                  bit 0  LNG0 - supposedly a language DIP switch
                  bit 1  LNG1 - supposedly a language DIP switch
                  bit 2  different for each game, but generally a collision bit
                  bit 3  TABLE - supposedly a cocktail table DIP switch
                  bit 4  different for each game, but generally a collision bit
                  bit 5  coin 2 (must activate together with $5100 bit 0)
                  bit 6  coin 1 (must activate together with $5101 bit 7)
                  bit 7  L256 - VBlank?
    5213       R  IN2 (Mouse Trap)
                  bit 3  blue button
                  bit 2  free play
                  bit 1  red button
                  bit 0  yellow button
    52XX      R/W Audio/Color Board Communications
    6000-6FFF R/W Character Generator RAM (Pepper II, Fax only)
    8000-FFF9  R  Program memory space
    FFFA-FFFF  R  Interrupt and Reset Vectors

    Exidy Sound Board:
    0000-07FF R/W RAM (mirrored every 0x7f)
    0800-0FFF R/W 6532 Timer
    1000-17FF R/W 6520 PIA
    1800-1FFF R/W 8253 Timer
    2000-27FF bit 0 Channel 1 Filter 1 enable
              bit 1 Channel 1 Filter 2 enable
              bit 2 Channel 2 Filter 1 enable
              bit 3 Channel 2 Filter 2 enable
              bit 4 Channel 3 Filter 1 enable
              bit 5 Channel 3 Filter 2 enable
    2800-2FFF 6840 Timer
    3000      Bit 0..1 Noise select
    3001      Bit 0..2 Channel 1 Amplitude
    3002      Bit 0..2 Channel 2 Amplitude
    3003      Bit 0..2 Channel 3 Amplitude
    5800-7FFF ROM

    Targ:
    5200    Sound board control
            bit 0 Music
            bit 1 Shoot
            bit 2 unused
            bit 3 Swarn
            bit 4 Sspec
            bit 5 crash
            bit 6 long
            bit 7 game

    5201    Sound board control
            bit 0 note
            bit 1 upper

    MouseTrap:
    5101    W  MouseTrap P1/P2 LED States
               bit 2  Player 1 LED state
               bit 4  Player 2 LED state

    MouseTrap Digital Sound:
    0000-3FFF ROM

    IO:
        A7 = 0: R Communication from sound processor
        A6 = 0: R CVSD Clock State
        A5 = 0: W Busy to sound processor
        A4 = 0: W Data to CVSD
*/
