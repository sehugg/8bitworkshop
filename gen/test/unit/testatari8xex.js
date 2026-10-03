"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const atari8_1 = require("../../src/machine/atari8");
// build an XEX from [start, bytes] chunks
function xex(...chunks) {
    let out = [0xff, 0xff];
    for (let [start, data] of chunks) {
        let end = start + data.length - 1;
        out.push(start & 0xff, start >> 8, end & 0xff, end >> 8, ...data);
    }
    return new Uint8Array(out);
}
describe('Atari 800 XEX loader', function () {
    before(function () {
        // the POKEY audio chain needs TSS's MasterChannel, which isn't loaded under node
        global.MasterChannel = class {
            addChannel() { }
        };
    });
    it('runs INIT before loading the next chunk', function () {
        let m = new atari8_1.Atari800();
        // chunk 1 is overwritten by chunk 2; its INIT must run first
        let file = xex([0x2e00, [0x60]], // rts
        [0x2e2, [0x00, 0x2e]], // INITAD = $2E00
        [0x2000, new Array(0xe00).fill(0xea)], // overlaps $2E00
        [0x2e0, [0x01, 0x20]]); // RUNAD = $2001
        m.loadXEX(file);
        // first chunk loaded, second not yet
        assert_1.default.strictEqual(m.ram[0x2e00], 0x60);
        assert_1.default.strictEqual(m.ram[0x2000], 0);
        assert_1.default.deepStrictEqual(Array.from(m.d500.slice(0, 6)), [0x20, 0x00, 0x2e, 0x8d, 0xf2, 0xd5]);
        // the stub's STA $D5F2 loads the rest
        m.writeMapper(0xf2, 0);
        assert_1.default.strictEqual(m.ram[0x2000], 0xea);
        assert_1.default.deepStrictEqual(Array.from(m.d500.slice(6, 14)), [0xa9, 0xa0, 0x8d, 0xff, 0xd5, 0x4c, 0x01, 0x20]);
        assert_1.default.strictEqual(m.run_address, 0xd500);
    });
    it('loads a plain XEX without INIT in one go', function () {
        let m = new atari8_1.Atari800();
        m.loadXEX(xex([0x2000, [1, 2, 3]], [0x2e0, [0x00, 0x20]]));
        assert_1.default.strictEqual(m.ram[0x2002], 3);
        assert_1.default.deepStrictEqual(Array.from(m.d500.slice(0, 8)), [0xa9, 0xa0, 0x8d, 0xff, 0xd5, 0x4c, 0x00, 0x20]);
    });
});
//# sourceMappingURL=testatari8xex.js.map