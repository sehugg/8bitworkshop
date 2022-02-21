"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.palette = exports.rgb2arr = exports.rgba2arr = exports.rgba = exports.rgb = exports.from = exports.chroma = exports.Palette = exports.isChroma = exports.isPalette = void 0;
const chroma_js_1 = __importDefault(require("chroma-js"));
const util_1 = require("../../util");
function checkCount(count) {
    if (count < 0 || count > 65536) {
        throw new Error("Palettes cannot have more than 2^16 (65536) colors.");
    }
}
function isPalette(object) {
    return object['colors'] instanceof Uint32Array;
}
exports.isPalette = isPalette;
function isChroma(object) {
    return object['_rgb'] instanceof Array;
}
exports.isChroma = isChroma;
class Palette {
    constructor(arg) {
        // TODO: more array types
        if (typeof arg === 'number') {
            checkCount(arg);
            this.colors = new Uint32Array(arg);
        }
        else if (arg instanceof Uint32Array) {
            this.colors = new Uint32Array(arg);
        }
        else if ((0, util_1.isArray)(arg)) {
            this.colors = new Uint32Array(arg.map(rgb));
        }
        else
            throw new Error(`Invalid Palette constructor`);
    }
    get(index) {
        return this.colors[index];
    }
    chromas() {
        return Array.from(this.colors).map((rgba) => from(rgba & 0xffffff));
    }
}
exports.Palette = Palette;
exports.chroma = chroma_js_1.default;
function from(obj) {
    if (typeof obj === 'number')
        return (0, chroma_js_1.default)((0, util_1.rgb2bgr)(obj & 0xffffff));
    else
        return (0, chroma_js_1.default)(obj);
}
exports.from = from;
function rgb(obj, g, b) {
    return rgba(obj, g, b, 0xff) | 0xff000000;
}
exports.rgb = rgb;
function rgba(obj, g, b, a) {
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
    if (typeof obj !== 'string' && (0, util_1.isArray)(obj) && typeof obj[0] === 'number') {
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
exports.rgba = rgba;
function rgba2arr(v) {
    return [
        (v >> 0) & 0xff,
        (v >> 8) & 0xff,
        (v >> 16) & 0xff,
        (v >> 24) & 0xff,
    ];
}
exports.rgba2arr = rgba2arr;
function rgb2arr(v) {
    return rgba2arr(v).slice(0, 3);
}
exports.rgb2arr = rgb2arr;
var palette;
(function (palette) {
    function from(obj, count) {
        checkCount(count);
        if (typeof obj === 'function') {
            if (!count)
                throw new Error(`You must also pass the number of colors to generate.`);
            var pal = new Palette(count);
            for (var i = 0; i < pal.colors.length; i++) {
                pal.colors[i] = rgba(obj(i));
            }
            return pal;
        }
        else {
            return new Palette(obj);
        }
    }
    palette.from = from;
    function mono() {
        return greys(2);
    }
    palette.mono = mono;
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
    function greys(count) {
        return from((i) => {
            let v = 255 * i / (count - 1);
            return rgb(v, v, v);
        }, count);
    }
    palette.greys = greys;
    function colors(count) {
        switch (count) {
            case 2: return mono();
            case 4: return rgb2();
            case 8: return rgb3();
            default: return factors(count); // TODO
        }
    }
    palette.colors = colors;
    function helix(count) {
        checkCount(count);
        return new Palette(exports.chroma.cubehelix().scale().colors(count));
    }
    palette.helix = helix;
    function factors(count, mult) {
        mult = mult || 0x031f0f;
        return from((i) => rgb(i * mult), count);
    }
    palette.factors = factors;
    // TODO: https://www.iquilezles.org/www/articles/palettes/palettes.htm
})(palette = exports.palette || (exports.palette = {}));
//# sourceMappingURL=color.js.map