"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileCC7800 = compileCC7800;
const cc6502_1 = require("./cc6502");
function compileCC7800(step) {
    return (0, cc6502_1.compileCC6502)(step, { tool: "cc7800", fsZip: "cc7800-fs.zip" });
}
//# sourceMappingURL=cc7800.js.map