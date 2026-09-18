// Minimal Atari 8-bit disk image support.
//
// Parses ATR images (and raw 128-byte-sector .xfd/.dsk images) and exposes
// sector reads/writes. Sector numbers are 1-based to match SIO/DAUX1/DAUX2.
//
// ATR layout: http://www.atarimax.com/jindroush.atari.org/afmtdos.html
//   0   word  magic $0296
//   2   word  paragraph count (16-byte units, includes the 16-byte header)
//   4   word  sector size (128 or 256)
//   6   dword CRC (unused)
//   10  dword unused
//   16  sector data

const ATR_MAGIC = 0x0296;

export class DiskImage {
  data: Uint8Array;
  sectorsize: number;
  numsectors: number;

  constructor(data: Uint8Array) {
    this.data = data;
    if (data.length >= 16 && (data[0] | (data[1] << 8)) == ATR_MAGIC) {
      const paragraphs = data[2] | (data[3] << 8);
      const total = paragraphs * 16;
      const sectorsize = data[4] | (data[5] << 8);
      // enhanced-density images declare 256-byte sectors, but the first three
      // (boot) sectors are still 128 bytes
      this.sectorsize = sectorsize == 256 ? 256 : 128;
      if (this.sectorsize == 256) {
        this.numsectors = 3 + Math.floor((total - 16 - 3 * 128) / 256);
      } else {
        this.numsectors = Math.floor((total - 16) / 128);
      }
    } else {
      // raw image, assume single density
      this.sectorsize = 128;
      this.numsectors = Math.floor(data.length / 128);
    }
  }

  private sectorOffset(sector: number): number {
    // sector is 0-based here
    if (this.sectorsize == 256) {
      if (sector < 3) return 16 + sector * 128;
      return 16 + 3 * 128 + (sector - 3) * 256;
    }
    return 16 + sector * 128;
  }

  /** Read up to len bytes from 1-based sector, returns null if out of range. */
  readSector(sector: number, len: number): Uint8Array {
    const idx = sector - 1;
    if (idx < 0 || idx >= this.numsectors) return null;
    const ofs = this.sectorOffset(idx);
    return this.data.subarray(ofs, Math.min(ofs + len, this.data.length));
  }

  /** Write len bytes into 1-based sector; returns false if out of range. */
  writeSector(sector: number, src: Uint8Array, len: number): boolean {
    const idx = sector - 1;
    if (idx < 0 || idx >= this.numsectors) return false;
    const ofs = this.sectorOffset(idx);
    this.data.set(src.subarray(0, Math.min(len, this.data.length - ofs)), ofs);
    return true;
  }
}
