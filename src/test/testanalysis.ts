import { describe } from "mocha";
import { OpcodeMetadata, Platform } from "../common/baseplatform";
import { CodeAnalyzer_vcs } from "../common/analysis";
import { MOS6502 } from "../common/cpu/MOS6502";
import assert from "assert";

class Test6502Platform implements Platform {
    cpu = new MOS6502();
    ram = new Uint8Array(65536);

    start(): void | Promise<void> {
        throw new Error("Method not implemented.");
    }
    reset(): void {
        throw new Error("Method not implemented.");
    }
    isRunning(): boolean {
        throw new Error("Method not implemented.");
    }
    getToolForFilename(s: string): string {
        throw new Error("Method not implemented.");
    }
    getDefaultExtension(): string {
        throw new Error("Method not implemented.");
    }
    pause(): void {
        throw new Error("Method not implemented.");
    }
    resume(): void {
        throw new Error("Method not implemented.");
    }
    loadROM(title: string, rom: any) {
        throw new Error("Method not implemented.");
    }
    getOpcodeMetadata?(opcode: number, offset: number): OpcodeMetadata {
        return this.cpu.cpu.getOpcodeMetadata(opcode, offset);
    }
    getOriginPC(): number {
        return 0;
    }
    readAddress?(addr:number) : number {
        return this.ram[addr] || 0;
    }
}

describe('6502 analysis', function () {
    it('Should analyze 6502', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0xea,0x85,0x02,0xa9,0x60,0x20,0x04,0x00,0xea,0x4c,0x01,0x00]);
        let analysis = new CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis);
        assert.equal(analysis.pc2minclocks[0x0], 304);
        assert.equal(analysis.pc2maxclocks[0x0], 304);
        assert.equal(analysis.pc2minclocks[0x1], 19);
        assert.equal(analysis.pc2maxclocks[0x0], 304);
        assert.equal(analysis.pc2minclocks[0x3], 0);
        assert.equal(analysis.pc2maxclocks[0x3], 0);
    });
});
