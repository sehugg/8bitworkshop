"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwoWayMapper = exports.Viewer = exports.MapEditor = exports.CharmapEditor = exports.ImageChooser = exports.NESNametableConverter = exports.MetaspriteCompositor = exports.Compositor = exports.PaletteEditorView = exports.PaletteFormatToRGB = exports.Palettizer = exports.Mapper = exports.Compressor = exports.TextDataNode = exports.FileDataNode = exports.PixNode = void 0;
exports.parseHexWords = parseHexWords;
exports.replaceHexWords = replaceHexWords;
exports.convertWordsToImages = convertWordsToImages;
exports.validateAssetData = validateAssetData;
exports.validateAssetByteLength = validateAssetByteLength;
exports.scanTextForAssetFragments = scanTextForAssetFragments;
exports.resolveEmbedPath = resolveEmbedPath;
exports.convertImagesToWords = convertImagesToWords;
exports.convertPaletteBytes = convertPaletteBytes;
exports.decodePacmanColorPromByte = decodePacmanColorPromByte;
exports.getPaletteLength = getPaletteLength;
exports.convertPaletteFormat = convertPaletteFormat;
exports.getPixelClipboard = getPixelClipboard;
exports.setPixelClipboard = setPixelClipboard;
exports.pasteClipboardPixels = pasteClipboardPixels;
const util_1 = require("../common/util");
const toolbar_1 = require("./toolbar");
const MAX_SIZE_X = 800;
const MAX_SIZE_Y = 1000;
const MAX_SCALE = 16;
function getArtBit(fmt) {
    return fmt.art ? (fmt.brev ? 0 : 7) : null;
}
/////////////////
// 0xabcd, #$abcd, 5'010101, 0b010101, etc
var pixel_re = /([0#]?)([x$%]|\d'h)([0-9a-f]+)(?:[;].*)?|(\d'b|0b)([01]+)/gim;
function convertToHexStatements(s) {
    // convert 'hex ....' asm format
    return s.replace(/(\shex\s+)([0-9a-f]+)/ig, function (m, hexprefix, hexstr) {
        var rtn = hexprefix;
        for (var i = 0; i < hexstr.length; i += 2) {
            rtn += '0x' + hexstr.substr(i, 2) + ',';
        }
        return rtn;
    });
}
function parseHexWords(s) {
    var arr = [];
    var m;
    while (m = pixel_re.exec(s)) {
        var n;
        if (m[4])
            n = parseInt(m[5], 2);
        else if (m[2].startsWith('%'))
            n = parseInt(m[3], 2);
        else if (m[2].startsWith('x') || m[2].startsWith('$') || m[2].endsWith('h'))
            n = parseInt(m[3], 16);
        else
            n = parseInt(m[3]);
        arr.push(n);
    }
    return arr;
}
function replaceHexWords(s, words, bpw) {
    // convert 'hex ...' format to 0x prefixed values for regex matching
    s = convertToHexStatements(s);
    var result = "";
    var m;
    var li = 0;
    var i = 0;
    var nibbles = Math.ceil(bpw / 4);
    while (m = pixel_re.exec(s)) {
        result += s.slice(li, pixel_re.lastIndex - m[0].length);
        li = pixel_re.lastIndex;
        if (m[4])
            result += m[4] + (0, util_1.tobin)(words[i++], parseInt(m[4]));
        else if (m[2].startsWith('%'))
            result += m[1] + m[2] + (0, util_1.tobin)(words[i++], bpw);
        else if (m[2].endsWith('h'))
            result += m[1] + m[2] + (0, util_1.hex)(words[i++], parseInt(m[2]));
        else if (m[2].startsWith('x'))
            result += m[1] + "x" + (0, util_1.hex)(words[i++], nibbles);
        else if (m[2].startsWith('$'))
            result += m[1] + "$" + (0, util_1.hex)(words[i++], nibbles);
        else
            result += m[1] + words[i++].toString();
    }
    result += s.slice(li);
    // convert 'hex ....' asm format
    result = result.replace(/(\shex\s+)([,x0-9a-f]+)/ig, (m, hexprefix, hexstr) => {
        var rtn = hexprefix + hexstr;
        rtn = rtn.replace(/0x/ig, '').replace(/,/ig, '');
        return rtn;
    });
    return result;
}
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
        if (x & (1 << i)) {
            y ^= 1 << s;
        }
    }
    return y;
}
// for VCS playfields
// ;;{w:20,h:10,flip:1,reindex:[4,5,6,7,15,14,13,12,11,10,9,8,16,17,18,19]};;
function reindexMask(x, inds) {
    var i = inds[x % inds.length];
    return [i >> 3, i & 7];
}
// Pac-Man strip layouts (must match src/machine/pacman.ts PacmanVideo)
const PAC_TILE_STRIPS = [
    // [byteOffset, bx, by]
    [0, 0, 4],
    [8, 0, 0],
];
const PAC_SPRITE_STRIPS = [
    [0, 8, 12], [8, 8, 0], [16, 8, 4], [24, 8, 8],
    [32, 0, 12], [40, 0, 0], [48, 0, 4], [56, 0, 8],
];
function pacStripDecode(input, inOff, output, bx, by, imgWidth) {
    for (var x = 0; x < 8; x++) {
        var strip = input[inOff + x] || 0;
        for (var y = 0; y < 4; y++) {
            var i = (3 - y) * imgWidth + (7 - x);
            var pen = ((strip >> y) & 1) | (((strip >> (y + 4)) & 1) << 1);
            output[by * imgWidth + bx + i] = pen;
        }
    }
}
function pacStripEncode(output, outOff, pixels, bx, by, imgWidth) {
    for (var x = 0; x < 8; x++) {
        var strip = 0;
        for (var y = 0; y < 4; y++) {
            var i = (3 - y) * imgWidth + (7 - x);
            var pen = (pixels[by * imgWidth + bx + i] || 0) & 3;
            if (pen & 1)
                strip |= (1 << y);
            if (pen & 2)
                strip |= (1 << (y + 4));
        }
        output[outOff + x] = strip;
    }
}
function pacStripLayouts(fmt) {
    if (fmt.w === 16 && fmt.h === 16)
        return PAC_SPRITE_STRIPS;
    return PAC_TILE_STRIPS;
}
function pacStripBytesPerImage(fmt) {
    return pacStripLayouts(fmt).length * 8;
}
function convertPacStripWordsToImages(words, fmt) {
    var width = fmt.w;
    var height = fmt.h;
    var count = fmt.count || 1;
    var wpimg = fmt.wpimg || pacStripBytesPerImage(fmt);
    var layouts = pacStripLayouts(fmt);
    var images = [];
    for (var n = 0; n < count; n++) {
        var pix = new Array(width * height).fill(0);
        var base = n * wpimg;
        for (var s = 0; s < layouts.length; s++) {
            var [off, bx, by] = layouts[s];
            pacStripDecode(words, base + off, pix, bx, by, width);
        }
        images.push(new Uint8Array(pix));
    }
    return images;
}
function convertPacStripImagesToWords(images, fmt) {
    var width = fmt.w;
    var height = fmt.h;
    var count = fmt.count || images.length;
    var wpimg = fmt.wpimg || pacStripBytesPerImage(fmt);
    var layouts = pacStripLayouts(fmt);
    var words = new Array(wpimg * count).fill(0);
    for (var n = 0; n < count; n++) {
        var pix = images[n] || new Uint8Array(width * height);
        var base = n * wpimg;
        for (var s = 0; s < layouts.length; s++) {
            var [off, bx, by] = layouts[s];
            pacStripEncode(words, base + off, pix, bx, by, width);
        }
    }
    return words;
}
function convertWordsToImages(words, fmt) {
    if (fmt.pacstrip)
        return convertPacStripWordsToImages(words, fmt);
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
    var wpimg = fmt.wpimg || wordsperline * height;
    var rowstride = wordsperline;
    if (fmt.il) {
        wpimg = wordsperline;
        rowstride = wordsperline * count;
    }
    var images = [];
    for (var n = 0; n < count; n++) {
        var imgdata = [];
        for (var y = 0; y < height; y++) {
            var yp = fmt.flip ? height - 1 - y : y;
            var ofs0 = wpimg * n + yp * rowstride;
            var shift = 0;
            for (var x = 0; x < width; x++) {
                var color = 0;
                var ofs = remapBits(ofs0, fmt.remap);
                if (fmt.reindex) {
                    [ofs, shift] = reindexMask(x, fmt.reindex);
                    ofs += ofs0;
                }
                for (var p = 0; p < nplanes; p++) {
                    var byte = words[ofs + p * pofs + skip];
                    color |= ((fmt.brev ? byte >> (bitsperword - shift - bpp) : byte >> shift) & mask) << (p * bpp);
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
function computeRequiredWords(fmt) {
    // mirrors the addressing performed by convertWordsToImages: the data must cover
    // every word the converter can read, and must also span the full per-image block
    // extent (wpimg * count), e.g. hardware sprite strides larger than the visible rows.
    var count = fmt.count || 1;
    var bpp = fmt.bpp || 1;
    var nplanes = fmt.np || 1;
    var bitsperword = fmt.bpw || 8;
    var wordsperline = fmt.sl || Math.ceil(fmt.w * bpp / bitsperword);
    var pofs = fmt.pofs || wordsperline * fmt.h * count;
    var skip = fmt.skip || 0;
    var wpimg = fmt.wpimg || (fmt.map === 'nesnt' ? 1024 : wordsperline * fmt.h);
    var rowstride = wordsperline;
    if (fmt.il) {
        wpimg = wordsperline;
        rowstride = wordsperline * count;
    }
    var maxReindexOfs = 0;
    if (fmt.reindex) {
        for (var x = 0; x < fmt.w; x++) {
            maxReindexOfs = Math.max(maxReindexOfs, reindexMask(x, fmt.reindex)[0]);
        }
    }
    var maxAddr = 0;
    for (var n = 0; n < count; n++) {
        for (var y = 0; y < fmt.h; y++) {
            var yp = fmt.flip ? fmt.h - 1 - y : y;
            var ofs0 = wpimg * n + yp * rowstride;
            var steps = Math.ceil(fmt.w * bpp / bitsperword);
            for (var s = 0; s < steps; s++) {
                var ofs = fmt.reindex ? (ofs0 + maxReindexOfs) : remapBits(ofs0, fmt.remap);
                maxAddr = Math.max(maxAddr, ofs + (nplanes - 1) * pofs + skip);
                ofs0++;
            }
        }
    }
    return Math.max(wpimg * count, maxAddr + 1);
}
function validateAssetData(datastr, fmt) {
    var words = parseHexWords(convertToHexStatements(datastr));
    if (fmt.comp == 'rletag') {
        words = Array.from((0, util_1.rle_unpack)(new Uint8Array(words)));
    }
    if (fmt.w > 0 && fmt.h > 0) {
        var required = computeRequiredWords(fmt);
        if (words.length != required) {
            return `Expected ${required} value(s), found ${words.length}`;
        }
    }
    else if (fmt.pal) {
        if (words.length < 1) {
            return `Palette requires at least 1 value, found ${words.length}`;
        }
    }
    return null;
}
// same as validateAssetData, but for a raw binary file (e.g. referenced via #embed)
// where the byte count is already known and there's no source text to parse
function validateAssetByteLength(bytelen, fmt) {
    if (fmt.comp == 'rletag') {
        return null; // can't statically determine compressed length
    }
    if (fmt.w > 0 && fmt.h > 0) {
        var required = computeRequiredWords(fmt);
        if (bytelen != required) {
            return `Expected ${required} byte(s), found ${bytelen}`;
        }
    }
    else if (fmt.pal) {
        if (bytelen < 1) {
            return `Palette requires at least 1 byte, found ${bytelen}`;
        }
    }
    return null;
}
function getLineNumber(data, offset) {
    let line = 1;
    for (let i = 0; i < offset && i < data.length; i++) {
        if (data[i] === '\n')
            line++;
    }
    return line;
}
// Scans source text for "/*{json}*/" or ";;{json};;" asset headers followed by a data
// block closed by the next ';' (C), ';;' (asm), or "end" (verilog). Pure/testable: no
// DOM or project dependencies -- platform-specific closing delimiter is supplied by caller.
function scanTextForAssetFragments(data, isVerilog) {
    var re1 = /[/;][*;]([{].+[}])[*;][/;]/g;
    var result = [];
    var m;
    while (m = re1.exec(data)) {
        var start = m.index + m[0].length;
        var end;
        if (isVerilog) {
            end = data.indexOf("end", start);
        }
        else if (m[0].startsWith(';;')) {
            end = data.indexOf(';;', start);
            if (end == data.indexOf(';;{', start)) {
                // ignore start of next asset
                end = -1;
            }
        }
        else {
            end = data.indexOf(';', start); // C
        }
        var startline = getLineNumber(data, m.index);
        var header = m[0];
        var endline = end >= 0 ? getLineNumber(data, end) : '???';
        if (end < 0) {
            var closingDelim = isVerilog ? '"end"' : m[0].startsWith(';;') ? '";;"' : '";"';
            result.push({ header: header, startline: startline, endline: endline, error: `No closing ${closingDelim} found after asset header` });
        }
        else if (end <= start) {
            result.push({ header: header, startline: startline, endline: endline, error: `Empty data block after asset header` });
        }
        else {
            try {
                var jsontxt = m[1].replace(/([A-Za-z]+):/g, '"$1":'); // fix lenient JSON
                var json = JSON.parse(jsontxt);
                // C23 #embed "file.bin" -- data lives in a separate binary file, not inline
                var embedMatch = /#embed\s+"(.+?)"/.exec(data.substring(start, end));
                var embedFile = embedMatch ? embedMatch[1] : undefined;
                result.push({ header: header, startline: startline, endline: endline, fmt: json, start: start, end: end, embedFile: embedFile });
            }
            catch (e) {
                result.push({ header: header, startline: startline, endline: endline, error: `Invalid asset format: ${e.message}` });
            }
        }
    }
    return result;
}
// Resolves a #embed "file.bin" path against a project file-existence check: tries the
// plain name first, then a directory-prefixed candidate based on the including file's
// own path (e.g. "sub/main.c" + "data.bin" -> "sub/data.bin").
function resolveEmbedPath(fileid, embedName, fileExists) {
    if (fileExists(embedName))
        return embedName;
    var slash = fileid.lastIndexOf('/');
    if (slash >= 0) {
        var candidate = fileid.substring(0, slash + 1) + embedName;
        if (fileExists(candidate))
            return candidate;
    }
    return null;
}
function convertImagesToWords(images, fmt) {
    if (fmt.destfmt)
        fmt = fmt.destfmt;
    if (fmt.pacstrip)
        return convertPacStripImagesToWords(images, fmt);
    var width = fmt.w;
    var height = fmt.h;
    var count = fmt.count || 1;
    var bpp = fmt.bpp || 1;
    var nplanes = fmt.np || 1;
    var bitsperword = fmt.bpw || 8;
    var wordsperline = fmt.sl || Math.ceil(fmt.w * bpp / bitsperword);
    var mask = (1 << bpp) - 1;
    var pofs = fmt.pofs || wordsperline * height * count;
    var skip = fmt.skip || 0;
    var wpimg = fmt.wpimg || wordsperline * height;
    var rowstride = wordsperline;
    if (fmt.il) {
        wpimg = wordsperline;
        rowstride = wordsperline * count;
    }
    var totalwords = fmt.il ? rowstride * height : wpimg * count;
    var words;
    if (nplanes > 0 && fmt.sl) // TODO?
        words = new Uint8Array(totalwords);
    else if (bitsperword <= 8)
        words = new Uint8Array(totalwords * nplanes);
    else
        words = new Uint32Array(totalwords * nplanes);
    for (var n = 0; n < count; n++) {
        var imgdata = images[n];
        var i = 0;
        for (var y = 0; y < height; y++) {
            var yp = fmt.flip ? height - 1 - y : y;
            var ofs0 = n * wpimg + yp * rowstride;
            var shift = 0;
            for (var x = 0; x < width; x++) {
                var color = imgdata[i++];
                var ofs = remapBits(ofs0, fmt.remap);
                if (fmt.reindex) {
                    [ofs, shift] = reindexMask(x, fmt.reindex);
                    ofs += ofs0;
                }
                for (var p = 0; p < nplanes; p++) {
                    var c = (color >> (p * bpp)) & mask;
                    words[ofs + p * pofs + skip] |= (fmt.brev ? (c << (bitsperword - shift - bpp)) : (c << shift));
                }
                shift += bpp;
                if (shift >= bitsperword && !fmt.reindex) {
                    ofs0 += 1;
                    shift = 0;
                }
            }
        }
    }
    return words;
}
// TODO
function convertPaletteBytes(arr, r0, r1, g0, g1, b0, b1) {
    var result = [];
    for (var i = 0; i < arr.length; i++) {
        var d = arr[i];
        var rgb = 0xff000000;
        rgb |= ((d >> r0) & ((1 << r1) - 1)) << (0 + 8 - r1);
        rgb |= ((d >> g0) & ((1 << g1) - 1)) << (8 + 8 - g1);
        rgb |= ((d >> b0) & ((1 << b1) - 1)) << (16 + 8 - b1);
        result.push(rgb);
    }
    return result;
}
/**
 * Pac-Man / Namco color PROM byte → RGBA.
 * Must match src/machine/pacman.ts PacmanVideo.rebuild() (MAME resistor weights).
 * Encoding: RRR (bits 0-2), GGG (3-5), BB (6-7).
 */
function decodePacmanColorPromByte(d) {
    var r = ((d >> 0) & 1) * 0x21 + ((d >> 1) & 1) * 0x47 + ((d >> 2) & 1) * 0x97;
    var g = ((d >> 3) & 1) * 0x21 + ((d >> 4) & 1) * 0x47 + ((d >> 5) & 1) * 0x97;
    var b = ((d >> 6) & 1) * 0x51 + ((d >> 7) & 1) * 0xae;
    return 0xff000000 | (b << 16) | (g << 8) | r;
}
function getPaletteLength(palfmt) {
    var pal = palfmt.pal;
    if (typeof pal === 'number') {
        var rr = Math.floor(Math.abs(pal / 100) % 10);
        var gg = Math.floor(Math.abs(pal / 10) % 10);
        var bb = Math.floor(Math.abs(pal) % 10);
        return 1 << (rr + gg + bb);
    }
    else if (pal === 'pacman') {
        return 256; // every PROM encoding byte → a color
    }
    else {
        var paltable = PREDEF_PALETTES[pal];
        if (paltable) {
            return paltable.length;
        }
        else {
            throw new Error("No palette named " + pal);
        }
    }
}
function convertPaletteFormat(palbytes, palfmt) {
    var pal = palfmt.pal;
    var newpalette;
    if (typeof pal === 'number') {
        var rr = Math.floor(Math.abs(pal / 100) % 10);
        var gg = Math.floor(Math.abs(pal / 10) % 10);
        var bb = Math.floor(Math.abs(pal) % 10);
        // TODO: n
        if (pal >= 0)
            newpalette = convertPaletteBytes(palbytes, 0, rr, rr, gg, rr + gg, bb);
        else
            newpalette = convertPaletteBytes(palbytes, rr + gg, bb, rr, gg, 0, rr);
    }
    else if (pal === 'pacman') {
        newpalette = [];
        for (var i = 0; i < palbytes.length; i++)
            newpalette.push(decodePacmanColorPromByte(palbytes[i]));
    }
    else {
        var paltable = PREDEF_PALETTES[pal];
        if (paltable) {
            newpalette = new Uint32Array(palbytes).map((i) => { return paltable[i & (paltable.length - 1)] | 0xff000000; });
        }
        else {
            throw new Error("No palette named " + pal);
        }
    }
    return newpalette;
}
// TODO: illegal colors?
const PREDEF_PALETTES = {
    // LCD polarity: index 0 = lightest (pixel off), 3 = darkest (pixel on)
    'gb': [
        0xd0d884, 0x87a84c, 0x526b34, 0x2d3122,
    ],
    'nes': [
        0x525252, 0xB40000, 0xA00000, 0xB1003D, 0x740069, 0x00005B, 0x00005F, 0x001840, 0x002F10, 0x084A08, 0x006700, 0x124200, 0x6D2800, 0x000000, 0x000000, 0x000000,
        0xC4D5E7, 0xFF4000, 0xDC0E22, 0xFF476B, 0xD7009F, 0x680AD7, 0x0019BC, 0x0054B1, 0x006A5B, 0x008C03, 0x00AB00, 0x2C8800, 0xA47200, 0x000000, 0x000000, 0x000000,
        0xF8F8F8, 0xFFAB3C, 0xFF7981, 0xFF5BC5, 0xFF48F2, 0xDF49FF, 0x476DFF, 0x00B4F7, 0x00E0FF, 0x00E375, 0x03F42B, 0x78B82E, 0xE5E218, 0x787878, 0x000000, 0x000000,
        0xFFFFFF, 0xFFF2BE, 0xF8B8B8, 0xF8B8D8, 0xFFB6FF, 0xFFC3FF, 0xC7D1FF, 0x9ADAFF, 0x88EDF8, 0x83FFDD, 0xB8F8B8, 0xF5F8AC, 0xFFFFB0, 0xF8D8F8, 0x000000, 0x000000
    ],
    'ap2lores': [
        (0x000000), (0xff00ff), (0x00007f), (0x7f007f), (0x007f00), (0x7f7f7f), (0x0000bf), (0x0000ff),
        (0xbf7f00), (0xffbf00), (0xbfbfbf), (0xff7f7f), (0x00ff00), (0xffff00), (0x00bf7f), (0xffffff),
    ],
    'vcs': [
        0x000000, 0x000000, 0x404040, 0x404040, 0x6c6c6c, 0x6c6c6c, 0x909090, 0x909090, 0xb0b0b0, 0xb0b0b0, 0xc8c8c8, 0xc8c8c8, 0xdcdcdc, 0xdcdcdc, 0xf4f4f4, 0xf4f4f4,
        0x004444, 0x004444, 0x106464, 0x106464, 0x248484, 0x248484, 0x34a0a0, 0x34a0a0, 0x40b8b8, 0x40b8b8, 0x50d0d0, 0x50d0d0, 0x5ce8e8, 0x5ce8e8, 0x68fcfc, 0x68fcfc,
        0x002870, 0x002870, 0x144484, 0x144484, 0x285c98, 0x285c98, 0x3c78ac, 0x3c78ac, 0x4c8cbc, 0x4c8cbc, 0x5ca0cc, 0x5ca0cc, 0x68b4dc, 0x68b4dc, 0x78c8ec, 0x78c8ec,
        0x001884, 0x001884, 0x183498, 0x183498, 0x3050ac, 0x3050ac, 0x4868c0, 0x4868c0, 0x5c80d0, 0x5c80d0, 0x7094e0, 0x7094e0, 0x80a8ec, 0x80a8ec, 0x94bcfc, 0x94bcfc,
        0x000088, 0x000088, 0x20209c, 0x20209c, 0x3c3cb0, 0x3c3cb0, 0x5858c0, 0x5858c0, 0x7070d0, 0x7070d0, 0x8888e0, 0x8888e0, 0xa0a0ec, 0xa0a0ec, 0xb4b4fc, 0xb4b4fc,
        0x5c0078, 0x5c0078, 0x74208c, 0x74208c, 0x883ca0, 0x883ca0, 0x9c58b0, 0x9c58b0, 0xb070c0, 0xb070c0, 0xc084d0, 0xc084d0, 0xd09cdc, 0xd09cdc, 0xe0b0ec, 0xe0b0ec,
        0x780048, 0x780048, 0x902060, 0x902060, 0xa43c78, 0xa43c78, 0xb8588c, 0xb8588c, 0xcc70a0, 0xcc70a0, 0xdc84b4, 0xdc84b4, 0xec9cc4, 0xec9cc4, 0xfcb0d4, 0xfcb0d4,
        0x840014, 0x840014, 0x982030, 0x982030, 0xac3c4c, 0xac3c4c, 0xc05868, 0xc05868, 0xd0707c, 0xd0707c, 0xe08894, 0xe08894, 0xeca0a8, 0xeca0a8, 0xfcb4bc, 0xfcb4bc,
        0x880000, 0x880000, 0x9c201c, 0x9c201c, 0xb04038, 0xb04038, 0xc05c50, 0xc05c50, 0xd07468, 0xd07468, 0xe08c7c, 0xe08c7c, 0xeca490, 0xeca490, 0xfcb8a4, 0xfcb8a4,
        0x7c1800, 0x7c1800, 0x90381c, 0x90381c, 0xa85438, 0xa85438, 0xbc7050, 0xbc7050, 0xcc8868, 0xcc8868, 0xdc9c7c, 0xdc9c7c, 0xecb490, 0xecb490, 0xfcc8a4, 0xfcc8a4,
        0x5c2c00, 0x5c2c00, 0x784c1c, 0x784c1c, 0x906838, 0x906838, 0xac8450, 0xac8450, 0xc09c68, 0xc09c68, 0xd4b47c, 0xd4b47c, 0xe8cc90, 0xe8cc90, 0xfce0a4, 0xfce0a4,
        0x2c3c00, 0x2c3c00, 0x485c1c, 0x485c1c, 0x647c38, 0x647c38, 0x809c50, 0x809c50, 0x94b468, 0x94b468, 0xacd07c, 0xacd07c, 0xc0e490, 0xc0e490, 0xd4fca4, 0xd4fca4,
        0x003c00, 0x003c00, 0x205c20, 0x205c20, 0x407c40, 0x407c40, 0x5c9c5c, 0x5c9c5c, 0x74b474, 0x74b474, 0x8cd08c, 0x8cd08c, 0xa4e4a4, 0xa4e4a4, 0xb8fcb8, 0xb8fcb8,
        0x003814, 0x003814, 0x1c5c34, 0x1c5c34, 0x387c50, 0x387c50, 0x50986c, 0x50986c, 0x68b484, 0x68b484, 0x7ccc9c, 0x7ccc9c, 0x90e4b4, 0x90e4b4, 0xa4fcc8, 0xa4fcc8,
        0x00302c, 0x00302c, 0x1c504c, 0x1c504c, 0x347068, 0x347068, 0x4c8c84, 0x4c8c84, 0x64a89c, 0x64a89c, 0x78c0b4, 0x78c0b4, 0x88d4cc, 0x88d4cc, 0x9cece0, 0x9cece0,
        0x002844, 0x002844, 0x184864, 0x184864, 0x306884, 0x306884, 0x4484a0, 0x4484a0, 0x589cb8, 0x589cb8, 0x6cb4d0, 0x6cb4d0, 0x7ccce8, 0x7ccce8, 0x8ce0fc, 0x8ce0fc
    ],
    'astrocade': [0, 2368548, 4737096, 7171437, 9539985, 11974326, 14342874, 16777215, 12255269, 14680137, 16716142, 16725394, 16734903, 16744155, 16753663, 16762879, 11534409, 13959277, 16318866, 16721334, 16730842, 16740095, 16749311, 16758783, 10420330, 12779662, 15138995, 16718039, 16727291, 16736767, 16745983, 16755199, 8847495, 11206827, 13631696, 15994612, 16724735, 16733951, 16743423, 16752639, 6946975, 9306307, 11731175, 14092287, 16461055, 16732415, 16741631, 16751103, 4784304, 7143637, 9568505, 11929087, 14297599, 16731647, 16741119, 16750335, 2425019, 4784352, 7209215, 9570047, 12004095, 14372863, 16741375, 16750847, 191, 2359523, 4718847, 7146495, 9515263, 11949311, 14318079, 16752127, 187, 224, 2294015, 4658431, 7092735, 9461247, 11895551, 14264063, 176, 213, 249, 2367999, 4736511, 7105279, 9539327, 11908095, 159, 195, 3303, 209151, 2577919, 4946431, 7380735, 9749247, 135, 171, 7888, 17140, 681983, 3050495, 5484543, 7853311, 106, 3470, 12723, 22231, 31483, 1548031, 3916799, 6285311, 73, 8557, 17810, 27318, 36570, 373759, 2742271, 5176575, 4389, 13641, 23150, 32402, 41911, 51163, 2026495, 4456447, 9472, 18724, 27976, 37485, 46737, 56246, 1834970, 4194303, 14080, 23296, 32803, 42055, 51564, 60816, 2031541, 4456409, 18176, 27648, 36864, 46116, 55624, 392556, 2752401, 5177269, 21760, 30976, 40192, 49667, 58919, 1572683, 3932016, 6291348, 24320, 33536, 43008, 52224, 716810, 3079982, 5504851, 7864183, 25856, 35328, 44544, 250368, 2619136, 4980503, 7405371, 9764703, 26624, 35840, 45312, 2413824, 4782336, 7143173, 9568041, 11927374, 26112, 35584, 2338560, 4707328, 7141376, 9502464, 11927326, 14286659, 24832, 2393344, 4762112, 7196160, 9564928, 11992832, 14352155, 16711487, 2447360, 4815872, 7250176, 9618688, 12052992, 14417664, 16776990, 16777027, 4803328, 7172096, 9606144, 11974912, 14343424, 16776965, 16777001, 16777038, 6962176, 9330688, 11764992, 14133504, 16502272, 16773655, 16777019, 16777055, 8858112, 11226880, 13660928, 16029440, 16759818, 16769070, 16777043, 16777079, 10426112, 12794624, 15163392, 16745475, 16754727, 16764235, 16773488, 16777108, 11534848, 13969152, 16337664, 16740388, 16749640, 16759148, 16768401, 16777141, 12255232, 14684928, 16725795, 16735047, 16744556, 16753808, 16763317, 16772569],
    'c64': [0x000000, 0xffffff, 0x2b3768, 0xb2a470, 0x863d6f, 0x438d58, 0x792835, 0x6fc7b8, 0x254f6f, 0x003943, 0x59679a, 0x444444, 0x6c6c6c, 0x84d29a, 0xb55e6c, 0x959595],
};
var PREDEF_LAYOUTS = {
    'nes': [
        ['Screen Color', 0x00, 1],
        ['Background 0', 0x01, 3],
        ['Background 1', 0x05, 3],
        ['Background 2', 0x09, 3],
        ['Background 3', 0x0d, 3],
        ['Sprite 0', 0x11, 3],
        ['Sprite 1', 0x15, 3],
        ['Sprite 2', 0x19, 3],
        ['Sprite 3', 0x1d, 3]
    ],
    'astrocade': [
        ['Left', 0x00, -4],
        ['Right', 0x04, -4]
    ],
    // Pac-Man: each palette PROM entry is 4 pens (indices into the 32-color PROM).
    // Arrays tagged layout:"pacman" should store those pens as already-resolved color-PROM bytes.
    'pacman': [
        ['Pal 01', 0x00, 4],
        ['Pal 03', 0x04, 4],
        ['Pal 05', 0x08, 4],
        ['Pal 07', 0x0c, 4],
        ['Pal 09', 0x10, 4],
        ['Pal 10', 0x14, 4],
        ['Pal 11', 0x18, 4],
        ['Pal 14', 0x1c, 4],
        ['Pal 19', 0x20, 4],
    ],
};
/////
function equalArrays(a, b) {
    if (a == null || b == null)
        return false;
    if (a.length !== b.length)
        return false;
    if (a === b)
        return true;
    for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
function equalNestedArrays(a, b) {
    if (a == null || b == null)
        return false;
    if (a.length !== b.length)
        return false;
    if (a === b)
        return true;
    for (var i = 0; i < a.length; i++) {
        if (!equalArrays(a[i], b[i]))
            return false;
    }
    return true;
}
class PixNode {
    refreshLeft() {
        var p = this;
        while (p) {
            p.updateLeft();
            p = p.left;
        }
    }
    refreshRight() {
        var p = this;
        while (p) {
            p.updateRight();
            p = p.right;
        }
    }
    addRight(node) {
        this.right = node;
        node.left = this;
        return node;
    }
    addLeft(node) {
        this.left = node;
        node.right = this;
        return node;
    }
}
exports.PixNode = PixNode;
class CodeProjectDataNode extends PixNode {
}
class FileDataNode extends CodeProjectDataNode {
    constructor(project, fileid) {
        super();
        this.project = project;
        this.fileid = fileid;
        this.label = fileid;
    }
    updateLeft() {
        //if (equalArrays(this.words, this.right.words)) return false;
        this.words = this.right.words;
        if (this.project) {
            this.project.updateFile(this.fileid, this.words);
        }
        return true;
    }
    updateRight() {
        if (this.project) {
            this.words = this.project.project.getFile(this.fileid);
        }
        return true;
    }
}
exports.FileDataNode = FileDataNode;
class TextDataNode extends CodeProjectDataNode {
    constructor(project, fileid, label, start, end, bpw) {
        super();
        this.project = project;
        this.fileid = fileid;
        this.label = label;
        this.bpw = bpw || 8;
        this.rangeId = `asset_${TextDataNode.nextRangeId++}`;
        this.project.setAssetRange(this.fileid, this.rangeId, start, end);
    }
    updateLeft() {
        if (this.right.words.length != this.words.length)
            throw Error("Cannot put " + this.right.words.length + " image bytes into array of " + this.words.length + " bytes");
        this.words = this.right.words;
        var datastr = this.project.getAssetText(this.fileid, this.rangeId);
        if (datastr == null)
            throw Error("Could not find source code range for asset " + this.fileid);
        datastr = replaceHexWords(datastr, this.words, this.bpw);
        // CM6 state field automatically remaps all tracked ranges.
        this.project.replaceAssetText(this.fileid, this.rangeId, datastr);
        return true;
    }
    updateRight() {
        var datastr = this.project.getAssetText(this.fileid, this.rangeId);
        if (datastr == null)
            throw Error("Could not find source code range for asset " + this.fileid);
        datastr = convertToHexStatements(datastr);
        var words = parseHexWords(datastr);
        this.words = words;
        return true;
    }
}
exports.TextDataNode = TextDataNode;
TextDataNode.nextRangeId = 0;
class Compressor extends PixNode {
    updateLeft() {
        // TODO: can't modify length of rle bytes
        return false;
    }
    updateRight() {
        this.words = (0, util_1.rle_unpack)(new Uint8Array(this.left.words));
        return true;
    }
}
exports.Compressor = Compressor;
class Mapper extends PixNode {
    constructor(fmt) {
        super();
        this.fmt = fmt;
    }
    updateLeft() {
        //if (equalNestedArrays(this.images, this.right.images)) return false;
        this.images = this.right.images;
        this.words = convertImagesToWords(this.images, this.fmt);
        return true;
    }
    updateRight() {
        if (equalArrays(this.words, this.left.words))
            return false;
        // convert each word array to images
        this.words = this.left.words;
        this.images = convertWordsToImages(this.words, this.fmt);
        return true;
    }
}
exports.Mapper = Mapper;
class RGBAPalette {
    constructor(palcols) {
        this.palcols = palcols;
    }
    indexOf(rgba) {
        return this.palcols.indexOf(rgba);
    }
}
class Palettizer extends PixNode {
    // TODO: control to select palette for bitmaps
    constructor(context, fmt) {
        super();
        this.palindex = 0;
        this.context = context;
        // Pac-Man strip bitmaps are always 2bpp (4 pens), even if bpp is omitted.
        if (fmt.pacstrip)
            this.ncolors = 4;
        else
            this.ncolors = 1 << ((fmt.bpp || 1) * (fmt.np || 1));
    }
    updateLeft() {
        if (this.right) {
            this.rgbimgs = this.right.rgbimgs;
        } // TODO: check is for unit test, remove?
        var pal = new RGBAPalette(this.palette);
        var newimages = this.rgbimgs.map((im) => {
            var out = new Uint8Array(im.length);
            for (var i = 0; i < im.length; i++) {
                out[i] = pal.indexOf(im[i]);
            }
            return out;
        });
        // have to do it this way b/c pixel editor modifies arrays
        //if (equalNestedArrays(newimages, this.images)) return false;
        this.images = newimages;
        return true;
    }
    updateRight() {
        if (!this.updateRefs() && equalNestedArrays(this.images, this.left.images))
            return false;
        this.images = this.left.images;
        var mask = this.palette.length - 1; // must be power of 2
        // for each image, map bytes to RGB colors
        this.rgbimgs = this.images.map((im) => {
            var out = new Uint32Array(im.length);
            for (var i = 0; i < im.length; i++) {
                out[i] = this.palette[im[i] & mask];
            }
            return out;
        });
        return true;
    }
    updateRefs() {
        var newpalette;
        if (this.context != null) {
            this.paloptions = this.context.getPalettes(this.ncolors);
            if (this.paloptions && this.paloptions.length > 0) {
                newpalette = this.paloptions[this.palindex].palette;
            }
        }
        if (newpalette == null) {
            if (this.ncolors <= 2)
                newpalette = new Uint32Array([0xff000000, 0xffffffff]);
            else
                newpalette = new Uint32Array([0xff000000, 0xffff00ff, 0xffffff00, 0xffffffff]); // TODO: more palettes
        }
        if (equalArrays(this.palette, newpalette))
            return false;
        this.palette = newpalette;
        return true;
    }
}
exports.Palettizer = Palettizer;
function dedupPalette(cols) {
    var dup = new Map();
    var res = new Uint32Array(cols.length);
    var ndups = 0;
    for (var i = 0; i < cols.length; i++) {
        var n = cols[i];
        while (dup[n]) {
            n ^= ++ndups;
        }
        res[i] = n;
        dup[n] = 1;
    }
    return res;
}
class PaletteFormatToRGB extends PixNode {
    constructor(palfmt) {
        super();
        this.palfmt = palfmt;
    }
    updateLeft() {
        //TODO
        return true;
    }
    updateRight() {
        if (equalArrays(this.words, this.left.words))
            return false;
        this.words = this.left.words;
        var cols = convertPaletteFormat(this.words, this.palfmt);
        // Keep exact PROM colors for Pac-Man (and any layout slices). Dedup is only
        // for flat palette grids where identical swatches need unique edit identities.
        this.palette = (this.palfmt.layout || this.palfmt.pal === 'pacman')
            ? new Uint32Array(cols) : dedupPalette(cols);
        this.layout = PREDEF_LAYOUTS[this.palfmt.layout];
        this.rgbimgs = [];
        this.palette.forEach((rgba) => {
            this.rgbimgs.push(new Uint32Array([rgba]));
        });
        return true;
    }
    getAllColors() {
        var arr = [];
        for (var i = 0; i < getPaletteLength(this.palfmt); i++)
            arr.push(i);
        return convertPaletteFormat(arr, this.palfmt);
    }
}
exports.PaletteFormatToRGB = PaletteFormatToRGB;
class PaletteEditorView extends PixNode {
    constructor(updateCells) {
        super();
        this.updateCells = updateCells;
    }
    updateLeft() {
        return true;
    }
    updateRight() {
        this.updateCells();
        return true;
    }
}
exports.PaletteEditorView = PaletteEditorView;
class Compositor extends PixNode {
    constructor(context) {
        super();
        this.tileindex = 0;
        this.context = context;
    }
    updateRefs() {
        var oldtilemap = this.tilemap;
        if (this.context != null) {
            this.tileoptions = this.context.getTilemaps(256);
            if (this.tileoptions && this.tileoptions.length > 0) {
                this.tilemap = this.tileoptions[this.tileindex].images;
            }
        }
        return !equalNestedArrays(oldtilemap, this.tilemap);
    }
}
exports.Compositor = Compositor;
class MetaspriteCompositor extends Compositor {
    constructor(context, metadefs) {
        super(context);
        this.metadefs = metadefs;
    }
    updateLeft() {
        // TODO
        return false;
    }
    updateRight() {
        this.updateRefs();
        this.width = 16; // TODO
        this.height = 16; // TODO
        var idata = new Uint8Array(this.width * this.height);
        this.images = [idata];
        this.metadefs.forEach((meta) => {
            // TODO
        });
        return true;
    }
}
exports.MetaspriteCompositor = MetaspriteCompositor;
class NESNametableConverter extends Compositor {
    constructor(context) {
        super(context);
    }
    updateLeft() {
        // TODO
        return false;
    }
    updateRight() {
        if (!this.updateRefs() && equalArrays(this.words, this.left.words))
            return false;
        this.words = this.left.words;
        this.cols = 32;
        this.rows = 30;
        this.width = this.cols * 8;
        this.height = this.rows * 8;
        this.baseofs = 0;
        var idata = new Uint8Array(this.width * this.height);
        this.images = [idata];
        var a = 0;
        var attraddr;
        for (var row = 0; row < this.rows; row++) {
            for (var col = 0; col < this.cols; col++) {
                var name = this.words[this.baseofs + a];
                if (typeof name === 'undefined')
                    throw Error("No name for address " + this.baseofs + " + " + a);
                var t = this.tilemap[name];
                if (!t)
                    throw Error("No tilemap found for tile index " + name);
                attraddr = (a & 0x2c00) | 0x3c0 | (a & 0x0C00) | ((a >> 4) & 0x38) | ((a >> 2) & 0x07);
                var attr = this.words[attraddr];
                var tag = name ^ (attr << 9) ^ 0x80000000;
                var i = row * this.cols * 8 * 8 + col * 8;
                var j = 0;
                var attrshift = (col & 2) + ((a & 0x40) >> 4);
                var coloradd = ((attr >> attrshift) & 3) << 2;
                for (var y = 0; y < 8; y++) {
                    for (var x = 0; x < 8; x++) {
                        var color = t[j++];
                        if (color)
                            color += coloradd;
                        idata[i++] = color;
                    }
                    i += this.cols * 8 - 8;
                }
                a++;
            }
        }
        // TODO
        return true;
    }
}
exports.NESNametableConverter = NESNametableConverter;
///// UI CONTROLS
class ImageChooser {
    constructor() {
        this.gapX = null;
    }
    recreate(parentdiv, onclick) {
        var agrid = $('<div class="asset_grid"/>'); // grid (or 1) of preview images
        parentdiv.empty().append(agrid);
        this.viewers = [];
        var cscale = Math.max(2, Math.ceil(16 / this.width)); // TODO
        var imgsperline = this.width <= 8 ? 16 : 8; // TODO
        var span = null;
        this.rgbimgs.forEach((imdata, i) => {
            var viewer = new Viewer();
            viewer.width = this.width;
            viewer.height = this.height;
            viewer.gapX = this.gapX;
            viewer.recreate();
            viewer.canvas.style.width = (viewer.displayWidth * cscale) + 'px'; // TODO
            viewer.canvas.title = '$' + (0, util_1.hex)(i);
            viewer.updateImage(imdata);
            $(viewer.canvas).addClass('asset_cell');
            $(viewer.canvas).click((e) => {
                onclick(i, viewer);
            });
            this.viewers.push(viewer);
            if (!span) {
                span = $('<span/>');
                agrid.append(span);
            }
            span.append(viewer.canvas);
            var brk = (i % imgsperline) == imgsperline - 1;
            if (brk) {
                agrid.append($("<br/>"));
                span = null;
            }
        });
    }
    updateImages(rgbimgs) {
        this.rgbimgs = rgbimgs;
        for (var i = 0; i < this.viewers.length; i++) {
            this.viewers[i].updateImage(rgbimgs[i]);
        }
    }
}
exports.ImageChooser = ImageChooser;
function newDiv(parent, cls) {
    var div = $(document.createElement("div"));
    if (parent)
        div.appendTo(parent);
    if (cls)
        div.addClass(cls);
    return div;
}
class CharmapEditor extends PixNode {
    constructor(context, parentdiv, fmt) {
        super();
        this.context = context;
        this.parentdiv = parentdiv;
        this.fmt = fmt;
    }
    updateLeft() {
        return true;
    }
    updateRight() {
        if (equalNestedArrays(this.rgbimgs, this.left.rgbimgs))
            return false;
        this.rgbimgs = this.left.rgbimgs;
        // if chooser already exists with same number of images, update in place
        if (this.chooser && this.chooser.viewers && this.chooser.viewers.length == this.rgbimgs.length) {
            this.updateArtInfo();
            this.chooser.updateImages(this.rgbimgs);
            // keep rgbimgs pointing to viewer buffers so edits propagate back via refreshLeft
            for (var i = 0; i < this.chooser.viewers.length; i++) {
                this.rgbimgs[i] = this.chooser.viewers[i].rgbdata;
            }
            return true;
        }
        var adual = newDiv(this.parentdiv.empty(), "asset_dual"); // contains grid and editor
        var agrid = newDiv(adual);
        var aeditor = newDiv(adual, "asset_editor").hide(); // contains editor, when selected
        // add image chooser grid
        var chooser = this.chooser = new ImageChooser();
        chooser.rgbimgs = this.rgbimgs;
        chooser.width = this.fmt.w || 1;
        chooser.height = this.fmt.h || 1;
        var artBit = getArtBit(this.fmt);
        if (artBit != null) {
            chooser.gapX = this.fmt.brev ? artBit + 1 : artBit;
        }
        chooser.recreate(agrid, (index, viewer) => {
            // TODO: variable scale?
            const aspect = this.fmt.aspect || 1.0;
            const yscale = Math.min(MAX_SCALE, MAX_SIZE_X / (viewer.displayWidth * aspect), MAX_SIZE_Y / this.fmt.h);
            const xscale = yscale * aspect;
            this.createEditor(aeditor, viewer, xscale, yscale);
            this.context.setCurrentEditor(aeditor, $(viewer.canvas), this);
            this.rgbimgs[index] = viewer.rgbdata;
        });
        this.updateArtInfo();
        if (this.fmt.art) {
            for (var i = 0; i < this.chooser.viewers.length; i++) {
                this.chooser.viewers[i].updateImage();
            }
        }
        // add palette selector
        // TODO: only view when editing?
        var palizer = this.left;
        if (palizer instanceof Palettizer && palizer.paloptions.length > 1) {
            var palselect = $(document.createElement('select'));
            palizer.paloptions.forEach((palopt, i) => {
                // TODO: full identifier
                var sel = $(document.createElement('option')).text(palopt.name).val(i).appendTo(palselect);
                if (i == palizer.palindex)
                    sel.attr('selected', 'selected');
            });
            palselect.appendTo(agrid).change((e) => {
                var index = $(e.target).val();
                palizer.palindex = index;
                palizer.refreshRight();
            });
        }
        return true;
    }
    updateArtInfo() {
        if (!this.fmt.art || !this.chooser || !this.chooser.viewers)
            return;
        var bitsperword = this.fmt.bpw || 8;
        var artBit = getArtBit(this.fmt);
        var indexedImages = this.left.images;
        if (!indexedImages)
            return;
        for (var i = 0; i < this.chooser.viewers.length; i++) {
            var viewer = this.chooser.viewers[i];
            viewer.artInfo = {
                artBit: artBit,
                bitsperword: bitsperword,
                indexedImage: indexedImages[i]
            };
        }
    }
    createEditor(aeditor, viewer, xscale, yscale) {
        var im = new PixEditor();
        im.createWith(viewer);
        im.updateImage();
        var w = im.displayWidth * xscale;
        var h = viewer.height * yscale;
        im.canvas.style.width = w + 'px'; // TODO
        im.canvas.style.height = h + 'px'; // TODO
        im.makeEditable(this, aeditor, this.left.palette);
        return im;
    }
}
exports.CharmapEditor = CharmapEditor;
class MapEditor extends PixNode {
    constructor(context, parentdiv, fmt) {
        super();
        this.context = context;
        this.parentdiv = parentdiv;
        this.fmt = fmt;
    }
    updateLeft() {
        return true;
    }
    updateRight() {
        if (equalNestedArrays(this.rgbimgs, this.left.rgbimgs))
            return false;
        this.rgbimgs = this.left.rgbimgs;
        var adual = newDiv(this.parentdiv.empty(), "asset_dual"); // contains grid and editor
        var agrid = newDiv(adual);
        var aeditor = newDiv(adual, "asset_editor").hide(); // contains editor, when selected
        // add image chooser grid
        var viewer = new Viewer();
        viewer.width = this.fmt.w;
        viewer.height = this.fmt.h;
        viewer.recreate();
        viewer.updateImage(this.rgbimgs[0]);
        agrid.append(viewer.canvas);
        return true;
    }
}
exports.MapEditor = MapEditor;
class Viewer {
    constructor() {
        this.gapX = null;
        this.artInfo = null;
    }
    get displayWidth() {
        return this.width + (this.gapX != null ? 1 : 0);
    }
    recreate() {
        this.canvas = this.newCanvas();
        this.imagedata = this.ctx.createImageData(this.width, this.height);
        this.rgbdata = new Uint32Array(this.imagedata.data.buffer);
        if (this.gapX != null) {
            this.displayImageData = this.ctx.createImageData(this.displayWidth, this.height);
            this.displayRgbData = new Uint32Array(this.displayImageData.data.buffer);
        }
        this.peerviewers = [this];
    }
    createWith(pv) {
        this.width = pv.width;
        this.height = pv.height;
        this.gapX = pv.gapX;
        this.imagedata = pv.imagedata;
        this.rgbdata = pv.rgbdata;
        this.canvas = this.newCanvas();
        if (this.gapX != null) {
            this.displayImageData = this.ctx.createImageData(this.displayWidth, this.height);
            this.displayRgbData = new Uint32Array(this.displayImageData.data.buffer);
        }
        pv.peerviewers.push(this);
        this.peerviewers = pv.peerviewers;
        this.artInfo = pv.artInfo;
    }
    newCanvas() {
        var c = document.createElement('canvas');
        c.width = this.displayWidth;
        c.height = this.height;
        //if (fmt.xform) c.style.transform = fmt.xform;
        c.classList.add("pixels");
        c.classList.add("pixelated");
        this.ctx = c.getContext('2d');
        return c;
    }
    updateImage(imdata) {
        if (imdata) {
            this.rgbdata.set(imdata);
        }
        for (let v of this.peerviewers) {
            if (v.gapX != null && v.displayRgbData) {
                var gx = v.gapX;
                var dw = v.displayWidth;
                for (var y = 0; y < this.height; y++) {
                    var srcOfs = y * this.width;
                    var dstOfs = y * dw;
                    for (var x = 0; x < gx; x++) {
                        v.displayRgbData[dstOfs + x] = this.rgbdata[srcOfs + x];
                    }
                    v.displayRgbData[dstOfs + gx] = 0x00000000; // Transparent gap column.
                    for (var x = gx; x < this.width; x++) {
                        v.displayRgbData[dstOfs + x + 1] = this.rgbdata[srcOfs + x];
                    }
                }
                v.ctx.putImageData(v.displayImageData, 0, 0);
            }
            else {
                v.ctx.putImageData(this.imagedata, 0, 0);
            }
        }
    }
}
exports.Viewer = Viewer;
var pixelClipboard = null;
function getPixelClipboard() {
    return pixelClipboard;
}
function setPixelClipboard(clip) {
    pixelClipboard = clip;
}
// Paste clipboard pixels over the top-left of the destination image, clipped to
// whichever is smaller. Colors are matched by palette index, not by RGB value,
// so a tile copied under one palette keeps its shape under another.
function pasteClipboardPixels(clip, dstpixels, dstwidth, dstheight, dstpalette) {
    var remap = new Map();
    for (var i = 0; i < clip.palette.length; i++) {
        if (!remap.has(clip.palette[i]))
            remap.set(clip.palette[i], dstpalette[i & (dstpalette.length - 1)]);
    }
    var result = dstpixels.slice();
    var w = Math.min(clip.width, dstwidth);
    var h = Math.min(clip.height, dstheight);
    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            var rgba = clip.pixels[y * clip.width + x];
            var mapped = remap.get(rgba);
            result[y * dstwidth + x] = mapped !== undefined ? mapped : rgba;
        }
    }
    return result;
}
class PixEditor extends Viewer {
    constructor() {
        super(...arguments);
        this.curpalcol = -1;
        this.offscreen = new Map();
    }
    getPositionFromEvent(e) {
        var dw = this.displayWidth;
        var x = Math.floor(e.offsetX * dw / $(this.canvas).width());
        var y = Math.floor(e.offsetY * this.height / $(this.canvas).height());
        if (this.gapX != null && x > this.gapX)
            x--;
        return { x: x, y: y };
    }
    setPaletteColor(col) {
        col &= this.palette.length - 1;
        if (this.curpalcol != col) {
            if (this.curpalcol >= 0)
                this.palbtns[this.curpalcol].removeClass('selected');
            this.curpalcol = col;
            this.currgba = this.palette[col & this.palette.length - 1];
            this.palbtns[col].addClass('selected');
        }
    }
    makeEditable(leftnode, aeditor, palette) {
        this.left = leftnode;
        this.palette = palette;
        var dragcol;
        var dragging = false;
        var pxls = $(this.canvas);
        var artDragIdx = -1;
        pxls.mousedown((e) => {
            var pos = this.getPositionFromEvent(e);
            if (this.isArtPixel(pos.x)) {
                artDragIdx = this.toggleArtPixel(pos.x, pos.y);
                dragging = true;
                $(document).mouseup((e) => {
                    $(document).off('mouseup');
                    dragging = false;
                    artDragIdx = -1;
                    this.commit();
                });
                return;
            }
            dragcol = this.getPixel(pos.x, pos.y) == this.currgba ? this.palette[0] : this.currgba;
            this.setPixel(pos.x, pos.y, this.currgba);
            dragging = true;
            $(document).mouseup((e) => {
                $(document).off('mouseup');
                var pos = this.getPositionFromEvent(e);
                this.setPixel(pos.x, pos.y, dragcol);
                dragging = false;
                this.commit();
            });
        })
            .mousemove((e) => {
            var pos = this.getPositionFromEvent(e);
            if (!dragging)
                return;
            if (artDragIdx >= 0 && this.isArtPixel(pos.x)) {
                this.setArtPixel(pos.x, pos.y, artDragIdx);
            }
            else if (artDragIdx < 0 && !this.isArtPixel(pos.x)) {
                this.setPixel(pos.x, pos.y, dragcol);
            }
        });
        aeditor.empty();
        this.createToolbarButtons(aeditor[0]);
        aeditor.append(this.canvas);
        aeditor.append(this.createPaletteButtons());
        this.setPaletteColor(1);
    }
    isArtPixel(x) {
        if (!this.artInfo)
            return false;
        return (x % this.artInfo.bitsperword) == this.artInfo.artBit;
    }
    toggleArtPixel(x, y) {
        var info = this.artInfo;
        if (!info)
            return -1;
        var ofs = y * this.width + x;
        var newIdx = info.indexedImage[ofs] ? 0 : 1;
        this.setArtPixel(x, y, newIdx);
        return newIdx;
    }
    setArtPixel(x, y, idx) {
        var info = this.artInfo;
        if (!info)
            return;
        if (x < 0 || x >= this.width || y < 0 || y >= this.height)
            return;
        var ofs = y * this.width + x;
        if (info.indexedImage[ofs] == idx)
            return;
        info.indexedImage[ofs] = idx;
        this.rgbdata[ofs] = this.palette[idx];
        this.updateImage();
    }
    getPixel(x, y) {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return this.offscreen[x + ',' + y] | this.palette[0];
        }
        else {
            var ofs = x + y * this.width;
            return this.rgbdata[ofs];
        }
    }
    setPixel(x, y, rgba) {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            this.offscreen[x + ',' + y] = rgba;
        }
        else {
            var ofs = x + y * this.width;
            var oldrgba = this.rgbdata[ofs];
            if (oldrgba != rgba) {
                this.rgbdata[ofs] = rgba;
                this.updateImage();
            }
        }
    }
    createPaletteButtons() {
        this.palbtns = [];
        var span = newDiv(null, "asset_toolbar");
        for (var i = 0; i < this.palette.length; i++) {
            var btn = $(document.createElement('button')).addClass('palbtn');
            var rgb = this.palette[i] & 0xffffff;
            var color = "#" + (0, util_1.hex)((0, util_1.rgb2bgr)(rgb), 6);
            btn.click(this.setPaletteColor.bind(this, i));
            btn.css('backgroundColor', color).text(i.toString(16));
            btn.css('color', (rgb & 0x008000) ? 'black' : 'white');
            span.append(btn);
            this.palbtns.push(btn);
        }
        return span;
    }
    createToolbarButtons(parent) {
        var toolbar = new toolbar_1.Toolbar(parent, null);
        toolbar.add('ctrl+shift+h', 'Flip X', 'glyphicon-resize-horizontal', this.flipX.bind(this));
        toolbar.add('ctrl+shift+v', 'Flip Y', 'glyphicon-resize-vertical', this.flipY.bind(this));
        toolbar.add('ctrl+shift+9', 'Rotate', 'glyphicon-repeat', this.rotate90.bind(this));
        toolbar.add('ctrl+shift+left', 'Move Left', 'glyphicon-arrow-left', this.translate.bind(this, 1, 0));
        toolbar.add('ctrl+shift+right', 'Move Right', 'glyphicon-arrow-right', this.translate.bind(this, -1, 0));
        toolbar.add('ctrl+shift+up', 'Move Up', 'glyphicon-arrow-up', this.translate.bind(this, 0, 1));
        toolbar.add('ctrl+shift+down', 'Move Down', 'glyphicon-arrow-down', this.translate.bind(this, 0, -1));
        toolbar.newGroup();
        toolbar.add(null, 'Copy Image', 'glyphicon-copy', this.copyImage.bind(this));
        toolbar.add(null, 'Paste Image', 'glyphicon-paste', this.pasteImage.bind(this));
        // TODO: destroy toolbar?
    }
    // returns the image with art-bit columns removed, like remapPixels() operates on
    getStrippedPixels() {
        if (!this.artInfo) {
            return { pixels: this.rgbdata.slice(), width: this.width };
        }
        var bpw = this.artInfo.bitsperword;
        var strippedWidth = this.width - Math.floor(this.width / bpw);
        var stripped = new Uint32Array(strippedWidth * this.height);
        this.copyNonArtPixels(stripped, strippedWidth, this.rgbdata, this.width);
        return { pixels: stripped, width: strippedWidth };
    }
    copyImage() {
        var { pixels, width } = this.getStrippedPixels();
        setPixelClipboard({
            width: width,
            height: this.height,
            pixels: pixels,
            palette: this.palette.slice()
        });
    }
    pasteImage() {
        var clip = getPixelClipboard();
        if (!clip)
            return;
        var { pixels, width } = this.getStrippedPixels();
        var pasted = pasteClipboardPixels(clip, pixels, width, this.height, this.palette);
        this.remapPixels((x, y) => pasted[y * width + x]);
    }
    commit() {
        this.updateImage();
        try {
            this.left.refreshLeft();
        }
        catch (e) {
            console.log(e);
            alert(`Could not update source code. ${e}`);
        }
    }
    copyNonArtPixels(dst, dstWidth, src, srcWidth) {
        for (var y = 0; y < this.height; y++) {
            var si = 0, di = 0;
            for (var x = 0; x < this.width; x++) {
                var isArt = this.isArtPixel(x);
                if (!isArt)
                    dst[y * dstWidth + di] = src[y * srcWidth + si];
                if (!isArt || srcWidth === this.width)
                    si++;
                if (!isArt || dstWidth === this.width)
                    di++;
            }
        }
    }
    remapPixels(mapfn) {
        // Strip art bit columns so transforms ignore them.
        var savedRgb = this.rgbdata;
        var savedWidth = this.width;
        if (this.artInfo) {
            var bpw = this.artInfo.bitsperword;
            var strippedWidth = this.width - Math.floor(this.width / bpw);
            var stripped = new Uint32Array(strippedWidth * this.height);
            this.copyNonArtPixels(stripped, strippedWidth, this.rgbdata, this.width);
            this.rgbdata = stripped;
            this.width = strippedWidth;
        }
        // Apply the transform.
        var i = 0;
        var pixels = new Uint32Array(this.rgbdata.length);
        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                pixels[i++] = mapfn(x, y);
            }
        }
        // Restore art bit columns from the original data.
        this.rgbdata = savedRgb;
        this.width = savedWidth;
        if (this.artInfo) {
            this.copyNonArtPixels(this.rgbdata, this.width, pixels, strippedWidth);
        }
        else {
            this.rgbdata.set(pixels);
        }
        this.commit();
    }
    rotate(deg) {
        var s1 = Math.sin(deg * Math.PI / 180);
        var c1 = Math.cos(deg * Math.PI / 180);
        this.remapPixels((x, y) => {
            var xx = x + 0.5 - this.width / 2.0;
            var yy = y + 0.5 - this.height / 2.0;
            var xx2 = xx * c1 - yy * s1 + this.width / 2.0 - 0.5;
            var yy2 = yy * c1 + xx * s1 + this.height / 2.0 - 0.5;
            return this.getPixel(xx2, yy2);
        });
    }
    rotate90() {
        this.rotate(90);
    }
    flipX() {
        this.remapPixels((x, y) => {
            return this.getPixel(this.width - 1 - x, y);
        });
    }
    flipY() {
        this.remapPixels((x, y) => {
            return this.getPixel(x, this.height - 1 - y);
        });
    }
    translate(dx, dy) {
        this.remapPixels((x, y) => {
            return this.getPixel(x + dx, y + dy);
        });
    }
}
// TODO: not yet used
class TwoWayPixelConverter {
    constructor(width, height, bpp, colpp) {
        this.w = width;
        this.h = height;
        this.words = new Uint8Array(width * height);
        this.bitoffsets = new Uint32Array(width * height);
        this.coloffsets = new Uint32Array(width * height);
    }
    setPixel(x, y, col, bitofs, colofs) {
        var ofs = x + y * this.w;
        this.words[ofs] = col;
        this.bitoffsets[ofs] = bitofs;
        this.coloffsets[ofs] = colofs;
    }
}
class TwoWayMapper extends PixNode {
    constructor(pc) {
        super();
        this.pc = pc;
    }
    updateLeft() {
        //if (equalNestedArrays(this.images, this.right.images)) return false;
        this.images = this.right.images;
        this.words = this.pc.imageToWords(this.images[0]);
        return true;
    }
    updateRight() {
        if (equalArrays(this.words, this.left.words))
            return false;
        // convert each word array to images
        this.words = this.left.words;
        this.images = this.pc.wordsToImage(this.words);
        return true;
    }
}
exports.TwoWayMapper = TwoWayMapper;
//# sourceMappingURL=pixeleditor.js.map