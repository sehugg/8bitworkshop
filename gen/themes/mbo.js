"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mbo = exports.mboHighlightStyle = exports.mboTheme = void 0;
const view_1 = require("@codemirror/view");
const language_1 = require("@codemirror/language");
const highlight_1 = require("@lezer/highlight");
exports.mboTheme = view_1.EditorView.theme({
    "&": {
        backgroundColor: "#2c2c2c",
        color: "#ffffec",
        caretColor: "#ffffec"
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
        backgroundColor: "#716C62 !important"
    },
    ".cm-selectionMatch": {
        backgroundColor: "#ffffff30"
    },
    ".cm-activeLine": {
        backgroundColor: "#494b41"
    },
    ".cm-activeLineGutter": {
        backgroundColor: "#68686588"
    },
    ".cm-matchingBracket": {
        color: "#33ff33 !important"
    },
    ".cm-matchingTag": {
        backgroundColor: "rgba(255,255,255,0.37)"
    },
    ".cm-cursor": {
        borderLeftColor: "#ffffec"
    },
    ".cm-gutters , .cm-panels": {
        backgroundColor: "#4e4e4e"
    },
    ".cm-lineNumbers .cm-gutterElement": {
        color: "#dadada"
    },
    ".gutter-bytes .cm-gutterElement": {
        color: "#999"
    },
    ".cm-highlightSpace": {
        backgroundImage: "radial-gradient(circle at 50% 55%, #aaaaaa45 11%, transparent 5%)"
    },
    ".cm-highlightTab": {
        backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"><path stroke="%23aaaaaa45" stroke-width="1" fill="none" d="M0 10H10L7 6M10 10L7 14"/></svg>')`,
        backgroundPosition: "left 50%"
    },
    ".tab-stop-ruler": {
        color: "rgba(255,255,255,0.25)",
        backgroundColor: "#202020",
        borderBottom: "2px solid #4e4e4e",
    },
}, { dark: true });
exports.mboHighlightStyle = language_1.HighlightStyle.define([
    { tag: [highlight_1.tags.keyword, highlight_1.tags.controlKeyword, highlight_1.tags.processingInstruction], color: "#fdbcf8" },
    { tag: [highlight_1.tags.name, highlight_1.tags.standard(highlight_1.tags.name), highlight_1.tags.variableName], color: "#ffffec" },
    { tag: highlight_1.tags.local(highlight_1.tags.variableName), color: "#00a8c6" },
    { tag: [highlight_1.tags.deleted, highlight_1.tags.macroName], color: "#00a8c6" },
    { tag: [highlight_1.tags.string, highlight_1.tags.inserted], color: "#b4fdb7" },
    { tag: [highlight_1.tags.number], color: "#3abff8" },
    { tag: [highlight_1.tags.modifier], color: "#fba3f4" },
    { tag: [highlight_1.tags.atom, highlight_1.tags.bool], color: "#02c7ea" },
    { tag: highlight_1.tags.definition(highlight_1.tags.variableName), color: "#88eeff" },
    { tag: [highlight_1.tags.propertyName, highlight_1.tags.attributeName, highlight_1.tags.tagName, highlight_1.tags.self], color: "#9ddfe9" },
    { tag: highlight_1.tags.definition(highlight_1.tags.name), color: "#88eeff" },
    { tag: [highlight_1.tags.special(highlight_1.tags.keyword), highlight_1.tags.special(highlight_1.tags.variableName)], color: "#fdda93" },
    { tag: [highlight_1.tags.typeName, highlight_1.tags.standard(highlight_1.tags.keyword)], color: "#ffb928" },
    { tag: [highlight_1.tags.bracket, highlight_1.tags.constant(highlight_1.tags.modifier)], color: "#8fdedd", fontWeight: "bold" },
    { tag: highlight_1.tags.comment, color: "#95958a" },
    { tag: highlight_1.tags.link, color: "#f54b07" },
    { tag: highlight_1.tags.meta, color: "#aaddaa" },
    { tag: highlight_1.tags.namespace, color: "#ffffec" },
    { tag: highlight_1.tags.invalid, color: "#ffffec", borderBottom: "1px solid #636363" },
]);
exports.mbo = [
    exports.mboTheme,
    (0, language_1.syntaxHighlighting)(exports.mboHighlightStyle),
];
//# sourceMappingURL=mbo.js.map