"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
const PCE_PRESETS = [
    { id: 'test_conio.c', name: 'Hello World (conio)' },
    { id: 'siegegame.c', name: 'Siege Game (conio)' },
    { id: 'hello.wiz', name: 'Hello World (Wiz)' },
];
class PCEnginePlatform {
    constructor(mainElement) {
        this.mainElement = mainElement;
    }
    start() {
        this.pce = new PCE();
        this.video = new emu_1.RasterVideo(this.mainElement, 684, 262, { overscan: true, aspect: 4 / 3 });
        this.video.create();
        this.pce.SetCanvas(this.video.canvas);
    }
    reset() {
        this.pce.Reset();
    }
    isRunning() {
        return this.pce.TimerID != null;
    }
    pause() {
        this.pce.Pause();
    }
    resume() {
        this.pce.CreateAudioContext();
        this.pce.Start();
    }
    getPresets() {
        return PCE_PRESETS;
    }
    loadROM(title, rom) {
        this.pce.Pause();
        this.pce.Init();
        this.pce.SetROM(rom);
    }
    getPlatformName() {
        return "PC Engine";
    }
    getToolForFilename(fn) {
        return (0, baseplatform_1.getToolForFilename_6502)(fn);
    }
    getDefaultExtension() {
        return ".pce";
    }
    readAddress(addr) {
        return this.pce.Get(addr);
    }
    writeAddress(addr, value) {
        this.pce.Set(addr, value);
    }
    readVRAMAddress(addr) {
        return this.pce.VDC[0].VRAM[addr];
    }
}
emu_1.PLATFORMS['pce'] = PCEnginePlatform;
/*

https://github.com/yhzmr442/jspce

MIT License

Copyright (c) 2019 yhzmr442

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
class PCE {
    constructor() {
        this.MainCanvas = null;
        this.Ctx = null;
        this.ImageData = null;
        this.MapperBase = class {
            constructor(rom, core) {
                this.ROM = rom;
                this.Core = core;
            }
            Init() {
            }
            Read(address) {
                return 0xFF;
            }
            Write(address, data) {
            }
        };
        this.VDCSelect = 0;
        this.ScreenWidthMAX = 0;
        this.ScreenHeightMAX = 0;
        /* ***************** */
        /* **** Setting **** */
        /* ***************** */
        this.SuperGrafx = false;
        this.CountryTypePCE = 0x40;
        this.CountryTypeTG16 = 0x00;
        this.CountryType = this.CountryTypePCE;
        this.GamePadButton6 = false;
        this.MultiTap = false;
        /* ******************* */
        /* **** Construct **** */
        /* ******************* */
        this.EtcConstruct();
        this.CPUConstruct();
        this.StorageConstruct();
        this.VCEConstruct();
        this.VPCConstruct();
        this.VDCConstruct();
        this.SoundConstruct();
        this.PSGConstruct();
        this.TimerConstruct();
        this.JoystickConstruct();
    }
    /* ************* */
    /* **** ETC **** */
    /* ************* */
    EtcConstruct() {
        this.TimerID = null;
        this.MainCanvas = null;
        this.Ctx = null;
        this.ImageData = null;
    }
    UpdateAnimationFrame() {
        this.TimerID = window.requestAnimationFrame(this.UpdateAnimationFrame.bind(this));
        this.Run();
    }
    CancelAnimationFrame() {
        window.cancelAnimationFrame(this.TimerID);
        this.TimerID = null;
    }
    Pause() {
        if (this.TimerID != null) {
            this.JoystickEventRelease();
            this.CancelAnimationFrame();
        }
    }
    Start() {
        if (this.TimerID == null) {
            this.JoystickEventInit();
            this.UpdateAnimationFrame();
        }
    }
    Run() {
        this.CheckGamePad();
        this.DrawFlag = false;
        while (!this.DrawFlag) {
            this.CPURun();
            this.VDCRun();
            this.TimerRun();
            this.PSGRun();
        }
    }
    Reset() {
        this.StorageReset();
        this.Mapper.Init();
        this.CPUInit();
        this.VCEInit();
        this.VPCInit();
        this.VDCInit();
        this.TimerInit();
        this.JoystickInit();
        this.PSGInit();
        this.CPUReset();
    }
    Init() {
        this.StorageInit();
        this.CPUInit();
        this.VCEInit();
        this.VPCInit();
        this.VDCInit();
        this.TimerInit();
        this.JoystickInit();
        this.PSGInit();
    }
    SetCanvas(canvas) {
        this.MainCanvas = canvas;
        if (!this.MainCanvas.getContext)
            return false;
        this.Ctx = this.MainCanvas.getContext("2d");
        this.ImageData = this.Ctx.createImageData(this.MainCanvas.width, this.MainCanvas.height); // this.ScreenWidthMAX, this.ScreenHeightMAX);
        for (let i = 0; i < this.MainCanvas.width * this.MainCanvas.height * 4; i += 4) {
            this.ImageData.data[i] = 0;
            this.ImageData.data[i + 1] = 0;
            this.ImageData.data[i + 2] = 0;
            this.ImageData.data[i + 3] = 255;
        }
        this.Ctx.putImageData(this.ImageData, 0, 0);
        return true;
    }
    /* ************* */
    /* **** CPU **** */
    /* ************* */
    CPUConstruct() {
        this.OpCycles = [
            8, 7, 3, 4, 6, 4, 6, 7, 3, 2, 2, 2, 7, 5, 7, 6, // 0x00
            2, 7, 7, 4, 6, 4, 6, 7, 2, 5, 2, 2, 7, 5, 7, 6, // 0x10
            7, 7, 3, 4, 4, 4, 6, 7, 3, 2, 2, 2, 5, 5, 7, 6, // 0x20
            2, 7, 7, 2, 4, 4, 6, 7, 2, 5, 2, 2, 5, 5, 7, 6, // 0x30
            7, 7, 3, 4, 8, 4, 6, 7, 3, 2, 2, 2, 4, 5, 7, 6, // 0x40
            2, 7, 7, 5, 2, 4, 6, 7, 2, 5, 3, 2, 2, 5, 7, 6, // 0x50
            7, 7, 2, 2, 4, 4, 6, 7, 3, 2, 2, 2, 7, 5, 7, 6, // 0x60
            2, 7, 7, 0, 4, 4, 6, 7, 2, 5, 3, 2, 7, 5, 7, 6, // 0x70
            4, 7, 2, 7, 4, 4, 4, 7, 2, 2, 2, 2, 5, 5, 5, 6, // 0x80
            2, 7, 7, 8, 4, 4, 4, 7, 2, 5, 2, 2, 5, 5, 5, 6, // 0x90
            2, 7, 2, 7, 4, 4, 4, 7, 2, 2, 2, 2, 5, 5, 5, 6, // 0xA0
            2, 7, 7, 8, 4, 4, 4, 7, 2, 5, 2, 2, 5, 5, 5, 6, // 0xB0
            2, 7, 2, 0, 4, 4, 6, 7, 2, 2, 2, 2, 5, 5, 7, 6, // 0xC0
            2, 7, 7, 0, 2, 4, 6, 7, 2, 5, 3, 2, 2, 5, 7, 6, // 0xD0
            2, 7, 2, 0, 4, 4, 6, 7, 2, 2, 2, 2, 5, 5, 7, 6, // 0xE0
            2, 7, 7, 0, 2, 4, 6, 7, 2, 5, 3, 2, 2, 5, 7, 6
        ]; //0xF0
        this.OpBytes = [
            0, 2, 1, 2, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 0, // 0x00
            0, 2, 2, 2, 2, 2, 2, 2, 1, 3, 1, 1, 3, 3, 3, 0, // 0x10
            0, 2, 1, 2, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 0, // 0x20
            0, 2, 2, 1, 2, 2, 2, 2, 1, 3, 1, 1, 3, 3, 3, 0, // 0x30
            0, 2, 1, 2, 0, 2, 2, 2, 1, 2, 1, 1, 0, 3, 3, 0, // 0x40
            0, 2, 2, 2, 1, 2, 2, 2, 1, 3, 1, 1, 1, 3, 3, 0, // 0x50
            0, 2, 1, 1, 2, 2, 2, 2, 1, 2, 1, 1, 0, 3, 3, 0, // 0x60
            0, 2, 2, 0, 2, 2, 2, 2, 1, 3, 1, 1, 0, 3, 3, 0, // 0x70
            0, 2, 1, 3, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 0, // 0x80
            0, 2, 2, 4, 2, 2, 2, 2, 1, 3, 1, 1, 3, 3, 3, 0, // 0x90
            2, 2, 2, 3, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 0, // 0xA0
            0, 2, 2, 4, 2, 2, 2, 2, 1, 3, 1, 1, 3, 3, 3, 0, // 0xB0
            2, 2, 1, 0, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 0, // 0xC0
            0, 2, 2, 0, 1, 2, 2, 2, 1, 3, 1, 1, 1, 3, 3, 0, // 0xD0
            2, 2, 1, 0, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 0, // 0xE0
            0, 2, 2, 0, 1, 2, 2, 2, 1, 3, 1, 1, 1, 3, 3, 0
        ]; //0xF0
        this.A = 0;
        this.X = 0;
        this.Y = 0;
        this.PC = 0;
        this.S = 0;
        this.P = 0;
        this.NZCacheTable = new Uint8Array(0x100);
        this.NZCacheTable = this.NZCacheTable.map((d, i) => { return i & 0x80; });
        this.NZCacheTable[0x00] = 0x02;
        this.NFlag = 0x80;
        this.VFlag = 0x40;
        this.TFlag = 0x20;
        this.BFlag = 0x10;
        this.DFlag = 0x08;
        this.IFlag = 0x04;
        this.ZFlag = 0x02;
        this.CFlag = 0x01;
        this.TIQFlag = 0x04;
        this.IRQ1Flag = 0x02;
        this.IRQ2Flag = 0x01;
        this.ProgressClock = 0;
        this.CPUBaseClock = 0;
        this.BaseClock1 = 12;
        this.BaseClock3 = 6;
        this.BaseClock5 = 4;
        this.BaseClock7 = 3;
        this.BaseClock10 = 2;
        this.TransferSrc = 0;
        this.TransferDist = 0;
        this.TransferLen = 0;
        this.TransferAlt = 0;
    }
    CPUReset() {
        this.TransferSrc = 0;
        this.TransferDist = 0;
        this.TransferLen = 0;
        this.TransferAlt = 0;
        this.CPUBaseClock = this.BaseClock1;
        this.SetIFlag();
        this.PC = this.Get16(0xFFFE);
    }
    CPUInit() {
        this.A = 0;
        this.X = 0;
        this.Y = 0;
        this.PC = 0;
        this.S = 0;
        this.P = 0x00;
        this.ProgressClock = 0;
        this.CPUBaseClock = this.BaseClock1;
        this.TransferSrc = 0;
        this.TransferDist = 0;
        this.TransferLen = 0;
        this.TransferAlt = 0;
        this.LastInt = 0x00;
    }
    CPURun() {
        this.ProgressClock = 0;
        let tmp = this.LastInt;
        this.LastInt = (this.P & this.IFlag) == 0x00 ? this.GetIntStatus() : 0x00;
        if (tmp != 0x00 && this.TransferLen == 0) {
            this.LastInt = 0x00;
            if ((tmp & this.TIQFlag) == this.TIQFlag) { //TIQ
                this.Push(this.PCH());
                this.Push(this.PCL());
                this.Push(this.P);
                this.P = 0x04;
                this.PC = this.Get16(0xFFFA);
            }
            else if ((tmp & this.IRQ1Flag) == this.IRQ1Flag) { //IRQ1
                this.Push(this.PCH());
                this.Push(this.PCL());
                this.Push(this.P);
                this.P = 0x04;
                this.PC = this.Get16(0xFFF8);
            }
            else if ((tmp & this.IRQ2Flag) == this.IRQ2Flag) { //IRQ2
                this.Push(this.PCH());
                this.Push(this.PCL());
                this.Push(this.P);
                this.SetIFlag();
                this.PC = this.Get16(0xFFF6);
            }
            this.ProgressClock = 8 * this.CPUBaseClock;
        }
        else
            this.OpExec();
    }
    OpExec() {
        let address;
        let tmp;
        let data;
        let bit;
        let i;
        let op = this.Get(this.PC);
        switch (op) {
            case 0x69: // ADC IMM
                this.ADC(this.PC + 1);
                break;
            case 0x65: // ADC ZP
                this.ADC(this.ZP());
                break;
            case 0x75: // ADC ZP, X
                this.ADC(this.ZP_X());
                break;
            case 0x72: // ADC (IND)
                this.ADC(this.IND());
                break;
            case 0x61: // ADC (IND, X)
                this.ADC(this.IND_X());
                break;
            case 0x71: // ADC (IND), Y
                this.ADC(this.IND_Y());
                break;
            case 0x6D: // ADC ABS
                this.ADC(this.ABS());
                break;
            case 0x7D: // ADC ABS, X
                this.ADC(this.ABS_X());
                break;
            case 0x79: // ADC ABS, Y
                this.ADC(this.ABS_Y());
                break;
            case 0xE9: // SBC IMM
                this.SBC(this.PC + 1);
                break;
            case 0xE5: // SBC ZP
                this.SBC(this.ZP());
                break;
            case 0xF5: // SBC ZP, X
                this.SBC(this.ZP_X());
                break;
            case 0xF2: // SBC (IND)
                this.SBC(this.IND());
                break;
            case 0xE1: // SBC (IND, X)
                this.SBC(this.IND_X());
                break;
            case 0xF1: // SBC (IND), Y
                this.SBC(this.IND_Y());
                break;
            case 0xED: // SBC ABS
                this.SBC(this.ABS());
                break;
            case 0xFD: // SBC ABS, X
                this.SBC(this.ABS_X());
                break;
            case 0xF9: // SBC ABS, Y
                this.SBC(this.ABS_Y());
                break;
            case 0x29: // AND IMM
                this.AND(this.PC + 1);
                break;
            case 0x25: // AND ZP
                this.AND(this.ZP());
                break;
            case 0x35: // AND ZP, X
                this.AND(this.ZP_X());
                break;
            case 0x32: // AND (IND)
                this.AND(this.IND());
                break;
            case 0x21: // AND (IND, X)
                this.AND(this.IND_X());
                break;
            case 0x31: // AND (IND), Y
                this.AND(this.IND_Y());
                break;
            case 0x2D: // AND ABS
                this.AND(this.ABS());
                break;
            case 0x3D: // AND ABS, X
                this.AND(this.ABS_X());
                break;
            case 0x39: // AND ABS, Y
                this.AND(this.ABS_Y());
                break;
            case 0x49: // EOR IMM
                this.EOR(this.PC + 1);
                break;
            case 0x45: // EOR ZP
                this.EOR(this.ZP());
                break;
            case 0x55: // EOR ZP, X
                this.EOR(this.ZP_X());
                break;
            case 0x52: // EOR (IND)
                this.EOR(this.IND());
                break;
            case 0x41: // EOR (IND, X)
                this.EOR(this.IND_X());
                break;
            case 0x51: // EOR (IND), Y
                this.EOR(this.IND_Y());
                break;
            case 0x4D: // EOR ABS
                this.EOR(this.ABS());
                break;
            case 0x5D: // EOR ABS, X
                this.EOR(this.ABS_X());
                break;
            case 0x59: // EOR ABS, Y
                this.EOR(this.ABS_Y());
                break;
            case 0x09: // ORA IMM
                this.ORA(this.PC + 1);
                break;
            case 0x05: // ORA ZP
                this.ORA(this.ZP());
                break;
            case 0x15: // ORA ZP, X
                this.ORA(this.ZP_X());
                break;
            case 0x12: // ORA (IND)
                this.ORA(this.IND());
                break;
            case 0x01: // ORA (IND, X)
                this.ORA(this.IND_X());
                break;
            case 0x11: // ORA (IND), Y
                this.ORA(this.IND_Y());
                break;
            case 0x0D: // ORA ABS
                this.ORA(this.ABS());
                break;
            case 0x1D: // ORA ABS, X
                this.ORA(this.ABS_X());
                break;
            case 0x19: // ORA ABS, Y
                this.ORA(this.ABS_Y());
                break;
            case 0x06: // ASL ZP
                address = this.ZP();
                this.Set(address, this.ASL(this.Get(address)));
                break;
            case 0x16: // ASL ZP, X
                address = this.ZP_X();
                this.Set(address, this.ASL(this.Get(address)));
                break;
            case 0x0E: // ASL ABS
                address = this.ABS();
                this.Set(address, this.ASL(this.Get(address)));
                break;
            case 0x1E: // ASL ABS, X
                address = this.ABS_X();
                this.Set(address, this.ASL(this.Get(address)));
                break;
            case 0x0A: // ASL A
                this.A = this.ASL(this.A);
                break;
            case 0x46: // LSR ZP
                address = this.ZP();
                this.Set(address, this.LSR(this.Get(address)));
                break;
            case 0x56: // LSR ZP, X
                address = this.ZP_X();
                this.Set(address, this.LSR(this.Get(address)));
                break;
            case 0x4E: // LSR ABS
                address = this.ABS();
                this.Set(address, this.LSR(this.Get(address)));
                break;
            case 0x5E: // LSR ABS, X
                address = this.ABS_X();
                this.Set(address, this.LSR(this.Get(address)));
                break;
            case 0x4A: // LSR A
                this.A = this.LSR(this.A);
                break;
            case 0x26: // ROL ZP
                address = this.ZP();
                this.Set(address, this.ROL(this.Get(address)));
                break;
            case 0x36: // ROL ZP, X
                address = this.ZP_X();
                this.Set(address, this.ROL(this.Get(address)));
                break;
            case 0x2E: // ROL ABS
                address = this.ABS();
                this.Set(address, this.ROL(this.Get(address)));
                break;
            case 0x3E: // ROL ABS, X
                address = this.ABS_X();
                this.Set(address, this.ROL(this.Get(address)));
                break;
            case 0x2A: // ROL A
                this.A = this.ROL(this.A);
                break;
            case 0x66: // ROR ZP
                address = this.ZP();
                this.Set(address, this.ROR(this.Get(address)));
                break;
            case 0x76: // ROR ZP, X
                address = this.ZP_X();
                this.Set(address, this.ROR(this.Get(address)));
                break;
            case 0x6E: // ROR ABS
                address = this.ABS();
                this.Set(address, this.ROR(this.Get(address)));
                break;
            case 0x7E: // ROR ABS, X
                address = this.ABS_X();
                this.Set(address, this.ROR(this.Get(address)));
                break;
            case 0x6A: // ROR A
                this.A = this.ROR(this.A);
                break;
            case 0x0F: // BBR0
                this.BBRi(0);
                break;
            case 0x1F: // BBR1
                this.BBRi(1);
                break;
            case 0x2F: // BBR2
                this.BBRi(2);
                break;
            case 0x3F: // BBR3
                this.BBRi(3);
                break;
            case 0x4F: // BBR4
                this.BBRi(4);
                break;
            case 0x5F: // BBR5
                this.BBRi(5);
                break;
            case 0x6F: // BBR6
                this.BBRi(6);
                break;
            case 0x7F: // BBR7
                this.BBRi(7);
                break;
            case 0x8F: // BBS0
                this.BBSi(0);
                break;
            case 0x9F: // BBS1
                this.BBSi(1);
                break;
            case 0xAF: // BBS2
                this.BBSi(2);
                break;
            case 0xBF: // BBS3
                this.BBSi(3);
                break;
            case 0xCF: // BBS4
                this.BBSi(4);
                break;
            case 0xDF: // BBS5
                this.BBSi(5);
                break;
            case 0xEF: // BBS6
                this.BBSi(6);
                break;
            case 0xFF: // BBS7
                this.BBSi(7);
                break;
            case 0x90: // BCC
                this.Branch((this.P & this.CFlag) == 0x00, 1);
                break;
            case 0xB0: // BCS
                this.Branch((this.P & this.CFlag) == this.CFlag, 1);
                break;
            case 0xD0: // BNE
                this.Branch((this.P & this.ZFlag) == 0x00, 1);
                break;
            case 0xF0: // BEQ
                this.Branch((this.P & this.ZFlag) == this.ZFlag, 1);
                break;
            case 0x10: // BPL
                this.Branch((this.P & this.NFlag) == 0x00, 1);
                break;
            case 0x30: // BMI
                this.Branch((this.P & this.NFlag) == this.NFlag, 1);
                break;
            case 0x50: // BVC
                this.Branch((this.P & this.VFlag) == 0x00, 1);
                break;
            case 0x70: // BVS
                this.Branch((this.P & this.VFlag) == this.VFlag, 1);
                break;
            case 0x80: // BRA
                this.Branch(true, 1);
                break;
            case 0x44: // BSR
                this.PC++;
                this.Push(this.PCH());
                this.Push(this.PCL());
                this.Branch(true, 0);
                break;
            case 0x20: // JSR ABS
                tmp = this.ABS();
                this.PC += 2;
                this.Push(this.PCH());
                this.Push(this.PCL());
                this.PC = tmp;
                this.ClearTFlag();
                break;
            case 0x40: // RTI
                this.P = this.Pull();
                this.toPCL(this.Pull());
                this.toPCH(this.Pull());
                break;
            case 0x60: // RTS
                this.ClearTFlag();
                this.toPCL(this.Pull());
                this.toPCH(this.Pull());
                this.PC++;
                break;
            case 0x4C: // JMP ABS
                this.PC = this.ABS();
                this.ClearTFlag();
                break;
            case 0x6C: // JMP (ABS)
                this.PC = this.ABS_IND();
                this.ClearTFlag();
                break;
            case 0x7C: // JMP (ABS, X)
                this.PC = this.ABS_X_IND();
                this.ClearTFlag();
                break;
            case 0x00: // BRK
                this.PC += 2;
                this.Push(this.PCH());
                this.Push(this.PCL());
                this.SetBFlag();
                this.Push(this.P);
                this.ClearDFlag();
                this.ClearTFlag();
                this.SetIFlag();
                this.PC = this.Get16(0xFFF6);
                break;
            case 0x62: // CLA
                this.A = 0x00;
                this.ClearTFlag();
                break;
            case 0x82: // CLX
                this.X = 0x00;
                this.ClearTFlag();
                break;
            case 0xC2: // CLY
                this.Y = 0x00;
                this.ClearTFlag();
                break;
            case 0x18: // CLC
                this.ClearCFlag();
                this.ClearTFlag();
                break;
            case 0xD8: // CLD
                this.ClearDFlag();
                this.ClearTFlag();
                break;
            case 0x58: // CLI
                this.ClearIFlag();
                this.ClearTFlag();
                break;
            case 0xB8: // CLV
                this.ClearVFlag();
                this.ClearTFlag();
                break;
            case 0x38: // SEC
                this.SetCFlag();
                this.ClearTFlag();
                break;
            case 0xF8: // SED
                this.SetDFlag();
                this.ClearTFlag();
                break;
            case 0x78: // SEI
                this.SetIFlag();
                this.ClearTFlag();
                break;
            case 0xF4: // SET
                this.SetTFlag();
                break;
            case 0xC9: // CMP IMM
                this.Compare(this.A, this.PC + 1);
                break;
            case 0xC5: // CMP ZP
                this.Compare(this.A, this.ZP());
                break;
            case 0xD5: // CMP ZP, X
                this.Compare(this.A, this.ZP_X());
                break;
            case 0xD2: // CMP (IND)
                this.Compare(this.A, this.IND());
                break;
            case 0xC1: // CMP (IND, X)
                this.Compare(this.A, this.IND_X());
                break;
            case 0xD1: // CMP (IND), Y
                this.Compare(this.A, this.IND_Y());
                break;
            case 0xCD: // CMP ABS
                this.Compare(this.A, this.ABS());
                break;
            case 0xDD: // CMP ABS, X
                this.Compare(this.A, this.ABS_X());
                break;
            case 0xD9: // CMP ABS, Y
                this.Compare(this.A, this.ABS_Y());
                break;
            case 0xE0: // CPX IMM
                this.Compare(this.X, this.PC + 1);
                break;
            case 0xE4: // CPX ZP
                this.Compare(this.X, this.ZP());
                break;
            case 0xEC: // CPX ABS
                this.Compare(this.X, this.ABS());
                break;
            case 0xC0: // CPY IMM
                this.Compare(this.Y, this.PC + 1);
                break;
            case 0xC4: // CPY ZP
                this.Compare(this.Y, this.ZP());
                break;
            case 0xCC: // CPY ABS
                this.Compare(this.Y, this.ABS());
                break;
            case 0xC6: // DEC ZP
                address = this.ZP();
                this.Set(address, this.Decrement(this.Get(address)));
                break;
            case 0xD6: // DEC ZP, X
                address = this.ZP_X();
                this.Set(address, this.Decrement(this.Get(address)));
                break;
            case 0xCE: // DEC ABS
                address = this.ABS();
                this.Set(address, this.Decrement(this.Get(address)));
                break;
            case 0xDE: // DEC ABS, X
                address = this.ABS_X();
                this.Set(address, this.Decrement(this.Get(address)));
                break;
            case 0x3A: // DEC A
                this.A = this.Decrement(this.A);
                break;
            case 0xCA: // DEX
                this.X = this.Decrement(this.X);
                break;
            case 0x88: // DEY
                this.Y = this.Decrement(this.Y);
                break;
            case 0xE6: // INC ZP
                address = this.ZP();
                this.Set(address, this.Increment(this.Get(address)));
                break;
            case 0xF6: // INC ZP, X
                address = this.ZP_X();
                this.Set(address, this.Increment(this.Get(address)));
                break;
            case 0xEE: // INC ABS
                address = this.ABS();
                this.Set(address, this.Increment(this.Get(address)));
                break;
            case 0xFE: // INC ABS, X
                address = this.ABS_X();
                this.Set(address, this.Increment(this.Get(address)));
                break;
            case 0x1A: // INC A
                this.A = this.Increment(this.A);
                break;
            case 0xE8: // INX
                this.X = this.Increment(this.X);
                break;
            case 0xC8: // INY
                this.Y = this.Increment(this.Y);
                break;
            case 0x48: // PHA
                this.Push(this.A);
                this.ClearTFlag();
                break;
            case 0x08: // PHP
                this.Push(this.P);
                this.ClearTFlag();
                break;
            case 0xDA: // PHX
                this.Push(this.X);
                this.ClearTFlag();
                break;
            case 0x5A: // PHY
                this.Push(this.Y);
                this.ClearTFlag();
                break;
            case 0x68: // PLA
                this.A = this.Pull();
                this.SetNZFlag(this.A);
                this.ClearTFlag();
                break;
            case 0x28: // PLP
                this.P = this.Pull();
                break;
            case 0xFA: // PLX
                this.X = this.Pull();
                this.SetNZFlag(this.X);
                this.ClearTFlag();
                break;
            case 0x7A: // PLY
                this.Y = this.Pull();
                this.SetNZFlag(this.Y);
                this.ClearTFlag();
                break;
            case 0x07: // RMB0
                this.RMBi(0);
                break;
            case 0x17: // RMB1
                this.RMBi(1);
                break;
            case 0x27: // RMB2
                this.RMBi(2);
                break;
            case 0x37: // RMB3
                this.RMBi(3);
                break;
            case 0x47: // RMB4
                this.RMBi(4);
                break;
            case 0x57: // RMB5
                this.RMBi(5);
                break;
            case 0x67: // RMB6
                this.RMBi(6);
                break;
            case 0x77: // RMB7
                this.RMBi(7);
                break;
            case 0x87: // SMB0
                this.SMBi(0);
                break;
            case 0x97: // SMB1
                this.SMBi(1);
                break;
            case 0xA7: // SMB2
                this.SMBi(2);
                break;
            case 0xB7: // SMB3
                this.SMBi(3);
                break;
            case 0xC7: // SMB4
                this.SMBi(4);
                break;
            case 0xD7: // SMB5
                this.SMBi(5);
                break;
            case 0xE7: // SMB6
                this.SMBi(6);
                break;
            case 0xF7: // SMB7
                this.SMBi(7);
                break;
            case 0x22: // SAX
                tmp = this.A;
                this.A = this.X;
                this.X = tmp;
                this.ClearTFlag();
                break;
            case 0x42: // SAY
                tmp = this.A;
                this.A = this.Y;
                this.Y = tmp;
                this.ClearTFlag();
                break;
            case 0x02: // SXY
                tmp = this.X;
                this.X = this.Y;
                this.Y = tmp;
                this.ClearTFlag();
                break;
            case 0xAA: // TAX
                this.X = this.A;
                this.SetNZFlag(this.X);
                this.ClearTFlag();
                break;
            case 0xA8: // TAY
                this.Y = this.A;
                this.SetNZFlag(this.Y);
                this.ClearTFlag();
                break;
            case 0xBA: // TSX
                this.X = this.S;
                this.SetNZFlag(this.X);
                this.ClearTFlag();
                break;
            case 0x8A: // TXA
                this.A = this.X;
                this.SetNZFlag(this.A);
                this.ClearTFlag();
                break;
            case 0x9A: // TXS
                this.S = this.X;
                this.ClearTFlag();
                break;
            case 0x98: // TYA
                this.A = this.Y;
                this.SetNZFlag(this.A);
                this.ClearTFlag();
                break;
            case 0x89: // BIT IMM
                this.BIT(this.PC + 1);
                break;
            case 0x24: // BIT ZP
                this.BIT(this.ZP());
                break;
            case 0x34: // BIT ZP, X
                this.BIT(this.ZP_X());
                break;
            case 0x2C: // BIT ABS
                this.BIT(this.ABS());
                break;
            case 0x3C: // BIT ABS, X
                this.BIT(this.ABS_X());
                break;
            case 0x83: // TST IMM ZP
                this.TST(this.PC + 1, 0x2000 | this.Get(this.PC + 2));
                break;
            case 0xA3: // TST IMM ZP, X
                this.TST(this.PC + 1, 0x2000 | ((this.Get(this.PC + 2) + this.X) & 0xFF));
                break;
            case 0x93: // TST IMM ABS
                this.TST(this.PC + 1, this.Get16(this.PC + 2));
                break;
            case 0xB3: // TST IMM ABS, X
                this.TST(this.PC + 1, (this.Get16(this.PC + 2) + this.X) & 0xFFFF);
                break;
            case 0x14: // TRB ZP
                this.TRB(this.ZP());
                break;
            case 0x1C: // TRB ABS
                this.TRB(this.ABS());
                break;
            case 0x04: // TSB ZP
                this.TSB(this.ZP());
                break;
            case 0x0C: // TSB ABS
                this.TSB(this.ABS());
                break;
            case 0xA9: // LDA IMM
                this.A = this.Load(this.PC + 1);
                break;
            case 0xA5: // LDA ZP
                this.A = this.Load(this.ZP());
                break;
            case 0xB5: // LDA ZP, X
                this.A = this.Load(this.ZP_X());
                break;
            case 0xB2: // LDA (IND)
                this.A = this.Load(this.IND());
                break;
            case 0xA1: // LDA (IND, X)
                this.A = this.Load(this.IND_X());
                break;
            case 0xB1: // LDA (IND), Y
                this.A = this.Load(this.IND_Y());
                break;
            case 0xAD: // LDA ABS
                this.A = this.Load(this.ABS());
                break;
            case 0xBD: // LDA ABS, X
                this.A = this.Load(this.ABS_X());
                break;
            case 0xB9: // LDA ABS, Y
                this.A = this.Load(this.ABS_Y());
                break;
            case 0xA2: // LDX IMM
                this.X = this.Load(this.PC + 1);
                break;
            case 0xA6: // LDX ZP
                this.X = this.Load(this.ZP());
                break;
            case 0xB6: // LDX ZP, Y
                this.X = this.Load(this.ZP_Y());
                break;
            case 0xAE: // LDX ABS
                this.X = this.Load(this.ABS());
                break;
            case 0xBE: // LDX ABS, Y
                this.X = this.Load(this.ABS_Y());
                break;
            case 0xA0: // LDY IMM
                this.Y = this.Load(this.PC + 1);
                break;
            case 0xA4: // LDY ZP
                this.Y = this.Load(this.ZP());
                break;
            case 0xB4: // LDY ZP, X
                this.Y = this.Load(this.ZP_X());
                break;
            case 0xAC: // LDY ABS
                this.Y = this.Load(this.ABS());
                break;
            case 0xBC: // LDY ABS, X
                this.Y = this.Load(this.ABS_X());
                break;
            case 0x85: // STA ZP
                this.Store(this.ZP(), this.A);
                break;
            case 0x95: // STA ZP, X
                this.Store(this.ZP_X(), this.A);
                break;
            case 0x92: // STA (IND)
                this.Store(this.IND(), this.A);
                break;
            case 0x81: // STA (IND, X)
                this.Store(this.IND_X(), this.A);
                break;
            case 0x91: // STA (IND), Y
                this.Store(this.IND_Y(), this.A);
                break;
            case 0x8D: // STA ABS
                this.Store(this.ABS(), this.A);
                break;
            case 0x9D: // STA ABS, X
                this.Store(this.ABS_X(), this.A);
                break;
            case 0x99: // STA ABS, Y
                this.Store(this.ABS_Y(), this.A);
                break;
            case 0x86: // STX ZP
                this.Store(this.ZP(), this.X);
                break;
            case 0x96: // STX ZP, Y
                this.Store(this.ZP_Y(), this.X);
                break;
            case 0x8E: // STX ABS
                this.Store(this.ABS(), this.X);
                break;
            case 0x84: // STY ZP
                this.Store(this.ZP(), this.Y);
                break;
            case 0x94: // STY ZP, X
                this.Store(this.ZP_X(), this.Y);
                break;
            case 0x8C: // STY ABS
                this.Store(this.ABS(), this.Y);
                break;
            case 0x64: // STZ ZP
                this.Store(this.ZP(), 0x00);
                break;
            case 0x74: // STZ ZP, X
                this.Store(this.ZP_X(), 0x00);
                break;
            case 0x9C: // STZ ABS
                this.Store(this.ABS(), 0x00);
                break;
            case 0x9E: // STZ ABS, X
                this.Store(this.ABS_X(), 0x00);
                break;
            case 0xEA: // NOP
                this.ClearTFlag();
                break;
            case 0x03: // ST0
                this.SetVDCRegister(this.Get(this.PC + 1), this.VDCSelect);
                this.ClearTFlag();
                break;
            case 0x13: // ST1
                this.SetVDCLow(this.Get(this.PC + 1), this.VDCSelect);
                this.ClearTFlag();
                break;
            case 0x23: // ST2
                this.SetVDCHigh(this.Get(this.PC + 1), this.VDCSelect);
                this.ClearTFlag();
                break;
            case 0x53: // TAMi
                data = this.Get(this.PC + 1);
                bit = 0x01;
                if (data == 0x00)
                    data = this.MPRSelect;
                else
                    this.MPRSelect = data;
                for (i = 0; i < 8; i++)
                    if ((data & (bit << i)) != 0x00)
                        this.MPR[i] = this.A << 13;
                break;
            case 0x43: // TMAi
                data = this.Get(this.PC + 1);
                bit = 0x01;
                if (data == 0x00)
                    data = this.MPRSelect;
                else
                    this.MPRSelect = data;
                for (i = 0; i < 8; i++)
                    if ((data & (bit << i)) != 0x00)
                        this.A = this.MPR[i] >>> 13;
                break;
            case 0xF3: // TAI
                if (this.TransferLen == 0) {
                    this.TransferSrc = this.Get16(this.PC + 1);
                    this.TransferDist = this.Get16(this.PC + 3);
                    this.TransferLen = this.Get16(this.PC + 5);
                    this.TransferAlt = 1;
                    this.ProgressClock = 17;
                }
                this.Set(this.TransferDist, this.Get(this.TransferSrc));
                this.TransferSrc = (this.TransferSrc + this.TransferAlt) & 0xFFFF;
                this.TransferDist = (this.TransferDist + 1) & 0xFFFF;
                this.TransferLen = (this.TransferLen - 1) & 0xFFFF;
                this.TransferAlt = this.TransferAlt == 1 ? -1 : 1;
                this.ProgressClock += 6;
                if (this.TransferLen == 0) {
                    this.ClearTFlag();
                    this.PC += 7;
                }
                break;
            case 0xC3: // TDD
                if (this.TransferLen == 0) {
                    this.TransferSrc = this.Get16(this.PC + 1);
                    this.TransferDist = this.Get16(this.PC + 3);
                    this.TransferLen = this.Get16(this.PC + 5);
                    this.ProgressClock = 17;
                }
                this.Set(this.TransferDist, this.Get(this.TransferSrc));
                this.TransferSrc = (this.TransferSrc - 1) & 0xFFFF;
                this.TransferDist = (this.TransferDist - 1) & 0xFFFF;
                this.TransferLen = (this.TransferLen - 1) & 0xFFFF;
                this.ProgressClock += 6;
                if (this.TransferLen == 0) {
                    this.ClearTFlag();
                    this.PC += 7;
                }
                break;
            case 0xE3: // TIA
                if (this.TransferLen == 0) {
                    this.TransferSrc = this.Get16(this.PC + 1);
                    this.TransferDist = this.Get16(this.PC + 3);
                    this.TransferLen = this.Get16(this.PC + 5);
                    this.TransferAlt = 1;
                    this.ProgressClock = 17;
                }
                this.Set(this.TransferDist, this.Get(this.TransferSrc));
                this.TransferSrc = (this.TransferSrc + 1) & 0xFFFF;
                this.TransferDist = (this.TransferDist + this.TransferAlt) & 0xFFFF;
                this.TransferLen = (this.TransferLen - 1) & 0xFFFF;
                this.TransferAlt = this.TransferAlt == 1 ? -1 : 1;
                this.ProgressClock += 6;
                if (this.TransferLen == 0) {
                    this.ClearTFlag();
                    this.PC += 7;
                }
                break;
            case 0x73: // TII
                if (this.TransferLen == 0) {
                    this.TransferSrc = this.Get16(this.PC + 1);
                    this.TransferDist = this.Get16(this.PC + 3);
                    this.TransferLen = this.Get16(this.PC + 5);
                    this.ProgressClock = 17;
                }
                this.Set(this.TransferDist, this.Get(this.TransferSrc));
                this.TransferSrc = (this.TransferSrc + 1) & 0xFFFF;
                this.TransferDist = (this.TransferDist + 1) & 0xFFFF;
                this.TransferLen = (this.TransferLen - 1) & 0xFFFF;
                this.ProgressClock += 6;
                if (this.TransferLen == 0) {
                    this.ClearTFlag();
                    this.PC += 7;
                }
                break;
            case 0xD3: // TIN
                if (this.TransferLen == 0) {
                    this.TransferSrc = this.Get16(this.PC + 1);
                    this.TransferDist = this.Get16(this.PC + 3);
                    this.TransferLen = this.Get16(this.PC + 5);
                    this.ProgressClock = 17;
                }
                this.Set(this.TransferDist, this.Get(this.TransferSrc));
                this.TransferSrc = (this.TransferSrc + 1) & 0xFFFF;
                this.TransferLen = (this.TransferLen - 1) & 0xFFFF;
                this.ProgressClock += 6;
                if (this.TransferLen == 0) {
                    this.ClearTFlag();
                    this.PC += 7;
                }
                break;
            case 0xD4: // CSH
                this.ClearTFlag();
                this.CPUBaseClock = this.BaseClock7;
                break;
            case 0x54: // CSL
                this.ClearTFlag();
                this.CPUBaseClock = this.BaseClock1;
                break;
            default:
                this.ClearTFlag(); //NOP
                break;
        }
        this.PC += this.OpBytes[op];
        this.ProgressClock = (this.ProgressClock + this.OpCycles[op]) * this.CPUBaseClock;
    }
    Adder(address, neg) {
        let data0;
        let data1 = this.Get(address);
        if (!neg && (this.P & this.TFlag) == this.TFlag) {
            this.ProgressClock = 3;
            data0 = this.Get(0x2000 | this.X);
        }
        else
            data0 = this.A;
        if (neg)
            data1 = ~data1 & 0xFF;
        let carry = this.P & 0x01;
        let tmp = data0 + data1 + carry;
        if ((this.P & this.DFlag) == 0x00) {
            if ((((~data0 & ~data1 & tmp) | (data0 & data1 & ~tmp)) & 0x80) == 0x80)
                this.SetVFlag();
            else
                this.ClearVFlag();
        }
        else {
            this.ProgressClock += 1;
            if (neg) {
                if ((tmp & 0x0F) > 0x09)
                    tmp -= 0x06;
                if ((tmp & 0xF0) > 0x90)
                    tmp -= 0x60;
            }
            else {
                if (((data0 & 0x0F) + (data1 & 0x0F) + carry) > 0x09)
                    tmp += 0x06;
                if ((tmp & 0x1F0) > 0x90)
                    tmp += 0x60;
            }
        }
        if (tmp > 0xFF)
            this.SetCFlag();
        else
            this.ClearCFlag();
        tmp &= 0xFF;
        this.SetNZFlag(tmp);
        if (!neg && (this.P & this.TFlag) == this.TFlag)
            this.Set(0x2000 | this.X, tmp);
        else
            this.A = tmp;
        this.ClearTFlag();
    }
    ADC(address) {
        this.Adder(address, false);
    }
    SBC(address) {
        this.Adder(address, true);
    }
    AND(address) {
        let data0;
        let data1 = this.Get(address);
        if ((this.P & this.TFlag) == 0x00) {
            data0 = this.A;
        }
        else {
            this.ProgressClock = 3;
            data0 = this.Get(0x2000 | this.X);
        }
        let tmp = data0 & data1;
        this.SetNZFlag(tmp);
        if ((this.P & this.TFlag) == 0x00)
            this.A = tmp;
        else
            this.Set(0x2000 | this.X, tmp);
        this.ClearTFlag();
    }
    EOR(address) {
        let data0;
        let data1 = this.Get(address);
        if ((this.P & this.TFlag) == 0x00) {
            data0 = this.A;
        }
        else {
            this.ProgressClock = 3;
            data0 = this.Get(0x2000 | this.X);
        }
        let tmp = data0 ^ data1;
        this.SetNZFlag(tmp);
        if ((this.P & this.TFlag) == 0x00)
            this.A = tmp;
        else
            this.Set(0x2000 | this.X, tmp);
        this.ClearTFlag();
    }
    ORA(address) {
        let data0;
        let data1 = this.Get(address);
        if ((this.P & this.TFlag) == 0x00) {
            data0 = this.A;
        }
        else {
            this.ProgressClock = 3;
            data0 = this.Get(0x2000 | this.X);
        }
        let tmp = data0 | data1;
        this.SetNZFlag(tmp);
        if ((this.P & this.TFlag) == 0x00)
            this.A = tmp;
        else
            this.Set(0x2000 | this.X, tmp);
        this.ClearTFlag();
    }
    ASL(data) {
        data <<= 1;
        if (data > 0xFF)
            this.SetCFlag();
        else
            this.ClearCFlag();
        data &= 0xFF;
        this.SetNZFlag(data);
        this.ClearTFlag();
        return data;
    }
    LSR(data) {
        if ((data & 0x01) == 0x01)
            this.SetCFlag();
        else
            this.ClearCFlag();
        data >>= 1;
        this.SetNZFlag(data);
        this.ClearTFlag();
        return data;
    }
    ROL(data) {
        data = (data << 1) | (this.P & 0x01);
        if (data > 0xFF)
            this.SetCFlag();
        else
            this.ClearCFlag();
        data &= 0xFF;
        this.SetNZFlag(data);
        this.ClearTFlag();
        return data;
    }
    ROR(data) {
        let tmp = this.P & this.CFlag;
        if ((data & 0x01) == 0x01)
            this.SetCFlag();
        else
            this.ClearCFlag();
        data = (data >> 1) | (tmp << 7);
        this.SetNZFlag(data);
        this.ClearTFlag();
        return data;
    }
    BBRi(bit) {
        let tmp = this.Get(this.ZP());
        tmp = (tmp >> bit) & 0x01;
        this.Branch(tmp == 0, 2);
    }
    BBSi(bit) {
        let tmp = this.Get(this.ZP());
        tmp = (tmp >> bit) & 0x01;
        this.Branch(tmp == 1, 2);
    }
    Branch(status, adr) {
        this.ClearTFlag();
        if (status) {
            let tmp = this.Get(this.PC + adr);
            if (tmp >= 0x80)
                tmp |= 0xFF00;
            this.PC = (this.PC + adr + 1 + tmp) & 0xFFFF;
            this.ProgressClock = 2;
        }
        else
            this.PC += adr + 1;
    }
    Compare(data0, data1) {
        data0 -= this.Get(data1);
        if (data0 < 0)
            this.ClearCFlag();
        else
            this.SetCFlag();
        this.ClearTFlag();
        this.SetNZFlag(data0 & 0xFF);
    }
    Decrement(data) {
        data = (data - 1) & 0xFF;
        this.SetNZFlag(data);
        this.ClearTFlag();
        return data;
    }
    Increment(data) {
        data = (data + 1) & 0xFF;
        this.SetNZFlag(data);
        this.ClearTFlag();
        return data;
    }
    Push(data) {
        this.Set(0x2100 | this.S, data);
        this.S = (this.S - 1) & 0xFF;
    }
    Pull() {
        this.S = (this.S + 1) & 0xFF;
        return this.Get(0x2100 | this.S);
    }
    RMBi(bit) {
        let address = this.ZP();
        this.Set(address, this.Get(address) & ~(0x01 << bit));
        this.ClearTFlag();
    }
    SMBi(bit) {
        let address = this.ZP();
        this.Set(address, this.Get(address) | (0x01 << bit));
        this.ClearTFlag();
    }
    BIT(address) {
        let tmp = this.Get(address);
        this.SetNZFlag(this.A & tmp);
        this.P = (this.P & ~(this.NFlag | this.VFlag)) | (tmp & (this.NFlag | this.VFlag));
        this.ClearTFlag();
    }
    TST(address0, address1) {
        let tmp0 = this.Get(address0);
        let tmp1 = this.Get(address1);
        this.SetNZFlag(tmp0 & tmp1);
        this.P = (this.P & ~(this.NFlag | this.VFlag)) | (tmp1 & (this.NFlag | this.VFlag));
        this.ClearTFlag();
    }
    TRB(address) {
        let tmp = this.Get(address);
        let res = ~this.A & tmp;
        this.Set(address, res);
        this.SetNZFlag(res);
        this.P = (this.P & ~(this.NFlag | this.VFlag)) | (tmp & (this.NFlag | this.VFlag));
        this.ClearTFlag();
    }
    TSB(address) {
        let tmp = this.Get(address);
        let res = this.A | tmp;
        this.Set(address, res);
        this.SetNZFlag(res);
        this.P = (this.P & ~(this.NFlag | this.VFlag)) | (tmp & (this.NFlag | this.VFlag));
        this.ClearTFlag();
    }
    Load(address) {
        let data = this.Get(address);
        this.SetNZFlag(data);
        this.ClearTFlag();
        return data;
    }
    Store(address, data) {
        this.Set(address, data);
        this.ClearTFlag();
    }
    ZP() {
        return 0x2000 | this.Get(this.PC + 1);
    }
    ZP_X() {
        return 0x2000 | ((this.Get(this.PC + 1) + this.X) & 0xFF);
    }
    ZP_Y() {
        return 0x2000 | ((this.Get(this.PC + 1) + this.Y) & 0xFF);
    }
    IND() {
        return this.Get16(0x2000 | this.Get(this.PC + 1));
    }
    IND_X() {
        return this.Get16(0x2000 | ((this.Get(this.PC + 1) + this.X) & 0xFF));
    }
    IND_Y() {
        return (this.Get16(0x2000 | this.Get(this.PC + 1)) + this.Y) & 0xFFFF;
    }
    ABS() {
        return this.Get16(this.PC + 1);
    }
    ABS_X() {
        return (this.Get16(this.PC + 1) + this.X) & 0xFFFF;
    }
    ABS_Y() {
        return (this.Get16(this.PC + 1) + this.Y) & 0xFFFF;
    }
    ABS_IND() {
        return this.Get16(this.Get16(this.PC + 1));
    }
    ABS_X_IND() {
        return this.Get16((this.Get16(this.PC + 1) + this.X) & 0xFFFF);
    }
    SetNZFlag(data) {
        this.P = (this.P & ~(this.NFlag | this.ZFlag)) | this.NZCacheTable[data];
    }
    SetVFlag() {
        this.P |= this.VFlag;
    }
    ClearVFlag() {
        this.P &= ~this.VFlag;
    }
    SetTFlag() {
        this.P |= this.TFlag;
    }
    ClearTFlag() {
        this.P &= ~this.TFlag;
    }
    SetBFlag() {
        this.P |= this.BFlag;
    }
    ClearBFlag() {
        this.P &= ~this.BFlag;
    }
    SetDFlag() {
        this.P |= this.DFlag;
    }
    ClearDFlag() {
        this.P &= ~this.DFlag;
    }
    SetIFlag() {
        this.P |= this.IFlag;
    }
    ClearIFlag() {
        this.P &= ~this.IFlag;
    }
    SetCFlag() {
        this.P |= this.CFlag;
    }
    ClearCFlag() {
        this.P &= ~this.CFlag;
    }
    PCH() {
        return this.PC >> 8;
    }
    PCL() {
        return this.PC & 0x00FF;
    }
    toPCH(data) {
        this.PC = (this.PC & 0x00FF) | (data << 8);
    }
    toPCL(data) {
        this.PC = (this.PC & 0xFF00) | data;
    }
    /* ***************** */
    /* **** Storage **** */
    /* ***************** */
    StorageConstruct() {
        this.MPR = new Array(8);
        this.MPRSelect = 0;
        this.RAM = new Uint8Array(0x8000);
        this.RAMMask = 0x1FFF;
        this.BRAM = new Uint8Array(0x2000).fill(0x00);
        this.BRAMUse = false;
        this.INTIRQ2 = 0x00;
        this.IntDisableRegister = 0;
        this.Mapper = null;
        this.Mapper0 = class extends this.MapperBase {
            constructor(rom, core) {
                super(rom, core);
                let tmp = this.ROM.length - 1;
                this.Address = 0x80000;
                while (this.Address > 0x0000) {
                    if ((this.Address & tmp) != 0x0000)
                        break;
                    this.Address >>>= 1;
                }
            }
            Read(address) {
                if (address >= this.ROM.length)
                    return this.ROM[(address & (this.Address - 1)) | this.Address];
                else
                    return this.ROM[address];
            }
        };
        this.Mapper1 = class extends this.MapperBase {
            constructor(rom, core) {
                super(rom, core);
                this.Address = 0;
            }
            Init() {
                this.Address = 0;
            }
            Read(address) {
                if (address < 0x80000)
                    return this.ROM[address];
                else
                    return this.ROM[this.Address | (address & 0x7FFFF)];
            }
            Write(address, data) {
                this.Address = ((address & 0x000F) + 1) << 19;
            }
        };
        this.Mapper2 = class extends this.MapperBase {
            constructor(rom, core) {
                super(rom, core);
                this.ROM = rom;
            }
            Read(address) {
                return this.ROM[address] || 0;
            }
            Write(address, data) {
                if (address >= 0x80000)
                    this.ROM[address] = data;
            }
        };
    }
    GetIntStatus() {
        return ~this.IntDisableRegister & this.GetIntReqest();
    }
    GetIntDisable() {
        return this.IntDisableRegister;
    }
    SetIntDisable(data) {
        this.IntDisableRegister = data;
        this.TimerAcknowledge();
    }
    GetIntReqest() {
        return (((this.VDC[0].VDCStatus | this.VDC[1].VDCStatus) & 0x3F) != 0x00 ? this.IRQ1Flag : 0x00) | this.INTIRQ2 | this.INTTIQ;
    }
    SetIntReqest(data) {
        this.TimerAcknowledge();
    }
    SetROM(rom) {
        this.Init();
        let tmp = rom.slice(rom.length % 8192);
        //if(tmp[0x001FFF] < 0xE0)
        //	tmp = tmp.map((d) => {return this.ReverseBit[d];});
        this.Mapper = new this.Mapper0(tmp, this);
        this.CPUReset();
    }
    StorageInit() {
        this.RAM.fill(0x00);
        this.RAMMask = this.SuperGrafx ? 0x7FFF : 0x1FFF;
        this.StorageReset();
    }
    StorageReset() {
        this.IntDisableRegister = 0x00; //IntInit
        for (let i = 0; i < 7; i++)
            this.MPR[i] = 0xFF << 13;
        this.MPR[7] = 0x00;
        this.MPRSelect = 0x01;
    }
    Get16(address) {
        return (this.Get(address + 1) << 8) | this.Get(address);
    }
    Get(address) {
        address = this.MPR[address >> 13] | (address & 0x1FFF);
        if (address < 0x100000) // ROM
            return this.Mapper.Read(address);
        if (address < 0x1EE000) // NOT USE
            return 0xFF;
        if (address < 0x1F0000) { // BRAM
            if (this.BRAMUse)
                return this.BRAM[address & 0x1FFF];
            else
                return 0xFF;
        }
        if (address < 0x1F8000) // RAM
            return this.RAM[address & this.RAMMask];
        if (address < 0x1FE000) // NOT USE
            return 0xFF;
        if (address < 0x1FE400) { // VDC
            if (this.SuperGrafx) {
                let tmp = address & 0x00001F;
                if (tmp < 0x00008) {
                    switch (address & 0x000003) { // VDC#1
                        case 0x00:
                            return this.GetVDCStatus(0);
                        case 0x01:
                            return 0x00;
                        case 0x02:
                            return this.GetVDCLow(0);
                        case 0x03:
                            return this.GetVDCHigh(0);
                    }
                }
                else if (tmp < 0x00010) { // VPC
                    return this.GetVPC(tmp & 0x000007);
                }
                else if (tmp < 0x00018) { // VDC#2
                    switch (address & 0x000003) {
                        case 0x00:
                            return this.GetVDCStatus(1);
                        case 0x01:
                            return 0x00;
                        case 0x02:
                            return this.GetVDCLow(1);
                        case 0x03:
                            return this.GetVDCHigh(1);
                    }
                }
                else {
                    return 0xFF;
                }
            }
            else {
                switch (address & 0x000003) { // VDC#1
                    case 0x00:
                        return this.GetVDCStatus(0);
                    case 0x01:
                        return 0x00;
                    case 0x02:
                        return this.GetVDCLow(0);
                    case 0x03:
                        return this.GetVDCHigh(0);
                }
            }
        }
        if (address < 0x1FE800) { // VCE
            switch (address & 0x000007) {
                case 0x04:
                    return this.GetVCEDataLow();
                case 0x05:
                    return this.GetVCEDataHigh();
                default:
                    return 0x00;
            }
        }
        if (address < 0x1FEC00) // PSG
            return this.GetPSG(address & 0x00000F);
        if (address < 0x1FF000) // TIMER
            return this.ReadTimerCounter();
        if (address < 0x1FF400) // IO
            return this.GetJoystick();
        if (address < 0x1FF800) { // INT Register
            switch (address & 0x000003) {
                case 0x02:
                    return this.GetIntDisable();
                case 0x03:
                    return this.GetIntReqest();
                default:
                    return 0x00;
            }
        }
        return 0xFF; //EXT
    }
    Set(address, data) {
        address = this.MPR[address >> 13] | (address & 0x1FFF);
        if (address < 0x100000) { // ROM
            this.Mapper.Write(address, data);
            return;
        }
        if (address < 0x1EE000) // NOT USE
            return;
        if (address < 0x1F0000) { // BRAM
            if (this.BRAMUse)
                this.BRAM[address & 0x1FFF] = data;
            return;
        }
        if (address < 0x1F8000) { // RAM
            this.RAM[address & this.RAMMask] = data;
            return;
        }
        if (address < 0x1FE000) // NOT USE
            return;
        if (address < 0x1FE400) { // VDC
            if (this.SuperGrafx) {
                let tmp = address & 0x00001F;
                if (tmp < 0x00008) {
                    switch (address & 0x000003) { // VDC#1
                        case 0x00:
                            this.SetVDCRegister(data, 0);
                            break;
                        case 0x02:
                            this.SetVDCLow(data, 0);
                            break;
                        case 0x03:
                            this.SetVDCHigh(data, 0);
                            break;
                    }
                }
                else if (tmp < 0x00010) { // VPC
                    this.SetVPC(tmp & 0x000007, data);
                }
                else if (tmp < 0x00018) { // VDC#2
                    switch (address & 0x000003) {
                        case 0x00:
                            this.SetVDCRegister(data, 1);
                            break;
                        case 0x02:
                            this.SetVDCLow(data, 1);
                            break;
                        case 0x03:
                            this.SetVDCHigh(data, 1);
                            break;
                    }
                }
            }
            else {
                switch (address & 0x000003) { // VDC#1
                    case 0x00:
                        this.SetVDCRegister(data, 0);
                        break;
                    case 0x01:
                        break;
                    case 0x02:
                        this.SetVDCLow(data, 0);
                        break;
                    case 0x03:
                        this.SetVDCHigh(data, 0);
                        break;
                }
            }
            return;
        }
        if (address < 0x1FE800) { // VCE
            switch (address & 0x000007) {
                case 0x00:
                    this.SetVCEControl(data);
                    break;
                case 0x02:
                    this.SetVCEAddressLow(data);
                    break;
                case 0x03:
                    this.SetVCEAddressHigh(data);
                    break;
                case 0x04:
                    this.SetVCEDataLow(data);
                    break;
                case 0x05:
                    this.SetVCEDataHigh(data);
                    break;
            }
            return;
        }
        if (address < 0x1FEC00) { // PSG
            this.SetPSG(address & 0x00000F, data);
            return;
        }
        if (address < 0x1FF000) { // TIMER
            switch (address & 0x000001) {
                case 0x00:
                    this.WirteTimerReload(data);
                    break;
                case 0x01:
                    this.WirteTimerControl(data);
                    break;
            }
            return;
        }
        if (address < 0x1FF400) { // IO
            this.SetJoystick(data);
            return;
        }
        if (address < 0x1FF800) { // INT Register
            switch (address & 0x000003) {
                case 0x02:
                    this.SetIntDisable(data);
                    break;
                case 0x03:
                    this.SetIntReqest(data);
                    break;
            }
            return;
        }
    }
    /* ************* */
    /* **** VCE **** */
    /* ************* */
    VCEConstruct() {
        this.Palette = new Array(512);
        this.PaletteData = new Array(512);
        this.MonoPaletteData = new Array(512);
        this.VCEBaseClock = 0;
        this.VCEControl = 0;
        this.VCEAddress = 0;
        this.VCEData = 0;
    }
    VCEInit() {
        this.Palette.fill(0x0000);
        for (let i = 0; i < 512; i++) {
            this.PaletteData[i] = { r: 0, g: 0, b: 0 };
            this.MonoPaletteData[i] = { r: 0, g: 0, b: 0 };
        }
        this.VCEBaseClock = this.BaseClock5;
        this.VCEControl = 0x00;
        this.VCEAddress = 0x00;
        this.VCEData = 0x00;
    }
    SetVCEControl(data) {
        this.VCEControl = data;
        switch (data & 0x03) {
            case 0x00:
                this.VCEBaseClock = this.BaseClock5;
                break;
            case 0x01:
                this.VCEBaseClock = this.BaseClock7;
                break;
            case 0x02:
            case 0x03:
                this.VCEBaseClock = this.BaseClock10;
                break;
        }
    }
    SetVCEAddressLow(data) {
        this.VCEAddress = (this.VCEAddress & 0xFF00) | data;
    }
    SetVCEAddressHigh(data) {
        this.VCEAddress = ((this.VCEAddress & 0x00FF) | (data << 8)) & 0x01FF;
    }
    GetVCEDataLow() {
        return this.Palette[this.VCEAddress] & 0x00FF;
    }
    GetVCEDataHigh() {
        let tmp = (this.Palette[this.VCEAddress] & 0xFF00) >> 8;
        this.VCEAddress = (this.VCEAddress + 1) & 0x01FF;
        return tmp;
    }
    SetVCEDataLow(data) {
        this.Palette[this.VCEAddress] = (this.Palette[this.VCEAddress] & 0xFF00) | data;
        this.ToPalettes();
    }
    SetVCEDataHigh(data) {
        this.Palette[this.VCEAddress] = (this.Palette[this.VCEAddress] & 0x00FF) | (data << 8);
        this.ToPalettes();
        this.VCEAddress = (this.VCEAddress + 1) & 0x01FF;
    }
    ToPalettes() {
        let color = this.Palette[this.VCEAddress];
        let tmp = this.PaletteData[this.VCEAddress];
        tmp.r = ((color >> 3) & 0x07) * 36;
        tmp.g = ((color >> 6) & 0x07) * 36;
        tmp.b = (color & 0x07) * 36;
        let mono = tmp.r * 0.299 + tmp.g * 0.587 + tmp.b * 0.114;
        this.MonoPaletteData[this.VCEAddress].r = mono;
        this.MonoPaletteData[this.VCEAddress].g = mono;
        this.MonoPaletteData[this.VCEAddress].b = mono;
    }
    /* ************* */
    /* **** VPC **** */
    /* ************* */
    VPCConstruct() {
        this.VPCRegister = new Uint8Array(8);
        this.VDCSelect = 0;
        this.VPCWindow1 = 0;
        this.VPCWindow2 = 0;
        this.VPCPriority = new Uint8Array(4);
    }
    VPCInit() {
        this.VPCRegister.fill(0x00);
        this.VPCRegister[0] = 0x11;
        this.VPCRegister[1] = 0x11;
        this.VPCRegister[7] = 0xFF;
        this.VDCSelect = 0;
        this.VPCWindow1 = 0;
        this.VPCWindow2 = 0;
        this.VPCPriority.fill(0x01);
    }
    SetVPC(no, data) {
        if (no == 0x07)
            return;
        this.VPCRegister[no] = data;
        if (no == 0x06)
            this.VDCSelect = data & 0x01;
        if (no == 0x02 || no == 0x03) {
            this.VPCWindow1 = (this.VPCRegister[0x02] | ((this.VPCRegister[0x03] & 0x03) << 8)) - 64;
            if (this.VPCWindow1 < 0)
                this.VPCWindow1 = 1024;
        }
        if (no == 0x04 || no == 0x05) {
            this.VPCWindow2 = (this.VPCRegister[0x04] | ((this.VPCRegister[0x05] & 0x03) << 8)) - 64;
            if (this.VPCWindow2 < 0)
                this.VPCWindow2 = -1;
        }
        if (no == 0x00) {
            this.VPCPriority[2] = this.VPCRegister[0x00] >> 4;
            this.VPCPriority[3] = this.VPCRegister[0x00] & 0x0F;
        }
        if (no == 0x01) {
            this.VPCPriority[0] = this.VPCRegister[0x01] >> 4;
            this.VPCPriority[1] = this.VPCRegister[0x01] & 0x0F;
        }
    }
    GetVPC(no) {
        return this.VPCRegister[no];
    }
    /* ************* */
    /* **** VDC **** */
    /* ************* */
    VDCConstruct() {
        this.DrawFlag = false;
        this.VDCPutLineProgressClock = 0;
        this.VDCPutLine = 0;
        this.VDC = new Array(2);
        this.VDCLineClock = 1368;
        this.ScreenSize = [];
        this.ScreenSize[this.BaseClock5] = 342;
        this.ScreenSize[this.BaseClock7] = 456;
        this.ScreenSize[this.BaseClock10] = 684;
        this.PutScreenSize = [];
        this.PutScreenSize[this.BaseClock5] = 320;
        this.PutScreenSize[this.BaseClock7] = 428;
        this.PutScreenSize[this.BaseClock10] = 640;
        this.ScreenHeightMAX = 262;
        this.ScreenWidthMAX = 684;
        this.VScreenWidthArray = [];
        this.VScreenWidthArray[0x00] = 32;
        this.VScreenWidthArray[0x10] = 64;
        this.VScreenWidthArray[0x20] = 128;
        this.VScreenWidthArray[0x30] = 128;
        this.ReverseBit = new Uint8Array(0x100);
        this.ReverseBit = this.ReverseBit.map((d, i) => {
            return ((i & 0x80) >> 7) | ((i & 0x40) >> 5) |
                ((i & 0x20) >> 3) | ((i & 0x10) >> 1) |
                ((i & 0x08) << 1) | ((i & 0x04) << 3) |
                ((i & 0x02) << 5) | ((i & 0x01) << 7);
        });
        this.ReverseBit16 = new Uint16Array(0x10000).fill(0x00);
        this.ReverseBit16 = this.ReverseBit16.map((d, i) => { return (this.ReverseBit[i & 0x00FF] << 8) | this.ReverseBit[(i & 0xFF00) >> 8]; });
        this.ReverseBit256 = new Uint32Array(0x100).fill(0x00);
        this.ReverseBit256 = this.ReverseBit256.map((d, i) => {
            let b = this.ReverseBit[i];
            return ((b & 0x80) << (28 - 7)) |
                ((b & 0x40) << (24 - 6)) |
                ((b & 0x20) << (20 - 5)) |
                ((b & 0x10) << (16 - 4)) |
                ((b & 0x08) << (12 - 3)) |
                ((b & 0x04) << (8 - 2)) |
                ((b & 0x02) << (4 - 1)) |
                ((b & 0x01) << (0 - 0));
        });
        this.SPAddressMask = [];
        this.SPAddressMask[16] = [];
        this.SPAddressMask[32] = [];
        this.SPAddressMask[16][16] = 0x07FE;
        this.SPAddressMask[16][32] = 0x07FE & 0x07FA;
        this.SPAddressMask[16][64] = 0x07FE & 0x07F2;
        this.SPAddressMask[32][16] = 0x07FC;
        this.SPAddressMask[32][32] = 0x07FC & 0x07FA;
        this.SPAddressMask[32][64] = 0x07FC & 0x07F2;
    }
    MakeSpriteLine(vdcno) {
        let vdcc = this.VDC[vdcno];
        let sp = vdcc.SPLine;
        for (let i = 0; i < vdcc.ScreenWidth; i++) {
            let spi = sp[i];
            spi.data = 0x00;
            spi.palette = 0x000;
            spi.no = 255;
            spi.priority = 0x00;
        }
        if ((vdcc.VDCRegister[0x05] & 0x0040) == 0x0000)
            return;
        let dotcount = 0;
        let line = vdcc.DrawBGYLine - (vdcc.VDS + vdcc.VSW) + 64;
        let vram = vdcc.VRAM;
        let satb = vdcc.SATB;
        let revbit16 = this.ReverseBit16;
        for (let i = 0, s = 0; i < 64; i++, s += 4) {
            let y = satb[s] & 0x3FF;
            let attribute = satb[s + 3];
            let height = ((attribute & 0x3000) >> 8) + 16;
            height = height > 32 ? 64 : height;
            if (line < y || line > (y + height - 1))
                continue;
            let x = (satb[s + 1] & 0x3FF) - 32;
            let width = ((attribute & 0x0100) >> 4) + 16;
            if ((x + width) <= 0)
                continue;
            let spy = line - y;
            if ((attribute & 0x8000) == 0x8000)
                spy = (height - 1) - spy;
            let index = ((satb[s + 2] & this.SPAddressMask[width][height]) << 5) | (((spy & 0x30) << 3) | (spy & 0x0F));
            let data0;
            let data1;
            let data2;
            let data3;
            if ((attribute & 0x0800) == 0x0000) {
                data0 = revbit16[vram[index]];
                data1 = revbit16[vram[index + 16]];
                data2 = revbit16[vram[index + 32]];
                data3 = revbit16[vram[index + 48]];
                if (width == 32) {
                    data0 |= revbit16[vram[(index | 0x0040)]] << 16;
                    data1 |= revbit16[vram[(index | 0x0040) + 16]] << 16;
                    data2 |= revbit16[vram[(index | 0x0040) + 32]] << 16;
                    data3 |= revbit16[vram[(index | 0x0040) + 48]] << 16;
                }
            }
            else {
                data0 = vram[index];
                data1 = vram[index + 16];
                data2 = vram[index + 32];
                data3 = vram[index + 48];
                if (width == 32) {
                    data0 = (data0 << 16) | vram[(index | 0x0040)];
                    data1 = (data1 << 16) | vram[(index | 0x0040) + 16];
                    data2 = (data2 << 16) | vram[(index | 0x0040) + 32];
                    data3 = (data3 << 16) | vram[(index | 0x0040) + 48];
                }
            }
            let palette = ((attribute & 0x000F) << 4) | 0x0100;
            let priority = attribute & 0x0080;
            let j = 0;
            if (x < 0) {
                j -= x;
                x = 0;
            }
            for (; j < width && x < vdcc.ScreenWidth; j++, x++) {
                let spx = sp[x];
                if (spx.data == 0x00) {
                    let dot = ((data0 >>> j) & 0x0001)
                        | (((data1 >>> j) << 1) & 0x0002)
                        | (((data2 >>> j) << 2) & 0x0004)
                        | (((data3 >>> j) << 3) & 0x0008);
                    if (dot != 0x00) {
                        spx.data = dot;
                        spx.palette = palette;
                        spx.priority = priority;
                    }
                }
                if (spx.no == 255)
                    spx.no = i;
                if (i != 0 && spx.no == 0)
                    vdcc.VDCStatus |= vdcc.VDCRegister[0x05] & 0x0001; //SetSpriteCollisionINT
                if (++dotcount == 256) {
                    vdcc.VDCStatus |= vdcc.VDCRegister[0x05] & 0x0002; //SetSpriteOverINT
                    if (vdcc.SpriteLimit)
                        return;
                }
            }
        }
    }
    MakeBGLine(vdcno) {
        let vdcc = this.VDC[vdcno];
        let sp = vdcc.SPLine;
        let bg = vdcc.BGLine;
        let sw = vdcc.ScreenWidth;
        let leftblank = ((vdcc.HDS + vdcc.HSW) << 3) + vdcc.DrawBGIndex;
        if ((vdcc.VDCRegister[0x05] & 0x0080) == 0x0080) {
            let WidthMask = vdcc.VScreenWidth - 1;
            let x = vdcc.VDCRegister[0x07];
            let index_x = (x >> 3) & WidthMask;
            x = (x & 0x07) << 2;
            let y = vdcc.DrawBGLine;
            let index_y = ((y >> 3) & (vdcc.VScreenHeight - 1)) * vdcc.VScreenWidth;
            y = y & 0x07;
            let vram = vdcc.VRAM;
            let bgx = 0;
            let revbit = this.ReverseBit256;
            while (bgx < sw) {
                let tmp = vram[index_x + index_y];
                let address = ((tmp & 0x0FFF) << 4) + y;
                let palette = (tmp & 0xF000) >> 8;
                let data0 = vram[address];
                let data1 = vram[address + 8];
                let data = (revbit[data0 & 0x00FF]) |
                    (revbit[(data0 & 0xFF00) >> 8] << 1) |
                    (revbit[data1 & 0x00FF] << 2) |
                    (revbit[(data1 & 0xFF00) >> 8] << 3);
                for (; x < 32 && bgx < sw; x += 4, bgx++) {
                    let dot = (data >>> x) & 0x0F;
                    let spbgx = sp[bgx];
                    bg[bgx + leftblank] = spbgx.data != 0x00 && (dot == 0x00 || spbgx.priority == 0x0080) ?
                        spbgx.data | spbgx.palette : dot | (dot == 0x00 ? 0x00 : palette);
                }
                x = 0;
                index_x = (index_x + 1) & WidthMask;
            }
        }
        else {
            for (let i = 0; i < sw; i++)
                bg[i + leftblank] = sp[i].data | sp[i].palette;
        }
    }
    MakeBGColorLineVDC(vdcno) {
        this.VDC[vdcno].BGLine.fill(0x100);
    }
    VDCProcessDMA(vdcno) {
        let vdcc = this.VDC[vdcno];
        if (vdcc.VRAMtoSATBCount > 0) { //VRAMtoSATB
            vdcc.VRAMtoSATBCount -= this.ProgressClock;
            if (vdcc.VRAMtoSATBCount <= 0)
                vdcc.VDCStatus = (vdcc.VDCStatus & 0xBF) | ((vdcc.VDCRegister[0x0F] & 0x0001) << 3); //VRAMtoSATB INT
        }
        if (vdcc.VRAMtoVRAMCount > 0) { //VRAMtoVRAM
            vdcc.VRAMtoVRAMCount -= this.ProgressClock;
            if (vdcc.VRAMtoVRAMCount <= 0)
                vdcc.VDCStatus = (vdcc.VDCStatus & 0xBF) | ((vdcc.VDCRegister[0x0F] & 0x0002) << 3); //VRAMtoVRAM INT
        }
    }
    VDCProcess(vdcno) {
        let vdcc = this.VDC[vdcno];
        vdcc.VDCProgressClock -= this.VDCLineClock;
        vdcc.DrawBGIndex = 0;
        vdcc.BGLine.fill(0x100);
        for (let i = 0; i < vdcc.ScreenSize; i += vdcc.DrawLineWidth) {
            vdcc.DrawBGYLine++;
            if (vdcc.DrawBGYLine == this.ScreenHeightMAX)
                vdcc.DrawBGYLine = 0;
            if (vdcc.DrawBGYLine < (vdcc.VDS + vdcc.VSW)) { //OVER SCAN
                this.MakeBGColorLineVDC(vdcno);
            }
            else if (vdcc.DrawBGYLine <= (vdcc.VDS + vdcc.VSW + vdcc.VDW)) { //ACTIVE DISPLAY
                vdcc.DrawBGLine = (vdcc.DrawBGYLine == (vdcc.VDS + vdcc.VSW) ? vdcc.VDCRegister[0x08] : (vdcc.DrawBGLine + 1)) & vdcc.VScreenHeightMask;
                if (!vdcc.VDCBurst) {
                    this.MakeSpriteLine(vdcno);
                    this.MakeBGLine(vdcno);
                }
                else
                    this.MakeBGColorLineVDC(vdcno);
            }
            else { //OVER SCAN
                this.MakeBGColorLineVDC(vdcno);
            }
            let vline = vdcc.VDS + vdcc.VSW + vdcc.VDW + 1;
            if (vline > 261)
                vline -= 261;
            if (vdcc.DrawBGYLine == vline) {
                vdcc.VDCStatus |= (vdcc.VDCRegister[0x05] & 0x0008) << 2; //SetVSync INT
                if (vdcc.VRAMtoSATBStartFlag) { //VRAMtoSATB
                    for (let i = 0, addr = vdcc.VDCRegister[0x13]; i < 256; i++, addr++)
                        vdcc.SATB[i] = vdcc.VRAM[addr];
                    vdcc.VRAMtoSATBCount = 256 * this.VCEBaseClock;
                    vdcc.VDCStatus |= 0x40;
                    vdcc.VRAMtoSATBStartFlag = (vdcc.VDCRegister[0x0F] & 0x0010) == 0x0010;
                }
            }
            vdcc.RasterCount++;
            if (vdcc.DrawBGYLine == (vdcc.VDS + vdcc.VSW - 1))
                vdcc.RasterCount = 64;
            if (vdcc.RasterCount == vdcc.VDCRegister[0x06] && (vdcc.VDCStatus & 0x20) == 0x00)
                vdcc.VDCStatus |= vdcc.VDCRegister[0x05] & 0x0004; //SetRaster INT
            vdcc.DrawBGIndex += vdcc.DrawLineWidth;
        }
    }
    VDCRun() {
        this.VDCProcessDMA(0);
        this.VDC[0].VDCProgressClock += this.ProgressClock;
        if (this.SuperGrafx) {
            this.VDCProcessDMA(1);
            this.VDC[1].VDCProgressClock += this.ProgressClock;
        }
        while (this.VDC[0].VDCProgressClock >= this.VDCLineClock) {
            this.VDCProcess(0);
            if (this.SuperGrafx)
                this.VDCProcess(1);
        }
        this.VDCPutLineProgressClock += this.ProgressClock;
        if (this.VDCPutLineProgressClock >= this.VDCLineClock) {
            this.VDCPutLineProgressClock -= this.VDCLineClock;
            this.VDCPutLine++;
            if (this.VDCPutLine == this.ScreenHeightMAX) {
                this.VDCPutLine = 0;
                this.GetScreenSize(0);
                this.VDC[0].DrawBGYLine = 0;
                if (this.SuperGrafx) {
                    this.GetScreenSize(1);
                    this.VDC[1].DrawBGYLine = 0;
                }
                this.DrawFlag = true;
                this.Ctx.putImageData(this.ImageData, 0, 0);
            }
            let palettes = (this.VCEControl & 0x80) == 0x00 ? this.PaletteData : this.MonoPaletteData;
            let data = this.ImageData.data;
            let imageIndex = this.VDCPutLine * this.ScreenWidthMAX * 4;
            let black = palettes[0x100];
            let sw = this.ScreenSize[this.VCEBaseClock];
            let bgl0 = this.VDC[0].BGLine;
            if (this.SuperGrafx) { //VPC
                let window1 = this.VPCWindow1;
                let window2 = this.VPCWindow2;
                let priority = this.VPCPriority;
                let bgl1 = this.VDC[1].BGLine;
                for (let bgx = 0; bgx < sw; bgx++, imageIndex += 4) {
                    let wflag = 0x00;
                    if (bgx >= window1)
                        wflag |= 0x01;
                    if (bgx <= window2)
                        wflag |= 0x02;
                    let bg0 = bgl0[bgx];
                    let bg1 = bgl1[bgx];
                    let color;
                    switch (priority[wflag]) {
                        case 0x04 | 0x03:
                            if (bg0 > 0x100 || bg1 > 0x100)
                                color = palettes[bg0 > 0x100 ? bg0 : bg1];
                            else
                                color = palettes[(bg0 & 0x0FF) != 0x000 ? bg0 : bg1];
                            break;
                        case 0x08 | 0x03:
                            if (bg0 < 0x100 && bg0 != 0x000)
                                color = palettes[bg0];
                            else
                                color = palettes[(bg1 & 0x0FF) != 0x000 ? bg1 : bg0];
                            break;
                        case 0x00 | 0x03:
                        case 0x0C | 0x03:
                            color = palettes[(bg0 & 0x0FF) != 0x000 ? bg0 : bg1];
                            break;
                        case 0x00 | 0x01:
                        case 0x04 | 0x01:
                        case 0x08 | 0x01:
                        case 0x0C | 0x01:
                            color = palettes[bg0];
                            break;
                        case 0x00 | 0x02:
                        case 0x04 | 0x02:
                        case 0x08 | 0x02:
                        case 0x0C | 0x02:
                            color = palettes[bg1];
                            break;
                        default:
                            color = black;
                            break;
                    }
                    data[imageIndex] = color.r;
                    data[imageIndex + 1] = color.g;
                    data[imageIndex + 2] = color.b;
                }
            }
            else {
                for (let bgx = 0; bgx < sw; bgx++, imageIndex += 4) {
                    let color = palettes[bgl0[bgx]];
                    data[imageIndex] = color.r;
                    data[imageIndex + 1] = color.g;
                    data[imageIndex + 2] = color.b;
                }
            }
        }
    }
    GetScreenSize(vdcno) {
        let vdcc = this.VDC[vdcno];
        let r = vdcc.VDCRegister;
        vdcc.VScreenWidth = this.VScreenWidthArray[r[0x09] & 0x0030];
        vdcc.VScreenHeight = (r[0x09] & 0x0040) == 0x0000 ? 32 : 64;
        vdcc.VScreenHeightMask = vdcc.VScreenHeight * 8 - 1;
        vdcc.ScreenWidth = ((r[0x0B] & 0x007F) + 1) * 8;
        if (vdcc.ScreenWidth > this.ScreenWidthMAX)
            vdcc.ScreenWidth = this.ScreenWidthMAX;
        vdcc.HDS = (r[0x0A] & 0x7F00) >> 8;
        vdcc.HSW = r[0x0A] & 0x001F;
        vdcc.HDE = (r[0x0B] & 0x7F00) >> 8;
        vdcc.HDW = r[0x0B] & 0x007F;
        vdcc.VDS = ((r[0x0C] & 0xFF00) >> 8);
        vdcc.VSW = r[0x0C] & 0x001F;
        vdcc.VDW = r[0x0D] & 0x01FF;
        vdcc.VCR = r[0x0E] & 0x00FF;
        vdcc.ScreenSize = this.ScreenSize[this.VCEBaseClock];
        if (this.MainCanvas.width != vdcc.ScreenSize) {
            //this.MainCanvas.style.width = (this.PutScreenSize[this.VCEBaseClock] * 2) + 'px';
            this.MainCanvas.width = this.PutScreenSize[this.VCEBaseClock];
        }
        vdcc.DrawLineWidth = (vdcc.HDS + vdcc.HSW + vdcc.HDE + vdcc.HDW + 1) << 3;
        if (vdcc.DrawLineWidth <= this.ScreenSize[this.BaseClock5])
            vdcc.DrawLineWidth = this.ScreenSize[this.BaseClock5];
        else if (vdcc.DrawLineWidth <= this.ScreenSize[this.BaseClock7])
            vdcc.DrawLineWidth = this.ScreenSize[this.BaseClock7];
        else
            vdcc.DrawLineWidth = this.ScreenSize[this.BaseClock10];
        vdcc.VDCBurst = (r[0x05] & 0x00C0) == 0x0000 ? true : false;
    }
    VDCInit() {
        this.VDCPutLineProgressClock = 0;
        this.VDCPutLine = 0;
        this.DrawFlag = false;
        for (let vdcno = 0; vdcno < 2; vdcno++) {
            this.VDC[vdcno] = {
                VDCRegister: new Uint16Array(20).fill(0x0000),
                VRAM: new Uint16Array(0x10000).fill(0x0000),
                SATB: new Uint16Array(256).fill(0x0000),
                VDCBurst: false,
                SpriteLimit: false,
                SPLine: new Array(this.ScreenWidthMAX),
                BGLine: new Array(this.ScreenWidthMAX).fill(0x00),
                VDCStatus: 0x00,
                VDCRegisterSelect: 0x00,
                WriteVRAMData: 0x0000,
                VRAMtoSATBStartFlag: false,
                VRAMtoSATBCount: 0,
                VRAMtoVRAMCount: 0,
                RasterCount: 64,
                VDCProgressClock: 0,
                DrawBGYLine: 0,
                DrawBGLine: 0,
                VScreenWidth: 0,
                VScreenHeight: 0,
                VScreenHeightMask: 0,
                ScreenWidth: 0,
                ScreenSize: 0,
                DrawLineWidth: 0,
                DrawBGIndex: 0,
                HDS: 0,
                HSW: 0,
                HDE: 0,
                HDW: 0,
                VDS: 0,
                VSW: 0,
                VDW: 0,
                VCR: 0
            };
            for (let i = 0; i < this.VDC[vdcno].SPLine.length; i++)
                this.VDC[vdcno].SPLine[i] = { data: 0x00, no: 255, priority: 0x00 };
            this.VDC[vdcno].VDCRegister[0x09] = 0x0010;
            this.VDC[vdcno].VDCRegister[0x0A] = 0x0202;
            this.VDC[vdcno].VDCRegister[0x0B] = 0x031F;
            this.VDC[vdcno].VDCRegister[0x0C] = 0x0F02;
            this.VDC[vdcno].VDCRegister[0x0D] = 0x00EF;
            this.VDC[vdcno].VDCRegister[0x0E] = 0x0003;
        }
        this.GetScreenSize(0);
        this.GetScreenSize(1);
    }
    SetVDCRegister(data, vdcno) {
        this.VDC[vdcno].VDCRegisterSelect = data & 0x1F;
    }
    SetVDCLow(data, vdcno) {
        let vdcc = this.VDC[vdcno];
        if (vdcc.VDCRegisterSelect == 0x02)
            vdcc.WriteVRAMData = data;
        else
            vdcc.VDCRegister[vdcc.VDCRegisterSelect] = (vdcc.VDCRegister[vdcc.VDCRegisterSelect] & 0xFF00) | data;
        if (vdcc.VDCRegisterSelect == 0x01) {
            vdcc.VDCRegister[0x02] = vdcc.VRAM[vdcc.VDCRegister[0x01]];
            return;
        }
        if (vdcc.VDCRegisterSelect == 0x08) {
            vdcc.DrawBGLine = vdcc.VDCRegister[0x08];
            return;
        }
        if (vdcc.VDCRegisterSelect == 0x0F)
            vdcc.VRAMtoSATBStartFlag = (vdcc.VDCRegister[0x0F] & 0x10) == 0x10;
    }
    SetVDCHigh(data, vdcno) {
        let vdcc = this.VDC[vdcno];
        if (vdcc.VDCRegisterSelect == 0x02) {
            vdcc.VRAM[vdcc.VDCRegister[0x00]] = vdcc.WriteVRAMData | (data << 8);
            vdcc.VDCRegister[0x00] = (vdcc.VDCRegister[0x00] + this.GetVRAMIncrement(vdcno)) & 0xFFFF;
            return;
        }
        vdcc.VDCRegister[vdcc.VDCRegisterSelect] = (vdcc.VDCRegister[vdcc.VDCRegisterSelect] & 0x00FF) | (data << 8);
        if (vdcc.VDCRegisterSelect == 0x01) {
            vdcc.VDCRegister[0x02] = vdcc.VRAM[vdcc.VDCRegister[0x01]];
            vdcc.VDCRegister[0x03] = vdcc.VDCRegister[0x02];
            vdcc.VDCRegister[0x01] = (vdcc.VDCRegister[0x01] + this.GetVRAMIncrement(vdcno)) & 0xFFFF;
            return;
        }
        if (vdcc.VDCRegisterSelect == 0x08) {
            vdcc.DrawBGLine = vdcc.VDCRegister[0x08];
            return;
        }
        if (vdcc.VDCRegisterSelect == 0x12) { //VRAMtoVRAM
            let si = (vdcc.VDCRegister[0x0F] & 0x0004) == 0x0000 ? 1 : -1;
            let di = (vdcc.VDCRegister[0x0F] & 0x0008) == 0x0000 ? 1 : -1;
            let s = vdcc.VDCRegister[0x10];
            let d = vdcc.VDCRegister[0x11];
            let l = vdcc.VDCRegister[0x12] + 1;
            vdcc.VRAMtoVRAMCount = l * this.VCEBaseClock;
            vdcc.VDCStatus |= 0x40;
            let vram = vdcc.VRAM;
            for (; l > 0; l--) {
                vram[d] = vram[s];
                s = (s + si) & 0xFFFF;
                d = (d + di) & 0xFFFF;
            }
            return;
        }
        if (vdcc.VDCRegisterSelect == 0x13) //VRAMtoSATB
            vdcc.VRAMtoSATBStartFlag = true;
    }
    GetVRAMIncrement(vdcno) {
        switch (this.VDC[vdcno].VDCRegister[0x05] & 0x1800) {
            case 0x0000:
                return 1;
            case 0x0800:
                return 32;
            case 0x1000:
                return 64;
            case 0x1800:
                return 128;
        }
    }
    GetVDCStatus(vdcno) {
        let tmp = this.VDC[vdcno].VDCStatus;
        this.VDC[vdcno].VDCStatus &= 0x40;
        return tmp;
    }
    GetVDCLow(vdcno) {
        return this.VDC[vdcno].VDCRegister[this.VDC[vdcno].VDCRegisterSelect] & 0x00FF;
    }
    GetVDCHigh(vdcno) {
        let vdcc = this.VDC[vdcno];
        if (vdcc.VDCRegisterSelect == 0x02 || vdcc.VDCRegisterSelect == 0x03) {
            let tmp = (vdcc.VDCRegister[0x02] & 0xFF00) >> 8;
            vdcc.VDCRegister[0x02] = vdcc.VRAM[vdcc.VDCRegister[0x01]];
            vdcc.VDCRegister[0x03] = vdcc.VDCRegister[0x02];
            vdcc.VDCRegister[0x01] = (vdcc.VDCRegister[0x01] + this.GetVRAMIncrement(vdcno)) & 0xFFFF;
            return tmp;
        }
        return (vdcc.VDCRegister[vdcc.VDCRegisterSelect] & 0xFF00) >> 8;
    }
    /* *************** */
    /* **** Sound **** */
    /* *************** */
    SoundConstruct() {
        this.WaveDataArray = [];
        this.WaveClockCounter = 0;
        this.WaveVolume = 1.0;
        this.WebAudioCtx = null;
        this.WebAudioJsNode = null;
        this.WebAudioGainNode = null;
        this.WebAudioBufferSize = 2048;
        this.PSGClock = 3579545;
    }
    WebAudioFunction(e) {
        let output = [];
        let data = [];
        for (let i = 0; i < 2; i++) {
            output[i] = e.outputBuffer.getChannelData(i);
            data[i] = new Float32Array(this.WebAudioBufferSize);
            if (this.WaveDataArray[i].length < this.WebAudioBufferSize) {
                data[i].fill(0.0);
            }
            else {
                for (let j = 0; j < data[i].length; j++)
                    data[i][j] = this.WaveDataArray[i].shift() / ((32 * 16 * 32) * 8 * 16);
                if (this.WaveDataArray[i].length > this.WebAudioBufferSize * 2)
                    this.WaveDataArray[i] = this.WaveDataArray[i].slice(this.WebAudioBufferSize);
            }
            output[i].set(data[i]);
        }
    }
    SoundInit() {
        this.WaveClockCounter = 0;
        this.WaveDataArray = [];
        this.WaveDataArray[0] = [];
        this.WaveDataArray[1] = [];
        if (typeof AudioContext !== "undefined" && this.WebAudioCtx == null) {
            this.CreateAudioContext();
        }
    }
    CreateAudioContext() {
        this.WebAudioCtx = new window.AudioContext();
        this.WebAudioJsNode = this.WebAudioCtx.createScriptProcessor(this.WebAudioBufferSize, 0, 2);
        this.WebAudioJsNode.onaudioprocess = this.WebAudioFunction.bind(this);
        this.WebAudioGainNode = this.WebAudioCtx.createGain();
        this.WebAudioJsNode.connect(this.WebAudioGainNode);
        this.WebAudioGainNode.connect(this.WebAudioCtx.destination);
    }
    SoundSet() {
        let waveoutleft;
        let waveoutright;
        let ch;
        let i;
        let j;
        let out;
        this.WaveClockCounter += this.WebAudioCtx.sampleRate;
        if (this.WaveClockCounter >= this.PSGClock) {
            this.WaveClockCounter -= this.PSGClock;
            waveoutleft = 0;
            waveoutright = 0;
            for (j = 0; j < 6; j++) {
                if (j != 1 || !this.WaveLfoOn) {
                    ch = this.PSGChannel[j];
                    if (j < 4 || !ch.noiseon)
                        out = ch.keyon ? (ch.dda ? ch.R[6] & 0x1F : ch.wave[ch.index]) : 0;
                    else
                        out = (ch.noise & 0x0001) == 0x0001 ? 0x0F : 0;
                    waveoutleft += out * ch.leftvol;
                    waveoutright += out * ch.rightvol;
                }
            }
            this.WaveDataArray[0].push(waveoutleft * this.WaveVolumeLeft);
            this.WaveDataArray[1].push(waveoutright * this.WaveVolumeRight);
            this.WebAudioGainNode.gain.value = this.WaveVolume;
        }
    }
    /* ************* */
    /* **** PSG **** */
    /* ************* */
    PSGConstruct() {
        this.PSGChannel = new Array(6);
        this.PSGBaseClock = this.BaseClock3;
        this.PSGProgressClock = 0;
        this.WaveVolumeLeft = 0;
        this.WaveVolumeRight = 0;
        this.WaveLfoOn = false;
        this.WaveLfoControl = 0;
        this.WaveLfoFreqency = 0;
    }
    PSGInit() {
        this.SoundInit();
        for (let i = 0; i < this.PSGChannel.length; i++)
            this.PSGChannel[i] = {
                R: new Array(10).fill(0),
                keyon: false,
                dda: false,
                freq: 0,
                count: 0,
                vol: 0,
                leftvol: 0,
                rightvol: 0,
                noiseon: false,
                noisefreq: 0,
                noise: 0x8000,
                noisestate: 0,
                index: 0,
                wave: new Uint8Array(32)
            };
    }
    PSGRun() {
        if (this.WebAudioCtx == null)
            return;
        let ch;
        let i;
        let j;
        let ch0;
        let ch1;
        let freqtmp;
        this.PSGProgressClock += this.ProgressClock;
        i = (this.PSGProgressClock / this.PSGBaseClock) | 0;
        this.PSGProgressClock %= this.PSGBaseClock;
        while (i > 0) {
            i--;
            j = 0;
            if (this.WaveLfoOn) {
                ch0 = this.PSGChannel[0];
                ch1 = this.PSGChannel[1];
                if (ch0.keyon) {
                    if (ch0.count == 0) {
                        ch0.index = (ch0.index + 1) & 0x1F;
                        freqtmp = 0;
                        if (this.WaveLfoControl != 0x00) {
                            freqtmp = ch1.wave[ch1.index];
                            freqtmp = freqtmp > 0x0F ? freqtmp - 0x20 : freqtmp & 0x0F;
                            freqtmp <<= 4 * (this.WaveLfoControl - 1);
                        }
                        freqtmp = ch0.freq + freqtmp;
                        if (freqtmp < 0)
                            freqtmp = 0;
                        ch0.count = freqtmp;
                    }
                    else
                        ch0.count--;
                    if (ch1.count == 0) {
                        ch1.index = (ch1.index + 1) & 0x1F;
                        ch1.count = ch1.freq * this.WaveLfoFreqency;
                    }
                    else
                        ch1.count--;
                }
                j = 2;
            }
            for (; j < 6; j++) {
                ch = this.PSGChannel[j];
                if (j < 4 || !ch.noiseon) {
                    if (ch.keyon && !ch.dda) {
                        if (ch.count == 0) {
                            ch.index = (ch.index + 1) & 0x1F;
                            ch.count = ch.freq;
                        }
                        else
                            ch.count--;
                    }
                }
                else {
                    if (ch.keyon && !ch.dda) {
                        if (ch.count == 0) {
                            ch.index = (ch.index + 1) & 0x1F;
                            if (ch.index == 0)
                                ch.noise = (ch.noise >> 1) | (((ch.noise << 12) ^ (ch.noise << 15)) & 0x8000);
                            ch.count = ch.noisefreq;
                        }
                        else
                            ch.count--;
                    }
                }
            }
            this.SoundSet();
        }
    }
    SetPSG(r, data) {
        if (r == 0) {
            this.PSGChannel[0].R[0] = data & 0x07;
            return;
        }
        if (this.PSGChannel[0].R[0] > 5)
            return;
        let ch = this.PSGChannel[this.PSGChannel[0].R[0]];
        ch.R[r] = data;
        switch (r) {
            case 1:
                this.PSGChannel[0].R[1] = data;
                this.WaveVolumeLeft = (data & 0xF0) >> 4;
                this.WaveVolumeRight = data & 0x0F;
                return;
            case 2:
            case 3:
                ch.freq = ((ch.R[3] << 8) | ch.R[2]) & 0x0FFF;
                return;
            case 4:
                ch.keyon = (data & 0x80) == 0x80 ? true : false;
                ch.dda = (data & 0x40) == 0x40 ? true : false;
                if ((data & 0x40) == 0x40)
                    ch.index = 0;
                ch.vol = data & 0x1F;
            case 5:
                let vol = ch.R[4] & 0x1F;
                ch.leftvol = ((ch.R[5] & 0xF0) >> 4) * vol;
                ch.rightvol = (ch.R[5] & 0x0F) * vol;
                return;
            case 6:
                if (!ch.dda) {
                    ch.wave[ch.index] = data & 0x1F;
                    ch.index = (ch.index + 1) & 0x1F;
                }
                return;
            case 7:
                ch.noiseon = (data & 0x80) == 0x80 ? true : false;
                ch.noisefreq = (data & 0x1F) ^ 0x1F;
                return;
            case 8:
                this.PSGChannel[0].R[8] = data;
                this.WaveLfoFreqency = data;
                return;
            case 9:
                this.PSGChannel[0].R[9] = data;
                this.WaveLfoOn = (data & 0x80) == 0x80 ? true : false;
                this.WaveLfoControl = data & 0x03;
                return;
        }
    }
    GetPSG(r) {
        if (r > 9)
            return 0xFF;
        if (r == 0 || r == 1 || r == 8 || r == 9)
            return this.PSGChannel[0].R[r];
        if (this.PSGChannel[0].R[0] > 5)
            return 0xFF;
        return this.PSGChannel[this.PSGChannel[0].R[0]].R[r];
    }
    /* *************** */
    /* **** TIMER **** */
    /* *************** */
    TimerConstruct() {
        this.TimerBaseClock = this.BaseClock7;
        this.TimerReload = 0;
        this.TimerFlag = false;
        this.TimerCounter = 0;
        this.TimerPrescaler = 0;
        this.INTTIQ = 0;
    }
    TimerInit() {
        this.TimerReload = 0x00;
        this.TimerFlag = false;
        this.TimerCounter = 0x00;
        this.TimerPrescaler = 0;
        this.INTTIQ = 0x00;
    }
    ReadTimerCounter() {
        return this.TimerCounter;
    }
    TimerAcknowledge() {
        this.INTTIQ = 0x00;
    }
    WirteTimerReload(data) {
        this.TimerReload = data & 0x7F;
    }
    WirteTimerControl(data) {
        if (!this.TimerFlag && (data & 0x01) == 0x01) {
            this.TimerCounter = this.TimerReload;
            this.TimerPrescaler = 0;
        }
        this.TimerFlag = (data & 0x01) == 0x01 ? true : false;
    }
    TimerRun() {
        if (this.TimerFlag) {
            this.TimerPrescaler += this.ProgressClock;
            while (this.TimerPrescaler >= (1024 * this.TimerBaseClock)) {
                this.TimerPrescaler -= 1024 * this.TimerBaseClock;
                this.TimerCounter--;
                if (this.TimerCounter < 0) {
                    this.TimerCounter = this.TimerReload;
                    this.INTTIQ = this.TIQFlag;
                }
            }
        }
    }
    /* ****************** */
    /* **** Joystick **** */
    /* ****************** */
    JoystickConstruct() {
        this.JoystickSEL = 0;
        this.JoystickCLR = 0;
        this.KeyUpFunction = null;
        this.KeyDownFunction = null;
        this.Keybord = new Array(5).fill([]);
        this.Keybord = this.Keybord.map((d) => { return new Array(4); });
        this.GamePad = new Array(5).fill([]);
        this.GamePad = this.Keybord.map((d) => { return new Array(4); });
        this.GamePadSelect = 0x00;
        this.GamePadButtonSelect = 0x00;
        this.GamePadBuffer = 0x00;
        this.GamePadData = [];
        this.GamePadData["STANDARD PAD"] = [
            [[{ type: "B", index: 1 }], // SHOT1
                [{ type: "B", index: 0 }], // SHOT2
                [{ type: "B", index: 8 }], // SELECT
                [{ type: "B", index: 9 }, { type: "B", index: 2 }], // RUN
                [{ type: "B", index: 12 }], // UP
                [{ type: "B", index: 13 }], // DOWN
                [{ type: "B", index: 14 }], // LEFT
                [{ type: "B", index: 15 }]], // RIGHT
            [[{ type: "B", index: 1 }], // SHOT1
                [{ type: "B", index: 0 }], // SHOT2
                [{ type: "B", index: 8 }], // SELECT
                [{ type: "B", index: 9 }], // RUN
                [{ type: "B", index: 12 }], // UP
                [{ type: "B", index: 13 }], // DOWN
                [{ type: "B", index: 14 }], // LEFT
                [{ type: "B", index: 15 }], // RIGHT
                [{ type: "B", index: 7 }], // SHOT3
                [{ type: "B", index: 5 }], // SHOT4
                [{ type: "B", index: 2 }], // SHOT5
                [{ type: "B", index: 3 }]]
        ]; // SHOT6
        this.GamePadData["HORI PAD 3 TURBO (Vendor: 0f0d Product: 0009)"] = [
            [[{ type: "B", index: 2 }], // SHOT1
                [{ type: "B", index: 1 }], // SHOT2
                [{ type: "B", index: 8 }], // SELECT
                [{ type: "B", index: 9 }, { type: "B", index: 0 }], // RUN
                [{ type: "P", index: 9 }], // UP (POV)
                [{ type: "N", index: 0 }], // DOWN (POV)
                [{ type: "N", index: 0 }], // LEFT (POV)
                [{ type: "N", index: 0 }]], // RIGHT (POV)
            [[{ type: "B", index: 2 }], // SHOT1
                [{ type: "B", index: 1 }], // SHOT2
                [{ type: "B", index: 8 }], // SELECT
                [{ type: "B", index: 9 }], // RUN
                [{ type: "P", index: 9 }], // UP (POV)
                [{ type: "N", index: 0 }], // DOWN (POV)
                [{ type: "N", index: 0 }], // LEFT (POV)
                [{ type: "N", index: 0 }], // RIGHT (POV)
                [{ type: "B", index: 7 }], // SHOT3
                [{ type: "B", index: 5 }], // SHOT4
                [{ type: "B", index: 0 }], // SHOT5
                [{ type: "B", index: 3 }]]
        ]; // SHOT6
        this.GamePadData["0f0d-0009-HORI PAD 3 TURBO"] = this.GamePadData["HORI PAD 3 TURBO (Vendor: 0f0d Product: 0009)"]; // Firefox
        this.GamePadData["UNKNOWN PAD"] = this.GamePadData["HORI PAD 3 TURBO (Vendor: 0f0d Product: 0009)"];
        this.GamePadKeyData = [{ index: 0, data: 0x01 }, { index: 0, data: 0x02 },
            { index: 0, data: 0x04 }, { index: 0, data: 0x08 },
            { index: 1, data: 0x01 }, { index: 1, data: 0x04 },
            { index: 1, data: 0x08 }, { index: 1, data: 0x02 },
            { index: 2, data: 0x01 }, { index: 2, data: 0x02 },
            { index: 2, data: 0x04 }, { index: 2, data: 0x08 }];
        this.GamePadPovData = [0x01, 0x01 | 0x02, 0x02, 0x02 | 0x04, 0x04, 0x04 | 0x08, 0x08, 0x01 | 0x08];
    }
    JoystickInit() {
        this.JoystickSEL = 0;
        this.JoystickCLR = 0;
        for (let i = 0; i < this.Keybord.length; i++) {
            this.Keybord[i][0] = 0xBF;
            this.Keybord[i][1] = 0xBF;
            this.Keybord[i][2] = 0xBF;
            this.Keybord[i][3] = 0xB0;
        }
        this.GamePadSelect = 0;
        this.GamePadButtonSelect = 0x00;
        this.GamePadBuffer = 0x00;
    }
    SetJoystick(data) {
        let sel = data & 0x01;
        let clr = (data & 0x02) >> 1;
        if ((this.JoystickSEL == 1 && this.JoystickCLR == 0) && (sel == 1 && clr == 1)) {
            this.JoystickSEL = 0;
            this.JoystickCLR = 0;
            this.GamePadSelect = 0;
            if (this.GamePadButton6)
                this.GamePadButtonSelect = this.GamePadButtonSelect ^ 0x02;
            this.GamePadBuffer = 0xB0 | this.CountryType;
            return;
        }
        if ((this.JoystickSEL == 0 && this.JoystickCLR == 0) && (sel == 1 && clr == 0))
            this.GamePadSelect++;
        this.JoystickSEL = sel;
        this.JoystickCLR = clr;
        let no = this.MultiTap ? this.GamePadSelect - 1 : 0;
        if (no < 5) {
            let tmp = this.GamePadButtonSelect | this.JoystickSEL;
            this.GamePadBuffer = (this.Keybord[no][tmp] & this.GamePad[no][tmp]) | this.CountryType;
        }
        else
            this.GamePadBuffer = 0xB0 | this.CountryType;
    }
    GetJoystick() {
        return this.GamePadBuffer;
    }
    UnsetButtonRUN(no) {
        this.Keybord[no][0] |= 0x08;
    }
    UnsetButtonSELECT(no) {
        this.Keybord[no][0] |= 0x04;
    }
    UnsetButtonSHOT2(no) {
        this.Keybord[no][0] |= 0x02;
    }
    UnsetButtonSHOT1(no) {
        this.Keybord[no][0] |= 0x01;
    }
    UnsetButtonLEFT(no) {
        this.Keybord[no][1] |= 0x08;
    }
    UnsetButtonDOWN(no) {
        this.Keybord[no][1] |= 0x04;
    }
    UnsetButtonRIGHT(no) {
        this.Keybord[no][1] |= 0x02;
    }
    UnsetButtonUP(no) {
        this.Keybord[no][1] |= 0x01;
    }
    UnsetButtonSHOT6(no) {
        this.Keybord[no][2] |= 0x08;
    }
    UnsetButtonSHOT5(no) {
        this.Keybord[no][2] |= 0x04;
    }
    UnsetButtonSHOT4(no) {
        this.Keybord[no][2] |= 0x02;
    }
    UnsetButtonSHOT3(no) {
        this.Keybord[no][2] |= 0x01;
    }
    SetButtonRUN(no) {
        this.Keybord[no][0] &= ~0x08;
    }
    SetButtonSELECT(no) {
        this.Keybord[no][0] &= ~0x04;
    }
    SetButtonSHOT2(no) {
        this.Keybord[no][0] &= ~0x02;
    }
    SetButtonSHOT1(no) {
        this.Keybord[no][0] &= ~0x01;
    }
    SetButtonLEFT(no) {
        this.Keybord[no][1] &= ~0x08;
    }
    SetButtonDOWN(no) {
        this.Keybord[no][1] &= ~0x04;
    }
    SetButtonRIGHT(no) {
        this.Keybord[no][1] &= ~0x02;
    }
    SetButtonUP(no) {
        this.Keybord[no][1] &= ~0x01;
    }
    SetButtonSHOT6(no) {
        this.Keybord[no][2] &= ~0x08;
    }
    SetButtonSHOT5(no) {
        this.Keybord[no][2] &= ~0x04;
    }
    SetButtonSHOT4(no) {
        this.Keybord[no][2] &= ~0x02;
    }
    SetButtonSHOT3(no) {
        this.Keybord[no][2] &= ~0x01;
    }
    CheckKeyUpFunction(evt) {
        switch (evt.keyCode) {
            case emu_1.Keys['START'].c: // RUN 'S'
                this.UnsetButtonRUN(0);
                break;
            case emu_1.Keys['SELECT'].c: // SELECT 'A'
                this.UnsetButtonSELECT(0);
                break;
            case emu_1.Keys['A'].c: // SHOT2 'Z'
            case emu_1.Keys['GP_A'].c: // SHOT2 'Z'
                this.UnsetButtonSHOT2(0);
                break;
            case emu_1.Keys['B'].c: // SHOT1 'X'
            case emu_1.Keys['GP_B'].c: // SHOT1 'X'
                this.UnsetButtonSHOT1(0);
                break;
            case 86: // SHOT2 'V'
                this.UnsetButtonSHOT2(0);
                break;
            case 66: // SHOT1 'B'
                this.UnsetButtonSHOT1(0);
                break;
            case 37: // LEFT
                this.UnsetButtonLEFT(0);
                break;
            case 39: // RIGHT
                this.UnsetButtonRIGHT(0);
                break;
            case 40: // DOWN
                this.UnsetButtonDOWN(0);
                break;
            case 38: // UP
                this.UnsetButtonUP(0);
                break;
            case 71: // SHOT6 'G'
                this.UnsetButtonSHOT6(0);
                break;
            case 70: // SHOT5 'F'
                this.UnsetButtonSHOT5(0);
                break;
            case 68: // SHOT4 'D'
                this.UnsetButtonSHOT4(0);
                break;
            case 67: // SHOT3 'C'
                this.UnsetButtonSHOT3(0);
                break;
        }
        //evt.preventDefault();
    }
    CheckKeyDownFunction(evt) {
        switch (evt.keyCode) {
            case emu_1.Keys['START'].c: // RUN 'S'
                this.SetButtonRUN(0);
                break;
            case emu_1.Keys['SELECT'].c: // SELECT 'A'
                this.SetButtonSELECT(0);
                break;
            case emu_1.Keys['A'].c: // SHOT2 'Z'
            case emu_1.Keys['GP_A'].c: // SHOT2 'Z'
                this.SetButtonSHOT2(0);
                break;
            case emu_1.Keys['B'].c: // SHOT2 'Z'
            case emu_1.Keys['GP_B'].c: // SHOT2 'Z'
                this.SetButtonSHOT1(0);
                break;
            case 86: // SHOT2 'V'
                this.SetButtonSHOT2(0);
                break;
            case 66: // SHOT1 'B'
                this.SetButtonSHOT1(0);
                break;
            case 37: // LEFT
                this.SetButtonLEFT(0);
                break;
            case 39: // RIGHT
                this.SetButtonRIGHT(0);
                break;
            case 40: // DOWN
                this.SetButtonDOWN(0);
                break;
            case 38: // UP
                this.SetButtonUP(0);
                break;
            case 71: // SHOT6 'G'
                this.SetButtonSHOT6(0);
                break;
            case 70: // SHOT5 'F'
                this.SetButtonSHOT5(0);
                break;
            case 68: // SHOT4 'D'
                this.SetButtonSHOT4(0);
                break;
            case 67: // SHOT3 'C'
                this.SetButtonSHOT3(0);
                break;
        }
        //evt.preventDefault();
    }
    JoystickEventInit() {
        this.KeyUpFunction = this.CheckKeyUpFunction.bind(this);
        this.KeyDownFunction = this.CheckKeyDownFunction.bind(this);
        this.MainCanvas.addEventListener("keyup", this.KeyUpFunction, true);
        this.MainCanvas.addEventListener("keydown", this.KeyDownFunction, true);
    }
    JoystickEventRelease() {
        this.MainCanvas.removeEventListener("keyup", this.KeyUpFunction, true);
        this.MainCanvas.removeEventListener("keydown", this.KeyDownFunction, true);
    }
    CheckGamePad() {
        for (let i = 0; i < this.GamePad.length; i++) {
            this.GamePad[i][0] = 0xBF;
            this.GamePad[i][1] = 0xBF;
            this.GamePad[i][2] = 0xBF;
            this.GamePad[i][3] = 0xB0;
        }
        if (typeof navigator.getGamepads === "undefined")
            return;
        let pads = navigator.getGamepads();
        for (let i = 0; i < 5; i++) {
            let pad = pads[i];
            if (typeof pad !== "undefined" && pad !== null) {
                let paddata;
                if (pad.mapping === "standard")
                    paddata = this.GamePadData["STANDARD PAD"];
                else {
                    paddata = this.GamePadData[pad.id];
                    if (typeof paddata === "undefined")
                        paddata = this.GamePadData["UNKNOWN PAD"];
                }
                paddata = this.GamePadButton6 ? paddata[1] : paddata[0];
                let tmp = 0;
                for (const val0 of paddata) {
                    for (const val1 of val0) {
                        switch (val1.type) {
                            case "B":
                                if (pad.buttons[val1.index].pressed)
                                    this.GamePad[i][this.GamePadKeyData[tmp].index] &= ~this.GamePadKeyData[tmp].data;
                                break;
                            case "A-":
                                if (pad.axes[val1.index] < -0.5)
                                    this.GamePad[i][this.GamePadKeyData[tmp].index] &= ~this.GamePadKeyData[tmp].data;
                                break;
                            case "A+":
                                if (pad.axes[val1.index] > 0.5)
                                    this.GamePad[i][this.GamePadKeyData[tmp].index] &= ~this.GamePadKeyData[tmp].data;
                                break;
                            case "AB":
                                if (pad.axes[val1.index] > -0.75)
                                    this.GamePad[i][this.GamePadKeyData[tmp].index] &= ~this.GamePadKeyData[tmp].data;
                                break;
                            case "P":
                                let povtmp = ((pad.axes[val1.index] + 1) * 7 / 2 + 0.5) | 0;
                                this.GamePad[i][1] &= ~(povtmp <= 7 ? this.GamePadPovData[povtmp] : 0x00);
                                break;
                        }
                    }
                    tmp++;
                }
            }
        }
    }
}
//# sourceMappingURL=pce.js.map