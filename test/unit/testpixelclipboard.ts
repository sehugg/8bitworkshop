import assert from "assert";
import { describe, it } from "mocha";
import { pasteClipboardPixels, PixelClipboardData } from "../../src/ide/pixeleditor";

const PAL_A = new Uint32Array([0xff000000, 0xff0000ff, 0xff00ff00, 0xffff0000]);
const PAL_B = new Uint32Array([0xff111111, 0xff222222, 0xff333333, 0xff444444]);

function clip(width: number, height: number, indexes: number[], palette: Uint32Array): PixelClipboardData {
  return {
    width: width,
    height: height,
    pixels: new Uint32Array(indexes.map((i) => palette[i])),
    palette: palette.slice()
  };
}

function indexesOf(pixels: Uint32Array, palette: Uint32Array): number[] {
  return Array.from(pixels).map((rgba) => palette.indexOf(rgba));
}

describe('Pixel editor clipboard', function () {

  it('should paste over the whole image when sizes match', function () {
    var src = clip(2, 2, [0, 1, 2, 3], PAL_A);
    var dst = new Uint32Array([PAL_A[3], PAL_A[3], PAL_A[3], PAL_A[3]]);
    var out = pasteClipboardPixels(src, dst, 2, 2, PAL_A);
    assert.deepEqual(indexesOf(out, PAL_A), [0, 1, 2, 3]);
  });

  it('should not modify the destination array in place', function () {
    var src = clip(1, 1, [1], PAL_A);
    var dst = new Uint32Array([PAL_A[0]]);
    pasteClipboardPixels(src, dst, 1, 1, PAL_A);
    assert.equal(dst[0], PAL_A[0]);
  });

  it('should remap colors by palette index when palettes differ', function () {
    var src = clip(2, 2, [0, 1, 2, 3], PAL_A);
    var dst = new Uint32Array(4).fill(PAL_B[0]);
    var out = pasteClipboardPixels(src, dst, 2, 2, PAL_B);
    assert.deepEqual(indexesOf(out, PAL_B), [0, 1, 2, 3]);
  });

  it('should wrap palette indexes when the destination palette is smaller', function () {
    var pal2 = PAL_B.slice(0, 2);
    var src = clip(2, 2, [0, 1, 2, 3], PAL_A);
    var dst = new Uint32Array(4).fill(pal2[0]);
    var out = pasteClipboardPixels(src, dst, 2, 2, pal2);
    assert.deepEqual(indexesOf(out, pal2), [0, 1, 0, 1]);
  });

  it('should clip a larger source and leave the rest of the destination alone', function () {
    var src = clip(3, 3, [1, 1, 1, 1, 1, 1, 1, 1, 1], PAL_A);
    var dst = new Uint32Array(4).fill(PAL_A[3]);
    var out = pasteClipboardPixels(src, dst, 2, 2, PAL_A);
    assert.deepEqual(indexesOf(out, PAL_A), [1, 1, 1, 1]);
  });

  it('should keep destination pixels outside a smaller source', function () {
    var src = clip(1, 1, [1], PAL_A);
    var dst = new Uint32Array(4).fill(PAL_A[3]);
    var out = pasteClipboardPixels(src, dst, 2, 2, PAL_A);
    assert.deepEqual(indexesOf(out, PAL_A), [1, 3, 3, 3]);
  });

  it('should pass through colors that are not in the source palette', function () {
    var src: PixelClipboardData = {
      width: 1, height: 1,
      pixels: new Uint32Array([0xff123456]),
      palette: PAL_A.slice()
    };
    var out = pasteClipboardPixels(src, new Uint32Array([PAL_B[0]]), 1, 1, PAL_B);
    assert.equal(out[0], 0xff123456);
  });

});
