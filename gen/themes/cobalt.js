"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cobalt = void 0;
const view_1 = require("@codemirror/view");
const language_1 = require("@codemirror/language");
const highlight_1 = require("@lezer/highlight");
const cobaltTheme = view_1.EditorView.theme({
    "&": {
        color: "white",
        backgroundColor: "#002240"
    },
    ".cm-content": {
        caretColor: "white"
    },
    "&.cm-focused .cm-cursor": {
        borderLeft: "1px solid white"
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
        backgroundColor: "#f77b35 !important"
    },
    ".cm-gutters": {
        backgroundColor: "#002240",
        color: "#d0d0d0",
        borderRight: "1px solid #aaa"
    },
    ".cm-activeLine": {
        backgroundColor: "#0055ff88"
    },
    ".cm-activeLineGutter": {
        backgroundColor: "#0055ff88",
        color: "#ffee80"
    },
    "&.cm-focused .cm-matchingBracket": {
        outline: "1px solid grey",
        color: "white !important",
        backgroundColor: "transparent"
    },
}, { dark: true });
const cobaltHighlightStyle = language_1.HighlightStyle.define([
    { tag: highlight_1.tags.comment, color: "#ccc" },
    { tag: highlight_1.tags.atom, color: "#845dc4 " },
    { tag: [highlight_1.tags.number, highlight_1.tags.attributeName, highlight_1.tags.className, highlight_1.tags.constant(highlight_1.tags.name)], color: "#ff80e1" },
    { tag: highlight_1.tags.keyword, color: "#ffee80" },
    { tag: highlight_1.tags.string, color: "#3ad900" },
    { tag: highlight_1.tags.meta, color: "#ff9d00" },
    { tag: [highlight_1.tags.tagName, highlight_1.tags.variableName, highlight_1.tags.modifier, highlight_1.tags.labelName, highlight_1.tags.namespace], color: "#9effff" },
    { tag: [highlight_1.tags.definition(highlight_1.tags.variableName), highlight_1.tags.typeName, highlight_1.tags.className, highlight_1.tags.namespace, highlight_1.tags.definition(highlight_1.tags.propertyName)], color: "white" },
    { tag: highlight_1.tags.bracket, color: "#d8d8d8" },
    { tag: [highlight_1.tags.standard(highlight_1.tags.name), highlight_1.tags.special(highlight_1.tags.string), highlight_1.tags.special(highlight_1.tags.variableName)], color: "#ff9e59" },
    { tag: highlight_1.tags.link, color: "#845dc4" },
    { tag: highlight_1.tags.invalid, color: "#9d1e15" },
]);
exports.cobalt = [
    cobaltTheme,
    (0, language_1.syntaxHighlighting)(cobaltHighlightStyle),
];
//# sourceMappingURL=cobalt.js.map