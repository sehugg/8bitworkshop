"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseObjDump = parseObjDump;
const path_1 = __importDefault(require("path"));
function parseObjDump(lst) {
    // parse symbol map
    const lines = lst.split('\n');
    const symbolmap = {};
    const segments = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("Disassembly"))
            break;
        if (line.startsWith('0')) {
            const parts = line.split(/\s+/);
            if (parts.length < 5)
                continue;
            const symbol = parts[parts.length - 1];
            const address = parseInt(parts[0], 16) & 0xffff; // TODO: 32-bit addresses
            symbolmap[symbol] = address;
            // is it a segment?
            if (symbol.startsWith('__')) {
                if (symbol.endsWith('_start')) {
                    let name = symbol.substring(2, symbol.length - 6);
                    let type = parts[2] == '.text' ? 'rom' : 'ram';
                    segments.push({ name, start: address, size: 0, type });
                }
                else if (symbol.endsWith('_size')) {
                    let name = symbol.substring(2, symbol.length - 5);
                    let seg = segments.find(s => s.name === name);
                    if (seg)
                        seg.size = address;
                }
            }
        }
    }
    // parse listings
    const listings = {};
    var lastListing = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith(';')) {
            const fileInfoIndex = line.indexOf(':');
            if (fileInfoIndex !== -1) {
                const fileInfo = line.substring(1).trim();
                const fileParts = fileInfo.split(':');
                const file = path_1.default.basename(fileParts[0].trim()).split('.')[0] + '.lst';
                const lineNumber = parseInt(fileParts[1], 10);
                if (lineNumber > 0) {
                    if (!listings[file])
                        listings[file] = { lines: [], text: lst };
                    lastListing = listings[file];
                    lastListing.lines.push({ line: lineNumber, offset: null });
                }
            }
        }
        else if (lastListing && line.match(/^\s*[A-F0-9]+:.+/i)) {
            const offsetIndex = line.indexOf(':');
            if (offsetIndex !== -1) {
                const offset = parseInt(line.substring(0, offsetIndex).trim(), 16) & 0xffff; // TODO: 32-bit addresses;
                lastListing.lines[lastListing.lines.length - 1].offset = offset;
            }
        }
    }
    return { listings, symbolmap, segments };
}
//# sourceMappingURL=clang.js.map