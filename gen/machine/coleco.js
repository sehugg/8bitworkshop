"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColecoVision = void 0;
const vdp_z80_1 = require("./vdp_z80");
const emu_1 = require("../common/emu");
const util_1 = require("../common/util");
const audio_1 = require("../common/audio");
// http://www.colecovision.eu/ColecoVision/development/tutorial1.shtml
// http://www.colecovision.eu/ColecoVision/development/libcv.shtml
// http://www.kernelcrash.com/blog/recreating-the-colecovision/2016/01/27/
// http://www.atarihq.com/danb/files/CV-Tech.txt
// http://www.atarihq.com/danb/files/CV-Sound.txt
// http://www.colecoboxart.com/faq/FAQ05.htm
// http://www.theadamresource.com/manuals/technical/Jeffcoleco.html
// http://bifi.msxnet.org/msxnet//tech/tms9918a.txt
// http://www.colecovision.dk/tools.htm?refreshed
// http://www.theadamresource.com/manuals/technical/ColecoVision%20Coding%20Guide.pdf
// http://www.unige.ch/medecine/nouspikel/ti99/tms9918a.htm
// http://map.grauw.nl/articles/vdp_tut.php
// http://www.msxcomputermagazine.nl/mccw/91/msx1demos1/en.html
// http://www.segordon.com/colecovision.php
// http://samdal.com/svvideo.htm
// https://github.com/tursilion/convert9918
// http://www.harmlesslion.com/cgi-bin/showprog.cgi?ColecoVision
var COLECOVISION_KEYCODE_MAP = (0, emu_1.makeKeycodeMap)([
    [emu_1.Keys.UP, 0, 0x1],
    [emu_1.Keys.DOWN, 0, 0x4],
    [emu_1.Keys.LEFT, 0, 0x8],
    [emu_1.Keys.RIGHT, 0, 0x2],
    [emu_1.Keys.A, 0, 0x40],
    [emu_1.Keys.B, 1, 0x40],
    [emu_1.Keys.P2_UP, 2, 0x1],
    [emu_1.Keys.P2_DOWN, 2, 0x4],
    [emu_1.Keys.P2_LEFT, 2, 0x8],
    [emu_1.Keys.P2_RIGHT, 2, 0x2],
    [emu_1.Keys.P2_A, 2, 0x40],
    [emu_1.Keys.P2_B, 3, 0x40],
]);
class ColecoVision extends vdp_z80_1.BaseZ80VDPBasedMachine {
    constructor() {
        super();
        this.defaultROMSize = 0x8000;
        this.ram = new Uint8Array(0x400);
        this.read = (0, emu_1.newAddressDecoder)([
            [0x0000, 0x1fff, 0x1fff, (a) => { return this.bios ? this.bios[a] : 0; }],
            [0x6000, 0x7fff, 0x03ff, (a) => { return this.ram[a]; }],
            [0x8000, 0xffff, 0x7fff, (a) => { return this.rom ? this.rom[a] : 0; }],
        ]);
        this.write = (0, emu_1.newAddressDecoder)([
            [0x6000, 0x7fff, 0x03ff, (a, v) => { this.ram[a] = v; }],
        ]);
        this.init(this, this.newIOBus(), new audio_1.SN76489_Audio(new audio_1.MasterAudio()));
        this.bios = new util_1.lzgmini().decode((0, util_1.stringToByteArray)(atob(COLECO_BIOS_LZG)));
    }
    getKeyboardMap() { return COLECOVISION_KEYCODE_MAP; }
    vdpInterrupt() {
        this.probe.logInterrupt(0);
        this.cpu.NMI();
    }
    newIOBus() {
        return {
            read: (addr) => {
                addr &= 0xff;
                //console.log('IO read', hex(addr,4));
                switch (addr) {
                    case 0xfc: return this.inputs[this.keypadMode ? 1 : 0] ^ 0xff;
                    case 0xff: return this.inputs[this.keypadMode ? 3 : 2] ^ 0xff;
                }
                if (addr >= 0xa0 && addr <= 0xbf) {
                    if (addr & 1)
                        return this.vdp.readStatus();
                    else
                        return this.vdp.readData();
                }
                return 0;
            },
            write: (addr, val) => {
                addr &= 0xff;
                val &= 0xff;
                //console.log('IO write', hex(addr,4), hex(val,2));
                switch (addr >> 4) {
                    case 0x8:
                    case 0x9:
                        this.keypadMode = true;
                        break;
                    case 0xc:
                    case 0xd:
                        this.keypadMode = false;
                        break;
                    case 0xa:
                    case 0xb:
                        if (addr & 1)
                            return this.vdp.writeAddress(val);
                        else
                            return this.vdp.writeData(val);
                    case 0xf:
                        this.psg.setData(val);
                        break;
                }
            }
        };
    }
    loadState(state) {
        super.loadState(state);
        this.keypadMode = state['kpm'];
    }
    saveState() {
        var state = super.saveState();
        state['kpm'] = this.keypadMode;
        return state;
    }
    reset() {
        super.reset();
        this.keypadMode = false;
    }
}
exports.ColecoVision = ColecoVision;
var COLECO_BIOS_LZG = `
TFpHAAAgAAAAB7djQcnHAQEDBgcx/3MYawAAAMMMgAehB+EPB+USB+UVB+UYB+UbB+UeB+QHHAZm
IYA8igUCBYIAKgCAff5VIAl8/qogBCoKgOnHAwkfgICAAAMFT6CgB4LgByEH4WDAYMBABlggQIAg
B+HAwOCgYAMGKweBQAYxBphAQEAG+KBABnAGEuAGUAabB+QA4AflBkggIAYyB+FgoKCgwAZdwAY5
B+HABhAGYAfhIAZQoKDgIAMCcOCAwAaIYIDgoAZY4AMFOAYGBsgGIAZYAwJWBlAAQAMEcAYfQAZ4
BhoDA3gGBgaQBjgGGwYfoOCAAwLIB+EDA/DAoAchAwNggAaQwAMFmOCAByEH5QZ4AwKABligAwUw
4EBAQAZYICAgoAMCUAYuBpAGPwawoOAG4AfhAyNQQKCgBqDAoMADJECgoOADBGjgwAZYYIADBPgD
AlADBEigAwVooAMFCAMEQAYHAwRQBg8GUAMiEAMEoAMEcAMD6gaQICAGyAADJZgDJ4gDI7gAwGAD
I0CAwAME6AMC+QMCaCBgAwRwAGCgwAaIQOADA2AGJiAH4gZoAwPgA0M6ACAAAwX4gKDAAwPAAyLP
AwNgAwXwAyNJAwR+AwX4oMADRQBgAyOgAyJxB+PAYANDEOBAQAMDeAMF+AfhA0RQAyJBB+NAAwPI
BncGkOBgwAZQYECABrADQs8DAkjAQCBAA0QYAAMDUAcLOERsRFREOAA4fFR8RHw4AAAofHx8OBAA
ABA4B+MQODgQfHwDBQgQBhgAADAwB4H8/PzMzAeBAAB4SEh4BkiEtLSEBggcDDRISDAAOEREOBAG
eBgUEDBwYAAMNCw0LGxgAABUOGw4VAAAIDA4PDgwIAAIGDh4OBgIAwJXEAMCaCgHAgAoADxUVDQU
FBQAOEQwKBhEAwNwAAB4eAMGIAchfBAHAQAHggMEqBh8GAfBABAwfDAH4gAAQEBAfAAAKCh8KCgG
DxA4OHwGB3x8ODgGLwcHBg8GfgBsbEgGyQZnfCgAIDhAMAhwEABkZAgQIExMACBQUCBUSDQAMDAD
ZEsQIAcCEAAgAwJ5EAYMKDh8OCgGURB8AwdYBuV8AwdlAyIyBAgQAyKmOERMVGREOAAQMAZ4OAYI
BBggQHwH4jgEBhAIGChIfAgIAHxAQHgGSAYVeEQH4XwGeCAgAyNYBkgHgTwECAMiijAwAySSB+Mg
Bh5AIBAIAwR3B0EGBAZyAwNgAwLoOERcVFxABrhEfEREAHhERAdCBghAQEBEOAZIBwF4AwN4AyJA
B+RABlhcREQ8AAbvRAA4AwP4OAAEBwEDAohESFBgUEhEAyJ1AyN4RGxUBh9EAERkVEwGqAZGAwRY
AwVIREQDIlAGSEgGmEADA/gDI9YQEAMCYAaoB8MoBkhUBwEoB+EoECgGKAaOBiB4AwLpQHgAOAMj
kDgAAAMC9gQAADgIBwI4AAYlA0rv/DADRR0GGgQ8RDwABjQDA+gGCEQDAvgEBg4DAuAGSHhAAyJ4
IHgDInAAAAYQPAQ4QEBwSAcBAANEehgACAAYCAgISDBAQAMD+QaOBlAAAGhUVEQDAnQG6AMCSAMC
yAADI1p4QAMDSEQ8BAAAWCQgIHAGWEA4BAYYAwJnKAMCnAYuWANCUQME+AfiVHwGSEhIMAMDSAYY
OBBgAAB4CDBAeAMCoGAgIBgDAngHYzAICAwICDAAKFADRuhsRER8AwPeQEQ4EDBIAwVYDAMF4Ach
AyMIKAflMAflOCgH5AMkFxAwBiAGqAYgB+MGIAMFCAME8BAGgRgAIAMFCAYHKER8RAMCQGwH4gwA
fEB4A2KYAHgUfFA8ADxQUHxQUFwAOAAwSAOCOCgH5WAH5TgDBaBgB+UoAwXwAwL9BugH5AAQOEBA
OBAAGCQgeCAkXABEKBB8ByEAYFBQaFxISAAIFBA4EBBQIBgDBdADIyIQGAfhAwRgGAMGWFADI6kH
4khoWEgDBSY8AwUeeAMi8DADQiAAA2ISA6N2/AQEB6FASFA4RAgcB+IsVBwEBmADglsGEiRIJAZf
AEgkAyKuVACoB2SoBySo/FT8B2IDRDAHA/AHpQfjUFBQ0AdhAyK+8AfjAwYQ0BAGkAcGBhAGyNAQ
8AYkAAYCB+MGJgfjBngDBVgcBpAQEPwDZgwDBhAHggZIAwYYAwUOBpBQUFBcAwNYXAMjtQMC9wbI
3AboB6HcAwUYBpAGCAaQBhgGkBADBghQUAMGKAMDWAZCAwW7AwNQAwJoBpgDBXAGAnwG11ADB0AD
JiADBbgGoPwHBQZJB+LgBwUcBwUDBhQAADRISDQDY49wSEhwQHhIA4OpAAB8A8R6eEggECADwtEA
PANDTwNjYHAGWShQAwKHOBA4A8LZA0IIeAaZOEREKChsADBAIBA4BqkoA4KfA0KIVFQDIvg4QANi
FwAGaQNjr3gHIwZYEAAGEEAwCDBABgkHoTAIBlEIFANIAlAgBiAAfAdhAwJ3B0IGfwMDjgPmiAcB
A8SRHAYnBihQAwK9BwFgEAODTQPjNXgDAmgHHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8H
HwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBwM=`;
//# sourceMappingURL=coleco.js.map