"use strict";
// The file a VCD recording streams to (see EmuCore.startVcd). Node only.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_VCD_MAX_BYTES = void 0;
exports.openVcdFile = openVcdFile;
const fs = __importStar(require("fs"));
const zlib = __importStar(require("zlib"));
/** The most the CLI writes unless told otherwise, about 400 frames of a design with video. */
exports.DEFAULT_VCD_MAX_BYTES = 1 << 30;
/**
 * Open `file` for a recording. A name ending in `.gz` is gzipped as it goes:
 * each chunk is its own gzip member, which gunzip reads as one stream, so
 * nothing needs flushing at the end. VCD compresses about 4x.
 * `maxBytes` (0 for no limit) sets when `full` turns true; the file goes a
 * little past it, since the recording stops between clocks.
 */
function openVcdFile(file, maxBytes = exports.DEFAULT_VCD_MAX_BYTES) {
    const fd = fs.openSync(file, 'w');
    const gzip = /\.gz$/i.test(file);
    const f = {
        bytes: 0,
        get full() { return maxBytes > 0 && f.bytes >= maxBytes; },
        write(chunk) {
            const data = gzip ? zlib.gzipSync(chunk, { level: 1 }) : Buffer.from(chunk);
            fs.writeSync(fd, data);
            f.bytes += data.length;
        },
        close() { fs.closeSync(fd); },
    };
    return f;
}
//# sourceMappingURL=vcdfile.js.map