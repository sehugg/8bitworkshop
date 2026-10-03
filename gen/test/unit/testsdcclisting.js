"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const sdcc_1 = require("../../src/worker/tools/sdcc");
// linked listings of `clrscr();` at skeleton.sdcc line 172, then a call from
// a header the file includes
const RST_SDCC3 = [
    "                           1274 _main::",
    "                           1275 ;<stdin>:172: clrscr();",
    "   056C CD 3C 00      [17] 1276 \tcall\t_clrscr",
].join("\n");
const RST_SDCC4 = [
    "    0000056C                       1274 _main::",
    "                                   1275 ;//skeleton.sdcc:172: clrscr();",
    "    0000056C CD 3C 00         [17] 1276 \tcall\t_clrscr",
    "                                   1277 ;//defs.h:9: inline_fn();",
    "    0000056F CD 40 00         [17] 1278 \tcall\t_inline_fn",
].join("\n");
// the mos6502 backend: a tab and a space around the line number, [ 2] cycles
const RST_MOS6502 = [
    "                                    117 ;\thello.c: 17: void main(void) {",
    "                                    118 ;\tgenLabel",
    "    00000865                        126 _main:",
    "                                    128 ;\thello.c: 18: putstr(message);",
    "    00000865 A2 08            [ 2]  136 \tldx\t#>_message",
    "    00000869 20 4E 08         [ 6]  138 \tjsr\t_putstr",
].join("\n");
// a main file that only #includes the others (e.g. fullscrollgame-sdcc.c)
const RST_MOS6502_INCLUDES = [
    "    00000865                        126 _main:",
    "                                    128 ;\tgame.c: 18: putstr(message);",
    "    00000865 A2 08            [ 2]  136 \tldx\t#>_message",
    "                                    140 ;\tlib.c: 4: x++;",
    "    00000869 E6 02            [ 5]  142 \tinc\t*_x",
].join("\n");
(0, mocha_1.describe)("sdcc listings", function () {
    (0, mocha_1.it)("tags mos6502 lines with the included file they came from", function () {
        const l = (0, sdcc_1.parseRSTListing)(RST_MOS6502_INCLUDES, "game-sdcc");
        assert_1.default.deepStrictEqual(l.lines.map((x) => [x.path, x.line, x.offset]), [["game.c", 18, 0x865], ["lib.c", 4, 0x869]]);
    });
    (0, mocha_1.it)("maps mos6502 source comments", function () {
        const l = (0, sdcc_1.parseRSTListing)(RST_MOS6502, "hello");
        assert_1.default.deepStrictEqual(l.lines.map((x) => [x.line, x.offset]), [[17, 0x865], [18, 0x865]]); // the function line maps to its label
        assert_1.default.deepStrictEqual(l.asmlines.map((x) => x.offset), [0x865, 0x869]);
    });
    (0, mocha_1.it)("maps SDCC 3.6.5 <stdin> source comments", function () {
        const l = (0, sdcc_1.parseRSTListing)(RST_SDCC3, "skeleton");
        assert_1.default.deepStrictEqual(l.lines.map((x) => [x.line, x.offset]), [[172, 0x56c]]);
        assert_1.default.strictEqual(l.asmlines[0].offset, 0x56c);
    });
    (0, mocha_1.it)("maps SDCC 4.x file source comments with 8-digit addresses", function () {
        const l = (0, sdcc_1.parseRSTListing)(RST_SDCC4, "skeleton");
        // the defs.h line is not attributed to skeleton.sdcc
        assert_1.default.deepStrictEqual(l.lines.map((x) => [x.line, x.offset]), [[172, 0x56c]]);
        assert_1.default.deepStrictEqual(l.asmlines.map((x) => x.offset), [0x56c, 0x56f]);
    });
});
//# sourceMappingURL=testsdcclisting.js.map