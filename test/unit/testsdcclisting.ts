import assert from "assert";
import { describe, it } from "mocha";
import { parseRSTListing } from "../../src/worker/tools/sdcc";

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

describe("sdcc listings", function () {

  it("maps SDCC 3.6.5 <stdin> source comments", function () {
    const l = parseRSTListing(RST_SDCC3, "skeleton");
    assert.deepStrictEqual(l.lines.map((x) => [x.line, x.offset]), [[172, 0x56c]]);
    assert.strictEqual(l.asmlines[0].offset, 0x56c);
  });

  it("maps SDCC 4.x file source comments with 8-digit addresses", function () {
    const l = parseRSTListing(RST_SDCC4, "skeleton");
    // the defs.h line is not attributed to skeleton.sdcc
    assert.deepStrictEqual(l.lines.map((x) => [x.line, x.offset]), [[172, 0x56c]]);
    assert.deepStrictEqual(l.asmlines.map((x) => x.offset), [0x56c, 0x56f]);
  });

});
