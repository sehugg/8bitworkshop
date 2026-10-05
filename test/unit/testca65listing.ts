import assert from "assert";
import { describe, it } from "mocha";
import { parseCA65Listing } from "../../src/worker/tools/cc65";

// A ca65 listing has two different line-number coordinate systems:
//
//  - the listing text (what the .lst window shows), which includes expanded
//    .macpack macros and repeats a data directive's bytes on continuation
//    rows, and
//  - the original ca65 source file.
//
// asmlines index the listing text so the .lst window can place the cursor;
// the sourceLineNumbers variant indexes the source so a .s/.ca65 editor can.

// 7-char address, file column, 11-char byte column, then the instruction text
function ln(addr: string, file: number, bytes: string, text: string) {
  return addr.padEnd(7) + ' ' + file + '  ' + bytes.padEnd(11) + ' ' + text;
}

// line:   1        2          3        4            5              6
//         7              8                9              10
const LISTING = [
  ln('000000r', 1, '', '; comment'),
  ln('000000r', 2, '', '.macro nop2'),
  ln('000000r', 2, '', 'nop'),
  ln('000000r', 2, '', '.endmacro'),
  ln('000000r', 1, '', '.segment "CODE"'),
  ln('000000r', 1, '', '.proc _main: near'),
  ln('000000r', 1, '', '\t.dbg func, "main", "00", static, "_main"'),
  ln('000000r', 1, '', '\t.dbg line, "main.c", 3'),
  ln('000000r', 1, 'A9 00', '\tlda #$00'),
  ln('000002r', 1, 'A9 01', '\tlda #$01'),
  ln('000004r', 1, '00 01 02 03', '\t.byte $00,$01,$02'),
  ln('000008r', 1, '04 05', ''),
  ln('00000Ar', 1, '60', '\trts'),
].join('\n');

describe('ca65 listing parsing', function () {

  it('numbers asm lines by listing-text position, not source line', function () {
    const asm = parseCA65Listing('main.lst', LISTING, {}, [], {}, false);
    // the .lst window renders the whole listing, so these must be the actual
    // 1-based listing lines (the .byte continuation on line 12 is one)
    assert.deepStrictEqual(asm.map(l => l.line), [9, 10, 11, 12, 13]);
    assert.deepStrictEqual(asm.map(l => l.offset), [0x0, 0x2, 0x4, 0x8, 0xa]);
  });

  it('can number asm lines by ca65 source line for a .s/.ca65 editor', function () {
    const asmsrc = parseCA65Listing('main.lst', LISTING, {}, [], {}, false, null, true);
    // the continuation row shares its directive's source line
    assert.deepStrictEqual(asmsrc.map(l => l.line), [6, 7, 8, 8, 9]);
  });

  it('maps C source lines from .dbg directives', function () {
    const src = parseCA65Listing('', LISTING, {}, [], {}, true);
    assert.deepStrictEqual(src.map(l => [l.line, l.path]), [[3, 'main.c']]);
  });

  it('applies the function symbol as a segment offset', function () {
    // _main is linked at $800, but the listing starts at 0
    const asm = parseCA65Listing('main.lst', LISTING, { _main: 0x800 }, [], {}, false);
    assert.deepStrictEqual(asm.map(l => l.offset), [0x800, 0x802, 0x804, 0x808, 0x80a]);
  });

});
