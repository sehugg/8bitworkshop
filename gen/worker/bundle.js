(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key2, value) => key2 in obj ? __defProp(obj, key2, { enumerable: true, configurable: true, writable: true, value }) : obj[key2] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined")
      return require.apply(this, arguments);
    throw new Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[Object.keys(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    __markAsModule(target);
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __reExport = (target, module2, desc) => {
    if (module2 && typeof module2 === "object" || typeof module2 === "function") {
      for (let key2 of __getOwnPropNames(module2))
        if (!__hasOwnProp.call(target, key2) && key2 !== "default")
          __defProp(target, key2, { get: () => module2[key2], enumerable: !(desc = __getOwnPropDesc(module2, key2)) || desc.enumerable });
    }
    return target;
  };
  var __toModule = (module2) => {
    return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
  };

  // node_modules/iobuffer/lib-esm/text-encoding-polyfill.js
  var require_text_encoding_polyfill = __commonJS({
    "node_modules/iobuffer/lib-esm/text-encoding-polyfill.js"(exports2) {
      "use strict";
      (function(scope) {
        "use strict";
        if (scope["TextEncoder"] && scope["TextDecoder"]) {
          return false;
        }
        function FastTextEncoder(utfLabel = "utf-8") {
          if (utfLabel !== "utf-8") {
            throw new RangeError(`Failed to construct 'TextEncoder': The encoding label provided ('${utfLabel}') is invalid.`);
          }
        }
        Object.defineProperty(FastTextEncoder.prototype, "encoding", {
          value: "utf-8"
        });
        FastTextEncoder.prototype.encode = function(string, options = { stream: false }) {
          if (options.stream) {
            throw new Error(`Failed to encode: the 'stream' option is unsupported.`);
          }
          let pos = 0;
          const len = string.length;
          const out = [];
          let at2 = 0;
          let tlen = Math.max(32, len + (len >> 1) + 7);
          let target = new Uint8Array(tlen >> 3 << 3);
          while (pos < len) {
            let value = string.charCodeAt(pos++);
            if (value >= 55296 && value <= 56319) {
              if (pos < len) {
                const extra = string.charCodeAt(pos);
                if ((extra & 64512) === 56320) {
                  ++pos;
                  value = ((value & 1023) << 10) + (extra & 1023) + 65536;
                }
              }
              if (value >= 55296 && value <= 56319) {
                continue;
              }
            }
            if (at2 + 4 > target.length) {
              tlen += 8;
              tlen *= 1 + pos / string.length * 2;
              tlen = tlen >> 3 << 3;
              const update2 = new Uint8Array(tlen);
              update2.set(target);
              target = update2;
            }
            if ((value & 4294967168) === 0) {
              target[at2++] = value;
              continue;
            } else if ((value & 4294965248) === 0) {
              target[at2++] = value >> 6 & 31 | 192;
            } else if ((value & 4294901760) === 0) {
              target[at2++] = value >> 12 & 15 | 224;
              target[at2++] = value >> 6 & 63 | 128;
            } else if ((value & 4292870144) === 0) {
              target[at2++] = value >> 18 & 7 | 240;
              target[at2++] = value >> 12 & 63 | 128;
              target[at2++] = value >> 6 & 63 | 128;
            } else {
              continue;
            }
            target[at2++] = value & 63 | 128;
          }
          return target.slice(0, at2);
        };
        function FastTextDecoder(utfLabel = "utf-8", options = { fatal: false }) {
          if (utfLabel !== "utf-8") {
            throw new RangeError(`Failed to construct 'TextDecoder': The encoding label provided ('${utfLabel}') is invalid.`);
          }
          if (options.fatal) {
            throw new Error(`Failed to construct 'TextDecoder': the 'fatal' option is unsupported.`);
          }
        }
        Object.defineProperty(FastTextDecoder.prototype, "encoding", {
          value: "utf-8"
        });
        Object.defineProperty(FastTextDecoder.prototype, "fatal", { value: false });
        Object.defineProperty(FastTextDecoder.prototype, "ignoreBOM", {
          value: false
        });
        FastTextDecoder.prototype.decode = function(buffer, options = { stream: false }) {
          if (options["stream"]) {
            throw new Error(`Failed to decode: the 'stream' option is unsupported.`);
          }
          const bytes = new Uint8Array(buffer);
          let pos = 0;
          const len = bytes.length;
          const out = [];
          while (pos < len) {
            const byte1 = bytes[pos++];
            if (byte1 === 0) {
              break;
            }
            if ((byte1 & 128) === 0) {
              out.push(byte1);
            } else if ((byte1 & 224) === 192) {
              const byte2 = bytes[pos++] & 63;
              out.push((byte1 & 31) << 6 | byte2);
            } else if ((byte1 & 240) === 224) {
              const byte2 = bytes[pos++] & 63;
              const byte3 = bytes[pos++] & 63;
              out.push((byte1 & 31) << 12 | byte2 << 6 | byte3);
            } else if ((byte1 & 248) === 240) {
              const byte2 = bytes[pos++] & 63;
              const byte3 = bytes[pos++] & 63;
              const byte4 = bytes[pos++] & 63;
              let codepoint = (byte1 & 7) << 18 | byte2 << 12 | byte3 << 6 | byte4;
              if (codepoint > 65535) {
                codepoint -= 65536;
                out.push(codepoint >>> 10 & 1023 | 55296);
                codepoint = 56320 | codepoint & 1023;
              }
              out.push(codepoint);
            } else {
            }
          }
          return String.fromCharCode.apply(null, out);
        };
        scope["TextEncoder"] = FastTextEncoder;
        scope["TextDecoder"] = FastTextDecoder;
      })(typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : exports2);
    }
  });

  // node_modules/chroma-js/chroma.js
  var require_chroma = __commonJS({
    "node_modules/chroma-js/chroma.js"(exports2, module2) {
      (function(global2, factory) {
        typeof exports2 === "object" && typeof module2 !== "undefined" ? module2.exports = factory() : typeof define === "function" && define.amd ? define(factory) : global2.chroma = factory();
      })(exports2, function() {
        "use strict";
        var limit = function(x, min2, max2) {
          if (min2 === void 0)
            min2 = 0;
          if (max2 === void 0)
            max2 = 1;
          return x < min2 ? min2 : x > max2 ? max2 : x;
        };
        var clip_rgb = function(rgb2) {
          rgb2._clipped = false;
          rgb2._unclipped = rgb2.slice(0);
          for (var i2 = 0; i2 <= 3; i2++) {
            if (i2 < 3) {
              if (rgb2[i2] < 0 || rgb2[i2] > 255) {
                rgb2._clipped = true;
              }
              rgb2[i2] = limit(rgb2[i2], 0, 255);
            } else if (i2 === 3) {
              rgb2[i2] = limit(rgb2[i2], 0, 1);
            }
          }
          return rgb2;
        };
        var classToType = {};
        for (var i = 0, list = ["Boolean", "Number", "String", "Function", "Array", "Date", "RegExp", "Undefined", "Null"]; i < list.length; i += 1) {
          var name = list[i];
          classToType["[object " + name + "]"] = name.toLowerCase();
        }
        var type = function(obj) {
          return classToType[Object.prototype.toString.call(obj)] || "object";
        };
        var unpack = function(args, keyOrder) {
          if (keyOrder === void 0)
            keyOrder = null;
          if (args.length >= 3) {
            return Array.prototype.slice.call(args);
          }
          if (type(args[0]) == "object" && keyOrder) {
            return keyOrder.split("").filter(function(k) {
              return args[0][k] !== void 0;
            }).map(function(k) {
              return args[0][k];
            });
          }
          return args[0];
        };
        var last = function(args) {
          if (args.length < 2) {
            return null;
          }
          var l = args.length - 1;
          if (type(args[l]) == "string") {
            return args[l].toLowerCase();
          }
          return null;
        };
        var PI = Math.PI;
        var utils = {
          clip_rgb,
          limit,
          type,
          unpack,
          last,
          PI,
          TWOPI: PI * 2,
          PITHIRD: PI / 3,
          DEG2RAD: PI / 180,
          RAD2DEG: 180 / PI
        };
        var input = {
          format: {},
          autodetect: []
        };
        var last$1 = utils.last;
        var clip_rgb$1 = utils.clip_rgb;
        var type$1 = utils.type;
        var Color = function Color2() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var me = this;
          if (type$1(args[0]) === "object" && args[0].constructor && args[0].constructor === this.constructor) {
            return args[0];
          }
          var mode = last$1(args);
          var autodetect = false;
          if (!mode) {
            autodetect = true;
            if (!input.sorted) {
              input.autodetect = input.autodetect.sort(function(a, b) {
                return b.p - a.p;
              });
              input.sorted = true;
            }
            for (var i2 = 0, list2 = input.autodetect; i2 < list2.length; i2 += 1) {
              var chk = list2[i2];
              mode = chk.test.apply(chk, args);
              if (mode) {
                break;
              }
            }
          }
          if (input.format[mode]) {
            var rgb2 = input.format[mode].apply(null, autodetect ? args : args.slice(0, -1));
            me._rgb = clip_rgb$1(rgb2);
          } else {
            throw new Error("unknown format: " + args);
          }
          if (me._rgb.length === 3) {
            me._rgb.push(1);
          }
        };
        Color.prototype.toString = function toString8() {
          if (type$1(this.hex) == "function") {
            return this.hex();
          }
          return "[" + this._rgb.join(",") + "]";
        };
        var Color_1 = Color;
        var chroma2 = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(chroma2.Color, [null].concat(args)))();
        };
        chroma2.Color = Color_1;
        chroma2.version = "2.1.2";
        var chroma_1 = chroma2;
        var unpack$1 = utils.unpack;
        var max = Math.max;
        var rgb2cmyk = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var ref2 = unpack$1(args, "rgb");
          var r = ref2[0];
          var g = ref2[1];
          var b = ref2[2];
          r = r / 255;
          g = g / 255;
          b = b / 255;
          var k = 1 - max(r, max(g, b));
          var f = k < 1 ? 1 / (1 - k) : 0;
          var c = (1 - r - k) * f;
          var m = (1 - g - k) * f;
          var y = (1 - b - k) * f;
          return [c, m, y, k];
        };
        var rgb2cmyk_1 = rgb2cmyk;
        var unpack$2 = utils.unpack;
        var cmyk2rgb = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          args = unpack$2(args, "cmyk");
          var c = args[0];
          var m = args[1];
          var y = args[2];
          var k = args[3];
          var alpha = args.length > 4 ? args[4] : 1;
          if (k === 1) {
            return [0, 0, 0, alpha];
          }
          return [
            c >= 1 ? 0 : 255 * (1 - c) * (1 - k),
            m >= 1 ? 0 : 255 * (1 - m) * (1 - k),
            y >= 1 ? 0 : 255 * (1 - y) * (1 - k),
            alpha
          ];
        };
        var cmyk2rgb_1 = cmyk2rgb;
        var unpack$3 = utils.unpack;
        var type$2 = utils.type;
        Color_1.prototype.cmyk = function() {
          return rgb2cmyk_1(this._rgb);
        };
        chroma_1.cmyk = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["cmyk"])))();
        };
        input.format.cmyk = cmyk2rgb_1;
        input.autodetect.push({
          p: 2,
          test: function() {
            var args = [], len = arguments.length;
            while (len--)
              args[len] = arguments[len];
            args = unpack$3(args, "cmyk");
            if (type$2(args) === "array" && args.length === 4) {
              return "cmyk";
            }
          }
        });
        var unpack$4 = utils.unpack;
        var last$2 = utils.last;
        var rnd = function(a) {
          return Math.round(a * 100) / 100;
        };
        var hsl2css = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var hsla = unpack$4(args, "hsla");
          var mode = last$2(args) || "lsa";
          hsla[0] = rnd(hsla[0] || 0);
          hsla[1] = rnd(hsla[1] * 100) + "%";
          hsla[2] = rnd(hsla[2] * 100) + "%";
          if (mode === "hsla" || hsla.length > 3 && hsla[3] < 1) {
            hsla[3] = hsla.length > 3 ? hsla[3] : 1;
            mode = "hsla";
          } else {
            hsla.length = 3;
          }
          return mode + "(" + hsla.join(",") + ")";
        };
        var hsl2css_1 = hsl2css;
        var unpack$5 = utils.unpack;
        var rgb2hsl = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          args = unpack$5(args, "rgba");
          var r = args[0];
          var g = args[1];
          var b = args[2];
          r /= 255;
          g /= 255;
          b /= 255;
          var min2 = Math.min(r, g, b);
          var max2 = Math.max(r, g, b);
          var l = (max2 + min2) / 2;
          var s, h;
          if (max2 === min2) {
            s = 0;
            h = Number.NaN;
          } else {
            s = l < 0.5 ? (max2 - min2) / (max2 + min2) : (max2 - min2) / (2 - max2 - min2);
          }
          if (r == max2) {
            h = (g - b) / (max2 - min2);
          } else if (g == max2) {
            h = 2 + (b - r) / (max2 - min2);
          } else if (b == max2) {
            h = 4 + (r - g) / (max2 - min2);
          }
          h *= 60;
          if (h < 0) {
            h += 360;
          }
          if (args.length > 3 && args[3] !== void 0) {
            return [h, s, l, args[3]];
          }
          return [h, s, l];
        };
        var rgb2hsl_1 = rgb2hsl;
        var unpack$6 = utils.unpack;
        var last$3 = utils.last;
        var round = Math.round;
        var rgb2css = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var rgba3 = unpack$6(args, "rgba");
          var mode = last$3(args) || "rgb";
          if (mode.substr(0, 3) == "hsl") {
            return hsl2css_1(rgb2hsl_1(rgba3), mode);
          }
          rgba3[0] = round(rgba3[0]);
          rgba3[1] = round(rgba3[1]);
          rgba3[2] = round(rgba3[2]);
          if (mode === "rgba" || rgba3.length > 3 && rgba3[3] < 1) {
            rgba3[3] = rgba3.length > 3 ? rgba3[3] : 1;
            mode = "rgba";
          }
          return mode + "(" + rgba3.slice(0, mode === "rgb" ? 3 : 4).join(",") + ")";
        };
        var rgb2css_1 = rgb2css;
        var unpack$7 = utils.unpack;
        var round$1 = Math.round;
        var hsl2rgb = function() {
          var assign2;
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          args = unpack$7(args, "hsl");
          var h = args[0];
          var s = args[1];
          var l = args[2];
          var r, g, b;
          if (s === 0) {
            r = g = b = l * 255;
          } else {
            var t3 = [0, 0, 0];
            var c = [0, 0, 0];
            var t2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var t1 = 2 * l - t2;
            var h_ = h / 360;
            t3[0] = h_ + 1 / 3;
            t3[1] = h_;
            t3[2] = h_ - 1 / 3;
            for (var i2 = 0; i2 < 3; i2++) {
              if (t3[i2] < 0) {
                t3[i2] += 1;
              }
              if (t3[i2] > 1) {
                t3[i2] -= 1;
              }
              if (6 * t3[i2] < 1) {
                c[i2] = t1 + (t2 - t1) * 6 * t3[i2];
              } else if (2 * t3[i2] < 1) {
                c[i2] = t2;
              } else if (3 * t3[i2] < 2) {
                c[i2] = t1 + (t2 - t1) * (2 / 3 - t3[i2]) * 6;
              } else {
                c[i2] = t1;
              }
            }
            assign2 = [round$1(c[0] * 255), round$1(c[1] * 255), round$1(c[2] * 255)], r = assign2[0], g = assign2[1], b = assign2[2];
          }
          if (args.length > 3) {
            return [r, g, b, args[3]];
          }
          return [r, g, b, 1];
        };
        var hsl2rgb_1 = hsl2rgb;
        var RE_RGB = /^rgb\(\s*(-?\d+),\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/;
        var RE_RGBA = /^rgba\(\s*(-?\d+),\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*([01]|[01]?\.\d+)\)$/;
        var RE_RGB_PCT = /^rgb\(\s*(-?\d+(?:\.\d+)?)%,\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*\)$/;
        var RE_RGBA_PCT = /^rgba\(\s*(-?\d+(?:\.\d+)?)%,\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)$/;
        var RE_HSL = /^hsl\(\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*\)$/;
        var RE_HSLA = /^hsla\(\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)$/;
        var round$2 = Math.round;
        var css2rgb = function(css) {
          css = css.toLowerCase().trim();
          var m;
          if (input.format.named) {
            try {
              return input.format.named(css);
            } catch (e) {
            }
          }
          if (m = css.match(RE_RGB)) {
            var rgb2 = m.slice(1, 4);
            for (var i2 = 0; i2 < 3; i2++) {
              rgb2[i2] = +rgb2[i2];
            }
            rgb2[3] = 1;
            return rgb2;
          }
          if (m = css.match(RE_RGBA)) {
            var rgb$12 = m.slice(1, 5);
            for (var i$12 = 0; i$12 < 4; i$12++) {
              rgb$12[i$12] = +rgb$12[i$12];
            }
            return rgb$12;
          }
          if (m = css.match(RE_RGB_PCT)) {
            var rgb$2 = m.slice(1, 4);
            for (var i$2 = 0; i$2 < 3; i$2++) {
              rgb$2[i$2] = round$2(rgb$2[i$2] * 2.55);
            }
            rgb$2[3] = 1;
            return rgb$2;
          }
          if (m = css.match(RE_RGBA_PCT)) {
            var rgb$3 = m.slice(1, 5);
            for (var i$3 = 0; i$3 < 3; i$3++) {
              rgb$3[i$3] = round$2(rgb$3[i$3] * 2.55);
            }
            rgb$3[3] = +rgb$3[3];
            return rgb$3;
          }
          if (m = css.match(RE_HSL)) {
            var hsl = m.slice(1, 4);
            hsl[1] *= 0.01;
            hsl[2] *= 0.01;
            var rgb$4 = hsl2rgb_1(hsl);
            rgb$4[3] = 1;
            return rgb$4;
          }
          if (m = css.match(RE_HSLA)) {
            var hsl$12 = m.slice(1, 4);
            hsl$12[1] *= 0.01;
            hsl$12[2] *= 0.01;
            var rgb$5 = hsl2rgb_1(hsl$12);
            rgb$5[3] = +m[4];
            return rgb$5;
          }
        };
        css2rgb.test = function(s) {
          return RE_RGB.test(s) || RE_RGBA.test(s) || RE_RGB_PCT.test(s) || RE_RGBA_PCT.test(s) || RE_HSL.test(s) || RE_HSLA.test(s);
        };
        var css2rgb_1 = css2rgb;
        var type$3 = utils.type;
        Color_1.prototype.css = function(mode) {
          return rgb2css_1(this._rgb, mode);
        };
        chroma_1.css = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["css"])))();
        };
        input.format.css = css2rgb_1;
        input.autodetect.push({
          p: 5,
          test: function(h) {
            var rest = [], len = arguments.length - 1;
            while (len-- > 0)
              rest[len] = arguments[len + 1];
            if (!rest.length && type$3(h) === "string" && css2rgb_1.test(h)) {
              return "css";
            }
          }
        });
        var unpack$8 = utils.unpack;
        input.format.gl = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var rgb2 = unpack$8(args, "rgba");
          rgb2[0] *= 255;
          rgb2[1] *= 255;
          rgb2[2] *= 255;
          return rgb2;
        };
        chroma_1.gl = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["gl"])))();
        };
        Color_1.prototype.gl = function() {
          var rgb2 = this._rgb;
          return [rgb2[0] / 255, rgb2[1] / 255, rgb2[2] / 255, rgb2[3]];
        };
        var unpack$9 = utils.unpack;
        var rgb2hcg = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var ref2 = unpack$9(args, "rgb");
          var r = ref2[0];
          var g = ref2[1];
          var b = ref2[2];
          var min2 = Math.min(r, g, b);
          var max2 = Math.max(r, g, b);
          var delta = max2 - min2;
          var c = delta * 100 / 255;
          var _g = min2 / (255 - delta) * 100;
          var h;
          if (delta === 0) {
            h = Number.NaN;
          } else {
            if (r === max2) {
              h = (g - b) / delta;
            }
            if (g === max2) {
              h = 2 + (b - r) / delta;
            }
            if (b === max2) {
              h = 4 + (r - g) / delta;
            }
            h *= 60;
            if (h < 0) {
              h += 360;
            }
          }
          return [h, c, _g];
        };
        var rgb2hcg_1 = rgb2hcg;
        var unpack$a = utils.unpack;
        var floor = Math.floor;
        var hcg2rgb = function() {
          var assign2, assign$1, assign$2, assign$3, assign$4, assign$5;
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          args = unpack$a(args, "hcg");
          var h = args[0];
          var c = args[1];
          var _g = args[2];
          var r, g, b;
          _g = _g * 255;
          var _c = c * 255;
          if (c === 0) {
            r = g = b = _g;
          } else {
            if (h === 360) {
              h = 0;
            }
            if (h > 360) {
              h -= 360;
            }
            if (h < 0) {
              h += 360;
            }
            h /= 60;
            var i2 = floor(h);
            var f = h - i2;
            var p = _g * (1 - c);
            var q = p + _c * (1 - f);
            var t = p + _c * f;
            var v = p + _c;
            switch (i2) {
              case 0:
                assign2 = [v, t, p], r = assign2[0], g = assign2[1], b = assign2[2];
                break;
              case 1:
                assign$1 = [q, v, p], r = assign$1[0], g = assign$1[1], b = assign$1[2];
                break;
              case 2:
                assign$2 = [p, v, t], r = assign$2[0], g = assign$2[1], b = assign$2[2];
                break;
              case 3:
                assign$3 = [p, q, v], r = assign$3[0], g = assign$3[1], b = assign$3[2];
                break;
              case 4:
                assign$4 = [t, p, v], r = assign$4[0], g = assign$4[1], b = assign$4[2];
                break;
              case 5:
                assign$5 = [v, p, q], r = assign$5[0], g = assign$5[1], b = assign$5[2];
                break;
            }
          }
          return [r, g, b, args.length > 3 ? args[3] : 1];
        };
        var hcg2rgb_1 = hcg2rgb;
        var unpack$b = utils.unpack;
        var type$4 = utils.type;
        Color_1.prototype.hcg = function() {
          return rgb2hcg_1(this._rgb);
        };
        chroma_1.hcg = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["hcg"])))();
        };
        input.format.hcg = hcg2rgb_1;
        input.autodetect.push({
          p: 1,
          test: function() {
            var args = [], len = arguments.length;
            while (len--)
              args[len] = arguments[len];
            args = unpack$b(args, "hcg");
            if (type$4(args) === "array" && args.length === 3) {
              return "hcg";
            }
          }
        });
        var unpack$c = utils.unpack;
        var last$4 = utils.last;
        var round$3 = Math.round;
        var rgb2hex = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var ref2 = unpack$c(args, "rgba");
          var r = ref2[0];
          var g = ref2[1];
          var b = ref2[2];
          var a = ref2[3];
          var mode = last$4(args) || "auto";
          if (a === void 0) {
            a = 1;
          }
          if (mode === "auto") {
            mode = a < 1 ? "rgba" : "rgb";
          }
          r = round$3(r);
          g = round$3(g);
          b = round$3(b);
          var u = r << 16 | g << 8 | b;
          var str = "000000" + u.toString(16);
          str = str.substr(str.length - 6);
          var hxa = "0" + round$3(a * 255).toString(16);
          hxa = hxa.substr(hxa.length - 2);
          switch (mode.toLowerCase()) {
            case "rgba":
              return "#" + str + hxa;
            case "argb":
              return "#" + hxa + str;
            default:
              return "#" + str;
          }
        };
        var rgb2hex_1 = rgb2hex;
        var RE_HEX = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        var RE_HEXA = /^#?([A-Fa-f0-9]{8}|[A-Fa-f0-9]{4})$/;
        var hex2rgb = function(hex3) {
          if (hex3.match(RE_HEX)) {
            if (hex3.length === 4 || hex3.length === 7) {
              hex3 = hex3.substr(1);
            }
            if (hex3.length === 3) {
              hex3 = hex3.split("");
              hex3 = hex3[0] + hex3[0] + hex3[1] + hex3[1] + hex3[2] + hex3[2];
            }
            var u = parseInt(hex3, 16);
            var r = u >> 16;
            var g = u >> 8 & 255;
            var b = u & 255;
            return [r, g, b, 1];
          }
          if (hex3.match(RE_HEXA)) {
            if (hex3.length === 5 || hex3.length === 9) {
              hex3 = hex3.substr(1);
            }
            if (hex3.length === 4) {
              hex3 = hex3.split("");
              hex3 = hex3[0] + hex3[0] + hex3[1] + hex3[1] + hex3[2] + hex3[2] + hex3[3] + hex3[3];
            }
            var u$1 = parseInt(hex3, 16);
            var r$1 = u$1 >> 24 & 255;
            var g$1 = u$1 >> 16 & 255;
            var b$1 = u$1 >> 8 & 255;
            var a = Math.round((u$1 & 255) / 255 * 100) / 100;
            return [r$1, g$1, b$1, a];
          }
          throw new Error("unknown hex color: " + hex3);
        };
        var hex2rgb_1 = hex2rgb;
        var type$5 = utils.type;
        Color_1.prototype.hex = function(mode) {
          return rgb2hex_1(this._rgb, mode);
        };
        chroma_1.hex = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["hex"])))();
        };
        input.format.hex = hex2rgb_1;
        input.autodetect.push({
          p: 4,
          test: function(h) {
            var rest = [], len = arguments.length - 1;
            while (len-- > 0)
              rest[len] = arguments[len + 1];
            if (!rest.length && type$5(h) === "string" && [3, 4, 5, 6, 7, 8, 9].indexOf(h.length) >= 0) {
              return "hex";
            }
          }
        });
        var unpack$d = utils.unpack;
        var TWOPI = utils.TWOPI;
        var min = Math.min;
        var sqrt = Math.sqrt;
        var acos = Math.acos;
        var rgb2hsi = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var ref2 = unpack$d(args, "rgb");
          var r = ref2[0];
          var g = ref2[1];
          var b = ref2[2];
          r /= 255;
          g /= 255;
          b /= 255;
          var h;
          var min_ = min(r, g, b);
          var i2 = (r + g + b) / 3;
          var s = i2 > 0 ? 1 - min_ / i2 : 0;
          if (s === 0) {
            h = NaN;
          } else {
            h = (r - g + (r - b)) / 2;
            h /= sqrt((r - g) * (r - g) + (r - b) * (g - b));
            h = acos(h);
            if (b > g) {
              h = TWOPI - h;
            }
            h /= TWOPI;
          }
          return [h * 360, s, i2];
        };
        var rgb2hsi_1 = rgb2hsi;
        var unpack$e = utils.unpack;
        var limit$1 = utils.limit;
        var TWOPI$1 = utils.TWOPI;
        var PITHIRD = utils.PITHIRD;
        var cos = Math.cos;
        var hsi2rgb = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          args = unpack$e(args, "hsi");
          var h = args[0];
          var s = args[1];
          var i2 = args[2];
          var r, g, b;
          if (isNaN(h)) {
            h = 0;
          }
          if (isNaN(s)) {
            s = 0;
          }
          if (h > 360) {
            h -= 360;
          }
          if (h < 0) {
            h += 360;
          }
          h /= 360;
          if (h < 1 / 3) {
            b = (1 - s) / 3;
            r = (1 + s * cos(TWOPI$1 * h) / cos(PITHIRD - TWOPI$1 * h)) / 3;
            g = 1 - (b + r);
          } else if (h < 2 / 3) {
            h -= 1 / 3;
            r = (1 - s) / 3;
            g = (1 + s * cos(TWOPI$1 * h) / cos(PITHIRD - TWOPI$1 * h)) / 3;
            b = 1 - (r + g);
          } else {
            h -= 2 / 3;
            g = (1 - s) / 3;
            b = (1 + s * cos(TWOPI$1 * h) / cos(PITHIRD - TWOPI$1 * h)) / 3;
            r = 1 - (g + b);
          }
          r = limit$1(i2 * r * 3);
          g = limit$1(i2 * g * 3);
          b = limit$1(i2 * b * 3);
          return [r * 255, g * 255, b * 255, args.length > 3 ? args[3] : 1];
        };
        var hsi2rgb_1 = hsi2rgb;
        var unpack$f = utils.unpack;
        var type$6 = utils.type;
        Color_1.prototype.hsi = function() {
          return rgb2hsi_1(this._rgb);
        };
        chroma_1.hsi = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["hsi"])))();
        };
        input.format.hsi = hsi2rgb_1;
        input.autodetect.push({
          p: 2,
          test: function() {
            var args = [], len = arguments.length;
            while (len--)
              args[len] = arguments[len];
            args = unpack$f(args, "hsi");
            if (type$6(args) === "array" && args.length === 3) {
              return "hsi";
            }
          }
        });
        var unpack$g = utils.unpack;
        var type$7 = utils.type;
        Color_1.prototype.hsl = function() {
          return rgb2hsl_1(this._rgb);
        };
        chroma_1.hsl = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["hsl"])))();
        };
        input.format.hsl = hsl2rgb_1;
        input.autodetect.push({
          p: 2,
          test: function() {
            var args = [], len = arguments.length;
            while (len--)
              args[len] = arguments[len];
            args = unpack$g(args, "hsl");
            if (type$7(args) === "array" && args.length === 3) {
              return "hsl";
            }
          }
        });
        var unpack$h = utils.unpack;
        var min$1 = Math.min;
        var max$1 = Math.max;
        var rgb2hsl$1 = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          args = unpack$h(args, "rgb");
          var r = args[0];
          var g = args[1];
          var b = args[2];
          var min_ = min$1(r, g, b);
          var max_ = max$1(r, g, b);
          var delta = max_ - min_;
          var h, s, v;
          v = max_ / 255;
          if (max_ === 0) {
            h = Number.NaN;
            s = 0;
          } else {
            s = delta / max_;
            if (r === max_) {
              h = (g - b) / delta;
            }
            if (g === max_) {
              h = 2 + (b - r) / delta;
            }
            if (b === max_) {
              h = 4 + (r - g) / delta;
            }
            h *= 60;
            if (h < 0) {
              h += 360;
            }
          }
          return [h, s, v];
        };
        var rgb2hsv = rgb2hsl$1;
        var unpack$i = utils.unpack;
        var floor$1 = Math.floor;
        var hsv2rgb = function() {
          var assign2, assign$1, assign$2, assign$3, assign$4, assign$5;
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          args = unpack$i(args, "hsv");
          var h = args[0];
          var s = args[1];
          var v = args[2];
          var r, g, b;
          v *= 255;
          if (s === 0) {
            r = g = b = v;
          } else {
            if (h === 360) {
              h = 0;
            }
            if (h > 360) {
              h -= 360;
            }
            if (h < 0) {
              h += 360;
            }
            h /= 60;
            var i2 = floor$1(h);
            var f = h - i2;
            var p = v * (1 - s);
            var q = v * (1 - s * f);
            var t = v * (1 - s * (1 - f));
            switch (i2) {
              case 0:
                assign2 = [v, t, p], r = assign2[0], g = assign2[1], b = assign2[2];
                break;
              case 1:
                assign$1 = [q, v, p], r = assign$1[0], g = assign$1[1], b = assign$1[2];
                break;
              case 2:
                assign$2 = [p, v, t], r = assign$2[0], g = assign$2[1], b = assign$2[2];
                break;
              case 3:
                assign$3 = [p, q, v], r = assign$3[0], g = assign$3[1], b = assign$3[2];
                break;
              case 4:
                assign$4 = [t, p, v], r = assign$4[0], g = assign$4[1], b = assign$4[2];
                break;
              case 5:
                assign$5 = [v, p, q], r = assign$5[0], g = assign$5[1], b = assign$5[2];
                break;
            }
          }
          return [r, g, b, args.length > 3 ? args[3] : 1];
        };
        var hsv2rgb_1 = hsv2rgb;
        var unpack$j = utils.unpack;
        var type$8 = utils.type;
        Color_1.prototype.hsv = function() {
          return rgb2hsv(this._rgb);
        };
        chroma_1.hsv = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["hsv"])))();
        };
        input.format.hsv = hsv2rgb_1;
        input.autodetect.push({
          p: 2,
          test: function() {
            var args = [], len = arguments.length;
            while (len--)
              args[len] = arguments[len];
            args = unpack$j(args, "hsv");
            if (type$8(args) === "array" && args.length === 3) {
              return "hsv";
            }
          }
        });
        var labConstants = {
          Kn: 18,
          Xn: 0.95047,
          Yn: 1,
          Zn: 1.08883,
          t0: 0.137931034,
          t1: 0.206896552,
          t2: 0.12841855,
          t3: 8856452e-9
        };
        var unpack$k = utils.unpack;
        var pow = Math.pow;
        var rgb2lab = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var ref2 = unpack$k(args, "rgb");
          var r = ref2[0];
          var g = ref2[1];
          var b = ref2[2];
          var ref$1 = rgb2xyz(r, g, b);
          var x = ref$1[0];
          var y = ref$1[1];
          var z = ref$1[2];
          var l = 116 * y - 16;
          return [l < 0 ? 0 : l, 500 * (x - y), 200 * (y - z)];
        };
        var rgb_xyz = function(r) {
          if ((r /= 255) <= 0.04045) {
            return r / 12.92;
          }
          return pow((r + 0.055) / 1.055, 2.4);
        };
        var xyz_lab = function(t) {
          if (t > labConstants.t3) {
            return pow(t, 1 / 3);
          }
          return t / labConstants.t2 + labConstants.t0;
        };
        var rgb2xyz = function(r, g, b) {
          r = rgb_xyz(r);
          g = rgb_xyz(g);
          b = rgb_xyz(b);
          var x = xyz_lab((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / labConstants.Xn);
          var y = xyz_lab((0.2126729 * r + 0.7151522 * g + 0.072175 * b) / labConstants.Yn);
          var z = xyz_lab((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / labConstants.Zn);
          return [x, y, z];
        };
        var rgb2lab_1 = rgb2lab;
        var unpack$l = utils.unpack;
        var pow$1 = Math.pow;
        var lab2rgb = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          args = unpack$l(args, "lab");
          var l = args[0];
          var a = args[1];
          var b = args[2];
          var x, y, z, r, g, b_;
          y = (l + 16) / 116;
          x = isNaN(a) ? y : y + a / 500;
          z = isNaN(b) ? y : y - b / 200;
          y = labConstants.Yn * lab_xyz(y);
          x = labConstants.Xn * lab_xyz(x);
          z = labConstants.Zn * lab_xyz(z);
          r = xyz_rgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z);
          g = xyz_rgb(-0.969266 * x + 1.8760108 * y + 0.041556 * z);
          b_ = xyz_rgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z);
          return [r, g, b_, args.length > 3 ? args[3] : 1];
        };
        var xyz_rgb = function(r) {
          return 255 * (r <= 304e-5 ? 12.92 * r : 1.055 * pow$1(r, 1 / 2.4) - 0.055);
        };
        var lab_xyz = function(t) {
          return t > labConstants.t1 ? t * t * t : labConstants.t2 * (t - labConstants.t0);
        };
        var lab2rgb_1 = lab2rgb;
        var unpack$m = utils.unpack;
        var type$9 = utils.type;
        Color_1.prototype.lab = function() {
          return rgb2lab_1(this._rgb);
        };
        chroma_1.lab = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["lab"])))();
        };
        input.format.lab = lab2rgb_1;
        input.autodetect.push({
          p: 2,
          test: function() {
            var args = [], len = arguments.length;
            while (len--)
              args[len] = arguments[len];
            args = unpack$m(args, "lab");
            if (type$9(args) === "array" && args.length === 3) {
              return "lab";
            }
          }
        });
        var unpack$n = utils.unpack;
        var RAD2DEG = utils.RAD2DEG;
        var sqrt$1 = Math.sqrt;
        var atan2 = Math.atan2;
        var round$4 = Math.round;
        var lab2lch = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var ref2 = unpack$n(args, "lab");
          var l = ref2[0];
          var a = ref2[1];
          var b = ref2[2];
          var c = sqrt$1(a * a + b * b);
          var h = (atan2(b, a) * RAD2DEG + 360) % 360;
          if (round$4(c * 1e4) === 0) {
            h = Number.NaN;
          }
          return [l, c, h];
        };
        var lab2lch_1 = lab2lch;
        var unpack$o = utils.unpack;
        var rgb2lch = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var ref2 = unpack$o(args, "rgb");
          var r = ref2[0];
          var g = ref2[1];
          var b = ref2[2];
          var ref$1 = rgb2lab_1(r, g, b);
          var l = ref$1[0];
          var a = ref$1[1];
          var b_ = ref$1[2];
          return lab2lch_1(l, a, b_);
        };
        var rgb2lch_1 = rgb2lch;
        var unpack$p = utils.unpack;
        var DEG2RAD = utils.DEG2RAD;
        var sin = Math.sin;
        var cos$1 = Math.cos;
        var lch2lab = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var ref2 = unpack$p(args, "lch");
          var l = ref2[0];
          var c = ref2[1];
          var h = ref2[2];
          if (isNaN(h)) {
            h = 0;
          }
          h = h * DEG2RAD;
          return [l, cos$1(h) * c, sin(h) * c];
        };
        var lch2lab_1 = lch2lab;
        var unpack$q = utils.unpack;
        var lch2rgb = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          args = unpack$q(args, "lch");
          var l = args[0];
          var c = args[1];
          var h = args[2];
          var ref2 = lch2lab_1(l, c, h);
          var L = ref2[0];
          var a = ref2[1];
          var b_ = ref2[2];
          var ref$1 = lab2rgb_1(L, a, b_);
          var r = ref$1[0];
          var g = ref$1[1];
          var b = ref$1[2];
          return [r, g, b, args.length > 3 ? args[3] : 1];
        };
        var lch2rgb_1 = lch2rgb;
        var unpack$r = utils.unpack;
        var hcl2rgb = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var hcl = unpack$r(args, "hcl").reverse();
          return lch2rgb_1.apply(void 0, hcl);
        };
        var hcl2rgb_1 = hcl2rgb;
        var unpack$s = utils.unpack;
        var type$a = utils.type;
        Color_1.prototype.lch = function() {
          return rgb2lch_1(this._rgb);
        };
        Color_1.prototype.hcl = function() {
          return rgb2lch_1(this._rgb).reverse();
        };
        chroma_1.lch = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["lch"])))();
        };
        chroma_1.hcl = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["hcl"])))();
        };
        input.format.lch = lch2rgb_1;
        input.format.hcl = hcl2rgb_1;
        ["lch", "hcl"].forEach(function(m) {
          return input.autodetect.push({
            p: 2,
            test: function() {
              var args = [], len = arguments.length;
              while (len--)
                args[len] = arguments[len];
              args = unpack$s(args, m);
              if (type$a(args) === "array" && args.length === 3) {
                return m;
              }
            }
          });
        });
        var w3cx11 = {
          aliceblue: "#f0f8ff",
          antiquewhite: "#faebd7",
          aqua: "#00ffff",
          aquamarine: "#7fffd4",
          azure: "#f0ffff",
          beige: "#f5f5dc",
          bisque: "#ffe4c4",
          black: "#000000",
          blanchedalmond: "#ffebcd",
          blue: "#0000ff",
          blueviolet: "#8a2be2",
          brown: "#a52a2a",
          burlywood: "#deb887",
          cadetblue: "#5f9ea0",
          chartreuse: "#7fff00",
          chocolate: "#d2691e",
          coral: "#ff7f50",
          cornflower: "#6495ed",
          cornflowerblue: "#6495ed",
          cornsilk: "#fff8dc",
          crimson: "#dc143c",
          cyan: "#00ffff",
          darkblue: "#00008b",
          darkcyan: "#008b8b",
          darkgoldenrod: "#b8860b",
          darkgray: "#a9a9a9",
          darkgreen: "#006400",
          darkgrey: "#a9a9a9",
          darkkhaki: "#bdb76b",
          darkmagenta: "#8b008b",
          darkolivegreen: "#556b2f",
          darkorange: "#ff8c00",
          darkorchid: "#9932cc",
          darkred: "#8b0000",
          darksalmon: "#e9967a",
          darkseagreen: "#8fbc8f",
          darkslateblue: "#483d8b",
          darkslategray: "#2f4f4f",
          darkslategrey: "#2f4f4f",
          darkturquoise: "#00ced1",
          darkviolet: "#9400d3",
          deeppink: "#ff1493",
          deepskyblue: "#00bfff",
          dimgray: "#696969",
          dimgrey: "#696969",
          dodgerblue: "#1e90ff",
          firebrick: "#b22222",
          floralwhite: "#fffaf0",
          forestgreen: "#228b22",
          fuchsia: "#ff00ff",
          gainsboro: "#dcdcdc",
          ghostwhite: "#f8f8ff",
          gold: "#ffd700",
          goldenrod: "#daa520",
          gray: "#808080",
          green: "#008000",
          greenyellow: "#adff2f",
          grey: "#808080",
          honeydew: "#f0fff0",
          hotpink: "#ff69b4",
          indianred: "#cd5c5c",
          indigo: "#4b0082",
          ivory: "#fffff0",
          khaki: "#f0e68c",
          laserlemon: "#ffff54",
          lavender: "#e6e6fa",
          lavenderblush: "#fff0f5",
          lawngreen: "#7cfc00",
          lemonchiffon: "#fffacd",
          lightblue: "#add8e6",
          lightcoral: "#f08080",
          lightcyan: "#e0ffff",
          lightgoldenrod: "#fafad2",
          lightgoldenrodyellow: "#fafad2",
          lightgray: "#d3d3d3",
          lightgreen: "#90ee90",
          lightgrey: "#d3d3d3",
          lightpink: "#ffb6c1",
          lightsalmon: "#ffa07a",
          lightseagreen: "#20b2aa",
          lightskyblue: "#87cefa",
          lightslategray: "#778899",
          lightslategrey: "#778899",
          lightsteelblue: "#b0c4de",
          lightyellow: "#ffffe0",
          lime: "#00ff00",
          limegreen: "#32cd32",
          linen: "#faf0e6",
          magenta: "#ff00ff",
          maroon: "#800000",
          maroon2: "#7f0000",
          maroon3: "#b03060",
          mediumaquamarine: "#66cdaa",
          mediumblue: "#0000cd",
          mediumorchid: "#ba55d3",
          mediumpurple: "#9370db",
          mediumseagreen: "#3cb371",
          mediumslateblue: "#7b68ee",
          mediumspringgreen: "#00fa9a",
          mediumturquoise: "#48d1cc",
          mediumvioletred: "#c71585",
          midnightblue: "#191970",
          mintcream: "#f5fffa",
          mistyrose: "#ffe4e1",
          moccasin: "#ffe4b5",
          navajowhite: "#ffdead",
          navy: "#000080",
          oldlace: "#fdf5e6",
          olive: "#808000",
          olivedrab: "#6b8e23",
          orange: "#ffa500",
          orangered: "#ff4500",
          orchid: "#da70d6",
          palegoldenrod: "#eee8aa",
          palegreen: "#98fb98",
          paleturquoise: "#afeeee",
          palevioletred: "#db7093",
          papayawhip: "#ffefd5",
          peachpuff: "#ffdab9",
          peru: "#cd853f",
          pink: "#ffc0cb",
          plum: "#dda0dd",
          powderblue: "#b0e0e6",
          purple: "#800080",
          purple2: "#7f007f",
          purple3: "#a020f0",
          rebeccapurple: "#663399",
          red: "#ff0000",
          rosybrown: "#bc8f8f",
          royalblue: "#4169e1",
          saddlebrown: "#8b4513",
          salmon: "#fa8072",
          sandybrown: "#f4a460",
          seagreen: "#2e8b57",
          seashell: "#fff5ee",
          sienna: "#a0522d",
          silver: "#c0c0c0",
          skyblue: "#87ceeb",
          slateblue: "#6a5acd",
          slategray: "#708090",
          slategrey: "#708090",
          snow: "#fffafa",
          springgreen: "#00ff7f",
          steelblue: "#4682b4",
          tan: "#d2b48c",
          teal: "#008080",
          thistle: "#d8bfd8",
          tomato: "#ff6347",
          turquoise: "#40e0d0",
          violet: "#ee82ee",
          wheat: "#f5deb3",
          white: "#ffffff",
          whitesmoke: "#f5f5f5",
          yellow: "#ffff00",
          yellowgreen: "#9acd32"
        };
        var w3cx11_1 = w3cx11;
        var type$b = utils.type;
        Color_1.prototype.name = function() {
          var hex3 = rgb2hex_1(this._rgb, "rgb");
          for (var i2 = 0, list2 = Object.keys(w3cx11_1); i2 < list2.length; i2 += 1) {
            var n2 = list2[i2];
            if (w3cx11_1[n2] === hex3) {
              return n2.toLowerCase();
            }
          }
          return hex3;
        };
        input.format.named = function(name2) {
          name2 = name2.toLowerCase();
          if (w3cx11_1[name2]) {
            return hex2rgb_1(w3cx11_1[name2]);
          }
          throw new Error("unknown color name: " + name2);
        };
        input.autodetect.push({
          p: 5,
          test: function(h) {
            var rest = [], len = arguments.length - 1;
            while (len-- > 0)
              rest[len] = arguments[len + 1];
            if (!rest.length && type$b(h) === "string" && w3cx11_1[h.toLowerCase()]) {
              return "named";
            }
          }
        });
        var unpack$t = utils.unpack;
        var rgb2num = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var ref2 = unpack$t(args, "rgb");
          var r = ref2[0];
          var g = ref2[1];
          var b = ref2[2];
          return (r << 16) + (g << 8) + b;
        };
        var rgb2num_1 = rgb2num;
        var type$c = utils.type;
        var num2rgb = function(num) {
          if (type$c(num) == "number" && num >= 0 && num <= 16777215) {
            var r = num >> 16;
            var g = num >> 8 & 255;
            var b = num & 255;
            return [r, g, b, 1];
          }
          throw new Error("unknown num color: " + num);
        };
        var num2rgb_1 = num2rgb;
        var type$d = utils.type;
        Color_1.prototype.num = function() {
          return rgb2num_1(this._rgb);
        };
        chroma_1.num = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["num"])))();
        };
        input.format.num = num2rgb_1;
        input.autodetect.push({
          p: 5,
          test: function() {
            var args = [], len = arguments.length;
            while (len--)
              args[len] = arguments[len];
            if (args.length === 1 && type$d(args[0]) === "number" && args[0] >= 0 && args[0] <= 16777215) {
              return "num";
            }
          }
        });
        var unpack$u = utils.unpack;
        var type$e = utils.type;
        var round$5 = Math.round;
        Color_1.prototype.rgb = function(rnd2) {
          if (rnd2 === void 0)
            rnd2 = true;
          if (rnd2 === false) {
            return this._rgb.slice(0, 3);
          }
          return this._rgb.slice(0, 3).map(round$5);
        };
        Color_1.prototype.rgba = function(rnd2) {
          if (rnd2 === void 0)
            rnd2 = true;
          return this._rgb.slice(0, 4).map(function(v, i2) {
            return i2 < 3 ? rnd2 === false ? v : round$5(v) : v;
          });
        };
        chroma_1.rgb = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["rgb"])))();
        };
        input.format.rgb = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var rgba3 = unpack$u(args, "rgba");
          if (rgba3[3] === void 0) {
            rgba3[3] = 1;
          }
          return rgba3;
        };
        input.autodetect.push({
          p: 3,
          test: function() {
            var args = [], len = arguments.length;
            while (len--)
              args[len] = arguments[len];
            args = unpack$u(args, "rgba");
            if (type$e(args) === "array" && (args.length === 3 || args.length === 4 && type$e(args[3]) == "number" && args[3] >= 0 && args[3] <= 1)) {
              return "rgb";
            }
          }
        });
        var log = Math.log;
        var temperature2rgb = function(kelvin) {
          var temp = kelvin / 100;
          var r, g, b;
          if (temp < 66) {
            r = 255;
            g = -155.25485562709179 - 0.44596950469579133 * (g = temp - 2) + 104.49216199393888 * log(g);
            b = temp < 20 ? 0 : -254.76935184120902 + 0.8274096064007395 * (b = temp - 10) + 115.67994401066147 * log(b);
          } else {
            r = 351.97690566805693 + 0.114206453784165 * (r = temp - 55) - 40.25366309332127 * log(r);
            g = 325.4494125711974 + 0.07943456536662342 * (g = temp - 50) - 28.0852963507957 * log(g);
            b = 255;
          }
          return [r, g, b, 1];
        };
        var temperature2rgb_1 = temperature2rgb;
        var unpack$v = utils.unpack;
        var round$6 = Math.round;
        var rgb2temperature = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          var rgb2 = unpack$v(args, "rgb");
          var r = rgb2[0], b = rgb2[2];
          var minTemp = 1e3;
          var maxTemp = 4e4;
          var eps = 0.4;
          var temp;
          while (maxTemp - minTemp > eps) {
            temp = (maxTemp + minTemp) * 0.5;
            var rgb$12 = temperature2rgb_1(temp);
            if (rgb$12[2] / rgb$12[0] >= b / r) {
              maxTemp = temp;
            } else {
              minTemp = temp;
            }
          }
          return round$6(temp);
        };
        var rgb2temperature_1 = rgb2temperature;
        Color_1.prototype.temp = Color_1.prototype.kelvin = Color_1.prototype.temperature = function() {
          return rgb2temperature_1(this._rgb);
        };
        chroma_1.temp = chroma_1.kelvin = chroma_1.temperature = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          return new (Function.prototype.bind.apply(Color_1, [null].concat(args, ["temp"])))();
        };
        input.format.temp = input.format.kelvin = input.format.temperature = temperature2rgb_1;
        var type$f = utils.type;
        Color_1.prototype.alpha = function(a, mutate) {
          if (mutate === void 0)
            mutate = false;
          if (a !== void 0 && type$f(a) === "number") {
            if (mutate) {
              this._rgb[3] = a;
              return this;
            }
            return new Color_1([this._rgb[0], this._rgb[1], this._rgb[2], a], "rgb");
          }
          return this._rgb[3];
        };
        Color_1.prototype.clipped = function() {
          return this._rgb._clipped || false;
        };
        Color_1.prototype.darken = function(amount) {
          if (amount === void 0)
            amount = 1;
          var me = this;
          var lab = me.lab();
          lab[0] -= labConstants.Kn * amount;
          return new Color_1(lab, "lab").alpha(me.alpha(), true);
        };
        Color_1.prototype.brighten = function(amount) {
          if (amount === void 0)
            amount = 1;
          return this.darken(-amount);
        };
        Color_1.prototype.darker = Color_1.prototype.darken;
        Color_1.prototype.brighter = Color_1.prototype.brighten;
        Color_1.prototype.get = function(mc) {
          var ref2 = mc.split(".");
          var mode = ref2[0];
          var channel = ref2[1];
          var src = this[mode]();
          if (channel) {
            var i2 = mode.indexOf(channel);
            if (i2 > -1) {
              return src[i2];
            }
            throw new Error("unknown channel " + channel + " in mode " + mode);
          } else {
            return src;
          }
        };
        var type$g = utils.type;
        var pow$2 = Math.pow;
        var EPS = 1e-7;
        var MAX_ITER = 20;
        Color_1.prototype.luminance = function(lum) {
          if (lum !== void 0 && type$g(lum) === "number") {
            if (lum === 0) {
              return new Color_1([0, 0, 0, this._rgb[3]], "rgb");
            }
            if (lum === 1) {
              return new Color_1([255, 255, 255, this._rgb[3]], "rgb");
            }
            var cur_lum = this.luminance();
            var mode = "rgb";
            var max_iter = MAX_ITER;
            var test = function(low, high) {
              var mid = low.interpolate(high, 0.5, mode);
              var lm = mid.luminance();
              if (Math.abs(lum - lm) < EPS || !max_iter--) {
                return mid;
              }
              return lm > lum ? test(low, mid) : test(mid, high);
            };
            var rgb2 = (cur_lum > lum ? test(new Color_1([0, 0, 0]), this) : test(this, new Color_1([255, 255, 255]))).rgb();
            return new Color_1(rgb2.concat([this._rgb[3]]));
          }
          return rgb2luminance.apply(void 0, this._rgb.slice(0, 3));
        };
        var rgb2luminance = function(r, g, b) {
          r = luminance_x(r);
          g = luminance_x(g);
          b = luminance_x(b);
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        var luminance_x = function(x) {
          x /= 255;
          return x <= 0.03928 ? x / 12.92 : pow$2((x + 0.055) / 1.055, 2.4);
        };
        var interpolator = {};
        var type$h = utils.type;
        var mix = function(col1, col2, f) {
          if (f === void 0)
            f = 0.5;
          var rest = [], len = arguments.length - 3;
          while (len-- > 0)
            rest[len] = arguments[len + 3];
          var mode = rest[0] || "lrgb";
          if (!interpolator[mode] && !rest.length) {
            mode = Object.keys(interpolator)[0];
          }
          if (!interpolator[mode]) {
            throw new Error("interpolation mode " + mode + " is not defined");
          }
          if (type$h(col1) !== "object") {
            col1 = new Color_1(col1);
          }
          if (type$h(col2) !== "object") {
            col2 = new Color_1(col2);
          }
          return interpolator[mode](col1, col2, f).alpha(col1.alpha() + f * (col2.alpha() - col1.alpha()));
        };
        Color_1.prototype.mix = Color_1.prototype.interpolate = function(col2, f) {
          if (f === void 0)
            f = 0.5;
          var rest = [], len = arguments.length - 2;
          while (len-- > 0)
            rest[len] = arguments[len + 2];
          return mix.apply(void 0, [this, col2, f].concat(rest));
        };
        Color_1.prototype.premultiply = function(mutate) {
          if (mutate === void 0)
            mutate = false;
          var rgb2 = this._rgb;
          var a = rgb2[3];
          if (mutate) {
            this._rgb = [rgb2[0] * a, rgb2[1] * a, rgb2[2] * a, a];
            return this;
          } else {
            return new Color_1([rgb2[0] * a, rgb2[1] * a, rgb2[2] * a, a], "rgb");
          }
        };
        Color_1.prototype.saturate = function(amount) {
          if (amount === void 0)
            amount = 1;
          var me = this;
          var lch = me.lch();
          lch[1] += labConstants.Kn * amount;
          if (lch[1] < 0) {
            lch[1] = 0;
          }
          return new Color_1(lch, "lch").alpha(me.alpha(), true);
        };
        Color_1.prototype.desaturate = function(amount) {
          if (amount === void 0)
            amount = 1;
          return this.saturate(-amount);
        };
        var type$i = utils.type;
        Color_1.prototype.set = function(mc, value, mutate) {
          if (mutate === void 0)
            mutate = false;
          var ref2 = mc.split(".");
          var mode = ref2[0];
          var channel = ref2[1];
          var src = this[mode]();
          if (channel) {
            var i2 = mode.indexOf(channel);
            if (i2 > -1) {
              if (type$i(value) == "string") {
                switch (value.charAt(0)) {
                  case "+":
                    src[i2] += +value;
                    break;
                  case "-":
                    src[i2] += +value;
                    break;
                  case "*":
                    src[i2] *= +value.substr(1);
                    break;
                  case "/":
                    src[i2] /= +value.substr(1);
                    break;
                  default:
                    src[i2] = +value;
                }
              } else if (type$i(value) === "number") {
                src[i2] = value;
              } else {
                throw new Error("unsupported value for Color.set");
              }
              var out = new Color_1(src, mode);
              if (mutate) {
                this._rgb = out._rgb;
                return this;
              }
              return out;
            }
            throw new Error("unknown channel " + channel + " in mode " + mode);
          } else {
            return src;
          }
        };
        var rgb$1 = function(col1, col2, f) {
          var xyz0 = col1._rgb;
          var xyz1 = col2._rgb;
          return new Color_1(xyz0[0] + f * (xyz1[0] - xyz0[0]), xyz0[1] + f * (xyz1[1] - xyz0[1]), xyz0[2] + f * (xyz1[2] - xyz0[2]), "rgb");
        };
        interpolator.rgb = rgb$1;
        var sqrt$2 = Math.sqrt;
        var pow$3 = Math.pow;
        var lrgb = function(col1, col2, f) {
          var ref2 = col1._rgb;
          var x1 = ref2[0];
          var y1 = ref2[1];
          var z1 = ref2[2];
          var ref$1 = col2._rgb;
          var x2 = ref$1[0];
          var y2 = ref$1[1];
          var z2 = ref$1[2];
          return new Color_1(sqrt$2(pow$3(x1, 2) * (1 - f) + pow$3(x2, 2) * f), sqrt$2(pow$3(y1, 2) * (1 - f) + pow$3(y2, 2) * f), sqrt$2(pow$3(z1, 2) * (1 - f) + pow$3(z2, 2) * f), "rgb");
        };
        interpolator.lrgb = lrgb;
        var lab$1 = function(col1, col2, f) {
          var xyz0 = col1.lab();
          var xyz1 = col2.lab();
          return new Color_1(xyz0[0] + f * (xyz1[0] - xyz0[0]), xyz0[1] + f * (xyz1[1] - xyz0[1]), xyz0[2] + f * (xyz1[2] - xyz0[2]), "lab");
        };
        interpolator.lab = lab$1;
        var _hsx = function(col1, col2, f, m) {
          var assign2, assign$1;
          var xyz0, xyz1;
          if (m === "hsl") {
            xyz0 = col1.hsl();
            xyz1 = col2.hsl();
          } else if (m === "hsv") {
            xyz0 = col1.hsv();
            xyz1 = col2.hsv();
          } else if (m === "hcg") {
            xyz0 = col1.hcg();
            xyz1 = col2.hcg();
          } else if (m === "hsi") {
            xyz0 = col1.hsi();
            xyz1 = col2.hsi();
          } else if (m === "lch" || m === "hcl") {
            m = "hcl";
            xyz0 = col1.hcl();
            xyz1 = col2.hcl();
          }
          var hue0, hue1, sat0, sat1, lbv0, lbv1;
          if (m.substr(0, 1) === "h") {
            assign2 = xyz0, hue0 = assign2[0], sat0 = assign2[1], lbv0 = assign2[2];
            assign$1 = xyz1, hue1 = assign$1[0], sat1 = assign$1[1], lbv1 = assign$1[2];
          }
          var sat, hue, lbv, dh;
          if (!isNaN(hue0) && !isNaN(hue1)) {
            if (hue1 > hue0 && hue1 - hue0 > 180) {
              dh = hue1 - (hue0 + 360);
            } else if (hue1 < hue0 && hue0 - hue1 > 180) {
              dh = hue1 + 360 - hue0;
            } else {
              dh = hue1 - hue0;
            }
            hue = hue0 + f * dh;
          } else if (!isNaN(hue0)) {
            hue = hue0;
            if ((lbv1 == 1 || lbv1 == 0) && m != "hsv") {
              sat = sat0;
            }
          } else if (!isNaN(hue1)) {
            hue = hue1;
            if ((lbv0 == 1 || lbv0 == 0) && m != "hsv") {
              sat = sat1;
            }
          } else {
            hue = Number.NaN;
          }
          if (sat === void 0) {
            sat = sat0 + f * (sat1 - sat0);
          }
          lbv = lbv0 + f * (lbv1 - lbv0);
          return new Color_1([hue, sat, lbv], m);
        };
        var lch$1 = function(col1, col2, f) {
          return _hsx(col1, col2, f, "lch");
        };
        interpolator.lch = lch$1;
        interpolator.hcl = lch$1;
        var num$1 = function(col1, col2, f) {
          var c1 = col1.num();
          var c2 = col2.num();
          return new Color_1(c1 + f * (c2 - c1), "num");
        };
        interpolator.num = num$1;
        var hcg$1 = function(col1, col2, f) {
          return _hsx(col1, col2, f, "hcg");
        };
        interpolator.hcg = hcg$1;
        var hsi$1 = function(col1, col2, f) {
          return _hsx(col1, col2, f, "hsi");
        };
        interpolator.hsi = hsi$1;
        var hsl$1 = function(col1, col2, f) {
          return _hsx(col1, col2, f, "hsl");
        };
        interpolator.hsl = hsl$1;
        var hsv$1 = function(col1, col2, f) {
          return _hsx(col1, col2, f, "hsv");
        };
        interpolator.hsv = hsv$1;
        var clip_rgb$2 = utils.clip_rgb;
        var pow$4 = Math.pow;
        var sqrt$3 = Math.sqrt;
        var PI$1 = Math.PI;
        var cos$2 = Math.cos;
        var sin$1 = Math.sin;
        var atan2$1 = Math.atan2;
        var average = function(colors, mode, weights) {
          if (mode === void 0)
            mode = "lrgb";
          if (weights === void 0)
            weights = null;
          var l = colors.length;
          if (!weights) {
            weights = Array.from(new Array(l)).map(function() {
              return 1;
            });
          }
          var k = l / weights.reduce(function(a, b) {
            return a + b;
          });
          weights.forEach(function(w, i3) {
            weights[i3] *= k;
          });
          colors = colors.map(function(c) {
            return new Color_1(c);
          });
          if (mode === "lrgb") {
            return _average_lrgb(colors, weights);
          }
          var first = colors.shift();
          var xyz = first.get(mode);
          var cnt = [];
          var dx = 0;
          var dy = 0;
          for (var i2 = 0; i2 < xyz.length; i2++) {
            xyz[i2] = (xyz[i2] || 0) * weights[0];
            cnt.push(isNaN(xyz[i2]) ? 0 : weights[0]);
            if (mode.charAt(i2) === "h" && !isNaN(xyz[i2])) {
              var A = xyz[i2] / 180 * PI$1;
              dx += cos$2(A) * weights[0];
              dy += sin$1(A) * weights[0];
            }
          }
          var alpha = first.alpha() * weights[0];
          colors.forEach(function(c, ci) {
            var xyz2 = c.get(mode);
            alpha += c.alpha() * weights[ci + 1];
            for (var i3 = 0; i3 < xyz.length; i3++) {
              if (!isNaN(xyz2[i3])) {
                cnt[i3] += weights[ci + 1];
                if (mode.charAt(i3) === "h") {
                  var A2 = xyz2[i3] / 180 * PI$1;
                  dx += cos$2(A2) * weights[ci + 1];
                  dy += sin$1(A2) * weights[ci + 1];
                } else {
                  xyz[i3] += xyz2[i3] * weights[ci + 1];
                }
              }
            }
          });
          for (var i$12 = 0; i$12 < xyz.length; i$12++) {
            if (mode.charAt(i$12) === "h") {
              var A$1 = atan2$1(dy / cnt[i$12], dx / cnt[i$12]) / PI$1 * 180;
              while (A$1 < 0) {
                A$1 += 360;
              }
              while (A$1 >= 360) {
                A$1 -= 360;
              }
              xyz[i$12] = A$1;
            } else {
              xyz[i$12] = xyz[i$12] / cnt[i$12];
            }
          }
          alpha /= l;
          return new Color_1(xyz, mode).alpha(alpha > 0.99999 ? 1 : alpha, true);
        };
        var _average_lrgb = function(colors, weights) {
          var l = colors.length;
          var xyz = [0, 0, 0, 0];
          for (var i2 = 0; i2 < colors.length; i2++) {
            var col = colors[i2];
            var f = weights[i2] / l;
            var rgb2 = col._rgb;
            xyz[0] += pow$4(rgb2[0], 2) * f;
            xyz[1] += pow$4(rgb2[1], 2) * f;
            xyz[2] += pow$4(rgb2[2], 2) * f;
            xyz[3] += rgb2[3] * f;
          }
          xyz[0] = sqrt$3(xyz[0]);
          xyz[1] = sqrt$3(xyz[1]);
          xyz[2] = sqrt$3(xyz[2]);
          if (xyz[3] > 0.9999999) {
            xyz[3] = 1;
          }
          return new Color_1(clip_rgb$2(xyz));
        };
        var type$j = utils.type;
        var pow$5 = Math.pow;
        var scale = function(colors) {
          var _mode = "rgb";
          var _nacol = chroma_1("#ccc");
          var _spread = 0;
          var _domain = [0, 1];
          var _pos = [];
          var _padding = [0, 0];
          var _classes = false;
          var _colors = [];
          var _out = false;
          var _min = 0;
          var _max = 1;
          var _correctLightness = false;
          var _colorCache = {};
          var _useCache = true;
          var _gamma = 1;
          var setColors = function(colors2) {
            colors2 = colors2 || ["#fff", "#000"];
            if (colors2 && type$j(colors2) === "string" && chroma_1.brewer && chroma_1.brewer[colors2.toLowerCase()]) {
              colors2 = chroma_1.brewer[colors2.toLowerCase()];
            }
            if (type$j(colors2) === "array") {
              if (colors2.length === 1) {
                colors2 = [colors2[0], colors2[0]];
              }
              colors2 = colors2.slice(0);
              for (var c = 0; c < colors2.length; c++) {
                colors2[c] = chroma_1(colors2[c]);
              }
              _pos.length = 0;
              for (var c$1 = 0; c$1 < colors2.length; c$1++) {
                _pos.push(c$1 / (colors2.length - 1));
              }
            }
            resetCache();
            return _colors = colors2;
          };
          var getClass = function(value) {
            if (_classes != null) {
              var n2 = _classes.length - 1;
              var i2 = 0;
              while (i2 < n2 && value >= _classes[i2]) {
                i2++;
              }
              return i2 - 1;
            }
            return 0;
          };
          var tMapLightness = function(t) {
            return t;
          };
          var tMapDomain = function(t) {
            return t;
          };
          var getColor = function(val, bypassMap) {
            var col, t;
            if (bypassMap == null) {
              bypassMap = false;
            }
            if (isNaN(val) || val === null) {
              return _nacol;
            }
            if (!bypassMap) {
              if (_classes && _classes.length > 2) {
                var c = getClass(val);
                t = c / (_classes.length - 2);
              } else if (_max !== _min) {
                t = (val - _min) / (_max - _min);
              } else {
                t = 1;
              }
            } else {
              t = val;
            }
            t = tMapDomain(t);
            if (!bypassMap) {
              t = tMapLightness(t);
            }
            if (_gamma !== 1) {
              t = pow$5(t, _gamma);
            }
            t = _padding[0] + t * (1 - _padding[0] - _padding[1]);
            t = Math.min(1, Math.max(0, t));
            var k = Math.floor(t * 1e4);
            if (_useCache && _colorCache[k]) {
              col = _colorCache[k];
            } else {
              if (type$j(_colors) === "array") {
                for (var i2 = 0; i2 < _pos.length; i2++) {
                  var p = _pos[i2];
                  if (t <= p) {
                    col = _colors[i2];
                    break;
                  }
                  if (t >= p && i2 === _pos.length - 1) {
                    col = _colors[i2];
                    break;
                  }
                  if (t > p && t < _pos[i2 + 1]) {
                    t = (t - p) / (_pos[i2 + 1] - p);
                    col = chroma_1.interpolate(_colors[i2], _colors[i2 + 1], t, _mode);
                    break;
                  }
                }
              } else if (type$j(_colors) === "function") {
                col = _colors(t);
              }
              if (_useCache) {
                _colorCache[k] = col;
              }
            }
            return col;
          };
          var resetCache = function() {
            return _colorCache = {};
          };
          setColors(colors);
          var f = function(v) {
            var c = chroma_1(getColor(v));
            if (_out && c[_out]) {
              return c[_out]();
            } else {
              return c;
            }
          };
          f.classes = function(classes) {
            if (classes != null) {
              if (type$j(classes) === "array") {
                _classes = classes;
                _domain = [classes[0], classes[classes.length - 1]];
              } else {
                var d = chroma_1.analyze(_domain);
                if (classes === 0) {
                  _classes = [d.min, d.max];
                } else {
                  _classes = chroma_1.limits(d, "e", classes);
                }
              }
              return f;
            }
            return _classes;
          };
          f.domain = function(domain) {
            if (!arguments.length) {
              return _domain;
            }
            _min = domain[0];
            _max = domain[domain.length - 1];
            _pos = [];
            var k = _colors.length;
            if (domain.length === k && _min !== _max) {
              for (var i2 = 0, list2 = Array.from(domain); i2 < list2.length; i2 += 1) {
                var d = list2[i2];
                _pos.push((d - _min) / (_max - _min));
              }
            } else {
              for (var c = 0; c < k; c++) {
                _pos.push(c / (k - 1));
              }
              if (domain.length > 2) {
                var tOut = domain.map(function(d2, i3) {
                  return i3 / (domain.length - 1);
                });
                var tBreaks = domain.map(function(d2) {
                  return (d2 - _min) / (_max - _min);
                });
                if (!tBreaks.every(function(val, i3) {
                  return tOut[i3] === val;
                })) {
                  tMapDomain = function(t) {
                    if (t <= 0 || t >= 1) {
                      return t;
                    }
                    var i3 = 0;
                    while (t >= tBreaks[i3 + 1]) {
                      i3++;
                    }
                    var f2 = (t - tBreaks[i3]) / (tBreaks[i3 + 1] - tBreaks[i3]);
                    var out = tOut[i3] + f2 * (tOut[i3 + 1] - tOut[i3]);
                    return out;
                  };
                }
              }
            }
            _domain = [_min, _max];
            return f;
          };
          f.mode = function(_m) {
            if (!arguments.length) {
              return _mode;
            }
            _mode = _m;
            resetCache();
            return f;
          };
          f.range = function(colors2, _pos2) {
            setColors(colors2, _pos2);
            return f;
          };
          f.out = function(_o) {
            _out = _o;
            return f;
          };
          f.spread = function(val) {
            if (!arguments.length) {
              return _spread;
            }
            _spread = val;
            return f;
          };
          f.correctLightness = function(v) {
            if (v == null) {
              v = true;
            }
            _correctLightness = v;
            resetCache();
            if (_correctLightness) {
              tMapLightness = function(t) {
                var L0 = getColor(0, true).lab()[0];
                var L1 = getColor(1, true).lab()[0];
                var pol = L0 > L1;
                var L_actual = getColor(t, true).lab()[0];
                var L_ideal = L0 + (L1 - L0) * t;
                var L_diff = L_actual - L_ideal;
                var t0 = 0;
                var t1 = 1;
                var max_iter = 20;
                while (Math.abs(L_diff) > 0.01 && max_iter-- > 0) {
                  (function() {
                    if (pol) {
                      L_diff *= -1;
                    }
                    if (L_diff < 0) {
                      t0 = t;
                      t += (t1 - t) * 0.5;
                    } else {
                      t1 = t;
                      t += (t0 - t) * 0.5;
                    }
                    L_actual = getColor(t, true).lab()[0];
                    return L_diff = L_actual - L_ideal;
                  })();
                }
                return t;
              };
            } else {
              tMapLightness = function(t) {
                return t;
              };
            }
            return f;
          };
          f.padding = function(p) {
            if (p != null) {
              if (type$j(p) === "number") {
                p = [p, p];
              }
              _padding = p;
              return f;
            } else {
              return _padding;
            }
          };
          f.colors = function(numColors, out) {
            if (arguments.length < 2) {
              out = "hex";
            }
            var result = [];
            if (arguments.length === 0) {
              result = _colors.slice(0);
            } else if (numColors === 1) {
              result = [f(0.5)];
            } else if (numColors > 1) {
              var dm = _domain[0];
              var dd = _domain[1] - dm;
              result = __range__(0, numColors, false).map(function(i3) {
                return f(dm + i3 / (numColors - 1) * dd);
              });
            } else {
              colors = [];
              var samples = [];
              if (_classes && _classes.length > 2) {
                for (var i2 = 1, end = _classes.length, asc = 1 <= end; asc ? i2 < end : i2 > end; asc ? i2++ : i2--) {
                  samples.push((_classes[i2 - 1] + _classes[i2]) * 0.5);
                }
              } else {
                samples = _domain;
              }
              result = samples.map(function(v) {
                return f(v);
              });
            }
            if (chroma_1[out]) {
              result = result.map(function(c) {
                return c[out]();
              });
            }
            return result;
          };
          f.cache = function(c) {
            if (c != null) {
              _useCache = c;
              return f;
            } else {
              return _useCache;
            }
          };
          f.gamma = function(g) {
            if (g != null) {
              _gamma = g;
              return f;
            } else {
              return _gamma;
            }
          };
          f.nodata = function(d) {
            if (d != null) {
              _nacol = chroma_1(d);
              return f;
            } else {
              return _nacol;
            }
          };
          return f;
        };
        function __range__(left, right, inclusive) {
          var range = [];
          var ascending = left < right;
          var end = !inclusive ? right : ascending ? right + 1 : right - 1;
          for (var i2 = left; ascending ? i2 < end : i2 > end; ascending ? i2++ : i2--) {
            range.push(i2);
          }
          return range;
        }
        var bezier = function(colors) {
          var assign2, assign$1, assign$2;
          var I, lab0, lab1, lab2;
          colors = colors.map(function(c) {
            return new Color_1(c);
          });
          if (colors.length === 2) {
            assign2 = colors.map(function(c) {
              return c.lab();
            }), lab0 = assign2[0], lab1 = assign2[1];
            I = function(t) {
              var lab = [0, 1, 2].map(function(i2) {
                return lab0[i2] + t * (lab1[i2] - lab0[i2]);
              });
              return new Color_1(lab, "lab");
            };
          } else if (colors.length === 3) {
            assign$1 = colors.map(function(c) {
              return c.lab();
            }), lab0 = assign$1[0], lab1 = assign$1[1], lab2 = assign$1[2];
            I = function(t) {
              var lab = [0, 1, 2].map(function(i2) {
                return (1 - t) * (1 - t) * lab0[i2] + 2 * (1 - t) * t * lab1[i2] + t * t * lab2[i2];
              });
              return new Color_1(lab, "lab");
            };
          } else if (colors.length === 4) {
            var lab3;
            assign$2 = colors.map(function(c) {
              return c.lab();
            }), lab0 = assign$2[0], lab1 = assign$2[1], lab2 = assign$2[2], lab3 = assign$2[3];
            I = function(t) {
              var lab = [0, 1, 2].map(function(i2) {
                return (1 - t) * (1 - t) * (1 - t) * lab0[i2] + 3 * (1 - t) * (1 - t) * t * lab1[i2] + 3 * (1 - t) * t * t * lab2[i2] + t * t * t * lab3[i2];
              });
              return new Color_1(lab, "lab");
            };
          } else if (colors.length === 5) {
            var I0 = bezier(colors.slice(0, 3));
            var I1 = bezier(colors.slice(2, 5));
            I = function(t) {
              if (t < 0.5) {
                return I0(t * 2);
              } else {
                return I1((t - 0.5) * 2);
              }
            };
          }
          return I;
        };
        var bezier_1 = function(colors) {
          var f = bezier(colors);
          f.scale = function() {
            return scale(f);
          };
          return f;
        };
        var blend = function(bottom, top, mode) {
          if (!blend[mode]) {
            throw new Error("unknown blend mode " + mode);
          }
          return blend[mode](bottom, top);
        };
        var blend_f = function(f) {
          return function(bottom, top) {
            var c0 = chroma_1(top).rgb();
            var c1 = chroma_1(bottom).rgb();
            return chroma_1.rgb(f(c0, c1));
          };
        };
        var each = function(f) {
          return function(c0, c1) {
            var out = [];
            out[0] = f(c0[0], c1[0]);
            out[1] = f(c0[1], c1[1]);
            out[2] = f(c0[2], c1[2]);
            return out;
          };
        };
        var normal = function(a) {
          return a;
        };
        var multiply = function(a, b) {
          return a * b / 255;
        };
        var darken$1 = function(a, b) {
          return a > b ? b : a;
        };
        var lighten = function(a, b) {
          return a > b ? a : b;
        };
        var screen = function(a, b) {
          return 255 * (1 - (1 - a / 255) * (1 - b / 255));
        };
        var overlay = function(a, b) {
          return b < 128 ? 2 * a * b / 255 : 255 * (1 - 2 * (1 - a / 255) * (1 - b / 255));
        };
        var burn = function(a, b) {
          return 255 * (1 - (1 - b / 255) / (a / 255));
        };
        var dodge = function(a, b) {
          if (a === 255) {
            return 255;
          }
          a = 255 * (b / 255) / (1 - a / 255);
          return a > 255 ? 255 : a;
        };
        blend.normal = blend_f(each(normal));
        blend.multiply = blend_f(each(multiply));
        blend.screen = blend_f(each(screen));
        blend.overlay = blend_f(each(overlay));
        blend.darken = blend_f(each(darken$1));
        blend.lighten = blend_f(each(lighten));
        blend.dodge = blend_f(each(dodge));
        blend.burn = blend_f(each(burn));
        var blend_1 = blend;
        var type$k = utils.type;
        var clip_rgb$3 = utils.clip_rgb;
        var TWOPI$2 = utils.TWOPI;
        var pow$6 = Math.pow;
        var sin$2 = Math.sin;
        var cos$3 = Math.cos;
        var cubehelix = function(start, rotations, hue, gamma, lightness) {
          if (start === void 0)
            start = 300;
          if (rotations === void 0)
            rotations = -1.5;
          if (hue === void 0)
            hue = 1;
          if (gamma === void 0)
            gamma = 1;
          if (lightness === void 0)
            lightness = [0, 1];
          var dh = 0, dl;
          if (type$k(lightness) === "array") {
            dl = lightness[1] - lightness[0];
          } else {
            dl = 0;
            lightness = [lightness, lightness];
          }
          var f = function(fract) {
            var a = TWOPI$2 * ((start + 120) / 360 + rotations * fract);
            var l = pow$6(lightness[0] + dl * fract, gamma);
            var h = dh !== 0 ? hue[0] + fract * dh : hue;
            var amp = h * l * (1 - l) / 2;
            var cos_a = cos$3(a);
            var sin_a = sin$2(a);
            var r = l + amp * (-0.14861 * cos_a + 1.78277 * sin_a);
            var g = l + amp * (-0.29227 * cos_a - 0.90649 * sin_a);
            var b = l + amp * (1.97294 * cos_a);
            return chroma_1(clip_rgb$3([r * 255, g * 255, b * 255, 1]));
          };
          f.start = function(s) {
            if (s == null) {
              return start;
            }
            start = s;
            return f;
          };
          f.rotations = function(r) {
            if (r == null) {
              return rotations;
            }
            rotations = r;
            return f;
          };
          f.gamma = function(g) {
            if (g == null) {
              return gamma;
            }
            gamma = g;
            return f;
          };
          f.hue = function(h) {
            if (h == null) {
              return hue;
            }
            hue = h;
            if (type$k(hue) === "array") {
              dh = hue[1] - hue[0];
              if (dh === 0) {
                hue = hue[1];
              }
            } else {
              dh = 0;
            }
            return f;
          };
          f.lightness = function(h) {
            if (h == null) {
              return lightness;
            }
            if (type$k(h) === "array") {
              lightness = h;
              dl = h[1] - h[0];
            } else {
              lightness = [h, h];
              dl = 0;
            }
            return f;
          };
          f.scale = function() {
            return chroma_1.scale(f);
          };
          f.hue(hue);
          return f;
        };
        var digits = "0123456789abcdef";
        var floor$2 = Math.floor;
        var random = Math.random;
        var random_1 = function() {
          var code = "#";
          for (var i2 = 0; i2 < 6; i2++) {
            code += digits.charAt(floor$2(random() * 16));
          }
          return new Color_1(code, "hex");
        };
        var log$1 = Math.log;
        var pow$7 = Math.pow;
        var floor$3 = Math.floor;
        var abs = Math.abs;
        var analyze2 = function(data3, key3) {
          if (key3 === void 0)
            key3 = null;
          var r = {
            min: Number.MAX_VALUE,
            max: Number.MAX_VALUE * -1,
            sum: 0,
            values: [],
            count: 0
          };
          if (type(data3) === "object") {
            data3 = Object.values(data3);
          }
          data3.forEach(function(val) {
            if (key3 && type(val) === "object") {
              val = val[key3];
            }
            if (val !== void 0 && val !== null && !isNaN(val)) {
              r.values.push(val);
              r.sum += val;
              if (val < r.min) {
                r.min = val;
              }
              if (val > r.max) {
                r.max = val;
              }
              r.count += 1;
            }
          });
          r.domain = [r.min, r.max];
          r.limits = function(mode, num) {
            return limits(r, mode, num);
          };
          return r;
        };
        var limits = function(data3, mode, num) {
          if (mode === void 0)
            mode = "equal";
          if (num === void 0)
            num = 7;
          if (type(data3) == "array") {
            data3 = analyze2(data3);
          }
          var min2 = data3.min;
          var max2 = data3.max;
          var values = data3.values.sort(function(a, b) {
            return a - b;
          });
          if (num === 1) {
            return [min2, max2];
          }
          var limits2 = [];
          if (mode.substr(0, 1) === "c") {
            limits2.push(min2);
            limits2.push(max2);
          }
          if (mode.substr(0, 1) === "e") {
            limits2.push(min2);
            for (var i2 = 1; i2 < num; i2++) {
              limits2.push(min2 + i2 / num * (max2 - min2));
            }
            limits2.push(max2);
          } else if (mode.substr(0, 1) === "l") {
            if (min2 <= 0) {
              throw new Error("Logarithmic scales are only possible for values > 0");
            }
            var min_log = Math.LOG10E * log$1(min2);
            var max_log = Math.LOG10E * log$1(max2);
            limits2.push(min2);
            for (var i$12 = 1; i$12 < num; i$12++) {
              limits2.push(pow$7(10, min_log + i$12 / num * (max_log - min_log)));
            }
            limits2.push(max2);
          } else if (mode.substr(0, 1) === "q") {
            limits2.push(min2);
            for (var i$2 = 1; i$2 < num; i$2++) {
              var p = (values.length - 1) * i$2 / num;
              var pb = floor$3(p);
              if (pb === p) {
                limits2.push(values[pb]);
              } else {
                var pr = p - pb;
                limits2.push(values[pb] * (1 - pr) + values[pb + 1] * pr);
              }
            }
            limits2.push(max2);
          } else if (mode.substr(0, 1) === "k") {
            var cluster;
            var n2 = values.length;
            var assignments = new Array(n2);
            var clusterSizes = new Array(num);
            var repeat = true;
            var nb_iters = 0;
            var centroids = null;
            centroids = [];
            centroids.push(min2);
            for (var i$3 = 1; i$3 < num; i$3++) {
              centroids.push(min2 + i$3 / num * (max2 - min2));
            }
            centroids.push(max2);
            while (repeat) {
              for (var j = 0; j < num; j++) {
                clusterSizes[j] = 0;
              }
              for (var i$4 = 0; i$4 < n2; i$4++) {
                var value = values[i$4];
                var mindist = Number.MAX_VALUE;
                var best = void 0;
                for (var j$1 = 0; j$1 < num; j$1++) {
                  var dist = abs(centroids[j$1] - value);
                  if (dist < mindist) {
                    mindist = dist;
                    best = j$1;
                  }
                  clusterSizes[best]++;
                  assignments[i$4] = best;
                }
              }
              var newCentroids = new Array(num);
              for (var j$2 = 0; j$2 < num; j$2++) {
                newCentroids[j$2] = null;
              }
              for (var i$5 = 0; i$5 < n2; i$5++) {
                cluster = assignments[i$5];
                if (newCentroids[cluster] === null) {
                  newCentroids[cluster] = values[i$5];
                } else {
                  newCentroids[cluster] += values[i$5];
                }
              }
              for (var j$3 = 0; j$3 < num; j$3++) {
                newCentroids[j$3] *= 1 / clusterSizes[j$3];
              }
              repeat = false;
              for (var j$4 = 0; j$4 < num; j$4++) {
                if (newCentroids[j$4] !== centroids[j$4]) {
                  repeat = true;
                  break;
                }
              }
              centroids = newCentroids;
              nb_iters++;
              if (nb_iters > 200) {
                repeat = false;
              }
            }
            var kClusters = {};
            for (var j$5 = 0; j$5 < num; j$5++) {
              kClusters[j$5] = [];
            }
            for (var i$6 = 0; i$6 < n2; i$6++) {
              cluster = assignments[i$6];
              kClusters[cluster].push(values[i$6]);
            }
            var tmpKMeansBreaks = [];
            for (var j$6 = 0; j$6 < num; j$6++) {
              tmpKMeansBreaks.push(kClusters[j$6][0]);
              tmpKMeansBreaks.push(kClusters[j$6][kClusters[j$6].length - 1]);
            }
            tmpKMeansBreaks = tmpKMeansBreaks.sort(function(a, b) {
              return a - b;
            });
            limits2.push(tmpKMeansBreaks[0]);
            for (var i$7 = 1; i$7 < tmpKMeansBreaks.length; i$7 += 2) {
              var v = tmpKMeansBreaks[i$7];
              if (!isNaN(v) && limits2.indexOf(v) === -1) {
                limits2.push(v);
              }
            }
          }
          return limits2;
        };
        var analyze_1 = { analyze: analyze2, limits };
        var contrast = function(a, b) {
          a = new Color_1(a);
          b = new Color_1(b);
          var l1 = a.luminance();
          var l2 = b.luminance();
          return l1 > l2 ? (l1 + 0.05) / (l2 + 0.05) : (l2 + 0.05) / (l1 + 0.05);
        };
        var sqrt$4 = Math.sqrt;
        var atan2$2 = Math.atan2;
        var abs$1 = Math.abs;
        var cos$4 = Math.cos;
        var PI$2 = Math.PI;
        var deltaE = function(a, b, L, C) {
          if (L === void 0)
            L = 1;
          if (C === void 0)
            C = 1;
          a = new Color_1(a);
          b = new Color_1(b);
          var ref2 = Array.from(a.lab());
          var L1 = ref2[0];
          var a1 = ref2[1];
          var b1 = ref2[2];
          var ref$1 = Array.from(b.lab());
          var L2 = ref$1[0];
          var a2 = ref$1[1];
          var b2 = ref$1[2];
          var c1 = sqrt$4(a1 * a1 + b1 * b1);
          var c2 = sqrt$4(a2 * a2 + b2 * b2);
          var sl = L1 < 16 ? 0.511 : 0.040975 * L1 / (1 + 0.01765 * L1);
          var sc = 0.0638 * c1 / (1 + 0.0131 * c1) + 0.638;
          var h1 = c1 < 1e-6 ? 0 : atan2$2(b1, a1) * 180 / PI$2;
          while (h1 < 0) {
            h1 += 360;
          }
          while (h1 >= 360) {
            h1 -= 360;
          }
          var t = h1 >= 164 && h1 <= 345 ? 0.56 + abs$1(0.2 * cos$4(PI$2 * (h1 + 168) / 180)) : 0.36 + abs$1(0.4 * cos$4(PI$2 * (h1 + 35) / 180));
          var c4 = c1 * c1 * c1 * c1;
          var f = sqrt$4(c4 / (c4 + 1900));
          var sh = sc * (f * t + 1 - f);
          var delL = L1 - L2;
          var delC = c1 - c2;
          var delA = a1 - a2;
          var delB = b1 - b2;
          var dH2 = delA * delA + delB * delB - delC * delC;
          var v1 = delL / (L * sl);
          var v2 = delC / (C * sc);
          var v3 = sh;
          return sqrt$4(v1 * v1 + v2 * v2 + dH2 / (v3 * v3));
        };
        var distance = function(a, b, mode) {
          if (mode === void 0)
            mode = "lab";
          a = new Color_1(a);
          b = new Color_1(b);
          var l1 = a.get(mode);
          var l2 = b.get(mode);
          var sum_sq = 0;
          for (var i2 in l1) {
            var d = (l1[i2] || 0) - (l2[i2] || 0);
            sum_sq += d * d;
          }
          return Math.sqrt(sum_sq);
        };
        var valid = function() {
          var args = [], len = arguments.length;
          while (len--)
            args[len] = arguments[len];
          try {
            new (Function.prototype.bind.apply(Color_1, [null].concat(args)))();
            return true;
          } catch (e) {
            return false;
          }
        };
        var scales = {
          cool: function cool() {
            return scale([chroma_1.hsl(180, 1, 0.9), chroma_1.hsl(250, 0.7, 0.4)]);
          },
          hot: function hot() {
            return scale(["#000", "#f00", "#ff0", "#fff"], [0, 0.25, 0.75, 1]).mode("rgb");
          }
        };
        var colorbrewer = {
          OrRd: ["#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84", "#fc8d59", "#ef6548", "#d7301f", "#b30000", "#7f0000"],
          PuBu: ["#fff7fb", "#ece7f2", "#d0d1e6", "#a6bddb", "#74a9cf", "#3690c0", "#0570b0", "#045a8d", "#023858"],
          BuPu: ["#f7fcfd", "#e0ecf4", "#bfd3e6", "#9ebcda", "#8c96c6", "#8c6bb1", "#88419d", "#810f7c", "#4d004b"],
          Oranges: ["#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", "#fd8d3c", "#f16913", "#d94801", "#a63603", "#7f2704"],
          BuGn: ["#f7fcfd", "#e5f5f9", "#ccece6", "#99d8c9", "#66c2a4", "#41ae76", "#238b45", "#006d2c", "#00441b"],
          YlOrBr: ["#ffffe5", "#fff7bc", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#cc4c02", "#993404", "#662506"],
          YlGn: ["#ffffe5", "#f7fcb9", "#d9f0a3", "#addd8e", "#78c679", "#41ab5d", "#238443", "#006837", "#004529"],
          Reds: ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#a50f15", "#67000d"],
          RdPu: ["#fff7f3", "#fde0dd", "#fcc5c0", "#fa9fb5", "#f768a1", "#dd3497", "#ae017e", "#7a0177", "#49006a"],
          Greens: ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#006d2c", "#00441b"],
          YlGnBu: ["#ffffd9", "#edf8b1", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#253494", "#081d58"],
          Purples: ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f", "#3f007d"],
          GnBu: ["#f7fcf0", "#e0f3db", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#0868ac", "#084081"],
          Greys: ["#ffffff", "#f0f0f0", "#d9d9d9", "#bdbdbd", "#969696", "#737373", "#525252", "#252525", "#000000"],
          YlOrRd: ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#bd0026", "#800026"],
          PuRd: ["#f7f4f9", "#e7e1ef", "#d4b9da", "#c994c7", "#df65b0", "#e7298a", "#ce1256", "#980043", "#67001f"],
          Blues: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"],
          PuBuGn: ["#fff7fb", "#ece2f0", "#d0d1e6", "#a6bddb", "#67a9cf", "#3690c0", "#02818a", "#016c59", "#014636"],
          Viridis: ["#440154", "#482777", "#3f4a8a", "#31678e", "#26838f", "#1f9d8a", "#6cce5a", "#b6de2b", "#fee825"],
          Spectral: ["#9e0142", "#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"],
          RdYlGn: ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"],
          RdBu: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061"],
          PiYG: ["#8e0152", "#c51b7d", "#de77ae", "#f1b6da", "#fde0ef", "#f7f7f7", "#e6f5d0", "#b8e186", "#7fbc41", "#4d9221", "#276419"],
          PRGn: ["#40004b", "#762a83", "#9970ab", "#c2a5cf", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#a6dba0", "#5aae61", "#1b7837", "#00441b"],
          RdYlBu: ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee090", "#ffffbf", "#e0f3f8", "#abd9e9", "#74add1", "#4575b4", "#313695"],
          BrBG: ["#543005", "#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#f5f5f5", "#c7eae5", "#80cdc1", "#35978f", "#01665e", "#003c30"],
          RdGy: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#ffffff", "#e0e0e0", "#bababa", "#878787", "#4d4d4d", "#1a1a1a"],
          PuOr: ["#7f3b08", "#b35806", "#e08214", "#fdb863", "#fee0b6", "#f7f7f7", "#d8daeb", "#b2abd2", "#8073ac", "#542788", "#2d004b"],
          Set2: ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3"],
          Accent: ["#7fc97f", "#beaed4", "#fdc086", "#ffff99", "#386cb0", "#f0027f", "#bf5b17", "#666666"],
          Set1: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628", "#f781bf", "#999999"],
          Set3: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#d9d9d9", "#bc80bd", "#ccebc5", "#ffed6f"],
          Dark2: ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#666666"],
          Paired: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a", "#ffff99", "#b15928"],
          Pastel2: ["#b3e2cd", "#fdcdac", "#cbd5e8", "#f4cae4", "#e6f5c9", "#fff2ae", "#f1e2cc", "#cccccc"],
          Pastel1: ["#fbb4ae", "#b3cde3", "#ccebc5", "#decbe4", "#fed9a6", "#ffffcc", "#e5d8bd", "#fddaec", "#f2f2f2"]
        };
        for (var i$1 = 0, list$1 = Object.keys(colorbrewer); i$1 < list$1.length; i$1 += 1) {
          var key2 = list$1[i$1];
          colorbrewer[key2.toLowerCase()] = colorbrewer[key2];
        }
        var colorbrewer_1 = colorbrewer;
        chroma_1.average = average;
        chroma_1.bezier = bezier_1;
        chroma_1.blend = blend_1;
        chroma_1.cubehelix = cubehelix;
        chroma_1.mix = chroma_1.interpolate = mix;
        chroma_1.random = random_1;
        chroma_1.scale = scale;
        chroma_1.analyze = analyze_1.analyze;
        chroma_1.contrast = contrast;
        chroma_1.deltaE = deltaE;
        chroma_1.distance = distance;
        chroma_1.limits = analyze_1.limits;
        chroma_1.valid = valid;
        chroma_1.scales = scales;
        chroma_1.colors = w3cx11_1;
        chroma_1.brewer = colorbrewer_1;
        var chroma_js = chroma_1;
        return chroma_js;
      });
    }
  });

  // node_modules/stackframe/stackframe.js
  var require_stackframe = __commonJS({
    "node_modules/stackframe/stackframe.js"(exports2, module2) {
      (function(root, factory) {
        "use strict";
        if (typeof define === "function" && define.amd) {
          define("stackframe", [], factory);
        } else if (typeof exports2 === "object") {
          module2.exports = factory();
        } else {
          root.StackFrame = factory();
        }
      })(exports2, function() {
        "use strict";
        function _isNumber(n2) {
          return !isNaN(parseFloat(n2)) && isFinite(n2);
        }
        function _capitalize(str) {
          return str.charAt(0).toUpperCase() + str.substring(1);
        }
        function _getter(p) {
          return function() {
            return this[p];
          };
        }
        var booleanProps = ["isConstructor", "isEval", "isNative", "isToplevel"];
        var numericProps = ["columnNumber", "lineNumber"];
        var stringProps = ["fileName", "functionName", "source"];
        var arrayProps = ["args"];
        var objectProps = ["evalOrigin"];
        var props = booleanProps.concat(numericProps, stringProps, arrayProps, objectProps);
        function StackFrame(obj) {
          if (!obj)
            return;
          for (var i2 = 0; i2 < props.length; i2++) {
            if (obj[props[i2]] !== void 0) {
              this["set" + _capitalize(props[i2])](obj[props[i2]]);
            }
          }
        }
        StackFrame.prototype = {
          getArgs: function() {
            return this.args;
          },
          setArgs: function(v) {
            if (Object.prototype.toString.call(v) !== "[object Array]") {
              throw new TypeError("Args must be an Array");
            }
            this.args = v;
          },
          getEvalOrigin: function() {
            return this.evalOrigin;
          },
          setEvalOrigin: function(v) {
            if (v instanceof StackFrame) {
              this.evalOrigin = v;
            } else if (v instanceof Object) {
              this.evalOrigin = new StackFrame(v);
            } else {
              throw new TypeError("Eval Origin must be an Object or StackFrame");
            }
          },
          toString: function() {
            var fileName = this.getFileName() || "";
            var lineNumber = this.getLineNumber() || "";
            var columnNumber = this.getColumnNumber() || "";
            var functionName = this.getFunctionName() || "";
            if (this.getIsEval()) {
              if (fileName) {
                return "[eval] (" + fileName + ":" + lineNumber + ":" + columnNumber + ")";
              }
              return "[eval]:" + lineNumber + ":" + columnNumber;
            }
            if (functionName) {
              return functionName + " (" + fileName + ":" + lineNumber + ":" + columnNumber + ")";
            }
            return fileName + ":" + lineNumber + ":" + columnNumber;
          }
        };
        StackFrame.fromString = function StackFrame$$fromString(str) {
          var argsStartIndex = str.indexOf("(");
          var argsEndIndex = str.lastIndexOf(")");
          var functionName = str.substring(0, argsStartIndex);
          var args = str.substring(argsStartIndex + 1, argsEndIndex).split(",");
          var locationString = str.substring(argsEndIndex + 1);
          if (locationString.indexOf("@") === 0) {
            var parts = /@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(locationString, "");
            var fileName = parts[1];
            var lineNumber = parts[2];
            var columnNumber = parts[3];
          }
          return new StackFrame({
            functionName,
            args: args || void 0,
            fileName,
            lineNumber: lineNumber || void 0,
            columnNumber: columnNumber || void 0
          });
        };
        for (var i = 0; i < booleanProps.length; i++) {
          StackFrame.prototype["get" + _capitalize(booleanProps[i])] = _getter(booleanProps[i]);
          StackFrame.prototype["set" + _capitalize(booleanProps[i])] = function(p) {
            return function(v) {
              this[p] = Boolean(v);
            };
          }(booleanProps[i]);
        }
        for (var j = 0; j < numericProps.length; j++) {
          StackFrame.prototype["get" + _capitalize(numericProps[j])] = _getter(numericProps[j]);
          StackFrame.prototype["set" + _capitalize(numericProps[j])] = function(p) {
            return function(v) {
              if (!_isNumber(v)) {
                throw new TypeError(p + " must be a Number");
              }
              this[p] = Number(v);
            };
          }(numericProps[j]);
        }
        for (var k = 0; k < stringProps.length; k++) {
          StackFrame.prototype["get" + _capitalize(stringProps[k])] = _getter(stringProps[k]);
          StackFrame.prototype["set" + _capitalize(stringProps[k])] = function(p) {
            return function(v) {
              this[p] = String(v);
            };
          }(stringProps[k]);
        }
        return StackFrame;
      });
    }
  });

  // node_modules/error-stack-parser/error-stack-parser.js
  var require_error_stack_parser = __commonJS({
    "node_modules/error-stack-parser/error-stack-parser.js"(exports2, module2) {
      (function(root, factory) {
        "use strict";
        if (typeof define === "function" && define.amd) {
          define("error-stack-parser", ["stackframe"], factory);
        } else if (typeof exports2 === "object") {
          module2.exports = factory(require_stackframe());
        } else {
          root.ErrorStackParser = factory(root.StackFrame);
        }
      })(exports2, function ErrorStackParser2(StackFrame) {
        "use strict";
        var FIREFOX_SAFARI_STACK_REGEXP = /(^|@)\S+:\d+/;
        var CHROME_IE_STACK_REGEXP = /^\s*at .*(\S+:\d+|\(native\))/m;
        var SAFARI_NATIVE_CODE_REGEXP = /^(eval@)?(\[native code])?$/;
        return {
          parse: function ErrorStackParser$$parse(error) {
            if (typeof error.stacktrace !== "undefined" || typeof error["opera#sourceloc"] !== "undefined") {
              return this.parseOpera(error);
            } else if (error.stack && error.stack.match(CHROME_IE_STACK_REGEXP)) {
              return this.parseV8OrIE(error);
            } else if (error.stack) {
              return this.parseFFOrSafari(error);
            } else {
              throw new Error("Cannot parse given Error object");
            }
          },
          extractLocation: function ErrorStackParser$$extractLocation(urlLike) {
            if (urlLike.indexOf(":") === -1) {
              return [urlLike];
            }
            var regExp = /(.+?)(?::(\d+))?(?::(\d+))?$/;
            var parts = regExp.exec(urlLike.replace(/[()]/g, ""));
            return [parts[1], parts[2] || void 0, parts[3] || void 0];
          },
          parseV8OrIE: function ErrorStackParser$$parseV8OrIE(error) {
            var filtered = error.stack.split("\n").filter(function(line) {
              return !!line.match(CHROME_IE_STACK_REGEXP);
            }, this);
            return filtered.map(function(line) {
              if (line.indexOf("(eval ") > -1) {
                line = line.replace(/eval code/g, "eval").replace(/(\(eval at [^()]*)|(\),.*$)/g, "");
              }
              var sanitizedLine = line.replace(/^\s+/, "").replace(/\(eval code/g, "(");
              var location = sanitizedLine.match(/ (\((.+):(\d+):(\d+)\)$)/);
              sanitizedLine = location ? sanitizedLine.replace(location[0], "") : sanitizedLine;
              var tokens = sanitizedLine.split(/\s+/).slice(1);
              var locationParts = this.extractLocation(location ? location[1] : tokens.pop());
              var functionName = tokens.join(" ") || void 0;
              var fileName = ["eval", "<anonymous>"].indexOf(locationParts[0]) > -1 ? void 0 : locationParts[0];
              return new StackFrame({
                functionName,
                fileName,
                lineNumber: locationParts[1],
                columnNumber: locationParts[2],
                source: line
              });
            }, this);
          },
          parseFFOrSafari: function ErrorStackParser$$parseFFOrSafari(error) {
            var filtered = error.stack.split("\n").filter(function(line) {
              return !line.match(SAFARI_NATIVE_CODE_REGEXP);
            }, this);
            return filtered.map(function(line) {
              if (line.indexOf(" > eval") > -1) {
                line = line.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g, ":$1");
              }
              if (line.indexOf("@") === -1 && line.indexOf(":") === -1) {
                return new StackFrame({
                  functionName: line
                });
              } else {
                var functionNameRegex = /((.*".+"[^@]*)?[^@]*)(?:@)/;
                var matches = line.match(functionNameRegex);
                var functionName = matches && matches[1] ? matches[1] : void 0;
                var locationParts = this.extractLocation(line.replace(functionNameRegex, ""));
                return new StackFrame({
                  functionName,
                  fileName: locationParts[0],
                  lineNumber: locationParts[1],
                  columnNumber: locationParts[2],
                  source: line
                });
              }
            }, this);
          },
          parseOpera: function ErrorStackParser$$parseOpera(e) {
            if (!e.stacktrace || e.message.indexOf("\n") > -1 && e.message.split("\n").length > e.stacktrace.split("\n").length) {
              return this.parseOpera9(e);
            } else if (!e.stack) {
              return this.parseOpera10(e);
            } else {
              return this.parseOpera11(e);
            }
          },
          parseOpera9: function ErrorStackParser$$parseOpera9(e) {
            var lineRE = /Line (\d+).*script (?:in )?(\S+)/i;
            var lines = e.message.split("\n");
            var result = [];
            for (var i = 2, len = lines.length; i < len; i += 2) {
              var match = lineRE.exec(lines[i]);
              if (match) {
                result.push(new StackFrame({
                  fileName: match[2],
                  lineNumber: match[1],
                  source: lines[i]
                }));
              }
            }
            return result;
          },
          parseOpera10: function ErrorStackParser$$parseOpera10(e) {
            var lineRE = /Line (\d+).*script (?:in )?(\S+)(?:: In function (\S+))?$/i;
            var lines = e.stacktrace.split("\n");
            var result = [];
            for (var i = 0, len = lines.length; i < len; i += 2) {
              var match = lineRE.exec(lines[i]);
              if (match) {
                result.push(new StackFrame({
                  functionName: match[3] || void 0,
                  fileName: match[2],
                  lineNumber: match[1],
                  source: lines[i]
                }));
              }
            }
            return result;
          },
          parseOpera11: function ErrorStackParser$$parseOpera11(error) {
            var filtered = error.stack.split("\n").filter(function(line) {
              return !!line.match(FIREFOX_SAFARI_STACK_REGEXP) && !line.match(/^Error created at/);
            }, this);
            return filtered.map(function(line) {
              var tokens = line.split("@");
              var locationParts = this.extractLocation(tokens.pop());
              var functionCall = tokens.shift() || "";
              var functionName = functionCall.replace(/<anonymous function(: (\w+))?>/, "$2").replace(/\([^)]*\)/g, "") || void 0;
              var argsRaw;
              if (functionCall.match(/\(([^)]*)\)/)) {
                argsRaw = functionCall.replace(/^[^(]+\(([^)]*)\)$/, "$1");
              }
              var args = argsRaw === void 0 || argsRaw === "[arguments not available]" ? void 0 : argsRaw.split(",");
              return new StackFrame({
                functionName,
                args,
                fileName: locationParts[0],
                lineNumber: locationParts[1],
                columnNumber: locationParts[2],
                source: line
              });
            }, this);
          }
        };
      });
    }
  });

  // node_modules/localforage/dist/localforage.js
  var require_localforage = __commonJS({
    "node_modules/localforage/dist/localforage.js"(exports2, module2) {
      (function(f) {
        if (typeof exports2 === "object" && typeof module2 !== "undefined") {
          module2.exports = f();
        } else if (typeof define === "function" && define.amd) {
          define([], f);
        } else {
          var g;
          if (typeof window !== "undefined") {
            g = window;
          } else if (typeof global !== "undefined") {
            g = global;
          } else if (typeof self !== "undefined") {
            g = self;
          } else {
            g = this;
          }
          g.localforage = f();
        }
      })(function() {
        var define2, module3, exports3;
        return function e(t, n2, r) {
          function s(o2, u) {
            if (!n2[o2]) {
              if (!t[o2]) {
                var a = typeof __require == "function" && __require;
                if (!u && a)
                  return a(o2, true);
                if (i)
                  return i(o2, true);
                var f = new Error("Cannot find module '" + o2 + "'");
                throw f.code = "MODULE_NOT_FOUND", f;
              }
              var l = n2[o2] = { exports: {} };
              t[o2][0].call(l.exports, function(e2) {
                var n3 = t[o2][1][e2];
                return s(n3 ? n3 : e2);
              }, l, l.exports, e, t, n2, r);
            }
            return n2[o2].exports;
          }
          var i = typeof __require == "function" && __require;
          for (var o = 0; o < r.length; o++)
            s(r[o]);
          return s;
        }({ 1: [function(_dereq_, module4, exports4) {
          (function(global2) {
            "use strict";
            var Mutation = global2.MutationObserver || global2.WebKitMutationObserver;
            var scheduleDrain;
            {
              if (Mutation) {
                var called = 0;
                var observer = new Mutation(nextTick);
                var element = global2.document.createTextNode("");
                observer.observe(element, {
                  characterData: true
                });
                scheduleDrain = function() {
                  element.data = called = ++called % 2;
                };
              } else if (!global2.setImmediate && typeof global2.MessageChannel !== "undefined") {
                var channel = new global2.MessageChannel();
                channel.port1.onmessage = nextTick;
                scheduleDrain = function() {
                  channel.port2.postMessage(0);
                };
              } else if ("document" in global2 && "onreadystatechange" in global2.document.createElement("script")) {
                scheduleDrain = function() {
                  var scriptEl = global2.document.createElement("script");
                  scriptEl.onreadystatechange = function() {
                    nextTick();
                    scriptEl.onreadystatechange = null;
                    scriptEl.parentNode.removeChild(scriptEl);
                    scriptEl = null;
                  };
                  global2.document.documentElement.appendChild(scriptEl);
                };
              } else {
                scheduleDrain = function() {
                  setTimeout(nextTick, 0);
                };
              }
            }
            var draining;
            var queue = [];
            function nextTick() {
              draining = true;
              var i, oldQueue;
              var len = queue.length;
              while (len) {
                oldQueue = queue;
                queue = [];
                i = -1;
                while (++i < len) {
                  oldQueue[i]();
                }
                len = queue.length;
              }
              draining = false;
            }
            module4.exports = immediate;
            function immediate(task) {
              if (queue.push(task) === 1 && !draining) {
                scheduleDrain();
              }
            }
          }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
        }, {}], 2: [function(_dereq_, module4, exports4) {
          "use strict";
          var immediate = _dereq_(1);
          function INTERNAL() {
          }
          var handlers = {};
          var REJECTED = ["REJECTED"];
          var FULFILLED = ["FULFILLED"];
          var PENDING = ["PENDING"];
          module4.exports = Promise2;
          function Promise2(resolver) {
            if (typeof resolver !== "function") {
              throw new TypeError("resolver must be a function");
            }
            this.state = PENDING;
            this.queue = [];
            this.outcome = void 0;
            if (resolver !== INTERNAL) {
              safelyResolveThenable(this, resolver);
            }
          }
          Promise2.prototype["catch"] = function(onRejected) {
            return this.then(null, onRejected);
          };
          Promise2.prototype.then = function(onFulfilled, onRejected) {
            if (typeof onFulfilled !== "function" && this.state === FULFILLED || typeof onRejected !== "function" && this.state === REJECTED) {
              return this;
            }
            var promise = new this.constructor(INTERNAL);
            if (this.state !== PENDING) {
              var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
              unwrap(promise, resolver, this.outcome);
            } else {
              this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
            }
            return promise;
          };
          function QueueItem(promise, onFulfilled, onRejected) {
            this.promise = promise;
            if (typeof onFulfilled === "function") {
              this.onFulfilled = onFulfilled;
              this.callFulfilled = this.otherCallFulfilled;
            }
            if (typeof onRejected === "function") {
              this.onRejected = onRejected;
              this.callRejected = this.otherCallRejected;
            }
          }
          QueueItem.prototype.callFulfilled = function(value) {
            handlers.resolve(this.promise, value);
          };
          QueueItem.prototype.otherCallFulfilled = function(value) {
            unwrap(this.promise, this.onFulfilled, value);
          };
          QueueItem.prototype.callRejected = function(value) {
            handlers.reject(this.promise, value);
          };
          QueueItem.prototype.otherCallRejected = function(value) {
            unwrap(this.promise, this.onRejected, value);
          };
          function unwrap(promise, func, value) {
            immediate(function() {
              var returnValue;
              try {
                returnValue = func(value);
              } catch (e) {
                return handlers.reject(promise, e);
              }
              if (returnValue === promise) {
                handlers.reject(promise, new TypeError("Cannot resolve promise with itself"));
              } else {
                handlers.resolve(promise, returnValue);
              }
            });
          }
          handlers.resolve = function(self2, value) {
            var result = tryCatch(getThen, value);
            if (result.status === "error") {
              return handlers.reject(self2, result.value);
            }
            var thenable = result.value;
            if (thenable) {
              safelyResolveThenable(self2, thenable);
            } else {
              self2.state = FULFILLED;
              self2.outcome = value;
              var i = -1;
              var len = self2.queue.length;
              while (++i < len) {
                self2.queue[i].callFulfilled(value);
              }
            }
            return self2;
          };
          handlers.reject = function(self2, error) {
            self2.state = REJECTED;
            self2.outcome = error;
            var i = -1;
            var len = self2.queue.length;
            while (++i < len) {
              self2.queue[i].callRejected(error);
            }
            return self2;
          };
          function getThen(obj) {
            var then = obj && obj.then;
            if (obj && (typeof obj === "object" || typeof obj === "function") && typeof then === "function") {
              return function appyThen() {
                then.apply(obj, arguments);
              };
            }
          }
          function safelyResolveThenable(self2, thenable) {
            var called = false;
            function onError(value) {
              if (called) {
                return;
              }
              called = true;
              handlers.reject(self2, value);
            }
            function onSuccess(value) {
              if (called) {
                return;
              }
              called = true;
              handlers.resolve(self2, value);
            }
            function tryToUnwrap() {
              thenable(onSuccess, onError);
            }
            var result = tryCatch(tryToUnwrap);
            if (result.status === "error") {
              onError(result.value);
            }
          }
          function tryCatch(func, value) {
            var out = {};
            try {
              out.value = func(value);
              out.status = "success";
            } catch (e) {
              out.status = "error";
              out.value = e;
            }
            return out;
          }
          Promise2.resolve = resolve;
          function resolve(value) {
            if (value instanceof this) {
              return value;
            }
            return handlers.resolve(new this(INTERNAL), value);
          }
          Promise2.reject = reject;
          function reject(reason) {
            var promise = new this(INTERNAL);
            return handlers.reject(promise, reason);
          }
          Promise2.all = all;
          function all(iterable) {
            var self2 = this;
            if (Object.prototype.toString.call(iterable) !== "[object Array]") {
              return this.reject(new TypeError("must be an array"));
            }
            var len = iterable.length;
            var called = false;
            if (!len) {
              return this.resolve([]);
            }
            var values = new Array(len);
            var resolved = 0;
            var i = -1;
            var promise = new this(INTERNAL);
            while (++i < len) {
              allResolver(iterable[i], i);
            }
            return promise;
            function allResolver(value, i2) {
              self2.resolve(value).then(resolveFromAll, function(error) {
                if (!called) {
                  called = true;
                  handlers.reject(promise, error);
                }
              });
              function resolveFromAll(outValue) {
                values[i2] = outValue;
                if (++resolved === len && !called) {
                  called = true;
                  handlers.resolve(promise, values);
                }
              }
            }
          }
          Promise2.race = race;
          function race(iterable) {
            var self2 = this;
            if (Object.prototype.toString.call(iterable) !== "[object Array]") {
              return this.reject(new TypeError("must be an array"));
            }
            var len = iterable.length;
            var called = false;
            if (!len) {
              return this.resolve([]);
            }
            var i = -1;
            var promise = new this(INTERNAL);
            while (++i < len) {
              resolver(iterable[i]);
            }
            return promise;
            function resolver(value) {
              self2.resolve(value).then(function(response) {
                if (!called) {
                  called = true;
                  handlers.resolve(promise, response);
                }
              }, function(error) {
                if (!called) {
                  called = true;
                  handlers.reject(promise, error);
                }
              });
            }
          }
        }, { "1": 1 }], 3: [function(_dereq_, module4, exports4) {
          (function(global2) {
            "use strict";
            if (typeof global2.Promise !== "function") {
              global2.Promise = _dereq_(2);
            }
          }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
        }, { "2": 2 }], 4: [function(_dereq_, module4, exports4) {
          "use strict";
          var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function(obj) {
            return typeof obj;
          } : function(obj) {
            return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
          };
          function _classCallCheck(instance, Constructor) {
            if (!(instance instanceof Constructor)) {
              throw new TypeError("Cannot call a class as a function");
            }
          }
          function getIDB() {
            try {
              if (typeof indexedDB !== "undefined") {
                return indexedDB;
              }
              if (typeof webkitIndexedDB !== "undefined") {
                return webkitIndexedDB;
              }
              if (typeof mozIndexedDB !== "undefined") {
                return mozIndexedDB;
              }
              if (typeof OIndexedDB !== "undefined") {
                return OIndexedDB;
              }
              if (typeof msIndexedDB !== "undefined") {
                return msIndexedDB;
              }
            } catch (e) {
              return;
            }
          }
          var idb = getIDB();
          function isIndexedDBValid() {
            try {
              if (!idb || !idb.open) {
                return false;
              }
              var isSafari = typeof openDatabase !== "undefined" && /(Safari|iPhone|iPad|iPod)/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) && !/BlackBerry/.test(navigator.platform);
              var hasFetch = typeof fetch === "function" && fetch.toString().indexOf("[native code") !== -1;
              return (!isSafari || hasFetch) && typeof indexedDB !== "undefined" && typeof IDBKeyRange !== "undefined";
            } catch (e) {
              return false;
            }
          }
          function createBlob(parts, properties) {
            parts = parts || [];
            properties = properties || {};
            try {
              return new Blob(parts, properties);
            } catch (e) {
              if (e.name !== "TypeError") {
                throw e;
              }
              var Builder2 = typeof BlobBuilder !== "undefined" ? BlobBuilder : typeof MSBlobBuilder !== "undefined" ? MSBlobBuilder : typeof MozBlobBuilder !== "undefined" ? MozBlobBuilder : WebKitBlobBuilder;
              var builder2 = new Builder2();
              for (var i = 0; i < parts.length; i += 1) {
                builder2.append(parts[i]);
              }
              return builder2.getBlob(properties.type);
            }
          }
          if (typeof Promise === "undefined") {
            _dereq_(3);
          }
          var Promise$1 = Promise;
          function executeCallback(promise, callback) {
            if (callback) {
              promise.then(function(result) {
                callback(null, result);
              }, function(error) {
                callback(error);
              });
            }
          }
          function executeTwoCallbacks(promise, callback, errorCallback) {
            if (typeof callback === "function") {
              promise.then(callback);
            }
            if (typeof errorCallback === "function") {
              promise["catch"](errorCallback);
            }
          }
          function normalizeKey(key3) {
            if (typeof key3 !== "string") {
              console.warn(key3 + " used as a key, but it is not a string.");
              key3 = String(key3);
            }
            return key3;
          }
          function getCallback() {
            if (arguments.length && typeof arguments[arguments.length - 1] === "function") {
              return arguments[arguments.length - 1];
            }
          }
          var DETECT_BLOB_SUPPORT_STORE = "local-forage-detect-blob-support";
          var supportsBlobs = void 0;
          var dbContexts = {};
          var toString8 = Object.prototype.toString;
          var READ_ONLY = "readonly";
          var READ_WRITE = "readwrite";
          function _binStringToArrayBuffer(bin) {
            var length4 = bin.length;
            var buf = new ArrayBuffer(length4);
            var arr = new Uint8Array(buf);
            for (var i = 0; i < length4; i++) {
              arr[i] = bin.charCodeAt(i);
            }
            return buf;
          }
          function _checkBlobSupportWithoutCaching(idb2) {
            return new Promise$1(function(resolve) {
              var txn = idb2.transaction(DETECT_BLOB_SUPPORT_STORE, READ_WRITE);
              var blob = createBlob([""]);
              txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, "key");
              txn.onabort = function(e) {
                e.preventDefault();
                e.stopPropagation();
                resolve(false);
              };
              txn.oncomplete = function() {
                var matchedChrome = navigator.userAgent.match(/Chrome\/(\d+)/);
                var matchedEdge = navigator.userAgent.match(/Edge\//);
                resolve(matchedEdge || !matchedChrome || parseInt(matchedChrome[1], 10) >= 43);
              };
            })["catch"](function() {
              return false;
            });
          }
          function _checkBlobSupport(idb2) {
            if (typeof supportsBlobs === "boolean") {
              return Promise$1.resolve(supportsBlobs);
            }
            return _checkBlobSupportWithoutCaching(idb2).then(function(value) {
              supportsBlobs = value;
              return supportsBlobs;
            });
          }
          function _deferReadiness(dbInfo) {
            var dbContext = dbContexts[dbInfo.name];
            var deferredOperation = {};
            deferredOperation.promise = new Promise$1(function(resolve, reject) {
              deferredOperation.resolve = resolve;
              deferredOperation.reject = reject;
            });
            dbContext.deferredOperations.push(deferredOperation);
            if (!dbContext.dbReady) {
              dbContext.dbReady = deferredOperation.promise;
            } else {
              dbContext.dbReady = dbContext.dbReady.then(function() {
                return deferredOperation.promise;
              });
            }
          }
          function _advanceReadiness(dbInfo) {
            var dbContext = dbContexts[dbInfo.name];
            var deferredOperation = dbContext.deferredOperations.pop();
            if (deferredOperation) {
              deferredOperation.resolve();
              return deferredOperation.promise;
            }
          }
          function _rejectReadiness(dbInfo, err2) {
            var dbContext = dbContexts[dbInfo.name];
            var deferredOperation = dbContext.deferredOperations.pop();
            if (deferredOperation) {
              deferredOperation.reject(err2);
              return deferredOperation.promise;
            }
          }
          function _getConnection(dbInfo, upgradeNeeded) {
            return new Promise$1(function(resolve, reject) {
              dbContexts[dbInfo.name] = dbContexts[dbInfo.name] || createDbContext();
              if (dbInfo.db) {
                if (upgradeNeeded) {
                  _deferReadiness(dbInfo);
                  dbInfo.db.close();
                } else {
                  return resolve(dbInfo.db);
                }
              }
              var dbArgs = [dbInfo.name];
              if (upgradeNeeded) {
                dbArgs.push(dbInfo.version);
              }
              var openreq = idb.open.apply(idb, dbArgs);
              if (upgradeNeeded) {
                openreq.onupgradeneeded = function(e) {
                  var db = openreq.result;
                  try {
                    db.createObjectStore(dbInfo.storeName);
                    if (e.oldVersion <= 1) {
                      db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);
                    }
                  } catch (ex) {
                    if (ex.name === "ConstraintError") {
                      console.warn('The database "' + dbInfo.name + '" has been upgraded from version ' + e.oldVersion + " to version " + e.newVersion + ', but the storage "' + dbInfo.storeName + '" already exists.');
                    } else {
                      throw ex;
                    }
                  }
                };
              }
              openreq.onerror = function(e) {
                e.preventDefault();
                reject(openreq.error);
              };
              openreq.onsuccess = function() {
                var db = openreq.result;
                db.onversionchange = function(e) {
                  e.target.close();
                };
                resolve(db);
                _advanceReadiness(dbInfo);
              };
            });
          }
          function _getOriginalConnection(dbInfo) {
            return _getConnection(dbInfo, false);
          }
          function _getUpgradedConnection(dbInfo) {
            return _getConnection(dbInfo, true);
          }
          function _isUpgradeNeeded(dbInfo, defaultVersion) {
            if (!dbInfo.db) {
              return true;
            }
            var isNewStore = !dbInfo.db.objectStoreNames.contains(dbInfo.storeName);
            var isDowngrade = dbInfo.version < dbInfo.db.version;
            var isUpgrade = dbInfo.version > dbInfo.db.version;
            if (isDowngrade) {
              if (dbInfo.version !== defaultVersion) {
                console.warn('The database "' + dbInfo.name + `" can't be downgraded from version ` + dbInfo.db.version + " to version " + dbInfo.version + ".");
              }
              dbInfo.version = dbInfo.db.version;
            }
            if (isUpgrade || isNewStore) {
              if (isNewStore) {
                var incVersion = dbInfo.db.version + 1;
                if (incVersion > dbInfo.version) {
                  dbInfo.version = incVersion;
                }
              }
              return true;
            }
            return false;
          }
          function _encodeBlob(blob) {
            return new Promise$1(function(resolve, reject) {
              var reader = new FileReader();
              reader.onerror = reject;
              reader.onloadend = function(e) {
                var base64 = btoa(e.target.result || "");
                resolve({
                  __local_forage_encoded_blob: true,
                  data: base64,
                  type: blob.type
                });
              };
              reader.readAsBinaryString(blob);
            });
          }
          function _decodeBlob(encodedBlob) {
            var arrayBuff = _binStringToArrayBuffer(atob(encodedBlob.data));
            return createBlob([arrayBuff], { type: encodedBlob.type });
          }
          function _isEncodedBlob(value) {
            return value && value.__local_forage_encoded_blob;
          }
          function _fullyReady(callback) {
            var self2 = this;
            var promise = self2._initReady().then(function() {
              var dbContext = dbContexts[self2._dbInfo.name];
              if (dbContext && dbContext.dbReady) {
                return dbContext.dbReady;
              }
            });
            executeTwoCallbacks(promise, callback, callback);
            return promise;
          }
          function _tryReconnect(dbInfo) {
            _deferReadiness(dbInfo);
            var dbContext = dbContexts[dbInfo.name];
            var forages = dbContext.forages;
            for (var i = 0; i < forages.length; i++) {
              var forage = forages[i];
              if (forage._dbInfo.db) {
                forage._dbInfo.db.close();
                forage._dbInfo.db = null;
              }
            }
            dbInfo.db = null;
            return _getOriginalConnection(dbInfo).then(function(db) {
              dbInfo.db = db;
              if (_isUpgradeNeeded(dbInfo)) {
                return _getUpgradedConnection(dbInfo);
              }
              return db;
            }).then(function(db) {
              dbInfo.db = dbContext.db = db;
              for (var i2 = 0; i2 < forages.length; i2++) {
                forages[i2]._dbInfo.db = db;
              }
            })["catch"](function(err2) {
              _rejectReadiness(dbInfo, err2);
              throw err2;
            });
          }
          function createTransaction(dbInfo, mode, callback, retries) {
            if (retries === void 0) {
              retries = 1;
            }
            try {
              var tx = dbInfo.db.transaction(dbInfo.storeName, mode);
              callback(null, tx);
            } catch (err2) {
              if (retries > 0 && (!dbInfo.db || err2.name === "InvalidStateError" || err2.name === "NotFoundError")) {
                return Promise$1.resolve().then(function() {
                  if (!dbInfo.db || err2.name === "NotFoundError" && !dbInfo.db.objectStoreNames.contains(dbInfo.storeName) && dbInfo.version <= dbInfo.db.version) {
                    if (dbInfo.db) {
                      dbInfo.version = dbInfo.db.version + 1;
                    }
                    return _getUpgradedConnection(dbInfo);
                  }
                }).then(function() {
                  return _tryReconnect(dbInfo).then(function() {
                    createTransaction(dbInfo, mode, callback, retries - 1);
                  });
                })["catch"](callback);
              }
              callback(err2);
            }
          }
          function createDbContext() {
            return {
              forages: [],
              db: null,
              dbReady: null,
              deferredOperations: []
            };
          }
          function _initStorage(options) {
            var self2 = this;
            var dbInfo = {
              db: null
            };
            if (options) {
              for (var i in options) {
                dbInfo[i] = options[i];
              }
            }
            var dbContext = dbContexts[dbInfo.name];
            if (!dbContext) {
              dbContext = createDbContext();
              dbContexts[dbInfo.name] = dbContext;
            }
            dbContext.forages.push(self2);
            if (!self2._initReady) {
              self2._initReady = self2.ready;
              self2.ready = _fullyReady;
            }
            var initPromises = [];
            function ignoreErrors() {
              return Promise$1.resolve();
            }
            for (var j = 0; j < dbContext.forages.length; j++) {
              var forage = dbContext.forages[j];
              if (forage !== self2) {
                initPromises.push(forage._initReady()["catch"](ignoreErrors));
              }
            }
            var forages = dbContext.forages.slice(0);
            return Promise$1.all(initPromises).then(function() {
              dbInfo.db = dbContext.db;
              return _getOriginalConnection(dbInfo);
            }).then(function(db) {
              dbInfo.db = db;
              if (_isUpgradeNeeded(dbInfo, self2._defaultConfig.version)) {
                return _getUpgradedConnection(dbInfo);
              }
              return db;
            }).then(function(db) {
              dbInfo.db = dbContext.db = db;
              self2._dbInfo = dbInfo;
              for (var k = 0; k < forages.length; k++) {
                var forage2 = forages[k];
                if (forage2 !== self2) {
                  forage2._dbInfo.db = dbInfo.db;
                  forage2._dbInfo.version = dbInfo.version;
                }
              }
            });
          }
          function getItem(key3, callback) {
            var self2 = this;
            key3 = normalizeKey(key3);
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                createTransaction(self2._dbInfo, READ_ONLY, function(err2, transaction) {
                  if (err2) {
                    return reject(err2);
                  }
                  try {
                    var store2 = transaction.objectStore(self2._dbInfo.storeName);
                    var req = store2.get(key3);
                    req.onsuccess = function() {
                      var value = req.result;
                      if (value === void 0) {
                        value = null;
                      }
                      if (_isEncodedBlob(value)) {
                        value = _decodeBlob(value);
                      }
                      resolve(value);
                    };
                    req.onerror = function() {
                      reject(req.error);
                    };
                  } catch (e) {
                    reject(e);
                  }
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function iterate(iterator, callback) {
            var self2 = this;
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                createTransaction(self2._dbInfo, READ_ONLY, function(err2, transaction) {
                  if (err2) {
                    return reject(err2);
                  }
                  try {
                    var store2 = transaction.objectStore(self2._dbInfo.storeName);
                    var req = store2.openCursor();
                    var iterationNumber = 1;
                    req.onsuccess = function() {
                      var cursor = req.result;
                      if (cursor) {
                        var value = cursor.value;
                        if (_isEncodedBlob(value)) {
                          value = _decodeBlob(value);
                        }
                        var result = iterator(value, cursor.key, iterationNumber++);
                        if (result !== void 0) {
                          resolve(result);
                        } else {
                          cursor["continue"]();
                        }
                      } else {
                        resolve();
                      }
                    };
                    req.onerror = function() {
                      reject(req.error);
                    };
                  } catch (e) {
                    reject(e);
                  }
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function setItem(key3, value, callback) {
            var self2 = this;
            key3 = normalizeKey(key3);
            var promise = new Promise$1(function(resolve, reject) {
              var dbInfo;
              self2.ready().then(function() {
                dbInfo = self2._dbInfo;
                if (toString8.call(value) === "[object Blob]") {
                  return _checkBlobSupport(dbInfo.db).then(function(blobSupport) {
                    if (blobSupport) {
                      return value;
                    }
                    return _encodeBlob(value);
                  });
                }
                return value;
              }).then(function(value2) {
                createTransaction(self2._dbInfo, READ_WRITE, function(err2, transaction) {
                  if (err2) {
                    return reject(err2);
                  }
                  try {
                    var store2 = transaction.objectStore(self2._dbInfo.storeName);
                    if (value2 === null) {
                      value2 = void 0;
                    }
                    var req = store2.put(value2, key3);
                    transaction.oncomplete = function() {
                      if (value2 === void 0) {
                        value2 = null;
                      }
                      resolve(value2);
                    };
                    transaction.onabort = transaction.onerror = function() {
                      var err3 = req.error ? req.error : req.transaction.error;
                      reject(err3);
                    };
                  } catch (e) {
                    reject(e);
                  }
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function removeItem(key3, callback) {
            var self2 = this;
            key3 = normalizeKey(key3);
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                createTransaction(self2._dbInfo, READ_WRITE, function(err2, transaction) {
                  if (err2) {
                    return reject(err2);
                  }
                  try {
                    var store2 = transaction.objectStore(self2._dbInfo.storeName);
                    var req = store2["delete"](key3);
                    transaction.oncomplete = function() {
                      resolve();
                    };
                    transaction.onerror = function() {
                      reject(req.error);
                    };
                    transaction.onabort = function() {
                      var err3 = req.error ? req.error : req.transaction.error;
                      reject(err3);
                    };
                  } catch (e) {
                    reject(e);
                  }
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function clear(callback) {
            var self2 = this;
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                createTransaction(self2._dbInfo, READ_WRITE, function(err2, transaction) {
                  if (err2) {
                    return reject(err2);
                  }
                  try {
                    var store2 = transaction.objectStore(self2._dbInfo.storeName);
                    var req = store2.clear();
                    transaction.oncomplete = function() {
                      resolve();
                    };
                    transaction.onabort = transaction.onerror = function() {
                      var err3 = req.error ? req.error : req.transaction.error;
                      reject(err3);
                    };
                  } catch (e) {
                    reject(e);
                  }
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function length3(callback) {
            var self2 = this;
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                createTransaction(self2._dbInfo, READ_ONLY, function(err2, transaction) {
                  if (err2) {
                    return reject(err2);
                  }
                  try {
                    var store2 = transaction.objectStore(self2._dbInfo.storeName);
                    var req = store2.count();
                    req.onsuccess = function() {
                      resolve(req.result);
                    };
                    req.onerror = function() {
                      reject(req.error);
                    };
                  } catch (e) {
                    reject(e);
                  }
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function key2(n2, callback) {
            var self2 = this;
            var promise = new Promise$1(function(resolve, reject) {
              if (n2 < 0) {
                resolve(null);
                return;
              }
              self2.ready().then(function() {
                createTransaction(self2._dbInfo, READ_ONLY, function(err2, transaction) {
                  if (err2) {
                    return reject(err2);
                  }
                  try {
                    var store2 = transaction.objectStore(self2._dbInfo.storeName);
                    var advanced = false;
                    var req = store2.openKeyCursor();
                    req.onsuccess = function() {
                      var cursor = req.result;
                      if (!cursor) {
                        resolve(null);
                        return;
                      }
                      if (n2 === 0) {
                        resolve(cursor.key);
                      } else {
                        if (!advanced) {
                          advanced = true;
                          cursor.advance(n2);
                        } else {
                          resolve(cursor.key);
                        }
                      }
                    };
                    req.onerror = function() {
                      reject(req.error);
                    };
                  } catch (e) {
                    reject(e);
                  }
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function keys(callback) {
            var self2 = this;
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                createTransaction(self2._dbInfo, READ_ONLY, function(err2, transaction) {
                  if (err2) {
                    return reject(err2);
                  }
                  try {
                    var store2 = transaction.objectStore(self2._dbInfo.storeName);
                    var req = store2.openKeyCursor();
                    var keys2 = [];
                    req.onsuccess = function() {
                      var cursor = req.result;
                      if (!cursor) {
                        resolve(keys2);
                        return;
                      }
                      keys2.push(cursor.key);
                      cursor["continue"]();
                    };
                    req.onerror = function() {
                      reject(req.error);
                    };
                  } catch (e) {
                    reject(e);
                  }
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function dropInstance(options, callback) {
            callback = getCallback.apply(this, arguments);
            var currentConfig = this.config();
            options = typeof options !== "function" && options || {};
            if (!options.name) {
              options.name = options.name || currentConfig.name;
              options.storeName = options.storeName || currentConfig.storeName;
            }
            var self2 = this;
            var promise;
            if (!options.name) {
              promise = Promise$1.reject("Invalid arguments");
            } else {
              var isCurrentDb = options.name === currentConfig.name && self2._dbInfo.db;
              var dbPromise = isCurrentDb ? Promise$1.resolve(self2._dbInfo.db) : _getOriginalConnection(options).then(function(db) {
                var dbContext = dbContexts[options.name];
                var forages = dbContext.forages;
                dbContext.db = db;
                for (var i = 0; i < forages.length; i++) {
                  forages[i]._dbInfo.db = db;
                }
                return db;
              });
              if (!options.storeName) {
                promise = dbPromise.then(function(db) {
                  _deferReadiness(options);
                  var dbContext = dbContexts[options.name];
                  var forages = dbContext.forages;
                  db.close();
                  for (var i = 0; i < forages.length; i++) {
                    var forage = forages[i];
                    forage._dbInfo.db = null;
                  }
                  var dropDBPromise = new Promise$1(function(resolve, reject) {
                    var req = idb.deleteDatabase(options.name);
                    req.onerror = function() {
                      var db2 = req.result;
                      if (db2) {
                        db2.close();
                      }
                      reject(req.error);
                    };
                    req.onblocked = function() {
                      console.warn('dropInstance blocked for database "' + options.name + '" until all open connections are closed');
                    };
                    req.onsuccess = function() {
                      var db2 = req.result;
                      if (db2) {
                        db2.close();
                      }
                      resolve(db2);
                    };
                  });
                  return dropDBPromise.then(function(db2) {
                    dbContext.db = db2;
                    for (var i2 = 0; i2 < forages.length; i2++) {
                      var _forage = forages[i2];
                      _advanceReadiness(_forage._dbInfo);
                    }
                  })["catch"](function(err2) {
                    (_rejectReadiness(options, err2) || Promise$1.resolve())["catch"](function() {
                    });
                    throw err2;
                  });
                });
              } else {
                promise = dbPromise.then(function(db) {
                  if (!db.objectStoreNames.contains(options.storeName)) {
                    return;
                  }
                  var newVersion = db.version + 1;
                  _deferReadiness(options);
                  var dbContext = dbContexts[options.name];
                  var forages = dbContext.forages;
                  db.close();
                  for (var i = 0; i < forages.length; i++) {
                    var forage = forages[i];
                    forage._dbInfo.db = null;
                    forage._dbInfo.version = newVersion;
                  }
                  var dropObjectPromise = new Promise$1(function(resolve, reject) {
                    var req = idb.open(options.name, newVersion);
                    req.onerror = function(err2) {
                      var db2 = req.result;
                      db2.close();
                      reject(err2);
                    };
                    req.onupgradeneeded = function() {
                      var db2 = req.result;
                      db2.deleteObjectStore(options.storeName);
                    };
                    req.onsuccess = function() {
                      var db2 = req.result;
                      db2.close();
                      resolve(db2);
                    };
                  });
                  return dropObjectPromise.then(function(db2) {
                    dbContext.db = db2;
                    for (var j = 0; j < forages.length; j++) {
                      var _forage2 = forages[j];
                      _forage2._dbInfo.db = db2;
                      _advanceReadiness(_forage2._dbInfo);
                    }
                  })["catch"](function(err2) {
                    (_rejectReadiness(options, err2) || Promise$1.resolve())["catch"](function() {
                    });
                    throw err2;
                  });
                });
              }
            }
            executeCallback(promise, callback);
            return promise;
          }
          var asyncStorage = {
            _driver: "asyncStorage",
            _initStorage,
            _support: isIndexedDBValid(),
            iterate,
            getItem,
            setItem,
            removeItem,
            clear,
            length: length3,
            key: key2,
            keys,
            dropInstance
          };
          function isWebSQLValid() {
            return typeof openDatabase === "function";
          }
          var BASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
          var BLOB_TYPE_PREFIX = "~~local_forage_type~";
          var BLOB_TYPE_PREFIX_REGEX = /^~~local_forage_type~([^~]+)~/;
          var SERIALIZED_MARKER = "__lfsc__:";
          var SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;
          var TYPE_ARRAYBUFFER = "arbf";
          var TYPE_BLOB = "blob";
          var TYPE_INT8ARRAY = "si08";
          var TYPE_UINT8ARRAY = "ui08";
          var TYPE_UINT8CLAMPEDARRAY = "uic8";
          var TYPE_INT16ARRAY = "si16";
          var TYPE_INT32ARRAY = "si32";
          var TYPE_UINT16ARRAY = "ur16";
          var TYPE_UINT32ARRAY = "ui32";
          var TYPE_FLOAT32ARRAY = "fl32";
          var TYPE_FLOAT64ARRAY = "fl64";
          var TYPE_SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER_LENGTH + TYPE_ARRAYBUFFER.length;
          var toString$12 = Object.prototype.toString;
          function stringToBuffer(serializedString) {
            var bufferLength = serializedString.length * 0.75;
            var len = serializedString.length;
            var i;
            var p = 0;
            var encoded1, encoded2, encoded3, encoded4;
            if (serializedString[serializedString.length - 1] === "=") {
              bufferLength--;
              if (serializedString[serializedString.length - 2] === "=") {
                bufferLength--;
              }
            }
            var buffer = new ArrayBuffer(bufferLength);
            var bytes = new Uint8Array(buffer);
            for (i = 0; i < len; i += 4) {
              encoded1 = BASE_CHARS.indexOf(serializedString[i]);
              encoded2 = BASE_CHARS.indexOf(serializedString[i + 1]);
              encoded3 = BASE_CHARS.indexOf(serializedString[i + 2]);
              encoded4 = BASE_CHARS.indexOf(serializedString[i + 3]);
              bytes[p++] = encoded1 << 2 | encoded2 >> 4;
              bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
              bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
            }
            return buffer;
          }
          function bufferToString(buffer) {
            var bytes = new Uint8Array(buffer);
            var base64String = "";
            var i;
            for (i = 0; i < bytes.length; i += 3) {
              base64String += BASE_CHARS[bytes[i] >> 2];
              base64String += BASE_CHARS[(bytes[i] & 3) << 4 | bytes[i + 1] >> 4];
              base64String += BASE_CHARS[(bytes[i + 1] & 15) << 2 | bytes[i + 2] >> 6];
              base64String += BASE_CHARS[bytes[i + 2] & 63];
            }
            if (bytes.length % 3 === 2) {
              base64String = base64String.substring(0, base64String.length - 1) + "=";
            } else if (bytes.length % 3 === 1) {
              base64String = base64String.substring(0, base64String.length - 2) + "==";
            }
            return base64String;
          }
          function serialize(value, callback) {
            var valueType = "";
            if (value) {
              valueType = toString$12.call(value);
            }
            if (value && (valueType === "[object ArrayBuffer]" || value.buffer && toString$12.call(value.buffer) === "[object ArrayBuffer]")) {
              var buffer;
              var marker = SERIALIZED_MARKER;
              if (value instanceof ArrayBuffer) {
                buffer = value;
                marker += TYPE_ARRAYBUFFER;
              } else {
                buffer = value.buffer;
                if (valueType === "[object Int8Array]") {
                  marker += TYPE_INT8ARRAY;
                } else if (valueType === "[object Uint8Array]") {
                  marker += TYPE_UINT8ARRAY;
                } else if (valueType === "[object Uint8ClampedArray]") {
                  marker += TYPE_UINT8CLAMPEDARRAY;
                } else if (valueType === "[object Int16Array]") {
                  marker += TYPE_INT16ARRAY;
                } else if (valueType === "[object Uint16Array]") {
                  marker += TYPE_UINT16ARRAY;
                } else if (valueType === "[object Int32Array]") {
                  marker += TYPE_INT32ARRAY;
                } else if (valueType === "[object Uint32Array]") {
                  marker += TYPE_UINT32ARRAY;
                } else if (valueType === "[object Float32Array]") {
                  marker += TYPE_FLOAT32ARRAY;
                } else if (valueType === "[object Float64Array]") {
                  marker += TYPE_FLOAT64ARRAY;
                } else {
                  callback(new Error("Failed to get type for BinaryArray"));
                }
              }
              callback(marker + bufferToString(buffer));
            } else if (valueType === "[object Blob]") {
              var fileReader = new FileReader();
              fileReader.onload = function() {
                var str = BLOB_TYPE_PREFIX + value.type + "~" + bufferToString(this.result);
                callback(SERIALIZED_MARKER + TYPE_BLOB + str);
              };
              fileReader.readAsArrayBuffer(value);
            } else {
              try {
                callback(JSON.stringify(value));
              } catch (e) {
                console.error("Couldn't convert value into a JSON string: ", value);
                callback(null, e);
              }
            }
          }
          function deserialize(value) {
            if (value.substring(0, SERIALIZED_MARKER_LENGTH) !== SERIALIZED_MARKER) {
              return JSON.parse(value);
            }
            var serializedString = value.substring(TYPE_SERIALIZED_MARKER_LENGTH);
            var type = value.substring(SERIALIZED_MARKER_LENGTH, TYPE_SERIALIZED_MARKER_LENGTH);
            var blobType;
            if (type === TYPE_BLOB && BLOB_TYPE_PREFIX_REGEX.test(serializedString)) {
              var matcher = serializedString.match(BLOB_TYPE_PREFIX_REGEX);
              blobType = matcher[1];
              serializedString = serializedString.substring(matcher[0].length);
            }
            var buffer = stringToBuffer(serializedString);
            switch (type) {
              case TYPE_ARRAYBUFFER:
                return buffer;
              case TYPE_BLOB:
                return createBlob([buffer], { type: blobType });
              case TYPE_INT8ARRAY:
                return new Int8Array(buffer);
              case TYPE_UINT8ARRAY:
                return new Uint8Array(buffer);
              case TYPE_UINT8CLAMPEDARRAY:
                return new Uint8ClampedArray(buffer);
              case TYPE_INT16ARRAY:
                return new Int16Array(buffer);
              case TYPE_UINT16ARRAY:
                return new Uint16Array(buffer);
              case TYPE_INT32ARRAY:
                return new Int32Array(buffer);
              case TYPE_UINT32ARRAY:
                return new Uint32Array(buffer);
              case TYPE_FLOAT32ARRAY:
                return new Float32Array(buffer);
              case TYPE_FLOAT64ARRAY:
                return new Float64Array(buffer);
              default:
                throw new Error("Unkown type: " + type);
            }
          }
          var localforageSerializer = {
            serialize,
            deserialize,
            stringToBuffer,
            bufferToString
          };
          function createDbTable(t, dbInfo, callback, errorCallback) {
            t.executeSql("CREATE TABLE IF NOT EXISTS " + dbInfo.storeName + " (id INTEGER PRIMARY KEY, key unique, value)", [], callback, errorCallback);
          }
          function _initStorage$1(options) {
            var self2 = this;
            var dbInfo = {
              db: null
            };
            if (options) {
              for (var i in options) {
                dbInfo[i] = typeof options[i] !== "string" ? options[i].toString() : options[i];
              }
            }
            var dbInfoPromise = new Promise$1(function(resolve, reject) {
              try {
                dbInfo.db = openDatabase(dbInfo.name, String(dbInfo.version), dbInfo.description, dbInfo.size);
              } catch (e) {
                return reject(e);
              }
              dbInfo.db.transaction(function(t) {
                createDbTable(t, dbInfo, function() {
                  self2._dbInfo = dbInfo;
                  resolve();
                }, function(t2, error) {
                  reject(error);
                });
              }, reject);
            });
            dbInfo.serializer = localforageSerializer;
            return dbInfoPromise;
          }
          function tryExecuteSql(t, dbInfo, sqlStatement, args, callback, errorCallback) {
            t.executeSql(sqlStatement, args, callback, function(t2, error) {
              if (error.code === error.SYNTAX_ERR) {
                t2.executeSql("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [dbInfo.storeName], function(t3, results) {
                  if (!results.rows.length) {
                    createDbTable(t3, dbInfo, function() {
                      t3.executeSql(sqlStatement, args, callback, errorCallback);
                    }, errorCallback);
                  } else {
                    errorCallback(t3, error);
                  }
                }, errorCallback);
              } else {
                errorCallback(t2, error);
              }
            }, errorCallback);
          }
          function getItem$1(key3, callback) {
            var self2 = this;
            key3 = normalizeKey(key3);
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                var dbInfo = self2._dbInfo;
                dbInfo.db.transaction(function(t) {
                  tryExecuteSql(t, dbInfo, "SELECT * FROM " + dbInfo.storeName + " WHERE key = ? LIMIT 1", [key3], function(t2, results) {
                    var result = results.rows.length ? results.rows.item(0).value : null;
                    if (result) {
                      result = dbInfo.serializer.deserialize(result);
                    }
                    resolve(result);
                  }, function(t2, error) {
                    reject(error);
                  });
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function iterate$1(iterator, callback) {
            var self2 = this;
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                var dbInfo = self2._dbInfo;
                dbInfo.db.transaction(function(t) {
                  tryExecuteSql(t, dbInfo, "SELECT * FROM " + dbInfo.storeName, [], function(t2, results) {
                    var rows = results.rows;
                    var length4 = rows.length;
                    for (var i = 0; i < length4; i++) {
                      var item = rows.item(i);
                      var result = item.value;
                      if (result) {
                        result = dbInfo.serializer.deserialize(result);
                      }
                      result = iterator(result, item.key, i + 1);
                      if (result !== void 0) {
                        resolve(result);
                        return;
                      }
                    }
                    resolve();
                  }, function(t2, error) {
                    reject(error);
                  });
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function _setItem(key3, value, callback, retriesLeft) {
            var self2 = this;
            key3 = normalizeKey(key3);
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                if (value === void 0) {
                  value = null;
                }
                var originalValue = value;
                var dbInfo = self2._dbInfo;
                dbInfo.serializer.serialize(value, function(value2, error) {
                  if (error) {
                    reject(error);
                  } else {
                    dbInfo.db.transaction(function(t) {
                      tryExecuteSql(t, dbInfo, "INSERT OR REPLACE INTO " + dbInfo.storeName + " (key, value) VALUES (?, ?)", [key3, value2], function() {
                        resolve(originalValue);
                      }, function(t2, error2) {
                        reject(error2);
                      });
                    }, function(sqlError) {
                      if (sqlError.code === sqlError.QUOTA_ERR) {
                        if (retriesLeft > 0) {
                          resolve(_setItem.apply(self2, [key3, originalValue, callback, retriesLeft - 1]));
                          return;
                        }
                        reject(sqlError);
                      }
                    });
                  }
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function setItem$1(key3, value, callback) {
            return _setItem.apply(this, [key3, value, callback, 1]);
          }
          function removeItem$1(key3, callback) {
            var self2 = this;
            key3 = normalizeKey(key3);
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                var dbInfo = self2._dbInfo;
                dbInfo.db.transaction(function(t) {
                  tryExecuteSql(t, dbInfo, "DELETE FROM " + dbInfo.storeName + " WHERE key = ?", [key3], function() {
                    resolve();
                  }, function(t2, error) {
                    reject(error);
                  });
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function clear$1(callback) {
            var self2 = this;
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                var dbInfo = self2._dbInfo;
                dbInfo.db.transaction(function(t) {
                  tryExecuteSql(t, dbInfo, "DELETE FROM " + dbInfo.storeName, [], function() {
                    resolve();
                  }, function(t2, error) {
                    reject(error);
                  });
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function length$1(callback) {
            var self2 = this;
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                var dbInfo = self2._dbInfo;
                dbInfo.db.transaction(function(t) {
                  tryExecuteSql(t, dbInfo, "SELECT COUNT(key) as c FROM " + dbInfo.storeName, [], function(t2, results) {
                    var result = results.rows.item(0).c;
                    resolve(result);
                  }, function(t2, error) {
                    reject(error);
                  });
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function key$1(n2, callback) {
            var self2 = this;
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                var dbInfo = self2._dbInfo;
                dbInfo.db.transaction(function(t) {
                  tryExecuteSql(t, dbInfo, "SELECT key FROM " + dbInfo.storeName + " WHERE id = ? LIMIT 1", [n2 + 1], function(t2, results) {
                    var result = results.rows.length ? results.rows.item(0).key : null;
                    resolve(result);
                  }, function(t2, error) {
                    reject(error);
                  });
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function keys$1(callback) {
            var self2 = this;
            var promise = new Promise$1(function(resolve, reject) {
              self2.ready().then(function() {
                var dbInfo = self2._dbInfo;
                dbInfo.db.transaction(function(t) {
                  tryExecuteSql(t, dbInfo, "SELECT key FROM " + dbInfo.storeName, [], function(t2, results) {
                    var keys2 = [];
                    for (var i = 0; i < results.rows.length; i++) {
                      keys2.push(results.rows.item(i).key);
                    }
                    resolve(keys2);
                  }, function(t2, error) {
                    reject(error);
                  });
                });
              })["catch"](reject);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function getAllStoreNames(db) {
            return new Promise$1(function(resolve, reject) {
              db.transaction(function(t) {
                t.executeSql("SELECT name FROM sqlite_master WHERE type='table' AND name <> '__WebKitDatabaseInfoTable__'", [], function(t2, results) {
                  var storeNames = [];
                  for (var i = 0; i < results.rows.length; i++) {
                    storeNames.push(results.rows.item(i).name);
                  }
                  resolve({
                    db,
                    storeNames
                  });
                }, function(t2, error) {
                  reject(error);
                });
              }, function(sqlError) {
                reject(sqlError);
              });
            });
          }
          function dropInstance$1(options, callback) {
            callback = getCallback.apply(this, arguments);
            var currentConfig = this.config();
            options = typeof options !== "function" && options || {};
            if (!options.name) {
              options.name = options.name || currentConfig.name;
              options.storeName = options.storeName || currentConfig.storeName;
            }
            var self2 = this;
            var promise;
            if (!options.name) {
              promise = Promise$1.reject("Invalid arguments");
            } else {
              promise = new Promise$1(function(resolve) {
                var db;
                if (options.name === currentConfig.name) {
                  db = self2._dbInfo.db;
                } else {
                  db = openDatabase(options.name, "", "", 0);
                }
                if (!options.storeName) {
                  resolve(getAllStoreNames(db));
                } else {
                  resolve({
                    db,
                    storeNames: [options.storeName]
                  });
                }
              }).then(function(operationInfo) {
                return new Promise$1(function(resolve, reject) {
                  operationInfo.db.transaction(function(t) {
                    function dropTable(storeName) {
                      return new Promise$1(function(resolve2, reject2) {
                        t.executeSql("DROP TABLE IF EXISTS " + storeName, [], function() {
                          resolve2();
                        }, function(t2, error) {
                          reject2(error);
                        });
                      });
                    }
                    var operations = [];
                    for (var i = 0, len = operationInfo.storeNames.length; i < len; i++) {
                      operations.push(dropTable(operationInfo.storeNames[i]));
                    }
                    Promise$1.all(operations).then(function() {
                      resolve();
                    })["catch"](function(e) {
                      reject(e);
                    });
                  }, function(sqlError) {
                    reject(sqlError);
                  });
                });
              });
            }
            executeCallback(promise, callback);
            return promise;
          }
          var webSQLStorage = {
            _driver: "webSQLStorage",
            _initStorage: _initStorage$1,
            _support: isWebSQLValid(),
            iterate: iterate$1,
            getItem: getItem$1,
            setItem: setItem$1,
            removeItem: removeItem$1,
            clear: clear$1,
            length: length$1,
            key: key$1,
            keys: keys$1,
            dropInstance: dropInstance$1
          };
          function isLocalStorageValid() {
            try {
              return typeof localStorage !== "undefined" && "setItem" in localStorage && !!localStorage.setItem;
            } catch (e) {
              return false;
            }
          }
          function _getKeyPrefix(options, defaultConfig) {
            var keyPrefix = options.name + "/";
            if (options.storeName !== defaultConfig.storeName) {
              keyPrefix += options.storeName + "/";
            }
            return keyPrefix;
          }
          function checkIfLocalStorageThrows() {
            var localStorageTestKey = "_localforage_support_test";
            try {
              localStorage.setItem(localStorageTestKey, true);
              localStorage.removeItem(localStorageTestKey);
              return false;
            } catch (e) {
              return true;
            }
          }
          function _isLocalStorageUsable() {
            return !checkIfLocalStorageThrows() || localStorage.length > 0;
          }
          function _initStorage$2(options) {
            var self2 = this;
            var dbInfo = {};
            if (options) {
              for (var i in options) {
                dbInfo[i] = options[i];
              }
            }
            dbInfo.keyPrefix = _getKeyPrefix(options, self2._defaultConfig);
            if (!_isLocalStorageUsable()) {
              return Promise$1.reject();
            }
            self2._dbInfo = dbInfo;
            dbInfo.serializer = localforageSerializer;
            return Promise$1.resolve();
          }
          function clear$2(callback) {
            var self2 = this;
            var promise = self2.ready().then(function() {
              var keyPrefix = self2._dbInfo.keyPrefix;
              for (var i = localStorage.length - 1; i >= 0; i--) {
                var key3 = localStorage.key(i);
                if (key3.indexOf(keyPrefix) === 0) {
                  localStorage.removeItem(key3);
                }
              }
            });
            executeCallback(promise, callback);
            return promise;
          }
          function getItem$2(key3, callback) {
            var self2 = this;
            key3 = normalizeKey(key3);
            var promise = self2.ready().then(function() {
              var dbInfo = self2._dbInfo;
              var result = localStorage.getItem(dbInfo.keyPrefix + key3);
              if (result) {
                result = dbInfo.serializer.deserialize(result);
              }
              return result;
            });
            executeCallback(promise, callback);
            return promise;
          }
          function iterate$2(iterator, callback) {
            var self2 = this;
            var promise = self2.ready().then(function() {
              var dbInfo = self2._dbInfo;
              var keyPrefix = dbInfo.keyPrefix;
              var keyPrefixLength = keyPrefix.length;
              var length4 = localStorage.length;
              var iterationNumber = 1;
              for (var i = 0; i < length4; i++) {
                var key3 = localStorage.key(i);
                if (key3.indexOf(keyPrefix) !== 0) {
                  continue;
                }
                var value = localStorage.getItem(key3);
                if (value) {
                  value = dbInfo.serializer.deserialize(value);
                }
                value = iterator(value, key3.substring(keyPrefixLength), iterationNumber++);
                if (value !== void 0) {
                  return value;
                }
              }
            });
            executeCallback(promise, callback);
            return promise;
          }
          function key$2(n2, callback) {
            var self2 = this;
            var promise = self2.ready().then(function() {
              var dbInfo = self2._dbInfo;
              var result;
              try {
                result = localStorage.key(n2);
              } catch (error) {
                result = null;
              }
              if (result) {
                result = result.substring(dbInfo.keyPrefix.length);
              }
              return result;
            });
            executeCallback(promise, callback);
            return promise;
          }
          function keys$2(callback) {
            var self2 = this;
            var promise = self2.ready().then(function() {
              var dbInfo = self2._dbInfo;
              var length4 = localStorage.length;
              var keys2 = [];
              for (var i = 0; i < length4; i++) {
                var itemKey = localStorage.key(i);
                if (itemKey.indexOf(dbInfo.keyPrefix) === 0) {
                  keys2.push(itemKey.substring(dbInfo.keyPrefix.length));
                }
              }
              return keys2;
            });
            executeCallback(promise, callback);
            return promise;
          }
          function length$2(callback) {
            var self2 = this;
            var promise = self2.keys().then(function(keys2) {
              return keys2.length;
            });
            executeCallback(promise, callback);
            return promise;
          }
          function removeItem$2(key3, callback) {
            var self2 = this;
            key3 = normalizeKey(key3);
            var promise = self2.ready().then(function() {
              var dbInfo = self2._dbInfo;
              localStorage.removeItem(dbInfo.keyPrefix + key3);
            });
            executeCallback(promise, callback);
            return promise;
          }
          function setItem$2(key3, value, callback) {
            var self2 = this;
            key3 = normalizeKey(key3);
            var promise = self2.ready().then(function() {
              if (value === void 0) {
                value = null;
              }
              var originalValue = value;
              return new Promise$1(function(resolve, reject) {
                var dbInfo = self2._dbInfo;
                dbInfo.serializer.serialize(value, function(value2, error) {
                  if (error) {
                    reject(error);
                  } else {
                    try {
                      localStorage.setItem(dbInfo.keyPrefix + key3, value2);
                      resolve(originalValue);
                    } catch (e) {
                      if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") {
                        reject(e);
                      }
                      reject(e);
                    }
                  }
                });
              });
            });
            executeCallback(promise, callback);
            return promise;
          }
          function dropInstance$2(options, callback) {
            callback = getCallback.apply(this, arguments);
            options = typeof options !== "function" && options || {};
            if (!options.name) {
              var currentConfig = this.config();
              options.name = options.name || currentConfig.name;
              options.storeName = options.storeName || currentConfig.storeName;
            }
            var self2 = this;
            var promise;
            if (!options.name) {
              promise = Promise$1.reject("Invalid arguments");
            } else {
              promise = new Promise$1(function(resolve) {
                if (!options.storeName) {
                  resolve(options.name + "/");
                } else {
                  resolve(_getKeyPrefix(options, self2._defaultConfig));
                }
              }).then(function(keyPrefix) {
                for (var i = localStorage.length - 1; i >= 0; i--) {
                  var key3 = localStorage.key(i);
                  if (key3.indexOf(keyPrefix) === 0) {
                    localStorage.removeItem(key3);
                  }
                }
              });
            }
            executeCallback(promise, callback);
            return promise;
          }
          var localStorageWrapper = {
            _driver: "localStorageWrapper",
            _initStorage: _initStorage$2,
            _support: isLocalStorageValid(),
            iterate: iterate$2,
            getItem: getItem$2,
            setItem: setItem$2,
            removeItem: removeItem$2,
            clear: clear$2,
            length: length$2,
            key: key$2,
            keys: keys$2,
            dropInstance: dropInstance$2
          };
          var sameValue = function sameValue2(x, y) {
            return x === y || typeof x === "number" && typeof y === "number" && isNaN(x) && isNaN(y);
          };
          var includes = function includes2(array, searchElement) {
            var len = array.length;
            var i = 0;
            while (i < len) {
              if (sameValue(array[i], searchElement)) {
                return true;
              }
              i++;
            }
            return false;
          };
          var isArray3 = Array.isArray || function(arg) {
            return Object.prototype.toString.call(arg) === "[object Array]";
          };
          var DefinedDrivers = {};
          var DriverSupport = {};
          var DefaultDrivers = {
            INDEXEDDB: asyncStorage,
            WEBSQL: webSQLStorage,
            LOCALSTORAGE: localStorageWrapper
          };
          var DefaultDriverOrder = [DefaultDrivers.INDEXEDDB._driver, DefaultDrivers.WEBSQL._driver, DefaultDrivers.LOCALSTORAGE._driver];
          var OptionalDriverMethods = ["dropInstance"];
          var LibraryMethods = ["clear", "getItem", "iterate", "key", "keys", "length", "removeItem", "setItem"].concat(OptionalDriverMethods);
          var DefaultConfig = {
            description: "",
            driver: DefaultDriverOrder.slice(),
            name: "localforage",
            size: 4980736,
            storeName: "keyvaluepairs",
            version: 1
          };
          function callWhenReady(localForageInstance, libraryMethod) {
            localForageInstance[libraryMethod] = function() {
              var _args = arguments;
              return localForageInstance.ready().then(function() {
                return localForageInstance[libraryMethod].apply(localForageInstance, _args);
              });
            };
          }
          function extend2() {
            for (var i = 1; i < arguments.length; i++) {
              var arg = arguments[i];
              if (arg) {
                for (var _key in arg) {
                  if (arg.hasOwnProperty(_key)) {
                    if (isArray3(arg[_key])) {
                      arguments[0][_key] = arg[_key].slice();
                    } else {
                      arguments[0][_key] = arg[_key];
                    }
                  }
                }
              }
            }
            return arguments[0];
          }
          var LocalForage = function() {
            function LocalForage2(options) {
              _classCallCheck(this, LocalForage2);
              for (var driverTypeKey in DefaultDrivers) {
                if (DefaultDrivers.hasOwnProperty(driverTypeKey)) {
                  var driver = DefaultDrivers[driverTypeKey];
                  var driverName = driver._driver;
                  this[driverTypeKey] = driverName;
                  if (!DefinedDrivers[driverName]) {
                    this.defineDriver(driver);
                  }
                }
              }
              this._defaultConfig = extend2({}, DefaultConfig);
              this._config = extend2({}, this._defaultConfig, options);
              this._driverSet = null;
              this._initDriver = null;
              this._ready = false;
              this._dbInfo = null;
              this._wrapLibraryMethodsWithReady();
              this.setDriver(this._config.driver)["catch"](function() {
              });
            }
            LocalForage2.prototype.config = function config(options) {
              if ((typeof options === "undefined" ? "undefined" : _typeof(options)) === "object") {
                if (this._ready) {
                  return new Error("Can't call config() after localforage has been used.");
                }
                for (var i in options) {
                  if (i === "storeName") {
                    options[i] = options[i].replace(/\W/g, "_");
                  }
                  if (i === "version" && typeof options[i] !== "number") {
                    return new Error("Database version must be a number.");
                  }
                  this._config[i] = options[i];
                }
                if ("driver" in options && options.driver) {
                  return this.setDriver(this._config.driver);
                }
                return true;
              } else if (typeof options === "string") {
                return this._config[options];
              } else {
                return this._config;
              }
            };
            LocalForage2.prototype.defineDriver = function defineDriver(driverObject, callback, errorCallback) {
              var promise = new Promise$1(function(resolve, reject) {
                try {
                  var driverName = driverObject._driver;
                  var complianceError = new Error("Custom driver not compliant; see https://mozilla.github.io/localForage/#definedriver");
                  if (!driverObject._driver) {
                    reject(complianceError);
                    return;
                  }
                  var driverMethods = LibraryMethods.concat("_initStorage");
                  for (var i = 0, len = driverMethods.length; i < len; i++) {
                    var driverMethodName = driverMethods[i];
                    var isRequired = !includes(OptionalDriverMethods, driverMethodName);
                    if ((isRequired || driverObject[driverMethodName]) && typeof driverObject[driverMethodName] !== "function") {
                      reject(complianceError);
                      return;
                    }
                  }
                  var configureMissingMethods = function configureMissingMethods2() {
                    var methodNotImplementedFactory = function methodNotImplementedFactory2(methodName) {
                      return function() {
                        var error = new Error("Method " + methodName + " is not implemented by the current driver");
                        var promise2 = Promise$1.reject(error);
                        executeCallback(promise2, arguments[arguments.length - 1]);
                        return promise2;
                      };
                    };
                    for (var _i = 0, _len = OptionalDriverMethods.length; _i < _len; _i++) {
                      var optionalDriverMethod = OptionalDriverMethods[_i];
                      if (!driverObject[optionalDriverMethod]) {
                        driverObject[optionalDriverMethod] = methodNotImplementedFactory(optionalDriverMethod);
                      }
                    }
                  };
                  configureMissingMethods();
                  var setDriverSupport = function setDriverSupport2(support) {
                    if (DefinedDrivers[driverName]) {
                      console.info("Redefining LocalForage driver: " + driverName);
                    }
                    DefinedDrivers[driverName] = driverObject;
                    DriverSupport[driverName] = support;
                    resolve();
                  };
                  if ("_support" in driverObject) {
                    if (driverObject._support && typeof driverObject._support === "function") {
                      driverObject._support().then(setDriverSupport, reject);
                    } else {
                      setDriverSupport(!!driverObject._support);
                    }
                  } else {
                    setDriverSupport(true);
                  }
                } catch (e) {
                  reject(e);
                }
              });
              executeTwoCallbacks(promise, callback, errorCallback);
              return promise;
            };
            LocalForage2.prototype.driver = function driver() {
              return this._driver || null;
            };
            LocalForage2.prototype.getDriver = function getDriver(driverName, callback, errorCallback) {
              var getDriverPromise = DefinedDrivers[driverName] ? Promise$1.resolve(DefinedDrivers[driverName]) : Promise$1.reject(new Error("Driver not found."));
              executeTwoCallbacks(getDriverPromise, callback, errorCallback);
              return getDriverPromise;
            };
            LocalForage2.prototype.getSerializer = function getSerializer(callback) {
              var serializerPromise = Promise$1.resolve(localforageSerializer);
              executeTwoCallbacks(serializerPromise, callback);
              return serializerPromise;
            };
            LocalForage2.prototype.ready = function ready(callback) {
              var self2 = this;
              var promise = self2._driverSet.then(function() {
                if (self2._ready === null) {
                  self2._ready = self2._initDriver();
                }
                return self2._ready;
              });
              executeTwoCallbacks(promise, callback, callback);
              return promise;
            };
            LocalForage2.prototype.setDriver = function setDriver(drivers, callback, errorCallback) {
              var self2 = this;
              if (!isArray3(drivers)) {
                drivers = [drivers];
              }
              var supportedDrivers = this._getSupportedDrivers(drivers);
              function setDriverToConfig() {
                self2._config.driver = self2.driver();
              }
              function extendSelfWithDriver(driver) {
                self2._extend(driver);
                setDriverToConfig();
                self2._ready = self2._initStorage(self2._config);
                return self2._ready;
              }
              function initDriver(supportedDrivers2) {
                return function() {
                  var currentDriverIndex = 0;
                  function driverPromiseLoop() {
                    while (currentDriverIndex < supportedDrivers2.length) {
                      var driverName = supportedDrivers2[currentDriverIndex];
                      currentDriverIndex++;
                      self2._dbInfo = null;
                      self2._ready = null;
                      return self2.getDriver(driverName).then(extendSelfWithDriver)["catch"](driverPromiseLoop);
                    }
                    setDriverToConfig();
                    var error = new Error("No available storage method found.");
                    self2._driverSet = Promise$1.reject(error);
                    return self2._driverSet;
                  }
                  return driverPromiseLoop();
                };
              }
              var oldDriverSetDone = this._driverSet !== null ? this._driverSet["catch"](function() {
                return Promise$1.resolve();
              }) : Promise$1.resolve();
              this._driverSet = oldDriverSetDone.then(function() {
                var driverName = supportedDrivers[0];
                self2._dbInfo = null;
                self2._ready = null;
                return self2.getDriver(driverName).then(function(driver) {
                  self2._driver = driver._driver;
                  setDriverToConfig();
                  self2._wrapLibraryMethodsWithReady();
                  self2._initDriver = initDriver(supportedDrivers);
                });
              })["catch"](function() {
                setDriverToConfig();
                var error = new Error("No available storage method found.");
                self2._driverSet = Promise$1.reject(error);
                return self2._driverSet;
              });
              executeTwoCallbacks(this._driverSet, callback, errorCallback);
              return this._driverSet;
            };
            LocalForage2.prototype.supports = function supports(driverName) {
              return !!DriverSupport[driverName];
            };
            LocalForage2.prototype._extend = function _extend(libraryMethodsAndProperties) {
              extend2(this, libraryMethodsAndProperties);
            };
            LocalForage2.prototype._getSupportedDrivers = function _getSupportedDrivers(drivers) {
              var supportedDrivers = [];
              for (var i = 0, len = drivers.length; i < len; i++) {
                var driverName = drivers[i];
                if (this.supports(driverName)) {
                  supportedDrivers.push(driverName);
                }
              }
              return supportedDrivers;
            };
            LocalForage2.prototype._wrapLibraryMethodsWithReady = function _wrapLibraryMethodsWithReady() {
              for (var i = 0, len = LibraryMethods.length; i < len; i++) {
                callWhenReady(this, LibraryMethods[i]);
              }
            };
            LocalForage2.prototype.createInstance = function createInstance(options) {
              return new LocalForage2(options);
            };
            return LocalForage2;
          }();
          var localforage_js = new LocalForage();
          module4.exports = localforage_js;
        }, { "3": 3 }] }, {}, [4])(4);
      });
    }
  });

  // src/common/util.ts
  function hex(v, nd) {
    if (!nd)
      nd = 2;
    if (nd == 8) {
      return hex(v >> 16 & 65535, 4) + hex(v & 65535, 4);
    } else {
      return toradix(v, nd, 16);
    }
  }
  function toradix(v, nd, radix) {
    try {
      var s = v.toString(radix).toUpperCase();
      while (s.length < nd)
        s = "0" + s;
      return s;
    } catch (e) {
      return v + "";
    }
  }
  function rgb2bgr(x) {
    return (x & 255) << 16 | x >> 16 & 255 | x & 65280;
  }
  function getBasePlatform(platform) {
    return platform.split(".")[0];
  }
  function getRootPlatform(platform) {
    return platform.split("-")[0];
  }
  function getRootBasePlatform(platform) {
    return getRootPlatform(getBasePlatform(platform));
  }
  function isArray(obj) {
    return obj != null && (Array.isArray(obj) || isTypedArray(obj));
  }
  function isTypedArray(obj) {
    return obj != null && obj["BYTES_PER_ELEMENT"];
  }
  var XMLParseError = class extends Error {
  };
  function escapeXML(s) {
    if (s.indexOf("&") >= 0) {
      return s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
    } else {
      return s;
    }
  }
  function parseXMLPoorly(s, openfn, closefn) {
    const tag_re = /[<]([/]?)([?a-z_-]+)([^>]*)[>]+|(\s*[^<]+)/gi;
    const attr_re = /\s*(\w+)="(.*?)"\s*/gi;
    var fm;
    var stack = [];
    var top;
    function closetop() {
      top = stack.pop();
      if (top == null || top.type != ident)
        throw new XMLParseError("mismatch close tag: " + ident);
      if (closefn) {
        top.obj = closefn(top);
      }
      if (stack.length == 0)
        throw new XMLParseError("close tag without open: " + ident);
      stack[stack.length - 1].children.push(top);
    }
    function parseattrs(as) {
      var am;
      var attrs2 = {};
      if (as != null) {
        while (am = attr_re.exec(as)) {
          attrs2[am[1]] = escapeXML(am[2]);
        }
      }
      return attrs2;
    }
    while (fm = tag_re.exec(s)) {
      var [_m0, close, ident, attrs, content] = fm;
      if (close) {
        closetop();
      } else if (ident) {
        var node = { type: ident, text: null, children: [], attrs: parseattrs(attrs), obj: null };
        stack.push(node);
        if (attrs) {
          parseattrs(attrs);
        }
        if (openfn) {
          node.obj = openfn(node);
        }
        if (attrs && attrs.endsWith("/"))
          closetop();
      } else if (content != null) {
        if (stack.length == 0)
          throw new XMLParseError("content without element");
        var txt = escapeXML(content).trim();
        if (txt.length)
          stack[stack.length - 1].text = txt;
      }
    }
    if (stack.length != 1)
      throw new XMLParseError("tag not closed");
    if (stack[0].type != "?xml")
      throw new XMLParseError("?xml needs to be first element");
    return top;
  }
  function findIntegerFactors(x, mina, minb, aspect) {
    let a = x;
    let b = 1;
    if (minb > 1 && minb < a) {
      a = Math.ceil(x / minb);
      b = minb;
    }
    while (a > b) {
      let a2 = a;
      let b2 = b;
      if ((a & 1) == 0) {
        b2 = b * 2;
        a2 = a / 2;
      }
      if (a % 3 == 0) {
        b2 = b * 3;
        a2 = a / 3;
      }
      if (a % 5 == 0) {
        b2 = b * 5;
        a2 = a / 5;
      }
      if (a2 < mina)
        break;
      if (a2 < b2 * aspect)
        break;
      a = a2;
      b = b2;
    }
    return { a, b };
  }
  var FileDataCache = class {
    constructor() {
      this.maxSize = 8e6;
      this.reset();
    }
    get(key2) {
      return this.cache.get(key2);
    }
    put(key2, value) {
      this.cache.set(key2, value);
      this.size += value.length;
      if (this.size > this.maxSize) {
        console.log("cache reset", this);
        this.reset();
      }
    }
    reset() {
      this.cache = new Map();
      this.size = 0;
    }
  };
  function coerceToArray(arrobj) {
    if (Array.isArray(arrobj))
      return arrobj;
    else if (arrobj != null && typeof arrobj[Symbol.iterator] === "function")
      return Array.from(arrobj);
    else if (typeof arrobj === "object")
      return Array.from(Object.values(arrobj));
    else
      throw new Error(`Expected array or object, got "${arrobj}"`);
  }

  // src/common/basic/compiler.ts
  var CompileError = class extends Error {
    constructor(msg, loc) {
      super(msg);
      Object.setPrototypeOf(this, CompileError.prototype);
      this.$loc = loc;
    }
  };
  var re_toks = /([0-9.]+[E][+-]?\d+|\d+[.][E0-9]*|[.][E0-9]+)|[0]*(\d+)|&([OH][0-9A-F]+)|(['].*)|([A-Z_]\w*[$]?)|(".*?")|([<>]?[=<>#])|(\*\*)|([-+*/^,;:()\[\]\?\\])|(\S+)|(\s+)/gi;
  var TokenType;
  (function(TokenType4) {
    TokenType4[TokenType4["EOL"] = 0] = "EOL";
    TokenType4[TokenType4["Float"] = 1] = "Float";
    TokenType4[TokenType4["Int"] = 2] = "Int";
    TokenType4[TokenType4["HexOctalInt"] = 3] = "HexOctalInt";
    TokenType4[TokenType4["Remark"] = 4] = "Remark";
    TokenType4[TokenType4["Ident"] = 5] = "Ident";
    TokenType4[TokenType4["String"] = 6] = "String";
    TokenType4[TokenType4["Relational"] = 7] = "Relational";
    TokenType4[TokenType4["DoubleStar"] = 8] = "DoubleStar";
    TokenType4[TokenType4["Operator"] = 9] = "Operator";
    TokenType4[TokenType4["CatchAll"] = 10] = "CatchAll";
    TokenType4[TokenType4["Whitespace"] = 11] = "Whitespace";
    TokenType4[TokenType4["_LAST"] = 12] = "_LAST";
  })(TokenType || (TokenType = {}));
  var OPERATORS = {
    "IMP": { f: "bimp", p: 4 },
    "EQV": { f: "beqv", p: 5 },
    "XOR": { f: "bxor", p: 6 },
    "OR": { f: "bor", p: 7 },
    "AND": { f: "band", p: 8 },
    "||": { f: "lor", p: 17 },
    "&&": { f: "land", p: 18 },
    "=": { f: "eq", p: 50 },
    "==": { f: "eq", p: 50 },
    "<>": { f: "ne", p: 50 },
    "><": { f: "ne", p: 50 },
    "!=": { f: "ne", p: 50 },
    "#": { f: "ne", p: 50 },
    "<": { f: "lt", p: 50 },
    ">": { f: "gt", p: 50 },
    "<=": { f: "le", p: 50 },
    ">=": { f: "ge", p: 50 },
    "MIN": { f: "min", p: 75 },
    "MAX": { f: "max", p: 75 },
    "+": { f: "add", p: 100 },
    "-": { f: "sub", p: 100 },
    "%": { f: "mod", p: 140 },
    "MOD": { f: "mod", p: 140 },
    "\\": { f: "idiv", p: 150 },
    "*": { f: "mul", p: 200 },
    "/": { f: "div", p: 200 },
    "^": { f: "pow", p: 300 },
    "**": { f: "pow", p: 300 }
  };
  function getOperator(op) {
    return OPERATORS[op];
  }
  function getPrecedence(tok) {
    switch (tok.type) {
      case 9:
      case 8:
      case 7:
      case 5:
        let op = getOperator(tok.str);
        if (op)
          return op.p;
    }
    return -1;
  }
  function isEOS(tok) {
    return tok.type == 0 || tok.type == 4 || tok.str == ":" || tok.str == "ELSE";
  }
  function stripQuotes(s) {
    return s.substr(1, s.length - 2);
  }
  function isLiteral(arg) {
    return arg.value != null;
  }
  function isLookup(arg) {
    return arg.name != null;
  }
  function isBinOp(arg) {
    return arg.op != null && arg.left != null && arg.right != null;
  }
  function isUnOp(arg) {
    return arg.op != null && arg.expr != null;
  }
  function mergeLocs(a, b) {
    return {
      line: Math.min(a.line, b.line),
      start: Math.min(a.start, b.start),
      end: Math.max(a.end, b.end),
      label: a.label || b.label,
      path: a.path || b.path
    };
  }
  var BASICParser = class {
    constructor() {
      this.opts = DIALECTS["DEFAULT"];
      this.maxlinelen = 255;
      this.optionCount = 0;
      this.lineno = 0;
      this.curlabel = null;
      this.stmts = [];
      this.labels = {};
      this.targets = {};
      this.errors = [];
      this.listings = {};
      this.vardefs = {};
      this.varrefs = {};
      this.fnrefs = {};
      this.scopestack = [];
      this.elseifcount = 0;
    }
    addError(msg, loc) {
      var tok = this.lasttoken || this.peekToken();
      if (!loc)
        loc = tok.$loc;
      this.errors.push({ path: loc.path, line: loc.line, label: this.curlabel, start: loc.start, end: loc.end, msg });
    }
    compileError(msg, loc, loc2) {
      this.addError(msg, loc);
      throw new CompileError(msg, loc);
    }
    dialectError(what, loc) {
      this.compileError(`${what} in this dialect of BASIC (${this.opts.dialectName}).`, loc);
    }
    dialectErrorNoSupport(what, loc) {
      this.compileError(`You can't use ${what} in this dialect of BASIC (${this.opts.dialectName}).`, loc);
    }
    consumeToken() {
      var tok = this.lasttoken = this.tokens.shift() || this.eol;
      return tok;
    }
    expectToken(str, msg) {
      var tok = this.consumeToken();
      var tokstr = tok.str;
      if (str != tokstr) {
        this.compileError(msg || `There should be a "${str}" here.`);
      }
      return tok;
    }
    expectTokens(strlist, msg) {
      var tok = this.consumeToken();
      var tokstr = tok.str;
      if (strlist.indexOf(tokstr) < 0) {
        this.compileError(msg || `There should be a ${strlist.map((s) => `"${s}"`).join(" or ")} here.`);
      }
      return tok;
    }
    peekToken(lookahead2) {
      var tok = this.tokens[lookahead2 || 0];
      return tok ? tok : this.eol;
    }
    pushbackToken(tok) {
      this.tokens.unshift(tok);
    }
    parseOptLabel() {
      let tok = this.consumeToken();
      switch (tok.type) {
        case 5:
          if (this.opts.optionalLabels || tok.str == "OPTION") {
            if (this.peekToken().str == ":" && !this.supportsCommand(tok.str)) {
              this.consumeToken();
            } else {
              this.pushbackToken(tok);
              break;
            }
          } else
            this.dialectError(`Each line must begin with a line number`);
        case 2:
          this.addLabel(tok.str);
          return;
        case 3:
        case 1:
          this.compileError(`Line numbers must be positive integers.`);
          break;
        case 9:
          if (this.supportsCommand(tok.str) && this.validKeyword(tok.str)) {
            this.pushbackToken(tok);
            break;
          }
        default:
          if (this.opts.optionalLabels)
            this.compileError(`A line must start with a line number, command, or label.`);
          else
            this.compileError(`A line must start with a line number.`);
        case 4:
          break;
      }
      this.addLabel("#" + this.lineno);
    }
    getPC() {
      return this.stmts.length;
    }
    addStatement(stmt, cmdtok, endtok) {
      if (endtok == null)
        endtok = this.peekToken();
      stmt.$loc = {
        path: cmdtok.$loc.path,
        line: cmdtok.$loc.line,
        start: cmdtok.$loc.start,
        end: endtok.$loc.start,
        label: this.curlabel,
        offset: this.stmts.length
      };
      this.modifyScope(stmt);
      this.stmts.push(stmt);
    }
    addLabel(str, offset2) {
      if (this.labels[str] != null)
        this.compileError(`There's a duplicated label named "${str}".`);
      this.labels[str] = this.getPC() + (offset2 || 0);
      this.curlabel = str;
      this.tokens.forEach((tok) => tok.$loc.label = str);
    }
    parseFile(file2, path) {
      this.path = path;
      var txtlines = file2.split(/\n|\r\n?/);
      txtlines.forEach((line) => this.parseLine(line));
      var program = { opts: this.opts, stmts: this.stmts, labels: this.labels };
      this.checkAll(program);
      this.listings[path] = this.generateListing(file2, program);
      return program;
    }
    parseLine(line) {
      try {
        this.tokenize(line);
        this.parse();
      } catch (e) {
        if (!(e instanceof CompileError))
          throw e;
      }
    }
    _tokenize(line) {
      let splitre = this.opts.optionalWhitespace && new RegExp("(" + this.opts.validKeywords.map((s) => `${s}`).join("|") + ")");
      var lastTokType = 10;
      var m;
      while (m = re_toks.exec(line)) {
        for (var i = 1; i <= lastTokType; i++) {
          let s = m[i];
          if (s != null) {
            let loc = { path: this.path, line: this.lineno, start: m.index, end: m.index + s.length };
            if (this.opts.asciiOnly && !/^[\x00-\x7F]*$/.test(s))
              this.dialectErrorNoSupport(`non-ASCII characters`);
            if (i == 5 || i == 3 || this.opts.uppercaseOnly) {
              s = s.toUpperCase();
              if (s == "DATA")
                lastTokType = 11;
              if (s == "DATA")
                splitre = null;
              if (s == "OPTION")
                splitre = null;
              if (lastTokType == 10 && s.startsWith("REM")) {
                s = "REM";
                lastTokType = 0;
              }
            }
            if (s == "[" || s == "]") {
              if (!this.opts.squareBrackets)
                this.dialectErrorNoSupport(`square brackets`);
              if (s == "[")
                s = "(";
              if (s == "]")
                s = ")";
            }
            if (splitre && i == 5) {
              var splittoks = s.split(splitre).filter((s2) => s2 != "");
              if (splittoks.length > 1) {
                splittoks.forEach((ss) => {
                  if (/^[0-9]+$/.test(ss))
                    i = 2;
                  else if (/^[A-Z_]\w*[$]?$/.test(ss))
                    i = 5;
                  else
                    this.compileError(`Try adding whitespace before "${ss}".`);
                  this.tokens.push({ str: ss, type: i, $loc: loc });
                });
                s = null;
              }
            }
            if (s)
              this.tokens.push({ str: s, type: i, $loc: loc });
            break;
          }
        }
      }
    }
    tokenize(line) {
      this.lineno++;
      this.tokens = [];
      this.eol = { type: 0, str: "", $loc: { path: this.path, line: this.lineno, start: line.length } };
      if (line.length > this.maxlinelen)
        this.compileError(`A line should be no more than ${this.maxlinelen} characters long.`);
      this._tokenize(line);
    }
    parse() {
      if (this.tokens.length) {
        this.parseOptLabel();
        if (this.tokens.length) {
          this.parseCompoundStatement();
        }
        var next = this.peekToken();
        if (!isEOS(next))
          this.compileError(`Expected end of line or ':'`, next.$loc);
        this.curlabel = null;
      }
    }
    parseCompoundStatement() {
      if (this.opts.multipleStmtsPerLine) {
        this.parseList(this.parseStatement, ":");
      } else {
        this.parseList(this.parseStatement, "\0");
        if (this.peekToken().str == ":")
          this.dialectErrorNoSupport(`multiple statements on a line`);
      }
    }
    validKeyword(keyword) {
      return this.opts.validKeywords && this.opts.validKeywords.indexOf(keyword) < 0 ? null : keyword;
    }
    validFunction(funcname) {
      return this.opts.validFunctions && this.opts.validFunctions.indexOf(funcname) < 0 ? null : funcname;
    }
    supportsCommand(cmd) {
      if (cmd == "?")
        return this.stmt__PRINT;
      else
        return this["stmt__" + cmd];
    }
    parseStatement() {
      if (this.opts.optionalWhitespace && this.peekToken().str == ":")
        return null;
      var cmdtok = this.consumeToken();
      var cmd = cmdtok.str;
      var stmt;
      switch (cmdtok.type) {
        case 4:
          if (cmdtok.str.startsWith("'") && !this.opts.tickComments)
            this.dialectErrorNoSupport(`tick comments`);
          return null;
        case 9:
          if (cmd == this.validKeyword("?"))
            cmd = "PRINT";
        case 5:
          if (cmd == "REM")
            return null;
          if (cmd == "GO" && this.peekToken().str == "TO") {
            this.consumeToken();
            cmd = "GOTO";
          } else if (cmd == "GO" && this.peekToken().str == "SUB") {
            this.consumeToken();
            cmd = "GOSUB";
          }
          var fn = this.supportsCommand(cmd);
          if (fn) {
            if (this.validKeyword(cmd) == null)
              this.dialectErrorNoSupport(`the ${cmd} statement`);
            stmt = fn.bind(this)();
            break;
          } else if (this.peekToken().str == "=" || this.peekToken().str == "(") {
            if (!this.opts.optionalLet)
              this.dialectError(`Assignments must have a preceding LET`);
            this.pushbackToken(cmdtok);
            stmt = this.stmt__LET();
            break;
          } else {
            this.compileError(`I don't understand the command "${cmd}".`);
          }
        case 0:
          if (this.opts.optionalWhitespace)
            return null;
        default:
          this.compileError(`There should be a command here.`);
          return null;
      }
      if (stmt != null)
        this.addStatement(stmt, cmdtok);
      return stmt;
    }
    modifyScope(stmt) {
      if (this.opts.compiledBlocks) {
        var cmd = stmt.command;
        if (cmd == "FOR" || cmd == "WHILE" || cmd == "SUB") {
          this.scopestack.push(this.getPC());
        } else if (cmd == "NEXT") {
          this.popScope(stmt, "FOR");
        } else if (cmd == "WEND") {
          this.popScope(stmt, "WHILE");
        }
      }
    }
    popScope(close, open) {
      var popidx = this.scopestack.pop();
      var popstmt = popidx != null ? this.stmts[popidx] : null;
      if (popstmt == null)
        this.compileError(`There's a ${close.command} without a matching ${open}.`, close.$loc);
      else if (popstmt.command != open)
        this.compileError(`There's a ${close.command} paired with ${popstmt.command}, but it should be paired with ${open}.`, close.$loc, popstmt.$loc);
      else if (close.command == "NEXT" && !this.opts.optionalNextVar && close.lexpr.name != popstmt.lexpr.name)
        this.compileError(`This NEXT statement is matched with the wrong FOR variable (${close.lexpr.name}).`, close.$loc, popstmt.$loc);
      close.startpc = popidx;
      popstmt.endpc = this.getPC();
    }
    popIfThenScope(nextpc) {
      var popidx = this.scopestack.pop();
      var popstmt = popidx != null ? this.stmts[popidx] : null;
      if (popstmt == null)
        this.compileError(`There's an END IF without a matching IF or ELSE.`);
      if (popstmt.command == "ELSE") {
        popstmt.endpc = this.getPC();
        this.popIfThenScope(popidx + 1);
      } else if (popstmt.command == "IF") {
        popstmt.endpc = nextpc != null ? nextpc : this.getPC();
      } else {
        this.compileError(`There's an END IF paired with a ${popstmt.command}, not IF or ELSE.`, this.lasttoken.$loc, popstmt.$loc);
      }
    }
    parseVarSubscriptOrFunc() {
      var tok = this.consumeToken();
      switch (tok.type) {
        case 5:
          let args = null;
          if (this.peekToken().str == "(") {
            this.expectToken("(");
            args = this.parseExprList();
            this.expectToken(")", `There should be another expression or a ")" here.`);
          }
          var loc = mergeLocs(tok.$loc, this.lasttoken.$loc);
          var valtype = this.exprTypeForSubscript(tok.str, args, loc);
          return { valtype, name: tok.str, args, $loc: loc };
        default:
          this.compileError(`There should be a variable name here.`);
          break;
      }
    }
    parseLexpr() {
      var lexpr = this.parseVarSubscriptOrFunc();
      this.vardefs[lexpr.name] = lexpr;
      this.validateVarName(lexpr);
      return lexpr;
    }
    parseForNextLexpr() {
      var lexpr = this.parseLexpr();
      if (lexpr.args || lexpr.name.endsWith("$"))
        this.compileError(`A FOR ... NEXT loop can only use numeric variables.`, lexpr.$loc);
      return lexpr;
    }
    parseList(parseFunc, delim) {
      var sep;
      var list = [];
      do {
        var el = parseFunc.bind(this)();
        if (el != null)
          list.push(el);
        sep = this.consumeToken();
      } while (sep.str == delim);
      this.pushbackToken(sep);
      return list;
    }
    parseLexprList() {
      return this.parseList(this.parseLexpr, ",");
    }
    parseExprList() {
      return this.parseList(this.parseExpr, ",");
    }
    parseLabelList() {
      return this.parseList(this.parseLabel, ",");
    }
    parseLabel() {
      if (this.opts.computedGoto) {
        var expr = this.parseExpr();
        if (isLiteral(expr))
          this.targets[expr.value] = this.lasttoken.$loc;
        return expr;
      } else {
        var tok = this.consumeToken();
        switch (tok.type) {
          case 5:
            if (!this.opts.optionalLabels)
              this.dialectError(`All labels must be line numbers`);
          case 2:
            var label = tok.str;
            this.targets[label] = tok.$loc;
            return { valtype: "label", value: label };
          default:
            var what = this.opts.optionalLabels ? "label or line number" : "line number";
            this.compileError(`There should be a ${what} here.`);
        }
      }
    }
    parseDatumList() {
      return this.parseList(this.parseDatum, ",");
    }
    parseDatum() {
      var tok = this.consumeToken();
      while (tok.type == 11)
        tok = this.consumeToken();
      if (isEOS(tok))
        this.compileError(`There should be a datum here.`);
      if (tok.type <= 3) {
        return this.parseValue(tok);
      }
      if (tok.str == "-" && this.peekToken().type <= 3) {
        tok = this.consumeToken();
        return { valtype: "number", value: -this.parseValue(tok).value };
      }
      if (tok.str == "+" && this.peekToken().type <= 3) {
        tok = this.consumeToken();
        return this.parseValue(tok);
      }
      var s = "";
      while (!isEOS(tok) && tok.str != ",") {
        s += this.parseValue(tok).value;
        tok = this.consumeToken();
      }
      this.pushbackToken(tok);
      return { valtype: "string", value: s };
    }
    parseValue(tok) {
      switch (tok.type) {
        case 3:
          if (!this.opts.hexOctalConsts)
            this.dialectErrorNoSupport(`hex/octal constants`);
          let base = tok.str.startsWith("H") ? 16 : 8;
          return { valtype: "number", value: parseInt(tok.str.substr(1), base) };
        case 2:
        case 1:
          return { valtype: "number", value: this.parseNumber(tok.str) };
        case 6:
          return { valtype: "string", value: stripQuotes(tok.str) };
        default:
          return { valtype: "string", value: tok.str };
      }
    }
    parsePrimary() {
      let tok = this.consumeToken();
      switch (tok.type) {
        case 3:
        case 2:
        case 1:
        case 6:
          return this.parseValue(tok);
        case 5:
          if (tok.str == "NOT") {
            let expr = this.parsePrimary();
            return { valtype: "number", op: this.opts.bitwiseLogic ? "bnot" : "lnot", expr };
          } else {
            this.pushbackToken(tok);
            return this.parseVarSubscriptOrFunc();
          }
        case 9:
          if (tok.str == "(") {
            let expr = this.parseExpr();
            this.expectToken(")", `There should be another expression or a ")" here.`);
            return expr;
          } else if (tok.str == "-") {
            let expr = this.parsePrimary();
            return { valtype: "number", op: "neg", expr };
          } else if (tok.str == "+") {
            return this.parsePrimary();
          }
        default:
          this.compileError(`The expression is incomplete.`);
          return;
      }
    }
    parseNumber(str) {
      var n2 = parseFloat(str);
      if (isNaN(n2))
        this.compileError(`The number ${str} is not a valid floating-point number.`);
      if (this.opts.checkOverflow && !isFinite(n2))
        this.compileError(`The number ${str} is too big to fit into a floating-point value.`);
      return n2;
    }
    parseExpr1(left, minPred) {
      let look = this.peekToken();
      while (getPrecedence(look) >= minPred) {
        let op = this.consumeToken();
        if (this.opts.validOperators && this.opts.validOperators.indexOf(op.str) < 0)
          this.dialectErrorNoSupport(`the "${op.str}" operator`);
        let right = this.parsePrimary();
        look = this.peekToken();
        while (getPrecedence(look) > getPrecedence(op)) {
          right = this.parseExpr1(right, getPrecedence(look));
          look = this.peekToken();
        }
        var opfn = getOperator(op.str).f;
        if (!this.opts.bitwiseLogic && op.str == "AND")
          opfn = "land";
        if (!this.opts.bitwiseLogic && op.str == "OR")
          opfn = "lor";
        var valtype = this.exprTypeForOp(opfn, left, right, op);
        left = { valtype, op: opfn, left, right };
      }
      return left;
    }
    parseExpr() {
      var startloc = this.peekToken().$loc;
      var expr = this.parseExpr1(this.parsePrimary(), 0);
      var endloc = this.lasttoken.$loc;
      expr.$loc = mergeLocs(startloc, endloc);
      return expr;
    }
    parseExprWithType(expecttype) {
      var expr = this.parseExpr();
      if (expr.valtype != expecttype)
        this.compileError(`There should be a ${expecttype} here, but this expression evaluates to a ${expr.valtype}.`, expr.$loc);
      return expr;
    }
    validateVarName(lexpr) {
      switch (this.opts.varNaming) {
        case "A":
          if (!/^[A-Z]$/i.test(lexpr.name))
            this.dialectErrorNoSupport(`variable names other than a single letter`);
          break;
        case "A1":
          if (lexpr.args == null && !/^[A-Z][0-9]?[$]?$/i.test(lexpr.name))
            this.dialectErrorNoSupport(`variable names other than a letter followed by an optional digit`);
          if (lexpr.args != null && !/^[A-Z]?[$]?$/i.test(lexpr.name))
            this.dialectErrorNoSupport(`array names other than a single letter`);
          break;
        case "A1$":
          if (!/^[A-Z][0-9]?[$]?$/i.test(lexpr.name))
            this.dialectErrorNoSupport(`variable names other than a letter followed by an optional digit`);
          break;
        case "AA":
          if (lexpr.args == null && !/^[A-Z][A-Z0-9]?[$]?$/i.test(lexpr.name))
            this.dialectErrorNoSupport(`variable names other than a letter followed by an optional letter or digit`);
          break;
        case "*":
          break;
      }
    }
    visitExpr(expr, callback) {
      if (isBinOp(expr)) {
        this.visitExpr(expr.left, callback);
        this.visitExpr(expr.right, callback);
      }
      if (isUnOp(expr)) {
        this.visitExpr(expr.expr, callback);
      }
      if (isLookup(expr) && expr.args != null) {
        for (var arg of expr.args)
          this.visitExpr(arg, callback);
      }
      callback(expr);
    }
    exprTypeForOp(fnname, left, right, optok) {
      if (left.valtype == "string" || right.valtype == "string") {
        if (fnname == "add") {
          if (this.opts.stringConcat)
            return "string";
          else
            this.dialectErrorNoSupport(`the "+" operator to concatenate strings`, optok.$loc);
        } else if (fnname.length != 2)
          this.compileError(`You can't do math on strings until they're converted to numbers.`, optok.$loc);
      }
      return "number";
    }
    exprTypeForSubscript(fnname, args, loc) {
      args = args || [];
      var defs = BUILTIN_MAP[fnname];
      if (defs != null) {
        if (!this.validFunction(fnname))
          this.dialectErrorNoSupport(`the ${fnname} function`, loc);
        for (var def of defs) {
          if (args.length == def.args.length)
            return def.result;
        }
        this.compileError(`The ${fnname} function takes ${def.args.length} arguments, but ${args.length} are given.`, loc);
      }
      this.varrefs[fnname] = loc;
      return fnname.endsWith("$") ? "string" : "number";
    }
    stmt__LET() {
      var lexprs = [this.parseLexpr()];
      this.expectToken("=");
      while (this.opts.chainAssignments && this.peekToken().type == 5 && this.peekToken(1).str == "=") {
        lexprs.push(this.parseLexpr());
        this.expectToken("=");
      }
      var right = this.parseExprWithType(lexprs[0].valtype);
      return { command: "LET", lexprs, right };
    }
    stmt__PRINT() {
      var sep, lastsep;
      var list = [];
      do {
        sep = this.peekToken();
        if (isEOS(sep)) {
          break;
        } else if (sep.str == ";") {
          this.consumeToken();
          lastsep = sep;
        } else if (sep.str == ",") {
          this.consumeToken();
          list.push({ value: "	" });
          lastsep = sep;
        } else {
          list.push(this.parseExpr());
          lastsep = null;
        }
      } while (true);
      if (!(lastsep && (lastsep.str == ";" || sep.str != ","))) {
        list.push({ value: "\n" });
      }
      return { command: "PRINT", args: list };
    }
    stmt__GOTO() {
      return this.__GO("GOTO");
    }
    stmt__GOSUB() {
      return this.__GO("GOSUB");
    }
    __GO(cmd) {
      var expr = this.parseLabel();
      if (this.peekToken().str == this.validKeyword("OF")) {
        this.expectToken("OF");
        let newcmd = cmd == "GOTO" ? "ONGOTO" : "ONGOSUB";
        return { command: newcmd, expr, labels: this.parseLabelList() };
      } else {
        return { command: cmd, label: expr };
      }
    }
    stmt__IF() {
      var cmdtok = this.lasttoken;
      var cond = this.parseExprWithType("number");
      var ifstmt = { command: "IF", cond };
      this.addStatement(ifstmt, cmdtok);
      var thengoto = this.expectTokens(["THEN", "GOTO", "GO"]);
      if (thengoto.str == "GO")
        this.expectToken("TO");
      if (this.opts.multilineIfThen && isEOS(this.peekToken())) {
        this.scopestack.push(this.getPC() - 1);
      } else {
        this.parseGotoOrStatements();
        if (this.peekToken().str == "ELSE") {
          this.expectToken("ELSE");
          ifstmt.endpc = this.getPC() + 1;
          this.stmt__ELSE();
        } else {
          ifstmt.endpc = this.getPC();
        }
      }
    }
    stmt__ELSE() {
      var elsestmt = { command: "ELSE" };
      this.addStatement(elsestmt, this.lasttoken);
      var nexttok = this.peekToken();
      if (this.opts.multilineIfThen && isEOS(nexttok)) {
        this.scopestack.push(this.getPC() - 1);
      } else if (this.opts.multilineIfThen && nexttok.str == "IF") {
        this.scopestack.push(this.getPC() - 1);
        this.parseGotoOrStatements();
        this.elseifcount++;
      } else {
        this.parseGotoOrStatements();
        elsestmt.endpc = this.getPC();
      }
    }
    parseGotoOrStatements() {
      var lineno = this.peekToken();
      if (lineno.type == 2) {
        this.parseLabel();
        var gotostmt = { command: "GOTO", label: { valtype: "label", value: lineno.str } };
        this.addStatement(gotostmt, lineno);
      } else {
        this.parseCompoundStatement();
      }
    }
    stmt__FOR() {
      var lexpr = this.parseForNextLexpr();
      this.expectToken("=");
      var init = this.parseExprWithType("number");
      this.expectToken("TO");
      var targ = this.parseExprWithType("number");
      if (this.peekToken().str == "STEP") {
        this.consumeToken();
        var step = this.parseExprWithType("number");
      }
      return { command: "FOR", lexpr, initial: init, target: targ, step };
    }
    stmt__NEXT() {
      var lexpr = null;
      if (!this.opts.optionalNextVar || !isEOS(this.peekToken())) {
        lexpr = this.parseForNextLexpr();
        if (this.opts.multipleNextVars && this.peekToken().str == ",") {
          this.consumeToken();
          this.tokens.unshift({ type: 5, str: "NEXT", $loc: this.peekToken().$loc });
          this.tokens.unshift({ type: 9, str: ":", $loc: this.peekToken().$loc });
        }
      }
      return { command: "NEXT", lexpr };
    }
    stmt__WHILE() {
      var cond = this.parseExprWithType("number");
      return { command: "WHILE", cond };
    }
    stmt__WEND() {
      return { command: "WEND" };
    }
    stmt__DIM() {
      var lexprs = this.parseLexprList();
      lexprs.forEach((arr) => {
        if (arr.args == null || arr.args.length == 0)
          this.compileError(`An array defined by DIM must have at least one dimension.`);
        else if (arr.args.length > this.opts.maxDimensions)
          this.dialectErrorNoSupport(`arrays with more than ${this.opts.maxDimensions} dimensionals`);
        for (var arrdim of arr.args) {
          if (arrdim.valtype != "number")
            this.compileError(`Array dimensions must be numeric.`, arrdim.$loc);
          if (isLiteral(arrdim) && arrdim.value < this.opts.defaultArrayBase)
            this.compileError(`An array dimension cannot be less than ${this.opts.defaultArrayBase}.`, arrdim.$loc);
        }
      });
      return { command: "DIM", args: lexprs };
    }
    stmt__INPUT() {
      var prompt = this.consumeToken();
      var promptstr;
      if (prompt.type == 6) {
        this.expectTokens([";", ","]);
        promptstr = stripQuotes(prompt.str);
      } else {
        this.pushbackToken(prompt);
        promptstr = "";
      }
      return { command: "INPUT", prompt: { valtype: "string", value: promptstr }, args: this.parseLexprList() };
    }
    stmt__ENTER() {
      var timeout = this.parseExpr();
      this.expectToken(",");
      var elapsed = this.parseLexpr();
      this.expectToken(",");
      return { command: "INPUT", prompt: null, args: this.parseLexprList(), timeout, elapsed };
    }
    stmt__DATA() {
      return { command: "DATA", datums: this.parseDatumList() };
    }
    stmt__READ() {
      return { command: "READ", args: this.parseLexprList() };
    }
    stmt__RESTORE() {
      var label = null;
      if (this.opts.restoreWithLabel && !isEOS(this.peekToken()))
        label = this.parseLabel();
      return { command: "RESTORE", label };
    }
    stmt__RETURN() {
      return { command: "RETURN" };
    }
    stmt__STOP() {
      return { command: "STOP" };
    }
    stmt__END() {
      if (this.opts.multilineIfThen && this.scopestack.length) {
        let endtok = this.expectTokens(["IF", "SUB"]);
        if (endtok.str == "IF") {
          this.popIfThenScope();
          while (this.elseifcount--)
            this.popIfThenScope();
          this.elseifcount = 0;
        } else if (endtok.str == "SUB") {
          this.addStatement({ command: "RETURN" }, endtok);
          this.popScope({ command: "END" }, "SUB");
        }
      } else {
        return { command: "END" };
      }
    }
    stmt__ON() {
      var expr = this.parseExprWithType("number");
      var gotok = this.consumeToken();
      var cmd = { GOTO: "ONGOTO", THEN: "ONGOTO", GOSUB: "ONGOSUB" }[gotok.str];
      if (!cmd)
        this.compileError(`There should be a GOTO or GOSUB here.`);
      var labels = this.parseLabelList();
      return { command: cmd, expr, labels };
    }
    stmt__DEF() {
      var lexpr = this.parseVarSubscriptOrFunc();
      if (lexpr.args && lexpr.args.length > this.opts.maxDefArgs)
        this.compileError(`There can be no more than ${this.opts.maxDefArgs} arguments to a function or subscript.`, lexpr.$loc);
      if (!lexpr.name.startsWith("FN"))
        this.compileError(`Functions defined with DEF must begin with the letters "FN".`, lexpr.$loc);
      this.markVarDefs(lexpr);
      this.expectToken("=");
      var func = this.parseExpr();
      this.visitExpr(func, (expr) => {
        if (isLookup(expr) && expr.name.startsWith("FN")) {
          if (!this.fnrefs[lexpr.name])
            this.fnrefs[lexpr.name] = [];
          this.fnrefs[lexpr.name].push(expr.name);
        }
      });
      this.checkCallGraph(lexpr.name, new Set());
      return { command: "DEF", lexpr, def: func };
    }
    stmt__SUB() {
      var lexpr = this.parseVarSubscriptOrFunc();
      this.markVarDefs(lexpr);
      this.addLabel(lexpr.name, 1);
      return { command: "SUB", lexpr };
    }
    stmt__CALL() {
      return { command: "CALL", call: this.parseVarSubscriptOrFunc() };
    }
    markVarDefs(lexpr) {
      this.vardefs[lexpr.name] = lexpr;
      if (lexpr.args != null)
        for (let arg of lexpr.args) {
          if (isLookup(arg) && arg.args == null)
            this.vardefs[arg.name] = arg;
          else
            this.compileError(`A definition can only define symbols, not expressions.`);
        }
    }
    checkCallGraph(name, visited) {
      if (visited.has(name))
        this.compileError(`There was a cycle in the function definition graph for ${name}.`);
      visited.add(name);
      var refs = this.fnrefs[name] || [];
      for (var ref2 of refs)
        this.checkCallGraph(ref2, visited);
      visited.delete(name);
    }
    stmt__POP() {
      return { command: "POP" };
    }
    stmt__GET() {
      var lexpr = this.parseLexpr();
      return { command: "GET", lexpr };
    }
    stmt__CLEAR() {
      return { command: "CLEAR" };
    }
    stmt__RANDOMIZE() {
      return { command: "RANDOMIZE" };
    }
    stmt__CHANGE() {
      var src = this.parseExpr();
      this.expectToken("TO");
      var dest = this.parseLexpr();
      if (dest.valtype == src.valtype)
        this.compileError(`CHANGE can only convert strings to numeric arrays, or vice-versa.`, mergeLocs(src.$loc, dest.$loc));
      return { command: "CHANGE", src, dest };
    }
    stmt__CONVERT() {
      var src = this.parseExpr();
      this.expectToken("TO");
      var dest = this.parseLexpr();
      if (dest.valtype == src.valtype)
        this.compileError(`CONVERT can only convert strings to numbers, or vice-versa.`, mergeLocs(src.$loc, dest.$loc));
      return { command: "CONVERT", src, dest };
    }
    stmt__OPTION() {
      this.optionCount++;
      var tokname = this.consumeToken();
      var optname = tokname.str.toUpperCase();
      if (tokname.type != 5)
        this.compileError(`There must be a name after the OPTION statement.`);
      var tokarg = this.consumeToken();
      var arg = tokarg.str.toUpperCase();
      switch (optname) {
        case "DIALECT":
          if (this.optionCount > 1)
            this.compileError(`OPTION DIALECT must be the first OPTION statement in the file.`, tokname.$loc);
          let dname = arg || "";
          if (dname == "")
            this.compileError(`OPTION DIALECT requires a dialect name.`, tokname.$loc);
          let dialect = DIALECTS[dname.toUpperCase()];
          if (dialect)
            this.opts = dialect;
          else
            this.compileError(`${dname} is not a valid dialect.`);
          break;
        case "BASE":
          let base = parseInt(arg);
          if (base == 0 || base == 1)
            this.opts.defaultArrayBase = base;
          else
            this.compileError("OPTION BASE can only be 0 or 1.");
          break;
        case "CPUSPEED":
          if (!(this.opts.commandsPerSec = Math.min(1e7, arg == "MAX" ? Infinity : parseFloat(arg))))
            this.compileError(`OPTION CPUSPEED takes a positive number or MAX.`);
          break;
        default:
          let propname = Object.getOwnPropertyNames(this.opts).find((n2) => n2.toUpperCase() == optname);
          if (propname == null)
            this.compileError(`${optname} is not a valid option.`, tokname.$loc);
          if (arg == null)
            this.compileError(`OPTION ${optname} requires a parameter.`);
          switch (typeof this.opts[propname]) {
            case "boolean":
              this.opts[propname] = arg.toUpperCase().startsWith("T") || arg > 0;
              return;
            case "number":
              this.opts[propname] = parseFloat(arg);
              return;
            case "string":
              this.opts[propname] = arg;
              return;
            case "object":
              if (Array.isArray(this.opts[propname]) && arg == "ALL") {
                this.opts[propname] = null;
                return;
              }
              this.compileError(`OPTION ${optname} ALL is the only option supported.`);
          }
          break;
      }
      return { command: "OPTION", optname, optargs: [arg] };
    }
    generateListing(file2, program) {
      var srclines = [];
      var laststmt;
      program.stmts.forEach((stmt, idx) => {
        laststmt = stmt;
        srclines.push(stmt.$loc);
      });
      if (this.opts.endStmtRequired && (laststmt == null || laststmt.command != "END"))
        this.dialectError(`All programs must have a final END statement`);
      return { lines: srclines };
    }
    getListings() {
      return this.listings;
    }
    checkAll(program) {
      this.checkLabels();
      this.checkScopes();
      this.checkVarRefs();
    }
    checkLabels() {
      for (let targ in this.targets) {
        if (this.labels[targ] == null) {
          var what = this.opts.optionalLabels && isNaN(parseInt(targ)) ? "label named" : "line number";
          this.addError(`There isn't a ${what} ${targ}.`, this.targets[targ]);
        }
      }
    }
    checkScopes() {
      if (this.opts.compiledBlocks && this.scopestack.length) {
        var open = this.stmts[this.scopestack.pop()];
        var close = { FOR: "NEXT", WHILE: "WEND", IF: "END IF", SUB: "END SUB" };
        this.compileError(`Don't forget to add a matching ${close[open.command]} statement.`, open.$loc);
      }
    }
    checkVarRefs() {
      if (!this.opts.defaultValues) {
        for (var varname in this.varrefs) {
          if (this.vardefs[varname] == null)
            this.compileError(`The variable ${varname} isn't defined anywhere in the program.`, this.varrefs[varname]);
        }
      }
    }
  };
  var ECMA55_MINIMAL = {
    dialectName: "ECMA55",
    asciiOnly: true,
    uppercaseOnly: true,
    optionalLabels: false,
    optionalWhitespace: false,
    multipleStmtsPerLine: false,
    varNaming: "A1",
    staticArrays: true,
    sharedArrayNamespace: true,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: false,
    stringConcat: false,
    maxDimensions: 2,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
      "BASE",
      "DATA",
      "DEF",
      "DIM",
      "END",
      "FOR",
      "GO",
      "GOSUB",
      "GOTO",
      "IF",
      "INPUT",
      "LET",
      "NEXT",
      "ON",
      "OPTION",
      "PRINT",
      "RANDOMIZE",
      "READ",
      "REM",
      "RESTORE",
      "RETURN",
      "STEP",
      "STOP",
      "THEN",
      "TO"
    ],
    validFunctions: [
      "ABS",
      "ATN",
      "COS",
      "EXP",
      "INT",
      "LOG",
      "RND",
      "SGN",
      "SIN",
      "SQR",
      "TAB",
      "TAN"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^"
    ],
    printZoneLength: 15,
    numericPadding: true,
    checkOverflow: true,
    testInitialFor: true,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: true,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: true,
    chainAssignments: false,
    optionalLet: false,
    compiledBlocks: true
  };
  var DARTMOUTH_4TH_EDITION = {
    dialectName: "DARTMOUTH4",
    asciiOnly: true,
    uppercaseOnly: true,
    optionalLabels: false,
    optionalWhitespace: false,
    multipleStmtsPerLine: false,
    varNaming: "A1",
    staticArrays: true,
    sharedArrayNamespace: false,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: false,
    stringConcat: false,
    maxDimensions: 2,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: true,
    hexOctalConsts: false,
    validKeywords: [
      "BASE",
      "DATA",
      "DEF",
      "DIM",
      "END",
      "FOR",
      "GO",
      "GOSUB",
      "GOTO",
      "IF",
      "INPUT",
      "LET",
      "NEXT",
      "ON",
      "OPTION",
      "PRINT",
      "RANDOMIZE",
      "READ",
      "REM",
      "RESTORE",
      "RETURN",
      "STEP",
      "STOP",
      "THEN",
      "TO",
      "CHANGE",
      "MAT",
      "RANDOM",
      "RESTORE$",
      "RESTORE*"
    ],
    validFunctions: [
      "ABS",
      "ATN",
      "COS",
      "EXP",
      "INT",
      "LOG",
      "RND",
      "SGN",
      "SIN",
      "SQR",
      "TAB",
      "TAN",
      "TRN",
      "INV",
      "DET",
      "NUM",
      "ZER"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^"
    ],
    printZoneLength: 15,
    numericPadding: true,
    checkOverflow: true,
    testInitialFor: true,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: true,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: true,
    chainAssignments: true,
    optionalLet: false,
    compiledBlocks: true
  };
  var TINY_BASIC = {
    dialectName: "TINY",
    asciiOnly: true,
    uppercaseOnly: true,
    optionalLabels: false,
    optionalWhitespace: false,
    multipleStmtsPerLine: false,
    varNaming: "A",
    staticArrays: false,
    sharedArrayNamespace: true,
    defaultArrayBase: 0,
    defaultArraySize: 0,
    defaultValues: true,
    stringConcat: false,
    maxDimensions: 0,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
      "OPTION",
      "PRINT",
      "IF",
      "THEN",
      "GOTO",
      "INPUT",
      "LET",
      "GOSUB",
      "RETURN",
      "CLEAR",
      "END"
    ],
    validFunctions: [],
    validOperators: [
      "=",
      "<>",
      "><",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/"
    ],
    printZoneLength: 1,
    numericPadding: false,
    checkOverflow: false,
    testInitialFor: false,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: false,
    computedGoto: true,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: false,
    compiledBlocks: false
  };
  var HP_TIMESHARED_BASIC = {
    dialectName: "HP2000",
    asciiOnly: true,
    uppercaseOnly: true,
    optionalLabels: false,
    optionalWhitespace: false,
    multipleStmtsPerLine: true,
    varNaming: "A1$",
    staticArrays: true,
    sharedArrayNamespace: false,
    defaultArrayBase: 1,
    defaultArraySize: 11,
    defaultValues: false,
    stringConcat: false,
    maxDimensions: 2,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
      "BASE",
      "DATA",
      "DEF",
      "DIM",
      "END",
      "FOR",
      "GO",
      "GOSUB",
      "GOTO",
      "IF",
      "INPUT",
      "LET",
      "NEXT",
      "OPTION",
      "PRINT",
      "RANDOMIZE",
      "READ",
      "REM",
      "RESTORE",
      "RETURN",
      "STEP",
      "STOP",
      "THEN",
      "TO",
      "ENTER",
      "MAT",
      "CONVERT",
      "OF",
      "IMAGE",
      "USING"
    ],
    validFunctions: [
      "ABS",
      "ATN",
      "BRK",
      "COS",
      "CTL",
      "EXP",
      "INT",
      "LEN",
      "LIN",
      "LOG",
      "NUM",
      "POS",
      "RND",
      "SGN",
      "SIN",
      "SPA",
      "SQR",
      "TAB",
      "TAN",
      "TIM",
      "TYP",
      "UPS$",
      "NFORMAT$"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^",
      "**",
      "#",
      "NOT",
      "AND",
      "OR",
      "MIN",
      "MAX"
    ],
    printZoneLength: 15,
    numericPadding: true,
    checkOverflow: false,
    testInitialFor: true,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: false,
    computedGoto: true,
    restoreWithLabel: true,
    squareBrackets: true,
    arraysContainChars: true,
    endStmtRequired: true,
    chainAssignments: true,
    optionalLet: true,
    compiledBlocks: true,
    maxArrayElements: 5e3
  };
  var DEC_BASIC_11 = {
    dialectName: "DEC11",
    asciiOnly: true,
    uppercaseOnly: true,
    optionalLabels: false,
    optionalWhitespace: false,
    multipleStmtsPerLine: false,
    varNaming: "A1",
    staticArrays: true,
    sharedArrayNamespace: false,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: true,
    stringConcat: true,
    maxDimensions: 2,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
      "OPTION",
      "DATA",
      "DEF",
      "DIM",
      "END",
      "FOR",
      "STEP",
      "GOSUB",
      "GOTO",
      "GO",
      "TO",
      "IF",
      "THEN",
      "INPUT",
      "LET",
      "NEXT",
      "ON",
      "PRINT",
      "RANDOMIZE",
      "READ",
      "REM",
      "RESET",
      "RESTORE",
      "RETURN",
      "STOP"
    ],
    validFunctions: [
      "ABS",
      "ATN",
      "COS",
      "EXP",
      "INT",
      "LOG",
      "LOG10",
      "PI",
      "RND",
      "SGN",
      "SIN",
      "SQR",
      "TAB",
      "ASC",
      "BIN",
      "CHR$",
      "CLK$",
      "DAT$",
      "LEN",
      "OCT",
      "POS",
      "SEG$",
      "STR$",
      "TRM$",
      "VAL",
      "NFORMAT$"
    ],
    validOperators: [
      "=",
      "<>",
      "><",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^"
    ],
    printZoneLength: 14,
    numericPadding: true,
    checkOverflow: true,
    testInitialFor: true,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: true,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: true,
    compiledBlocks: true
  };
  var DEC_BASIC_PLUS = {
    dialectName: "DECPLUS",
    asciiOnly: true,
    uppercaseOnly: false,
    optionalLabels: false,
    optionalWhitespace: false,
    multipleStmtsPerLine: true,
    varNaming: "A1",
    staticArrays: true,
    sharedArrayNamespace: false,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: true,
    stringConcat: true,
    maxDimensions: 2,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: true,
    hexOctalConsts: false,
    validKeywords: [
      "OPTION",
      "REM",
      "LET",
      "DIM",
      "RANDOM",
      "RANDOMIZE",
      "IF",
      "THEN",
      "ELSE",
      "FOR",
      "TO",
      "STEP",
      "WHILE",
      "UNTIL",
      "NEXT",
      "DEF",
      "ON",
      "GOTO",
      "GOSUB",
      "RETURN",
      "CHANGE",
      "READ",
      "DATA",
      "RESTORE",
      "PRINT",
      "USING",
      "INPUT",
      "LINE",
      "NAME",
      "AS",
      "ERROR",
      "RESUME",
      "CHAIN",
      "STOP",
      "END",
      "MAT",
      "UNLESS",
      "SLEEP",
      "WAIT"
    ],
    validFunctions: [
      "ABS",
      "ATN",
      "COS",
      "EXP",
      "INT",
      "LOG",
      "LOG10",
      "PI",
      "RND",
      "SGN",
      "SIN",
      "SQR",
      "TAB",
      "TAN",
      "POS",
      "TAB",
      "ASCII",
      "CHR$",
      "CVT%$",
      "CVTF$",
      "CVT$%",
      "CVT$F",
      "LEFT$",
      "RIGHT$",
      "MID$",
      "LEN",
      "INSTR",
      "SPACE$",
      "NUM$",
      "VAL",
      "XLATE",
      "DATE$",
      "TIME$",
      "TIME",
      "ERR",
      "ERL",
      "SWAP%",
      "RAD$",
      "NFORMAT$"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^",
      "**",
      "==",
      "NOT",
      "AND",
      "OR",
      "XOR",
      "IMP",
      "EQV"
    ],
    printZoneLength: 14,
    numericPadding: true,
    checkOverflow: true,
    testInitialFor: true,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: true,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: true,
    compiledBlocks: true
  };
  var BASICODE = {
    dialectName: "BASICODE",
    asciiOnly: true,
    uppercaseOnly: false,
    optionalLabels: false,
    optionalWhitespace: true,
    multipleStmtsPerLine: true,
    varNaming: "AA",
    staticArrays: true,
    sharedArrayNamespace: false,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: false,
    stringConcat: true,
    maxDimensions: 2,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
      "BASE",
      "DATA",
      "DEF",
      "DIM",
      "END",
      "FOR",
      "GO",
      "GOSUB",
      "GOTO",
      "IF",
      "INPUT",
      "LET",
      "NEXT",
      "ON",
      "OPTION",
      "PRINT",
      "READ",
      "REM",
      "RESTORE",
      "RETURN",
      "STEP",
      "STOP",
      "THEN",
      "TO",
      "AND",
      "NOT",
      "OR"
    ],
    validFunctions: [
      "ABS",
      "ASC",
      "ATN",
      "CHR$",
      "COS",
      "EXP",
      "INT",
      "LEFT$",
      "LEN",
      "LOG",
      "MID$",
      "RIGHT$",
      "SGN",
      "SIN",
      "SQR",
      "TAB",
      "TAN",
      "VAL"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^",
      "AND",
      "NOT",
      "OR"
    ],
    printZoneLength: 15,
    numericPadding: true,
    checkOverflow: true,
    testInitialFor: true,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: true,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: true,
    compiledBlocks: false
  };
  var ALTAIR_BASIC41 = {
    dialectName: "ALTAIR41",
    asciiOnly: true,
    uppercaseOnly: true,
    optionalLabels: false,
    optionalWhitespace: true,
    multipleStmtsPerLine: true,
    varNaming: "*",
    staticArrays: false,
    sharedArrayNamespace: true,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: true,
    stringConcat: true,
    maxDimensions: 128,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
      "OPTION",
      "CONSOLE",
      "DATA",
      "DEF",
      "DEFUSR",
      "DIM",
      "END",
      "ERASE",
      "ERROR",
      "FOR",
      "GOTO",
      "GOSUB",
      "IF",
      "THEN",
      "ELSE",
      "INPUT",
      "LET",
      "LINE",
      "PRINT",
      "LPRINT",
      "USING",
      "NEXT",
      "ON",
      "OUT",
      "POKE",
      "READ",
      "REM",
      "RESTORE",
      "RESUME",
      "RETURN",
      "STOP",
      "SWAP",
      "TROFF",
      "TRON",
      "WAIT",
      "TO",
      "STEP",
      "AND",
      "NOT",
      "OR",
      "XOR",
      "IMP",
      "EQV",
      "MOD",
      "RANDOMIZE"
    ],
    validFunctions: [
      "ABS",
      "ASC",
      "ATN",
      "CDBL",
      "CHR$",
      "CINT",
      "COS",
      "ERL",
      "ERR",
      "EXP",
      "FIX",
      "FRE",
      "HEX$",
      "INP",
      "INSTR",
      "INT",
      "LEFT$",
      "LEN",
      "LOG",
      "LPOS",
      "MID$",
      "OCT$",
      "POS",
      "RIGHT$",
      "RND",
      "SGN",
      "SIN",
      "SPACE$",
      "SPC",
      "SQR",
      "STR$",
      "STRING$",
      "TAB",
      "TAN",
      "USR",
      "VAL",
      "VARPTR"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^",
      "\\",
      "AND",
      "NOT",
      "OR",
      "XOR",
      "IMP",
      "EQV",
      "MOD"
    ],
    printZoneLength: 15,
    numericPadding: true,
    checkOverflow: true,
    testInitialFor: false,
    optionalNextVar: true,
    multipleNextVars: true,
    bitwiseLogic: true,
    checkOnGotoIndex: false,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: true,
    compiledBlocks: false
  };
  var APPLESOFT_BASIC = {
    dialectName: "APPLESOFT",
    asciiOnly: true,
    uppercaseOnly: false,
    optionalLabels: false,
    optionalWhitespace: true,
    multipleStmtsPerLine: true,
    varNaming: "*",
    staticArrays: false,
    sharedArrayNamespace: false,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: true,
    stringConcat: true,
    maxDimensions: 88,
    maxDefArgs: 1,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
      "OPTION",
      "CLEAR",
      "LET",
      "DIM",
      "DEF",
      "GOTO",
      "GOSUB",
      "RETURN",
      "ON",
      "POP",
      "FOR",
      "NEXT",
      "IF",
      "THEN",
      "END",
      "STOP",
      "ONERR",
      "RESUME",
      "PRINT",
      "INPUT",
      "GET",
      "HOME",
      "HTAB",
      "VTAB",
      "INVERSE",
      "FLASH",
      "NORMAL",
      "TEXT",
      "GR",
      "COLOR",
      "PLOT",
      "HLIN",
      "VLIN",
      "HGR",
      "HGR2",
      "HPLOT",
      "HCOLOR",
      "AT",
      "DATA",
      "READ",
      "RESTORE",
      "REM",
      "TRACE",
      "NOTRACE",
      "TO",
      "STEP",
      "AND",
      "NOT",
      "OR"
    ],
    validFunctions: [
      "ABS",
      "ATN",
      "COS",
      "EXP",
      "INT",
      "LOG",
      "RND",
      "SGN",
      "SIN",
      "SQR",
      "TAN",
      "LEN",
      "LEFT$",
      "MID$",
      "RIGHT$",
      "STR$",
      "VAL",
      "CHR$",
      "ASC",
      "FRE",
      "SCRN",
      "PDL",
      "PEEK",
      "POS"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^",
      "AND",
      "NOT",
      "OR"
    ],
    printZoneLength: 16,
    numericPadding: false,
    checkOverflow: true,
    testInitialFor: false,
    optionalNextVar: true,
    multipleNextVars: true,
    bitwiseLogic: false,
    checkOnGotoIndex: false,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: true,
    compiledBlocks: false
  };
  var BASIC80 = {
    dialectName: "BASIC80",
    asciiOnly: true,
    uppercaseOnly: false,
    optionalLabels: false,
    optionalWhitespace: true,
    multipleStmtsPerLine: true,
    varNaming: "*",
    staticArrays: false,
    sharedArrayNamespace: true,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: true,
    stringConcat: true,
    maxDimensions: 255,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: true,
    hexOctalConsts: true,
    validKeywords: [
      "OPTION",
      "CONSOLE",
      "DATA",
      "DEF",
      "DEFUSR",
      "DIM",
      "END",
      "ERASE",
      "ERROR",
      "FOR",
      "GOTO",
      "GOSUB",
      "IF",
      "THEN",
      "ELSE",
      "INPUT",
      "LET",
      "LINE",
      "PRINT",
      "LPRINT",
      "USING",
      "NEXT",
      "ON",
      "OUT",
      "POKE",
      "READ",
      "REM",
      "RESTORE",
      "RESUME",
      "RETURN",
      "STOP",
      "SWAP",
      "TROFF",
      "TRON",
      "WAIT",
      "CALL",
      "CHAIN",
      "COMMON",
      "WHILE",
      "WEND",
      "WRITE",
      "RANDOMIZE",
      "TO",
      "STEP",
      "AND",
      "NOT",
      "OR",
      "XOR",
      "IMP",
      "EQV",
      "MOD"
    ],
    validFunctions: [
      "ABS",
      "ASC",
      "ATN",
      "CDBL",
      "CHR$",
      "CINT",
      "COS",
      "CSNG",
      "CVI",
      "CVS",
      "CVD",
      "EOF",
      "EXP",
      "FIX",
      "FRE",
      "HEX$",
      "INP",
      "INPUT$",
      "INSTR",
      "INT",
      "LEFT$",
      "LEN",
      "LOC",
      "LOG",
      "LPOS",
      "MID$",
      "MKI$",
      "MKS$",
      "MKD$",
      "OCT$",
      "PEEK",
      "POS",
      "RIGHT$",
      "RND",
      "SGN",
      "SIN",
      "SPACE$",
      "SPC",
      "SQR",
      "STR$",
      "STRING$",
      "TAB",
      "TAN",
      "USR",
      "VAL",
      "VARPTR"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^",
      "\\",
      "AND",
      "NOT",
      "OR",
      "XOR",
      "IMP",
      "EQV",
      "MOD"
    ],
    printZoneLength: 14,
    numericPadding: true,
    checkOverflow: false,
    testInitialFor: true,
    optionalNextVar: true,
    multipleNextVars: true,
    bitwiseLogic: true,
    checkOnGotoIndex: false,
    computedGoto: false,
    restoreWithLabel: true,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: true,
    compiledBlocks: false
  };
  var MODERN_BASIC = {
    dialectName: "MODERN",
    asciiOnly: false,
    uppercaseOnly: false,
    optionalLabels: true,
    optionalWhitespace: false,
    multipleStmtsPerLine: true,
    varNaming: "*",
    staticArrays: false,
    sharedArrayNamespace: false,
    defaultArrayBase: 0,
    defaultArraySize: 0,
    defaultValues: false,
    stringConcat: true,
    maxDimensions: 255,
    maxDefArgs: 255,
    maxStringLength: 2048,
    tickComments: true,
    hexOctalConsts: true,
    validKeywords: null,
    validFunctions: null,
    validOperators: null,
    printZoneLength: 16,
    numericPadding: false,
    checkOverflow: true,
    testInitialFor: true,
    optionalNextVar: true,
    multipleNextVars: true,
    bitwiseLogic: true,
    checkOnGotoIndex: true,
    computedGoto: false,
    restoreWithLabel: true,
    squareBrackets: true,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: true,
    optionalLet: true,
    compiledBlocks: true,
    multilineIfThen: true
  };
  var BUILTIN_DEFS = [
    ["ABS", ["number"], "number"],
    ["ASC", ["string"], "number"],
    ["ATN", ["number"], "number"],
    ["CHR$", ["number"], "string"],
    ["CINT", ["number"], "number"],
    ["COS", ["number"], "number"],
    ["COT", ["number"], "number"],
    ["CTL", ["number"], "string"],
    ["EXP", ["number"], "number"],
    ["FIX", ["number"], "number"],
    ["HEX$", ["number"], "string"],
    ["INSTR", ["number", "string", "string"], "number"],
    ["INSTR", ["string", "string"], "number"],
    ["INT", ["number"], "number"],
    ["LEFT$", ["string", "number"], "string"],
    ["LEN", ["string"], "number"],
    ["LIN", ["number"], "string"],
    ["LOG", ["number"], "number"],
    ["LOG10", ["number"], "number"],
    ["MID$", ["string", "number"], "string"],
    ["MID$", ["string", "number", "number"], "string"],
    ["OCT$", ["number"], "string"],
    ["PI", [], "number"],
    ["POS", ["number"], "number"],
    ["POS", ["string", "string"], "number"],
    ["RIGHT$", ["string", "number"], "string"],
    ["RND", [], "number"],
    ["RND", ["number"], "number"],
    ["ROUND", ["number"], "number"],
    ["SGN", ["number"], "number"],
    ["SIN", ["number"], "number"],
    ["SPACE$", ["number"], "string"],
    ["SPC", ["number"], "string"],
    ["SQR", ["number"], "number"],
    ["STR$", ["number"], "string"],
    ["STRING$", ["number", "number"], "string"],
    ["STRING$", ["number", "string"], "string"],
    ["TAB", ["number"], "string"],
    ["TAN", ["number"], "number"],
    ["TIM", ["number"], "number"],
    ["TIMER", [], "number"],
    ["UPS$", ["string"], "string"],
    ["VAL", ["string"], "number"],
    ["LPAD$", ["string", "number"], "string"],
    ["RPAD$", ["string", "number"], "string"],
    ["NFORMAT$", ["number", "number"], "string"]
  ];
  var BUILTIN_MAP = {};
  BUILTIN_DEFS.forEach((def, idx) => {
    let [name, args, result] = def;
    if (!BUILTIN_MAP[name])
      BUILTIN_MAP[name] = [];
    BUILTIN_MAP[name].push({ args, result });
  });
  var DIALECTS = {
    "DEFAULT": MODERN_BASIC,
    "DARTMOUTH": DARTMOUTH_4TH_EDITION,
    "DARTMOUTH4": DARTMOUTH_4TH_EDITION,
    "ALTAIR": ALTAIR_BASIC41,
    "ALTAIR4": ALTAIR_BASIC41,
    "ALTAIR41": ALTAIR_BASIC41,
    "TINY": TINY_BASIC,
    "ECMA55": ECMA55_MINIMAL,
    "MINIMAL": ECMA55_MINIMAL,
    "HP": HP_TIMESHARED_BASIC,
    "HPB": HP_TIMESHARED_BASIC,
    "HPTSB": HP_TIMESHARED_BASIC,
    "HP2000": HP_TIMESHARED_BASIC,
    "HPBASIC": HP_TIMESHARED_BASIC,
    "HPACCESS": HP_TIMESHARED_BASIC,
    "DEC11": DEC_BASIC_11,
    "DEC": DEC_BASIC_PLUS,
    "DECPLUS": DEC_BASIC_PLUS,
    "BASICPLUS": DEC_BASIC_PLUS,
    "BASICODE": BASICODE,
    "APPLESOFT": APPLESOFT_BASIC,
    "BASIC80": BASIC80,
    "MODERN": MODERN_BASIC
  };

  // src/worker/tools/misc.ts
  function translateShowdown(step) {
    setupRequireFunction();
    load("showdown.min");
    var showdown = emglobal["showdown"];
    var converter = new showdown.Converter({
      tables: "true",
      smoothLivePreview: "true",
      requireSpaceBeforeHeadingText: "true",
      emoji: "true"
    });
    var code = getWorkFileAsString(step.path);
    var html = converter.makeHtml(code);
    delete emglobal["require"];
    return {
      output: html
    };
  }
  function compileInform6(step) {
    loadNative("inform");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.inf" });
    var objpath = step.prefix + ".z5";
    if (staleFiles(step, [objpath])) {
      var errorMatcher = msvcErrorMatcher(errors);
      var lstout = "";
      var match_fn = (s) => {
        if (s.indexOf("Error:") >= 0) {
          errorMatcher(s);
        } else {
          lstout += s;
          lstout += "\n";
        }
      };
      var args = ["-afjnops", "-v5", "-Cu", "-E1", "-k", "+/share/lib", step.path];
      var inform = emglobal.inform({
        instantiateWasm: moduleInstFn("inform"),
        noInitialRun: true,
        print: match_fn,
        printErr: match_fn
      });
      var FS = inform.FS;
      setupFS(FS, "inform");
      populateFiles(step, FS);
      execMain(step, inform, args);
      if (errors.length)
        return { errors };
      var objout = FS.readFile(objpath, { encoding: "binary" });
      putWorkFile(objpath, objout);
      if (!anyTargetChanged(step, [objpath]))
        return;
      var symbolmap = {};
      var segments = [];
      var entitymap = {
        "object": {},
        "property": {},
        "attribute": {},
        "constant": {},
        "global-variable": {},
        "routine": {}
      };
      var dbgout = FS.readFile("gameinfo.dbg", { encoding: "utf8" });
      var xmlroot = parseXMLPoorly(dbgout);
      var segtype = "ram";
      xmlroot.children.forEach((node) => {
        switch (node.type) {
          case "global-variable":
          case "routine":
            var ident = node.children.find((c, v) => c.type == "identifier").text;
            var address = parseInt(node.children.find((c, v) => c.type == "address").text);
            symbolmap[ident] = address;
            entitymap[node.type][address] = ident;
            break;
          case "object":
          case "property":
          case "attribute":
            var ident = node.children.find((c, v) => c.type == "identifier").text;
            var value = parseInt(node.children.find((c, v) => c.type == "value").text);
            entitymap[node.type][value] = ident;
            break;
          case "story-file-section":
            var name = node.children.find((c, v) => c.type == "type").text;
            var address = parseInt(node.children.find((c, v) => c.type == "address").text);
            var endAddress = parseInt(node.children.find((c, v) => c.type == "end-address").text);
            if (name == "grammar table")
              segtype = "rom";
            segments.push({ name, start: address, size: endAddress - address, type: segtype });
        }
      });
      var listings = {};
      var lines = parseListing(lstout, /\s*(\d+)\s+[+]([0-9a-f]+)\s+([<*>]*)\s*(\w+)\s+(.+)/i, -1, 2, 4);
      var lstpath = step.prefix + ".lst";
      listings[lstpath] = { lines: [], asmlines: lines, text: lstout };
      return {
        output: objout,
        listings,
        errors,
        symbolmap,
        segments,
        debuginfo: entitymap
      };
    }
  }
  function compileBASIC(step) {
    var jsonpath = step.path + ".json";
    gatherFiles(step);
    if (staleFiles(step, [jsonpath])) {
      var parser = new BASICParser();
      var code = getWorkFileAsString(step.path);
      try {
        var ast = parser.parseFile(code, step.path);
      } catch (e) {
        console.log(e);
        if (parser.errors.length == 0)
          throw e;
      }
      if (parser.errors.length) {
        return { errors: parser.errors };
      }
      var json = JSON.stringify(ast, (key2, value) => {
        return key2 == "$loc" ? void 0 : value;
      });
      putWorkFile(jsonpath, json);
      if (anyTargetChanged(step, [jsonpath]))
        return {
          output: ast,
          listings: parser.getListings()
        };
    }
  }
  function compileWiz(step) {
    loadNative("wiz");
    var params = step.params;
    gatherFiles(step, { mainFilePath: "main.wiz" });
    var destpath = step.prefix + (params.wiz_rom_ext || ".bin");
    var errors = [];
    if (staleFiles(step, [destpath])) {
      var wiz = emglobal.wiz({
        instantiateWasm: moduleInstFn("wiz"),
        noInitialRun: true,
        print: print_fn,
        printErr: makeErrorMatcher(errors, /(.+?):(\d+):\s*(.+)/, 2, 3, step.path, 1)
      });
      var FS = wiz.FS;
      setupFS(FS, "wiz");
      populateFiles(step, FS);
      populateExtraFiles(step, FS, params.extra_compile_files);
      const FWDIR = "/share/common";
      var args = [
        "-o",
        destpath,
        "-I",
        FWDIR + "/" + (params.wiz_inc_dir || step.platform),
        "-s",
        "wla",
        "--color=none",
        step.path
      ];
      args.push("--system", params.wiz_sys_type || params.arch);
      execMain(step, wiz, args);
      if (errors.length)
        return { errors };
      var binout = FS.readFile(destpath, { encoding: "binary" });
      putWorkFile(destpath, binout);
      var dbgout = FS.readFile(step.prefix + ".sym", { encoding: "utf8" });
      var symbolmap = {};
      for (var s of dbgout.split("\n")) {
        var toks = s.split(/ /);
        if (toks && toks.length >= 2) {
          var tokrange = toks[0].split(":");
          var start = parseInt(tokrange[1], 16);
          var sym = toks[1];
          symbolmap[sym] = start;
        }
      }
      return {
        output: binout,
        errors,
        symbolmap
      };
    }
  }

  // src/worker/tools/cc65.ts
  function parseCA65Listing(code, symbols, params, dbg) {
    var segofs = 0;
    var offset2 = 0;
    var dbgLineMatch = /^([0-9A-F]+)([r]?)\s+(\d+)\s+[.]dbg\s+(\w+), "([^"]+)", (.+)/;
    var funcLineMatch = /"(\w+)", (\w+), "(\w+)"/;
    var insnLineMatch = /^([0-9A-F]+)([r]?)\s{1,2}(\d+)\s{1,2}([0-9A-Frx ]{11})\s+(.*)/;
    var segMatch = /[.]segment\s+"(\w+)"/i;
    var lines = [];
    var linenum = 0;
    for (var line of code.split(re_crlf)) {
      var dbgm = dbgLineMatch.exec(line);
      if (dbgm && dbgm[1]) {
        var dbgtype = dbgm[4];
        offset2 = parseInt(dbgm[1], 16);
        if (dbgtype == "func") {
          var funcm = funcLineMatch.exec(dbgm[6]);
          if (funcm) {
            var funcofs = symbols[funcm[3]];
            if (typeof funcofs === "number") {
              segofs = funcofs - offset2;
            }
          }
        }
      }
      if (dbg && dbgm && dbgtype == "line") {
        lines.push({
          line: parseInt(dbgm[6]),
          offset: offset2 + segofs,
          insns: null
        });
      }
      var linem = insnLineMatch.exec(line);
      var topfile = linem && linem[3] == "1";
      if (topfile)
        linenum++;
      if (topfile && linem[1]) {
        var offset2 = parseInt(linem[1], 16);
        var insns = linem[4].trim();
        if (insns.length) {
          if (linem[5].length == 0) {
            linenum--;
          } else if (!dbg) {
            lines.push({
              line: linenum,
              offset: offset2 + segofs,
              insns,
              iscode: true
            });
          }
        } else {
          var sym = linem[5];
          var segm = sym && segMatch.exec(sym);
          if (segm && segm[1]) {
            var symofs = symbols["__" + segm[1] + "_RUN__"];
            if (typeof symofs === "number") {
              segofs = symofs;
            }
          } else if (sym.endsWith(":") && !sym.startsWith("@")) {
            var symofs = symbols[sym.substring(0, sym.length - 1)];
            if (typeof symofs === "number") {
              segofs = symofs - offset2;
            }
          }
        }
      }
    }
    return lines;
  }
  function assembleCA65(step) {
    loadNative("ca65");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.s" });
    var objpath = step.prefix + ".o";
    var lstpath = step.prefix + ".lst";
    if (staleFiles(step, [objpath, lstpath])) {
      var objout, lstout;
      var CA65 = emglobal.ca65({
        instantiateWasm: moduleInstFn("ca65"),
        noInitialRun: true,
        print: print_fn,
        printErr: makeErrorMatcher(errors, /(.+?):(\d+): (.+)/, 2, 3, step.path, 1)
      });
      var FS = CA65.FS;
      setupFS(FS, "65-" + getRootBasePlatform(step.platform));
      populateFiles(step, FS);
      fixParamsWithDefines(step.path, step.params);
      var args = ["-v", "-g", "-I", "/share/asminc", "-o", objpath, "-l", lstpath, step.path];
      args.unshift.apply(args, ["-D", "__8BITWORKSHOP__=1"]);
      if (step.mainfile) {
        args.unshift.apply(args, ["-D", "__MAIN__=1"]);
      }
      execMain(step, CA65, args);
      if (errors.length)
        return { errors };
      objout = FS.readFile(objpath, { encoding: "binary" });
      lstout = FS.readFile(lstpath, { encoding: "utf8" });
      putWorkFile(objpath, objout);
      putWorkFile(lstpath, lstout);
    }
    return {
      linktool: "ld65",
      files: [objpath, lstpath],
      args: [objpath]
    };
  }
  function linkLD65(step) {
    loadNative("ld65");
    var params = step.params;
    gatherFiles(step);
    var binpath = "main";
    if (staleFiles(step, [binpath])) {
      var errors = [];
      var LD65 = emglobal.ld65({
        instantiateWasm: moduleInstFn("ld65"),
        noInitialRun: true,
        print: print_fn,
        printErr: function(s2) {
          errors.push({ msg: s2, line: 0 });
        }
      });
      var FS = LD65.FS;
      setupFS(FS, "65-" + getRootBasePlatform(step.platform));
      populateFiles(step, FS);
      populateExtraFiles(step, FS, params.extra_link_files);
      if (store.hasFile(params.cfgfile)) {
        populateEntry(FS, params.cfgfile, store.getFileEntry(params.cfgfile), null);
      }
      var libargs = params.libargs || [];
      var cfgfile = params.cfgfile;
      var args = [
        "--cfg-path",
        "/share/cfg",
        "--lib-path",
        "/share/lib",
        "-C",
        cfgfile,
        "-Ln",
        "main.vice",
        "-o",
        "main",
        "-m",
        "main.map"
      ].concat(step.args, libargs);
      execMain(step, LD65, args);
      if (errors.length)
        return { errors };
      var aout = FS.readFile("main", { encoding: "binary" });
      var mapout = FS.readFile("main.map", { encoding: "utf8" });
      var viceout = FS.readFile("main.vice", { encoding: "utf8" });
      putWorkFile("main", aout);
      putWorkFile("main.map", mapout);
      putWorkFile("main.vice", viceout);
      if (!anyTargetChanged(step, ["main", "main.map", "main.vice"]))
        return;
      var symbolmap = {};
      for (var s of viceout.split("\n")) {
        var toks = s.split(" ");
        if (toks[0] == "al") {
          let ident = toks[2].substr(1);
          if (ident.length != 5 || !ident.startsWith("L")) {
            let ofs = parseInt(toks[1], 16);
            symbolmap[ident] = ofs;
          }
        }
      }
      var seg_re = /^__(\w+)_SIZE__$/;
      var segments = [];
      segments.push({ name: "CPU Stack", start: 256, size: 256, type: "ram" });
      segments.push({ name: "CPU Vectors", start: 65530, size: 6, type: "rom" });
      for (let ident in symbolmap) {
        let m = seg_re.exec(ident);
        if (m) {
          let seg = m[1];
          let segstart = symbolmap["__" + seg + "_RUN__"] || symbolmap["__" + seg + "_START__"];
          let segsize = symbolmap["__" + seg + "_SIZE__"];
          let seglast = symbolmap["__" + seg + "_LAST__"];
          if (segstart >= 0 && segsize > 0 && !seg.startsWith("PRG") && seg != "RAM") {
            var type = null;
            if (seg.startsWith("CODE") || seg == "STARTUP" || seg == "RODATA" || seg.endsWith("ROM"))
              type = "rom";
            else if (seg == "ZP" || seg == "DATA" || seg == "BSS" || seg.endsWith("RAM"))
              type = "ram";
            segments.push({ name: seg, start: segstart, size: segsize, last: seglast, type });
          }
        }
      }
      var listings = {};
      for (var fn of step.files) {
        if (fn.endsWith(".lst")) {
          var lstout = FS.readFile(fn, { encoding: "utf8" });
          lstout = lstout.split("\n\n")[1] || lstout;
          var asmlines = parseCA65Listing(lstout, symbolmap, params, false);
          var srclines = parseCA65Listing(lstout, symbolmap, params, true);
          putWorkFile(fn, lstout);
          listings[fn] = {
            asmlines: srclines.length ? asmlines : null,
            lines: srclines.length ? srclines : asmlines,
            text: lstout
          };
        }
      }
      return {
        output: aout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }
  function compileCC65(step) {
    loadNative("cc65");
    var params = step.params;
    var re_err1 = /(.*?):(\d+): (.+)/;
    var errors = [];
    var errline = 0;
    function match_fn(s) {
      console.log(s);
      var matches = re_err1.exec(s);
      if (matches) {
        errline = parseInt(matches[2]);
        errors.push({
          line: errline,
          msg: matches[3],
          path: matches[1]
        });
      }
    }
    gatherFiles(step, { mainFilePath: "main.c" });
    var destpath = step.prefix + ".s";
    if (staleFiles(step, [destpath])) {
      var CC65 = emglobal.cc65({
        instantiateWasm: moduleInstFn("cc65"),
        noInitialRun: true,
        print: print_fn,
        printErr: match_fn
      });
      var FS = CC65.FS;
      setupFS(FS, "65-" + getRootBasePlatform(step.platform));
      populateFiles(step, FS);
      fixParamsWithDefines(step.path, params);
      var args = [
        "-I",
        "/share/include",
        "-I",
        ".",
        "-D",
        "__8BITWORKSHOP__"
      ];
      if (params.define) {
        params.define.forEach((x) => args.push("-D" + x));
      }
      if (step.mainfile) {
        args.unshift.apply(args, ["-D", "__MAIN__"]);
      }
      var customArgs = params.extra_compiler_args || ["-T", "-g", "-Oirs", "-Cl", "-W", "-pointer-sign,-no-effect"];
      args = args.concat(customArgs, args);
      args.push(step.path);
      execMain(step, CC65, args);
      if (errors.length)
        return { errors };
      var asmout = FS.readFile(destpath, { encoding: "utf8" });
      putWorkFile(destpath, asmout);
    }
    return {
      nexttool: "ca65",
      path: destpath,
      args: [destpath],
      files: [destpath]
    };
  }

  // src/worker/tools/dasm.ts
  function parseDASMListing(lstpath, lsttext, listings, errors, unresolved) {
    let lineMatch = /\s*(\d+)\s+(\S+)\s+([0-9a-f]+)\s+([?0-9a-f][?0-9a-f ]+)?\s+(.+)?/i;
    let equMatch = /\bequ\b/i;
    let macroMatch = /\bMAC\s+(\S+)?/i;
    let lastline = 0;
    let macros = {};
    let lstline = 0;
    let lstlist = listings[lstpath];
    for (let line of lsttext.split(re_crlf)) {
      lstline++;
      let linem = lineMatch.exec(line + "    ");
      if (linem && linem[1] != null) {
        let linenum = parseInt(linem[1]);
        let filename = linem[2];
        let offset2 = parseInt(linem[3], 16);
        let insns = linem[4];
        let restline = linem[5];
        if (insns && insns.startsWith("?"))
          insns = null;
        if (lstlist && lstlist.lines) {
          lstlist.lines.push({
            line: lstline,
            offset: offset2,
            insns,
            iscode: true
          });
        }
        let lst = listings[filename];
        if (lst) {
          var lines = lst.lines;
          let macmatch = macroMatch.exec(restline);
          if (macmatch) {
            macros[macmatch[1]] = { line: parseInt(linem[1]), file: linem[2].toLowerCase() };
          } else if (insns && restline && !restline.match(equMatch)) {
            lines.push({
              line: linenum,
              offset: offset2,
              insns,
              iscode: restline[0] != "."
            });
          }
          lastline = linenum;
        } else {
          let mac = macros[filename.toLowerCase()];
          if (mac && linenum == 0) {
            lines.push({
              line: lastline + 1,
              offset: offset2,
              insns,
              iscode: true
            });
          }
          if (insns && mac) {
            let maclst = listings[mac.file];
            if (maclst && maclst.lines) {
              maclst.lines.push({
                path: mac.file,
                line: mac.line + linenum,
                offset: offset2,
                insns,
                iscode: true
              });
            }
          } else {
            if (insns && linem[3] && lastline > 0) {
              lines.push({
                line: lastline + 1,
                offset: offset2,
                insns: null
              });
            }
          }
        }
        for (let key2 in unresolved) {
          let l = restline || line;
          let pos = l.indexOf(key2);
          if (pos >= 0) {
            let cmt = l.indexOf(";");
            if (cmt < 0 || cmt > pos) {
              if (new RegExp("\\b" + key2 + "\\b").exec(l)) {
                errors.push({
                  path: filename,
                  line: linenum,
                  msg: "Unresolved symbol '" + key2 + "'"
                });
              }
            }
          }
        }
      }
      let errm = re_msvc.exec(line);
      if (errm) {
        errors.push({
          path: errm[1],
          line: parseInt(errm[2]),
          msg: errm[4]
        });
      }
    }
  }
  function assembleDASM(step) {
    load("dasm");
    var re_usl = /(\w+)\s+0000\s+[?][?][?][?]/;
    var unresolved = {};
    var errors = [];
    var errorMatcher = msvcErrorMatcher(errors);
    function match_fn(s2) {
      var matches = re_usl.exec(s2);
      if (matches) {
        var key2 = matches[1];
        if (key2 != "NO_ILLEGAL_OPCODES") {
          unresolved[matches[1]] = 0;
        }
      } else if (s2.startsWith("Warning:")) {
        errors.push({ line: 0, msg: s2.substr(9) });
      } else if (s2.startsWith("unable ")) {
        errors.push({ line: 0, msg: s2 });
      } else if (s2.startsWith("segment: ")) {
        errors.push({ line: 0, msg: "Segment overflow: " + s2.substring(9) });
      } else if (s2.toLowerCase().indexOf("error:") >= 0) {
        errors.push({ line: 0, msg: s2.trim() });
      } else {
        errorMatcher(s2);
      }
    }
    var Module = emglobal.DASM({
      noInitialRun: true,
      print: match_fn
    });
    var FS = Module.FS;
    populateFiles(step, FS, {
      mainFilePath: "main.a"
    });
    var binpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".sym";
    execMain(step, Module, [
      step.path,
      "-f3",
      "-l" + lstpath,
      "-o" + binpath,
      "-s" + sympath
    ]);
    var alst = FS.readFile(lstpath, { "encoding": "utf8" });
    var listings = {};
    for (let path of step.files) {
      listings[path] = { lines: [] };
    }
    parseDASMListing(lstpath, alst, listings, errors, unresolved);
    if (errors.length) {
      return { errors };
    }
    var aout, asym;
    aout = FS.readFile(binpath);
    try {
      asym = FS.readFile(sympath, { "encoding": "utf8" });
    } catch (e) {
      console.log(e);
      errors.push({ line: 0, msg: "No symbol table generated, maybe segment overflow?" });
      return { errors };
    }
    putWorkFile(binpath, aout);
    putWorkFile(lstpath, alst);
    putWorkFile(sympath, asym);
    if (!anyTargetChanged(step, [binpath]))
      return;
    var symbolmap = {};
    for (var s of asym.split("\n")) {
      var toks = s.split(/\s+/);
      if (toks && toks.length >= 2 && !toks[0].startsWith("-")) {
        symbolmap[toks[0]] = parseInt(toks[1], 16);
      }
    }
    if (step["bblines"]) {
      let lst = listings[step.path];
      if (lst) {
        lst.asmlines = lst.lines;
        lst.text = alst;
        lst.lines = [];
      }
    }
    return {
      output: aout,
      listings,
      errors,
      symbolmap
    };
  }
  function preprocessBatariBasic(code) {
    load("bbpreprocess");
    var bbout = "";
    function addbbout_fn(s) {
      bbout += s;
      bbout += "\n";
    }
    var BBPRE = emglobal.preprocess({
      noInitialRun: true,
      print: addbbout_fn,
      printErr: print_fn,
      noFSInit: true
    });
    var FS = BBPRE.FS;
    setupStdin(FS, code);
    BBPRE.callMain([]);
    console.log("preprocess " + code.length + " -> " + bbout.length + " bytes");
    return bbout;
  }
  function compileBatariBasic(step) {
    load("bb2600basic");
    var params = step.params;
    var asmout = "";
    function addasmout_fn(s) {
      asmout += s;
      asmout += "\n";
    }
    var re_err1 = /[(](\d+)[)]:?\s*(.+)/;
    var errors = [];
    var errline = 0;
    function match_fn(s) {
      console.log(s);
      var matches = re_err1.exec(s);
      if (matches) {
        errline = parseInt(matches[1]);
        errors.push({
          line: errline,
          msg: matches[2]
        });
      }
    }
    gatherFiles(step, { mainFilePath: "main.bas" });
    var destpath = step.prefix + ".asm";
    if (staleFiles(step, [destpath])) {
      var BB = emglobal.bb2600basic({
        noInitialRun: true,
        print: addasmout_fn,
        printErr: match_fn,
        noFSInit: true,
        TOTAL_MEMORY: 64 * 1024 * 1024
      });
      var FS = BB.FS;
      populateFiles(step, FS);
      var code = getWorkFileAsString(step.path);
      code = preprocessBatariBasic(code);
      setupStdin(FS, code);
      setupFS(FS, "2600basic");
      execMain(step, BB, ["-i", "/share", step.path]);
      if (errors.length)
        return { errors };
      var includesout = FS.readFile("includes.bB", { encoding: "utf8" });
      var redefsout = FS.readFile("2600basic_variable_redefs.h", { encoding: "utf8" });
      var includes = includesout.trim().split("\n");
      var combinedasm = "";
      var splitasm = asmout.split("bB.asm file is split here");
      for (var incfile of includes) {
        var inctext;
        if (incfile == "bB.asm")
          inctext = splitasm[0];
        else if (incfile == "bB2.asm")
          inctext = splitasm[1];
        else
          inctext = FS.readFile("/share/includes/" + incfile, { encoding: "utf8" });
        console.log(incfile, inctext.length);
        combinedasm += "\n\n;;;" + incfile + "\n\n";
        combinedasm += inctext;
      }
      putWorkFile(destpath, combinedasm);
      putWorkFile("2600basic.h", FS.readFile("/share/includes/2600basic.h"));
      putWorkFile("2600basic_variable_redefs.h", redefsout);
    }
    return {
      nexttool: "dasm",
      path: destpath,
      args: [destpath],
      files: [destpath, "2600basic.h", "2600basic_variable_redefs.h"],
      bblines: true
    };
  }

  // src/worker/tools/sdcc.ts
  function hexToArray(s, ofs) {
    var buf = new ArrayBuffer(s.length / 2);
    var arr = new Uint8Array(buf);
    for (var i = 0; i < arr.length; i++) {
      arr[i] = parseInt(s.slice(i * 2 + ofs, i * 2 + ofs + 2), 16);
    }
    return arr;
  }
  function parseIHX(ihx, rom_start, rom_size, errors) {
    var output = new Uint8Array(new ArrayBuffer(rom_size));
    var high_size = 0;
    for (var s of ihx.split("\n")) {
      if (s[0] == ":") {
        var arr = hexToArray(s, 1);
        var count = arr[0];
        var address = (arr[1] << 8) + arr[2] - rom_start;
        var rectype = arr[3];
        if (rectype == 0) {
          for (var i = 0; i < count; i++) {
            var b = arr[4 + i];
            output[i + address] = b;
          }
          if (i + address > high_size)
            high_size = i + address;
        } else if (rectype == 1) {
          break;
        } else {
          console.log(s);
        }
      }
    }
    if (high_size > rom_size) {
    }
    return output;
  }
  function assembleSDASZ80(step) {
    loadNative("sdasz80");
    var objout, lstout, symout;
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.asm" });
    var objpath = step.prefix + ".rel";
    var lstpath = step.prefix + ".lst";
    if (staleFiles(step, [objpath, lstpath])) {
      var match_asm_re1 = / in line (\d+) of (\S+)/;
      var match_asm_re2 = / <\w> (.+)/;
      var errline = 0;
      var errpath = step.path;
      var match_asm_fn = (s) => {
        var m = match_asm_re1.exec(s);
        if (m) {
          errline = parseInt(m[1]);
          errpath = m[2];
        } else {
          m = match_asm_re2.exec(s);
          if (m) {
            errors.push({
              line: errline,
              path: errpath,
              msg: m[1]
            });
          }
        }
      };
      var ASZ80 = emglobal.sdasz80({
        instantiateWasm: moduleInstFn("sdasz80"),
        noInitialRun: true,
        print: match_asm_fn,
        printErr: match_asm_fn
      });
      var FS = ASZ80.FS;
      populateFiles(step, FS);
      execMain(step, ASZ80, ["-plosgffwy", step.path]);
      if (errors.length) {
        return { errors };
      }
      objout = FS.readFile(objpath, { encoding: "utf8" });
      lstout = FS.readFile(lstpath, { encoding: "utf8" });
      putWorkFile(objpath, objout);
      putWorkFile(lstpath, lstout);
    }
    return {
      linktool: "sdldz80",
      files: [objpath, lstpath],
      args: [objpath]
    };
  }
  function linkSDLDZ80(step) {
    loadNative("sdldz80");
    var errors = [];
    gatherFiles(step);
    var binpath = "main.ihx";
    if (staleFiles(step, [binpath])) {
      var match_aslink_re = /\?ASlink-(\w+)-(.+)/;
      var match_aslink_fn = (s2) => {
        var matches = match_aslink_re.exec(s2);
        if (matches) {
          errors.push({
            line: 0,
            msg: matches[2]
          });
        }
      };
      var params = step.params;
      var LDZ80 = emglobal.sdldz80({
        instantiateWasm: moduleInstFn("sdldz80"),
        noInitialRun: true,
        print: match_aslink_fn,
        printErr: match_aslink_fn
      });
      var FS = LDZ80.FS;
      setupFS(FS, "sdcc");
      populateFiles(step, FS);
      populateExtraFiles(step, FS, params.extra_link_files);
      if (step.platform.startsWith("coleco")) {
        FS.writeFile("crt0.rel", FS.readFile("/share/lib/coleco/crt0.rel", { encoding: "utf8" }));
        FS.writeFile("crt0.lst", "\n");
      }
      var args = [
        "-mjwxyu",
        "-i",
        "main.ihx",
        "-b",
        "_CODE=0x" + params.code_start.toString(16),
        "-b",
        "_DATA=0x" + params.data_start.toString(16),
        "-k",
        "/share/lib/z80",
        "-l",
        "z80"
      ];
      if (params.extra_link_args)
        args.push.apply(args, params.extra_link_args);
      args.push.apply(args, step.args);
      execMain(step, LDZ80, args);
      var hexout = FS.readFile("main.ihx", { encoding: "utf8" });
      var noiout = FS.readFile("main.noi", { encoding: "utf8" });
      putWorkFile("main.ihx", hexout);
      putWorkFile("main.noi", noiout);
      if (!anyTargetChanged(step, ["main.ihx", "main.noi"]))
        return;
      var binout = parseIHX(hexout, params.rom_start !== void 0 ? params.rom_start : params.code_start, params.rom_size, errors);
      if (errors.length) {
        return { errors };
      }
      var listings = {};
      for (var fn of step.files) {
        if (fn.endsWith(".lst")) {
          var rstout = FS.readFile(fn.replace(".lst", ".rst"), { encoding: "utf8" });
          var asmlines = parseListing(rstout, /^\s*([0-9A-F]{4})\s+([0-9A-F][0-9A-F r]*[0-9A-F])\s+\[([0-9 ]+)\]?\s+(\d+) (.*)/i, 4, 1, 2, 3);
          var srclines = parseSourceLines(rstout, /^\s+\d+ ;<stdin>:(\d+):/i, /^\s*([0-9A-F]{4})/i);
          putWorkFile(fn, rstout);
          listings[fn] = {
            asmlines: srclines.length ? asmlines : null,
            lines: srclines.length ? srclines : asmlines,
            text: rstout
          };
        }
      }
      var symbolmap = {};
      for (var s of noiout.split("\n")) {
        var toks = s.split(" ");
        if (toks[0] == "DEF" && !toks[1].startsWith("A$")) {
          symbolmap[toks[1]] = parseInt(toks[2], 16);
        }
      }
      var seg_re = /^s__(\w+)$/;
      var segments = [];
      for (let ident in symbolmap) {
        let m = seg_re.exec(ident);
        if (m) {
          let seg = m[1];
          let segstart = symbolmap[ident];
          let segsize = symbolmap["l__" + seg];
          if (segstart >= 0 && segsize > 0) {
            var type = null;
            if (["INITIALIZER", "GSINIT", "GSFINAL"].includes(seg))
              type = "rom";
            else if (seg.startsWith("CODE"))
              type = "rom";
            else if (["DATA", "INITIALIZED"].includes(seg))
              type = "ram";
            if (type == "rom" || segstart > 0)
              segments.push({ name: seg, start: segstart, size: segsize, type });
          }
        }
      }
      return {
        output: binout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }
  function compileSDCC(step) {
    gatherFiles(step, {
      mainFilePath: "main.c"
    });
    var outpath = step.prefix + ".asm";
    if (staleFiles(step, [outpath])) {
      var errors = [];
      var params = step.params;
      loadNative("sdcc");
      var SDCC = emglobal.sdcc({
        instantiateWasm: moduleInstFn("sdcc"),
        noInitialRun: true,
        noFSInit: true,
        print: print_fn,
        printErr: msvcErrorMatcher(errors)
      });
      var FS = SDCC.FS;
      populateFiles(step, FS);
      var code = getWorkFileAsString(step.path);
      var preproc = preprocessMCPP(step, "sdcc");
      if (preproc.errors) {
        return { errors: preproc.errors };
      } else
        code = preproc.code;
      setupStdin(FS, code);
      setupFS(FS, "sdcc");
      var args = [
        "--vc",
        "--std-sdcc99",
        "-mz80",
        "--c1mode",
        "--less-pedantic",
        "-o",
        outpath
      ];
      if (!/^\s*#pragma\s+opt_code/m.exec(code)) {
        args.push.apply(args, [
          "--oldralloc",
          "--no-peep",
          "--nolospre"
        ]);
      }
      if (params.extra_compile_args) {
        args.push.apply(args, params.extra_compile_args);
      }
      execMain(step, SDCC, args);
      if (errors.length) {
        return { errors };
      }
      var asmout = FS.readFile(outpath, { encoding: "utf8" });
      asmout = " .area _HOME\n .area _CODE\n .area _INITIALIZER\n .area _DATA\n .area _INITIALIZED\n .area _BSEG\n .area _BSS\n .area _HEAP\n" + asmout;
      putWorkFile(outpath, asmout);
    }
    return {
      nexttool: "sdasz80",
      path: outpath,
      args: [outpath],
      files: [outpath]
    };
  }

  // src/worker/assembler.ts
  var isError = (o) => o.error !== void 0;
  function hex2(v, nd) {
    try {
      if (!nd)
        nd = 2;
      if (nd == 8) {
        return hex2(v >> 16 & 65535, 4) + hex2(v & 65535, 4);
      }
      var s = v.toString(16).toUpperCase();
      while (s.length < nd)
        s = "0" + s;
      return s;
    } catch (e) {
      return v + "";
    }
  }
  function stringToData(s) {
    var data3 = [];
    for (var i = 0; i < s.length; i++) {
      data3[i] = s.charCodeAt(i);
    }
    return data3;
  }
  var Assembler = class {
    constructor(spec) {
      this.ip = 0;
      this.origin = 0;
      this.linenum = 0;
      this.symbols = {};
      this.errors = [];
      this.outwords = [];
      this.asmlines = [];
      this.fixups = [];
      this.width = 8;
      this.codelen = 0;
      this.aborted = false;
      this.spec = spec;
      if (spec) {
        this.preprocessRules();
      }
    }
    rule2regex(rule, vars) {
      var s = rule.fmt;
      if (!s || !(typeof s === "string"))
        throw Error('Each rule must have a "fmt" string field');
      if (!rule.bits || !(rule.bits instanceof Array))
        throw Error('Each rule must have a "bits" array field');
      var varlist = [];
      rule.prefix = s.split(/\s+/)[0];
      s = s.replace(/\+/g, "\\+");
      s = s.replace(/\*/g, "\\*");
      s = s.replace(/\s+/g, "\\s+");
      s = s.replace(/\[/g, "\\[");
      s = s.replace(/\]/g, "\\]");
      s = s.replace(/\(/g, "\\(");
      s = s.replace(/\)/g, "\\)");
      s = s.replace(/\./g, "\\.");
      s = s.replace(/~\w+/g, (varname) => {
        varname = varname.substr(1);
        var v = vars[varname];
        varlist.push(varname);
        if (!v)
          throw Error('Could not find variable definition for "~' + varname + '"');
        else if (v.toks)
          return "(\\w+)";
        else
          return "([0-9]+|[$][0-9a-f]+|\\w+)";
      });
      try {
        rule.re = new RegExp("^" + s + "$", "i");
      } catch (e) {
        throw Error('Bad regex for rule "' + rule.fmt + '": /' + s + "/ -- " + e);
      }
      rule.varlist = varlist;
      return rule;
    }
    preprocessRules() {
      if (this.spec.width) {
        this.width = this.spec.width || 8;
      }
      for (var rule of this.spec.rules) {
        this.rule2regex(rule, this.spec.vars);
      }
    }
    warning(msg, line) {
      this.errors.push({ msg, line: line ? line : this.linenum });
    }
    fatal(msg, line) {
      this.warning(msg, line);
      this.aborted = true;
    }
    fatalIf(msg, line) {
      if (msg)
        this.fatal(msg, line);
    }
    addBytes(result) {
      this.asmlines.push({
        line: this.linenum,
        offset: this.ip,
        nbits: result.nbits
      });
      var op = result.opcode;
      var nb = result.nbits / this.width;
      for (var i = 0; i < nb; i++) {
        if (this.width < 32)
          this.outwords[this.ip++ - this.origin] = op >> (nb - 1 - i) * this.width & (1 << this.width) - 1;
        else
          this.outwords[this.ip++ - this.origin] = op;
      }
    }
    addWords(data3) {
      this.asmlines.push({
        line: this.linenum,
        offset: this.ip,
        nbits: this.width * data3.length
      });
      for (var i = 0; i < data3.length; i++) {
        if (this.width < 32)
          this.outwords[this.ip++ - this.origin] = data3[i] & (1 << this.width) - 1;
        else
          this.outwords[this.ip++ - this.origin] = data3[i];
      }
    }
    parseData(toks) {
      var data3 = [];
      for (var i = 0; i < toks.length; i++) {
        data3[i] = this.parseConst(toks[i]);
      }
      return data3;
    }
    alignIP(align) {
      if (align < 1 || align > this.codelen)
        this.fatal("Invalid alignment value");
      else
        this.ip = Math.floor((this.ip + align - 1) / align) * align;
    }
    parseConst(s, nbits) {
      if (s && s[0] == "$")
        return parseInt(s.substr(1), 16);
      else
        return parseInt(s);
    }
    swapEndian(x, nbits) {
      var y = 0;
      while (nbits > 0) {
        var n2 = Math.min(nbits, this.width);
        var mask = (1 << n2) - 1;
        y <<= n2;
        y |= x & mask;
        x >>>= n2;
        nbits -= n2;
      }
      return y;
    }
    buildInstruction(rule, m) {
      var opcode = 0;
      var oplen = 0;
      for (let b of rule.bits) {
        let n2, x;
        if (typeof b === "string") {
          n2 = b.length;
          x = parseInt(b, 2);
        } else {
          var index = typeof b === "number" ? b : b.a;
          var id = m[index + 1];
          var v = this.spec.vars[rule.varlist[index]];
          if (!v) {
            return { error: `Could not find matching identifier for '${m[0]}' index ${index}` };
          }
          n2 = v.bits;
          var shift = 0;
          if (typeof b !== "number") {
            n2 = b.n;
            shift = b.b;
          }
          if (v.toks) {
            x = v.toks.indexOf(id);
            if (x < 0)
              return { error: "Can't use '" + id + "' here, only one of: " + v.toks.join(", ") };
          } else {
            x = this.parseConst(id, n2);
            if (isNaN(x)) {
              this.fixups.push({
                sym: id,
                ofs: this.ip,
                size: v.bits,
                line: this.linenum,
                dstlen: n2,
                dstofs: oplen,
                srcofs: shift,
                endian: v.endian,
                iprel: !!v.iprel,
                ipofs: v.ipofs + 0,
                ipmul: v.ipmul || 1
              });
              x = 0;
            } else {
              var mask = (1 << v.bits) - 1;
              if ((x & mask) != x)
                return { error: "Value " + x + " does not fit in " + v.bits + " bits" };
            }
          }
          if (v.endian == "little")
            x = this.swapEndian(x, v.bits);
          if (typeof b !== "number") {
            x = x >>> shift & (1 << b.n) - 1;
          }
        }
        opcode = opcode << n2 | x;
        oplen += n2;
      }
      if (oplen == 0)
        this.warning("Opcode had zero length");
      else if (oplen > 32)
        this.warning("Opcodes > 32 bits not supported");
      else if (oplen % this.width != 0)
        this.warning("Opcode was not word-aligned (" + oplen + " bits)");
      return { opcode, nbits: oplen };
    }
    loadArch(arch) {
      if (this.loadJSON) {
        var json = this.loadJSON(arch + ".json");
        if (json && json.vars && json.rules) {
          this.spec = json;
          this.preprocessRules();
        } else {
          return "Could not load arch file '" + arch + ".json'";
        }
      }
    }
    parseDirective(tokens) {
      var cmd = tokens[0].toLowerCase();
      if (cmd == ".define")
        this.symbols[tokens[1].toLowerCase()] = { value: tokens[2] };
      else if (cmd == ".org")
        this.ip = this.origin = parseInt(tokens[1]);
      else if (cmd == ".len")
        this.codelen = parseInt(tokens[1]);
      else if (cmd == ".width")
        this.width = parseInt(tokens[1]);
      else if (cmd == ".arch")
        this.fatalIf(this.loadArch(tokens[1]));
      else if (cmd == ".include")
        this.fatalIf(this.loadInclude(tokens[1]));
      else if (cmd == ".module")
        this.fatalIf(this.loadModule(tokens[1]));
      else if (cmd == ".data")
        this.addWords(this.parseData(tokens.slice(1)));
      else if (cmd == ".string")
        this.addWords(stringToData(tokens.slice(1).join(" ")));
      else if (cmd == ".align")
        this.alignIP(this.parseConst(tokens[1]));
      else
        this.warning("Unrecognized directive: " + tokens);
    }
    assemble(line) {
      this.linenum++;
      line = line.replace(/[;].*/g, "").trim();
      if (line[0] == ".") {
        var tokens = line.split(/\s+/);
        this.parseDirective(tokens);
        return;
      }
      line = line.toLowerCase();
      line = line.replace(/(\w+):/, (_label, label) => {
        this.symbols[label] = { value: this.ip };
        return "";
      });
      line = line.trim();
      if (line == "")
        return;
      if (!this.spec) {
        this.fatal("Need to load .arch first");
        return;
      }
      var lastError;
      for (var rule of this.spec.rules) {
        var m = rule.re.exec(line);
        if (m) {
          var result = this.buildInstruction(rule, m);
          if (!isError(result)) {
            this.addBytes(result);
            return result;
          } else {
            lastError = result.error;
          }
        }
      }
      this.warning(lastError ? lastError : "Could not decode instruction: " + line);
    }
    applyFixup(fix, sym) {
      var ofs = fix.ofs + Math.floor(fix.dstofs / this.width);
      var mask = (1 << fix.size) - 1;
      var value = this.parseConst(sym.value + "", fix.dstlen);
      if (fix.iprel)
        value = (value - fix.ofs) * fix.ipmul - fix.ipofs;
      if (fix.srcofs == 0 && (value > mask || value < -mask))
        this.warning("Symbol " + fix.sym + " (" + value + ") does not fit in " + fix.dstlen + " bits", fix.line);
      if (fix.srcofs > 0)
        value >>>= fix.srcofs;
      value &= (1 << fix.dstlen) - 1;
      if (this.width == 32) {
        var shift = 32 - fix.dstofs - fix.dstlen;
        value <<= shift;
      }
      if (fix.size <= this.width) {
        this.outwords[ofs - this.origin] ^= value;
      } else {
        if (fix.endian == "big")
          value = this.swapEndian(value, fix.size);
        while (value) {
          if (value & this.outwords[ofs - this.origin]) {
            this.warning("Instruction bits overlapped: " + hex2(this.outwords[ofs - this.origin], 8), hex2(value, 8));
          } else {
            this.outwords[ofs - this.origin] ^= value & (1 << this.width) - 1;
          }
          value >>>= this.width;
          ofs++;
        }
      }
    }
    finish() {
      for (var i = 0; i < this.fixups.length; i++) {
        var fix = this.fixups[i];
        var sym = this.symbols[fix.sym];
        if (sym) {
          this.applyFixup(fix, sym);
        } else {
          this.warning("Symbol '" + fix.sym + "' not found");
        }
      }
      for (var i = 0; i < this.asmlines.length; i++) {
        var al = this.asmlines[i];
        al.insns = "";
        for (var j = 0; j < al.nbits / this.width; j++) {
          var word = this.outwords[al.offset + j - this.origin];
          if (j > 0)
            al.insns += " ";
          al.insns += hex2(word, this.width / 4);
        }
      }
      while (this.outwords.length < this.codelen) {
        this.outwords.push(0);
      }
      this.fixups = [];
      return this.state();
    }
    assembleFile(text) {
      var lines = text.split(/\n/g);
      for (var i = 0; i < lines.length && !this.aborted; i++) {
        try {
          this.assemble(lines[i]);
        } catch (e) {
          console.log(e);
          this.fatal("Exception during assembly: " + e);
        }
      }
      return this.finish();
    }
    state() {
      return {
        ip: this.ip,
        line: this.linenum,
        origin: this.origin,
        codelen: this.codelen,
        intermediate: {},
        output: this.outwords,
        lines: this.asmlines,
        errors: this.errors,
        fixups: this.fixups
      };
    }
  };

  // src/common/hdl/hdltypes.ts
  function isVarDecl(arg) {
    return typeof arg.isParam !== "undefined";
  }
  function isConstExpr(arg) {
    return typeof arg.cvalue === "number";
  }

  // src/common/hdl/vxmlparser.ts
  var CompileError2 = class extends Error {
    constructor($loc, msg) {
      super(msg);
      this.$loc = $loc;
      Object.setPrototypeOf(this, CompileError2.prototype);
    }
  };
  var VerilogXMLParser = class {
    constructor() {
      this.files = {};
      this.dtypes = {};
      this.modules = {};
      this.hierarchies = {};
      this.cur_deferred = [];
      this.dtypes["QData"] = { left: 63, right: 0, signed: false };
      this.dtypes["IData"] = { left: 31, right: 0, signed: false };
      this.dtypes["SData"] = { left: 15, right: 0, signed: false };
      this.dtypes["CData"] = { left: 7, right: 0, signed: false };
      this.dtypes["byte"] = { left: 7, right: 0, signed: true };
      this.dtypes["shortint"] = { left: 15, right: 0, signed: true };
      this.dtypes["int"] = { left: 31, right: 0, signed: true };
      this.dtypes["integer"] = { left: 31, right: 0, signed: true };
      this.dtypes["longint"] = { left: 63, right: 0, signed: true };
      this.dtypes["time"] = { left: 63, right: 0, signed: false };
    }
    defer(fn) {
      this.cur_deferred.unshift(fn);
    }
    defer2(fn) {
      this.cur_deferred.push(fn);
    }
    run_deferred() {
      this.cur_deferred.forEach((fn) => fn());
      this.cur_deferred = [];
    }
    name2js(s) {
      if (s == null)
        throw new CompileError2(this.cur_loc, `no name`);
      return s.replace(/[^a-z0-9_]/gi, "$");
    }
    findChildren(node, type, required) {
      var arr = node.children.filter((n2) => n2.type == type);
      if (arr.length == 0 && required)
        throw new CompileError2(this.cur_loc, `no child of type ${type}`);
      return arr;
    }
    parseSourceLocation(node) {
      var loc = node.attrs["loc"];
      if (loc) {
        if (loc == this.cur_loc_str) {
          return this.cur_loc;
        } else {
          var [fileid, line, col, end_line, end_col] = loc.split(",");
          var $loc = {
            hdlfile: this.files[fileid],
            path: this.files[fileid].filename,
            line: parseInt(line),
            start: parseInt(col) - 1,
            end_line: parseInt(end_line),
            end: parseInt(end_col) - 1
          };
          this.cur_loc = $loc;
          this.cur_loc_str = loc;
          return $loc;
        }
      } else {
        return null;
      }
    }
    open_module(node) {
      var module2 = {
        $loc: this.parseSourceLocation(node),
        name: node.attrs["name"],
        origName: node.attrs["origName"],
        blocks: [],
        instances: [],
        vardefs: {}
      };
      if (this.cur_module)
        throw new CompileError2(this.cur_loc, `nested modules not supported`);
      this.cur_module = module2;
      return module2;
    }
    deferDataType(node, def) {
      var dtype_id = node.attrs["dtype_id"];
      if (dtype_id != null) {
        this.defer(() => {
          def.dtype = this.dtypes[dtype_id];
          if (!def.dtype) {
            throw new CompileError2(this.cur_loc, `Unknown data type ${dtype_id} for ${node.type}`);
          }
        });
      }
    }
    parseConstValue(s) {
      const re_const = /(\d+)'([s]?)h([0-9a-f]+)/i;
      var m = re_const.exec(s);
      if (m) {
        var numstr = m[3];
        if (numstr.length <= 8)
          return parseInt(numstr, 16);
        else
          return BigInt("0x" + numstr);
      } else {
        throw new CompileError2(this.cur_loc, `could not parse constant "${s}"`);
      }
    }
    resolveVar(s, mod) {
      var def = mod.vardefs[s];
      if (def == null)
        throw new CompileError2(this.cur_loc, `could not resolve variable "${s}"`);
      return def;
    }
    resolveModule(s) {
      var mod = this.modules[s];
      if (mod == null)
        throw new CompileError2(this.cur_loc, `could not resolve module "${s}"`);
      return mod;
    }
    visit_verilator_xml(node) {
    }
    visit_package(node) {
    }
    visit_module(node) {
      this.findChildren(node, "var", false).forEach((n2) => {
        if (isVarDecl(n2.obj)) {
          this.cur_module.vardefs[n2.obj.name] = n2.obj;
        }
      });
      this.modules[this.cur_module.name] = this.cur_module;
      this.cur_module = null;
    }
    visit_var(node) {
      var name = node.attrs["name"];
      name = this.name2js(name);
      var vardef = {
        $loc: this.parseSourceLocation(node),
        name,
        origName: node.attrs["origName"],
        isInput: node.attrs["dir"] == "input",
        isOutput: node.attrs["dir"] == "output",
        isParam: node.attrs["param"] == "true",
        dtype: null
      };
      this.deferDataType(node, vardef);
      var const_nodes = this.findChildren(node, "const", false);
      if (const_nodes.length) {
        vardef.constValue = const_nodes[0].obj;
      }
      var init_nodes = this.findChildren(node, "initarray", false);
      if (init_nodes.length) {
        vardef.initValue = init_nodes[0].obj;
      }
      return vardef;
    }
    visit_const(node) {
      var name = node.attrs["name"];
      var cvalue = this.parseConstValue(name);
      var constdef = {
        $loc: this.parseSourceLocation(node),
        dtype: null,
        cvalue: typeof cvalue === "number" ? cvalue : null,
        bigvalue: typeof cvalue === "bigint" ? cvalue : null
      };
      this.deferDataType(node, constdef);
      return constdef;
    }
    visit_varref(node) {
      var name = node.attrs["name"];
      name = this.name2js(name);
      var varref = {
        $loc: this.parseSourceLocation(node),
        dtype: null,
        refname: name
      };
      this.deferDataType(node, varref);
      var mod = this.cur_module;
      return varref;
    }
    visit_sentree(node) {
    }
    visit_always(node) {
      var sentree;
      var expr;
      if (node.children.length == 2) {
        sentree = node.children[0].obj;
        expr = node.children[1].obj;
      } else {
        sentree = null;
        expr = node.children[0].obj;
      }
      var always = {
        $loc: this.parseSourceLocation(node),
        blocktype: node.type,
        name: null,
        senlist: sentree,
        exprs: [expr]
      };
      this.cur_module.blocks.push(always);
      return always;
    }
    visit_begin(node) {
      var exprs = [];
      node.children.forEach((n2) => exprs.push(n2.obj));
      return {
        $loc: this.parseSourceLocation(node),
        blocktype: node.type,
        name: node.attrs["name"],
        exprs
      };
    }
    visit_initarray(node) {
      return this.visit_begin(node);
    }
    visit_inititem(node) {
      this.expectChildren(node, 1, 1);
      return {
        index: parseInt(node.attrs["index"]),
        expr: node.children[0].obj
      };
    }
    visit_cfunc(node) {
      if (this.cur_module == null) {
        return;
      }
      var block = this.visit_begin(node);
      block.exprs = [];
      node.children.forEach((n2) => block.exprs.push(n2.obj));
      this.cur_module.blocks.push(block);
      return block;
    }
    visit_cuse(node) {
    }
    visit_instance(node) {
      var instance = {
        $loc: this.parseSourceLocation(node),
        name: node.attrs["name"],
        origName: node.attrs["origName"],
        ports: [],
        module: null
      };
      node.children.forEach((child) => {
        instance.ports.push(child.obj);
      });
      this.cur_module.instances.push(instance);
      this.defer(() => {
        instance.module = this.resolveModule(node.attrs["defName"]);
      });
      return instance;
    }
    visit_iface(node) {
      throw new CompileError2(this.cur_loc, `interfaces not supported`);
    }
    visit_intfref(node) {
      throw new CompileError2(this.cur_loc, `interfaces not supported`);
    }
    visit_port(node) {
      this.expectChildren(node, 1, 1);
      var varref = {
        $loc: this.parseSourceLocation(node),
        name: node.attrs["name"],
        expr: node.children[0].obj
      };
      return varref;
    }
    visit_netlist(node) {
    }
    visit_files(node) {
    }
    visit_module_files(node) {
      node.children.forEach((n2) => {
        if (n2.obj) {
          var file2 = this.files[n2.obj.id];
          if (file2)
            file2.isModule = true;
        }
      });
    }
    visit_file(node) {
      return this.visit_file_or_module(node, false);
    }
    visit_scope(node) {
    }
    visit_topscope(node) {
    }
    visit_file_or_module(node, isModule) {
      var file2 = {
        id: node.attrs["id"],
        filename: node.attrs["filename"],
        isModule
      };
      this.files[file2.id] = file2;
      return file2;
    }
    visit_cells(node) {
      this.expectChildren(node, 1, 9999);
      var hier = node.children[0].obj;
      if (hier != null) {
        var hiername = hier.name;
        this.hierarchies[hiername] = hier;
      }
    }
    visit_cell(node) {
      var hier = {
        $loc: this.parseSourceLocation(node),
        name: node.attrs["name"],
        module: null,
        parent: null,
        children: node.children.map((n2) => n2.obj)
      };
      if (node.children.length > 0)
        throw new CompileError2(this.cur_loc, `multiple non-flattened modules not yet supported`);
      node.children.forEach((n2) => n2.obj.parent = hier);
      this.defer(() => {
        hier.module = this.resolveModule(node.attrs["submodname"]);
      });
      return hier;
    }
    visit_basicdtype(node) {
      let id = node.attrs["id"];
      var dtype;
      var dtypename = node.attrs["name"];
      switch (dtypename) {
        case "logic":
        case "integer":
        case "bit":
          let dlogic = {
            $loc: this.parseSourceLocation(node),
            left: parseInt(node.attrs["left"] || "0"),
            right: parseInt(node.attrs["right"] || "0"),
            signed: node.attrs["signed"] == "true"
          };
          dtype = dlogic;
          break;
        case "string":
          let dstring = {
            $loc: this.parseSourceLocation(node),
            jstype: "string"
          };
          dtype = dstring;
          break;
        default:
          dtype = this.dtypes[dtypename];
          if (dtype == null) {
            throw new CompileError2(this.cur_loc, `unknown data type ${dtypename}`);
          }
      }
      this.dtypes[id] = dtype;
      return dtype;
    }
    visit_refdtype(node) {
    }
    visit_enumdtype(node) {
    }
    visit_enumitem(node) {
    }
    visit_packarraydtype(node) {
      return this.visit_unpackarraydtype(node);
    }
    visit_memberdtype(node) {
      throw new CompileError2(null, `structs not supported`);
    }
    visit_constdtype(node) {
    }
    visit_paramtypedtype(node) {
    }
    visit_unpackarraydtype(node) {
      let id = node.attrs["id"];
      let sub_dtype_id = node.attrs["sub_dtype_id"];
      let range = node.children[0].obj;
      if (isConstExpr(range.left) && isConstExpr(range.right)) {
        var dtype = {
          $loc: this.parseSourceLocation(node),
          subtype: null,
          low: range.left,
          high: range.right
        };
        this.dtypes[id] = dtype;
        this.defer(() => {
          dtype.subtype = this.dtypes[sub_dtype_id];
          if (!dtype.subtype)
            throw new CompileError2(this.cur_loc, `Unknown data type ${sub_dtype_id} for array`);
        });
        return dtype;
      } else {
        throw new CompileError2(this.cur_loc, `could not parse constant exprs in array`);
      }
    }
    visit_senitem(node) {
      var edgeType = node.attrs["edgeType"];
      if (edgeType != "POS" && edgeType != "NEG")
        throw new CompileError2(this.cur_loc, "POS/NEG required");
      return {
        $loc: this.parseSourceLocation(node),
        edgeType,
        expr: node.obj
      };
    }
    visit_text(node) {
    }
    visit_cstmt(node) {
    }
    visit_cfile(node) {
    }
    visit_typetable(node) {
    }
    visit_constpool(node) {
    }
    visit_comment(node) {
    }
    expectChildren(node, low, high) {
      if (node.children.length < low || node.children.length > high)
        throw new CompileError2(this.cur_loc, `expected between ${low} and ${high} children`);
    }
    __visit_unop(node) {
      this.expectChildren(node, 1, 1);
      var expr = {
        $loc: this.parseSourceLocation(node),
        op: node.type,
        dtype: null,
        left: node.children[0].obj
      };
      this.deferDataType(node, expr);
      return expr;
    }
    visit_extend(node) {
      var unop = this.__visit_unop(node);
      unop.width = parseInt(node.attrs["width"]);
      unop.widthminv = parseInt(node.attrs["widthminv"]);
      if (unop.width != 32)
        throw new CompileError2(this.cur_loc, `extends width ${unop.width} != 32`);
      return unop;
    }
    visit_extends(node) {
      return this.visit_extend(node);
    }
    __visit_binop(node) {
      this.expectChildren(node, 2, 2);
      var expr = {
        $loc: this.parseSourceLocation(node),
        op: node.type,
        dtype: null,
        left: node.children[0].obj,
        right: node.children[1].obj
      };
      this.deferDataType(node, expr);
      return expr;
    }
    visit_if(node) {
      this.expectChildren(node, 2, 3);
      var expr = {
        $loc: this.parseSourceLocation(node),
        op: "if",
        dtype: null,
        cond: node.children[0].obj,
        left: node.children[1].obj,
        right: node.children[2] && node.children[2].obj
      };
      return expr;
    }
    visit_while(node) {
      this.expectChildren(node, 2, 4);
      var expr = {
        $loc: this.parseSourceLocation(node),
        op: "while",
        dtype: null,
        precond: node.children[0].obj,
        loopcond: node.children[1].obj,
        body: node.children[2] && node.children[2].obj,
        inc: node.children[3] && node.children[3].obj
      };
      return expr;
    }
    __visit_triop(node) {
      this.expectChildren(node, 3, 3);
      var expr = {
        $loc: this.parseSourceLocation(node),
        op: node.type,
        dtype: null,
        cond: node.children[0].obj,
        left: node.children[1].obj,
        right: node.children[2].obj
      };
      this.deferDataType(node, expr);
      return expr;
    }
    __visit_func(node) {
      var expr = {
        $loc: this.parseSourceLocation(node),
        dtype: null,
        funcname: node.attrs["func"] || "$" + node.type,
        args: node.children.map((n2) => n2.obj)
      };
      this.deferDataType(node, expr);
      return expr;
    }
    visit_not(node) {
      return this.__visit_unop(node);
    }
    visit_negate(node) {
      return this.__visit_unop(node);
    }
    visit_redand(node) {
      return this.__visit_unop(node);
    }
    visit_redor(node) {
      return this.__visit_unop(node);
    }
    visit_redxor(node) {
      return this.__visit_unop(node);
    }
    visit_initial(node) {
      return this.__visit_unop(node);
    }
    visit_ccast(node) {
      return this.__visit_unop(node);
    }
    visit_creset(node) {
      return this.__visit_unop(node);
    }
    visit_creturn(node) {
      return this.__visit_unop(node);
    }
    visit_contassign(node) {
      return this.__visit_binop(node);
    }
    visit_assigndly(node) {
      return this.__visit_binop(node);
    }
    visit_assignpre(node) {
      return this.__visit_binop(node);
    }
    visit_assignpost(node) {
      return this.__visit_binop(node);
    }
    visit_assign(node) {
      return this.__visit_binop(node);
    }
    visit_arraysel(node) {
      return this.__visit_binop(node);
    }
    visit_wordsel(node) {
      return this.__visit_binop(node);
    }
    visit_eq(node) {
      return this.__visit_binop(node);
    }
    visit_neq(node) {
      return this.__visit_binop(node);
    }
    visit_lte(node) {
      return this.__visit_binop(node);
    }
    visit_gte(node) {
      return this.__visit_binop(node);
    }
    visit_lt(node) {
      return this.__visit_binop(node);
    }
    visit_gt(node) {
      return this.__visit_binop(node);
    }
    visit_and(node) {
      return this.__visit_binop(node);
    }
    visit_or(node) {
      return this.__visit_binop(node);
    }
    visit_xor(node) {
      return this.__visit_binop(node);
    }
    visit_add(node) {
      return this.__visit_binop(node);
    }
    visit_sub(node) {
      return this.__visit_binop(node);
    }
    visit_concat(node) {
      return this.__visit_binop(node);
    }
    visit_shiftl(node) {
      return this.__visit_binop(node);
    }
    visit_shiftr(node) {
      return this.__visit_binop(node);
    }
    visit_shiftrs(node) {
      return this.__visit_binop(node);
    }
    visit_mul(node) {
      return this.__visit_binop(node);
    }
    visit_div(node) {
      return this.__visit_binop(node);
    }
    visit_moddiv(node) {
      return this.__visit_binop(node);
    }
    visit_muls(node) {
      return this.__visit_binop(node);
    }
    visit_divs(node) {
      return this.__visit_binop(node);
    }
    visit_moddivs(node) {
      return this.__visit_binop(node);
    }
    visit_gts(node) {
      return this.__visit_binop(node);
    }
    visit_lts(node) {
      return this.__visit_binop(node);
    }
    visit_gtes(node) {
      return this.__visit_binop(node);
    }
    visit_ltes(node) {
      return this.__visit_binop(node);
    }
    visit_range(node) {
      return this.__visit_binop(node);
    }
    visit_cond(node) {
      return this.__visit_triop(node);
    }
    visit_condbound(node) {
      return this.__visit_triop(node);
    }
    visit_sel(node) {
      return this.__visit_triop(node);
    }
    visit_changedet(node) {
      if (node.children.length == 0)
        return null;
      else
        return this.__visit_binop(node);
    }
    visit_ccall(node) {
      return this.__visit_func(node);
    }
    visit_finish(node) {
      return this.__visit_func(node);
    }
    visit_stop(node) {
      return this.__visit_func(node);
    }
    visit_rand(node) {
      return this.__visit_func(node);
    }
    visit_time(node) {
      return this.__visit_func(node);
    }
    visit_display(node) {
      return null;
    }
    visit_sformatf(node) {
      return null;
    }
    visit_scopename(node) {
      return null;
    }
    visit_readmem(node) {
      return this.__visit_func(node);
    }
    xml_open(node) {
      this.cur_node = node;
      var method = this[`open_${node.type}`];
      if (method) {
        return method.bind(this)(node);
      }
    }
    xml_close(node) {
      this.cur_node = node;
      var method = this[`visit_${node.type}`];
      if (method) {
        return method.bind(this)(node);
      } else {
        throw new CompileError2(this.cur_loc, `no visitor for ${node.type}`);
      }
    }
    parse(xmls) {
      parseXMLPoorly(xmls, this.xml_open.bind(this), this.xml_close.bind(this));
      this.cur_node = null;
      this.run_deferred();
    }
  };

  // src/worker/tools/verilog.ts
  function detectModuleName(code) {
    var m = /^\s*module\s+(\w+_top)\b/m.exec(code) || /^\s*module\s+(top|t)\b/m.exec(code) || /^\s*module\s+(\w+)\b/m.exec(code);
    return m ? m[1] : null;
  }
  function detectTopModuleName(code) {
    var topmod = detectModuleName(code) || "top";
    var m = /^\s*module\s+(\w+?_top)/m.exec(code);
    if (m && m[1])
      topmod = m[1];
    return topmod;
  }
  var jsasm_module_top;
  var jsasm_module_output;
  var jsasm_module_key;
  function compileJSASM(asmcode, platform, options, is_inline) {
    var asm = new Assembler(null);
    var includes = [];
    asm.loadJSON = (filename) => {
      var jsontext = getWorkFileAsString(filename);
      if (!jsontext)
        throw Error("could not load " + filename);
      return JSON.parse(jsontext);
    };
    asm.loadInclude = (filename) => {
      if (!filename.startsWith('"') || !filename.endsWith('"'))
        return 'Expected filename in "double quotes"';
      filename = filename.substr(1, filename.length - 2);
      includes.push(filename);
    };
    var loaded_module = false;
    asm.loadModule = (top_module) => {
      loaded_module = true;
      var key2 = top_module + "/" + includes;
      if (jsasm_module_key != key2) {
        jsasm_module_key = key2;
        jsasm_module_output = null;
      }
      jsasm_module_top = top_module;
      var main_filename = includes[includes.length - 1];
      var voutput = compileVerilator({ platform, files: includes, path: main_filename, tool: "verilator" });
      if (voutput)
        jsasm_module_output = voutput;
      return null;
    };
    var result = asm.assembleFile(asmcode);
    if (loaded_module && jsasm_module_output) {
      if (jsasm_module_output.errors && jsasm_module_output.errors.length)
        return jsasm_module_output;
      var asmout = result.output;
      result.output = jsasm_module_output.output;
      result.output.program_rom = asmout;
      result.output.program_rom_variable = jsasm_module_top + "$program_rom";
      result.listings = {};
      result.listings[options.path] = { lines: result.lines };
      return result;
    } else {
      return result;
    }
  }
  function compileJSASMStep(step) {
    gatherFiles(step);
    var code = getWorkFileAsString(step.path);
    var platform = step.platform || "verilog";
    return compileJSASM(code, platform, step, false);
  }
  function compileInlineASM(code, platform, options, errors, asmlines) {
    code = code.replace(/__asm\b([\s\S]+?)\b__endasm\b/g, function(s, asmcode, index) {
      var firstline = code.substr(0, index).match(/\n/g).length;
      var asmout = compileJSASM(asmcode, platform, options, true);
      if (asmout.errors && asmout.errors.length) {
        for (var i = 0; i < asmout.errors.length; i++) {
          asmout.errors[i].line += firstline;
          errors.push(asmout.errors[i]);
        }
        return "";
      } else if (asmout.output) {
        let s2 = "";
        var out = asmout.output;
        for (var i = 0; i < out.length; i++) {
          if (i > 0) {
            s2 += ",";
            if ((i & 255) == 0)
              s2 += "\n";
          }
          s2 += 0 | out[i];
        }
        if (asmlines) {
          var al = asmout.lines;
          for (var i = 0; i < al.length; i++) {
            al[i].line += firstline;
            asmlines.push(al[i]);
          }
        }
        return s2;
      }
    });
    return code;
  }
  function compileVerilator(step) {
    loadNative("verilator_bin");
    var platform = step.platform || "verilog";
    var errors = [];
    gatherFiles(step);
    if (staleFiles(step, [xmlPath])) {
      var match_fn = makeErrorMatcher(errors, /%(.+?): (.+?):(\d+)?[:]?\s*(.+)/i, 3, 4, step.path, 2);
      var verilator_mod = emglobal.verilator_bin({
        instantiateWasm: moduleInstFn("verilator_bin"),
        noInitialRun: true,
        noExitRuntime: true,
        print: print_fn,
        printErr: match_fn,
        wasmMemory: getWASMMemory()
      });
      var code = getWorkFileAsString(step.path);
      var topmod = detectTopModuleName(code);
      var FS = verilator_mod.FS;
      var listings = {};
      populateFiles(step, FS, {
        mainFilePath: step.path,
        processFn: (path, code2) => {
          if (typeof code2 === "string") {
            let asmlines = [];
            code2 = compileInlineASM(code2, platform, step, errors, asmlines);
            if (asmlines.length) {
              listings[path] = { lines: asmlines };
            }
          }
          return code2;
        }
      });
      starttime();
      var xmlPath = `obj_dir/V${topmod}.xml`;
      try {
        var args = [
          "--cc",
          "-O3",
          "-DEXT_INLINE_ASM",
          "-DTOPMOD__" + topmod,
          "-D__8BITWORKSHOP__",
          "-Wall",
          "-Wno-DECLFILENAME",
          "-Wno-UNUSED",
          "-Wno-EOFNEWLINE",
          "-Wno-PROCASSWIRE",
          "--x-assign",
          "fast",
          "--noassert",
          "--pins-sc-biguint",
          "--debug-check",
          "--top-module",
          topmod,
          step.path
        ];
        execMain(step, verilator_mod, args);
      } catch (e) {
        console.log(e);
        errors.push({ line: 0, msg: "Compiler internal error: " + e });
      }
      endtime("compile");
      errors = errors.filter(function(e) {
        return !/Exiting due to \d+/.exec(e.msg);
      }, errors);
      errors = errors.filter(function(e) {
        return !/Use ["][/][*]/.exec(e.msg);
      }, errors);
      if (errors.length) {
        return { errors };
      }
      starttime();
      var xmlParser = new VerilogXMLParser();
      try {
        var xmlContent = FS.readFile(xmlPath, { encoding: "utf8" });
        var xmlScrubbed = xmlContent.replace(/ fl=".+?" loc=".+?"/g, "");
        putWorkFile(xmlPath, xmlScrubbed);
        if (!anyTargetChanged(step, [xmlPath]))
          return;
        xmlParser.parse(xmlContent);
      } catch (e) {
        console.log(e, e.stack);
        if (e.$loc != null) {
          let $loc = e.$loc;
          errors.push({ msg: "" + e, path: $loc.path, line: $loc.line });
        } else {
          errors.push({ line: 0, msg: "" + e });
        }
        return { errors, listings };
      } finally {
        endtime("parse");
      }
      return {
        output: xmlParser,
        errors,
        listings
      };
    }
  }
  function compileYosys(step) {
    loadNative("yosys");
    var code = step.code;
    var errors = [];
    var match_fn = makeErrorMatcher(errors, /ERROR: (.+?) in line (.+?[.]v):(\d+)[: ]+(.+)/i, 3, 4, step.path);
    starttime();
    var yosys_mod = emglobal.yosys({
      instantiateWasm: moduleInstFn("yosys"),
      noInitialRun: true,
      print: print_fn,
      printErr: match_fn
    });
    endtime("create module");
    var topmod = detectTopModuleName(code);
    var FS = yosys_mod.FS;
    FS.writeFile(topmod + ".v", code);
    starttime();
    try {
      execMain(step, yosys_mod, ["-q", "-o", topmod + ".json", "-S", topmod + ".v"]);
    } catch (e) {
      console.log(e);
      endtime("compile");
      return { errors };
    }
    endtime("compile");
    if (errors.length)
      return { errors };
    try {
      var json_file = FS.readFile(topmod + ".json", { encoding: "utf8" });
      var json = JSON.parse(json_file);
      console.log(json);
      return { output: json, errors };
    } catch (e) {
      console.log(e);
      return { errors };
    }
  }
  function compileSilice(step) {
    loadNative("silice");
    var params = step.params;
    gatherFiles(step, { mainFilePath: "main.ice" });
    var destpath = step.prefix + ".v";
    var errors = [];
    var errfile;
    var errline;
    if (staleFiles(step, [destpath])) {
      var match_fn = (s) => {
        s = s.replaceAll(/\033\[\d+\w/g, "");
        var mf = /file:\s*(\w+)/.exec(s);
        var ml = /line:\s+(\d+)/.exec(s);
        var preproc = /\[preprocessor\] (\d+)\] (.+)/.exec(s);
        if (mf)
          errfile = mf[1];
        else if (ml)
          errline = parseInt(ml[1]);
        else if (preproc) {
          errors.push({ path: step.path, line: parseInt(preproc[1]), msg: preproc[2] });
        } else if (errfile && errline && s.length > 1) {
          if (s.length > 2) {
            errors.push({ path: errfile + ".ice", line: errline, msg: s });
          } else {
            errfile = null;
            errline = null;
          }
        } else
          console.log(s);
      };
      var silice = emglobal.silice({
        instantiateWasm: moduleInstFn("silice"),
        noInitialRun: true,
        print: match_fn,
        printErr: match_fn
      });
      var FS = silice.FS;
      setupFS(FS, "Silice");
      populateFiles(step, FS);
      populateExtraFiles(step, FS, params.extra_compile_files);
      const FWDIR = "/share/frameworks";
      var args = [
        "-D",
        "NTSC=1",
        "--frameworks_dir",
        FWDIR,
        "-f",
        `/8bitworkshop.v`,
        "-o",
        destpath,
        step.path
      ];
      execMain(step, silice, args);
      if (errors.length)
        return { errors };
      var vout = FS.readFile(destpath, { encoding: "utf8" });
      putWorkFile(destpath, vout);
    }
    return {
      nexttool: "verilator",
      path: destpath,
      args: [destpath],
      files: [destpath]
    };
  }

  // src/worker/tools/m6809.ts
  function assembleXASM6809(step) {
    load("xasm6809");
    var alst = "";
    var lasterror = null;
    var errors = [];
    function match_fn(s) {
      alst += s;
      alst += "\n";
      if (lasterror) {
        var line = parseInt(s.slice(0, 5)) || 0;
        errors.push({
          line,
          msg: lasterror
        });
        lasterror = null;
      } else if (s.startsWith("***** ")) {
        lasterror = s.slice(6);
      }
    }
    var Module = emglobal.xasm6809({
      noInitialRun: true,
      print: match_fn,
      printErr: print_fn
    });
    var FS = Module.FS;
    populateFiles(step, FS, {
      mainFilePath: "main.asm"
    });
    var binpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";
    execMain(step, Module, ["-c", "-l", "-s", "-y", "-o=" + binpath, step.path]);
    if (errors.length)
      return { errors };
    var aout = FS.readFile(binpath, { encoding: "binary" });
    if (aout.length == 0) {
      errors.push({ line: 0, msg: "Empty output file" });
      return { errors };
    }
    putWorkFile(binpath, aout);
    putWorkFile(lstpath, alst);
    var symbolmap = {};
    var asmlines = parseListing(alst, /^\s*([0-9]+) .+ ([0-9A-F]+)\s+\[([0-9 ]+)\]\s+([0-9A-F]+) (.*)/i, 1, 2, 4, 3);
    var listings = {};
    listings[step.prefix + ".lst"] = { lines: asmlines, text: alst };
    return {
      output: aout,
      listings,
      errors,
      symbolmap
    };
  }
  function compileCMOC(step) {
    loadNative("cmoc");
    var params = step.params;
    var re_err1 = /^[/]*([^:]*):(\d+): (.+)$/;
    var errors = [];
    var errline = 0;
    function match_fn(s) {
      var matches = re_err1.exec(s);
      if (matches) {
        errors.push({
          line: parseInt(matches[2]),
          msg: matches[3],
          path: matches[1] || step.path
        });
      } else {
        console.log(s);
      }
    }
    gatherFiles(step, { mainFilePath: "main.c" });
    var destpath = step.prefix + ".s";
    if (staleFiles(step, [destpath])) {
      var args = [
        "-S",
        "-Werror",
        "-V",
        "-I/share/include",
        "-I.",
        step.path
      ];
      var CMOC = emglobal.cmoc({
        instantiateWasm: moduleInstFn("cmoc"),
        noInitialRun: true,
        print: match_fn,
        printErr: match_fn
      });
      var code = getWorkFileAsString(step.path);
      var preproc = preprocessMCPP(step, null);
      if (preproc.errors) {
        return { errors: preproc.errors };
      } else
        code = preproc.code;
      var FS = CMOC.FS;
      populateFiles(step, FS);
      FS.writeFile(step.path, code);
      fixParamsWithDefines(step.path, params);
      if (params.extra_compile_args) {
        args.unshift.apply(args, params.extra_compile_args);
      }
      execMain(step, CMOC, args);
      if (errors.length)
        return { errors };
      var asmout = FS.readFile(destpath, { encoding: "utf8" });
      if (step.params.set_stack_end)
        asmout = asmout.replace("stack space in bytes", `
 lds #${step.params.set_stack_end}
`);
      putWorkFile(destpath, asmout);
    }
    return {
      nexttool: "lwasm",
      path: destpath,
      args: [destpath],
      files: [destpath]
    };
  }
  function assembleLWASM(step) {
    loadNative("lwasm");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.s" });
    var objpath = step.prefix + ".o";
    var lstpath = step.prefix + ".lst";
    const isRaw = step.path.endsWith(".asm");
    if (staleFiles(step, [objpath, lstpath])) {
      var objout, lstout;
      var args = ["-9", "-I/share/asminc", "-o" + objpath, "-l" + lstpath, step.path];
      args.push(isRaw ? "-r" : "--obj");
      var LWASM = emglobal.lwasm({
        instantiateWasm: moduleInstFn("lwasm"),
        noInitialRun: true,
        print: print_fn,
        printErr: msvcErrorMatcher(errors)
      });
      var FS = LWASM.FS;
      populateFiles(step, FS);
      fixParamsWithDefines(step.path, step.params);
      execMain(step, LWASM, args);
      if (errors.length)
        return { errors };
      objout = FS.readFile(objpath, { encoding: "binary" });
      lstout = FS.readFile(lstpath, { encoding: "utf8" });
      putWorkFile(objpath, objout);
      putWorkFile(lstpath, lstout);
      if (isRaw) {
        return {
          output: objout
        };
      }
    }
    return {
      linktool: "lwlink",
      files: [objpath, lstpath],
      args: [objpath]
    };
  }
  function linkLWLINK(step) {
    loadNative("lwlink");
    var params = step.params;
    gatherFiles(step);
    var binpath = "main";
    if (staleFiles(step, [binpath])) {
      var errors = [];
      var LWLINK = emglobal.lwlink({
        instantiateWasm: moduleInstFn("lwlink"),
        noInitialRun: true,
        print: print_fn,
        printErr: function(s2) {
          if (s2.startsWith("Warning:"))
            console.log(s2);
          else
            errors.push({ msg: s2, line: 0 });
        }
      });
      var FS = LWLINK.FS;
      populateFiles(step, FS);
      populateExtraFiles(step, FS, params.extra_link_files);
      var libargs = params.extra_link_args || [];
      var args = [
        "-L.",
        "--entry=program_start",
        "--raw",
        "--output=main",
        "--map=main.map"
      ].concat(libargs, step.args);
      console.log(args);
      execMain(step, LWLINK, args);
      if (errors.length)
        return { errors };
      var aout = FS.readFile("main", { encoding: "binary" });
      var mapout = FS.readFile("main.map", { encoding: "utf8" });
      putWorkFile("main", aout);
      putWorkFile("main.map", mapout);
      if (!anyTargetChanged(step, ["main", "main.map"]))
        return;
      var symbolmap = {};
      var segments = [];
      for (var s of mapout.split("\n")) {
        var toks = s.split(" ");
        if (toks[0] == "Symbol:") {
          let ident = toks[1];
          let ofs = parseInt(toks[4], 16);
          if (ident && ofs >= 0 && !ident.startsWith("l_") && !ident.startsWith("funcsize_") && !ident.startsWith("funcend_")) {
            symbolmap[ident] = ofs;
          }
        } else if (toks[0] == "Section:") {
          let seg = toks[1];
          let segstart = parseInt(toks[5], 16);
          let segsize = parseInt(toks[7], 16);
          segments.push({ name: seg, start: segstart, size: segsize });
        }
      }
      const re_segment = /\s*SECTION\s+(\w+)/i;
      const re_function = /\s*([0-9a-f]+).+?(\w+)\s+EQU\s+[*]/i;
      var listings = {};
      for (var fn of step.files) {
        if (fn.endsWith(".lst")) {
          var lstout = FS.readFile(fn, { encoding: "utf8" });
          var asmlines = parseListing(lstout, /^([0-9A-F]+)\s+([0-9A-F]+)\s+[(]\s*(.+?)[)]:(\d+) (.*)/i, 4, 1, 2, 3, re_function, re_segment);
          for (let l of asmlines) {
            l.offset += symbolmap[l.func] || 0;
          }
          var srclines = parseSourceLines(lstout, /Line .+?:(\d+)/i, /^([0-9A-F]{4})/i, re_function, re_segment);
          for (let l of srclines) {
            l.offset += symbolmap[l.func] || 0;
          }
          putWorkFile(fn, lstout);
          lstout = lstout.split("\n").map((l) => l.substring(0, 15) + l.substring(56)).join("\n");
          listings[fn] = {
            asmlines: srclines.length ? asmlines : null,
            lines: srclines.length ? srclines : asmlines,
            text: lstout
          };
        }
      }
      return {
        output: aout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }

  // src/worker/tools/m6502.ts
  function assembleNESASM(step) {
    loadNative("nesasm");
    var re_filename = /\#\[(\d+)\]\s+(\S+)/;
    var re_insn = /\s+(\d+)\s+([0-9A-F]+):([0-9A-F]+)/;
    var re_error = /\s+(.+)/;
    var errors = [];
    var state = 0;
    var lineno = 0;
    var filename;
    function match_fn(s2) {
      var m2;
      switch (state) {
        case 0:
          m2 = re_filename.exec(s2);
          if (m2) {
            filename = m2[2];
          }
          m2 = re_insn.exec(s2);
          if (m2) {
            lineno = parseInt(m2[1]);
            state = 1;
          }
          break;
        case 1:
          m2 = re_error.exec(s2);
          if (m2) {
            errors.push({ path: filename, line: lineno, msg: m2[1] });
            state = 0;
          }
          break;
      }
    }
    var Module = emglobal.nesasm({
      instantiateWasm: moduleInstFn("nesasm"),
      noInitialRun: true,
      print: match_fn
    });
    var FS = Module.FS;
    populateFiles(step, FS, {
      mainFilePath: "main.a"
    });
    var binpath = step.prefix + ".nes";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".fns";
    execMain(step, Module, [step.path, "-s", "-l", "2"]);
    var listings = {};
    try {
      var alst = FS.readFile(lstpath, { "encoding": "utf8" });
      var asmlines = parseListing(alst, /^\s*(\d+)\s+([0-9A-F]+):([0-9A-F]+)\s+([0-9A-F ]+?)  (.*)/i, 1, 3, 4);
      putWorkFile(lstpath, alst);
      listings[lstpath] = {
        lines: asmlines,
        text: alst
      };
    } catch (e) {
    }
    if (errors.length) {
      return { errors };
    }
    var aout, asym;
    aout = FS.readFile(binpath);
    try {
      asym = FS.readFile(sympath, { "encoding": "utf8" });
    } catch (e) {
      console.log(e);
      errors.push({ line: 0, msg: "No symbol table generated, maybe missing ENDM or segment overflow?" });
      return { errors };
    }
    putWorkFile(binpath, aout);
    putWorkFile(sympath, asym);
    if (alst)
      putWorkFile(lstpath, alst);
    if (!anyTargetChanged(step, [binpath, sympath]))
      return;
    var symbolmap = {};
    for (var s of asym.split("\n")) {
      if (!s.startsWith(";")) {
        var m = /(\w+)\s+=\s+[$]([0-9A-F]+)/.exec(s);
        if (m) {
          symbolmap[m[1]] = parseInt(m[2], 16);
        }
      }
    }
    return {
      output: aout,
      listings,
      errors,
      symbolmap
    };
  }
  function assembleMerlin32(step) {
    loadNative("merlin32");
    var errors = [];
    var lstfiles = [];
    gatherFiles(step, { mainFilePath: "main.lnk" });
    var objpath = step.prefix + ".bin";
    if (staleFiles(step, [objpath])) {
      var args = ["-v", step.path];
      var merlin32 = emglobal.merlin32({
        instantiateWasm: moduleInstFn("merlin32"),
        noInitialRun: true,
        print: (s) => {
          var m = /\s*=>\s*Creating Output file '(.+?)'/.exec(s);
          if (m) {
            lstfiles.push(m[1]);
          }
          var errpos = s.indexOf("Error");
          if (errpos >= 0) {
            s = s.slice(errpos + 6).trim();
            var mline = /\bline (\d+)\b/.exec(s);
            var mpath = /\bfile '(.+?)'/.exec(s);
            errors.push({
              line: parseInt(mline[1]) || 0,
              msg: s,
              path: mpath[1] || step.path
            });
          }
        },
        printErr: print_fn
      });
      var FS = merlin32.FS;
      populateFiles(step, FS);
      execMain(step, merlin32, args);
      if (errors.length)
        return { errors };
      var errout = null;
      try {
        errout = FS.readFile("error_output.txt", { encoding: "utf8" });
      } catch (e) {
      }
      var objout = FS.readFile(objpath, { encoding: "binary" });
      putWorkFile(objpath, objout);
      if (!anyTargetChanged(step, [objpath]))
        return;
      var symbolmap = {};
      var segments = [];
      var listings = {};
      lstfiles.forEach((lstfn) => {
        var lst = FS.readFile(lstfn, { encoding: "utf8" });
        lst.split("\n").forEach((line) => {
          var toks = line.split(/\s*\|\s*/);
          if (toks && toks[6]) {
            var toks2 = toks[1].split(/\s+/);
            var toks3 = toks[6].split(/[:/]/, 4);
            var path = toks2[1];
            if (path && toks2[2] && toks3[1]) {
              var lstline = {
                line: parseInt(toks2[2]),
                offset: parseInt(toks3[1].trim(), 16),
                insns: toks3[2],
                cycles: null,
                iscode: false
              };
              var lst2 = listings[path];
              if (!lst2)
                listings[path] = lst2 = { lines: [] };
              lst2.lines.push(lstline);
            }
          }
        });
      });
      return {
        output: objout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }
  function compileFastBasic(step) {
    loadNative("fastbasic-int");
    var params = step.params;
    gatherFiles(step, { mainFilePath: "main.fb" });
    var destpath = step.prefix + ".s";
    var errors = [];
    if (staleFiles(step, [destpath])) {
      var fastbasic = emglobal.fastbasic({
        instantiateWasm: moduleInstFn("fastbasic-int"),
        noInitialRun: true,
        print: print_fn,
        printErr: makeErrorMatcher(errors, /(.+?):(\d+):(\d+):\s*(.+)/, 2, 4, step.path, 1)
      });
      var FS = fastbasic.FS;
      populateFiles(step, FS);
      var libfile = "fastbasic-int.lib";
      params.libargs = [libfile];
      params.cfgfile = params.fastbasic_cfgfile;
      params.extra_link_files = [libfile, params.cfgfile];
      var args = [step.path, destpath];
      execMain(step, fastbasic, args);
      if (errors.length)
        return { errors };
      var asmout = FS.readFile(destpath, { encoding: "utf8" });
      putWorkFile(destpath, asmout);
    }
    return {
      nexttool: "ca65",
      path: destpath,
      args: [destpath],
      files: [destpath]
    };
  }

  // src/worker/tools/z80.ts
  function assembleZMAC(step) {
    loadNative("zmac");
    var hexout, lstout, binout;
    var errors = [];
    var params = step.params;
    gatherFiles(step, { mainFilePath: "main.asm" });
    var lstpath = step.prefix + ".lst";
    var binpath = step.prefix + ".cim";
    if (staleFiles(step, [binpath, lstpath])) {
      var ZMAC = emglobal.zmac({
        instantiateWasm: moduleInstFn("zmac"),
        noInitialRun: true,
        print: print_fn,
        printErr: makeErrorMatcher(errors, /([^( ]+)\s*[(](\d+)[)]\s*:\s*(.+)/, 2, 3, step.path)
      });
      var FS = ZMAC.FS;
      populateFiles(step, FS);
      execMain(step, ZMAC, ["-z", "-c", "--oo", "lst,cim", step.path]);
      if (errors.length) {
        return { errors };
      }
      lstout = FS.readFile("zout/" + lstpath, { encoding: "utf8" });
      binout = FS.readFile("zout/" + binpath, { encoding: "binary" });
      putWorkFile(binpath, binout);
      putWorkFile(lstpath, lstout);
      if (!anyTargetChanged(step, [binpath, lstpath]))
        return;
      var lines = parseListing(lstout, /\s*(\d+):\s*([0-9a-f]+)\s+([0-9a-f]+)\s+(.+)/i, 1, 2, 3);
      var listings = {};
      listings[lstpath] = { lines };
      var symbolmap = {};
      var sympos = lstout.indexOf("Symbol Table:");
      if (sympos > 0) {
        var symout = lstout.slice(sympos + 14);
        symout.split("\n").forEach(function(l) {
          var m = l.match(/(\S+)\s+([= ]*)([0-9a-f]+)/i);
          if (m) {
            symbolmap[m[1]] = parseInt(m[3], 16);
          }
        });
      }
      return {
        output: binout,
        listings,
        errors,
        symbolmap
      };
    }
  }

  // src/worker/tools/x86.ts
  function compileSmallerC(step) {
    loadNative("smlrc");
    var params = step.params;
    var re_err1 = /^Error in "[/]*(.+)" [(](\d+):(\d+)[)]/;
    var errors = [];
    var errline = 0;
    var errpath = step.path;
    function match_fn(s) {
      var matches = re_err1.exec(s);
      if (matches) {
        errline = parseInt(matches[2]);
        errpath = matches[1];
      } else {
        errors.push({
          line: errline,
          msg: s,
          path: errpath
        });
      }
    }
    gatherFiles(step, { mainFilePath: "main.c" });
    var destpath = step.prefix + ".asm";
    if (staleFiles(step, [destpath])) {
      var args = [
        "-seg16",
        "-no-externs",
        step.path,
        destpath
      ];
      var smlrc = emglobal.smlrc({
        instantiateWasm: moduleInstFn("smlrc"),
        noInitialRun: true,
        print: match_fn,
        printErr: match_fn
      });
      var code = getWorkFileAsString(step.path);
      var preproc = preprocessMCPP(step, null);
      if (preproc.errors) {
        return { errors: preproc.errors };
      } else
        code = preproc.code;
      var FS = smlrc.FS;
      populateFiles(step, FS);
      FS.writeFile(step.path, code);
      fixParamsWithDefines(step.path, params);
      if (params.extra_compile_args) {
        args.unshift.apply(args, params.extra_compile_args);
      }
      execMain(step, smlrc, args);
      if (errors.length)
        return { errors };
      var asmout = FS.readFile(destpath, { encoding: "utf8" });
      putWorkFile(destpath, asmout);
    }
    return {
      nexttool: "yasm",
      path: destpath,
      args: [destpath],
      files: [destpath]
    };
  }
  function assembleYASM(step) {
    loadNative("yasm");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.asm" });
    var objpath = step.prefix + ".exe";
    var lstpath = step.prefix + ".lst";
    var mappath = step.prefix + ".map";
    if (staleFiles(step, [objpath])) {
      var args = [
        "-X",
        "vc",
        "-a",
        "x86",
        "-f",
        "dosexe",
        "-p",
        "nasm",
        "-D",
        "freedos",
        "-o",
        objpath,
        "-l",
        lstpath,
        "--mapfile=" + mappath,
        step.path
      ];
      var YASM = emglobal.yasm({
        instantiateWasm: moduleInstFn("yasm"),
        noInitialRun: true,
        print: print_fn,
        printErr: msvcErrorMatcher(errors)
      });
      var FS = YASM.FS;
      populateFiles(step, FS);
      execMain(step, YASM, args);
      if (errors.length)
        return { errors };
      var objout, lstout, mapout;
      objout = FS.readFile(objpath, { encoding: "binary" });
      lstout = FS.readFile(lstpath, { encoding: "utf8" });
      mapout = FS.readFile(mappath, { encoding: "utf8" });
      putWorkFile(objpath, objout);
      putWorkFile(lstpath, lstout);
      if (!anyTargetChanged(step, [objpath]))
        return;
      var symbolmap = {};
      var segments = [];
      var lines = parseListing(lstout, /\s*(\d+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+(.+)/i, 1, 2, 3);
      var listings = {};
      listings[lstpath] = { lines, text: lstout };
      return {
        output: objout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }

  // src/worker/tools/arm.ts
  function assembleARMIPS(step) {
    loadNative("armips");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.asm" });
    var objpath = "main.bin";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".sym";
    var error_fn = makeErrorMatcher(errors, /^(.+?)\((\d+)\)\s+(fatal error|error|warning):\s+(.+)/, 2, 4, step.path, 1);
    if (staleFiles(step, [objpath])) {
      var args = [step.path, "-temp", lstpath, "-sym", sympath, "-erroronwarning"];
      var armips = emglobal.armips({
        instantiateWasm: moduleInstFn("armips"),
        noInitialRun: true,
        print: error_fn,
        printErr: error_fn
      });
      var FS = armips.FS;
      var code = getWorkFileAsString(step.path);
      code = `.arm.little :: .create "${objpath}",0 :: ${code}
  .close`;
      putWorkFile(step.path, code);
      populateFiles(step, FS);
      execMain(step, armips, args);
      if (errors.length)
        return { errors };
      var objout = FS.readFile(objpath, { encoding: "binary" });
      putWorkFile(objpath, objout);
      if (!anyTargetChanged(step, [objpath]))
        return;
      var symbolmap = {};
      var segments = [];
      var listings = {};
      var lstout = FS.readFile(lstpath, { encoding: "utf8" });
      var lines = lstout.split(re_crlf);
      var re_asmline = /^([0-9A-F]+) (.+?); [/](.+?) line (\d+)/;
      var lastofs = -1;
      for (var line of lines) {
        var m;
        if (m = re_asmline.exec(line)) {
          var path = m[3];
          var path2 = getPrefix(path) + ".lst";
          var lst = listings[path2];
          if (lst == null) {
            lst = listings[path2] = { lines: [] };
          }
          var ofs = parseInt(m[1], 16);
          if (lastofs == ofs) {
            lst.lines.pop();
          } else if (ofs > lastofs) {
            var lastline = lst.lines[lst.lines.length - 1];
            if (lastline && !lastline.insns) {
              var insns = objout.slice(lastofs, ofs).reverse();
              lastline.insns = Array.from(insns).map((b) => hex(b, 2)).join("");
            }
          }
          lst.lines.push({
            path,
            line: parseInt(m[4]),
            offset: ofs
          });
          lastofs = ofs;
        }
      }
      var symout = FS.readFile(sympath, { encoding: "utf8" });
      var re_symline = /^([0-9A-F]+)\s+(.+)/;
      for (var line of symout.split(re_crlf)) {
        var m;
        if (m = re_symline.exec(line)) {
          symbolmap[m[2]] = parseInt(m[1], 16);
        }
      }
      return {
        output: objout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }
  function assembleVASMARM(step) {
    loadNative("vasmarm_std");
    var re_err1 = /^(fatal error|error|warning)? (\d+) in line (\d+) of "(.+)": (.+)/;
    var re_err2 = /^(fatal error|error|warning)? (\d+): (.+)/;
    var re_undefsym = /symbol <(.+?)>/;
    var errors = [];
    var undefsyms = [];
    function findUndefinedSymbols(line2) {
      undefsyms.forEach((sym) => {
        if (line2.indexOf(sym) >= 0) {
          errors.push({
            path: curpath,
            line: curline,
            msg: "Undefined symbol: " + sym
          });
        }
      });
    }
    function match_fn(s) {
      let matches = re_err1.exec(s);
      if (matches) {
        errors.push({
          line: parseInt(matches[3]),
          path: matches[4],
          msg: matches[5]
        });
      } else {
        matches = re_err2.exec(s);
        if (matches) {
          let m2 = re_undefsym.exec(matches[3]);
          if (m2) {
            undefsyms.push(m2[1]);
          } else {
            errors.push({
              line: 0,
              msg: s
            });
          }
        } else {
          console.log(s);
        }
      }
    }
    gatherFiles(step, { mainFilePath: "main.asm" });
    var objpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";
    if (staleFiles(step, [objpath])) {
      var args = ["-Fbin", "-m7tdmi", "-x", "-wfail", step.path, "-o", objpath, "-L", lstpath];
      var vasm = emglobal.vasm({
        instantiateWasm: moduleInstFn("vasmarm_std"),
        noInitialRun: true,
        print: match_fn,
        printErr: match_fn
      });
      var FS = vasm.FS;
      populateFiles(step, FS);
      execMain(step, vasm, args);
      if (errors.length) {
        return { errors };
      }
      if (undefsyms.length == 0) {
        var objout = FS.readFile(objpath, { encoding: "binary" });
        putWorkFile(objpath, objout);
        if (!anyTargetChanged(step, [objpath]))
          return;
      }
      var lstout = FS.readFile(lstpath, { encoding: "utf8" });
      var symbolmap = {};
      var segments = [];
      var listings = {};
      var re_asmline = /^(\d+):([0-9A-F]+)\s+([0-9A-F ]+)\s+(\d+)([:M])/;
      var re_secline = /^(\d+):\s+"(.+)"/;
      var re_nameline = /^Source:\s+"(.+)"/;
      var re_symline = /^(\w+)\s+(\d+):([0-9A-F]+)/;
      var re_emptyline = /^\s+(\d+)([:M])/;
      var curpath = step.path;
      var curline = 0;
      var sections = {};
      var lines = lstout.split(re_crlf);
      var lstlines = [];
      for (var line of lines) {
        var m;
        if (m = re_secline.exec(line)) {
          sections[m[1]] = m[2];
        } else if (m = re_nameline.exec(line)) {
          curpath = m[1];
        } else if (m = re_symline.exec(line)) {
          symbolmap[m[1]] = parseInt(m[3], 16);
        } else if (m = re_asmline.exec(line)) {
          if (m[5] == ":") {
            curline = parseInt(m[4]);
          } else {
          }
          lstlines.push({
            path: curpath,
            line: curline,
            offset: parseInt(m[2], 16),
            insns: m[3].replaceAll(" ", "")
          });
          findUndefinedSymbols(line);
        } else if (m = re_emptyline.exec(line)) {
          curline = parseInt(m[1]);
          findUndefinedSymbols(line);
        } else {
        }
      }
      listings[lstpath] = { lines: lstlines, text: lstout };
      if (undefsyms.length && errors.length == 0) {
        errors.push({
          line: 0,
          msg: "Undefined symbols: " + undefsyms.join(", ")
        });
      }
      return {
        output: objout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }

  // node_modules/yufka/node_modules/acorn/dist/acorn.mjs
  var reservedWords = {
    3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
    5: "class enum extends super const export import",
    6: "enum",
    strict: "implements interface let package private protected public static yield",
    strictBind: "eval arguments"
  };
  var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";
  var keywords$1 = {
    5: ecma5AndLessKeywords,
    "5module": ecma5AndLessKeywords + " export import",
    6: ecma5AndLessKeywords + " const class extends export import super"
  };
  var keywordRelationalOperator = /^in(stanceof)?$/;
  var nonASCIIidentifierStartChars = "\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u0870-\u0887\u0889-\u088E\u08A0-\u08C9\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C5D\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D04-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u1711\u171F-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4C\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7CA\uA7D0\uA7D1\uA7D3\uA7D5-\uA7D9\uA7F2-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC";
  var nonASCIIidentifierChars = "\u200C\u200D\xB7\u0300-\u036F\u0387\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0898-\u089F\u08CA-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B55-\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C04\u0C3C\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECD\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1369-\u1371\u1712-\u1715\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u180F-\u1819\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19D0-\u19DA\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1ABD\u1ABF-\u1ACE\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DFF\u203F\u2040\u2054\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA620-\uA629\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880\uA881\uA8B4-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F1\uA8FF-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFF10-\uFF19\uFF3F";
  var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
  var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");
  nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;
  var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 13, 10, 2, 14, 2, 6, 2, 1, 2, 10, 2, 14, 2, 6, 2, 1, 68, 310, 10, 21, 11, 7, 25, 5, 2, 41, 2, 8, 70, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 349, 41, 7, 1, 79, 28, 11, 0, 9, 21, 43, 17, 47, 20, 28, 22, 13, 52, 58, 1, 3, 0, 14, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 85, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 159, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 38, 6, 186, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 19, 72, 264, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 190, 0, 80, 921, 103, 110, 18, 195, 2637, 96, 16, 1070, 4050, 582, 8634, 568, 8, 30, 18, 78, 18, 29, 19, 47, 17, 3, 32, 20, 6, 18, 689, 63, 129, 74, 6, 0, 67, 12, 65, 1, 2, 0, 29, 6135, 9, 1237, 43, 8, 8936, 3, 2, 6, 2, 1, 2, 290, 46, 2, 18, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 1845, 30, 482, 44, 11, 6, 17, 0, 322, 29, 19, 43, 1269, 6, 2, 3, 2, 1, 2, 14, 2, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42719, 33, 4152, 8, 221, 3, 5761, 15, 7472, 3104, 541, 1507, 4938];
  var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 370, 1, 154, 10, 50, 3, 123, 2, 54, 14, 32, 10, 3, 1, 11, 3, 46, 10, 8, 0, 46, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 161, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 193, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 84, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 406, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 19306, 9, 87, 9, 39, 4, 60, 6, 26, 9, 1014, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 4706, 45, 3, 22, 543, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 262, 6, 10, 9, 357, 0, 62, 13, 1495, 6, 110, 6, 6, 9, 4759, 9, 787719, 239];
  function isInAstralSet(code, set) {
    var pos = 65536;
    for (var i = 0; i < set.length; i += 2) {
      pos += set[i];
      if (pos > code) {
        return false;
      }
      pos += set[i + 1];
      if (pos >= code) {
        return true;
      }
    }
  }
  function isIdentifierStart(code, astral) {
    if (code < 65) {
      return code === 36;
    }
    if (code < 91) {
      return true;
    }
    if (code < 97) {
      return code === 95;
    }
    if (code < 123) {
      return true;
    }
    if (code <= 65535) {
      return code >= 170 && nonASCIIidentifierStart.test(String.fromCharCode(code));
    }
    if (astral === false) {
      return false;
    }
    return isInAstralSet(code, astralIdentifierStartCodes);
  }
  function isIdentifierChar(code, astral) {
    if (code < 48) {
      return code === 36;
    }
    if (code < 58) {
      return true;
    }
    if (code < 65) {
      return false;
    }
    if (code < 91) {
      return true;
    }
    if (code < 97) {
      return code === 95;
    }
    if (code < 123) {
      return true;
    }
    if (code <= 65535) {
      return code >= 170 && nonASCIIidentifier.test(String.fromCharCode(code));
    }
    if (astral === false) {
      return false;
    }
    return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
  }
  var TokenType2 = function TokenType3(label, conf) {
    if (conf === void 0)
      conf = {};
    this.label = label;
    this.keyword = conf.keyword;
    this.beforeExpr = !!conf.beforeExpr;
    this.startsExpr = !!conf.startsExpr;
    this.isLoop = !!conf.isLoop;
    this.isAssign = !!conf.isAssign;
    this.prefix = !!conf.prefix;
    this.postfix = !!conf.postfix;
    this.binop = conf.binop || null;
    this.updateContext = null;
  };
  function binop(name, prec) {
    return new TokenType2(name, { beforeExpr: true, binop: prec });
  }
  var beforeExpr = { beforeExpr: true };
  var startsExpr = { startsExpr: true };
  var keywords = {};
  function kw(name, options) {
    if (options === void 0)
      options = {};
    options.keyword = name;
    return keywords[name] = new TokenType2(name, options);
  }
  var types$1 = {
    num: new TokenType2("num", startsExpr),
    regexp: new TokenType2("regexp", startsExpr),
    string: new TokenType2("string", startsExpr),
    name: new TokenType2("name", startsExpr),
    privateId: new TokenType2("privateId", startsExpr),
    eof: new TokenType2("eof"),
    bracketL: new TokenType2("[", { beforeExpr: true, startsExpr: true }),
    bracketR: new TokenType2("]"),
    braceL: new TokenType2("{", { beforeExpr: true, startsExpr: true }),
    braceR: new TokenType2("}"),
    parenL: new TokenType2("(", { beforeExpr: true, startsExpr: true }),
    parenR: new TokenType2(")"),
    comma: new TokenType2(",", beforeExpr),
    semi: new TokenType2(";", beforeExpr),
    colon: new TokenType2(":", beforeExpr),
    dot: new TokenType2("."),
    question: new TokenType2("?", beforeExpr),
    questionDot: new TokenType2("?."),
    arrow: new TokenType2("=>", beforeExpr),
    template: new TokenType2("template"),
    invalidTemplate: new TokenType2("invalidTemplate"),
    ellipsis: new TokenType2("...", beforeExpr),
    backQuote: new TokenType2("`", startsExpr),
    dollarBraceL: new TokenType2("${", { beforeExpr: true, startsExpr: true }),
    eq: new TokenType2("=", { beforeExpr: true, isAssign: true }),
    assign: new TokenType2("_=", { beforeExpr: true, isAssign: true }),
    incDec: new TokenType2("++/--", { prefix: true, postfix: true, startsExpr: true }),
    prefix: new TokenType2("!/~", { beforeExpr: true, prefix: true, startsExpr: true }),
    logicalOR: binop("||", 1),
    logicalAND: binop("&&", 2),
    bitwiseOR: binop("|", 3),
    bitwiseXOR: binop("^", 4),
    bitwiseAND: binop("&", 5),
    equality: binop("==/!=/===/!==", 6),
    relational: binop("</>/<=/>=", 7),
    bitShift: binop("<</>>/>>>", 8),
    plusMin: new TokenType2("+/-", { beforeExpr: true, binop: 9, prefix: true, startsExpr: true }),
    modulo: binop("%", 10),
    star: binop("*", 10),
    slash: binop("/", 10),
    starstar: new TokenType2("**", { beforeExpr: true }),
    coalesce: binop("??", 1),
    _break: kw("break"),
    _case: kw("case", beforeExpr),
    _catch: kw("catch"),
    _continue: kw("continue"),
    _debugger: kw("debugger"),
    _default: kw("default", beforeExpr),
    _do: kw("do", { isLoop: true, beforeExpr: true }),
    _else: kw("else", beforeExpr),
    _finally: kw("finally"),
    _for: kw("for", { isLoop: true }),
    _function: kw("function", startsExpr),
    _if: kw("if"),
    _return: kw("return", beforeExpr),
    _switch: kw("switch"),
    _throw: kw("throw", beforeExpr),
    _try: kw("try"),
    _var: kw("var"),
    _const: kw("const"),
    _while: kw("while", { isLoop: true }),
    _with: kw("with"),
    _new: kw("new", { beforeExpr: true, startsExpr: true }),
    _this: kw("this", startsExpr),
    _super: kw("super", startsExpr),
    _class: kw("class", startsExpr),
    _extends: kw("extends", beforeExpr),
    _export: kw("export"),
    _import: kw("import", startsExpr),
    _null: kw("null", startsExpr),
    _true: kw("true", startsExpr),
    _false: kw("false", startsExpr),
    _in: kw("in", { beforeExpr: true, binop: 7 }),
    _instanceof: kw("instanceof", { beforeExpr: true, binop: 7 }),
    _typeof: kw("typeof", { beforeExpr: true, prefix: true, startsExpr: true }),
    _void: kw("void", { beforeExpr: true, prefix: true, startsExpr: true }),
    _delete: kw("delete", { beforeExpr: true, prefix: true, startsExpr: true })
  };
  var lineBreak = /\r\n?|\n|\u2028|\u2029/;
  var lineBreakG = new RegExp(lineBreak.source, "g");
  function isNewLine(code) {
    return code === 10 || code === 13 || code === 8232 || code === 8233;
  }
  function nextLineBreak(code, from2, end) {
    if (end === void 0)
      end = code.length;
    for (var i = from2; i < end; i++) {
      var next = code.charCodeAt(i);
      if (isNewLine(next)) {
        return i < end - 1 && next === 13 && code.charCodeAt(i + 1) === 10 ? i + 2 : i + 1;
      }
    }
    return -1;
  }
  var nonASCIIwhitespace = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
  var skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;
  var ref = Object.prototype;
  var hasOwnProperty = ref.hasOwnProperty;
  var toString = ref.toString;
  var hasOwn = Object.hasOwn || function(obj, propName) {
    return hasOwnProperty.call(obj, propName);
  };
  var isArray2 = Array.isArray || function(obj) {
    return toString.call(obj) === "[object Array]";
  };
  function wordsRegexp(words) {
    return new RegExp("^(?:" + words.replace(/ /g, "|") + ")$");
  }
  var loneSurrogate = /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/;
  var Position = function Position2(line, col) {
    this.line = line;
    this.column = col;
  };
  Position.prototype.offset = function offset(n2) {
    return new Position(this.line, this.column + n2);
  };
  var SourceLocation = function SourceLocation2(p, start, end) {
    this.start = start;
    this.end = end;
    if (p.sourceFile !== null) {
      this.source = p.sourceFile;
    }
  };
  function getLineInfo(input, offset2) {
    for (var line = 1, cur = 0; ; ) {
      var nextBreak = nextLineBreak(input, cur, offset2);
      if (nextBreak < 0) {
        return new Position(line, offset2 - cur);
      }
      ++line;
      cur = nextBreak;
    }
  }
  var defaultOptions = {
    ecmaVersion: null,
    sourceType: "script",
    onInsertedSemicolon: null,
    onTrailingComma: null,
    allowReserved: null,
    allowReturnOutsideFunction: false,
    allowImportExportEverywhere: false,
    allowAwaitOutsideFunction: null,
    allowSuperOutsideMethod: null,
    allowHashBang: false,
    locations: false,
    onToken: null,
    onComment: null,
    ranges: false,
    program: null,
    sourceFile: null,
    directSourceFile: null,
    preserveParens: false
  };
  var warnedAboutEcmaVersion = false;
  function getOptions(opts) {
    var options = {};
    for (var opt in defaultOptions) {
      options[opt] = opts && hasOwn(opts, opt) ? opts[opt] : defaultOptions[opt];
    }
    if (options.ecmaVersion === "latest") {
      options.ecmaVersion = 1e8;
    } else if (options.ecmaVersion == null) {
      if (!warnedAboutEcmaVersion && typeof console === "object" && console.warn) {
        warnedAboutEcmaVersion = true;
        console.warn("Since Acorn 8.0.0, options.ecmaVersion is required.\nDefaulting to 2020, but this will stop working in the future.");
      }
      options.ecmaVersion = 11;
    } else if (options.ecmaVersion >= 2015) {
      options.ecmaVersion -= 2009;
    }
    if (options.allowReserved == null) {
      options.allowReserved = options.ecmaVersion < 5;
    }
    if (isArray2(options.onToken)) {
      var tokens = options.onToken;
      options.onToken = function(token) {
        return tokens.push(token);
      };
    }
    if (isArray2(options.onComment)) {
      options.onComment = pushComment(options, options.onComment);
    }
    return options;
  }
  function pushComment(options, array) {
    return function(block, text, start, end, startLoc, endLoc) {
      var comment = {
        type: block ? "Block" : "Line",
        value: text,
        start,
        end
      };
      if (options.locations) {
        comment.loc = new SourceLocation(this, startLoc, endLoc);
      }
      if (options.ranges) {
        comment.range = [start, end];
      }
      array.push(comment);
    };
  }
  var SCOPE_TOP = 1;
  var SCOPE_FUNCTION = 2;
  var SCOPE_ASYNC = 4;
  var SCOPE_GENERATOR = 8;
  var SCOPE_ARROW = 16;
  var SCOPE_SIMPLE_CATCH = 32;
  var SCOPE_SUPER = 64;
  var SCOPE_DIRECT_SUPER = 128;
  var SCOPE_CLASS_STATIC_BLOCK = 256;
  var SCOPE_VAR = SCOPE_TOP | SCOPE_FUNCTION | SCOPE_CLASS_STATIC_BLOCK;
  function functionFlags(async, generator) {
    return SCOPE_FUNCTION | (async ? SCOPE_ASYNC : 0) | (generator ? SCOPE_GENERATOR : 0);
  }
  var BIND_NONE = 0;
  var BIND_VAR = 1;
  var BIND_LEXICAL = 2;
  var BIND_FUNCTION = 3;
  var BIND_SIMPLE_CATCH = 4;
  var BIND_OUTSIDE = 5;
  var Parser = function Parser2(options, input, startPos) {
    this.options = options = getOptions(options);
    this.sourceFile = options.sourceFile;
    this.keywords = wordsRegexp(keywords$1[options.ecmaVersion >= 6 ? 6 : options.sourceType === "module" ? "5module" : 5]);
    var reserved = "";
    if (options.allowReserved !== true) {
      reserved = reservedWords[options.ecmaVersion >= 6 ? 6 : options.ecmaVersion === 5 ? 5 : 3];
      if (options.sourceType === "module") {
        reserved += " await";
      }
    }
    this.reservedWords = wordsRegexp(reserved);
    var reservedStrict = (reserved ? reserved + " " : "") + reservedWords.strict;
    this.reservedWordsStrict = wordsRegexp(reservedStrict);
    this.reservedWordsStrictBind = wordsRegexp(reservedStrict + " " + reservedWords.strictBind);
    this.input = String(input);
    this.containsEsc = false;
    if (startPos) {
      this.pos = startPos;
      this.lineStart = this.input.lastIndexOf("\n", startPos - 1) + 1;
      this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;
    } else {
      this.pos = this.lineStart = 0;
      this.curLine = 1;
    }
    this.type = types$1.eof;
    this.value = null;
    this.start = this.end = this.pos;
    this.startLoc = this.endLoc = this.curPosition();
    this.lastTokEndLoc = this.lastTokStartLoc = null;
    this.lastTokStart = this.lastTokEnd = this.pos;
    this.context = this.initialContext();
    this.exprAllowed = true;
    this.inModule = options.sourceType === "module";
    this.strict = this.inModule || this.strictDirective(this.pos);
    this.potentialArrowAt = -1;
    this.potentialArrowInForAwait = false;
    this.yieldPos = this.awaitPos = this.awaitIdentPos = 0;
    this.labels = [];
    this.undefinedExports = Object.create(null);
    if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === "#!") {
      this.skipLineComment(2);
    }
    this.scopeStack = [];
    this.enterScope(SCOPE_TOP);
    this.regexpState = null;
    this.privateNameStack = [];
  };
  var prototypeAccessors = { inFunction: { configurable: true }, inGenerator: { configurable: true }, inAsync: { configurable: true }, canAwait: { configurable: true }, allowSuper: { configurable: true }, allowDirectSuper: { configurable: true }, treatFunctionsAsVar: { configurable: true }, allowNewDotTarget: { configurable: true }, inClassStaticBlock: { configurable: true } };
  Parser.prototype.parse = function parse() {
    var node = this.options.program || this.startNode();
    this.nextToken();
    return this.parseTopLevel(node);
  };
  prototypeAccessors.inFunction.get = function() {
    return (this.currentVarScope().flags & SCOPE_FUNCTION) > 0;
  };
  prototypeAccessors.inGenerator.get = function() {
    return (this.currentVarScope().flags & SCOPE_GENERATOR) > 0 && !this.currentVarScope().inClassFieldInit;
  };
  prototypeAccessors.inAsync.get = function() {
    return (this.currentVarScope().flags & SCOPE_ASYNC) > 0 && !this.currentVarScope().inClassFieldInit;
  };
  prototypeAccessors.canAwait.get = function() {
    for (var i = this.scopeStack.length - 1; i >= 0; i--) {
      var scope = this.scopeStack[i];
      if (scope.inClassFieldInit || scope.flags & SCOPE_CLASS_STATIC_BLOCK) {
        return false;
      }
      if (scope.flags & SCOPE_FUNCTION) {
        return (scope.flags & SCOPE_ASYNC) > 0;
      }
    }
    return this.inModule && this.options.ecmaVersion >= 13 || this.options.allowAwaitOutsideFunction;
  };
  prototypeAccessors.allowSuper.get = function() {
    var ref2 = this.currentThisScope();
    var flags = ref2.flags;
    var inClassFieldInit = ref2.inClassFieldInit;
    return (flags & SCOPE_SUPER) > 0 || inClassFieldInit || this.options.allowSuperOutsideMethod;
  };
  prototypeAccessors.allowDirectSuper.get = function() {
    return (this.currentThisScope().flags & SCOPE_DIRECT_SUPER) > 0;
  };
  prototypeAccessors.treatFunctionsAsVar.get = function() {
    return this.treatFunctionsAsVarInScope(this.currentScope());
  };
  prototypeAccessors.allowNewDotTarget.get = function() {
    var ref2 = this.currentThisScope();
    var flags = ref2.flags;
    var inClassFieldInit = ref2.inClassFieldInit;
    return (flags & (SCOPE_FUNCTION | SCOPE_CLASS_STATIC_BLOCK)) > 0 || inClassFieldInit;
  };
  prototypeAccessors.inClassStaticBlock.get = function() {
    return (this.currentVarScope().flags & SCOPE_CLASS_STATIC_BLOCK) > 0;
  };
  Parser.extend = function extend() {
    var plugins = [], len = arguments.length;
    while (len--)
      plugins[len] = arguments[len];
    var cls = this;
    for (var i = 0; i < plugins.length; i++) {
      cls = plugins[i](cls);
    }
    return cls;
  };
  Parser.parse = function parse2(input, options) {
    return new this(options, input).parse();
  };
  Parser.parseExpressionAt = function parseExpressionAt(input, pos, options) {
    var parser = new this(options, input, pos);
    parser.nextToken();
    return parser.parseExpression();
  };
  Parser.tokenizer = function tokenizer(input, options) {
    return new this(options, input);
  };
  Object.defineProperties(Parser.prototype, prototypeAccessors);
  var pp$9 = Parser.prototype;
  var literal = /^(?:'((?:\\.|[^'\\])*?)'|"((?:\\.|[^"\\])*?)")/;
  pp$9.strictDirective = function(start) {
    for (; ; ) {
      skipWhiteSpace.lastIndex = start;
      start += skipWhiteSpace.exec(this.input)[0].length;
      var match = literal.exec(this.input.slice(start));
      if (!match) {
        return false;
      }
      if ((match[1] || match[2]) === "use strict") {
        skipWhiteSpace.lastIndex = start + match[0].length;
        var spaceAfter = skipWhiteSpace.exec(this.input), end = spaceAfter.index + spaceAfter[0].length;
        var next = this.input.charAt(end);
        return next === ";" || next === "}" || lineBreak.test(spaceAfter[0]) && !(/[(`.[+\-/*%<>=,?^&]/.test(next) || next === "!" && this.input.charAt(end + 1) === "=");
      }
      start += match[0].length;
      skipWhiteSpace.lastIndex = start;
      start += skipWhiteSpace.exec(this.input)[0].length;
      if (this.input[start] === ";") {
        start++;
      }
    }
  };
  pp$9.eat = function(type) {
    if (this.type === type) {
      this.next();
      return true;
    } else {
      return false;
    }
  };
  pp$9.isContextual = function(name) {
    return this.type === types$1.name && this.value === name && !this.containsEsc;
  };
  pp$9.eatContextual = function(name) {
    if (!this.isContextual(name)) {
      return false;
    }
    this.next();
    return true;
  };
  pp$9.expectContextual = function(name) {
    if (!this.eatContextual(name)) {
      this.unexpected();
    }
  };
  pp$9.canInsertSemicolon = function() {
    return this.type === types$1.eof || this.type === types$1.braceR || lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
  };
  pp$9.insertSemicolon = function() {
    if (this.canInsertSemicolon()) {
      if (this.options.onInsertedSemicolon) {
        this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc);
      }
      return true;
    }
  };
  pp$9.semicolon = function() {
    if (!this.eat(types$1.semi) && !this.insertSemicolon()) {
      this.unexpected();
    }
  };
  pp$9.afterTrailingComma = function(tokType, notNext) {
    if (this.type === tokType) {
      if (this.options.onTrailingComma) {
        this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc);
      }
      if (!notNext) {
        this.next();
      }
      return true;
    }
  };
  pp$9.expect = function(type) {
    this.eat(type) || this.unexpected();
  };
  pp$9.unexpected = function(pos) {
    this.raise(pos != null ? pos : this.start, "Unexpected token");
  };
  function DestructuringErrors() {
    this.shorthandAssign = this.trailingComma = this.parenthesizedAssign = this.parenthesizedBind = this.doubleProto = -1;
  }
  pp$9.checkPatternErrors = function(refDestructuringErrors, isAssign) {
    if (!refDestructuringErrors) {
      return;
    }
    if (refDestructuringErrors.trailingComma > -1) {
      this.raiseRecoverable(refDestructuringErrors.trailingComma, "Comma is not permitted after the rest element");
    }
    var parens = isAssign ? refDestructuringErrors.parenthesizedAssign : refDestructuringErrors.parenthesizedBind;
    if (parens > -1) {
      this.raiseRecoverable(parens, "Parenthesized pattern");
    }
  };
  pp$9.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
    if (!refDestructuringErrors) {
      return false;
    }
    var shorthandAssign = refDestructuringErrors.shorthandAssign;
    var doubleProto = refDestructuringErrors.doubleProto;
    if (!andThrow) {
      return shorthandAssign >= 0 || doubleProto >= 0;
    }
    if (shorthandAssign >= 0) {
      this.raise(shorthandAssign, "Shorthand property assignments are valid only in destructuring patterns");
    }
    if (doubleProto >= 0) {
      this.raiseRecoverable(doubleProto, "Redefinition of __proto__ property");
    }
  };
  pp$9.checkYieldAwaitInDefaultParams = function() {
    if (this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos)) {
      this.raise(this.yieldPos, "Yield expression cannot be a default value");
    }
    if (this.awaitPos) {
      this.raise(this.awaitPos, "Await expression cannot be a default value");
    }
  };
  pp$9.isSimpleAssignTarget = function(expr) {
    if (expr.type === "ParenthesizedExpression") {
      return this.isSimpleAssignTarget(expr.expression);
    }
    return expr.type === "Identifier" || expr.type === "MemberExpression";
  };
  var pp$8 = Parser.prototype;
  pp$8.parseTopLevel = function(node) {
    var exports2 = Object.create(null);
    if (!node.body) {
      node.body = [];
    }
    while (this.type !== types$1.eof) {
      var stmt = this.parseStatement(null, true, exports2);
      node.body.push(stmt);
    }
    if (this.inModule) {
      for (var i = 0, list = Object.keys(this.undefinedExports); i < list.length; i += 1) {
        var name = list[i];
        this.raiseRecoverable(this.undefinedExports[name].start, "Export '" + name + "' is not defined");
      }
    }
    this.adaptDirectivePrologue(node.body);
    this.next();
    node.sourceType = this.options.sourceType;
    return this.finishNode(node, "Program");
  };
  var loopLabel = { kind: "loop" };
  var switchLabel = { kind: "switch" };
  pp$8.isLet = function(context) {
    if (this.options.ecmaVersion < 6 || !this.isContextual("let")) {
      return false;
    }
    skipWhiteSpace.lastIndex = this.pos;
    var skip = skipWhiteSpace.exec(this.input);
    var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
    if (nextCh === 91 || nextCh === 92 || nextCh > 55295 && nextCh < 56320) {
      return true;
    }
    if (context) {
      return false;
    }
    if (nextCh === 123) {
      return true;
    }
    if (isIdentifierStart(nextCh, true)) {
      var pos = next + 1;
      while (isIdentifierChar(nextCh = this.input.charCodeAt(pos), true)) {
        ++pos;
      }
      if (nextCh === 92 || nextCh > 55295 && nextCh < 56320) {
        return true;
      }
      var ident = this.input.slice(next, pos);
      if (!keywordRelationalOperator.test(ident)) {
        return true;
      }
    }
    return false;
  };
  pp$8.isAsyncFunction = function() {
    if (this.options.ecmaVersion < 8 || !this.isContextual("async")) {
      return false;
    }
    skipWhiteSpace.lastIndex = this.pos;
    var skip = skipWhiteSpace.exec(this.input);
    var next = this.pos + skip[0].length, after;
    return !lineBreak.test(this.input.slice(this.pos, next)) && this.input.slice(next, next + 8) === "function" && (next + 8 === this.input.length || !(isIdentifierChar(after = this.input.charCodeAt(next + 8)) || after > 55295 && after < 56320));
  };
  pp$8.parseStatement = function(context, topLevel, exports2) {
    var starttype = this.type, node = this.startNode(), kind;
    if (this.isLet(context)) {
      starttype = types$1._var;
      kind = "let";
    }
    switch (starttype) {
      case types$1._break:
      case types$1._continue:
        return this.parseBreakContinueStatement(node, starttype.keyword);
      case types$1._debugger:
        return this.parseDebuggerStatement(node);
      case types$1._do:
        return this.parseDoStatement(node);
      case types$1._for:
        return this.parseForStatement(node);
      case types$1._function:
        if (context && (this.strict || context !== "if" && context !== "label") && this.options.ecmaVersion >= 6) {
          this.unexpected();
        }
        return this.parseFunctionStatement(node, false, !context);
      case types$1._class:
        if (context) {
          this.unexpected();
        }
        return this.parseClass(node, true);
      case types$1._if:
        return this.parseIfStatement(node);
      case types$1._return:
        return this.parseReturnStatement(node);
      case types$1._switch:
        return this.parseSwitchStatement(node);
      case types$1._throw:
        return this.parseThrowStatement(node);
      case types$1._try:
        return this.parseTryStatement(node);
      case types$1._const:
      case types$1._var:
        kind = kind || this.value;
        if (context && kind !== "var") {
          this.unexpected();
        }
        return this.parseVarStatement(node, kind);
      case types$1._while:
        return this.parseWhileStatement(node);
      case types$1._with:
        return this.parseWithStatement(node);
      case types$1.braceL:
        return this.parseBlock(true, node);
      case types$1.semi:
        return this.parseEmptyStatement(node);
      case types$1._export:
      case types$1._import:
        if (this.options.ecmaVersion > 10 && starttype === types$1._import) {
          skipWhiteSpace.lastIndex = this.pos;
          var skip = skipWhiteSpace.exec(this.input);
          var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
          if (nextCh === 40 || nextCh === 46) {
            return this.parseExpressionStatement(node, this.parseExpression());
          }
        }
        if (!this.options.allowImportExportEverywhere) {
          if (!topLevel) {
            this.raise(this.start, "'import' and 'export' may only appear at the top level");
          }
          if (!this.inModule) {
            this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'");
          }
        }
        return starttype === types$1._import ? this.parseImport(node) : this.parseExport(node, exports2);
      default:
        if (this.isAsyncFunction()) {
          if (context) {
            this.unexpected();
          }
          this.next();
          return this.parseFunctionStatement(node, true, !context);
        }
        var maybeName = this.value, expr = this.parseExpression();
        if (starttype === types$1.name && expr.type === "Identifier" && this.eat(types$1.colon)) {
          return this.parseLabeledStatement(node, maybeName, expr, context);
        } else {
          return this.parseExpressionStatement(node, expr);
        }
    }
  };
  pp$8.parseBreakContinueStatement = function(node, keyword) {
    var isBreak = keyword === "break";
    this.next();
    if (this.eat(types$1.semi) || this.insertSemicolon()) {
      node.label = null;
    } else if (this.type !== types$1.name) {
      this.unexpected();
    } else {
      node.label = this.parseIdent();
      this.semicolon();
    }
    var i = 0;
    for (; i < this.labels.length; ++i) {
      var lab = this.labels[i];
      if (node.label == null || lab.name === node.label.name) {
        if (lab.kind != null && (isBreak || lab.kind === "loop")) {
          break;
        }
        if (node.label && isBreak) {
          break;
        }
      }
    }
    if (i === this.labels.length) {
      this.raise(node.start, "Unsyntactic " + keyword);
    }
    return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
  };
  pp$8.parseDebuggerStatement = function(node) {
    this.next();
    this.semicolon();
    return this.finishNode(node, "DebuggerStatement");
  };
  pp$8.parseDoStatement = function(node) {
    this.next();
    this.labels.push(loopLabel);
    node.body = this.parseStatement("do");
    this.labels.pop();
    this.expect(types$1._while);
    node.test = this.parseParenExpression();
    if (this.options.ecmaVersion >= 6) {
      this.eat(types$1.semi);
    } else {
      this.semicolon();
    }
    return this.finishNode(node, "DoWhileStatement");
  };
  pp$8.parseForStatement = function(node) {
    this.next();
    var awaitAt = this.options.ecmaVersion >= 9 && this.canAwait && this.eatContextual("await") ? this.lastTokStart : -1;
    this.labels.push(loopLabel);
    this.enterScope(0);
    this.expect(types$1.parenL);
    if (this.type === types$1.semi) {
      if (awaitAt > -1) {
        this.unexpected(awaitAt);
      }
      return this.parseFor(node, null);
    }
    var isLet = this.isLet();
    if (this.type === types$1._var || this.type === types$1._const || isLet) {
      var init$1 = this.startNode(), kind = isLet ? "let" : this.value;
      this.next();
      this.parseVar(init$1, true, kind);
      this.finishNode(init$1, "VariableDeclaration");
      if ((this.type === types$1._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && init$1.declarations.length === 1) {
        if (this.options.ecmaVersion >= 9) {
          if (this.type === types$1._in) {
            if (awaitAt > -1) {
              this.unexpected(awaitAt);
            }
          } else {
            node.await = awaitAt > -1;
          }
        }
        return this.parseForIn(node, init$1);
      }
      if (awaitAt > -1) {
        this.unexpected(awaitAt);
      }
      return this.parseFor(node, init$1);
    }
    var startsWithLet = this.isContextual("let"), isForOf = false;
    var refDestructuringErrors = new DestructuringErrors();
    var init = this.parseExpression(awaitAt > -1 ? "await" : true, refDestructuringErrors);
    if (this.type === types$1._in || (isForOf = this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
      if (this.options.ecmaVersion >= 9) {
        if (this.type === types$1._in) {
          if (awaitAt > -1) {
            this.unexpected(awaitAt);
          }
        } else {
          node.await = awaitAt > -1;
        }
      }
      if (startsWithLet && isForOf) {
        this.raise(init.start, "The left-hand side of a for-of loop may not start with 'let'.");
      }
      this.toAssignable(init, false, refDestructuringErrors);
      this.checkLValPattern(init);
      return this.parseForIn(node, init);
    } else {
      this.checkExpressionErrors(refDestructuringErrors, true);
    }
    if (awaitAt > -1) {
      this.unexpected(awaitAt);
    }
    return this.parseFor(node, init);
  };
  pp$8.parseFunctionStatement = function(node, isAsync, declarationPosition) {
    this.next();
    return this.parseFunction(node, FUNC_STATEMENT | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT), false, isAsync);
  };
  pp$8.parseIfStatement = function(node) {
    this.next();
    node.test = this.parseParenExpression();
    node.consequent = this.parseStatement("if");
    node.alternate = this.eat(types$1._else) ? this.parseStatement("if") : null;
    return this.finishNode(node, "IfStatement");
  };
  pp$8.parseReturnStatement = function(node) {
    if (!this.inFunction && !this.options.allowReturnOutsideFunction) {
      this.raise(this.start, "'return' outside of function");
    }
    this.next();
    if (this.eat(types$1.semi) || this.insertSemicolon()) {
      node.argument = null;
    } else {
      node.argument = this.parseExpression();
      this.semicolon();
    }
    return this.finishNode(node, "ReturnStatement");
  };
  pp$8.parseSwitchStatement = function(node) {
    this.next();
    node.discriminant = this.parseParenExpression();
    node.cases = [];
    this.expect(types$1.braceL);
    this.labels.push(switchLabel);
    this.enterScope(0);
    var cur;
    for (var sawDefault = false; this.type !== types$1.braceR; ) {
      if (this.type === types$1._case || this.type === types$1._default) {
        var isCase = this.type === types$1._case;
        if (cur) {
          this.finishNode(cur, "SwitchCase");
        }
        node.cases.push(cur = this.startNode());
        cur.consequent = [];
        this.next();
        if (isCase) {
          cur.test = this.parseExpression();
        } else {
          if (sawDefault) {
            this.raiseRecoverable(this.lastTokStart, "Multiple default clauses");
          }
          sawDefault = true;
          cur.test = null;
        }
        this.expect(types$1.colon);
      } else {
        if (!cur) {
          this.unexpected();
        }
        cur.consequent.push(this.parseStatement(null));
      }
    }
    this.exitScope();
    if (cur) {
      this.finishNode(cur, "SwitchCase");
    }
    this.next();
    this.labels.pop();
    return this.finishNode(node, "SwitchStatement");
  };
  pp$8.parseThrowStatement = function(node) {
    this.next();
    if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) {
      this.raise(this.lastTokEnd, "Illegal newline after throw");
    }
    node.argument = this.parseExpression();
    this.semicolon();
    return this.finishNode(node, "ThrowStatement");
  };
  var empty$1 = [];
  pp$8.parseTryStatement = function(node) {
    this.next();
    node.block = this.parseBlock();
    node.handler = null;
    if (this.type === types$1._catch) {
      var clause = this.startNode();
      this.next();
      if (this.eat(types$1.parenL)) {
        clause.param = this.parseBindingAtom();
        var simple = clause.param.type === "Identifier";
        this.enterScope(simple ? SCOPE_SIMPLE_CATCH : 0);
        this.checkLValPattern(clause.param, simple ? BIND_SIMPLE_CATCH : BIND_LEXICAL);
        this.expect(types$1.parenR);
      } else {
        if (this.options.ecmaVersion < 10) {
          this.unexpected();
        }
        clause.param = null;
        this.enterScope(0);
      }
      clause.body = this.parseBlock(false);
      this.exitScope();
      node.handler = this.finishNode(clause, "CatchClause");
    }
    node.finalizer = this.eat(types$1._finally) ? this.parseBlock() : null;
    if (!node.handler && !node.finalizer) {
      this.raise(node.start, "Missing catch or finally clause");
    }
    return this.finishNode(node, "TryStatement");
  };
  pp$8.parseVarStatement = function(node, kind) {
    this.next();
    this.parseVar(node, false, kind);
    this.semicolon();
    return this.finishNode(node, "VariableDeclaration");
  };
  pp$8.parseWhileStatement = function(node) {
    this.next();
    node.test = this.parseParenExpression();
    this.labels.push(loopLabel);
    node.body = this.parseStatement("while");
    this.labels.pop();
    return this.finishNode(node, "WhileStatement");
  };
  pp$8.parseWithStatement = function(node) {
    if (this.strict) {
      this.raise(this.start, "'with' in strict mode");
    }
    this.next();
    node.object = this.parseParenExpression();
    node.body = this.parseStatement("with");
    return this.finishNode(node, "WithStatement");
  };
  pp$8.parseEmptyStatement = function(node) {
    this.next();
    return this.finishNode(node, "EmptyStatement");
  };
  pp$8.parseLabeledStatement = function(node, maybeName, expr, context) {
    for (var i$1 = 0, list = this.labels; i$1 < list.length; i$1 += 1) {
      var label = list[i$1];
      if (label.name === maybeName) {
        this.raise(expr.start, "Label '" + maybeName + "' is already declared");
      }
    }
    var kind = this.type.isLoop ? "loop" : this.type === types$1._switch ? "switch" : null;
    for (var i = this.labels.length - 1; i >= 0; i--) {
      var label$1 = this.labels[i];
      if (label$1.statementStart === node.start) {
        label$1.statementStart = this.start;
        label$1.kind = kind;
      } else {
        break;
      }
    }
    this.labels.push({ name: maybeName, kind, statementStart: this.start });
    node.body = this.parseStatement(context ? context.indexOf("label") === -1 ? context + "label" : context : "label");
    this.labels.pop();
    node.label = expr;
    return this.finishNode(node, "LabeledStatement");
  };
  pp$8.parseExpressionStatement = function(node, expr) {
    node.expression = expr;
    this.semicolon();
    return this.finishNode(node, "ExpressionStatement");
  };
  pp$8.parseBlock = function(createNewLexicalScope, node, exitStrict) {
    if (createNewLexicalScope === void 0)
      createNewLexicalScope = true;
    if (node === void 0)
      node = this.startNode();
    node.body = [];
    this.expect(types$1.braceL);
    if (createNewLexicalScope) {
      this.enterScope(0);
    }
    while (this.type !== types$1.braceR) {
      var stmt = this.parseStatement(null);
      node.body.push(stmt);
    }
    if (exitStrict) {
      this.strict = false;
    }
    this.next();
    if (createNewLexicalScope) {
      this.exitScope();
    }
    return this.finishNode(node, "BlockStatement");
  };
  pp$8.parseFor = function(node, init) {
    node.init = init;
    this.expect(types$1.semi);
    node.test = this.type === types$1.semi ? null : this.parseExpression();
    this.expect(types$1.semi);
    node.update = this.type === types$1.parenR ? null : this.parseExpression();
    this.expect(types$1.parenR);
    node.body = this.parseStatement("for");
    this.exitScope();
    this.labels.pop();
    return this.finishNode(node, "ForStatement");
  };
  pp$8.parseForIn = function(node, init) {
    var isForIn = this.type === types$1._in;
    this.next();
    if (init.type === "VariableDeclaration" && init.declarations[0].init != null && (!isForIn || this.options.ecmaVersion < 8 || this.strict || init.kind !== "var" || init.declarations[0].id.type !== "Identifier")) {
      this.raise(init.start, (isForIn ? "for-in" : "for-of") + " loop variable declaration may not have an initializer");
    }
    node.left = init;
    node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();
    this.expect(types$1.parenR);
    node.body = this.parseStatement("for");
    this.exitScope();
    this.labels.pop();
    return this.finishNode(node, isForIn ? "ForInStatement" : "ForOfStatement");
  };
  pp$8.parseVar = function(node, isFor, kind) {
    node.declarations = [];
    node.kind = kind;
    for (; ; ) {
      var decl = this.startNode();
      this.parseVarId(decl, kind);
      if (this.eat(types$1.eq)) {
        decl.init = this.parseMaybeAssign(isFor);
      } else if (kind === "const" && !(this.type === types$1._in || this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
        this.unexpected();
      } else if (decl.id.type !== "Identifier" && !(isFor && (this.type === types$1._in || this.isContextual("of")))) {
        this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
      } else {
        decl.init = null;
      }
      node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
      if (!this.eat(types$1.comma)) {
        break;
      }
    }
    return node;
  };
  pp$8.parseVarId = function(decl, kind) {
    decl.id = this.parseBindingAtom();
    this.checkLValPattern(decl.id, kind === "var" ? BIND_VAR : BIND_LEXICAL, false);
  };
  var FUNC_STATEMENT = 1;
  var FUNC_HANGING_STATEMENT = 2;
  var FUNC_NULLABLE_ID = 4;
  pp$8.parseFunction = function(node, statement, allowExpressionBody, isAsync, forInit) {
    this.initFunction(node);
    if (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !isAsync) {
      if (this.type === types$1.star && statement & FUNC_HANGING_STATEMENT) {
        this.unexpected();
      }
      node.generator = this.eat(types$1.star);
    }
    if (this.options.ecmaVersion >= 8) {
      node.async = !!isAsync;
    }
    if (statement & FUNC_STATEMENT) {
      node.id = statement & FUNC_NULLABLE_ID && this.type !== types$1.name ? null : this.parseIdent();
      if (node.id && !(statement & FUNC_HANGING_STATEMENT)) {
        this.checkLValSimple(node.id, this.strict || node.generator || node.async ? this.treatFunctionsAsVar ? BIND_VAR : BIND_LEXICAL : BIND_FUNCTION);
      }
    }
    var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
    this.yieldPos = 0;
    this.awaitPos = 0;
    this.awaitIdentPos = 0;
    this.enterScope(functionFlags(node.async, node.generator));
    if (!(statement & FUNC_STATEMENT)) {
      node.id = this.type === types$1.name ? this.parseIdent() : null;
    }
    this.parseFunctionParams(node);
    this.parseFunctionBody(node, allowExpressionBody, false, forInit);
    this.yieldPos = oldYieldPos;
    this.awaitPos = oldAwaitPos;
    this.awaitIdentPos = oldAwaitIdentPos;
    return this.finishNode(node, statement & FUNC_STATEMENT ? "FunctionDeclaration" : "FunctionExpression");
  };
  pp$8.parseFunctionParams = function(node) {
    this.expect(types$1.parenL);
    node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);
    this.checkYieldAwaitInDefaultParams();
  };
  pp$8.parseClass = function(node, isStatement) {
    this.next();
    var oldStrict = this.strict;
    this.strict = true;
    this.parseClassId(node, isStatement);
    this.parseClassSuper(node);
    var privateNameMap = this.enterClassBody();
    var classBody = this.startNode();
    var hadConstructor = false;
    classBody.body = [];
    this.expect(types$1.braceL);
    while (this.type !== types$1.braceR) {
      var element = this.parseClassElement(node.superClass !== null);
      if (element) {
        classBody.body.push(element);
        if (element.type === "MethodDefinition" && element.kind === "constructor") {
          if (hadConstructor) {
            this.raise(element.start, "Duplicate constructor in the same class");
          }
          hadConstructor = true;
        } else if (element.key && element.key.type === "PrivateIdentifier" && isPrivateNameConflicted(privateNameMap, element)) {
          this.raiseRecoverable(element.key.start, "Identifier '#" + element.key.name + "' has already been declared");
        }
      }
    }
    this.strict = oldStrict;
    this.next();
    node.body = this.finishNode(classBody, "ClassBody");
    this.exitClassBody();
    return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
  };
  pp$8.parseClassElement = function(constructorAllowsSuper) {
    if (this.eat(types$1.semi)) {
      return null;
    }
    var ecmaVersion = this.options.ecmaVersion;
    var node = this.startNode();
    var keyName = "";
    var isGenerator = false;
    var isAsync = false;
    var kind = "method";
    var isStatic = false;
    if (this.eatContextual("static")) {
      if (ecmaVersion >= 13 && this.eat(types$1.braceL)) {
        this.parseClassStaticBlock(node);
        return node;
      }
      if (this.isClassElementNameStart() || this.type === types$1.star) {
        isStatic = true;
      } else {
        keyName = "static";
      }
    }
    node.static = isStatic;
    if (!keyName && ecmaVersion >= 8 && this.eatContextual("async")) {
      if ((this.isClassElementNameStart() || this.type === types$1.star) && !this.canInsertSemicolon()) {
        isAsync = true;
      } else {
        keyName = "async";
      }
    }
    if (!keyName && (ecmaVersion >= 9 || !isAsync) && this.eat(types$1.star)) {
      isGenerator = true;
    }
    if (!keyName && !isAsync && !isGenerator) {
      var lastValue = this.value;
      if (this.eatContextual("get") || this.eatContextual("set")) {
        if (this.isClassElementNameStart()) {
          kind = lastValue;
        } else {
          keyName = lastValue;
        }
      }
    }
    if (keyName) {
      node.computed = false;
      node.key = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc);
      node.key.name = keyName;
      this.finishNode(node.key, "Identifier");
    } else {
      this.parseClassElementName(node);
    }
    if (ecmaVersion < 13 || this.type === types$1.parenL || kind !== "method" || isGenerator || isAsync) {
      var isConstructor = !node.static && checkKeyName(node, "constructor");
      var allowsDirectSuper = isConstructor && constructorAllowsSuper;
      if (isConstructor && kind !== "method") {
        this.raise(node.key.start, "Constructor can't have get/set modifier");
      }
      node.kind = isConstructor ? "constructor" : kind;
      this.parseClassMethod(node, isGenerator, isAsync, allowsDirectSuper);
    } else {
      this.parseClassField(node);
    }
    return node;
  };
  pp$8.isClassElementNameStart = function() {
    return this.type === types$1.name || this.type === types$1.privateId || this.type === types$1.num || this.type === types$1.string || this.type === types$1.bracketL || this.type.keyword;
  };
  pp$8.parseClassElementName = function(element) {
    if (this.type === types$1.privateId) {
      if (this.value === "constructor") {
        this.raise(this.start, "Classes can't have an element named '#constructor'");
      }
      element.computed = false;
      element.key = this.parsePrivateIdent();
    } else {
      this.parsePropertyName(element);
    }
  };
  pp$8.parseClassMethod = function(method, isGenerator, isAsync, allowsDirectSuper) {
    var key2 = method.key;
    if (method.kind === "constructor") {
      if (isGenerator) {
        this.raise(key2.start, "Constructor can't be a generator");
      }
      if (isAsync) {
        this.raise(key2.start, "Constructor can't be an async method");
      }
    } else if (method.static && checkKeyName(method, "prototype")) {
      this.raise(key2.start, "Classes may not have a static property named prototype");
    }
    var value = method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);
    if (method.kind === "get" && value.params.length !== 0) {
      this.raiseRecoverable(value.start, "getter should have no params");
    }
    if (method.kind === "set" && value.params.length !== 1) {
      this.raiseRecoverable(value.start, "setter should have exactly one param");
    }
    if (method.kind === "set" && value.params[0].type === "RestElement") {
      this.raiseRecoverable(value.params[0].start, "Setter cannot use rest params");
    }
    return this.finishNode(method, "MethodDefinition");
  };
  pp$8.parseClassField = function(field) {
    if (checkKeyName(field, "constructor")) {
      this.raise(field.key.start, "Classes can't have a field named 'constructor'");
    } else if (field.static && checkKeyName(field, "prototype")) {
      this.raise(field.key.start, "Classes can't have a static field named 'prototype'");
    }
    if (this.eat(types$1.eq)) {
      var scope = this.currentThisScope();
      var inClassFieldInit = scope.inClassFieldInit;
      scope.inClassFieldInit = true;
      field.value = this.parseMaybeAssign();
      scope.inClassFieldInit = inClassFieldInit;
    } else {
      field.value = null;
    }
    this.semicolon();
    return this.finishNode(field, "PropertyDefinition");
  };
  pp$8.parseClassStaticBlock = function(node) {
    node.body = [];
    var oldLabels = this.labels;
    this.labels = [];
    this.enterScope(SCOPE_CLASS_STATIC_BLOCK | SCOPE_SUPER);
    while (this.type !== types$1.braceR) {
      var stmt = this.parseStatement(null);
      node.body.push(stmt);
    }
    this.next();
    this.exitScope();
    this.labels = oldLabels;
    return this.finishNode(node, "StaticBlock");
  };
  pp$8.parseClassId = function(node, isStatement) {
    if (this.type === types$1.name) {
      node.id = this.parseIdent();
      if (isStatement) {
        this.checkLValSimple(node.id, BIND_LEXICAL, false);
      }
    } else {
      if (isStatement === true) {
        this.unexpected();
      }
      node.id = null;
    }
  };
  pp$8.parseClassSuper = function(node) {
    node.superClass = this.eat(types$1._extends) ? this.parseExprSubscripts(false) : null;
  };
  pp$8.enterClassBody = function() {
    var element = { declared: Object.create(null), used: [] };
    this.privateNameStack.push(element);
    return element.declared;
  };
  pp$8.exitClassBody = function() {
    var ref2 = this.privateNameStack.pop();
    var declared = ref2.declared;
    var used = ref2.used;
    var len = this.privateNameStack.length;
    var parent2 = len === 0 ? null : this.privateNameStack[len - 1];
    for (var i = 0; i < used.length; ++i) {
      var id = used[i];
      if (!hasOwn(declared, id.name)) {
        if (parent2) {
          parent2.used.push(id);
        } else {
          this.raiseRecoverable(id.start, "Private field '#" + id.name + "' must be declared in an enclosing class");
        }
      }
    }
  };
  function isPrivateNameConflicted(privateNameMap, element) {
    var name = element.key.name;
    var curr = privateNameMap[name];
    var next = "true";
    if (element.type === "MethodDefinition" && (element.kind === "get" || element.kind === "set")) {
      next = (element.static ? "s" : "i") + element.kind;
    }
    if (curr === "iget" && next === "iset" || curr === "iset" && next === "iget" || curr === "sget" && next === "sset" || curr === "sset" && next === "sget") {
      privateNameMap[name] = "true";
      return false;
    } else if (!curr) {
      privateNameMap[name] = next;
      return false;
    } else {
      return true;
    }
  }
  function checkKeyName(node, name) {
    var computed = node.computed;
    var key2 = node.key;
    return !computed && (key2.type === "Identifier" && key2.name === name || key2.type === "Literal" && key2.value === name);
  }
  pp$8.parseExport = function(node, exports2) {
    this.next();
    if (this.eat(types$1.star)) {
      if (this.options.ecmaVersion >= 11) {
        if (this.eatContextual("as")) {
          node.exported = this.parseModuleExportName();
          this.checkExport(exports2, node.exported.name, this.lastTokStart);
        } else {
          node.exported = null;
        }
      }
      this.expectContextual("from");
      if (this.type !== types$1.string) {
        this.unexpected();
      }
      node.source = this.parseExprAtom();
      this.semicolon();
      return this.finishNode(node, "ExportAllDeclaration");
    }
    if (this.eat(types$1._default)) {
      this.checkExport(exports2, "default", this.lastTokStart);
      var isAsync;
      if (this.type === types$1._function || (isAsync = this.isAsyncFunction())) {
        var fNode = this.startNode();
        this.next();
        if (isAsync) {
          this.next();
        }
        node.declaration = this.parseFunction(fNode, FUNC_STATEMENT | FUNC_NULLABLE_ID, false, isAsync);
      } else if (this.type === types$1._class) {
        var cNode = this.startNode();
        node.declaration = this.parseClass(cNode, "nullableID");
      } else {
        node.declaration = this.parseMaybeAssign();
        this.semicolon();
      }
      return this.finishNode(node, "ExportDefaultDeclaration");
    }
    if (this.shouldParseExportStatement()) {
      node.declaration = this.parseStatement(null);
      if (node.declaration.type === "VariableDeclaration") {
        this.checkVariableExport(exports2, node.declaration.declarations);
      } else {
        this.checkExport(exports2, node.declaration.id.name, node.declaration.id.start);
      }
      node.specifiers = [];
      node.source = null;
    } else {
      node.declaration = null;
      node.specifiers = this.parseExportSpecifiers(exports2);
      if (this.eatContextual("from")) {
        if (this.type !== types$1.string) {
          this.unexpected();
        }
        node.source = this.parseExprAtom();
      } else {
        for (var i = 0, list = node.specifiers; i < list.length; i += 1) {
          var spec = list[i];
          this.checkUnreserved(spec.local);
          this.checkLocalExport(spec.local);
          if (spec.local.type === "Literal") {
            this.raise(spec.local.start, "A string literal cannot be used as an exported binding without `from`.");
          }
        }
        node.source = null;
      }
      this.semicolon();
    }
    return this.finishNode(node, "ExportNamedDeclaration");
  };
  pp$8.checkExport = function(exports2, name, pos) {
    if (!exports2) {
      return;
    }
    if (hasOwn(exports2, name)) {
      this.raiseRecoverable(pos, "Duplicate export '" + name + "'");
    }
    exports2[name] = true;
  };
  pp$8.checkPatternExport = function(exports2, pat) {
    var type = pat.type;
    if (type === "Identifier") {
      this.checkExport(exports2, pat.name, pat.start);
    } else if (type === "ObjectPattern") {
      for (var i = 0, list = pat.properties; i < list.length; i += 1) {
        var prop = list[i];
        this.checkPatternExport(exports2, prop);
      }
    } else if (type === "ArrayPattern") {
      for (var i$1 = 0, list$1 = pat.elements; i$1 < list$1.length; i$1 += 1) {
        var elt = list$1[i$1];
        if (elt) {
          this.checkPatternExport(exports2, elt);
        }
      }
    } else if (type === "Property") {
      this.checkPatternExport(exports2, pat.value);
    } else if (type === "AssignmentPattern") {
      this.checkPatternExport(exports2, pat.left);
    } else if (type === "RestElement") {
      this.checkPatternExport(exports2, pat.argument);
    } else if (type === "ParenthesizedExpression") {
      this.checkPatternExport(exports2, pat.expression);
    }
  };
  pp$8.checkVariableExport = function(exports2, decls) {
    if (!exports2) {
      return;
    }
    for (var i = 0, list = decls; i < list.length; i += 1) {
      var decl = list[i];
      this.checkPatternExport(exports2, decl.id);
    }
  };
  pp$8.shouldParseExportStatement = function() {
    return this.type.keyword === "var" || this.type.keyword === "const" || this.type.keyword === "class" || this.type.keyword === "function" || this.isLet() || this.isAsyncFunction();
  };
  pp$8.parseExportSpecifiers = function(exports2) {
    var nodes = [], first = true;
    this.expect(types$1.braceL);
    while (!this.eat(types$1.braceR)) {
      if (!first) {
        this.expect(types$1.comma);
        if (this.afterTrailingComma(types$1.braceR)) {
          break;
        }
      } else {
        first = false;
      }
      var node = this.startNode();
      node.local = this.parseModuleExportName();
      node.exported = this.eatContextual("as") ? this.parseModuleExportName() : node.local;
      this.checkExport(exports2, node.exported[node.exported.type === "Identifier" ? "name" : "value"], node.exported.start);
      nodes.push(this.finishNode(node, "ExportSpecifier"));
    }
    return nodes;
  };
  pp$8.parseImport = function(node) {
    this.next();
    if (this.type === types$1.string) {
      node.specifiers = empty$1;
      node.source = this.parseExprAtom();
    } else {
      node.specifiers = this.parseImportSpecifiers();
      this.expectContextual("from");
      node.source = this.type === types$1.string ? this.parseExprAtom() : this.unexpected();
    }
    this.semicolon();
    return this.finishNode(node, "ImportDeclaration");
  };
  pp$8.parseImportSpecifiers = function() {
    var nodes = [], first = true;
    if (this.type === types$1.name) {
      var node = this.startNode();
      node.local = this.parseIdent();
      this.checkLValSimple(node.local, BIND_LEXICAL);
      nodes.push(this.finishNode(node, "ImportDefaultSpecifier"));
      if (!this.eat(types$1.comma)) {
        return nodes;
      }
    }
    if (this.type === types$1.star) {
      var node$1 = this.startNode();
      this.next();
      this.expectContextual("as");
      node$1.local = this.parseIdent();
      this.checkLValSimple(node$1.local, BIND_LEXICAL);
      nodes.push(this.finishNode(node$1, "ImportNamespaceSpecifier"));
      return nodes;
    }
    this.expect(types$1.braceL);
    while (!this.eat(types$1.braceR)) {
      if (!first) {
        this.expect(types$1.comma);
        if (this.afterTrailingComma(types$1.braceR)) {
          break;
        }
      } else {
        first = false;
      }
      var node$2 = this.startNode();
      node$2.imported = this.parseModuleExportName();
      if (this.eatContextual("as")) {
        node$2.local = this.parseIdent();
      } else {
        this.checkUnreserved(node$2.imported);
        node$2.local = node$2.imported;
      }
      this.checkLValSimple(node$2.local, BIND_LEXICAL);
      nodes.push(this.finishNode(node$2, "ImportSpecifier"));
    }
    return nodes;
  };
  pp$8.parseModuleExportName = function() {
    if (this.options.ecmaVersion >= 13 && this.type === types$1.string) {
      var stringLiteral = this.parseLiteral(this.value);
      if (loneSurrogate.test(stringLiteral.value)) {
        this.raise(stringLiteral.start, "An export name cannot include a lone surrogate.");
      }
      return stringLiteral;
    }
    return this.parseIdent(true);
  };
  pp$8.adaptDirectivePrologue = function(statements) {
    for (var i = 0; i < statements.length && this.isDirectiveCandidate(statements[i]); ++i) {
      statements[i].directive = statements[i].expression.raw.slice(1, -1);
    }
  };
  pp$8.isDirectiveCandidate = function(statement) {
    return statement.type === "ExpressionStatement" && statement.expression.type === "Literal" && typeof statement.expression.value === "string" && (this.input[statement.start] === '"' || this.input[statement.start] === "'");
  };
  var pp$7 = Parser.prototype;
  pp$7.toAssignable = function(node, isBinding, refDestructuringErrors) {
    if (this.options.ecmaVersion >= 6 && node) {
      switch (node.type) {
        case "Identifier":
          if (this.inAsync && node.name === "await") {
            this.raise(node.start, "Cannot use 'await' as identifier inside an async function");
          }
          break;
        case "ObjectPattern":
        case "ArrayPattern":
        case "AssignmentPattern":
        case "RestElement":
          break;
        case "ObjectExpression":
          node.type = "ObjectPattern";
          if (refDestructuringErrors) {
            this.checkPatternErrors(refDestructuringErrors, true);
          }
          for (var i = 0, list = node.properties; i < list.length; i += 1) {
            var prop = list[i];
            this.toAssignable(prop, isBinding);
            if (prop.type === "RestElement" && (prop.argument.type === "ArrayPattern" || prop.argument.type === "ObjectPattern")) {
              this.raise(prop.argument.start, "Unexpected token");
            }
          }
          break;
        case "Property":
          if (node.kind !== "init") {
            this.raise(node.key.start, "Object pattern can't contain getter or setter");
          }
          this.toAssignable(node.value, isBinding);
          break;
        case "ArrayExpression":
          node.type = "ArrayPattern";
          if (refDestructuringErrors) {
            this.checkPatternErrors(refDestructuringErrors, true);
          }
          this.toAssignableList(node.elements, isBinding);
          break;
        case "SpreadElement":
          node.type = "RestElement";
          this.toAssignable(node.argument, isBinding);
          if (node.argument.type === "AssignmentPattern") {
            this.raise(node.argument.start, "Rest elements cannot have a default value");
          }
          break;
        case "AssignmentExpression":
          if (node.operator !== "=") {
            this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
          }
          node.type = "AssignmentPattern";
          delete node.operator;
          this.toAssignable(node.left, isBinding);
          break;
        case "ParenthesizedExpression":
          this.toAssignable(node.expression, isBinding, refDestructuringErrors);
          break;
        case "ChainExpression":
          this.raiseRecoverable(node.start, "Optional chaining cannot appear in left-hand side");
          break;
        case "MemberExpression":
          if (!isBinding) {
            break;
          }
        default:
          this.raise(node.start, "Assigning to rvalue");
      }
    } else if (refDestructuringErrors) {
      this.checkPatternErrors(refDestructuringErrors, true);
    }
    return node;
  };
  pp$7.toAssignableList = function(exprList, isBinding) {
    var end = exprList.length;
    for (var i = 0; i < end; i++) {
      var elt = exprList[i];
      if (elt) {
        this.toAssignable(elt, isBinding);
      }
    }
    if (end) {
      var last = exprList[end - 1];
      if (this.options.ecmaVersion === 6 && isBinding && last && last.type === "RestElement" && last.argument.type !== "Identifier") {
        this.unexpected(last.argument.start);
      }
    }
    return exprList;
  };
  pp$7.parseSpread = function(refDestructuringErrors) {
    var node = this.startNode();
    this.next();
    node.argument = this.parseMaybeAssign(false, refDestructuringErrors);
    return this.finishNode(node, "SpreadElement");
  };
  pp$7.parseRestBinding = function() {
    var node = this.startNode();
    this.next();
    if (this.options.ecmaVersion === 6 && this.type !== types$1.name) {
      this.unexpected();
    }
    node.argument = this.parseBindingAtom();
    return this.finishNode(node, "RestElement");
  };
  pp$7.parseBindingAtom = function() {
    if (this.options.ecmaVersion >= 6) {
      switch (this.type) {
        case types$1.bracketL:
          var node = this.startNode();
          this.next();
          node.elements = this.parseBindingList(types$1.bracketR, true, true);
          return this.finishNode(node, "ArrayPattern");
        case types$1.braceL:
          return this.parseObj(true);
      }
    }
    return this.parseIdent();
  };
  pp$7.parseBindingList = function(close, allowEmpty, allowTrailingComma) {
    var elts = [], first = true;
    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(types$1.comma);
      }
      if (allowEmpty && this.type === types$1.comma) {
        elts.push(null);
      } else if (allowTrailingComma && this.afterTrailingComma(close)) {
        break;
      } else if (this.type === types$1.ellipsis) {
        var rest = this.parseRestBinding();
        this.parseBindingListItem(rest);
        elts.push(rest);
        if (this.type === types$1.comma) {
          this.raise(this.start, "Comma is not permitted after the rest element");
        }
        this.expect(close);
        break;
      } else {
        var elem = this.parseMaybeDefault(this.start, this.startLoc);
        this.parseBindingListItem(elem);
        elts.push(elem);
      }
    }
    return elts;
  };
  pp$7.parseBindingListItem = function(param) {
    return param;
  };
  pp$7.parseMaybeDefault = function(startPos, startLoc, left) {
    left = left || this.parseBindingAtom();
    if (this.options.ecmaVersion < 6 || !this.eat(types$1.eq)) {
      return left;
    }
    var node = this.startNodeAt(startPos, startLoc);
    node.left = left;
    node.right = this.parseMaybeAssign();
    return this.finishNode(node, "AssignmentPattern");
  };
  pp$7.checkLValSimple = function(expr, bindingType, checkClashes) {
    if (bindingType === void 0)
      bindingType = BIND_NONE;
    var isBind = bindingType !== BIND_NONE;
    switch (expr.type) {
      case "Identifier":
        if (this.strict && this.reservedWordsStrictBind.test(expr.name)) {
          this.raiseRecoverable(expr.start, (isBind ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
        }
        if (isBind) {
          if (bindingType === BIND_LEXICAL && expr.name === "let") {
            this.raiseRecoverable(expr.start, "let is disallowed as a lexically bound name");
          }
          if (checkClashes) {
            if (hasOwn(checkClashes, expr.name)) {
              this.raiseRecoverable(expr.start, "Argument name clash");
            }
            checkClashes[expr.name] = true;
          }
          if (bindingType !== BIND_OUTSIDE) {
            this.declareName(expr.name, bindingType, expr.start);
          }
        }
        break;
      case "ChainExpression":
        this.raiseRecoverable(expr.start, "Optional chaining cannot appear in left-hand side");
        break;
      case "MemberExpression":
        if (isBind) {
          this.raiseRecoverable(expr.start, "Binding member expression");
        }
        break;
      case "ParenthesizedExpression":
        if (isBind) {
          this.raiseRecoverable(expr.start, "Binding parenthesized expression");
        }
        return this.checkLValSimple(expr.expression, bindingType, checkClashes);
      default:
        this.raise(expr.start, (isBind ? "Binding" : "Assigning to") + " rvalue");
    }
  };
  pp$7.checkLValPattern = function(expr, bindingType, checkClashes) {
    if (bindingType === void 0)
      bindingType = BIND_NONE;
    switch (expr.type) {
      case "ObjectPattern":
        for (var i = 0, list = expr.properties; i < list.length; i += 1) {
          var prop = list[i];
          this.checkLValInnerPattern(prop, bindingType, checkClashes);
        }
        break;
      case "ArrayPattern":
        for (var i$1 = 0, list$1 = expr.elements; i$1 < list$1.length; i$1 += 1) {
          var elem = list$1[i$1];
          if (elem) {
            this.checkLValInnerPattern(elem, bindingType, checkClashes);
          }
        }
        break;
      default:
        this.checkLValSimple(expr, bindingType, checkClashes);
    }
  };
  pp$7.checkLValInnerPattern = function(expr, bindingType, checkClashes) {
    if (bindingType === void 0)
      bindingType = BIND_NONE;
    switch (expr.type) {
      case "Property":
        this.checkLValInnerPattern(expr.value, bindingType, checkClashes);
        break;
      case "AssignmentPattern":
        this.checkLValPattern(expr.left, bindingType, checkClashes);
        break;
      case "RestElement":
        this.checkLValPattern(expr.argument, bindingType, checkClashes);
        break;
      default:
        this.checkLValPattern(expr, bindingType, checkClashes);
    }
  };
  var TokContext = function TokContext2(token, isExpr, preserveSpace, override, generator) {
    this.token = token;
    this.isExpr = !!isExpr;
    this.preserveSpace = !!preserveSpace;
    this.override = override;
    this.generator = !!generator;
  };
  var types = {
    b_stat: new TokContext("{", false),
    b_expr: new TokContext("{", true),
    b_tmpl: new TokContext("${", false),
    p_stat: new TokContext("(", false),
    p_expr: new TokContext("(", true),
    q_tmpl: new TokContext("`", true, true, function(p) {
      return p.tryReadTemplateToken();
    }),
    f_stat: new TokContext("function", false),
    f_expr: new TokContext("function", true),
    f_expr_gen: new TokContext("function", true, false, null, true),
    f_gen: new TokContext("function", false, false, null, true)
  };
  var pp$6 = Parser.prototype;
  pp$6.initialContext = function() {
    return [types.b_stat];
  };
  pp$6.curContext = function() {
    return this.context[this.context.length - 1];
  };
  pp$6.braceIsBlock = function(prevType) {
    var parent2 = this.curContext();
    if (parent2 === types.f_expr || parent2 === types.f_stat) {
      return true;
    }
    if (prevType === types$1.colon && (parent2 === types.b_stat || parent2 === types.b_expr)) {
      return !parent2.isExpr;
    }
    if (prevType === types$1._return || prevType === types$1.name && this.exprAllowed) {
      return lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
    }
    if (prevType === types$1._else || prevType === types$1.semi || prevType === types$1.eof || prevType === types$1.parenR || prevType === types$1.arrow) {
      return true;
    }
    if (prevType === types$1.braceL) {
      return parent2 === types.b_stat;
    }
    if (prevType === types$1._var || prevType === types$1._const || prevType === types$1.name) {
      return false;
    }
    return !this.exprAllowed;
  };
  pp$6.inGeneratorContext = function() {
    for (var i = this.context.length - 1; i >= 1; i--) {
      var context = this.context[i];
      if (context.token === "function") {
        return context.generator;
      }
    }
    return false;
  };
  pp$6.updateContext = function(prevType) {
    var update2, type = this.type;
    if (type.keyword && prevType === types$1.dot) {
      this.exprAllowed = false;
    } else if (update2 = type.updateContext) {
      update2.call(this, prevType);
    } else {
      this.exprAllowed = type.beforeExpr;
    }
  };
  pp$6.overrideContext = function(tokenCtx) {
    if (this.curContext() !== tokenCtx) {
      this.context[this.context.length - 1] = tokenCtx;
    }
  };
  types$1.parenR.updateContext = types$1.braceR.updateContext = function() {
    if (this.context.length === 1) {
      this.exprAllowed = true;
      return;
    }
    var out = this.context.pop();
    if (out === types.b_stat && this.curContext().token === "function") {
      out = this.context.pop();
    }
    this.exprAllowed = !out.isExpr;
  };
  types$1.braceL.updateContext = function(prevType) {
    this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);
    this.exprAllowed = true;
  };
  types$1.dollarBraceL.updateContext = function() {
    this.context.push(types.b_tmpl);
    this.exprAllowed = true;
  };
  types$1.parenL.updateContext = function(prevType) {
    var statementParens = prevType === types$1._if || prevType === types$1._for || prevType === types$1._with || prevType === types$1._while;
    this.context.push(statementParens ? types.p_stat : types.p_expr);
    this.exprAllowed = true;
  };
  types$1.incDec.updateContext = function() {
  };
  types$1._function.updateContext = types$1._class.updateContext = function(prevType) {
    if (prevType.beforeExpr && prevType !== types$1._else && !(prevType === types$1.semi && this.curContext() !== types.p_stat) && !(prevType === types$1._return && lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) && !((prevType === types$1.colon || prevType === types$1.braceL) && this.curContext() === types.b_stat)) {
      this.context.push(types.f_expr);
    } else {
      this.context.push(types.f_stat);
    }
    this.exprAllowed = false;
  };
  types$1.backQuote.updateContext = function() {
    if (this.curContext() === types.q_tmpl) {
      this.context.pop();
    } else {
      this.context.push(types.q_tmpl);
    }
    this.exprAllowed = false;
  };
  types$1.star.updateContext = function(prevType) {
    if (prevType === types$1._function) {
      var index = this.context.length - 1;
      if (this.context[index] === types.f_expr) {
        this.context[index] = types.f_expr_gen;
      } else {
        this.context[index] = types.f_gen;
      }
    }
    this.exprAllowed = true;
  };
  types$1.name.updateContext = function(prevType) {
    var allowed = false;
    if (this.options.ecmaVersion >= 6 && prevType !== types$1.dot) {
      if (this.value === "of" && !this.exprAllowed || this.value === "yield" && this.inGeneratorContext()) {
        allowed = true;
      }
    }
    this.exprAllowed = allowed;
  };
  var pp$5 = Parser.prototype;
  pp$5.checkPropClash = function(prop, propHash, refDestructuringErrors) {
    if (this.options.ecmaVersion >= 9 && prop.type === "SpreadElement") {
      return;
    }
    if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand)) {
      return;
    }
    var key2 = prop.key;
    var name;
    switch (key2.type) {
      case "Identifier":
        name = key2.name;
        break;
      case "Literal":
        name = String(key2.value);
        break;
      default:
        return;
    }
    var kind = prop.kind;
    if (this.options.ecmaVersion >= 6) {
      if (name === "__proto__" && kind === "init") {
        if (propHash.proto) {
          if (refDestructuringErrors) {
            if (refDestructuringErrors.doubleProto < 0) {
              refDestructuringErrors.doubleProto = key2.start;
            }
          } else {
            this.raiseRecoverable(key2.start, "Redefinition of __proto__ property");
          }
        }
        propHash.proto = true;
      }
      return;
    }
    name = "$" + name;
    var other = propHash[name];
    if (other) {
      var redefinition;
      if (kind === "init") {
        redefinition = this.strict && other.init || other.get || other.set;
      } else {
        redefinition = other.init || other[kind];
      }
      if (redefinition) {
        this.raiseRecoverable(key2.start, "Redefinition of property");
      }
    } else {
      other = propHash[name] = {
        init: false,
        get: false,
        set: false
      };
    }
    other[kind] = true;
  };
  pp$5.parseExpression = function(forInit, refDestructuringErrors) {
    var startPos = this.start, startLoc = this.startLoc;
    var expr = this.parseMaybeAssign(forInit, refDestructuringErrors);
    if (this.type === types$1.comma) {
      var node = this.startNodeAt(startPos, startLoc);
      node.expressions = [expr];
      while (this.eat(types$1.comma)) {
        node.expressions.push(this.parseMaybeAssign(forInit, refDestructuringErrors));
      }
      return this.finishNode(node, "SequenceExpression");
    }
    return expr;
  };
  pp$5.parseMaybeAssign = function(forInit, refDestructuringErrors, afterLeftParse) {
    if (this.isContextual("yield")) {
      if (this.inGenerator) {
        return this.parseYield(forInit);
      } else {
        this.exprAllowed = false;
      }
    }
    var ownDestructuringErrors = false, oldParenAssign = -1, oldTrailingComma = -1, oldDoubleProto = -1;
    if (refDestructuringErrors) {
      oldParenAssign = refDestructuringErrors.parenthesizedAssign;
      oldTrailingComma = refDestructuringErrors.trailingComma;
      oldDoubleProto = refDestructuringErrors.doubleProto;
      refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = -1;
    } else {
      refDestructuringErrors = new DestructuringErrors();
      ownDestructuringErrors = true;
    }
    var startPos = this.start, startLoc = this.startLoc;
    if (this.type === types$1.parenL || this.type === types$1.name) {
      this.potentialArrowAt = this.start;
      this.potentialArrowInForAwait = forInit === "await";
    }
    var left = this.parseMaybeConditional(forInit, refDestructuringErrors);
    if (afterLeftParse) {
      left = afterLeftParse.call(this, left, startPos, startLoc);
    }
    if (this.type.isAssign) {
      var node = this.startNodeAt(startPos, startLoc);
      node.operator = this.value;
      if (this.type === types$1.eq) {
        left = this.toAssignable(left, false, refDestructuringErrors);
      }
      if (!ownDestructuringErrors) {
        refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = refDestructuringErrors.doubleProto = -1;
      }
      if (refDestructuringErrors.shorthandAssign >= left.start) {
        refDestructuringErrors.shorthandAssign = -1;
      }
      if (this.type === types$1.eq) {
        this.checkLValPattern(left);
      } else {
        this.checkLValSimple(left);
      }
      node.left = left;
      this.next();
      node.right = this.parseMaybeAssign(forInit);
      if (oldDoubleProto > -1) {
        refDestructuringErrors.doubleProto = oldDoubleProto;
      }
      return this.finishNode(node, "AssignmentExpression");
    } else {
      if (ownDestructuringErrors) {
        this.checkExpressionErrors(refDestructuringErrors, true);
      }
    }
    if (oldParenAssign > -1) {
      refDestructuringErrors.parenthesizedAssign = oldParenAssign;
    }
    if (oldTrailingComma > -1) {
      refDestructuringErrors.trailingComma = oldTrailingComma;
    }
    return left;
  };
  pp$5.parseMaybeConditional = function(forInit, refDestructuringErrors) {
    var startPos = this.start, startLoc = this.startLoc;
    var expr = this.parseExprOps(forInit, refDestructuringErrors);
    if (this.checkExpressionErrors(refDestructuringErrors)) {
      return expr;
    }
    if (this.eat(types$1.question)) {
      var node = this.startNodeAt(startPos, startLoc);
      node.test = expr;
      node.consequent = this.parseMaybeAssign();
      this.expect(types$1.colon);
      node.alternate = this.parseMaybeAssign(forInit);
      return this.finishNode(node, "ConditionalExpression");
    }
    return expr;
  };
  pp$5.parseExprOps = function(forInit, refDestructuringErrors) {
    var startPos = this.start, startLoc = this.startLoc;
    var expr = this.parseMaybeUnary(refDestructuringErrors, false, false, forInit);
    if (this.checkExpressionErrors(refDestructuringErrors)) {
      return expr;
    }
    return expr.start === startPos && expr.type === "ArrowFunctionExpression" ? expr : this.parseExprOp(expr, startPos, startLoc, -1, forInit);
  };
  pp$5.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, forInit) {
    var prec = this.type.binop;
    if (prec != null && (!forInit || this.type !== types$1._in)) {
      if (prec > minPrec) {
        var logical = this.type === types$1.logicalOR || this.type === types$1.logicalAND;
        var coalesce = this.type === types$1.coalesce;
        if (coalesce) {
          prec = types$1.logicalAND.binop;
        }
        var op = this.value;
        this.next();
        var startPos = this.start, startLoc = this.startLoc;
        var right = this.parseExprOp(this.parseMaybeUnary(null, false, false, forInit), startPos, startLoc, prec, forInit);
        var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op, logical || coalesce);
        if (logical && this.type === types$1.coalesce || coalesce && (this.type === types$1.logicalOR || this.type === types$1.logicalAND)) {
          this.raiseRecoverable(this.start, "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses");
        }
        return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, forInit);
      }
    }
    return left;
  };
  pp$5.buildBinary = function(startPos, startLoc, left, right, op, logical) {
    if (right.type === "PrivateIdentifier") {
      this.raise(right.start, "Private identifier can only be left side of binary expression");
    }
    var node = this.startNodeAt(startPos, startLoc);
    node.left = left;
    node.operator = op;
    node.right = right;
    return this.finishNode(node, logical ? "LogicalExpression" : "BinaryExpression");
  };
  pp$5.parseMaybeUnary = function(refDestructuringErrors, sawUnary, incDec, forInit) {
    var startPos = this.start, startLoc = this.startLoc, expr;
    if (this.isContextual("await") && this.canAwait) {
      expr = this.parseAwait(forInit);
      sawUnary = true;
    } else if (this.type.prefix) {
      var node = this.startNode(), update2 = this.type === types$1.incDec;
      node.operator = this.value;
      node.prefix = true;
      this.next();
      node.argument = this.parseMaybeUnary(null, true, update2, forInit);
      this.checkExpressionErrors(refDestructuringErrors, true);
      if (update2) {
        this.checkLValSimple(node.argument);
      } else if (this.strict && node.operator === "delete" && node.argument.type === "Identifier") {
        this.raiseRecoverable(node.start, "Deleting local variable in strict mode");
      } else if (node.operator === "delete" && isPrivateFieldAccess(node.argument)) {
        this.raiseRecoverable(node.start, "Private fields can not be deleted");
      } else {
        sawUnary = true;
      }
      expr = this.finishNode(node, update2 ? "UpdateExpression" : "UnaryExpression");
    } else if (!sawUnary && this.type === types$1.privateId) {
      if (forInit || this.privateNameStack.length === 0) {
        this.unexpected();
      }
      expr = this.parsePrivateIdent();
      if (this.type !== types$1._in) {
        this.unexpected();
      }
    } else {
      expr = this.parseExprSubscripts(refDestructuringErrors, forInit);
      if (this.checkExpressionErrors(refDestructuringErrors)) {
        return expr;
      }
      while (this.type.postfix && !this.canInsertSemicolon()) {
        var node$1 = this.startNodeAt(startPos, startLoc);
        node$1.operator = this.value;
        node$1.prefix = false;
        node$1.argument = expr;
        this.checkLValSimple(expr);
        this.next();
        expr = this.finishNode(node$1, "UpdateExpression");
      }
    }
    if (!incDec && this.eat(types$1.starstar)) {
      if (sawUnary) {
        this.unexpected(this.lastTokStart);
      } else {
        return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false, false, forInit), "**", false);
      }
    } else {
      return expr;
    }
  };
  function isPrivateFieldAccess(node) {
    return node.type === "MemberExpression" && node.property.type === "PrivateIdentifier" || node.type === "ChainExpression" && isPrivateFieldAccess(node.expression);
  }
  pp$5.parseExprSubscripts = function(refDestructuringErrors, forInit) {
    var startPos = this.start, startLoc = this.startLoc;
    var expr = this.parseExprAtom(refDestructuringErrors, forInit);
    if (expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")") {
      return expr;
    }
    var result = this.parseSubscripts(expr, startPos, startLoc, false, forInit);
    if (refDestructuringErrors && result.type === "MemberExpression") {
      if (refDestructuringErrors.parenthesizedAssign >= result.start) {
        refDestructuringErrors.parenthesizedAssign = -1;
      }
      if (refDestructuringErrors.parenthesizedBind >= result.start) {
        refDestructuringErrors.parenthesizedBind = -1;
      }
      if (refDestructuringErrors.trailingComma >= result.start) {
        refDestructuringErrors.trailingComma = -1;
      }
    }
    return result;
  };
  pp$5.parseSubscripts = function(base, startPos, startLoc, noCalls, forInit) {
    var maybeAsyncArrow = this.options.ecmaVersion >= 8 && base.type === "Identifier" && base.name === "async" && this.lastTokEnd === base.end && !this.canInsertSemicolon() && base.end - base.start === 5 && this.potentialArrowAt === base.start;
    var optionalChained = false;
    while (true) {
      var element = this.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit);
      if (element.optional) {
        optionalChained = true;
      }
      if (element === base || element.type === "ArrowFunctionExpression") {
        if (optionalChained) {
          var chainNode = this.startNodeAt(startPos, startLoc);
          chainNode.expression = element;
          element = this.finishNode(chainNode, "ChainExpression");
        }
        return element;
      }
      base = element;
    }
  };
  pp$5.parseSubscript = function(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit) {
    var optionalSupported = this.options.ecmaVersion >= 11;
    var optional = optionalSupported && this.eat(types$1.questionDot);
    if (noCalls && optional) {
      this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions");
    }
    var computed = this.eat(types$1.bracketL);
    if (computed || optional && this.type !== types$1.parenL && this.type !== types$1.backQuote || this.eat(types$1.dot)) {
      var node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      if (computed) {
        node.property = this.parseExpression();
        this.expect(types$1.bracketR);
      } else if (this.type === types$1.privateId && base.type !== "Super") {
        node.property = this.parsePrivateIdent();
      } else {
        node.property = this.parseIdent(this.options.allowReserved !== "never");
      }
      node.computed = !!computed;
      if (optionalSupported) {
        node.optional = optional;
      }
      base = this.finishNode(node, "MemberExpression");
    } else if (!noCalls && this.eat(types$1.parenL)) {
      var refDestructuringErrors = new DestructuringErrors(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
      this.yieldPos = 0;
      this.awaitPos = 0;
      this.awaitIdentPos = 0;
      var exprList = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors);
      if (maybeAsyncArrow && !optional && !this.canInsertSemicolon() && this.eat(types$1.arrow)) {
        this.checkPatternErrors(refDestructuringErrors, false);
        this.checkYieldAwaitInDefaultParams();
        if (this.awaitIdentPos > 0) {
          this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function");
        }
        this.yieldPos = oldYieldPos;
        this.awaitPos = oldAwaitPos;
        this.awaitIdentPos = oldAwaitIdentPos;
        return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, true, forInit);
      }
      this.checkExpressionErrors(refDestructuringErrors, true);
      this.yieldPos = oldYieldPos || this.yieldPos;
      this.awaitPos = oldAwaitPos || this.awaitPos;
      this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;
      var node$1 = this.startNodeAt(startPos, startLoc);
      node$1.callee = base;
      node$1.arguments = exprList;
      if (optionalSupported) {
        node$1.optional = optional;
      }
      base = this.finishNode(node$1, "CallExpression");
    } else if (this.type === types$1.backQuote) {
      if (optional || optionalChained) {
        this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions");
      }
      var node$2 = this.startNodeAt(startPos, startLoc);
      node$2.tag = base;
      node$2.quasi = this.parseTemplate({ isTagged: true });
      base = this.finishNode(node$2, "TaggedTemplateExpression");
    }
    return base;
  };
  pp$5.parseExprAtom = function(refDestructuringErrors, forInit) {
    if (this.type === types$1.slash) {
      this.readRegexp();
    }
    var node, canBeArrow = this.potentialArrowAt === this.start;
    switch (this.type) {
      case types$1._super:
        if (!this.allowSuper) {
          this.raise(this.start, "'super' keyword outside a method");
        }
        node = this.startNode();
        this.next();
        if (this.type === types$1.parenL && !this.allowDirectSuper) {
          this.raise(node.start, "super() call outside constructor of a subclass");
        }
        if (this.type !== types$1.dot && this.type !== types$1.bracketL && this.type !== types$1.parenL) {
          this.unexpected();
        }
        return this.finishNode(node, "Super");
      case types$1._this:
        node = this.startNode();
        this.next();
        return this.finishNode(node, "ThisExpression");
      case types$1.name:
        var startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;
        var id = this.parseIdent(false);
        if (this.options.ecmaVersion >= 8 && !containsEsc && id.name === "async" && !this.canInsertSemicolon() && this.eat(types$1._function)) {
          this.overrideContext(types.f_expr);
          return this.parseFunction(this.startNodeAt(startPos, startLoc), 0, false, true, forInit);
        }
        if (canBeArrow && !this.canInsertSemicolon()) {
          if (this.eat(types$1.arrow)) {
            return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], false, forInit);
          }
          if (this.options.ecmaVersion >= 8 && id.name === "async" && this.type === types$1.name && !containsEsc && (!this.potentialArrowInForAwait || this.value !== "of" || this.containsEsc)) {
            id = this.parseIdent(false);
            if (this.canInsertSemicolon() || !this.eat(types$1.arrow)) {
              this.unexpected();
            }
            return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], true, forInit);
          }
        }
        return id;
      case types$1.regexp:
        var value = this.value;
        node = this.parseLiteral(value.value);
        node.regex = { pattern: value.pattern, flags: value.flags };
        return node;
      case types$1.num:
      case types$1.string:
        return this.parseLiteral(this.value);
      case types$1._null:
      case types$1._true:
      case types$1._false:
        node = this.startNode();
        node.value = this.type === types$1._null ? null : this.type === types$1._true;
        node.raw = this.type.keyword;
        this.next();
        return this.finishNode(node, "Literal");
      case types$1.parenL:
        var start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow, forInit);
        if (refDestructuringErrors) {
          if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr)) {
            refDestructuringErrors.parenthesizedAssign = start;
          }
          if (refDestructuringErrors.parenthesizedBind < 0) {
            refDestructuringErrors.parenthesizedBind = start;
          }
        }
        return expr;
      case types$1.bracketL:
        node = this.startNode();
        this.next();
        node.elements = this.parseExprList(types$1.bracketR, true, true, refDestructuringErrors);
        return this.finishNode(node, "ArrayExpression");
      case types$1.braceL:
        this.overrideContext(types.b_expr);
        return this.parseObj(false, refDestructuringErrors);
      case types$1._function:
        node = this.startNode();
        this.next();
        return this.parseFunction(node, 0);
      case types$1._class:
        return this.parseClass(this.startNode(), false);
      case types$1._new:
        return this.parseNew();
      case types$1.backQuote:
        return this.parseTemplate();
      case types$1._import:
        if (this.options.ecmaVersion >= 11) {
          return this.parseExprImport();
        } else {
          return this.unexpected();
        }
      default:
        this.unexpected();
    }
  };
  pp$5.parseExprImport = function() {
    var node = this.startNode();
    if (this.containsEsc) {
      this.raiseRecoverable(this.start, "Escape sequence in keyword import");
    }
    var meta = this.parseIdent(true);
    switch (this.type) {
      case types$1.parenL:
        return this.parseDynamicImport(node);
      case types$1.dot:
        node.meta = meta;
        return this.parseImportMeta(node);
      default:
        this.unexpected();
    }
  };
  pp$5.parseDynamicImport = function(node) {
    this.next();
    node.source = this.parseMaybeAssign();
    if (!this.eat(types$1.parenR)) {
      var errorPos = this.start;
      if (this.eat(types$1.comma) && this.eat(types$1.parenR)) {
        this.raiseRecoverable(errorPos, "Trailing comma is not allowed in import()");
      } else {
        this.unexpected(errorPos);
      }
    }
    return this.finishNode(node, "ImportExpression");
  };
  pp$5.parseImportMeta = function(node) {
    this.next();
    var containsEsc = this.containsEsc;
    node.property = this.parseIdent(true);
    if (node.property.name !== "meta") {
      this.raiseRecoverable(node.property.start, "The only valid meta property for import is 'import.meta'");
    }
    if (containsEsc) {
      this.raiseRecoverable(node.start, "'import.meta' must not contain escaped characters");
    }
    if (this.options.sourceType !== "module" && !this.options.allowImportExportEverywhere) {
      this.raiseRecoverable(node.start, "Cannot use 'import.meta' outside a module");
    }
    return this.finishNode(node, "MetaProperty");
  };
  pp$5.parseLiteral = function(value) {
    var node = this.startNode();
    node.value = value;
    node.raw = this.input.slice(this.start, this.end);
    if (node.raw.charCodeAt(node.raw.length - 1) === 110) {
      node.bigint = node.raw.slice(0, -1).replace(/_/g, "");
    }
    this.next();
    return this.finishNode(node, "Literal");
  };
  pp$5.parseParenExpression = function() {
    this.expect(types$1.parenL);
    var val = this.parseExpression();
    this.expect(types$1.parenR);
    return val;
  };
  pp$5.parseParenAndDistinguishExpression = function(canBeArrow, forInit) {
    var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8;
    if (this.options.ecmaVersion >= 6) {
      this.next();
      var innerStartPos = this.start, innerStartLoc = this.startLoc;
      var exprList = [], first = true, lastIsComma = false;
      var refDestructuringErrors = new DestructuringErrors(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;
      this.yieldPos = 0;
      this.awaitPos = 0;
      while (this.type !== types$1.parenR) {
        first ? first = false : this.expect(types$1.comma);
        if (allowTrailingComma && this.afterTrailingComma(types$1.parenR, true)) {
          lastIsComma = true;
          break;
        } else if (this.type === types$1.ellipsis) {
          spreadStart = this.start;
          exprList.push(this.parseParenItem(this.parseRestBinding()));
          if (this.type === types$1.comma) {
            this.raise(this.start, "Comma is not permitted after the rest element");
          }
          break;
        } else {
          exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
        }
      }
      var innerEndPos = this.lastTokEnd, innerEndLoc = this.lastTokEndLoc;
      this.expect(types$1.parenR);
      if (canBeArrow && !this.canInsertSemicolon() && this.eat(types$1.arrow)) {
        this.checkPatternErrors(refDestructuringErrors, false);
        this.checkYieldAwaitInDefaultParams();
        this.yieldPos = oldYieldPos;
        this.awaitPos = oldAwaitPos;
        return this.parseParenArrowList(startPos, startLoc, exprList, forInit);
      }
      if (!exprList.length || lastIsComma) {
        this.unexpected(this.lastTokStart);
      }
      if (spreadStart) {
        this.unexpected(spreadStart);
      }
      this.checkExpressionErrors(refDestructuringErrors, true);
      this.yieldPos = oldYieldPos || this.yieldPos;
      this.awaitPos = oldAwaitPos || this.awaitPos;
      if (exprList.length > 1) {
        val = this.startNodeAt(innerStartPos, innerStartLoc);
        val.expressions = exprList;
        this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
      } else {
        val = exprList[0];
      }
    } else {
      val = this.parseParenExpression();
    }
    if (this.options.preserveParens) {
      var par = this.startNodeAt(startPos, startLoc);
      par.expression = val;
      return this.finishNode(par, "ParenthesizedExpression");
    } else {
      return val;
    }
  };
  pp$5.parseParenItem = function(item) {
    return item;
  };
  pp$5.parseParenArrowList = function(startPos, startLoc, exprList, forInit) {
    return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, false, forInit);
  };
  var empty = [];
  pp$5.parseNew = function() {
    if (this.containsEsc) {
      this.raiseRecoverable(this.start, "Escape sequence in keyword new");
    }
    var node = this.startNode();
    var meta = this.parseIdent(true);
    if (this.options.ecmaVersion >= 6 && this.eat(types$1.dot)) {
      node.meta = meta;
      var containsEsc = this.containsEsc;
      node.property = this.parseIdent(true);
      if (node.property.name !== "target") {
        this.raiseRecoverable(node.property.start, "The only valid meta property for new is 'new.target'");
      }
      if (containsEsc) {
        this.raiseRecoverable(node.start, "'new.target' must not contain escaped characters");
      }
      if (!this.allowNewDotTarget) {
        this.raiseRecoverable(node.start, "'new.target' can only be used in functions and class static block");
      }
      return this.finishNode(node, "MetaProperty");
    }
    var startPos = this.start, startLoc = this.startLoc, isImport = this.type === types$1._import;
    node.callee = this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true, false);
    if (isImport && node.callee.type === "ImportExpression") {
      this.raise(startPos, "Cannot use new with import()");
    }
    if (this.eat(types$1.parenL)) {
      node.arguments = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false);
    } else {
      node.arguments = empty;
    }
    return this.finishNode(node, "NewExpression");
  };
  pp$5.parseTemplateElement = function(ref2) {
    var isTagged = ref2.isTagged;
    var elem = this.startNode();
    if (this.type === types$1.invalidTemplate) {
      if (!isTagged) {
        this.raiseRecoverable(this.start, "Bad escape sequence in untagged template literal");
      }
      elem.value = {
        raw: this.value,
        cooked: null
      };
    } else {
      elem.value = {
        raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, "\n"),
        cooked: this.value
      };
    }
    this.next();
    elem.tail = this.type === types$1.backQuote;
    return this.finishNode(elem, "TemplateElement");
  };
  pp$5.parseTemplate = function(ref2) {
    if (ref2 === void 0)
      ref2 = {};
    var isTagged = ref2.isTagged;
    if (isTagged === void 0)
      isTagged = false;
    var node = this.startNode();
    this.next();
    node.expressions = [];
    var curElt = this.parseTemplateElement({ isTagged });
    node.quasis = [curElt];
    while (!curElt.tail) {
      if (this.type === types$1.eof) {
        this.raise(this.pos, "Unterminated template literal");
      }
      this.expect(types$1.dollarBraceL);
      node.expressions.push(this.parseExpression());
      this.expect(types$1.braceR);
      node.quasis.push(curElt = this.parseTemplateElement({ isTagged }));
    }
    this.next();
    return this.finishNode(node, "TemplateLiteral");
  };
  pp$5.isAsyncProp = function(prop) {
    return !prop.computed && prop.key.type === "Identifier" && prop.key.name === "async" && (this.type === types$1.name || this.type === types$1.num || this.type === types$1.string || this.type === types$1.bracketL || this.type.keyword || this.options.ecmaVersion >= 9 && this.type === types$1.star) && !lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
  };
  pp$5.parseObj = function(isPattern, refDestructuringErrors) {
    var node = this.startNode(), first = true, propHash = {};
    node.properties = [];
    this.next();
    while (!this.eat(types$1.braceR)) {
      if (!first) {
        this.expect(types$1.comma);
        if (this.options.ecmaVersion >= 5 && this.afterTrailingComma(types$1.braceR)) {
          break;
        }
      } else {
        first = false;
      }
      var prop = this.parseProperty(isPattern, refDestructuringErrors);
      if (!isPattern) {
        this.checkPropClash(prop, propHash, refDestructuringErrors);
      }
      node.properties.push(prop);
    }
    return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
  };
  pp$5.parseProperty = function(isPattern, refDestructuringErrors) {
    var prop = this.startNode(), isGenerator, isAsync, startPos, startLoc;
    if (this.options.ecmaVersion >= 9 && this.eat(types$1.ellipsis)) {
      if (isPattern) {
        prop.argument = this.parseIdent(false);
        if (this.type === types$1.comma) {
          this.raise(this.start, "Comma is not permitted after the rest element");
        }
        return this.finishNode(prop, "RestElement");
      }
      if (this.type === types$1.parenL && refDestructuringErrors) {
        if (refDestructuringErrors.parenthesizedAssign < 0) {
          refDestructuringErrors.parenthesizedAssign = this.start;
        }
        if (refDestructuringErrors.parenthesizedBind < 0) {
          refDestructuringErrors.parenthesizedBind = this.start;
        }
      }
      prop.argument = this.parseMaybeAssign(false, refDestructuringErrors);
      if (this.type === types$1.comma && refDestructuringErrors && refDestructuringErrors.trailingComma < 0) {
        refDestructuringErrors.trailingComma = this.start;
      }
      return this.finishNode(prop, "SpreadElement");
    }
    if (this.options.ecmaVersion >= 6) {
      prop.method = false;
      prop.shorthand = false;
      if (isPattern || refDestructuringErrors) {
        startPos = this.start;
        startLoc = this.startLoc;
      }
      if (!isPattern) {
        isGenerator = this.eat(types$1.star);
      }
    }
    var containsEsc = this.containsEsc;
    this.parsePropertyName(prop);
    if (!isPattern && !containsEsc && this.options.ecmaVersion >= 8 && !isGenerator && this.isAsyncProp(prop)) {
      isAsync = true;
      isGenerator = this.options.ecmaVersion >= 9 && this.eat(types$1.star);
      this.parsePropertyName(prop, refDestructuringErrors);
    } else {
      isAsync = false;
    }
    this.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc);
    return this.finishNode(prop, "Property");
  };
  pp$5.parsePropertyValue = function(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc) {
    if ((isGenerator || isAsync) && this.type === types$1.colon) {
      this.unexpected();
    }
    if (this.eat(types$1.colon)) {
      prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);
      prop.kind = "init";
    } else if (this.options.ecmaVersion >= 6 && this.type === types$1.parenL) {
      if (isPattern) {
        this.unexpected();
      }
      prop.kind = "init";
      prop.method = true;
      prop.value = this.parseMethod(isGenerator, isAsync);
    } else if (!isPattern && !containsEsc && this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.type !== types$1.comma && this.type !== types$1.braceR && this.type !== types$1.eq)) {
      if (isGenerator || isAsync) {
        this.unexpected();
      }
      prop.kind = prop.key.name;
      this.parsePropertyName(prop);
      prop.value = this.parseMethod(false);
      var paramCount = prop.kind === "get" ? 0 : 1;
      if (prop.value.params.length !== paramCount) {
        var start = prop.value.start;
        if (prop.kind === "get") {
          this.raiseRecoverable(start, "getter should have no params");
        } else {
          this.raiseRecoverable(start, "setter should have exactly one param");
        }
      } else {
        if (prop.kind === "set" && prop.value.params[0].type === "RestElement") {
          this.raiseRecoverable(prop.value.params[0].start, "Setter cannot use rest params");
        }
      }
    } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
      if (isGenerator || isAsync) {
        this.unexpected();
      }
      this.checkUnreserved(prop.key);
      if (prop.key.name === "await" && !this.awaitIdentPos) {
        this.awaitIdentPos = startPos;
      }
      prop.kind = "init";
      if (isPattern) {
        prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));
      } else if (this.type === types$1.eq && refDestructuringErrors) {
        if (refDestructuringErrors.shorthandAssign < 0) {
          refDestructuringErrors.shorthandAssign = this.start;
        }
        prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));
      } else {
        prop.value = this.copyNode(prop.key);
      }
      prop.shorthand = true;
    } else {
      this.unexpected();
    }
  };
  pp$5.parsePropertyName = function(prop) {
    if (this.options.ecmaVersion >= 6) {
      if (this.eat(types$1.bracketL)) {
        prop.computed = true;
        prop.key = this.parseMaybeAssign();
        this.expect(types$1.bracketR);
        return prop.key;
      } else {
        prop.computed = false;
      }
    }
    return prop.key = this.type === types$1.num || this.type === types$1.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never");
  };
  pp$5.initFunction = function(node) {
    node.id = null;
    if (this.options.ecmaVersion >= 6) {
      node.generator = node.expression = false;
    }
    if (this.options.ecmaVersion >= 8) {
      node.async = false;
    }
  };
  pp$5.parseMethod = function(isGenerator, isAsync, allowDirectSuper) {
    var node = this.startNode(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
    this.initFunction(node);
    if (this.options.ecmaVersion >= 6) {
      node.generator = isGenerator;
    }
    if (this.options.ecmaVersion >= 8) {
      node.async = !!isAsync;
    }
    this.yieldPos = 0;
    this.awaitPos = 0;
    this.awaitIdentPos = 0;
    this.enterScope(functionFlags(isAsync, node.generator) | SCOPE_SUPER | (allowDirectSuper ? SCOPE_DIRECT_SUPER : 0));
    this.expect(types$1.parenL);
    node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);
    this.checkYieldAwaitInDefaultParams();
    this.parseFunctionBody(node, false, true, false);
    this.yieldPos = oldYieldPos;
    this.awaitPos = oldAwaitPos;
    this.awaitIdentPos = oldAwaitIdentPos;
    return this.finishNode(node, "FunctionExpression");
  };
  pp$5.parseArrowExpression = function(node, params, isAsync, forInit) {
    var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
    this.enterScope(functionFlags(isAsync, false) | SCOPE_ARROW);
    this.initFunction(node);
    if (this.options.ecmaVersion >= 8) {
      node.async = !!isAsync;
    }
    this.yieldPos = 0;
    this.awaitPos = 0;
    this.awaitIdentPos = 0;
    node.params = this.toAssignableList(params, true);
    this.parseFunctionBody(node, true, false, forInit);
    this.yieldPos = oldYieldPos;
    this.awaitPos = oldAwaitPos;
    this.awaitIdentPos = oldAwaitIdentPos;
    return this.finishNode(node, "ArrowFunctionExpression");
  };
  pp$5.parseFunctionBody = function(node, isArrowFunction, isMethod, forInit) {
    var isExpression = isArrowFunction && this.type !== types$1.braceL;
    var oldStrict = this.strict, useStrict = false;
    if (isExpression) {
      node.body = this.parseMaybeAssign(forInit);
      node.expression = true;
      this.checkParams(node, false);
    } else {
      var nonSimple = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(node.params);
      if (!oldStrict || nonSimple) {
        useStrict = this.strictDirective(this.end);
        if (useStrict && nonSimple) {
          this.raiseRecoverable(node.start, "Illegal 'use strict' directive in function with non-simple parameter list");
        }
      }
      var oldLabels = this.labels;
      this.labels = [];
      if (useStrict) {
        this.strict = true;
      }
      this.checkParams(node, !oldStrict && !useStrict && !isArrowFunction && !isMethod && this.isSimpleParamList(node.params));
      if (this.strict && node.id) {
        this.checkLValSimple(node.id, BIND_OUTSIDE);
      }
      node.body = this.parseBlock(false, void 0, useStrict && !oldStrict);
      node.expression = false;
      this.adaptDirectivePrologue(node.body.body);
      this.labels = oldLabels;
    }
    this.exitScope();
  };
  pp$5.isSimpleParamList = function(params) {
    for (var i = 0, list = params; i < list.length; i += 1) {
      var param = list[i];
      if (param.type !== "Identifier") {
        return false;
      }
    }
    return true;
  };
  pp$5.checkParams = function(node, allowDuplicates) {
    var nameHash = Object.create(null);
    for (var i = 0, list = node.params; i < list.length; i += 1) {
      var param = list[i];
      this.checkLValInnerPattern(param, BIND_VAR, allowDuplicates ? null : nameHash);
    }
  };
  pp$5.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
    var elts = [], first = true;
    while (!this.eat(close)) {
      if (!first) {
        this.expect(types$1.comma);
        if (allowTrailingComma && this.afterTrailingComma(close)) {
          break;
        }
      } else {
        first = false;
      }
      var elt = void 0;
      if (allowEmpty && this.type === types$1.comma) {
        elt = null;
      } else if (this.type === types$1.ellipsis) {
        elt = this.parseSpread(refDestructuringErrors);
        if (refDestructuringErrors && this.type === types$1.comma && refDestructuringErrors.trailingComma < 0) {
          refDestructuringErrors.trailingComma = this.start;
        }
      } else {
        elt = this.parseMaybeAssign(false, refDestructuringErrors);
      }
      elts.push(elt);
    }
    return elts;
  };
  pp$5.checkUnreserved = function(ref2) {
    var start = ref2.start;
    var end = ref2.end;
    var name = ref2.name;
    if (this.inGenerator && name === "yield") {
      this.raiseRecoverable(start, "Cannot use 'yield' as identifier inside a generator");
    }
    if (this.inAsync && name === "await") {
      this.raiseRecoverable(start, "Cannot use 'await' as identifier inside an async function");
    }
    if (this.currentThisScope().inClassFieldInit && name === "arguments") {
      this.raiseRecoverable(start, "Cannot use 'arguments' in class field initializer");
    }
    if (this.inClassStaticBlock && (name === "arguments" || name === "await")) {
      this.raise(start, "Cannot use " + name + " in class static initialization block");
    }
    if (this.keywords.test(name)) {
      this.raise(start, "Unexpected keyword '" + name + "'");
    }
    if (this.options.ecmaVersion < 6 && this.input.slice(start, end).indexOf("\\") !== -1) {
      return;
    }
    var re = this.strict ? this.reservedWordsStrict : this.reservedWords;
    if (re.test(name)) {
      if (!this.inAsync && name === "await") {
        this.raiseRecoverable(start, "Cannot use keyword 'await' outside an async function");
      }
      this.raiseRecoverable(start, "The keyword '" + name + "' is reserved");
    }
  };
  pp$5.parseIdent = function(liberal, isBinding) {
    var node = this.startNode();
    if (this.type === types$1.name) {
      node.name = this.value;
    } else if (this.type.keyword) {
      node.name = this.type.keyword;
      if ((node.name === "class" || node.name === "function") && (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46)) {
        this.context.pop();
      }
    } else {
      this.unexpected();
    }
    this.next(!!liberal);
    this.finishNode(node, "Identifier");
    if (!liberal) {
      this.checkUnreserved(node);
      if (node.name === "await" && !this.awaitIdentPos) {
        this.awaitIdentPos = node.start;
      }
    }
    return node;
  };
  pp$5.parsePrivateIdent = function() {
    var node = this.startNode();
    if (this.type === types$1.privateId) {
      node.name = this.value;
    } else {
      this.unexpected();
    }
    this.next();
    this.finishNode(node, "PrivateIdentifier");
    if (this.privateNameStack.length === 0) {
      this.raise(node.start, "Private field '#" + node.name + "' must be declared in an enclosing class");
    } else {
      this.privateNameStack[this.privateNameStack.length - 1].used.push(node);
    }
    return node;
  };
  pp$5.parseYield = function(forInit) {
    if (!this.yieldPos) {
      this.yieldPos = this.start;
    }
    var node = this.startNode();
    this.next();
    if (this.type === types$1.semi || this.canInsertSemicolon() || this.type !== types$1.star && !this.type.startsExpr) {
      node.delegate = false;
      node.argument = null;
    } else {
      node.delegate = this.eat(types$1.star);
      node.argument = this.parseMaybeAssign(forInit);
    }
    return this.finishNode(node, "YieldExpression");
  };
  pp$5.parseAwait = function(forInit) {
    if (!this.awaitPos) {
      this.awaitPos = this.start;
    }
    var node = this.startNode();
    this.next();
    node.argument = this.parseMaybeUnary(null, true, false, forInit);
    return this.finishNode(node, "AwaitExpression");
  };
  var pp$4 = Parser.prototype;
  pp$4.raise = function(pos, message) {
    var loc = getLineInfo(this.input, pos);
    message += " (" + loc.line + ":" + loc.column + ")";
    var err2 = new SyntaxError(message);
    err2.pos = pos;
    err2.loc = loc;
    err2.raisedAt = this.pos;
    throw err2;
  };
  pp$4.raiseRecoverable = pp$4.raise;
  pp$4.curPosition = function() {
    if (this.options.locations) {
      return new Position(this.curLine, this.pos - this.lineStart);
    }
  };
  var pp$3 = Parser.prototype;
  var Scope = function Scope2(flags) {
    this.flags = flags;
    this.var = [];
    this.lexical = [];
    this.functions = [];
    this.inClassFieldInit = false;
  };
  pp$3.enterScope = function(flags) {
    this.scopeStack.push(new Scope(flags));
  };
  pp$3.exitScope = function() {
    this.scopeStack.pop();
  };
  pp$3.treatFunctionsAsVarInScope = function(scope) {
    return scope.flags & SCOPE_FUNCTION || !this.inModule && scope.flags & SCOPE_TOP;
  };
  pp$3.declareName = function(name, bindingType, pos) {
    var redeclared = false;
    if (bindingType === BIND_LEXICAL) {
      var scope = this.currentScope();
      redeclared = scope.lexical.indexOf(name) > -1 || scope.functions.indexOf(name) > -1 || scope.var.indexOf(name) > -1;
      scope.lexical.push(name);
      if (this.inModule && scope.flags & SCOPE_TOP) {
        delete this.undefinedExports[name];
      }
    } else if (bindingType === BIND_SIMPLE_CATCH) {
      var scope$1 = this.currentScope();
      scope$1.lexical.push(name);
    } else if (bindingType === BIND_FUNCTION) {
      var scope$2 = this.currentScope();
      if (this.treatFunctionsAsVar) {
        redeclared = scope$2.lexical.indexOf(name) > -1;
      } else {
        redeclared = scope$2.lexical.indexOf(name) > -1 || scope$2.var.indexOf(name) > -1;
      }
      scope$2.functions.push(name);
    } else {
      for (var i = this.scopeStack.length - 1; i >= 0; --i) {
        var scope$3 = this.scopeStack[i];
        if (scope$3.lexical.indexOf(name) > -1 && !(scope$3.flags & SCOPE_SIMPLE_CATCH && scope$3.lexical[0] === name) || !this.treatFunctionsAsVarInScope(scope$3) && scope$3.functions.indexOf(name) > -1) {
          redeclared = true;
          break;
        }
        scope$3.var.push(name);
        if (this.inModule && scope$3.flags & SCOPE_TOP) {
          delete this.undefinedExports[name];
        }
        if (scope$3.flags & SCOPE_VAR) {
          break;
        }
      }
    }
    if (redeclared) {
      this.raiseRecoverable(pos, "Identifier '" + name + "' has already been declared");
    }
  };
  pp$3.checkLocalExport = function(id) {
    if (this.scopeStack[0].lexical.indexOf(id.name) === -1 && this.scopeStack[0].var.indexOf(id.name) === -1) {
      this.undefinedExports[id.name] = id;
    }
  };
  pp$3.currentScope = function() {
    return this.scopeStack[this.scopeStack.length - 1];
  };
  pp$3.currentVarScope = function() {
    for (var i = this.scopeStack.length - 1; ; i--) {
      var scope = this.scopeStack[i];
      if (scope.flags & SCOPE_VAR) {
        return scope;
      }
    }
  };
  pp$3.currentThisScope = function() {
    for (var i = this.scopeStack.length - 1; ; i--) {
      var scope = this.scopeStack[i];
      if (scope.flags & SCOPE_VAR && !(scope.flags & SCOPE_ARROW)) {
        return scope;
      }
    }
  };
  var Node = function Node2(parser, pos, loc) {
    this.type = "";
    this.start = pos;
    this.end = 0;
    if (parser.options.locations) {
      this.loc = new SourceLocation(parser, loc);
    }
    if (parser.options.directSourceFile) {
      this.sourceFile = parser.options.directSourceFile;
    }
    if (parser.options.ranges) {
      this.range = [pos, 0];
    }
  };
  var pp$2 = Parser.prototype;
  pp$2.startNode = function() {
    return new Node(this, this.start, this.startLoc);
  };
  pp$2.startNodeAt = function(pos, loc) {
    return new Node(this, pos, loc);
  };
  function finishNodeAt(node, type, pos, loc) {
    node.type = type;
    node.end = pos;
    if (this.options.locations) {
      node.loc.end = loc;
    }
    if (this.options.ranges) {
      node.range[1] = pos;
    }
    return node;
  }
  pp$2.finishNode = function(node, type) {
    return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc);
  };
  pp$2.finishNodeAt = function(node, type, pos, loc) {
    return finishNodeAt.call(this, node, type, pos, loc);
  };
  pp$2.copyNode = function(node) {
    var newNode = new Node(this, node.start, this.startLoc);
    for (var prop in node) {
      newNode[prop] = node[prop];
    }
    return newNode;
  };
  var ecma9BinaryProperties = "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS";
  var ecma10BinaryProperties = ecma9BinaryProperties + " Extended_Pictographic";
  var ecma11BinaryProperties = ecma10BinaryProperties;
  var ecma12BinaryProperties = ecma11BinaryProperties + " EBase EComp EMod EPres ExtPict";
  var ecma13BinaryProperties = ecma12BinaryProperties;
  var unicodeBinaryProperties = {
    9: ecma9BinaryProperties,
    10: ecma10BinaryProperties,
    11: ecma11BinaryProperties,
    12: ecma12BinaryProperties,
    13: ecma13BinaryProperties
  };
  var unicodeGeneralCategoryValues = "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu";
  var ecma9ScriptValues = "Adlam Adlm Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb";
  var ecma10ScriptValues = ecma9ScriptValues + " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd";
  var ecma11ScriptValues = ecma10ScriptValues + " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho";
  var ecma12ScriptValues = ecma11ScriptValues + " Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi";
  var ecma13ScriptValues = ecma12ScriptValues + " Cypro_Minoan Cpmn Old_Uyghur Ougr Tangsa Tnsa Toto Vithkuqi Vith";
  var unicodeScriptValues = {
    9: ecma9ScriptValues,
    10: ecma10ScriptValues,
    11: ecma11ScriptValues,
    12: ecma12ScriptValues,
    13: ecma13ScriptValues
  };
  var data = {};
  function buildUnicodeData(ecmaVersion) {
    var d = data[ecmaVersion] = {
      binary: wordsRegexp(unicodeBinaryProperties[ecmaVersion] + " " + unicodeGeneralCategoryValues),
      nonBinary: {
        General_Category: wordsRegexp(unicodeGeneralCategoryValues),
        Script: wordsRegexp(unicodeScriptValues[ecmaVersion])
      }
    };
    d.nonBinary.Script_Extensions = d.nonBinary.Script;
    d.nonBinary.gc = d.nonBinary.General_Category;
    d.nonBinary.sc = d.nonBinary.Script;
    d.nonBinary.scx = d.nonBinary.Script_Extensions;
  }
  for (i = 0, list = [9, 10, 11, 12, 13]; i < list.length; i += 1) {
    ecmaVersion = list[i];
    buildUnicodeData(ecmaVersion);
  }
  var ecmaVersion;
  var i;
  var list;
  var pp$1 = Parser.prototype;
  var RegExpValidationState = function RegExpValidationState2(parser) {
    this.parser = parser;
    this.validFlags = "gim" + (parser.options.ecmaVersion >= 6 ? "uy" : "") + (parser.options.ecmaVersion >= 9 ? "s" : "") + (parser.options.ecmaVersion >= 13 ? "d" : "");
    this.unicodeProperties = data[parser.options.ecmaVersion >= 13 ? 13 : parser.options.ecmaVersion];
    this.source = "";
    this.flags = "";
    this.start = 0;
    this.switchU = false;
    this.switchN = false;
    this.pos = 0;
    this.lastIntValue = 0;
    this.lastStringValue = "";
    this.lastAssertionIsQuantifiable = false;
    this.numCapturingParens = 0;
    this.maxBackReference = 0;
    this.groupNames = [];
    this.backReferenceNames = [];
  };
  RegExpValidationState.prototype.reset = function reset(start, pattern, flags) {
    var unicode = flags.indexOf("u") !== -1;
    this.start = start | 0;
    this.source = pattern + "";
    this.flags = flags;
    this.switchU = unicode && this.parser.options.ecmaVersion >= 6;
    this.switchN = unicode && this.parser.options.ecmaVersion >= 9;
  };
  RegExpValidationState.prototype.raise = function raise(message) {
    this.parser.raiseRecoverable(this.start, "Invalid regular expression: /" + this.source + "/: " + message);
  };
  RegExpValidationState.prototype.at = function at(i, forceU) {
    if (forceU === void 0)
      forceU = false;
    var s = this.source;
    var l = s.length;
    if (i >= l) {
      return -1;
    }
    var c = s.charCodeAt(i);
    if (!(forceU || this.switchU) || c <= 55295 || c >= 57344 || i + 1 >= l) {
      return c;
    }
    var next = s.charCodeAt(i + 1);
    return next >= 56320 && next <= 57343 ? (c << 10) + next - 56613888 : c;
  };
  RegExpValidationState.prototype.nextIndex = function nextIndex(i, forceU) {
    if (forceU === void 0)
      forceU = false;
    var s = this.source;
    var l = s.length;
    if (i >= l) {
      return l;
    }
    var c = s.charCodeAt(i), next;
    if (!(forceU || this.switchU) || c <= 55295 || c >= 57344 || i + 1 >= l || (next = s.charCodeAt(i + 1)) < 56320 || next > 57343) {
      return i + 1;
    }
    return i + 2;
  };
  RegExpValidationState.prototype.current = function current(forceU) {
    if (forceU === void 0)
      forceU = false;
    return this.at(this.pos, forceU);
  };
  RegExpValidationState.prototype.lookahead = function lookahead(forceU) {
    if (forceU === void 0)
      forceU = false;
    return this.at(this.nextIndex(this.pos, forceU), forceU);
  };
  RegExpValidationState.prototype.advance = function advance(forceU) {
    if (forceU === void 0)
      forceU = false;
    this.pos = this.nextIndex(this.pos, forceU);
  };
  RegExpValidationState.prototype.eat = function eat(ch, forceU) {
    if (forceU === void 0)
      forceU = false;
    if (this.current(forceU) === ch) {
      this.advance(forceU);
      return true;
    }
    return false;
  };
  function codePointToString$1(ch) {
    if (ch <= 65535) {
      return String.fromCharCode(ch);
    }
    ch -= 65536;
    return String.fromCharCode((ch >> 10) + 55296, (ch & 1023) + 56320);
  }
  pp$1.validateRegExpFlags = function(state) {
    var validFlags = state.validFlags;
    var flags = state.flags;
    for (var i = 0; i < flags.length; i++) {
      var flag = flags.charAt(i);
      if (validFlags.indexOf(flag) === -1) {
        this.raise(state.start, "Invalid regular expression flag");
      }
      if (flags.indexOf(flag, i + 1) > -1) {
        this.raise(state.start, "Duplicate regular expression flag");
      }
    }
  };
  pp$1.validateRegExpPattern = function(state) {
    this.regexp_pattern(state);
    if (!state.switchN && this.options.ecmaVersion >= 9 && state.groupNames.length > 0) {
      state.switchN = true;
      this.regexp_pattern(state);
    }
  };
  pp$1.regexp_pattern = function(state) {
    state.pos = 0;
    state.lastIntValue = 0;
    state.lastStringValue = "";
    state.lastAssertionIsQuantifiable = false;
    state.numCapturingParens = 0;
    state.maxBackReference = 0;
    state.groupNames.length = 0;
    state.backReferenceNames.length = 0;
    this.regexp_disjunction(state);
    if (state.pos !== state.source.length) {
      if (state.eat(41)) {
        state.raise("Unmatched ')'");
      }
      if (state.eat(93) || state.eat(125)) {
        state.raise("Lone quantifier brackets");
      }
    }
    if (state.maxBackReference > state.numCapturingParens) {
      state.raise("Invalid escape");
    }
    for (var i = 0, list = state.backReferenceNames; i < list.length; i += 1) {
      var name = list[i];
      if (state.groupNames.indexOf(name) === -1) {
        state.raise("Invalid named capture referenced");
      }
    }
  };
  pp$1.regexp_disjunction = function(state) {
    this.regexp_alternative(state);
    while (state.eat(124)) {
      this.regexp_alternative(state);
    }
    if (this.regexp_eatQuantifier(state, true)) {
      state.raise("Nothing to repeat");
    }
    if (state.eat(123)) {
      state.raise("Lone quantifier brackets");
    }
  };
  pp$1.regexp_alternative = function(state) {
    while (state.pos < state.source.length && this.regexp_eatTerm(state)) {
    }
  };
  pp$1.regexp_eatTerm = function(state) {
    if (this.regexp_eatAssertion(state)) {
      if (state.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(state)) {
        if (state.switchU) {
          state.raise("Invalid quantifier");
        }
      }
      return true;
    }
    if (state.switchU ? this.regexp_eatAtom(state) : this.regexp_eatExtendedAtom(state)) {
      this.regexp_eatQuantifier(state);
      return true;
    }
    return false;
  };
  pp$1.regexp_eatAssertion = function(state) {
    var start = state.pos;
    state.lastAssertionIsQuantifiable = false;
    if (state.eat(94) || state.eat(36)) {
      return true;
    }
    if (state.eat(92)) {
      if (state.eat(66) || state.eat(98)) {
        return true;
      }
      state.pos = start;
    }
    if (state.eat(40) && state.eat(63)) {
      var lookbehind = false;
      if (this.options.ecmaVersion >= 9) {
        lookbehind = state.eat(60);
      }
      if (state.eat(61) || state.eat(33)) {
        this.regexp_disjunction(state);
        if (!state.eat(41)) {
          state.raise("Unterminated group");
        }
        state.lastAssertionIsQuantifiable = !lookbehind;
        return true;
      }
    }
    state.pos = start;
    return false;
  };
  pp$1.regexp_eatQuantifier = function(state, noError) {
    if (noError === void 0)
      noError = false;
    if (this.regexp_eatQuantifierPrefix(state, noError)) {
      state.eat(63);
      return true;
    }
    return false;
  };
  pp$1.regexp_eatQuantifierPrefix = function(state, noError) {
    return state.eat(42) || state.eat(43) || state.eat(63) || this.regexp_eatBracedQuantifier(state, noError);
  };
  pp$1.regexp_eatBracedQuantifier = function(state, noError) {
    var start = state.pos;
    if (state.eat(123)) {
      var min = 0, max = -1;
      if (this.regexp_eatDecimalDigits(state)) {
        min = state.lastIntValue;
        if (state.eat(44) && this.regexp_eatDecimalDigits(state)) {
          max = state.lastIntValue;
        }
        if (state.eat(125)) {
          if (max !== -1 && max < min && !noError) {
            state.raise("numbers out of order in {} quantifier");
          }
          return true;
        }
      }
      if (state.switchU && !noError) {
        state.raise("Incomplete quantifier");
      }
      state.pos = start;
    }
    return false;
  };
  pp$1.regexp_eatAtom = function(state) {
    return this.regexp_eatPatternCharacters(state) || state.eat(46) || this.regexp_eatReverseSolidusAtomEscape(state) || this.regexp_eatCharacterClass(state) || this.regexp_eatUncapturingGroup(state) || this.regexp_eatCapturingGroup(state);
  };
  pp$1.regexp_eatReverseSolidusAtomEscape = function(state) {
    var start = state.pos;
    if (state.eat(92)) {
      if (this.regexp_eatAtomEscape(state)) {
        return true;
      }
      state.pos = start;
    }
    return false;
  };
  pp$1.regexp_eatUncapturingGroup = function(state) {
    var start = state.pos;
    if (state.eat(40)) {
      if (state.eat(63) && state.eat(58)) {
        this.regexp_disjunction(state);
        if (state.eat(41)) {
          return true;
        }
        state.raise("Unterminated group");
      }
      state.pos = start;
    }
    return false;
  };
  pp$1.regexp_eatCapturingGroup = function(state) {
    if (state.eat(40)) {
      if (this.options.ecmaVersion >= 9) {
        this.regexp_groupSpecifier(state);
      } else if (state.current() === 63) {
        state.raise("Invalid group");
      }
      this.regexp_disjunction(state);
      if (state.eat(41)) {
        state.numCapturingParens += 1;
        return true;
      }
      state.raise("Unterminated group");
    }
    return false;
  };
  pp$1.regexp_eatExtendedAtom = function(state) {
    return state.eat(46) || this.regexp_eatReverseSolidusAtomEscape(state) || this.regexp_eatCharacterClass(state) || this.regexp_eatUncapturingGroup(state) || this.regexp_eatCapturingGroup(state) || this.regexp_eatInvalidBracedQuantifier(state) || this.regexp_eatExtendedPatternCharacter(state);
  };
  pp$1.regexp_eatInvalidBracedQuantifier = function(state) {
    if (this.regexp_eatBracedQuantifier(state, true)) {
      state.raise("Nothing to repeat");
    }
    return false;
  };
  pp$1.regexp_eatSyntaxCharacter = function(state) {
    var ch = state.current();
    if (isSyntaxCharacter(ch)) {
      state.lastIntValue = ch;
      state.advance();
      return true;
    }
    return false;
  };
  function isSyntaxCharacter(ch) {
    return ch === 36 || ch >= 40 && ch <= 43 || ch === 46 || ch === 63 || ch >= 91 && ch <= 94 || ch >= 123 && ch <= 125;
  }
  pp$1.regexp_eatPatternCharacters = function(state) {
    var start = state.pos;
    var ch = 0;
    while ((ch = state.current()) !== -1 && !isSyntaxCharacter(ch)) {
      state.advance();
    }
    return state.pos !== start;
  };
  pp$1.regexp_eatExtendedPatternCharacter = function(state) {
    var ch = state.current();
    if (ch !== -1 && ch !== 36 && !(ch >= 40 && ch <= 43) && ch !== 46 && ch !== 63 && ch !== 91 && ch !== 94 && ch !== 124) {
      state.advance();
      return true;
    }
    return false;
  };
  pp$1.regexp_groupSpecifier = function(state) {
    if (state.eat(63)) {
      if (this.regexp_eatGroupName(state)) {
        if (state.groupNames.indexOf(state.lastStringValue) !== -1) {
          state.raise("Duplicate capture group name");
        }
        state.groupNames.push(state.lastStringValue);
        return;
      }
      state.raise("Invalid group");
    }
  };
  pp$1.regexp_eatGroupName = function(state) {
    state.lastStringValue = "";
    if (state.eat(60)) {
      if (this.regexp_eatRegExpIdentifierName(state) && state.eat(62)) {
        return true;
      }
      state.raise("Invalid capture group name");
    }
    return false;
  };
  pp$1.regexp_eatRegExpIdentifierName = function(state) {
    state.lastStringValue = "";
    if (this.regexp_eatRegExpIdentifierStart(state)) {
      state.lastStringValue += codePointToString$1(state.lastIntValue);
      while (this.regexp_eatRegExpIdentifierPart(state)) {
        state.lastStringValue += codePointToString$1(state.lastIntValue);
      }
      return true;
    }
    return false;
  };
  pp$1.regexp_eatRegExpIdentifierStart = function(state) {
    var start = state.pos;
    var forceU = this.options.ecmaVersion >= 11;
    var ch = state.current(forceU);
    state.advance(forceU);
    if (ch === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
      ch = state.lastIntValue;
    }
    if (isRegExpIdentifierStart(ch)) {
      state.lastIntValue = ch;
      return true;
    }
    state.pos = start;
    return false;
  };
  function isRegExpIdentifierStart(ch) {
    return isIdentifierStart(ch, true) || ch === 36 || ch === 95;
  }
  pp$1.regexp_eatRegExpIdentifierPart = function(state) {
    var start = state.pos;
    var forceU = this.options.ecmaVersion >= 11;
    var ch = state.current(forceU);
    state.advance(forceU);
    if (ch === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
      ch = state.lastIntValue;
    }
    if (isRegExpIdentifierPart(ch)) {
      state.lastIntValue = ch;
      return true;
    }
    state.pos = start;
    return false;
  };
  function isRegExpIdentifierPart(ch) {
    return isIdentifierChar(ch, true) || ch === 36 || ch === 95 || ch === 8204 || ch === 8205;
  }
  pp$1.regexp_eatAtomEscape = function(state) {
    if (this.regexp_eatBackReference(state) || this.regexp_eatCharacterClassEscape(state) || this.regexp_eatCharacterEscape(state) || state.switchN && this.regexp_eatKGroupName(state)) {
      return true;
    }
    if (state.switchU) {
      if (state.current() === 99) {
        state.raise("Invalid unicode escape");
      }
      state.raise("Invalid escape");
    }
    return false;
  };
  pp$1.regexp_eatBackReference = function(state) {
    var start = state.pos;
    if (this.regexp_eatDecimalEscape(state)) {
      var n2 = state.lastIntValue;
      if (state.switchU) {
        if (n2 > state.maxBackReference) {
          state.maxBackReference = n2;
        }
        return true;
      }
      if (n2 <= state.numCapturingParens) {
        return true;
      }
      state.pos = start;
    }
    return false;
  };
  pp$1.regexp_eatKGroupName = function(state) {
    if (state.eat(107)) {
      if (this.regexp_eatGroupName(state)) {
        state.backReferenceNames.push(state.lastStringValue);
        return true;
      }
      state.raise("Invalid named reference");
    }
    return false;
  };
  pp$1.regexp_eatCharacterEscape = function(state) {
    return this.regexp_eatControlEscape(state) || this.regexp_eatCControlLetter(state) || this.regexp_eatZero(state) || this.regexp_eatHexEscapeSequence(state) || this.regexp_eatRegExpUnicodeEscapeSequence(state, false) || !state.switchU && this.regexp_eatLegacyOctalEscapeSequence(state) || this.regexp_eatIdentityEscape(state);
  };
  pp$1.regexp_eatCControlLetter = function(state) {
    var start = state.pos;
    if (state.eat(99)) {
      if (this.regexp_eatControlLetter(state)) {
        return true;
      }
      state.pos = start;
    }
    return false;
  };
  pp$1.regexp_eatZero = function(state) {
    if (state.current() === 48 && !isDecimalDigit(state.lookahead())) {
      state.lastIntValue = 0;
      state.advance();
      return true;
    }
    return false;
  };
  pp$1.regexp_eatControlEscape = function(state) {
    var ch = state.current();
    if (ch === 116) {
      state.lastIntValue = 9;
      state.advance();
      return true;
    }
    if (ch === 110) {
      state.lastIntValue = 10;
      state.advance();
      return true;
    }
    if (ch === 118) {
      state.lastIntValue = 11;
      state.advance();
      return true;
    }
    if (ch === 102) {
      state.lastIntValue = 12;
      state.advance();
      return true;
    }
    if (ch === 114) {
      state.lastIntValue = 13;
      state.advance();
      return true;
    }
    return false;
  };
  pp$1.regexp_eatControlLetter = function(state) {
    var ch = state.current();
    if (isControlLetter(ch)) {
      state.lastIntValue = ch % 32;
      state.advance();
      return true;
    }
    return false;
  };
  function isControlLetter(ch) {
    return ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122;
  }
  pp$1.regexp_eatRegExpUnicodeEscapeSequence = function(state, forceU) {
    if (forceU === void 0)
      forceU = false;
    var start = state.pos;
    var switchU = forceU || state.switchU;
    if (state.eat(117)) {
      if (this.regexp_eatFixedHexDigits(state, 4)) {
        var lead = state.lastIntValue;
        if (switchU && lead >= 55296 && lead <= 56319) {
          var leadSurrogateEnd = state.pos;
          if (state.eat(92) && state.eat(117) && this.regexp_eatFixedHexDigits(state, 4)) {
            var trail = state.lastIntValue;
            if (trail >= 56320 && trail <= 57343) {
              state.lastIntValue = (lead - 55296) * 1024 + (trail - 56320) + 65536;
              return true;
            }
          }
          state.pos = leadSurrogateEnd;
          state.lastIntValue = lead;
        }
        return true;
      }
      if (switchU && state.eat(123) && this.regexp_eatHexDigits(state) && state.eat(125) && isValidUnicode(state.lastIntValue)) {
        return true;
      }
      if (switchU) {
        state.raise("Invalid unicode escape");
      }
      state.pos = start;
    }
    return false;
  };
  function isValidUnicode(ch) {
    return ch >= 0 && ch <= 1114111;
  }
  pp$1.regexp_eatIdentityEscape = function(state) {
    if (state.switchU) {
      if (this.regexp_eatSyntaxCharacter(state)) {
        return true;
      }
      if (state.eat(47)) {
        state.lastIntValue = 47;
        return true;
      }
      return false;
    }
    var ch = state.current();
    if (ch !== 99 && (!state.switchN || ch !== 107)) {
      state.lastIntValue = ch;
      state.advance();
      return true;
    }
    return false;
  };
  pp$1.regexp_eatDecimalEscape = function(state) {
    state.lastIntValue = 0;
    var ch = state.current();
    if (ch >= 49 && ch <= 57) {
      do {
        state.lastIntValue = 10 * state.lastIntValue + (ch - 48);
        state.advance();
      } while ((ch = state.current()) >= 48 && ch <= 57);
      return true;
    }
    return false;
  };
  pp$1.regexp_eatCharacterClassEscape = function(state) {
    var ch = state.current();
    if (isCharacterClassEscape(ch)) {
      state.lastIntValue = -1;
      state.advance();
      return true;
    }
    if (state.switchU && this.options.ecmaVersion >= 9 && (ch === 80 || ch === 112)) {
      state.lastIntValue = -1;
      state.advance();
      if (state.eat(123) && this.regexp_eatUnicodePropertyValueExpression(state) && state.eat(125)) {
        return true;
      }
      state.raise("Invalid property name");
    }
    return false;
  };
  function isCharacterClassEscape(ch) {
    return ch === 100 || ch === 68 || ch === 115 || ch === 83 || ch === 119 || ch === 87;
  }
  pp$1.regexp_eatUnicodePropertyValueExpression = function(state) {
    var start = state.pos;
    if (this.regexp_eatUnicodePropertyName(state) && state.eat(61)) {
      var name = state.lastStringValue;
      if (this.regexp_eatUnicodePropertyValue(state)) {
        var value = state.lastStringValue;
        this.regexp_validateUnicodePropertyNameAndValue(state, name, value);
        return true;
      }
    }
    state.pos = start;
    if (this.regexp_eatLoneUnicodePropertyNameOrValue(state)) {
      var nameOrValue = state.lastStringValue;
      this.regexp_validateUnicodePropertyNameOrValue(state, nameOrValue);
      return true;
    }
    return false;
  };
  pp$1.regexp_validateUnicodePropertyNameAndValue = function(state, name, value) {
    if (!hasOwn(state.unicodeProperties.nonBinary, name)) {
      state.raise("Invalid property name");
    }
    if (!state.unicodeProperties.nonBinary[name].test(value)) {
      state.raise("Invalid property value");
    }
  };
  pp$1.regexp_validateUnicodePropertyNameOrValue = function(state, nameOrValue) {
    if (!state.unicodeProperties.binary.test(nameOrValue)) {
      state.raise("Invalid property name");
    }
  };
  pp$1.regexp_eatUnicodePropertyName = function(state) {
    var ch = 0;
    state.lastStringValue = "";
    while (isUnicodePropertyNameCharacter(ch = state.current())) {
      state.lastStringValue += codePointToString$1(ch);
      state.advance();
    }
    return state.lastStringValue !== "";
  };
  function isUnicodePropertyNameCharacter(ch) {
    return isControlLetter(ch) || ch === 95;
  }
  pp$1.regexp_eatUnicodePropertyValue = function(state) {
    var ch = 0;
    state.lastStringValue = "";
    while (isUnicodePropertyValueCharacter(ch = state.current())) {
      state.lastStringValue += codePointToString$1(ch);
      state.advance();
    }
    return state.lastStringValue !== "";
  };
  function isUnicodePropertyValueCharacter(ch) {
    return isUnicodePropertyNameCharacter(ch) || isDecimalDigit(ch);
  }
  pp$1.regexp_eatLoneUnicodePropertyNameOrValue = function(state) {
    return this.regexp_eatUnicodePropertyValue(state);
  };
  pp$1.regexp_eatCharacterClass = function(state) {
    if (state.eat(91)) {
      state.eat(94);
      this.regexp_classRanges(state);
      if (state.eat(93)) {
        return true;
      }
      state.raise("Unterminated character class");
    }
    return false;
  };
  pp$1.regexp_classRanges = function(state) {
    while (this.regexp_eatClassAtom(state)) {
      var left = state.lastIntValue;
      if (state.eat(45) && this.regexp_eatClassAtom(state)) {
        var right = state.lastIntValue;
        if (state.switchU && (left === -1 || right === -1)) {
          state.raise("Invalid character class");
        }
        if (left !== -1 && right !== -1 && left > right) {
          state.raise("Range out of order in character class");
        }
      }
    }
  };
  pp$1.regexp_eatClassAtom = function(state) {
    var start = state.pos;
    if (state.eat(92)) {
      if (this.regexp_eatClassEscape(state)) {
        return true;
      }
      if (state.switchU) {
        var ch$1 = state.current();
        if (ch$1 === 99 || isOctalDigit(ch$1)) {
          state.raise("Invalid class escape");
        }
        state.raise("Invalid escape");
      }
      state.pos = start;
    }
    var ch = state.current();
    if (ch !== 93) {
      state.lastIntValue = ch;
      state.advance();
      return true;
    }
    return false;
  };
  pp$1.regexp_eatClassEscape = function(state) {
    var start = state.pos;
    if (state.eat(98)) {
      state.lastIntValue = 8;
      return true;
    }
    if (state.switchU && state.eat(45)) {
      state.lastIntValue = 45;
      return true;
    }
    if (!state.switchU && state.eat(99)) {
      if (this.regexp_eatClassControlLetter(state)) {
        return true;
      }
      state.pos = start;
    }
    return this.regexp_eatCharacterClassEscape(state) || this.regexp_eatCharacterEscape(state);
  };
  pp$1.regexp_eatClassControlLetter = function(state) {
    var ch = state.current();
    if (isDecimalDigit(ch) || ch === 95) {
      state.lastIntValue = ch % 32;
      state.advance();
      return true;
    }
    return false;
  };
  pp$1.regexp_eatHexEscapeSequence = function(state) {
    var start = state.pos;
    if (state.eat(120)) {
      if (this.regexp_eatFixedHexDigits(state, 2)) {
        return true;
      }
      if (state.switchU) {
        state.raise("Invalid escape");
      }
      state.pos = start;
    }
    return false;
  };
  pp$1.regexp_eatDecimalDigits = function(state) {
    var start = state.pos;
    var ch = 0;
    state.lastIntValue = 0;
    while (isDecimalDigit(ch = state.current())) {
      state.lastIntValue = 10 * state.lastIntValue + (ch - 48);
      state.advance();
    }
    return state.pos !== start;
  };
  function isDecimalDigit(ch) {
    return ch >= 48 && ch <= 57;
  }
  pp$1.regexp_eatHexDigits = function(state) {
    var start = state.pos;
    var ch = 0;
    state.lastIntValue = 0;
    while (isHexDigit(ch = state.current())) {
      state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
      state.advance();
    }
    return state.pos !== start;
  };
  function isHexDigit(ch) {
    return ch >= 48 && ch <= 57 || ch >= 65 && ch <= 70 || ch >= 97 && ch <= 102;
  }
  function hexToInt(ch) {
    if (ch >= 65 && ch <= 70) {
      return 10 + (ch - 65);
    }
    if (ch >= 97 && ch <= 102) {
      return 10 + (ch - 97);
    }
    return ch - 48;
  }
  pp$1.regexp_eatLegacyOctalEscapeSequence = function(state) {
    if (this.regexp_eatOctalDigit(state)) {
      var n1 = state.lastIntValue;
      if (this.regexp_eatOctalDigit(state)) {
        var n2 = state.lastIntValue;
        if (n1 <= 3 && this.regexp_eatOctalDigit(state)) {
          state.lastIntValue = n1 * 64 + n2 * 8 + state.lastIntValue;
        } else {
          state.lastIntValue = n1 * 8 + n2;
        }
      } else {
        state.lastIntValue = n1;
      }
      return true;
    }
    return false;
  };
  pp$1.regexp_eatOctalDigit = function(state) {
    var ch = state.current();
    if (isOctalDigit(ch)) {
      state.lastIntValue = ch - 48;
      state.advance();
      return true;
    }
    state.lastIntValue = 0;
    return false;
  };
  function isOctalDigit(ch) {
    return ch >= 48 && ch <= 55;
  }
  pp$1.regexp_eatFixedHexDigits = function(state, length3) {
    var start = state.pos;
    state.lastIntValue = 0;
    for (var i = 0; i < length3; ++i) {
      var ch = state.current();
      if (!isHexDigit(ch)) {
        state.pos = start;
        return false;
      }
      state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
      state.advance();
    }
    return true;
  };
  var Token = function Token2(p) {
    this.type = p.type;
    this.value = p.value;
    this.start = p.start;
    this.end = p.end;
    if (p.options.locations) {
      this.loc = new SourceLocation(p, p.startLoc, p.endLoc);
    }
    if (p.options.ranges) {
      this.range = [p.start, p.end];
    }
  };
  var pp = Parser.prototype;
  pp.next = function(ignoreEscapeSequenceInKeyword) {
    if (!ignoreEscapeSequenceInKeyword && this.type.keyword && this.containsEsc) {
      this.raiseRecoverable(this.start, "Escape sequence in keyword " + this.type.keyword);
    }
    if (this.options.onToken) {
      this.options.onToken(new Token(this));
    }
    this.lastTokEnd = this.end;
    this.lastTokStart = this.start;
    this.lastTokEndLoc = this.endLoc;
    this.lastTokStartLoc = this.startLoc;
    this.nextToken();
  };
  pp.getToken = function() {
    this.next();
    return new Token(this);
  };
  if (typeof Symbol !== "undefined") {
    pp[Symbol.iterator] = function() {
      var this$1$1 = this;
      return {
        next: function() {
          var token = this$1$1.getToken();
          return {
            done: token.type === types$1.eof,
            value: token
          };
        }
      };
    };
  }
  pp.nextToken = function() {
    var curContext = this.curContext();
    if (!curContext || !curContext.preserveSpace) {
      this.skipSpace();
    }
    this.start = this.pos;
    if (this.options.locations) {
      this.startLoc = this.curPosition();
    }
    if (this.pos >= this.input.length) {
      return this.finishToken(types$1.eof);
    }
    if (curContext.override) {
      return curContext.override(this);
    } else {
      this.readToken(this.fullCharCodeAtPos());
    }
  };
  pp.readToken = function(code) {
    if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92) {
      return this.readWord();
    }
    return this.getTokenFromCode(code);
  };
  pp.fullCharCodeAtPos = function() {
    var code = this.input.charCodeAt(this.pos);
    if (code <= 55295 || code >= 56320) {
      return code;
    }
    var next = this.input.charCodeAt(this.pos + 1);
    return next <= 56319 || next >= 57344 ? code : (code << 10) + next - 56613888;
  };
  pp.skipBlockComment = function() {
    var startLoc = this.options.onComment && this.curPosition();
    var start = this.pos, end = this.input.indexOf("*/", this.pos += 2);
    if (end === -1) {
      this.raise(this.pos - 2, "Unterminated comment");
    }
    this.pos = end + 2;
    if (this.options.locations) {
      for (var nextBreak = void 0, pos = start; (nextBreak = nextLineBreak(this.input, pos, this.pos)) > -1; ) {
        ++this.curLine;
        pos = this.lineStart = nextBreak;
      }
    }
    if (this.options.onComment) {
      this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos, startLoc, this.curPosition());
    }
  };
  pp.skipLineComment = function(startSkip) {
    var start = this.pos;
    var startLoc = this.options.onComment && this.curPosition();
    var ch = this.input.charCodeAt(this.pos += startSkip);
    while (this.pos < this.input.length && !isNewLine(ch)) {
      ch = this.input.charCodeAt(++this.pos);
    }
    if (this.options.onComment) {
      this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos, startLoc, this.curPosition());
    }
  };
  pp.skipSpace = function() {
    loop:
      while (this.pos < this.input.length) {
        var ch = this.input.charCodeAt(this.pos);
        switch (ch) {
          case 32:
          case 160:
            ++this.pos;
            break;
          case 13:
            if (this.input.charCodeAt(this.pos + 1) === 10) {
              ++this.pos;
            }
          case 10:
          case 8232:
          case 8233:
            ++this.pos;
            if (this.options.locations) {
              ++this.curLine;
              this.lineStart = this.pos;
            }
            break;
          case 47:
            switch (this.input.charCodeAt(this.pos + 1)) {
              case 42:
                this.skipBlockComment();
                break;
              case 47:
                this.skipLineComment(2);
                break;
              default:
                break loop;
            }
            break;
          default:
            if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
              ++this.pos;
            } else {
              break loop;
            }
        }
      }
  };
  pp.finishToken = function(type, val) {
    this.end = this.pos;
    if (this.options.locations) {
      this.endLoc = this.curPosition();
    }
    var prevType = this.type;
    this.type = type;
    this.value = val;
    this.updateContext(prevType);
  };
  pp.readToken_dot = function() {
    var next = this.input.charCodeAt(this.pos + 1);
    if (next >= 48 && next <= 57) {
      return this.readNumber(true);
    }
    var next2 = this.input.charCodeAt(this.pos + 2);
    if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) {
      this.pos += 3;
      return this.finishToken(types$1.ellipsis);
    } else {
      ++this.pos;
      return this.finishToken(types$1.dot);
    }
  };
  pp.readToken_slash = function() {
    var next = this.input.charCodeAt(this.pos + 1);
    if (this.exprAllowed) {
      ++this.pos;
      return this.readRegexp();
    }
    if (next === 61) {
      return this.finishOp(types$1.assign, 2);
    }
    return this.finishOp(types$1.slash, 1);
  };
  pp.readToken_mult_modulo_exp = function(code) {
    var next = this.input.charCodeAt(this.pos + 1);
    var size = 1;
    var tokentype = code === 42 ? types$1.star : types$1.modulo;
    if (this.options.ecmaVersion >= 7 && code === 42 && next === 42) {
      ++size;
      tokentype = types$1.starstar;
      next = this.input.charCodeAt(this.pos + 2);
    }
    if (next === 61) {
      return this.finishOp(types$1.assign, size + 1);
    }
    return this.finishOp(tokentype, size);
  };
  pp.readToken_pipe_amp = function(code) {
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === code) {
      if (this.options.ecmaVersion >= 12) {
        var next2 = this.input.charCodeAt(this.pos + 2);
        if (next2 === 61) {
          return this.finishOp(types$1.assign, 3);
        }
      }
      return this.finishOp(code === 124 ? types$1.logicalOR : types$1.logicalAND, 2);
    }
    if (next === 61) {
      return this.finishOp(types$1.assign, 2);
    }
    return this.finishOp(code === 124 ? types$1.bitwiseOR : types$1.bitwiseAND, 1);
  };
  pp.readToken_caret = function() {
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === 61) {
      return this.finishOp(types$1.assign, 2);
    }
    return this.finishOp(types$1.bitwiseXOR, 1);
  };
  pp.readToken_plus_min = function(code) {
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === code) {
      if (next === 45 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 62 && (this.lastTokEnd === 0 || lineBreak.test(this.input.slice(this.lastTokEnd, this.pos)))) {
        this.skipLineComment(3);
        this.skipSpace();
        return this.nextToken();
      }
      return this.finishOp(types$1.incDec, 2);
    }
    if (next === 61) {
      return this.finishOp(types$1.assign, 2);
    }
    return this.finishOp(types$1.plusMin, 1);
  };
  pp.readToken_lt_gt = function(code) {
    var next = this.input.charCodeAt(this.pos + 1);
    var size = 1;
    if (next === code) {
      size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
      if (this.input.charCodeAt(this.pos + size) === 61) {
        return this.finishOp(types$1.assign, size + 1);
      }
      return this.finishOp(types$1.bitShift, size);
    }
    if (next === 33 && code === 60 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 45 && this.input.charCodeAt(this.pos + 3) === 45) {
      this.skipLineComment(4);
      this.skipSpace();
      return this.nextToken();
    }
    if (next === 61) {
      size = 2;
    }
    return this.finishOp(types$1.relational, size);
  };
  pp.readToken_eq_excl = function(code) {
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === 61) {
      return this.finishOp(types$1.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2);
    }
    if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) {
      this.pos += 2;
      return this.finishToken(types$1.arrow);
    }
    return this.finishOp(code === 61 ? types$1.eq : types$1.prefix, 1);
  };
  pp.readToken_question = function() {
    var ecmaVersion = this.options.ecmaVersion;
    if (ecmaVersion >= 11) {
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === 46) {
        var next2 = this.input.charCodeAt(this.pos + 2);
        if (next2 < 48 || next2 > 57) {
          return this.finishOp(types$1.questionDot, 2);
        }
      }
      if (next === 63) {
        if (ecmaVersion >= 12) {
          var next2$1 = this.input.charCodeAt(this.pos + 2);
          if (next2$1 === 61) {
            return this.finishOp(types$1.assign, 3);
          }
        }
        return this.finishOp(types$1.coalesce, 2);
      }
    }
    return this.finishOp(types$1.question, 1);
  };
  pp.readToken_numberSign = function() {
    var ecmaVersion = this.options.ecmaVersion;
    var code = 35;
    if (ecmaVersion >= 13) {
      ++this.pos;
      code = this.fullCharCodeAtPos();
      if (isIdentifierStart(code, true) || code === 92) {
        return this.finishToken(types$1.privateId, this.readWord1());
      }
    }
    this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
  };
  pp.getTokenFromCode = function(code) {
    switch (code) {
      case 46:
        return this.readToken_dot();
      case 40:
        ++this.pos;
        return this.finishToken(types$1.parenL);
      case 41:
        ++this.pos;
        return this.finishToken(types$1.parenR);
      case 59:
        ++this.pos;
        return this.finishToken(types$1.semi);
      case 44:
        ++this.pos;
        return this.finishToken(types$1.comma);
      case 91:
        ++this.pos;
        return this.finishToken(types$1.bracketL);
      case 93:
        ++this.pos;
        return this.finishToken(types$1.bracketR);
      case 123:
        ++this.pos;
        return this.finishToken(types$1.braceL);
      case 125:
        ++this.pos;
        return this.finishToken(types$1.braceR);
      case 58:
        ++this.pos;
        return this.finishToken(types$1.colon);
      case 96:
        if (this.options.ecmaVersion < 6) {
          break;
        }
        ++this.pos;
        return this.finishToken(types$1.backQuote);
      case 48:
        var next = this.input.charCodeAt(this.pos + 1);
        if (next === 120 || next === 88) {
          return this.readRadixNumber(16);
        }
        if (this.options.ecmaVersion >= 6) {
          if (next === 111 || next === 79) {
            return this.readRadixNumber(8);
          }
          if (next === 98 || next === 66) {
            return this.readRadixNumber(2);
          }
        }
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
        return this.readNumber(false);
      case 34:
      case 39:
        return this.readString(code);
      case 47:
        return this.readToken_slash();
      case 37:
      case 42:
        return this.readToken_mult_modulo_exp(code);
      case 124:
      case 38:
        return this.readToken_pipe_amp(code);
      case 94:
        return this.readToken_caret();
      case 43:
      case 45:
        return this.readToken_plus_min(code);
      case 60:
      case 62:
        return this.readToken_lt_gt(code);
      case 61:
      case 33:
        return this.readToken_eq_excl(code);
      case 63:
        return this.readToken_question();
      case 126:
        return this.finishOp(types$1.prefix, 1);
      case 35:
        return this.readToken_numberSign();
    }
    this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
  };
  pp.finishOp = function(type, size) {
    var str = this.input.slice(this.pos, this.pos + size);
    this.pos += size;
    return this.finishToken(type, str);
  };
  pp.readRegexp = function() {
    var escaped, inClass, start = this.pos;
    for (; ; ) {
      if (this.pos >= this.input.length) {
        this.raise(start, "Unterminated regular expression");
      }
      var ch = this.input.charAt(this.pos);
      if (lineBreak.test(ch)) {
        this.raise(start, "Unterminated regular expression");
      }
      if (!escaped) {
        if (ch === "[") {
          inClass = true;
        } else if (ch === "]" && inClass) {
          inClass = false;
        } else if (ch === "/" && !inClass) {
          break;
        }
        escaped = ch === "\\";
      } else {
        escaped = false;
      }
      ++this.pos;
    }
    var pattern = this.input.slice(start, this.pos);
    ++this.pos;
    var flagsStart = this.pos;
    var flags = this.readWord1();
    if (this.containsEsc) {
      this.unexpected(flagsStart);
    }
    var state = this.regexpState || (this.regexpState = new RegExpValidationState(this));
    state.reset(start, pattern, flags);
    this.validateRegExpFlags(state);
    this.validateRegExpPattern(state);
    var value = null;
    try {
      value = new RegExp(pattern, flags);
    } catch (e) {
    }
    return this.finishToken(types$1.regexp, { pattern, flags, value });
  };
  pp.readInt = function(radix, len, maybeLegacyOctalNumericLiteral) {
    var allowSeparators = this.options.ecmaVersion >= 12 && len === void 0;
    var isLegacyOctalNumericLiteral = maybeLegacyOctalNumericLiteral && this.input.charCodeAt(this.pos) === 48;
    var start = this.pos, total = 0, lastCode = 0;
    for (var i = 0, e = len == null ? Infinity : len; i < e; ++i, ++this.pos) {
      var code = this.input.charCodeAt(this.pos), val = void 0;
      if (allowSeparators && code === 95) {
        if (isLegacyOctalNumericLiteral) {
          this.raiseRecoverable(this.pos, "Numeric separator is not allowed in legacy octal numeric literals");
        }
        if (lastCode === 95) {
          this.raiseRecoverable(this.pos, "Numeric separator must be exactly one underscore");
        }
        if (i === 0) {
          this.raiseRecoverable(this.pos, "Numeric separator is not allowed at the first of digits");
        }
        lastCode = code;
        continue;
      }
      if (code >= 97) {
        val = code - 97 + 10;
      } else if (code >= 65) {
        val = code - 65 + 10;
      } else if (code >= 48 && code <= 57) {
        val = code - 48;
      } else {
        val = Infinity;
      }
      if (val >= radix) {
        break;
      }
      lastCode = code;
      total = total * radix + val;
    }
    if (allowSeparators && lastCode === 95) {
      this.raiseRecoverable(this.pos - 1, "Numeric separator is not allowed at the last of digits");
    }
    if (this.pos === start || len != null && this.pos - start !== len) {
      return null;
    }
    return total;
  };
  function stringToNumber(str, isLegacyOctalNumericLiteral) {
    if (isLegacyOctalNumericLiteral) {
      return parseInt(str, 8);
    }
    return parseFloat(str.replace(/_/g, ""));
  }
  function stringToBigInt(str) {
    if (typeof BigInt !== "function") {
      return null;
    }
    return BigInt(str.replace(/_/g, ""));
  }
  pp.readRadixNumber = function(radix) {
    var start = this.pos;
    this.pos += 2;
    var val = this.readInt(radix);
    if (val == null) {
      this.raise(this.start + 2, "Expected number in radix " + radix);
    }
    if (this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110) {
      val = stringToBigInt(this.input.slice(start, this.pos));
      ++this.pos;
    } else if (isIdentifierStart(this.fullCharCodeAtPos())) {
      this.raise(this.pos, "Identifier directly after number");
    }
    return this.finishToken(types$1.num, val);
  };
  pp.readNumber = function(startsWithDot) {
    var start = this.pos;
    if (!startsWithDot && this.readInt(10, void 0, true) === null) {
      this.raise(start, "Invalid number");
    }
    var octal = this.pos - start >= 2 && this.input.charCodeAt(start) === 48;
    if (octal && this.strict) {
      this.raise(start, "Invalid number");
    }
    var next = this.input.charCodeAt(this.pos);
    if (!octal && !startsWithDot && this.options.ecmaVersion >= 11 && next === 110) {
      var val$1 = stringToBigInt(this.input.slice(start, this.pos));
      ++this.pos;
      if (isIdentifierStart(this.fullCharCodeAtPos())) {
        this.raise(this.pos, "Identifier directly after number");
      }
      return this.finishToken(types$1.num, val$1);
    }
    if (octal && /[89]/.test(this.input.slice(start, this.pos))) {
      octal = false;
    }
    if (next === 46 && !octal) {
      ++this.pos;
      this.readInt(10);
      next = this.input.charCodeAt(this.pos);
    }
    if ((next === 69 || next === 101) && !octal) {
      next = this.input.charCodeAt(++this.pos);
      if (next === 43 || next === 45) {
        ++this.pos;
      }
      if (this.readInt(10) === null) {
        this.raise(start, "Invalid number");
      }
    }
    if (isIdentifierStart(this.fullCharCodeAtPos())) {
      this.raise(this.pos, "Identifier directly after number");
    }
    var val = stringToNumber(this.input.slice(start, this.pos), octal);
    return this.finishToken(types$1.num, val);
  };
  pp.readCodePoint = function() {
    var ch = this.input.charCodeAt(this.pos), code;
    if (ch === 123) {
      if (this.options.ecmaVersion < 6) {
        this.unexpected();
      }
      var codePos = ++this.pos;
      code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
      ++this.pos;
      if (code > 1114111) {
        this.invalidStringToken(codePos, "Code point out of bounds");
      }
    } else {
      code = this.readHexChar(4);
    }
    return code;
  };
  function codePointToString(code) {
    if (code <= 65535) {
      return String.fromCharCode(code);
    }
    code -= 65536;
    return String.fromCharCode((code >> 10) + 55296, (code & 1023) + 56320);
  }
  pp.readString = function(quote) {
    var out = "", chunkStart = ++this.pos;
    for (; ; ) {
      if (this.pos >= this.input.length) {
        this.raise(this.start, "Unterminated string constant");
      }
      var ch = this.input.charCodeAt(this.pos);
      if (ch === quote) {
        break;
      }
      if (ch === 92) {
        out += this.input.slice(chunkStart, this.pos);
        out += this.readEscapedChar(false);
        chunkStart = this.pos;
      } else if (ch === 8232 || ch === 8233) {
        if (this.options.ecmaVersion < 10) {
          this.raise(this.start, "Unterminated string constant");
        }
        ++this.pos;
        if (this.options.locations) {
          this.curLine++;
          this.lineStart = this.pos;
        }
      } else {
        if (isNewLine(ch)) {
          this.raise(this.start, "Unterminated string constant");
        }
        ++this.pos;
      }
    }
    out += this.input.slice(chunkStart, this.pos++);
    return this.finishToken(types$1.string, out);
  };
  var INVALID_TEMPLATE_ESCAPE_ERROR = {};
  pp.tryReadTemplateToken = function() {
    this.inTemplateElement = true;
    try {
      this.readTmplToken();
    } catch (err2) {
      if (err2 === INVALID_TEMPLATE_ESCAPE_ERROR) {
        this.readInvalidTemplateToken();
      } else {
        throw err2;
      }
    }
    this.inTemplateElement = false;
  };
  pp.invalidStringToken = function(position, message) {
    if (this.inTemplateElement && this.options.ecmaVersion >= 9) {
      throw INVALID_TEMPLATE_ESCAPE_ERROR;
    } else {
      this.raise(position, message);
    }
  };
  pp.readTmplToken = function() {
    var out = "", chunkStart = this.pos;
    for (; ; ) {
      if (this.pos >= this.input.length) {
        this.raise(this.start, "Unterminated template");
      }
      var ch = this.input.charCodeAt(this.pos);
      if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) {
        if (this.pos === this.start && (this.type === types$1.template || this.type === types$1.invalidTemplate)) {
          if (ch === 36) {
            this.pos += 2;
            return this.finishToken(types$1.dollarBraceL);
          } else {
            ++this.pos;
            return this.finishToken(types$1.backQuote);
          }
        }
        out += this.input.slice(chunkStart, this.pos);
        return this.finishToken(types$1.template, out);
      }
      if (ch === 92) {
        out += this.input.slice(chunkStart, this.pos);
        out += this.readEscapedChar(true);
        chunkStart = this.pos;
      } else if (isNewLine(ch)) {
        out += this.input.slice(chunkStart, this.pos);
        ++this.pos;
        switch (ch) {
          case 13:
            if (this.input.charCodeAt(this.pos) === 10) {
              ++this.pos;
            }
          case 10:
            out += "\n";
            break;
          default:
            out += String.fromCharCode(ch);
            break;
        }
        if (this.options.locations) {
          ++this.curLine;
          this.lineStart = this.pos;
        }
        chunkStart = this.pos;
      } else {
        ++this.pos;
      }
    }
  };
  pp.readInvalidTemplateToken = function() {
    for (; this.pos < this.input.length; this.pos++) {
      switch (this.input[this.pos]) {
        case "\\":
          ++this.pos;
          break;
        case "$":
          if (this.input[this.pos + 1] !== "{") {
            break;
          }
        case "`":
          return this.finishToken(types$1.invalidTemplate, this.input.slice(this.start, this.pos));
      }
    }
    this.raise(this.start, "Unterminated template");
  };
  pp.readEscapedChar = function(inTemplate) {
    var ch = this.input.charCodeAt(++this.pos);
    ++this.pos;
    switch (ch) {
      case 110:
        return "\n";
      case 114:
        return "\r";
      case 120:
        return String.fromCharCode(this.readHexChar(2));
      case 117:
        return codePointToString(this.readCodePoint());
      case 116:
        return "	";
      case 98:
        return "\b";
      case 118:
        return "\v";
      case 102:
        return "\f";
      case 13:
        if (this.input.charCodeAt(this.pos) === 10) {
          ++this.pos;
        }
      case 10:
        if (this.options.locations) {
          this.lineStart = this.pos;
          ++this.curLine;
        }
        return "";
      case 56:
      case 57:
        if (this.strict) {
          this.invalidStringToken(this.pos - 1, "Invalid escape sequence");
        }
        if (inTemplate) {
          var codePos = this.pos - 1;
          this.invalidStringToken(codePos, "Invalid escape sequence in template string");
          return null;
        }
      default:
        if (ch >= 48 && ch <= 55) {
          var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
          var octal = parseInt(octalStr, 8);
          if (octal > 255) {
            octalStr = octalStr.slice(0, -1);
            octal = parseInt(octalStr, 8);
          }
          this.pos += octalStr.length - 1;
          ch = this.input.charCodeAt(this.pos);
          if ((octalStr !== "0" || ch === 56 || ch === 57) && (this.strict || inTemplate)) {
            this.invalidStringToken(this.pos - 1 - octalStr.length, inTemplate ? "Octal literal in template string" : "Octal literal in strict mode");
          }
          return String.fromCharCode(octal);
        }
        if (isNewLine(ch)) {
          return "";
        }
        return String.fromCharCode(ch);
    }
  };
  pp.readHexChar = function(len) {
    var codePos = this.pos;
    var n2 = this.readInt(16, len);
    if (n2 === null) {
      this.invalidStringToken(codePos, "Bad character escape sequence");
    }
    return n2;
  };
  pp.readWord1 = function() {
    this.containsEsc = false;
    var word = "", first = true, chunkStart = this.pos;
    var astral = this.options.ecmaVersion >= 6;
    while (this.pos < this.input.length) {
      var ch = this.fullCharCodeAtPos();
      if (isIdentifierChar(ch, astral)) {
        this.pos += ch <= 65535 ? 1 : 2;
      } else if (ch === 92) {
        this.containsEsc = true;
        word += this.input.slice(chunkStart, this.pos);
        var escStart = this.pos;
        if (this.input.charCodeAt(++this.pos) !== 117) {
          this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX");
        }
        ++this.pos;
        var esc = this.readCodePoint();
        if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral)) {
          this.invalidStringToken(escStart, "Invalid Unicode escape");
        }
        word += codePointToString(esc);
        chunkStart = this.pos;
      } else {
        break;
      }
      first = false;
    }
    return word + this.input.slice(chunkStart, this.pos);
  };
  pp.readWord = function() {
    var word = this.readWord1();
    var type = types$1.name;
    if (this.keywords.test(word)) {
      type = keywords[word];
    }
    return this.finishToken(type, word);
  };
  var version = "8.7.0";
  Parser.acorn = {
    Parser,
    version,
    defaultOptions,
    Position,
    SourceLocation,
    getLineInfo,
    Node,
    TokenType: TokenType2,
    tokTypes: types$1,
    keywordTypes: keywords,
    TokContext,
    tokContexts: types,
    isIdentifierChar,
    isIdentifierStart,
    Token,
    isNewLine,
    lineBreak,
    lineBreakG,
    nonASCIIwhitespace
  };
  function parse3(input, options) {
    return Parser.parse(input, options);
  }

  // node_modules/sourcemap-codec/dist/sourcemap-codec.es.js
  var charToInteger = {};
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  for (i = 0; i < chars.length; i++) {
    charToInteger[chars.charCodeAt(i)] = i;
  }
  var i;
  function encode(decoded) {
    var sourceFileIndex = 0;
    var sourceCodeLine = 0;
    var sourceCodeColumn = 0;
    var nameIndex = 0;
    var mappings = "";
    for (var i = 0; i < decoded.length; i++) {
      var line = decoded[i];
      if (i > 0)
        mappings += ";";
      if (line.length === 0)
        continue;
      var generatedCodeColumn = 0;
      var lineMappings = [];
      for (var _i = 0, line_1 = line; _i < line_1.length; _i++) {
        var segment = line_1[_i];
        var segmentMappings = encodeInteger(segment[0] - generatedCodeColumn);
        generatedCodeColumn = segment[0];
        if (segment.length > 1) {
          segmentMappings += encodeInteger(segment[1] - sourceFileIndex) + encodeInteger(segment[2] - sourceCodeLine) + encodeInteger(segment[3] - sourceCodeColumn);
          sourceFileIndex = segment[1];
          sourceCodeLine = segment[2];
          sourceCodeColumn = segment[3];
        }
        if (segment.length === 5) {
          segmentMappings += encodeInteger(segment[4] - nameIndex);
          nameIndex = segment[4];
        }
        lineMappings.push(segmentMappings);
      }
      mappings += lineMappings.join(",");
    }
    return mappings;
  }
  function encodeInteger(num) {
    var result = "";
    num = num < 0 ? -num << 1 | 1 : num << 1;
    do {
      var clamped = num & 31;
      num >>>= 5;
      if (num > 0) {
        clamped |= 32;
      }
      result += chars[clamped];
    } while (num > 0);
    return result;
  }

  // node_modules/magic-string/dist/magic-string.es.js
  var BitSet = function BitSet2(arg) {
    this.bits = arg instanceof BitSet2 ? arg.bits.slice() : [];
  };
  BitSet.prototype.add = function add(n2) {
    this.bits[n2 >> 5] |= 1 << (n2 & 31);
  };
  BitSet.prototype.has = function has(n2) {
    return !!(this.bits[n2 >> 5] & 1 << (n2 & 31));
  };
  var Chunk = function Chunk2(start, end, content) {
    this.start = start;
    this.end = end;
    this.original = content;
    this.intro = "";
    this.outro = "";
    this.content = content;
    this.storeName = false;
    this.edited = false;
    Object.defineProperties(this, {
      previous: { writable: true, value: null },
      next: { writable: true, value: null }
    });
  };
  Chunk.prototype.appendLeft = function appendLeft(content) {
    this.outro += content;
  };
  Chunk.prototype.appendRight = function appendRight(content) {
    this.intro = this.intro + content;
  };
  Chunk.prototype.clone = function clone() {
    var chunk = new Chunk(this.start, this.end, this.original);
    chunk.intro = this.intro;
    chunk.outro = this.outro;
    chunk.content = this.content;
    chunk.storeName = this.storeName;
    chunk.edited = this.edited;
    return chunk;
  };
  Chunk.prototype.contains = function contains(index) {
    return this.start < index && index < this.end;
  };
  Chunk.prototype.eachNext = function eachNext(fn) {
    var chunk = this;
    while (chunk) {
      fn(chunk);
      chunk = chunk.next;
    }
  };
  Chunk.prototype.eachPrevious = function eachPrevious(fn) {
    var chunk = this;
    while (chunk) {
      fn(chunk);
      chunk = chunk.previous;
    }
  };
  Chunk.prototype.edit = function edit(content, storeName, contentOnly) {
    this.content = content;
    if (!contentOnly) {
      this.intro = "";
      this.outro = "";
    }
    this.storeName = storeName;
    this.edited = true;
    return this;
  };
  Chunk.prototype.prependLeft = function prependLeft(content) {
    this.outro = content + this.outro;
  };
  Chunk.prototype.prependRight = function prependRight(content) {
    this.intro = content + this.intro;
  };
  Chunk.prototype.split = function split(index) {
    var sliceIndex = index - this.start;
    var originalBefore = this.original.slice(0, sliceIndex);
    var originalAfter = this.original.slice(sliceIndex);
    this.original = originalBefore;
    var newChunk = new Chunk(index, this.end, originalAfter);
    newChunk.outro = this.outro;
    this.outro = "";
    this.end = index;
    if (this.edited) {
      newChunk.edit("", false);
      this.content = "";
    } else {
      this.content = originalBefore;
    }
    newChunk.next = this.next;
    if (newChunk.next) {
      newChunk.next.previous = newChunk;
    }
    newChunk.previous = this;
    this.next = newChunk;
    return newChunk;
  };
  Chunk.prototype.toString = function toString2() {
    return this.intro + this.content + this.outro;
  };
  Chunk.prototype.trimEnd = function trimEnd(rx) {
    this.outro = this.outro.replace(rx, "");
    if (this.outro.length) {
      return true;
    }
    var trimmed = this.content.replace(rx, "");
    if (trimmed.length) {
      if (trimmed !== this.content) {
        this.split(this.start + trimmed.length).edit("", void 0, true);
      }
      return true;
    } else {
      this.edit("", void 0, true);
      this.intro = this.intro.replace(rx, "");
      if (this.intro.length) {
        return true;
      }
    }
  };
  Chunk.prototype.trimStart = function trimStart(rx) {
    this.intro = this.intro.replace(rx, "");
    if (this.intro.length) {
      return true;
    }
    var trimmed = this.content.replace(rx, "");
    if (trimmed.length) {
      if (trimmed !== this.content) {
        this.split(this.end - trimmed.length);
        this.edit("", void 0, true);
      }
      return true;
    } else {
      this.edit("", void 0, true);
      this.outro = this.outro.replace(rx, "");
      if (this.outro.length) {
        return true;
      }
    }
  };
  var btoa2 = function() {
    throw new Error("Unsupported environment: `window.btoa` or `Buffer` should be supported.");
  };
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    btoa2 = function(str) {
      return window.btoa(unescape(encodeURIComponent(str)));
    };
  } else if (typeof Buffer === "function") {
    btoa2 = function(str) {
      return Buffer.from(str, "utf-8").toString("base64");
    };
  }
  var SourceMap = function SourceMap2(properties) {
    this.version = 3;
    this.file = properties.file;
    this.sources = properties.sources;
    this.sourcesContent = properties.sourcesContent;
    this.names = properties.names;
    this.mappings = encode(properties.mappings);
  };
  SourceMap.prototype.toString = function toString3() {
    return JSON.stringify(this);
  };
  SourceMap.prototype.toUrl = function toUrl() {
    return "data:application/json;charset=utf-8;base64," + btoa2(this.toString());
  };
  function guessIndent(code) {
    var lines = code.split("\n");
    var tabbed = lines.filter(function(line) {
      return /^\t+/.test(line);
    });
    var spaced = lines.filter(function(line) {
      return /^ {2,}/.test(line);
    });
    if (tabbed.length === 0 && spaced.length === 0) {
      return null;
    }
    if (tabbed.length >= spaced.length) {
      return "	";
    }
    var min = spaced.reduce(function(previous, current2) {
      var numSpaces = /^ +/.exec(current2)[0].length;
      return Math.min(numSpaces, previous);
    }, Infinity);
    return new Array(min + 1).join(" ");
  }
  function getRelativePath(from2, to) {
    var fromParts = from2.split(/[/\\]/);
    var toParts = to.split(/[/\\]/);
    fromParts.pop();
    while (fromParts[0] === toParts[0]) {
      fromParts.shift();
      toParts.shift();
    }
    if (fromParts.length) {
      var i = fromParts.length;
      while (i--) {
        fromParts[i] = "..";
      }
    }
    return fromParts.concat(toParts).join("/");
  }
  var toString4 = Object.prototype.toString;
  function isObject(thing) {
    return toString4.call(thing) === "[object Object]";
  }
  function getLocator(source2) {
    var originalLines = source2.split("\n");
    var lineOffsets = [];
    for (var i = 0, pos = 0; i < originalLines.length; i++) {
      lineOffsets.push(pos);
      pos += originalLines[i].length + 1;
    }
    return function locate(index) {
      var i2 = 0;
      var j = lineOffsets.length;
      while (i2 < j) {
        var m = i2 + j >> 1;
        if (index < lineOffsets[m]) {
          j = m;
        } else {
          i2 = m + 1;
        }
      }
      var line = i2 - 1;
      var column = index - lineOffsets[line];
      return { line, column };
    };
  }
  var Mappings = function Mappings2(hires) {
    this.hires = hires;
    this.generatedCodeLine = 0;
    this.generatedCodeColumn = 0;
    this.raw = [];
    this.rawSegments = this.raw[this.generatedCodeLine] = [];
    this.pending = null;
  };
  Mappings.prototype.addEdit = function addEdit(sourceIndex, content, loc, nameIndex) {
    if (content.length) {
      var segment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
      if (nameIndex >= 0) {
        segment.push(nameIndex);
      }
      this.rawSegments.push(segment);
    } else if (this.pending) {
      this.rawSegments.push(this.pending);
    }
    this.advance(content);
    this.pending = null;
  };
  Mappings.prototype.addUneditedChunk = function addUneditedChunk(sourceIndex, chunk, original, loc, sourcemapLocations) {
    var originalCharIndex = chunk.start;
    var first = true;
    while (originalCharIndex < chunk.end) {
      if (this.hires || first || sourcemapLocations.has(originalCharIndex)) {
        this.rawSegments.push([this.generatedCodeColumn, sourceIndex, loc.line, loc.column]);
      }
      if (original[originalCharIndex] === "\n") {
        loc.line += 1;
        loc.column = 0;
        this.generatedCodeLine += 1;
        this.raw[this.generatedCodeLine] = this.rawSegments = [];
        this.generatedCodeColumn = 0;
        first = true;
      } else {
        loc.column += 1;
        this.generatedCodeColumn += 1;
        first = false;
      }
      originalCharIndex += 1;
    }
    this.pending = null;
  };
  Mappings.prototype.advance = function advance2(str) {
    if (!str) {
      return;
    }
    var lines = str.split("\n");
    if (lines.length > 1) {
      for (var i = 0; i < lines.length - 1; i++) {
        this.generatedCodeLine++;
        this.raw[this.generatedCodeLine] = this.rawSegments = [];
      }
      this.generatedCodeColumn = 0;
    }
    this.generatedCodeColumn += lines[lines.length - 1].length;
  };
  var n = "\n";
  var warned = {
    insertLeft: false,
    insertRight: false,
    storeName: false
  };
  var MagicString = function MagicString2(string, options) {
    if (options === void 0)
      options = {};
    var chunk = new Chunk(0, string.length, string);
    Object.defineProperties(this, {
      original: { writable: true, value: string },
      outro: { writable: true, value: "" },
      intro: { writable: true, value: "" },
      firstChunk: { writable: true, value: chunk },
      lastChunk: { writable: true, value: chunk },
      lastSearchedChunk: { writable: true, value: chunk },
      byStart: { writable: true, value: {} },
      byEnd: { writable: true, value: {} },
      filename: { writable: true, value: options.filename },
      indentExclusionRanges: { writable: true, value: options.indentExclusionRanges },
      sourcemapLocations: { writable: true, value: new BitSet() },
      storedNames: { writable: true, value: {} },
      indentStr: { writable: true, value: guessIndent(string) }
    });
    this.byStart[0] = chunk;
    this.byEnd[string.length] = chunk;
  };
  MagicString.prototype.addSourcemapLocation = function addSourcemapLocation(char) {
    this.sourcemapLocations.add(char);
  };
  MagicString.prototype.append = function append(content) {
    if (typeof content !== "string") {
      throw new TypeError("outro content must be a string");
    }
    this.outro += content;
    return this;
  };
  MagicString.prototype.appendLeft = function appendLeft2(index, content) {
    if (typeof content !== "string") {
      throw new TypeError("inserted content must be a string");
    }
    this._split(index);
    var chunk = this.byEnd[index];
    if (chunk) {
      chunk.appendLeft(content);
    } else {
      this.intro += content;
    }
    return this;
  };
  MagicString.prototype.appendRight = function appendRight2(index, content) {
    if (typeof content !== "string") {
      throw new TypeError("inserted content must be a string");
    }
    this._split(index);
    var chunk = this.byStart[index];
    if (chunk) {
      chunk.appendRight(content);
    } else {
      this.outro += content;
    }
    return this;
  };
  MagicString.prototype.clone = function clone2() {
    var cloned = new MagicString(this.original, { filename: this.filename });
    var originalChunk = this.firstChunk;
    var clonedChunk = cloned.firstChunk = cloned.lastSearchedChunk = originalChunk.clone();
    while (originalChunk) {
      cloned.byStart[clonedChunk.start] = clonedChunk;
      cloned.byEnd[clonedChunk.end] = clonedChunk;
      var nextOriginalChunk = originalChunk.next;
      var nextClonedChunk = nextOriginalChunk && nextOriginalChunk.clone();
      if (nextClonedChunk) {
        clonedChunk.next = nextClonedChunk;
        nextClonedChunk.previous = clonedChunk;
        clonedChunk = nextClonedChunk;
      }
      originalChunk = nextOriginalChunk;
    }
    cloned.lastChunk = clonedChunk;
    if (this.indentExclusionRanges) {
      cloned.indentExclusionRanges = this.indentExclusionRanges.slice();
    }
    cloned.sourcemapLocations = new BitSet(this.sourcemapLocations);
    cloned.intro = this.intro;
    cloned.outro = this.outro;
    return cloned;
  };
  MagicString.prototype.generateDecodedMap = function generateDecodedMap(options) {
    var this$1 = this;
    options = options || {};
    var sourceIndex = 0;
    var names = Object.keys(this.storedNames);
    var mappings = new Mappings(options.hires);
    var locate = getLocator(this.original);
    if (this.intro) {
      mappings.advance(this.intro);
    }
    this.firstChunk.eachNext(function(chunk) {
      var loc = locate(chunk.start);
      if (chunk.intro.length) {
        mappings.advance(chunk.intro);
      }
      if (chunk.edited) {
        mappings.addEdit(sourceIndex, chunk.content, loc, chunk.storeName ? names.indexOf(chunk.original) : -1);
      } else {
        mappings.addUneditedChunk(sourceIndex, chunk, this$1.original, loc, this$1.sourcemapLocations);
      }
      if (chunk.outro.length) {
        mappings.advance(chunk.outro);
      }
    });
    return {
      file: options.file ? options.file.split(/[/\\]/).pop() : null,
      sources: [options.source ? getRelativePath(options.file || "", options.source) : null],
      sourcesContent: options.includeContent ? [this.original] : [null],
      names,
      mappings: mappings.raw
    };
  };
  MagicString.prototype.generateMap = function generateMap(options) {
    return new SourceMap(this.generateDecodedMap(options));
  };
  MagicString.prototype.getIndentString = function getIndentString() {
    return this.indentStr === null ? "	" : this.indentStr;
  };
  MagicString.prototype.indent = function indent(indentStr, options) {
    var pattern = /^[^\r\n]/gm;
    if (isObject(indentStr)) {
      options = indentStr;
      indentStr = void 0;
    }
    indentStr = indentStr !== void 0 ? indentStr : this.indentStr || "	";
    if (indentStr === "") {
      return this;
    }
    options = options || {};
    var isExcluded = {};
    if (options.exclude) {
      var exclusions = typeof options.exclude[0] === "number" ? [options.exclude] : options.exclude;
      exclusions.forEach(function(exclusion) {
        for (var i = exclusion[0]; i < exclusion[1]; i += 1) {
          isExcluded[i] = true;
        }
      });
    }
    var shouldIndentNextCharacter = options.indentStart !== false;
    var replacer = function(match) {
      if (shouldIndentNextCharacter) {
        return "" + indentStr + match;
      }
      shouldIndentNextCharacter = true;
      return match;
    };
    this.intro = this.intro.replace(pattern, replacer);
    var charIndex = 0;
    var chunk = this.firstChunk;
    while (chunk) {
      var end = chunk.end;
      if (chunk.edited) {
        if (!isExcluded[charIndex]) {
          chunk.content = chunk.content.replace(pattern, replacer);
          if (chunk.content.length) {
            shouldIndentNextCharacter = chunk.content[chunk.content.length - 1] === "\n";
          }
        }
      } else {
        charIndex = chunk.start;
        while (charIndex < end) {
          if (!isExcluded[charIndex]) {
            var char = this.original[charIndex];
            if (char === "\n") {
              shouldIndentNextCharacter = true;
            } else if (char !== "\r" && shouldIndentNextCharacter) {
              shouldIndentNextCharacter = false;
              if (charIndex === chunk.start) {
                chunk.prependRight(indentStr);
              } else {
                this._splitChunk(chunk, charIndex);
                chunk = chunk.next;
                chunk.prependRight(indentStr);
              }
            }
          }
          charIndex += 1;
        }
      }
      charIndex = chunk.end;
      chunk = chunk.next;
    }
    this.outro = this.outro.replace(pattern, replacer);
    return this;
  };
  MagicString.prototype.insert = function insert() {
    throw new Error("magicString.insert(...) is deprecated. Use prependRight(...) or appendLeft(...)");
  };
  MagicString.prototype.insertLeft = function insertLeft(index, content) {
    if (!warned.insertLeft) {
      console.warn("magicString.insertLeft(...) is deprecated. Use magicString.appendLeft(...) instead");
      warned.insertLeft = true;
    }
    return this.appendLeft(index, content);
  };
  MagicString.prototype.insertRight = function insertRight(index, content) {
    if (!warned.insertRight) {
      console.warn("magicString.insertRight(...) is deprecated. Use magicString.prependRight(...) instead");
      warned.insertRight = true;
    }
    return this.prependRight(index, content);
  };
  MagicString.prototype.move = function move(start, end, index) {
    if (index >= start && index <= end) {
      throw new Error("Cannot move a selection inside itself");
    }
    this._split(start);
    this._split(end);
    this._split(index);
    var first = this.byStart[start];
    var last = this.byEnd[end];
    var oldLeft = first.previous;
    var oldRight = last.next;
    var newRight = this.byStart[index];
    if (!newRight && last === this.lastChunk) {
      return this;
    }
    var newLeft = newRight ? newRight.previous : this.lastChunk;
    if (oldLeft) {
      oldLeft.next = oldRight;
    }
    if (oldRight) {
      oldRight.previous = oldLeft;
    }
    if (newLeft) {
      newLeft.next = first;
    }
    if (newRight) {
      newRight.previous = last;
    }
    if (!first.previous) {
      this.firstChunk = last.next;
    }
    if (!last.next) {
      this.lastChunk = first.previous;
      this.lastChunk.next = null;
    }
    first.previous = newLeft;
    last.next = newRight || null;
    if (!newLeft) {
      this.firstChunk = first;
    }
    if (!newRight) {
      this.lastChunk = last;
    }
    return this;
  };
  MagicString.prototype.overwrite = function overwrite(start, end, content, options) {
    if (typeof content !== "string") {
      throw new TypeError("replacement content must be a string");
    }
    while (start < 0) {
      start += this.original.length;
    }
    while (end < 0) {
      end += this.original.length;
    }
    if (end > this.original.length) {
      throw new Error("end is out of bounds");
    }
    if (start === end) {
      throw new Error("Cannot overwrite a zero-length range \u2013 use appendLeft or prependRight instead");
    }
    this._split(start);
    this._split(end);
    if (options === true) {
      if (!warned.storeName) {
        console.warn("The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string");
        warned.storeName = true;
      }
      options = { storeName: true };
    }
    var storeName = options !== void 0 ? options.storeName : false;
    var contentOnly = options !== void 0 ? options.contentOnly : false;
    if (storeName) {
      var original = this.original.slice(start, end);
      this.storedNames[original] = true;
    }
    var first = this.byStart[start];
    var last = this.byEnd[end];
    if (first) {
      if (end > first.end && first.next !== this.byStart[first.end]) {
        throw new Error("Cannot overwrite across a split point");
      }
      first.edit(content, storeName, contentOnly);
      if (first !== last) {
        var chunk = first.next;
        while (chunk !== last) {
          chunk.edit("", false);
          chunk = chunk.next;
        }
        chunk.edit("", false);
      }
    } else {
      var newChunk = new Chunk(start, end, "").edit(content, storeName);
      last.next = newChunk;
      newChunk.previous = last;
    }
    return this;
  };
  MagicString.prototype.prepend = function prepend(content) {
    if (typeof content !== "string") {
      throw new TypeError("outro content must be a string");
    }
    this.intro = content + this.intro;
    return this;
  };
  MagicString.prototype.prependLeft = function prependLeft2(index, content) {
    if (typeof content !== "string") {
      throw new TypeError("inserted content must be a string");
    }
    this._split(index);
    var chunk = this.byEnd[index];
    if (chunk) {
      chunk.prependLeft(content);
    } else {
      this.intro = content + this.intro;
    }
    return this;
  };
  MagicString.prototype.prependRight = function prependRight2(index, content) {
    if (typeof content !== "string") {
      throw new TypeError("inserted content must be a string");
    }
    this._split(index);
    var chunk = this.byStart[index];
    if (chunk) {
      chunk.prependRight(content);
    } else {
      this.outro = content + this.outro;
    }
    return this;
  };
  MagicString.prototype.remove = function remove(start, end) {
    while (start < 0) {
      start += this.original.length;
    }
    while (end < 0) {
      end += this.original.length;
    }
    if (start === end) {
      return this;
    }
    if (start < 0 || end > this.original.length) {
      throw new Error("Character is out of bounds");
    }
    if (start > end) {
      throw new Error("end must be greater than start");
    }
    this._split(start);
    this._split(end);
    var chunk = this.byStart[start];
    while (chunk) {
      chunk.intro = "";
      chunk.outro = "";
      chunk.edit("");
      chunk = end > chunk.end ? this.byStart[chunk.end] : null;
    }
    return this;
  };
  MagicString.prototype.lastChar = function lastChar() {
    if (this.outro.length) {
      return this.outro[this.outro.length - 1];
    }
    var chunk = this.lastChunk;
    do {
      if (chunk.outro.length) {
        return chunk.outro[chunk.outro.length - 1];
      }
      if (chunk.content.length) {
        return chunk.content[chunk.content.length - 1];
      }
      if (chunk.intro.length) {
        return chunk.intro[chunk.intro.length - 1];
      }
    } while (chunk = chunk.previous);
    if (this.intro.length) {
      return this.intro[this.intro.length - 1];
    }
    return "";
  };
  MagicString.prototype.lastLine = function lastLine() {
    var lineIndex = this.outro.lastIndexOf(n);
    if (lineIndex !== -1) {
      return this.outro.substr(lineIndex + 1);
    }
    var lineStr = this.outro;
    var chunk = this.lastChunk;
    do {
      if (chunk.outro.length > 0) {
        lineIndex = chunk.outro.lastIndexOf(n);
        if (lineIndex !== -1) {
          return chunk.outro.substr(lineIndex + 1) + lineStr;
        }
        lineStr = chunk.outro + lineStr;
      }
      if (chunk.content.length > 0) {
        lineIndex = chunk.content.lastIndexOf(n);
        if (lineIndex !== -1) {
          return chunk.content.substr(lineIndex + 1) + lineStr;
        }
        lineStr = chunk.content + lineStr;
      }
      if (chunk.intro.length > 0) {
        lineIndex = chunk.intro.lastIndexOf(n);
        if (lineIndex !== -1) {
          return chunk.intro.substr(lineIndex + 1) + lineStr;
        }
        lineStr = chunk.intro + lineStr;
      }
    } while (chunk = chunk.previous);
    lineIndex = this.intro.lastIndexOf(n);
    if (lineIndex !== -1) {
      return this.intro.substr(lineIndex + 1) + lineStr;
    }
    return this.intro + lineStr;
  };
  MagicString.prototype.slice = function slice(start, end) {
    if (start === void 0)
      start = 0;
    if (end === void 0)
      end = this.original.length;
    while (start < 0) {
      start += this.original.length;
    }
    while (end < 0) {
      end += this.original.length;
    }
    var result = "";
    var chunk = this.firstChunk;
    while (chunk && (chunk.start > start || chunk.end <= start)) {
      if (chunk.start < end && chunk.end >= end) {
        return result;
      }
      chunk = chunk.next;
    }
    if (chunk && chunk.edited && chunk.start !== start) {
      throw new Error("Cannot use replaced character " + start + " as slice start anchor.");
    }
    var startChunk = chunk;
    while (chunk) {
      if (chunk.intro && (startChunk !== chunk || chunk.start === start)) {
        result += chunk.intro;
      }
      var containsEnd = chunk.start < end && chunk.end >= end;
      if (containsEnd && chunk.edited && chunk.end !== end) {
        throw new Error("Cannot use replaced character " + end + " as slice end anchor.");
      }
      var sliceStart = startChunk === chunk ? start - chunk.start : 0;
      var sliceEnd = containsEnd ? chunk.content.length + end - chunk.end : chunk.content.length;
      result += chunk.content.slice(sliceStart, sliceEnd);
      if (chunk.outro && (!containsEnd || chunk.end === end)) {
        result += chunk.outro;
      }
      if (containsEnd) {
        break;
      }
      chunk = chunk.next;
    }
    return result;
  };
  MagicString.prototype.snip = function snip(start, end) {
    var clone4 = this.clone();
    clone4.remove(0, start);
    clone4.remove(end, clone4.original.length);
    return clone4;
  };
  MagicString.prototype._split = function _split(index) {
    if (this.byStart[index] || this.byEnd[index]) {
      return;
    }
    var chunk = this.lastSearchedChunk;
    var searchForward = index > chunk.end;
    while (chunk) {
      if (chunk.contains(index)) {
        return this._splitChunk(chunk, index);
      }
      chunk = searchForward ? this.byStart[chunk.end] : this.byEnd[chunk.start];
    }
  };
  MagicString.prototype._splitChunk = function _splitChunk(chunk, index) {
    if (chunk.edited && chunk.content.length) {
      var loc = getLocator(this.original)(index);
      throw new Error("Cannot split a chunk that has already been edited (" + loc.line + ":" + loc.column + ' \u2013 "' + chunk.original + '")');
    }
    var newChunk = chunk.split(index);
    this.byEnd[index] = chunk;
    this.byStart[index] = newChunk;
    this.byEnd[newChunk.end] = newChunk;
    if (chunk === this.lastChunk) {
      this.lastChunk = newChunk;
    }
    this.lastSearchedChunk = chunk;
    return true;
  };
  MagicString.prototype.toString = function toString5() {
    var str = this.intro;
    var chunk = this.firstChunk;
    while (chunk) {
      str += chunk.toString();
      chunk = chunk.next;
    }
    return str + this.outro;
  };
  MagicString.prototype.isEmpty = function isEmpty() {
    var chunk = this.firstChunk;
    do {
      if (chunk.intro.length && chunk.intro.trim() || chunk.content.length && chunk.content.trim() || chunk.outro.length && chunk.outro.trim()) {
        return false;
      }
    } while (chunk = chunk.next);
    return true;
  };
  MagicString.prototype.length = function length() {
    var chunk = this.firstChunk;
    var length3 = 0;
    do {
      length3 += chunk.intro.length + chunk.content.length + chunk.outro.length;
    } while (chunk = chunk.next);
    return length3;
  };
  MagicString.prototype.trimLines = function trimLines() {
    return this.trim("[\\r\\n]");
  };
  MagicString.prototype.trim = function trim(charType) {
    return this.trimStart(charType).trimEnd(charType);
  };
  MagicString.prototype.trimEndAborted = function trimEndAborted(charType) {
    var rx = new RegExp((charType || "\\s") + "+$");
    this.outro = this.outro.replace(rx, "");
    if (this.outro.length) {
      return true;
    }
    var chunk = this.lastChunk;
    do {
      var end = chunk.end;
      var aborted = chunk.trimEnd(rx);
      if (chunk.end !== end) {
        if (this.lastChunk === chunk) {
          this.lastChunk = chunk.next;
        }
        this.byEnd[chunk.end] = chunk;
        this.byStart[chunk.next.start] = chunk.next;
        this.byEnd[chunk.next.end] = chunk.next;
      }
      if (aborted) {
        return true;
      }
      chunk = chunk.previous;
    } while (chunk);
    return false;
  };
  MagicString.prototype.trimEnd = function trimEnd2(charType) {
    this.trimEndAborted(charType);
    return this;
  };
  MagicString.prototype.trimStartAborted = function trimStartAborted(charType) {
    var rx = new RegExp("^" + (charType || "\\s") + "+");
    this.intro = this.intro.replace(rx, "");
    if (this.intro.length) {
      return true;
    }
    var chunk = this.firstChunk;
    do {
      var end = chunk.end;
      var aborted = chunk.trimStart(rx);
      if (chunk.end !== end) {
        if (chunk === this.lastChunk) {
          this.lastChunk = chunk.next;
        }
        this.byEnd[chunk.end] = chunk;
        this.byStart[chunk.next.start] = chunk.next;
        this.byEnd[chunk.next.end] = chunk.next;
      }
      if (aborted) {
        return true;
      }
      chunk = chunk.next;
    } while (chunk);
    return false;
  };
  MagicString.prototype.trimStart = function trimStart2(charType) {
    this.trimStartAborted(charType);
    return this;
  };
  var hasOwnProp = Object.prototype.hasOwnProperty;
  var Bundle = function Bundle2(options) {
    if (options === void 0)
      options = {};
    this.intro = options.intro || "";
    this.separator = options.separator !== void 0 ? options.separator : "\n";
    this.sources = [];
    this.uniqueSources = [];
    this.uniqueSourceIndexByFilename = {};
  };
  Bundle.prototype.addSource = function addSource(source2) {
    if (source2 instanceof MagicString) {
      return this.addSource({
        content: source2,
        filename: source2.filename,
        separator: this.separator
      });
    }
    if (!isObject(source2) || !source2.content) {
      throw new Error("bundle.addSource() takes an object with a `content` property, which should be an instance of MagicString, and an optional `filename`");
    }
    ["filename", "indentExclusionRanges", "separator"].forEach(function(option) {
      if (!hasOwnProp.call(source2, option)) {
        source2[option] = source2.content[option];
      }
    });
    if (source2.separator === void 0) {
      source2.separator = this.separator;
    }
    if (source2.filename) {
      if (!hasOwnProp.call(this.uniqueSourceIndexByFilename, source2.filename)) {
        this.uniqueSourceIndexByFilename[source2.filename] = this.uniqueSources.length;
        this.uniqueSources.push({ filename: source2.filename, content: source2.content.original });
      } else {
        var uniqueSource = this.uniqueSources[this.uniqueSourceIndexByFilename[source2.filename]];
        if (source2.content.original !== uniqueSource.content) {
          throw new Error("Illegal source: same filename (" + source2.filename + "), different contents");
        }
      }
    }
    this.sources.push(source2);
    return this;
  };
  Bundle.prototype.append = function append2(str, options) {
    this.addSource({
      content: new MagicString(str),
      separator: options && options.separator || ""
    });
    return this;
  };
  Bundle.prototype.clone = function clone3() {
    var bundle = new Bundle({
      intro: this.intro,
      separator: this.separator
    });
    this.sources.forEach(function(source2) {
      bundle.addSource({
        filename: source2.filename,
        content: source2.content.clone(),
        separator: source2.separator
      });
    });
    return bundle;
  };
  Bundle.prototype.generateDecodedMap = function generateDecodedMap2(options) {
    var this$1 = this;
    if (options === void 0)
      options = {};
    var names = [];
    this.sources.forEach(function(source2) {
      Object.keys(source2.content.storedNames).forEach(function(name) {
        if (!~names.indexOf(name)) {
          names.push(name);
        }
      });
    });
    var mappings = new Mappings(options.hires);
    if (this.intro) {
      mappings.advance(this.intro);
    }
    this.sources.forEach(function(source2, i) {
      if (i > 0) {
        mappings.advance(this$1.separator);
      }
      var sourceIndex = source2.filename ? this$1.uniqueSourceIndexByFilename[source2.filename] : -1;
      var magicString = source2.content;
      var locate = getLocator(magicString.original);
      if (magicString.intro) {
        mappings.advance(magicString.intro);
      }
      magicString.firstChunk.eachNext(function(chunk) {
        var loc = locate(chunk.start);
        if (chunk.intro.length) {
          mappings.advance(chunk.intro);
        }
        if (source2.filename) {
          if (chunk.edited) {
            mappings.addEdit(sourceIndex, chunk.content, loc, chunk.storeName ? names.indexOf(chunk.original) : -1);
          } else {
            mappings.addUneditedChunk(sourceIndex, chunk, magicString.original, loc, magicString.sourcemapLocations);
          }
        } else {
          mappings.advance(chunk.content);
        }
        if (chunk.outro.length) {
          mappings.advance(chunk.outro);
        }
      });
      if (magicString.outro) {
        mappings.advance(magicString.outro);
      }
    });
    return {
      file: options.file ? options.file.split(/[/\\]/).pop() : null,
      sources: this.uniqueSources.map(function(source2) {
        return options.file ? getRelativePath(options.file, source2.filename) : source2.filename;
      }),
      sourcesContent: this.uniqueSources.map(function(source2) {
        return options.includeContent ? source2.content : null;
      }),
      names,
      mappings: mappings.raw
    };
  };
  Bundle.prototype.generateMap = function generateMap2(options) {
    return new SourceMap(this.generateDecodedMap(options));
  };
  Bundle.prototype.getIndentString = function getIndentString2() {
    var indentStringCounts = {};
    this.sources.forEach(function(source2) {
      var indentStr = source2.content.indentStr;
      if (indentStr === null) {
        return;
      }
      if (!indentStringCounts[indentStr]) {
        indentStringCounts[indentStr] = 0;
      }
      indentStringCounts[indentStr] += 1;
    });
    return Object.keys(indentStringCounts).sort(function(a, b) {
      return indentStringCounts[a] - indentStringCounts[b];
    })[0] || "	";
  };
  Bundle.prototype.indent = function indent2(indentStr) {
    var this$1 = this;
    if (!arguments.length) {
      indentStr = this.getIndentString();
    }
    if (indentStr === "") {
      return this;
    }
    var trailingNewline = !this.intro || this.intro.slice(-1) === "\n";
    this.sources.forEach(function(source2, i) {
      var separator = source2.separator !== void 0 ? source2.separator : this$1.separator;
      var indentStart = trailingNewline || i > 0 && /\r?\n$/.test(separator);
      source2.content.indent(indentStr, {
        exclude: source2.indentExclusionRanges,
        indentStart
      });
      trailingNewline = source2.content.lastChar() === "\n";
    });
    if (this.intro) {
      this.intro = indentStr + this.intro.replace(/^[^\n]/gm, function(match, index) {
        return index > 0 ? indentStr + match : match;
      });
    }
    return this;
  };
  Bundle.prototype.prepend = function prepend2(str) {
    this.intro = str + this.intro;
    return this;
  };
  Bundle.prototype.toString = function toString6() {
    var this$1 = this;
    var body = this.sources.map(function(source2, i) {
      var separator = source2.separator !== void 0 ? source2.separator : this$1.separator;
      var str = (i > 0 ? separator : "") + source2.content.toString();
      return str;
    }).join("");
    return this.intro + body;
  };
  Bundle.prototype.isEmpty = function isEmpty2() {
    if (this.intro.length && this.intro.trim()) {
      return false;
    }
    if (this.sources.some(function(source2) {
      return !source2.content.isEmpty();
    })) {
      return false;
    }
    return true;
  };
  Bundle.prototype.length = function length2() {
    return this.sources.reduce(function(length3, source2) {
      return length3 + source2.content.length();
    }, this.intro.length);
  };
  Bundle.prototype.trimLines = function trimLines2() {
    return this.trim("[\\r\\n]");
  };
  Bundle.prototype.trim = function trim2(charType) {
    return this.trimStart(charType).trimEnd(charType);
  };
  Bundle.prototype.trimStart = function trimStart3(charType) {
    var rx = new RegExp("^" + (charType || "\\s") + "+");
    this.intro = this.intro.replace(rx, "");
    if (!this.intro) {
      var source2;
      var i = 0;
      do {
        source2 = this.sources[i++];
        if (!source2) {
          break;
        }
      } while (!source2.content.trimStartAborted(charType));
    }
    return this;
  };
  Bundle.prototype.trimEnd = function trimEnd3(charType) {
    var rx = new RegExp((charType || "\\s") + "+$");
    var source2;
    var i = this.sources.length - 1;
    do {
      source2 = this.sources[i--];
      if (!source2) {
        this.intro = this.intro.replace(rx, "");
        break;
      }
    } while (!source2.content.trimEndAborted(charType));
    return this;
  };
  var magic_string_es_default = MagicString;

  // node_modules/yufka/dist/esm/lib/metadata.js
  var finishedNodes = new WeakSet();
  function checkNode(node) {
    if (finishedNodes.has(node)) {
      throw new Error(`Cannot run helper method after manipulator callback of iterated or target node has finished running`);
    }
  }
  var nodeMetadataStore = new WeakMap();

  // node_modules/yufka/dist/esm/lib/helpers.js
  var helpers_exports = {};
  __export(helpers_exports, {
    parent: () => parent,
    source: () => source,
    update: () => update
  });
  function source(node) {
    const { context } = nodeMetadataStore.get(node);
    return context.magicString.slice(node.start, node.end).toString();
  }
  function parent(node, levels = 1) {
    const { parent: parentNode } = nodeMetadataStore.get(node);
    if (!parentNode) {
      return void 0;
    }
    if (levels <= 1) {
      return parentNode;
    }
    return parent(parentNode, levels - 1);
  }
  function update(node, replacement) {
    checkNode(node);
    const { context } = nodeMetadataStore.get(node);
    context.magicString.overwrite(node.start, node.end, replacement);
  }

  // node_modules/yufka/dist/esm/lib/util.js
  function isPromise(value) {
    return typeof value === "object" && value !== null && typeof value.then === "function";
  }
  function isNode(value) {
    return typeof value === "object" && value !== null && typeof value.type === "string";
  }

  // node_modules/yufka/dist/esm/lib/lifecycle.js
  function collectChildNodes(node) {
    const childNodes = [];
    for (const key2 of Object.keys(node)) {
      const property = node[key2];
      if (Array.isArray(property)) {
        for (const propertyElement of property) {
          if (isNode(propertyElement)) {
            childNodes.push(propertyElement);
          }
        }
      } else if (isNode(property)) {
        childNodes.push(property);
      }
    }
    return childNodes;
  }
  function performSuccessiveRecursiveWalks(node, childNodes, context) {
    if (childNodes.length === 0) {
      return void 0;
    }
    const [firstChild, ...remainingChildNodes] = childNodes;
    const subwalkResult = handleNode(firstChild, context);
    if (isPromise(subwalkResult)) {
      return subwalkResult.then(() => performSuccessiveRecursiveWalks(node, remainingChildNodes, context));
    } else {
      return performSuccessiveRecursiveWalks(node, remainingChildNodes, context);
    }
  }
  function collectTreeMetadata(node, context) {
    const childNodes = collectChildNodes(node);
    for (const childNode of childNodes) {
      nodeMetadataStore.set(childNode, { parent: node, context });
      collectTreeMetadata(childNode, context);
    }
  }
  function createNodeHelper(node, helperName) {
    return (...args) => {
      const helper = helpers_exports[helperName];
      if (isNode(args[0])) {
        if (helperName === "update") {
          checkNode(args[0]);
        }
        return helper(...args);
      } else {
        return helper(node, ...args);
      }
    };
  }
  function handleNode(node, context) {
    const childNodes = collectChildNodes(node);
    const subwalksResult = performSuccessiveRecursiveWalks(node, childNodes, context);
    const nodeHelpers = {
      source: createNodeHelper(node, "source"),
      parent: createNodeHelper(node, "parent"),
      update: createNodeHelper(node, "update")
    };
    if (isPromise(subwalksResult)) {
      return subwalksResult.then(() => {
        return context.manipulator(node, nodeHelpers);
      }).then((manipulatorResult) => {
        finishedNodes.add(node);
        return manipulatorResult;
      });
    } else {
      const manipulatorResult = context.manipulator(node, nodeHelpers);
      if (isPromise(manipulatorResult)) {
        return manipulatorResult.then((result) => {
          finishedNodes.add(node);
          return result;
        });
      } else {
        finishedNodes.add(node);
        return manipulatorResult;
      }
    }
  }
  function createResult({ magicString, options }) {
    const code = magicString.toString();
    return Object.freeze({
      code,
      map: magicString.generateMap(options.sourceMap),
      toString: () => code
    });
  }

  // node_modules/yufka/dist/esm/yufka.esm.js
  function yufka(...yufkaArgs) {
    var _a;
    let options;
    let manipulator;
    const source2 = String(yufkaArgs[0]);
    if (typeof yufkaArgs[1] === "function") {
      options = {};
      manipulator = yufkaArgs[1];
    } else if (typeof yufkaArgs[1] === "object" && typeof yufkaArgs[2] === "function") {
      options = yufkaArgs[1];
      manipulator = yufkaArgs[2];
    } else {
      throw new Error("Invalid arguments. After the source code argument, yufka() expects either an options object and a manipulator function or just a manipulator function");
    }
    const acornOptions = __spreadValues({
      ecmaVersion: "latest"
    }, (_a = options.acorn) !== null && _a !== void 0 ? _a : {});
    const rootNode = options.parser ? options.parser.parse(source2, acornOptions) : parse3(source2, acornOptions);
    const magicString = new magic_string_es_default(source2);
    const context = { magicString, options, manipulator };
    nodeMetadataStore.set(rootNode, { parent: void 0, context });
    collectTreeMetadata(rootNode, context);
    const walkResult = handleNode(rootNode, context);
    if (isPromise(walkResult)) {
      return walkResult.then(() => createResult(context));
    } else {
      return createResult(context);
    }
  }
  yufka.source = source;
  yufka.parent = parent;
  yufka.update = update;
  var yufka_esm_default = yufka;

  // src/common/script/lib/bitmap.ts
  var bitmap_exports = {};
  __export(bitmap_exports, {
    AbstractBitmap: () => AbstractBitmap,
    IndexedBitmap: () => IndexedBitmap,
    MappedBitmap: () => MappedBitmap,
    RGBABitmap: () => RGBABitmap,
    analyze: () => analyze,
    convertWordsToImages: () => convertWordsToImages,
    decode: () => decode2,
    font: () => font,
    indexed: () => indexed,
    montage: () => montage,
    png: () => png,
    rgba: () => rgba2
  });

  // node_modules/iobuffer/lib-esm/utf8.browser.js
  var import_text_encoding_polyfill = __toModule(require_text_encoding_polyfill());
  var decoder = new TextDecoder("utf-8");
  function decode(bytes) {
    return decoder.decode(bytes);
  }
  var encoder = new TextEncoder();
  function encode2(str) {
    return encoder.encode(str);
  }

  // node_modules/iobuffer/lib-esm/IOBuffer.js
  var defaultByteLength = 1024 * 8;
  var IOBuffer = class {
    constructor(data3 = defaultByteLength, options = {}) {
      let dataIsGiven = false;
      if (typeof data3 === "number") {
        data3 = new ArrayBuffer(data3);
      } else {
        dataIsGiven = true;
        this.lastWrittenByte = data3.byteLength;
      }
      const offset2 = options.offset ? options.offset >>> 0 : 0;
      const byteLength = data3.byteLength - offset2;
      let dvOffset = offset2;
      if (ArrayBuffer.isView(data3) || data3 instanceof IOBuffer) {
        if (data3.byteLength !== data3.buffer.byteLength) {
          dvOffset = data3.byteOffset + offset2;
        }
        data3 = data3.buffer;
      }
      if (dataIsGiven) {
        this.lastWrittenByte = byteLength;
      } else {
        this.lastWrittenByte = 0;
      }
      this.buffer = data3;
      this.length = byteLength;
      this.byteLength = byteLength;
      this.byteOffset = dvOffset;
      this.offset = 0;
      this.littleEndian = true;
      this._data = new DataView(this.buffer, dvOffset, byteLength);
      this._mark = 0;
      this._marks = [];
    }
    available(byteLength = 1) {
      return this.offset + byteLength <= this.length;
    }
    isLittleEndian() {
      return this.littleEndian;
    }
    setLittleEndian() {
      this.littleEndian = true;
      return this;
    }
    isBigEndian() {
      return !this.littleEndian;
    }
    setBigEndian() {
      this.littleEndian = false;
      return this;
    }
    skip(n2 = 1) {
      this.offset += n2;
      return this;
    }
    seek(offset2) {
      this.offset = offset2;
      return this;
    }
    mark() {
      this._mark = this.offset;
      return this;
    }
    reset() {
      this.offset = this._mark;
      return this;
    }
    pushMark() {
      this._marks.push(this.offset);
      return this;
    }
    popMark() {
      const offset2 = this._marks.pop();
      if (offset2 === void 0) {
        throw new Error("Mark stack empty");
      }
      this.seek(offset2);
      return this;
    }
    rewind() {
      this.offset = 0;
      return this;
    }
    ensureAvailable(byteLength = 1) {
      if (!this.available(byteLength)) {
        const lengthNeeded = this.offset + byteLength;
        const newLength = lengthNeeded * 2;
        const newArray = new Uint8Array(newLength);
        newArray.set(new Uint8Array(this.buffer));
        this.buffer = newArray.buffer;
        this.length = this.byteLength = newLength;
        this._data = new DataView(this.buffer);
      }
      return this;
    }
    readBoolean() {
      return this.readUint8() !== 0;
    }
    readInt8() {
      return this._data.getInt8(this.offset++);
    }
    readUint8() {
      return this._data.getUint8(this.offset++);
    }
    readByte() {
      return this.readUint8();
    }
    readBytes(n2 = 1) {
      const bytes = new Uint8Array(n2);
      for (let i = 0; i < n2; i++) {
        bytes[i] = this.readByte();
      }
      return bytes;
    }
    readInt16() {
      const value = this._data.getInt16(this.offset, this.littleEndian);
      this.offset += 2;
      return value;
    }
    readUint16() {
      const value = this._data.getUint16(this.offset, this.littleEndian);
      this.offset += 2;
      return value;
    }
    readInt32() {
      const value = this._data.getInt32(this.offset, this.littleEndian);
      this.offset += 4;
      return value;
    }
    readUint32() {
      const value = this._data.getUint32(this.offset, this.littleEndian);
      this.offset += 4;
      return value;
    }
    readFloat32() {
      const value = this._data.getFloat32(this.offset, this.littleEndian);
      this.offset += 4;
      return value;
    }
    readFloat64() {
      const value = this._data.getFloat64(this.offset, this.littleEndian);
      this.offset += 8;
      return value;
    }
    readBigInt64() {
      const value = this._data.getBigInt64(this.offset, this.littleEndian);
      this.offset += 8;
      return value;
    }
    readBigUint64() {
      const value = this._data.getBigUint64(this.offset, this.littleEndian);
      this.offset += 8;
      return value;
    }
    readChar() {
      return String.fromCharCode(this.readInt8());
    }
    readChars(n2 = 1) {
      let result = "";
      for (let i = 0; i < n2; i++) {
        result += this.readChar();
      }
      return result;
    }
    readUtf8(n2 = 1) {
      return decode(this.readBytes(n2));
    }
    writeBoolean(value) {
      this.writeUint8(value ? 255 : 0);
      return this;
    }
    writeInt8(value) {
      this.ensureAvailable(1);
      this._data.setInt8(this.offset++, value);
      this._updateLastWrittenByte();
      return this;
    }
    writeUint8(value) {
      this.ensureAvailable(1);
      this._data.setUint8(this.offset++, value);
      this._updateLastWrittenByte();
      return this;
    }
    writeByte(value) {
      return this.writeUint8(value);
    }
    writeBytes(bytes) {
      this.ensureAvailable(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        this._data.setUint8(this.offset++, bytes[i]);
      }
      this._updateLastWrittenByte();
      return this;
    }
    writeInt16(value) {
      this.ensureAvailable(2);
      this._data.setInt16(this.offset, value, this.littleEndian);
      this.offset += 2;
      this._updateLastWrittenByte();
      return this;
    }
    writeUint16(value) {
      this.ensureAvailable(2);
      this._data.setUint16(this.offset, value, this.littleEndian);
      this.offset += 2;
      this._updateLastWrittenByte();
      return this;
    }
    writeInt32(value) {
      this.ensureAvailable(4);
      this._data.setInt32(this.offset, value, this.littleEndian);
      this.offset += 4;
      this._updateLastWrittenByte();
      return this;
    }
    writeUint32(value) {
      this.ensureAvailable(4);
      this._data.setUint32(this.offset, value, this.littleEndian);
      this.offset += 4;
      this._updateLastWrittenByte();
      return this;
    }
    writeFloat32(value) {
      this.ensureAvailable(4);
      this._data.setFloat32(this.offset, value, this.littleEndian);
      this.offset += 4;
      this._updateLastWrittenByte();
      return this;
    }
    writeFloat64(value) {
      this.ensureAvailable(8);
      this._data.setFloat64(this.offset, value, this.littleEndian);
      this.offset += 8;
      this._updateLastWrittenByte();
      return this;
    }
    writeBigInt64(value) {
      this.ensureAvailable(8);
      this._data.setBigInt64(this.offset, value, this.littleEndian);
      this.offset += 8;
      this._updateLastWrittenByte();
      return this;
    }
    writeBigUint64(value) {
      this.ensureAvailable(8);
      this._data.setBigUint64(this.offset, value, this.littleEndian);
      this.offset += 8;
      this._updateLastWrittenByte();
      return this;
    }
    writeChar(str) {
      return this.writeUint8(str.charCodeAt(0));
    }
    writeChars(str) {
      for (let i = 0; i < str.length; i++) {
        this.writeUint8(str.charCodeAt(i));
      }
      return this;
    }
    writeUtf8(str) {
      return this.writeBytes(encode2(str));
    }
    toArray() {
      return new Uint8Array(this.buffer, this.byteOffset, this.lastWrittenByte);
    }
    _updateLastWrittenByte() {
      if (this.offset > this.lastWrittenByte) {
        this.lastWrittenByte = this.offset;
      }
    }
  };

  // node_modules/fast-png/node_modules/pako/dist/pako.esm.mjs
  var Z_FIXED$1 = 4;
  var Z_BINARY = 0;
  var Z_TEXT = 1;
  var Z_UNKNOWN$1 = 2;
  function zero$1(buf) {
    let len = buf.length;
    while (--len >= 0) {
      buf[len] = 0;
    }
  }
  var STORED_BLOCK = 0;
  var STATIC_TREES = 1;
  var DYN_TREES = 2;
  var MIN_MATCH$1 = 3;
  var MAX_MATCH$1 = 258;
  var LENGTH_CODES$1 = 29;
  var LITERALS$1 = 256;
  var L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1;
  var D_CODES$1 = 30;
  var BL_CODES$1 = 19;
  var HEAP_SIZE$1 = 2 * L_CODES$1 + 1;
  var MAX_BITS$1 = 15;
  var Buf_size = 16;
  var MAX_BL_BITS = 7;
  var END_BLOCK = 256;
  var REP_3_6 = 16;
  var REPZ_3_10 = 17;
  var REPZ_11_138 = 18;
  var extra_lbits = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]);
  var extra_dbits = new Uint8Array([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]);
  var extra_blbits = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]);
  var bl_order = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var DIST_CODE_LEN = 512;
  var static_ltree = new Array((L_CODES$1 + 2) * 2);
  zero$1(static_ltree);
  var static_dtree = new Array(D_CODES$1 * 2);
  zero$1(static_dtree);
  var _dist_code = new Array(DIST_CODE_LEN);
  zero$1(_dist_code);
  var _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
  zero$1(_length_code);
  var base_length = new Array(LENGTH_CODES$1);
  zero$1(base_length);
  var base_dist = new Array(D_CODES$1);
  zero$1(base_dist);
  function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
    this.static_tree = static_tree;
    this.extra_bits = extra_bits;
    this.extra_base = extra_base;
    this.elems = elems;
    this.max_length = max_length;
    this.has_stree = static_tree && static_tree.length;
  }
  var static_l_desc;
  var static_d_desc;
  var static_bl_desc;
  function TreeDesc(dyn_tree, stat_desc) {
    this.dyn_tree = dyn_tree;
    this.max_code = 0;
    this.stat_desc = stat_desc;
  }
  var d_code = (dist) => {
    return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
  };
  var put_short = (s, w) => {
    s.pending_buf[s.pending++] = w & 255;
    s.pending_buf[s.pending++] = w >>> 8 & 255;
  };
  var send_bits = (s, value, length3) => {
    if (s.bi_valid > Buf_size - length3) {
      s.bi_buf |= value << s.bi_valid & 65535;
      put_short(s, s.bi_buf);
      s.bi_buf = value >> Buf_size - s.bi_valid;
      s.bi_valid += length3 - Buf_size;
    } else {
      s.bi_buf |= value << s.bi_valid & 65535;
      s.bi_valid += length3;
    }
  };
  var send_code = (s, c, tree) => {
    send_bits(s, tree[c * 2], tree[c * 2 + 1]);
  };
  var bi_reverse = (code, len) => {
    let res = 0;
    do {
      res |= code & 1;
      code >>>= 1;
      res <<= 1;
    } while (--len > 0);
    return res >>> 1;
  };
  var bi_flush = (s) => {
    if (s.bi_valid === 16) {
      put_short(s, s.bi_buf);
      s.bi_buf = 0;
      s.bi_valid = 0;
    } else if (s.bi_valid >= 8) {
      s.pending_buf[s.pending++] = s.bi_buf & 255;
      s.bi_buf >>= 8;
      s.bi_valid -= 8;
    }
  };
  var gen_bitlen = (s, desc) => {
    const tree = desc.dyn_tree;
    const max_code = desc.max_code;
    const stree = desc.stat_desc.static_tree;
    const has_stree = desc.stat_desc.has_stree;
    const extra = desc.stat_desc.extra_bits;
    const base = desc.stat_desc.extra_base;
    const max_length = desc.stat_desc.max_length;
    let h;
    let n2, m;
    let bits;
    let xbits;
    let f;
    let overflow = 0;
    for (bits = 0; bits <= MAX_BITS$1; bits++) {
      s.bl_count[bits] = 0;
    }
    tree[s.heap[s.heap_max] * 2 + 1] = 0;
    for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
      n2 = s.heap[h];
      bits = tree[tree[n2 * 2 + 1] * 2 + 1] + 1;
      if (bits > max_length) {
        bits = max_length;
        overflow++;
      }
      tree[n2 * 2 + 1] = bits;
      if (n2 > max_code) {
        continue;
      }
      s.bl_count[bits]++;
      xbits = 0;
      if (n2 >= base) {
        xbits = extra[n2 - base];
      }
      f = tree[n2 * 2];
      s.opt_len += f * (bits + xbits);
      if (has_stree) {
        s.static_len += f * (stree[n2 * 2 + 1] + xbits);
      }
    }
    if (overflow === 0) {
      return;
    }
    do {
      bits = max_length - 1;
      while (s.bl_count[bits] === 0) {
        bits--;
      }
      s.bl_count[bits]--;
      s.bl_count[bits + 1] += 2;
      s.bl_count[max_length]--;
      overflow -= 2;
    } while (overflow > 0);
    for (bits = max_length; bits !== 0; bits--) {
      n2 = s.bl_count[bits];
      while (n2 !== 0) {
        m = s.heap[--h];
        if (m > max_code) {
          continue;
        }
        if (tree[m * 2 + 1] !== bits) {
          s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
          tree[m * 2 + 1] = bits;
        }
        n2--;
      }
    }
  };
  var gen_codes = (tree, max_code, bl_count) => {
    const next_code = new Array(MAX_BITS$1 + 1);
    let code = 0;
    let bits;
    let n2;
    for (bits = 1; bits <= MAX_BITS$1; bits++) {
      next_code[bits] = code = code + bl_count[bits - 1] << 1;
    }
    for (n2 = 0; n2 <= max_code; n2++) {
      let len = tree[n2 * 2 + 1];
      if (len === 0) {
        continue;
      }
      tree[n2 * 2] = bi_reverse(next_code[len]++, len);
    }
  };
  var tr_static_init = () => {
    let n2;
    let bits;
    let length3;
    let code;
    let dist;
    const bl_count = new Array(MAX_BITS$1 + 1);
    length3 = 0;
    for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
      base_length[code] = length3;
      for (n2 = 0; n2 < 1 << extra_lbits[code]; n2++) {
        _length_code[length3++] = code;
      }
    }
    _length_code[length3 - 1] = code;
    dist = 0;
    for (code = 0; code < 16; code++) {
      base_dist[code] = dist;
      for (n2 = 0; n2 < 1 << extra_dbits[code]; n2++) {
        _dist_code[dist++] = code;
      }
    }
    dist >>= 7;
    for (; code < D_CODES$1; code++) {
      base_dist[code] = dist << 7;
      for (n2 = 0; n2 < 1 << extra_dbits[code] - 7; n2++) {
        _dist_code[256 + dist++] = code;
      }
    }
    for (bits = 0; bits <= MAX_BITS$1; bits++) {
      bl_count[bits] = 0;
    }
    n2 = 0;
    while (n2 <= 143) {
      static_ltree[n2 * 2 + 1] = 8;
      n2++;
      bl_count[8]++;
    }
    while (n2 <= 255) {
      static_ltree[n2 * 2 + 1] = 9;
      n2++;
      bl_count[9]++;
    }
    while (n2 <= 279) {
      static_ltree[n2 * 2 + 1] = 7;
      n2++;
      bl_count[7]++;
    }
    while (n2 <= 287) {
      static_ltree[n2 * 2 + 1] = 8;
      n2++;
      bl_count[8]++;
    }
    gen_codes(static_ltree, L_CODES$1 + 1, bl_count);
    for (n2 = 0; n2 < D_CODES$1; n2++) {
      static_dtree[n2 * 2 + 1] = 5;
      static_dtree[n2 * 2] = bi_reverse(n2, 5);
    }
    static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
    static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES$1, MAX_BITS$1);
    static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES$1, MAX_BL_BITS);
  };
  var init_block = (s) => {
    let n2;
    for (n2 = 0; n2 < L_CODES$1; n2++) {
      s.dyn_ltree[n2 * 2] = 0;
    }
    for (n2 = 0; n2 < D_CODES$1; n2++) {
      s.dyn_dtree[n2 * 2] = 0;
    }
    for (n2 = 0; n2 < BL_CODES$1; n2++) {
      s.bl_tree[n2 * 2] = 0;
    }
    s.dyn_ltree[END_BLOCK * 2] = 1;
    s.opt_len = s.static_len = 0;
    s.last_lit = s.matches = 0;
  };
  var bi_windup = (s) => {
    if (s.bi_valid > 8) {
      put_short(s, s.bi_buf);
    } else if (s.bi_valid > 0) {
      s.pending_buf[s.pending++] = s.bi_buf;
    }
    s.bi_buf = 0;
    s.bi_valid = 0;
  };
  var copy_block = (s, buf, len, header) => {
    bi_windup(s);
    if (header) {
      put_short(s, len);
      put_short(s, ~len);
    }
    s.pending_buf.set(s.window.subarray(buf, buf + len), s.pending);
    s.pending += len;
  };
  var smaller = (tree, n2, m, depth) => {
    const _n2 = n2 * 2;
    const _m2 = m * 2;
    return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n2] <= depth[m];
  };
  var pqdownheap = (s, tree, k) => {
    const v = s.heap[k];
    let j = k << 1;
    while (j <= s.heap_len) {
      if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
        j++;
      }
      if (smaller(tree, v, s.heap[j], s.depth)) {
        break;
      }
      s.heap[k] = s.heap[j];
      k = j;
      j <<= 1;
    }
    s.heap[k] = v;
  };
  var compress_block = (s, ltree, dtree) => {
    let dist;
    let lc;
    let lx = 0;
    let code;
    let extra;
    if (s.last_lit !== 0) {
      do {
        dist = s.pending_buf[s.d_buf + lx * 2] << 8 | s.pending_buf[s.d_buf + lx * 2 + 1];
        lc = s.pending_buf[s.l_buf + lx];
        lx++;
        if (dist === 0) {
          send_code(s, lc, ltree);
        } else {
          code = _length_code[lc];
          send_code(s, code + LITERALS$1 + 1, ltree);
          extra = extra_lbits[code];
          if (extra !== 0) {
            lc -= base_length[code];
            send_bits(s, lc, extra);
          }
          dist--;
          code = d_code(dist);
          send_code(s, code, dtree);
          extra = extra_dbits[code];
          if (extra !== 0) {
            dist -= base_dist[code];
            send_bits(s, dist, extra);
          }
        }
      } while (lx < s.last_lit);
    }
    send_code(s, END_BLOCK, ltree);
  };
  var build_tree = (s, desc) => {
    const tree = desc.dyn_tree;
    const stree = desc.stat_desc.static_tree;
    const has_stree = desc.stat_desc.has_stree;
    const elems = desc.stat_desc.elems;
    let n2, m;
    let max_code = -1;
    let node;
    s.heap_len = 0;
    s.heap_max = HEAP_SIZE$1;
    for (n2 = 0; n2 < elems; n2++) {
      if (tree[n2 * 2] !== 0) {
        s.heap[++s.heap_len] = max_code = n2;
        s.depth[n2] = 0;
      } else {
        tree[n2 * 2 + 1] = 0;
      }
    }
    while (s.heap_len < 2) {
      node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
      tree[node * 2] = 1;
      s.depth[node] = 0;
      s.opt_len--;
      if (has_stree) {
        s.static_len -= stree[node * 2 + 1];
      }
    }
    desc.max_code = max_code;
    for (n2 = s.heap_len >> 1; n2 >= 1; n2--) {
      pqdownheap(s, tree, n2);
    }
    node = elems;
    do {
      n2 = s.heap[1];
      s.heap[1] = s.heap[s.heap_len--];
      pqdownheap(s, tree, 1);
      m = s.heap[1];
      s.heap[--s.heap_max] = n2;
      s.heap[--s.heap_max] = m;
      tree[node * 2] = tree[n2 * 2] + tree[m * 2];
      s.depth[node] = (s.depth[n2] >= s.depth[m] ? s.depth[n2] : s.depth[m]) + 1;
      tree[n2 * 2 + 1] = tree[m * 2 + 1] = node;
      s.heap[1] = node++;
      pqdownheap(s, tree, 1);
    } while (s.heap_len >= 2);
    s.heap[--s.heap_max] = s.heap[1];
    gen_bitlen(s, desc);
    gen_codes(tree, max_code, s.bl_count);
  };
  var scan_tree = (s, tree, max_code) => {
    let n2;
    let prevlen = -1;
    let curlen;
    let nextlen = tree[0 * 2 + 1];
    let count = 0;
    let max_count = 7;
    let min_count = 4;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }
    tree[(max_code + 1) * 2 + 1] = 65535;
    for (n2 = 0; n2 <= max_code; n2++) {
      curlen = nextlen;
      nextlen = tree[(n2 + 1) * 2 + 1];
      if (++count < max_count && curlen === nextlen) {
        continue;
      } else if (count < min_count) {
        s.bl_tree[curlen * 2] += count;
      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          s.bl_tree[curlen * 2]++;
        }
        s.bl_tree[REP_3_6 * 2]++;
      } else if (count <= 10) {
        s.bl_tree[REPZ_3_10 * 2]++;
      } else {
        s.bl_tree[REPZ_11_138 * 2]++;
      }
      count = 0;
      prevlen = curlen;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;
      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  };
  var send_tree = (s, tree, max_code) => {
    let n2;
    let prevlen = -1;
    let curlen;
    let nextlen = tree[0 * 2 + 1];
    let count = 0;
    let max_count = 7;
    let min_count = 4;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }
    for (n2 = 0; n2 <= max_code; n2++) {
      curlen = nextlen;
      nextlen = tree[(n2 + 1) * 2 + 1];
      if (++count < max_count && curlen === nextlen) {
        continue;
      } else if (count < min_count) {
        do {
          send_code(s, curlen, s.bl_tree);
        } while (--count !== 0);
      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          send_code(s, curlen, s.bl_tree);
          count--;
        }
        send_code(s, REP_3_6, s.bl_tree);
        send_bits(s, count - 3, 2);
      } else if (count <= 10) {
        send_code(s, REPZ_3_10, s.bl_tree);
        send_bits(s, count - 3, 3);
      } else {
        send_code(s, REPZ_11_138, s.bl_tree);
        send_bits(s, count - 11, 7);
      }
      count = 0;
      prevlen = curlen;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;
      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  };
  var build_bl_tree = (s) => {
    let max_blindex;
    scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
    scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
    build_tree(s, s.bl_desc);
    for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
      if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
        break;
      }
    }
    s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
    return max_blindex;
  };
  var send_all_trees = (s, lcodes, dcodes, blcodes) => {
    let rank2;
    send_bits(s, lcodes - 257, 5);
    send_bits(s, dcodes - 1, 5);
    send_bits(s, blcodes - 4, 4);
    for (rank2 = 0; rank2 < blcodes; rank2++) {
      send_bits(s, s.bl_tree[bl_order[rank2] * 2 + 1], 3);
    }
    send_tree(s, s.dyn_ltree, lcodes - 1);
    send_tree(s, s.dyn_dtree, dcodes - 1);
  };
  var detect_data_type = (s) => {
    let black_mask = 4093624447;
    let n2;
    for (n2 = 0; n2 <= 31; n2++, black_mask >>>= 1) {
      if (black_mask & 1 && s.dyn_ltree[n2 * 2] !== 0) {
        return Z_BINARY;
      }
    }
    if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
      return Z_TEXT;
    }
    for (n2 = 32; n2 < LITERALS$1; n2++) {
      if (s.dyn_ltree[n2 * 2] !== 0) {
        return Z_TEXT;
      }
    }
    return Z_BINARY;
  };
  var static_init_done = false;
  var _tr_init$1 = (s) => {
    if (!static_init_done) {
      tr_static_init();
      static_init_done = true;
    }
    s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
    s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
    s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
    s.bi_buf = 0;
    s.bi_valid = 0;
    init_block(s);
  };
  var _tr_stored_block$1 = (s, buf, stored_len, last) => {
    send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
    copy_block(s, buf, stored_len, true);
  };
  var _tr_align$1 = (s) => {
    send_bits(s, STATIC_TREES << 1, 3);
    send_code(s, END_BLOCK, static_ltree);
    bi_flush(s);
  };
  var _tr_flush_block$1 = (s, buf, stored_len, last) => {
    let opt_lenb, static_lenb;
    let max_blindex = 0;
    if (s.level > 0) {
      if (s.strm.data_type === Z_UNKNOWN$1) {
        s.strm.data_type = detect_data_type(s);
      }
      build_tree(s, s.l_desc);
      build_tree(s, s.d_desc);
      max_blindex = build_bl_tree(s);
      opt_lenb = s.opt_len + 3 + 7 >>> 3;
      static_lenb = s.static_len + 3 + 7 >>> 3;
      if (static_lenb <= opt_lenb) {
        opt_lenb = static_lenb;
      }
    } else {
      opt_lenb = static_lenb = stored_len + 5;
    }
    if (stored_len + 4 <= opt_lenb && buf !== -1) {
      _tr_stored_block$1(s, buf, stored_len, last);
    } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {
      send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
      compress_block(s, static_ltree, static_dtree);
    } else {
      send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
      send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
      compress_block(s, s.dyn_ltree, s.dyn_dtree);
    }
    init_block(s);
    if (last) {
      bi_windup(s);
    }
  };
  var _tr_tally$1 = (s, dist, lc) => {
    s.pending_buf[s.d_buf + s.last_lit * 2] = dist >>> 8 & 255;
    s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 255;
    s.pending_buf[s.l_buf + s.last_lit] = lc & 255;
    s.last_lit++;
    if (dist === 0) {
      s.dyn_ltree[lc * 2]++;
    } else {
      s.matches++;
      dist--;
      s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2]++;
      s.dyn_dtree[d_code(dist) * 2]++;
    }
    return s.last_lit === s.lit_bufsize - 1;
  };
  var _tr_init_1 = _tr_init$1;
  var _tr_stored_block_1 = _tr_stored_block$1;
  var _tr_flush_block_1 = _tr_flush_block$1;
  var _tr_tally_1 = _tr_tally$1;
  var _tr_align_1 = _tr_align$1;
  var trees = {
    _tr_init: _tr_init_1,
    _tr_stored_block: _tr_stored_block_1,
    _tr_flush_block: _tr_flush_block_1,
    _tr_tally: _tr_tally_1,
    _tr_align: _tr_align_1
  };
  var adler32 = (adler, buf, len, pos) => {
    let s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n2 = 0;
    while (len !== 0) {
      n2 = len > 2e3 ? 2e3 : len;
      len -= n2;
      do {
        s1 = s1 + buf[pos++] | 0;
        s2 = s2 + s1 | 0;
      } while (--n2);
      s1 %= 65521;
      s2 %= 65521;
    }
    return s1 | s2 << 16 | 0;
  };
  var adler32_1 = adler32;
  var makeTable = () => {
    let c, table = [];
    for (var n2 = 0; n2 < 256; n2++) {
      c = n2;
      for (var k = 0; k < 8; k++) {
        c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      }
      table[n2] = c;
    }
    return table;
  };
  var crcTable = new Uint32Array(makeTable());
  var crc32 = (crc2, buf, len, pos) => {
    const t = crcTable;
    const end = pos + len;
    crc2 ^= -1;
    for (let i = pos; i < end; i++) {
      crc2 = crc2 >>> 8 ^ t[(crc2 ^ buf[i]) & 255];
    }
    return crc2 ^ -1;
  };
  var crc32_1 = crc32;
  var messages = {
    2: "need dictionary",
    1: "stream end",
    0: "",
    "-1": "file error",
    "-2": "stream error",
    "-3": "data error",
    "-4": "insufficient memory",
    "-5": "buffer error",
    "-6": "incompatible version"
  };
  var constants$2 = {
    Z_NO_FLUSH: 0,
    Z_PARTIAL_FLUSH: 1,
    Z_SYNC_FLUSH: 2,
    Z_FULL_FLUSH: 3,
    Z_FINISH: 4,
    Z_BLOCK: 5,
    Z_TREES: 6,
    Z_OK: 0,
    Z_STREAM_END: 1,
    Z_NEED_DICT: 2,
    Z_ERRNO: -1,
    Z_STREAM_ERROR: -2,
    Z_DATA_ERROR: -3,
    Z_MEM_ERROR: -4,
    Z_BUF_ERROR: -5,
    Z_NO_COMPRESSION: 0,
    Z_BEST_SPEED: 1,
    Z_BEST_COMPRESSION: 9,
    Z_DEFAULT_COMPRESSION: -1,
    Z_FILTERED: 1,
    Z_HUFFMAN_ONLY: 2,
    Z_RLE: 3,
    Z_FIXED: 4,
    Z_DEFAULT_STRATEGY: 0,
    Z_BINARY: 0,
    Z_TEXT: 1,
    Z_UNKNOWN: 2,
    Z_DEFLATED: 8
  };
  var { _tr_init, _tr_stored_block, _tr_flush_block, _tr_tally, _tr_align } = trees;
  var {
    Z_NO_FLUSH: Z_NO_FLUSH$2,
    Z_PARTIAL_FLUSH,
    Z_FULL_FLUSH: Z_FULL_FLUSH$1,
    Z_FINISH: Z_FINISH$3,
    Z_BLOCK: Z_BLOCK$1,
    Z_OK: Z_OK$3,
    Z_STREAM_END: Z_STREAM_END$3,
    Z_STREAM_ERROR: Z_STREAM_ERROR$2,
    Z_DATA_ERROR: Z_DATA_ERROR$2,
    Z_BUF_ERROR: Z_BUF_ERROR$1,
    Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION$1,
    Z_FILTERED,
    Z_HUFFMAN_ONLY,
    Z_RLE,
    Z_FIXED,
    Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY$1,
    Z_UNKNOWN,
    Z_DEFLATED: Z_DEFLATED$2
  } = constants$2;
  var MAX_MEM_LEVEL = 9;
  var MAX_WBITS$1 = 15;
  var DEF_MEM_LEVEL = 8;
  var LENGTH_CODES = 29;
  var LITERALS = 256;
  var L_CODES = LITERALS + 1 + LENGTH_CODES;
  var D_CODES = 30;
  var BL_CODES = 19;
  var HEAP_SIZE = 2 * L_CODES + 1;
  var MAX_BITS = 15;
  var MIN_MATCH = 3;
  var MAX_MATCH = 258;
  var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
  var PRESET_DICT = 32;
  var INIT_STATE = 42;
  var EXTRA_STATE = 69;
  var NAME_STATE = 73;
  var COMMENT_STATE = 91;
  var HCRC_STATE = 103;
  var BUSY_STATE = 113;
  var FINISH_STATE = 666;
  var BS_NEED_MORE = 1;
  var BS_BLOCK_DONE = 2;
  var BS_FINISH_STARTED = 3;
  var BS_FINISH_DONE = 4;
  var OS_CODE = 3;
  var err = (strm, errorCode) => {
    strm.msg = messages[errorCode];
    return errorCode;
  };
  var rank = (f) => {
    return (f << 1) - (f > 4 ? 9 : 0);
  };
  var zero = (buf) => {
    let len = buf.length;
    while (--len >= 0) {
      buf[len] = 0;
    }
  };
  var HASH_ZLIB = (s, prev, data3) => (prev << s.hash_shift ^ data3) & s.hash_mask;
  var HASH = HASH_ZLIB;
  var flush_pending = (strm) => {
    const s = strm.state;
    let len = s.pending;
    if (len > strm.avail_out) {
      len = strm.avail_out;
    }
    if (len === 0) {
      return;
    }
    strm.output.set(s.pending_buf.subarray(s.pending_out, s.pending_out + len), strm.next_out);
    strm.next_out += len;
    s.pending_out += len;
    strm.total_out += len;
    strm.avail_out -= len;
    s.pending -= len;
    if (s.pending === 0) {
      s.pending_out = 0;
    }
  };
  var flush_block_only = (s, last) => {
    _tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
    s.block_start = s.strstart;
    flush_pending(s.strm);
  };
  var put_byte = (s, b) => {
    s.pending_buf[s.pending++] = b;
  };
  var putShortMSB = (s, b) => {
    s.pending_buf[s.pending++] = b >>> 8 & 255;
    s.pending_buf[s.pending++] = b & 255;
  };
  var read_buf = (strm, buf, start, size) => {
    let len = strm.avail_in;
    if (len > size) {
      len = size;
    }
    if (len === 0) {
      return 0;
    }
    strm.avail_in -= len;
    buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
    if (strm.state.wrap === 1) {
      strm.adler = adler32_1(strm.adler, buf, len, start);
    } else if (strm.state.wrap === 2) {
      strm.adler = crc32_1(strm.adler, buf, len, start);
    }
    strm.next_in += len;
    strm.total_in += len;
    return len;
  };
  var longest_match = (s, cur_match) => {
    let chain_length = s.max_chain_length;
    let scan = s.strstart;
    let match;
    let len;
    let best_len = s.prev_length;
    let nice_match = s.nice_match;
    const limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
    const _win = s.window;
    const wmask = s.w_mask;
    const prev = s.prev;
    const strend = s.strstart + MAX_MATCH;
    let scan_end1 = _win[scan + best_len - 1];
    let scan_end = _win[scan + best_len];
    if (s.prev_length >= s.good_match) {
      chain_length >>= 2;
    }
    if (nice_match > s.lookahead) {
      nice_match = s.lookahead;
    }
    do {
      match = cur_match;
      if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
        continue;
      }
      scan += 2;
      match++;
      do {
      } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
      len = MAX_MATCH - (strend - scan);
      scan = strend - MAX_MATCH;
      if (len > best_len) {
        s.match_start = cur_match;
        best_len = len;
        if (len >= nice_match) {
          break;
        }
        scan_end1 = _win[scan + best_len - 1];
        scan_end = _win[scan + best_len];
      }
    } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
    if (best_len <= s.lookahead) {
      return best_len;
    }
    return s.lookahead;
  };
  var fill_window = (s) => {
    const _w_size = s.w_size;
    let p, n2, m, more, str;
    do {
      more = s.window_size - s.lookahead - s.strstart;
      if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
        s.window.set(s.window.subarray(_w_size, _w_size + _w_size), 0);
        s.match_start -= _w_size;
        s.strstart -= _w_size;
        s.block_start -= _w_size;
        n2 = s.hash_size;
        p = n2;
        do {
          m = s.head[--p];
          s.head[p] = m >= _w_size ? m - _w_size : 0;
        } while (--n2);
        n2 = _w_size;
        p = n2;
        do {
          m = s.prev[--p];
          s.prev[p] = m >= _w_size ? m - _w_size : 0;
        } while (--n2);
        more += _w_size;
      }
      if (s.strm.avail_in === 0) {
        break;
      }
      n2 = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
      s.lookahead += n2;
      if (s.lookahead + s.insert >= MIN_MATCH) {
        str = s.strstart - s.insert;
        s.ins_h = s.window[str];
        s.ins_h = HASH(s, s.ins_h, s.window[str + 1]);
        while (s.insert) {
          s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
          s.prev[str & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = str;
          str++;
          s.insert--;
          if (s.lookahead + s.insert < MIN_MATCH) {
            break;
          }
        }
      }
    } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
  };
  var deflate_stored = (s, flush) => {
    let max_block_size = 65535;
    if (max_block_size > s.pending_buf_size - 5) {
      max_block_size = s.pending_buf_size - 5;
    }
    for (; ; ) {
      if (s.lookahead <= 1) {
        fill_window(s);
        if (s.lookahead === 0 && flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      s.strstart += s.lookahead;
      s.lookahead = 0;
      const max_start = s.block_start + max_block_size;
      if (s.strstart === 0 || s.strstart >= max_start) {
        s.lookahead = s.strstart - max_start;
        s.strstart = max_start;
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      if (s.strstart - s.block_start >= s.w_size - MIN_LOOKAHEAD) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.strstart > s.block_start) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_NEED_MORE;
  };
  var deflate_fast = (s, flush) => {
    let hash_head;
    let bflush;
    for (; ; ) {
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      hash_head = 0;
      if (s.lookahead >= MIN_MATCH) {
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
      }
      if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
        s.match_length = longest_match(s, hash_head);
      }
      if (s.match_length >= MIN_MATCH) {
        bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
        s.lookahead -= s.match_length;
        if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
          s.match_length--;
          do {
            s.strstart++;
            s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
          } while (--s.match_length !== 0);
          s.strstart++;
        } else {
          s.strstart += s.match_length;
          s.match_length = 0;
          s.ins_h = s.window[s.strstart];
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1]);
        }
      } else {
        bflush = _tr_tally(s, 0, s.window[s.strstart]);
        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
    if (flush === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  };
  var deflate_slow = (s, flush) => {
    let hash_head;
    let bflush;
    let max_insert;
    for (; ; ) {
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      hash_head = 0;
      if (s.lookahead >= MIN_MATCH) {
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
      }
      s.prev_length = s.match_length;
      s.prev_match = s.match_start;
      s.match_length = MIN_MATCH - 1;
      if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
        s.match_length = longest_match(s, hash_head);
        if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) {
          s.match_length = MIN_MATCH - 1;
        }
      }
      if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
        max_insert = s.strstart + s.lookahead - MIN_MATCH;
        bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
        s.lookahead -= s.prev_length - 1;
        s.prev_length -= 2;
        do {
          if (++s.strstart <= max_insert) {
            s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
          }
        } while (--s.prev_length !== 0);
        s.match_available = 0;
        s.match_length = MIN_MATCH - 1;
        s.strstart++;
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
      } else if (s.match_available) {
        bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
        if (bflush) {
          flush_block_only(s, false);
        }
        s.strstart++;
        s.lookahead--;
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      } else {
        s.match_available = 1;
        s.strstart++;
        s.lookahead--;
      }
    }
    if (s.match_available) {
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
      s.match_available = 0;
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
    if (flush === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  };
  var deflate_rle = (s, flush) => {
    let bflush;
    let prev;
    let scan, strend;
    const _win = s.window;
    for (; ; ) {
      if (s.lookahead <= MAX_MATCH) {
        fill_window(s);
        if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      s.match_length = 0;
      if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
        scan = s.strstart - 1;
        prev = _win[scan];
        if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
          strend = s.strstart + MAX_MATCH;
          do {
          } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
          s.match_length = MAX_MATCH - (strend - scan);
          if (s.match_length > s.lookahead) {
            s.match_length = s.lookahead;
          }
        }
      }
      if (s.match_length >= MIN_MATCH) {
        bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);
        s.lookahead -= s.match_length;
        s.strstart += s.match_length;
        s.match_length = 0;
      } else {
        bflush = _tr_tally(s, 0, s.window[s.strstart]);
        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  };
  var deflate_huff = (s, flush) => {
    let bflush;
    for (; ; ) {
      if (s.lookahead === 0) {
        fill_window(s);
        if (s.lookahead === 0) {
          if (flush === Z_NO_FLUSH$2) {
            return BS_NEED_MORE;
          }
          break;
        }
      }
      s.match_length = 0;
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  };
  function Config(good_length, max_lazy, nice_length, max_chain, func) {
    this.good_length = good_length;
    this.max_lazy = max_lazy;
    this.nice_length = nice_length;
    this.max_chain = max_chain;
    this.func = func;
  }
  var configuration_table = [
    new Config(0, 0, 0, 0, deflate_stored),
    new Config(4, 4, 8, 4, deflate_fast),
    new Config(4, 5, 16, 8, deflate_fast),
    new Config(4, 6, 32, 32, deflate_fast),
    new Config(4, 4, 16, 16, deflate_slow),
    new Config(8, 16, 32, 32, deflate_slow),
    new Config(8, 16, 128, 128, deflate_slow),
    new Config(8, 32, 128, 256, deflate_slow),
    new Config(32, 128, 258, 1024, deflate_slow),
    new Config(32, 258, 258, 4096, deflate_slow)
  ];
  var lm_init = (s) => {
    s.window_size = 2 * s.w_size;
    zero(s.head);
    s.max_lazy_match = configuration_table[s.level].max_lazy;
    s.good_match = configuration_table[s.level].good_length;
    s.nice_match = configuration_table[s.level].nice_length;
    s.max_chain_length = configuration_table[s.level].max_chain;
    s.strstart = 0;
    s.block_start = 0;
    s.lookahead = 0;
    s.insert = 0;
    s.match_length = s.prev_length = MIN_MATCH - 1;
    s.match_available = 0;
    s.ins_h = 0;
  };
  function DeflateState() {
    this.strm = null;
    this.status = 0;
    this.pending_buf = null;
    this.pending_buf_size = 0;
    this.pending_out = 0;
    this.pending = 0;
    this.wrap = 0;
    this.gzhead = null;
    this.gzindex = 0;
    this.method = Z_DEFLATED$2;
    this.last_flush = -1;
    this.w_size = 0;
    this.w_bits = 0;
    this.w_mask = 0;
    this.window = null;
    this.window_size = 0;
    this.prev = null;
    this.head = null;
    this.ins_h = 0;
    this.hash_size = 0;
    this.hash_bits = 0;
    this.hash_mask = 0;
    this.hash_shift = 0;
    this.block_start = 0;
    this.match_length = 0;
    this.prev_match = 0;
    this.match_available = 0;
    this.strstart = 0;
    this.match_start = 0;
    this.lookahead = 0;
    this.prev_length = 0;
    this.max_chain_length = 0;
    this.max_lazy_match = 0;
    this.level = 0;
    this.strategy = 0;
    this.good_match = 0;
    this.nice_match = 0;
    this.dyn_ltree = new Uint16Array(HEAP_SIZE * 2);
    this.dyn_dtree = new Uint16Array((2 * D_CODES + 1) * 2);
    this.bl_tree = new Uint16Array((2 * BL_CODES + 1) * 2);
    zero(this.dyn_ltree);
    zero(this.dyn_dtree);
    zero(this.bl_tree);
    this.l_desc = null;
    this.d_desc = null;
    this.bl_desc = null;
    this.bl_count = new Uint16Array(MAX_BITS + 1);
    this.heap = new Uint16Array(2 * L_CODES + 1);
    zero(this.heap);
    this.heap_len = 0;
    this.heap_max = 0;
    this.depth = new Uint16Array(2 * L_CODES + 1);
    zero(this.depth);
    this.l_buf = 0;
    this.lit_bufsize = 0;
    this.last_lit = 0;
    this.d_buf = 0;
    this.opt_len = 0;
    this.static_len = 0;
    this.matches = 0;
    this.insert = 0;
    this.bi_buf = 0;
    this.bi_valid = 0;
  }
  var deflateResetKeep = (strm) => {
    if (!strm || !strm.state) {
      return err(strm, Z_STREAM_ERROR$2);
    }
    strm.total_in = strm.total_out = 0;
    strm.data_type = Z_UNKNOWN;
    const s = strm.state;
    s.pending = 0;
    s.pending_out = 0;
    if (s.wrap < 0) {
      s.wrap = -s.wrap;
    }
    s.status = s.wrap ? INIT_STATE : BUSY_STATE;
    strm.adler = s.wrap === 2 ? 0 : 1;
    s.last_flush = Z_NO_FLUSH$2;
    _tr_init(s);
    return Z_OK$3;
  };
  var deflateReset = (strm) => {
    const ret = deflateResetKeep(strm);
    if (ret === Z_OK$3) {
      lm_init(strm.state);
    }
    return ret;
  };
  var deflateSetHeader = (strm, head) => {
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$2;
    }
    if (strm.state.wrap !== 2) {
      return Z_STREAM_ERROR$2;
    }
    strm.state.gzhead = head;
    return Z_OK$3;
  };
  var deflateInit2 = (strm, level, method, windowBits, memLevel, strategy) => {
    if (!strm) {
      return Z_STREAM_ERROR$2;
    }
    let wrap = 1;
    if (level === Z_DEFAULT_COMPRESSION$1) {
      level = 6;
    }
    if (windowBits < 0) {
      wrap = 0;
      windowBits = -windowBits;
    } else if (windowBits > 15) {
      wrap = 2;
      windowBits -= 16;
    }
    if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED) {
      return err(strm, Z_STREAM_ERROR$2);
    }
    if (windowBits === 8) {
      windowBits = 9;
    }
    const s = new DeflateState();
    strm.state = s;
    s.strm = strm;
    s.wrap = wrap;
    s.gzhead = null;
    s.w_bits = windowBits;
    s.w_size = 1 << s.w_bits;
    s.w_mask = s.w_size - 1;
    s.hash_bits = memLevel + 7;
    s.hash_size = 1 << s.hash_bits;
    s.hash_mask = s.hash_size - 1;
    s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
    s.window = new Uint8Array(s.w_size * 2);
    s.head = new Uint16Array(s.hash_size);
    s.prev = new Uint16Array(s.w_size);
    s.lit_bufsize = 1 << memLevel + 6;
    s.pending_buf_size = s.lit_bufsize * 4;
    s.pending_buf = new Uint8Array(s.pending_buf_size);
    s.d_buf = 1 * s.lit_bufsize;
    s.l_buf = (1 + 2) * s.lit_bufsize;
    s.level = level;
    s.strategy = strategy;
    s.method = method;
    return deflateReset(strm);
  };
  var deflateInit = (strm, level) => {
    return deflateInit2(strm, level, Z_DEFLATED$2, MAX_WBITS$1, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY$1);
  };
  var deflate$2 = (strm, flush) => {
    let beg, val;
    if (!strm || !strm.state || flush > Z_BLOCK$1 || flush < 0) {
      return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2;
    }
    const s = strm.state;
    if (!strm.output || !strm.input && strm.avail_in !== 0 || s.status === FINISH_STATE && flush !== Z_FINISH$3) {
      return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR$1 : Z_STREAM_ERROR$2);
    }
    s.strm = strm;
    const old_flush = s.last_flush;
    s.last_flush = flush;
    if (s.status === INIT_STATE) {
      if (s.wrap === 2) {
        strm.adler = 0;
        put_byte(s, 31);
        put_byte(s, 139);
        put_byte(s, 8);
        if (!s.gzhead) {
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
          put_byte(s, OS_CODE);
          s.status = BUSY_STATE;
        } else {
          put_byte(s, (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16));
          put_byte(s, s.gzhead.time & 255);
          put_byte(s, s.gzhead.time >> 8 & 255);
          put_byte(s, s.gzhead.time >> 16 & 255);
          put_byte(s, s.gzhead.time >> 24 & 255);
          put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
          put_byte(s, s.gzhead.os & 255);
          if (s.gzhead.extra && s.gzhead.extra.length) {
            put_byte(s, s.gzhead.extra.length & 255);
            put_byte(s, s.gzhead.extra.length >> 8 & 255);
          }
          if (s.gzhead.hcrc) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending, 0);
          }
          s.gzindex = 0;
          s.status = EXTRA_STATE;
        }
      } else {
        let header = Z_DEFLATED$2 + (s.w_bits - 8 << 4) << 8;
        let level_flags = -1;
        if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
          level_flags = 0;
        } else if (s.level < 6) {
          level_flags = 1;
        } else if (s.level === 6) {
          level_flags = 2;
        } else {
          level_flags = 3;
        }
        header |= level_flags << 6;
        if (s.strstart !== 0) {
          header |= PRESET_DICT;
        }
        header += 31 - header % 31;
        s.status = BUSY_STATE;
        putShortMSB(s, header);
        if (s.strstart !== 0) {
          putShortMSB(s, strm.adler >>> 16);
          putShortMSB(s, strm.adler & 65535);
        }
        strm.adler = 1;
      }
    }
    if (s.status === EXTRA_STATE) {
      if (s.gzhead.extra) {
        beg = s.pending;
        while (s.gzindex < (s.gzhead.extra.length & 65535)) {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              break;
            }
          }
          put_byte(s, s.gzhead.extra[s.gzindex] & 255);
          s.gzindex++;
        }
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (s.gzindex === s.gzhead.extra.length) {
          s.gzindex = 0;
          s.status = NAME_STATE;
        }
      } else {
        s.status = NAME_STATE;
      }
    }
    if (s.status === NAME_STATE) {
      if (s.gzhead.name) {
        beg = s.pending;
        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              val = 1;
              break;
            }
          }
          if (s.gzindex < s.gzhead.name.length) {
            val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (val === 0) {
          s.gzindex = 0;
          s.status = COMMENT_STATE;
        }
      } else {
        s.status = COMMENT_STATE;
      }
    }
    if (s.status === COMMENT_STATE) {
      if (s.gzhead.comment) {
        beg = s.pending;
        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              val = 1;
              break;
            }
          }
          if (s.gzindex < s.gzhead.comment.length) {
            val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (val === 0) {
          s.status = HCRC_STATE;
        }
      } else {
        s.status = HCRC_STATE;
      }
    }
    if (s.status === HCRC_STATE) {
      if (s.gzhead.hcrc) {
        if (s.pending + 2 > s.pending_buf_size) {
          flush_pending(strm);
        }
        if (s.pending + 2 <= s.pending_buf_size) {
          put_byte(s, strm.adler & 255);
          put_byte(s, strm.adler >> 8 & 255);
          strm.adler = 0;
          s.status = BUSY_STATE;
        }
      } else {
        s.status = BUSY_STATE;
      }
    }
    if (s.pending !== 0) {
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH$3) {
      return err(strm, Z_BUF_ERROR$1);
    }
    if (s.status === FINISH_STATE && strm.avail_in !== 0) {
      return err(strm, Z_BUF_ERROR$1);
    }
    if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH$2 && s.status !== FINISH_STATE) {
      let bstate = s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
      if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
        s.status = FINISH_STATE;
      }
      if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
        if (strm.avail_out === 0) {
          s.last_flush = -1;
        }
        return Z_OK$3;
      }
      if (bstate === BS_BLOCK_DONE) {
        if (flush === Z_PARTIAL_FLUSH) {
          _tr_align(s);
        } else if (flush !== Z_BLOCK$1) {
          _tr_stored_block(s, 0, 0, false);
          if (flush === Z_FULL_FLUSH$1) {
            zero(s.head);
            if (s.lookahead === 0) {
              s.strstart = 0;
              s.block_start = 0;
              s.insert = 0;
            }
          }
        }
        flush_pending(strm);
        if (strm.avail_out === 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
      }
    }
    if (flush !== Z_FINISH$3) {
      return Z_OK$3;
    }
    if (s.wrap <= 0) {
      return Z_STREAM_END$3;
    }
    if (s.wrap === 2) {
      put_byte(s, strm.adler & 255);
      put_byte(s, strm.adler >> 8 & 255);
      put_byte(s, strm.adler >> 16 & 255);
      put_byte(s, strm.adler >> 24 & 255);
      put_byte(s, strm.total_in & 255);
      put_byte(s, strm.total_in >> 8 & 255);
      put_byte(s, strm.total_in >> 16 & 255);
      put_byte(s, strm.total_in >> 24 & 255);
    } else {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 65535);
    }
    flush_pending(strm);
    if (s.wrap > 0) {
      s.wrap = -s.wrap;
    }
    return s.pending !== 0 ? Z_OK$3 : Z_STREAM_END$3;
  };
  var deflateEnd = (strm) => {
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$2;
    }
    const status = strm.state.status;
    if (status !== INIT_STATE && status !== EXTRA_STATE && status !== NAME_STATE && status !== COMMENT_STATE && status !== HCRC_STATE && status !== BUSY_STATE && status !== FINISH_STATE) {
      return err(strm, Z_STREAM_ERROR$2);
    }
    strm.state = null;
    return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$3;
  };
  var deflateSetDictionary = (strm, dictionary) => {
    let dictLength = dictionary.length;
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$2;
    }
    const s = strm.state;
    const wrap = s.wrap;
    if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) {
      return Z_STREAM_ERROR$2;
    }
    if (wrap === 1) {
      strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0);
    }
    s.wrap = 0;
    if (dictLength >= s.w_size) {
      if (wrap === 0) {
        zero(s.head);
        s.strstart = 0;
        s.block_start = 0;
        s.insert = 0;
      }
      let tmpDict = new Uint8Array(s.w_size);
      tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0);
      dictionary = tmpDict;
      dictLength = s.w_size;
    }
    const avail = strm.avail_in;
    const next = strm.next_in;
    const input = strm.input;
    strm.avail_in = dictLength;
    strm.next_in = 0;
    strm.input = dictionary;
    fill_window(s);
    while (s.lookahead >= MIN_MATCH) {
      let str = s.strstart;
      let n2 = s.lookahead - (MIN_MATCH - 1);
      do {
        s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
      } while (--n2);
      s.strstart = str;
      s.lookahead = MIN_MATCH - 1;
      fill_window(s);
    }
    s.strstart += s.lookahead;
    s.block_start = s.strstart;
    s.insert = s.lookahead;
    s.lookahead = 0;
    s.match_length = s.prev_length = MIN_MATCH - 1;
    s.match_available = 0;
    strm.next_in = next;
    strm.input = input;
    strm.avail_in = avail;
    s.wrap = wrap;
    return Z_OK$3;
  };
  var deflateInit_1 = deflateInit;
  var deflateInit2_1 = deflateInit2;
  var deflateReset_1 = deflateReset;
  var deflateResetKeep_1 = deflateResetKeep;
  var deflateSetHeader_1 = deflateSetHeader;
  var deflate_2$1 = deflate$2;
  var deflateEnd_1 = deflateEnd;
  var deflateSetDictionary_1 = deflateSetDictionary;
  var deflateInfo = "pako deflate (from Nodeca project)";
  var deflate_1$2 = {
    deflateInit: deflateInit_1,
    deflateInit2: deflateInit2_1,
    deflateReset: deflateReset_1,
    deflateResetKeep: deflateResetKeep_1,
    deflateSetHeader: deflateSetHeader_1,
    deflate: deflate_2$1,
    deflateEnd: deflateEnd_1,
    deflateSetDictionary: deflateSetDictionary_1,
    deflateInfo
  };
  var _has = (obj, key2) => {
    return Object.prototype.hasOwnProperty.call(obj, key2);
  };
  var assign = function(obj) {
    const sources = Array.prototype.slice.call(arguments, 1);
    while (sources.length) {
      const source2 = sources.shift();
      if (!source2) {
        continue;
      }
      if (typeof source2 !== "object") {
        throw new TypeError(source2 + "must be non-object");
      }
      for (const p in source2) {
        if (_has(source2, p)) {
          obj[p] = source2[p];
        }
      }
    }
    return obj;
  };
  var flattenChunks = (chunks) => {
    let len = 0;
    for (let i = 0, l = chunks.length; i < l; i++) {
      len += chunks[i].length;
    }
    const result = new Uint8Array(len);
    for (let i = 0, pos = 0, l = chunks.length; i < l; i++) {
      let chunk = chunks[i];
      result.set(chunk, pos);
      pos += chunk.length;
    }
    return result;
  };
  var common = {
    assign,
    flattenChunks
  };
  var STR_APPLY_UIA_OK = true;
  try {
    String.fromCharCode.apply(null, new Uint8Array(1));
  } catch (__) {
    STR_APPLY_UIA_OK = false;
  }
  var _utf8len = new Uint8Array(256);
  for (let q = 0; q < 256; q++) {
    _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
  }
  _utf8len[254] = _utf8len[254] = 1;
  var string2buf = (str) => {
    if (typeof TextEncoder === "function" && TextEncoder.prototype.encode) {
      return new TextEncoder().encode(str);
    }
    let buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
    for (m_pos = 0; m_pos < str_len; m_pos++) {
      c = str.charCodeAt(m_pos);
      if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
        c2 = str.charCodeAt(m_pos + 1);
        if ((c2 & 64512) === 56320) {
          c = 65536 + (c - 55296 << 10) + (c2 - 56320);
          m_pos++;
        }
      }
      buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
    }
    buf = new Uint8Array(buf_len);
    for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
      c = str.charCodeAt(m_pos);
      if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
        c2 = str.charCodeAt(m_pos + 1);
        if ((c2 & 64512) === 56320) {
          c = 65536 + (c - 55296 << 10) + (c2 - 56320);
          m_pos++;
        }
      }
      if (c < 128) {
        buf[i++] = c;
      } else if (c < 2048) {
        buf[i++] = 192 | c >>> 6;
        buf[i++] = 128 | c & 63;
      } else if (c < 65536) {
        buf[i++] = 224 | c >>> 12;
        buf[i++] = 128 | c >>> 6 & 63;
        buf[i++] = 128 | c & 63;
      } else {
        buf[i++] = 240 | c >>> 18;
        buf[i++] = 128 | c >>> 12 & 63;
        buf[i++] = 128 | c >>> 6 & 63;
        buf[i++] = 128 | c & 63;
      }
    }
    return buf;
  };
  var buf2binstring = (buf, len) => {
    if (len < 65534) {
      if (buf.subarray && STR_APPLY_UIA_OK) {
        return String.fromCharCode.apply(null, buf.length === len ? buf : buf.subarray(0, len));
      }
    }
    let result = "";
    for (let i = 0; i < len; i++) {
      result += String.fromCharCode(buf[i]);
    }
    return result;
  };
  var buf2string = (buf, max) => {
    const len = max || buf.length;
    if (typeof TextDecoder === "function" && TextDecoder.prototype.decode) {
      return new TextDecoder().decode(buf.subarray(0, max));
    }
    let i, out;
    const utf16buf = new Array(len * 2);
    for (out = 0, i = 0; i < len; ) {
      let c = buf[i++];
      if (c < 128) {
        utf16buf[out++] = c;
        continue;
      }
      let c_len = _utf8len[c];
      if (c_len > 4) {
        utf16buf[out++] = 65533;
        i += c_len - 1;
        continue;
      }
      c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
      while (c_len > 1 && i < len) {
        c = c << 6 | buf[i++] & 63;
        c_len--;
      }
      if (c_len > 1) {
        utf16buf[out++] = 65533;
        continue;
      }
      if (c < 65536) {
        utf16buf[out++] = c;
      } else {
        c -= 65536;
        utf16buf[out++] = 55296 | c >> 10 & 1023;
        utf16buf[out++] = 56320 | c & 1023;
      }
    }
    return buf2binstring(utf16buf, out);
  };
  var utf8border = (buf, max) => {
    max = max || buf.length;
    if (max > buf.length) {
      max = buf.length;
    }
    let pos = max - 1;
    while (pos >= 0 && (buf[pos] & 192) === 128) {
      pos--;
    }
    if (pos < 0) {
      return max;
    }
    if (pos === 0) {
      return max;
    }
    return pos + _utf8len[buf[pos]] > max ? pos : max;
  };
  var strings = {
    string2buf,
    buf2string,
    utf8border
  };
  function ZStream() {
    this.input = null;
    this.next_in = 0;
    this.avail_in = 0;
    this.total_in = 0;
    this.output = null;
    this.next_out = 0;
    this.avail_out = 0;
    this.total_out = 0;
    this.msg = "";
    this.state = null;
    this.data_type = 2;
    this.adler = 0;
  }
  var zstream = ZStream;
  var toString$1 = Object.prototype.toString;
  var {
    Z_NO_FLUSH: Z_NO_FLUSH$1,
    Z_SYNC_FLUSH,
    Z_FULL_FLUSH,
    Z_FINISH: Z_FINISH$2,
    Z_OK: Z_OK$2,
    Z_STREAM_END: Z_STREAM_END$2,
    Z_DEFAULT_COMPRESSION,
    Z_DEFAULT_STRATEGY,
    Z_DEFLATED: Z_DEFLATED$1
  } = constants$2;
  function Deflate$1(options) {
    this.options = common.assign({
      level: Z_DEFAULT_COMPRESSION,
      method: Z_DEFLATED$1,
      chunkSize: 16384,
      windowBits: 15,
      memLevel: 8,
      strategy: Z_DEFAULT_STRATEGY
    }, options || {});
    let opt = this.options;
    if (opt.raw && opt.windowBits > 0) {
      opt.windowBits = -opt.windowBits;
    } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
      opt.windowBits += 16;
    }
    this.err = 0;
    this.msg = "";
    this.ended = false;
    this.chunks = [];
    this.strm = new zstream();
    this.strm.avail_out = 0;
    let status = deflate_1$2.deflateInit2(this.strm, opt.level, opt.method, opt.windowBits, opt.memLevel, opt.strategy);
    if (status !== Z_OK$2) {
      throw new Error(messages[status]);
    }
    if (opt.header) {
      deflate_1$2.deflateSetHeader(this.strm, opt.header);
    }
    if (opt.dictionary) {
      let dict;
      if (typeof opt.dictionary === "string") {
        dict = strings.string2buf(opt.dictionary);
      } else if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]") {
        dict = new Uint8Array(opt.dictionary);
      } else {
        dict = opt.dictionary;
      }
      status = deflate_1$2.deflateSetDictionary(this.strm, dict);
      if (status !== Z_OK$2) {
        throw new Error(messages[status]);
      }
      this._dict_set = true;
    }
  }
  Deflate$1.prototype.push = function(data3, flush_mode) {
    const strm = this.strm;
    const chunkSize = this.options.chunkSize;
    let status, _flush_mode;
    if (this.ended) {
      return false;
    }
    if (flush_mode === ~~flush_mode)
      _flush_mode = flush_mode;
    else
      _flush_mode = flush_mode === true ? Z_FINISH$2 : Z_NO_FLUSH$1;
    if (typeof data3 === "string") {
      strm.input = strings.string2buf(data3);
    } else if (toString$1.call(data3) === "[object ArrayBuffer]") {
      strm.input = new Uint8Array(data3);
    } else {
      strm.input = data3;
    }
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
    for (; ; ) {
      if (strm.avail_out === 0) {
        strm.output = new Uint8Array(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      if ((_flush_mode === Z_SYNC_FLUSH || _flush_mode === Z_FULL_FLUSH) && strm.avail_out <= 6) {
        this.onData(strm.output.subarray(0, strm.next_out));
        strm.avail_out = 0;
        continue;
      }
      status = deflate_1$2.deflate(strm, _flush_mode);
      if (status === Z_STREAM_END$2) {
        if (strm.next_out > 0) {
          this.onData(strm.output.subarray(0, strm.next_out));
        }
        status = deflate_1$2.deflateEnd(this.strm);
        this.onEnd(status);
        this.ended = true;
        return status === Z_OK$2;
      }
      if (strm.avail_out === 0) {
        this.onData(strm.output);
        continue;
      }
      if (_flush_mode > 0 && strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out));
        strm.avail_out = 0;
        continue;
      }
      if (strm.avail_in === 0)
        break;
    }
    return true;
  };
  Deflate$1.prototype.onData = function(chunk) {
    this.chunks.push(chunk);
  };
  Deflate$1.prototype.onEnd = function(status) {
    if (status === Z_OK$2) {
      this.result = common.flattenChunks(this.chunks);
    }
    this.chunks = [];
    this.err = status;
    this.msg = this.strm.msg;
  };
  var BAD$1 = 30;
  var TYPE$1 = 12;
  var inffast = function inflate_fast(strm, start) {
    let _in;
    let last;
    let _out;
    let beg;
    let end;
    let dmax;
    let wsize;
    let whave;
    let wnext;
    let s_window;
    let hold;
    let bits;
    let lcode;
    let dcode;
    let lmask;
    let dmask;
    let here;
    let op;
    let len;
    let dist;
    let from2;
    let from_source;
    let input, output;
    const state = strm.state;
    _in = strm.next_in;
    input = strm.input;
    last = _in + (strm.avail_in - 5);
    _out = strm.next_out;
    output = strm.output;
    beg = _out - (start - strm.avail_out);
    end = _out + (strm.avail_out - 257);
    dmax = state.dmax;
    wsize = state.wsize;
    whave = state.whave;
    wnext = state.wnext;
    s_window = state.window;
    hold = state.hold;
    bits = state.bits;
    lcode = state.lencode;
    dcode = state.distcode;
    lmask = (1 << state.lenbits) - 1;
    dmask = (1 << state.distbits) - 1;
    top:
      do {
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = lcode[hold & lmask];
        dolen:
          for (; ; ) {
            op = here >>> 24;
            hold >>>= op;
            bits -= op;
            op = here >>> 16 & 255;
            if (op === 0) {
              output[_out++] = here & 65535;
            } else if (op & 16) {
              len = here & 65535;
              op &= 15;
              if (op) {
                if (bits < op) {
                  hold += input[_in++] << bits;
                  bits += 8;
                }
                len += hold & (1 << op) - 1;
                hold >>>= op;
                bits -= op;
              }
              if (bits < 15) {
                hold += input[_in++] << bits;
                bits += 8;
                hold += input[_in++] << bits;
                bits += 8;
              }
              here = dcode[hold & dmask];
              dodist:
                for (; ; ) {
                  op = here >>> 24;
                  hold >>>= op;
                  bits -= op;
                  op = here >>> 16 & 255;
                  if (op & 16) {
                    dist = here & 65535;
                    op &= 15;
                    if (bits < op) {
                      hold += input[_in++] << bits;
                      bits += 8;
                      if (bits < op) {
                        hold += input[_in++] << bits;
                        bits += 8;
                      }
                    }
                    dist += hold & (1 << op) - 1;
                    if (dist > dmax) {
                      strm.msg = "invalid distance too far back";
                      state.mode = BAD$1;
                      break top;
                    }
                    hold >>>= op;
                    bits -= op;
                    op = _out - beg;
                    if (dist > op) {
                      op = dist - op;
                      if (op > whave) {
                        if (state.sane) {
                          strm.msg = "invalid distance too far back";
                          state.mode = BAD$1;
                          break top;
                        }
                      }
                      from2 = 0;
                      from_source = s_window;
                      if (wnext === 0) {
                        from2 += wsize - op;
                        if (op < len) {
                          len -= op;
                          do {
                            output[_out++] = s_window[from2++];
                          } while (--op);
                          from2 = _out - dist;
                          from_source = output;
                        }
                      } else if (wnext < op) {
                        from2 += wsize + wnext - op;
                        op -= wnext;
                        if (op < len) {
                          len -= op;
                          do {
                            output[_out++] = s_window[from2++];
                          } while (--op);
                          from2 = 0;
                          if (wnext < len) {
                            op = wnext;
                            len -= op;
                            do {
                              output[_out++] = s_window[from2++];
                            } while (--op);
                            from2 = _out - dist;
                            from_source = output;
                          }
                        }
                      } else {
                        from2 += wnext - op;
                        if (op < len) {
                          len -= op;
                          do {
                            output[_out++] = s_window[from2++];
                          } while (--op);
                          from2 = _out - dist;
                          from_source = output;
                        }
                      }
                      while (len > 2) {
                        output[_out++] = from_source[from2++];
                        output[_out++] = from_source[from2++];
                        output[_out++] = from_source[from2++];
                        len -= 3;
                      }
                      if (len) {
                        output[_out++] = from_source[from2++];
                        if (len > 1) {
                          output[_out++] = from_source[from2++];
                        }
                      }
                    } else {
                      from2 = _out - dist;
                      do {
                        output[_out++] = output[from2++];
                        output[_out++] = output[from2++];
                        output[_out++] = output[from2++];
                        len -= 3;
                      } while (len > 2);
                      if (len) {
                        output[_out++] = output[from2++];
                        if (len > 1) {
                          output[_out++] = output[from2++];
                        }
                      }
                    }
                  } else if ((op & 64) === 0) {
                    here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                    continue dodist;
                  } else {
                    strm.msg = "invalid distance code";
                    state.mode = BAD$1;
                    break top;
                  }
                  break;
                }
            } else if ((op & 64) === 0) {
              here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
              continue dolen;
            } else if (op & 32) {
              state.mode = TYPE$1;
              break top;
            } else {
              strm.msg = "invalid literal/length code";
              state.mode = BAD$1;
              break top;
            }
            break;
          }
      } while (_in < last && _out < end);
    len = bits >> 3;
    _in -= len;
    bits -= len << 3;
    hold &= (1 << bits) - 1;
    strm.next_in = _in;
    strm.next_out = _out;
    strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
    strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
    state.hold = hold;
    state.bits = bits;
    return;
  };
  var MAXBITS = 15;
  var ENOUGH_LENS$1 = 852;
  var ENOUGH_DISTS$1 = 592;
  var CODES$1 = 0;
  var LENS$1 = 1;
  var DISTS$1 = 2;
  var lbase = new Uint16Array([
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    13,
    15,
    17,
    19,
    23,
    27,
    31,
    35,
    43,
    51,
    59,
    67,
    83,
    99,
    115,
    131,
    163,
    195,
    227,
    258,
    0,
    0
  ]);
  var lext = new Uint8Array([
    16,
    16,
    16,
    16,
    16,
    16,
    16,
    16,
    17,
    17,
    17,
    17,
    18,
    18,
    18,
    18,
    19,
    19,
    19,
    19,
    20,
    20,
    20,
    20,
    21,
    21,
    21,
    21,
    16,
    72,
    78
  ]);
  var dbase = new Uint16Array([
    1,
    2,
    3,
    4,
    5,
    7,
    9,
    13,
    17,
    25,
    33,
    49,
    65,
    97,
    129,
    193,
    257,
    385,
    513,
    769,
    1025,
    1537,
    2049,
    3073,
    4097,
    6145,
    8193,
    12289,
    16385,
    24577,
    0,
    0
  ]);
  var dext = new Uint8Array([
    16,
    16,
    16,
    16,
    17,
    17,
    18,
    18,
    19,
    19,
    20,
    20,
    21,
    21,
    22,
    22,
    23,
    23,
    24,
    24,
    25,
    25,
    26,
    26,
    27,
    27,
    28,
    28,
    29,
    29,
    64,
    64
  ]);
  var inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) => {
    const bits = opts.bits;
    let len = 0;
    let sym = 0;
    let min = 0, max = 0;
    let root = 0;
    let curr = 0;
    let drop = 0;
    let left = 0;
    let used = 0;
    let huff = 0;
    let incr;
    let fill;
    let low;
    let mask;
    let next;
    let base = null;
    let base_index = 0;
    let end;
    const count = new Uint16Array(MAXBITS + 1);
    const offs = new Uint16Array(MAXBITS + 1);
    let extra = null;
    let extra_index = 0;
    let here_bits, here_op, here_val;
    for (len = 0; len <= MAXBITS; len++) {
      count[len] = 0;
    }
    for (sym = 0; sym < codes; sym++) {
      count[lens[lens_index + sym]]++;
    }
    root = bits;
    for (max = MAXBITS; max >= 1; max--) {
      if (count[max] !== 0) {
        break;
      }
    }
    if (root > max) {
      root = max;
    }
    if (max === 0) {
      table[table_index++] = 1 << 24 | 64 << 16 | 0;
      table[table_index++] = 1 << 24 | 64 << 16 | 0;
      opts.bits = 1;
      return 0;
    }
    for (min = 1; min < max; min++) {
      if (count[min] !== 0) {
        break;
      }
    }
    if (root < min) {
      root = min;
    }
    left = 1;
    for (len = 1; len <= MAXBITS; len++) {
      left <<= 1;
      left -= count[len];
      if (left < 0) {
        return -1;
      }
    }
    if (left > 0 && (type === CODES$1 || max !== 1)) {
      return -1;
    }
    offs[1] = 0;
    for (len = 1; len < MAXBITS; len++) {
      offs[len + 1] = offs[len] + count[len];
    }
    for (sym = 0; sym < codes; sym++) {
      if (lens[lens_index + sym] !== 0) {
        work[offs[lens[lens_index + sym]]++] = sym;
      }
    }
    if (type === CODES$1) {
      base = extra = work;
      end = 19;
    } else if (type === LENS$1) {
      base = lbase;
      base_index -= 257;
      extra = lext;
      extra_index -= 257;
      end = 256;
    } else {
      base = dbase;
      extra = dext;
      end = -1;
    }
    huff = 0;
    sym = 0;
    len = min;
    next = table_index;
    curr = root;
    drop = 0;
    low = -1;
    used = 1 << root;
    mask = used - 1;
    if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
      return 1;
    }
    for (; ; ) {
      here_bits = len - drop;
      if (work[sym] < end) {
        here_op = 0;
        here_val = work[sym];
      } else if (work[sym] > end) {
        here_op = extra[extra_index + work[sym]];
        here_val = base[base_index + work[sym]];
      } else {
        here_op = 32 + 64;
        here_val = 0;
      }
      incr = 1 << len - drop;
      fill = 1 << curr;
      min = fill;
      do {
        fill -= incr;
        table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
      } while (fill !== 0);
      incr = 1 << len - 1;
      while (huff & incr) {
        incr >>= 1;
      }
      if (incr !== 0) {
        huff &= incr - 1;
        huff += incr;
      } else {
        huff = 0;
      }
      sym++;
      if (--count[len] === 0) {
        if (len === max) {
          break;
        }
        len = lens[lens_index + work[sym]];
      }
      if (len > root && (huff & mask) !== low) {
        if (drop === 0) {
          drop = root;
        }
        next += min;
        curr = len - drop;
        left = 1 << curr;
        while (curr + drop < max) {
          left -= count[curr + drop];
          if (left <= 0) {
            break;
          }
          curr++;
          left <<= 1;
        }
        used += 1 << curr;
        if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
          return 1;
        }
        low = huff & mask;
        table[low] = root << 24 | curr << 16 | next - table_index | 0;
      }
    }
    if (huff !== 0) {
      table[next + huff] = len - drop << 24 | 64 << 16 | 0;
    }
    opts.bits = root;
    return 0;
  };
  var inftrees = inflate_table;
  var CODES = 0;
  var LENS = 1;
  var DISTS = 2;
  var {
    Z_FINISH: Z_FINISH$1,
    Z_BLOCK,
    Z_TREES,
    Z_OK: Z_OK$1,
    Z_STREAM_END: Z_STREAM_END$1,
    Z_NEED_DICT: Z_NEED_DICT$1,
    Z_STREAM_ERROR: Z_STREAM_ERROR$1,
    Z_DATA_ERROR: Z_DATA_ERROR$1,
    Z_MEM_ERROR: Z_MEM_ERROR$1,
    Z_BUF_ERROR,
    Z_DEFLATED
  } = constants$2;
  var HEAD = 1;
  var FLAGS = 2;
  var TIME = 3;
  var OS = 4;
  var EXLEN = 5;
  var EXTRA = 6;
  var NAME = 7;
  var COMMENT = 8;
  var HCRC = 9;
  var DICTID = 10;
  var DICT = 11;
  var TYPE = 12;
  var TYPEDO = 13;
  var STORED = 14;
  var COPY_ = 15;
  var COPY = 16;
  var TABLE = 17;
  var LENLENS = 18;
  var CODELENS = 19;
  var LEN_ = 20;
  var LEN = 21;
  var LENEXT = 22;
  var DIST = 23;
  var DISTEXT = 24;
  var MATCH = 25;
  var LIT = 26;
  var CHECK = 27;
  var LENGTH = 28;
  var DONE = 29;
  var BAD = 30;
  var MEM = 31;
  var SYNC = 32;
  var ENOUGH_LENS = 852;
  var ENOUGH_DISTS = 592;
  var MAX_WBITS = 15;
  var DEF_WBITS = MAX_WBITS;
  var zswap32 = (q) => {
    return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
  };
  function InflateState() {
    this.mode = 0;
    this.last = false;
    this.wrap = 0;
    this.havedict = false;
    this.flags = 0;
    this.dmax = 0;
    this.check = 0;
    this.total = 0;
    this.head = null;
    this.wbits = 0;
    this.wsize = 0;
    this.whave = 0;
    this.wnext = 0;
    this.window = null;
    this.hold = 0;
    this.bits = 0;
    this.length = 0;
    this.offset = 0;
    this.extra = 0;
    this.lencode = null;
    this.distcode = null;
    this.lenbits = 0;
    this.distbits = 0;
    this.ncode = 0;
    this.nlen = 0;
    this.ndist = 0;
    this.have = 0;
    this.next = null;
    this.lens = new Uint16Array(320);
    this.work = new Uint16Array(288);
    this.lendyn = null;
    this.distdyn = null;
    this.sane = 0;
    this.back = 0;
    this.was = 0;
  }
  var inflateResetKeep = (strm) => {
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$1;
    }
    const state = strm.state;
    strm.total_in = strm.total_out = state.total = 0;
    strm.msg = "";
    if (state.wrap) {
      strm.adler = state.wrap & 1;
    }
    state.mode = HEAD;
    state.last = 0;
    state.havedict = 0;
    state.dmax = 32768;
    state.head = null;
    state.hold = 0;
    state.bits = 0;
    state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS);
    state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS);
    state.sane = 1;
    state.back = -1;
    return Z_OK$1;
  };
  var inflateReset = (strm) => {
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$1;
    }
    const state = strm.state;
    state.wsize = 0;
    state.whave = 0;
    state.wnext = 0;
    return inflateResetKeep(strm);
  };
  var inflateReset2 = (strm, windowBits) => {
    let wrap;
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$1;
    }
    const state = strm.state;
    if (windowBits < 0) {
      wrap = 0;
      windowBits = -windowBits;
    } else {
      wrap = (windowBits >> 4) + 1;
      if (windowBits < 48) {
        windowBits &= 15;
      }
    }
    if (windowBits && (windowBits < 8 || windowBits > 15)) {
      return Z_STREAM_ERROR$1;
    }
    if (state.window !== null && state.wbits !== windowBits) {
      state.window = null;
    }
    state.wrap = wrap;
    state.wbits = windowBits;
    return inflateReset(strm);
  };
  var inflateInit2 = (strm, windowBits) => {
    if (!strm) {
      return Z_STREAM_ERROR$1;
    }
    const state = new InflateState();
    strm.state = state;
    state.window = null;
    const ret = inflateReset2(strm, windowBits);
    if (ret !== Z_OK$1) {
      strm.state = null;
    }
    return ret;
  };
  var inflateInit = (strm) => {
    return inflateInit2(strm, DEF_WBITS);
  };
  var virgin = true;
  var lenfix;
  var distfix;
  var fixedtables = (state) => {
    if (virgin) {
      lenfix = new Int32Array(512);
      distfix = new Int32Array(32);
      let sym = 0;
      while (sym < 144) {
        state.lens[sym++] = 8;
      }
      while (sym < 256) {
        state.lens[sym++] = 9;
      }
      while (sym < 280) {
        state.lens[sym++] = 7;
      }
      while (sym < 288) {
        state.lens[sym++] = 8;
      }
      inftrees(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
      sym = 0;
      while (sym < 32) {
        state.lens[sym++] = 5;
      }
      inftrees(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
      virgin = false;
    }
    state.lencode = lenfix;
    state.lenbits = 9;
    state.distcode = distfix;
    state.distbits = 5;
  };
  var updatewindow = (strm, src, end, copy) => {
    let dist;
    const state = strm.state;
    if (state.window === null) {
      state.wsize = 1 << state.wbits;
      state.wnext = 0;
      state.whave = 0;
      state.window = new Uint8Array(state.wsize);
    }
    if (copy >= state.wsize) {
      state.window.set(src.subarray(end - state.wsize, end), 0);
      state.wnext = 0;
      state.whave = state.wsize;
    } else {
      dist = state.wsize - state.wnext;
      if (dist > copy) {
        dist = copy;
      }
      state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
      copy -= dist;
      if (copy) {
        state.window.set(src.subarray(end - copy, end), 0);
        state.wnext = copy;
        state.whave = state.wsize;
      } else {
        state.wnext += dist;
        if (state.wnext === state.wsize) {
          state.wnext = 0;
        }
        if (state.whave < state.wsize) {
          state.whave += dist;
        }
      }
    }
    return 0;
  };
  var inflate$2 = (strm, flush) => {
    let state;
    let input, output;
    let next;
    let put;
    let have, left;
    let hold;
    let bits;
    let _in, _out;
    let copy;
    let from2;
    let from_source;
    let here = 0;
    let here_bits, here_op, here_val;
    let last_bits, last_op, last_val;
    let len;
    let ret;
    const hbuf = new Uint8Array(4);
    let opts;
    let n2;
    const order = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
    if (!strm || !strm.state || !strm.output || !strm.input && strm.avail_in !== 0) {
      return Z_STREAM_ERROR$1;
    }
    state = strm.state;
    if (state.mode === TYPE) {
      state.mode = TYPEDO;
    }
    put = strm.next_out;
    output = strm.output;
    left = strm.avail_out;
    next = strm.next_in;
    input = strm.input;
    have = strm.avail_in;
    hold = state.hold;
    bits = state.bits;
    _in = have;
    _out = left;
    ret = Z_OK$1;
    inf_leave:
      for (; ; ) {
        switch (state.mode) {
          case HEAD:
            if (state.wrap === 0) {
              state.mode = TYPEDO;
              break;
            }
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.wrap & 2 && hold === 35615) {
              state.check = 0;
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32_1(state.check, hbuf, 2, 0);
              hold = 0;
              bits = 0;
              state.mode = FLAGS;
              break;
            }
            state.flags = 0;
            if (state.head) {
              state.head.done = false;
            }
            if (!(state.wrap & 1) || (((hold & 255) << 8) + (hold >> 8)) % 31) {
              strm.msg = "incorrect header check";
              state.mode = BAD;
              break;
            }
            if ((hold & 15) !== Z_DEFLATED) {
              strm.msg = "unknown compression method";
              state.mode = BAD;
              break;
            }
            hold >>>= 4;
            bits -= 4;
            len = (hold & 15) + 8;
            if (state.wbits === 0) {
              state.wbits = len;
            } else if (len > state.wbits) {
              strm.msg = "invalid window size";
              state.mode = BAD;
              break;
            }
            state.dmax = 1 << state.wbits;
            strm.adler = state.check = 1;
            state.mode = hold & 512 ? DICTID : TYPE;
            hold = 0;
            bits = 0;
            break;
          case FLAGS:
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.flags = hold;
            if ((state.flags & 255) !== Z_DEFLATED) {
              strm.msg = "unknown compression method";
              state.mode = BAD;
              break;
            }
            if (state.flags & 57344) {
              strm.msg = "unknown header flags set";
              state.mode = BAD;
              break;
            }
            if (state.head) {
              state.head.text = hold >> 8 & 1;
            }
            if (state.flags & 512) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32_1(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
            state.mode = TIME;
          case TIME:
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.head) {
              state.head.time = hold;
            }
            if (state.flags & 512) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              hbuf[2] = hold >>> 16 & 255;
              hbuf[3] = hold >>> 24 & 255;
              state.check = crc32_1(state.check, hbuf, 4, 0);
            }
            hold = 0;
            bits = 0;
            state.mode = OS;
          case OS:
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.head) {
              state.head.xflags = hold & 255;
              state.head.os = hold >> 8;
            }
            if (state.flags & 512) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32_1(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
            state.mode = EXLEN;
          case EXLEN:
            if (state.flags & 1024) {
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.length = hold;
              if (state.head) {
                state.head.extra_len = hold;
              }
              if (state.flags & 512) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc32_1(state.check, hbuf, 2, 0);
              }
              hold = 0;
              bits = 0;
            } else if (state.head) {
              state.head.extra = null;
            }
            state.mode = EXTRA;
          case EXTRA:
            if (state.flags & 1024) {
              copy = state.length;
              if (copy > have) {
                copy = have;
              }
              if (copy) {
                if (state.head) {
                  len = state.head.extra_len - state.length;
                  if (!state.head.extra) {
                    state.head.extra = new Uint8Array(state.head.extra_len);
                  }
                  state.head.extra.set(input.subarray(next, next + copy), len);
                }
                if (state.flags & 512) {
                  state.check = crc32_1(state.check, input, copy, next);
                }
                have -= copy;
                next += copy;
                state.length -= copy;
              }
              if (state.length) {
                break inf_leave;
              }
            }
            state.length = 0;
            state.mode = NAME;
          case NAME:
            if (state.flags & 2048) {
              if (have === 0) {
                break inf_leave;
              }
              copy = 0;
              do {
                len = input[next + copy++];
                if (state.head && len && state.length < 65536) {
                  state.head.name += String.fromCharCode(len);
                }
              } while (len && copy < have);
              if (state.flags & 512) {
                state.check = crc32_1(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              if (len) {
                break inf_leave;
              }
            } else if (state.head) {
              state.head.name = null;
            }
            state.length = 0;
            state.mode = COMMENT;
          case COMMENT:
            if (state.flags & 4096) {
              if (have === 0) {
                break inf_leave;
              }
              copy = 0;
              do {
                len = input[next + copy++];
                if (state.head && len && state.length < 65536) {
                  state.head.comment += String.fromCharCode(len);
                }
              } while (len && copy < have);
              if (state.flags & 512) {
                state.check = crc32_1(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              if (len) {
                break inf_leave;
              }
            } else if (state.head) {
              state.head.comment = null;
            }
            state.mode = HCRC;
          case HCRC:
            if (state.flags & 512) {
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (hold !== (state.check & 65535)) {
                strm.msg = "header crc mismatch";
                state.mode = BAD;
                break;
              }
              hold = 0;
              bits = 0;
            }
            if (state.head) {
              state.head.hcrc = state.flags >> 9 & 1;
              state.head.done = true;
            }
            strm.adler = state.check = 0;
            state.mode = TYPE;
            break;
          case DICTID:
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            strm.adler = state.check = zswap32(hold);
            hold = 0;
            bits = 0;
            state.mode = DICT;
          case DICT:
            if (state.havedict === 0) {
              strm.next_out = put;
              strm.avail_out = left;
              strm.next_in = next;
              strm.avail_in = have;
              state.hold = hold;
              state.bits = bits;
              return Z_NEED_DICT$1;
            }
            strm.adler = state.check = 1;
            state.mode = TYPE;
          case TYPE:
            if (flush === Z_BLOCK || flush === Z_TREES) {
              break inf_leave;
            }
          case TYPEDO:
            if (state.last) {
              hold >>>= bits & 7;
              bits -= bits & 7;
              state.mode = CHECK;
              break;
            }
            while (bits < 3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.last = hold & 1;
            hold >>>= 1;
            bits -= 1;
            switch (hold & 3) {
              case 0:
                state.mode = STORED;
                break;
              case 1:
                fixedtables(state);
                state.mode = LEN_;
                if (flush === Z_TREES) {
                  hold >>>= 2;
                  bits -= 2;
                  break inf_leave;
                }
                break;
              case 2:
                state.mode = TABLE;
                break;
              case 3:
                strm.msg = "invalid block type";
                state.mode = BAD;
            }
            hold >>>= 2;
            bits -= 2;
            break;
          case STORED:
            hold >>>= bits & 7;
            bits -= bits & 7;
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
              strm.msg = "invalid stored block lengths";
              state.mode = BAD;
              break;
            }
            state.length = hold & 65535;
            hold = 0;
            bits = 0;
            state.mode = COPY_;
            if (flush === Z_TREES) {
              break inf_leave;
            }
          case COPY_:
            state.mode = COPY;
          case COPY:
            copy = state.length;
            if (copy) {
              if (copy > have) {
                copy = have;
              }
              if (copy > left) {
                copy = left;
              }
              if (copy === 0) {
                break inf_leave;
              }
              output.set(input.subarray(next, next + copy), put);
              have -= copy;
              next += copy;
              left -= copy;
              put += copy;
              state.length -= copy;
              break;
            }
            state.mode = TYPE;
            break;
          case TABLE:
            while (bits < 14) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.nlen = (hold & 31) + 257;
            hold >>>= 5;
            bits -= 5;
            state.ndist = (hold & 31) + 1;
            hold >>>= 5;
            bits -= 5;
            state.ncode = (hold & 15) + 4;
            hold >>>= 4;
            bits -= 4;
            if (state.nlen > 286 || state.ndist > 30) {
              strm.msg = "too many length or distance symbols";
              state.mode = BAD;
              break;
            }
            state.have = 0;
            state.mode = LENLENS;
          case LENLENS:
            while (state.have < state.ncode) {
              while (bits < 3) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.lens[order[state.have++]] = hold & 7;
              hold >>>= 3;
              bits -= 3;
            }
            while (state.have < 19) {
              state.lens[order[state.have++]] = 0;
            }
            state.lencode = state.lendyn;
            state.lenbits = 7;
            opts = { bits: state.lenbits };
            ret = inftrees(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
            state.lenbits = opts.bits;
            if (ret) {
              strm.msg = "invalid code lengths set";
              state.mode = BAD;
              break;
            }
            state.have = 0;
            state.mode = CODELENS;
          case CODELENS:
            while (state.have < state.nlen + state.ndist) {
              for (; ; ) {
                here = state.lencode[hold & (1 << state.lenbits) - 1];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (here_val < 16) {
                hold >>>= here_bits;
                bits -= here_bits;
                state.lens[state.have++] = here_val;
              } else {
                if (here_val === 16) {
                  n2 = here_bits + 2;
                  while (bits < n2) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= here_bits;
                  bits -= here_bits;
                  if (state.have === 0) {
                    strm.msg = "invalid bit length repeat";
                    state.mode = BAD;
                    break;
                  }
                  len = state.lens[state.have - 1];
                  copy = 3 + (hold & 3);
                  hold >>>= 2;
                  bits -= 2;
                } else if (here_val === 17) {
                  n2 = here_bits + 3;
                  while (bits < n2) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= here_bits;
                  bits -= here_bits;
                  len = 0;
                  copy = 3 + (hold & 7);
                  hold >>>= 3;
                  bits -= 3;
                } else {
                  n2 = here_bits + 7;
                  while (bits < n2) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= here_bits;
                  bits -= here_bits;
                  len = 0;
                  copy = 11 + (hold & 127);
                  hold >>>= 7;
                  bits -= 7;
                }
                if (state.have + copy > state.nlen + state.ndist) {
                  strm.msg = "invalid bit length repeat";
                  state.mode = BAD;
                  break;
                }
                while (copy--) {
                  state.lens[state.have++] = len;
                }
              }
            }
            if (state.mode === BAD) {
              break;
            }
            if (state.lens[256] === 0) {
              strm.msg = "invalid code -- missing end-of-block";
              state.mode = BAD;
              break;
            }
            state.lenbits = 9;
            opts = { bits: state.lenbits };
            ret = inftrees(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
            state.lenbits = opts.bits;
            if (ret) {
              strm.msg = "invalid literal/lengths set";
              state.mode = BAD;
              break;
            }
            state.distbits = 6;
            state.distcode = state.distdyn;
            opts = { bits: state.distbits };
            ret = inftrees(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
            state.distbits = opts.bits;
            if (ret) {
              strm.msg = "invalid distances set";
              state.mode = BAD;
              break;
            }
            state.mode = LEN_;
            if (flush === Z_TREES) {
              break inf_leave;
            }
          case LEN_:
            state.mode = LEN;
          case LEN:
            if (have >= 6 && left >= 258) {
              strm.next_out = put;
              strm.avail_out = left;
              strm.next_in = next;
              strm.avail_in = have;
              state.hold = hold;
              state.bits = bits;
              inffast(strm, _out);
              put = strm.next_out;
              output = strm.output;
              left = strm.avail_out;
              next = strm.next_in;
              input = strm.input;
              have = strm.avail_in;
              hold = state.hold;
              bits = state.bits;
              if (state.mode === TYPE) {
                state.back = -1;
              }
              break;
            }
            state.back = 0;
            for (; ; ) {
              here = state.lencode[hold & (1 << state.lenbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (here_op && (here_op & 240) === 0) {
              last_bits = here_bits;
              last_op = here_op;
              last_val = here_val;
              for (; ; ) {
                here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (last_bits + here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              hold >>>= last_bits;
              bits -= last_bits;
              state.back += last_bits;
            }
            hold >>>= here_bits;
            bits -= here_bits;
            state.back += here_bits;
            state.length = here_val;
            if (here_op === 0) {
              state.mode = LIT;
              break;
            }
            if (here_op & 32) {
              state.back = -1;
              state.mode = TYPE;
              break;
            }
            if (here_op & 64) {
              strm.msg = "invalid literal/length code";
              state.mode = BAD;
              break;
            }
            state.extra = here_op & 15;
            state.mode = LENEXT;
          case LENEXT:
            if (state.extra) {
              n2 = state.extra;
              while (bits < n2) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.length += hold & (1 << state.extra) - 1;
              hold >>>= state.extra;
              bits -= state.extra;
              state.back += state.extra;
            }
            state.was = state.length;
            state.mode = DIST;
          case DIST:
            for (; ; ) {
              here = state.distcode[hold & (1 << state.distbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if ((here_op & 240) === 0) {
              last_bits = here_bits;
              last_op = here_op;
              last_val = here_val;
              for (; ; ) {
                here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (last_bits + here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              hold >>>= last_bits;
              bits -= last_bits;
              state.back += last_bits;
            }
            hold >>>= here_bits;
            bits -= here_bits;
            state.back += here_bits;
            if (here_op & 64) {
              strm.msg = "invalid distance code";
              state.mode = BAD;
              break;
            }
            state.offset = here_val;
            state.extra = here_op & 15;
            state.mode = DISTEXT;
          case DISTEXT:
            if (state.extra) {
              n2 = state.extra;
              while (bits < n2) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.offset += hold & (1 << state.extra) - 1;
              hold >>>= state.extra;
              bits -= state.extra;
              state.back += state.extra;
            }
            if (state.offset > state.dmax) {
              strm.msg = "invalid distance too far back";
              state.mode = BAD;
              break;
            }
            state.mode = MATCH;
          case MATCH:
            if (left === 0) {
              break inf_leave;
            }
            copy = _out - left;
            if (state.offset > copy) {
              copy = state.offset - copy;
              if (copy > state.whave) {
                if (state.sane) {
                  strm.msg = "invalid distance too far back";
                  state.mode = BAD;
                  break;
                }
              }
              if (copy > state.wnext) {
                copy -= state.wnext;
                from2 = state.wsize - copy;
              } else {
                from2 = state.wnext - copy;
              }
              if (copy > state.length) {
                copy = state.length;
              }
              from_source = state.window;
            } else {
              from_source = output;
              from2 = put - state.offset;
              copy = state.length;
            }
            if (copy > left) {
              copy = left;
            }
            left -= copy;
            state.length -= copy;
            do {
              output[put++] = from_source[from2++];
            } while (--copy);
            if (state.length === 0) {
              state.mode = LEN;
            }
            break;
          case LIT:
            if (left === 0) {
              break inf_leave;
            }
            output[put++] = state.length;
            left--;
            state.mode = LEN;
            break;
          case CHECK:
            if (state.wrap) {
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold |= input[next++] << bits;
                bits += 8;
              }
              _out -= left;
              strm.total_out += _out;
              state.total += _out;
              if (_out) {
                strm.adler = state.check = state.flags ? crc32_1(state.check, output, _out, put - _out) : adler32_1(state.check, output, _out, put - _out);
              }
              _out = left;
              if ((state.flags ? hold : zswap32(hold)) !== state.check) {
                strm.msg = "incorrect data check";
                state.mode = BAD;
                break;
              }
              hold = 0;
              bits = 0;
            }
            state.mode = LENGTH;
          case LENGTH:
            if (state.wrap && state.flags) {
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (hold !== (state.total & 4294967295)) {
                strm.msg = "incorrect length check";
                state.mode = BAD;
                break;
              }
              hold = 0;
              bits = 0;
            }
            state.mode = DONE;
          case DONE:
            ret = Z_STREAM_END$1;
            break inf_leave;
          case BAD:
            ret = Z_DATA_ERROR$1;
            break inf_leave;
          case MEM:
            return Z_MEM_ERROR$1;
          case SYNC:
          default:
            return Z_STREAM_ERROR$1;
        }
      }
    strm.next_out = put;
    strm.avail_out = left;
    strm.next_in = next;
    strm.avail_in = have;
    state.hold = hold;
    state.bits = bits;
    if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH$1)) {
      if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out))
        ;
    }
    _in -= strm.avail_in;
    _out -= strm.avail_out;
    strm.total_in += _in;
    strm.total_out += _out;
    state.total += _out;
    if (state.wrap && _out) {
      strm.adler = state.check = state.flags ? crc32_1(state.check, output, _out, strm.next_out - _out) : adler32_1(state.check, output, _out, strm.next_out - _out);
    }
    strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
    if ((_in === 0 && _out === 0 || flush === Z_FINISH$1) && ret === Z_OK$1) {
      ret = Z_BUF_ERROR;
    }
    return ret;
  };
  var inflateEnd = (strm) => {
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$1;
    }
    let state = strm.state;
    if (state.window) {
      state.window = null;
    }
    strm.state = null;
    return Z_OK$1;
  };
  var inflateGetHeader = (strm, head) => {
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$1;
    }
    const state = strm.state;
    if ((state.wrap & 2) === 0) {
      return Z_STREAM_ERROR$1;
    }
    state.head = head;
    head.done = false;
    return Z_OK$1;
  };
  var inflateSetDictionary = (strm, dictionary) => {
    const dictLength = dictionary.length;
    let state;
    let dictid;
    let ret;
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$1;
    }
    state = strm.state;
    if (state.wrap !== 0 && state.mode !== DICT) {
      return Z_STREAM_ERROR$1;
    }
    if (state.mode === DICT) {
      dictid = 1;
      dictid = adler32_1(dictid, dictionary, dictLength, 0);
      if (dictid !== state.check) {
        return Z_DATA_ERROR$1;
      }
    }
    ret = updatewindow(strm, dictionary, dictLength, dictLength);
    if (ret) {
      state.mode = MEM;
      return Z_MEM_ERROR$1;
    }
    state.havedict = 1;
    return Z_OK$1;
  };
  var inflateReset_1 = inflateReset;
  var inflateReset2_1 = inflateReset2;
  var inflateResetKeep_1 = inflateResetKeep;
  var inflateInit_1 = inflateInit;
  var inflateInit2_1 = inflateInit2;
  var inflate_2$1 = inflate$2;
  var inflateEnd_1 = inflateEnd;
  var inflateGetHeader_1 = inflateGetHeader;
  var inflateSetDictionary_1 = inflateSetDictionary;
  var inflateInfo = "pako inflate (from Nodeca project)";
  var inflate_1$2 = {
    inflateReset: inflateReset_1,
    inflateReset2: inflateReset2_1,
    inflateResetKeep: inflateResetKeep_1,
    inflateInit: inflateInit_1,
    inflateInit2: inflateInit2_1,
    inflate: inflate_2$1,
    inflateEnd: inflateEnd_1,
    inflateGetHeader: inflateGetHeader_1,
    inflateSetDictionary: inflateSetDictionary_1,
    inflateInfo
  };
  function GZheader() {
    this.text = 0;
    this.time = 0;
    this.xflags = 0;
    this.os = 0;
    this.extra = null;
    this.extra_len = 0;
    this.name = "";
    this.comment = "";
    this.hcrc = 0;
    this.done = false;
  }
  var gzheader = GZheader;
  var toString7 = Object.prototype.toString;
  var {
    Z_NO_FLUSH,
    Z_FINISH,
    Z_OK,
    Z_STREAM_END,
    Z_NEED_DICT,
    Z_STREAM_ERROR,
    Z_DATA_ERROR,
    Z_MEM_ERROR
  } = constants$2;
  function Inflate$1(options) {
    this.options = common.assign({
      chunkSize: 1024 * 64,
      windowBits: 15,
      to: ""
    }, options || {});
    const opt = this.options;
    if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
      opt.windowBits = -opt.windowBits;
      if (opt.windowBits === 0) {
        opt.windowBits = -15;
      }
    }
    if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
      opt.windowBits += 32;
    }
    if (opt.windowBits > 15 && opt.windowBits < 48) {
      if ((opt.windowBits & 15) === 0) {
        opt.windowBits |= 15;
      }
    }
    this.err = 0;
    this.msg = "";
    this.ended = false;
    this.chunks = [];
    this.strm = new zstream();
    this.strm.avail_out = 0;
    let status = inflate_1$2.inflateInit2(this.strm, opt.windowBits);
    if (status !== Z_OK) {
      throw new Error(messages[status]);
    }
    this.header = new gzheader();
    inflate_1$2.inflateGetHeader(this.strm, this.header);
    if (opt.dictionary) {
      if (typeof opt.dictionary === "string") {
        opt.dictionary = strings.string2buf(opt.dictionary);
      } else if (toString7.call(opt.dictionary) === "[object ArrayBuffer]") {
        opt.dictionary = new Uint8Array(opt.dictionary);
      }
      if (opt.raw) {
        status = inflate_1$2.inflateSetDictionary(this.strm, opt.dictionary);
        if (status !== Z_OK) {
          throw new Error(messages[status]);
        }
      }
    }
  }
  Inflate$1.prototype.push = function(data3, flush_mode) {
    const strm = this.strm;
    const chunkSize = this.options.chunkSize;
    const dictionary = this.options.dictionary;
    let status, _flush_mode, last_avail_out;
    if (this.ended)
      return false;
    if (flush_mode === ~~flush_mode)
      _flush_mode = flush_mode;
    else
      _flush_mode = flush_mode === true ? Z_FINISH : Z_NO_FLUSH;
    if (toString7.call(data3) === "[object ArrayBuffer]") {
      strm.input = new Uint8Array(data3);
    } else {
      strm.input = data3;
    }
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
    for (; ; ) {
      if (strm.avail_out === 0) {
        strm.output = new Uint8Array(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      status = inflate_1$2.inflate(strm, _flush_mode);
      if (status === Z_NEED_DICT && dictionary) {
        status = inflate_1$2.inflateSetDictionary(strm, dictionary);
        if (status === Z_OK) {
          status = inflate_1$2.inflate(strm, _flush_mode);
        } else if (status === Z_DATA_ERROR) {
          status = Z_NEED_DICT;
        }
      }
      while (strm.avail_in > 0 && status === Z_STREAM_END && strm.state.wrap > 0 && data3[strm.next_in] !== 0) {
        inflate_1$2.inflateReset(strm);
        status = inflate_1$2.inflate(strm, _flush_mode);
      }
      switch (status) {
        case Z_STREAM_ERROR:
        case Z_DATA_ERROR:
        case Z_NEED_DICT:
        case Z_MEM_ERROR:
          this.onEnd(status);
          this.ended = true;
          return false;
      }
      last_avail_out = strm.avail_out;
      if (strm.next_out) {
        if (strm.avail_out === 0 || status === Z_STREAM_END) {
          if (this.options.to === "string") {
            let next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
            let tail = strm.next_out - next_out_utf8;
            let utf8str = strings.buf2string(strm.output, next_out_utf8);
            strm.next_out = tail;
            strm.avail_out = chunkSize - tail;
            if (tail)
              strm.output.set(strm.output.subarray(next_out_utf8, next_out_utf8 + tail), 0);
            this.onData(utf8str);
          } else {
            this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
          }
        }
      }
      if (status === Z_OK && last_avail_out === 0)
        continue;
      if (status === Z_STREAM_END) {
        status = inflate_1$2.inflateEnd(this.strm);
        this.onEnd(status);
        this.ended = true;
        return true;
      }
      if (strm.avail_in === 0)
        break;
    }
    return true;
  };
  Inflate$1.prototype.onData = function(chunk) {
    this.chunks.push(chunk);
  };
  Inflate$1.prototype.onEnd = function(status) {
    if (status === Z_OK) {
      if (this.options.to === "string") {
        this.result = this.chunks.join("");
      } else {
        this.result = common.flattenChunks(this.chunks);
      }
    }
    this.chunks = [];
    this.err = status;
    this.msg = this.strm.msg;
  };
  function inflate$1(input, options) {
    const inflator = new Inflate$1(options);
    inflator.push(input);
    if (inflator.err)
      throw inflator.msg || messages[inflator.err];
    return inflator.result;
  }
  function inflateRaw$1(input, options) {
    options = options || {};
    options.raw = true;
    return inflate$1(input, options);
  }
  var Inflate_1$1 = Inflate$1;
  var inflate_2 = inflate$1;
  var inflateRaw_1$1 = inflateRaw$1;
  var ungzip$1 = inflate$1;
  var constants = constants$2;
  var inflate_1$1 = {
    Inflate: Inflate_1$1,
    inflate: inflate_2,
    inflateRaw: inflateRaw_1$1,
    ungzip: ungzip$1,
    constants
  };
  var { Inflate, inflate, inflateRaw, ungzip } = inflate_1$1;
  var Inflate_1 = Inflate;

  // node_modules/fast-png/lib-esm/common.js
  var pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  var crcTable2 = [];
  for (let n2 = 0; n2 < 256; n2++) {
    let c = n2;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 3988292384 ^ c >>> 1;
      } else {
        c = c >>> 1;
      }
    }
    crcTable2[n2] = c;
  }
  var initialCrc = 4294967295;
  function updateCrc(currentCrc, data3, length3) {
    let c = currentCrc;
    for (let n2 = 0; n2 < length3; n2++) {
      c = crcTable2[(c ^ data3[n2]) & 255] ^ c >>> 8;
    }
    return c;
  }
  function crc(data3, length3) {
    return (updateCrc(initialCrc, data3, length3) ^ initialCrc) >>> 0;
  }

  // node_modules/fast-png/lib-esm/internalTypes.js
  var ColorType;
  (function(ColorType2) {
    ColorType2[ColorType2["UNKNOWN"] = -1] = "UNKNOWN";
    ColorType2[ColorType2["GREYSCALE"] = 0] = "GREYSCALE";
    ColorType2[ColorType2["TRUECOLOUR"] = 2] = "TRUECOLOUR";
    ColorType2[ColorType2["INDEXED_COLOUR"] = 3] = "INDEXED_COLOUR";
    ColorType2[ColorType2["GREYSCALE_ALPHA"] = 4] = "GREYSCALE_ALPHA";
    ColorType2[ColorType2["TRUECOLOUR_ALPHA"] = 6] = "TRUECOLOUR_ALPHA";
  })(ColorType || (ColorType = {}));
  var CompressionMethod;
  (function(CompressionMethod2) {
    CompressionMethod2[CompressionMethod2["UNKNOWN"] = -1] = "UNKNOWN";
    CompressionMethod2[CompressionMethod2["DEFLATE"] = 0] = "DEFLATE";
  })(CompressionMethod || (CompressionMethod = {}));
  var FilterMethod;
  (function(FilterMethod2) {
    FilterMethod2[FilterMethod2["UNKNOWN"] = -1] = "UNKNOWN";
    FilterMethod2[FilterMethod2["ADAPTIVE"] = 0] = "ADAPTIVE";
  })(FilterMethod || (FilterMethod = {}));
  var InterlaceMethod;
  (function(InterlaceMethod2) {
    InterlaceMethod2[InterlaceMethod2["UNKNOWN"] = -1] = "UNKNOWN";
    InterlaceMethod2[InterlaceMethod2["NO_INTERLACE"] = 0] = "NO_INTERLACE";
    InterlaceMethod2[InterlaceMethod2["ADAM7"] = 1] = "ADAM7";
  })(InterlaceMethod || (InterlaceMethod = {}));

  // node_modules/fast-png/lib-esm/PNGDecoder.js
  var empty2 = new Uint8Array(0);
  var NULL = "\0";
  var uint16 = new Uint16Array([255]);
  var uint8 = new Uint8Array(uint16.buffer);
  var osIsLittleEndian = uint8[0] === 255;
  var PNGDecoder = class extends IOBuffer {
    constructor(data3, options = {}) {
      super(data3);
      const { checkCrc = false } = options;
      this._checkCrc = checkCrc;
      this._inflator = new Inflate_1();
      this._png = {
        width: -1,
        height: -1,
        channels: -1,
        data: new Uint8Array(0),
        depth: 1,
        text: {}
      };
      this._end = false;
      this._hasPalette = false;
      this._palette = [];
      this._compressionMethod = CompressionMethod.UNKNOWN;
      this._filterMethod = FilterMethod.UNKNOWN;
      this._interlaceMethod = InterlaceMethod.UNKNOWN;
      this._colorType = -1;
      this.setBigEndian();
    }
    decode() {
      this.decodeSignature();
      while (!this._end) {
        this.decodeChunk();
      }
      this.decodeImage();
      return this._png;
    }
    decodeSignature() {
      for (let i = 0; i < pngSignature.length; i++) {
        if (this.readUint8() !== pngSignature[i]) {
          throw new Error(`wrong PNG signature. Byte at ${i} should be ${pngSignature[i]}.`);
        }
      }
    }
    decodeChunk() {
      const length3 = this.readUint32();
      const type = this.readChars(4);
      const offset2 = this.offset;
      switch (type) {
        case "IHDR":
          this.decodeIHDR();
          break;
        case "PLTE":
          this.decodePLTE(length3);
          break;
        case "IDAT":
          this.decodeIDAT(length3);
          break;
        case "IEND":
          this._end = true;
          break;
        case "tRNS":
          this.decodetRNS(length3);
          break;
        case "tEXt":
          this.decodetEXt(length3);
          break;
        case "pHYs":
          this.decodepHYs();
          break;
        default:
          this.skip(length3);
          break;
      }
      if (this.offset - offset2 !== length3) {
        throw new Error(`Length mismatch while decoding chunk ${type}`);
      }
      if (this._checkCrc) {
        const expectedCrc = this.readUint32();
        const crcLength = length3 + 4;
        const actualCrc = crc(new Uint8Array(this.buffer, this.byteOffset + this.offset - crcLength - 4, crcLength), crcLength);
        if (actualCrc !== expectedCrc) {
          throw new Error(`CRC mismatch for chunk ${type}. Expected ${expectedCrc}, found ${actualCrc}`);
        }
      } else {
        this.skip(4);
      }
    }
    decodeIHDR() {
      const image = this._png;
      image.width = this.readUint32();
      image.height = this.readUint32();
      image.depth = checkBitDepth(this.readUint8());
      const colorType = this.readUint8();
      this._colorType = colorType;
      let channels;
      switch (colorType) {
        case ColorType.GREYSCALE:
          channels = 1;
          break;
        case ColorType.TRUECOLOUR:
          channels = 3;
          break;
        case ColorType.INDEXED_COLOUR:
          channels = 1;
          break;
        case ColorType.GREYSCALE_ALPHA:
          channels = 2;
          break;
        case ColorType.TRUECOLOUR_ALPHA:
          channels = 4;
          break;
        default:
          throw new Error(`Unknown color type: ${colorType}`);
      }
      this._png.channels = channels;
      this._compressionMethod = this.readUint8();
      if (this._compressionMethod !== CompressionMethod.DEFLATE) {
        throw new Error(`Unsupported compression method: ${this._compressionMethod}`);
      }
      this._filterMethod = this.readUint8();
      this._interlaceMethod = this.readUint8();
    }
    decodePLTE(length3) {
      if (length3 % 3 !== 0) {
        throw new RangeError(`PLTE field length must be a multiple of 3. Got ${length3}`);
      }
      const l = length3 / 3;
      this._hasPalette = true;
      const palette2 = [];
      this._palette = palette2;
      for (let i = 0; i < l; i++) {
        palette2.push([this.readUint8(), this.readUint8(), this.readUint8()]);
      }
    }
    decodeIDAT(length3) {
      this._inflator.push(new Uint8Array(this.buffer, this.offset + this.byteOffset, length3));
      this.skip(length3);
    }
    decodetRNS(length3) {
      if (this._colorType === 3) {
        if (length3 > this._palette.length) {
          throw new Error(`tRNS chunk contains more alpha values than there are palette colors (${length3} vs ${this._palette.length})`);
        }
        let i = 0;
        for (; i < length3; i++) {
          const alpha = this.readByte();
          this._palette[i].push(alpha);
        }
        for (; i < this._palette.length; i++) {
          this._palette[i].push(255);
        }
      }
    }
    decodetEXt(length3) {
      let keyword = "";
      let char;
      while ((char = this.readChar()) !== NULL) {
        keyword += char;
      }
      this._png.text[keyword] = this.readChars(length3 - keyword.length - 1);
    }
    decodepHYs() {
      const ppuX = this.readUint32();
      const ppuY = this.readUint32();
      const unitSpecifier = this.readByte();
      this._png.resolution = { x: ppuX, y: ppuY, unit: unitSpecifier };
    }
    decodeImage() {
      if (this._inflator.err) {
        throw new Error(`Error while decompressing the data: ${this._inflator.err}`);
      }
      const data3 = this._inflator.result;
      if (this._filterMethod !== FilterMethod.ADAPTIVE) {
        throw new Error(`Filter method ${this._filterMethod} not supported`);
      }
      if (this._interlaceMethod === InterlaceMethod.NO_INTERLACE) {
        this.decodeInterlaceNull(data3);
      } else {
        throw new Error(`Interlace method ${this._interlaceMethod} not supported`);
      }
    }
    decodeInterlaceNull(data3) {
      const height = this._png.height;
      const bytesPerPixel = this._png.channels * this._png.depth / 8;
      const bytesPerLine = this._png.width * bytesPerPixel;
      const newData = new Uint8Array(this._png.height * bytesPerLine);
      let prevLine = empty2;
      let offset2 = 0;
      let currentLine;
      let newLine;
      for (let i = 0; i < height; i++) {
        currentLine = data3.subarray(offset2 + 1, offset2 + 1 + bytesPerLine);
        newLine = newData.subarray(i * bytesPerLine, (i + 1) * bytesPerLine);
        switch (data3[offset2]) {
          case 0:
            unfilterNone(currentLine, newLine, bytesPerLine);
            break;
          case 1:
            unfilterSub(currentLine, newLine, bytesPerLine, bytesPerPixel);
            break;
          case 2:
            unfilterUp(currentLine, newLine, prevLine, bytesPerLine);
            break;
          case 3:
            unfilterAverage(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel);
            break;
          case 4:
            unfilterPaeth(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel);
            break;
          default:
            throw new Error(`Unsupported filter: ${data3[offset2]}`);
        }
        prevLine = newLine;
        offset2 += bytesPerLine + 1;
      }
      if (this._hasPalette) {
        this._png.palette = this._palette;
      }
      if (this._png.depth === 16) {
        const uint16Data = new Uint16Array(newData.buffer);
        if (osIsLittleEndian) {
          for (let k = 0; k < uint16Data.length; k++) {
            uint16Data[k] = swap16(uint16Data[k]);
          }
        }
        this._png.data = uint16Data;
      } else {
        this._png.data = newData;
      }
    }
  };
  function unfilterNone(currentLine, newLine, bytesPerLine) {
    for (let i = 0; i < bytesPerLine; i++) {
      newLine[i] = currentLine[i];
    }
  }
  function unfilterSub(currentLine, newLine, bytesPerLine, bytesPerPixel) {
    let i = 0;
    for (; i < bytesPerPixel; i++) {
      newLine[i] = currentLine[i];
    }
    for (; i < bytesPerLine; i++) {
      newLine[i] = currentLine[i] + newLine[i - bytesPerPixel] & 255;
    }
  }
  function unfilterUp(currentLine, newLine, prevLine, bytesPerLine) {
    let i = 0;
    if (prevLine.length === 0) {
      for (; i < bytesPerLine; i++) {
        newLine[i] = currentLine[i];
      }
    } else {
      for (; i < bytesPerLine; i++) {
        newLine[i] = currentLine[i] + prevLine[i] & 255;
      }
    }
  }
  function unfilterAverage(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel) {
    let i = 0;
    if (prevLine.length === 0) {
      for (; i < bytesPerPixel; i++) {
        newLine[i] = currentLine[i];
      }
      for (; i < bytesPerLine; i++) {
        newLine[i] = currentLine[i] + (newLine[i - bytesPerPixel] >> 1) & 255;
      }
    } else {
      for (; i < bytesPerPixel; i++) {
        newLine[i] = currentLine[i] + (prevLine[i] >> 1) & 255;
      }
      for (; i < bytesPerLine; i++) {
        newLine[i] = currentLine[i] + (newLine[i - bytesPerPixel] + prevLine[i] >> 1) & 255;
      }
    }
  }
  function unfilterPaeth(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel) {
    let i = 0;
    if (prevLine.length === 0) {
      for (; i < bytesPerPixel; i++) {
        newLine[i] = currentLine[i];
      }
      for (; i < bytesPerLine; i++) {
        newLine[i] = currentLine[i] + newLine[i - bytesPerPixel] & 255;
      }
    } else {
      for (; i < bytesPerPixel; i++) {
        newLine[i] = currentLine[i] + prevLine[i] & 255;
      }
      for (; i < bytesPerLine; i++) {
        newLine[i] = currentLine[i] + paethPredictor(newLine[i - bytesPerPixel], prevLine[i], prevLine[i - bytesPerPixel]) & 255;
      }
    }
  }
  function paethPredictor(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc)
      return a;
    else if (pb <= pc)
      return b;
    else
      return c;
  }
  function swap16(val) {
    return (val & 255) << 8 | val >> 8 & 255;
  }
  function checkBitDepth(value) {
    if (value !== 1 && value !== 2 && value !== 4 && value !== 8 && value !== 16) {
      throw new Error(`invalid bit depth: ${value}`);
    }
    return value;
  }

  // node_modules/fast-png/lib-esm/types.js
  var ResolutionUnitSpecifier;
  (function(ResolutionUnitSpecifier2) {
    ResolutionUnitSpecifier2[ResolutionUnitSpecifier2["UNKNOWN"] = 0] = "UNKNOWN";
    ResolutionUnitSpecifier2[ResolutionUnitSpecifier2["METRE"] = 1] = "METRE";
  })(ResolutionUnitSpecifier || (ResolutionUnitSpecifier = {}));

  // node_modules/fast-png/lib-esm/index.js
  function decodePNG(data3, options) {
    const decoder2 = new PNGDecoder(data3, options);
    return decoder2.decode();
  }

  // src/common/script/lib/color.ts
  var color_exports = {};
  __export(color_exports, {
    Palette: () => Palette,
    chroma: () => chroma,
    from: () => from,
    isChroma: () => isChroma,
    isPalette: () => isPalette,
    palette: () => palette,
    rgb: () => rgb,
    rgb2arr: () => rgb2arr,
    rgba: () => rgba,
    rgba2arr: () => rgba2arr
  });
  var import_chroma_js = __toModule(require_chroma());
  function checkCount(count) {
    if (count < 0 || count > 65536) {
      throw new Error("Palettes cannot have more than 2^16 (65536) colors.");
    }
  }
  function isPalette(object) {
    return object["colors"] instanceof Uint32Array;
  }
  function isChroma(object) {
    return object["_rgb"] instanceof Array;
  }
  var Palette = class {
    constructor(arg) {
      if (typeof arg === "number") {
        checkCount(arg);
        this.colors = new Uint32Array(arg);
      } else if (arg instanceof Uint32Array) {
        this.colors = new Uint32Array(arg);
      } else if (isArray(arg)) {
        this.colors = new Uint32Array(arg.map(rgb));
      } else
        throw new Error(`Invalid Palette constructor`);
    }
    get(index) {
      return this.colors[index];
    }
    chromas() {
      return Array.from(this.colors).map((rgba3) => from(rgba3 & 16777215));
    }
  };
  var chroma = import_chroma_js.default;
  function from(obj) {
    if (typeof obj === "number")
      return (0, import_chroma_js.default)(rgb2bgr(obj & 16777215));
    else
      return (0, import_chroma_js.default)(obj);
  }
  function rgb(obj, g, b) {
    return rgba(obj, g, b, 255) | 4278190080;
  }
  function rgba(obj, g, b, a) {
    if (isChroma(obj)) {
      return rgba(obj._rgb[0], obj._rgb[1], obj._rgb[2], obj._rgb[3]);
    }
    if (typeof obj === "number") {
      let r = obj;
      if (typeof g === "number" && typeof b === "number")
        return (r & 255) << 0 | (g & 255) << 8 | (b & 255) << 16 | (a & 255) << 24;
      else
        return obj;
    }
    if (typeof obj !== "string" && isArray(obj) && typeof obj[0] === "number") {
      let arr = obj;
      let v = 0;
      v |= (arr[0] & 255) << 0;
      v |= (arr[1] & 255) << 8;
      v |= (arr[2] & 255) << 16;
      v |= (arr[3] & 255) << 24;
      return v;
    }
    return rgba(from(obj).rgb());
  }
  function rgba2arr(v) {
    return [
      v >> 0 & 255,
      v >> 8 & 255,
      v >> 16 & 255,
      v >> 24 & 255
    ];
  }
  function rgb2arr(v) {
    return rgba2arr(v).slice(0, 3);
  }
  var palette;
  (function(palette2) {
    function from2(obj, count) {
      checkCount(count);
      if (typeof obj === "function") {
        if (!count)
          throw new Error(`You must also pass the number of colors to generate.`);
        var pal = new Palette(count);
        for (var i = 0; i < pal.colors.length; i++) {
          pal.colors[i] = rgba(obj(i));
        }
        return pal;
      } else {
        return new Palette(obj);
      }
    }
    palette2.from = from2;
    function mono() {
      return greys(2);
    }
    palette2.mono = mono;
    function rgb2() {
      return new Palette([
        rgb(0, 0, 0),
        rgb(0, 0, 255),
        rgb(255, 0, 0),
        rgb(0, 255, 0)
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
        rgb(255, 255, 255)
      ]);
    }
    function greys(count) {
      return from2((i) => {
        let v = 255 * i / (count - 1);
        return rgb(v, v, v);
      }, count);
    }
    palette2.greys = greys;
    function colors(count) {
      switch (count) {
        case 2:
          return mono();
        case 4:
          return rgb2();
        case 8:
          return rgb3();
        default:
          return factors(count);
      }
    }
    palette2.colors = colors;
    function helix(count) {
      checkCount(count);
      return new Palette(chroma.cubehelix().scale().colors(count));
    }
    palette2.helix = helix;
    function factors(count, mult) {
      mult = mult || 204559;
      return from2((i) => rgb(i * mult), count);
    }
    palette2.factors = factors;
  })(palette || (palette = {}));

  // src/common/script/lib/io.ts
  var io_exports = {};
  __export(io_exports, {
    $$getData: () => $$getData,
    $$loadData: () => $$loadData,
    $$setupFS: () => $$setupFS,
    IOWaitError: () => IOWaitError,
    Mutable: () => Mutable,
    canonicalurl: () => canonicalurl,
    data: () => data2,
    fetchurl: () => fetchurl,
    module: () => module,
    mutable: () => mutable,
    read: () => read,
    readbin: () => readbin,
    readlines: () => readlines,
    readnocache: () => readnocache,
    splitlines: () => splitlines
  });
  var $$cache = new FileDataCache();
  var $$store;
  var $$data = {};
  var $$modules = new Map();
  function $$setupFS(store2) {
    $$store = store2;
  }
  function $$getData() {
    return $$data;
  }
  function $$loadData(data3) {
    Object.assign($$data, data3);
  }
  var data2;
  (function(data3) {
    function load2(object, key2) {
      if (object == null)
        return object;
      let override = $$data && $$data[key2];
      if (override && object.$$setstate) {
        object.$$setstate(override);
      } else if (override) {
        Object.assign(object, override);
      }
      return object;
    }
    data3.load = load2;
    function save(object, key2) {
      if ($$data && object && object.$$getstate) {
        $$data[key2] = object.$$getstate();
      }
      return object;
    }
    data3.save = save;
    function get(key2) {
      return $$data && $$data[key2];
    }
    data3.get = get;
    function set(key2, value) {
      if ($$data) {
        $$data[key2] = value;
      }
    }
    data3.set = set;
  })(data2 || (data2 = {}));
  var IOWaitError = class extends Error {
  };
  function canonicalurl(url) {
    if (url.startsWith("https://github.com/")) {
      let toks = url.split("/");
      if (toks[5] === "blob") {
        return `https://raw.githubusercontent.com/${toks[3]}/${toks[4]}/${toks.slice(6).join("/")}`;
      }
    }
    return url;
  }
  function fetchurl(url, type) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = type === "text" ? "text" : "arraybuffer";
    xhr.open("GET", url, false);
    xhr.send(null);
    if (xhr.response != null && xhr.status == 200) {
      if (type === "text") {
        return xhr.response;
      } else {
        return new Uint8Array(xhr.response);
      }
    } else {
      throw new Error(`The resource at "${url}" responded with status code of ${xhr.status}.`);
    }
  }
  function readnocache(url, type) {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      return fetchurl(url, type);
    }
    if ($$store) {
      return $$store.getFileData(url);
    }
  }
  function read(url, type) {
    url = canonicalurl(url);
    let cachekey = url;
    let data3 = $$cache.get(cachekey);
    if (data3 != null)
      return data3;
    data3 = readnocache(url, type);
    if (data3 == null)
      throw new Error(`Cannot find resource "${url}"`);
    if (type === "text" && typeof data3 !== "string")
      throw new Error(`Resource "${url}" is not a string`);
    if (type === "binary" && !(data3 instanceof Uint8Array))
      throw new Error(`Resource "${url}" is not a binary file`);
    $$cache.put(cachekey, data3);
    return data3;
  }
  function readbin(url) {
    var data3 = read(url, "binary");
    if (data3 instanceof Uint8Array)
      return data3;
    else
      throw new Error(`The resource at "${url}" is not a binary file.`);
  }
  function readlines(url) {
    return read(url, "text").split("\n");
  }
  function splitlines(text) {
    return text.split(/\n|\r\n/g);
  }
  function module(url) {
    let key2 = `${url}::${url.length}`;
    let exports2 = $$modules.get(key2);
    if (exports2 == null) {
      let code = readnocache(url, "text");
      let func = new Function("exports", "module", code);
      let module2 = {};
      exports2 = {};
      func(exports2, module2);
      $$modules.set(key2, exports2);
    }
    return exports2;
  }
  var Mutable = class {
    constructor(initial) {
      this.value = initial;
    }
    $$setstate(newstate) {
      this.value = newstate.value;
    }
    $$getstate() {
      return { value: this.value };
    }
  };
  function mutable(obj) {
    Object.defineProperty(obj, "$$setstate", {
      value: function(newstate) {
        Object.assign(this, newstate);
      },
      enumerable: false
    });
    Object.defineProperty(obj, "$$getstate", {
      value: function() {
        return this;
      },
      enumerable: false
    });
    return obj;
  }

  // src/common/script/lib/bitmap.ts
  var AbstractBitmap = class {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.style = {};
    }
    inbounds(x, y) {
      return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
    assign(fn) {
      if (typeof fn === "function") {
        for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
            this.set(x, y, fn(x, y));
          }
        }
      } else if (fn && fn["length"] != null) {
        this.setarray(fn);
      } else {
        throw new Error(`Illegal argument to assign(): ${fn}`);
      }
    }
    clone() {
      let bmp = this.blank(this.width, this.height);
      bmp.assign((x, y) => this.get(x, y));
      return bmp;
    }
    crop(srcx, srcy, width, height) {
      let dest = this.blank(width, height);
      dest.assign((x, y) => this.get(x + srcx, y + srcy));
      return dest;
    }
    blit(src, destx, desty, srcx, srcy) {
      destx |= 0;
      desty |= 0;
      srcx |= 0;
      srcy |= 0;
      for (var y = 0; y < src.height; y++) {
        for (var x = 0; x < src.width; x++) {
          let rgba3 = src.getrgba(x + srcx, y + srcy);
          this.set(x + destx, y + desty, rgba3);
        }
      }
    }
    fill(destx, desty, width, height, value) {
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          this.set(x + destx, y + desty, value);
        }
      }
    }
  };
  var RGBABitmap = class extends AbstractBitmap {
    constructor(width, height, initial) {
      super(width, height);
      this.rgba = new Uint32Array(this.width * this.height);
      if (initial)
        this.assign(initial);
    }
    setarray(arr) {
      this.rgba.set(arr);
    }
    set(x, y, rgba3) {
      if (this.inbounds(x, y))
        this.rgba[y * this.width + x] = rgba3;
    }
    get(x, y) {
      return this.inbounds(x, y) ? this.rgba[y * this.width + x] : 0;
    }
    getrgba(x, y) {
      return this.get(x, y);
    }
    blank(width, height) {
      return new RGBABitmap(width || this.width, height || this.height);
    }
    clone() {
      let bitmap = this.blank(this.width, this.height);
      bitmap.rgba.set(this.rgba);
      return bitmap;
    }
  };
  var MappedBitmap = class extends AbstractBitmap {
    constructor(width, height, bpp, initial) {
      super(width, height);
      this.bpp = bpp;
      if (bpp != 1 && bpp != 2 && bpp != 4 && bpp != 8)
        throw new Error(`Invalid bits per pixel: ${bpp}`);
      this.pixels = new Uint8Array(this.width * this.height);
      if (initial)
        this.assign(initial);
    }
    setarray(arr) {
      this.pixels.set(arr);
    }
    set(x, y, index) {
      if (this.inbounds(x, y))
        this.pixels[y * this.width + x] = index;
    }
    get(x, y) {
      return this.inbounds(x, y) ? this.pixels[y * this.width + x] : 0;
    }
  };
  function getbpp(x) {
    if (typeof x === "number")
      return x;
    if (x instanceof Palette) {
      if (x.colors.length <= 2)
        return 1;
      else if (x.colors.length <= 4)
        return 2;
      else if (x.colors.length <= 16)
        return 4;
    }
    return 8;
  }
  var IndexedBitmap = class extends MappedBitmap {
    constructor(width, height, bppOrPalette, initial) {
      super(width, height, getbpp(bppOrPalette), initial);
      this.palette = bppOrPalette instanceof Palette ? bppOrPalette : palette.colors(1 << this.bpp);
    }
    getrgba(x, y) {
      return this.palette && this.palette.colors[this.get(x, y)];
    }
    blank(width, height, newPalette) {
      let bitmap = new IndexedBitmap(width || this.width, height || this.height, newPalette || this.palette);
      return bitmap;
    }
    clone() {
      let bitmap = this.blank(this.width, this.height);
      bitmap.pixels.set(this.pixels);
      return bitmap;
    }
  };
  function rgba2(width, height, initial) {
    return new RGBABitmap(width, height, initial);
  }
  function indexed(width, height, bpp, initial) {
    return new IndexedBitmap(width, height, bpp, initial);
  }
  function decode2(arr, fmt) {
    var pixels = convertWordsToImages(arr, fmt);
    let bpp = (fmt.bpp || 1) * (fmt.np || 1);
    return pixels.map((data3) => new IndexedBitmap(fmt.w, fmt.h, bpp, data3));
  }
  function analyze(bitmaps) {
    bitmaps = coerceToArray(bitmaps);
    let r = { min: { w: 0, h: 0 }, max: { w: 0, h: 0 } };
    for (let bmp of bitmaps) {
      if (!(bmp instanceof AbstractBitmap))
        return null;
      r.min.w = Math.min(bmp.width);
      r.max.w = Math.max(bmp.width);
      r.min.h = Math.min(bmp.height);
      r.max.h = Math.max(bmp.height);
    }
    return r;
  }
  function montage(bitmaps, options) {
    bitmaps = coerceToArray(bitmaps);
    let minmax = options && options.analysis || analyze(bitmaps);
    if (minmax == null)
      throw new Error(`Expected an array of bitmaps`);
    let hitrects = [];
    let aspect = options && options.aspect || 1;
    let gap = options && options.gap || 0;
    if (minmax.min.w == minmax.max.w && minmax.min.h == minmax.max.h) {
      let totalPixels = minmax.min.w * minmax.min.h * bitmaps.length;
      let factors = findIntegerFactors(totalPixels, minmax.max.w, minmax.max.h, aspect);
      let columns = Math.ceil(factors.a / minmax.min.w);
      let rows = Math.ceil(factors.b / minmax.min.h);
      let result = new RGBABitmap(factors.a + gap * (columns - 1), factors.b + gap * (rows - 1));
      let x = 0;
      let y = 0;
      bitmaps.forEach((bmp) => {
        result.blit(bmp, x, y, 0, 0);
        hitrects.push({ x, y, w: bmp.width, h: bmp.height });
        x += bmp.width + gap;
        if (x >= result.width) {
          x = 0;
          y += bmp.height + gap;
        }
      });
      return result;
    } else {
      throw new Error(`combine() only supports uniformly-sized images right now`);
    }
  }
  var png;
  (function(png2) {
    function read2(url) {
      return decode3(readbin(url));
    }
    png2.read = read2;
    function decode3(data3) {
      let png3 = decodePNG(data3);
      return convertToBitmap(png3);
    }
    png2.decode = decode3;
    function convertToBitmap(png3) {
      if (png3.palette && png3.depth <= 8) {
        return convertIndexedToBitmap(png3);
      } else {
        return convertRGBAToBitmap(png3);
      }
    }
    function convertIndexedToBitmap(png3) {
      var palarr = png3.palette;
      var palette2 = new Palette(palarr);
      let bitmap = new IndexedBitmap(png3.width, png3.height, png3.depth);
      if (png3.depth == 8) {
        bitmap.pixels.set(png3.data);
      } else {
        let pixperbyte = Math.floor(8 / png3.depth);
        let mask = (1 << png3.depth) - 1;
        for (let i = 0; i < bitmap.pixels.length; i++) {
          var bofs = i % pixperbyte * png3.depth;
          let val = png3.data[Math.floor(i / pixperbyte)];
          bitmap.pixels[i] = val >> bofs & mask;
        }
      }
      bitmap.palette = palette2;
      return bitmap;
    }
    function convertRGBAToBitmap(png3) {
      const bitmap = new RGBABitmap(png3.width, png3.height);
      const rgba3 = [0, 0, 0, 0];
      for (let i = 0; i < bitmap.rgba.length; i++) {
        for (let j = 0; j < 4; j++)
          rgba3[j] = png3.data[i * 4 + j];
        bitmap.rgba[i] = rgba(rgba3);
      }
      return bitmap;
    }
  })(png || (png = {}));
  var font;
  (function(font2) {
    class Glyph extends IndexedBitmap {
      constructor(width, height, bpp, code, yoffset) {
        super(width, height, bpp);
        this.code = code;
        this.yoffset = yoffset;
      }
    }
    function read2(url) {
      if (url.endsWith(".yaff"))
        return decodeyafflines(readlines(url));
      if (url.endsWith(".draw"))
        return decodedrawlines(readlines(url));
      throw new Error(`Can't figure out font format for "${url}"`);
    }
    font2.read = read2;
    function decodeglyph(glines, curcode, yoffset) {
      let width = 0;
      for (var gline of glines)
        width = Math.max(width, gline.length);
      let g = new Glyph(width, glines.length, 1, curcode, yoffset);
      for (var y = 0; y < glines.length; y++) {
        let gline2 = glines[y];
        for (var x = 0; x < gline2.length; x++) {
          let ch = gline2[x];
          g.set(x, y, ch === "@" || ch === "#" ? 1 : 0);
        }
      }
      return g;
    }
    font2.decodeglyph = decodeglyph;
    function decodeyafflines(lines) {
      let maxheight = 0;
      let properties = {};
      let glyphs = {};
      let yoffset = 0;
      let curcode = -1;
      let curglyph = [];
      const re_prop = /^([\w-]+):\s+(.+)/i;
      const re_label = /^0x([0-9a-f]+):|u[+]([0-9a-f]+):|(\w+):/i;
      const re_gline = /^\s+([.@]+)/;
      function addfont() {
        if (curcode >= 0 && curglyph.length) {
          glyphs[curcode] = decodeglyph(curglyph, curcode, yoffset);
          curcode = -1;
          curglyph = [];
        }
      }
      for (let line of lines) {
        let m;
        if (m = re_prop.exec(line)) {
          properties[m[1]] = m[2];
          if (m[1] === "bottom")
            yoffset = parseInt(m[2]);
          if (m[1] === "size")
            maxheight = parseInt(m[2]);
        } else if (m = re_label.exec(line)) {
          addfont();
          if (m[1] != null)
            curcode = parseInt(m[1], 16);
          else if (m[2] != null)
            curcode = parseInt(m[2], 16);
          else if (m[3] != null)
            curcode = null;
        } else if (m = re_gline.exec(line)) {
          curglyph.push(m[1]);
        }
        if (isNaN(curcode + yoffset + maxheight))
          throw new Error(`couldn't decode .yaff: ${JSON.stringify(line)}`);
      }
      addfont();
      return { maxheight, properties, glyphs };
    }
    font2.decodeyafflines = decodeyafflines;
    function decodedrawlines(lines) {
      let maxheight = 0;
      let properties = {};
      let glyphs = {};
      let curcode = -1;
      let curglyph = [];
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
        let m;
        if (m = re_gline.exec(line)) {
          if (m[1] != null) {
            addfont();
            curcode = parseInt(m[1], 16);
            if (isNaN(curcode))
              throw new Error(`couldn't decode .draw: ${JSON.stringify(line)}`);
          }
          curglyph.push(m[2]);
        }
      }
      addfont();
      return { maxheight, properties, glyphs };
    }
    font2.decodedrawlines = decodedrawlines;
  })(font || (font = {}));
  function remapBits(x, arr) {
    if (!arr)
      return x;
    var y = 0;
    for (var i = 0; i < arr.length; i++) {
      var s = arr[i];
      if (s < 0) {
        s = -s - 1;
        y ^= 1 << s;
      }
      if (x & 1 << i) {
        y ^= 1 << s;
      }
    }
    return y;
  }
  function convertWordsToImages(words, fmt) {
    var width = fmt.w;
    var height = fmt.h;
    var count = fmt.count || 1;
    var bpp = fmt.bpp || 1;
    var nplanes = fmt.np || 1;
    var bitsperword = fmt.bpw || 8;
    var wordsperline = fmt.sl || Math.ceil(width * bpp / bitsperword);
    var mask = (1 << bpp) - 1;
    var pofs = fmt.pofs || wordsperline * height * count;
    var skip = fmt.skip || 0;
    var images = [];
    for (var n2 = 0; n2 < count; n2++) {
      var imgdata = [];
      for (var y = 0; y < height; y++) {
        var yp = fmt.flip ? height - 1 - y : y;
        var ofs0 = n2 * wordsperline * height + yp * wordsperline;
        var shift = 0;
        for (var x = 0; x < width; x++) {
          var color2 = 0;
          var ofs = remapBits(ofs0, fmt.remap);
          for (var p = 0; p < nplanes; p++) {
            var byte = words[ofs + p * pofs + skip];
            color2 |= ((fmt.brev ? byte >> bitsperword - shift - bpp : byte >> shift) & mask) << p * bpp;
          }
          imgdata.push(color2);
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

  // src/common/script/lib/output.ts
  var output_exports = {};
  __export(output_exports, {
    COutputFile: () => COutputFile,
    OutputFile: () => OutputFile,
    file: () => file
  });
  var DataType;
  (function(DataType2) {
    DataType2[DataType2["unknown"] = 0] = "unknown";
    DataType2[DataType2["u8"] = 1] = "u8";
    DataType2[DataType2["s8"] = 2] = "s8";
    DataType2[DataType2["u16"] = 3] = "u16";
    DataType2[DataType2["s16"] = 4] = "s16";
    DataType2[DataType2["u32"] = 5] = "u32";
    DataType2[DataType2["s32"] = 6] = "s32";
    DataType2[DataType2["f32"] = 7] = "f32";
    DataType2[DataType2["f64"] = 8] = "f64";
  })(DataType || (DataType = {}));
  function getArrayDataType(value) {
    if (value instanceof Uint8Array) {
      return 1;
    } else if (value instanceof Int8Array) {
      return 2;
    } else if (value instanceof Uint16Array) {
      return 3;
    } else if (value instanceof Int16Array) {
      return 4;
    } else if (value instanceof Uint32Array) {
      return 5;
    } else if (value instanceof Int32Array) {
      return 6;
    } else if (value instanceof Float32Array) {
      return 7;
    } else if (value instanceof Float64Array) {
      return 8;
    }
  }
  var OutputFile = class {
    constructor(path, decls) {
      this.path = path;
      this.decls = decls;
    }
    toString() {
      return Object.entries(this.decls).map((entry) => this.declToText(entry[0], entry[1])).join("\n\n");
    }
  };
  var COutputFile = class extends OutputFile {
    toString() {
      return `#include <stdint.h>

${super.toString()}
`;
    }
    dataTypeToString(dtype) {
      switch (dtype) {
        case 1:
          return "uint8_t";
        case 2:
          return "int8_t";
        case 3:
          return "uint16_t";
        case 4:
          return "int16_t";
        case 5:
          return "uint32_t";
        case 6:
          return "int32_t";
        case 7:
          return "float";
        case 8:
          return "double";
        default:
          throw new Error("Cannot convert data type");
      }
    }
    valueToString(value, atype) {
      return value + "";
    }
    declToText(label, value) {
      if (Array.isArray(value) || value["BYTES_PER_ELEMENT"]) {
        let atype = getArrayDataType(value);
        if (atype != null) {
          let dtypestr = this.dataTypeToString(atype);
          let dtext = value.map((elem) => this.valueToString(elem, atype)).join(",");
          let len = value.length;
          return `${dtypestr} ${label}[${len}] = { ${dtext} };`;
        }
      }
      throw new Error(`Cannot convert array "${label}"`);
    }
  };
  function file(path, decls) {
    return new COutputFile(path, decls);
  }

  // src/common/script/lib/scriptui.ts
  var scriptui_exports = {};
  __export(scriptui_exports, {
    EVENT_KEY: () => EVENT_KEY,
    InteractionRecord: () => InteractionRecord,
    ScriptUIButton: () => ScriptUIButton,
    ScriptUIButtonType: () => ScriptUIButtonType,
    ScriptUISelect: () => ScriptUISelect,
    ScriptUISelectType: () => ScriptUISelectType,
    ScriptUIShortcut: () => ScriptUIShortcut,
    ScriptUISlider: () => ScriptUISlider,
    ScriptUISliderType: () => ScriptUISliderType,
    ScriptUIToggle: () => ScriptUIToggle,
    button: () => button,
    interact: () => interact,
    isInteractive: () => isInteractive,
    key: () => key,
    select: () => select,
    slider: () => slider,
    toggle: () => toggle
  });
  var $$seq = 0;
  var EVENT_KEY = "$$event";
  var InteractionRecord = class {
    constructor(interacttarget, $$callback) {
      this.$$callback = $$callback;
      this.lastevent = null;
      this.interacttarget = interacttarget || this;
      this.interactid = ++$$seq;
    }
    $$setstate(newstate) {
      this.interactid = newstate.interactid;
      this.interacttarget.$$interact = this;
      let event = data2.get(EVENT_KEY);
      if (event && event.interactid == this.interactid) {
        if (this.$$callback) {
          this.$$callback(event);
        }
        this.lastevent = event;
        data2.set(EVENT_KEY, null);
      }
      this.$$callback = null;
    }
    $$getstate() {
      this.$$callback = null;
      return { interactid: this.interactid };
    }
  };
  function isInteractive(obj) {
    return !!obj.$$interact;
  }
  function interact(object, callback) {
    if (typeof object === "object") {
      return new InteractionRecord(object, callback);
    }
    throw new Error(`This object is not capable of interaction.`);
  }
  var ScriptUISliderType = class {
    constructor(min, max, step) {
      this.min = min;
      this.max = max;
      this.step = step;
      this.uitype = "slider";
      this.value = min;
    }
  };
  var ScriptUISlider = class extends ScriptUISliderType {
    initial(value) {
      this.value = value;
      return this;
    }
    $$getstate() {
      return { value: this.value };
    }
  };
  function slider(min, max, step) {
    return new ScriptUISlider(min, max, step || 1);
  }
  var ScriptUISelectType = class {
    constructor(options) {
      this.options = options;
      this.uitype = "select";
      this.index = 0;
      this.value = this.options[this.index];
    }
  };
  var ScriptUISelect = class extends ScriptUISelectType {
    initial(index) {
      this.index = index;
      this.value = this.options[index];
      return this;
    }
    $$getstate() {
      return { value: this.value, index: this.index };
    }
  };
  function select(options) {
    return new ScriptUISelect(options);
  }
  var ScriptUIButtonType = class extends InteractionRecord {
    constructor(label, callback) {
      super(null, callback);
      this.label = label;
      this.uitype = "button";
      this.$$interact = this;
    }
  };
  var ScriptUIButton = class extends ScriptUIButtonType {
  };
  function button(name, callback) {
    return new ScriptUIButton(name, callback);
  }
  var ScriptUIToggle = class extends ScriptUIButton {
    $$getstate() {
      let state = super.$$getstate();
      state.enabled = this.enabled;
      return state;
    }
    $$setstate(newstate) {
      this.enabled = newstate.enabled;
      super.$$setstate(newstate);
    }
  };
  function toggle(name) {
    return new ScriptUIToggle(name, function(e) {
      this.enabled = !this.enabled;
    });
  }
  var ScriptUIShortcut = class extends InteractionRecord {
    constructor(key2, callback) {
      super(null, callback);
      this.key = key2;
      this.uitype = "shortcut";
      this.$$interact = this;
    }
  };
  function key(key2, callback) {
    return new ScriptUIShortcut(key2, callback);
  }

  // src/common/script/env.ts
  var ErrorStackParser = require_error_stack_parser();
  var PROP_CONSTRUCTOR_NAME = "$$consname";
  var IMPORTS = {
    "bitmap": bitmap_exports,
    "io": io_exports,
    "output": output_exports,
    "color": color_exports,
    "ui": scriptui_exports
  };
  var LINE_NUMBER_OFFSET = 3;
  var GLOBAL_BADLIST = [
    "eval"
  ];
  var GLOBAL_GOODLIST = [
    "eval",
    "Math",
    "JSON",
    "parseFloat",
    "parseInt",
    "isFinite",
    "isNaN",
    "String",
    "Symbol",
    "Number",
    "Object",
    "Boolean",
    "NaN",
    "Infinity",
    "Date",
    "BigInt",
    "Set",
    "Map",
    "RegExp",
    "Array",
    "ArrayBuffer",
    "DataView",
    "Float32Array",
    "Float64Array",
    "Int8Array",
    "Int16Array",
    "Int32Array",
    "Uint8Array",
    "Uint16Array",
    "Uint32Array",
    "Uint8ClampedArray"
  ];
  var RuntimeError = class extends Error {
    constructor(loc, msg) {
      super(msg);
      this.loc = loc;
    }
  };
  function setConstructorName(o) {
    var _a, _b;
    let name = (_b = (_a = Object.getPrototypeOf(o)) == null ? void 0 : _a.constructor) == null ? void 0 : _b.name;
    if (name != null && name != "Object") {
      o[PROP_CONSTRUCTOR_NAME] = name;
    }
  }
  var Environment = class {
    constructor(globalenv, path) {
      this.globalenv = globalenv;
      this.path = path;
      var badlst = Object.getOwnPropertyNames(this.globalenv).filter((name) => GLOBAL_GOODLIST.indexOf(name) < 0);
      this.builtins = __spreadValues({
        print: (...args) => this.print(args)
      }, IMPORTS);
      this.preamble = `'use strict';var ${badlst.join(",")};`;
      for (var impname in this.builtins) {
        this.preamble += `var ${impname}=$$.${impname};`;
      }
      this.preamble += "{\n";
      this.postamble = "\n}";
    }
    error(varname, msg) {
      let obj = this.declvars && this.declvars[varname];
      console.log("ERROR", varname, obj, this);
      throw new RuntimeError(obj && obj.loc, msg);
    }
    print(args) {
      if (args && args.length > 0 && args[0] != null) {
        this.obj[`$print__${this.seq++}`] = args.length == 1 ? args[0] : args;
      }
    }
    preprocess(code) {
      this.declvars = {};
      this.seq = 0;
      let options = {
        sourceMap: {
          file: this.path,
          source: this.path,
          hires: false,
          includeContent: false
        },
        acorn: {
          ecmaVersion: 6,
          locations: true,
          allowAwaitOutsideFunction: true,
          allowReturnOutsideFunction: true,
          allowReserved: true
        }
      };
      const result = yufka_esm_default(code, options, (node, { update: update2, source: source2, parent: parent2 }) => {
        const isTopLevel = () => {
          return parent2() && parent2().type === "ExpressionStatement" && parent2(2) && parent2(2).type === "Program";
        };
        const convertTopToPrint = () => {
          if (isTopLevel()) {
            let printkey = `$print__${this.seq++}`;
            update2(`this.${printkey} = io.data.load(${source2()}, ${JSON.stringify(printkey)})`);
          }
        };
        const left = node["left"];
        switch (node.type) {
          case "Program":
            update2(`${this.preamble}${source2()}${this.postamble}`);
            break;
          case "Identifier":
            if (GLOBAL_BADLIST.indexOf(source2()) >= 0) {
              update2(`__FORBIDDEN__KEYWORD__${source2()}__`);
            } else {
              convertTopToPrint();
            }
            break;
          case "AssignmentExpression":
            if (isTopLevel()) {
              if (left && left.type === "Identifier") {
                if (!this.declvars[left.name]) {
                  update2(`var ${left.name}=io.data.load(this.${source2()}, ${JSON.stringify(left.name)})`);
                  this.declvars[left.name] = left;
                } else {
                  update2(`${left.name}=this.${source2()}`);
                }
              }
            }
            break;
          case "UnaryExpression":
          case "BinaryExpression":
          case "CallExpression":
          case "MemberExpression":
            convertTopToPrint();
            break;
          case "Literal":
            if (typeof node["value"] === "string" && isTopLevel()) {
              update2(`this.$doc__${this.seq++} = { literaltext: ${source2()} };`);
            } else {
              convertTopToPrint();
            }
            break;
        }
      });
      return result.toString();
    }
    async run(code) {
      code = this.preprocess(code);
      this.obj = {};
      const AsyncFunction = Object.getPrototypeOf(async function() {
      }).constructor;
      const fn = new AsyncFunction("$$", code).bind(this.obj, this.builtins);
      await fn.call(this);
      this.checkResult(this.obj, new Set(), []);
    }
    checkResult(o, checked, fullkey) {
      if (o == null)
        return;
      if (checked.has(o))
        return;
      if (typeof o === "object") {
        let prkey = function() {
          return fullkey.join(".");
        };
        setConstructorName(o);
        delete o.$$callback;
        if (o.length > 100)
          return;
        if (o.BYTES_PER_ELEMENT > 0)
          return;
        checked.add(o);
        for (var [key2, value] of Object.entries(o)) {
          if (value == null && fullkey.length == 0 && !key2.startsWith("$")) {
            this.error(key2, `"${key2}" has no value.`);
          }
          fullkey.push(key2);
          if (typeof value === "function") {
            if (fullkey.length == 1)
              this.error(fullkey[0], `"${prkey()}" is a function. Did you forget to pass parameters?`);
            else
              this.error(fullkey[0], `This expression may be incomplete, or it contains a function object: ${prkey()}`);
          }
          if (typeof value === "symbol") {
            this.error(fullkey[0], `"${prkey()}" is a Symbol, and can't be used.`);
          }
          if (value instanceof Promise) {
            this.error(fullkey[0], `"${prkey()}" is unresolved. Use "await" before expression.`);
          }
          this.checkResult(value, checked, fullkey);
          fullkey.pop();
        }
      }
    }
    render() {
      var cells = [];
      for (var [key2, value] of Object.entries(this.obj)) {
        if (typeof value === "function") {
        } else {
          var cell = { id: key2, object: value };
          cells.push(cell);
        }
      }
      return cells;
    }
    extractErrors(e) {
      let loc = e["loc"];
      if (loc && loc.start && loc.end) {
        return [{
          path: this.path,
          msg: e.message,
          line: loc.start.line,
          start: loc.start.column,
          end: loc.end.line
        }];
      }
      if (loc && loc.line != null) {
        return [{
          path: this.path,
          msg: e.message,
          line: loc.line,
          start: loc.column
        }];
      }
      let frames = ErrorStackParser.parse(e);
      let frame = frames.findIndex((f) => f.functionName === "anonymous");
      let errors = [];
      if (frame < 0 && e.stack != null) {
        let m = /.anonymous.:(\d+):(\d+)/g.exec(e.stack);
        if (m != null) {
          errors.push({
            path: this.path,
            msg: e.message,
            line: parseInt(m[1]) - LINE_NUMBER_OFFSET
          });
        }
      }
      while (frame >= 0) {
        console.log(frames[frame]);
        if (frames[frame].fileName.endsWith("Function")) {
          errors.push({
            path: this.path,
            msg: e.message,
            line: frames[frame].lineNumber - LINE_NUMBER_OFFSET
          });
        }
        --frame;
      }
      if (errors.length == 0) {
        errors.push({
          path: this.path,
          msg: e.message,
          line: 0
        });
      }
      return errors;
    }
    commitLoadableState() {
      for (let [key2, value] of Object.entries(this.obj)) {
        let loadable = value;
        data2.save(loadable, key2);
      }
      return $$getData();
    }
  };

  // src/ide/project.ts
  var import_localforage = __toModule(require_localforage());
  function createNewPersistentStore(storeid) {
    var store2 = import_localforage.default.createInstance({
      name: "__" + storeid,
      version: 2
    });
    return store2;
  }

  // src/worker/tools/script.ts
  var environments = {};
  function getEnv(path) {
    var env = environments[path];
    if (!env) {
      env = environments[path] = new Environment(emglobal, path);
    }
    return env;
  }
  async function runJavascript(step) {
    var env = getEnv(step.path);
    var code = store.getFileAsString(step.path);
    var lstore = createNewPersistentStore(step.platform + "//items");
    const itemskey = step.path;
    if (store.items == null) {
      store.items = await lstore.getItem(itemskey) || {};
      console.log(store.items);
    }
    $$setupFS(store);
    $$loadData(store.items);
    try {
      await env.run(code);
      let cells = env.render();
      let state = env.commitLoadableState();
      let output = { cells, state };
      lstore.setItem(itemskey, state);
      store.items = state;
      return { output };
    } catch (e) {
      console.log(e);
      return { errors: env.extractErrors(e) };
    } finally {
      $$setupFS(null);
    }
  }

  // src/worker/workermain.ts
  var ENVIRONMENT_IS_WEB = typeof window === "object";
  var ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
  var emglobal = ENVIRONMENT_IS_WORKER ? self : ENVIRONMENT_IS_WEB ? window : global;
  if (!emglobal["require"]) {
    emglobal["require"] = (modpath) => {
      if (modpath.endsWith(".js"))
        modpath = modpath.slice(-3);
      var modname = modpath.split("/").slice(-1)[0];
      var hasNamespace = emglobal[modname] != null;
      console.log("@@@ require", modname, modpath, hasNamespace);
      if (!hasNamespace) {
        exports = {};
        importScripts(`${modpath}.js`);
      }
      if (emglobal[modname] == null) {
        emglobal[modname] = exports;
      }
      return emglobal[modname];
    };
  }
  var _WASM_module_cache = {};
  var CACHE_WASM_MODULES = true;
  var wasmMemory;
  function getWASMMemory() {
    if (wasmMemory == null) {
      wasmMemory = new WebAssembly.Memory({
        "initial": 1024,
        "maximum": 16384
      });
    }
    return wasmMemory;
  }
  function getWASMModule(module_id) {
    var module2 = _WASM_module_cache[module_id];
    if (!module2) {
      starttime();
      module2 = new WebAssembly.Module(wasmBlob[module_id]);
      if (CACHE_WASM_MODULES) {
        _WASM_module_cache[module_id] = module2;
        delete wasmBlob[module_id];
      }
      endtime("module creation " + module_id);
    }
    return module2;
  }
  function moduleInstFn(module_id) {
    return function(imports, ri) {
      var mod = getWASMModule(module_id);
      var inst = new WebAssembly.Instance(mod, imports);
      ri(inst);
      return inst.exports;
    };
  }
  var PLATFORM_PARAMS = {
    "vcs": {
      arch: "6502",
      code_start: 4096,
      code_size: 61440,
      data_start: 128,
      data_size: 128,
      wiz_rom_ext: ".a26",
      wiz_inc_dir: "2600",
      extra_link_files: ["atari2600.cfg"],
      cfgfile: "atari2600.cfg"
    },
    "mw8080bw": {
      arch: "z80",
      code_start: 0,
      rom_size: 8192,
      data_start: 8192,
      data_size: 1024,
      stack_end: 9216
    },
    "vicdual": {
      arch: "z80",
      code_start: 0,
      rom_size: 16416,
      data_start: 58368,
      data_size: 1024,
      stack_end: 59392
    },
    "galaxian": {
      arch: "z80",
      code_start: 0,
      rom_size: 16384,
      data_start: 16384,
      data_size: 1024,
      stack_end: 18432
    },
    "galaxian-scramble": {
      arch: "z80",
      code_start: 0,
      rom_size: 20512,
      data_start: 16384,
      data_size: 1024,
      stack_end: 18432
    },
    "williams": {
      arch: "6809",
      code_start: 0,
      rom_size: 49152,
      data_start: 38912,
      data_size: 10240,
      stack_end: 49152,
      set_stack_end: 49152,
      extra_link_files: ["williams.scr", "libcmoc-crt-vec.a", "libcmoc-std-vec.a"],
      extra_link_args: ["-swilliams.scr", "-lcmoc-crt-vec", "-lcmoc-std-vec"],
      extra_compile_files: ["assert.h", "cmoc.h", "stdarg.h", "stdlib.h"]
    },
    "williams-defender": {
      arch: "6809",
      code_start: 0,
      rom_size: 49152,
      data_start: 38912,
      data_size: 10240,
      stack_end: 49152
    },
    "williams-z80": {
      arch: "z80",
      code_start: 0,
      rom_size: 38912,
      data_start: 38912,
      data_size: 10240,
      stack_end: 49152
    },
    "vector-z80color": {
      arch: "z80",
      code_start: 0,
      rom_size: 32768,
      data_start: 57344,
      data_size: 8192,
      stack_end: 0
    },
    "vector-ataricolor": {
      arch: "6502",
      define: ["__VECTOR__"],
      cfgfile: "vector-color.cfg",
      libargs: ["crt0.o", "none.lib"],
      extra_link_files: ["crt0.o", "vector-color.cfg"]
    },
    "sound_williams-z80": {
      arch: "z80",
      code_start: 0,
      rom_size: 16384,
      data_start: 16384,
      data_size: 1024,
      stack_end: 32768
    },
    "base_z80": {
      arch: "z80",
      code_start: 0,
      rom_size: 32768,
      data_start: 32768,
      data_size: 32768,
      stack_end: 0
    },
    "coleco": {
      arch: "z80",
      rom_start: 32768,
      code_start: 33024,
      rom_size: 32768,
      data_start: 28672,
      data_size: 1024,
      stack_end: 32768,
      extra_preproc_args: ["-I", "/share/include/coleco", "-D", "CV_CV"],
      extra_link_args: ["-k", "/share/lib/coleco", "-l", "libcv", "-l", "libcvu", "crt0.rel"]
    },
    "msx": {
      arch: "z80",
      rom_start: 16384,
      code_start: 16384,
      rom_size: 32768,
      data_start: 49152,
      data_size: 12288,
      stack_end: 65535,
      extra_link_args: ["crt0-msx.rel"],
      extra_link_files: ["crt0-msx.rel", "crt0-msx.lst"],
      wiz_sys_type: "z80",
      wiz_inc_dir: "msx"
    },
    "msx-libcv": {
      arch: "z80",
      rom_start: 16384,
      code_start: 16384,
      rom_size: 32768,
      data_start: 49152,
      data_size: 12288,
      stack_end: 65535,
      extra_preproc_args: ["-I", ".", "-D", "CV_MSX"],
      extra_link_args: ["-k", ".", "-l", "libcv-msx", "-l", "libcvu-msx", "crt0-msx.rel"],
      extra_link_files: ["libcv-msx.lib", "libcvu-msx.lib", "crt0-msx.rel", "crt0-msx.lst"],
      extra_compile_files: ["cv.h", "cv_graphics.h", "cv_input.h", "cv_sound.h", "cv_support.h", "cvu.h", "cvu_c.h", "cvu_compression.h", "cvu_f.h", "cvu_graphics.h", "cvu_input.h", "cvu_sound.h"]
    },
    "sms-sg1000-libcv": {
      arch: "z80",
      rom_start: 0,
      code_start: 256,
      rom_size: 49152,
      data_start: 49152,
      data_size: 1024,
      stack_end: 57344,
      extra_preproc_args: ["-I", ".", "-D", "CV_SMS"],
      extra_link_args: ["-k", ".", "-l", "libcv-sms", "-l", "libcvu-sms", "crt0-sms.rel"],
      extra_link_files: ["libcv-sms.lib", "libcvu-sms.lib", "crt0-sms.rel", "crt0-sms.lst"],
      extra_compile_files: ["cv.h", "cv_graphics.h", "cv_input.h", "cv_sound.h", "cv_support.h", "cvu.h", "cvu_c.h", "cvu_compression.h", "cvu_f.h", "cvu_graphics.h", "cvu_input.h", "cvu_sound.h"]
    },
    "nes": {
      arch: "6502",
      define: ["__NES__"],
      cfgfile: "neslib2.cfg",
      libargs: [
        "crt0.o",
        "nes.lib",
        "neslib2.lib",
        "-D",
        "NES_MAPPER=0",
        "-D",
        "NES_PRG_BANKS=2",
        "-D",
        "NES_CHR_BANKS=1",
        "-D",
        "NES_MIRRORING=0"
      ],
      extra_link_files: ["crt0.o", "neslib2.lib", "neslib2.cfg", "nesbanked.cfg"],
      wiz_rom_ext: ".nes"
    },
    "apple2": {
      arch: "6502",
      define: ["__APPLE2__"],
      cfgfile: "apple2.cfg",
      libargs: ["--lib-path", "/share/target/apple2/drv", "-D", "__EXEHDR__=0", "apple2.lib"],
      __CODE_RUN__: 16384,
      code_start: 2051
    },
    "apple2-e": {
      arch: "6502",
      define: ["__APPLE2__"],
      cfgfile: "apple2.cfg",
      libargs: ["apple2.lib"]
    },
    "atari8-800xl.disk": {
      arch: "6502",
      define: ["__ATARI__"],
      cfgfile: "atari.cfg",
      libargs: ["atari.lib"],
      fastbasic_cfgfile: "fastbasic-cart.cfg"
    },
    "atari8-800xl": {
      arch: "6502",
      define: ["__ATARI__"],
      cfgfile: "atari-cart.cfg",
      libargs: ["atari.lib", "-D", "__CARTFLAGS__=4"],
      fastbasic_cfgfile: "fastbasic-cart.cfg"
    },
    "atari8-5200": {
      arch: "6502",
      define: ["__ATARI5200__"],
      cfgfile: "atari5200.cfg",
      libargs: ["atari5200.lib", "-D", "__CARTFLAGS__=255"],
      fastbasic_cfgfile: "fastbasic-cart.cfg"
    },
    "verilog": {
      arch: "verilog",
      extra_compile_files: ["8bitworkshop.v"]
    },
    "astrocade": {
      arch: "z80",
      code_start: 8192,
      rom_size: 8192,
      data_start: 19984,
      data_size: 496,
      stack_end: 20480
    },
    "astrocade-arcade": {
      arch: "z80",
      code_start: 0,
      rom_size: 16384,
      data_start: 32224,
      data_size: 544,
      stack_end: 32768
    },
    "astrocade-bios": {
      arch: "z80",
      code_start: 0,
      rom_size: 8192,
      data_start: 20430,
      data_size: 50,
      stack_end: 20430
    },
    "atari7800": {
      arch: "6502",
      define: ["__ATARI7800__"],
      cfgfile: "atari7800.cfg",
      libargs: ["crt0.o", "none.lib"],
      extra_link_files: ["crt0.o", "atari7800.cfg"]
    },
    "c64": {
      arch: "6502",
      define: ["__CBM__", "__C64__"],
      cfgfile: "c64.cfg",
      libargs: ["c64.lib"]
    },
    "kim1": {
      arch: "6502"
    },
    "vectrex": {
      arch: "6809",
      code_start: 0,
      rom_size: 32768,
      data_start: 51328,
      data_size: 896,
      stack_end: 52224,
      extra_compile_files: ["assert.h", "cmoc.h", "stdarg.h", "vectrex.h", "stdlib.h", "bios.h"],
      extra_link_files: ["vectrex.scr", "libcmoc-crt-vec.a", "libcmoc-std-vec.a"],
      extra_compile_args: ["--vectrex"],
      extra_link_args: ["-svectrex.scr", "-lcmoc-crt-vec", "-lcmoc-std-vec"]
    },
    "x86": {
      arch: "x86"
    },
    "zx": {
      arch: "z80",
      code_start: 23755,
      rom_size: 65368 - 23755,
      data_start: 61440,
      data_size: 65024 - 61440,
      stack_end: 65368,
      extra_link_args: ["crt0-zx.rel"],
      extra_link_files: ["crt0-zx.rel", "crt0-zx.lst"]
    },
    "devel-6502": {
      arch: "6502",
      cfgfile: "devel-6502.cfg",
      libargs: ["crt0.o", "none.lib"],
      extra_link_files: ["crt0.o", "devel-6502.cfg"]
    },
    "cpc.rslib": {
      arch: "z80",
      code_start: 16384,
      rom_size: 45312 - 16384,
      data_start: 45312,
      data_size: 45312 - 49152,
      stack_end: 49152,
      extra_compile_files: ["cpcrslib.h"],
      extra_link_args: ["crt0-cpc.rel", "cpcrslib.lib"],
      extra_link_files: ["crt0-cpc.rel", "crt0-cpc.lst", "cpcrslib.lib", "cpcrslib.lst"]
    },
    "cpc": {
      arch: "z80",
      code_start: 16384,
      rom_size: 45312 - 16384,
      data_start: 45312,
      data_size: 45312 - 49152,
      stack_end: 49152,
      extra_compile_files: ["cpctelera.h"],
      extra_link_args: ["crt0-cpc.rel", "cpctelera.lib"],
      extra_link_files: ["crt0-cpc.rel", "crt0-cpc.lst", "cpctelera.lib", "cpctelera.lst"]
    }
  };
  PLATFORM_PARAMS["sms-sms-libcv"] = PLATFORM_PARAMS["sms-sg1000-libcv"];
  var _t1;
  function starttime() {
    _t1 = new Date();
  }
  function endtime(msg) {
    var _t2 = new Date();
    console.log(msg, _t2.getTime() - _t1.getTime(), "ms");
  }
  var FileWorkingStore = class {
    constructor() {
      this.workfs = {};
      this.workerseq = 0;
      this.reset();
    }
    reset() {
      this.workfs = {};
      this.newVersion();
    }
    currentVersion() {
      return this.workerseq;
    }
    newVersion() {
      let ts = new Date().getTime();
      if (ts <= this.workerseq)
        ts = ++this.workerseq;
      return ts;
    }
    putFile(path, data3) {
      var encoding = typeof data3 === "string" ? "utf8" : "binary";
      var entry = this.workfs[path];
      if (!entry || !compareData(entry.data, data3) || entry.encoding != encoding) {
        this.workfs[path] = entry = { path, data: data3, encoding, ts: this.newVersion() };
        console.log("+++", entry.path, entry.encoding, entry.data.length, entry.ts);
      }
      return entry;
    }
    hasFile(path) {
      return this.workfs[path] != null;
    }
    getFileData(path) {
      return this.workfs[path] && this.workfs[path].data;
    }
    getFileAsString(path) {
      let data3 = this.getFileData(path);
      if (data3 != null && typeof data3 !== "string")
        throw new Error(`${path}: expected string`);
      return data3;
    }
    getFileEntry(path) {
      return this.workfs[path];
    }
    setItem(key2, value) {
      this.items[key2] = value;
    }
  };
  var store = new FileWorkingStore();
  function errorResult(msg) {
    return { errors: [{ line: 0, msg }] };
  }
  var Builder = class {
    constructor() {
      this.steps = [];
      this.startseq = 0;
    }
    wasChanged(entry) {
      return entry.ts > this.startseq;
    }
    async executeBuildSteps() {
      this.startseq = store.currentVersion();
      var linkstep = null;
      while (this.steps.length) {
        var step = this.steps.shift();
        var platform = step.platform;
        var toolfn = TOOLS[step.tool];
        if (!toolfn)
          throw Error("no tool named " + step.tool);
        step.params = PLATFORM_PARAMS[getBasePlatform(platform)];
        try {
          step.result = await toolfn(step);
        } catch (e) {
          console.log("EXCEPTION", e, e.stack);
          return errorResult(e + "");
        }
        if (step.result) {
          step.result.params = step.params;
          if ("errors" in step.result && step.result.errors.length) {
            applyDefaultErrorPath(step.result.errors, step.path);
            return step.result;
          }
          if ("output" in step.result && step.result.output) {
            return step.result;
          }
          if ("linktool" in step.result) {
            if (linkstep) {
              linkstep.files = linkstep.files.concat(step.result.files);
              linkstep.args = linkstep.args.concat(step.result.args);
            } else {
              linkstep = {
                tool: step.result.linktool,
                platform,
                files: step.result.files,
                args: step.result.args
              };
            }
          }
          if ("nexttool" in step.result) {
            var asmstep = __spreadValues({
              tool: step.result.nexttool,
              platform
            }, step.result);
            this.steps.push(asmstep);
          }
          if (this.steps.length == 0 && linkstep) {
            this.steps.push(linkstep);
            linkstep = null;
          }
        }
      }
    }
    async handleMessage(data3) {
      this.steps = [];
      if (data3.updates) {
        data3.updates.forEach((u) => store.putFile(u.path, u.data));
      }
      if (data3.setitems) {
        data3.setitems.forEach((i) => store.setItem(i.key, i.value));
      }
      if (data3.buildsteps) {
        this.steps.push.apply(this.steps, data3.buildsteps);
      }
      if (data3.code) {
        this.steps.push(data3);
      }
      if (this.steps.length) {
        var result = await this.executeBuildSteps();
        return result ? result : { unchanged: true };
      }
      console.log("Unknown message", data3);
    }
  };
  var builder = new Builder();
  function applyDefaultErrorPath(errors, path) {
    if (!path)
      return;
    for (var i = 0; i < errors.length; i++) {
      var err2 = errors[i];
      if (!err2.path && err2.line)
        err2.path = path;
    }
  }
  function compareData(a, b) {
    if (a.length != b.length)
      return false;
    if (typeof a === "string" && typeof b === "string") {
      return a == b;
    } else {
      for (var i = 0; i < a.length; i++) {
        if (a[i] != b[i])
          return false;
      }
      return true;
    }
  }
  function putWorkFile(path, data3) {
    return store.putFile(path, data3);
  }
  function getWorkFileAsString(path) {
    return store.getFileAsString(path);
  }
  function populateEntry(fs, path, entry, options) {
    var data3 = entry.data;
    if (options && options.processFn) {
      data3 = options.processFn(path, data3);
    }
    var toks = path.split("/");
    if (toks.length > 1) {
      for (var i = 0; i < toks.length - 1; i++)
        try {
          fs.mkdir(toks[i]);
        } catch (e) {
        }
    }
    fs.writeFile(path, data3, { encoding: entry.encoding });
    var time = new Date(entry.ts);
    fs.utime(path, time, time);
    console.log("<<<", path, entry.data.length);
  }
  function gatherFiles(step, options) {
    var maxts = 0;
    if (step.files) {
      for (var i = 0; i < step.files.length; i++) {
        var path = step.files[i];
        var entry = store.workfs[path];
        if (!entry) {
          throw new Error("No entry for path '" + path + "'");
        } else {
          maxts = Math.max(maxts, entry.ts);
        }
      }
    } else if (step.code) {
      var path = step.path ? step.path : options.mainFilePath;
      if (!path)
        throw Error("need path or mainFilePath");
      var code = step.code;
      var entry = putWorkFile(path, code);
      step.path = path;
      step.files = [path];
      maxts = entry.ts;
    } else if (step.path) {
      var path = step.path;
      var entry = store.workfs[path];
      maxts = entry.ts;
      step.files = [path];
    }
    if (step.path && !step.prefix) {
      step.prefix = getPrefix(step.path);
    }
    step.maxts = maxts;
    return maxts;
  }
  function getPrefix(s) {
    var pos = s.lastIndexOf(".");
    return pos > 0 ? s.substring(0, pos) : s;
  }
  function populateFiles(step, fs, options) {
    gatherFiles(step, options);
    if (!step.files)
      throw Error("call gatherFiles() first");
    for (var i = 0; i < step.files.length; i++) {
      var path = step.files[i];
      populateEntry(fs, path, store.workfs[path], options);
    }
  }
  function populateExtraFiles(step, fs, extrafiles) {
    if (extrafiles) {
      for (var i = 0; i < extrafiles.length; i++) {
        var xfn = extrafiles[i];
        if (store.workfs[xfn]) {
          fs.writeFile(xfn, store.workfs[xfn].data, { encoding: "binary" });
          continue;
        }
        var xpath = "lib/" + getBasePlatform(step.platform) + "/" + xfn;
        var xhr = new XMLHttpRequest();
        xhr.responseType = "arraybuffer";
        xhr.open("GET", PWORKER + xpath, false);
        xhr.send(null);
        if (xhr.response && xhr.status == 200) {
          var data3 = new Uint8Array(xhr.response);
          fs.writeFile(xfn, data3, { encoding: "binary" });
          putWorkFile(xfn, data3);
          console.log(":::", xfn, data3.length);
        } else {
          throw Error("Could not load extra file " + xpath);
        }
      }
    }
  }
  function staleFiles(step, targets) {
    if (!step.maxts)
      throw Error("call populateFiles() first");
    for (var i = 0; i < targets.length; i++) {
      var entry = store.workfs[targets[i]];
      if (!entry || step.maxts > entry.ts)
        return true;
    }
    console.log("unchanged", step.maxts, targets);
    return false;
  }
  function anyTargetChanged(step, targets) {
    if (!step.maxts)
      throw Error("call populateFiles() first");
    for (var i = 0; i < targets.length; i++) {
      var entry = store.workfs[targets[i]];
      if (!entry || entry.ts > step.maxts)
        return true;
    }
    console.log("unchanged", step.maxts, targets);
    return false;
  }
  function execMain(step, mod, args) {
    starttime();
    var run = mod.callMain || mod.run;
    run(args);
    endtime(step.tool);
  }
  var fsMeta = {};
  var fsBlob = {};
  var wasmBlob = {};
  var PSRC = "../../src/";
  var PWORKER = PSRC + "worker/";
  function loadFilesystem(name) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = "blob";
    xhr.open("GET", PWORKER + "fs/fs" + name + ".data", false);
    xhr.send(null);
    fsBlob[name] = xhr.response;
    xhr = new XMLHttpRequest();
    xhr.responseType = "json";
    xhr.open("GET", PWORKER + "fs/fs" + name + ".js.metadata", false);
    xhr.send(null);
    fsMeta[name] = xhr.response;
    console.log("Loaded " + name + " filesystem", fsMeta[name].files.length, "files", fsBlob[name].size, "bytes");
  }
  var loaded = {};
  function load(modulename, debug) {
    if (!loaded[modulename]) {
      importScripts(PWORKER + "asmjs/" + modulename + (debug ? "." + debug + ".js" : ".js"));
      loaded[modulename] = 1;
    }
  }
  function loadWASM(modulename, debug) {
    if (!loaded[modulename]) {
      importScripts(PWORKER + "wasm/" + modulename + (debug ? "." + debug + ".js" : ".js"));
      var xhr = new XMLHttpRequest();
      xhr.responseType = "arraybuffer";
      xhr.open("GET", PWORKER + "wasm/" + modulename + ".wasm", false);
      xhr.send(null);
      if (xhr.response) {
        wasmBlob[modulename] = new Uint8Array(xhr.response);
        console.log("Loaded " + modulename + ".wasm (" + wasmBlob[modulename].length + " bytes)");
        loaded[modulename] = 1;
      } else {
        throw Error("Could not load WASM file " + modulename + ".wasm");
      }
    }
  }
  function loadNative(modulename) {
    if (CACHE_WASM_MODULES && typeof WebAssembly === "object") {
      loadWASM(modulename);
    } else {
      load(modulename);
    }
  }
  function setupFS(FS, name) {
    var WORKERFS = FS.filesystems["WORKERFS"];
    if (name === "65-vector")
      name = "65-none";
    if (name === "65-atari7800")
      name = "65-none";
    if (name === "65-devel")
      name = "65-none";
    if (name === "65-vcs")
      name = "65-none";
    if (!fsMeta[name])
      throw Error("No filesystem for '" + name + "'");
    FS.mkdir("/share");
    FS.mount(WORKERFS, {
      packages: [{ metadata: fsMeta[name], blob: fsBlob[name] }]
    }, "/share");
    var reader = WORKERFS.reader;
    var blobcache = {};
    WORKERFS.stream_ops.read = function(stream, buffer, offset2, length3, position) {
      if (position >= stream.node.size)
        return 0;
      var contents = blobcache[stream.path];
      if (!contents) {
        var ab = reader.readAsArrayBuffer(stream.node.contents);
        contents = blobcache[stream.path] = new Uint8Array(ab);
      }
      if (position + length3 > contents.length)
        length3 = contents.length - position;
      for (var i = 0; i < length3; i++) {
        buffer[offset2 + i] = contents[position + i];
      }
      return length3;
    };
  }
  var print_fn = function(s) {
    console.log(s);
  };
  var re_msvc = /[/]*([^( ]+)\s*[(](\d+)[)]\s*:\s*(.+?):\s*(.*)/;
  var re_msvc2 = /\s*(at)\s+(\d+)\s*(:)\s*(.*)/;
  function msvcErrorMatcher(errors) {
    return function(s) {
      var matches = re_msvc.exec(s) || re_msvc2.exec(s);
      if (matches) {
        var errline = parseInt(matches[2]);
        errors.push({
          line: errline,
          path: matches[1],
          msg: matches[4]
        });
      } else {
        console.log(s);
      }
    };
  }
  function makeErrorMatcher(errors, regex, iline, imsg, mainpath, ifilename) {
    return function(s) {
      var matches = regex.exec(s);
      if (matches) {
        errors.push({
          line: parseInt(matches[iline]) || 1,
          msg: matches[imsg],
          path: ifilename ? matches[ifilename] : mainpath
        });
      } else {
        console.log("??? " + s);
      }
    };
  }
  function extractErrors(regex, strings2, path, iline, imsg, ifilename) {
    var errors = [];
    var matcher = makeErrorMatcher(errors, regex, iline, imsg, path, ifilename);
    for (var i = 0; i < strings2.length; i++) {
      matcher(strings2[i]);
    }
    return errors;
  }
  var re_crlf = /\r?\n/;
  var re_lineoffset = /\s*(\d+)\s+[%]line\s+(\d+)\+(\d+)\s+(.+)/;
  function parseListing(code, lineMatch, iline, ioffset, iinsns, icycles, funcMatch, segMatch) {
    var lines = [];
    var lineofs = 0;
    var segment = "";
    var func = "";
    var funcbase = 0;
    code.split(re_crlf).forEach((line, lineindex) => {
      let segm = segMatch && segMatch.exec(line);
      if (segm) {
        segment = segm[1];
      }
      let funcm = funcMatch && funcMatch.exec(line);
      if (funcm) {
        funcbase = parseInt(funcm[1], 16);
        func = funcm[2];
      }
      var linem = lineMatch.exec(line);
      if (linem && linem[1]) {
        var linenum = iline < 0 ? lineindex : parseInt(linem[iline]);
        var offset2 = parseInt(linem[ioffset], 16);
        var insns = linem[iinsns];
        var cycles = icycles ? parseInt(linem[icycles]) : null;
        var iscode = cycles > 0;
        if (insns) {
          lines.push({
            line: linenum + lineofs,
            offset: offset2 - funcbase,
            insns,
            cycles,
            iscode,
            segment,
            func
          });
        }
      } else {
        let m = re_lineoffset.exec(line);
        if (m) {
          lineofs = parseInt(m[2]) - parseInt(m[1]) - parseInt(m[3]);
        }
      }
    });
    return lines;
  }
  function parseSourceLines(code, lineMatch, offsetMatch, funcMatch, segMatch) {
    var lines = [];
    var lastlinenum = 0;
    var segment = "";
    var func = "";
    var funcbase = 0;
    for (var line of code.split(re_crlf)) {
      let segm = segMatch && segMatch.exec(line);
      if (segm) {
        segment = segm[1];
      }
      let funcm = funcMatch && funcMatch.exec(line);
      if (funcm) {
        funcbase = parseInt(funcm[1], 16);
        func = funcm[2];
      }
      var linem = lineMatch.exec(line);
      if (linem && linem[1]) {
        lastlinenum = parseInt(linem[1]);
      } else if (lastlinenum) {
        var linem = offsetMatch.exec(line);
        if (linem && linem[1]) {
          var offset2 = parseInt(linem[1], 16);
          lines.push({
            line: lastlinenum,
            offset: offset2 - funcbase,
            segment,
            func
          });
          lastlinenum = 0;
        }
      }
    }
    return lines;
  }
  function setupStdin(fs, code) {
    var i = 0;
    fs.init(function() {
      return i < code.length ? code.charCodeAt(i++) : null;
    });
  }
  function fixParamsWithDefines(path, params) {
    var libargs = params.libargs;
    if (path && libargs) {
      var code = getWorkFileAsString(path);
      if (code) {
        var oldcfgfile = params.cfgfile;
        var ident2index = {};
        for (var i = 0; i < libargs.length; i++) {
          var toks = libargs[i].split("=");
          if (toks.length == 2) {
            ident2index[toks[0]] = i;
          }
        }
        var re = /^[;]?#define\s+(\w+)\s+(\S+)/gmi;
        var m;
        while (m = re.exec(code)) {
          var ident = m[1];
          var value = m[2];
          var index = ident2index[ident];
          if (index >= 0) {
            libargs[index] = ident + "=" + value;
            console.log("Using libargs", index, libargs[index]);
            if (ident == "NES_MAPPER" && value == "4") {
              params.cfgfile = "nesbanked.cfg";
              console.log("using config file", params.cfgfile);
            }
          } else if (ident == "CFGFILE" && value) {
            params.cfgfile = value;
          } else if (ident == "LIBARGS" && value) {
            params.libargs = value.split(",").filter((s) => {
              return s != "";
            });
            console.log("Using libargs", params.libargs);
          } else if (ident == "CC65_FLAGS" && value) {
            params.extra_compiler_args = value.split(",").filter((s) => {
              return s != "";
            });
            console.log("Using compiler flags", params.extra_compiler_args);
          }
        }
      }
    }
  }
  function makeCPPSafe(s) {
    return s.replace(/[^A-Za-z0-9_]/g, "_");
  }
  function preprocessMCPP(step, filesys) {
    load("mcpp");
    var platform = step.platform;
    var params = PLATFORM_PARAMS[getBasePlatform(platform)];
    if (!params)
      throw Error("Platform not supported: " + platform);
    var errors = [];
    var match_fn = makeErrorMatcher(errors, /<stdin>:(\d+): (.+)/, 1, 2, step.path);
    var MCPP = emglobal.mcpp({
      noInitialRun: true,
      noFSInit: true,
      print: print_fn,
      printErr: match_fn
    });
    var FS = MCPP.FS;
    if (filesys)
      setupFS(FS, filesys);
    populateFiles(step, FS);
    populateExtraFiles(step, FS, params.extra_compile_files);
    var args = [
      "-D",
      "__8BITWORKSHOP__",
      "-D",
      "__SDCC_z80",
      "-D",
      makeCPPSafe(platform.toUpperCase()),
      "-I",
      "/share/include",
      "-Q",
      step.path,
      "main.i"
    ];
    if (step.mainfile) {
      args.unshift.apply(args, ["-D", "__MAIN__"]);
    }
    if (params.extra_preproc_args) {
      args.push.apply(args, params.extra_preproc_args);
    }
    execMain(step, MCPP, args);
    if (errors.length)
      return { errors };
    var iout = FS.readFile("main.i", { encoding: "utf8" });
    iout = iout.replace(/^#line /gm, "\n# ");
    try {
      var errout = FS.readFile("mcpp.err", { encoding: "utf8" });
      if (errout.length) {
        var errors = extractErrors(/([^:]+):(\d+): (.+)/, errout.split("\n"), step.path, 2, 3, 1);
        if (errors.length == 0) {
          errors = errorResult(errout).errors;
        }
        return { errors };
      }
    } catch (e) {
    }
    return { code: iout };
  }
  function setupRequireFunction() {
    var exports2 = {};
    exports2["jsdom"] = {
      JSDOM: function(a, b) {
        this.window = {};
      }
    };
    emglobal["require"] = (modname) => {
      console.log("require", modname, exports2[modname] != null);
      return exports2[modname];
    };
  }
  var TOOLS = {
    "dasm": assembleDASM,
    "cc65": compileCC65,
    "ca65": assembleCA65,
    "ld65": linkLD65,
    "sdasz80": assembleSDASZ80,
    "sdldz80": linkSDLDZ80,
    "sdcc": compileSDCC,
    "xasm6809": assembleXASM6809,
    "cmoc": compileCMOC,
    "lwasm": assembleLWASM,
    "lwlink": linkLWLINK,
    "verilator": compileVerilator,
    "yosys": compileYosys,
    "jsasm": compileJSASMStep,
    "zmac": assembleZMAC,
    "nesasm": assembleNESASM,
    "smlrc": compileSmallerC,
    "yasm": assembleYASM,
    "bataribasic": compileBatariBasic,
    "markdown": translateShowdown,
    "inform6": compileInform6,
    "merlin32": assembleMerlin32,
    "fastbasic": compileFastBasic,
    "basic": compileBASIC,
    "silice": compileSilice,
    "wiz": compileWiz,
    "armips": assembleARMIPS,
    "vasmarm": assembleVASMARM,
    "js": runJavascript
  };
  var TOOL_PRELOADFS = {
    "cc65-apple2": "65-apple2",
    "ca65-apple2": "65-apple2",
    "cc65-c64": "65-c64",
    "ca65-c64": "65-c64",
    "cc65-nes": "65-nes",
    "ca65-nes": "65-nes",
    "cc65-atari8": "65-atari8",
    "ca65-atari8": "65-atari8",
    "cc65-vector": "65-none",
    "ca65-vector": "65-none",
    "cc65-atari7800": "65-none",
    "ca65-atari7800": "65-none",
    "cc65-devel": "65-none",
    "ca65-devel": "65-none",
    "ca65-vcs": "65-none",
    "sdasz80": "sdcc",
    "sdcc": "sdcc",
    "sccz80": "sccz80",
    "bataribasic": "2600basic",
    "inform6": "inform",
    "fastbasic": "65-atari8",
    "silice": "Silice",
    "wiz": "wiz"
  };
  async function handleMessage(data3) {
    if (data3.preload) {
      var fs = TOOL_PRELOADFS[data3.preload];
      if (!fs && data3.platform)
        fs = TOOL_PRELOADFS[data3.preload + "-" + getBasePlatform(data3.platform)];
      if (!fs && data3.platform)
        fs = TOOL_PRELOADFS[data3.preload + "-" + getRootBasePlatform(data3.platform)];
      if (fs && !fsMeta[fs])
        loadFilesystem(fs);
      return;
    }
    if (data3.reset) {
      store.reset();
      return;
    }
    return builder.handleMessage(data3);
  }
  if (ENVIRONMENT_IS_WORKER) {
    lastpromise = null;
    onmessage = async function(e) {
      await lastpromise;
      lastpromise = handleMessage(e.data);
      var result = await lastpromise;
      lastpromise = null;
      if (result) {
        try {
          postMessage(result);
        } catch (e2) {
          console.log(e2);
          postMessage(errorResult(`${e2}`));
        }
      }
    };
  }
  var lastpromise;
})();
/*!
    localForage -- Offline Storage, Improved
    Version 1.10.0
    https://localforage.github.io/localForage
    (c) 2013-2017 Mozilla, Apache License 2.0
*/
/*! pako 2.0.4 https://github.com/nodeca/pako @license (MIT AND Zlib) */
/**
 * chroma.js - JavaScript library for color conversions
 *
 * Copyright (c) 2011-2019, Gregor Aisch
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. The name Gregor Aisch may not be used to endorse or promote products
 * derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL GREGOR AISCH OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * -------------------------------------------------------
 *
 * chroma.js includes colors from colorbrewer2.org, which are released under
 * the following license:
 *
 * Copyright (c) 2002 Cynthia Brewer, Mark Harrower,
 * and The Pennsylvania State University.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied. See the License for the specific
 * language governing permissions and limitations under the License.
 *
 * ------------------------------------------------------
 *
 * Named colors are taken from X11 Color Names.
 * http://www.w3.org/TR/css3-color/#svg-color
 *
 * @preserve
 */
//# sourceMappingURL=bundle.js.map
