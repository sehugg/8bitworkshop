
// TODO: dynamic import
import * as fastpng from 'fast-png';
import { Palette } from './color';
import * as io from './io'
import * as color from './color'
import { coerceToArray, findIntegerFactors, RGBA } from '../../util';

export type PixelMapFunction = (x: number, y: number) => number;

export abstract class AbstractBitmap<T> {
    aspect? : number;   // aspect ratio, null == default == 1:1
    style? : {} = {};   // CSS styles (TODO: other elements?)

    constructor(
        public readonly width: number,
        public readonly height: number,
    ) {
    }
    abstract blank(width: number, height: number) : AbstractBitmap<T>;
    abstract setarray(arr: ArrayLike<number>) : void;
    abstract set(x: number, y: number, val: number) : void;
    abstract get(x: number, y: number): number;
    abstract getrgba(x: number, y: number): number;

    inbounds(x: number, y: number): boolean {
        return (x >= 0 && x < this.width && y >= 0 && y < this.height);
    }
    assign(fn: ArrayLike<number> | PixelMapFunction) : void {
        if (typeof fn === 'function') {
            for (let y=0; y<this.height; y++) {
                for (let x=0; x<this.width; x++) {
                    this.set(x, y, fn(x, y));
                }
            }
        } else if (fn && fn['length'] != null) {
            this.setarray(fn);
        } else {
            throw new Error(`Illegal argument to assign(): ${fn}`)
        }
    }
    clone() : AbstractBitmap<T> {
        let bmp = this.blank(this.width, this.height);
        bmp.assign((x,y) => this.get(x,y));
        return bmp;
    }
    crop(srcx: number, srcy: number, width: number, height: number) {
        let dest = this.blank(width, height);
        dest.assign((x, y) => this.get(x + srcx, y + srcy));
        return dest;
    }
    blit(src: BitmapType, 
        destx: number, desty: number,
        srcx: number, srcy: number)
    {
        destx |= 0;
        desty |= 0;
        srcx |= 0;
        srcy |= 0;
        for (var y=0; y<src.height; y++) {
            for (var x=0; x<src.width; x++) {
                let rgba = src.getrgba(x+srcx, y+srcy);
                this.set(x+destx, y+desty, rgba);
            }
        }
    }
    fill(destx: number, desty: number, width:number, height:number, value:number) {
        for (var y=0; y<height; y++) {
            for (var x=0; x<width; x++) {
                this.set(x+destx, y+desty, value);
            }
        }
    }
}

export class RGBABitmap extends AbstractBitmap<RGBABitmap> {
    public readonly rgba: Uint32Array

    constructor(
        width: number,
        height: number,
        initial?: Uint32Array | PixelMapFunction
    ) {
        super(width, height);
        this.rgba = new Uint32Array(this.width * this.height);
        if (initial) this.assign(initial);
    }
    setarray(arr: ArrayLike<number>) {
        this.rgba.set(arr);
    }
    set(x: number, y: number, rgba: number) {
        if (this.inbounds(x,y)) this.rgba[y * this.width + x] = rgba;
    }
    get(x: number, y: number): number {
        return this.inbounds(x,y) ? this.rgba[y * this.width + x] : 0;
    }
    getrgba(x: number, y: number): number {
        return this.get(x, y);
    }
    blank(width?: number, height?: number) : RGBABitmap {
        return new RGBABitmap(width || this.width, height || this.height);
    }
    clone() : RGBABitmap {
        let bitmap = this.blank(this.width, this.height);
        bitmap.rgba.set(this.rgba);
        return bitmap;
    }
}

export abstract class MappedBitmap extends AbstractBitmap<MappedBitmap> {
    public readonly pixels: Uint8Array

    constructor(
        width: number,
        height: number,
        public readonly bpp: number,
        initial?: Uint8Array | PixelMapFunction
    ) {
        super(width, height);
        if (bpp != 1 && bpp != 2 && bpp != 4 && bpp != 8)
            throw new Error(`Invalid bits per pixel: ${bpp}`);
        this.pixels = new Uint8Array(this.width * this.height);
        if (initial) this.assign(initial);
    }
    setarray(arr: ArrayLike<number>) {
        this.pixels.set(arr);
    }
    set(x: number, y: number, index: number) {
        if (this.inbounds(x,y)) this.pixels[y * this.width + x] = index;
    }
    get(x: number, y: number): number {
        return this.inbounds(x,y) ? this.pixels[y * this.width + x] : 0;
    }
}

function getbpp(x : number | Palette) : number {
    if (typeof x === 'number') return x;
    if (x instanceof Palette) {
        if (x.colors.length <= 2) return 1;
        else if (x.colors.length <= 4) return 2;
        else if (x.colors.length <= 16) return 4;
    }
    return 8;
}

export class IndexedBitmap extends MappedBitmap {
    public palette: Palette;

    constructor(
        width: number,
        height: number,
        bppOrPalette: number | Palette,
        initial?: Uint8Array | PixelMapFunction
    ) {
        super(width, height, getbpp(bppOrPalette), initial);
        this.palette = bppOrPalette instanceof Palette
            ? bppOrPalette 
            : color.palette.colors(1 << this.bpp);
    }
    getrgba(x: number, y: number): number {
        return this.palette && this.palette.colors[this.get(x, y)];
    }
    blank(width?: number, height?: number, newPalette?: Palette) : IndexedBitmap {
        let bitmap = new IndexedBitmap(width || this.width, height || this.height, newPalette || this.palette);
        return bitmap;
    }
    clone() : IndexedBitmap {
        let bitmap = this.blank(this.width, this.height);
        bitmap.pixels.set(this.pixels);
        return bitmap;
    }
}

export function rgba(width: number, height: number, initial?: Uint32Array | PixelMapFunction) {
    return new RGBABitmap(width, height, initial);
}

export function indexed(width: number, height: number, bpp: number, initial?: Uint8Array | PixelMapFunction) {
    return new IndexedBitmap(width, height, bpp, initial);
}

export type BitmapType = RGBABitmap | IndexedBitmap;

// TODO: check arguments
export function decode(arr: Uint8Array, fmt: PixelEditorImageFormat) {
    var pixels = convertWordsToImages(arr, fmt);
    // TODO: guess if missing w/h/count?
    // TODO: reverse mapping
    // TODO: maybe better composable functions
    let bpp = (fmt.bpp||1) * (fmt.np||1);
    return pixels.map(data => new IndexedBitmap(fmt.w, fmt.h, bpp, data));
}

export interface BitmapAnalysis {
    min: {w: number, h: number};
    max: {w: number, h: number};
}

export function analyze(bitmaps: BitmapType[]) {
    bitmaps = coerceToArray(bitmaps);
    let r = {min:{w:0,h:0}, max:{w:0,h:0}};
    for (let bmp of bitmaps) {
        if (!(bmp instanceof AbstractBitmap)) return null;
        r.min.w = Math.min(bmp.width);
        r.max.w = Math.max(bmp.width);
        r.min.h = Math.min(bmp.height);
        r.max.h = Math.max(bmp.height);
    }
    return r;
}

export interface MontageOptions {
    analysis?: BitmapAnalysis;
    gap?: number;
    aspect?: number;
}

export function montage(bitmaps: BitmapType[], options?: MontageOptions) {
    bitmaps = coerceToArray(bitmaps);
    let minmax = (options && options.analysis) || analyze(bitmaps);
    if (minmax == null) throw new Error(`Expected an array of bitmaps`);
    let hitrects = [];
    let aspect = (options && options.aspect) || 1;
    let gap = (options && options.gap) || 0;
    if (minmax.min.w == minmax.max.w && minmax.min.h == minmax.max.h) {
        let totalPixels = minmax.min.w * minmax.min.h * bitmaps.length;
        let factors = findIntegerFactors(totalPixels, minmax.max.w, minmax.max.h, aspect);
        let columns = Math.ceil(factors.a / minmax.min.w); // TODO: rounding?
        let rows = Math.ceil(factors.b / minmax.min.h);
        let result = new RGBABitmap(factors.a + gap * (columns-1), factors.b + gap * (rows-1));
        let x = 0;
        let y = 0;
        bitmaps.forEach((bmp) => {
            result.blit(bmp, x, y, 0, 0);
            hitrects.push({x, y, w: bmp.width, h: bmp.height })
            x += bmp.width + gap;
            if (x >= result.width) {
                x = 0;
                y += bmp.height + gap;
            }
        })
        return result;
    } else {
        throw new Error(`combine() only supports uniformly-sized images right now`); // TODO
    }
}

/////

export namespace png {
    export function read(url: string): BitmapType {
        return decode(io.readbin(url));
    }
    export function decode(data: Uint8Array): BitmapType {
        let png = fastpng.decode(data);
        return convertToBitmap(png);
    }
    function convertToBitmap(png: fastpng.IDecodedPNG): BitmapType {
        if (png.palette && png.depth <= 8) {
            return convertIndexedToBitmap(png);
        } else {
            return convertRGBAToBitmap(png);
        }
    }
    function convertIndexedToBitmap(png: fastpng.IDecodedPNG): IndexedBitmap {
        var palarr = <any>png.palette as [number, number, number, number][];
        var palette = new Palette(palarr);
        let bitmap = new IndexedBitmap(png.width, png.height, png.depth);
        if (png.depth == 8) {
            bitmap.pixels.set(png.data);
        } else {
            let pixperbyte = Math.floor(8 / png.depth);
            let mask = (1 << png.depth) - 1;
            for (let i = 0; i < bitmap.pixels.length; i++) {
                var bofs = (i % pixperbyte) * png.depth;
                let val = png.data[Math.floor(i / pixperbyte)];
                bitmap.pixels[i] = (val >> bofs) & mask;
            }
        }
        bitmap.palette = palette;
        // TODO: aspect etc
        return bitmap;
    }
    function convertRGBAToBitmap(png: fastpng.IDecodedPNG): RGBABitmap {
        const bitmap = new RGBABitmap(png.width, png.height);
        const rgba : [number,number,number,number] = [0, 0, 0, 0];
        for (let i = 0; i < bitmap.rgba.length; i++) {
            for (let j = 0; j < 4; j++)
                rgba[j] = png.data[i * 4 + j];
            bitmap.rgba[i] = color.rgba(rgba);
        }
        // TODO: aspect etc
        return bitmap;
    }
}

export namespace font {
    interface Font {
        maxheight: number;
        glyphs: { [code: number]: Glyph };
        properties: {};
    }
    class Glyph extends IndexedBitmap {
        constructor(width: number, height: number, bpp: number,
            public readonly code: number,
            public readonly yoffset: number) {
            super(width, height, bpp);
        }
    }
    export function read(url: string) {
        if (url.endsWith('.yaff')) return decodeyafflines(io.readlines(url));
        if (url.endsWith('.draw')) return decodedrawlines(io.readlines(url));
        throw new Error(`Can't figure out font format for "${url}"`);
    }
    export function decodeglyph(glines: string[], curcode: number, yoffset: number): Glyph {
        let width = 0;
        for (var gline of glines) width = Math.max(width, gline.length);
        let g = new Glyph(width, glines.length, 1, curcode, yoffset);
        for (var y = 0; y < glines.length; y++) {
            let gline = glines[y];
            for (var x = 0; x < gline.length; x++) {
                let ch = gline[x];
                g.set(x, y, ch==='@' || ch==='#' ? 1 : 0); // TODO: provide mapping
            }
        }
        return g;
    }
    // https://github.com/robhagemans/monobit
    export function decodeyafflines(lines: string[]): Font {
        let maxheight = 0;
        let properties = {};
        let glyphs = {};
        let yoffset = 0;
        let curcode = -1;
        let curglyph: string[] = [];
        const re_prop = /^([\w-]+):\s+(.+)/i;
        const re_label = /^0x([0-9a-f]+):|u[+]([0-9a-f]+):|(\w+):/i;
        const re_gline = /^\s+([.@]+)/
        function addfont() {
            if (curcode >= 0 && curglyph.length) {
                glyphs[curcode] = decodeglyph(curglyph, curcode, yoffset);
                curcode = -1;
                curglyph = [];
            }
        }
        for (let line of lines) {
            let m: RegExpExecArray;
            if (m = re_prop.exec(line)) {
                properties[m[1]] = m[2];
                if (m[1] === 'bottom') yoffset = parseInt(m[2]);
                if (m[1] === 'size') maxheight = parseInt(m[2]);
            } else if (m = re_label.exec(line)) {
                addfont();
                if (m[1] != null) curcode = parseInt(m[1], 16);
                else if (m[2] != null) curcode = parseInt(m[2], 16);
                else if (m[3] != null) curcode = null; // text labels not supported
            } else if (m = re_gline.exec(line)) {
                curglyph.push(m[1]);
            }
            if (isNaN(curcode + yoffset + maxheight))
                throw new Error(`couldn't decode .yaff: ${JSON.stringify(line)}`)
        }
        addfont();
        return { maxheight, properties, glyphs };
    }
    // https://github.com/robhagemans/monobit
    export function decodedrawlines(lines: string[]): Font {
        let maxheight = 0;
        let properties = {};
        let glyphs = {};
        let curcode = -1;
        let curglyph: string[] = [];
        const re_gline = /^([0-9a-f]+)?[:]?\s*([-#]+)/i;
        function addfont() {
            if (curcode >= 0 && curglyph.length) {
                glyphs[curcode] = decodeglyph(curglyph, curcode, 0);
                maxheight = Math.max(maxheight, curglyph.length);
                curcode = -1;
                curglyph = [];
            }
        }
        for (let line of lines) {
            let m: RegExpExecArray;
            if (m = re_gline.exec(line)) {
                if (m[1] != null) {
                    addfont();
                    curcode = parseInt(m[1], 16);
                    if (isNaN(curcode))
                        throw new Error(`couldn't decode .draw: ${JSON.stringify(line)}`)
                }
                curglyph.push(m[2]);
            }
        }
        addfont();
        return { maxheight, properties, glyphs };
    }
}

// TODO: merge w/ pixeleditor

export type PixelEditorImageFormat = {
    w:number
    h:number
    count?:number
    bpp?:number
    np?:number
    bpw?:number
    sl?:number
    pofs?:number
    remap?:number[]
    reindex?:number[]
    brev?:boolean
    flip?:boolean
    destfmt?:PixelEditorImageFormat
    xform?:string
    skip?:number
    aspect?:number
  };

  function remapBits(x:number, arr:number[]) : number {
    if (!arr) return x;
    var y = 0;
    for (var i=0; i<arr.length; i++) {
      var s = arr[i];
      if (s < 0) {
        s = -s-1;
        y ^= 1 << s;
      }
      if (x & (1 << i)) {
        y ^= 1 << s;
      }
    }
    return y;
  }
  
  export function convertWordsToImages(words:ArrayLike<number>, fmt:PixelEditorImageFormat) : Uint8Array[] {
    var width = fmt.w;
    var height = fmt.h;
    var count = fmt.count || 1;
    var bpp = fmt.bpp || 1;
    var nplanes = fmt.np || 1;
    var bitsperword = fmt.bpw || 8;
    var wordsperline = fmt.sl || Math.ceil(width * bpp / bitsperword);
    var mask = (1 << bpp)-1;
    var pofs = fmt.pofs || wordsperline*height*count;
    var skip = fmt.skip || 0;
    var images = [];
    for (var n=0; n<count; n++) {
      var imgdata = [];
      for (var y=0; y<height; y++) {
        var yp = fmt.flip ? height-1-y : y;
        var ofs0 = n*wordsperline*height + yp*wordsperline;
        var shift = 0;
        for (var x=0; x<width; x++) {
          var color = 0;
          var ofs = remapBits(ofs0, fmt.remap);
          // TODO: if (fmt.reindex) { [ofs, shift] = reindexMask(x, fmt.reindex); ofs += ofs0; }
          for (var p=0; p<nplanes; p++) {
            var byte = words[ofs + p*pofs + skip];
            color |= ((fmt.brev ? byte>>(bitsperword-shift-bpp) : byte>>shift) & mask) << (p*bpp);
          }
          imgdata.push(color);
          shift += bpp;
          if (shift >= bitsperword && !fmt.reindex) {
            ofs0 += 1;
            shift = 0;
          }
        }
      }
      images.push(new Uint8Array(imgdata));
    }
    return images;
  }
  