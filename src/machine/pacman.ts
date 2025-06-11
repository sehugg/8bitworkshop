import { Z80, Z80State } from "../common/cpu/ZilogZ80";
import { BasicScanlineMachine } from "../common/devices";
import { KeyFlags, newAddressDecoder, padBytes, noise, Keys, makeKeycodeMap, newKeyboardHandler, EmuHalt } from "../common/emu";
import { TssChannelAdapter, MasterAudio } from "../common/audio";
import { hex } from "../common/util";

const PACMAN_KEYCODE_MAP = makeKeycodeMap([
    [Keys.UP, 0, 0x1],     // UP
    [Keys.LEFT, 0, 0x2],   // LEFT 
    [Keys.RIGHT, 0, 0x4],  // RIGHT
    [Keys.DOWN, 0, 0x8],   // DOWN
    [Keys.VK_5, 0, 0x20],  // COIN1
    [Keys.VK_6, 0, 0x40],  // COIN2
    [Keys.START, 1, 0x20], // START1
    [Keys.VK_2, 1, 0x40],  // START2
    // Removed SERVICE mapping to prevent accidental service mode activation
    // [Keys.SELECT, 1, 0x10], // SERVICE
]);

// Pacman palette colors (4-bit RGB conversion)
const bitcolors = [
    0x00000000, // 0
    0x00000f00, // 1 - red
    0x000f0000, // 2 - green  
    0x000f0f00, // 3 - yellow
    0x0f000000, // 4 - blue
    0x0f000f00, // 5 - magenta
    0x0f0f0000, // 6 - cyan
    0x0f0f0f00, // 7 - white
];

// Pacman video rendering - proper tile-based version
const PacmanVideo = function (machine, charROM: Uint8Array, vram: Uint8Array, cram: Uint8Array, oram: Uint8Array, palette: Uint32Array, options) {
    var self = this;
    this.machine = machine;
    this.charROM = charROM;
    this.frameCounter = 0;

    this.advanceFrame = function () {
        this.frameCounter = (this.frameCounter + 1) & 0xff;
    }

    this.drawScanline = function (pixels, sl) {
        var pixofs = sl * 224;
        
        // Pacman screen is rotated 90 degrees, 28x36 characters visible
        // Clear scanline with black
        for (var i = 0; i < 224; i++) {
            pixels[pixofs + i] = 0xff000000;
        }
        
        // Draw character tiles
        // Pacman screen: 28 columns (visible), each 8 pixels wide = 224 pixels
        // Due to rotation, we need to read vertically from VRAM
        var sy = sl;
        var ty = Math.floor(sy / 8); // tile Y (0-35)
        var py = sy & 7;             // pixel Y within tile (0-7)
        
        if (ty < 36) { // valid tile row
            for (var tx = 0; tx < 28; tx++) { // 28 visible columns
                var sx = tx * 8;
                
                // Calculate VRAM address - Pacman has rotated layout
                // First 2 rows and last 2 rows are at different positions
                var vramAddr;
                if (ty < 2) {
                    // Top 2 rows (score area) - use columns 0-31 
                    vramAddr = ty * 32 + (tx + 2);
                } else if (ty >= 34) {
                    // Bottom 2 rows (lives/fruit area) - use columns 0-31
                    vramAddr = (ty - 32) * 32 + (tx + 2);
                } else {
                    // Main play area - rotated columns, right to left
                    // Columns are stored as: rightmost column first
                    var col = 29 - tx; // reverse column order
                    var row = ty - 2;  // adjust for top 2 rows
                    vramAddr = (col * 32) + row + 64; // offset past first 2 rows
                }
                
                if (vramAddr < 0x400) {
                    var tileCode = vram[vramAddr];
                    var tileColor = cram[vramAddr];
                    
                    // Get tile graphics from character ROM
                    // MAME format: Each character is 16 bytes
                    // Bytes 0-7: pixels 0-3 of rows 0-7 (left half) - CORRECTED
                    // Bytes 8-15: pixels 4-7 of rows 0-7 (right half) - CORRECTED
                    // Within each byte: bits 0-3 = bitplane 0, bits 4-7 = bitplane 1
                    var charBase = tileCode * 16;
                    
                    // Draw 8 pixels of the character
                    var color0 = (tileColor & 0x3f) << 2; // Base color from color RAM
                    for (var px = 0; px < 8; px++) {
                        var colorIndex;
                        
                        // Try swapping px and py for 90-degree rotation, with column flip for upside-down fix
                        var readRow = px;     // Use px as the row to read from
                        var readCol = 7 - py; // Use (7-py) as the column to read from (flipped)
                        
                        if (readCol < 4) {
                            // Read from bytes 0-7 (left half)
                            var byteAddr = charBase + readRow; // bytes 0-7
                            var data = this.charROM[byteAddr];
                            var bitpos = readCol; // Column position
                            var bit0 = (data >> bitpos) & 1;      // bitplane 0
                            var bit1 = (data >> (bitpos + 4)) & 1; // bitplane 1
                            colorIndex = color0 + bit0 + (bit1 << 1);
                        } else {
                            // Read from bytes 8-15 (right half)
                            var byteAddr = charBase + 8 + readRow; // bytes 8-15
                            var data = this.charROM[byteAddr];
                            var bitpos = readCol - 4; // Column position
                            var bit0 = (data >> bitpos) & 1;      // bitplane 0
                            var bit1 = (data >> (bitpos + 4)) & 1; // bitplane 1
                            colorIndex = color0 + bit0 + (bit1 << 1);
                        }
                        
                        // Use black for color 0, otherwise use palette color
                        var color = (colorIndex & 3) ? palette[colorIndex & 31] : 0xff000000;
                        // Apply horizontal mirroring by drawing pixels in reverse order
                        var mirroredPx = 7 - px; // Horizontal flip: 0->7, 1->6, 2->5, etc.
                        pixels[pixofs + sx + mirroredPx] = color;
                    }
                }
            }
        }
    }
};

const XTAL = 18432000.0;
const scanlinesPerFrame = 264;
const cpuFrequency = XTAL / 6; // 3.072 MHz
const hsyncFrequency = XTAL / 3 / 192 / 2; // 16 kHz
const vsyncFrequency = hsyncFrequency / 132 / 2; // 60.606060 Hz
const cpuCyclesPerLine = cpuFrequency / hsyncFrequency;
const INITIAL_WATCHDOG = 8;

const audioSampleRate = 60 * scanlinesPerFrame;

export class PacmanMachine extends BasicScanlineMachine {

    cpuFrequency = cpuFrequency;
    canvasWidth = 224;
    numTotalScanlines = 288;
    numVisibleScanlines = 224;  // Only 224 lines are visible in Pacman
    defaultROMSize = 0x6200;    // Program ROM (16KB) + Graphics ROM (8KB) + Palette space
    sampleRate = audioSampleRate;
    cpuCyclesPerLine = cpuCyclesPerLine | 0;
    rotate = 0;  // Try no rotation to fix text orientation
    
    palBase = 0x6000;  // Palette location in ROM
    gfxBase = 0x4000;  // Graphics ROM location in ROM

    cpu: Z80 = new Z80();
    ram = new Uint8Array(0x800);
    vram = new Uint8Array(0x400);  // Video RAM
    cram = new Uint8Array(0x400);  // Color RAM  
    oram = new Uint8Array(0x100);  // Object/Sprite RAM
    charROM: Uint8Array;           // Character graphics ROM
    palette: Uint32Array;
    gfx; // PacmanVideo
    audioadapter;
    watchdog_counter: number = 0;
    interruptEnabled: number = 0;
    soundEnabled: number = 0;
    flipScreen: number = 0;
    defaultInputs: number[] = [0xff, 0xff]; // Pacman inputs are active low
    keyMap = PACMAN_KEYCODE_MAP;
    handler;
    
    // Debug tracking
    lastPC: number = 0;
    pcStuckCounter: number = 0;
    frameCounter: number = 0;
    debugLogNextInstructions: number = 0; // Counter for logging next N instructions

    // LS259 mainlatch outputs (8-bit addressable latch)
    mainlatch: number = 0;
    
    // Cycle-based interrupt timing like pac-c emulator
    cpuCycleCounter: number = 0;
    
    // IM 0 interrupt vector (set via port 0)
    interruptVector: number = 0xFA;  // Default to 0xFA as ROM sets this via port 0

    constructor() {
        super();
        this.cpu = new Z80();
        this.cpu.connectIOBus(this.newIOBus());
        this.cpu.connectMemoryBus(this.newMemoryBus());
        
        // Initialize ROM and character ROM arrays
        this.rom = new Uint8Array(this.defaultROMSize);
        this.charROM = new Uint8Array(0x2000); // 8KB character ROM (correct Pacman size)
        
        // Initialize palette
        this.palette = new Uint32Array(32);
        
        this.gfx = new PacmanVideo(this, this.charROM, this.vram, this.cram, this.oram, this.palette, {});
        
        // Initialize inputs and keyboard handler
        this.inputs.set(this.defaultInputs);
        this.handler = newKeyboardHandler(this.inputs, this.keyMap);
        
        console.log("Pacman machine initialized with keymap:", this.keyMap);
        console.log("Initial inputs:", Array.from(this.inputs).map(x => x.toString(16)));
        
        // Initialize cycle counter
        this.cpuCycleCounter = 0;
    }

    newMemoryBus() {
        return {
            read: this.readByteHook,
            write: this.writeByteHook
        };
    }

    readByteHook = (a) => {
        var val = 0;
        if (a < 0x4000) {  
            val = this.rom ? this.rom[a] : 0;
        } else if (a >= 0x4000 && a < 0x4400) {
            val = this.vram[a - 0x4000];
        } else if (a >= 0x4400 && a < 0x4800) {
            val = this.cram[a - 0x4400];
        } else if (a >= 0x4800 && a < 0x4FF0) {
            val = this.ram[a - 0x4800];
        } else if (a >= 0x4FF0 && a < 0x5000) {
            val = this.oram[a - 0x4FF0];
        } else if (a >= 0x5000 && a < 0x5100) {
            // Handle mirrored input reads based on address
            if ((a & 0xc0) == 0x00) {  // 0x5000-0x503F - Input Port 0 (IN0)
                val = this.defaultInputs[0] ^ this.inputs[0];  // Active low inputs
                val |= 0x10;  // Force Rack Test OFF (bit 0x10 = 1) to prevent service mode
            } else if ((a & 0xc0) == 0x40) {  // 0x5040-0x507F - Input Port 1 (IN1)  
                val = this.defaultInputs[1] ^ this.inputs[1];  // Active low inputs
                val |= 0x80;  // Force Cabinet to UPRIGHT (bit 0x80 = 1) instead of TABLE
                val |= 0x10;  // Force board_test OFF (bit 0x10 = 1) to prevent service mode
            } else if ((a & 0xc0) == 0x80) {  // 0x5080-0x50BF - DIP switches
                // DIP switch settings (correct MAME defaults)
                // Bits 0-1: Coinage (01 = 1 coin/1 credit), Bits 2-3: Lives (00 = 3 lives)  
                // Bits 4-5: Bonus (00 = 10K bonus), Bits 6-7: Difficulty & Ghost Names
                val = 0x51;  // MAME setting "1010001": 1 coin/1 credit, 3 lives, 10K bonus
            } else {
                val = 0xFF;  // Unmapped reads return 0xFF
            }
        } else if (a >= 0x8000) {
            // ROM mirror at 0x8000-0xBFFF (for proper MAME compatibility)
            val = this.rom ? this.rom[a & 0x3FFF] : 0;
        }
        
        return val;
    }
    
    writeByteHook = (a, val) => {
        if (a < 0x4000) {
            // ROM - cannot write, ignore
        } else if (a >= 0x4000 && a < 0x4400) {
            this.vram[a - 0x4000] = val;
        } else if (a >= 0x4400 && a < 0x4800) {
            this.cram[a - 0x4400] = val;
        } else if (a >= 0x4800 && a < 0x4FF0) {
            this.ram[a - 0x4800] = val;
        } else if (a >= 0x4FF0 && a < 0x5000) {
            this.oram[a - 0x4FF0] = val;
        } else if (a >= 0x5000 && a < 0x5100) {
            // I/O writes - handle LS259 mainlatch and other hardware
            if ((a & 0x00F8) == 0x0000) {  // 0x5000-0x5007 - LS259 mainlatch
                var latch_bit = a & 7;
                var old_mainlatch = this.mainlatch;
                
                // Update the specific bit in mainlatch
                if (val & 1) {
                    this.mainlatch |= (1 << latch_bit);
                } else {
                    this.mainlatch &= ~(1 << latch_bit);
                }
                
                // Handle specific latch functions based on MAME
                switch (latch_bit) {
                    case 0: // Interrupt enable
                        var old_int = this.interruptEnabled;
                        this.interruptEnabled = (this.mainlatch >> 0) & 1;
                        if (old_int !== this.interruptEnabled) {
                            console.log(`*** INTERRUPT ${this.interruptEnabled ? 'ENABLED' : 'DISABLED'} at PC=${this.cpu.getPC().toString(16)} ***`);
                        }
                        break;
                    case 1: // Sound enable
                        this.soundEnabled = (this.mainlatch >> 1) & 1;
                        break;
                    case 3: // Flip screen
                        this.flipScreen = (this.mainlatch >> 3) & 1;
                        break;
                }
            } else if ((a & 0x00E0) == 0x0040) {  // 0x5040-0x505F - Sound registers
                // TODO: Implement Namco WSG sound chip
            } else if ((a & 0x00F0) == 0x0060) {  // 0x5060-0x506F - Sprite coordinates
                this.oram[0x10 + (a & 0xF)] = val;
            } else if ((a & 0x00C0) == 0x00C0) {  // 0x50C0-0x50FF - Watchdog reset
                console.log(`WATCHDOG RESET at ${a.toString(16)} = ${val.toString(16)} (frame ${this.frameCounter}, PC=${this.cpu.getPC().toString(16)})`);
                this.watchdog_counter = INITIAL_WATCHDOG;
            }
        }
    }

    // Z80 port I/O handlers - this is crucial for IM 0 interrupt mode!
    readPortHook = (port) => {
        // No input ports via I/O on Pacman - all are memory mapped
        return 0xFF;
    }
    
    writePortHook = (port, val) => {
        // Port 0 is used to set interrupt vector for IM 0/IM 2 mode
        if (port === 0) {
            this.interruptVector = val;
            console.log(`*** INTERRUPT VECTOR SET TO ${val.toString(16)} via port 0 (IM mode) ***`);
        }
    }

    newIOBus() {
        return {
            read: this.readPortHook,
            write: this.writePortHook
        };
    }

    reset() {
        super.reset();
        this.cpu.reset();
        this.watchdog_counter = INITIAL_WATCHDOG;
        
        // Extract character ROM from ROM (8KB at gfxBase)
        console.log(`Extracting character ROM from offset ${this.gfxBase.toString(16)}`);
        if (this.rom.length >= this.gfxBase + 0x2000) {
            for (var i = 0; i < 0x2000; i++) {
                this.charROM[i] = this.rom[this.gfxBase + i];
            }
            console.log(`Character ROM loaded: ${this.charROM.length} bytes (2 bitplanes of 4KB each)`);
        } else {
            console.log(`ERROR: ROM too small for character data at ${this.gfxBase.toString(16)}`);
        }
    }

    loadState(state) {
        this.cpu.loadState(state.c);
        this.ram.set(state.ram);
        this.vram.set(state.vr);
        this.cram.set(state.cr);
        this.oram.set(state.or);
        this.watchdog_counter = state.wdc;
        this.interruptEnabled = state.ie;
        this.loadControlsState(state);
    }

    saveState() {
        return {
            c: this.cpu.saveState(),
            ram: this.ram.slice(0),
            vr: this.vram.slice(0),
            cr: this.cram.slice(0),
            or: this.oram.slice(0),
            wdc: this.watchdog_counter,
            ie: this.interruptEnabled,
            inputs: this.inputs.slice(0)
        };
    }

    setKeyInput(key: number, code: number, flags: number): void {
        console.log(`setKeyInput called: key=${key} code=${code} flags=${flags}`);
        console.log(`Inputs before:`, Array.from(this.inputs).map(x => x.toString(16)));
        super.setKeyInput(key, code, flags);
        console.log(`Inputs after:`, Array.from(this.inputs).map(x => x.toString(16)));
    }

    advanceCPU() {
        // Track PC for reset detection
        var currentPC = this.cpu.getPC();
        if (currentPC === 0x0000 && this.lastPC !== 0x0000) {
            console.log(`*** RESET DETECTED: PC jumped to 0x0000 from ${this.lastPC.toString(16)} ***`);
            console.log(`Frame: ${this.frameCounter}, Interrupt enabled: ${this.interruptEnabled}`);
        }
        this.lastPC = currentPC;
        
        // Execute one CPU instruction and track cycles (like pac-c emulator)
        var elapsed_cycles = this.cpu.advanceInsn();
        this.cpuCycleCounter += elapsed_cycles;
        
        // Check for VBLANK interrupt every PAC_CYCLES_PER_FRAME cycles (like pac-c emulator)
        var PAC_CYCLES_PER_FRAME = this.cpuFrequency / 60; // 60 FPS
        
        if (this.cpuCycleCounter >= PAC_CYCLES_PER_FRAME) {
            this.cpuCycleCounter -= PAC_CYCLES_PER_FRAME;
            
            // Trigger VBLANK interrupt if enabled (like pac-c emulator)
            if (this.interruptEnabled) {
                // The ROM uses IM 2 mode with interrupt vector 0xFA
                // In IM 2, the interrupt vector forms the low byte of the address
                // The I register (set to 0x3F by ROM) forms the high byte  
                // So interrupt jumps to address (I << 8) | interruptVector = 0x3FFA
                // But the Z80 emulator expects the data byte for IM 0 mode
                // Since our Z80 is in IM 0 mode, we use the interrupt vector directly
                this.cpu.interrupt(this.interruptVector);
            }
        }
        
        return elapsed_cycles;
    }

    startScanline() {
        // Remove scanline-based interrupt - we now use cycle-based timing
        // This method can be empty or handle other scanline-specific tasks
    }

    drawScanline() {
        this.gfx.drawScanline(this.pixels, this.scanline);
    }

    advanceFrame(trap) {
        var steps = super.advanceFrame(trap);
        this.gfx.advanceFrame();
        this.frameCounter++;
        
        // Watchdog - enable proper behavior like other machines
        this.watchdog_counter--;
        if (this.watchdog_counter <= 0) {
            console.log(`*** WATCHDOG TIMEOUT: Fired at frame ${this.frameCounter}, PC=${this.cpu.getPC().toString(16)} ***`);
            throw new EmuHalt("WATCHDOG FIRED - Game should reset");
        }
        
        return steps;
    }
    
    // Helper methods for ROM analysis
    getInstructionName(opcode: number): string {
        const opcodeNames = {
            0x76: 'HALT', 0xFB: 'EI', 0xF3: 'DI', 0xC3: 'JP', 0xCD: 'CALL',
            0xC9: 'RET', 0x00: 'NOP', 0x3E: 'LD A,n', 0x21: 'LD HL,nn'
        };
        return opcodeNames[opcode] || `UNKNOWN(${opcode?.toString(16)})`;
    }
    
    analyzeROMPhase(pc: number): string {
        if (pc < 0x1000) return "INTERRUPT_VECTORS";
        if (pc >= 0x2300 && pc <= 0x2400) return "INITIALIZATION";
        if (pc >= 0x1000 && pc <= 0x2000) return "MAIN_PROGRAM";
        if (pc >= 0x3000) return "GAME_LOGIC"; 
        return `UNKNOWN_AREA(${pc.toString(16)})`;
    }
    
    analyzeVRAMActivity(): string {
        var nonZeroCount = 0;
        var nonSpaceCount = 0;
        for (var i = 0; i < this.vram.length; i++) {
            if (this.vram[i] !== 0) nonZeroCount++;
            if (this.vram[i] !== 0x40) nonSpaceCount++; // 0x40 is typically space character
        }
        
        if (nonSpaceCount > 50) return `ACTIVE_GRAPHICS(${nonSpaceCount}_tiles)`;
        if (nonZeroCount > 0) return `CLEARING_SCREEN(${nonZeroCount}_spaces)`;
        return "NO_ACTIVITY";
    }
    
    checkForAttractMode(): void {
        // Look for signs that ROM has moved to attract mode
        var pc = this.cpu.getPC();
        var vramActive = this.analyzeVRAMActivity();
        
        if (vramActive.includes("ACTIVE_GRAPHICS")) {
            console.log("🎉 SUCCESS: ROM appears to have reached game/attract mode!");
            console.log(`   Graphics are being drawn: ${vramActive}`);
        } else if (pc < 0x2000 && pc !== 0x234a) {
            console.log("🔄 PROGRESS: ROM has moved beyond initialization phase");
            console.log(`   Now executing in main program area: PC=${pc.toString(16)}`);
        } else {
            // Check if we're still in initialization
            if (pc === 0x234a) {
                console.log("⏳ STILL INITIALIZING: ROM still in HALT/interrupt cycle");
                console.log("   This is normal - real Pacman hardware takes time to initialize");
            }
        }
    }

    loadROM(data) {
        this.rom.set(padBytes(data, this.defaultROMSize));
        
        console.log(`ROM loaded: ${data.length} bytes, padded to ${this.defaultROMSize}`);
        console.log(`First few ROM bytes: ${Array.from(this.rom.slice(0, 16)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`);
        
        // DEBUG: Check interrupt vectors and important code locations
        console.log(`=== INTERRUPT VECTOR DEBUG ===`);
        console.log(`RST 0x00 (0x0000): ${Array.from(this.rom.slice(0x00, 0x08)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`RST 0x08 (0x0008): ${Array.from(this.rom.slice(0x08, 0x10)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`RST 0x10 (0x0010): ${Array.from(this.rom.slice(0x10, 0x18)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`RST 0x18 (0x0018): ${Array.from(this.rom.slice(0x18, 0x20)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`RST 0x20 (0x0020): ${Array.from(this.rom.slice(0x20, 0x28)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`RST 0x28 (0x0028): ${Array.from(this.rom.slice(0x28, 0x30)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`RST 0x30 (0x0030): ${Array.from(this.rom.slice(0x30, 0x38)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`RST 0x38 (0x0038): ${Array.from(this.rom.slice(0x38, 0x40)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`NMI vector (0x0066): ${Array.from(this.rom.slice(0x66, 0x70)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`);
        
        // Extract graphics and palette data if present in ROM
        if (this.rom.length >= this.gfxBase + 0x2000) {
            // Extract character ROM (8KB at 0x4000)
            this.charROM = new Uint8Array(0x2000);
            this.charROM.set(this.rom.slice(this.gfxBase, this.gfxBase + 0x2000));
            console.log(`Character ROM extracted: ${this.charROM.length} bytes from ${this.gfxBase.toString(16)}`);
        }
        
        if (this.rom.length >= this.palBase + 32) {
            // Extract palette data (32 bytes at 0x6000)
            var palette_data = this.rom.slice(this.palBase, this.palBase + 32);
            this.palette = new Uint32Array(32);
            for (var i = 0; i < 32; i++) {
                // Convert 4-bit RGB to 32-bit RGBA
                var val = palette_data[i];
                var r = ((val >> 0) & 1) * 0x21 + ((val >> 1) & 1) * 0x47 + ((val >> 2) & 1) * 0x97;
                var g = ((val >> 3) & 1) * 0x21 + ((val >> 4) & 1) * 0x47 + ((val >> 5) & 1) * 0x97;
                var b = ((val >> 6) & 1) * 0x51 + ((val >> 7) & 1) * 0xae;
                this.palette[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
            }
            console.log(`Palette extracted: 32 colors from ${this.palBase.toString(16)}`);
        }
        
        // Initialize graphics system
        this.gfx = new PacmanVideo(this, this.charROM, this.vram, this.cram, this.oram, this.palette, {});
        console.log("Graphics system initialized");
    }

    // Required interface methods - delegate to hooks
    read(a: number): number {
        return this.readByteHook(a);
    }
    
    write(a: number, val: number): void {
        this.writeByteHook(a, val);
    }
    
    readConst(a: number): number {
        return this.readByteHook(a);
    }
} 