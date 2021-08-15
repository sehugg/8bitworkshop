
export class Palette {
    colors: Uint32Array;

    constructor(arg: number | number[] | Uint32Array) {
        if (typeof arg === 'number') {
            if (!(arg >= 1 && arg <= 65536)) throw new Error('Invalid palette size ' + arg);
            this.colors = new Uint32Array(arg);
        } else {
            this.colors = new Uint32Array(arg);
        }
    }
}

export function rgb(r: number, g: number, b: number): number {
    return ((r & 0xff) << 0) | ((g & 0xff) << 8) | ((b & 0xff) << 16) | 0xff000000;
}

export function arr2rgba(arr: number[] | Uint8Array): number {
    let v = 0;
    v |= (arr[0] & 0xff) << 0;
    v |= (arr[1] & 0xff) << 8;
    v |= (arr[2] & 0xff) << 16;
    v |= (arr[3] & 0xff) << 24;
    return v;
}

export function rgba2arr(v: number): number[] {
    return [
        (v >> 0) & 0xff,
        (v >> 8) & 0xff,
        (v >> 16) & 0xff,
        (v >> 24) & 0xff,
    ]
}

export namespace palette {
    export function generate(bpp: number, func: (index: number) => number) {
        var pal = new Palette(1 << bpp);
        for (var i = 0; i < pal.colors.length; i++) {
            pal.colors[i] = 0xff000000 | func(i);
        }
        return pal;
    }
    export function mono() {
        return greys(1);
    }
    export function rgb2() {
        return new Palette([
            rgb(0, 0, 0),
            rgb(0, 0, 255),
            rgb(255, 0, 0),
            rgb(0, 255, 0),
        ]);
    }
    export function rgb3() {
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
    export function greys(bpp: number) {
        return generate(bpp, (i) => {
            let v = 255 * i / ((1 << bpp) - 1);
            return rgb(v,v,v);
        });
    }
    export function colors(bpp: number) {
        switch (bpp) {
            case 1: return mono();
            case 2: return rgb2();
            case 3: return rgb3();
            default: return factors(bpp); // TODO
        }
    }
    export function factors(bpp: number, mult?: number) {
        mult = mult || 0x031f0f;
        return generate(bpp, (i) => i * mult);
    }
    // TODO: https://www.iquilezles.org/www/articles/palettes/palettes.htm
}
