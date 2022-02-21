/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 *
 * TMS9918A VDP emulation.
 *
 * https://github.com/Rasmus-M/Js99er
 * GNU General Public License v2.0
 */

import { hex, lpad, RGBA } from "../util";
import { ProbeVRAM, NullProbe } from "../devices";

enum TMS9918A_Mode {
  GRAPHICS = 0,
  TEXT = 1,
  BITMAP = 2,
  MULTICOLOR = 3,
  MODE4 = 4,
  BITMAP_TEXT = 5,
  BITMAP_MULTICOLOR = 6,
  ILLEGAL = 7,
};

interface CPUInterface {
    setVDPInterrupt(b:boolean);
}

export class TMS9918A {

  cru : { setVDPInterrupt: (b:boolean) => void };
  enableFlicker : boolean;
  probe : ProbeVRAM = new NullProbe();

  ram = new Uint8Array(16384); // VDP RAM
  registers = new Uint8Array(8);
  spriteBuffer = new Uint8Array(256);
  addressRegister : number;
  statusRegister : number;

  palette : number[];

  latch : boolean;
  prefetchByte : number;

  displayOn : boolean = false;
  interruptsOn : boolean = false;
  screenMode : number;
  bitmapMode : boolean;
  textMode : boolean;
  colorTable : number;
  nameTable : number;
  charPatternTable : number;
  spriteAttributeTable : number;
  spritePatternTable : number;
  colorTableMask : number;
  patternTableMask : number;
  ramMask : number;
  fgColor : number;
  bgColor : number;

  flicker : boolean;
  redrawRequired : boolean;

  fb32 : Uint32Array;

  width : number;
  height : number;

  constructor(fb32:Uint32Array, cru:CPUInterface, enableFlicker:boolean) {

    this.fb32 = fb32;
    this.cru = cru;
    this.enableFlicker = enableFlicker;

    this.palette = [
        RGBA(0, 0, 0),
        RGBA(0, 0, 0),
        RGBA(33, 200, 66),
        RGBA(94, 220, 120),
        RGBA(84, 85, 237),
        RGBA(125, 118, 252),
        RGBA(212, 82, 77),
        RGBA(66, 235, 245),
        RGBA(252, 85, 84),
        RGBA(255, 121, 120),
        RGBA(212, 193, 84),
        RGBA(230, 206, 128),
        RGBA(33, 176, 59),
        RGBA(201, 91, 186),
        RGBA(204, 204, 204),
        RGBA(255, 255, 255)
    ];
  }

    reset() {

        var i;
        this.ram.fill(0);
        this.registers.fill(0);
        
        this.addressRegister = 0;
        this.statusRegister = 0;

        this.prefetchByte = 0;
        this.latch = false;

        this.displayOn = false;
        this.interruptsOn = false;
        this.screenMode = TMS9918A_Mode.GRAPHICS;
        this.bitmapMode = false;
        this.textMode = false;
        this.colorTable = 0;
        this.nameTable = 0;
        this.charPatternTable = 0;
        this.spriteAttributeTable = 0;
        this.spritePatternTable = 0;
        this.colorTableMask = 0x3FFF;
        this.patternTableMask = 0x3FFF;
        this.ramMask = 0x3FFF;
        this.fgColor = 0;
        this.bgColor = 0;

        this.flicker = this.enableFlicker;
        this.redrawRequired = true;

        this.width = 304;
        this.height = 240;
    }

    drawScanline(y:number) {
        var imageData = this.fb32,
            width = this.width,
            imageDataAddr = (y * width),
            screenMode = this.screenMode,
            textMode = this.textMode,
            bitmapMode = this.bitmapMode,
            drawWidth = !textMode ? 256 : 240,
            drawHeight = 192,
            hBorder = (width - drawWidth) >> 1,
            vBorder = (this.height - drawHeight) >> 1,
            fgColor = this.fgColor,
            bgColor = this.bgColor,
            ram = this.ram,
            nameTable = this.nameTable,
            colorTable = this.colorTable,
            charPatternTable = this.charPatternTable,
            colorTableMask = this.colorTableMask,
            patternTableMask = this.patternTableMask,
            spriteAttributeTable = this.spriteAttributeTable,
            spritePatternTable = this.spritePatternTable,
            spriteSize = (this.registers[1] & 0x2) !== 0,
            spriteMagnify = this.registers[1] & 0x1,
            spriteDimension = (spriteSize ? 16 : 8) << (spriteMagnify ? 1 : 0),
            maxSpritesOnLine = this.flicker ? 4 : 32,
            palette = this.palette,
            collision = false, fifthSprite = false, fifthSpriteIndex = 31,
            x, color, rgbColor, name, tableOffset, colorByte, patternByte;
        if (y >= vBorder && y < vBorder + drawHeight && this.displayOn) {
            var y1 = y - vBorder;
            // Pre-process sprites
            if (!textMode) {
                var spriteBuffer = this.spriteBuffer;
                spriteBuffer.fill(0);
                var spritesOnLine = 0;
                var endMarkerFound = false;
                var spriteAttributeAddr = spriteAttributeTable;
                var s;
                for (s = 0; s < 32 && spritesOnLine <= maxSpritesOnLine && !endMarkerFound; s++) {
                    var sy = ram[spriteAttributeAddr];
                    if (sy !== 0xD0) {
                        if (sy > 0xD0) {
                            sy -= 256;
                        }
                        sy++;
                        var sy1 = sy + spriteDimension;
                        var y2 = -1;
                        if (s < 8 || !bitmapMode) {
                            if (y1 >= sy && y1 < sy1) {
                                y2 = y1;
                            }
                        }
                        else {
                            // Emulate sprite duplication bug
                            var yMasked = y1 & (((this.registers[4] & 0x03) << 6) | 0x3F);
                            if (yMasked >= sy && yMasked < sy1) {
                                y2 = yMasked;
                            }
                            else if (y1 >= 64 && y1 < 128 && y1 >= sy && y1 < sy1) {
                                y2 = y1;
                            }
                        }
                        if (y2 !== -1) {
                            if (spritesOnLine < maxSpritesOnLine) {
                                var sx = ram[spriteAttributeAddr + 1];
                                var sPatternNo = ram[spriteAttributeAddr + 2] & (spriteSize ? 0xFC : 0xFF);
                                var sColor = ram[spriteAttributeAddr + 3] & 0x0F;
                                if ((ram[spriteAttributeAddr + 3] & 0x80) !== 0) {
                                    sx -= 32;
                                }
                                var sLine = (y2 - sy) >> spriteMagnify;
                                var sPatternBase = spritePatternTable + (sPatternNo << 3) + sLine;
                                for (var sx1 = 0; sx1 < spriteDimension; sx1++) {
                                    var sx2 = sx + sx1;
                                    if (sx2 >= 0 && sx2 < drawWidth) {
                                        var sx3 = sx1 >> spriteMagnify;
                                        var sPatternByte = ram[sPatternBase + (sx3 >= 8 ? 16 : 0)];
                                        if ((sPatternByte & (0x80 >> (sx3 & 0x07))) !== 0) {
                                            if (spriteBuffer[sx2] === 0) {
                                                spriteBuffer[sx2] = sColor + 1;
                                            }
                                            else {
                                                collision = true;
                                            }
                                        }
                                    }
                                }
                            }
                            spritesOnLine++;
                        }
                        spriteAttributeAddr += 4;
                    }
                    else {
                        endMarkerFound = true;
                    }
                }
                if (spritesOnLine > 4) {
                    fifthSprite = true;
                    fifthSpriteIndex = s;
                }
            }
            // Draw
            var rowOffset = !textMode ? (y1 >> 3) << 5 : (y1 >> 3) * 40;
            var lineOffset = y1 & 7;
            for (x = 0; x < width; x++) {
                if (x >= hBorder && x < hBorder + drawWidth) {
                    var x1 = x - hBorder;
                    // Tiles
                    switch (screenMode) {
                        case TMS9918A_Mode.GRAPHICS:
                            name = ram[nameTable + rowOffset + (x1 >> 3)];
                            colorByte = ram[colorTable + (name >> 3)];
                            patternByte = ram[charPatternTable + (name << 3) + lineOffset];
                            color = (patternByte & (0x80 >> (x1 & 7))) !== 0 ? (colorByte & 0xF0) >> 4 : colorByte & 0x0F;
                            break;
                        case TMS9918A_Mode.BITMAP:
                            name = ram[nameTable + rowOffset + (x1 >> 3)];
                            tableOffset = ((y1 & 0xC0) << 5) + (name << 3);
                            colorByte = ram[colorTable + (tableOffset & colorTableMask) + lineOffset];
                            patternByte = ram[charPatternTable + (tableOffset & patternTableMask) + lineOffset];
                            color = (patternByte & (0x80 >> (x1 & 7))) !== 0 ? (colorByte & 0xF0) >> 4 : colorByte & 0x0F;
                            break;
                        case TMS9918A_Mode.MULTICOLOR:
                            name = ram[nameTable + rowOffset + (x1 >> 3)];
                            lineOffset = (y1 & 0x1C) >> 2;
                            patternByte = ram[charPatternTable + (name << 3) + lineOffset];
                            color = (x1 & 4) === 0 ? (patternByte & 0xF0) >> 4 : patternByte & 0x0F;
                            break;
                        case TMS9918A_Mode.TEXT:
                            name = ram[nameTable + rowOffset + Math.floor(x1 / 6)];
                            patternByte = ram[charPatternTable + (name << 3) + lineOffset];
                            color = (patternByte & (0x80 >> (x1 % 6))) !== 0 ? fgColor : bgColor;
                            break;
                        case TMS9918A_Mode.BITMAP_TEXT:
                            name = ram[nameTable + rowOffset + Math.floor(x1 / 6)];
                            tableOffset = ((y1 & 0xC0) << 5) + (name << 3);
                            patternByte = ram[charPatternTable + (tableOffset & patternTableMask) + lineOffset];
                            color = (patternByte & (0x80 >> (x1 % 6))) !== 0 ? fgColor : bgColor;
                            break;
                        case TMS9918A_Mode.BITMAP_MULTICOLOR:
                            name = ram[nameTable + rowOffset + (x1 >> 3)];
                            lineOffset = (y1 & 0x1C) >> 2;
                            tableOffset = ((y1 & 0xC0) << 5) + (name << 3);
                            patternByte = ram[charPatternTable + (tableOffset & patternTableMask) + lineOffset];
                            color = (x1 & 4) === 0 ? (patternByte & 0xF0) >> 4 : patternByte & 0x0F;
                            break;
                        case TMS9918A_Mode.ILLEGAL:
                            color = (x1 & 4) === 0 ? fgColor : bgColor;
                            break;
                    }
                    if (color === 0) {
                        color = bgColor;
                    }
                    // Sprites
                    if (!textMode) {
                        var spriteColor = spriteBuffer[x1] - 1;
                        if (spriteColor > 0) {
                            color = spriteColor;
                        }
                    }
                }
                else {
                    color = bgColor;
                }
                rgbColor = palette[color];
                imageData[imageDataAddr++] = rgbColor;
            }
        }
        // Top/bottom border
        else {
            rgbColor = palette[bgColor];
            for (x = 0; x < width; x++) {
                imageData[imageDataAddr++] = rgbColor;
            }
        }
        if (y === vBorder + drawHeight) {
            this.statusRegister |= 0x80;
            if (this.interruptsOn) {
                this.cru.setVDPInterrupt(true);
            }
        }
        if (collision) {
            this.statusRegister |= 0x20;
        }
        if ((this.statusRegister & 0x40) === 0) {
            this.statusRegister |= fifthSpriteIndex;
        }
        if (fifthSprite) {
            this.statusRegister |= 0x40;
        }
    }

    setReadAddress(i:number) {
        this.addressRegister = ((i & 0x3f) << 8) | (this.addressRegister & 0x00FF);
        this.prefetchByte = this.ram[this.addressRegister++];
        this.addressRegister &= 0x3FFF;
    }
    
    setWriteAddress(i:number) {
        this.addressRegister = ((i & 0x3f) << 8) | (this.addressRegister & 0x00FF);
    }
    
    setVDPWriteRegister(i:number) {
        var regmask = this.registers.length-1;
        this.registers[i & regmask] = this.addressRegister & 0x00FF;
        switch (i & regmask) {
            // Mode
            case 0:
                this.updateMode(this.registers[0], this.registers[1]);
                break;
            case 1:
                this.ramMask = (this.registers[1] & 0x80) !== 0 ? 0x3FFF : 0x1FFF;
                this.displayOn = (this.registers[1] & 0x40) !== 0;
                this.interruptsOn = (this.registers[1] & 0x20) !== 0;
                this.updateMode(this.registers[0], this.registers[1]);
                break;
            // Name table
            case 2:
                this.nameTable = (this.registers[2] & 0xf) << 10;
                break;
            // Color table
            case 3:
                if (this.bitmapMode) {
                    this.colorTable = (this.registers[3] & 0x80) << 6;
                }
                else {
                    this.colorTable = this.registers[3] << 6;
                }
                this.updateTableMasks();
                break;
            // Pattern table
            case 4:
                if (this.bitmapMode) {
                    this.charPatternTable = (this.registers[4] & 0x4) << 11;
                }
                else {
                    this.charPatternTable = (this.registers[4] & 0x7) << 11;
                }
                this.updateTableMasks();
                break;
            // Sprite attribute table
            case 5:
                this.spriteAttributeTable = (this.registers[5] & 0x7f) << 7;
                break;
            // Sprite pattern table
            case 6:
                this.spritePatternTable = (this.registers[6] & 0x7) << 11;
                break;
            // Background
            case 7:
                this.fgColor = (this.registers[7] & 0xf0) >> 4;
                this.bgColor = this.registers[7] & 0x0f;
                break;
        }
        // this.logRegisters();
        // this.log.info("Name table: " + this.nameTable.toHexWord());
        // this.log.info("Pattern table: " + this.charPatternTable.toHexWord());
    }

    setVDPWriteCommand3(i:number) {
            this.setVDPWriteRegister(i);
    }
    
    writeAddress(i:number) {
        if (!this.latch) {
            this.addressRegister = (this.addressRegister & 0xFF00) | i;
        } else {
            switch ((i & 0xc0) >> 6) {
                // Set read address
                case 0:
                    this.setReadAddress(i);
                    break;
                // Set write address
                case 1:
                    this.setWriteAddress(i);
                    break;
                // Write register
                case 2:
                    this.setVDPWriteRegister(i);
                    break;
                // Color RAM (SMS only)
                case 3:
                    this.setVDPWriteCommand3(i);
                    break;
            }
            this.redrawRequired = true;
        }
        this.latch = !this.latch;
    }

    updateMode(reg0:number, reg1:number) {
        this.bitmapMode = (reg0 & 0x02) !== 0;
        this.textMode = (reg1 & 0x10) !== 0;
        // Check bitmap mode bit, not text or multicolor
        if (this.bitmapMode) {
            switch ((reg1 & 0x18) >> 3) {
                case 0:
                    // Bitmap mode
                    this.screenMode = TMS9918A_Mode.BITMAP;
                    break;
                case 1:
                    // Multicolor mode
                    this.screenMode = TMS9918A_Mode.BITMAP_MULTICOLOR;
                    break;
                case 2:
                    // Text mode
                    this.screenMode = TMS9918A_Mode.BITMAP_TEXT;
                    break;
                case 3:
                    // Illegal
                    this.screenMode = TMS9918A_Mode.ILLEGAL;
                    break;
            }
        } else {
            switch ((reg1 & 0x18) >> 3) {
                case 0:
                    // Graphics mode 0
                    this.screenMode = TMS9918A_Mode.GRAPHICS;
                    break;
                case 1:
                    // Multicolor mode
                    this.screenMode = TMS9918A_Mode.MULTICOLOR;
                    break;
                case 2:
                    // Text mode
                    this.screenMode = TMS9918A_Mode.TEXT;
                    break;
                case 3:
                    // Illegal
                    this.screenMode = TMS9918A_Mode.ILLEGAL;
                    break;
            }
        }
        if (this.bitmapMode) {
            this.colorTable = (this.registers[3] & 0x80) << 6;
            this.charPatternTable = (this.registers[4] & 0x4) << 11;
            this.updateTableMasks();
        } else {
            this.colorTable = this.registers[3] << 6;
            this.charPatternTable = (this.registers[4] & 0x7) << 11;
        }
        this.nameTable = (this.registers[2] & 0xf) << 10;
        this.spriteAttributeTable = (this.registers[5] & 0x7f) << 7;
        this.spritePatternTable = (this.registers[6] & 0x7) << 11;
    }

    updateTableMasks() {
        if (this.screenMode === TMS9918A_Mode.BITMAP) {
            this.colorTableMask = ((this.registers[3] & 0x7F) << 6) | 0x3F; // 000CCCCCCC111111
            this.patternTableMask  = ((this.registers[4] & 0x03) << 11) | (this.colorTableMask & 0x7FF); // 000PPCCCCC111111
            // this.log.info("colorTableMask:" + this.colorTableMask);
            // this.log.info("patternTableMask:" + this.patternTableMask);
        }
        else if (this.screenMode === TMS9918A_Mode.BITMAP_TEXT || this.screenMode === TMS9918A_Mode.BITMAP_MULTICOLOR) {
            this.colorTableMask = this.ramMask;
            this.patternTableMask  = ((this.registers[4] & 0x03) << 11) | 0x7FF; // 000PP11111111111
        }
        else {
            this.colorTableMask = this.ramMask;
            this.patternTableMask = this.ramMask;
        }
    }

    writeData(i:number) {
        this.probe.logVRAMWrite(this.addressRegister, i);
        this.ram[this.addressRegister++] = i;
        this.prefetchByte = i;
        this.addressRegister &= this.ramMask;
        this.latch = false;
        this.redrawRequired = true;
    }

    readStatus() : number {
        var i = this.statusRegister;
        this.statusRegister = 0x1F; // TODO: & 0x1f?
        if (this.interruptsOn) {
            this.cru.setVDPInterrupt(false);
        }
        this.latch = false;
        return i;
    }

    readData() : number {
        var i = this.prefetchByte;
        this.prefetchByte = this.ram[this.addressRegister++];
        this.probe.logVRAMRead(this.addressRegister-1, this.prefetchByte);
        this.addressRegister &= this.ramMask;
        this.latch = false;
        return i;
    }

    getRAM() : Uint8Array {
        return this.ram;
    }

    colorTableSize() : number {
        if (this.screenMode === TMS9918A_Mode.GRAPHICS) {
            return 0x20;
        }
        else if (this.screenMode === TMS9918A_Mode.BITMAP) {
            return Math.min(this.colorTableMask + 1, 0x1800);
        }
        else {
            return 0;
        }
    }

    patternTableSize() : number {
        if (this.bitmapMode) {
            return Math.min(this.patternTableMask + 1, 0x1800);
        }
        else {
            return 0x800;
        }
    }
    getDebugTables() {
        var tables : [string,number,number][] = [
            ["Pattern Table", this.charPatternTable, this.patternTableSize()],
            ["Name Table", this.nameTable, 0x300],
            ["Color Table", this.colorTable, this.colorTableSize()],
            ["Sprite Patterns", this.spritePatternTable, 64*32],
            ["Sprite Attributes", this.spriteAttributeTable, 4*32],
        ];
        return tables;
    }
    getRegsString() : string {
        const w = 20;
        var s = "Registers:";
        for (var i = 0; i < this.registers.length; i++) {
            s += " " + hex(this.registers[i],2);
        }
        s += "\n\n";
        var tables = this.getDebugTables();
        for (var row of tables) {
            if (row[2] > 0)
                s += lpad(row[0], w) + ": $" + hex(row[1],4) + " - $" + hex(row[1]+row[2]-1,4) + "\n";
        }
        s += lpad("Address Register",w) + ": $" + hex(this.addressRegister,4) + "\n";
        s += lpad("Status Register",w) + ": $" + hex(this.statusRegister,2) + "\n";
        s += lpad("Screen Mode",w) + ":  " + this.screenMode + "\n";
        s += lpad("Display On",w) + ":  " + this.displayOn + "\n";
        if (this.ramMask != 0x3fff)
            s += lpad("RAM Mask",w) + ": $" + hex(this.ramMask) + "\n";
        return s;
    }

    hexView(start:number, length:number, anchorAddr:number) : {text,lineCount,anchorLine} {
        var text = "";
        var anchorLine = null;
        var addr = start;
        var line = 0;
        for (var i = 0; i < length && addr < 0x4000; addr++, i++) {
            if ((i & 0x000F) === 0) {
                text += "\n" + hex(addr,4) + ":";
                line++;
            }
            text += " ";
            if (anchorAddr && anchorAddr === addr) {
                anchorLine = line;
            }
            var hx = this.ram[addr].toString(16).toUpperCase();
            if (hx.length === 1) {
                text += "0";
            }
            text += hx;
        }
        return {text: text.substr(1), lineCount: line, anchorLine: anchorLine - 1};
    }

    getWord(addr:number) : number {
        return addr < 0x4000 ? this.ram[addr] << 8 | this.ram[addr+1] : 0;
    }

    getCharAt(x:number, y:number) : number {
        x -= 24;
        y -= 24;
        if (!this.textMode) {
            return this.ram[this.nameTable + Math.floor(x / 8) + Math.floor(y / 8)  * 32];
        }
        else {
            return this.ram[this.nameTable + Math.floor((x - 8) / 6) + Math.floor(y / 8)  * 40];
        }
    }

    setFlicker(value:boolean) {
        this.flicker = value;
        this.enableFlicker = value;
    }

    getState() {
        return {
            ram: this.ram.slice(0),
            registers: this.registers.slice(0),
            addressRegister: this.addressRegister,
            statusRegister: this.statusRegister,
            latch: this.latch,
            prefetchByte: this.prefetchByte,
            displayOn: this.displayOn,
            interruptsOn: this.interruptsOn,
            screenMode: this.screenMode,
            bitmapMode: this.bitmapMode,
            textMode: this.textMode,
            colorTable: this.colorTable,
            nameTable: this.nameTable,
            charPatternTable: this.charPatternTable,
            spriteAttributeTable: this.spriteAttributeTable,
            spritePatternTable: this.spritePatternTable,
            colorTableMask: this.colorTableMask,
            patternTableMask: this.patternTableMask,
            ramMask: this.ramMask,
            fgColor: this.fgColor,
            bgColor: this.bgColor,
            flicker: this.flicker
        };
    }

    restoreState(state) {
        this.ram.set(state.ram);
        this.registers.set(state.registers);
        this.addressRegister = state.addressRegister;
        this.statusRegister = state.statusRegister;
        this.latch = state.latch;
        this.prefetchByte = state.prefetchByte;
        this.displayOn = state.displayOn;
        this.interruptsOn = state.interruptsOn;
        this.screenMode = state.screenMode;
        this.bitmapMode = state.bitmapMode;
        this.textMode = state.textMode;
        this.colorTable = state.colorTable;
        this.nameTable = state.nameTable;
        this.charPatternTable = state.charPatternTable;
        this.spriteAttributeTable = state.spriteAttributeTable;
        this.spritePatternTable = state.spritePatternTable;
        this.colorTableMask = state.colorTableMask;
        this.patternTableMask = state.patternTableMask;
        this.ramMask = state.ramMask;
        this.fgColor = state.fgColor;
        this.bgColor = state.bgColor;
        this.flicker = state.flicker;
        this.redrawRequired = true;
    }
};

export class SMSVDP extends TMS9918A {

    writeToCRAM : boolean;
    cram = new Uint8Array(32); // color RAM
    cpalette = new Uint32Array(32); // color RAM (RGBA)
    registers = new Uint8Array(16); // 8 more registers (actually only 5)
    vramUntwiddled = new Uint8Array(0x8000);
    numVisibleLines = 192;
    lineCounter = 0; // TODO: state
    lineInterruptPending = false; // TODO: state

    reset() {
        super.reset();
        this.writeToCRAM = false;
        this.cram.fill(0);
        this.cpalette.fill(0);
        this.vramUntwiddled.fill(0);        
    }
    readStatus() {
        this.lineInterruptPending = false;
        return super.readStatus();
    }
    updateMode(reg0:number, reg1:number) {
        if (reg0 & 0x04) {
            this.screenMode = TMS9918A_Mode.MODE4;
            this.nameTable = ((this.registers[2] & 0xf) << 10) & 0x3800;
            this.spriteAttributeTable = (this.registers[5] & 0x7e) << 7;
        } else {
            super.updateMode(reg0, reg1);
        }
    }
    setReadAddress(i:number) {
        super.setReadAddress(i);
        this.writeToCRAM = false;
    }
    setWriteAddress(i:number) {
        super.setWriteAddress(i);
        this.writeToCRAM = false;
    }
    setVDPWriteRegister(i:number) {
        super.setVDPWriteRegister(i);
        //this.writeToCRAM = false; // TODO?
        this.ramMask = 0x3fff;
    }
    setVDPWriteCommand3(i:number) {
        this.writeToCRAM = true;
        //this.addressRegister &= 0x1f; // TODO?
    }
    writeData(i:number) {
        if (this.writeToCRAM) {
            var palindex = this.addressRegister++ & (this.cram.length-1);
            this.cram[palindex] = i;
            this.cpalette[palindex] = RGBA((i&3)*85, ((i>>2)&3)*85, ((i>>4)&3)*85);
            this.prefetchByte = i;
            this.addressRegister &= this.ramMask;
            this.redrawRequired = true;
        } else {
            var oldAddress = this.addressRegister;
            super.writeData(i);
            this.writeTwiddled(oldAddress, i);
        }
        this.latch = false;
    }
    writeTwiddled(vdp_addr:number, val:number) {
        var planarBase = vdp_addr & 0x3ffc;
        var twiddledBase = planarBase * 2;
        var val0 = this.ram[planarBase];
        var val1 = this.ram[planarBase + 1];
        var val2 = this.ram[planarBase + 2];
        var val3 = this.ram[planarBase + 3];
        for (var i = 0; i < 8; ++i) {
            var effectiveBit = 7 - i;
            var index = (((val0 >>> effectiveBit) & 1))
                | (((val1 >>> effectiveBit) & 1) << 1)
                | (((val2 >>> effectiveBit) & 1) << 2)
                | (((val3 >>> effectiveBit) & 1) << 3);
            this.vramUntwiddled[twiddledBase + i] = index;
        }
    }
    getState() {
        var state = super.getState();
        state['cram'] = this.cram.slice(0);
        return state;
    }
    restoreState(state) {
        super.restoreState(state);
        this.cram.set(state.cram);
    }
    drawScanline(y:number) {
        if (this.screenMode == TMS9918A_Mode.MODE4)
            this.rasterize_line(y);	// special mode 4
        else
            super.drawScanline(y);
    }

    findSprites(line:number) {
        var spriteInfo = this.spriteAttributeTable;
        var active = [];
        var spriteHeight = 8;
        var i;
        if (this.registers[1] & 2) {
            spriteHeight = 16;
        }
        for (i = 0; i < 64; i++) {
            var y = this.ram[spriteInfo + i];
            if (y === 208) {
                break;
            }
            if (y >= 240) y -= 256;
            if (line >= y && line < (y + spriteHeight)) {
                if (active.length === 8) {
                    this.statusRegister |= 0x40;  // Sprite overflow
                    break;
                }
                active.push([
                    this.ram[spriteInfo + 128 + i * 2],
                    this.ram[spriteInfo + 128 + i * 2 + 1],
                    y]);
            }
        }
        return active;
    }


    rasterize_background(lineAddr:number, pixelOffset:number, tileData:number, tileDef:number, transparent:boolean) {
        lineAddr = lineAddr | 0;
        pixelOffset = pixelOffset | 0;
        tileData = tileData | 0;
        tileDef = (tileDef | 0) * 2;
        var i, tileDefInc;
        if ((tileData & (1 << 9))) {
            tileDefInc = -1;
            tileDef += 7;
        } else {
            tileDefInc = 1;
        }
        const paletteOffset = (tileData & (1 << 11)) ? 16 : 0;
        var index;
        if (transparent && paletteOffset === 0) {
            for (i = 0; i < 8; i++) {
                index = this.vramUntwiddled[tileDef];
                tileDef += tileDefInc;
                if (index !== 0) this.fb32[lineAddr + pixelOffset] = this.cpalette[index];
                pixelOffset = (pixelOffset + 1) & 255;
            }
        } else {
            for (i = 0; i < 8; i++) {
                index = this.vramUntwiddled[tileDef] + paletteOffset;
                tileDef += tileDefInc;
                this.fb32[lineAddr + pixelOffset] = this.cpalette[index];
                pixelOffset = (pixelOffset + 1) & 255;
            }
        }
    }

    
    clear_background(lineAddr:number, pixelOffset:number) {
        lineAddr = lineAddr | 0;
        pixelOffset = pixelOffset | 0;
        var i;
        const rgb = this.cpalette[0];
        for (i = 0; i < 8; ++i) {
            this.fb32[lineAddr + pixelOffset] = rgb;
            pixelOffset = (pixelOffset + 1) & 255;
        }
    }

    rasterize_background_line(lineAddr:number, pixelOffset:number, nameAddr:number, yMod:number) {
        lineAddr = lineAddr | 0;
        pixelOffset = pixelOffset | 0;
        nameAddr = nameAddr | 0;
        const yOffset = (yMod | 0) * 4;
        for (var i = 0; i < 32; i++) {
            // TODO: static left-hand rows.
            var tileData = this.ram[nameAddr + i * 2] | (this.ram[nameAddr + i * 2 + 1] << 8);
            var tileNum = tileData & 511;
            var tileDef = 32 * tileNum;
            if (tileData & (1 << 10)) {
                tileDef += 28 - yOffset;
            } else {
                tileDef += yOffset;
            }
            if ((tileData & (1 << 12)) === 0) {
                this.rasterize_background(lineAddr, pixelOffset, tileData, tileDef, false);
            } else {
                this.clear_background(lineAddr, pixelOffset);
            }
            pixelOffset = (pixelOffset + 8) & 255;
        }
    }

    rasterize_foreground_line(lineAddr:number, pixelOffset:number, nameAddr:number, yMod:number) {
        lineAddr = lineAddr | 0;
        pixelOffset = pixelOffset | 0;
        nameAddr = nameAddr | 0;
        const yOffset = (yMod | 0) * 4;
        for (var i = 0; i < 32; i++) {
            // TODO: static left-hand rows.
            var tileData = this.ram[nameAddr + i * 2] | (this.ram[nameAddr + i * 2 + 1] << 8);
            if ((tileData & (1 << 12)) === 0) continue;
            var tileNum = tileData & 511;
            var tileDef = 32 * tileNum;
            if (tileData & (1 << 10)) {
                tileDef += 28 - yOffset;
            } else {
                tileDef += yOffset;
            }
            this.rasterize_background(lineAddr, ((i * 8) + pixelOffset & 0xff), tileData, tileDef, true);
        }
    }


    rasterize_sprites(line:number, lineAddr:number, pixelOffset:number, sprites) {
        lineAddr = lineAddr | 0;
        pixelOffset = pixelOffset | 0;
        const spriteBase = (this.registers[6] & 4) ? 0x2000 : 0;
        // TODO: sprite X-8 shift
        // TODO: sprite double size
        for (var i = 0; i < 256; ++i) {
            var xPos = i;//(i + this.registers[8]) & 0xff;
            var spriteFoundThisX = false;
            var writtenTo = false;
            var minDistToNext = 256;
            for (var k = 0; k < sprites.length; k++) {
                var sprite = sprites[k];
                var offset = xPos - sprite[0];
                // Sprite to the right of the current X?
                if (offset < 0) {
                    // Find out how far it would be to skip to this sprite
                    var distToSprite = -offset;
                    // Keep the minimum distance to the next sprite to the right.
                    if (distToSprite < minDistToNext) minDistToNext = distToSprite;
                    continue;
                }
                if (offset >= 8) continue;
                spriteFoundThisX = true;
                var spriteLine = line - sprite[2];
                var spriteAddr = spriteBase + sprite[1] * 32 + spriteLine * 4;
                var untwiddledAddr = spriteAddr * 2 + offset;
                var index = this.vramUntwiddled[untwiddledAddr];
                if (index === 0) {
                    continue;
                }
                if (writtenTo) {
                    // We have a collision!.
                    this.statusRegister |= 0x20;
                    break;
                }
                this.fb32[lineAddr + ((pixelOffset + i - this.registers[8]) & 0xff)] = this.cpalette[16 + index];
                writtenTo = true;
            }
            if (!spriteFoundThisX && minDistToNext > 1) {
                // If we didn't find a sprite on this X, then we can skip ahead by the minimum
                // dist to next (minus one to account for loop add)
                i += minDistToNext - 1;
            }
        }
    }

    border_clear(lineAddr:number, count:number) {
        lineAddr = lineAddr | 0;
        count = count | 0;
        const borderIndex = 16 + (this.registers[7] & 0xf);
        const borderRGB = this.cpalette[borderIndex];
        this.fb32.fill(borderRGB, lineAddr, lineAddr+count);
    }

    rasterize_line(line:number) {
        line |= 0;
        var vdp_regs = this.registers;
        var drawWidth = 256;
        var drawHeight = this.numVisibleLines; // TODO?
        var hBorder = (this.width - drawWidth) >> 1;
        var vBorder = (this.height - drawHeight) >> 1; // TODO?
        const startAddr = ((line + vBorder) * this.width) | 0;
        const lineAddr = (startAddr + hBorder) | 0;
        if (!this.displayOn || line < 0 || line >= drawHeight) {
            if (line < this.height)
                this.border_clear(startAddr, this.width);
            else if (line >= 262-vBorder)
                this.border_clear((line-262+vBorder)*this.width, this.width);
        } else {
            var effectiveLine = line + vdp_regs[9];
            if (effectiveLine >= 224) {
                effectiveLine -= 224;
            }
            const sprites = this.findSprites(line);
            const pixelOffset = ((vdp_regs[0] & 64) && line < 16) ? 0 : vdp_regs[8];
            const nameAddr = this.nameTable + (effectiveLine >>> 3) * 64;
            const yMod = effectiveLine & 7;

            this.rasterize_background_line(lineAddr, pixelOffset, nameAddr, yMod);
            this.rasterize_sprites(line, lineAddr, pixelOffset, sprites);
            this.rasterize_foreground_line(lineAddr, pixelOffset, nameAddr, yMod);

            this.border_clear(startAddr, hBorder);
            this.border_clear(lineAddr + 256, hBorder);
            if (vdp_regs[0] & (1 << 5)) {
                // Blank out left hand column.
                this.border_clear(lineAddr, 8);
            }
        }
        // frame interrupts
        if (line == drawHeight) {
            this.statusRegister |= 0x80;
            if (this.interruptsOn) {
                this.cru.setVDPInterrupt(true);
            }
        }
        // line interrupts
        if (line <= drawHeight) {
            if (this.lineCounter > 0) {
                this.lineCounter--;
            } else {
                this.lineCounter = this.registers[0xa];
                this.lineInterruptPending = true;
            }
        } else {
            this.lineCounter = this.registers[0xa];
        }
        if (this.lineInterruptPending) {
            if (this.registers[0] & 0x10) {
                // TODO this.cru.setVDPInterrupt(true);
            }
        }
    }

    getDebugTables() {
        if (this.screenMode == TMS9918A_Mode.MODE4) {
            var tables : [string,number,number][] = [
                ["Pattern Table", 0, 512*32],
                ["Name Table", this.nameTable, 32*32*2], // TODO: size
                ["Sprite Attributes", this.spriteAttributeTable, 256],
            ]
            return tables;
        } else {
            return super.getDebugTables();
        }
    }
};

