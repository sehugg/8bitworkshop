"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const analysis_1 = require("../common/analysis");
const MOS6502_1 = require("../common/cpu/MOS6502");
const assert_1 = __importDefault(require("assert"));
class Test6502Platform {
    constructor() {
        this.cpu = new MOS6502_1.MOS6502();
        this.ram = new Uint8Array(65536);
    }
    start() {
        throw new Error("Method not implemented.");
    }
    reset() {
        throw new Error("Method not implemented.");
    }
    isRunning() {
        throw new Error("Method not implemented.");
    }
    getToolForFilename(s) {
        throw new Error("Method not implemented.");
    }
    getDefaultExtension() {
        throw new Error("Method not implemented.");
    }
    pause() {
        throw new Error("Method not implemented.");
    }
    resume() {
        throw new Error("Method not implemented.");
    }
    loadROM(title, rom) {
        throw new Error("Method not implemented.");
    }
    getOpcodeMetadata(opcode, offset) {
        return this.cpu.cpu.getOpcodeMetadata(opcode, offset);
    }
    getOriginPC() {
        return 0;
    }
    readAddress(addr) {
        return this.ram[addr] || 0;
    }
}
(0, mocha_1.describe)('6502 analysis', function () {
    it('Should analyze WSYNC', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0xea, 0x85, 0x02, 0xa9, 0x60, 0x20, 0x04, 0x00, 0xea, 0x4c, 0x01, 0x00]);
        let analysis = new analysis_1.CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis.pc2clockrange);
        assert_1.default.equal(analysis.pc2clockrange[0x0].minclocks, 0);
        assert_1.default.equal(analysis.pc2clockrange[0x0].maxclocks, 0);
        assert_1.default.equal(analysis.pc2clockrange[0x1].minclocks, 2);
        assert_1.default.equal(analysis.pc2clockrange[0x1].maxclocks, 19);
        assert_1.default.equal(analysis.pc2clockrange[0x3].minclocks, 0);
        assert_1.default.equal(analysis.pc2clockrange[0x3].maxclocks, 0);
    });
    it('Should analyze loop', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0xea, 0x4c, 0x00, 0x00]); // 5 cycles
        let analysis = new analysis_1.CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis.pc2clockrange);
        assert_1.default.equal(analysis.pc2clockrange[0x0].minclocks, 0);
        assert_1.default.equal(analysis.pc2clockrange[0x0].maxclocks, 75);
        // TODO: should be 0-75
        /*
        assert.equal(analysis.pc2clockrange[0x1].minclocks, 1);
        assert.equal(analysis.pc2clockrange[0x1].maxclocks, 72);
        */
    });
    it('Should wrap clocks', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0xb1, 0, 0xb1, 0, 0xb1, 0, 0xb1, 0, 0xb1, 0, 0xb1, 0, 0xb1, 0, 0xb1, 0, 0xb1, 0, 0xb1, 0, 0xb1, 0, 0xb1, 0, 0xb1, 0, 0xb1, 0, 0xea, 0x4c, 0, 0]);
        let analysis = new analysis_1.CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis.pc2clockrange);
        // TODO: should be 0-75
        assert_1.default.equal(analysis.pc2clockrange[0x0].minclocks, 0);
        assert_1.default.equal(analysis.pc2clockrange[0x0].maxclocks, 75);
        assert_1.default.equal(analysis.pc2clockrange[0x2].minclocks, 5);
        assert_1.default.equal(analysis.pc2clockrange[0x2].maxclocks, 6);
    });
    it('Should wrap RTS', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0xb1, 0x60, 0x20, 1, 0, 0x4c, 0, 0]);
        let analysis = new analysis_1.CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis.pc2clockrange);
        // TODO: should be 0-75
        assert_1.default.equal(analysis.pc2clockrange[0x0].minclocks, 0);
        assert_1.default.equal(analysis.pc2clockrange[0x0].maxclocks, 75);
    });
    it('Should not recurse', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0xea, 0x20, 0x07, 0x00, 0x4c, 0x00, 0x00, 0xa4, 0x88, 0xea, 0xd0, 0xfb, 0x60]);
        let analysis = new analysis_1.CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis.pc2clockrange);
        // TODO: should be 0-75
        assert_1.default.equal(analysis.pc2clockrange[0x0].minclocks, 0);
        assert_1.default.equal(analysis.pc2clockrange[0x0].maxclocks, 75);
    });
    it('Should not break', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0x85, 0x02, 0x85, 0x2a, 0xa9, 0x00, 0x85, 0x26, 0x85, 0x1b, 0x85, 0x1c, 0x4c, 0x00, 0x00]);
        let analysis = new analysis_1.CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis.pc2clockrange);
        // TODO: should be 0-75
        assert_1.default.equal(analysis.pc2clockrange[0x0].minclocks, 0);
        assert_1.default.equal(analysis.pc2clockrange[0x0].maxclocks, 17);
    });
});
//# sourceMappingURL=testanalysis.js.map