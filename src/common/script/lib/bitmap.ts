
import * as fastpng from 'fast-png';
import { Palette } from './color';
import * as io from './io'
import * as color from './color'

export type PixelMapFunction = (x: number, y: number) => number;

export abstract class AbstractBitmap<T> {
    aspect? : number;   // aspect ratio, null == default == 1:1
    constructor(
        public readonly width: number,
        public readonly height: number,
    ) {
    }

    abstract blank(width: number, height: number) : AbstractBitmap<T>;
    abstract setarray(arr: ArrayLike<number>) : AbstractBitmap<T>;
    abstract set(x: number, y: number, val: number) : AbstractBitmap<T>;
    abstract get(x: number, y: number): number;

    inbounds(x: number, y: number): boolean {
        return (x >= 0 && x < this.width && y >= 0 && y < this.height);
    }
    assign(fn: ArrayLike<number> | PixelMapFunction) {
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
        return this;
    }
    clone() : AbstractBitmap<T> {
        return this.blank(this.width, this.height).assign((x,y) => this.get(x,y));
    }
    crop(srcx: number, srcy: number, width: number, height: number) {
        let dest = this.blank(width, height);
        dest.assign((x, y) => this.get(x + srcx, y + srcy));
        return dest;
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
        return this;
    }
    set(x: number, y: number, rgba: number) {
        if (this.inbounds(x,y)) this.rgba[y * this.width + x] = rgba;
        return this;
    }
    get(x: number, y: number): number {
        return this.inbounds(x,y) ? this.rgba[y * this.width + x] : 0;
    }
    blank(width: number, height: number) : RGBABitmap {
        return new RGBABitmap(width, height);
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
        public readonly bitsPerPixel: number,
        initial?: Uint8Array | PixelMapFunction
    ) {
        super(width, height);
        if (bitsPerPixel != 1 && bitsPerPixel != 2 && bitsPerPixel != 4 && bitsPerPixel != 8)
            throw new Error(`Invalid bits per pixel: ${bitsPerPixel}`);
        this.pixels = new Uint8Array(this.width * this.height);
        if (initial) this.assign(initial);
    }
    setarray(arr: ArrayLike<number>) {
        this.pixels.set(arr);
        return this;
    }
    set(x: number, y: number, index: number) {
        if (this.inbounds(x,y)) this.pixels[y * this.width + x] = index;
        return this;
    }
    get(x: number, y: number): number {
        return this.inbounds(x,y) ? this.pixels[y * this.width + x] : 0;
    }
    abstract getRGBAForIndex(index: number): number;
}

export class IndexedBitmap extends MappedBitmap {
    public palette: Palette;

    constructor(
        width: number,
        height: number,
        bitsPerPixel: number,
        initial?: Uint8Array | PixelMapFunction
    ) {
        super(width, height, bitsPerPixel || 8, initial);
        this.palette = color.palette.colors(this.bitsPerPixel);
    }

    getRGBAForIndex(index: number): number {
        return this.palette.colors[index];
    }
    blank(width: number, height: number) : IndexedBitmap {
        let bitmap = new IndexedBitmap(width, height, this.bitsPerPixel);
        bitmap.palette = this.palette;
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
    return pixels.map(data => new IndexedBitmap(fmt.w, fmt.h, fmt.bpp | 1, data));
}

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
        var palette = new Palette(palarr.length);
        for (let i = 0; i < palarr.length; i++) {
            // TODO: alpha?
            palette.colors[i] = color.arr2rgba(palarr[i]) | 0xff000000;
        }
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
        let bitmap = new RGBABitmap(png.width, png.height);
        let rgba = [0, 0, 0, 0];
        for (let i = 0; i < bitmap.rgba.length; i++) {
            for (let j = 0; j < 4; j++)
                rgba[j] = png.data[i * 4 + j];
            bitmap.rgba[i] = color.arr2rgba(rgba);
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
          var ofs = ofs0; // TODO: remapBits(ofs0, fmt.remap);
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
  