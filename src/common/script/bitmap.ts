
import * as fastpng from 'fast-png';
import { convertWordsToImages, PixelEditorImageFormat } from '../../ide/pixeleditor';
import { arrayCompare } from '../util';
import * as io from './io'

export abstract class AbstractBitmap {
    constructor(
        public readonly width: number,
        public readonly height: number,
    ) {
    }
}

export class RGBABitmap extends AbstractBitmap {
    public readonly rgba: Uint32Array

    constructor(
        width: number,
        height: number,
    ) {
        super(width, height);
        this.rgba = new Uint32Array(this.width * this.height);
    }
    setPixel(x: number, y: number, rgba: number): void {
        this.rgba[y * this.width + x] = rgba;
    }
    getPixel(x: number, y: number): number {
        return this.rgba[y * this.width + x];
    }
}

export abstract class MappedBitmap extends AbstractBitmap {
    public readonly pixels: Uint8Array

    constructor(
        width: number,
        height: number,
        public readonly bitsPerPixel: number,
        pixels?: Uint8Array
    ) {
        super(width, height);
        this.pixels = pixels || new Uint8Array(this.width * this.height);
    }

    setPixel(x: number, y: number, index: number): void {
        this.pixels[y * this.width + x] = index;
    }
    getPixel(x: number, y: number): number {
        return this.pixels[y * this.width + x];
    }
    abstract getRGBAForIndex(index: number): number;
}

export class Palette {
    colors: Uint32Array;

    constructor(numColors: number) {
        this.colors = new Uint32Array(numColors);
    }
}

export class IndexedBitmap extends MappedBitmap {
    public palette: Palette;

    constructor(
        width: number,
        height: number,
        bitsPerPixel: number,
        pixels?: Uint8Array
    ) {
        super(width, height, bitsPerPixel, pixels);
        this.palette = getDefaultPalette(bitsPerPixel);
    }

    getRGBAForIndex(index: number): number {
        return this.palette.colors[index];
    }
}

// TODO?
function getDefaultPalette(bpp: number) {
    var pal = new Palette(1 << bpp);
    for (var i=0; i<pal.colors.length; i++) {
        pal.colors[i] = 0xff000000 | (i * 7919);
    }
    return pal;
}

export function rgbaToUint32(rgba: number[]): number {
    let v = 0;
    v |= rgba[0] << 0;
    v |= rgba[1] << 8;
    v |= rgba[2] << 16;
    v |= rgba[3] << 24;
    return v;
}

export function rgba(width: number, height: number) {
    return new RGBABitmap(width, height);
}

export function indexed(width: number, height: number, bpp: number) {
    return new IndexedBitmap(width, height, bpp);
}

export type BitmapType = RGBABitmap | IndexedBitmap;

export namespace png {
    export function load(url: string): BitmapType {
        return decode(io.loadbin(url));
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
            palette.colors[i] = rgbaToUint32(palarr[i]) | 0xff000000;
        }
        let bitmap = new IndexedBitmap(png.width, png.height, png.depth);
        for (let i = 0; i < bitmap.pixels.length; i++) {
            bitmap.pixels[i] = png.data[i];
        }
        bitmap.palette = palette;
        return bitmap;
    }
    function convertRGBAToBitmap(png: fastpng.IDecodedPNG): RGBABitmap {
        let bitmap = new RGBABitmap(png.width, png.height);
        let rgba = [0, 0, 0, 0];
        for (let i = 0; i < bitmap.rgba.length; i++) {
            for (let j = 0; j < 4; j++)
                rgba[j] = png.data[i * 4 + j];
            bitmap.rgba[i] = rgbaToUint32(rgba);
        }
        return bitmap;
    }
}

export namespace from {
    // TODO: check arguments
    export function bytes(arr: Uint8Array, fmt: PixelEditorImageFormat) {
        var pixels = convertWordsToImages(arr, fmt);
        // TODO: guess if missing w/h/count?
        // TODO: reverse mapping
        // TODO: maybe better composable functions
        return pixels.map(data => new IndexedBitmap(fmt.w, fmt.h, fmt.bpp|1, data));
    }
}
