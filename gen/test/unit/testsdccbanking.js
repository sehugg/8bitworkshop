"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const sdcc_1 = require("../../src/worker/tools/sdcc");
// Intel HEX record with checksum
function rec(type, addr, data) {
    let bytes = [data.length, addr >> 8, addr & 0xff, type, ...data];
    let sum = bytes.reduce((a, b) => a + b, 0);
    bytes.push((-sum) & 0xff);
    return ':' + bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
}
const GB_BANKING = { size: 0x4000, window: 0x4000 };
(0, mocha_1.describe)("sdcc ROM banking", function () {
    (0, mocha_1.it)("places type 04 records by bank and grows the ROM", function () {
        const ihx = [
            rec(0, 0x0100, [0x11]),
            rec(4, 0, [0x00, 0x01]), rec(0, 0x4000, [0x22]),
            rec(4, 0, [0x00, 0x05]), rec(0, 0x4001, [0x55]),
            rec(4, 0, [0x00, 0x00]), rec(0, 0x0200, [0x33]),
            rec(1, 0, []),
        ].join('\n');
        const errors = [];
        const rom = (0, sdcc_1.parseIHX)(ihx, 0, 0x8000, errors, GB_BANKING);
        assert_1.default.deepStrictEqual(errors, []);
        assert_1.default.strictEqual(rom.length, 0x20000); // bank 5 -> 0x14001, rounded up to 128 KB
        assert_1.default.strictEqual(rom[0x100], 0x11);
        assert_1.default.strictEqual(rom[0x4000], 0x22);
        assert_1.default.strictEqual(rom[0x14001], 0x55);
        assert_1.default.strictEqual(rom[0x200], 0x33);
    });
    (0, mocha_1.it)("reports a bank that overflows its window", function () {
        const ihx = [rec(4, 0, [0x00, 0x01]), rec(0, 0x8000, [0x22]), rec(1, 0, [])].join('\n');
        const errors = [];
        (0, sdcc_1.parseIHX)(ihx, 0, 0x8000, errors, GB_BANKING);
        assert_1.default.strictEqual(errors.length, 1);
        assert_1.default.match(errors[0].msg, /Bank 1 overflows/);
    });
    (0, mocha_1.it)("keeps the fixed size without banking", function () {
        const ihx = [rec(0, 0x0000, [0x01]), rec(4, 0, [0x00, 0x01]), rec(0, 0x0000, [0x02]), rec(1, 0, [])].join('\n');
        const rom = (0, sdcc_1.parseIHX)(ihx, 0, 0x8000, [], undefined);
        assert_1.default.strictEqual(rom.length, 0x8000);
        assert_1.default.strictEqual(rom[0], 0x01); // record above 64 KB is skipped, not folded onto 0
    });
    (0, mocha_1.it)("generates -b args for #pragma bank areas", function () {
        const rels = ["XL3\nA _CODE size 0 flags 0\nA _CODE_2 size 1F flags 0\n", "A _CODE_1 size 4 flags 0\nA _CODE_0 size 0 flags 0\n"];
        assert_1.default.deepStrictEqual((0, sdcc_1.bankedAreaArgs)(rels, GB_BANKING), ['-b', '_CODE_1=0x14000', '-b', '_CODE_2=0x24000']);
    });
    (0, mocha_1.it)("fills in the bank of a __banked call and defines b_ symbols", function () {
        const caller = "\tcall\tbanked_call\n\t.dw\t_foo\n\t.dw 0     ; PENDING: bank support\n";
        assert_1.default.ok((0, sdcc_1.fixBankedCalls)(caller).includes("\t.dw b_foo"));
        const callee = "\t.area _CODE_3\n_foo::\n\tret\n_bar::\n\tret\n";
        const out = (0, sdcc_1.fixBankedCalls)(callee);
        assert_1.default.ok(out.includes("b_foo == 3"));
        assert_1.default.ok(out.includes("b_bar == 3"));
        // bank 0 code gets no b_ symbols
        assert_1.default.ok(!(0, sdcc_1.fixBankedCalls)("\t.area _CODE\n_foo::\n").includes("b_foo"));
    });
});
//# sourceMappingURL=testsdccbanking.js.map