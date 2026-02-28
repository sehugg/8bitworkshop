"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editorTheme = void 0;
const view_1 = require("@codemirror/view");
exports.editorTheme = view_1.EditorView.theme({
    "&": {
        height: "100%",
    },
    ".cm-currentpc": {
        backgroundColor: "#7e2a70 !important",
    },
    ".currentpc-span-blocked": {
        backgroundColor: "#7e2a70 !important",
    },
    ".currentpc-marker-blocked": {
        color: "#ffee33",
    },
    ".highlight-lines": {
        backgroundColor: "#003399 !important",
    },
    ".gutter-offset": {
        marginRight: "0.25em",
    },
    ".gutter-bytes": {
        marginLeft: "0.25em",
        marginRight: "0.25em",
        opacity: 0.7,
    },
    ".gutter-currentpc": {
        color: "#ff66ee",
    },
    ".gutter-clock": {
        marginLeft: "0.25em",
        marginRight: "0.25em",
    },
    "& .cm-lineNumbers .cm-gutterElement": {
        color: "#99cc99",
    },
});
//# sourceMappingURL=editorTheme.js.map