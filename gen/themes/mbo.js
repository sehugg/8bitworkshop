"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mbo = exports.mboHighlightStyle = exports.mboTheme = void 0;
const view_1 = require("@codemirror/view");
const language_1 = require("@codemirror/language");
const highlight_1 = require("@lezer/highlight");
exports.mboTheme = view_1.EditorView.theme({
    "&": {
        backgroundColor: "#2c2c2c",
        color: "#ffffec"
    },
    ".cm-content": {
        caretColor: "#ffffec"
    },
    "&.cm-focused .cm-cursor": {
        borderLeft: "1px solid #ffffec"
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
        backgroundColor: "rgba(113, 108, 98, .99) !important"
    },
    ".cm-gutters": {
        backgroundColor: "#4e4e4e",
        color: "#dadada",
        borderRight: "none"
    },
    ".cm-activeLine": {
        backgroundColor: "#494b4155"
    },
    ".cm-activeLineGutter": {
        backgroundColor: "#494b4155"
    },
    "&.cm-focused .cm-gutterElement.cm-activeLineGutter": {
        color: "#33ff33"
    },
    ".cm-linenumber": {
        color: "#dadada"
    },
    ".cm-matchingBracket": {
        color: "#33ff33 !important"
    }
}, { dark: true });
exports.mboHighlightStyle = language_1.HighlightStyle.define([
    { tag: highlight_1.tags.keyword, color: "#ffb928" },
    { tag: [highlight_1.tags.name, highlight_1.tags.standard(highlight_1.tags.name)], color: "#ffffec" },
    { tag: highlight_1.tags.variableName, color: "#9ddfe9" },
    { tag: [highlight_1.tags.deleted, highlight_1.tags.macroName], color: "#00a8c6" }, // maps to cm-variable-2
    { tag: [highlight_1.tags.processingInstruction, highlight_1.tags.string, highlight_1.tags.inserted], color: "#b4fdb7" }, // Updated string color
    { tag: highlight_1.tags.number, color: "#33aadd" }, // Updated number color
    { tag: [highlight_1.tags.atom, highlight_1.tags.bool, highlight_1.tags.special(highlight_1.tags.variableName)], color: "#00a8c6" },
    { tag: highlight_1.tags.definition(highlight_1.tags.variableName), color: "#ffb928" },
    { tag: [highlight_1.tags.propertyName, highlight_1.tags.attributeName, highlight_1.tags.tagName], color: "#9ddfe9" },
    { tag: highlight_1.tags.definition(highlight_1.tags.name), color: "#88eeff" }, // maps to cm-def
    { tag: highlight_1.tags.typeName, color: "#ffb928" }, // maps to cm-variable-3
    { tag: highlight_1.tags.bracket, color: "#fffffc", fontWeight: "bold" },
    { tag: highlight_1.tags.comment, color: "#95958a" },
    { tag: highlight_1.tags.link, color: "#f54b07" },
    { tag: highlight_1.tags.meta, color: "#aaddaa" },
    { tag: highlight_1.tags.invalid, color: "#ffffec", borderBottom: "1px solid #636363" },
]);
exports.mbo = [
    exports.mboTheme,
    (0, language_1.syntaxHighlighting)(exports.mboHighlightStyle),
];
//# sourceMappingURL=mbo.js.map