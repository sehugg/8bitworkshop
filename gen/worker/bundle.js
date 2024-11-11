(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
  var __reExport = (target, module, desc) => {
    if (module && typeof module === "object" || typeof module === "function") {
      for (let key of __getOwnPropNames(module))
        if (!__hasOwnProp.call(target, key) && key !== "default")
          __defProp(target, key, { get: () => module[key], enumerable: !(desc = __getOwnPropDesc(module, key)) || desc.enumerable });
    }
    return target;
  };
  var __toModule = (module) => {
    return __reExport(__markAsModule(__defProp(module != null ? __create(__getProtoOf(module)) : {}, "default", module && module.__esModule && "default" in module ? { get: () => module.default, enumerable: true } : { value: module, enumerable: true })), module);
  };
  var __accessCheck = (obj, member, msg) => {
    if (!member.has(obj))
      throw TypeError("Cannot " + msg);
  };
  var __privateGet = (obj, member, getter) => {
    __accessCheck(obj, member, "read from private field");
    return getter ? getter.call(obj) : member.get(obj);
  };
  var __privateAdd = (obj, member, value) => {
    if (member.has(obj))
      throw TypeError("Cannot add the same private member more than once");
    member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  };
  var __privateSet = (obj, member, value, setter) => {
    __accessCheck(obj, member, "write to private field");
    setter ? setter.call(obj, value) : member.set(obj, value);
    return value;
  };

  // node_modules/jszip/dist/jszip.min.js
  var require_jszip_min = __commonJS({
    "node_modules/jszip/dist/jszip.min.js"(exports2, module) {
      !function(e) {
        if (typeof exports2 == "object" && typeof module != "undefined")
          module.exports = e();
        else if (typeof define == "function" && define.amd)
          define([], e);
        else {
          (typeof window != "undefined" ? window : typeof global != "undefined" ? global : typeof self != "undefined" ? self : this).JSZip = e();
        }
      }(function() {
        return function s(a, o, h) {
          function u(r, e2) {
            if (!o[r]) {
              if (!a[r]) {
                var t = typeof __require == "function" && __require;
                if (!e2 && t)
                  return t(r, true);
                if (l)
                  return l(r, true);
                var n = new Error("Cannot find module '" + r + "'");
                throw n.code = "MODULE_NOT_FOUND", n;
              }
              var i = o[r] = { exports: {} };
              a[r][0].call(i.exports, function(e3) {
                var t2 = a[r][1][e3];
                return u(t2 || e3);
              }, i, i.exports, s, a, o, h);
            }
            return o[r].exports;
          }
          for (var l = typeof __require == "function" && __require, e = 0; e < h.length; e++)
            u(h[e]);
          return u;
        }({ 1: [function(e, t, r) {
          "use strict";
          var d = e("./utils"), c = e("./support"), p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
          r.encode = function(e2) {
            for (var t2, r2, n, i, s, a, o, h = [], u = 0, l = e2.length, f = l, c2 = d.getTypeOf(e2) !== "string"; u < e2.length; )
              f = l - u, n = c2 ? (t2 = e2[u++], r2 = u < l ? e2[u++] : 0, u < l ? e2[u++] : 0) : (t2 = e2.charCodeAt(u++), r2 = u < l ? e2.charCodeAt(u++) : 0, u < l ? e2.charCodeAt(u++) : 0), i = t2 >> 2, s = (3 & t2) << 4 | r2 >> 4, a = 1 < f ? (15 & r2) << 2 | n >> 6 : 64, o = 2 < f ? 63 & n : 64, h.push(p.charAt(i) + p.charAt(s) + p.charAt(a) + p.charAt(o));
            return h.join("");
          }, r.decode = function(e2) {
            var t2, r2, n, i, s, a, o = 0, h = 0, u = "data:";
            if (e2.substr(0, u.length) === u)
              throw new Error("Invalid base64 input, it looks like a data url.");
            var l, f = 3 * (e2 = e2.replace(/[^A-Za-z0-9+/=]/g, "")).length / 4;
            if (e2.charAt(e2.length - 1) === p.charAt(64) && f--, e2.charAt(e2.length - 2) === p.charAt(64) && f--, f % 1 != 0)
              throw new Error("Invalid base64 input, bad content length.");
            for (l = c.uint8array ? new Uint8Array(0 | f) : new Array(0 | f); o < e2.length; )
              t2 = p.indexOf(e2.charAt(o++)) << 2 | (i = p.indexOf(e2.charAt(o++))) >> 4, r2 = (15 & i) << 4 | (s = p.indexOf(e2.charAt(o++))) >> 2, n = (3 & s) << 6 | (a = p.indexOf(e2.charAt(o++))), l[h++] = t2, s !== 64 && (l[h++] = r2), a !== 64 && (l[h++] = n);
            return l;
          };
        }, { "./support": 30, "./utils": 32 }], 2: [function(e, t, r) {
          "use strict";
          var n = e("./external"), i = e("./stream/DataWorker"), s = e("./stream/Crc32Probe"), a = e("./stream/DataLengthProbe");
          function o(e2, t2, r2, n2, i2) {
            this.compressedSize = e2, this.uncompressedSize = t2, this.crc32 = r2, this.compression = n2, this.compressedContent = i2;
          }
          o.prototype = { getContentWorker: function() {
            var e2 = new i(n.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new a("data_length")), t2 = this;
            return e2.on("end", function() {
              if (this.streamInfo.data_length !== t2.uncompressedSize)
                throw new Error("Bug : uncompressed data size mismatch");
            }), e2;
          }, getCompressedWorker: function() {
            return new i(n.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
          } }, o.createWorkerFrom = function(e2, t2, r2) {
            return e2.pipe(new s()).pipe(new a("uncompressedSize")).pipe(t2.compressWorker(r2)).pipe(new a("compressedSize")).withStreamInfo("compression", t2);
          }, t.exports = o;
        }, { "./external": 6, "./stream/Crc32Probe": 25, "./stream/DataLengthProbe": 26, "./stream/DataWorker": 27 }], 3: [function(e, t, r) {
          "use strict";
          var n = e("./stream/GenericWorker");
          r.STORE = { magic: "\0\0", compressWorker: function() {
            return new n("STORE compression");
          }, uncompressWorker: function() {
            return new n("STORE decompression");
          } }, r.DEFLATE = e("./flate");
        }, { "./flate": 7, "./stream/GenericWorker": 28 }], 4: [function(e, t, r) {
          "use strict";
          var n = e("./utils");
          var o = function() {
            for (var e2, t2 = [], r2 = 0; r2 < 256; r2++) {
              e2 = r2;
              for (var n2 = 0; n2 < 8; n2++)
                e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
              t2[r2] = e2;
            }
            return t2;
          }();
          t.exports = function(e2, t2) {
            return e2 !== void 0 && e2.length ? n.getTypeOf(e2) !== "string" ? function(e3, t3, r2, n2) {
              var i = o, s = n2 + r2;
              e3 ^= -1;
              for (var a = n2; a < s; a++)
                e3 = e3 >>> 8 ^ i[255 & (e3 ^ t3[a])];
              return -1 ^ e3;
            }(0 | t2, e2, e2.length, 0) : function(e3, t3, r2, n2) {
              var i = o, s = n2 + r2;
              e3 ^= -1;
              for (var a = n2; a < s; a++)
                e3 = e3 >>> 8 ^ i[255 & (e3 ^ t3.charCodeAt(a))];
              return -1 ^ e3;
            }(0 | t2, e2, e2.length, 0) : 0;
          };
        }, { "./utils": 32 }], 5: [function(e, t, r) {
          "use strict";
          r.base64 = false, r.binary = false, r.dir = false, r.createFolders = true, r.date = null, r.compression = null, r.compressionOptions = null, r.comment = null, r.unixPermissions = null, r.dosPermissions = null;
        }, {}], 6: [function(e, t, r) {
          "use strict";
          var n = null;
          n = typeof Promise != "undefined" ? Promise : e("lie"), t.exports = { Promise: n };
        }, { lie: 37 }], 7: [function(e, t, r) {
          "use strict";
          var n = typeof Uint8Array != "undefined" && typeof Uint16Array != "undefined" && typeof Uint32Array != "undefined", i = e("pako"), s = e("./utils"), a = e("./stream/GenericWorker"), o = n ? "uint8array" : "array";
          function h(e2, t2) {
            a.call(this, "FlateWorker/" + e2), this._pako = null, this._pakoAction = e2, this._pakoOptions = t2, this.meta = {};
          }
          r.magic = "\b\0", s.inherits(h, a), h.prototype.processChunk = function(e2) {
            this.meta = e2.meta, this._pako === null && this._createPako(), this._pako.push(s.transformTo(o, e2.data), false);
          }, h.prototype.flush = function() {
            a.prototype.flush.call(this), this._pako === null && this._createPako(), this._pako.push([], true);
          }, h.prototype.cleanUp = function() {
            a.prototype.cleanUp.call(this), this._pako = null;
          }, h.prototype._createPako = function() {
            this._pako = new i[this._pakoAction]({ raw: true, level: this._pakoOptions.level || -1 });
            var t2 = this;
            this._pako.onData = function(e2) {
              t2.push({ data: e2, meta: t2.meta });
            };
          }, r.compressWorker = function(e2) {
            return new h("Deflate", e2);
          }, r.uncompressWorker = function() {
            return new h("Inflate", {});
          };
        }, { "./stream/GenericWorker": 28, "./utils": 32, pako: 38 }], 8: [function(e, t, r) {
          "use strict";
          function A(e2, t2) {
            var r2, n2 = "";
            for (r2 = 0; r2 < t2; r2++)
              n2 += String.fromCharCode(255 & e2), e2 >>>= 8;
            return n2;
          }
          function n(e2, t2, r2, n2, i2, s2) {
            var a, o, h = e2.file, u = e2.compression, l = s2 !== O.utf8encode, f = I.transformTo("string", s2(h.name)), c = I.transformTo("string", O.utf8encode(h.name)), d = h.comment, p = I.transformTo("string", s2(d)), m = I.transformTo("string", O.utf8encode(d)), _ = c.length !== h.name.length, g = m.length !== d.length, b = "", v = "", y = "", w = h.dir, k = h.date, x = { crc32: 0, compressedSize: 0, uncompressedSize: 0 };
            t2 && !r2 || (x.crc32 = e2.crc32, x.compressedSize = e2.compressedSize, x.uncompressedSize = e2.uncompressedSize);
            var S = 0;
            t2 && (S |= 8), l || !_ && !g || (S |= 2048);
            var z = 0, C = 0;
            w && (z |= 16), i2 === "UNIX" ? (C = 798, z |= function(e3, t3) {
              var r3 = e3;
              return e3 || (r3 = t3 ? 16893 : 33204), (65535 & r3) << 16;
            }(h.unixPermissions, w)) : (C = 20, z |= function(e3) {
              return 63 & (e3 || 0);
            }(h.dosPermissions)), a = k.getUTCHours(), a <<= 6, a |= k.getUTCMinutes(), a <<= 5, a |= k.getUTCSeconds() / 2, o = k.getUTCFullYear() - 1980, o <<= 4, o |= k.getUTCMonth() + 1, o <<= 5, o |= k.getUTCDate(), _ && (v = A(1, 1) + A(B(f), 4) + c, b += "up" + A(v.length, 2) + v), g && (y = A(1, 1) + A(B(p), 4) + m, b += "uc" + A(y.length, 2) + y);
            var E = "";
            return E += "\n\0", E += A(S, 2), E += u.magic, E += A(a, 2), E += A(o, 2), E += A(x.crc32, 4), E += A(x.compressedSize, 4), E += A(x.uncompressedSize, 4), E += A(f.length, 2), E += A(b.length, 2), { fileRecord: R.LOCAL_FILE_HEADER + E + f + b, dirRecord: R.CENTRAL_FILE_HEADER + A(C, 2) + E + A(p.length, 2) + "\0\0\0\0" + A(z, 4) + A(n2, 4) + f + b + p };
          }
          var I = e("../utils"), i = e("../stream/GenericWorker"), O = e("../utf8"), B = e("../crc32"), R = e("../signature");
          function s(e2, t2, r2, n2) {
            i.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = t2, this.zipPlatform = r2, this.encodeFileName = n2, this.streamFiles = e2, this.accumulate = false, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
          }
          I.inherits(s, i), s.prototype.push = function(e2) {
            var t2 = e2.meta.percent || 0, r2 = this.entriesCount, n2 = this._sources.length;
            this.accumulate ? this.contentBuffer.push(e2) : (this.bytesWritten += e2.data.length, i.prototype.push.call(this, { data: e2.data, meta: { currentFile: this.currentFile, percent: r2 ? (t2 + 100 * (r2 - n2 - 1)) / r2 : 100 } }));
          }, s.prototype.openedSource = function(e2) {
            this.currentSourceOffset = this.bytesWritten, this.currentFile = e2.file.name;
            var t2 = this.streamFiles && !e2.file.dir;
            if (t2) {
              var r2 = n(e2, t2, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
              this.push({ data: r2.fileRecord, meta: { percent: 0 } });
            } else
              this.accumulate = true;
          }, s.prototype.closedSource = function(e2) {
            this.accumulate = false;
            var t2 = this.streamFiles && !e2.file.dir, r2 = n(e2, t2, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
            if (this.dirRecords.push(r2.dirRecord), t2)
              this.push({ data: function(e3) {
                return R.DATA_DESCRIPTOR + A(e3.crc32, 4) + A(e3.compressedSize, 4) + A(e3.uncompressedSize, 4);
              }(e2), meta: { percent: 100 } });
            else
              for (this.push({ data: r2.fileRecord, meta: { percent: 0 } }); this.contentBuffer.length; )
                this.push(this.contentBuffer.shift());
            this.currentFile = null;
          }, s.prototype.flush = function() {
            for (var e2 = this.bytesWritten, t2 = 0; t2 < this.dirRecords.length; t2++)
              this.push({ data: this.dirRecords[t2], meta: { percent: 100 } });
            var r2 = this.bytesWritten - e2, n2 = function(e3, t3, r3, n3, i2) {
              var s2 = I.transformTo("string", i2(n3));
              return R.CENTRAL_DIRECTORY_END + "\0\0\0\0" + A(e3, 2) + A(e3, 2) + A(t3, 4) + A(r3, 4) + A(s2.length, 2) + s2;
            }(this.dirRecords.length, r2, e2, this.zipComment, this.encodeFileName);
            this.push({ data: n2, meta: { percent: 100 } });
          }, s.prototype.prepareNextSource = function() {
            this.previous = this._sources.shift(), this.openedSource(this.previous.streamInfo), this.isPaused ? this.previous.pause() : this.previous.resume();
          }, s.prototype.registerPrevious = function(e2) {
            this._sources.push(e2);
            var t2 = this;
            return e2.on("data", function(e3) {
              t2.processChunk(e3);
            }), e2.on("end", function() {
              t2.closedSource(t2.previous.streamInfo), t2._sources.length ? t2.prepareNextSource() : t2.end();
            }), e2.on("error", function(e3) {
              t2.error(e3);
            }), this;
          }, s.prototype.resume = function() {
            return !!i.prototype.resume.call(this) && (!this.previous && this._sources.length ? (this.prepareNextSource(), true) : this.previous || this._sources.length || this.generatedError ? void 0 : (this.end(), true));
          }, s.prototype.error = function(e2) {
            var t2 = this._sources;
            if (!i.prototype.error.call(this, e2))
              return false;
            for (var r2 = 0; r2 < t2.length; r2++)
              try {
                t2[r2].error(e2);
              } catch (e3) {
              }
            return true;
          }, s.prototype.lock = function() {
            i.prototype.lock.call(this);
            for (var e2 = this._sources, t2 = 0; t2 < e2.length; t2++)
              e2[t2].lock();
          }, t.exports = s;
        }, { "../crc32": 4, "../signature": 23, "../stream/GenericWorker": 28, "../utf8": 31, "../utils": 32 }], 9: [function(e, t, r) {
          "use strict";
          var u = e("../compressions"), n = e("./ZipFileWorker");
          r.generateWorker = function(e2, a, t2) {
            var o = new n(a.streamFiles, t2, a.platform, a.encodeFileName), h = 0;
            try {
              e2.forEach(function(e3, t3) {
                h++;
                var r2 = function(e4, t4) {
                  var r3 = e4 || t4, n3 = u[r3];
                  if (!n3)
                    throw new Error(r3 + " is not a valid compression method !");
                  return n3;
                }(t3.options.compression, a.compression), n2 = t3.options.compressionOptions || a.compressionOptions || {}, i = t3.dir, s = t3.date;
                t3._compressWorker(r2, n2).withStreamInfo("file", { name: e3, dir: i, date: s, comment: t3.comment || "", unixPermissions: t3.unixPermissions, dosPermissions: t3.dosPermissions }).pipe(o);
              }), o.entriesCount = h;
            } catch (e3) {
              o.error(e3);
            }
            return o;
          };
        }, { "../compressions": 3, "./ZipFileWorker": 8 }], 10: [function(e, t, r) {
          "use strict";
          function n() {
            if (!(this instanceof n))
              return new n();
            if (arguments.length)
              throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
            this.files = Object.create(null), this.comment = null, this.root = "", this.clone = function() {
              var e2 = new n();
              for (var t2 in this)
                typeof this[t2] != "function" && (e2[t2] = this[t2]);
              return e2;
            };
          }
          (n.prototype = e("./object")).loadAsync = e("./load"), n.support = e("./support"), n.defaults = e("./defaults"), n.version = "3.10.1", n.loadAsync = function(e2, t2) {
            return new n().loadAsync(e2, t2);
          }, n.external = e("./external"), t.exports = n;
        }, { "./defaults": 5, "./external": 6, "./load": 11, "./object": 15, "./support": 30 }], 11: [function(e, t, r) {
          "use strict";
          var u = e("./utils"), i = e("./external"), n = e("./utf8"), s = e("./zipEntries"), a = e("./stream/Crc32Probe"), l = e("./nodejsUtils");
          function f(n2) {
            return new i.Promise(function(e2, t2) {
              var r2 = n2.decompressed.getContentWorker().pipe(new a());
              r2.on("error", function(e3) {
                t2(e3);
              }).on("end", function() {
                r2.streamInfo.crc32 !== n2.decompressed.crc32 ? t2(new Error("Corrupted zip : CRC32 mismatch")) : e2();
              }).resume();
            });
          }
          t.exports = function(e2, o) {
            var h = this;
            return o = u.extend(o || {}, { base64: false, checkCRC32: false, optimizedBinaryString: false, createFolders: false, decodeFileName: n.utf8decode }), l.isNode && l.isStream(e2) ? i.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : u.prepareContent("the loaded zip file", e2, true, o.optimizedBinaryString, o.base64).then(function(e3) {
              var t2 = new s(o);
              return t2.load(e3), t2;
            }).then(function(e3) {
              var t2 = [i.Promise.resolve(e3)], r2 = e3.files;
              if (o.checkCRC32)
                for (var n2 = 0; n2 < r2.length; n2++)
                  t2.push(f(r2[n2]));
              return i.Promise.all(t2);
            }).then(function(e3) {
              for (var t2 = e3.shift(), r2 = t2.files, n2 = 0; n2 < r2.length; n2++) {
                var i2 = r2[n2], s2 = i2.fileNameStr, a2 = u.resolve(i2.fileNameStr);
                h.file(a2, i2.decompressed, { binary: true, optimizedBinaryString: true, date: i2.date, dir: i2.dir, comment: i2.fileCommentStr.length ? i2.fileCommentStr : null, unixPermissions: i2.unixPermissions, dosPermissions: i2.dosPermissions, createFolders: o.createFolders }), i2.dir || (h.file(a2).unsafeOriginalName = s2);
              }
              return t2.zipComment.length && (h.comment = t2.zipComment), h;
            });
          };
        }, { "./external": 6, "./nodejsUtils": 14, "./stream/Crc32Probe": 25, "./utf8": 31, "./utils": 32, "./zipEntries": 33 }], 12: [function(e, t, r) {
          "use strict";
          var n = e("../utils"), i = e("../stream/GenericWorker");
          function s(e2, t2) {
            i.call(this, "Nodejs stream input adapter for " + e2), this._upstreamEnded = false, this._bindStream(t2);
          }
          n.inherits(s, i), s.prototype._bindStream = function(e2) {
            var t2 = this;
            (this._stream = e2).pause(), e2.on("data", function(e3) {
              t2.push({ data: e3, meta: { percent: 0 } });
            }).on("error", function(e3) {
              t2.isPaused ? this.generatedError = e3 : t2.error(e3);
            }).on("end", function() {
              t2.isPaused ? t2._upstreamEnded = true : t2.end();
            });
          }, s.prototype.pause = function() {
            return !!i.prototype.pause.call(this) && (this._stream.pause(), true);
          }, s.prototype.resume = function() {
            return !!i.prototype.resume.call(this) && (this._upstreamEnded ? this.end() : this._stream.resume(), true);
          }, t.exports = s;
        }, { "../stream/GenericWorker": 28, "../utils": 32 }], 13: [function(e, t, r) {
          "use strict";
          var i = e("readable-stream").Readable;
          function n(e2, t2, r2) {
            i.call(this, t2), this._helper = e2;
            var n2 = this;
            e2.on("data", function(e3, t3) {
              n2.push(e3) || n2._helper.pause(), r2 && r2(t3);
            }).on("error", function(e3) {
              n2.emit("error", e3);
            }).on("end", function() {
              n2.push(null);
            });
          }
          e("../utils").inherits(n, i), n.prototype._read = function() {
            this._helper.resume();
          }, t.exports = n;
        }, { "../utils": 32, "readable-stream": 16 }], 14: [function(e, t, r) {
          "use strict";
          t.exports = { isNode: typeof Buffer != "undefined", newBufferFrom: function(e2, t2) {
            if (Buffer.from && Buffer.from !== Uint8Array.from)
              return Buffer.from(e2, t2);
            if (typeof e2 == "number")
              throw new Error('The "data" argument must not be a number');
            return new Buffer(e2, t2);
          }, allocBuffer: function(e2) {
            if (Buffer.alloc)
              return Buffer.alloc(e2);
            var t2 = new Buffer(e2);
            return t2.fill(0), t2;
          }, isBuffer: function(e2) {
            return Buffer.isBuffer(e2);
          }, isStream: function(e2) {
            return e2 && typeof e2.on == "function" && typeof e2.pause == "function" && typeof e2.resume == "function";
          } };
        }, {}], 15: [function(e, t, r) {
          "use strict";
          function s(e2, t2, r2) {
            var n2, i2 = u.getTypeOf(t2), s2 = u.extend(r2 || {}, f);
            s2.date = s2.date || new Date(), s2.compression !== null && (s2.compression = s2.compression.toUpperCase()), typeof s2.unixPermissions == "string" && (s2.unixPermissions = parseInt(s2.unixPermissions, 8)), s2.unixPermissions && 16384 & s2.unixPermissions && (s2.dir = true), s2.dosPermissions && 16 & s2.dosPermissions && (s2.dir = true), s2.dir && (e2 = g(e2)), s2.createFolders && (n2 = _(e2)) && b.call(this, n2, true);
            var a2 = i2 === "string" && s2.binary === false && s2.base64 === false;
            r2 && r2.binary !== void 0 || (s2.binary = !a2), (t2 instanceof c && t2.uncompressedSize === 0 || s2.dir || !t2 || t2.length === 0) && (s2.base64 = false, s2.binary = true, t2 = "", s2.compression = "STORE", i2 = "string");
            var o2 = null;
            o2 = t2 instanceof c || t2 instanceof l ? t2 : p.isNode && p.isStream(t2) ? new m(e2, t2) : u.prepareContent(e2, t2, s2.binary, s2.optimizedBinaryString, s2.base64);
            var h2 = new d(e2, o2, s2);
            this.files[e2] = h2;
          }
          var i = e("./utf8"), u = e("./utils"), l = e("./stream/GenericWorker"), a = e("./stream/StreamHelper"), f = e("./defaults"), c = e("./compressedObject"), d = e("./zipObject"), o = e("./generate"), p = e("./nodejsUtils"), m = e("./nodejs/NodejsStreamInputAdapter"), _ = function(e2) {
            e2.slice(-1) === "/" && (e2 = e2.substring(0, e2.length - 1));
            var t2 = e2.lastIndexOf("/");
            return 0 < t2 ? e2.substring(0, t2) : "";
          }, g = function(e2) {
            return e2.slice(-1) !== "/" && (e2 += "/"), e2;
          }, b = function(e2, t2) {
            return t2 = t2 !== void 0 ? t2 : f.createFolders, e2 = g(e2), this.files[e2] || s.call(this, e2, null, { dir: true, createFolders: t2 }), this.files[e2];
          };
          function h(e2) {
            return Object.prototype.toString.call(e2) === "[object RegExp]";
          }
          var n = { load: function() {
            throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
          }, forEach: function(e2) {
            var t2, r2, n2;
            for (t2 in this.files)
              n2 = this.files[t2], (r2 = t2.slice(this.root.length, t2.length)) && t2.slice(0, this.root.length) === this.root && e2(r2, n2);
          }, filter: function(r2) {
            var n2 = [];
            return this.forEach(function(e2, t2) {
              r2(e2, t2) && n2.push(t2);
            }), n2;
          }, file: function(e2, t2, r2) {
            if (arguments.length !== 1)
              return e2 = this.root + e2, s.call(this, e2, t2, r2), this;
            if (h(e2)) {
              var n2 = e2;
              return this.filter(function(e3, t3) {
                return !t3.dir && n2.test(e3);
              });
            }
            var i2 = this.files[this.root + e2];
            return i2 && !i2.dir ? i2 : null;
          }, folder: function(r2) {
            if (!r2)
              return this;
            if (h(r2))
              return this.filter(function(e3, t3) {
                return t3.dir && r2.test(e3);
              });
            var e2 = this.root + r2, t2 = b.call(this, e2), n2 = this.clone();
            return n2.root = t2.name, n2;
          }, remove: function(r2) {
            r2 = this.root + r2;
            var e2 = this.files[r2];
            if (e2 || (r2.slice(-1) !== "/" && (r2 += "/"), e2 = this.files[r2]), e2 && !e2.dir)
              delete this.files[r2];
            else
              for (var t2 = this.filter(function(e3, t3) {
                return t3.name.slice(0, r2.length) === r2;
              }), n2 = 0; n2 < t2.length; n2++)
                delete this.files[t2[n2].name];
            return this;
          }, generate: function() {
            throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
          }, generateInternalStream: function(e2) {
            var t2, r2 = {};
            try {
              if ((r2 = u.extend(e2 || {}, { streamFiles: false, compression: "STORE", compressionOptions: null, type: "", platform: "DOS", comment: null, mimeType: "application/zip", encodeFileName: i.utf8encode })).type = r2.type.toLowerCase(), r2.compression = r2.compression.toUpperCase(), r2.type === "binarystring" && (r2.type = "string"), !r2.type)
                throw new Error("No output type specified.");
              u.checkSupport(r2.type), r2.platform !== "darwin" && r2.platform !== "freebsd" && r2.platform !== "linux" && r2.platform !== "sunos" || (r2.platform = "UNIX"), r2.platform === "win32" && (r2.platform = "DOS");
              var n2 = r2.comment || this.comment || "";
              t2 = o.generateWorker(this, r2, n2);
            } catch (e3) {
              (t2 = new l("error")).error(e3);
            }
            return new a(t2, r2.type || "string", r2.mimeType);
          }, generateAsync: function(e2, t2) {
            return this.generateInternalStream(e2).accumulate(t2);
          }, generateNodeStream: function(e2, t2) {
            return (e2 = e2 || {}).type || (e2.type = "nodebuffer"), this.generateInternalStream(e2).toNodejsStream(t2);
          } };
          t.exports = n;
        }, { "./compressedObject": 2, "./defaults": 5, "./generate": 9, "./nodejs/NodejsStreamInputAdapter": 12, "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31, "./utils": 32, "./zipObject": 35 }], 16: [function(e, t, r) {
          "use strict";
          t.exports = e("stream");
        }, { stream: void 0 }], 17: [function(e, t, r) {
          "use strict";
          var n = e("./DataReader");
          function i(e2) {
            n.call(this, e2);
            for (var t2 = 0; t2 < this.data.length; t2++)
              e2[t2] = 255 & e2[t2];
          }
          e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
            return this.data[this.zero + e2];
          }, i.prototype.lastIndexOfSignature = function(e2) {
            for (var t2 = e2.charCodeAt(0), r2 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.length - 4; 0 <= s; --s)
              if (this.data[s] === t2 && this.data[s + 1] === r2 && this.data[s + 2] === n2 && this.data[s + 3] === i2)
                return s - this.zero;
            return -1;
          }, i.prototype.readAndCheckSignature = function(e2) {
            var t2 = e2.charCodeAt(0), r2 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.readData(4);
            return t2 === s[0] && r2 === s[1] && n2 === s[2] && i2 === s[3];
          }, i.prototype.readData = function(e2) {
            if (this.checkOffset(e2), e2 === 0)
              return [];
            var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
            return this.index += e2, t2;
          }, t.exports = i;
        }, { "../utils": 32, "./DataReader": 18 }], 18: [function(e, t, r) {
          "use strict";
          var n = e("../utils");
          function i(e2) {
            this.data = e2, this.length = e2.length, this.index = 0, this.zero = 0;
          }
          i.prototype = { checkOffset: function(e2) {
            this.checkIndex(this.index + e2);
          }, checkIndex: function(e2) {
            if (this.length < this.zero + e2 || e2 < 0)
              throw new Error("End of data reached (data length = " + this.length + ", asked index = " + e2 + "). Corrupted zip ?");
          }, setIndex: function(e2) {
            this.checkIndex(e2), this.index = e2;
          }, skip: function(e2) {
            this.setIndex(this.index + e2);
          }, byteAt: function() {
          }, readInt: function(e2) {
            var t2, r2 = 0;
            for (this.checkOffset(e2), t2 = this.index + e2 - 1; t2 >= this.index; t2--)
              r2 = (r2 << 8) + this.byteAt(t2);
            return this.index += e2, r2;
          }, readString: function(e2) {
            return n.transformTo("string", this.readData(e2));
          }, readData: function() {
          }, lastIndexOfSignature: function() {
          }, readAndCheckSignature: function() {
          }, readDate: function() {
            var e2 = this.readInt(4);
            return new Date(Date.UTC(1980 + (e2 >> 25 & 127), (e2 >> 21 & 15) - 1, e2 >> 16 & 31, e2 >> 11 & 31, e2 >> 5 & 63, (31 & e2) << 1));
          } }, t.exports = i;
        }, { "../utils": 32 }], 19: [function(e, t, r) {
          "use strict";
          var n = e("./Uint8ArrayReader");
          function i(e2) {
            n.call(this, e2);
          }
          e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
            this.checkOffset(e2);
            var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
            return this.index += e2, t2;
          }, t.exports = i;
        }, { "../utils": 32, "./Uint8ArrayReader": 21 }], 20: [function(e, t, r) {
          "use strict";
          var n = e("./DataReader");
          function i(e2) {
            n.call(this, e2);
          }
          e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
            return this.data.charCodeAt(this.zero + e2);
          }, i.prototype.lastIndexOfSignature = function(e2) {
            return this.data.lastIndexOf(e2) - this.zero;
          }, i.prototype.readAndCheckSignature = function(e2) {
            return e2 === this.readData(4);
          }, i.prototype.readData = function(e2) {
            this.checkOffset(e2);
            var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
            return this.index += e2, t2;
          }, t.exports = i;
        }, { "../utils": 32, "./DataReader": 18 }], 21: [function(e, t, r) {
          "use strict";
          var n = e("./ArrayReader");
          function i(e2) {
            n.call(this, e2);
          }
          e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
            if (this.checkOffset(e2), e2 === 0)
              return new Uint8Array(0);
            var t2 = this.data.subarray(this.zero + this.index, this.zero + this.index + e2);
            return this.index += e2, t2;
          }, t.exports = i;
        }, { "../utils": 32, "./ArrayReader": 17 }], 22: [function(e, t, r) {
          "use strict";
          var n = e("../utils"), i = e("../support"), s = e("./ArrayReader"), a = e("./StringReader"), o = e("./NodeBufferReader"), h = e("./Uint8ArrayReader");
          t.exports = function(e2) {
            var t2 = n.getTypeOf(e2);
            return n.checkSupport(t2), t2 !== "string" || i.uint8array ? t2 === "nodebuffer" ? new o(e2) : i.uint8array ? new h(n.transformTo("uint8array", e2)) : new s(n.transformTo("array", e2)) : new a(e2);
          };
        }, { "../support": 30, "../utils": 32, "./ArrayReader": 17, "./NodeBufferReader": 19, "./StringReader": 20, "./Uint8ArrayReader": 21 }], 23: [function(e, t, r) {
          "use strict";
          r.LOCAL_FILE_HEADER = "PK", r.CENTRAL_FILE_HEADER = "PK", r.CENTRAL_DIRECTORY_END = "PK", r.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07", r.ZIP64_CENTRAL_DIRECTORY_END = "PK", r.DATA_DESCRIPTOR = "PK\x07\b";
        }, {}], 24: [function(e, t, r) {
          "use strict";
          var n = e("./GenericWorker"), i = e("../utils");
          function s(e2) {
            n.call(this, "ConvertWorker to " + e2), this.destType = e2;
          }
          i.inherits(s, n), s.prototype.processChunk = function(e2) {
            this.push({ data: i.transformTo(this.destType, e2.data), meta: e2.meta });
          }, t.exports = s;
        }, { "../utils": 32, "./GenericWorker": 28 }], 25: [function(e, t, r) {
          "use strict";
          var n = e("./GenericWorker"), i = e("../crc32");
          function s() {
            n.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
          }
          e("../utils").inherits(s, n), s.prototype.processChunk = function(e2) {
            this.streamInfo.crc32 = i(e2.data, this.streamInfo.crc32 || 0), this.push(e2);
          }, t.exports = s;
        }, { "../crc32": 4, "../utils": 32, "./GenericWorker": 28 }], 26: [function(e, t, r) {
          "use strict";
          var n = e("../utils"), i = e("./GenericWorker");
          function s(e2) {
            i.call(this, "DataLengthProbe for " + e2), this.propName = e2, this.withStreamInfo(e2, 0);
          }
          n.inherits(s, i), s.prototype.processChunk = function(e2) {
            if (e2) {
              var t2 = this.streamInfo[this.propName] || 0;
              this.streamInfo[this.propName] = t2 + e2.data.length;
            }
            i.prototype.processChunk.call(this, e2);
          }, t.exports = s;
        }, { "../utils": 32, "./GenericWorker": 28 }], 27: [function(e, t, r) {
          "use strict";
          var n = e("../utils"), i = e("./GenericWorker");
          function s(e2) {
            i.call(this, "DataWorker");
            var t2 = this;
            this.dataIsReady = false, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = false, e2.then(function(e3) {
              t2.dataIsReady = true, t2.data = e3, t2.max = e3 && e3.length || 0, t2.type = n.getTypeOf(e3), t2.isPaused || t2._tickAndRepeat();
            }, function(e3) {
              t2.error(e3);
            });
          }
          n.inherits(s, i), s.prototype.cleanUp = function() {
            i.prototype.cleanUp.call(this), this.data = null;
          }, s.prototype.resume = function() {
            return !!i.prototype.resume.call(this) && (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = true, n.delay(this._tickAndRepeat, [], this)), true);
          }, s.prototype._tickAndRepeat = function() {
            this._tickScheduled = false, this.isPaused || this.isFinished || (this._tick(), this.isFinished || (n.delay(this._tickAndRepeat, [], this), this._tickScheduled = true));
          }, s.prototype._tick = function() {
            if (this.isPaused || this.isFinished)
              return false;
            var e2 = null, t2 = Math.min(this.max, this.index + 16384);
            if (this.index >= this.max)
              return this.end();
            switch (this.type) {
              case "string":
                e2 = this.data.substring(this.index, t2);
                break;
              case "uint8array":
                e2 = this.data.subarray(this.index, t2);
                break;
              case "array":
              case "nodebuffer":
                e2 = this.data.slice(this.index, t2);
            }
            return this.index = t2, this.push({ data: e2, meta: { percent: this.max ? this.index / this.max * 100 : 0 } });
          }, t.exports = s;
        }, { "../utils": 32, "./GenericWorker": 28 }], 28: [function(e, t, r) {
          "use strict";
          function n(e2) {
            this.name = e2 || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = true, this.isFinished = false, this.isLocked = false, this._listeners = { data: [], end: [], error: [] }, this.previous = null;
          }
          n.prototype = { push: function(e2) {
            this.emit("data", e2);
          }, end: function() {
            if (this.isFinished)
              return false;
            this.flush();
            try {
              this.emit("end"), this.cleanUp(), this.isFinished = true;
            } catch (e2) {
              this.emit("error", e2);
            }
            return true;
          }, error: function(e2) {
            return !this.isFinished && (this.isPaused ? this.generatedError = e2 : (this.isFinished = true, this.emit("error", e2), this.previous && this.previous.error(e2), this.cleanUp()), true);
          }, on: function(e2, t2) {
            return this._listeners[e2].push(t2), this;
          }, cleanUp: function() {
            this.streamInfo = this.generatedError = this.extraStreamInfo = null, this._listeners = [];
          }, emit: function(e2, t2) {
            if (this._listeners[e2])
              for (var r2 = 0; r2 < this._listeners[e2].length; r2++)
                this._listeners[e2][r2].call(this, t2);
          }, pipe: function(e2) {
            return e2.registerPrevious(this);
          }, registerPrevious: function(e2) {
            if (this.isLocked)
              throw new Error("The stream '" + this + "' has already been used.");
            this.streamInfo = e2.streamInfo, this.mergeStreamInfo(), this.previous = e2;
            var t2 = this;
            return e2.on("data", function(e3) {
              t2.processChunk(e3);
            }), e2.on("end", function() {
              t2.end();
            }), e2.on("error", function(e3) {
              t2.error(e3);
            }), this;
          }, pause: function() {
            return !this.isPaused && !this.isFinished && (this.isPaused = true, this.previous && this.previous.pause(), true);
          }, resume: function() {
            if (!this.isPaused || this.isFinished)
              return false;
            var e2 = this.isPaused = false;
            return this.generatedError && (this.error(this.generatedError), e2 = true), this.previous && this.previous.resume(), !e2;
          }, flush: function() {
          }, processChunk: function(e2) {
            this.push(e2);
          }, withStreamInfo: function(e2, t2) {
            return this.extraStreamInfo[e2] = t2, this.mergeStreamInfo(), this;
          }, mergeStreamInfo: function() {
            for (var e2 in this.extraStreamInfo)
              Object.prototype.hasOwnProperty.call(this.extraStreamInfo, e2) && (this.streamInfo[e2] = this.extraStreamInfo[e2]);
          }, lock: function() {
            if (this.isLocked)
              throw new Error("The stream '" + this + "' has already been used.");
            this.isLocked = true, this.previous && this.previous.lock();
          }, toString: function() {
            var e2 = "Worker " + this.name;
            return this.previous ? this.previous + " -> " + e2 : e2;
          } }, t.exports = n;
        }, {}], 29: [function(e, t, r) {
          "use strict";
          var h = e("../utils"), i = e("./ConvertWorker"), s = e("./GenericWorker"), u = e("../base64"), n = e("../support"), a = e("../external"), o = null;
          if (n.nodestream)
            try {
              o = e("../nodejs/NodejsStreamOutputAdapter");
            } catch (e2) {
            }
          function l(e2, o2) {
            return new a.Promise(function(t2, r2) {
              var n2 = [], i2 = e2._internalType, s2 = e2._outputType, a2 = e2._mimeType;
              e2.on("data", function(e3, t3) {
                n2.push(e3), o2 && o2(t3);
              }).on("error", function(e3) {
                n2 = [], r2(e3);
              }).on("end", function() {
                try {
                  var e3 = function(e4, t3, r3) {
                    switch (e4) {
                      case "blob":
                        return h.newBlob(h.transformTo("arraybuffer", t3), r3);
                      case "base64":
                        return u.encode(t3);
                      default:
                        return h.transformTo(e4, t3);
                    }
                  }(s2, function(e4, t3) {
                    var r3, n3 = 0, i3 = null, s3 = 0;
                    for (r3 = 0; r3 < t3.length; r3++)
                      s3 += t3[r3].length;
                    switch (e4) {
                      case "string":
                        return t3.join("");
                      case "array":
                        return Array.prototype.concat.apply([], t3);
                      case "uint8array":
                        for (i3 = new Uint8Array(s3), r3 = 0; r3 < t3.length; r3++)
                          i3.set(t3[r3], n3), n3 += t3[r3].length;
                        return i3;
                      case "nodebuffer":
                        return Buffer.concat(t3);
                      default:
                        throw new Error("concat : unsupported type '" + e4 + "'");
                    }
                  }(i2, n2), a2);
                  t2(e3);
                } catch (e4) {
                  r2(e4);
                }
                n2 = [];
              }).resume();
            });
          }
          function f(e2, t2, r2) {
            var n2 = t2;
            switch (t2) {
              case "blob":
              case "arraybuffer":
                n2 = "uint8array";
                break;
              case "base64":
                n2 = "string";
            }
            try {
              this._internalType = n2, this._outputType = t2, this._mimeType = r2, h.checkSupport(n2), this._worker = e2.pipe(new i(n2)), e2.lock();
            } catch (e3) {
              this._worker = new s("error"), this._worker.error(e3);
            }
          }
          f.prototype = { accumulate: function(e2) {
            return l(this, e2);
          }, on: function(e2, t2) {
            var r2 = this;
            return e2 === "data" ? this._worker.on(e2, function(e3) {
              t2.call(r2, e3.data, e3.meta);
            }) : this._worker.on(e2, function() {
              h.delay(t2, arguments, r2);
            }), this;
          }, resume: function() {
            return h.delay(this._worker.resume, [], this._worker), this;
          }, pause: function() {
            return this._worker.pause(), this;
          }, toNodejsStream: function(e2) {
            if (h.checkSupport("nodestream"), this._outputType !== "nodebuffer")
              throw new Error(this._outputType + " is not supported by this method");
            return new o(this, { objectMode: this._outputType !== "nodebuffer" }, e2);
          } }, t.exports = f;
        }, { "../base64": 1, "../external": 6, "../nodejs/NodejsStreamOutputAdapter": 13, "../support": 30, "../utils": 32, "./ConvertWorker": 24, "./GenericWorker": 28 }], 30: [function(e, t, r) {
          "use strict";
          if (r.base64 = true, r.array = true, r.string = true, r.arraybuffer = typeof ArrayBuffer != "undefined" && typeof Uint8Array != "undefined", r.nodebuffer = typeof Buffer != "undefined", r.uint8array = typeof Uint8Array != "undefined", typeof ArrayBuffer == "undefined")
            r.blob = false;
          else {
            var n = new ArrayBuffer(0);
            try {
              r.blob = new Blob([n], { type: "application/zip" }).size === 0;
            } catch (e2) {
              try {
                var i = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
                i.append(n), r.blob = i.getBlob("application/zip").size === 0;
              } catch (e3) {
                r.blob = false;
              }
            }
          }
          try {
            r.nodestream = !!e("readable-stream").Readable;
          } catch (e2) {
            r.nodestream = false;
          }
        }, { "readable-stream": 16 }], 31: [function(e, t, s) {
          "use strict";
          for (var o = e("./utils"), h = e("./support"), r = e("./nodejsUtils"), n = e("./stream/GenericWorker"), u = new Array(256), i = 0; i < 256; i++)
            u[i] = 252 <= i ? 6 : 248 <= i ? 5 : 240 <= i ? 4 : 224 <= i ? 3 : 192 <= i ? 2 : 1;
          u[254] = u[254] = 1;
          function a() {
            n.call(this, "utf-8 decode"), this.leftOver = null;
          }
          function l() {
            n.call(this, "utf-8 encode");
          }
          s.utf8encode = function(e2) {
            return h.nodebuffer ? r.newBufferFrom(e2, "utf-8") : function(e3) {
              var t2, r2, n2, i2, s2, a2 = e3.length, o2 = 0;
              for (i2 = 0; i2 < a2; i2++)
                (64512 & (r2 = e3.charCodeAt(i2))) == 55296 && i2 + 1 < a2 && (64512 & (n2 = e3.charCodeAt(i2 + 1))) == 56320 && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), o2 += r2 < 128 ? 1 : r2 < 2048 ? 2 : r2 < 65536 ? 3 : 4;
              for (t2 = h.uint8array ? new Uint8Array(o2) : new Array(o2), i2 = s2 = 0; s2 < o2; i2++)
                (64512 & (r2 = e3.charCodeAt(i2))) == 55296 && i2 + 1 < a2 && (64512 & (n2 = e3.charCodeAt(i2 + 1))) == 56320 && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), r2 < 128 ? t2[s2++] = r2 : (r2 < 2048 ? t2[s2++] = 192 | r2 >>> 6 : (r2 < 65536 ? t2[s2++] = 224 | r2 >>> 12 : (t2[s2++] = 240 | r2 >>> 18, t2[s2++] = 128 | r2 >>> 12 & 63), t2[s2++] = 128 | r2 >>> 6 & 63), t2[s2++] = 128 | 63 & r2);
              return t2;
            }(e2);
          }, s.utf8decode = function(e2) {
            return h.nodebuffer ? o.transformTo("nodebuffer", e2).toString("utf-8") : function(e3) {
              var t2, r2, n2, i2, s2 = e3.length, a2 = new Array(2 * s2);
              for (t2 = r2 = 0; t2 < s2; )
                if ((n2 = e3[t2++]) < 128)
                  a2[r2++] = n2;
                else if (4 < (i2 = u[n2]))
                  a2[r2++] = 65533, t2 += i2 - 1;
                else {
                  for (n2 &= i2 === 2 ? 31 : i2 === 3 ? 15 : 7; 1 < i2 && t2 < s2; )
                    n2 = n2 << 6 | 63 & e3[t2++], i2--;
                  1 < i2 ? a2[r2++] = 65533 : n2 < 65536 ? a2[r2++] = n2 : (n2 -= 65536, a2[r2++] = 55296 | n2 >> 10 & 1023, a2[r2++] = 56320 | 1023 & n2);
                }
              return a2.length !== r2 && (a2.subarray ? a2 = a2.subarray(0, r2) : a2.length = r2), o.applyFromCharCode(a2);
            }(e2 = o.transformTo(h.uint8array ? "uint8array" : "array", e2));
          }, o.inherits(a, n), a.prototype.processChunk = function(e2) {
            var t2 = o.transformTo(h.uint8array ? "uint8array" : "array", e2.data);
            if (this.leftOver && this.leftOver.length) {
              if (h.uint8array) {
                var r2 = t2;
                (t2 = new Uint8Array(r2.length + this.leftOver.length)).set(this.leftOver, 0), t2.set(r2, this.leftOver.length);
              } else
                t2 = this.leftOver.concat(t2);
              this.leftOver = null;
            }
            var n2 = function(e3, t3) {
              var r3;
              for ((t3 = t3 || e3.length) > e3.length && (t3 = e3.length), r3 = t3 - 1; 0 <= r3 && (192 & e3[r3]) == 128; )
                r3--;
              return r3 < 0 ? t3 : r3 === 0 ? t3 : r3 + u[e3[r3]] > t3 ? r3 : t3;
            }(t2), i2 = t2;
            n2 !== t2.length && (h.uint8array ? (i2 = t2.subarray(0, n2), this.leftOver = t2.subarray(n2, t2.length)) : (i2 = t2.slice(0, n2), this.leftOver = t2.slice(n2, t2.length))), this.push({ data: s.utf8decode(i2), meta: e2.meta });
          }, a.prototype.flush = function() {
            this.leftOver && this.leftOver.length && (this.push({ data: s.utf8decode(this.leftOver), meta: {} }), this.leftOver = null);
          }, s.Utf8DecodeWorker = a, o.inherits(l, n), l.prototype.processChunk = function(e2) {
            this.push({ data: s.utf8encode(e2.data), meta: e2.meta });
          }, s.Utf8EncodeWorker = l;
        }, { "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./support": 30, "./utils": 32 }], 32: [function(e, t, a) {
          "use strict";
          var o = e("./support"), h = e("./base64"), r = e("./nodejsUtils"), u = e("./external");
          function n(e2) {
            return e2;
          }
          function l(e2, t2) {
            for (var r2 = 0; r2 < e2.length; ++r2)
              t2[r2] = 255 & e2.charCodeAt(r2);
            return t2;
          }
          e("setimmediate"), a.newBlob = function(t2, r2) {
            a.checkSupport("blob");
            try {
              return new Blob([t2], { type: r2 });
            } catch (e2) {
              try {
                var n2 = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
                return n2.append(t2), n2.getBlob(r2);
              } catch (e3) {
                throw new Error("Bug : can't construct the Blob.");
              }
            }
          };
          var i = { stringifyByChunk: function(e2, t2, r2) {
            var n2 = [], i2 = 0, s2 = e2.length;
            if (s2 <= r2)
              return String.fromCharCode.apply(null, e2);
            for (; i2 < s2; )
              t2 === "array" || t2 === "nodebuffer" ? n2.push(String.fromCharCode.apply(null, e2.slice(i2, Math.min(i2 + r2, s2)))) : n2.push(String.fromCharCode.apply(null, e2.subarray(i2, Math.min(i2 + r2, s2)))), i2 += r2;
            return n2.join("");
          }, stringifyByChar: function(e2) {
            for (var t2 = "", r2 = 0; r2 < e2.length; r2++)
              t2 += String.fromCharCode(e2[r2]);
            return t2;
          }, applyCanBeUsed: { uint8array: function() {
            try {
              return o.uint8array && String.fromCharCode.apply(null, new Uint8Array(1)).length === 1;
            } catch (e2) {
              return false;
            }
          }(), nodebuffer: function() {
            try {
              return o.nodebuffer && String.fromCharCode.apply(null, r.allocBuffer(1)).length === 1;
            } catch (e2) {
              return false;
            }
          }() } };
          function s(e2) {
            var t2 = 65536, r2 = a.getTypeOf(e2), n2 = true;
            if (r2 === "uint8array" ? n2 = i.applyCanBeUsed.uint8array : r2 === "nodebuffer" && (n2 = i.applyCanBeUsed.nodebuffer), n2)
              for (; 1 < t2; )
                try {
                  return i.stringifyByChunk(e2, r2, t2);
                } catch (e3) {
                  t2 = Math.floor(t2 / 2);
                }
            return i.stringifyByChar(e2);
          }
          function f(e2, t2) {
            for (var r2 = 0; r2 < e2.length; r2++)
              t2[r2] = e2[r2];
            return t2;
          }
          a.applyFromCharCode = s;
          var c = {};
          c.string = { string: n, array: function(e2) {
            return l(e2, new Array(e2.length));
          }, arraybuffer: function(e2) {
            return c.string.uint8array(e2).buffer;
          }, uint8array: function(e2) {
            return l(e2, new Uint8Array(e2.length));
          }, nodebuffer: function(e2) {
            return l(e2, r.allocBuffer(e2.length));
          } }, c.array = { string: s, array: n, arraybuffer: function(e2) {
            return new Uint8Array(e2).buffer;
          }, uint8array: function(e2) {
            return new Uint8Array(e2);
          }, nodebuffer: function(e2) {
            return r.newBufferFrom(e2);
          } }, c.arraybuffer = { string: function(e2) {
            return s(new Uint8Array(e2));
          }, array: function(e2) {
            return f(new Uint8Array(e2), new Array(e2.byteLength));
          }, arraybuffer: n, uint8array: function(e2) {
            return new Uint8Array(e2);
          }, nodebuffer: function(e2) {
            return r.newBufferFrom(new Uint8Array(e2));
          } }, c.uint8array = { string: s, array: function(e2) {
            return f(e2, new Array(e2.length));
          }, arraybuffer: function(e2) {
            return e2.buffer;
          }, uint8array: n, nodebuffer: function(e2) {
            return r.newBufferFrom(e2);
          } }, c.nodebuffer = { string: s, array: function(e2) {
            return f(e2, new Array(e2.length));
          }, arraybuffer: function(e2) {
            return c.nodebuffer.uint8array(e2).buffer;
          }, uint8array: function(e2) {
            return f(e2, new Uint8Array(e2.length));
          }, nodebuffer: n }, a.transformTo = function(e2, t2) {
            if (t2 = t2 || "", !e2)
              return t2;
            a.checkSupport(e2);
            var r2 = a.getTypeOf(t2);
            return c[r2][e2](t2);
          }, a.resolve = function(e2) {
            for (var t2 = e2.split("/"), r2 = [], n2 = 0; n2 < t2.length; n2++) {
              var i2 = t2[n2];
              i2 === "." || i2 === "" && n2 !== 0 && n2 !== t2.length - 1 || (i2 === ".." ? r2.pop() : r2.push(i2));
            }
            return r2.join("/");
          }, a.getTypeOf = function(e2) {
            return typeof e2 == "string" ? "string" : Object.prototype.toString.call(e2) === "[object Array]" ? "array" : o.nodebuffer && r.isBuffer(e2) ? "nodebuffer" : o.uint8array && e2 instanceof Uint8Array ? "uint8array" : o.arraybuffer && e2 instanceof ArrayBuffer ? "arraybuffer" : void 0;
          }, a.checkSupport = function(e2) {
            if (!o[e2.toLowerCase()])
              throw new Error(e2 + " is not supported by this platform");
          }, a.MAX_VALUE_16BITS = 65535, a.MAX_VALUE_32BITS = -1, a.pretty = function(e2) {
            var t2, r2, n2 = "";
            for (r2 = 0; r2 < (e2 || "").length; r2++)
              n2 += "\\x" + ((t2 = e2.charCodeAt(r2)) < 16 ? "0" : "") + t2.toString(16).toUpperCase();
            return n2;
          }, a.delay = function(e2, t2, r2) {
            setImmediate(function() {
              e2.apply(r2 || null, t2 || []);
            });
          }, a.inherits = function(e2, t2) {
            function r2() {
            }
            r2.prototype = t2.prototype, e2.prototype = new r2();
          }, a.extend = function() {
            var e2, t2, r2 = {};
            for (e2 = 0; e2 < arguments.length; e2++)
              for (t2 in arguments[e2])
                Object.prototype.hasOwnProperty.call(arguments[e2], t2) && r2[t2] === void 0 && (r2[t2] = arguments[e2][t2]);
            return r2;
          }, a.prepareContent = function(r2, e2, n2, i2, s2) {
            return u.Promise.resolve(e2).then(function(n3) {
              return o.blob && (n3 instanceof Blob || ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(n3)) !== -1) && typeof FileReader != "undefined" ? new u.Promise(function(t2, r3) {
                var e3 = new FileReader();
                e3.onload = function(e4) {
                  t2(e4.target.result);
                }, e3.onerror = function(e4) {
                  r3(e4.target.error);
                }, e3.readAsArrayBuffer(n3);
              }) : n3;
            }).then(function(e3) {
              var t2 = a.getTypeOf(e3);
              return t2 ? (t2 === "arraybuffer" ? e3 = a.transformTo("uint8array", e3) : t2 === "string" && (s2 ? e3 = h.decode(e3) : n2 && i2 !== true && (e3 = function(e4) {
                return l(e4, o.uint8array ? new Uint8Array(e4.length) : new Array(e4.length));
              }(e3))), e3) : u.Promise.reject(new Error("Can't read the data of '" + r2 + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
            });
          };
        }, { "./base64": 1, "./external": 6, "./nodejsUtils": 14, "./support": 30, setimmediate: 54 }], 33: [function(e, t, r) {
          "use strict";
          var n = e("./reader/readerFor"), i = e("./utils"), s = e("./signature"), a = e("./zipEntry"), o = e("./support");
          function h(e2) {
            this.files = [], this.loadOptions = e2;
          }
          h.prototype = { checkSignature: function(e2) {
            if (!this.reader.readAndCheckSignature(e2)) {
              this.reader.index -= 4;
              var t2 = this.reader.readString(4);
              throw new Error("Corrupted zip or bug: unexpected signature (" + i.pretty(t2) + ", expected " + i.pretty(e2) + ")");
            }
          }, isSignature: function(e2, t2) {
            var r2 = this.reader.index;
            this.reader.setIndex(e2);
            var n2 = this.reader.readString(4) === t2;
            return this.reader.setIndex(r2), n2;
          }, readBlockEndOfCentral: function() {
            this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2);
            var e2 = this.reader.readData(this.zipCommentLength), t2 = o.uint8array ? "uint8array" : "array", r2 = i.transformTo(t2, e2);
            this.zipComment = this.loadOptions.decodeFileName(r2);
          }, readBlockZip64EndOfCentral: function() {
            this.zip64EndOfCentralSize = this.reader.readInt(8), this.reader.skip(4), this.diskNumber = this.reader.readInt(4), this.diskWithCentralDirStart = this.reader.readInt(4), this.centralDirRecordsOnThisDisk = this.reader.readInt(8), this.centralDirRecords = this.reader.readInt(8), this.centralDirSize = this.reader.readInt(8), this.centralDirOffset = this.reader.readInt(8), this.zip64ExtensibleData = {};
            for (var e2, t2, r2, n2 = this.zip64EndOfCentralSize - 44; 0 < n2; )
              e2 = this.reader.readInt(2), t2 = this.reader.readInt(4), r2 = this.reader.readData(t2), this.zip64ExtensibleData[e2] = { id: e2, length: t2, value: r2 };
          }, readBlockZip64EndOfCentralLocator: function() {
            if (this.diskWithZip64CentralDirStart = this.reader.readInt(4), this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8), this.disksCount = this.reader.readInt(4), 1 < this.disksCount)
              throw new Error("Multi-volumes zip are not supported");
          }, readLocalFiles: function() {
            var e2, t2;
            for (e2 = 0; e2 < this.files.length; e2++)
              t2 = this.files[e2], this.reader.setIndex(t2.localHeaderOffset), this.checkSignature(s.LOCAL_FILE_HEADER), t2.readLocalPart(this.reader), t2.handleUTF8(), t2.processAttributes();
          }, readCentralDir: function() {
            var e2;
            for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(s.CENTRAL_FILE_HEADER); )
              (e2 = new a({ zip64: this.zip64 }, this.loadOptions)).readCentralPart(this.reader), this.files.push(e2);
            if (this.centralDirRecords !== this.files.length && this.centralDirRecords !== 0 && this.files.length === 0)
              throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
          }, readEndOfCentral: function() {
            var e2 = this.reader.lastIndexOfSignature(s.CENTRAL_DIRECTORY_END);
            if (e2 < 0)
              throw !this.isSignature(0, s.LOCAL_FILE_HEADER) ? new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html") : new Error("Corrupted zip: can't find end of central directory");
            this.reader.setIndex(e2);
            var t2 = e2;
            if (this.checkSignature(s.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === i.MAX_VALUE_16BITS || this.diskWithCentralDirStart === i.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === i.MAX_VALUE_16BITS || this.centralDirRecords === i.MAX_VALUE_16BITS || this.centralDirSize === i.MAX_VALUE_32BITS || this.centralDirOffset === i.MAX_VALUE_32BITS) {
              if (this.zip64 = true, (e2 = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR)) < 0)
                throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
              if (this.reader.setIndex(e2), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, s.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0))
                throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
              this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral();
            }
            var r2 = this.centralDirOffset + this.centralDirSize;
            this.zip64 && (r2 += 20, r2 += 12 + this.zip64EndOfCentralSize);
            var n2 = t2 - r2;
            if (0 < n2)
              this.isSignature(t2, s.CENTRAL_FILE_HEADER) || (this.reader.zero = n2);
            else if (n2 < 0)
              throw new Error("Corrupted zip: missing " + Math.abs(n2) + " bytes.");
          }, prepareReader: function(e2) {
            this.reader = n(e2);
          }, load: function(e2) {
            this.prepareReader(e2), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
          } }, t.exports = h;
        }, { "./reader/readerFor": 22, "./signature": 23, "./support": 30, "./utils": 32, "./zipEntry": 34 }], 34: [function(e, t, r) {
          "use strict";
          var n = e("./reader/readerFor"), s = e("./utils"), i = e("./compressedObject"), a = e("./crc32"), o = e("./utf8"), h = e("./compressions"), u = e("./support");
          function l(e2, t2) {
            this.options = e2, this.loadOptions = t2;
          }
          l.prototype = { isEncrypted: function() {
            return (1 & this.bitFlag) == 1;
          }, useUTF8: function() {
            return (2048 & this.bitFlag) == 2048;
          }, readLocalPart: function(e2) {
            var t2, r2;
            if (e2.skip(22), this.fileNameLength = e2.readInt(2), r2 = e2.readInt(2), this.fileName = e2.readData(this.fileNameLength), e2.skip(r2), this.compressedSize === -1 || this.uncompressedSize === -1)
              throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
            if ((t2 = function(e3) {
              for (var t3 in h)
                if (Object.prototype.hasOwnProperty.call(h, t3) && h[t3].magic === e3)
                  return h[t3];
              return null;
            }(this.compressionMethod)) === null)
              throw new Error("Corrupted zip : compression " + s.pretty(this.compressionMethod) + " unknown (inner file : " + s.transformTo("string", this.fileName) + ")");
            this.decompressed = new i(this.compressedSize, this.uncompressedSize, this.crc32, t2, e2.readData(this.compressedSize));
          }, readCentralPart: function(e2) {
            this.versionMadeBy = e2.readInt(2), e2.skip(2), this.bitFlag = e2.readInt(2), this.compressionMethod = e2.readString(2), this.date = e2.readDate(), this.crc32 = e2.readInt(4), this.compressedSize = e2.readInt(4), this.uncompressedSize = e2.readInt(4);
            var t2 = e2.readInt(2);
            if (this.extraFieldsLength = e2.readInt(2), this.fileCommentLength = e2.readInt(2), this.diskNumberStart = e2.readInt(2), this.internalFileAttributes = e2.readInt(2), this.externalFileAttributes = e2.readInt(4), this.localHeaderOffset = e2.readInt(4), this.isEncrypted())
              throw new Error("Encrypted zip are not supported");
            e2.skip(t2), this.readExtraFields(e2), this.parseZIP64ExtraField(e2), this.fileComment = e2.readData(this.fileCommentLength);
          }, processAttributes: function() {
            this.unixPermissions = null, this.dosPermissions = null;
            var e2 = this.versionMadeBy >> 8;
            this.dir = !!(16 & this.externalFileAttributes), e2 == 0 && (this.dosPermissions = 63 & this.externalFileAttributes), e2 == 3 && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), this.dir || this.fileNameStr.slice(-1) !== "/" || (this.dir = true);
          }, parseZIP64ExtraField: function() {
            if (this.extraFields[1]) {
              var e2 = n(this.extraFields[1].value);
              this.uncompressedSize === s.MAX_VALUE_32BITS && (this.uncompressedSize = e2.readInt(8)), this.compressedSize === s.MAX_VALUE_32BITS && (this.compressedSize = e2.readInt(8)), this.localHeaderOffset === s.MAX_VALUE_32BITS && (this.localHeaderOffset = e2.readInt(8)), this.diskNumberStart === s.MAX_VALUE_32BITS && (this.diskNumberStart = e2.readInt(4));
            }
          }, readExtraFields: function(e2) {
            var t2, r2, n2, i2 = e2.index + this.extraFieldsLength;
            for (this.extraFields || (this.extraFields = {}); e2.index + 4 < i2; )
              t2 = e2.readInt(2), r2 = e2.readInt(2), n2 = e2.readData(r2), this.extraFields[t2] = { id: t2, length: r2, value: n2 };
            e2.setIndex(i2);
          }, handleUTF8: function() {
            var e2 = u.uint8array ? "uint8array" : "array";
            if (this.useUTF8())
              this.fileNameStr = o.utf8decode(this.fileName), this.fileCommentStr = o.utf8decode(this.fileComment);
            else {
              var t2 = this.findExtraFieldUnicodePath();
              if (t2 !== null)
                this.fileNameStr = t2;
              else {
                var r2 = s.transformTo(e2, this.fileName);
                this.fileNameStr = this.loadOptions.decodeFileName(r2);
              }
              var n2 = this.findExtraFieldUnicodeComment();
              if (n2 !== null)
                this.fileCommentStr = n2;
              else {
                var i2 = s.transformTo(e2, this.fileComment);
                this.fileCommentStr = this.loadOptions.decodeFileName(i2);
              }
            }
          }, findExtraFieldUnicodePath: function() {
            var e2 = this.extraFields[28789];
            if (e2) {
              var t2 = n(e2.value);
              return t2.readInt(1) !== 1 ? null : a(this.fileName) !== t2.readInt(4) ? null : o.utf8decode(t2.readData(e2.length - 5));
            }
            return null;
          }, findExtraFieldUnicodeComment: function() {
            var e2 = this.extraFields[25461];
            if (e2) {
              var t2 = n(e2.value);
              return t2.readInt(1) !== 1 ? null : a(this.fileComment) !== t2.readInt(4) ? null : o.utf8decode(t2.readData(e2.length - 5));
            }
            return null;
          } }, t.exports = l;
        }, { "./compressedObject": 2, "./compressions": 3, "./crc32": 4, "./reader/readerFor": 22, "./support": 30, "./utf8": 31, "./utils": 32 }], 35: [function(e, t, r) {
          "use strict";
          function n(e2, t2, r2) {
            this.name = e2, this.dir = r2.dir, this.date = r2.date, this.comment = r2.comment, this.unixPermissions = r2.unixPermissions, this.dosPermissions = r2.dosPermissions, this._data = t2, this._dataBinary = r2.binary, this.options = { compression: r2.compression, compressionOptions: r2.compressionOptions };
          }
          var s = e("./stream/StreamHelper"), i = e("./stream/DataWorker"), a = e("./utf8"), o = e("./compressedObject"), h = e("./stream/GenericWorker");
          n.prototype = { internalStream: function(e2) {
            var t2 = null, r2 = "string";
            try {
              if (!e2)
                throw new Error("No output type specified.");
              var n2 = (r2 = e2.toLowerCase()) === "string" || r2 === "text";
              r2 !== "binarystring" && r2 !== "text" || (r2 = "string"), t2 = this._decompressWorker();
              var i2 = !this._dataBinary;
              i2 && !n2 && (t2 = t2.pipe(new a.Utf8EncodeWorker())), !i2 && n2 && (t2 = t2.pipe(new a.Utf8DecodeWorker()));
            } catch (e3) {
              (t2 = new h("error")).error(e3);
            }
            return new s(t2, r2, "");
          }, async: function(e2, t2) {
            return this.internalStream(e2).accumulate(t2);
          }, nodeStream: function(e2, t2) {
            return this.internalStream(e2 || "nodebuffer").toNodejsStream(t2);
          }, _compressWorker: function(e2, t2) {
            if (this._data instanceof o && this._data.compression.magic === e2.magic)
              return this._data.getCompressedWorker();
            var r2 = this._decompressWorker();
            return this._dataBinary || (r2 = r2.pipe(new a.Utf8EncodeWorker())), o.createWorkerFrom(r2, e2, t2);
          }, _decompressWorker: function() {
            return this._data instanceof o ? this._data.getContentWorker() : this._data instanceof h ? this._data : new i(this._data);
          } };
          for (var u = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], l = function() {
            throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
          }, f = 0; f < u.length; f++)
            n.prototype[u[f]] = l;
          t.exports = n;
        }, { "./compressedObject": 2, "./stream/DataWorker": 27, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31 }], 36: [function(e, l, t) {
          (function(t2) {
            "use strict";
            var r, n, e2 = t2.MutationObserver || t2.WebKitMutationObserver;
            if (e2) {
              var i = 0, s = new e2(u), a = t2.document.createTextNode("");
              s.observe(a, { characterData: true }), r = function() {
                a.data = i = ++i % 2;
              };
            } else if (t2.setImmediate || t2.MessageChannel === void 0)
              r = "document" in t2 && "onreadystatechange" in t2.document.createElement("script") ? function() {
                var e3 = t2.document.createElement("script");
                e3.onreadystatechange = function() {
                  u(), e3.onreadystatechange = null, e3.parentNode.removeChild(e3), e3 = null;
                }, t2.document.documentElement.appendChild(e3);
              } : function() {
                setTimeout(u, 0);
              };
            else {
              var o = new t2.MessageChannel();
              o.port1.onmessage = u, r = function() {
                o.port2.postMessage(0);
              };
            }
            var h = [];
            function u() {
              var e3, t3;
              n = true;
              for (var r2 = h.length; r2; ) {
                for (t3 = h, h = [], e3 = -1; ++e3 < r2; )
                  t3[e3]();
                r2 = h.length;
              }
              n = false;
            }
            l.exports = function(e3) {
              h.push(e3) !== 1 || n || r();
            };
          }).call(this, typeof global != "undefined" ? global : typeof self != "undefined" ? self : typeof window != "undefined" ? window : {});
        }, {}], 37: [function(e, t, r) {
          "use strict";
          var i = e("immediate");
          function u() {
          }
          var l = {}, s = ["REJECTED"], a = ["FULFILLED"], n = ["PENDING"];
          function o(e2) {
            if (typeof e2 != "function")
              throw new TypeError("resolver must be a function");
            this.state = n, this.queue = [], this.outcome = void 0, e2 !== u && d(this, e2);
          }
          function h(e2, t2, r2) {
            this.promise = e2, typeof t2 == "function" && (this.onFulfilled = t2, this.callFulfilled = this.otherCallFulfilled), typeof r2 == "function" && (this.onRejected = r2, this.callRejected = this.otherCallRejected);
          }
          function f(t2, r2, n2) {
            i(function() {
              var e2;
              try {
                e2 = r2(n2);
              } catch (e3) {
                return l.reject(t2, e3);
              }
              e2 === t2 ? l.reject(t2, new TypeError("Cannot resolve promise with itself")) : l.resolve(t2, e2);
            });
          }
          function c(e2) {
            var t2 = e2 && e2.then;
            if (e2 && (typeof e2 == "object" || typeof e2 == "function") && typeof t2 == "function")
              return function() {
                t2.apply(e2, arguments);
              };
          }
          function d(t2, e2) {
            var r2 = false;
            function n2(e3) {
              r2 || (r2 = true, l.reject(t2, e3));
            }
            function i2(e3) {
              r2 || (r2 = true, l.resolve(t2, e3));
            }
            var s2 = p(function() {
              e2(i2, n2);
            });
            s2.status === "error" && n2(s2.value);
          }
          function p(e2, t2) {
            var r2 = {};
            try {
              r2.value = e2(t2), r2.status = "success";
            } catch (e3) {
              r2.status = "error", r2.value = e3;
            }
            return r2;
          }
          (t.exports = o).prototype.finally = function(t2) {
            if (typeof t2 != "function")
              return this;
            var r2 = this.constructor;
            return this.then(function(e2) {
              return r2.resolve(t2()).then(function() {
                return e2;
              });
            }, function(e2) {
              return r2.resolve(t2()).then(function() {
                throw e2;
              });
            });
          }, o.prototype.catch = function(e2) {
            return this.then(null, e2);
          }, o.prototype.then = function(e2, t2) {
            if (typeof e2 != "function" && this.state === a || typeof t2 != "function" && this.state === s)
              return this;
            var r2 = new this.constructor(u);
            this.state !== n ? f(r2, this.state === a ? e2 : t2, this.outcome) : this.queue.push(new h(r2, e2, t2));
            return r2;
          }, h.prototype.callFulfilled = function(e2) {
            l.resolve(this.promise, e2);
          }, h.prototype.otherCallFulfilled = function(e2) {
            f(this.promise, this.onFulfilled, e2);
          }, h.prototype.callRejected = function(e2) {
            l.reject(this.promise, e2);
          }, h.prototype.otherCallRejected = function(e2) {
            f(this.promise, this.onRejected, e2);
          }, l.resolve = function(e2, t2) {
            var r2 = p(c, t2);
            if (r2.status === "error")
              return l.reject(e2, r2.value);
            var n2 = r2.value;
            if (n2)
              d(e2, n2);
            else {
              e2.state = a, e2.outcome = t2;
              for (var i2 = -1, s2 = e2.queue.length; ++i2 < s2; )
                e2.queue[i2].callFulfilled(t2);
            }
            return e2;
          }, l.reject = function(e2, t2) {
            e2.state = s, e2.outcome = t2;
            for (var r2 = -1, n2 = e2.queue.length; ++r2 < n2; )
              e2.queue[r2].callRejected(t2);
            return e2;
          }, o.resolve = function(e2) {
            if (e2 instanceof this)
              return e2;
            return l.resolve(new this(u), e2);
          }, o.reject = function(e2) {
            var t2 = new this(u);
            return l.reject(t2, e2);
          }, o.all = function(e2) {
            var r2 = this;
            if (Object.prototype.toString.call(e2) !== "[object Array]")
              return this.reject(new TypeError("must be an array"));
            var n2 = e2.length, i2 = false;
            if (!n2)
              return this.resolve([]);
            var s2 = new Array(n2), a2 = 0, t2 = -1, o2 = new this(u);
            for (; ++t2 < n2; )
              h2(e2[t2], t2);
            return o2;
            function h2(e3, t3) {
              r2.resolve(e3).then(function(e4) {
                s2[t3] = e4, ++a2 !== n2 || i2 || (i2 = true, l.resolve(o2, s2));
              }, function(e4) {
                i2 || (i2 = true, l.reject(o2, e4));
              });
            }
          }, o.race = function(e2) {
            var t2 = this;
            if (Object.prototype.toString.call(e2) !== "[object Array]")
              return this.reject(new TypeError("must be an array"));
            var r2 = e2.length, n2 = false;
            if (!r2)
              return this.resolve([]);
            var i2 = -1, s2 = new this(u);
            for (; ++i2 < r2; )
              a2 = e2[i2], t2.resolve(a2).then(function(e3) {
                n2 || (n2 = true, l.resolve(s2, e3));
              }, function(e3) {
                n2 || (n2 = true, l.reject(s2, e3));
              });
            var a2;
            return s2;
          };
        }, { immediate: 36 }], 38: [function(e, t, r) {
          "use strict";
          var n = {};
          (0, e("./lib/utils/common").assign)(n, e("./lib/deflate"), e("./lib/inflate"), e("./lib/zlib/constants")), t.exports = n;
        }, { "./lib/deflate": 39, "./lib/inflate": 40, "./lib/utils/common": 41, "./lib/zlib/constants": 44 }], 39: [function(e, t, r) {
          "use strict";
          var a = e("./zlib/deflate"), o = e("./utils/common"), h = e("./utils/strings"), i = e("./zlib/messages"), s = e("./zlib/zstream"), u = Object.prototype.toString, l = 0, f = -1, c = 0, d = 8;
          function p(e2) {
            if (!(this instanceof p))
              return new p(e2);
            this.options = o.assign({ level: f, method: d, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: c, to: "" }, e2 || {});
            var t2 = this.options;
            t2.raw && 0 < t2.windowBits ? t2.windowBits = -t2.windowBits : t2.gzip && 0 < t2.windowBits && t2.windowBits < 16 && (t2.windowBits += 16), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new s(), this.strm.avail_out = 0;
            var r2 = a.deflateInit2(this.strm, t2.level, t2.method, t2.windowBits, t2.memLevel, t2.strategy);
            if (r2 !== l)
              throw new Error(i[r2]);
            if (t2.header && a.deflateSetHeader(this.strm, t2.header), t2.dictionary) {
              var n2;
              if (n2 = typeof t2.dictionary == "string" ? h.string2buf(t2.dictionary) : u.call(t2.dictionary) === "[object ArrayBuffer]" ? new Uint8Array(t2.dictionary) : t2.dictionary, (r2 = a.deflateSetDictionary(this.strm, n2)) !== l)
                throw new Error(i[r2]);
              this._dict_set = true;
            }
          }
          function n(e2, t2) {
            var r2 = new p(t2);
            if (r2.push(e2, true), r2.err)
              throw r2.msg || i[r2.err];
            return r2.result;
          }
          p.prototype.push = function(e2, t2) {
            var r2, n2, i2 = this.strm, s2 = this.options.chunkSize;
            if (this.ended)
              return false;
            n2 = t2 === ~~t2 ? t2 : t2 === true ? 4 : 0, typeof e2 == "string" ? i2.input = h.string2buf(e2) : u.call(e2) === "[object ArrayBuffer]" ? i2.input = new Uint8Array(e2) : i2.input = e2, i2.next_in = 0, i2.avail_in = i2.input.length;
            do {
              if (i2.avail_out === 0 && (i2.output = new o.Buf8(s2), i2.next_out = 0, i2.avail_out = s2), (r2 = a.deflate(i2, n2)) !== 1 && r2 !== l)
                return this.onEnd(r2), !(this.ended = true);
              i2.avail_out !== 0 && (i2.avail_in !== 0 || n2 !== 4 && n2 !== 2) || (this.options.to === "string" ? this.onData(h.buf2binstring(o.shrinkBuf(i2.output, i2.next_out))) : this.onData(o.shrinkBuf(i2.output, i2.next_out)));
            } while ((0 < i2.avail_in || i2.avail_out === 0) && r2 !== 1);
            return n2 === 4 ? (r2 = a.deflateEnd(this.strm), this.onEnd(r2), this.ended = true, r2 === l) : n2 !== 2 || (this.onEnd(l), !(i2.avail_out = 0));
          }, p.prototype.onData = function(e2) {
            this.chunks.push(e2);
          }, p.prototype.onEnd = function(e2) {
            e2 === l && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = o.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
          }, r.Deflate = p, r.deflate = n, r.deflateRaw = function(e2, t2) {
            return (t2 = t2 || {}).raw = true, n(e2, t2);
          }, r.gzip = function(e2, t2) {
            return (t2 = t2 || {}).gzip = true, n(e2, t2);
          };
        }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/deflate": 46, "./zlib/messages": 51, "./zlib/zstream": 53 }], 40: [function(e, t, r) {
          "use strict";
          var c = e("./zlib/inflate"), d = e("./utils/common"), p = e("./utils/strings"), m = e("./zlib/constants"), n = e("./zlib/messages"), i = e("./zlib/zstream"), s = e("./zlib/gzheader"), _ = Object.prototype.toString;
          function a(e2) {
            if (!(this instanceof a))
              return new a(e2);
            this.options = d.assign({ chunkSize: 16384, windowBits: 0, to: "" }, e2 || {});
            var t2 = this.options;
            t2.raw && 0 <= t2.windowBits && t2.windowBits < 16 && (t2.windowBits = -t2.windowBits, t2.windowBits === 0 && (t2.windowBits = -15)), !(0 <= t2.windowBits && t2.windowBits < 16) || e2 && e2.windowBits || (t2.windowBits += 32), 15 < t2.windowBits && t2.windowBits < 48 && (15 & t2.windowBits) == 0 && (t2.windowBits |= 15), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new i(), this.strm.avail_out = 0;
            var r2 = c.inflateInit2(this.strm, t2.windowBits);
            if (r2 !== m.Z_OK)
              throw new Error(n[r2]);
            this.header = new s(), c.inflateGetHeader(this.strm, this.header);
          }
          function o(e2, t2) {
            var r2 = new a(t2);
            if (r2.push(e2, true), r2.err)
              throw r2.msg || n[r2.err];
            return r2.result;
          }
          a.prototype.push = function(e2, t2) {
            var r2, n2, i2, s2, a2, o2, h = this.strm, u = this.options.chunkSize, l = this.options.dictionary, f = false;
            if (this.ended)
              return false;
            n2 = t2 === ~~t2 ? t2 : t2 === true ? m.Z_FINISH : m.Z_NO_FLUSH, typeof e2 == "string" ? h.input = p.binstring2buf(e2) : _.call(e2) === "[object ArrayBuffer]" ? h.input = new Uint8Array(e2) : h.input = e2, h.next_in = 0, h.avail_in = h.input.length;
            do {
              if (h.avail_out === 0 && (h.output = new d.Buf8(u), h.next_out = 0, h.avail_out = u), (r2 = c.inflate(h, m.Z_NO_FLUSH)) === m.Z_NEED_DICT && l && (o2 = typeof l == "string" ? p.string2buf(l) : _.call(l) === "[object ArrayBuffer]" ? new Uint8Array(l) : l, r2 = c.inflateSetDictionary(this.strm, o2)), r2 === m.Z_BUF_ERROR && f === true && (r2 = m.Z_OK, f = false), r2 !== m.Z_STREAM_END && r2 !== m.Z_OK)
                return this.onEnd(r2), !(this.ended = true);
              h.next_out && (h.avail_out !== 0 && r2 !== m.Z_STREAM_END && (h.avail_in !== 0 || n2 !== m.Z_FINISH && n2 !== m.Z_SYNC_FLUSH) || (this.options.to === "string" ? (i2 = p.utf8border(h.output, h.next_out), s2 = h.next_out - i2, a2 = p.buf2string(h.output, i2), h.next_out = s2, h.avail_out = u - s2, s2 && d.arraySet(h.output, h.output, i2, s2, 0), this.onData(a2)) : this.onData(d.shrinkBuf(h.output, h.next_out)))), h.avail_in === 0 && h.avail_out === 0 && (f = true);
            } while ((0 < h.avail_in || h.avail_out === 0) && r2 !== m.Z_STREAM_END);
            return r2 === m.Z_STREAM_END && (n2 = m.Z_FINISH), n2 === m.Z_FINISH ? (r2 = c.inflateEnd(this.strm), this.onEnd(r2), this.ended = true, r2 === m.Z_OK) : n2 !== m.Z_SYNC_FLUSH || (this.onEnd(m.Z_OK), !(h.avail_out = 0));
          }, a.prototype.onData = function(e2) {
            this.chunks.push(e2);
          }, a.prototype.onEnd = function(e2) {
            e2 === m.Z_OK && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = d.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
          }, r.Inflate = a, r.inflate = o, r.inflateRaw = function(e2, t2) {
            return (t2 = t2 || {}).raw = true, o(e2, t2);
          }, r.ungzip = o;
        }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/constants": 44, "./zlib/gzheader": 47, "./zlib/inflate": 49, "./zlib/messages": 51, "./zlib/zstream": 53 }], 41: [function(e, t, r) {
          "use strict";
          var n = typeof Uint8Array != "undefined" && typeof Uint16Array != "undefined" && typeof Int32Array != "undefined";
          r.assign = function(e2) {
            for (var t2 = Array.prototype.slice.call(arguments, 1); t2.length; ) {
              var r2 = t2.shift();
              if (r2) {
                if (typeof r2 != "object")
                  throw new TypeError(r2 + "must be non-object");
                for (var n2 in r2)
                  r2.hasOwnProperty(n2) && (e2[n2] = r2[n2]);
              }
            }
            return e2;
          }, r.shrinkBuf = function(e2, t2) {
            return e2.length === t2 ? e2 : e2.subarray ? e2.subarray(0, t2) : (e2.length = t2, e2);
          };
          var i = { arraySet: function(e2, t2, r2, n2, i2) {
            if (t2.subarray && e2.subarray)
              e2.set(t2.subarray(r2, r2 + n2), i2);
            else
              for (var s2 = 0; s2 < n2; s2++)
                e2[i2 + s2] = t2[r2 + s2];
          }, flattenChunks: function(e2) {
            var t2, r2, n2, i2, s2, a;
            for (t2 = n2 = 0, r2 = e2.length; t2 < r2; t2++)
              n2 += e2[t2].length;
            for (a = new Uint8Array(n2), t2 = i2 = 0, r2 = e2.length; t2 < r2; t2++)
              s2 = e2[t2], a.set(s2, i2), i2 += s2.length;
            return a;
          } }, s = { arraySet: function(e2, t2, r2, n2, i2) {
            for (var s2 = 0; s2 < n2; s2++)
              e2[i2 + s2] = t2[r2 + s2];
          }, flattenChunks: function(e2) {
            return [].concat.apply([], e2);
          } };
          r.setTyped = function(e2) {
            e2 ? (r.Buf8 = Uint8Array, r.Buf16 = Uint16Array, r.Buf32 = Int32Array, r.assign(r, i)) : (r.Buf8 = Array, r.Buf16 = Array, r.Buf32 = Array, r.assign(r, s));
          }, r.setTyped(n);
        }, {}], 42: [function(e, t, r) {
          "use strict";
          var h = e("./common"), i = true, s = true;
          try {
            String.fromCharCode.apply(null, [0]);
          } catch (e2) {
            i = false;
          }
          try {
            String.fromCharCode.apply(null, new Uint8Array(1));
          } catch (e2) {
            s = false;
          }
          for (var u = new h.Buf8(256), n = 0; n < 256; n++)
            u[n] = 252 <= n ? 6 : 248 <= n ? 5 : 240 <= n ? 4 : 224 <= n ? 3 : 192 <= n ? 2 : 1;
          function l(e2, t2) {
            if (t2 < 65537 && (e2.subarray && s || !e2.subarray && i))
              return String.fromCharCode.apply(null, h.shrinkBuf(e2, t2));
            for (var r2 = "", n2 = 0; n2 < t2; n2++)
              r2 += String.fromCharCode(e2[n2]);
            return r2;
          }
          u[254] = u[254] = 1, r.string2buf = function(e2) {
            var t2, r2, n2, i2, s2, a = e2.length, o = 0;
            for (i2 = 0; i2 < a; i2++)
              (64512 & (r2 = e2.charCodeAt(i2))) == 55296 && i2 + 1 < a && (64512 & (n2 = e2.charCodeAt(i2 + 1))) == 56320 && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), o += r2 < 128 ? 1 : r2 < 2048 ? 2 : r2 < 65536 ? 3 : 4;
            for (t2 = new h.Buf8(o), i2 = s2 = 0; s2 < o; i2++)
              (64512 & (r2 = e2.charCodeAt(i2))) == 55296 && i2 + 1 < a && (64512 & (n2 = e2.charCodeAt(i2 + 1))) == 56320 && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), r2 < 128 ? t2[s2++] = r2 : (r2 < 2048 ? t2[s2++] = 192 | r2 >>> 6 : (r2 < 65536 ? t2[s2++] = 224 | r2 >>> 12 : (t2[s2++] = 240 | r2 >>> 18, t2[s2++] = 128 | r2 >>> 12 & 63), t2[s2++] = 128 | r2 >>> 6 & 63), t2[s2++] = 128 | 63 & r2);
            return t2;
          }, r.buf2binstring = function(e2) {
            return l(e2, e2.length);
          }, r.binstring2buf = function(e2) {
            for (var t2 = new h.Buf8(e2.length), r2 = 0, n2 = t2.length; r2 < n2; r2++)
              t2[r2] = e2.charCodeAt(r2);
            return t2;
          }, r.buf2string = function(e2, t2) {
            var r2, n2, i2, s2, a = t2 || e2.length, o = new Array(2 * a);
            for (r2 = n2 = 0; r2 < a; )
              if ((i2 = e2[r2++]) < 128)
                o[n2++] = i2;
              else if (4 < (s2 = u[i2]))
                o[n2++] = 65533, r2 += s2 - 1;
              else {
                for (i2 &= s2 === 2 ? 31 : s2 === 3 ? 15 : 7; 1 < s2 && r2 < a; )
                  i2 = i2 << 6 | 63 & e2[r2++], s2--;
                1 < s2 ? o[n2++] = 65533 : i2 < 65536 ? o[n2++] = i2 : (i2 -= 65536, o[n2++] = 55296 | i2 >> 10 & 1023, o[n2++] = 56320 | 1023 & i2);
              }
            return l(o, n2);
          }, r.utf8border = function(e2, t2) {
            var r2;
            for ((t2 = t2 || e2.length) > e2.length && (t2 = e2.length), r2 = t2 - 1; 0 <= r2 && (192 & e2[r2]) == 128; )
              r2--;
            return r2 < 0 ? t2 : r2 === 0 ? t2 : r2 + u[e2[r2]] > t2 ? r2 : t2;
          };
        }, { "./common": 41 }], 43: [function(e, t, r) {
          "use strict";
          t.exports = function(e2, t2, r2, n) {
            for (var i = 65535 & e2 | 0, s = e2 >>> 16 & 65535 | 0, a = 0; r2 !== 0; ) {
              for (r2 -= a = 2e3 < r2 ? 2e3 : r2; s = s + (i = i + t2[n++] | 0) | 0, --a; )
                ;
              i %= 65521, s %= 65521;
            }
            return i | s << 16 | 0;
          };
        }, {}], 44: [function(e, t, r) {
          "use strict";
          t.exports = { Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_TREES: 6, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_BUF_ERROR: -5, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, Z_BINARY: 0, Z_TEXT: 1, Z_UNKNOWN: 2, Z_DEFLATED: 8 };
        }, {}], 45: [function(e, t, r) {
          "use strict";
          var o = function() {
            for (var e2, t2 = [], r2 = 0; r2 < 256; r2++) {
              e2 = r2;
              for (var n = 0; n < 8; n++)
                e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
              t2[r2] = e2;
            }
            return t2;
          }();
          t.exports = function(e2, t2, r2, n) {
            var i = o, s = n + r2;
            e2 ^= -1;
            for (var a = n; a < s; a++)
              e2 = e2 >>> 8 ^ i[255 & (e2 ^ t2[a])];
            return -1 ^ e2;
          };
        }, {}], 46: [function(e, t, r) {
          "use strict";
          var h, c = e("../utils/common"), u = e("./trees"), d = e("./adler32"), p = e("./crc32"), n = e("./messages"), l = 0, f = 4, m = 0, _ = -2, g = -1, b = 4, i = 2, v = 8, y = 9, s = 286, a = 30, o = 19, w = 2 * s + 1, k = 15, x = 3, S = 258, z = S + x + 1, C = 42, E = 113, A = 1, I = 2, O = 3, B = 4;
          function R(e2, t2) {
            return e2.msg = n[t2], t2;
          }
          function T(e2) {
            return (e2 << 1) - (4 < e2 ? 9 : 0);
          }
          function D(e2) {
            for (var t2 = e2.length; 0 <= --t2; )
              e2[t2] = 0;
          }
          function F(e2) {
            var t2 = e2.state, r2 = t2.pending;
            r2 > e2.avail_out && (r2 = e2.avail_out), r2 !== 0 && (c.arraySet(e2.output, t2.pending_buf, t2.pending_out, r2, e2.next_out), e2.next_out += r2, t2.pending_out += r2, e2.total_out += r2, e2.avail_out -= r2, t2.pending -= r2, t2.pending === 0 && (t2.pending_out = 0));
          }
          function N(e2, t2) {
            u._tr_flush_block(e2, 0 <= e2.block_start ? e2.block_start : -1, e2.strstart - e2.block_start, t2), e2.block_start = e2.strstart, F(e2.strm);
          }
          function U(e2, t2) {
            e2.pending_buf[e2.pending++] = t2;
          }
          function P(e2, t2) {
            e2.pending_buf[e2.pending++] = t2 >>> 8 & 255, e2.pending_buf[e2.pending++] = 255 & t2;
          }
          function L(e2, t2) {
            var r2, n2, i2 = e2.max_chain_length, s2 = e2.strstart, a2 = e2.prev_length, o2 = e2.nice_match, h2 = e2.strstart > e2.w_size - z ? e2.strstart - (e2.w_size - z) : 0, u2 = e2.window, l2 = e2.w_mask, f2 = e2.prev, c2 = e2.strstart + S, d2 = u2[s2 + a2 - 1], p2 = u2[s2 + a2];
            e2.prev_length >= e2.good_match && (i2 >>= 2), o2 > e2.lookahead && (o2 = e2.lookahead);
            do {
              if (u2[(r2 = t2) + a2] === p2 && u2[r2 + a2 - 1] === d2 && u2[r2] === u2[s2] && u2[++r2] === u2[s2 + 1]) {
                s2 += 2, r2++;
                do {
                } while (u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && s2 < c2);
                if (n2 = S - (c2 - s2), s2 = c2 - S, a2 < n2) {
                  if (e2.match_start = t2, o2 <= (a2 = n2))
                    break;
                  d2 = u2[s2 + a2 - 1], p2 = u2[s2 + a2];
                }
              }
            } while ((t2 = f2[t2 & l2]) > h2 && --i2 != 0);
            return a2 <= e2.lookahead ? a2 : e2.lookahead;
          }
          function j(e2) {
            var t2, r2, n2, i2, s2, a2, o2, h2, u2, l2, f2 = e2.w_size;
            do {
              if (i2 = e2.window_size - e2.lookahead - e2.strstart, e2.strstart >= f2 + (f2 - z)) {
                for (c.arraySet(e2.window, e2.window, f2, f2, 0), e2.match_start -= f2, e2.strstart -= f2, e2.block_start -= f2, t2 = r2 = e2.hash_size; n2 = e2.head[--t2], e2.head[t2] = f2 <= n2 ? n2 - f2 : 0, --r2; )
                  ;
                for (t2 = r2 = f2; n2 = e2.prev[--t2], e2.prev[t2] = f2 <= n2 ? n2 - f2 : 0, --r2; )
                  ;
                i2 += f2;
              }
              if (e2.strm.avail_in === 0)
                break;
              if (a2 = e2.strm, o2 = e2.window, h2 = e2.strstart + e2.lookahead, u2 = i2, l2 = void 0, l2 = a2.avail_in, u2 < l2 && (l2 = u2), r2 = l2 === 0 ? 0 : (a2.avail_in -= l2, c.arraySet(o2, a2.input, a2.next_in, l2, h2), a2.state.wrap === 1 ? a2.adler = d(a2.adler, o2, l2, h2) : a2.state.wrap === 2 && (a2.adler = p(a2.adler, o2, l2, h2)), a2.next_in += l2, a2.total_in += l2, l2), e2.lookahead += r2, e2.lookahead + e2.insert >= x)
                for (s2 = e2.strstart - e2.insert, e2.ins_h = e2.window[s2], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + 1]) & e2.hash_mask; e2.insert && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + x - 1]) & e2.hash_mask, e2.prev[s2 & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = s2, s2++, e2.insert--, !(e2.lookahead + e2.insert < x)); )
                  ;
            } while (e2.lookahead < z && e2.strm.avail_in !== 0);
          }
          function Z(e2, t2) {
            for (var r2, n2; ; ) {
              if (e2.lookahead < z) {
                if (j(e2), e2.lookahead < z && t2 === l)
                  return A;
                if (e2.lookahead === 0)
                  break;
              }
              if (r2 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), r2 !== 0 && e2.strstart - r2 <= e2.w_size - z && (e2.match_length = L(e2, r2)), e2.match_length >= x)
                if (n2 = u._tr_tally(e2, e2.strstart - e2.match_start, e2.match_length - x), e2.lookahead -= e2.match_length, e2.match_length <= e2.max_lazy_match && e2.lookahead >= x) {
                  for (e2.match_length--; e2.strstart++, e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart, --e2.match_length != 0; )
                    ;
                  e2.strstart++;
                } else
                  e2.strstart += e2.match_length, e2.match_length = 0, e2.ins_h = e2.window[e2.strstart], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + 1]) & e2.hash_mask;
              else
                n2 = u._tr_tally(e2, 0, e2.window[e2.strstart]), e2.lookahead--, e2.strstart++;
              if (n2 && (N(e2, false), e2.strm.avail_out === 0))
                return A;
            }
            return e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t2 === f ? (N(e2, true), e2.strm.avail_out === 0 ? O : B) : e2.last_lit && (N(e2, false), e2.strm.avail_out === 0) ? A : I;
          }
          function W(e2, t2) {
            for (var r2, n2, i2; ; ) {
              if (e2.lookahead < z) {
                if (j(e2), e2.lookahead < z && t2 === l)
                  return A;
                if (e2.lookahead === 0)
                  break;
              }
              if (r2 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), e2.prev_length = e2.match_length, e2.prev_match = e2.match_start, e2.match_length = x - 1, r2 !== 0 && e2.prev_length < e2.max_lazy_match && e2.strstart - r2 <= e2.w_size - z && (e2.match_length = L(e2, r2), e2.match_length <= 5 && (e2.strategy === 1 || e2.match_length === x && 4096 < e2.strstart - e2.match_start) && (e2.match_length = x - 1)), e2.prev_length >= x && e2.match_length <= e2.prev_length) {
                for (i2 = e2.strstart + e2.lookahead - x, n2 = u._tr_tally(e2, e2.strstart - 1 - e2.prev_match, e2.prev_length - x), e2.lookahead -= e2.prev_length - 1, e2.prev_length -= 2; ++e2.strstart <= i2 && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), --e2.prev_length != 0; )
                  ;
                if (e2.match_available = 0, e2.match_length = x - 1, e2.strstart++, n2 && (N(e2, false), e2.strm.avail_out === 0))
                  return A;
              } else if (e2.match_available) {
                if ((n2 = u._tr_tally(e2, 0, e2.window[e2.strstart - 1])) && N(e2, false), e2.strstart++, e2.lookahead--, e2.strm.avail_out === 0)
                  return A;
              } else
                e2.match_available = 1, e2.strstart++, e2.lookahead--;
            }
            return e2.match_available && (n2 = u._tr_tally(e2, 0, e2.window[e2.strstart - 1]), e2.match_available = 0), e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t2 === f ? (N(e2, true), e2.strm.avail_out === 0 ? O : B) : e2.last_lit && (N(e2, false), e2.strm.avail_out === 0) ? A : I;
          }
          function M(e2, t2, r2, n2, i2) {
            this.good_length = e2, this.max_lazy = t2, this.nice_length = r2, this.max_chain = n2, this.func = i2;
          }
          function H() {
            this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = v, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new c.Buf16(2 * w), this.dyn_dtree = new c.Buf16(2 * (2 * a + 1)), this.bl_tree = new c.Buf16(2 * (2 * o + 1)), D(this.dyn_ltree), D(this.dyn_dtree), D(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new c.Buf16(k + 1), this.heap = new c.Buf16(2 * s + 1), D(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new c.Buf16(2 * s + 1), D(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
          }
          function G(e2) {
            var t2;
            return e2 && e2.state ? (e2.total_in = e2.total_out = 0, e2.data_type = i, (t2 = e2.state).pending = 0, t2.pending_out = 0, t2.wrap < 0 && (t2.wrap = -t2.wrap), t2.status = t2.wrap ? C : E, e2.adler = t2.wrap === 2 ? 0 : 1, t2.last_flush = l, u._tr_init(t2), m) : R(e2, _);
          }
          function K(e2) {
            var t2 = G(e2);
            return t2 === m && function(e3) {
              e3.window_size = 2 * e3.w_size, D(e3.head), e3.max_lazy_match = h[e3.level].max_lazy, e3.good_match = h[e3.level].good_length, e3.nice_match = h[e3.level].nice_length, e3.max_chain_length = h[e3.level].max_chain, e3.strstart = 0, e3.block_start = 0, e3.lookahead = 0, e3.insert = 0, e3.match_length = e3.prev_length = x - 1, e3.match_available = 0, e3.ins_h = 0;
            }(e2.state), t2;
          }
          function Y(e2, t2, r2, n2, i2, s2) {
            if (!e2)
              return _;
            var a2 = 1;
            if (t2 === g && (t2 = 6), n2 < 0 ? (a2 = 0, n2 = -n2) : 15 < n2 && (a2 = 2, n2 -= 16), i2 < 1 || y < i2 || r2 !== v || n2 < 8 || 15 < n2 || t2 < 0 || 9 < t2 || s2 < 0 || b < s2)
              return R(e2, _);
            n2 === 8 && (n2 = 9);
            var o2 = new H();
            return (e2.state = o2).strm = e2, o2.wrap = a2, o2.gzhead = null, o2.w_bits = n2, o2.w_size = 1 << o2.w_bits, o2.w_mask = o2.w_size - 1, o2.hash_bits = i2 + 7, o2.hash_size = 1 << o2.hash_bits, o2.hash_mask = o2.hash_size - 1, o2.hash_shift = ~~((o2.hash_bits + x - 1) / x), o2.window = new c.Buf8(2 * o2.w_size), o2.head = new c.Buf16(o2.hash_size), o2.prev = new c.Buf16(o2.w_size), o2.lit_bufsize = 1 << i2 + 6, o2.pending_buf_size = 4 * o2.lit_bufsize, o2.pending_buf = new c.Buf8(o2.pending_buf_size), o2.d_buf = 1 * o2.lit_bufsize, o2.l_buf = 3 * o2.lit_bufsize, o2.level = t2, o2.strategy = s2, o2.method = r2, K(e2);
          }
          h = [new M(0, 0, 0, 0, function(e2, t2) {
            var r2 = 65535;
            for (r2 > e2.pending_buf_size - 5 && (r2 = e2.pending_buf_size - 5); ; ) {
              if (e2.lookahead <= 1) {
                if (j(e2), e2.lookahead === 0 && t2 === l)
                  return A;
                if (e2.lookahead === 0)
                  break;
              }
              e2.strstart += e2.lookahead, e2.lookahead = 0;
              var n2 = e2.block_start + r2;
              if ((e2.strstart === 0 || e2.strstart >= n2) && (e2.lookahead = e2.strstart - n2, e2.strstart = n2, N(e2, false), e2.strm.avail_out === 0))
                return A;
              if (e2.strstart - e2.block_start >= e2.w_size - z && (N(e2, false), e2.strm.avail_out === 0))
                return A;
            }
            return e2.insert = 0, t2 === f ? (N(e2, true), e2.strm.avail_out === 0 ? O : B) : (e2.strstart > e2.block_start && (N(e2, false), e2.strm.avail_out), A);
          }), new M(4, 4, 8, 4, Z), new M(4, 5, 16, 8, Z), new M(4, 6, 32, 32, Z), new M(4, 4, 16, 16, W), new M(8, 16, 32, 32, W), new M(8, 16, 128, 128, W), new M(8, 32, 128, 256, W), new M(32, 128, 258, 1024, W), new M(32, 258, 258, 4096, W)], r.deflateInit = function(e2, t2) {
            return Y(e2, t2, v, 15, 8, 0);
          }, r.deflateInit2 = Y, r.deflateReset = K, r.deflateResetKeep = G, r.deflateSetHeader = function(e2, t2) {
            return e2 && e2.state ? e2.state.wrap !== 2 ? _ : (e2.state.gzhead = t2, m) : _;
          }, r.deflate = function(e2, t2) {
            var r2, n2, i2, s2;
            if (!e2 || !e2.state || 5 < t2 || t2 < 0)
              return e2 ? R(e2, _) : _;
            if (n2 = e2.state, !e2.output || !e2.input && e2.avail_in !== 0 || n2.status === 666 && t2 !== f)
              return R(e2, e2.avail_out === 0 ? -5 : _);
            if (n2.strm = e2, r2 = n2.last_flush, n2.last_flush = t2, n2.status === C)
              if (n2.wrap === 2)
                e2.adler = 0, U(n2, 31), U(n2, 139), U(n2, 8), n2.gzhead ? (U(n2, (n2.gzhead.text ? 1 : 0) + (n2.gzhead.hcrc ? 2 : 0) + (n2.gzhead.extra ? 4 : 0) + (n2.gzhead.name ? 8 : 0) + (n2.gzhead.comment ? 16 : 0)), U(n2, 255 & n2.gzhead.time), U(n2, n2.gzhead.time >> 8 & 255), U(n2, n2.gzhead.time >> 16 & 255), U(n2, n2.gzhead.time >> 24 & 255), U(n2, n2.level === 9 ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 255 & n2.gzhead.os), n2.gzhead.extra && n2.gzhead.extra.length && (U(n2, 255 & n2.gzhead.extra.length), U(n2, n2.gzhead.extra.length >> 8 & 255)), n2.gzhead.hcrc && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending, 0)), n2.gzindex = 0, n2.status = 69) : (U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, n2.level === 9 ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 3), n2.status = E);
              else {
                var a2 = v + (n2.w_bits - 8 << 4) << 8;
                a2 |= (2 <= n2.strategy || n2.level < 2 ? 0 : n2.level < 6 ? 1 : n2.level === 6 ? 2 : 3) << 6, n2.strstart !== 0 && (a2 |= 32), a2 += 31 - a2 % 31, n2.status = E, P(n2, a2), n2.strstart !== 0 && (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), e2.adler = 1;
              }
            if (n2.status === 69)
              if (n2.gzhead.extra) {
                for (i2 = n2.pending; n2.gzindex < (65535 & n2.gzhead.extra.length) && (n2.pending !== n2.pending_buf_size || (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending !== n2.pending_buf_size)); )
                  U(n2, 255 & n2.gzhead.extra[n2.gzindex]), n2.gzindex++;
                n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), n2.gzindex === n2.gzhead.extra.length && (n2.gzindex = 0, n2.status = 73);
              } else
                n2.status = 73;
            if (n2.status === 73)
              if (n2.gzhead.name) {
                i2 = n2.pending;
                do {
                  if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                    s2 = 1;
                    break;
                  }
                  s2 = n2.gzindex < n2.gzhead.name.length ? 255 & n2.gzhead.name.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
                } while (s2 !== 0);
                n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), s2 === 0 && (n2.gzindex = 0, n2.status = 91);
              } else
                n2.status = 91;
            if (n2.status === 91)
              if (n2.gzhead.comment) {
                i2 = n2.pending;
                do {
                  if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                    s2 = 1;
                    break;
                  }
                  s2 = n2.gzindex < n2.gzhead.comment.length ? 255 & n2.gzhead.comment.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
                } while (s2 !== 0);
                n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), s2 === 0 && (n2.status = 103);
              } else
                n2.status = 103;
            if (n2.status === 103 && (n2.gzhead.hcrc ? (n2.pending + 2 > n2.pending_buf_size && F(e2), n2.pending + 2 <= n2.pending_buf_size && (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), e2.adler = 0, n2.status = E)) : n2.status = E), n2.pending !== 0) {
              if (F(e2), e2.avail_out === 0)
                return n2.last_flush = -1, m;
            } else if (e2.avail_in === 0 && T(t2) <= T(r2) && t2 !== f)
              return R(e2, -5);
            if (n2.status === 666 && e2.avail_in !== 0)
              return R(e2, -5);
            if (e2.avail_in !== 0 || n2.lookahead !== 0 || t2 !== l && n2.status !== 666) {
              var o2 = n2.strategy === 2 ? function(e3, t3) {
                for (var r3; ; ) {
                  if (e3.lookahead === 0 && (j(e3), e3.lookahead === 0)) {
                    if (t3 === l)
                      return A;
                    break;
                  }
                  if (e3.match_length = 0, r3 = u._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++, r3 && (N(e3, false), e3.strm.avail_out === 0))
                    return A;
                }
                return e3.insert = 0, t3 === f ? (N(e3, true), e3.strm.avail_out === 0 ? O : B) : e3.last_lit && (N(e3, false), e3.strm.avail_out === 0) ? A : I;
              }(n2, t2) : n2.strategy === 3 ? function(e3, t3) {
                for (var r3, n3, i3, s3, a3 = e3.window; ; ) {
                  if (e3.lookahead <= S) {
                    if (j(e3), e3.lookahead <= S && t3 === l)
                      return A;
                    if (e3.lookahead === 0)
                      break;
                  }
                  if (e3.match_length = 0, e3.lookahead >= x && 0 < e3.strstart && (n3 = a3[i3 = e3.strstart - 1]) === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3]) {
                    s3 = e3.strstart + S;
                    do {
                    } while (n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && i3 < s3);
                    e3.match_length = S - (s3 - i3), e3.match_length > e3.lookahead && (e3.match_length = e3.lookahead);
                  }
                  if (e3.match_length >= x ? (r3 = u._tr_tally(e3, 1, e3.match_length - x), e3.lookahead -= e3.match_length, e3.strstart += e3.match_length, e3.match_length = 0) : (r3 = u._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++), r3 && (N(e3, false), e3.strm.avail_out === 0))
                    return A;
                }
                return e3.insert = 0, t3 === f ? (N(e3, true), e3.strm.avail_out === 0 ? O : B) : e3.last_lit && (N(e3, false), e3.strm.avail_out === 0) ? A : I;
              }(n2, t2) : h[n2.level].func(n2, t2);
              if (o2 !== O && o2 !== B || (n2.status = 666), o2 === A || o2 === O)
                return e2.avail_out === 0 && (n2.last_flush = -1), m;
              if (o2 === I && (t2 === 1 ? u._tr_align(n2) : t2 !== 5 && (u._tr_stored_block(n2, 0, 0, false), t2 === 3 && (D(n2.head), n2.lookahead === 0 && (n2.strstart = 0, n2.block_start = 0, n2.insert = 0))), F(e2), e2.avail_out === 0))
                return n2.last_flush = -1, m;
            }
            return t2 !== f ? m : n2.wrap <= 0 ? 1 : (n2.wrap === 2 ? (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), U(n2, e2.adler >> 16 & 255), U(n2, e2.adler >> 24 & 255), U(n2, 255 & e2.total_in), U(n2, e2.total_in >> 8 & 255), U(n2, e2.total_in >> 16 & 255), U(n2, e2.total_in >> 24 & 255)) : (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), F(e2), 0 < n2.wrap && (n2.wrap = -n2.wrap), n2.pending !== 0 ? m : 1);
          }, r.deflateEnd = function(e2) {
            var t2;
            return e2 && e2.state ? (t2 = e2.state.status) !== C && t2 !== 69 && t2 !== 73 && t2 !== 91 && t2 !== 103 && t2 !== E && t2 !== 666 ? R(e2, _) : (e2.state = null, t2 === E ? R(e2, -3) : m) : _;
          }, r.deflateSetDictionary = function(e2, t2) {
            var r2, n2, i2, s2, a2, o2, h2, u2, l2 = t2.length;
            if (!e2 || !e2.state)
              return _;
            if ((s2 = (r2 = e2.state).wrap) === 2 || s2 === 1 && r2.status !== C || r2.lookahead)
              return _;
            for (s2 === 1 && (e2.adler = d(e2.adler, t2, l2, 0)), r2.wrap = 0, l2 >= r2.w_size && (s2 === 0 && (D(r2.head), r2.strstart = 0, r2.block_start = 0, r2.insert = 0), u2 = new c.Buf8(r2.w_size), c.arraySet(u2, t2, l2 - r2.w_size, r2.w_size, 0), t2 = u2, l2 = r2.w_size), a2 = e2.avail_in, o2 = e2.next_in, h2 = e2.input, e2.avail_in = l2, e2.next_in = 0, e2.input = t2, j(r2); r2.lookahead >= x; ) {
              for (n2 = r2.strstart, i2 = r2.lookahead - (x - 1); r2.ins_h = (r2.ins_h << r2.hash_shift ^ r2.window[n2 + x - 1]) & r2.hash_mask, r2.prev[n2 & r2.w_mask] = r2.head[r2.ins_h], r2.head[r2.ins_h] = n2, n2++, --i2; )
                ;
              r2.strstart = n2, r2.lookahead = x - 1, j(r2);
            }
            return r2.strstart += r2.lookahead, r2.block_start = r2.strstart, r2.insert = r2.lookahead, r2.lookahead = 0, r2.match_length = r2.prev_length = x - 1, r2.match_available = 0, e2.next_in = o2, e2.input = h2, e2.avail_in = a2, r2.wrap = s2, m;
          }, r.deflateInfo = "pako deflate (from Nodeca project)";
        }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./messages": 51, "./trees": 52 }], 47: [function(e, t, r) {
          "use strict";
          t.exports = function() {
            this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = false;
          };
        }, {}], 48: [function(e, t, r) {
          "use strict";
          t.exports = function(e2, t2) {
            var r2, n, i, s, a, o, h, u, l, f, c, d, p, m, _, g, b, v, y, w, k, x, S, z, C;
            r2 = e2.state, n = e2.next_in, z = e2.input, i = n + (e2.avail_in - 5), s = e2.next_out, C = e2.output, a = s - (t2 - e2.avail_out), o = s + (e2.avail_out - 257), h = r2.dmax, u = r2.wsize, l = r2.whave, f = r2.wnext, c = r2.window, d = r2.hold, p = r2.bits, m = r2.lencode, _ = r2.distcode, g = (1 << r2.lenbits) - 1, b = (1 << r2.distbits) - 1;
            e:
              do {
                p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = m[d & g];
                t:
                  for (; ; ) {
                    if (d >>>= y = v >>> 24, p -= y, (y = v >>> 16 & 255) === 0)
                      C[s++] = 65535 & v;
                    else {
                      if (!(16 & y)) {
                        if ((64 & y) == 0) {
                          v = m[(65535 & v) + (d & (1 << y) - 1)];
                          continue t;
                        }
                        if (32 & y) {
                          r2.mode = 12;
                          break e;
                        }
                        e2.msg = "invalid literal/length code", r2.mode = 30;
                        break e;
                      }
                      w = 65535 & v, (y &= 15) && (p < y && (d += z[n++] << p, p += 8), w += d & (1 << y) - 1, d >>>= y, p -= y), p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = _[d & b];
                      r:
                        for (; ; ) {
                          if (d >>>= y = v >>> 24, p -= y, !(16 & (y = v >>> 16 & 255))) {
                            if ((64 & y) == 0) {
                              v = _[(65535 & v) + (d & (1 << y) - 1)];
                              continue r;
                            }
                            e2.msg = "invalid distance code", r2.mode = 30;
                            break e;
                          }
                          if (k = 65535 & v, p < (y &= 15) && (d += z[n++] << p, (p += 8) < y && (d += z[n++] << p, p += 8)), h < (k += d & (1 << y) - 1)) {
                            e2.msg = "invalid distance too far back", r2.mode = 30;
                            break e;
                          }
                          if (d >>>= y, p -= y, (y = s - a) < k) {
                            if (l < (y = k - y) && r2.sane) {
                              e2.msg = "invalid distance too far back", r2.mode = 30;
                              break e;
                            }
                            if (S = c, (x = 0) === f) {
                              if (x += u - y, y < w) {
                                for (w -= y; C[s++] = c[x++], --y; )
                                  ;
                                x = s - k, S = C;
                              }
                            } else if (f < y) {
                              if (x += u + f - y, (y -= f) < w) {
                                for (w -= y; C[s++] = c[x++], --y; )
                                  ;
                                if (x = 0, f < w) {
                                  for (w -= y = f; C[s++] = c[x++], --y; )
                                    ;
                                  x = s - k, S = C;
                                }
                              }
                            } else if (x += f - y, y < w) {
                              for (w -= y; C[s++] = c[x++], --y; )
                                ;
                              x = s - k, S = C;
                            }
                            for (; 2 < w; )
                              C[s++] = S[x++], C[s++] = S[x++], C[s++] = S[x++], w -= 3;
                            w && (C[s++] = S[x++], 1 < w && (C[s++] = S[x++]));
                          } else {
                            for (x = s - k; C[s++] = C[x++], C[s++] = C[x++], C[s++] = C[x++], 2 < (w -= 3); )
                              ;
                            w && (C[s++] = C[x++], 1 < w && (C[s++] = C[x++]));
                          }
                          break;
                        }
                    }
                    break;
                  }
              } while (n < i && s < o);
            n -= w = p >> 3, d &= (1 << (p -= w << 3)) - 1, e2.next_in = n, e2.next_out = s, e2.avail_in = n < i ? i - n + 5 : 5 - (n - i), e2.avail_out = s < o ? o - s + 257 : 257 - (s - o), r2.hold = d, r2.bits = p;
          };
        }, {}], 49: [function(e, t, r) {
          "use strict";
          var I = e("../utils/common"), O = e("./adler32"), B = e("./crc32"), R = e("./inffast"), T = e("./inftrees"), D = 1, F = 2, N = 0, U = -2, P = 1, n = 852, i = 592;
          function L(e2) {
            return (e2 >>> 24 & 255) + (e2 >>> 8 & 65280) + ((65280 & e2) << 8) + ((255 & e2) << 24);
          }
          function s() {
            this.mode = 0, this.last = false, this.wrap = 0, this.havedict = false, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new I.Buf16(320), this.work = new I.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
          }
          function a(e2) {
            var t2;
            return e2 && e2.state ? (t2 = e2.state, e2.total_in = e2.total_out = t2.total = 0, e2.msg = "", t2.wrap && (e2.adler = 1 & t2.wrap), t2.mode = P, t2.last = 0, t2.havedict = 0, t2.dmax = 32768, t2.head = null, t2.hold = 0, t2.bits = 0, t2.lencode = t2.lendyn = new I.Buf32(n), t2.distcode = t2.distdyn = new I.Buf32(i), t2.sane = 1, t2.back = -1, N) : U;
          }
          function o(e2) {
            var t2;
            return e2 && e2.state ? ((t2 = e2.state).wsize = 0, t2.whave = 0, t2.wnext = 0, a(e2)) : U;
          }
          function h(e2, t2) {
            var r2, n2;
            return e2 && e2.state ? (n2 = e2.state, t2 < 0 ? (r2 = 0, t2 = -t2) : (r2 = 1 + (t2 >> 4), t2 < 48 && (t2 &= 15)), t2 && (t2 < 8 || 15 < t2) ? U : (n2.window !== null && n2.wbits !== t2 && (n2.window = null), n2.wrap = r2, n2.wbits = t2, o(e2))) : U;
          }
          function u(e2, t2) {
            var r2, n2;
            return e2 ? (n2 = new s(), (e2.state = n2).window = null, (r2 = h(e2, t2)) !== N && (e2.state = null), r2) : U;
          }
          var l, f, c = true;
          function j(e2) {
            if (c) {
              var t2;
              for (l = new I.Buf32(512), f = new I.Buf32(32), t2 = 0; t2 < 144; )
                e2.lens[t2++] = 8;
              for (; t2 < 256; )
                e2.lens[t2++] = 9;
              for (; t2 < 280; )
                e2.lens[t2++] = 7;
              for (; t2 < 288; )
                e2.lens[t2++] = 8;
              for (T(D, e2.lens, 0, 288, l, 0, e2.work, { bits: 9 }), t2 = 0; t2 < 32; )
                e2.lens[t2++] = 5;
              T(F, e2.lens, 0, 32, f, 0, e2.work, { bits: 5 }), c = false;
            }
            e2.lencode = l, e2.lenbits = 9, e2.distcode = f, e2.distbits = 5;
          }
          function Z(e2, t2, r2, n2) {
            var i2, s2 = e2.state;
            return s2.window === null && (s2.wsize = 1 << s2.wbits, s2.wnext = 0, s2.whave = 0, s2.window = new I.Buf8(s2.wsize)), n2 >= s2.wsize ? (I.arraySet(s2.window, t2, r2 - s2.wsize, s2.wsize, 0), s2.wnext = 0, s2.whave = s2.wsize) : (n2 < (i2 = s2.wsize - s2.wnext) && (i2 = n2), I.arraySet(s2.window, t2, r2 - n2, i2, s2.wnext), (n2 -= i2) ? (I.arraySet(s2.window, t2, r2 - n2, n2, 0), s2.wnext = n2, s2.whave = s2.wsize) : (s2.wnext += i2, s2.wnext === s2.wsize && (s2.wnext = 0), s2.whave < s2.wsize && (s2.whave += i2))), 0;
          }
          r.inflateReset = o, r.inflateReset2 = h, r.inflateResetKeep = a, r.inflateInit = function(e2) {
            return u(e2, 15);
          }, r.inflateInit2 = u, r.inflate = function(e2, t2) {
            var r2, n2, i2, s2, a2, o2, h2, u2, l2, f2, c2, d, p, m, _, g, b, v, y, w, k, x, S, z, C = 0, E = new I.Buf8(4), A = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
            if (!e2 || !e2.state || !e2.output || !e2.input && e2.avail_in !== 0)
              return U;
            (r2 = e2.state).mode === 12 && (r2.mode = 13), a2 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o2 = e2.avail_in, u2 = r2.hold, l2 = r2.bits, f2 = o2, c2 = h2, x = N;
            e:
              for (; ; )
                switch (r2.mode) {
                  case P:
                    if (r2.wrap === 0) {
                      r2.mode = 13;
                      break;
                    }
                    for (; l2 < 16; ) {
                      if (o2 === 0)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    if (2 & r2.wrap && u2 === 35615) {
                      E[r2.check = 0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0), l2 = u2 = 0, r2.mode = 2;
                      break;
                    }
                    if (r2.flags = 0, r2.head && (r2.head.done = false), !(1 & r2.wrap) || (((255 & u2) << 8) + (u2 >> 8)) % 31) {
                      e2.msg = "incorrect header check", r2.mode = 30;
                      break;
                    }
                    if ((15 & u2) != 8) {
                      e2.msg = "unknown compression method", r2.mode = 30;
                      break;
                    }
                    if (l2 -= 4, k = 8 + (15 & (u2 >>>= 4)), r2.wbits === 0)
                      r2.wbits = k;
                    else if (k > r2.wbits) {
                      e2.msg = "invalid window size", r2.mode = 30;
                      break;
                    }
                    r2.dmax = 1 << k, e2.adler = r2.check = 1, r2.mode = 512 & u2 ? 10 : 12, l2 = u2 = 0;
                    break;
                  case 2:
                    for (; l2 < 16; ) {
                      if (o2 === 0)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    if (r2.flags = u2, (255 & r2.flags) != 8) {
                      e2.msg = "unknown compression method", r2.mode = 30;
                      break;
                    }
                    if (57344 & r2.flags) {
                      e2.msg = "unknown header flags set", r2.mode = 30;
                      break;
                    }
                    r2.head && (r2.head.text = u2 >> 8 & 1), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0, r2.mode = 3;
                  case 3:
                    for (; l2 < 32; ) {
                      if (o2 === 0)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    r2.head && (r2.head.time = u2), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, E[2] = u2 >>> 16 & 255, E[3] = u2 >>> 24 & 255, r2.check = B(r2.check, E, 4, 0)), l2 = u2 = 0, r2.mode = 4;
                  case 4:
                    for (; l2 < 16; ) {
                      if (o2 === 0)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    r2.head && (r2.head.xflags = 255 & u2, r2.head.os = u2 >> 8), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0, r2.mode = 5;
                  case 5:
                    if (1024 & r2.flags) {
                      for (; l2 < 16; ) {
                        if (o2 === 0)
                          break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      r2.length = u2, r2.head && (r2.head.extra_len = u2), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0;
                    } else
                      r2.head && (r2.head.extra = null);
                    r2.mode = 6;
                  case 6:
                    if (1024 & r2.flags && (o2 < (d = r2.length) && (d = o2), d && (r2.head && (k = r2.head.extra_len - r2.length, r2.head.extra || (r2.head.extra = new Array(r2.head.extra_len)), I.arraySet(r2.head.extra, n2, s2, d, k)), 512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, r2.length -= d), r2.length))
                      break e;
                    r2.length = 0, r2.mode = 7;
                  case 7:
                    if (2048 & r2.flags) {
                      if (o2 === 0)
                        break e;
                      for (d = 0; k = n2[s2 + d++], r2.head && k && r2.length < 65536 && (r2.head.name += String.fromCharCode(k)), k && d < o2; )
                        ;
                      if (512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, k)
                        break e;
                    } else
                      r2.head && (r2.head.name = null);
                    r2.length = 0, r2.mode = 8;
                  case 8:
                    if (4096 & r2.flags) {
                      if (o2 === 0)
                        break e;
                      for (d = 0; k = n2[s2 + d++], r2.head && k && r2.length < 65536 && (r2.head.comment += String.fromCharCode(k)), k && d < o2; )
                        ;
                      if (512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, k)
                        break e;
                    } else
                      r2.head && (r2.head.comment = null);
                    r2.mode = 9;
                  case 9:
                    if (512 & r2.flags) {
                      for (; l2 < 16; ) {
                        if (o2 === 0)
                          break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      if (u2 !== (65535 & r2.check)) {
                        e2.msg = "header crc mismatch", r2.mode = 30;
                        break;
                      }
                      l2 = u2 = 0;
                    }
                    r2.head && (r2.head.hcrc = r2.flags >> 9 & 1, r2.head.done = true), e2.adler = r2.check = 0, r2.mode = 12;
                    break;
                  case 10:
                    for (; l2 < 32; ) {
                      if (o2 === 0)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    e2.adler = r2.check = L(u2), l2 = u2 = 0, r2.mode = 11;
                  case 11:
                    if (r2.havedict === 0)
                      return e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, 2;
                    e2.adler = r2.check = 1, r2.mode = 12;
                  case 12:
                    if (t2 === 5 || t2 === 6)
                      break e;
                  case 13:
                    if (r2.last) {
                      u2 >>>= 7 & l2, l2 -= 7 & l2, r2.mode = 27;
                      break;
                    }
                    for (; l2 < 3; ) {
                      if (o2 === 0)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    switch (r2.last = 1 & u2, l2 -= 1, 3 & (u2 >>>= 1)) {
                      case 0:
                        r2.mode = 14;
                        break;
                      case 1:
                        if (j(r2), r2.mode = 20, t2 !== 6)
                          break;
                        u2 >>>= 2, l2 -= 2;
                        break e;
                      case 2:
                        r2.mode = 17;
                        break;
                      case 3:
                        e2.msg = "invalid block type", r2.mode = 30;
                    }
                    u2 >>>= 2, l2 -= 2;
                    break;
                  case 14:
                    for (u2 >>>= 7 & l2, l2 -= 7 & l2; l2 < 32; ) {
                      if (o2 === 0)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    if ((65535 & u2) != (u2 >>> 16 ^ 65535)) {
                      e2.msg = "invalid stored block lengths", r2.mode = 30;
                      break;
                    }
                    if (r2.length = 65535 & u2, l2 = u2 = 0, r2.mode = 15, t2 === 6)
                      break e;
                  case 15:
                    r2.mode = 16;
                  case 16:
                    if (d = r2.length) {
                      if (o2 < d && (d = o2), h2 < d && (d = h2), d === 0)
                        break e;
                      I.arraySet(i2, n2, s2, d, a2), o2 -= d, s2 += d, h2 -= d, a2 += d, r2.length -= d;
                      break;
                    }
                    r2.mode = 12;
                    break;
                  case 17:
                    for (; l2 < 14; ) {
                      if (o2 === 0)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    if (r2.nlen = 257 + (31 & u2), u2 >>>= 5, l2 -= 5, r2.ndist = 1 + (31 & u2), u2 >>>= 5, l2 -= 5, r2.ncode = 4 + (15 & u2), u2 >>>= 4, l2 -= 4, 286 < r2.nlen || 30 < r2.ndist) {
                      e2.msg = "too many length or distance symbols", r2.mode = 30;
                      break;
                    }
                    r2.have = 0, r2.mode = 18;
                  case 18:
                    for (; r2.have < r2.ncode; ) {
                      for (; l2 < 3; ) {
                        if (o2 === 0)
                          break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      r2.lens[A[r2.have++]] = 7 & u2, u2 >>>= 3, l2 -= 3;
                    }
                    for (; r2.have < 19; )
                      r2.lens[A[r2.have++]] = 0;
                    if (r2.lencode = r2.lendyn, r2.lenbits = 7, S = { bits: r2.lenbits }, x = T(0, r2.lens, 0, 19, r2.lencode, 0, r2.work, S), r2.lenbits = S.bits, x) {
                      e2.msg = "invalid code lengths set", r2.mode = 30;
                      break;
                    }
                    r2.have = 0, r2.mode = 19;
                  case 19:
                    for (; r2.have < r2.nlen + r2.ndist; ) {
                      for (; g = (C = r2.lencode[u2 & (1 << r2.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                        if (o2 === 0)
                          break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      if (b < 16)
                        u2 >>>= _, l2 -= _, r2.lens[r2.have++] = b;
                      else {
                        if (b === 16) {
                          for (z = _ + 2; l2 < z; ) {
                            if (o2 === 0)
                              break e;
                            o2--, u2 += n2[s2++] << l2, l2 += 8;
                          }
                          if (u2 >>>= _, l2 -= _, r2.have === 0) {
                            e2.msg = "invalid bit length repeat", r2.mode = 30;
                            break;
                          }
                          k = r2.lens[r2.have - 1], d = 3 + (3 & u2), u2 >>>= 2, l2 -= 2;
                        } else if (b === 17) {
                          for (z = _ + 3; l2 < z; ) {
                            if (o2 === 0)
                              break e;
                            o2--, u2 += n2[s2++] << l2, l2 += 8;
                          }
                          l2 -= _, k = 0, d = 3 + (7 & (u2 >>>= _)), u2 >>>= 3, l2 -= 3;
                        } else {
                          for (z = _ + 7; l2 < z; ) {
                            if (o2 === 0)
                              break e;
                            o2--, u2 += n2[s2++] << l2, l2 += 8;
                          }
                          l2 -= _, k = 0, d = 11 + (127 & (u2 >>>= _)), u2 >>>= 7, l2 -= 7;
                        }
                        if (r2.have + d > r2.nlen + r2.ndist) {
                          e2.msg = "invalid bit length repeat", r2.mode = 30;
                          break;
                        }
                        for (; d--; )
                          r2.lens[r2.have++] = k;
                      }
                    }
                    if (r2.mode === 30)
                      break;
                    if (r2.lens[256] === 0) {
                      e2.msg = "invalid code -- missing end-of-block", r2.mode = 30;
                      break;
                    }
                    if (r2.lenbits = 9, S = { bits: r2.lenbits }, x = T(D, r2.lens, 0, r2.nlen, r2.lencode, 0, r2.work, S), r2.lenbits = S.bits, x) {
                      e2.msg = "invalid literal/lengths set", r2.mode = 30;
                      break;
                    }
                    if (r2.distbits = 6, r2.distcode = r2.distdyn, S = { bits: r2.distbits }, x = T(F, r2.lens, r2.nlen, r2.ndist, r2.distcode, 0, r2.work, S), r2.distbits = S.bits, x) {
                      e2.msg = "invalid distances set", r2.mode = 30;
                      break;
                    }
                    if (r2.mode = 20, t2 === 6)
                      break e;
                  case 20:
                    r2.mode = 21;
                  case 21:
                    if (6 <= o2 && 258 <= h2) {
                      e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, R(e2, c2), a2 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o2 = e2.avail_in, u2 = r2.hold, l2 = r2.bits, r2.mode === 12 && (r2.back = -1);
                      break;
                    }
                    for (r2.back = 0; g = (C = r2.lencode[u2 & (1 << r2.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                      if (o2 === 0)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    if (g && (240 & g) == 0) {
                      for (v = _, y = g, w = b; g = (C = r2.lencode[w + ((u2 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l2); ) {
                        if (o2 === 0)
                          break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      u2 >>>= v, l2 -= v, r2.back += v;
                    }
                    if (u2 >>>= _, l2 -= _, r2.back += _, r2.length = b, g === 0) {
                      r2.mode = 26;
                      break;
                    }
                    if (32 & g) {
                      r2.back = -1, r2.mode = 12;
                      break;
                    }
                    if (64 & g) {
                      e2.msg = "invalid literal/length code", r2.mode = 30;
                      break;
                    }
                    r2.extra = 15 & g, r2.mode = 22;
                  case 22:
                    if (r2.extra) {
                      for (z = r2.extra; l2 < z; ) {
                        if (o2 === 0)
                          break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      r2.length += u2 & (1 << r2.extra) - 1, u2 >>>= r2.extra, l2 -= r2.extra, r2.back += r2.extra;
                    }
                    r2.was = r2.length, r2.mode = 23;
                  case 23:
                    for (; g = (C = r2.distcode[u2 & (1 << r2.distbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                      if (o2 === 0)
                        break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    if ((240 & g) == 0) {
                      for (v = _, y = g, w = b; g = (C = r2.distcode[w + ((u2 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l2); ) {
                        if (o2 === 0)
                          break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      u2 >>>= v, l2 -= v, r2.back += v;
                    }
                    if (u2 >>>= _, l2 -= _, r2.back += _, 64 & g) {
                      e2.msg = "invalid distance code", r2.mode = 30;
                      break;
                    }
                    r2.offset = b, r2.extra = 15 & g, r2.mode = 24;
                  case 24:
                    if (r2.extra) {
                      for (z = r2.extra; l2 < z; ) {
                        if (o2 === 0)
                          break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      r2.offset += u2 & (1 << r2.extra) - 1, u2 >>>= r2.extra, l2 -= r2.extra, r2.back += r2.extra;
                    }
                    if (r2.offset > r2.dmax) {
                      e2.msg = "invalid distance too far back", r2.mode = 30;
                      break;
                    }
                    r2.mode = 25;
                  case 25:
                    if (h2 === 0)
                      break e;
                    if (d = c2 - h2, r2.offset > d) {
                      if ((d = r2.offset - d) > r2.whave && r2.sane) {
                        e2.msg = "invalid distance too far back", r2.mode = 30;
                        break;
                      }
                      p = d > r2.wnext ? (d -= r2.wnext, r2.wsize - d) : r2.wnext - d, d > r2.length && (d = r2.length), m = r2.window;
                    } else
                      m = i2, p = a2 - r2.offset, d = r2.length;
                    for (h2 < d && (d = h2), h2 -= d, r2.length -= d; i2[a2++] = m[p++], --d; )
                      ;
                    r2.length === 0 && (r2.mode = 21);
                    break;
                  case 26:
                    if (h2 === 0)
                      break e;
                    i2[a2++] = r2.length, h2--, r2.mode = 21;
                    break;
                  case 27:
                    if (r2.wrap) {
                      for (; l2 < 32; ) {
                        if (o2 === 0)
                          break e;
                        o2--, u2 |= n2[s2++] << l2, l2 += 8;
                      }
                      if (c2 -= h2, e2.total_out += c2, r2.total += c2, c2 && (e2.adler = r2.check = r2.flags ? B(r2.check, i2, c2, a2 - c2) : O(r2.check, i2, c2, a2 - c2)), c2 = h2, (r2.flags ? u2 : L(u2)) !== r2.check) {
                        e2.msg = "incorrect data check", r2.mode = 30;
                        break;
                      }
                      l2 = u2 = 0;
                    }
                    r2.mode = 28;
                  case 28:
                    if (r2.wrap && r2.flags) {
                      for (; l2 < 32; ) {
                        if (o2 === 0)
                          break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      if (u2 !== (4294967295 & r2.total)) {
                        e2.msg = "incorrect length check", r2.mode = 30;
                        break;
                      }
                      l2 = u2 = 0;
                    }
                    r2.mode = 29;
                  case 29:
                    x = 1;
                    break e;
                  case 30:
                    x = -3;
                    break e;
                  case 31:
                    return -4;
                  case 32:
                  default:
                    return U;
                }
            return e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, (r2.wsize || c2 !== e2.avail_out && r2.mode < 30 && (r2.mode < 27 || t2 !== 4)) && Z(e2, e2.output, e2.next_out, c2 - e2.avail_out) ? (r2.mode = 31, -4) : (f2 -= e2.avail_in, c2 -= e2.avail_out, e2.total_in += f2, e2.total_out += c2, r2.total += c2, r2.wrap && c2 && (e2.adler = r2.check = r2.flags ? B(r2.check, i2, c2, e2.next_out - c2) : O(r2.check, i2, c2, e2.next_out - c2)), e2.data_type = r2.bits + (r2.last ? 64 : 0) + (r2.mode === 12 ? 128 : 0) + (r2.mode === 20 || r2.mode === 15 ? 256 : 0), (f2 == 0 && c2 === 0 || t2 === 4) && x === N && (x = -5), x);
          }, r.inflateEnd = function(e2) {
            if (!e2 || !e2.state)
              return U;
            var t2 = e2.state;
            return t2.window && (t2.window = null), e2.state = null, N;
          }, r.inflateGetHeader = function(e2, t2) {
            var r2;
            return e2 && e2.state ? (2 & (r2 = e2.state).wrap) == 0 ? U : ((r2.head = t2).done = false, N) : U;
          }, r.inflateSetDictionary = function(e2, t2) {
            var r2, n2 = t2.length;
            return e2 && e2.state ? (r2 = e2.state).wrap !== 0 && r2.mode !== 11 ? U : r2.mode === 11 && O(1, t2, n2, 0) !== r2.check ? -3 : Z(e2, t2, n2, n2) ? (r2.mode = 31, -4) : (r2.havedict = 1, N) : U;
          }, r.inflateInfo = "pako inflate (from Nodeca project)";
        }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./inffast": 48, "./inftrees": 50 }], 50: [function(e, t, r) {
          "use strict";
          var D = e("../utils/common"), F = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], N = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78], U = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0], P = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
          t.exports = function(e2, t2, r2, n, i, s, a, o) {
            var h, u, l, f, c, d, p, m, _, g = o.bits, b = 0, v = 0, y = 0, w = 0, k = 0, x = 0, S = 0, z = 0, C = 0, E = 0, A = null, I = 0, O = new D.Buf16(16), B = new D.Buf16(16), R = null, T = 0;
            for (b = 0; b <= 15; b++)
              O[b] = 0;
            for (v = 0; v < n; v++)
              O[t2[r2 + v]]++;
            for (k = g, w = 15; 1 <= w && O[w] === 0; w--)
              ;
            if (w < k && (k = w), w === 0)
              return i[s++] = 20971520, i[s++] = 20971520, o.bits = 1, 0;
            for (y = 1; y < w && O[y] === 0; y++)
              ;
            for (k < y && (k = y), b = z = 1; b <= 15; b++)
              if (z <<= 1, (z -= O[b]) < 0)
                return -1;
            if (0 < z && (e2 === 0 || w !== 1))
              return -1;
            for (B[1] = 0, b = 1; b < 15; b++)
              B[b + 1] = B[b] + O[b];
            for (v = 0; v < n; v++)
              t2[r2 + v] !== 0 && (a[B[t2[r2 + v]]++] = v);
            if (d = e2 === 0 ? (A = R = a, 19) : e2 === 1 ? (A = F, I -= 257, R = N, T -= 257, 256) : (A = U, R = P, -1), b = y, c = s, S = v = E = 0, l = -1, f = (C = 1 << (x = k)) - 1, e2 === 1 && 852 < C || e2 === 2 && 592 < C)
              return 1;
            for (; ; ) {
              for (p = b - S, _ = a[v] < d ? (m = 0, a[v]) : a[v] > d ? (m = R[T + a[v]], A[I + a[v]]) : (m = 96, 0), h = 1 << b - S, y = u = 1 << x; i[c + (E >> S) + (u -= h)] = p << 24 | m << 16 | _ | 0, u !== 0; )
                ;
              for (h = 1 << b - 1; E & h; )
                h >>= 1;
              if (h !== 0 ? (E &= h - 1, E += h) : E = 0, v++, --O[b] == 0) {
                if (b === w)
                  break;
                b = t2[r2 + a[v]];
              }
              if (k < b && (E & f) !== l) {
                for (S === 0 && (S = k), c += y, z = 1 << (x = b - S); x + S < w && !((z -= O[x + S]) <= 0); )
                  x++, z <<= 1;
                if (C += 1 << x, e2 === 1 && 852 < C || e2 === 2 && 592 < C)
                  return 1;
                i[l = E & f] = k << 24 | x << 16 | c - s | 0;
              }
            }
            return E !== 0 && (i[c + E] = b - S << 24 | 64 << 16 | 0), o.bits = k, 0;
          };
        }, { "../utils/common": 41 }], 51: [function(e, t, r) {
          "use strict";
          t.exports = { 2: "need dictionary", 1: "stream end", 0: "", "-1": "file error", "-2": "stream error", "-3": "data error", "-4": "insufficient memory", "-5": "buffer error", "-6": "incompatible version" };
        }, {}], 52: [function(e, t, r) {
          "use strict";
          var i = e("../utils/common"), o = 0, h = 1;
          function n(e2) {
            for (var t2 = e2.length; 0 <= --t2; )
              e2[t2] = 0;
          }
          var s = 0, a = 29, u = 256, l = u + 1 + a, f = 30, c = 19, _ = 2 * l + 1, g = 15, d = 16, p = 7, m = 256, b = 16, v = 17, y = 18, w = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0], k = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13], x = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7], S = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], z = new Array(2 * (l + 2));
          n(z);
          var C = new Array(2 * f);
          n(C);
          var E = new Array(512);
          n(E);
          var A = new Array(256);
          n(A);
          var I = new Array(a);
          n(I);
          var O, B, R, T = new Array(f);
          function D(e2, t2, r2, n2, i2) {
            this.static_tree = e2, this.extra_bits = t2, this.extra_base = r2, this.elems = n2, this.max_length = i2, this.has_stree = e2 && e2.length;
          }
          function F(e2, t2) {
            this.dyn_tree = e2, this.max_code = 0, this.stat_desc = t2;
          }
          function N(e2) {
            return e2 < 256 ? E[e2] : E[256 + (e2 >>> 7)];
          }
          function U(e2, t2) {
            e2.pending_buf[e2.pending++] = 255 & t2, e2.pending_buf[e2.pending++] = t2 >>> 8 & 255;
          }
          function P(e2, t2, r2) {
            e2.bi_valid > d - r2 ? (e2.bi_buf |= t2 << e2.bi_valid & 65535, U(e2, e2.bi_buf), e2.bi_buf = t2 >> d - e2.bi_valid, e2.bi_valid += r2 - d) : (e2.bi_buf |= t2 << e2.bi_valid & 65535, e2.bi_valid += r2);
          }
          function L(e2, t2, r2) {
            P(e2, r2[2 * t2], r2[2 * t2 + 1]);
          }
          function j(e2, t2) {
            for (var r2 = 0; r2 |= 1 & e2, e2 >>>= 1, r2 <<= 1, 0 < --t2; )
              ;
            return r2 >>> 1;
          }
          function Z(e2, t2, r2) {
            var n2, i2, s2 = new Array(g + 1), a2 = 0;
            for (n2 = 1; n2 <= g; n2++)
              s2[n2] = a2 = a2 + r2[n2 - 1] << 1;
            for (i2 = 0; i2 <= t2; i2++) {
              var o2 = e2[2 * i2 + 1];
              o2 !== 0 && (e2[2 * i2] = j(s2[o2]++, o2));
            }
          }
          function W(e2) {
            var t2;
            for (t2 = 0; t2 < l; t2++)
              e2.dyn_ltree[2 * t2] = 0;
            for (t2 = 0; t2 < f; t2++)
              e2.dyn_dtree[2 * t2] = 0;
            for (t2 = 0; t2 < c; t2++)
              e2.bl_tree[2 * t2] = 0;
            e2.dyn_ltree[2 * m] = 1, e2.opt_len = e2.static_len = 0, e2.last_lit = e2.matches = 0;
          }
          function M(e2) {
            8 < e2.bi_valid ? U(e2, e2.bi_buf) : 0 < e2.bi_valid && (e2.pending_buf[e2.pending++] = e2.bi_buf), e2.bi_buf = 0, e2.bi_valid = 0;
          }
          function H(e2, t2, r2, n2) {
            var i2 = 2 * t2, s2 = 2 * r2;
            return e2[i2] < e2[s2] || e2[i2] === e2[s2] && n2[t2] <= n2[r2];
          }
          function G(e2, t2, r2) {
            for (var n2 = e2.heap[r2], i2 = r2 << 1; i2 <= e2.heap_len && (i2 < e2.heap_len && H(t2, e2.heap[i2 + 1], e2.heap[i2], e2.depth) && i2++, !H(t2, n2, e2.heap[i2], e2.depth)); )
              e2.heap[r2] = e2.heap[i2], r2 = i2, i2 <<= 1;
            e2.heap[r2] = n2;
          }
          function K(e2, t2, r2) {
            var n2, i2, s2, a2, o2 = 0;
            if (e2.last_lit !== 0)
              for (; n2 = e2.pending_buf[e2.d_buf + 2 * o2] << 8 | e2.pending_buf[e2.d_buf + 2 * o2 + 1], i2 = e2.pending_buf[e2.l_buf + o2], o2++, n2 === 0 ? L(e2, i2, t2) : (L(e2, (s2 = A[i2]) + u + 1, t2), (a2 = w[s2]) !== 0 && P(e2, i2 -= I[s2], a2), L(e2, s2 = N(--n2), r2), (a2 = k[s2]) !== 0 && P(e2, n2 -= T[s2], a2)), o2 < e2.last_lit; )
                ;
            L(e2, m, t2);
          }
          function Y(e2, t2) {
            var r2, n2, i2, s2 = t2.dyn_tree, a2 = t2.stat_desc.static_tree, o2 = t2.stat_desc.has_stree, h2 = t2.stat_desc.elems, u2 = -1;
            for (e2.heap_len = 0, e2.heap_max = _, r2 = 0; r2 < h2; r2++)
              s2[2 * r2] !== 0 ? (e2.heap[++e2.heap_len] = u2 = r2, e2.depth[r2] = 0) : s2[2 * r2 + 1] = 0;
            for (; e2.heap_len < 2; )
              s2[2 * (i2 = e2.heap[++e2.heap_len] = u2 < 2 ? ++u2 : 0)] = 1, e2.depth[i2] = 0, e2.opt_len--, o2 && (e2.static_len -= a2[2 * i2 + 1]);
            for (t2.max_code = u2, r2 = e2.heap_len >> 1; 1 <= r2; r2--)
              G(e2, s2, r2);
            for (i2 = h2; r2 = e2.heap[1], e2.heap[1] = e2.heap[e2.heap_len--], G(e2, s2, 1), n2 = e2.heap[1], e2.heap[--e2.heap_max] = r2, e2.heap[--e2.heap_max] = n2, s2[2 * i2] = s2[2 * r2] + s2[2 * n2], e2.depth[i2] = (e2.depth[r2] >= e2.depth[n2] ? e2.depth[r2] : e2.depth[n2]) + 1, s2[2 * r2 + 1] = s2[2 * n2 + 1] = i2, e2.heap[1] = i2++, G(e2, s2, 1), 2 <= e2.heap_len; )
              ;
            e2.heap[--e2.heap_max] = e2.heap[1], function(e3, t3) {
              var r3, n3, i3, s3, a3, o3, h3 = t3.dyn_tree, u3 = t3.max_code, l2 = t3.stat_desc.static_tree, f2 = t3.stat_desc.has_stree, c2 = t3.stat_desc.extra_bits, d2 = t3.stat_desc.extra_base, p2 = t3.stat_desc.max_length, m2 = 0;
              for (s3 = 0; s3 <= g; s3++)
                e3.bl_count[s3] = 0;
              for (h3[2 * e3.heap[e3.heap_max] + 1] = 0, r3 = e3.heap_max + 1; r3 < _; r3++)
                p2 < (s3 = h3[2 * h3[2 * (n3 = e3.heap[r3]) + 1] + 1] + 1) && (s3 = p2, m2++), h3[2 * n3 + 1] = s3, u3 < n3 || (e3.bl_count[s3]++, a3 = 0, d2 <= n3 && (a3 = c2[n3 - d2]), o3 = h3[2 * n3], e3.opt_len += o3 * (s3 + a3), f2 && (e3.static_len += o3 * (l2[2 * n3 + 1] + a3)));
              if (m2 !== 0) {
                do {
                  for (s3 = p2 - 1; e3.bl_count[s3] === 0; )
                    s3--;
                  e3.bl_count[s3]--, e3.bl_count[s3 + 1] += 2, e3.bl_count[p2]--, m2 -= 2;
                } while (0 < m2);
                for (s3 = p2; s3 !== 0; s3--)
                  for (n3 = e3.bl_count[s3]; n3 !== 0; )
                    u3 < (i3 = e3.heap[--r3]) || (h3[2 * i3 + 1] !== s3 && (e3.opt_len += (s3 - h3[2 * i3 + 1]) * h3[2 * i3], h3[2 * i3 + 1] = s3), n3--);
              }
            }(e2, t2), Z(s2, u2, e2.bl_count);
          }
          function X(e2, t2, r2) {
            var n2, i2, s2 = -1, a2 = t2[1], o2 = 0, h2 = 7, u2 = 4;
            for (a2 === 0 && (h2 = 138, u2 = 3), t2[2 * (r2 + 1) + 1] = 65535, n2 = 0; n2 <= r2; n2++)
              i2 = a2, a2 = t2[2 * (n2 + 1) + 1], ++o2 < h2 && i2 === a2 || (o2 < u2 ? e2.bl_tree[2 * i2] += o2 : i2 !== 0 ? (i2 !== s2 && e2.bl_tree[2 * i2]++, e2.bl_tree[2 * b]++) : o2 <= 10 ? e2.bl_tree[2 * v]++ : e2.bl_tree[2 * y]++, s2 = i2, u2 = (o2 = 0) === a2 ? (h2 = 138, 3) : i2 === a2 ? (h2 = 6, 3) : (h2 = 7, 4));
          }
          function V(e2, t2, r2) {
            var n2, i2, s2 = -1, a2 = t2[1], o2 = 0, h2 = 7, u2 = 4;
            for (a2 === 0 && (h2 = 138, u2 = 3), n2 = 0; n2 <= r2; n2++)
              if (i2 = a2, a2 = t2[2 * (n2 + 1) + 1], !(++o2 < h2 && i2 === a2)) {
                if (o2 < u2)
                  for (; L(e2, i2, e2.bl_tree), --o2 != 0; )
                    ;
                else
                  i2 !== 0 ? (i2 !== s2 && (L(e2, i2, e2.bl_tree), o2--), L(e2, b, e2.bl_tree), P(e2, o2 - 3, 2)) : o2 <= 10 ? (L(e2, v, e2.bl_tree), P(e2, o2 - 3, 3)) : (L(e2, y, e2.bl_tree), P(e2, o2 - 11, 7));
                s2 = i2, u2 = (o2 = 0) === a2 ? (h2 = 138, 3) : i2 === a2 ? (h2 = 6, 3) : (h2 = 7, 4);
              }
          }
          n(T);
          var q = false;
          function J(e2, t2, r2, n2) {
            P(e2, (s << 1) + (n2 ? 1 : 0), 3), function(e3, t3, r3, n3) {
              M(e3), n3 && (U(e3, r3), U(e3, ~r3)), i.arraySet(e3.pending_buf, e3.window, t3, r3, e3.pending), e3.pending += r3;
            }(e2, t2, r2, true);
          }
          r._tr_init = function(e2) {
            q || (function() {
              var e3, t2, r2, n2, i2, s2 = new Array(g + 1);
              for (n2 = r2 = 0; n2 < a - 1; n2++)
                for (I[n2] = r2, e3 = 0; e3 < 1 << w[n2]; e3++)
                  A[r2++] = n2;
              for (A[r2 - 1] = n2, n2 = i2 = 0; n2 < 16; n2++)
                for (T[n2] = i2, e3 = 0; e3 < 1 << k[n2]; e3++)
                  E[i2++] = n2;
              for (i2 >>= 7; n2 < f; n2++)
                for (T[n2] = i2 << 7, e3 = 0; e3 < 1 << k[n2] - 7; e3++)
                  E[256 + i2++] = n2;
              for (t2 = 0; t2 <= g; t2++)
                s2[t2] = 0;
              for (e3 = 0; e3 <= 143; )
                z[2 * e3 + 1] = 8, e3++, s2[8]++;
              for (; e3 <= 255; )
                z[2 * e3 + 1] = 9, e3++, s2[9]++;
              for (; e3 <= 279; )
                z[2 * e3 + 1] = 7, e3++, s2[7]++;
              for (; e3 <= 287; )
                z[2 * e3 + 1] = 8, e3++, s2[8]++;
              for (Z(z, l + 1, s2), e3 = 0; e3 < f; e3++)
                C[2 * e3 + 1] = 5, C[2 * e3] = j(e3, 5);
              O = new D(z, w, u + 1, l, g), B = new D(C, k, 0, f, g), R = new D(new Array(0), x, 0, c, p);
            }(), q = true), e2.l_desc = new F(e2.dyn_ltree, O), e2.d_desc = new F(e2.dyn_dtree, B), e2.bl_desc = new F(e2.bl_tree, R), e2.bi_buf = 0, e2.bi_valid = 0, W(e2);
          }, r._tr_stored_block = J, r._tr_flush_block = function(e2, t2, r2, n2) {
            var i2, s2, a2 = 0;
            0 < e2.level ? (e2.strm.data_type === 2 && (e2.strm.data_type = function(e3) {
              var t3, r3 = 4093624447;
              for (t3 = 0; t3 <= 31; t3++, r3 >>>= 1)
                if (1 & r3 && e3.dyn_ltree[2 * t3] !== 0)
                  return o;
              if (e3.dyn_ltree[18] !== 0 || e3.dyn_ltree[20] !== 0 || e3.dyn_ltree[26] !== 0)
                return h;
              for (t3 = 32; t3 < u; t3++)
                if (e3.dyn_ltree[2 * t3] !== 0)
                  return h;
              return o;
            }(e2)), Y(e2, e2.l_desc), Y(e2, e2.d_desc), a2 = function(e3) {
              var t3;
              for (X(e3, e3.dyn_ltree, e3.l_desc.max_code), X(e3, e3.dyn_dtree, e3.d_desc.max_code), Y(e3, e3.bl_desc), t3 = c - 1; 3 <= t3 && e3.bl_tree[2 * S[t3] + 1] === 0; t3--)
                ;
              return e3.opt_len += 3 * (t3 + 1) + 5 + 5 + 4, t3;
            }(e2), i2 = e2.opt_len + 3 + 7 >>> 3, (s2 = e2.static_len + 3 + 7 >>> 3) <= i2 && (i2 = s2)) : i2 = s2 = r2 + 5, r2 + 4 <= i2 && t2 !== -1 ? J(e2, t2, r2, n2) : e2.strategy === 4 || s2 === i2 ? (P(e2, 2 + (n2 ? 1 : 0), 3), K(e2, z, C)) : (P(e2, 4 + (n2 ? 1 : 0), 3), function(e3, t3, r3, n3) {
              var i3;
              for (P(e3, t3 - 257, 5), P(e3, r3 - 1, 5), P(e3, n3 - 4, 4), i3 = 0; i3 < n3; i3++)
                P(e3, e3.bl_tree[2 * S[i3] + 1], 3);
              V(e3, e3.dyn_ltree, t3 - 1), V(e3, e3.dyn_dtree, r3 - 1);
            }(e2, e2.l_desc.max_code + 1, e2.d_desc.max_code + 1, a2 + 1), K(e2, e2.dyn_ltree, e2.dyn_dtree)), W(e2), n2 && M(e2);
          }, r._tr_tally = function(e2, t2, r2) {
            return e2.pending_buf[e2.d_buf + 2 * e2.last_lit] = t2 >>> 8 & 255, e2.pending_buf[e2.d_buf + 2 * e2.last_lit + 1] = 255 & t2, e2.pending_buf[e2.l_buf + e2.last_lit] = 255 & r2, e2.last_lit++, t2 === 0 ? e2.dyn_ltree[2 * r2]++ : (e2.matches++, t2--, e2.dyn_ltree[2 * (A[r2] + u + 1)]++, e2.dyn_dtree[2 * N(t2)]++), e2.last_lit === e2.lit_bufsize - 1;
          }, r._tr_align = function(e2) {
            P(e2, 2, 3), L(e2, m, z), function(e3) {
              e3.bi_valid === 16 ? (U(e3, e3.bi_buf), e3.bi_buf = 0, e3.bi_valid = 0) : 8 <= e3.bi_valid && (e3.pending_buf[e3.pending++] = 255 & e3.bi_buf, e3.bi_buf >>= 8, e3.bi_valid -= 8);
            }(e2);
          };
        }, { "../utils/common": 41 }], 53: [function(e, t, r) {
          "use strict";
          t.exports = function() {
            this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
          };
        }, {}], 54: [function(e, t, r) {
          (function(e2) {
            !function(r2, n) {
              "use strict";
              if (!r2.setImmediate) {
                var i, s, t2, a, o = 1, h = {}, u = false, l = r2.document, e3 = Object.getPrototypeOf && Object.getPrototypeOf(r2);
                e3 = e3 && e3.setTimeout ? e3 : r2, i = {}.toString.call(r2.process) === "[object process]" ? function(e4) {
                  process.nextTick(function() {
                    c(e4);
                  });
                } : function() {
                  if (r2.postMessage && !r2.importScripts) {
                    var e4 = true, t3 = r2.onmessage;
                    return r2.onmessage = function() {
                      e4 = false;
                    }, r2.postMessage("", "*"), r2.onmessage = t3, e4;
                  }
                }() ? (a = "setImmediate$" + Math.random() + "$", r2.addEventListener ? r2.addEventListener("message", d, false) : r2.attachEvent("onmessage", d), function(e4) {
                  r2.postMessage(a + e4, "*");
                }) : r2.MessageChannel ? ((t2 = new MessageChannel()).port1.onmessage = function(e4) {
                  c(e4.data);
                }, function(e4) {
                  t2.port2.postMessage(e4);
                }) : l && "onreadystatechange" in l.createElement("script") ? (s = l.documentElement, function(e4) {
                  var t3 = l.createElement("script");
                  t3.onreadystatechange = function() {
                    c(e4), t3.onreadystatechange = null, s.removeChild(t3), t3 = null;
                  }, s.appendChild(t3);
                }) : function(e4) {
                  setTimeout(c, 0, e4);
                }, e3.setImmediate = function(e4) {
                  typeof e4 != "function" && (e4 = new Function("" + e4));
                  for (var t3 = new Array(arguments.length - 1), r3 = 0; r3 < t3.length; r3++)
                    t3[r3] = arguments[r3 + 1];
                  var n2 = { callback: e4, args: t3 };
                  return h[o] = n2, i(o), o++;
                }, e3.clearImmediate = f;
              }
              function f(e4) {
                delete h[e4];
              }
              function c(e4) {
                if (u)
                  setTimeout(c, 0, e4);
                else {
                  var t3 = h[e4];
                  if (t3) {
                    u = true;
                    try {
                      !function(e5) {
                        var t4 = e5.callback, r3 = e5.args;
                        switch (r3.length) {
                          case 0:
                            t4();
                            break;
                          case 1:
                            t4(r3[0]);
                            break;
                          case 2:
                            t4(r3[0], r3[1]);
                            break;
                          case 3:
                            t4(r3[0], r3[1], r3[2]);
                            break;
                          default:
                            t4.apply(n, r3);
                        }
                      }(t3);
                    } finally {
                      f(e4), u = false;
                    }
                  }
                }
              }
              function d(e4) {
                e4.source === r2 && typeof e4.data == "string" && e4.data.indexOf(a) === 0 && c(+e4.data.slice(a.length));
              }
            }(typeof self == "undefined" ? e2 === void 0 ? this : e2 : self);
          }).call(this, typeof global != "undefined" ? global : typeof self != "undefined" ? self : typeof window != "undefined" ? window : {});
        }, {}] }, {}, [10])(10);
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
  function stringToByteArray(s) {
    var a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++)
      a[i] = s.charCodeAt(i);
    return a;
  }
  function byteArrayToString(data) {
    var str = "";
    if (data != null) {
      var charLUT = new Array();
      for (var i = 0; i < 256; ++i)
        charLUT[i] = String.fromCharCode(i);
      var len = data.length;
      for (var i = 0; i < len; i++)
        str += charLUT[data[i]];
    }
    return str;
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
  function convertDataToUint8Array(data) {
    return typeof data === "string" ? stringToByteArray(data) : data;
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
  (function(TokenType3) {
    TokenType3[TokenType3["EOL"] = 0] = "EOL";
    TokenType3[TokenType3["Float"] = 1] = "Float";
    TokenType3[TokenType3["Int"] = 2] = "Int";
    TokenType3[TokenType3["HexOctalInt"] = 3] = "HexOctalInt";
    TokenType3[TokenType3["Remark"] = 4] = "Remark";
    TokenType3[TokenType3["Ident"] = 5] = "Ident";
    TokenType3[TokenType3["String"] = 6] = "String";
    TokenType3[TokenType3["Relational"] = 7] = "Relational";
    TokenType3[TokenType3["DoubleStar"] = 8] = "DoubleStar";
    TokenType3[TokenType3["Operator"] = 9] = "Operator";
    TokenType3[TokenType3["CatchAll"] = 10] = "CatchAll";
    TokenType3[TokenType3["Whitespace"] = 11] = "Whitespace";
    TokenType3[TokenType3["_LAST"] = 12] = "_LAST";
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
    peekToken(lookahead) {
      var tok = this.tokens[lookahead || 0];
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
    addLabel(str, offset) {
      if (this.labels[str] != null)
        this.compileError(`There's a duplicated label named "${str}".`);
      this.labels[str] = this.getPC() + (offset || 0);
      this.curlabel = str;
      this.tokens.forEach((tok) => tok.$loc.label = str);
    }
    parseFile(file, path) {
      this.path = path;
      var txtlines = file.split(/\n|\r\n?/);
      txtlines.forEach((line) => this.parseLine(line));
      var program = { opts: this.opts, stmts: this.stmts, labels: this.labels };
      this.checkAll(program);
      this.listings[path] = this.generateListing(file, program);
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
      var n = parseFloat(str);
      if (isNaN(n))
        this.compileError(`The number ${str} is not a valid floating-point number.`);
      if (this.opts.checkOverflow && !isFinite(n))
        this.compileError(`The number ${str} is too big to fit into a floating-point value.`);
      return n;
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
          if (isLiteral(arrdim) && typeof arrdim.value === "number" && arrdim.value < this.opts.defaultArrayBase)
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
      for (var ref of refs)
        this.checkCallGraph(ref, visited);
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
          let propname = Object.getOwnPropertyNames(this.opts).find((n) => n.toUpperCase() == optname);
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
    generateListing(file, program) {
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

  // src/worker/platforms.ts
  var PLATFORM_PARAMS = {
    "vcs": {
      arch: "6502",
      code_start: 4096,
      code_size: 61440,
      data_start: 128,
      data_size: 128,
      wiz_rom_ext: ".a26",
      wiz_inc_dir: "2600",
      cfgfile: "atari2600.cfg",
      libargs: ["crt0.o", "atari2600.lib"],
      extra_link_files: ["crt0.o", "atari2600.cfg"],
      define: ["__ATARI2600__"]
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
      libargs: ["--lib-path", "/share/target/apple2/drv", "apple2.lib"],
      __CODE_RUN__: 16384,
      code_start: 2051,
      acmeargs: ["-f", "apple"]
    },
    "apple2-e": {
      arch: "6502",
      define: ["__APPLE2__"],
      cfgfile: "apple2.cfg",
      libargs: ["apple2.lib"],
      acmeargs: ["-f", "apple"]
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
    "atari8-800": {
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
      libargs: ["c64.lib"],
      acmeargs: ["-f", "cbm"]
    },
    "vic20": {
      arch: "6502",
      define: ["__CBM__", "__VIC20__"],
      cfgfile: "vic20.cfg",
      libargs: ["vic20.lib"],
      acmeargs: ["-f", "cbm"]
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
    },
    "pce": {
      arch: "huc6280",
      define: ["__PCE__"],
      cfgfile: "pce.cfg",
      libargs: ["pce.lib", "-D", "__CARTSIZE__=0x8000"]
    },
    "exidy": {
      define: ["__EXIDY__"],
      cfgfile: "exidy.cfg",
      libargs: ["crt0.o", "none.lib"],
      extra_link_files: ["crt0.o", "exidy.cfg"]
    },
    "arm32": {
      arch: "arm32",
      define: ["__ARM__", "DISABLE_UNIMPLEMENTED_LIBC_APIS", "PRINTF_ALIAS_STANDARD_FUNCTION_NAMES_SOFT"],
      extra_compile_args: ["-I./arch/arm/include", "-I./openlibm/include", "-I./openlibm/src", "-I./printf/src"],
      extra_link_files: ["crt0.c", "libc.a"],
      extra_link_args: ["crt0.c", "-lc"]
    }
  };
  PLATFORM_PARAMS["sms-sms-libcv"] = PLATFORM_PARAMS["sms-sg1000-libcv"];
  PLATFORM_PARAMS["sms-gg-libcv"] = PLATFORM_PARAMS["sms-sms-libcv"];

  // src/worker/builder.ts
  var PSRC = "../../src/";
  var PWORKER = PSRC + "worker/";
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
    putFile(path, data) {
      var encoding = typeof data === "string" ? "utf8" : "binary";
      var entry = this.workfs[path];
      if (!entry || !compareData(entry.data, data) || entry.encoding != encoding) {
        this.workfs[path] = entry = { path, data, encoding, ts: this.newVersion() };
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
      let data = this.getFileData(path);
      if (data != null && typeof data !== "string")
        throw new Error(`${path}: expected string`);
      return data;
    }
    getFileEntry(path) {
      return this.workfs[path];
    }
    setItem(key, value) {
      this.items[key] = value;
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
        var [tool, remoteTool] = step.tool.split(":", 2);
        var toolfn = TOOLS[tool];
        if (!toolfn) {
          throw Error(`no tool named "${tool}"`);
        }
        if (remoteTool) {
          step.tool = remoteTool;
        }
        step.params = PLATFORM_PARAMS[getBasePlatform(platform)];
        try {
          step.result = await toolfn(step);
        } catch (e) {
          console.log("EXCEPTION", e, e.stack);
          return errorResult(e + "");
        }
        if (step.result) {
          step.result.params = step.params;
          if (step.debuginfo) {
            let r = step.result;
            if (!r.debuginfo)
              r.debuginfo = {};
            Object.assign(r.debuginfo, step.debuginfo);
          }
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
            linkstep.debuginfo = step.debuginfo;
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
    async handleMessage(data) {
      this.steps = [];
      if (data.updates) {
        data.updates.forEach((u) => store.putFile(u.path, u.data));
      }
      if (data.setitems) {
        data.setitems.forEach((i) => store.setItem(i.key, i.value));
      }
      if (data.buildsteps) {
        this.steps.push.apply(this.steps, data.buildsteps);
      }
      if (data.code) {
        this.steps.push(data);
      }
      if (this.steps.length) {
        var result = await this.executeBuildSteps();
        return result ? result : { unchanged: true };
      }
      console.log("Unknown message", data);
    }
  };
  function applyDefaultErrorPath(errors, path) {
    if (!path)
      return;
    for (var i = 0; i < errors.length; i++) {
      var err = errors[i];
      if (!err.path && err.line)
        err.path = path;
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
  var builder = new Builder();
  var _t1;
  function starttime() {
    _t1 = new Date();
  }
  function endtime(msg) {
    var _t2 = new Date();
    console.log(msg, _t2.getTime() - _t1.getTime(), "ms");
  }
  function putWorkFile(path, data) {
    return store.putFile(path, data);
  }
  function getWorkFileAsString(path) {
    return store.getFileAsString(path);
  }
  function populateEntry(fs, path, entry, options) {
    var data = entry.data;
    if (options && options.processFn) {
      data = options.processFn(path, data);
    }
    var toks = path.split("/");
    if (toks.length > 1) {
      for (var i = 0; i < toks.length - 1; i++)
        try {
          fs.mkdir(toks[i]);
        } catch (e) {
        }
    }
    fs.writeFile(path, data, { encoding: entry.encoding });
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
          var data = new Uint8Array(xhr.response);
          fs.writeFile(xfn, data, { encoding: "binary" });
          putWorkFile(xfn, data);
          console.log(":::", xfn, data.length);
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
  function processEmbedDirective(code) {
    let re3 = /^\s*#embed\s+"(.+?)"/gm;
    return code.replace(re3, (m, m1) => {
      let filename = m1;
      let filedata = store.getFileData(filename);
      let bytes = convertDataToUint8Array(filedata);
      if (!bytes)
        throw new Error('#embed: file not found: "' + filename + '"');
      let out = "";
      for (let i = 0; i < bytes.length; i++) {
        out += bytes[i].toString() + ",";
      }
      return out.substring(0, out.length - 1);
    });
  }

  // src/worker/wasmutils.ts
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
    var module = _WASM_module_cache[module_id];
    if (!module) {
      starttime();
      module = new WebAssembly.Module(wasmBlob[module_id]);
      if (CACHE_WASM_MODULES) {
        _WASM_module_cache[module_id] = module;
        delete wasmBlob[module_id];
      }
      endtime("module creation " + module_id);
    }
    return module;
  }
  function moduleInstFn(module_id) {
    return function(imports, ri) {
      var mod = getWASMModule(module_id);
      var inst = new WebAssembly.Instance(mod, imports);
      ri(inst);
      return inst.exports;
    };
  }
  function execMain(step, mod, args) {
    starttime();
    var run = mod.callMain || mod.run;
    run(args);
    endtime(step.tool);
    console.log("exec", step.tool, args.join(" "));
  }
  var fsMeta = {};
  var fsBlob = {};
  var wasmBlob = {};
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
  function load(modulename, debug3) {
    if (!loaded[modulename]) {
      importScripts(PWORKER + "asmjs/" + modulename + (debug3 ? "." + debug3 + ".js" : ".js"));
      loaded[modulename] = 1;
    }
  }
  function loadWASMBinary(modulename) {
    if (!loaded[modulename]) {
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
    return wasmBlob[modulename];
  }
  function loadWASM(modulename, debug3) {
    if (!loaded[modulename]) {
      importScripts(PWORKER + "wasm/" + modulename + (debug3 ? "." + debug3 + ".js" : ".js"));
      loadWASMBinary(modulename);
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
      name = "65-atari2600";
    if (name === "65-exidy")
      name = "65-none";
    if (!fsMeta[name])
      throw Error("No filesystem for '" + name + "'");
    FS.mkdir("/share");
    FS.mount(WORKERFS, {
      packages: [{ metadata: fsMeta[name], blob: fsBlob[name] }]
    }, "/share");
    var reader = WORKERFS.reader;
    var blobcache = {};
    WORKERFS.stream_ops.read = function(stream, buffer, offset, length, position) {
      if (position >= stream.node.size)
        return 0;
      var contents = blobcache[stream.path];
      if (!contents) {
        var ab = reader.readAsArrayBuffer(stream.node.contents);
        contents = blobcache[stream.path] = new Uint8Array(ab);
      }
      if (position + length > contents.length)
        length = contents.length - position;
      for (var i = 0; i < length; i++) {
        buffer[offset + i] = contents[position + i];
      }
      return length;
    };
  }
  var print_fn = function(s) {
    console.log(s);
  };
  function setupStdin(fs, code) {
    var i = 0;
    fs.init(function() {
      return i < code.length ? code.charCodeAt(i++) : null;
    });
  }

  // src/worker/listingutils.ts
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
  function extractErrors(regex, strings, path, iline, imsg, ifilename) {
    var errors = [];
    var matcher = makeErrorMatcher(errors, regex, iline, imsg, path, ifilename);
    for (var i = 0; i < strings.length; i++) {
      matcher(strings[i]);
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
        var offset = parseInt(linem[ioffset], 16);
        var insns = linem[iinsns];
        var cycles = icycles ? parseInt(linem[icycles]) : null;
        var iscode = cycles > 0;
        if (insns) {
          lines.push({
            line: linenum + lineofs,
            offset: offset - funcbase,
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
          var offset = parseInt(linem[1], 16);
          lines.push({
            line: lastlinenum,
            offset: offset - funcbase,
            segment,
            func
          });
          lastlinenum = 0;
        }
      }
    }
    return lines;
  }

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
      var json = JSON.stringify(ast, (key, value) => {
        return key == "$loc" ? void 0 : value;
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
        FWDIR + "/" + (params.wiz_inc_dir || getRootBasePlatform(step.platform)),
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
  function parseCA65Listing(asmfn, code, symbols, segments, params, dbg, listings) {
    var _a;
    var segofs = 0;
    var offset = 0;
    var dbgLineMatch = /^([0-9A-F]+)([r]?)\s+(\d+)\s+[.]dbg\s+(\w+), "([^"]+)", (.+)/;
    var funcLineMatch = /"(\w+)", (\w+), "(\w+)"/;
    var insnLineMatch = /^([0-9A-F]+)([r]?)\s{1,2}(\d+)\s{1,2}([0-9A-Frx ]{11})\s+(.*)/;
    var segMatch = /[.]segment\s+"(\w+)"/i;
    var origlines = [];
    var lines = origlines;
    var linenum = 0;
    let curpath = asmfn || "";
    for (var line of code.split(re_crlf)) {
      var dbgm = dbgLineMatch.exec(line);
      if (dbgm && dbgm[1]) {
        var dbgtype = dbgm[4];
        offset = parseInt(dbgm[1], 16);
        curpath = dbgm[5];
        if (curpath && listings) {
          let l = listings[curpath];
          if (!l)
            l = listings[curpath] = { lines: [] };
          lines = l.lines;
        }
        if (dbgtype == "func") {
          var funcm = funcLineMatch.exec(dbgm[6]);
          if (funcm) {
            var funcofs = symbols[funcm[3]];
            if (typeof funcofs === "number") {
              segofs = funcofs - offset;
            }
          }
        }
      }
      if (dbg && dbgm && dbgtype == "line") {
        lines.push({
          path: dbgm[5],
          line: parseInt(dbgm[6]),
          offset: offset + segofs,
          insns: null
        });
      }
      let linem = insnLineMatch.exec(line);
      let topfile = linem && linem[3] == "1";
      if (topfile) {
        let insns = ((_a = linem[4]) == null ? void 0 : _a.trim()) || "";
        if (!(insns != "" && linem[5] == "")) {
          linenum++;
        }
        if (linem[1]) {
          var offset = parseInt(linem[1], 16);
          if (insns.length) {
            if (!dbg) {
              lines.push({
                path: curpath,
                line: linenum,
                offset: offset + segofs,
                insns,
                iscode: true
              });
            }
          } else {
            var sym = null;
            var label = linem[5];
            if (label == null ? void 0 : label.endsWith(":")) {
              sym = label.substring(0, label.length - 1);
            } else if (label == null ? void 0 : label.toLowerCase().startsWith(".proc")) {
              sym = label.split(" ")[1];
            }
            if (sym && !sym.startsWith("@")) {
              var symofs = symbols[sym];
              if (typeof symofs === "number") {
                segofs = symofs - offset;
              }
            }
          }
        }
      }
    }
    return origlines;
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
      if (errors.length) {
        let listings = {};
        return { errors, listings };
      }
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
    var _a, _b;
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
      if (step.platform == "pce" && aout.length > 8192) {
        let newrom = new Uint8Array(aout.length);
        newrom.set(aout.slice(aout.length - 8192), 0);
        newrom.set(aout.slice(0, aout.length - 8192), 8192);
        aout = newrom;
      }
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
      var segments = [];
      let re_seglist = /(\w+)\s+([0-9A-F]+)\s+([0-9A-F]+)\s+([0-9A-F]+)\s+([0-9A-F]+)/;
      let parseseglist = false;
      let m;
      for (let s2 of mapout.split("\n")) {
        if (parseseglist && (m = re_seglist.exec(s2))) {
          let seg = m[1];
          let start = parseInt(m[2], 16);
          let size = parseInt(m[4], 16);
          let type = "";
          if (seg.startsWith("CODE") || seg == "STARTUP" || seg == "RODATA" || seg.endsWith("ROM"))
            type = "rom";
          else if (seg == "ZP" || seg == "DATA" || seg == "BSS" || seg.endsWith("RAM"))
            type = "ram";
          segments.push({ name: seg, start, size, type });
        }
        if (s2 == "Segment list:")
          parseseglist = true;
        if (s2 == "")
          parseseglist = false;
      }
      var listings = {};
      for (var fn of step.files) {
        if (fn.endsWith(".lst")) {
          var lstout = FS.readFile(fn, { encoding: "utf8" });
          lstout = lstout.split("\n\n")[1] || lstout;
          putWorkFile(fn, lstout);
          let isECS = ((_b = (_a = step.debuginfo) == null ? void 0 : _a.systems) == null ? void 0 : _b.Init) != null;
          if (isECS) {
            var asmlines = [];
            var srclines = parseCA65Listing(fn, lstout, symbolmap, segments, params, true, listings);
            listings[fn] = {
              lines: [],
              text: lstout
            };
          } else {
            var asmlines = parseCA65Listing(fn, lstout, symbolmap, segments, params, false);
            var srclines = parseCA65Listing("", lstout, symbolmap, segments, params, true);
            listings[fn] = {
              asmlines: srclines.length ? asmlines : null,
              lines: srclines.length ? srclines : asmlines,
              text: lstout
            };
          }
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
      populateFiles(step, FS, {
        mainFilePath: step.path,
        processFn: (path, code) => {
          if (typeof code === "string") {
            code = processEmbedDirective(code);
          }
          return code;
        }
      });
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

  // src/common/wasi/wasishim.ts
  var use_debug = true;
  var debug = use_debug ? console.log : () => {
  };
  var warning = console.log;
  var FDType;
  (function(FDType2) {
    FDType2[FDType2["UNKNOWN"] = 0] = "UNKNOWN";
    FDType2[FDType2["BLOCK_DEVICE"] = 1] = "BLOCK_DEVICE";
    FDType2[FDType2["CHARACTER_DEVICE"] = 2] = "CHARACTER_DEVICE";
    FDType2[FDType2["DIRECTORY"] = 3] = "DIRECTORY";
    FDType2[FDType2["REGULAR_FILE"] = 4] = "REGULAR_FILE";
    FDType2[FDType2["SOCKET_DGRAM"] = 5] = "SOCKET_DGRAM";
    FDType2[FDType2["SOCKET_STREAM"] = 6] = "SOCKET_STREAM";
    FDType2[FDType2["SYMBOLIC_LINK"] = 7] = "SYMBOLIC_LINK";
  })(FDType || (FDType = {}));
  var FDRights;
  (function(FDRights2) {
    FDRights2[FDRights2["FD_DATASYNC"] = 1] = "FD_DATASYNC";
    FDRights2[FDRights2["FD_READ"] = 2] = "FD_READ";
    FDRights2[FDRights2["FD_SEEK"] = 4] = "FD_SEEK";
    FDRights2[FDRights2["FD_FDSTAT_SET_FLAGS"] = 8] = "FD_FDSTAT_SET_FLAGS";
    FDRights2[FDRights2["FD_SYNC"] = 16] = "FD_SYNC";
    FDRights2[FDRights2["FD_TELL"] = 32] = "FD_TELL";
    FDRights2[FDRights2["FD_WRITE"] = 64] = "FD_WRITE";
    FDRights2[FDRights2["FD_ADVISE"] = 128] = "FD_ADVISE";
    FDRights2[FDRights2["FD_ALLOCATE"] = 256] = "FD_ALLOCATE";
    FDRights2[FDRights2["PATH_CREATE_DIRECTORY"] = 512] = "PATH_CREATE_DIRECTORY";
    FDRights2[FDRights2["PATH_CREATE_FILE"] = 1024] = "PATH_CREATE_FILE";
    FDRights2[FDRights2["PATH_LINK_SOURCE"] = 2048] = "PATH_LINK_SOURCE";
    FDRights2[FDRights2["PATH_LINK_TARGET"] = 4096] = "PATH_LINK_TARGET";
    FDRights2[FDRights2["PATH_OPEN"] = 8192] = "PATH_OPEN";
    FDRights2[FDRights2["FD_READDIR"] = 16384] = "FD_READDIR";
    FDRights2[FDRights2["PATH_READLINK"] = 32768] = "PATH_READLINK";
    FDRights2[FDRights2["PATH_RENAME_SOURCE"] = 65536] = "PATH_RENAME_SOURCE";
    FDRights2[FDRights2["PATH_RENAME_TARGET"] = 131072] = "PATH_RENAME_TARGET";
    FDRights2[FDRights2["PATH_FILESTAT_GET"] = 262144] = "PATH_FILESTAT_GET";
    FDRights2[FDRights2["PATH_FILESTAT_SET_SIZE"] = 524288] = "PATH_FILESTAT_SET_SIZE";
    FDRights2[FDRights2["PATH_FILESTAT_SET_TIMES"] = 1048576] = "PATH_FILESTAT_SET_TIMES";
    FDRights2[FDRights2["FD_FILESTAT_GET"] = 2097152] = "FD_FILESTAT_GET";
    FDRights2[FDRights2["FD_FILESTAT_SET_SIZE"] = 4194304] = "FD_FILESTAT_SET_SIZE";
    FDRights2[FDRights2["FD_FILESTAT_SET_TIMES"] = 8388608] = "FD_FILESTAT_SET_TIMES";
    FDRights2[FDRights2["PATH_SYMLINK"] = 16777216] = "PATH_SYMLINK";
    FDRights2[FDRights2["PATH_REMOVE_DIRECTORY"] = 33554432] = "PATH_REMOVE_DIRECTORY";
    FDRights2[FDRights2["PATH_UNLINK_FILE"] = 67108864] = "PATH_UNLINK_FILE";
    FDRights2[FDRights2["POLL_FD_READWRITE"] = 134217728] = "POLL_FD_READWRITE";
    FDRights2[FDRights2["SOCK_SHUTDOWN"] = 268435456] = "SOCK_SHUTDOWN";
    FDRights2[FDRights2["FD_ALL"] = 536870911] = "FD_ALL";
  })(FDRights || (FDRights = {}));
  var FDFlags;
  (function(FDFlags2) {
    FDFlags2[FDFlags2["APPEND"] = 1] = "APPEND";
    FDFlags2[FDFlags2["DSYNC"] = 2] = "DSYNC";
    FDFlags2[FDFlags2["NONBLOCK"] = 4] = "NONBLOCK";
    FDFlags2[FDFlags2["RSYNC"] = 8] = "RSYNC";
    FDFlags2[FDFlags2["SYNC"] = 16] = "SYNC";
  })(FDFlags || (FDFlags = {}));
  var FDOpenFlags;
  (function(FDOpenFlags2) {
    FDOpenFlags2[FDOpenFlags2["CREAT"] = 1] = "CREAT";
    FDOpenFlags2[FDOpenFlags2["DIRECTORY"] = 2] = "DIRECTORY";
    FDOpenFlags2[FDOpenFlags2["EXCL"] = 4] = "EXCL";
    FDOpenFlags2[FDOpenFlags2["TRUNC"] = 8] = "TRUNC";
  })(FDOpenFlags || (FDOpenFlags = {}));
  var WASIErrors;
  (function(WASIErrors2) {
    WASIErrors2[WASIErrors2["SUCCESS"] = 0] = "SUCCESS";
    WASIErrors2[WASIErrors2["TOOBIG"] = 1] = "TOOBIG";
    WASIErrors2[WASIErrors2["ACCES"] = 2] = "ACCES";
    WASIErrors2[WASIErrors2["ADDRINUSE"] = 3] = "ADDRINUSE";
    WASIErrors2[WASIErrors2["ADDRNOTAVAIL"] = 4] = "ADDRNOTAVAIL";
    WASIErrors2[WASIErrors2["AFNOSUPPORT"] = 5] = "AFNOSUPPORT";
    WASIErrors2[WASIErrors2["AGAIN"] = 6] = "AGAIN";
    WASIErrors2[WASIErrors2["ALREADY"] = 7] = "ALREADY";
    WASIErrors2[WASIErrors2["BADF"] = 8] = "BADF";
    WASIErrors2[WASIErrors2["BADMSG"] = 9] = "BADMSG";
    WASIErrors2[WASIErrors2["BUSY"] = 10] = "BUSY";
    WASIErrors2[WASIErrors2["CANCELED"] = 11] = "CANCELED";
    WASIErrors2[WASIErrors2["CHILD"] = 12] = "CHILD";
    WASIErrors2[WASIErrors2["CONNABORTED"] = 13] = "CONNABORTED";
    WASIErrors2[WASIErrors2["CONNREFUSED"] = 14] = "CONNREFUSED";
    WASIErrors2[WASIErrors2["CONNRESET"] = 15] = "CONNRESET";
    WASIErrors2[WASIErrors2["DEADLK"] = 16] = "DEADLK";
    WASIErrors2[WASIErrors2["DESTADDRREQ"] = 17] = "DESTADDRREQ";
    WASIErrors2[WASIErrors2["DOM"] = 18] = "DOM";
    WASIErrors2[WASIErrors2["DQUOT"] = 19] = "DQUOT";
    WASIErrors2[WASIErrors2["EXIST"] = 20] = "EXIST";
    WASIErrors2[WASIErrors2["FAULT"] = 21] = "FAULT";
    WASIErrors2[WASIErrors2["FBIG"] = 22] = "FBIG";
    WASIErrors2[WASIErrors2["HOSTUNREACH"] = 23] = "HOSTUNREACH";
    WASIErrors2[WASIErrors2["IDRM"] = 24] = "IDRM";
    WASIErrors2[WASIErrors2["ILSEQ"] = 25] = "ILSEQ";
    WASIErrors2[WASIErrors2["INPROGRESS"] = 26] = "INPROGRESS";
    WASIErrors2[WASIErrors2["INTR"] = 27] = "INTR";
    WASIErrors2[WASIErrors2["INVAL"] = 28] = "INVAL";
    WASIErrors2[WASIErrors2["IO"] = 29] = "IO";
    WASIErrors2[WASIErrors2["ISCONN"] = 30] = "ISCONN";
    WASIErrors2[WASIErrors2["ISDIR"] = 31] = "ISDIR";
    WASIErrors2[WASIErrors2["LOOP"] = 32] = "LOOP";
    WASIErrors2[WASIErrors2["MFILE"] = 33] = "MFILE";
    WASIErrors2[WASIErrors2["MLINK"] = 34] = "MLINK";
    WASIErrors2[WASIErrors2["MSGSIZE"] = 35] = "MSGSIZE";
    WASIErrors2[WASIErrors2["MULTIHOP"] = 36] = "MULTIHOP";
    WASIErrors2[WASIErrors2["NAMETOOLONG"] = 37] = "NAMETOOLONG";
    WASIErrors2[WASIErrors2["NETDOWN"] = 38] = "NETDOWN";
    WASIErrors2[WASIErrors2["NETRESET"] = 39] = "NETRESET";
    WASIErrors2[WASIErrors2["NETUNREACH"] = 40] = "NETUNREACH";
    WASIErrors2[WASIErrors2["NFILE"] = 41] = "NFILE";
    WASIErrors2[WASIErrors2["NOBUFS"] = 42] = "NOBUFS";
    WASIErrors2[WASIErrors2["NODEV"] = 43] = "NODEV";
    WASIErrors2[WASIErrors2["NOENT"] = 44] = "NOENT";
    WASIErrors2[WASIErrors2["NOEXEC"] = 45] = "NOEXEC";
    WASIErrors2[WASIErrors2["NOLCK"] = 46] = "NOLCK";
    WASIErrors2[WASIErrors2["NOLINK"] = 47] = "NOLINK";
    WASIErrors2[WASIErrors2["NOMEM"] = 48] = "NOMEM";
    WASIErrors2[WASIErrors2["NOMSG"] = 49] = "NOMSG";
    WASIErrors2[WASIErrors2["NOPROTOOPT"] = 50] = "NOPROTOOPT";
    WASIErrors2[WASIErrors2["NOSPC"] = 51] = "NOSPC";
    WASIErrors2[WASIErrors2["NOSYS"] = 52] = "NOSYS";
    WASIErrors2[WASIErrors2["NOTCONN"] = 53] = "NOTCONN";
    WASIErrors2[WASIErrors2["NOTDIR"] = 54] = "NOTDIR";
    WASIErrors2[WASIErrors2["NOTEMPTY"] = 55] = "NOTEMPTY";
    WASIErrors2[WASIErrors2["NOTRECOVERABLE"] = 56] = "NOTRECOVERABLE";
    WASIErrors2[WASIErrors2["NOTSOCK"] = 57] = "NOTSOCK";
    WASIErrors2[WASIErrors2["NOTSUP"] = 58] = "NOTSUP";
    WASIErrors2[WASIErrors2["NOTTY"] = 59] = "NOTTY";
    WASIErrors2[WASIErrors2["NXIO"] = 60] = "NXIO";
    WASIErrors2[WASIErrors2["OVERFLOW"] = 61] = "OVERFLOW";
    WASIErrors2[WASIErrors2["OWNERDEAD"] = 62] = "OWNERDEAD";
    WASIErrors2[WASIErrors2["PERM"] = 63] = "PERM";
    WASIErrors2[WASIErrors2["PIPE"] = 64] = "PIPE";
    WASIErrors2[WASIErrors2["PROTO"] = 65] = "PROTO";
    WASIErrors2[WASIErrors2["PROTONOSUPPORT"] = 66] = "PROTONOSUPPORT";
    WASIErrors2[WASIErrors2["PROTOTYPE"] = 67] = "PROTOTYPE";
    WASIErrors2[WASIErrors2["RANGE"] = 68] = "RANGE";
    WASIErrors2[WASIErrors2["ROFS"] = 69] = "ROFS";
    WASIErrors2[WASIErrors2["SPIPE"] = 70] = "SPIPE";
    WASIErrors2[WASIErrors2["SRCH"] = 71] = "SRCH";
    WASIErrors2[WASIErrors2["STALE"] = 72] = "STALE";
    WASIErrors2[WASIErrors2["TIMEDOUT"] = 73] = "TIMEDOUT";
    WASIErrors2[WASIErrors2["TXTBSY"] = 74] = "TXTBSY";
    WASIErrors2[WASIErrors2["XDEV"] = 75] = "XDEV";
    WASIErrors2[WASIErrors2["NOTCAPABLE"] = 76] = "NOTCAPABLE";
  })(WASIErrors || (WASIErrors = {}));
  var WASIFileDescriptor = class {
    constructor(name, type, rights) {
      this.name = name;
      this.type = type;
      this.rights = rights;
      this.fdindex = -1;
      this.data = new Uint8Array(16);
      this.flags = 0;
      this.size = 0;
      this.offset = 0;
      this.rights = -1;
    }
    ensureCapacity(size) {
      if (this.data.byteLength < size) {
        const newdata = new Uint8Array(size * 2);
        newdata.set(this.data);
        this.data = newdata;
      }
    }
    write(chunk) {
      this.ensureCapacity(this.offset + chunk.byteLength);
      this.data.set(chunk, this.offset);
      this.offset += chunk.byteLength;
      this.size = Math.max(this.size, this.offset);
    }
    read(chunk) {
      const len = Math.min(chunk.byteLength, this.size - this.offset);
      chunk.set(this.data.subarray(this.offset, this.offset + len));
      this.offset += len;
      return len;
    }
    truncate() {
      this.size = 0;
      this.offset = 0;
    }
    llseek(offset, whence) {
      switch (whence) {
        case 0:
          this.offset = offset;
          break;
        case 1:
          this.offset += offset;
          break;
        case 2:
          this.offset = this.size + offset;
          break;
      }
      if (this.offset < 0)
        this.offset = 0;
      if (this.offset > this.size)
        this.offset = this.size;
    }
    getBytes() {
      return this.data.subarray(0, this.size);
    }
    getBytesAsString() {
      return new TextDecoder().decode(this.getBytes());
    }
    toString() {
      return `FD(${this.fdindex} "${this.name}" 0x${this.type.toString(16)} 0x${this.rights.toString(16)} ${this.offset}/${this.size}/${this.data.byteLength})`;
    }
  };
  var WASIStreamingFileDescriptor = class extends WASIFileDescriptor {
    constructor(fdindex, name, type, rights, stream) {
      super(name, type, rights);
      this.stream = stream;
      this.fdindex = fdindex;
    }
    write(chunk) {
      this.stream.write(chunk);
    }
  };
  var WASIMemoryFilesystem = class {
    constructor() {
      this.parent = null;
      this.files = new Map();
      this.dirs = new Map();
      this.putDirectory("/");
    }
    setParent(parent) {
      this.parent = parent;
    }
    putDirectory(name, rights) {
      if (!rights)
        rights = 8192 | 512 | 1024;
      if (name != "/" && name.endsWith("/"))
        name = name.substring(0, name.length - 1);
      const parent = name.substring(0, name.lastIndexOf("/"));
      if (parent && parent != name) {
        this.putDirectory(parent, rights);
      }
      const dir = new WASIFileDescriptor(name, 3, rights);
      this.dirs.set(name, dir);
      return dir;
    }
    putFile(name, data, rights) {
      if (typeof data === "string") {
        data = new TextEncoder().encode(data);
      }
      if (!rights)
        rights = 2 | 64;
      const file = new WASIFileDescriptor(name, 4, rights);
      file.write(data);
      file.offset = 0;
      this.files.set(name, file);
      return file;
    }
    putSymbolicLink(name, target, rights) {
      if (!rights)
        rights = 16777216;
      const file = new WASIFileDescriptor(name, 7, rights);
      file.write(new TextEncoder().encode(target));
      file.offset = 0;
      this.files.set(name, file);
      return file;
    }
    getFile(name) {
      var _a;
      let file = this.files.get(name);
      if (!file) {
        file = (_a = this.parent) == null ? void 0 : _a.getFile(name);
      }
      return file;
    }
    getDirectories() {
      return [...this.dirs.values()];
    }
    getFiles() {
      return [...this.files.values()];
    }
  };
  var _instance, _memarr8, _memarr32, _args, _envvars;
  var WASIRunner = class {
    constructor() {
      __privateAdd(this, _instance, void 0);
      __privateAdd(this, _memarr8, void 0);
      __privateAdd(this, _memarr32, void 0);
      __privateAdd(this, _args, []);
      __privateAdd(this, _envvars, []);
      this.fds = [];
      this.exited = false;
      this.errno = -1;
      this.fs = new WASIMemoryFilesystem();
      this.createStdioBrowser();
    }
    exports() {
      return __privateGet(this, _instance).exports;
    }
    createStdioNode() {
      this.stdin = new WASIStreamingFileDescriptor(0, "<stdin>", 2, 2, process.stdin);
      this.stdout = new WASIStreamingFileDescriptor(1, "<stdout>", 2, 64, process.stdout);
      this.stderr = new WASIStreamingFileDescriptor(2, "<stderr>", 2, 64, process.stderr);
      this.fds[0] = this.stdin;
      this.fds[1] = this.stdout;
      this.fds[2] = this.stderr;
    }
    createStdioBrowser() {
      this.stdin = new WASIFileDescriptor("<stdin>", 2, 2);
      this.stdout = new WASIFileDescriptor("<stdout>", 2, 64);
      this.stderr = new WASIFileDescriptor("<stderr>", 2, 64);
      this.stdin.fdindex = 0;
      this.stdout.fdindex = 1;
      this.stderr.fdindex = 2;
      this.fds[0] = this.stdin;
      this.fds[1] = this.stdout;
      this.fds[2] = this.stderr;
    }
    initSync(wasmModule) {
      __privateSet(this, _instance, new WebAssembly.Instance(wasmModule, this.getImportObject()));
    }
    loadSync(wasmSource) {
      let wasmModule = new WebAssembly.Module(wasmSource);
      this.initSync(wasmModule);
    }
    async loadAsync(wasmSource) {
      let wasmModule = await WebAssembly.compile(wasmSource);
      __privateSet(this, _instance, await WebAssembly.instantiate(wasmModule, this.getImportObject()));
    }
    setArgs(args) {
      __privateSet(this, _args, args.map((arg) => new TextEncoder().encode(arg + "\0")));
    }
    addPreopenDirectory(name) {
      return this.openFile(name, 2 | 1);
    }
    openFile(path, o_flags, mode) {
      let file = this.fs.getFile(path);
      mode = typeof mode == "undefined" ? 438 : mode;
      if (o_flags & 1) {
        if (file == null) {
          if (o_flags & 2) {
            file = this.fs.putDirectory(path);
          } else {
            file = this.fs.putFile(path, new Uint8Array(), 536870911);
          }
        } else {
          if (o_flags & 8) {
            file.truncate();
          } else
            return 28;
        }
      } else {
        if (file == null)
          return 52;
        if (o_flags & 2) {
          if (file.type !== 3)
            return 52;
        }
        if (o_flags & 4)
          return 28;
        if (o_flags & 8) {
          file.truncate();
        } else {
          file.llseek(0, 0);
        }
      }
      file.fdindex = this.fds.length;
      this.fds.push(file);
      return file;
    }
    mem8() {
      var _a;
      if (!((_a = __privateGet(this, _memarr8)) == null ? void 0 : _a.byteLength)) {
        __privateSet(this, _memarr8, new Uint8Array(__privateGet(this, _instance).exports.memory.buffer));
      }
      return __privateGet(this, _memarr8);
    }
    mem32() {
      var _a;
      if (!((_a = __privateGet(this, _memarr32)) == null ? void 0 : _a.byteLength)) {
        __privateSet(this, _memarr32, new Int32Array(__privateGet(this, _instance).exports.memory.buffer));
      }
      return __privateGet(this, _memarr32);
    }
    run() {
      try {
        __privateGet(this, _instance).exports._start();
        if (!this.exited) {
          this.exited = true;
          this.errno = 0;
        }
      } catch (err) {
        if (!this.exited)
          throw err;
      }
      return this.getErrno();
    }
    initialize() {
      __privateGet(this, _instance).exports._initialize();
      return this.getErrno();
    }
    getImportObject() {
      return {
        "wasi_snapshot_preview1": this.getWASISnapshotPreview1(),
        "env": this.getEnv()
      };
    }
    peek8(ptr) {
      return this.mem8()[ptr];
    }
    peek16(ptr) {
      return this.mem8()[ptr] | this.mem8()[ptr + 1] << 8;
    }
    peek32(ptr) {
      return this.mem32()[ptr >>> 2];
    }
    poke8(ptr, val) {
      this.mem8()[ptr] = val;
    }
    poke16(ptr, val) {
      this.mem8()[ptr] = val;
      this.mem8()[ptr + 1] = val >> 8;
    }
    poke32(ptr, val) {
      this.mem32()[ptr >>> 2] = val;
    }
    poke64(ptr, val) {
      this.mem32()[ptr >>> 2] = val;
      this.mem32()[(ptr >>> 2) + 1] = 0;
    }
    pokeUTF8(str, ptr, maxlen) {
      const enc = new TextEncoder();
      const bytes = enc.encode(str);
      const len = Math.min(bytes.length, maxlen);
      this.mem8().set(bytes.subarray(0, len), ptr);
      return len;
    }
    peekUTF8(ptr, maxlen) {
      const bytes = this.mem8().subarray(ptr, ptr + maxlen);
      const dec = new TextDecoder();
      return dec.decode(bytes);
    }
    getErrno() {
      return this.errno;
    }
    poke_str_array_sizes(strs, count_ptr, buf_size_ptr) {
      this.poke32(count_ptr, strs.length);
      this.poke32(buf_size_ptr, strs.reduce((acc, arg) => acc + arg.length, 0));
    }
    poke_str_args(strs, argv_ptr, argv_buf_ptr) {
      let argv = argv_ptr;
      let argv_buf = argv_buf_ptr;
      for (let arg of __privateGet(this, _args)) {
        this.poke32(argv, argv_buf);
        argv += 4;
        for (let i = 0; i < arg.length; i++) {
          this.poke8(argv_buf, arg[i]);
          argv_buf++;
        }
      }
    }
    args_sizes_get(argcount_ptr, argv_buf_size_ptr) {
      debug("args_sizes_get", argcount_ptr, argv_buf_size_ptr);
      this.poke_str_array_sizes(__privateGet(this, _args), argcount_ptr, argv_buf_size_ptr);
      return 0;
    }
    args_get(argv_ptr, argv_buf_ptr) {
      debug("args_get", argv_ptr, argv_buf_ptr);
      this.poke_str_args(__privateGet(this, _args), argv_ptr, argv_buf_ptr);
      return 0;
    }
    environ_sizes_get(environ_count_ptr, environ_buf_size_ptr) {
      debug("environ_sizes_get", environ_count_ptr, environ_buf_size_ptr);
      this.poke_str_array_sizes(__privateGet(this, _envvars), environ_count_ptr, environ_buf_size_ptr);
      return 0;
    }
    environ_get(environ_ptr, environ_buf_ptr) {
      debug("environ_get", environ_ptr, environ_buf_ptr);
      this.poke_str_args(__privateGet(this, _envvars), environ_ptr, environ_buf_ptr);
      return 0;
    }
    fd_write(fd, iovs, iovs_len, nwritten_ptr) {
      const stream = this.fds[fd];
      const iovecs = this.mem32().subarray(iovs >>> 2, iovs + iovs_len * 8 >>> 2);
      let total = 0;
      for (let i = 0; i < iovs_len; i++) {
        const ptr = iovecs[i * 2];
        const len = iovecs[i * 2 + 1];
        const chunk = this.mem8().subarray(ptr, ptr + len);
        total += len;
        stream.write(chunk);
      }
      this.poke32(nwritten_ptr, total);
      debug("fd_write", fd, iovs, iovs_len, "->", total);
      return 0;
    }
    fd_read(fd, iovs, iovs_len, nread_ptr) {
      const stream = this.fds[fd];
      const iovecs = this.mem32().subarray(iovs >>> 2, iovs + iovs_len * 8 >>> 2);
      let total = 0;
      for (let i = 0; i < iovs_len; i++) {
        const ptr = iovecs[i * 2];
        const len = iovecs[i * 2 + 1];
        const chunk = this.mem8().subarray(ptr, ptr + len);
        total += stream.read(chunk);
      }
      this.poke32(nread_ptr, total);
      debug("fd_read", fd, iovs, iovs_len, "->", total);
      return 0;
    }
    fd_seek(fd, offset, whence, newoffset_ptr) {
      const file = this.fds[fd];
      if (typeof offset == "bigint")
        offset = Number(offset);
      debug("fd_seek", fd, offset, whence, file + "");
      if (file != null) {
        file.llseek(offset, whence);
        this.poke64(newoffset_ptr, file.offset);
        return 0;
      }
      return 8;
    }
    fd_close(fd) {
      debug("fd_close", fd);
      const file = this.fds[fd];
      if (file != null) {
        this.fds[fd] = null;
        return 0;
      }
      return 8;
    }
    proc_exit(errno) {
      debug("proc_exit", errno);
      this.errno = errno;
      this.exited = true;
    }
    fd_prestat_get(fd, prestat_ptr) {
      const file = this.fds[fd];
      debug("fd_prestat_get", fd, prestat_ptr, file == null ? void 0 : file.name);
      if (file && file.type === 3) {
        const enc_name = new TextEncoder().encode(file.name);
        this.poke8(prestat_ptr + 0, 0);
        this.poke64(prestat_ptr + 8, enc_name.length);
        return 0;
      }
      return 8;
    }
    fd_fdstat_get(fd, fdstat_ptr) {
      const file = this.fds[fd];
      debug("fd_fdstat_get", fd, fdstat_ptr, file + "");
      if (file != null) {
        this.poke16(fdstat_ptr + 0, file.type);
        this.poke16(fdstat_ptr + 2, file.flags);
        this.poke64(fdstat_ptr + 8, file.rights);
        this.poke64(fdstat_ptr + 16, file.rights);
        return 0;
      }
      return 8;
    }
    fd_prestat_dir_name(fd, path_ptr, path_len) {
      const file = this.fds[fd];
      debug("fd_prestat_dir_name", fd, path_ptr, path_len);
      if (file != null) {
        this.pokeUTF8(file.name, path_ptr, path_len);
        return 0;
      }
      return 28;
    }
    path_open(dirfd, dirflags, path_ptr, path_len, o_flags, fs_rights_base, fs_rights_inheriting, fd_flags, fd_ptr) {
      const dir = this.fds[dirfd];
      if (dir == null)
        return 8;
      if (dir.type !== 3)
        return 54;
      const filename = this.peekUTF8(path_ptr, path_len);
      const path = dir.name + "/" + filename;
      const fd = this.openFile(path, o_flags, fd_flags);
      debug("path_open", path, dirfd, dirflags, o_flags, fd_flags, fd_ptr, "->", fd + "");
      if (typeof fd === "number")
        return fd;
      this.poke32(fd_ptr, fd.fdindex);
      return 0;
    }
    random_get(ptr, len) {
      debug("random_get", ptr, len);
      for (let i = 0; i < len; i++) {
        this.poke8(ptr + i, Math.floor(Math.random() * 256));
      }
      return 0;
    }
    path_filestat_get(dirfd, dirflags, path_ptr, path_len, filestat_ptr) {
      const dir = this.fds[dirfd];
      if (dir == null)
        return 8;
      if (dir.type !== 3)
        return 54;
      const filename = this.peekUTF8(path_ptr, path_len);
      const path = filename.startsWith("/") ? filename : dir.name + "/" + filename;
      const fd = this.fs.getFile(path);
      console.log("path_filestat_get", dir + "", filename, path, filestat_ptr, "->", fd + "");
      if (!fd)
        return 44;
      this.poke64(filestat_ptr, fd.fdindex);
      this.poke64(filestat_ptr + 8, 0);
      this.poke8(filestat_ptr + 16, fd.type);
      this.poke64(filestat_ptr + 24, 1);
      this.poke64(filestat_ptr + 32, fd.size);
      this.poke64(filestat_ptr + 40, 0);
      this.poke64(filestat_ptr + 48, 0);
      this.poke64(filestat_ptr + 56, 0);
    }
    path_readlink(dirfd, path_ptr, path_len, buf_ptr, buf_len, buf_used_ptr) {
      const dir = this.fds[dirfd];
      debug("path_readlink", dirfd, path_ptr, path_len, buf_ptr, buf_len, buf_used_ptr, dir + "");
      if (dir == null)
        return 8;
      if (dir.type !== 3)
        return 54;
      const filename = this.peekUTF8(path_ptr, path_len);
      const path = dir.name + "/" + filename;
      const fd = this.fs.getFile(path);
      debug("path_readlink", path, fd + "");
      if (!fd)
        return 44;
      if (fd.type !== 7)
        return 28;
      const target = fd.getBytesAsString();
      const len = this.pokeUTF8(target, buf_ptr, buf_len);
      this.poke32(buf_used_ptr, len);
      debug("path_readlink", path, "->", target);
      return 0;
    }
    path_readlinkat(dirfd, path_ptr, path_len, buf_ptr, buf_len, buf_used_ptr) {
      return this.path_readlink(dirfd, path_ptr, path_len, buf_ptr, buf_len, buf_used_ptr);
    }
    path_unlink_file(dirfd, path_ptr, path_len) {
      const dir = this.fds[dirfd];
      if (dir == null)
        return 8;
      if (dir.type !== 3)
        return 54;
      const filename = this.peekUTF8(path_ptr, path_len);
      const path = dir.name + "/" + filename;
      const fd = this.fs.getFile(path);
      debug("path_unlink_file", dir + "", path, fd + "");
      if (!fd)
        return 44;
      this.fs.getFile(path);
      return 0;
    }
    clock_time_get(clock_id, precision, time_ptr) {
      const time = Date.now();
      this.poke64(time_ptr, time);
      return 0;
    }
    getWASISnapshotPreview1() {
      return {
        args_sizes_get: this.args_sizes_get.bind(this),
        args_get: this.args_get.bind(this),
        environ_sizes_get: this.environ_sizes_get.bind(this),
        environ_get: this.environ_get.bind(this),
        proc_exit: this.proc_exit.bind(this),
        path_open: this.path_open.bind(this),
        fd_prestat_get: this.fd_prestat_get.bind(this),
        fd_prestat_dir_name: this.fd_prestat_dir_name.bind(this),
        fd_fdstat_get: this.fd_fdstat_get.bind(this),
        fd_read: this.fd_read.bind(this),
        fd_write: this.fd_write.bind(this),
        fd_seek: this.fd_seek.bind(this),
        fd_close: this.fd_close.bind(this),
        path_filestat_get: this.path_filestat_get.bind(this),
        random_get: this.random_get.bind(this),
        path_readlink: this.path_readlink.bind(this),
        path_unlink_file: this.path_unlink_file.bind(this),
        clock_time_get: this.clock_time_get.bind(this),
        fd_fdstat_set_flags() {
          warning("TODO: fd_fdstat_set_flags");
          return 58;
        },
        fd_readdir() {
          warning("TODO: fd_readdir");
          return 58;
        },
        fd_tell() {
          warning("TODO: fd_tell");
          return 58;
        },
        path_remove_directory() {
          warning("TODO: path_remove_directory");
          return 0;
        }
      };
    }
    getEnv() {
      return {
        __syscall_unlinkat() {
          warning("TODO: unlink");
          return 58;
        },
        __syscall_faccessat() {
          warning("TODO: faccessat");
          return 58;
        },
        __syscall_readlinkat: this.path_readlinkat.bind(this),
        __syscall_getcwd() {
          warning("TODO: getcwd");
          return 58;
        },
        __syscall_rmdir() {
          warning("TODO: rmdir");
          return 58;
        },
        segfault() {
          warning("TODO: segfault");
          return 58;
        },
        alignfault() {
          warning("TODO: alignfault");
          return 58;
        },
        __wasilibc_cwd: new WebAssembly.Global({
          value: "i32",
          mutable: true
        }, 0)
      };
    }
  };
  _instance = new WeakMap();
  _memarr8 = new WeakMap();
  _memarr32 = new WeakMap();
  _args = new WeakMap();
  _envvars = new WeakMap();

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
        let offset = parseInt(linem[3], 16);
        let insns = linem[4];
        let restline = linem[5];
        if (insns && insns.startsWith("?"))
          insns = null;
        if (lstlist && lstlist.lines) {
          lstlist.lines.push({
            line: lstline,
            offset,
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
              offset,
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
              offset,
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
                offset,
                insns,
                iscode: true
              });
            }
          } else {
            if (insns && linem[3] && lastline > 0) {
              lines.push({
                line: lastline + 1,
                offset,
                insns: null
              });
            }
          }
        }
        for (let key in unresolved) {
          let l = restline || line;
          let pos = l.indexOf(key);
          if (pos >= 0) {
            let cmt = l.indexOf(";");
            if (cmt < 0 || cmt > pos) {
              if (new RegExp("\\b" + key + "\\b").exec(l)) {
                errors.push({
                  path: filename,
                  line: linenum,
                  msg: "Unresolved symbol '" + key + "'"
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
  var re_usl = /(\w+)\s+0000\s+[?][?][?][?]/;
  function parseSymbolMap(asym) {
    var symbolmap = {};
    for (var s of asym.split("\n")) {
      var toks = s.split(/\s+/);
      if (toks && toks.length >= 2 && !toks[0].startsWith("-")) {
        symbolmap[toks[0]] = parseInt(toks[1], 16);
      }
    }
    return symbolmap;
  }
  function assembleDASM(step) {
    load("dasm");
    var unresolved = {};
    var errors = [];
    var errorMatcher = msvcErrorMatcher(errors);
    function match_fn(s) {
      var matches = re_usl.exec(s);
      if (matches) {
        var key = matches[1];
        if (key != "NO_ILLEGAL_OPCODES") {
          unresolved[matches[1]] = 0;
        }
      } else if (s.startsWith("Warning:")) {
        errors.push({ line: 0, msg: s.substr(9) });
      } else if (s.startsWith("unable ")) {
        errors.push({ line: 0, msg: s });
      } else if (s.startsWith("segment: ")) {
        errors.push({ line: 0, msg: "Segment overflow: " + s.substring(9) });
      } else if (s.toLowerCase().indexOf("error:") >= 0) {
        errors.push({ line: 0, msg: s.trim() });
      } else {
        errorMatcher(s);
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
    const symbolmap = parseSymbolMap(asym);
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

  // src/worker/tools/mcpp.ts
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
    populateFiles(step, FS, {
      mainFilePath: step.path,
      processFn: (path, code) => {
        if (typeof code === "string") {
          code = processEmbedDirective(code);
        }
        return code;
      }
    });
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
    let platform_def = platform.toUpperCase().replaceAll(/[^a-zA-Z0-9]/g, "_");
    args.unshift.apply(args, ["-D", `__PLATFORM_${platform_def}__`]);
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
      if (errors.length) {
        return { errors };
      }
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
    var data = [];
    for (var i = 0; i < s.length; i++) {
      data[i] = s.charCodeAt(i);
    }
    return data;
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
    addWords(data) {
      this.asmlines.push({
        line: this.linenum,
        offset: this.ip,
        nbits: this.width * data.length
      });
      for (var i = 0; i < data.length; i++) {
        if (this.width < 32)
          this.outwords[this.ip++ - this.origin] = data[i] & (1 << this.width) - 1;
        else
          this.outwords[this.ip++ - this.origin] = data[i];
      }
    }
    parseData(toks) {
      var data = [];
      for (var i = 0; i < toks.length; i++) {
        data[i] = this.parseConst(toks[i]);
      }
      return data;
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
        var n = Math.min(nbits, this.width);
        var mask = (1 << n) - 1;
        y <<= n;
        y |= x & mask;
        x >>>= n;
        nbits -= n;
      }
      return y;
    }
    buildInstruction(rule, m) {
      var opcode = 0;
      var oplen = 0;
      for (let b of rule.bits) {
        let n, x;
        if (typeof b === "string") {
          n = b.length;
          x = parseInt(b, 2);
        } else {
          var index = typeof b === "number" ? b : b.a;
          var id = m[index + 1];
          var v = this.spec.vars[rule.varlist[index]];
          if (!v) {
            return { error: `Could not find matching identifier for '${m[0]}' index ${index}` };
          }
          n = v.bits;
          var shift = 0;
          if (typeof b !== "number") {
            n = b.n;
            shift = b.b;
          }
          if (v.toks) {
            x = v.toks.indexOf(id);
            if (x < 0)
              return { error: "Can't use '" + id + "' here, only one of: " + v.toks.join(", ") };
          } else {
            x = this.parseConst(id, n);
            if (isNaN(x)) {
              this.fixups.push({
                sym: id,
                ofs: this.ip,
                size: v.bits,
                line: this.linenum,
                dstlen: n,
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
        opcode = opcode << n | x;
        oplen += n;
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
      var arr = node.children.filter((n) => n.type == type);
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
      var module = {
        $loc: this.parseSourceLocation(node),
        name: node.attrs["name"],
        origName: node.attrs["origName"],
        blocks: [],
        instances: [],
        vardefs: {}
      };
      if (this.cur_module)
        throw new CompileError2(this.cur_loc, `nested modules not supported`);
      this.cur_module = module;
      return module;
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
      this.findChildren(node, "var", false).forEach((n) => {
        if (isVarDecl(n.obj)) {
          this.cur_module.vardefs[n.obj.name] = n.obj;
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
      node.children.forEach((n) => exprs.push(n.obj));
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
      node.children.forEach((n) => block.exprs.push(n.obj));
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
      node.children.forEach((n) => {
        if (n.obj) {
          var file = this.files[n.obj.id];
          if (file)
            file.isModule = true;
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
      var file = {
        id: node.attrs["id"],
        filename: node.attrs["filename"],
        isModule
      };
      this.files[file.id] = file;
      return file;
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
        children: node.children.map((n) => n.obj)
      };
      if (node.children.length > 0)
        throw new CompileError2(this.cur_loc, `multiple non-flattened modules not yet supported`);
      node.children.forEach((n) => n.obj.parent = hier);
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
        args: node.children.map((n) => n.obj)
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
      var key = top_module + "/" + includes;
      if (jsasm_module_key != key) {
        jsasm_module_key = key;
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
        s = s.replaceAll(/\x1b\[\d+\w/g, "");
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
    if (staleFiles(step, [binpath])) {
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

  // src/common/binutils.ts
  function getASCII(view, offset) {
    let s = "";
    let i = offset;
    while (view.getUint8(i) !== 0) {
      s += String.fromCharCode(view.getUint8(i));
      i++;
    }
    return s;
  }
  var ELFParser = class {
    constructor(data) {
      this.dataView = new DataView(data.buffer);
      this.sectionHeaders = [];
      this.symbolTable = [];
      const elfHeader = new DataView(this.dataView.buffer, 0, 52);
      const magic = elfHeader.getInt32(0, true);
      if (magic !== 1179403647) {
        throw new Error("Invalid ELF header");
      }
      if (elfHeader.getUint8(4) !== 1) {
        throw new Error("Only 32-bit ELF supported");
      }
      if (elfHeader.getUint8(6) !== 1) {
        throw new Error("Invalid ELF version");
      }
      const endian = elfHeader.getUint8(5) === 1;
      if (!endian) {
        throw new Error("Big endian not supported");
      }
      this.entry = elfHeader.getUint32(24, endian);
      const sectionHeaderOffset = this.dataView.getUint32(32, endian);
      const sectionHeaderSize = this.dataView.getUint16(46, endian);
      const sectionHeaderCount = this.dataView.getUint16(48, endian);
      const sectionNameIndex = this.dataView.getUint16(50, endian);
      for (let i = 0; i < sectionHeaderCount; i++) {
        const offset = sectionHeaderOffset + i * sectionHeaderSize;
        const section = new ElfSectionHeader(this.dataView, offset);
        this.sectionHeaders.push(section);
      }
      const sectionNameSection = this.sectionHeaders[sectionNameIndex];
      if (!sectionNameSection) {
        throw new Error("Invalid ELF section name table");
      } else {
        const sectionNameView = sectionNameSection.contents;
        for (let i = 0; i < sectionHeaderCount; i++) {
          this.sectionHeaders[i].stringView = sectionNameView;
        }
      }
      const stringTableSection = this.getSection(".strtab", ElfSectionType.STRTAB);
      if (stringTableSection) {
        const stringView = stringTableSection.contents;
        const symbolTableSection = this.getSection(".symtab", ElfSectionType.SYMTAB);
        if (symbolTableSection) {
          const symbolTableOffset = symbolTableSection.offset;
          const symbolTableSize = symbolTableSection.size;
          const symbolTableEntryCount = symbolTableSize / 16;
          for (let i = 0; i < symbolTableEntryCount; i++) {
            const offset = symbolTableOffset + i * 16;
            const entry = new ElfSymbolTableEntry(this.dataView, offset, stringView);
            this.symbolTable.push(entry);
          }
        }
      }
    }
    getSymbols() {
      return this.symbolTable;
    }
    getSection(name, type) {
      if (typeof type === "number") {
        return this.sectionHeaders.find((section) => section.name === name && section.type === type) || null;
      } else {
        return this.sectionHeaders.find((section) => section.name === name) || null;
      }
    }
  };
  var ElfSectionType;
  (function(ElfSectionType2) {
    ElfSectionType2[ElfSectionType2["SYMTAB"] = 2] = "SYMTAB";
    ElfSectionType2[ElfSectionType2["STRTAB"] = 3] = "STRTAB";
  })(ElfSectionType || (ElfSectionType = {}));
  var ElfSectionHeader = class {
    constructor(dataView, headerOffset) {
      this.dataView = dataView;
      this.headerOffset = headerOffset;
      this.stringView = null;
      this.type = this.dataView.getUint32(this.headerOffset + 4, true);
    }
    get flags() {
      return this.dataView.getUint32(this.headerOffset + 8, true);
    }
    get vmaddr() {
      return this.dataView.getUint32(this.headerOffset + 12, true);
    }
    get offset() {
      return this.dataView.getUint32(this.headerOffset + 16, true);
    }
    get size() {
      return this.dataView.getUint32(this.headerOffset + 20, true);
    }
    get nameOffset() {
      return this.dataView.getUint32(this.headerOffset + 0, true);
    }
    get name() {
      return getASCII(this.stringView, this.nameOffset);
    }
    get contents() {
      return new DataView(this.dataView.buffer, this.offset, this.size);
    }
  };
  var ElfSymbolTableEntry = class {
    constructor(dataView, entryOffset, stringView) {
      this.dataView = dataView;
      this.entryOffset = entryOffset;
      this.stringView = stringView;
    }
    get nameOffset() {
      return this.dataView.getUint32(this.entryOffset, true);
    }
    get name() {
      return getASCII(this.stringView, this.nameOffset);
    }
    get value() {
      return this.dataView.getUint32(this.entryOffset + 4, true);
    }
    get size() {
      return this.dataView.getUint32(this.entryOffset + 8, true);
    }
    get info() {
      return this.dataView.getUint8(this.entryOffset + 12);
    }
    get other() {
      return this.dataView.getUint8(this.entryOffset + 13);
    }
  };
  var DwarfTag;
  (function(DwarfTag2) {
    DwarfTag2[DwarfTag2["DW_TAG_padding"] = 0] = "DW_TAG_padding";
    DwarfTag2[DwarfTag2["DW_TAG_array_type"] = 1] = "DW_TAG_array_type";
    DwarfTag2[DwarfTag2["DW_TAG_class_type"] = 2] = "DW_TAG_class_type";
    DwarfTag2[DwarfTag2["DW_TAG_entry_point"] = 3] = "DW_TAG_entry_point";
    DwarfTag2[DwarfTag2["DW_TAG_enumeration_type"] = 4] = "DW_TAG_enumeration_type";
    DwarfTag2[DwarfTag2["DW_TAG_formal_parameter"] = 5] = "DW_TAG_formal_parameter";
    DwarfTag2[DwarfTag2["DW_TAG_imported_declaration"] = 8] = "DW_TAG_imported_declaration";
    DwarfTag2[DwarfTag2["DW_TAG_label"] = 10] = "DW_TAG_label";
    DwarfTag2[DwarfTag2["DW_TAG_lexical_block"] = 11] = "DW_TAG_lexical_block";
    DwarfTag2[DwarfTag2["DW_TAG_member"] = 13] = "DW_TAG_member";
    DwarfTag2[DwarfTag2["DW_TAG_pointer_type"] = 15] = "DW_TAG_pointer_type";
    DwarfTag2[DwarfTag2["DW_TAG_reference_type"] = 16] = "DW_TAG_reference_type";
    DwarfTag2[DwarfTag2["DW_TAG_compile_unit"] = 17] = "DW_TAG_compile_unit";
    DwarfTag2[DwarfTag2["DW_TAG_string_type"] = 18] = "DW_TAG_string_type";
    DwarfTag2[DwarfTag2["DW_TAG_structure_type"] = 19] = "DW_TAG_structure_type";
    DwarfTag2[DwarfTag2["DW_TAG_subroutine_type"] = 21] = "DW_TAG_subroutine_type";
    DwarfTag2[DwarfTag2["DW_TAG_typedef"] = 22] = "DW_TAG_typedef";
    DwarfTag2[DwarfTag2["DW_TAG_union_type"] = 23] = "DW_TAG_union_type";
    DwarfTag2[DwarfTag2["DW_TAG_unspecified_parameters"] = 24] = "DW_TAG_unspecified_parameters";
    DwarfTag2[DwarfTag2["DW_TAG_variant"] = 25] = "DW_TAG_variant";
    DwarfTag2[DwarfTag2["DW_TAG_common_block"] = 26] = "DW_TAG_common_block";
    DwarfTag2[DwarfTag2["DW_TAG_common_inclusion"] = 27] = "DW_TAG_common_inclusion";
    DwarfTag2[DwarfTag2["DW_TAG_inheritance"] = 28] = "DW_TAG_inheritance";
    DwarfTag2[DwarfTag2["DW_TAG_inlined_subroutine"] = 29] = "DW_TAG_inlined_subroutine";
    DwarfTag2[DwarfTag2["DW_TAG_module"] = 30] = "DW_TAG_module";
    DwarfTag2[DwarfTag2["DW_TAG_ptr_to_member_type"] = 31] = "DW_TAG_ptr_to_member_type";
    DwarfTag2[DwarfTag2["DW_TAG_set_type"] = 32] = "DW_TAG_set_type";
    DwarfTag2[DwarfTag2["DW_TAG_subrange_type"] = 33] = "DW_TAG_subrange_type";
    DwarfTag2[DwarfTag2["DW_TAG_with_stmt"] = 34] = "DW_TAG_with_stmt";
    DwarfTag2[DwarfTag2["DW_TAG_access_declaration"] = 35] = "DW_TAG_access_declaration";
    DwarfTag2[DwarfTag2["DW_TAG_base_type"] = 36] = "DW_TAG_base_type";
    DwarfTag2[DwarfTag2["DW_TAG_catch_block"] = 37] = "DW_TAG_catch_block";
    DwarfTag2[DwarfTag2["DW_TAG_const_type"] = 38] = "DW_TAG_const_type";
    DwarfTag2[DwarfTag2["DW_TAG_constant"] = 39] = "DW_TAG_constant";
    DwarfTag2[DwarfTag2["DW_TAG_enumerator"] = 40] = "DW_TAG_enumerator";
    DwarfTag2[DwarfTag2["DW_TAG_file_type"] = 41] = "DW_TAG_file_type";
    DwarfTag2[DwarfTag2["DW_TAG_friend"] = 42] = "DW_TAG_friend";
    DwarfTag2[DwarfTag2["DW_TAG_namelist"] = 43] = "DW_TAG_namelist";
    DwarfTag2[DwarfTag2["DW_TAG_namelist_item"] = 44] = "DW_TAG_namelist_item";
    DwarfTag2[DwarfTag2["DW_TAG_packed_type"] = 45] = "DW_TAG_packed_type";
    DwarfTag2[DwarfTag2["DW_TAG_subprogram"] = 46] = "DW_TAG_subprogram";
    DwarfTag2[DwarfTag2["DW_TAG_template_type_param"] = 47] = "DW_TAG_template_type_param";
    DwarfTag2[DwarfTag2["DW_TAG_template_value_param"] = 48] = "DW_TAG_template_value_param";
    DwarfTag2[DwarfTag2["DW_TAG_thrown_type"] = 49] = "DW_TAG_thrown_type";
    DwarfTag2[DwarfTag2["DW_TAG_try_block"] = 50] = "DW_TAG_try_block";
    DwarfTag2[DwarfTag2["DW_TAG_variant_part"] = 51] = "DW_TAG_variant_part";
    DwarfTag2[DwarfTag2["DW_TAG_variable"] = 52] = "DW_TAG_variable";
    DwarfTag2[DwarfTag2["DW_TAG_volatile_type"] = 53] = "DW_TAG_volatile_type";
    DwarfTag2[DwarfTag2["DW_TAG_dwarf_procedure"] = 54] = "DW_TAG_dwarf_procedure";
    DwarfTag2[DwarfTag2["DW_TAG_restrict_type"] = 55] = "DW_TAG_restrict_type";
    DwarfTag2[DwarfTag2["DW_TAG_interface_type"] = 56] = "DW_TAG_interface_type";
    DwarfTag2[DwarfTag2["DW_TAG_namespace"] = 57] = "DW_TAG_namespace";
    DwarfTag2[DwarfTag2["DW_TAG_imported_module"] = 58] = "DW_TAG_imported_module";
    DwarfTag2[DwarfTag2["DW_TAG_unspecified_type"] = 59] = "DW_TAG_unspecified_type";
    DwarfTag2[DwarfTag2["DW_TAG_partial_unit"] = 60] = "DW_TAG_partial_unit";
    DwarfTag2[DwarfTag2["DW_TAG_imported_unit"] = 61] = "DW_TAG_imported_unit";
    DwarfTag2[DwarfTag2["DW_TAG_MIPS_loop"] = 16513] = "DW_TAG_MIPS_loop";
    DwarfTag2[DwarfTag2["DW_TAG_HP_array_descriptor"] = 16528] = "DW_TAG_HP_array_descriptor";
    DwarfTag2[DwarfTag2["DW_TAG_format_label"] = 16641] = "DW_TAG_format_label";
    DwarfTag2[DwarfTag2["DW_TAG_function_template"] = 16642] = "DW_TAG_function_template";
    DwarfTag2[DwarfTag2["DW_TAG_class_template"] = 16643] = "DW_TAG_class_template";
    DwarfTag2[DwarfTag2["DW_TAG_GNU_BINCL"] = 16644] = "DW_TAG_GNU_BINCL";
    DwarfTag2[DwarfTag2["DW_TAG_GNU_EINCL"] = 16645] = "DW_TAG_GNU_EINCL";
    DwarfTag2[DwarfTag2["DW_TAG_upc_shared_type"] = 34661] = "DW_TAG_upc_shared_type";
    DwarfTag2[DwarfTag2["DW_TAG_upc_strict_type"] = 34662] = "DW_TAG_upc_strict_type";
    DwarfTag2[DwarfTag2["DW_TAG_upc_relaxed_type"] = 34663] = "DW_TAG_upc_relaxed_type";
    DwarfTag2[DwarfTag2["DW_TAG_PGI_kanji_type"] = 40960] = "DW_TAG_PGI_kanji_type";
    DwarfTag2[DwarfTag2["DW_TAG_PGI_interface_block"] = 40992] = "DW_TAG_PGI_interface_block";
  })(DwarfTag || (DwarfTag = {}));
  var DwarfHasChild;
  (function(DwarfHasChild2) {
    DwarfHasChild2[DwarfHasChild2["DW_children_no"] = 0] = "DW_children_no";
    DwarfHasChild2[DwarfHasChild2["DW_children_yes"] = 1] = "DW_children_yes";
  })(DwarfHasChild || (DwarfHasChild = {}));
  var DwarfForm;
  (function(DwarfForm2) {
    DwarfForm2[DwarfForm2["DW_FORM_addr"] = 1] = "DW_FORM_addr";
    DwarfForm2[DwarfForm2["DW_FORM_block2"] = 3] = "DW_FORM_block2";
    DwarfForm2[DwarfForm2["DW_FORM_block4"] = 4] = "DW_FORM_block4";
    DwarfForm2[DwarfForm2["DW_FORM_data2"] = 5] = "DW_FORM_data2";
    DwarfForm2[DwarfForm2["DW_FORM_data4"] = 6] = "DW_FORM_data4";
    DwarfForm2[DwarfForm2["DW_FORM_data8"] = 7] = "DW_FORM_data8";
    DwarfForm2[DwarfForm2["DW_FORM_string"] = 8] = "DW_FORM_string";
    DwarfForm2[DwarfForm2["DW_FORM_block"] = 9] = "DW_FORM_block";
    DwarfForm2[DwarfForm2["DW_FORM_block1"] = 10] = "DW_FORM_block1";
    DwarfForm2[DwarfForm2["DW_FORM_data1"] = 11] = "DW_FORM_data1";
    DwarfForm2[DwarfForm2["DW_FORM_flag"] = 12] = "DW_FORM_flag";
    DwarfForm2[DwarfForm2["DW_FORM_sdata"] = 13] = "DW_FORM_sdata";
    DwarfForm2[DwarfForm2["DW_FORM_strp"] = 14] = "DW_FORM_strp";
    DwarfForm2[DwarfForm2["DW_FORM_udata"] = 15] = "DW_FORM_udata";
    DwarfForm2[DwarfForm2["DW_FORM_ref_addr"] = 16] = "DW_FORM_ref_addr";
    DwarfForm2[DwarfForm2["DW_FORM_ref1"] = 17] = "DW_FORM_ref1";
    DwarfForm2[DwarfForm2["DW_FORM_ref2"] = 18] = "DW_FORM_ref2";
    DwarfForm2[DwarfForm2["DW_FORM_ref4"] = 19] = "DW_FORM_ref4";
    DwarfForm2[DwarfForm2["DW_FORM_ref8"] = 20] = "DW_FORM_ref8";
    DwarfForm2[DwarfForm2["DW_FORM_ref_udata"] = 21] = "DW_FORM_ref_udata";
    DwarfForm2[DwarfForm2["DW_FORM_indirect"] = 22] = "DW_FORM_indirect";
  })(DwarfForm || (DwarfForm = {}));
  var DwarfAttribute;
  (function(DwarfAttribute2) {
    DwarfAttribute2[DwarfAttribute2["DW_AT_sibling"] = 1] = "DW_AT_sibling";
    DwarfAttribute2[DwarfAttribute2["DW_AT_location"] = 2] = "DW_AT_location";
    DwarfAttribute2[DwarfAttribute2["DW_AT_name"] = 3] = "DW_AT_name";
    DwarfAttribute2[DwarfAttribute2["DW_AT_ordering"] = 9] = "DW_AT_ordering";
    DwarfAttribute2[DwarfAttribute2["DW_AT_subscr_data"] = 10] = "DW_AT_subscr_data";
    DwarfAttribute2[DwarfAttribute2["DW_AT_byte_size"] = 11] = "DW_AT_byte_size";
    DwarfAttribute2[DwarfAttribute2["DW_AT_bit_offset"] = 12] = "DW_AT_bit_offset";
    DwarfAttribute2[DwarfAttribute2["DW_AT_bit_size"] = 13] = "DW_AT_bit_size";
    DwarfAttribute2[DwarfAttribute2["DW_AT_element_list"] = 15] = "DW_AT_element_list";
    DwarfAttribute2[DwarfAttribute2["DW_AT_stmt_list"] = 16] = "DW_AT_stmt_list";
    DwarfAttribute2[DwarfAttribute2["DW_AT_low_pc"] = 17] = "DW_AT_low_pc";
    DwarfAttribute2[DwarfAttribute2["DW_AT_high_pc"] = 18] = "DW_AT_high_pc";
    DwarfAttribute2[DwarfAttribute2["DW_AT_language"] = 19] = "DW_AT_language";
    DwarfAttribute2[DwarfAttribute2["DW_AT_member"] = 20] = "DW_AT_member";
    DwarfAttribute2[DwarfAttribute2["DW_AT_discr"] = 21] = "DW_AT_discr";
    DwarfAttribute2[DwarfAttribute2["DW_AT_discr_value"] = 22] = "DW_AT_discr_value";
    DwarfAttribute2[DwarfAttribute2["DW_AT_visibility"] = 23] = "DW_AT_visibility";
    DwarfAttribute2[DwarfAttribute2["DW_AT_import"] = 24] = "DW_AT_import";
    DwarfAttribute2[DwarfAttribute2["DW_AT_string_length"] = 25] = "DW_AT_string_length";
    DwarfAttribute2[DwarfAttribute2["DW_AT_common_reference"] = 26] = "DW_AT_common_reference";
    DwarfAttribute2[DwarfAttribute2["DW_AT_comp_dir"] = 27] = "DW_AT_comp_dir";
    DwarfAttribute2[DwarfAttribute2["DW_AT_const_value"] = 28] = "DW_AT_const_value";
    DwarfAttribute2[DwarfAttribute2["DW_AT_containing_type"] = 29] = "DW_AT_containing_type";
    DwarfAttribute2[DwarfAttribute2["DW_AT_default_value"] = 30] = "DW_AT_default_value";
    DwarfAttribute2[DwarfAttribute2["DW_AT_inline"] = 32] = "DW_AT_inline";
    DwarfAttribute2[DwarfAttribute2["DW_AT_is_optional"] = 33] = "DW_AT_is_optional";
    DwarfAttribute2[DwarfAttribute2["DW_AT_lower_bound"] = 34] = "DW_AT_lower_bound";
    DwarfAttribute2[DwarfAttribute2["DW_AT_producer"] = 37] = "DW_AT_producer";
    DwarfAttribute2[DwarfAttribute2["DW_AT_prototyped"] = 39] = "DW_AT_prototyped";
    DwarfAttribute2[DwarfAttribute2["DW_AT_return_addr"] = 42] = "DW_AT_return_addr";
    DwarfAttribute2[DwarfAttribute2["DW_AT_start_scope"] = 44] = "DW_AT_start_scope";
    DwarfAttribute2[DwarfAttribute2["DW_AT_stride_size"] = 46] = "DW_AT_stride_size";
    DwarfAttribute2[DwarfAttribute2["DW_AT_upper_bound"] = 47] = "DW_AT_upper_bound";
    DwarfAttribute2[DwarfAttribute2["DW_AT_abstract_origin"] = 49] = "DW_AT_abstract_origin";
    DwarfAttribute2[DwarfAttribute2["DW_AT_accessibility"] = 50] = "DW_AT_accessibility";
    DwarfAttribute2[DwarfAttribute2["DW_AT_address_class"] = 51] = "DW_AT_address_class";
    DwarfAttribute2[DwarfAttribute2["DW_AT_artificial"] = 52] = "DW_AT_artificial";
    DwarfAttribute2[DwarfAttribute2["DW_AT_base_types"] = 53] = "DW_AT_base_types";
    DwarfAttribute2[DwarfAttribute2["DW_AT_calling_convention"] = 54] = "DW_AT_calling_convention";
    DwarfAttribute2[DwarfAttribute2["DW_AT_count"] = 55] = "DW_AT_count";
    DwarfAttribute2[DwarfAttribute2["DW_AT_data_member_location"] = 56] = "DW_AT_data_member_location";
    DwarfAttribute2[DwarfAttribute2["DW_AT_decl_column"] = 57] = "DW_AT_decl_column";
    DwarfAttribute2[DwarfAttribute2["DW_AT_decl_file"] = 58] = "DW_AT_decl_file";
    DwarfAttribute2[DwarfAttribute2["DW_AT_decl_line"] = 59] = "DW_AT_decl_line";
    DwarfAttribute2[DwarfAttribute2["DW_AT_declaration"] = 60] = "DW_AT_declaration";
    DwarfAttribute2[DwarfAttribute2["DW_AT_discr_list"] = 61] = "DW_AT_discr_list";
    DwarfAttribute2[DwarfAttribute2["DW_AT_encoding"] = 62] = "DW_AT_encoding";
    DwarfAttribute2[DwarfAttribute2["DW_AT_external"] = 63] = "DW_AT_external";
    DwarfAttribute2[DwarfAttribute2["DW_AT_frame_base"] = 64] = "DW_AT_frame_base";
    DwarfAttribute2[DwarfAttribute2["DW_AT_friend"] = 65] = "DW_AT_friend";
    DwarfAttribute2[DwarfAttribute2["DW_AT_identifier_case"] = 66] = "DW_AT_identifier_case";
    DwarfAttribute2[DwarfAttribute2["DW_AT_macro_info"] = 67] = "DW_AT_macro_info";
    DwarfAttribute2[DwarfAttribute2["DW_AT_namelist_items"] = 68] = "DW_AT_namelist_items";
    DwarfAttribute2[DwarfAttribute2["DW_AT_priority"] = 69] = "DW_AT_priority";
    DwarfAttribute2[DwarfAttribute2["DW_AT_segment"] = 70] = "DW_AT_segment";
    DwarfAttribute2[DwarfAttribute2["DW_AT_specification"] = 71] = "DW_AT_specification";
    DwarfAttribute2[DwarfAttribute2["DW_AT_static_link"] = 72] = "DW_AT_static_link";
    DwarfAttribute2[DwarfAttribute2["DW_AT_type"] = 73] = "DW_AT_type";
    DwarfAttribute2[DwarfAttribute2["DW_AT_use_location"] = 74] = "DW_AT_use_location";
    DwarfAttribute2[DwarfAttribute2["DW_AT_variable_parameter"] = 75] = "DW_AT_variable_parameter";
    DwarfAttribute2[DwarfAttribute2["DW_AT_virtuality"] = 76] = "DW_AT_virtuality";
    DwarfAttribute2[DwarfAttribute2["DW_AT_vtable_elem_location"] = 77] = "DW_AT_vtable_elem_location";
    DwarfAttribute2[DwarfAttribute2["DW_AT_allocated"] = 78] = "DW_AT_allocated";
    DwarfAttribute2[DwarfAttribute2["DW_AT_associated"] = 79] = "DW_AT_associated";
    DwarfAttribute2[DwarfAttribute2["DW_AT_data_location"] = 80] = "DW_AT_data_location";
    DwarfAttribute2[DwarfAttribute2["DW_AT_stride"] = 81] = "DW_AT_stride";
    DwarfAttribute2[DwarfAttribute2["DW_AT_entry_pc"] = 82] = "DW_AT_entry_pc";
    DwarfAttribute2[DwarfAttribute2["DW_AT_use_UTF8"] = 83] = "DW_AT_use_UTF8";
    DwarfAttribute2[DwarfAttribute2["DW_AT_extension"] = 84] = "DW_AT_extension";
    DwarfAttribute2[DwarfAttribute2["DW_AT_ranges"] = 85] = "DW_AT_ranges";
    DwarfAttribute2[DwarfAttribute2["DW_AT_trampoline"] = 86] = "DW_AT_trampoline";
    DwarfAttribute2[DwarfAttribute2["DW_AT_call_column"] = 87] = "DW_AT_call_column";
    DwarfAttribute2[DwarfAttribute2["DW_AT_call_file"] = 88] = "DW_AT_call_file";
    DwarfAttribute2[DwarfAttribute2["DW_AT_call_line"] = 89] = "DW_AT_call_line";
    DwarfAttribute2[DwarfAttribute2["DW_AT_MIPS_fde"] = 8193] = "DW_AT_MIPS_fde";
    DwarfAttribute2[DwarfAttribute2["DW_AT_MIPS_loop_begin"] = 8194] = "DW_AT_MIPS_loop_begin";
    DwarfAttribute2[DwarfAttribute2["DW_AT_MIPS_tail_loop_begin"] = 8195] = "DW_AT_MIPS_tail_loop_begin";
    DwarfAttribute2[DwarfAttribute2["DW_AT_MIPS_epilog_begin"] = 8196] = "DW_AT_MIPS_epilog_begin";
    DwarfAttribute2[DwarfAttribute2["DW_AT_MIPS_loop_unroll_factor"] = 8197] = "DW_AT_MIPS_loop_unroll_factor";
    DwarfAttribute2[DwarfAttribute2["DW_AT_MIPS_software_pipeline_depth"] = 8198] = "DW_AT_MIPS_software_pipeline_depth";
    DwarfAttribute2[DwarfAttribute2["DW_AT_MIPS_linkage_name"] = 8199] = "DW_AT_MIPS_linkage_name";
    DwarfAttribute2[DwarfAttribute2["DW_AT_MIPS_stride"] = 8200] = "DW_AT_MIPS_stride";
    DwarfAttribute2[DwarfAttribute2["DW_AT_MIPS_abstract_name"] = 8201] = "DW_AT_MIPS_abstract_name";
    DwarfAttribute2[DwarfAttribute2["DW_AT_MIPS_clone_origin"] = 8202] = "DW_AT_MIPS_clone_origin";
    DwarfAttribute2[DwarfAttribute2["DW_AT_MIPS_has_inlines"] = 8203] = "DW_AT_MIPS_has_inlines";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_block_index"] = 8192] = "DW_AT_HP_block_index";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_unmodifiable"] = 8193] = "DW_AT_HP_unmodifiable";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_actuals_stmt_list"] = 8208] = "DW_AT_HP_actuals_stmt_list";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_proc_per_section"] = 8209] = "DW_AT_HP_proc_per_section";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_raw_data_ptr"] = 8210] = "DW_AT_HP_raw_data_ptr";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_pass_by_reference"] = 8211] = "DW_AT_HP_pass_by_reference";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_opt_level"] = 8212] = "DW_AT_HP_opt_level";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_prof_version_id"] = 8213] = "DW_AT_HP_prof_version_id";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_opt_flags"] = 8214] = "DW_AT_HP_opt_flags";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_cold_region_low_pc"] = 8215] = "DW_AT_HP_cold_region_low_pc";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_cold_region_high_pc"] = 8216] = "DW_AT_HP_cold_region_high_pc";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_all_variables_modifiable"] = 8217] = "DW_AT_HP_all_variables_modifiable";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_linkage_name"] = 8218] = "DW_AT_HP_linkage_name";
    DwarfAttribute2[DwarfAttribute2["DW_AT_HP_prof_flags"] = 8219] = "DW_AT_HP_prof_flags";
    DwarfAttribute2[DwarfAttribute2["DW_AT_sf_names"] = 8449] = "DW_AT_sf_names";
    DwarfAttribute2[DwarfAttribute2["DW_AT_src_info"] = 8450] = "DW_AT_src_info";
    DwarfAttribute2[DwarfAttribute2["DW_AT_mac_info"] = 8451] = "DW_AT_mac_info";
    DwarfAttribute2[DwarfAttribute2["DW_AT_src_coords"] = 8452] = "DW_AT_src_coords";
    DwarfAttribute2[DwarfAttribute2["DW_AT_body_begin"] = 8453] = "DW_AT_body_begin";
    DwarfAttribute2[DwarfAttribute2["DW_AT_body_end"] = 8454] = "DW_AT_body_end";
    DwarfAttribute2[DwarfAttribute2["DW_AT_GNU_vector"] = 8455] = "DW_AT_GNU_vector";
    DwarfAttribute2[DwarfAttribute2["DW_AT_VMS_rtnbeg_pd_address"] = 8705] = "DW_AT_VMS_rtnbeg_pd_address";
    DwarfAttribute2[DwarfAttribute2["DW_AT_upc_threads_scaled"] = 12816] = "DW_AT_upc_threads_scaled";
    DwarfAttribute2[DwarfAttribute2["DW_AT_PGI_lbase"] = 14848] = "DW_AT_PGI_lbase";
    DwarfAttribute2[DwarfAttribute2["DW_AT_PGI_soffset"] = 14849] = "DW_AT_PGI_soffset";
    DwarfAttribute2[DwarfAttribute2["DW_AT_PGI_lstride"] = 14850] = "DW_AT_PGI_lstride";
  })(DwarfAttribute || (DwarfAttribute = {}));
  var DwarfLineNumberOps;
  (function(DwarfLineNumberOps2) {
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_extended_op"] = 0] = "DW_LNS_extended_op";
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_copy"] = 1] = "DW_LNS_copy";
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_advance_pc"] = 2] = "DW_LNS_advance_pc";
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_advance_line"] = 3] = "DW_LNS_advance_line";
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_set_file"] = 4] = "DW_LNS_set_file";
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_set_column"] = 5] = "DW_LNS_set_column";
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_negate_stmt"] = 6] = "DW_LNS_negate_stmt";
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_set_basic_block"] = 7] = "DW_LNS_set_basic_block";
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_const_add_pc"] = 8] = "DW_LNS_const_add_pc";
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_fixed_advance_pc"] = 9] = "DW_LNS_fixed_advance_pc";
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_set_prologue_end"] = 10] = "DW_LNS_set_prologue_end";
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_set_epilogue_begin"] = 11] = "DW_LNS_set_epilogue_begin";
    DwarfLineNumberOps2[DwarfLineNumberOps2["DW_LNS_set_isa"] = 12] = "DW_LNS_set_isa";
  })(DwarfLineNumberOps || (DwarfLineNumberOps = {}));
  var DwarfLineNumberExtendedOps;
  (function(DwarfLineNumberExtendedOps2) {
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_end_sequence"] = 1] = "DW_LNE_end_sequence";
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_set_address"] = 2] = "DW_LNE_set_address";
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_define_file"] = 3] = "DW_LNE_define_file";
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_HP_negate_is_UV_update"] = 17] = "DW_LNE_HP_negate_is_UV_update";
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_HP_push_context"] = 18] = "DW_LNE_HP_push_context";
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_HP_pop_context"] = 19] = "DW_LNE_HP_pop_context";
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_HP_set_file_line_column"] = 20] = "DW_LNE_HP_set_file_line_column";
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_HP_set_routine_name"] = 21] = "DW_LNE_HP_set_routine_name";
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_HP_set_sequence"] = 22] = "DW_LNE_HP_set_sequence";
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_HP_negate_post_semantics"] = 23] = "DW_LNE_HP_negate_post_semantics";
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_HP_negate_function_exit"] = 24] = "DW_LNE_HP_negate_function_exit";
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_HP_negate_front_end_logical"] = 25] = "DW_LNE_HP_negate_front_end_logical";
    DwarfLineNumberExtendedOps2[DwarfLineNumberExtendedOps2["DW_LNE_HP_define_proc"] = 32] = "DW_LNE_HP_define_proc";
  })(DwarfLineNumberExtendedOps || (DwarfLineNumberExtendedOps = {}));
  var DwarfEncoding;
  (function(DwarfEncoding2) {
    DwarfEncoding2[DwarfEncoding2["DW_ATE_address"] = 1] = "DW_ATE_address";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_boolean"] = 2] = "DW_ATE_boolean";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_complex_float"] = 3] = "DW_ATE_complex_float";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_float"] = 4] = "DW_ATE_float";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_signed"] = 5] = "DW_ATE_signed";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_signed_char"] = 6] = "DW_ATE_signed_char";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_unsigned"] = 7] = "DW_ATE_unsigned";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_unsigned_char"] = 8] = "DW_ATE_unsigned_char";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_imaginary_float"] = 9] = "DW_ATE_imaginary_float";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_packed_decimal"] = 10] = "DW_ATE_packed_decimal";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_numeric_string"] = 11] = "DW_ATE_numeric_string";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_edited"] = 12] = "DW_ATE_edited";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_signed_fixed"] = 13] = "DW_ATE_signed_fixed";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_unsigned_fixed"] = 14] = "DW_ATE_unsigned_fixed";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_decimal_float"] = 15] = "DW_ATE_decimal_float";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_lo_user"] = 128] = "DW_ATE_lo_user";
    DwarfEncoding2[DwarfEncoding2["DW_ATE_hi_user"] = 255] = "DW_ATE_hi_user";
  })(DwarfEncoding || (DwarfEncoding = {}));
  var DwarfOpcode;
  (function(DwarfOpcode2) {
    DwarfOpcode2[DwarfOpcode2["DW_OP_addr"] = 3] = "DW_OP_addr";
    DwarfOpcode2[DwarfOpcode2["DW_OP_deref"] = 6] = "DW_OP_deref";
    DwarfOpcode2[DwarfOpcode2["DW_OP_const1u"] = 8] = "DW_OP_const1u";
    DwarfOpcode2[DwarfOpcode2["DW_OP_const1s"] = 9] = "DW_OP_const1s";
    DwarfOpcode2[DwarfOpcode2["DW_OP_const2u"] = 10] = "DW_OP_const2u";
    DwarfOpcode2[DwarfOpcode2["DW_OP_const2s"] = 11] = "DW_OP_const2s";
    DwarfOpcode2[DwarfOpcode2["DW_OP_const4u"] = 12] = "DW_OP_const4u";
    DwarfOpcode2[DwarfOpcode2["DW_OP_const4s"] = 13] = "DW_OP_const4s";
    DwarfOpcode2[DwarfOpcode2["DW_OP_const8u"] = 14] = "DW_OP_const8u";
    DwarfOpcode2[DwarfOpcode2["DW_OP_const8s"] = 15] = "DW_OP_const8s";
    DwarfOpcode2[DwarfOpcode2["DW_OP_constu"] = 16] = "DW_OP_constu";
    DwarfOpcode2[DwarfOpcode2["DW_OP_consts"] = 17] = "DW_OP_consts";
    DwarfOpcode2[DwarfOpcode2["DW_OP_dup"] = 18] = "DW_OP_dup";
    DwarfOpcode2[DwarfOpcode2["DW_OP_drop"] = 19] = "DW_OP_drop";
    DwarfOpcode2[DwarfOpcode2["DW_OP_over"] = 20] = "DW_OP_over";
    DwarfOpcode2[DwarfOpcode2["DW_OP_pick"] = 21] = "DW_OP_pick";
    DwarfOpcode2[DwarfOpcode2["DW_OP_swap"] = 22] = "DW_OP_swap";
    DwarfOpcode2[DwarfOpcode2["DW_OP_rot"] = 23] = "DW_OP_rot";
    DwarfOpcode2[DwarfOpcode2["DW_OP_xderef"] = 24] = "DW_OP_xderef";
    DwarfOpcode2[DwarfOpcode2["DW_OP_abs"] = 25] = "DW_OP_abs";
    DwarfOpcode2[DwarfOpcode2["DW_OP_and"] = 26] = "DW_OP_and";
    DwarfOpcode2[DwarfOpcode2["DW_OP_div"] = 27] = "DW_OP_div";
    DwarfOpcode2[DwarfOpcode2["DW_OP_minus"] = 28] = "DW_OP_minus";
    DwarfOpcode2[DwarfOpcode2["DW_OP_mod"] = 29] = "DW_OP_mod";
    DwarfOpcode2[DwarfOpcode2["DW_OP_mul"] = 30] = "DW_OP_mul";
    DwarfOpcode2[DwarfOpcode2["DW_OP_neg"] = 31] = "DW_OP_neg";
    DwarfOpcode2[DwarfOpcode2["DW_OP_not"] = 32] = "DW_OP_not";
    DwarfOpcode2[DwarfOpcode2["DW_OP_or"] = 33] = "DW_OP_or";
    DwarfOpcode2[DwarfOpcode2["DW_OP_plus"] = 34] = "DW_OP_plus";
    DwarfOpcode2[DwarfOpcode2["DW_OP_plus_uconst"] = 35] = "DW_OP_plus_uconst";
    DwarfOpcode2[DwarfOpcode2["DW_OP_shl"] = 36] = "DW_OP_shl";
    DwarfOpcode2[DwarfOpcode2["DW_OP_shr"] = 37] = "DW_OP_shr";
    DwarfOpcode2[DwarfOpcode2["DW_OP_shra"] = 38] = "DW_OP_shra";
    DwarfOpcode2[DwarfOpcode2["DW_OP_xor"] = 39] = "DW_OP_xor";
    DwarfOpcode2[DwarfOpcode2["DW_OP_bra"] = 40] = "DW_OP_bra";
    DwarfOpcode2[DwarfOpcode2["DW_OP_eq"] = 41] = "DW_OP_eq";
    DwarfOpcode2[DwarfOpcode2["DW_OP_ge"] = 42] = "DW_OP_ge";
    DwarfOpcode2[DwarfOpcode2["DW_OP_gt"] = 43] = "DW_OP_gt";
    DwarfOpcode2[DwarfOpcode2["DW_OP_le"] = 44] = "DW_OP_le";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lt"] = 45] = "DW_OP_lt";
    DwarfOpcode2[DwarfOpcode2["DW_OP_ne"] = 46] = "DW_OP_ne";
    DwarfOpcode2[DwarfOpcode2["DW_OP_skip"] = 47] = "DW_OP_skip";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit0"] = 48] = "DW_OP_lit0";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit1"] = 49] = "DW_OP_lit1";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit2"] = 50] = "DW_OP_lit2";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit3"] = 51] = "DW_OP_lit3";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit4"] = 52] = "DW_OP_lit4";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit5"] = 53] = "DW_OP_lit5";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit6"] = 54] = "DW_OP_lit6";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit7"] = 55] = "DW_OP_lit7";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit8"] = 56] = "DW_OP_lit8";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit9"] = 57] = "DW_OP_lit9";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit10"] = 58] = "DW_OP_lit10";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit11"] = 59] = "DW_OP_lit11";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit12"] = 60] = "DW_OP_lit12";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit13"] = 61] = "DW_OP_lit13";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit14"] = 62] = "DW_OP_lit14";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit15"] = 63] = "DW_OP_lit15";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit16"] = 64] = "DW_OP_lit16";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit17"] = 65] = "DW_OP_lit17";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit18"] = 66] = "DW_OP_lit18";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit19"] = 67] = "DW_OP_lit19";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit20"] = 68] = "DW_OP_lit20";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit21"] = 69] = "DW_OP_lit21";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit22"] = 70] = "DW_OP_lit22";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit23"] = 71] = "DW_OP_lit23";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit24"] = 72] = "DW_OP_lit24";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit25"] = 73] = "DW_OP_lit25";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit26"] = 74] = "DW_OP_lit26";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit27"] = 75] = "DW_OP_lit27";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit28"] = 76] = "DW_OP_lit28";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit29"] = 77] = "DW_OP_lit29";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit30"] = 78] = "DW_OP_lit30";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lit31"] = 79] = "DW_OP_lit31";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg0"] = 80] = "DW_OP_reg0";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg1"] = 81] = "DW_OP_reg1";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg2"] = 82] = "DW_OP_reg2";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg3"] = 83] = "DW_OP_reg3";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg4"] = 84] = "DW_OP_reg4";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg5"] = 85] = "DW_OP_reg5";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg6"] = 86] = "DW_OP_reg6";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg7"] = 87] = "DW_OP_reg7";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg8"] = 88] = "DW_OP_reg8";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg9"] = 89] = "DW_OP_reg9";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg10"] = 90] = "DW_OP_reg10";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg11"] = 91] = "DW_OP_reg11";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg12"] = 92] = "DW_OP_reg12";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg13"] = 93] = "DW_OP_reg13";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg14"] = 94] = "DW_OP_reg14";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg15"] = 95] = "DW_OP_reg15";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg16"] = 96] = "DW_OP_reg16";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg17"] = 97] = "DW_OP_reg17";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg18"] = 98] = "DW_OP_reg18";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg19"] = 99] = "DW_OP_reg19";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg20"] = 100] = "DW_OP_reg20";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg21"] = 101] = "DW_OP_reg21";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg22"] = 102] = "DW_OP_reg22";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg23"] = 103] = "DW_OP_reg23";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg24"] = 104] = "DW_OP_reg24";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg25"] = 105] = "DW_OP_reg25";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg26"] = 106] = "DW_OP_reg26";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg27"] = 107] = "DW_OP_reg27";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg28"] = 108] = "DW_OP_reg28";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg29"] = 109] = "DW_OP_reg29";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg30"] = 110] = "DW_OP_reg30";
    DwarfOpcode2[DwarfOpcode2["DW_OP_reg31"] = 111] = "DW_OP_reg31";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg0"] = 112] = "DW_OP_breg0";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg1"] = 113] = "DW_OP_breg1";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg2"] = 114] = "DW_OP_breg2";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg3"] = 115] = "DW_OP_breg3";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg4"] = 116] = "DW_OP_breg4";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg5"] = 117] = "DW_OP_breg5";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg6"] = 118] = "DW_OP_breg6";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg7"] = 119] = "DW_OP_breg7";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg8"] = 120] = "DW_OP_breg8";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg9"] = 121] = "DW_OP_breg9";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg10"] = 122] = "DW_OP_breg10";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg11"] = 123] = "DW_OP_breg11";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg12"] = 124] = "DW_OP_breg12";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg13"] = 125] = "DW_OP_breg13";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg14"] = 126] = "DW_OP_breg14";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg15"] = 127] = "DW_OP_breg15";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg16"] = 128] = "DW_OP_breg16";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg17"] = 129] = "DW_OP_breg17";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg18"] = 130] = "DW_OP_breg18";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg19"] = 131] = "DW_OP_breg19";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg20"] = 132] = "DW_OP_breg20";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg21"] = 133] = "DW_OP_breg21";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg22"] = 134] = "DW_OP_breg22";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg23"] = 135] = "DW_OP_breg23";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg24"] = 136] = "DW_OP_breg24";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg25"] = 137] = "DW_OP_breg25";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg26"] = 138] = "DW_OP_breg26";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg27"] = 139] = "DW_OP_breg27";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg28"] = 140] = "DW_OP_breg28";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg29"] = 141] = "DW_OP_breg29";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg30"] = 142] = "DW_OP_breg30";
    DwarfOpcode2[DwarfOpcode2["DW_OP_breg31"] = 143] = "DW_OP_breg31";
    DwarfOpcode2[DwarfOpcode2["DW_OP_regX"] = 144] = "DW_OP_regX";
    DwarfOpcode2[DwarfOpcode2["DW_OP_fbreg"] = 145] = "DW_OP_fbreg";
    DwarfOpcode2[DwarfOpcode2["DW_OP_bregX"] = 146] = "DW_OP_bregX";
    DwarfOpcode2[DwarfOpcode2["DW_OP_piece"] = 147] = "DW_OP_piece";
    DwarfOpcode2[DwarfOpcode2["DW_OP_deref_size"] = 148] = "DW_OP_deref_size";
    DwarfOpcode2[DwarfOpcode2["DW_OP_xderef_size"] = 149] = "DW_OP_xderef_size";
    DwarfOpcode2[DwarfOpcode2["DW_OP_nop"] = 150] = "DW_OP_nop";
    DwarfOpcode2[DwarfOpcode2["DW_OP_push_object_address"] = 151] = "DW_OP_push_object_address";
    DwarfOpcode2[DwarfOpcode2["DW_OP_call2"] = 152] = "DW_OP_call2";
    DwarfOpcode2[DwarfOpcode2["DW_OP_call4"] = 153] = "DW_OP_call4";
    DwarfOpcode2[DwarfOpcode2["DW_OP_call_ref"] = 154] = "DW_OP_call_ref";
    DwarfOpcode2[DwarfOpcode2["DW_OP_form_tls_address"] = 155] = "DW_OP_form_tls_address";
    DwarfOpcode2[DwarfOpcode2["DW_OP_call_frame_cfa"] = 156] = "DW_OP_call_frame_cfa";
    DwarfOpcode2[DwarfOpcode2["DW_OP_bit_piece"] = 157] = "DW_OP_bit_piece";
    DwarfOpcode2[DwarfOpcode2["DW_OP_lo_user"] = 224] = "DW_OP_lo_user";
    DwarfOpcode2[DwarfOpcode2["DW_OP_hi_user"] = 255] = "DW_OP_hi_user";
    DwarfOpcode2[DwarfOpcode2["DW_OP_GNU_push_tls_address"] = 224] = "DW_OP_GNU_push_tls_address";
  })(DwarfOpcode || (DwarfOpcode = {}));
  var DwarfLanguage;
  (function(DwarfLanguage2) {
    DwarfLanguage2[DwarfLanguage2["DW_LANG_none"] = 0] = "DW_LANG_none";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_C89"] = 1] = "DW_LANG_C89";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_C"] = 2] = "DW_LANG_C";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_Ada83"] = 3] = "DW_LANG_Ada83";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_C_plus_plus"] = 4] = "DW_LANG_C_plus_plus";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_Cobol74"] = 5] = "DW_LANG_Cobol74";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_Cobol85"] = 6] = "DW_LANG_Cobol85";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_Fortran77"] = 7] = "DW_LANG_Fortran77";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_Fortran90"] = 8] = "DW_LANG_Fortran90";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_Pascal83"] = 9] = "DW_LANG_Pascal83";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_Modula2"] = 10] = "DW_LANG_Modula2";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_Java"] = 11] = "DW_LANG_Java";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_C99"] = 12] = "DW_LANG_C99";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_Ada95"] = 13] = "DW_LANG_Ada95";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_Fortran95"] = 14] = "DW_LANG_Fortran95";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_PLI"] = 15] = "DW_LANG_PLI";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_ObjC"] = 16] = "DW_LANG_ObjC";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_ObjC_plus_plus"] = 17] = "DW_LANG_ObjC_plus_plus";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_UPC"] = 18] = "DW_LANG_UPC";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_D"] = 19] = "DW_LANG_D";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_lo_user"] = 32768] = "DW_LANG_lo_user";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_hi_user"] = 65535] = "DW_LANG_hi_user";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_Mips_Assembler"] = 32769] = "DW_LANG_Mips_Assembler";
    DwarfLanguage2[DwarfLanguage2["DW_LANG_Upc"] = 34661] = "DW_LANG_Upc";
  })(DwarfLanguage || (DwarfLanguage = {}));
  var ByteReader = class {
    constructor(view, littleEndian) {
      this.view = view;
      this.littleEndian = littleEndian;
      this.addressSize = 4;
      this.offsetSize = 4;
      this.offset = 0;
    }
    isEOF() {
      return this.offset >= this.view.byteLength;
    }
    readOneByte() {
      const value = this.view.getUint8(this.offset);
      this.offset += 1;
      return value;
    }
    readTwoBytes() {
      const value = this.view.getUint16(this.offset, this.littleEndian);
      this.offset += 2;
      return value;
    }
    readFourBytes() {
      const value = this.view.getUint32(this.offset, this.littleEndian);
      this.offset += 4;
      return value;
    }
    readEightBytes() {
      const value = this.view.getBigUint64(this.offset, this.littleEndian);
      this.offset += 8;
      return value;
    }
    readUnsignedLEB128() {
      let result = BigInt(0);
      let shift = BigInt(0);
      while (true) {
        const byte = this.readOneByte();
        result |= BigInt(byte & 127) << shift;
        if ((byte & 128) === 0) {
          break;
        }
        shift += BigInt(7);
      }
      return shift < 31 ? Number(result) : result;
    }
    readSignedLEB128() {
      let result = BigInt(0);
      let shift = BigInt(0);
      let byte = 0;
      while (true) {
        byte = this.readOneByte();
        result |= BigInt(byte & 127) << shift;
        shift += BigInt(7);
        if ((byte & 128) === 0) {
          break;
        }
      }
      if ((byte & 64) !== 0) {
        result |= -(BigInt(1) << shift);
      }
      return shift < 31 ? Number(result) : result;
    }
    readOffset() {
      if (this.offsetSize === 4) {
        const value = this.readFourBytes();
        return value;
      } else {
        throw new Error("Invalid offset size");
      }
    }
    readAddress() {
      if (this.addressSize === 4) {
        const value = this.readFourBytes();
        return value;
      } else {
        throw new Error("Invalid address size");
      }
    }
    readInitialLength() {
      const initial_length = this.readFourBytes();
      if (initial_length === 4294967295) {
        throw new Error("64-bit DWARF is not supported");
      } else {
        this.offsetSize = 4;
        return initial_length;
      }
    }
    readString() {
      let result = "";
      while (true) {
        const byte = this.readOneByte();
        if (byte === 0) {
          break;
        }
        result += String.fromCharCode(byte);
      }
      return result;
    }
    slice(offset, length) {
      return new DataView(this.view.buffer, this.view.byteOffset + offset, length);
    }
    readByteArray(length) {
      const result = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        result[i] = this.readOneByte();
      }
      return result;
    }
  };
  var DWARFParser = class {
    constructor(elf) {
      this.elf = elf;
      this.units = [];
      this.lineInfos = [];
      const abbrev = elf.getSection(".debug_abbrev");
      const info = elf.getSection(".debug_info");
      const debugstrs = elf.getSection(".debug_str") || elf.getSection("__debug_str");
      const infoReader = new ByteReader(info.contents, true);
      while (!infoReader.isEOF()) {
        const compilationUnit = new DWARFCompilationUnit(infoReader, debugstrs.contents);
        compilationUnit.read(abbrev.contents);
        this.units.push(compilationUnit);
        compilationUnit.dispose();
      }
      const linedata = elf.getSection(".debug_line");
      const lineReader = new ByteReader(linedata.contents, true);
      while (!lineReader.isEOF()) {
        const lineInfo = new DWARFLineInfo(lineReader);
        lineInfo.readLines();
        this.lineInfos.push(lineInfo);
        lineInfo.dispose();
      }
    }
  };
  var DWARFCompilationUnit = class {
    constructor(infoReader, debugstrs) {
      this.infoReader = infoReader;
      this.debugstrs = debugstrs;
      this.abbrevs = [];
      const baseOffset = infoReader.offset;
      const length = infoReader.readInitialLength();
      const version = infoReader.readTwoBytes();
      this.abbrevOffset = Number(infoReader.readOffset());
      const address_size = infoReader.readOneByte();
      this.headerLength = infoReader.offset - baseOffset;
      if (version != 2)
        throw new Error("DWARF version " + version + " not supported");
      if (address_size !== 4)
        throw new Error("Address size " + address_size + " not supported");
      this.contentLength = Number(length) - this.headerLength + 4;
      this.contentOffset = infoReader.offset;
    }
    dispose() {
      this.infoReader = null;
      this.debugstrs = null;
      this.abbrevs = null;
    }
    skip() {
      this.infoReader.offset += this.contentLength;
    }
    read(abbrev) {
      let abbrevReader = new ByteReader(abbrev, true);
      abbrevReader.offset = this.abbrevOffset;
      this.abbrevs = parseAbbrevs(abbrevReader);
      const slice = this.infoReader.slice(this.contentOffset, this.contentLength);
      this.root = this.processDIEs(new ByteReader(slice, true));
      this.skip();
    }
    processDIEs(reader) {
      let die_stack = [{ children: [] }];
      while (!reader.isEOF()) {
        let absolute_offset = reader.offset + this.contentOffset;
        let abbrev_num = Number(reader.readUnsignedLEB128());
        if (abbrev_num == 0) {
          let item = die_stack.pop();
          if (!item)
            throw new Error("DIE stack underflow @ offset " + reader.offset);
          continue;
        }
        let abbrev = this.abbrevs[abbrev_num - 1];
        if (!abbrev)
          throw new Error("Invalid abbreviation number " + abbrev_num);
        let obj = this.processDIE(reader, abbrev);
        let top = die_stack[die_stack.length - 1];
        if (!top.children)
          top.children = [];
        top.children.push(obj);
        if (abbrev.has_children) {
          die_stack.push(obj);
        }
      }
      if (die_stack.length != 1)
        throw new Error("DIE stack not empty");
      return die_stack[0];
    }
    processDIE(reader, abbrev) {
      let obj = { tag: DwarfTag[abbrev.tag] };
      for (let attr of abbrev.attributes) {
        let form = attr.form;
        let value = this.processAttribute(reader, form);
        obj[DwarfAttribute[attr.attr]] = value;
      }
      return obj;
    }
    processAttribute(reader, form) {
      switch (form) {
        case 11:
        case 12:
        case 17:
          return reader.readOneByte();
        case 5:
        case 18:
          return reader.readTwoBytes();
        case 6:
        case 19:
        case 1:
        case 16:
          return reader.readFourBytes();
        case 7:
        case 20:
          return reader.readEightBytes();
        case 8:
          return reader.readString();
        case 15:
        case 21:
          return reader.readUnsignedLEB128();
        case 13:
          return reader.readSignedLEB128();
        case 14:
          let offset = Number(reader.readOffset());
          return this.getStringFrom(this.debugstrs, offset);
        case 10:
          let len = reader.readOneByte();
          return reader.readByteArray(len);
        default:
          throw new Error("Unsupported form " + form);
      }
    }
    getStringFrom(strtab, offset) {
      let result = "";
      while (true) {
        const byte = strtab.getUint8(offset);
        if (byte === 0) {
          break;
        }
        result += String.fromCharCode(byte);
        offset += 1;
      }
      return result;
    }
  };
  var LineStateMachine = class {
    constructor(default_is_stmt) {
      this.Reset(default_is_stmt);
    }
    Reset(default_is_stmt) {
      this.file_num = 1;
      this.address = 0;
      this.line_num = 1;
      this.column_num = 0;
      this.is_stmt = default_is_stmt;
      this.basic_block = false;
      this.end_sequence = false;
    }
  };
  function parseAbbrevs(reader) {
    const abbrevs = [];
    while (!reader.isEOF()) {
      const number = Number(reader.readUnsignedLEB128());
      if (number == 0)
        break;
      const tag = Number(reader.readUnsignedLEB128());
      const has_children = reader.readOneByte() !== 0;
      const attributes = [];
      while (true) {
        const attr = Number(reader.readUnsignedLEB128());
        const form = Number(reader.readUnsignedLEB128());
        if (attr === 0 && form === 0) {
          break;
        }
        attributes.push({ attr, form });
      }
      const abbrev = {
        number,
        tag,
        has_children,
        attributes
      };
      abbrevs.push(abbrev);
    }
    return abbrevs;
  }
  var DWARFLineInfo = class {
    constructor(headerReader) {
      this.headerReader = headerReader;
      this.readHeader();
    }
    dispose() {
      this.headerReader = null;
      this.opData = null;
      this.opReader = null;
      this.lsm = null;
    }
    readHeader() {
      const length = this.headerReader.readInitialLength();
      const baseOffset1 = this.headerReader.offset;
      const version = this.headerReader.readTwoBytes();
      if (version != 2)
        throw new Error("DWARF version " + version + " not supported");
      const prologue_length = this.headerReader.readOffset();
      const baseOffset2 = this.headerReader.offset;
      this.min_insn_length = this.headerReader.readOneByte();
      this.default_is_stmt = this.headerReader.readOneByte() !== 0;
      this.line_base = this.headerReader.readOneByte();
      if (this.line_base >= 128) {
        this.line_base -= 256;
      }
      this.line_range = this.headerReader.readOneByte();
      const opcode_base = this.opcode_base = this.headerReader.readOneByte();
      const std_opcode_lengths = new Array(opcode_base + 1);
      for (let i = 1; i < opcode_base; i++) {
        std_opcode_lengths[i] = this.headerReader.readOneByte();
      }
      this.directories = [null];
      while (true) {
        const name = this.headerReader.readString();
        if (name === "") {
          break;
        }
        this.directories.push(name);
      }
      this.files = [null];
      while (true) {
        const name = this.headerReader.readString();
        if (name === "") {
          break;
        }
        const dir_index = Number(this.headerReader.readUnsignedLEB128());
        const mod_time = Number(this.headerReader.readUnsignedLEB128());
        const file_length = Number(this.headerReader.readUnsignedLEB128());
        this.files.push({ name, dir_index, mod_time, file_length, lines: [] });
      }
      this.contentOffset = baseOffset2 + Number(prologue_length);
      this.contentLength = Number(length) - (this.contentOffset - baseOffset1);
    }
    skip() {
      this.headerReader.offset = this.contentOffset + this.contentLength;
    }
    readLines() {
      this.opData = this.headerReader.slice(this.contentOffset, this.contentLength);
      this.opReader = new ByteReader(this.opData, true);
      this.lsm = new LineStateMachine(this.default_is_stmt);
      while (!this.opReader.isEOF()) {
        let add_line = this.processOneOpcode();
        if (this.lsm.end_sequence) {
          this.lsm.Reset(this.default_is_stmt);
        } else if (add_line) {
          let line = {
            file: this.files[this.lsm.file_num].name,
            line: this.lsm.line_num,
            column: this.lsm.column_num,
            address: this.lsm.address,
            is_stmt: this.lsm.is_stmt,
            basic_block: this.lsm.basic_block,
            end_sequence: this.lsm.end_sequence
          };
          this.files[this.lsm.file_num].lines.push(line);
        }
      }
      this.skip();
    }
    processOneOpcode() {
      let opcode = this.opReader.readOneByte();
      if (opcode >= this.opcode_base) {
        opcode -= this.opcode_base;
        let advance_address = Math.floor(opcode / this.line_range) * this.min_insn_length;
        let advance_line = opcode % this.line_range + this.line_base;
        this.checkPassPC();
        this.lsm.address += advance_address;
        this.lsm.line_num += advance_line;
        this.lsm.basic_block = true;
        return true;
      }
      switch (opcode) {
        case 1: {
          this.lsm.basic_block = false;
          return true;
        }
        case 2: {
          const advance_address = this.opReader.readUnsignedLEB128();
          this.checkPassPC();
          this.lsm.address += this.min_insn_length * Number(advance_address);
          break;
        }
        case 3: {
          this.lsm.line_num += Number(this.opReader.readSignedLEB128());
          break;
        }
        case 4: {
          this.lsm.file_num = Number(this.opReader.readUnsignedLEB128());
          break;
        }
        case 5: {
          this.lsm.column_num = Number(this.opReader.readUnsignedLEB128());
          break;
        }
        case 6: {
          this.lsm.is_stmt = !this.lsm.is_stmt;
          break;
        }
        case 7: {
          this.lsm.basic_block = true;
          break;
        }
        case 9: {
          const advance_address = this.opReader.readTwoBytes();
          this.checkPassPC();
          this.lsm.address += advance_address;
          break;
        }
        case 8: {
          const advance_address = this.min_insn_length * ((255 - this.opcode_base) / this.line_range);
          this.checkPassPC();
          this.lsm.address += advance_address;
          break;
        }
        case 10: {
          break;
        }
        case 11: {
          break;
        }
        case 0: {
          const extended_op_len = this.opReader.readUnsignedLEB128();
          const extended_op = this.opReader.readOneByte();
          switch (extended_op) {
            case 1:
              this.lsm.end_sequence = true;
              return true;
            case 2:
              this.lsm.address = Number(this.opReader.readAddress());
              break;
            case 3:
              break;
            default:
              console.log("Unknown DWARF extended opcode " + extended_op);
              this.opReader.offset += Number(extended_op_len);
              break;
          }
          break;
        }
        default:
          console.log("Unknown DWARF opcode " + opcode);
          break;
      }
    }
    checkPassPC() {
    }
  };

  // src/worker/wasiutils.ts
  var import_jszip = __toModule(require_jszip_min());
  function loadBlobSync(path) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = "blob";
    xhr.open("GET", path, false);
    xhr.send(null);
    return xhr.response;
  }
  async function unzipWASIFilesystem(zipdata, rootPath = "./") {
    const jszip = new import_jszip.default();
    await jszip.loadAsync(zipdata);
    let fs = new WASIMemoryFilesystem();
    let promises = [];
    jszip.forEach(async (relativePath, zipEntry) => {
      if (zipEntry.dir) {
        fs.putDirectory(relativePath);
      } else {
        let path = rootPath + relativePath;
        let prom = zipEntry.async("uint8array").then((data) => {
          fs.putFile(path, data);
        });
        promises.push(prom);
      }
    });
    await Promise.all(promises);
    return fs;
  }
  async function loadWASIFilesystemZip(zippath, rootPath = "./") {
    const jszip = new import_jszip.default();
    const path = "../../src/worker/fs/" + zippath;
    const zipdata = loadBlobSync(path);
    console.log(zippath, zipdata);
    return unzipWASIFilesystem(zipdata, rootPath);
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
  function tccErrorMatcher(errors, mainpath) {
    return makeErrorMatcher(errors, /([^:]+|tcc):(\d+|\s*error): (.+)/, 2, 3, mainpath, 1);
    ;
  }
  var armtcc_fs = null;
  async function compileARMTCC(step) {
    loadNative("arm-tcc");
    const params = step.params;
    const errors = [];
    gatherFiles(step, { mainFilePath: "main.c" });
    const objpath = step.prefix + ".o";
    const error_fn = tccErrorMatcher(errors, step.path);
    if (!armtcc_fs) {
      armtcc_fs = await loadWASIFilesystemZip("arm32-fs.zip");
    }
    if (staleFiles(step, [objpath])) {
      const armtcc = await emglobal.armtcc({
        instantiateWasm: moduleInstFn("arm-tcc"),
        noInitialRun: true,
        print: error_fn,
        printErr: error_fn
      });
      var args = [
        "-c",
        "-I.",
        "-I./include",
        "-funsigned-char",
        "-gdwarf-2",
        "-o",
        objpath
      ];
      if (params.define) {
        params.define.forEach((x) => args.push("-D" + x));
      }
      if (params.extra_compile_args) {
        args = args.concat(params.extra_compile_args);
      }
      args.push(step.path);
      const FS = armtcc.FS;
      armtcc_fs.getDirectories().forEach((dir) => {
        if (dir.name != "/")
          FS.mkdir(dir.name);
      });
      armtcc_fs.getFiles().forEach((file) => {
        FS.writeFile(file.name, file.getBytes(), { encoding: "binary" });
      });
      populateExtraFiles(step, FS, params.extra_compile_files);
      populateFiles(step, FS, {
        mainFilePath: step.path,
        processFn: (path, code) => {
          if (typeof code === "string") {
            code = processEmbedDirective(code);
          }
          return code;
        }
      });
      execMain(step, armtcc, args);
      if (errors.length)
        return { errors };
      var objout = FS.readFile(objpath, { encoding: "binary" });
      putWorkFile(objpath, objout);
    }
    return {
      linktool: "armtcclink",
      files: [objpath],
      args: [objpath]
    };
  }
  async function linkARMTCC(step) {
    loadNative("arm-tcc");
    const params = step.params;
    const errors = [];
    gatherFiles(step, { mainFilePath: "main.c" });
    const objpath = "main.elf";
    const error_fn = tccErrorMatcher(errors, step.path);
    if (staleFiles(step, [objpath])) {
      const armtcc = await emglobal.armtcc({
        instantiateWasm: moduleInstFn("arm-tcc"),
        noInitialRun: true,
        print: error_fn,
        printErr: error_fn
      });
      var args = [
        "-L.",
        "-nostdlib",
        "-nostdinc",
        "-Wl,--oformat=elf32-arm",
        "-gdwarf-2",
        "-o",
        objpath
      ];
      if (params.define) {
        params.define.forEach((x) => args.push("-D" + x));
      }
      args = args.concat(step.files);
      if (params.extra_link_args) {
        args = args.concat(params.extra_link_args);
      }
      const FS = armtcc.FS;
      populateExtraFiles(step, FS, params.extra_link_files);
      populateFiles(step, FS);
      execMain(step, armtcc, args);
      if (errors.length)
        return { errors };
      var objout = FS.readFile(objpath, { encoding: "binary" });
      putWorkFile(objpath, objout);
      if (!anyTargetChanged(step, [objpath]))
        return;
      const elfparser = new ELFParser(objout);
      let maxaddr = 0;
      elfparser.sectionHeaders.forEach((section, index) => {
        maxaddr = Math.max(maxaddr, section.vmaddr + section.size);
      });
      let rom = new Uint8Array(maxaddr);
      elfparser.sectionHeaders.forEach((section, index) => {
        if (section.flags & 2) {
          let data = objout.slice(section.offset, section.offset + section.size);
          rom.set(data, section.vmaddr);
        }
      });
      const obj32 = new Uint32Array(rom.buffer);
      const start = elfparser.entry;
      obj32[0] = start;
      obj32[1] = start;
      obj32[2] = start;
      obj32[3] = start;
      obj32[4] = start;
      obj32[5] = start;
      obj32[6] = start;
      obj32[7] = start;
      let symbolmap = {};
      elfparser.getSymbols().forEach((symbol, index) => {
        symbolmap[symbol.name] = symbol.value;
      });
      let segments = [];
      elfparser.sectionHeaders.forEach((section, index) => {
        if (section.flags & 2 && section.size) {
          segments.push({
            name: section.name,
            start: section.vmaddr,
            size: section.size,
            type: section.type
          });
        }
      });
      const listings = {};
      const dwarf = new DWARFParser(elfparser);
      dwarf.lineInfos.forEach((lineInfo) => {
        lineInfo.files.forEach((file) => {
          if (!file || !file.lines)
            return;
          file.lines.forEach((line) => {
            const filename = line.file;
            const offset = line.address;
            const path = getPrefix(filename) + ".lst";
            const linenum = line.line;
            let lst = listings[path];
            if (lst == null) {
              lst = listings[path] = { lines: [] };
            }
            lst.lines.push({
              path,
              line: linenum,
              offset
            });
          });
        });
      });
      return {
        output: rom,
        listings,
        errors,
        symbolmap,
        segments,
        debuginfo: dwarf
      };
    }
  }

  // src/common/tokenizer.ts
  var CompileError3 = class extends Error {
    constructor(msg, loc) {
      super(msg);
      Object.setPrototypeOf(this, CompileError3.prototype);
      this.$loc = loc;
    }
  };
  function mergeLocs2(a, b) {
    return {
      line: Math.min(a.line, b.line),
      start: Math.min(a.start, b.start),
      end: Math.max(a.end, b.end),
      label: a.label || b.label,
      path: a.path || b.path
    };
  }
  var TokenType2;
  (function(TokenType3) {
    TokenType3["EOF"] = "eof";
    TokenType3["EOL"] = "eol";
    TokenType3["Ident"] = "ident";
    TokenType3["Comment"] = "comment";
    TokenType3["Ignore"] = "ignore";
    TokenType3["CatchAll"] = "catch-all";
  })(TokenType2 || (TokenType2 = {}));
  var CATCH_ALL_RULES = [
    { type: TokenType2.CatchAll, regex: /.+?/ }
  ];
  function re_escape(rule) {
    return `(${rule.regex.source})`;
  }
  var TokenizerRuleSet = class {
    constructor(rules) {
      this.rules = rules.concat(CATCH_ALL_RULES);
      var pattern = this.rules.map(re_escape).join("|");
      this.regex = new RegExp(pattern, "gs");
    }
  };
  var Tokenizer = class {
    constructor() {
      this.errorOnCatchAll = false;
      this.deferred = [];
      this.errors = [];
      this.lineno = 0;
      this.lineindex = [];
      this.tokens = [];
    }
    setTokenRuleSet(ruleset) {
      this.ruleset = ruleset;
    }
    setTokenRules(rules) {
      this.setTokenRuleSet(new TokenizerRuleSet(rules));
    }
    tokenizeFile(contents, path) {
      this.path = path;
      let m;
      let re = /\n|\r\n?/g;
      this.lineindex.push(0);
      while (m = re.exec(contents)) {
        this.lineindex.push(m.index);
      }
      this._tokenize(contents);
      this.eof = { type: TokenType2.EOF, str: "", eol: true, $loc: { path: this.path, line: this.lineno } };
      this.pushToken(this.eof);
    }
    _tokenize(text) {
      let m;
      this.lineno = 0;
      while (m = this.ruleset.regex.exec(text)) {
        let found = false;
        while (m.index >= this.lineindex[this.lineno]) {
          this.lineno++;
        }
        let rules = this.ruleset.rules;
        for (let i = 0; i < rules.length; i++) {
          let s = m[i + 1];
          if (s != null) {
            found = true;
            let col = m.index - (this.lineindex[this.lineno - 1] || -1) - 1;
            let loc = { path: this.path, line: this.lineno, start: col, end: col + s.length };
            let rule = rules[i];
            switch (rule.type) {
              case TokenType2.CatchAll:
                if (this.errorOnCatchAll) {
                  this.compileError(`I didn't expect the character "${m[0]}" here.`, loc);
                }
              default:
                this.pushToken({ str: s, type: rule.type, $loc: loc, eol: false });
                break;
              case TokenType2.EOL:
                if (this.tokens.length)
                  this.tokens[this.tokens.length - 1].eol = true;
              case TokenType2.Comment:
              case TokenType2.Ignore:
                break;
            }
            break;
          }
        }
        if (!found) {
          this.compileError(`Could not parse token: <<${m[0]}>>`);
        }
      }
    }
    pushToken(token) {
      this.tokens.push(token);
    }
    addError(msg, loc) {
      let tok = this.lasttoken || this.peekToken();
      if (!loc)
        loc = tok.$loc;
      this.errors.push({ path: loc.path, line: loc.line, label: this.curlabel, start: loc.start, end: loc.end, msg });
    }
    internalError() {
      return this.compileError("Internal error.");
    }
    notImplementedError() {
      return this.compileError("Not yet implemented.");
    }
    compileError(msg, loc, loc2) {
      this.addError(msg, loc);
      let e = new CompileError3(msg, loc);
      throw e;
      return e;
    }
    peekToken(lookahead) {
      let tok = this.tokens[lookahead || 0];
      return tok ? tok : this.eof;
    }
    consumeToken() {
      let tok = this.lasttoken = this.tokens.shift() || this.eof;
      return tok;
    }
    ifToken(match) {
      if (this.peekToken().str == match)
        return this.consumeToken();
    }
    expectToken(str, msg) {
      let tok = this.consumeToken();
      let tokstr = tok.str;
      if (str != tokstr) {
        this.compileError(msg || `There should be a "${str}" here.`);
      }
      return tok;
    }
    expectTokens(strlist, msg) {
      let tok = this.consumeToken();
      let tokstr = tok.str;
      if (!strlist.includes(tokstr)) {
        this.compileError(msg || `These keywords are valid here: ${strlist.join(", ")}`);
      }
      return tok;
    }
    parseModifiers(modifiers) {
      let result = {};
      do {
        var tok = this.peekToken();
        if (modifiers.indexOf(tok.str) < 0)
          return result;
        this.consumeToken();
        result[tok.str] = true;
      } while (tok != null);
    }
    expectIdent(msg) {
      let tok = this.consumeToken();
      if (tok.type != TokenType2.Ident)
        this.compileError(msg || `There should be an identifier here.`);
      return tok;
    }
    pushbackToken(tok) {
      this.tokens.unshift(tok);
    }
    isEOF() {
      return this.tokens.length == 0 || this.peekToken().type == "eof";
    }
    expectEOL(msg) {
      let tok = this.consumeToken();
      if (tok.type != TokenType2.EOL)
        this.compileError(msg || `There's too much stuff on this line.`);
    }
    skipBlankLines() {
      this.skipTokenTypes(["eol"]);
    }
    skipTokenTypes(types) {
      while (types.includes(this.peekToken().type))
        this.consumeToken();
    }
    expectTokenTypes(types, msg) {
      let tok = this.consumeToken();
      if (!types.includes(tok.type))
        this.compileError(msg || `There should be a ${types.map((s) => `"${s}"`).join(" or ")} here. not a "${tok.type}".`);
      return tok;
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
    runDeferred() {
      while (this.deferred.length) {
        this.deferred.shift()();
      }
    }
  };

  // src/common/ecs/binpack.ts
  var debug2 = false;
  var BoxPlacement;
  (function(BoxPlacement2) {
    BoxPlacement2[BoxPlacement2["TopLeft"] = 0] = "TopLeft";
    BoxPlacement2[BoxPlacement2["TopRight"] = 1] = "TopRight";
    BoxPlacement2[BoxPlacement2["BottomLeft"] = 2] = "BottomLeft";
    BoxPlacement2[BoxPlacement2["BottomRight"] = 3] = "BottomRight";
  })(BoxPlacement || (BoxPlacement = {}));
  function boxesIntersect(a, b) {
    return !(b.left >= a.right || b.right <= a.left || b.top >= a.bottom || b.bottom <= a.top);
  }
  function boxesContain(a, b) {
    return b.left >= a.left && b.top >= a.top && b.right <= a.right && b.bottom <= a.bottom;
  }
  var Bin = class {
    constructor(binbounds) {
      this.binbounds = binbounds;
      this.boxes = [];
      this.free = [];
      this.extents = { left: 0, top: 0, right: 0, bottom: 0 };
      this.free.push(binbounds);
    }
    getBoxes(bounds, limit, boxes) {
      let result = [];
      if (!boxes)
        boxes = this.boxes;
      for (let box of boxes) {
        if (boxesIntersect(bounds, box)) {
          result.push(box);
          if (result.length >= limit)
            break;
        }
      }
      return result;
    }
    fits(b) {
      if (!boxesContain(this.binbounds, b)) {
        if (debug2)
          console.log("out of bounds!", b.left, b.top, b.right, b.bottom);
        return false;
      }
      if (this.getBoxes(b, 1).length > 0) {
        if (debug2)
          console.log("intersect!", b.left, b.top, b.right, b.bottom);
        return false;
      }
      return true;
    }
    bestFit(b) {
      let bestscore = 0;
      let best = null;
      for (let f of this.free) {
        if (b.left != null && b.left < f.left)
          continue;
        if (b.left != null && b.left + b.width > f.right)
          continue;
        if (b.top != null && b.top < f.top)
          continue;
        if (b.top != null && b.top + b.height > f.bottom)
          continue;
        let dx = f.right - f.left - b.width;
        let dy = f.bottom - f.top - b.height;
        if (dx >= 0 && dy >= 0) {
          let score = 1 / (1 + dx + dy + f.left * 1e-3);
          if (score > bestscore) {
            best = f;
            bestscore = score;
            if (score == 1)
              break;
          }
        }
      }
      return best;
    }
    anyFit(b) {
      let bestscore = 0;
      let best = null;
      for (let f of this.free) {
        let box = {
          left: b.left != null ? b.left : f.left,
          right: f.left + b.width,
          top: b.top != null ? b.top : f.top,
          bottom: f.top + b.height
        };
        if (this.fits(box)) {
          let score = 1 / (1 + box.left + box.top);
          if (score > bestscore) {
            best = f;
            if (score == 1)
              break;
          }
        }
      }
      return best;
    }
    add(b) {
      if (debug2)
        console.log("add", b.left, b.top, b.right, b.bottom);
      if (!this.fits(b)) {
        throw new Error(`bad fit ${b.left} ${b.top} ${b.right} ${b.bottom}`);
      }
      this.boxes.push(b);
      this.extents.right = Math.max(this.extents.right, b.right);
      this.extents.bottom = Math.max(this.extents.bottom, b.bottom);
      for (let p of b.parents) {
        let i = this.free.indexOf(p);
        if (i < 0)
          throw new Error("cannot find parent");
        if (debug2)
          console.log("removed", p.left, p.top, p.right, p.bottom);
        this.free.splice(i, 1);
        this.addFree(p.left, p.top, b.left, p.bottom);
        this.addFree(b.right, p.top, p.right, p.bottom);
        this.addFree(b.left, p.top, b.right, b.top);
        this.addFree(b.left, b.bottom, b.right, p.bottom);
      }
    }
    addFree(left, top, right, bottom) {
      if (bottom > top && right > left) {
        let b = { left, top, right, bottom };
        if (debug2)
          console.log("free", b.left, b.top, b.right, b.bottom);
        this.free.push(b);
      }
    }
  };
  var Packer = class {
    constructor() {
      this.bins = [];
      this.boxes = [];
      this.defaultPlacement = 0;
    }
    pack() {
      for (let bc of this.boxes) {
        let box = this.bestPlacement(bc);
        if (!box)
          return false;
        box.bin.add(box);
        bc.box = box;
      }
      return true;
    }
    bestPlacement(b) {
      for (let bin of this.bins) {
        let parent = bin.bestFit(b);
        let approx = false;
        if (!parent) {
          parent = bin.anyFit(b);
          approx = true;
          if (debug2)
            console.log("anyfit", parent == null ? void 0 : parent.left, parent == null ? void 0 : parent.top);
        }
        if (parent) {
          let place = this.defaultPlacement;
          let box = {
            left: parent.left,
            top: parent.top,
            right: parent.left + b.width,
            bottom: parent.top + b.height
          };
          if (b.left != null) {
            box.left = b.left;
            box.right = b.left + b.width;
          }
          if (b.top != null) {
            box.top = b.top;
            box.bottom = b.top + b.height;
          }
          if (place == 2 || place == 3) {
            let h = box.bottom - box.top;
            box.top = parent.bottom - h;
            box.bottom = parent.bottom;
          }
          if (place == 1 || place == 3) {
            let w = box.right - box.left;
            box.left = parent.right - w;
            box.right = parent.right;
          }
          if (debug2)
            console.log("place", b.label, box.left, box.top, box.right, box.bottom, parent == null ? void 0 : parent.left, parent == null ? void 0 : parent.top);
          let parents = [parent];
          if (approx)
            parents = bin.getBoxes(box, 100, bin.free);
          return __spreadValues({ parents, place, bin }, box);
        }
      }
      if (debug2)
        console.log("cannot place!", b.left, b.top, b.width, b.height);
      return null;
    }
    toSVG() {
      let s = "";
      let r = { width: 100, height: 70 };
      for (let bin of this.bins) {
        r.width = Math.max(r.width, bin.binbounds.right);
        r.height = Math.max(r.height, bin.binbounds.bottom);
      }
      s += `<svg viewBox="0 0 ${r.width} ${r.height}" xmlns="http://www.w3.org/2000/svg"><style><![CDATA[text {font: 1px sans-serif;}]]></style>`;
      for (let bin of this.bins) {
        let be = bin.extents;
        s += "<g>";
        s += `<rect width="${be.right - be.left}" height="${be.bottom - be.top}" stroke="black" stroke-width="0.5" fill="none"/>`;
        let textx = be.right + 1;
        let texty = 0;
        for (let box of this.boxes) {
          let b = box.box;
          if (b) {
            if (b.bin == bin)
              s += `<rect width="${b.right - b.left}" height="${b.bottom - b.top}" x="${b.left}" y="${b.top}" stroke="black" stroke-width="0.25" fill="#ccc"/>`;
            if (b.top == texty)
              textx += 10;
            else
              textx = be.right + 1;
            texty = b.top;
            if (box.label)
              s += `<text x="${textx}" y="${texty}" height="1">${box.label}</text>`;
          }
        }
        s += "</g>";
      }
      s += `</svg>`;
      return s;
    }
    toSVGUrl() {
      return `data:image/svg+xml;base64,${btoa(this.toSVG())}`;
    }
  };

  // src/common/ecs/ecs.ts
  var ECSError = class extends Error {
    constructor(msg, obj) {
      super(msg);
      this.$sources = [];
      Object.setPrototypeOf(this, ECSError.prototype);
      if (obj)
        this.$loc = obj.$loc || obj;
    }
  };
  function mksymbol(c, fieldName) {
    return c.name + "_" + fieldName;
  }
  function mkscopesymbol(s, c, fieldName) {
    return s.name + "_" + c.name + "_" + fieldName;
  }
  var SystemStats = class {
  };
  var SELECT_TYPE = ["once", "foreach", "join", "with", "if", "select", "unroll"];
  function isLiteral2(arg) {
    return arg.value != null;
  }
  function isLiteralInt(arg) {
    return isLiteral2(arg) && arg.valtype.dtype == "int";
  }
  function isBinOp2(arg) {
    return arg.op != null && arg.left != null && arg.right != null;
  }
  function isUnOp2(arg) {
    return arg.op != null && arg.expr != null;
  }
  function isBlockStmt(arg) {
    return arg.stmts != null;
  }
  function isInlineCode(arg) {
    return arg.code != null;
  }
  function isQueryExpr(arg) {
    return arg.query != null;
  }
  var Dialect_CA65 = class {
    constructor() {
      this.ASM_ITERATE_EACH_ASC = `
    ldx #0
@__each:
    {{%code}}
    inx
    cpx #{{%ecount}}
    jne @__each
@__exit:
`;
      this.ASM_ITERATE_EACH_DESC = `
    ldx #{{%ecount}}-1
@__each:
    {{%code}}
    dex
    jpl @__each
@__exit:
`;
      this.ASM_ITERATE_JOIN_ASC = `
    ldy #0
@__each:
    ldx {{%joinfield}},y
    {{%code}}
    iny
    cpy #{{%ecount}}
    jne @__each
@__exit:
`;
      this.ASM_ITERATE_JOIN_DESC = `
    ldy #{{%ecount}}-1
@__each:
    ldx {{%joinfield}},y
    {{%code}}
    dey
    jpl @__each
@__exit:
`;
      this.ASM_FILTER_RANGE_LO_X = `
    cpx #{{%xofs}}
    jcc @__skipxlo
    {{%code}}
@__skipxlo:
`;
      this.ASM_FILTER_RANGE_HI_X = `
    cpx #{{%xofs}}+{{%ecount}}
    jcs @__skipxhi
    {{%code}}
@__skipxhi:
`;
      this.ASM_LOOKUP_REF_X = `
    ldx {{%reffield}}
    {{%code}}
`;
      this.INIT_FROM_ARRAY = `
    ldy #{{%nbytes}}
:   lda {{%src}}-1,y
    sta {{%dest}}-1,y
    dey
    bne :-
`;
    }
    comment(s) {
      return `
;;; ${s}
`;
    }
    absolute(ident, offset) {
      return this.addOffset(ident, offset || 0);
    }
    addOffset(ident, offset) {
      if (offset > 0)
        return `${ident}+${offset}`;
      if (offset < 0)
        return `${ident}-${-offset}`;
      return ident;
    }
    indexed_x(ident, offset) {
      return this.addOffset(ident, offset) + ",x";
    }
    indexed_y(ident, offset) {
      return this.addOffset(ident, offset) + ",y";
    }
    fieldsymbol(component, field, bitofs) {
      return `${component.name}_${field.name}_b${bitofs}`;
    }
    datasymbol(component, field, eid, bitofs) {
      return `${component.name}_${field.name}_e${eid}_b${bitofs}`;
    }
    debug_file(path) {
      return `.dbg file, "${path}", 0, 0`;
    }
    debug_line(path, line) {
      return `.dbg line, "${path}", ${line}`;
    }
    startScope(name) {
      return `.scope ${name}`;
    }
    endScope(name) {
      return `.endscope
${this.scopeSymbol(name)} = ${name}::__Start`;
    }
    scopeSymbol(name) {
      return `${name}__Start`;
    }
    align(value) {
      return `.align ${value}`;
    }
    alignSegmentStart() {
      return this.label("__ALIGNORIGIN");
    }
    warningIfPageCrossed(startlabel) {
      return `
.assert >(${startlabel}) = >(*), error, "${startlabel} crosses a page boundary!"`;
    }
    warningIfMoreThan(bytes, startlabel) {
      return `
.assert (* - ${startlabel}) <= ${bytes}, error, .sprintf("${startlabel} does not fit in ${bytes} bytes, it took %d!", (* - ${startlabel}))`;
    }
    alignIfLessThan(bytes) {
      return `
.if <(* - __ALIGNORIGIN) > 256-${bytes}
.align $100
.endif`;
    }
    segment(segtype) {
      if (segtype == "bss") {
        return `.zeropage`;
      } else if (segtype == "rodata") {
        return ".rodata";
      } else {
        return `.code`;
      }
    }
    label(sym) {
      return `${sym}:`;
    }
    export(sym) {
      return `.export _${sym} = ${sym}`;
    }
    byte(b) {
      if (b === void 0) {
        return `.res 1`;
      } else if (typeof b === "number") {
        if (b < 0 || b > 255)
          throw new ECSError(`out of range byte ${b}`);
        return `.byte ${b}`;
      } else {
        if (b.bitofs == 0)
          return `.byte <${b.symbol}`;
        else if (b.bitofs == 8)
          return `.byte >${b.symbol}`;
        else
          return `.byte ((${b.symbol} >> ${b.bitofs})&255)`;
      }
    }
    tempLabel(inst) {
      return `${inst.system.name}__${inst.id}__tmp`;
    }
    equate(symbol, value) {
      return `${symbol} = ${value}`;
    }
    define(symbol, value) {
      if (value)
        return `.define ${symbol} ${value}`;
      else
        return `.define ${symbol}`;
    }
    call(symbol) {
      return ` jsr ${symbol}`;
    }
    jump(symbol) {
      return ` jmp ${symbol}`;
    }
    return() {
      return " rts";
    }
  };
  var SourceFileExport = class {
    constructor() {
      this.lines = [];
    }
    line(s) {
      this.text(s);
    }
    text(s) {
      for (let l of s.split("\n"))
        this.lines.push(l);
    }
    toString() {
      return this.lines.join("\n");
    }
  };
  var CodeSegment = class {
    constructor() {
      this.codefrags = [];
    }
    addCodeFragment(code) {
      this.codefrags.push(code);
    }
    dump(file) {
      for (let code of this.codefrags) {
        file.text(code);
      }
    }
  };
  var DataSegment = class {
    constructor() {
      this.symbols = {};
      this.equates = {};
      this.ofs2sym = new Map();
      this.fieldranges = {};
      this.size = 0;
      this.initdata = [];
    }
    allocateBytes(name, bytes) {
      let ofs = this.symbols[name];
      if (ofs == null) {
        ofs = this.size;
        this.declareSymbol(name, ofs);
        this.size += bytes;
      }
      return ofs;
    }
    declareSymbol(name, ofs) {
      var _a;
      this.symbols[name] = ofs;
      if (!this.ofs2sym.has(ofs))
        this.ofs2sym.set(ofs, []);
      (_a = this.ofs2sym.get(ofs)) == null ? void 0 : _a.push(name);
    }
    findExistingInitData(bytes) {
      for (let i = 0; i < this.size - bytes.length; i++) {
        for (var j = 0; j < bytes.length; j++) {
          if (this.initdata[i + j] !== bytes[j])
            break;
        }
        if (j == bytes.length)
          return i;
      }
      return -1;
    }
    allocateInitData(name, bytes) {
      let ofs = this.findExistingInitData(bytes);
      if (ofs >= 0) {
        this.declareSymbol(name, ofs);
      } else {
        ofs = this.allocateBytes(name, bytes.length);
        for (let i = 0; i < bytes.length; i++) {
          this.initdata[ofs + i] = bytes[i];
        }
      }
    }
    dump(file, dialect, doExport) {
      for (let i = 0; i < this.size; i++) {
        let syms = this.ofs2sym.get(i);
        if (syms) {
          for (let sym of syms) {
            if (doExport)
              file.line(dialect.export(sym));
            file.line(dialect.label(sym));
          }
        }
        file.line(dialect.byte(this.initdata[i]));
      }
      for (let [symbol, value] of Object.entries(this.equates)) {
        file.line(dialect.equate(symbol, value));
      }
    }
    getFieldRange(component, fieldName) {
      return this.fieldranges[mksymbol(component, fieldName)];
    }
    getByteOffset(range, access, entityID) {
      if (entityID < range.elo)
        throw new ECSError(`entity ID ${entityID} too low for ${access.symbol}`);
      if (entityID > range.ehi)
        throw new ECSError(`entity ID ${entityID} too high for ${access.symbol}`);
      let ofs = this.symbols[access.symbol];
      if (ofs !== void 0) {
        return ofs + entityID - range.elo;
      }
      throw new ECSError(`cannot find field access for ${access.symbol}`);
    }
    getOriginSymbol() {
      let a = this.ofs2sym.get(0);
      if (!a)
        throw new ECSError("getOriginSymbol(): no symbol at offset 0");
      return a[0];
    }
  };
  var UninitDataSegment = class extends DataSegment {
  };
  var ConstDataSegment = class extends DataSegment {
  };
  function getFieldBits(f) {
    let n = f.hi - f.lo + 1;
    return Math.ceil(Math.log2(n));
  }
  function getFieldLength(f) {
    if (f.dtype == "int") {
      return f.hi - f.lo + 1;
    } else {
      return 1;
    }
  }
  function getPackedFieldSize(f, constValue) {
    if (f.dtype == "int") {
      return getFieldBits(f);
    }
    if (f.dtype == "array" && f.index) {
      return 0;
    }
    if (f.dtype == "array" && constValue != null && Array.isArray(constValue)) {
      return constValue.length * getPackedFieldSize(f.elem);
    }
    if (f.dtype == "ref") {
      return 8;
    }
    return 0;
  }
  var EntitySet = class {
    constructor(scope, query, e) {
      this.scope = scope;
      if (query) {
        if (query.entities) {
          this.entities = query.entities.slice(0);
        } else {
          this.atypes = scope.em.archetypesMatching(query);
          this.entities = scope.entitiesMatching(this.atypes);
        }
        if (query.limit) {
          this.entities = this.entities.slice(0, query.limit);
        }
      } else if (e) {
        this.entities = e;
      } else {
        throw new ECSError("invalid EntitySet constructor");
      }
      if (!this.atypes) {
        let at = new Set();
        for (let e2 of this.entities)
          at.add(e2.etype);
        this.atypes = Array.from(at.values());
      }
    }
    contains(c, f, where) {
      return this.scope.em.singleComponentWithFieldName(this.atypes, f.name, where);
    }
    intersection(qr) {
      let ents = this.entities.filter((e) => qr.entities.includes(e));
      return new EntitySet(this.scope, void 0, ents);
    }
    union(qr) {
      let ents = this.entities.concat(qr.entities);
      let atypes = this.atypes.concat(qr.atypes);
      return new EntitySet(this.scope, void 0, ents);
    }
    isContiguous() {
      if (this.entities.length == 0)
        return true;
      let id = this.entities[0].id;
      for (let i = 1; i < this.entities.length; i++) {
        if (this.entities[i].id != ++id)
          return false;
      }
      return true;
    }
  };
  var IndexRegister = class {
    constructor(scope, eset) {
      this.scope = scope;
      this.elo = 0;
      this.ehi = scope.entities.length - 1;
      this.lo = null;
      this.hi = null;
      if (eset) {
        this.narrowInPlace(eset);
      }
    }
    entityCount() {
      return this.ehi - this.elo + 1;
    }
    clone() {
      return Object.assign(new IndexRegister(this.scope), this);
    }
    narrow(eset, action) {
      let i = this.clone();
      return i.narrowInPlace(eset, action) ? i : null;
    }
    narrowInPlace(eset, action) {
      if (this.scope != eset.scope)
        throw new ECSError(`scope mismatch`, action);
      if (!eset.isContiguous())
        throw new ECSError(`entities are not contiguous`, action);
      if (this.eset) {
        this.eset = this.eset.intersection(eset);
      } else {
        this.eset = eset;
      }
      if (this.eset.entities.length == 0) {
        return false;
      }
      let newelo = this.eset.entities[0].id;
      let newehi = this.eset.entities[this.eset.entities.length - 1].id;
      if (this.lo === null || this.hi === null) {
        this.lo = 0;
        this.hi = newehi - newelo;
        this.elo = newelo;
        this.ehi = newehi;
      } else {
        this.lo += newelo - this.elo;
        this.hi += newehi - this.ehi;
      }
      return true;
    }
    offset() {
      return this.lo || 0;
    }
  };
  var ActionCPUState = class {
    constructor() {
      this.xreg = null;
      this.yreg = null;
    }
  };
  var ActionEval = class {
    constructor(scope, instance, action, eventargs) {
      this.scope = scope;
      this.instance = instance;
      this.action = action;
      this.eventargs = eventargs;
      this.tmplabel = "";
      this.em = scope.em;
      this.dialect = scope.em.dialect;
      this.tmplabel = this.dialect.tempLabel(this.instance);
      this.seq = this.em.seq++;
      this.label = `${this.instance.system.name}__${action.event}__${this.seq}`;
    }
    begin() {
    }
    end() {
    }
    codeToString() {
      let code = this.exprToCode(this.action.expr);
      return code;
    }
    replaceTags(code, action, props) {
      const tag_re = /\{\{(.+?)\}\}/g;
      code = code.replace(tag_re, (entire, group) => {
        let toks = group.split(/\s+/);
        if (toks.length == 0)
          throw new ECSError(`empty command`, action);
        let cmd = group.charAt(0);
        let arg0 = toks[0].substring(1).trim();
        let args = [arg0].concat(toks.slice(1));
        switch (cmd) {
          case "!":
            return this.__emit(args);
          case "$":
            return this.__local(args);
          case "^":
            return this.__use(args);
          case "#":
            return this.__arg(args);
          case "&":
            return this.__eid(args);
          case "<":
            return this.__get([arg0, "0"]);
          case ">":
            return this.__get([arg0, "8"]);
          default:
            let value = props[toks[0]];
            if (value)
              return value;
            let fn = this["__" + toks[0]];
            if (fn)
              return fn.bind(this)(toks.slice(1));
            throw new ECSError(`unrecognized command {{${toks[0]}}}`, action);
        }
      });
      return code;
    }
    replaceLabels(code) {
      const label_re = /@(\w+)\b/g;
      let seq = this.em.seq++;
      let label = `${this.instance.system.name}__${this.action.event}__${seq}`;
      code = code.replace(label_re, (s, a) => `${label}__${a}`);
      return code;
    }
    __get(args) {
      return this.getset(args, false);
    }
    __set(args) {
      return this.getset(args, true);
    }
    getset(args, canwrite) {
      let fieldName = args[0];
      let bitofs = parseInt(args[1] || "0");
      return this.generateCodeForField(fieldName, bitofs, canwrite);
    }
    parseFieldArgs(args) {
      let fieldName = args[0];
      let bitofs = parseInt(args[1] || "0");
      let component = this.em.singleComponentWithFieldName(this.scope.state.working.atypes, fieldName, this.action);
      let field = component.fields.find((f) => f.name == fieldName);
      if (field == null)
        throw new ECSError(`no field named "${fieldName}" in component`, this.action);
      return { component, field, bitofs };
    }
    __base(args) {
      let { component, field, bitofs } = this.parseFieldArgs(args);
      return this.dialect.fieldsymbol(component, field, bitofs);
    }
    __data(args) {
      let { component, field, bitofs } = this.parseFieldArgs(args);
      let entities = this.scope.state.working.entities;
      if (entities.length != 1)
        throw new ECSError(`data operates on exactly one entity`, this.action);
      let eid = entities[0].id;
      return this.dialect.datasymbol(component, field, eid, bitofs);
    }
    __const(args) {
      let { component, field, bitofs } = this.parseFieldArgs(args);
      let entities = this.scope.state.working.entities;
      if (entities.length != 1)
        throw new ECSError(`const operates on exactly one entity`, this.action);
      let constVal = entities[0].consts[mksymbol(component, field.name)];
      if (constVal === void 0)
        throw new ECSError(`field is not constant`, this.action);
      if (typeof constVal !== "number")
        throw new ECSError(`field is not numeric`, this.action);
      return constVal << bitofs;
    }
    __index(args) {
      let ident = args[0];
      let index = parseInt(args[1] || "0");
      let entities = this.scope.state.working.entities;
      if (entities.length == 1) {
        return this.dialect.absolute(ident);
      } else {
        return this.dialect.indexed_x(ident, index);
      }
    }
    __eid(args) {
      let e = this.scope.getEntityByName(args[0] || "?");
      if (!e)
        throw new ECSError(`can't find entity named "${args[0]}"`, this.action);
      return e.id.toString();
    }
    __use(args) {
      return this.scope.includeResource(args[0]);
    }
    __emit(args) {
      let event = args[0];
      let eventargs = args.slice(1);
      try {
        return this.scope.generateCodeForEvent(event, eventargs);
      } catch (e) {
        if (e.$sources)
          e.$sources.push(this.action);
        throw e;
      }
    }
    __local(args) {
      let tempinc = parseInt(args[0]);
      let tempbytes = this.instance.system.tempbytes;
      if (isNaN(tempinc))
        throw new ECSError(`bad temporary offset`, this.action);
      if (!tempbytes)
        throw new ECSError(`this system has no locals`, this.action);
      if (tempinc < 0 || tempinc >= tempbytes)
        throw new ECSError(`this system only has ${tempbytes} locals`, this.action);
      this.scope.updateTempLiveness(this.instance);
      return `${this.tmplabel}+${tempinc}`;
    }
    __arg(args) {
      let argindex = parseInt(args[0] || "0");
      let argvalue = this.eventargs[argindex] || "";
      return argvalue;
    }
    __start(args) {
      let startSymbol = this.dialect.scopeSymbol(args[0]);
      return this.dialect.jump(startSymbol);
    }
    generateCodeForField(fieldName, bitofs, canWrite) {
      var _a, _b, _c, _d;
      const action = this.action;
      const qr = this.scope.state.working;
      var component;
      var baseLookup = false;
      var entityLookup = false;
      let entities;
      if (fieldName.indexOf(".") > 0) {
        let [entname, fname] = fieldName.split(".");
        let ent = this.scope.getEntityByName(entname);
        if (ent == null)
          throw new ECSError(`no entity named "${entname}" in this scope`, action);
        component = this.em.singleComponentWithFieldName([ent.etype], fname, action);
        fieldName = fname;
        entities = [ent];
        entityLookup = true;
      } else if (fieldName.indexOf(":") > 0) {
        let [cname, fname] = fieldName.split(":");
        component = this.em.getComponentByName(cname);
        if (component == null)
          throw new ECSError(`no component named "${cname}"`, action);
        entities = this.scope.state.working.entities;
        fieldName = fname;
        baseLookup = true;
      } else {
        component = this.em.singleComponentWithFieldName(qr.atypes, fieldName, action);
        entities = this.scope.state.working.entities;
      }
      let field = component.fields.find((f) => f.name == fieldName);
      if (field == null)
        throw new ECSError(`no field named "${fieldName}" in component`, action);
      let ident = this.dialect.fieldsymbol(component, field, bitofs);
      let constValues = new Set();
      let isConst = false;
      for (let e of entities) {
        let constVal = e.consts[mksymbol(component, fieldName)];
        if (constVal !== void 0)
          isConst = true;
        constValues.add(constVal);
      }
      if (isConst && canWrite)
        throw new ECSError(`can't write to constant field ${fieldName}`, action);
      if (constValues.size == 1) {
        let value = constValues.values().next().value;
        if (typeof value === "number") {
          return `#${value >> bitofs & 255}`;
        }
      }
      let range = this.scope.getFieldRange(component, field.name);
      if (!range)
        throw new ECSError(`couldn't find field for ${component.name}:${fieldName}, maybe no entities?`);
      if (baseLookup) {
        return this.dialect.absolute(ident);
      } else if (entities.length == 1) {
        let eidofs = entities[0].id - range.elo;
        return this.dialect.absolute(ident, eidofs);
      } else {
        let ir;
        let int;
        let eidofs;
        let xreg = this.scope.state.xreg;
        let yreg = this.scope.state.yreg;
        if (xreg && (int = (_a = xreg.eset) == null ? void 0 : _a.intersection(qr))) {
          ir = xreg.eset;
          eidofs = xreg.elo - range.elo;
        } else if (yreg && (int = (_b = yreg.eset) == null ? void 0 : _b.intersection(qr))) {
          ir = yreg.eset;
          eidofs = yreg.elo - range.elo;
        } else {
          ir = null;
          eidofs = 0;
        }
        if (!ir) {
          throw new ECSError(`no intersection for index register`, action);
        }
        if (ir.entities.length == 0)
          throw new ECSError(`no common entities for index register`, action);
        if (!ir.isContiguous())
          throw new ECSError(`entities in query are not contiguous`, action);
        if (ir == ((_c = this.scope.state.xreg) == null ? void 0 : _c.eset))
          return this.dialect.indexed_x(ident, eidofs);
        if (ir == ((_d = this.scope.state.yreg) == null ? void 0 : _d.eset))
          return this.dialect.indexed_y(ident, eidofs);
        throw new ECSError(`cannot find "${component.name}:${field.name}" in state`, action);
      }
    }
    getJoinField(action, atypes, jtypes) {
      let refs = Array.from(this.scope.iterateArchetypeFields(atypes, (c, f) => f.dtype == "ref"));
      if (refs.length == 0)
        throw new ECSError(`cannot find join fields`, action);
      if (refs.length > 1)
        throw new ECSError(`cannot join multiple fields (${refs.map((r) => r.f.name).join(" ")})`, action);
      return refs[0];
    }
    isSubroutineSized(code) {
      if (code.length > 2e4)
        return false;
      if (code.split("\n ").length >= 4)
        return true;
      return false;
    }
    exprToCode(expr) {
      if (isQueryExpr(expr)) {
        return this.queryExprToCode(expr);
      }
      if (isBlockStmt(expr)) {
        return this.blockStmtToCode(expr);
      }
      if (isInlineCode(expr)) {
        return this.evalInlineCode(expr.code);
      }
      throw new ECSError(`cannot convert expression to code`, expr);
    }
    evalInlineCode(code) {
      let props = this.scope.state.props || {};
      code = this.replaceLabels(code);
      code = this.replaceTags(code, this.action, props);
      return code;
    }
    blockStmtToCode(expr) {
      return expr.stmts.map((node) => this.exprToCode(node)).join("\n");
    }
    queryExprToCode(qexpr) {
      let q = this.startQuery(qexpr);
      const allowEmpty = ["if", "foreach", "join"];
      if (q.working.entities.length == 0 && allowEmpty.includes(qexpr.select)) {
        this.endQuery(q);
        return "";
      } else {
        this.scope.state.working = q.working;
        this.scope.state.props = q.props;
        q.code = this.evalInlineCode(q.code);
        let body = this.blockStmtToCode(qexpr);
        this.endQuery(q);
        body = q.code.replace("%%CODE%%", body);
        return body;
      }
    }
    queryWorkingSet(qexpr) {
      const scope = this.scope;
      const instance = this.instance;
      let select = qexpr.select;
      let q = qexpr.query;
      let qr = new EntitySet(scope, q);
      if (!(qexpr.all || q.entities)) {
        let ir = qr.intersection(scope.state.working);
        if (ir.entities.length || select == "if") {
          qr = ir;
        }
      }
      if (instance.params.refEntity && instance.params.refField) {
        let rf = instance.params.refField;
        if (rf.f.dtype == "ref") {
          let rq = rf.f.query;
          qr = qr.intersection(new EntitySet(scope, rq));
        }
      } else if (instance.params.query) {
        qr = qr.intersection(new EntitySet(scope, instance.params.query));
      }
      return qr;
    }
    updateIndexRegisters(qr, jr, select) {
      const action = this.action;
      const scope = this.scope;
      const instance = this.instance;
      const state = this.scope.state;
      if (qr.entities.length > 1) {
        switch (select) {
          case "once":
            break;
          case "foreach":
          case "unroll":
            if (state.xreg && state.yreg)
              throw new ECSError("no more index registers", action);
            if (state.xreg)
              state.yreg = new IndexRegister(scope, qr);
            else
              state.xreg = new IndexRegister(scope, qr);
            break;
          case "join":
            if (state.xreg || state.yreg)
              throw new ECSError("no free index registers for join", action);
            if (jr)
              state.xreg = new IndexRegister(scope, jr);
            state.yreg = new IndexRegister(scope, qr);
            break;
          case "if":
          case "with":
            if (state.xreg && state.xreg.eset) {
              state.xreg = state.xreg.narrow(qr, action);
            } else if (select == "with") {
              if (instance.params.refEntity && instance.params.refField) {
                if (state.xreg)
                  state.xreg.eset = qr;
                else
                  state.xreg = new IndexRegister(scope, qr);
              }
            }
            break;
        }
      }
    }
    getCodeAndProps(qexpr, qr, jr, oldState) {
      const entities = qr.entities;
      const select = qexpr.select;
      let code = "%%CODE%%";
      let props = {};
      if (select == "join" && jr) {
        if (qr.entities.length) {
          let joinfield = this.getJoinField(this.action, qr.atypes, jr.atypes);
          code = this.wrapCodeInLoop(code, qexpr, qr.entities, joinfield);
          props["%joinfield"] = this.dialect.fieldsymbol(joinfield.c, joinfield.f, 0);
        }
      }
      let fullEntityCount = qr.entities.length;
      if (select == "with") {
        if (this.instance.params.refEntity && this.instance.params.refField) {
          let re = this.instance.params.refEntity;
          let rf = this.instance.params.refField;
          code = this.wrapCodeInRefLookup(code);
          let range = this.scope.getFieldRange(rf.c, rf.f.name);
          let eidofs = re.id - range.elo;
          props["%reffield"] = `${this.dialect.fieldsymbol(rf.c, rf.f, 0)}+${eidofs}`;
        } else {
          code = this.wrapCodeInFilter(code, qr, oldState, props);
        }
      }
      if (select == "if") {
        code = this.wrapCodeInFilter(code, qr, oldState, props);
      }
      if (select == "foreach" && entities.length > 1) {
        code = this.wrapCodeInLoop(code, qexpr, qr.entities);
      }
      if (select == "unroll" && entities.length > 1) {
        throw new ECSError("unroll is not yet implemented");
      }
      if (entities.length) {
        props["%elo"] = entities[0].id.toString();
        props["%ehi"] = entities[entities.length - 1].id.toString();
      }
      props["%ecount"] = entities.length.toString();
      props["%efullcount"] = fullEntityCount.toString();
      return { code, props };
    }
    startQuery(qexpr) {
      const scope = this.scope;
      const action = this.action;
      const select = qexpr.select;
      const oldState = this.scope.state;
      this.scope.state = Object.assign(new ActionCPUState(), oldState);
      const qr = this.queryWorkingSet(qexpr);
      const jr = qexpr.join && qr.entities.length ? new EntitySet(scope, qexpr.join) : null;
      this.updateIndexRegisters(qr, jr, select);
      const { code, props } = this.getCodeAndProps(qexpr, qr, jr, oldState);
      let working = jr ? qr.union(jr) : qr;
      return { working, oldState, props, code };
    }
    endQuery(q) {
      this.scope.state = q.oldState;
    }
    wrapCodeInLoop(code, qexpr, ents, joinfield) {
      let dir = qexpr.direction;
      let s = dir == "desc" ? this.dialect.ASM_ITERATE_EACH_DESC : this.dialect.ASM_ITERATE_EACH_ASC;
      if (joinfield)
        s = dir == "desc" ? this.dialect.ASM_ITERATE_JOIN_DESC : this.dialect.ASM_ITERATE_JOIN_ASC;
      s = s.replace("{{%code}}", code);
      return s;
    }
    wrapCodeInFilter(code, qr, oldState, props) {
      var _a, _b;
      const ents = qr.entities;
      const ents2 = (_b = (_a = oldState.xreg) == null ? void 0 : _a.eset) == null ? void 0 : _b.entities;
      if (ents && ents.length && ents2) {
        let lo = ents[0].id;
        let hi = ents[ents.length - 1].id;
        let lo2 = ents2[0].id;
        let hi2 = ents2[ents2.length - 1].id;
        if (lo != lo2) {
          code = this.dialect.ASM_FILTER_RANGE_LO_X.replace("{{%code}}", code);
          props["%xofs"] = lo - lo2;
        }
        if (hi != hi2) {
          code = this.dialect.ASM_FILTER_RANGE_HI_X.replace("{{%code}}", code);
        }
      }
      return code;
    }
    wrapCodeInRefLookup(code) {
      code = this.dialect.ASM_LOOKUP_REF_X.replace("{{%code}}", code);
      return code;
    }
  };
  var EventCodeStats = class {
    constructor(inst, action, eventcode) {
      this.inst = inst;
      this.action = action;
      this.eventcode = eventcode;
      this.labels = [];
      this.count = 0;
    }
  };
  var EntityScope = class {
    constructor(em, dialect, name, parent) {
      this.em = em;
      this.dialect = dialect;
      this.name = name;
      this.parent = parent;
      this.childScopes = [];
      this.instances = [];
      this.entities = [];
      this.fieldtypes = {};
      this.sysstats = new Map();
      this.bss = new UninitDataSegment();
      this.rodata = new ConstDataSegment();
      this.code = new CodeSegment();
      this.componentsInScope = new Set();
      this.resources = new Set();
      this.isDemo = false;
      this.filePath = "";
      this.inCritical = 0;
      parent == null ? void 0 : parent.childScopes.push(this);
      this.state = new ActionCPUState();
      this.state.working = new EntitySet(this, void 0, this.entities);
    }
    newEntity(etype, name) {
      if (name && this.getEntityByName(name))
        throw new ECSError(`already an entity named "${name}"`);
      let id = this.entities.length;
      etype = this.em.addArchetype(etype);
      let entity = { id, etype, consts: {}, inits: {} };
      for (let c of etype.components) {
        this.componentsInScope.add(c.name);
      }
      entity.name = name;
      this.entities.push(entity);
      return entity;
    }
    newSystemInstance(inst) {
      if (!inst)
        throw new Error();
      inst.id = this.instances.length + 1;
      this.instances.push(inst);
      this.em.registerSystemEvents(inst.system);
      return inst;
    }
    newSystemInstanceWithDefaults(system) {
      return this.newSystemInstance({ system, params: {}, id: 0 });
    }
    getSystemInstanceNamed(name) {
      return this.instances.find((sys) => sys.system.name == name);
    }
    getEntityByName(name) {
      return this.entities.find((e) => e.name == name);
    }
    *iterateEntityFields(entities) {
      for (let i = 0; i < entities.length; i++) {
        let e = entities[i];
        for (let c of e.etype.components) {
          for (let f of c.fields) {
            yield { i, e, c, f, v: e.consts[mksymbol(c, f.name)] };
          }
        }
      }
    }
    *iterateArchetypeFields(arch, filter) {
      for (let i = 0; i < arch.length; i++) {
        let a = arch[i];
        for (let c of a.components) {
          for (let f of c.fields) {
            if (!filter || filter(c, f))
              yield { i, c, f };
          }
        }
      }
    }
    *iterateChildScopes() {
      for (let scope of this.childScopes) {
        yield scope;
      }
    }
    entitiesMatching(atypes) {
      let result = [];
      for (let e of this.entities) {
        for (let a of atypes) {
          if (e.etype === a) {
            result.push(e);
            break;
          }
        }
      }
      return result;
    }
    hasComponent(ctype) {
      return this.componentsInScope.has(ctype.name);
    }
    buildSegments() {
      let iter = this.iterateEntityFields(this.entities);
      for (var o = iter.next(); o.value; o = iter.next()) {
        let { i, e, c, f, v } = o.value;
        let cfname = mksymbol(c, f.name);
        let ftype = this.fieldtypes[cfname];
        let isConst = ftype == "const";
        let segment = isConst ? this.rodata : this.bss;
        if (v === void 0 && isConst)
          throw new ECSError(`no value for const field ${cfname}`, e);
        let array = segment.fieldranges[cfname];
        if (!array) {
          array = segment.fieldranges[cfname] = { component: c, field: f, elo: i, ehi: i };
        } else {
          array.ehi = i;
          if (array.ehi - array.elo + 1 >= 256)
            throw new ECSError(`too many entities have field ${cfname}, limit is 256`);
        }
        if (!isConst) {
          if (f.dtype == "int" && f.defvalue !== void 0) {
            let ecfname = mkscopesymbol(this, c, f.name);
            if (e.inits[ecfname] == null) {
              this.setInitValue(e, c, f, f.defvalue);
            }
          }
        }
      }
    }
    allocateSegment(segment, alloc, type) {
      let fields = Object.values(segment.fieldranges);
      for (let f of fields) {
        if (this.fieldtypes[mksymbol(f.component, f.field.name)] == type) {
          let rangelen = f.ehi - f.elo + 1;
          let bits = getPackedFieldSize(f.field);
          if (bits == 0)
            bits = 16;
          let bytesperelem = Math.ceil(bits / 8);
          let access = [];
          for (let i = 0; i < bits; i += 8) {
            let symbol = this.dialect.fieldsymbol(f.component, f.field, i);
            access.push({ symbol, bit: i, width: 8 });
            if (alloc) {
              segment.allocateBytes(symbol, rangelen);
            }
          }
          f.access = access;
        }
      }
    }
    allocateROData(segment) {
      let iter = this.iterateEntityFields(this.entities);
      for (var o = iter.next(); o.value; o = iter.next()) {
        let { i, e, c, f, v } = o.value;
        let cfname = mksymbol(c, f.name);
        if (this.fieldtypes[cfname] == "const") {
          let range = segment.fieldranges[cfname];
          let entcount = range ? range.ehi - range.elo + 1 : 0;
          if (v == null && f.dtype == "int")
            v = 0;
          if (v == null && f.dtype == "ref")
            v = 0;
          if (v == null && f.dtype == "array")
            throw new ECSError(`no default value for array ${cfname}`, e);
          if (v instanceof Uint8Array && f.dtype == "array") {
            let ptrlosym = this.dialect.fieldsymbol(c, f, 0);
            let ptrhisym = this.dialect.fieldsymbol(c, f, 8);
            let loofs = segment.allocateBytes(ptrlosym, entcount);
            let hiofs = segment.allocateBytes(ptrhisym, entcount);
            let datasym = this.dialect.datasymbol(c, f, e.id, 0);
            segment.allocateInitData(datasym, v);
            if (f.baseoffset)
              datasym = `(${datasym}+${f.baseoffset})`;
            segment.initdata[loofs + e.id - range.elo] = { symbol: datasym, bitofs: 0 };
            segment.initdata[hiofs + e.id - range.elo] = { symbol: datasym, bitofs: 8 };
          } else if (typeof v === "number") {
            {
              if (!range.access)
                throw new ECSError(`no access for field ${cfname}`);
              for (let a of range.access) {
                segment.allocateBytes(a.symbol, entcount);
                let ofs = segment.getByteOffset(range, a, e.id);
                if (e.id < range.elo)
                  throw new ECSError("entity out of range " + c.name + " " + f.name, e);
                if (segment.initdata[ofs] !== void 0)
                  throw new ECSError("initdata already set " + ofs), e;
                segment.initdata[ofs] = v >> a.bit & 255;
              }
            }
          } else if (v == null && f.dtype == "array" && f.index) {
            let datasym = this.dialect.datasymbol(c, f, e.id, 0);
            let databytes = getFieldLength(f.index);
            let offset = this.bss.allocateBytes(datasym, databytes);
            let ptrlosym = this.dialect.fieldsymbol(c, f, 0);
            let ptrhisym = this.dialect.fieldsymbol(c, f, 8);
            let loofs = segment.allocateBytes(ptrlosym, entcount);
            let hiofs = segment.allocateBytes(ptrhisym, entcount);
            if (f.baseoffset)
              datasym = `(${datasym}+${f.baseoffset})`;
            segment.initdata[loofs + e.id - range.elo] = { symbol: datasym, bitofs: 0 };
            segment.initdata[hiofs + e.id - range.elo] = { symbol: datasym, bitofs: 8 };
          } else {
            throw new ECSError(`unhandled constant ${e.id}:${cfname} -- ${typeof v}`);
          }
        }
      }
    }
    allocateInitData(segment) {
      if (segment.size == 0)
        return "";
      let initbytes = new Uint8Array(segment.size);
      let iter = this.iterateEntityFields(this.entities);
      for (var o = iter.next(); o.value; o = iter.next()) {
        let { i, e, c, f, v } = o.value;
        let scfname = mkscopesymbol(this, c, f.name);
        let initvalue = e.inits[scfname];
        if (initvalue !== void 0) {
          let range = segment.getFieldRange(c, f.name);
          if (!range)
            throw new ECSError(`no init range for ${scfname}`, e);
          if (!range.access)
            throw new ECSError(`no init range access for ${scfname}`, e);
          if (typeof initvalue === "number") {
            for (let a of range.access) {
              let offset = segment.getByteOffset(range, a, e.id);
              initbytes[offset] = initvalue >> a.bit & (1 << a.width) - 1;
            }
          } else if (initvalue instanceof Uint8Array) {
            let datasym = this.dialect.datasymbol(c, f, e.id, 0);
            let ofs = this.bss.symbols[datasym];
            initbytes.set(initvalue, ofs);
          } else {
            throw new ECSError(`cannot initialize ${scfname} = ${initvalue}`);
          }
        }
      }
      let bufsym = this.name + "__INITDATA";
      let bufofs = this.rodata.allocateInitData(bufsym, initbytes);
      let code = this.dialect.INIT_FROM_ARRAY;
      code = code.replace("{{%nbytes}}", initbytes.length.toString());
      code = code.replace("{{%src}}", bufsym);
      code = code.replace("{{%dest}}", segment.getOriginSymbol());
      return code;
    }
    getFieldRange(c, fn) {
      return this.bss.getFieldRange(c, fn) || this.rodata.getFieldRange(c, fn);
    }
    setConstValue(e, component, field, value) {
      this.setConstInitValue(e, component, field, value, "const");
    }
    setInitValue(e, component, field, value) {
      this.setConstInitValue(e, component, field, value, "init");
    }
    setConstInitValue(e, component, field, value, type) {
      this.checkFieldValue(field, value);
      let fieldName = field.name;
      let cfname = mksymbol(component, fieldName);
      let ecfname = mkscopesymbol(this, component, fieldName);
      if (e.consts[cfname] !== void 0)
        throw new ECSError(`"${fieldName}" is already defined as a constant`, e);
      if (e.inits[ecfname] !== void 0)
        throw new ECSError(`"${fieldName}" is already defined as a variable`, e);
      if (type == "const")
        e.consts[cfname] = value;
      if (type == "init")
        e.inits[ecfname] = value;
      this.fieldtypes[cfname] = type;
    }
    isConstOrInit(component, fieldName) {
      return this.fieldtypes[mksymbol(component, fieldName)];
    }
    getConstValue(entity, fieldName) {
      let component = this.em.singleComponentWithFieldName([entity.etype], fieldName, entity);
      let cfname = mksymbol(component, fieldName);
      return entity.consts[cfname];
    }
    checkFieldValue(field, value) {
      if (field.dtype == "array") {
        if (!(value instanceof Uint8Array))
          throw new ECSError(`This "${field.name}" value should be an array.`);
      } else if (typeof value !== "number") {
        throw new ECSError(`This "${field.name}" ${field.dtype} value should be an number.`);
      } else {
        if (field.dtype == "int") {
          if (value < field.lo || value > field.hi)
            throw new ECSError(`This "${field.name}" value is out of range, should be between ${field.lo} and ${field.hi}.`);
        } else if (field.dtype == "ref") {
          let eset = new EntitySet(this, field.query);
          if (value < 0 || value >= eset.entities.length)
            throw new ECSError(`This "${field.name}" value is out of range for this ref type.`);
        }
      }
    }
    generateCodeForEvent(event, args, codelabel) {
      let systems = this.em.event2systems[event];
      if (!systems || systems.length == 0) {
        console.log(`warning: no system responds to "${event}"`);
        return "";
      }
      this.eventSeq++;
      let code = "";
      if (codelabel) {
        code += this.dialect.label(codelabel) + "\n";
      }
      if (event == "start") {
        code += this.allocateInitData(this.bss);
      }
      let eventCount = 0;
      let instances = this.instances.filter((inst) => systems.includes(inst.system));
      for (let inst of instances) {
        let sys = inst.system;
        for (let action of sys.actions) {
          if (action.event == event) {
            eventCount++;
            let codeeval = new ActionEval(this, inst, action, args || []);
            codeeval.begin();
            if (action.critical)
              this.inCritical++;
            let eventcode = codeeval.codeToString();
            if (action.critical)
              this.inCritical--;
            if (!this.inCritical && codeeval.isSubroutineSized(eventcode)) {
              let normcode = this.normalizeCode(eventcode, action);
              let estats = this.eventCodeStats[normcode];
              if (!estats) {
                estats = this.eventCodeStats[normcode] = new EventCodeStats(inst, action, eventcode);
              }
              estats.labels.push(codeeval.label);
              estats.count++;
              if (action.critical)
                estats.count++;
            }
            let s = "";
            s += this.dialect.comment(`start action ${codeeval.label}`);
            s += eventcode;
            s += this.dialect.comment(`end action ${codeeval.label}`);
            code += s;
            codeeval.end();
          }
        }
      }
      if (eventCount == 0) {
        console.log(`warning: event ${event} not handled`);
      }
      return code;
    }
    normalizeCode(code, action) {
      code = code.replace(/\b(\w+__\w+__)(\d+)__(\w+)\b/g, (z, a, b, c) => a + c);
      return code;
    }
    getSystemStats(inst) {
      let stats = this.sysstats.get(inst);
      if (!stats) {
        stats = new SystemStats();
        this.sysstats.set(inst, stats);
      }
      return stats;
    }
    updateTempLiveness(inst) {
      let stats = this.getSystemStats(inst);
      let n = this.eventSeq;
      if (stats.tempstartseq && stats.tempendseq) {
        stats.tempstartseq = Math.min(stats.tempstartseq, n);
        stats.tempendseq = Math.max(stats.tempendseq, n);
      } else {
        stats.tempstartseq = stats.tempendseq = n;
      }
    }
    includeResource(symbol) {
      this.resources.add(symbol);
      return symbol;
    }
    allocateTempVars() {
      let pack = new Packer();
      let maxTempBytes = 128 - this.bss.size;
      let bssbin = new Bin({ left: 0, top: 0, bottom: this.eventSeq + 1, right: maxTempBytes });
      pack.bins.push(bssbin);
      for (let instance of this.instances) {
        let stats = this.getSystemStats(instance);
        if (instance.system.tempbytes && stats.tempstartseq && stats.tempendseq) {
          let v = {
            inst: instance,
            top: stats.tempstartseq,
            bottom: stats.tempendseq + 1,
            width: instance.system.tempbytes,
            height: stats.tempendseq - stats.tempstartseq + 1,
            label: instance.system.name
          };
          pack.boxes.push(v);
        }
      }
      if (!pack.pack())
        console.log("cannot pack temporary local vars");
      if (bssbin.extents.right > 0) {
        let tempofs = this.bss.allocateBytes("TEMP", bssbin.extents.right);
        for (let b of pack.boxes) {
          let inst = b.inst;
          if (b.box)
            this.bss.declareSymbol(this.dialect.tempLabel(inst), tempofs + b.box.left);
        }
      }
      console.log(pack.toSVGUrl());
    }
    analyzeEntities() {
      this.buildSegments();
      this.allocateSegment(this.bss, true, "init");
      this.allocateSegment(this.bss, true, void 0);
      this.allocateSegment(this.rodata, false, "const");
      this.allocateROData(this.rodata);
    }
    isMainScope() {
      return this.parent == null;
    }
    generateCode() {
      this.eventSeq = 0;
      this.eventCodeStats = {};
      let start;
      let initsys = this.em.getSystemByName("Init");
      if (this.isMainScope() && initsys) {
        this.newSystemInstanceWithDefaults(initsys);
        start = this.generateCodeForEvent("main_init");
      } else {
        start = this.generateCodeForEvent("start");
      }
      start = this.replaceSubroutines(start);
      this.code.addCodeFragment(start);
      for (let sub of Array.from(this.resources.values())) {
        if (!this.getSystemInstanceNamed(sub)) {
          let sys = this.em.getSystemByName(sub);
          if (!sys)
            throw new ECSError(`cannot find resource named "${sub}"`);
          this.newSystemInstanceWithDefaults(sys);
        }
        let code = this.generateCodeForEvent(sub, [], sub);
        this.code.addCodeFragment(code);
      }
    }
    replaceSubroutines(code) {
      let allsubs = [];
      for (let stats of Object.values(this.eventCodeStats)) {
        if (stats.count > 1) {
          if (allsubs.length == 0) {
            allsubs = [
              this.dialect.segment("rodata"),
              this.dialect.alignSegmentStart()
            ];
          } else if (stats.action.fitbytes) {
            allsubs.push(this.dialect.alignIfLessThan(stats.action.fitbytes));
          }
          let subcall = this.dialect.call(stats.labels[0]);
          for (let label of stats.labels) {
            let startdelim = this.dialect.comment(`start action ${label}`).trim();
            let enddelim = this.dialect.comment(`end action ${label}`).trim();
            let istart = code.indexOf(startdelim);
            let iend = code.indexOf(enddelim, istart);
            if (istart >= 0 && iend > istart) {
              code = code.substring(0, istart) + subcall + code.substring(iend + enddelim.length);
            }
          }
          let substart = stats.labels[0];
          let sublines = [
            this.dialect.segment("rodata"),
            this.dialect.label(substart),
            stats.eventcode,
            this.dialect.return()
          ];
          if (stats.action.critical) {
            sublines.push(this.dialect.warningIfPageCrossed(substart));
          }
          if (stats.action.fitbytes) {
            sublines.push(this.dialect.warningIfMoreThan(stats.action.fitbytes, substart));
          }
          allsubs = allsubs.concat(sublines);
        }
      }
      code += allsubs.join("\n");
      return code;
    }
    showStats() {
      for (let inst of this.instances) {
        console.log(inst.system.name, this.getSystemStats(inst));
      }
    }
    dumpCodeTo(file) {
      let shouldExport = this.instances.length == 0;
      let dialect = this.dialect;
      file.line(dialect.startScope(this.name));
      file.line(dialect.segment("bss"));
      this.bss.dump(file, dialect, shouldExport);
      file.line(dialect.segment("code"));
      this.rodata.dump(file, dialect, shouldExport);
      file.line(dialect.label("__Start"));
      this.code.dump(file);
      for (let subscope of this.childScopes) {
        subscope.dump(file);
      }
      file.line(dialect.endScope(this.name));
    }
    dump(file) {
      this.analyzeEntities();
      this.generateCode();
      this.allocateTempVars();
      this.dumpCodeTo(file);
    }
  };
  var EntityManager = class {
    constructor(dialect) {
      this.dialect = dialect;
      this.archetypes = {};
      this.components = {};
      this.systems = {};
      this.topScopes = {};
      this.event2systems = {};
      this.name2cfpairs = {};
      this.mainPath = "";
      this.imported = {};
      this.seq = 1;
    }
    newScope(name, parent) {
      let existing = this.topScopes[name];
      if (existing && !existing.isDemo)
        throw new ECSError(`scope ${name} already defined`, existing);
      let scope = new EntityScope(this, this.dialect, name, parent);
      if (!parent)
        this.topScopes[name] = scope;
      return scope;
    }
    deferComponent(name) {
      this.components[name] = { name, fields: [] };
    }
    defineComponent(ctype) {
      let existing = this.components[ctype.name];
      if (existing && existing.fields.length > 0)
        throw new ECSError(`component ${ctype.name} already defined`, existing);
      if (existing) {
        existing.fields = ctype.fields;
        ctype = existing;
      }
      for (let field of ctype.fields) {
        let list = this.name2cfpairs[field.name];
        if (!list)
          list = this.name2cfpairs[field.name] = [];
        list.push({ c: ctype, f: field });
      }
      this.components[ctype.name] = ctype;
      return ctype;
    }
    defineSystem(system) {
      let existing = this.systems[system.name];
      if (existing)
        throw new ECSError(`system ${system.name} already defined`, existing);
      return this.systems[system.name] = system;
    }
    registerSystemEvents(system) {
      for (let a of system.actions) {
        let event = a.event;
        let list = this.event2systems[event];
        if (list == null)
          list = this.event2systems[event] = [];
        if (!list.includes(system))
          list.push(system);
      }
    }
    addArchetype(atype) {
      let key = atype.components.map((c) => c.name).join(",");
      if (this.archetypes[key])
        return this.archetypes[key];
      else
        return this.archetypes[key] = atype;
    }
    componentsMatching(q, etype) {
      var _a;
      let list = [];
      for (let c of etype.components) {
        if ((_a = q.exclude) == null ? void 0 : _a.includes(c)) {
          return [];
        }
        if (q.include.length == 0 || q.include.includes(c)) {
          list.push(c);
        }
      }
      return list.length == q.include.length ? list : [];
    }
    archetypesMatching(q) {
      let result = new Set();
      for (let etype of Object.values(this.archetypes)) {
        let cmatch = this.componentsMatching(q, etype);
        if (cmatch.length > 0) {
          result.add(etype);
        }
      }
      return Array.from(result.values());
    }
    componentsWithFieldName(atypes, fieldName) {
      let comps = new Set();
      for (let at of atypes) {
        for (let c of at.components) {
          for (let f of c.fields) {
            if (f.name == fieldName)
              comps.add(c);
          }
        }
      }
      return Array.from(comps);
    }
    getComponentByName(name) {
      return this.components[name];
    }
    getSystemByName(name) {
      return this.systems[name];
    }
    singleComponentWithFieldName(atypes, fieldName, where) {
      let cfpairs = this.name2cfpairs[fieldName];
      if (!cfpairs)
        throw new ECSError(`cannot find field named "${fieldName}"`, where);
      let filtered = cfpairs.filter((cf) => atypes.find((a) => a.components.includes(cf.c)));
      if (filtered.length == 0) {
        throw new ECSError(`cannot find component with field "${fieldName}" in this context`, where);
      }
      if (filtered.length > 1) {
        throw new ECSError(`ambiguous field name "${fieldName}"`, where);
      }
      return filtered[0].c;
    }
    toJSON() {
      return JSON.stringify({
        components: this.components,
        systems: this.systems
      });
    }
    exportToFile(file) {
      for (let event of Object.keys(this.event2systems)) {
        file.line(this.dialect.equate(`EVENT__${event}`, "1"));
      }
      for (let scope of Object.values(this.topScopes)) {
        if (!scope.isDemo || scope.filePath == this.mainPath) {
          scope.dump(file);
        }
      }
    }
    *iterateScopes() {
      for (let scope of Object.values(this.topScopes)) {
        yield scope;
        scope.iterateChildScopes();
      }
    }
    getDebugTree() {
      let scopes = this.topScopes;
      let components = this.components;
      let fields = this.name2cfpairs;
      let systems = this.systems;
      let events = this.event2systems;
      let entities = {};
      for (let scope of Array.from(this.iterateScopes())) {
        for (let e of scope.entities)
          entities[e.name || "#" + e.id.toString()] = e;
      }
      return { scopes, components, fields, systems, events, entities };
    }
    evalExpr(expr, scope) {
      if (isLiteral2(expr))
        return expr;
      if (isBinOp2(expr) || isUnOp2(expr)) {
        var fn = this["evalop__" + expr.op];
        if (!fn)
          throw new ECSError(`no eval function for "${expr.op}"`);
      }
      if (isBinOp2(expr)) {
        expr.left = this.evalExpr(expr.left, scope);
        expr.right = this.evalExpr(expr.right, scope);
        let e = fn(expr.left, expr.right);
        return e || expr;
      }
      if (isUnOp2(expr)) {
        expr.expr = this.evalExpr(expr.expr, scope);
        let e = fn(expr.expr);
        return e || expr;
      }
      return expr;
    }
    evalop__neg(arg) {
      if (isLiteralInt(arg)) {
        let valtype = {
          dtype: "int",
          lo: -arg.valtype.hi,
          hi: arg.valtype.hi
        };
        return { valtype, value: -arg.value };
      }
    }
    evalop__add(left, right) {
      if (isLiteralInt(left) && isLiteralInt(right)) {
        let valtype = {
          dtype: "int",
          lo: left.valtype.lo + right.valtype.lo,
          hi: left.valtype.hi + right.valtype.hi
        };
        return { valtype, value: left.value + right.value };
      }
    }
    evalop__sub(left, right) {
      if (isLiteralInt(left) && isLiteralInt(right)) {
        let valtype = {
          dtype: "int",
          lo: left.valtype.lo - right.valtype.hi,
          hi: left.valtype.hi - right.valtype.lo
        };
        return { valtype, value: left.value - right.value };
      }
    }
  };

  // src/common/ecs/decoder.ts
  var LineDecoder = class {
    constructor(text) {
      this.curline = 0;
      this.lines = text.split("\n").map((s) => s.trim()).filter((s) => !!s).map((s) => s.split(/\s+/));
    }
    decodeBits(s, n, msbfirst) {
      if (s.length != n)
        throw new ECSError(`Expected ${n} characters`);
      let b = 0;
      for (let i = 0; i < n; i++) {
        let bit;
        let ch = s.charAt(i);
        if (ch == "x" || ch == "X" || ch == "1")
          bit = 1;
        else if (ch == "." || ch == "0")
          bit = 0;
        else
          throw new ECSError("need x or . (or 0 or 1)");
        if (bit) {
          if (msbfirst)
            b |= 1 << n - 1 - i;
          else
            b |= 1 << i;
        }
      }
      return b;
    }
    assertTokens(toks, count) {
      if (toks.length != count)
        throw new ECSError(`Expected ${count} tokens on line.`);
    }
    hex(s) {
      let v = parseInt(s, 16);
      if (isNaN(v))
        throw new ECSError(`Invalid hex value: ${s}`);
      return v;
    }
    getErrorLocation($loc) {
      $loc.line += this.curline + 1;
      return $loc;
    }
  };
  var VCSSpriteDecoder = class extends LineDecoder {
    parse() {
      let height = this.lines.length;
      let bitmapdata = new Uint8Array(height);
      let colormapdata = new Uint8Array(height);
      for (let i = 0; i < height; i++) {
        this.curline = height - 1 - i;
        let toks = this.lines[this.curline];
        this.assertTokens(toks, 2);
        bitmapdata[i] = this.decodeBits(toks[0], 8, true);
        colormapdata[i] = this.hex(toks[1]);
      }
      return {
        properties: {
          bitmapdata,
          colormapdata,
          height: height - 1
        }
      };
    }
  };
  var VCSBitmapDecoder = class extends LineDecoder {
    parse() {
      let height = this.lines.length;
      let bitmapdata = new Uint8Array(height);
      for (let i = 0; i < height; i++) {
        this.curline = height - 1 - i;
        let toks = this.lines[this.curline];
        this.assertTokens(toks, 1);
        bitmapdata[i] = this.decodeBits(toks[0], 8, true);
      }
      return {
        properties: {
          bitmapdata,
          height: height - 1
        }
      };
    }
  };
  var VCSPlayfieldDecoder = class extends LineDecoder {
    parse() {
      let height = this.lines.length;
      let pf = new Uint32Array(height);
      for (let i = 0; i < height; i++) {
        this.curline = height - 1 - i;
        let toks = this.lines[this.curline];
        this.assertTokens(toks, 1);
        let pf0 = this.decodeBits(toks[0].substring(0, 4), 4, false) << 4;
        let pf1 = this.decodeBits(toks[0].substring(4, 12), 8, true);
        let pf2 = this.decodeBits(toks[0].substring(12, 20), 8, false);
        pf[i] = pf0 << 0 | pf1 << 8 | pf2 << 16;
      }
      return {
        properties: {
          pf
        }
      };
    }
  };
  var VCSVersatilePlayfieldDecoder = class extends LineDecoder {
    parse() {
      let height = this.lines.length;
      let data = new Uint8Array(height * 2);
      data.fill(63);
      const regs = [13, 14, 15, 8, 9, 10, 63];
      let prev = [0, 0, 0, 0, 0, 0, 0];
      let cur = [0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < height; i++) {
        let dataofs = height * 2 - i * 2;
        this.curline = i;
        let toks = this.lines[this.curline];
        if (toks.length == 2) {
          data[dataofs - 1] = this.hex(toks[0]);
          data[dataofs - 2] = this.hex(toks[1]);
          continue;
        }
        this.assertTokens(toks, 4);
        cur[0] = this.decodeBits(toks[0].substring(0, 4), 4, false) << 4;
        cur[1] = this.decodeBits(toks[0].substring(4, 12), 8, true);
        cur[2] = this.decodeBits(toks[0].substring(12, 20), 8, false);
        if (toks[1] != "..")
          cur[3] = this.hex(toks[1]);
        if (toks[2] != "..")
          cur[4] = this.hex(toks[2]);
        if (toks[3] != "..")
          cur[5] = this.hex(toks[3]);
        let changed = [];
        for (let j = 0; j < cur.length; j++) {
          if (cur[j] != prev[j])
            changed.push(j);
        }
        if (changed.length > 1) {
          console.log(changed, cur, prev);
          throw new ECSError(`More than one register change in line ${i + 1}: [${changed}]`);
        }
        let chgidx = changed.length ? changed[0] : regs.length - 1;
        data[dataofs - 1] = regs[chgidx];
        data[dataofs - 2] = cur[chgidx];
        prev[chgidx] = cur[chgidx];
      }
      return {
        properties: {
          data
        }
      };
    }
  };
  var VCSBitmap48Decoder = class extends LineDecoder {
    parse() {
      let height = this.lines.length;
      let bitmap0 = new Uint8Array(height);
      let bitmap1 = new Uint8Array(height);
      let bitmap2 = new Uint8Array(height);
      let bitmap3 = new Uint8Array(height);
      let bitmap4 = new Uint8Array(height);
      let bitmap5 = new Uint8Array(height);
      for (let i = 0; i < height; i++) {
        this.curline = height - 1 - i;
        let toks = this.lines[this.curline];
        this.assertTokens(toks, 1);
        bitmap0[i] = this.decodeBits(toks[0].slice(0, 8), 8, true);
        bitmap1[i] = this.decodeBits(toks[0].slice(8, 16), 8, true);
        bitmap2[i] = this.decodeBits(toks[0].slice(16, 24), 8, true);
        bitmap3[i] = this.decodeBits(toks[0].slice(24, 32), 8, true);
        bitmap4[i] = this.decodeBits(toks[0].slice(32, 40), 8, true);
        bitmap5[i] = this.decodeBits(toks[0].slice(40, 48), 8, true);
      }
      return {
        properties: {
          bitmap0,
          bitmap1,
          bitmap2,
          bitmap3,
          bitmap4,
          bitmap5,
          height: height - 1
        }
      };
    }
  };
  function newDecoder(name, text) {
    let cons = DECODERS[name];
    if (cons)
      return new cons(text);
  }
  var DECODERS = {
    "vcs_sprite": VCSSpriteDecoder,
    "vcs_bitmap": VCSBitmapDecoder,
    "vcs_playfield": VCSPlayfieldDecoder,
    "vcs_versatile": VCSVersatilePlayfieldDecoder,
    "vcs_bitmap48": VCSBitmap48Decoder
  };

  // src/common/ecs/compiler.ts
  var ECSTokenType;
  (function(ECSTokenType2) {
    ECSTokenType2["Ellipsis"] = "ellipsis";
    ECSTokenType2["Operator"] = "operator";
    ECSTokenType2["Relational"] = "relational";
    ECSTokenType2["QuotedString"] = "quoted-string";
    ECSTokenType2["Integer"] = "integer";
    ECSTokenType2["CodeFragment"] = "code-fragment";
    ECSTokenType2["Placeholder"] = "placeholder";
  })(ECSTokenType || (ECSTokenType = {}));
  var OPERATORS2 = {
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
    "-": { f: "sub", p: 100 }
  };
  function getOperator2(op) {
    return OPERATORS2[op];
  }
  function getPrecedence2(tok) {
    switch (tok.type) {
      case ECSTokenType.Operator:
      case ECSTokenType.Relational:
      case TokenType2.Ident:
        let op = getOperator2(tok.str);
        if (op)
          return op.p;
    }
    return -1;
  }
  var ECSCompiler = class extends Tokenizer {
    constructor(em, isMainFile) {
      super();
      this.em = em;
      this.isMainFile = isMainFile;
      this.currentScope = null;
      this.currentContext = null;
      this.includeDebugInfo = false;
      this.setTokenRules([
        { type: ECSTokenType.Ellipsis, regex: /\.\./ },
        { type: ECSTokenType.QuotedString, regex: /".*?"/ },
        { type: ECSTokenType.CodeFragment, regex: /---.*?---/ },
        { type: ECSTokenType.Integer, regex: /0[xX][A-Fa-f0-9]+/ },
        { type: ECSTokenType.Integer, regex: /\$[A-Fa-f0-9]+/ },
        { type: ECSTokenType.Integer, regex: /[%][01]+/ },
        { type: ECSTokenType.Integer, regex: /\d+/ },
        { type: ECSTokenType.Relational, regex: /[=<>][=<>]?/ },
        { type: ECSTokenType.Operator, regex: /[.#,:(){}\[\]\-\+]/ },
        { type: TokenType2.Ident, regex: /[A-Za-z_][A-Za-z0-9_]*/ },
        { type: TokenType2.Ignore, regex: /\/\/.*?[\n\r]/ },
        { type: TokenType2.Ignore, regex: /\/\*.*?\*\// },
        { type: TokenType2.EOL, regex: /[\n\r]+/ },
        { type: TokenType2.Ignore, regex: /\s+/ }
      ]);
      this.errorOnCatchAll = true;
    }
    annotate(fn) {
      let start = this.peekToken();
      let obj = fn();
      let end = this.lasttoken;
      let $loc = end ? mergeLocs2(start.$loc, end.$loc) : start.$loc;
      if (obj)
        obj.$loc = $loc;
      return obj;
    }
    parseFile(text, path) {
      this.tokenizeFile(text, path);
      while (!this.isEOF()) {
        let top = this.parseTopLevel();
        if (top) {
          let t = top;
          this.annotate(() => t);
        }
      }
      this.runDeferred();
    }
    importFile(path) {
      if (!this.em.imported[path]) {
        let text = this.getImportFile && this.getImportFile(path);
        if (!text)
          this.compileError(`I can't find the import file "${path}".`);
        this.em.imported[path] = true;
        let comp = new ECSCompiler(this.em, false);
        comp.includeDebugInfo = this.includeDebugInfo;
        try {
          comp.parseFile(text, path);
        } catch (e) {
          for (var err of comp.errors)
            this.errors.push(err);
          throw e;
        }
      }
    }
    parseTopLevel() {
      let tok = this.expectTokens(["component", "system", "scope", "resource", "import", "demo", "comment"]);
      if (tok.str == "component") {
        return this.em.defineComponent(this.parseComponentDefinition());
      }
      if (tok.str == "system") {
        return this.em.defineSystem(this.parseSystem());
      }
      if (tok.str == "scope") {
        return this.parseScope();
      }
      if (tok.str == "resource") {
        return this.em.defineSystem(this.parseResource());
      }
      if (tok.str == "import") {
        let tok2 = this.expectTokenTypes([ECSTokenType.QuotedString]);
        let path = tok2.str.substring(1, tok2.str.length - 1);
        return this.importFile(path);
      }
      if (tok.str == "demo") {
        if (this.isMainFile) {
          let scope = this.parseScope();
          scope.isDemo = true;
          this.expectToken("demo");
          return scope;
        } else {
          this.skipDemo();
          return;
        }
      }
      if (tok.str == "comment") {
        this.expectTokenTypes([ECSTokenType.CodeFragment]);
        return;
      }
      this.compileError(`Unexpected top-level keyword: ${tok.str}`);
    }
    skipDemo() {
      var tok;
      while ((tok = this.consumeToken()) && !this.isEOF()) {
        if (tok.str == "end" && this.peekToken().str == "demo") {
          this.consumeToken();
          return;
        }
      }
      throw new ECSError(`Expected "end demo" after a "demo" declaration.`);
    }
    parseComponentDefinition() {
      let name = this.expectIdent().str;
      let fields = [];
      this.em.deferComponent(name);
      while (this.peekToken().str != "end") {
        fields.push(this.parseComponentField());
      }
      this.expectToken("end");
      return { name, fields };
    }
    parseComponentField() {
      let name = this.expectIdent();
      this.expectToken(":", 'I expected either a ":" or "end" here.');
      let type = this.parseDataType();
      return __spreadValues({ name: name.str, $loc: name.$loc }, type);
    }
    parseDataType() {
      if (this.peekToken().type == "integer") {
        let lo = this.parseIntegerConstant();
        this.expectToken("..");
        let hi = this.parseIntegerConstant();
        this.checkLowerLimit(lo, -2147483648, "lower int range");
        this.checkUpperLimit(hi, 2147483647, "upper int range");
        this.checkUpperLimit(hi - lo, 4294967295, "int range");
        this.checkLowerLimit(hi, lo, "int range");
        let defvalue;
        if (this.ifToken("default")) {
          defvalue = this.parseIntegerConstant();
        }
        return { dtype: "int", lo, hi, defvalue };
      }
      if (this.peekToken().str == "[") {
        return { dtype: "ref", query: this.parseQuery() };
      }
      if (this.ifToken("array")) {
        let index = void 0;
        if (this.peekToken().type == ECSTokenType.Integer) {
          index = this.parseDataType();
        }
        this.expectToken("of");
        let elem = this.parseDataType();
        let baseoffset;
        if (this.ifToken("baseoffset")) {
          baseoffset = this.parseIntegerConstant();
          this.checkLowerLimit(baseoffset, -32768, "base offset");
          this.checkUpperLimit(baseoffset, 32767, "base offset");
        }
        return { dtype: "array", index, elem, baseoffset };
      }
      if (this.ifToken("enum")) {
        this.expectToken("[");
        let enumtoks = this.parseList(this.parseEnumIdent, ",");
        this.expectToken("]");
        if (enumtoks.length == 0)
          this.compileError(`must define at least one enum`);
        let lo = 0;
        let hi = enumtoks.length - 1;
        this.checkLowerLimit(hi, 0, "enum count");
        this.checkUpperLimit(hi, 255, "enum count");
        let enums = {};
        for (let i = 0; i <= hi; i++)
          enums[enumtoks[i].str] = i;
        let defvalue;
        if (this.ifToken("default")) {
          defvalue = this.parseIntegerConstant();
        }
        return { dtype: "int", lo, hi, defvalue, enums };
      }
      throw this.compileError(`I expected a data type here.`);
    }
    parseEnumIdent() {
      let tok = this.expectTokenTypes([TokenType2.Ident]);
      return tok;
    }
    parseEnumValue(tok, field) {
      if (!field.enums)
        throw new ECSError(`field is not an enum`);
      let value = field.enums[tok.str];
      if (value == null)
        throw new ECSError(`unknown enum "${tok.str}"`);
      return value;
    }
    parseDataValue(field) {
      var _a, _b;
      let tok = this.peekToken();
      if (tok.type == TokenType2.Ident && field.dtype == "int") {
        return this.parseEnumValue(this.consumeToken(), field);
      }
      if (tok.type == TokenType2.Ident) {
        let entity = (_a = this.currentScope) == null ? void 0 : _a.getEntityByName(tok.str);
        if (!entity)
          this.compileError('no entity named "${tok.str}"');
        else {
          this.consumeToken();
          this.expectToken(".");
          let fieldName = this.expectIdent().str;
          let constValue = (_b = this.currentScope) == null ? void 0 : _b.getConstValue(entity, fieldName);
          if (constValue == null)
            throw new ECSError(`"${fieldName}" is not defined as a constant`, entity);
          else
            return constValue;
        }
      }
      if (tok.str == "[") {
        return new Uint8Array(this.parseDataArray());
      }
      if (tok.str == "#") {
        this.consumeToken();
        let reftype = field.dtype == "ref" ? field : void 0;
        return this.parseEntityForwardRef(reftype);
      }
      return this.parseIntegerConstant();
    }
    parseEntityForwardRef(reftype) {
      let token = this.expectIdent();
      return { reftype, token };
    }
    parseDataArray() {
      this.expectToken("[");
      let arr = this.parseList(this.parseIntegerConstant, ",");
      this.expectToken("]");
      return arr;
    }
    expectInteger() {
      let s = this.consumeToken().str;
      let i;
      if (s.startsWith("$"))
        i = parseInt(s.substring(1), 16);
      else if (s.startsWith("%"))
        i = parseInt(s.substring(1), 2);
      else
        i = parseInt(s);
      if (isNaN(i))
        this.compileError("There should be an integer here.");
      return i;
    }
    parseSystem() {
      let name = this.expectIdent().str;
      let actions = [];
      let system = { name, actions };
      let cmd;
      while ((cmd = this.expectTokens(["on", "locals", "end"]).str) != "end") {
        if (cmd == "on") {
          let action = this.annotate(() => this.parseAction(system));
          actions.push(action);
        } else if (cmd == "locals") {
          system.tempbytes = this.parseIntegerConstant();
        } else {
          this.compileError(`Unexpected system keyword: ${cmd}`);
        }
      }
      return system;
    }
    parseResource() {
      let name = this.expectIdent().str;
      let tempbytes;
      if (this.peekToken().str == "locals") {
        this.consumeToken();
        tempbytes = this.parseIntegerConstant();
      }
      let system = { name, tempbytes, actions: [] };
      let expr = this.annotate(() => this.parseBlockStatement());
      let action = { expr, event: name };
      system.actions.push(action);
      return system;
    }
    parseAction(system) {
      const event = this.expectIdent().str;
      this.expectToken("do");
      let fitbytes = void 0;
      let critical = void 0;
      if (this.ifToken("critical"))
        critical = true;
      if (this.ifToken("fit"))
        fitbytes = this.parseIntegerConstant();
      let expr = this.annotate(() => this.parseBlockStatement());
      let action = { expr, event, fitbytes, critical };
      return action;
    }
    parseQuery() {
      let q = { include: [] };
      let start = this.expectToken("[");
      this.parseList(() => this.parseQueryItem(q), ",");
      this.expectToken("]");
      q.$loc = mergeLocs2(start.$loc, this.lasttoken.$loc);
      return q;
    }
    parseQueryItem(q) {
      let prefix = this.peekToken();
      if (prefix.type != TokenType2.Ident) {
        this.consumeToken();
      }
      if (prefix.type == TokenType2.Ident) {
        let cref = this.parseComponentRef();
        q.include.push(cref);
      } else if (prefix.str == "-") {
        let cref = this.parseComponentRef();
        if (!q.exclude)
          q.exclude = [];
        q.exclude.push(cref);
      } else if (prefix.str == "#") {
        const scope = this.currentScope;
        if (scope == null) {
          throw this.compileError("You can only reference specific entities inside of a scope.");
        }
        let eref = this.parseEntityForwardRef();
        this.deferred.push(() => {
          let refvalue = this.resolveEntityRef(scope, eref);
          if (!q.entities)
            q.entities = [];
          q.entities.push(scope.entities[refvalue]);
        });
      } else {
        this.compileError(`Query components may be preceded only by a '-'.`);
      }
    }
    parseEventName() {
      return this.expectIdent().str;
    }
    parseEventList() {
      return this.parseList(this.parseEventName, ",");
    }
    parseCode() {
      let tok = this.expectTokenTypes([ECSTokenType.CodeFragment]);
      let code = tok.str.substring(3, tok.str.length - 3);
      let lines = code.split("\n");
      if (this.includeDebugInfo)
        this.addDebugInfo(lines, tok.$loc.line);
      code = lines.join("\n");
      return code;
    }
    addDebugInfo(lines, startline) {
      const re = /^\s*(;|\/\/|$)/;
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].match(re))
          lines[i] = this.em.dialect.debug_line(this.path, startline + i) + "\n" + lines[i];
      }
    }
    parseScope() {
      let name = this.expectIdent().str;
      let scope = this.em.newScope(name, this.currentScope || void 0);
      scope.filePath = this.path;
      this.currentScope = scope;
      let cmd;
      while ((cmd = this.expectTokens(["end", "using", "entity", "scope", "comment", "system"]).str) != "end") {
        if (cmd == "using") {
          this.parseScopeUsing();
        }
        if (cmd == "entity") {
          this.annotate(() => this.parseEntity());
        }
        if (cmd == "scope") {
          this.annotate(() => this.parseScope());
        }
        if (cmd == "comment") {
          this.expectTokenTypes([ECSTokenType.CodeFragment]);
        }
        if (cmd == "system") {
          let sys = this.annotate(() => this.parseSystem());
          this.em.defineSystem(sys);
          this.currentScope.newSystemInstanceWithDefaults(sys);
        }
      }
      this.currentScope = scope.parent || null;
      return scope;
    }
    parseScopeUsing() {
      var _a;
      let instlist = this.parseList(this.parseSystemInstanceRef, ",");
      let params = {};
      if (this.peekToken().str == "with") {
        this.consumeToken();
        params = this.parseSystemInstanceParameters();
      }
      for (let inst of instlist) {
        inst.params = params;
        (_a = this.currentScope) == null ? void 0 : _a.newSystemInstance(inst);
      }
    }
    parseEntity() {
      if (!this.currentScope) {
        throw this.internalError();
      }
      const scope = this.currentScope;
      let entname = "";
      if (this.peekToken().type == TokenType2.Ident) {
        entname = this.expectIdent().str;
      }
      let etype = this.parseEntityArchetype();
      let entity = this.currentScope.newEntity(etype, entname);
      let cmd2;
      while ((cmd2 = this.expectTokens(["const", "init", "var", "decode", "end"]).str) != "end") {
        let cmd = cmd2;
        if (cmd == "var")
          cmd = "init";
        if (cmd == "init" || cmd == "const") {
          this.parseInitConst(cmd, scope, entity);
        } else if (cmd == "decode") {
          this.parseDecode(scope, entity);
        }
      }
      return entity;
    }
    parseInitConst(cmd, scope, entity) {
      let name = this.expectIdent().str;
      let { c, f } = this.getEntityField(entity, name);
      let symtype = scope.isConstOrInit(c, name);
      if (symtype && symtype != cmd)
        this.compileError(`I can't mix const and init values for a given field in a scope.`);
      this.expectToken("=");
      let valueOrRef = this.parseDataValue(f);
      if (valueOrRef.token != null) {
        this.deferred.push(() => {
          this.lasttoken = valueOrRef.token;
          let refvalue = this.resolveEntityRef(scope, valueOrRef);
          if (cmd == "const")
            scope.setConstValue(entity, c, f, refvalue);
          if (cmd == "init")
            scope.setInitValue(entity, c, f, refvalue);
        });
      } else {
        if (cmd == "const")
          scope.setConstValue(entity, c, f, valueOrRef);
        if (cmd == "init")
          scope.setInitValue(entity, c, f, valueOrRef);
      }
    }
    parseDecode(scope, entity) {
      let decoderid = this.expectIdent().str;
      let codetok = this.expectTokenTypes([ECSTokenType.CodeFragment]);
      let code = codetok.str;
      code = code.substring(3, code.length - 3);
      let decoder = newDecoder(decoderid, code);
      if (!decoder) {
        throw this.compileError(`I can't find a "${decoderid}" decoder.`);
      }
      let result;
      try {
        result = decoder.parse();
      } catch (e) {
        throw new ECSError(e.message, decoder.getErrorLocation(codetok.$loc));
      }
      for (let entry of Object.entries(result.properties)) {
        let { c, f } = this.getEntityField(entity, entry[0]);
        scope.setConstValue(entity, c, f, entry[1]);
      }
    }
    getEntityField(e, name) {
      if (!this.currentScope) {
        throw this.internalError();
      }
      let comps = this.em.componentsWithFieldName([e.etype], name);
      if (comps.length == 0)
        this.compileError(`I couldn't find a field named "${name}" for this entity.`);
      if (comps.length > 1)
        this.compileError(`I found more than one field named "${name}" for this entity.`);
      let component = comps[0];
      let field = component.fields.find((f) => f.name == name);
      if (!field) {
        throw this.internalError();
      }
      return { c: component, f: field };
    }
    parseEntityArchetype() {
      this.expectToken("[");
      let components = this.parseList(this.parseComponentRef, ",");
      this.expectToken("]");
      return { components };
    }
    parseComponentRef() {
      let name = this.expectIdent().str;
      let cref = this.em.getComponentByName(name);
      if (!cref)
        this.compileError(`I couldn't find a component named "${name}".`);
      return cref;
    }
    findEntityByName(scope, token) {
      let name = token.str;
      let eref = scope.entities.find((e) => e.name == name);
      if (!eref) {
        throw this.compileError(`I couldn't find an entity named "${name}" in this scope.`, token.$loc);
      }
      return eref;
    }
    resolveEntityRef(scope, ref) {
      let id = this.findEntityByName(scope, ref.token).id;
      if (ref.reftype) {
        let atypes = this.em.archetypesMatching(ref.reftype.query);
        let entities = scope.entitiesMatching(atypes);
        if (entities.length == 0)
          throw this.compileError(`This entity doesn't seem to fit the reference type.`, ref.token.$loc);
        id -= entities[0].id;
      }
      return id;
    }
    parseSystemInstanceRef() {
      let name = this.expectIdent().str;
      let system = this.em.getSystemByName(name);
      if (!system)
        throw this.compileError(`I couldn't find a system named "${name}".`, this.lasttoken.$loc);
      let params = {};
      let inst = { system, params, id: 0 };
      return inst;
    }
    parseSystemInstanceParameters() {
      let scope = this.currentScope;
      if (scope == null)
        throw this.internalError();
      if (this.peekToken().str == "[") {
        return { query: this.parseQuery() };
      }
      this.expectToken("#");
      let entname = this.expectIdent();
      this.expectToken(".");
      let fieldname = this.expectIdent();
      let entity = this.findEntityByName(scope, entname);
      let cf = this.getEntityField(entity, fieldname.str);
      return { refEntity: entity, refField: cf };
    }
    exportToFile(src) {
      this.em.exportToFile(src);
    }
    export() {
      let src = new SourceFileExport();
      src.line(this.em.dialect.debug_file(this.path));
      for (let path of Object.keys(this.em.imported))
        src.line(this.em.dialect.debug_file(path));
      this.exportToFile(src);
      return src.toString();
    }
    checkUpperLimit(value, upper, what) {
      if (value > upper)
        this.compileError(`This ${what} is too high; must be ${upper} or less`);
    }
    checkLowerLimit(value, lower, what) {
      if (value < lower)
        this.compileError(`This ${what} is too low; must be ${lower} or more`);
    }
    parseConstant() {
      let expr = this.parseExpr();
      expr = this.em.evalExpr(expr, this.currentScope);
      if (isLiteral2(expr))
        return expr.value;
      throw this.compileError("This expression is not a constant.");
    }
    parseIntegerConstant() {
      let value = this.parseConstant();
      if (typeof value === "number")
        return value;
      throw this.compileError("This expression is not an integer.");
    }
    parseExpr() {
      var startloc = this.peekToken().$loc;
      var expr = this.parseExpr1(this.parsePrimary(), 0);
      var endloc = this.lasttoken.$loc;
      expr.$loc = mergeLocs2(startloc, endloc);
      return expr;
    }
    parseExpr1(left, minPred) {
      let look = this.peekToken();
      while (getPrecedence2(look) >= minPred) {
        let op = this.consumeToken();
        let right = this.parsePrimary();
        look = this.peekToken();
        while (getPrecedence2(look) > getPrecedence2(op)) {
          right = this.parseExpr1(right, getPrecedence2(look));
          look = this.peekToken();
        }
        var opfn = getOperator2(op.str).f;
        if (op.str == "and")
          opfn = "land";
        if (op.str == "or")
          opfn = "lor";
        var valtype = this.exprTypeForOp(opfn, left, right, op);
        left = { valtype, op: opfn, left, right };
      }
      return left;
    }
    parsePrimary() {
      let tok = this.consumeToken();
      switch (tok.type) {
        case ECSTokenType.Integer:
          this.pushbackToken(tok);
          let value = this.expectInteger();
          let valtype = { dtype: "int", lo: value, hi: value };
          return { valtype, value };
        case TokenType2.Ident:
          if (tok.str == "not") {
            let expr = this.parsePrimary();
            let valtype2 = { dtype: "int", lo: 0, hi: 1 };
            return { valtype: valtype2, op: "lnot", expr };
          } else {
            this.pushbackToken(tok);
            return this.parseVarSubscriptOrFunc();
          }
        case ECSTokenType.Operator:
          if (tok.str == "(") {
            let expr = this.parseExpr();
            this.expectToken(")", `There should be another expression or a ")" here.`);
            return expr;
          } else if (tok.str == "-") {
            let expr = this.parsePrimary();
            let valtype2 = expr.valtype;
            if ((valtype2 == null ? void 0 : valtype2.dtype) == "int") {
              let hi = Math.abs(valtype2.hi);
              let negtype = { dtype: "int", lo: -hi, hi };
              return { valtype: negtype, op: "neg", expr };
            }
          } else if (tok.str == "+") {
            return this.parsePrimary();
          }
        default:
          throw this.compileError(`The expression is incomplete.`);
      }
    }
    parseVarSubscriptOrFunc() {
      var tok = this.consumeToken();
      switch (tok.type) {
        case TokenType2.Ident:
          if (this.ifToken(":")) {
            let ftok = this.consumeToken();
            let component = this.em.getComponentByName(tok.str);
            if (!component)
              throw this.compileError(`A component named "${tok.str}" has not been defined.`);
            let field = component.fields.find((f) => f.name == ftok.str);
            if (!field)
              throw this.compileError(`There is no "${ftok.str}" field in the ${tok.str} component.`);
            if (!this.currentScope)
              throw this.compileError(`This operation only works inside of a scope.`);
            let atypes = this.em.archetypesMatching({ include: [component] });
            let entities = this.currentScope.entitiesMatching(atypes);
            return { entities, field };
          }
          if (this.ifToken(".")) {
            let ftok = this.consumeToken();
            if (!this.currentScope)
              throw this.compileError(`This operation only works inside of a scope.`);
            let entity = this.currentScope.getEntityByName(tok.str);
            if (!entity)
              throw this.compileError(`An entity named "${tok.str}" has not been defined.`);
            let component = this.em.singleComponentWithFieldName([entity.etype], ftok.str, ftok);
            let field = component.fields.find((f) => f.name == ftok.str);
            if (!field)
              throw this.compileError(`There is no "${ftok.str}" field in this entity.`);
            let entities = [entity];
            return { entities, field };
          }
          let args = [];
          if (this.ifToken("(")) {
            args = this.parseExprList();
            this.expectToken(")", `There should be another expression or a ")" here.`);
          }
          var loc = mergeLocs2(tok.$loc, this.lasttoken.$loc);
          var valtype = this.exprTypeForSubscript(tok.str, args, loc);
          return { valtype, name: tok.str, args, $loc: loc };
        default:
          throw this.compileError(`There should be a variable name here.`);
      }
    }
    parseLexpr() {
      var lexpr = this.parseVarSubscriptOrFunc();
      return lexpr;
    }
    exprTypeForOp(fnname, left, right, optok) {
      return { dtype: "int", lo: 0, hi: 255 };
    }
    exprTypeForSubscript(fnname, args, loc) {
      return { dtype: "int", lo: 0, hi: 255 };
    }
    parseLexprList() {
      return this.parseList(this.parseLexpr, ",");
    }
    parseExprList() {
      return this.parseList(this.parseExpr, ",");
    }
    parseBlockStatement() {
      let valtype = { dtype: "int", lo: 0, hi: 0 };
      if (this.peekToken().type == ECSTokenType.CodeFragment) {
        return { valtype, code: this.parseCode() };
      }
      if (this.ifToken("begin")) {
        let stmts = [];
        while (this.peekToken().str != "end") {
          stmts.push(this.annotate(() => this.parseBlockStatement()));
        }
        this.expectToken("end");
        return { valtype, stmts };
      }
      let cmd = this.peekToken();
      if (SELECT_TYPE.includes(cmd.str)) {
        return this.parseQueryStatement();
      }
      throw this.compileError(`There should be a statement or "end" here.`, cmd.$loc);
    }
    parseQueryStatement() {
      const select = this.expectTokens(SELECT_TYPE).str;
      let all = this.ifToken("all") != null;
      let query = void 0;
      let join = void 0;
      if (select == "once") {
        if (this.peekToken().str == "[")
          this.compileError(`A "${select}" action can't include a query.`);
      } else {
        query = this.parseQuery();
      }
      if (select == "join") {
        this.expectToken("with");
        join = this.parseQuery();
      }
      if (this.ifToken("limit")) {
        if (!query) {
          this.compileError(`A "${select}" query can't include a limit.`);
        } else
          query.limit = this.parseIntegerConstant();
      }
      const all_modifiers = ["asc", "desc"];
      const modifiers = this.parseModifiers(all_modifiers);
      let direction = void 0;
      if (modifiers["asc"])
        direction = "asc";
      else if (modifiers["desc"])
        direction = "desc";
      let body = this.annotate(() => this.parseBlockStatement());
      return { select, query, join, direction, all, stmts: [body], loop: select == "foreach" };
    }
  };

  // src/worker/tools/ecs.ts
  function assembleECS(step) {
    let em = new EntityManager(new Dialect_CA65());
    let compiler = new ECSCompiler(em, true);
    compiler.getImportFile = (path) => {
      return getWorkFileAsString(path);
    };
    gatherFiles(step, { mainFilePath: "main.ecs" });
    if (step.mainfile)
      em.mainPath = step.path;
    var destpath = step.prefix + ".ca65";
    if (staleFiles(step, [destpath])) {
      let code = getWorkFileAsString(step.path);
      fixParamsWithDefines(step.path, step.params);
      try {
        compiler.includeDebugInfo = true;
        compiler.parseFile(code, step.path);
        let outtext = compiler.export().toString();
        putWorkFile(destpath, outtext);
        var listings = {};
        listings[destpath] = { lines: [], text: outtext };
        var debuginfo = compiler.em.getDebugTree();
      } catch (e) {
        if (e instanceof ECSError) {
          compiler.addError(e.message, e.$loc);
          for (let obj of e.$sources) {
            let name = obj.event;
            if (name == "start")
              break;
            compiler.addError(`... ${name}`, obj.$loc);
          }
          return { errors: compiler.errors };
        } else if (e instanceof CompileError3) {
          return { errors: compiler.errors };
        } else {
          throw e;
        }
      }
      return {
        nexttool: "ca65",
        path: destpath,
        args: [destpath],
        files: [destpath].concat(step.files),
        listings,
        debuginfo
      };
    }
  }

  // src/common/workertypes.ts
  function isUnchanged(result) {
    return "unchanged" in result;
  }
  function isErrorResult(result) {
    return "errors" in result;
  }
  function isOutputResult(result) {
    return "output" in result;
  }

  // src/worker/tools/remote.ts
  var sessionID = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  async function buildRemote(step) {
    const { REMOTE_URL } = await (await fetch("../../remote.json")).json();
    if (typeof REMOTE_URL !== "string")
      throw new Error("No REMOTE_URL in remote.json");
    gatherFiles(step);
    var binpath = "a.out";
    if (staleFiles(step, [binpath])) {
      let updates = [];
      for (var i = 0; i < step.files.length; i++) {
        let path = step.files[i];
        let entry = store.workfs[path];
        let data = typeof entry.data === "string" ? entry.data : "data:base64," + btoa(byteArrayToString(entry.data));
        updates.push({ path, data });
      }
      let cmd = { buildStep: step, updates, sessionID };
      console.log("POST", cmd);
      let result = await fetch(REMOTE_URL, {
        method: "POST",
        mode: "cors",
        body: JSON.stringify(cmd),
        headers: {
          "Content-Type": "application/json"
        }
      });
      let json = await result.json();
      if (isUnchanged(json))
        return json;
      if (isErrorResult(json))
        return json;
      if (isOutputResult(json)) {
        json.output = stringToByteArray(atob(json.output));
        return json;
      }
      throw new Error(`Unexpected result from remote build: ${JSON.stringify(json)}`);
    }
  }

  // src/worker/tools/acme.ts
  function parseACMESymbolTable(text) {
    var symbolmap = {};
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; ++i) {
      var line = lines[i].trim();
      var m = line.match(/(\w+)\s*=\s*[$]([0-9a-f]+)/i);
      if (m) {
        symbolmap[m[1]] = parseInt(m[2], 16);
      }
    }
    return symbolmap;
  }
  function parseACMEReportFile(text) {
    var listings = {};
    var listing;
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; ++i) {
      var line = lines[i].trim();
      var m1 = line.match(/^;\s*[*]+\s*Source: (.+)$/);
      if (m1) {
        var file = m1[1];
        listings[file] = listing = {
          lines: []
        };
        continue;
      }
      var m2 = line.match(/^(\d+)\s+([0-9a-f]+)\s+([0-9a-f]+)/i);
      if (m2) {
        if (listing) {
          listing.lines.push({
            line: parseInt(m2[1]),
            offset: parseInt(m2[2], 16),
            insns: m2[3]
          });
        }
      }
    }
    return listings;
  }
  function assembleACME(step) {
    var _a;
    loadNative("acme");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.acme" });
    var binpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".sym";
    if (staleFiles(step, [binpath])) {
      var binout, lstout, symout;
      var ACME = emglobal.acme({
        instantiateWasm: moduleInstFn("acme"),
        noInitialRun: true,
        print: print_fn,
        printErr: msvcErrorMatcher(errors)
      });
      var FS = ACME.FS;
      populateFiles(step, FS);
      fixParamsWithDefines(step.path, step.params);
      var args = ["--msvc", "--initmem", "0", "-o", binpath, "-r", lstpath, "-l", sympath, step.path];
      if ((_a = step.params) == null ? void 0 : _a.acmeargs) {
        args.unshift.apply(args, step.params.acmeargs);
      } else {
        args.unshift.apply(args, ["-f", "plain"]);
      }
      args.unshift.apply(args, ["-D__8BITWORKSHOP__=1"]);
      if (step.mainfile) {
        args.unshift.apply(args, ["-D__MAIN__=1"]);
      }
      execMain(step, ACME, args);
      if (errors.length) {
        let listings = {};
        return { errors, listings };
      }
      binout = FS.readFile(binpath, { encoding: "binary" });
      lstout = FS.readFile(lstpath, { encoding: "utf8" });
      symout = FS.readFile(sympath, { encoding: "utf8" });
      putWorkFile(binpath, binout);
      putWorkFile(lstpath, lstout);
      putWorkFile(sympath, symout);
      return {
        output: binout,
        listings: parseACMEReportFile(lstout),
        errors,
        symbolmap: parseACMESymbolTable(symout)
      };
    }
  }

  // src/worker/tools/cc7800.ts
  var cc7800_fs = null;
  var wasiModule = null;
  async function compileCC7800(step) {
    const errors = [];
    gatherFiles(step, { mainFilePath: "main.c" });
    const destpath = "./a.out";
    if (staleFiles(step, [destpath])) {
      if (!cc7800_fs) {
        cc7800_fs = await loadWASIFilesystemZip("cc7800-fs.zip");
      }
      if (!wasiModule) {
        wasiModule = new WebAssembly.Module(loadWASMBinary("cc7800"));
      }
      const wasi = new WASIRunner();
      wasi.initSync(wasiModule);
      wasi.fs.setParent(cc7800_fs);
      for (let file of step.files) {
        wasi.fs.putFile("./" + file, store.getFileData(file));
      }
      wasi.addPreopenDirectory("headers");
      wasi.addPreopenDirectory(".");
      wasi.setArgs(["cc7800", "-v", "-g", "-S", "-I", "headers", step.path]);
      try {
        wasi.run();
      } catch (e) {
        errors.push(e);
      }
      let stdout = wasi.fds[1].getBytesAsString();
      let stderr = wasi.fds[2].getBytesAsString();
      console.log("stdout", stdout);
      console.log("stderr", stderr);
      if (stderr.indexOf("Syntax error:") >= 0) {
        const matcher = makeErrorMatcher(errors, /^Syntax error: (.+?) on line (\d+) of (.+)/, 2, 1, step.path, 3);
        for (let line of stderr.split("\n")) {
          matcher(line);
        }
      }
      if (errors.length) {
        return { errors };
      }
      const combinedasm = wasi.fs.getFile(destpath).getBytesAsString();
      putWorkFile(destpath, combinedasm);
    }
    return {
      nexttool: "dasm",
      path: destpath,
      args: [destpath],
      files: [destpath]
    };
  }

  // src/worker/tools/bataribasic.ts
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

  // src/worker/tools/oscar64.ts
  var oscar64_fs = null;
  var wasiModule2 = null;
  async function compileOscar64(step) {
    const errors = [];
    const rootDir = "/root/";
    gatherFiles(step, { mainFilePath: "main.c" });
    const destpath = (step.path || "main.c").replace(/\.[^.]+$/, ".prg");
    console.log("destpath", destpath);
    if (staleFiles(step, [destpath])) {
      if (!oscar64_fs) {
        oscar64_fs = await loadWASIFilesystemZip("oscar64-fs.zip", "/root/");
      }
      if (!wasiModule2) {
        wasiModule2 = new WebAssembly.Module(loadWASMBinary("oscar64"));
      }
      const wasi = new WASIRunner();
      wasi.initSync(wasiModule2);
      wasi.fs.setParent(oscar64_fs);
      for (let file of step.files) {
        wasi.fs.putFile(rootDir + file, store.getFileData(file));
      }
      wasi.addPreopenDirectory("/root");
      wasi.setArgs(["oscar64", "-v", "-g", "-i=/root", step.path]);
      try {
        wasi.run();
      } catch (e) {
        errors.push(e);
      }
      let stdout = wasi.fds[1].getBytesAsString();
      let stderr = wasi.fds[2].getBytesAsString();
      console.log("stdout", stdout);
      console.log("stderr", stderr);
      const matcher = makeErrorMatcher(errors, /\((\d+),\s+(\d+)\)\s+: error (\d+): (.+)/, 1, 4, step.path);
      for (let line of stderr.split("\n")) {
        matcher(line);
      }
      if (errors.length) {
        return { errors };
      }
      const output = wasi.fs.getFile(rootDir + destpath).getBytes();
      putWorkFile(destpath, output);
      return {
        output,
        errors
      };
    }
  }

  // src/worker/workertools.ts
  var TOOLS = {
    "dasm": assembleDASM,
    "acme": assembleACME,
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
    "ecs": assembleECS,
    "remote": buildRemote,
    "cc7800": compileCC7800,
    "armtcc": compileARMTCC,
    "armtcclink": linkARMTCC,
    "oscar64": compileOscar64
  };
  var TOOL_PRELOADFS = {
    "cc65-apple2": "65-apple2",
    "ca65-apple2": "65-apple2",
    "cc65-c64": "65-c64",
    "ca65-c64": "65-c64",
    "cc65-vic20": "65-vic20",
    "ca65-vic20": "65-vic20",
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
    "cc65-vcs": "65-atari2600",
    "ca65-vcs": "65-atari2600",
    "cc65-pce": "65-pce",
    "ca65-pce": "65-pce",
    "cc65-exidy": "65-none",
    "ca65-exidy": "65-none",
    "sdasz80": "sdcc",
    "sdcc": "sdcc",
    "sccz80": "sccz80",
    "bataribasic": "2600basic",
    "inform6": "inform",
    "fastbasic": "65-atari8",
    "silice": "Silice",
    "wiz": "wiz",
    "ecs-vcs": "65-atari2600",
    "ecs-nes": "65-nes",
    "ecs-c64": "65-c64"
  };

  // src/worker/workermain.ts
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
  async function handleMessage(data) {
    if (data.preload) {
      var fs = TOOL_PRELOADFS[data.preload];
      if (!fs && data.platform)
        fs = TOOL_PRELOADFS[data.preload + "-" + getBasePlatform(data.platform)];
      if (!fs && data.platform)
        fs = TOOL_PRELOADFS[data.preload + "-" + getRootBasePlatform(data.platform)];
      if (fs && !fsMeta[fs])
        loadFilesystem(fs);
      return;
    }
    if (data.reset) {
      store.reset();
      return;
    }
    return builder.handleMessage(data);
  }
  var ENVIRONMENT_IS_WORKER2 = typeof importScripts === "function";
  if (ENVIRONMENT_IS_WORKER2) {
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

JSZip v3.10.1 - A JavaScript class for generating and reading zip files
<http://stuartk.com/jszip>

(c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>
Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/main/LICENSE.markdown.

JSZip uses the library pako released under the MIT license :
https://github.com/nodeca/pako/blob/main/LICENSE
*/
//# sourceMappingURL=bundle.js.map
