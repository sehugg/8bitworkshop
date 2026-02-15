import { EditorView } from "@codemirror/view";

export const editorTheme = EditorView.theme({
    "&": {
        height: "100%",
    },
    ".cm-currentpc": {
        backgroundColor: "#7e2a70 !important",
    },
    ".currentpc-marker": {
        color: "#ff66ee",
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