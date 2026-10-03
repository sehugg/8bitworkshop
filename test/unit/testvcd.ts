import assert from "assert";
import { describe, it } from "mocha";
import { VCDWriter, vcdId } from "../../src/common/vcd";

function record(signals: { name: string, len: number }[], states: any[]) {
  const chunks: string[] = [];
  const w = new VCDWriter(signals, c => chunks.push(c));
  for (const s of states) w.sample(s);
  w.finish();
  return { text: chunks.join(''), chunks, w };
}

describe('VCD writer', function () {
  it('makes identifier codes from printable characters', function () {
    assert.equal(vcdId(0), '!');
    assert.equal(vcdId(93), '~');
    assert.equal(vcdId(94), '!!');
    const ids = new Set(Array.from({ length: 20000 }, (_, i) => vcdId(i)));
    assert.equal(ids.size, 20000);
    for (const id of ids) assert.ok(/^[!-~]+$/.test(id));
  });

  it('declares signals in scopes named by their `$` paths', function () {
    const { text } = record([
      { name: 'top$clk', len: 1 },
      { name: 'top$cpu$pc', len: 16 },
      { name: 'top$cpu$alu$out', len: 8 },
      { name: 'top$ram$we', len: 1 },
    ], [{}]);
    const defs = text.slice(0, text.indexOf('$enddefinitions'));
    assert.deepStrictEqual(defs.split('\n').filter(l => /^\$(scope|upscope|var)/.test(l)), [
      '$scope module top $end',
      '$var wire 1 ! clk $end',
      '$scope module cpu $end',
      '$var wire 16 " pc [15:0] $end',
      '$scope module alu $end',
      '$var wire 8 # out [7:0] $end',
      '$upscope $end',
      '$upscope $end',
      '$scope module ram $end',
      '$var wire 1 $ we $end',
      '$upscope $end',
      '$upscope $end',
    ]);
  });

  it('dumps every value first, then only changes', function () {
    const { text } = record([{ name: 'm$a', len: 1 }, { name: 'm$b', len: 4 }], [
      { m$a: 0, m$b: 5 },
      { m$a: 0, m$b: 5 },   // nothing changed: no time stamp
      { m$a: 1, m$b: 5 },
      { m$a: 1, m$b: 0 },
    ]);
    const body = text.slice(text.indexOf('$enddefinitions'));
    assert.equal(body.split('\n').slice(1).join('\n'), [
      '#0', '$dumpvars', '0!', 'b101 "', '$end',
      '#2', '1!',
      '#3', 'b0 "',
      '#4', '',
    ].join('\n'));
  });

  it('cuts values to the signal width and reads bigints', function () {
    const { text } = record([
      { name: 'm$n', len: 4 }, { name: 'm$s', len: 8 }, { name: 'm$w', len: 40 }, { name: 'm$x', len: 32 },
    ], [{ m$n: 0x1f, m$s: -1, m$w: BigInt("0x123456789a"), m$x: -1 }]);
    assert.ok(text.includes('b1111 !\n'));
    assert.ok(text.includes('b11111111 "\n'));
    assert.ok(text.includes('b' + BigInt("0x123456789a").toString(2) + ' #\n'));
    assert.ok(text.includes('b' + '1'.repeat(32) + ' $\n'));
  });

  it('writes in chunks, so a long recording is never held whole', function () {
    const chunks: string[] = [];
    const w = new VCDWriter([{ name: 'm$c', len: 16 }], c => chunks.push(c));
    for (let i = 0; i < 100000; i++) w.sample({ m$c: i });
    w.finish();
    assert.ok(chunks.length > 10, `${chunks.length} chunks`);
    assert.equal(w.samples, 100000);
    const all = chunks.join('');
    assert.ok(all.endsWith('#100000\n'));
    assert.equal(all.match(/^#/gm)!.length, 100001);
  });
});
