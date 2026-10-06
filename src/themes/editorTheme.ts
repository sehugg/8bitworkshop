import { EditorView } from "@codemirror/view";

// TODO: Move remaining colors into themes.
export const editorTheme = EditorView.theme({
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
    // Executed-line heat map: cold (rarely run) -> hot (frequently run).
    ".cm-traced-line": {},
    ".cm-traced-line-h0": {
        backgroundColor: "rgba(70, 120, 255, 0.18)",
    },
    ".cm-traced-line-h1": {
        backgroundColor: "rgba(80, 210, 170, 0.20)",
    },
    ".cm-traced-line-h2": {
        backgroundColor: "rgba(255, 200, 60, 0.22)",
    },
    ".cm-traced-line-h3": {
        backgroundColor: "rgba(255, 70, 50, 0.28)",
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