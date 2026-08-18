import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags as t } from "@lezer/highlight"

const cobaltTheme = EditorView.theme({
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

const cobaltHighlightStyle = HighlightStyle.define([
  { tag: t.standard(t.keyword), color: "#99ff99" }, // Green (reserved words)
  { tag: [t.name, t.standard(t.name)], color: "#eee" }, // Light gray identifiers
  { tag: t.variableName, color: "#76f6ff" },
  { tag: t.local(t.variableName), color: "#ffff99" }, // Yellow for locals
  { tag: [t.deleted, t.macroName], color: "#ffbb99" }, // Pastel pink (macros/defines)
  { tag: [t.processingInstruction, t.keyword, t.controlKeyword], color: "#c5bdff" }, //  keywords
  { tag: [t.string, t.inserted], color: "#68ff98" }, // Strings
  { tag: [t.number, t.modifier], color: "#ff99ff" }, // Magenta (numbers)
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#ffc261" }, // Green
  { tag: t.definition(t.variableName), color: "#fff" }, // White (TP definitions)
  { tag: [t.propertyName, t.attributeName, t.tagName, t.self], color: "#b2ebf2" }, // Pastel cyan
  { tag: t.definition(t.name), color: "#f0f0f0" }, // Pale gray function definitions
  { tag: t.typeName, color: "#9be8c5" }, // Pastel seafoam green
  { tag: t.bracket, color: "#d8d8d8" },
  { tag: t.comment, color: "#999" }, // Grey
  { tag: t.link, color: "#c3b1e1" }, // Pastel purple
  { tag: t.meta, color: "#ffd9a0" }, // Pastel orange (directives)
  { tag: t.invalid, color: "#ff6666" }, // Invalid
  { tag: t.operator, color: "#ffa3f0" }, // Operator
]);

export const cobalt = [
  cobaltTheme,
  syntaxHighlighting(cobaltHighlightStyle),
];