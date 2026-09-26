"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSymbolFile = parseSymbolFile;
exports.lookupSymbol = lookupSymbol;
/** Parse a cc65/ca65 or VICE label file into a symbol map. */
function parseSymbolFile(text) {
    const symbols = {};
    for (const line of text.split(/\r?\n/)) {
        const m1 = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*\$?([0-9A-Fa-f]+)\s*;/); // ca65/cc65 list
        const m2 = line.match(/^\s*(?:al|add_label)\s+([0-9A-Fa-f]+)\s+\.?([A-Za-z_][\w]*)/); // VICE
        if (m1)
            symbols[m1[1]] = parseInt(m1[2], 16);
        else if (m2)
            symbols[m2[2]] = parseInt(m2[1], 16);
    }
    return symbols;
}
/**
 * Look up a symbol the way a user types it: exactly, then with the leading
 * underscore C compilers add (`main` finds `_main`), then without a leading
 * '.' (VICE labels).
 */
function lookupSymbol(symbols, name) {
    if (!symbols)
        return undefined;
    if (name in symbols)
        return symbols[name];
    if ('_' + name in symbols)
        return symbols['_' + name];
    const bare = name.replace(/^\./, '');
    if (bare !== name && bare in symbols)
        return symbols[bare];
    return undefined;
}
//# sourceMappingURL=symbolfile.js.map