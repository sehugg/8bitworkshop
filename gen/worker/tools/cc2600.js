"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compilecc2600 = compilecc2600;
const cc6502_1 = require("./cc6502");
function compilecc2600(step) {
    return (0, cc6502_1.compileCC6502)(step, { tool: "cc2600", fsZip: "cc2600-fs.zip" });
}
//# sourceMappingURL=cc2600.js.map