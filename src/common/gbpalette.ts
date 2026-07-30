/**
 * Shared Game Boy DMG (olive LCD) palette.
 *
 * Shade 0 = lightest (LCD pixel off / "white"), shade 3 = darkest (pixel on).
 * Values are packed for Canvas ImageData as Uint32 little-endian RGBA (= 0xAABBGGRR).
 */

export function rgbToPixel(r: number, g: number, b: number): number {
  return 0xFF000000 | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

/** Four DMG shades, lightest → darkest (matches BGP/OBP shade indices). */
export const DMG_PALETTE: number[] = [
  rgbToPixel(0xd0, 0xd8, 0x84), // Lightest (warm mint)
  rgbToPixel(0x87, 0xa8, 0x4c), // Light mid
  rgbToPixel(0x52, 0x6b, 0x34), // Dark mid
  rgbToPixel(0x2d, 0x31, 0x22), // Darkest (deep olive)
];

/** RGB888 triples matching DMG_PALETTE (for boytacean remap / tooling). */
export const DMG_PALETTE_RGB: [number, number, number][] = [
  [0xd0, 0xd8, 0x84],
  [0x87, 0xa8, 0x4c],
  [0x52, 0x6b, 0x34],
  [0x2d, 0x31, 0x22],
];

/** Asset-editor / PREDEF_PALETTES entries (RGB without alpha; callers OR 0xff000000). */
export const DMG_PALETTE_RGB24: number[] = [
  0xd0d884,
  0x87a84c,
  0x526b34,
  0x2d3122,
];

/** Map a greyscale / near-grey RGB888 pixel to a DMG shade (0=light … 3=dark). */
export function dmgShadeFromRgb(r: number, g: number, b: number): number {
  var y = (r + g + b) / 3;
  if (y >= 192) return 0;
  if (y >= 128) return 1;
  if (y >= 64) return 2;
  return 3;
}
