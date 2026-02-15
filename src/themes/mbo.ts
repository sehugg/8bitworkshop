import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags as t } from "@lezer/highlight"

export const mboTheme = EditorView.theme({
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

export const mboHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#ffb928" },
  { tag: [t.name, t.variableName, t.standard(t.name)], color: "#ffffec" },
  { tag: [t.deleted, t.macroName], color: "#00a8c6" }, // maps to cm-variable-2
  { tag: [t.processingInstruction, t.string, t.inserted], color: "#b4fdb7" }, // Updated string color
  { tag: t.number, color: "#33aadd" }, // Updated number color
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#00a8c6" },
  { tag: [t.propertyName, t.attributeName, t.tagName], color: "#9ddfe9" },
  { tag: t.definition(t.name), color: "#88eeff" }, // maps to cm-def
  { tag: t.typeName, color: "#ffb928" }, // maps to cm-variable-3
  { tag: t.bracket, color: "#fffffc", fontWeight: "bold" },
  { tag: t.comment, color: "#95958a" },
  { tag: t.link, color: "#f54b07" },
  { tag: t.meta, color: "#aaddaa" },
  { tag: t.invalid, color: "#ffffec", borderBottom: "1px solid #636363" },
]);

export const mbo = [
  mboTheme,
  syntaxHighlighting(mboHighlightStyle),
];