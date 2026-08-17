"use strict";
// Terminal image display using Kitty or iTerm2 protocols.
// Uses supports-terminal-graphics for detection; rendering has no npm deps.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayImageInTerminal = displayImageInTerminal;
const supports_terminal_graphics_1 = __importDefault(require("supports-terminal-graphics"));
/**
 * Auto-pick a nearest-neighbor scale (2x, 3x, or 4x) so the image
 * is large enough to see but fits roughly within the terminal.
 */
function autoScale(imageWidth, imageHeight) {
    const termCols = process.stdout.columns || 80;
    // Assume ~8px per cell width; aim to fill about half the terminal width
    const targetPx = termCols * 4;
    const scale = Math.max(1, Math.min(4, Math.round(targetPx / imageWidth)));
    return scale;
}
/**
 * Detect terminal type and display a PNG image inline.
 * imageWidth/imageHeight are the original pixel dimensions (avoids re-decoding for Kitty/iTerm2).
 * Returns true if the image was displayed, false otherwise.
 */
function displayImageInTerminal(pngData, imageWidth, imageHeight) {
    if (!process.stdout.isTTY)
        return false;
    // If dimensions not provided, read from PNG header
    if (!imageWidth || !imageHeight) {
        const dims = readPNGDimensions(pngData);
        imageWidth = dims.width;
        imageHeight = dims.height;
    }
    if (!imageWidth || !imageHeight)
        return false;
    const scale = autoScale(imageWidth, imageHeight);
    const support = supports_terminal_graphics_1.default.stdout;
    if (support.kitty) {
        displayKitty(pngData, imageWidth, imageHeight, scale);
        return true;
    }
    if (support.iterm2) {
        displayITerm2(pngData, imageWidth, imageHeight, scale);
        return true;
    }
    /*
    if (support.sixel) {
      displaySixel(pngData);
      return true;
    }
    */
    return false;
}
/** Read width/height from a PNG IHDR chunk without full decode. */
function readPNGDimensions(data) {
    if (data.length >= 24 && data[12] === 0x49 && data[13] === 0x48 && data[14] === 0x44 && data[15] === 0x52) {
        return { width: readU32(data, 16), height: readU32(data, 20) };
    }
    return { width: 0, height: 0 };
}
/**
 * Kitty graphics protocol: transmit PNG data as base64 chunks.
 * c= and r= specify display size in terminal cells (~8px wide, ~16px tall).
 * https://sw.kovidgoyal.net/kitty/graphics-protocol/
 */
function displayKitty(pngData, w, h, scale) {
    const b64 = Buffer.from(pngData).toString('base64');
    const chunkSize = 4096;
    const cols = Math.ceil(w * scale / 8);
    const rows = Math.ceil(h * scale / 16);
    for (let i = 0; i < b64.length; i += chunkSize) {
        const chunk = b64.slice(i, i + chunkSize);
        const more = i + chunkSize < b64.length ? 1 : 0;
        if (i === 0) {
            process.stdout.write(`\x1b_Gf=100,a=T,c=${cols},r=${rows},m=${more};${chunk}\x1b\\`);
        }
        else {
            process.stdout.write(`\x1b_Gm=${more};${chunk}\x1b\\`);
        }
    }
    process.stdout.write('\n');
}
/**
 * iTerm2 inline image protocol with pixel-level width/height.
 * https://iterm2.com/documentation-images.html
 */
function displayITerm2(pngData, w, h, scale) {
    const b64 = Buffer.from(pngData).toString('base64');
    const pw = w * scale;
    const ph = h * scale;
    process.stdout.write(`\x1b]1337;File=inline=1;size=${pngData.length};width=${pw}px;height=${ph}px:${b64}\x07\n`);
}
function readU32(data, offset) {
    return (data[offset] << 24 | data[offset + 1] << 16 | data[offset + 2] << 8 | data[offset + 3]) >>> 0;
}
//# sourceMappingURL=termimage.js.map