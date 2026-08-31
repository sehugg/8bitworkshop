"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTrailingComment = exports.extractDocComment = void 0;
exports.extractSymbols = extractSymbols;
var doccomment_1 = require("./doccomment");
Object.defineProperty(exports, "extractDocComment", { enumerable: true, get: function () { return doccomment_1.extractDocComment; } });
Object.defineProperty(exports, "extractTrailingComment", { enumerable: true, get: function () { return doccomment_1.extractTrailingComment; } });
function extractSymbols(text, filename, editorStyle, source) {
    // Basic fallback extraction using regex patterns
    const records = [];
    const lines = text.split('\n');
    // Simple patterns for common languages
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNo = i + 1;
        // Function/method definitions
        const funcMatch = line.match(/(?:function|func|def|proc)\s+(\w+)/i);
        if (funcMatch) {
            records.push({
                id: `${filename}:${lineNo}:${funcMatch[1]}`,
                name: funcMatch[1],
                kind: 'func',
                source,
                file: filename,
                line: lineNo
            });
        }
        // Variable/const declarations
        const varMatch = line.match(/(?:var|let|const|global)\s+(\w+)/i);
        if (varMatch) {
            records.push({
                id: `${filename}:${lineNo}:${varMatch[1]}`,
                name: varMatch[1],
                kind: 'var',
                source,
                file: filename,
                line: lineNo
            });
        }
        // Type definitions
        const typeMatch = line.match(/(?:struct|class|interface|type)\s+(\w+)/i);
        if (typeMatch) {
            records.push({
                id: `${filename}:${lineNo}:${typeMatch[1]}`,
                name: typeMatch[1],
                kind: 'type',
                source,
                file: filename,
                line: lineNo
            });
        }
        // Labels (assembly)
        const labelMatch = line.match(/^\s*(\w+)\s*:/);
        if (labelMatch && !line.trim().startsWith('//')) {
            records.push({
                id: `${filename}:${lineNo}:${labelMatch[1]}`,
                name: labelMatch[1],
                kind: 'label',
                source,
                file: filename,
                line: lineNo
            });
        }
        // Macros
        const macroMatch = line.match(/#define\s+(\w+)/i);
        if (macroMatch) {
            records.push({
                id: `${filename}:${lineNo}:${macroMatch[1]}`,
                name: macroMatch[1],
                kind: 'macro',
                source,
                file: filename,
                line: lineNo
            });
        }
        // Equates
        const equateMatch = line.match(/^\s*(\w+)\s*(?:=|equ)\s+/i);
        if (equateMatch) {
            records.push({
                id: `${filename}:${lineNo}:${equateMatch[1]}`,
                name: equateMatch[1],
                kind: 'equate',
                source,
                file: filename,
                line: lineNo
            });
        }
    }
    return records;
}
//# sourceMappingURL=index.js.map