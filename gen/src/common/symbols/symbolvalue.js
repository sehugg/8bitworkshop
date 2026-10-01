"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SYMBOL_BYTES = void 0;
exports.formatSymbolValue = formatSymbolValue;
const util_1 = require("../util");
// most bytes of one symbol a client gets (a big array is just a prefix)
exports.MAX_SYMBOL_BYTES = 32;
/** `$ADDR: $XX` for one byte; `$ADDR[size]: XX XX ...` (memory order) for more. */
function formatSymbolValue(s) {
    const bytes = s.bytes || [s.value];
    if (bytes.length === 1)
        return `$${(0, util_1.hex)(s.addr, 4)}: $${(0, util_1.hex)(bytes[0], 2)}`;
    const more = s.size > bytes.length ? ' ...' : '';
    return `$${(0, util_1.hex)(s.addr, 4)}[${s.size}]: ${bytes.map(b => (0, util_1.hex)(b, 2)).join(' ')}${more}`;
}
//# sourceMappingURL=symbolvalue.js.map