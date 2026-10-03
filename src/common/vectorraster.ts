// Software rasterizer for vector platforms, for hosts with no canvas (the CLI
// and the VS Code extension). It mirrors VectorVideo in emu.ts: clear() fades
// the last frame, drawLine() adds a line on top.

/** the same 8-color palette as VectorVideo.COLORS, as [r, g, b] */
const COLORS: number[][] = [
  [0x11, 0x11, 0x11], [0x11, 0x11, 0xff], [0x11, 0xff, 0x11], [0x11, 0xff, 0xff],
  [0xff, 0x11, 0x11], [0xff, 0x11, 0xff], [0xff, 0xff, 0x11], [0xff, 0xff, 0xff],
];

export const DEFAULT_VECTOR_SIZE = 512;

export class VectorRaster {
  readonly width: number;
  readonly height: number;
  /** RGBA pixels, in the byte order of a little-endian Uint32 (0xAABBGGRR) */
  readonly pixels: Uint32Array;
  private bytes: Uint8Array;
  private sx: number;
  private sy: number;
  persistenceAlpha = 0.5;
  gamma = 0.8;

  /**
   * @param vw,vh the coordinate space the platform draws in
   * @param size  pixels along the longer side of the output
   */
  constructor(vw: number, vh: number, size: number) {
    var scale = size / Math.max(vw, vh);
    this.width = Math.max(1, Math.round(vw * scale));
    this.height = Math.max(1, Math.round(vh * scale));
    this.sx = this.width / vw;
    this.sy = this.height / vh;
    var buffer = new ArrayBuffer(this.width * this.height * 4);
    this.pixels = new Uint32Array(buffer);
    this.bytes = new Uint8Array(buffer);
    this.clear(true);
  }

  /** Fade the last frame toward black (all the way, if `hard`). */
  clear(hard = false) {
    var keep = hard ? 0 : 1 - this.persistenceAlpha;
    var b = this.bytes;
    for (var i = 0; i < b.length; i += 4) {
      b[i] *= keep; b[i + 1] *= keep; b[i + 2] *= keep;
      b[i + 3] = 255;
    }
  }

  /** Add a line (in the platform's coordinates, y up) with antialiasing. */
  drawLine(x1: number, y1: number, x2: number, y2: number, intensity: number, color: number) {
    if (!(intensity > 0)) return;
    var alpha = Math.pow(Math.min(intensity, 255) / 255, this.gamma);
    var rgb = COLORS[color & 7];
    var px1 = x1 * this.sx, py1 = this.height - y1 * this.sy;
    var px2 = x2 * this.sx, py2 = this.height - y2 * this.sy;
    var dx = px2 - px1, dy = py2 - py1;
    if (dx == 0 && dy == 0) {
      this.splat(px1, py1, rgb, alpha);
      return;
    }
    // one point per pixel along the longer axis
    var steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      this.splat(px1 + dx * t, py1 + dy * t, rgb, alpha);
    }
  }

  /** Add one antialiased point: its weight is shared among the 4 pixels around it. */
  private splat(x: number, y: number, rgb: number[], w: number) {
    var x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5);
    var fx = x - 0.5 - x0, fy = y - 0.5 - y0;
    this.add(x0, y0, rgb, w * (1 - fx) * (1 - fy));
    this.add(x0 + 1, y0, rgb, w * fx * (1 - fy));
    this.add(x0, y0 + 1, rgb, w * (1 - fx) * fy);
    this.add(x0 + 1, y0 + 1, rgb, w * fx * fy);
  }

  private add(x: number, y: number, rgb: number[], w: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || w <= 0) return;
    var i = (y * this.width + x) * 4;
    var b = this.bytes;
    b[i] = Math.min(255, b[i] + rgb[0] * w);
    b[i + 1] = Math.min(255, b[i + 1] + rgb[1] * w);
    b[i + 2] = Math.min(255, b[i + 2] + rgb[2] * w);
  }
}
