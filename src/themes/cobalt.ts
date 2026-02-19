import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags as t } from "@lezer/highlight"

const cobaltTheme = EditorView.theme({
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

const cobaltHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: "#ccc" },
  { tag: t.atom, color: "#845dc4 " },
  { tag: [t.number, t.attributeName, t.className, t.constant(t.name)], color: "#ff80e1" },
  { tag: t.keyword, color: "#ffee80" },
  { tag: t.string, color: "#3ad900" },
  { tag: t.meta, color: "#ff9d00" },
  { tag: [t.tagName, t.variableName, t.modifier, t.labelName, t.namespace], color: "#9effff" },
  { tag: [t.definition(t.variableName), t.typeName, t.className, t.namespace, t.definition(t.propertyName)], color: "white" },
  { tag: t.bracket, color: "#d8d8d8" },
  { tag: [t.standard(t.name), t.special(t.string), t.special(t.variableName)], color: "#ff9e59" },
  { tag: t.link, color: "#845dc4" },
  { tag: t.invalid, color: "#9d1e15" },
]);

export const cobalt = [
  cobaltTheme,
  syntaxHighlighting(cobaltHighlightStyle),
];