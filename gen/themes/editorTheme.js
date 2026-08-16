"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editorTheme = void 0;
const view_1 = require("@codemirror/view");
// TODO: Move remaining colors into themes.
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
    ".cm-error-span": {
        textDecoration: "underline wavy red",
        backgroundColor: "rgba(255, 0, 0, 0.15)",
    },
    ".gutter-offset .cm-gutterElement": {
        paddingRight: "0.25em",
    },
    ".gutter-bytes .cm-gutterElement": {
        paddingLeft: "0.25em",
        paddingRight: "0.25em",
    },
    ".gutter-currentpc .cm-gutterElement": {
        color: "#ff66ee",
    },
    ".gutter-clock .cm-gutterElement": {
        paddingLeft: "0.25em",
        paddingRight: "0.25em",
    },
});
//# sourceMappingURL=editorTheme.js.map