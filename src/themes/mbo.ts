import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags as t } from "@lezer/highlight"

export const mboTheme = EditorView.theme({
  "&": {
    backgroundColor: "#2c2c2c",
    color: "#ffffec",
    caretColor: "#ffffec"
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "#a29b8c7b !important"
  },
  ".cm-selectionMatch": {
    backgroundColor: "#ffffff30"
  },
  ".cm-activeLine": {
    backgroundColor: "#ffffff0a"
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

export const mboHighlightStyle = HighlightStyle.define([
  { tag: [t.processingInstruction], color: "#ff9cf7" },
  { tag: [t.keyword, t.controlKeyword, t.modifier], color: "#ffb928" },
  { tag: [t.name, t.standard(t.name), t.variableName], color: "#ffffec" },
  { tag: t.local(t.variableName), color: "#00a8c6" },
  { tag: [t.deleted, t.macroName], color: "#00a8c6" },
  { tag: [t.string, t.inserted], color: "#b4fdb7" },
  { tag: [t.number], color: "#3abff8" },
  { tag: [t.atom, t.bool], color: "#02c7ea" },
  { tag: t.definition(t.variableName), color: "#88eeff" },
  { tag: [t.propertyName, t.attributeName, t.tagName, t.self], color: "#9ddfe9" },
  { tag: t.definition(t.name), color: "#88eeff" },
  { tag: [t.special(t.keyword), t.special(t.variableName)], color: "#fdda93" },
  { tag: [t.typeName, t.standard(t.keyword)], color: "#ffb928" },
  { tag: [t.bracket, t.constant(t.modifier)], color: "#8fdedd", fontWeight: "bold" },
  { tag: t.comment, color: "#95958a" },
  { tag: t.link, color: "#f54b07" },
  { tag: t.meta, color: "#aaddaa" },
  { tag: t.namespace, color: "#ffffec" },
  { tag: t.invalid, color: "#ffffec", borderBottom: "1px solid #636363" },
]);

export const mbo = [
  mboTheme,
  syntaxHighlighting(mboHighlightStyle),
];
