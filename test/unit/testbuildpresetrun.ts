import assert from "assert";
import { describe, it } from "mocha";
import { screenStats } from "../../src/tools/buildpresets";

// buildpresets --run flags the frames that look like nothing drew: a blank
// (untouched) screen or one color covering everything. screenStats is the pure
// part of that check, kept here so it runs without an emulator.

const BLACK = 0x00000000;
const BLUE = 0xff0000ff;
const RED = 0xffff0000;

function fill(color: number, n = 100) {
  return new Uint32Array(n).fill(color);
}

describe('buildpresets screen check', function () {
  it('flags an untouched (blank) screen', function () {
    const s = screenStats(fill(BLACK), 10, 10);
    assert.strictEqual(s.verdict, 'blank');
    assert.strictEqual(s.colors, 1);
  });

  it('flags a single drawn color as solid', function () {
    const s = screenStats(fill(BLUE), 10, 10);
    assert.strictEqual(s.verdict, 'solid');
    assert.strictEqual(s.color, BLUE);
  });

  it('flags a nearly single-color screen as solid', function () {
    const px = fill(BLUE, 1000);
    px[0] = RED;  // one stray pixel out of 1000
    assert.strictEqual(screenStats(px).verdict, 'solid');
  });

  it('passes a screen with a real background and foreground', function () {
    const px = fill(BLUE);
    for (let i = 0; i < 30; i++) px[i] = RED;
    const s = screenStats(px, 10, 10);
    assert.strictEqual(s.verdict, 'ok');
    assert.strictEqual(s.colors, 2);
    assert.strictEqual(s.dominant, 0.7);
  });

  it('carries the dimensions through', function () {
    const s = screenStats(fill(BLUE, 96), 16, 6);
    assert.strictEqual(s.width, 16);
    assert.strictEqual(s.height, 6);
  });
});
