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
    it('Should analyze 6502', function () {
        let platform = new Test6502Platform();
        platform.ram.set([0xea, 0x85, 0x02, 0xa9, 0x60, 0x20, 0x04, 0x00, 0xea, 0x4c, 0x01, 0x00]);
        let analysis = new analysis_1.CodeAnalyzer_vcs(platform);
        analysis.showLoopTimingForPC(0x0);
        console.log(analysis);
        assert_1.default.equal(analysis.pc2minclocks[0x0], 304);
        assert_1.default.equal(analysis.pc2maxclocks[0x0], 304);
        assert_1.default.equal(analysis.pc2minclocks[0x1], 19);
        assert_1.default.equal(analysis.pc2maxclocks[0x0], 304);
        assert_1.default.equal(analysis.pc2minclocks[0x3], 0);
        assert_1.default.equal(analysis.pc2maxclocks[0x3], 0);
    });
});
//# sourceMappingURL=testanalysis.js.map