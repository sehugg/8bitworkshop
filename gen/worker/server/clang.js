"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseObjDumpListing = exports.parseObjDumpSymbolTable = void 0;
const path_1 = __importDefault(require("path"));
function parseObjDumpSymbolTable(symbolTable) {
    const lines = symbolTable.split('\n');
    const result = {};
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('00')) {
            const parts = line.split(/\s+/);
            if (parts.length < 5)
                continue;
            const symbol = parts[parts.length - 1];
            const address = parseInt(parts[0], 16);
            result[symbol] = address;
        }
    }
    return result;
}
exports.parseObjDumpSymbolTable = parseObjDumpSymbolTable;
function parseObjDumpListing(lst) {
    const lines = lst.split('\n');
    const result = {};
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
                    if (!result[file])
                        result[file] = { lines: [], text: lst };
                    lastListing = result[file];
                    lastListing.lines.push({ line: lineNumber, offset: null });
                }
            }
        }
        else if (lastListing && line.match(/^\s*[A-F0-9]+:.+/i)) {
            const offsetIndex = line.indexOf(':');
            if (offsetIndex !== -1) {
                const offset = parseInt(line.substring(0, offsetIndex).trim(), 16);
                lastListing.lines[lastListing.lines.length - 1].offset = offset;
            }
        }
    }
    return result;
}
exports.parseObjDumpListing = parseObjDumpListing;
//# sourceMappingURL=clang.js.map