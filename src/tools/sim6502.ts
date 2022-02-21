
import { MOS6502 } from "../common/cpu/MOS6502";
import { disassemble6502 } from "../common/cpu/disasm6502";
import { Bus } from "../common/devices";
import { hex, rpad } from "../common/util";

class CPUSimulator implements Bus {

    cpu : MOS6502;
    ram : Uint8Array;
    ok = false;
    linebuf = '';

    constructor() {
        this.cpu = new MOS6502();
        this.ram = new Uint8Array(0x10000);
        this.cpu.connectMemoryBus(this);
    }

    loadROM(rom: Uint8Array) {
        var hdrlen = 0;
        var prgstart = 0x200;
        if (rom[0] == 0x00) hdrlen = 0;
        else if (rom[0] == 0x73 && rom[1] == 0x69) hdrlen = 12;
        else throw Error("Bad header " + rom[0]);
        this.ram.set(rom.slice(hdrlen), prgstart);
        this.ram[0xfff4] = 0x60; // RTS
        this.ram[0xfff5] = 0x60; // RTS
        this.ram[0xfff6] = 0x60; // RTS
        this.ram[0xfff7] = 0x60; // RTS
        this.ram[0xfff8] = 0x60; // RTS
        this.ram[0xfffc] = (prgstart & 0xff);
        this.ram[0xfffd] = ((prgstart >> 8) & 0xff);
        this.cpu.reset();
        this.ok = true;
    }

    read(a: number): number {
        return this.ram[a] & 0xff;
    }
    write(a: number, v: number): void {
        if (a >= 0x200 && a <= 0xbfff) {
            this.warn("Write in code area: " + hex(a,4))
        }
        if (a >= 0x100 && a < (this.cpu.getSP()|0x100)) {
            this.warn("Write outside stack area: " + hex(a,4))
        }
        this.ram[a] = v;
    }
    readConst?(a: number): number {
        return this.ram[a] & 0xff;
    }

    tick() {
        this.cpu.advanceInsn();
        this.log();
    }

    warn(s:string) {
        console.log("###",hex(this.cpu.getPC(),4),s);
    }

    log() {
        var st = this.cpu.saveState();
        var pc = this.cpu.getPC();
        var b0 = this.readConst(pc);
        var b1 = this.readConst(pc+1);
        var b2 = this.readConst(pc+2);
        var line = disassemble6502(pc, b0, b1, b2);
        var stack = "";
        for (var i=0xff; i>st.SP-0; i--) {
            stack += hex(this.readConst(i+0x100),2);
            //if (i==st.SP) stack += " ";
        }
        console.log(
            hex(pc,4),
            rpad(line.line, 30),
            hex(st.A), hex(st.X), hex(st.Y), hex(st.SP),
            st.C?"C":"-", st.N?"N":"-", st.Z?"Z":"-", st.V?"V":"-",
            stack);
        if (pc == 0xfff7) {
            let addr = this.readStackArg(0);
            let s = '';
            for (var i=0; i<this.readStackArg(2); i++) {
                let cc = this.readConst(addr+i);
                s += String.fromCharCode(cc);
                this.linebuf += s;
                if (cc == 10 || cc == 13) {
                    console.log("---LINE", this.linebuf);
                    this.linebuf = '';
                }
            }
            console.log("---WRITE", s, st.A, hex(addr), this.readStackArg(2));
        }
        else if (pc == 0xfff9) {
            console.log("---EXIT", st.A);
            this.ok = false;
        }
        else if (b0 == 0x00 || line.line == 'KIL') {
            this.ok = false;
        }
        else if (b0 == 0x20 || b0 == 0x60) {
            console.log();
        }
    }

    readStackArg(offset: number) : number {
        var a = (this.cpu.getSP() | 0x100) + offset + 3;
        return this.readConst(a) + this.readConst(a+1) * 256;
    }
}

const fs = require('fs');
const rom = fs.readFileSync(process.argv[2], null);
console.log(rom);

var sim = new CPUSimulator();
sim.loadROM(rom);
while (sim.ok) {
    sim.tick();
}
