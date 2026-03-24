"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertTabKeymap = exports.smartIndentKeymap = void 0;
const commands_1 = require("@codemirror/commands");
exports.smartIndentKeymap = [
    { key: "Tab", run: commands_1.indentMore },
    { key: "Shift-Tab", run: commands_1.indentLess },
];
exports.insertTabKeymap = [
    { key: "Tab", run: commands_1.insertTab },
    { key: "Shift-Tab", run: commands_1.indentLess },
];
//# sourceMappingURL=tabs.js.map