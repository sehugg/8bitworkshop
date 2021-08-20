
import _chroma from 'chroma-js'
import { isArray, rgb2bgr } from '../../util';

export type Chroma = { _rgb: [number,number,number,number] };

export type ColorSource = number | [number,number,number] | [number,number,number,number] | string | Chroma;

function checkCount(count) {
    if (count < 0 || count > 65536) {
        throw new Error("Palettes cannot have more than 2^16 (65536) colors.");
    }
}

export function isPalette(object): object is Palette {
    return object['colors'] instanceof Uint32Array;
}

export function isChroma(object): object is Chroma {
    return object['_rgb'] instanceof Array;
}

export class Palette {
    readonly colors: Uint32Array;

    constructor(arg: number | any[] | Uint32Array) {
        // TODO: more array types
        if (typeof arg === 'number') {
            checkCount(arg);
            this.colors = new Uint32Array(arg);
        } else if (arg instanceof Uint32Array) {
            this.colors = new Uint32Array(arg);
        } else if (isArray(arg)) {
            this.colors = new Uint32Array(arg.map(rgb));
        } else
            throw new Error(`Invalid Palette constructor`)
    }
    get(index: number) {
        return this.colors[index];
    }
    chromas() {
        return Array.from(this.colors).map((rgba) => from(rgba & 0xffffff));
    }
}

export const chroma = _chroma;

export function from(obj: ColorSource) {
    if (typeof obj === 'number')
        return _chroma(rgb2bgr(obj & 0xffffff));
    else
        return _chroma(obj as any);
}

export function rgb(obj: ColorSource) : number;
export function rgb(r: number, g: number, b: number) : number;

export function rgb(obj: any, g?: number, b?: number) : number {
    return rgba(obj, g, b, 0xff) | 0xff000000;
}

export function rgba(obj: ColorSource) : number;
export function rgba(r: number, g: number, b: number, a: number) : number;

export function rgba(obj: ColorSource, g?: number, b?: number, a?: number) : number {
    if (isChroma(obj)) {
        return rgba(obj._rgb[0], obj._rgb[1], obj._rgb[2], obj._rgb[3]);
    }
    if (typeof obj === 'number') {
        let r = obj;
        if (typeof g === 'number' && typeof b === 'number')
            return ((r & 0xff) << 0) | ((g & 0xff) << 8) | ((b & 0xff) << 16) | ((a & 0xff) << 24);
        else
            return obj;
    }
    if (typeof obj !== 'string' && isArray(obj) && typeof obj[0] === 'number') {
        let arr = obj;
        let v = 0;
        v |= (arr[0] & 0xff) << 0;
        v |= (arr[1] & 0xff) << 8;
        v |= (arr[2] & 0xff) << 16;
        v |= (arr[3] & 0xff) << 24;
        return v;
    }
    return rgba(from(obj).rgb());
}

export function rgba2arr(v: number): number[] {
    return [
        (v >> 0) & 0xff,
        (v >> 8) & 0xff,
        (v >> 16) & 0xff,
        (v >> 24) & 0xff,
    ]
}

export function rgb2arr(v: number): number[] {
    return rgba2arr(v).slice(0,3);
}

type ColorGenFunc = (index: number) => number;

export namespace palette {
    export function from(obj: number | any[] | Uint32Array | ColorGenFunc, count?: number) {
        checkCount(count);
        if (typeof obj === 'function') {
            if (!count) throw new Error(`You must also pass the number of colors to generate.`)
            var pal = new Palette(count);
            for (var i = 0; i < pal.colors.length; i++) {
                pal.colors[i] = rgba(obj(i));
            }
            return pal;
        } else {
            return new Palette(obj);
        }
    }
    export function mono() {
        return greys(2);
    }
    function rgb2() {
        return new Palette([
            rgb(0, 0, 0),
            rgb(0, 0, 255),
            rgb(255, 0, 0),
            rgb(0, 255, 0),
        ]);
    }
    function rgb3() {
        return new Palette([
            rgb(0, 0, 0),
            rgb(0, 0, 255),
            rgb(255, 0, 0),
            rgb(255, 0, 255),
            rgb(0, 255, 0),
            rgb(0, 255, 255),
            rgb(255, 255, 0),
            rgb(255, 255, 255),
        ]);
    }
    export function greys(count: number) {
        return from((i) => {
            let v = 255 * i / (count - 1);
            return rgb(v,v,v);
        }, count);
    }
    export function colors(count: number) {
        switch (count) {
            case 2: return mono();
            case 4: return rgb2();
            case 8: return rgb3();
            default: return factors(count); // TODO
        }
    }
    export function helix(count: number) {
        checkCount(count);
        return new Palette(chroma.cubehelix().scale().colors(count));
    }
    export function factors(count: number, mult?: number) {
        mult = mult || 0x031f0f;
        return from((i) => rgb(i * mult), count);
    }
    // TODO: https://www.iquilezles.org/www/articles/palettes/palettes.htm
}
