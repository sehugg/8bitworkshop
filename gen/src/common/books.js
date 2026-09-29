"use strict";
// books - the 8bitworkshop books, and which one covers a platform.
// The IDE's Books menu and the VS Code extension's platform picker use it.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOOKS = void 0;
exports.bookFor = bookFor;
const util_1 = require("./util");
exports.BOOKS = [
    { id: 'vcs', title: 'Making Games For The Atari 2600', url: 'https://www.amazon.com/dp/1541021304', image: 'book_a2600.png',
        platforms: ['vcs'] },
    { id: 'arcade', title: 'Making 8-bit Arcade Games in C', url: 'https://www.amazon.com/dp/1545484759', image: 'book_arcade.png',
        platforms: ['mw8080bw', 'vicdual', 'galaxian', 'galaxian-scramble', 'vector-z80color', 'williams-z80'] },
    { id: 'verilog', title: 'Designing Video Game Hardware in Verilog', url: 'https://www.amazon.com/dp/1728619440', image: 'book_verilog.png',
        platforms: ['verilog'] },
    { id: 'nes', title: 'Making Games for the NES', url: 'https://www.amazon.com/dp/1075952727', image: 'book_nes.png',
        platforms: ['nes'] },
    { id: 'c64', title: 'Making Games for the C-64', url: 'https://www.amazon.com/dp/B0DMKH8NGL', image: 'book_c64.png',
        platforms: ['c64'] },
];
/** The book that covers a platform, if one does. */
function bookFor(platform) {
    var base = (0, util_1.getBasePlatform)(platform);
    var root = (0, util_1.getRootBasePlatform)(platform);
    return exports.BOOKS.find(b => b.platforms.includes(base))
        || exports.BOOKS.find(b => b.platforms.includes(root));
}
//# sourceMappingURL=books.js.map