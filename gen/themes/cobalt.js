"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cobalt = void 0;
const view_1 = require("@codemirror/view");
const language_1 = require("@codemirror/language");
const highlight_1 = require("@lezer/highlight");
const cobaltTheme = view_1.EditorView.theme({
    "&": {
        backgroundColor: "#122c43",
        color: "#e6e6e6"
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
        backgroundColor: "#9191fb30 !important"
    },
    ".cm-selectionMatch": {
        backgroundColor: "#445e8bc7"
    },
    ".cm-activeLine": {
        backgroundColor: "#99eeff12"
    },
    ".cm-activeLineGutter": {
        backgroundColor: "#57707b42",
    },
    "&.cm-focused .cm-matchingBracket": {
        outline: "1px solid grey",
    },
    ".cm-gutters , .cm-panels": {
        backgroundColor: "#00305b",
        borderRight: "1px solid #666"
    },
    ".cm-lineNumbers .cm-gutterElement": {
        color: "#dadada4d"
    },
    ".gutter-bytes .cm-gutterElement": {
        color: "#0fddeeb0"
    },
    ".cm-highlightSpace": {
        backgroundImage: "radial-gradient(circle at 50% 55%, #aaaaaa45 11%, transparent 5%)"
    },
    ".cm-highlightTab": {
        backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"><path stroke="%23aaaaaa45" stroke-width="1" fill="none" d="M0 10H10L7 6M10 10L7 14"/></svg>')`,
        backgroundPosition: "left 50%"
    },
    ".tab-stop-ruler": {
        color: "rgba(255,255,255,0.35)",
        backgroundColor: "#002240",
        borderBottom: "2px solid #0055ff88",
    },
}, { dark: true });
const cobaltHighlightStyle = language_1.HighlightStyle.define([
    { tag: highlight_1.tags.standard(highlight_1.tags.keyword), color: "#99ff99" }, // Green (reserved words)
    { tag: [highlight_1.tags.name, highlight_1.tags.standard(highlight_1.tags.name)], color: "#eee" }, // Light gray identifiers
    { tag: highlight_1.tags.variableName, color: "#76f6ff" },
    { tag: highlight_1.tags.local(highlight_1.tags.variableName), color: "#ffff99" }, // Yellow for locals
    { tag: [highlight_1.tags.deleted, highlight_1.tags.macroName], color: "#ffbb99" }, // Pastel pink (macros/defines)
    { tag: [highlight_1.tags.processingInstruction, highlight_1.tags.keyword, highlight_1.tags.controlKeyword], color: "#c5bdff" }, //  keywords
    { tag: [highlight_1.tags.string, highlight_1.tags.inserted], color: "#68ff98" }, // Strings
    { tag: [highlight_1.tags.number, highlight_1.tags.modifier], color: "#ff99ff" }, // Magenta (numbers)
    { tag: [highlight_1.tags.atom, highlight_1.tags.bool, highlight_1.tags.special(highlight_1.tags.variableName)], color: "#ffc261" }, // Green
    { tag: highlight_1.tags.definition(highlight_1.tags.variableName), color: "#fff" }, // White (TP definitions)
    { tag: [highlight_1.tags.propertyName, highlight_1.tags.attributeName, highlight_1.tags.tagName, highlight_1.tags.self], color: "#b2ebf2" }, // Pastel cyan
    { tag: highlight_1.tags.definition(highlight_1.tags.name), color: "#f0f0f0" }, // Pale gray function definitions
    { tag: highlight_1.tags.typeName, color: "#9be8c5" }, // Pastel seafoam green
    { tag: highlight_1.tags.bracket, color: "#d8d8d8" },
    { tag: highlight_1.tags.comment, color: "#999" }, // Grey
    { tag: highlight_1.tags.link, color: "#c3b1e1" }, // Pastel purple
    { tag: highlight_1.tags.meta, color: "#ffd9a0" }, // Pastel orange (directives)
    { tag: highlight_1.tags.invalid, color: "#ff6666" }, // Invalid
    { tag: highlight_1.tags.operator, color: "#ffa3f0" }, // Operator
]);
exports.cobalt = [
    cobaltTheme,
    (0, language_1.syntaxHighlighting)(cobaltHighlightStyle),
];
//# sourceMappingURL=cobalt.js.map