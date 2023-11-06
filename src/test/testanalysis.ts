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
    it('Should analyze WSYNC', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0xea,0x85,0x02,0xa9,0x60,0x20,0x04,0x00,0xea,0x4c,0x01,0x00]);
        let analysis = new CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis.pc2clockrange);
        assert.equal(analysis.pc2clockrange[0x0].minclocks, 0);
        assert.equal(analysis.pc2clockrange[0x0].maxclocks, 0);
        assert.equal(analysis.pc2clockrange[0x1].minclocks, 2);
        assert.equal(analysis.pc2clockrange[0x1].maxclocks, 19);
        assert.equal(analysis.pc2clockrange[0x3].minclocks, 0);
        assert.equal(analysis.pc2clockrange[0x3].maxclocks, 0);
    });
    it('Should analyze loop', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0xea,0x4c,0x00,0x00]); // 5 cycles
        let analysis = new CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis.pc2clockrange);
        assert.equal(analysis.pc2clockrange[0x0].minclocks, 0);
        assert.equal(analysis.pc2clockrange[0x0].maxclocks, 75);
        // TODO: should be 0-75
        /*
        assert.equal(analysis.pc2clockrange[0x1].minclocks, 1);
        assert.equal(analysis.pc2clockrange[0x1].maxclocks, 72);
        */
    });
    it('Should wrap clocks', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0xb1,0,0xb1,0,0xb1,0,0xb1,0,0xb1,0,0xb1,0,0xb1,0,0xb1,0,0xb1,0,0xb1,0,0xb1,0,0xb1,0,0xb1,0,0xb1,0,0xea,0x4c,0,0]);
        let analysis = new CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis.pc2clockrange);
        // TODO: should be 0-75
        assert.equal(analysis.pc2clockrange[0x0].minclocks, 0);
        assert.equal(analysis.pc2clockrange[0x0].maxclocks, 75);
        assert.equal(analysis.pc2clockrange[0x2].minclocks, 5);
        assert.equal(analysis.pc2clockrange[0x2].maxclocks, 6);
    });
    it('Should wrap RTS', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0xb1,0x60,0x20,1,0,0x4c,0,0]);
        let analysis = new CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis.pc2clockrange);
        // TODO: should be 0-75
        assert.equal(analysis.pc2clockrange[0x0].minclocks, 0);
        assert.equal(analysis.pc2clockrange[0x0].maxclocks, 75);
    });
    it('Should not recurse', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0xea,0x20,0x07,0x00,0x4c,0x00,0x00, 0xa4,0x88,0xea,0xd0,0xfb,0x60]);
        let analysis = new CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis.pc2clockrange);
        // TODO: should be 0-75
        assert.equal(analysis.pc2clockrange[0x0].minclocks, 0);
        assert.equal(analysis.pc2clockrange[0x0].maxclocks, 75);
    });
    it('Should not break', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0x85,0x02,0x85,0x2a,0xa9,0x00,0x85,0x26,0x85,0x1b,0x85,0x1c,0x4c,0x00,0x00]);
        let analysis = new CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis.pc2clockrange);
        // TODO: should be 0-75
        assert.equal(analysis.pc2clockrange[0x0].minclocks, 0);
        assert.equal(analysis.pc2clockrange[0x0].maxclocks, 17);
    });
});
