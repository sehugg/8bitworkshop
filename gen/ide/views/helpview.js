"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelpView = exports.HELP_TOPICS = void 0;
exports.resolveHelpId = resolveHelpId;
exports.getHelpTopic = getHelpTopic;
exports.helpTopicForView = helpTopicForView;
exports.renderHelpBody = renderHelpBody;
const DOMPurify = require("dompurify");
const baseviews_1 = require("./baseviews");
const docssource_1 = require("../search/docssource");
// Help docs are Markdown files under src/docs. The esbuild plugin in
// build/md-loader.mjs renders each import to an HTML string at build time;
// src/md.d.ts supplies the ambient module type for `tsc`.
const index_md_1 = __importDefault(require("../../docs/index.md"));
const editor_md_1 = __importDefault(require("../../docs/editor.md"));
const disasm_md_1 = __importDefault(require("../../docs/disasm.md"));
const memory_md_1 = __importDefault(require("../../docs/memory.md"));
const memmap_md_1 = __importDefault(require("../../docs/memmap.md"));
const vram_md_1 = __importDefault(require("../../docs/vram.md"));
const memprobe_md_1 = __importDefault(require("../../docs/memprobe.md"));
const crtprobe_md_1 = __importDefault(require("../../docs/crtprobe.md"));
const probelog_md_1 = __importDefault(require("../../docs/probelog.md"));
const scanlineio_md_1 = __importDefault(require("../../docs/scanlineio.md"));
const symbols_md_1 = __importDefault(require("../../docs/symbols.md"));
const callstack_md_1 = __importDefault(require("../../docs/callstack.md"));
const debugtree_md_1 = __importDefault(require("../../docs/debugtree.md"));
const breakpoints_md_1 = __importDefault(require("../../docs/breakpoints.md"));
const asseteditor_md_1 = __importDefault(require("../../docs/asseteditor.md"));
const managing_files_md_1 = __importDefault(require("../../docs/managing-files.md"));
const build_directives_md_1 = __importDefault(require("../../docs/build-directives.md"));
const toolchains_md_1 = __importDefault(require("../../docs/toolchains.md"));
const asset_headers_md_1 = __importDefault(require("../../docs/asset-headers.md"));
const embedding_ide_md_1 = __importDefault(require("../../docs/embedding-ide.md"));
// Registry, in the order topics appear in the docs index.
exports.HELP_TOPICS = [
    { id: "index", title: "IDE Help", html: index_md_1.default },
    { id: "editor", title: "Editor", html: editor_md_1.default },
    { id: "disasm", title: "Disassembly", html: disasm_md_1.default },
    { id: "memory", title: "Memory Browser", html: memory_md_1.default },
    { id: "memmap", title: "Memory Map", html: memmap_md_1.default },
    { id: "vram", title: "VRAM Browser", html: vram_md_1.default },
    { id: "memprobe", title: "Memory Probe", html: memprobe_md_1.default },
    { id: "crtprobe", title: "CRT Probe", html: crtprobe_md_1.default },
    { id: "probelog", title: "Probe Log", html: probelog_md_1.default },
    { id: "scanlineio", title: "Scanline I/O", html: scanlineio_md_1.default },
    { id: "symbols", title: "Symbol Profiler", html: symbols_md_1.default },
    { id: "callstack", title: "Call Stack", html: callstack_md_1.default },
    { id: "debugtree", title: "Debug Tree", html: debugtree_md_1.default },
    { id: "breakpoints", title: "Breakpoints", html: breakpoints_md_1.default },
    { id: "asseteditor", title: "Asset Editor", html: asseteditor_md_1.default },
    { id: "managing-files", title: "Managing Files", html: managing_files_md_1.default },
    { id: "build-directives", title: "Build Directives", html: build_directives_md_1.default },
    { id: "toolchains", title: "Toolchains & Platforms", html: toolchains_md_1.default },
    { id: "asset-headers", title: "Asset Headers", html: asset_headers_md_1.default },
    { id: "embedding-ide", title: "Embedding the IDE", html: embedding_ide_md_1.default },
];
const HELP_BY_ID = {};
for (let topic of exports.HELP_TOPICS)
    HELP_BY_ID[topic.id] = topic;
// Make the bundled docs searchable from the IDE search palette.
(0, docssource_1.setDocsProvider)(() => exports.HELP_TOPICS);
// Accepts "#help/editor", "help/editor", "#help", "editor.md", "editor" and
// returns a known topic id (falling back to the index).
function resolveHelpId(id) {
    let s = id || "";
    if (s.startsWith("#"))
        s = s.substring(1);
    if (s.startsWith("help"))
        s = s.substring("help".length);
    if (s.startsWith("/"))
        s = s.substring(1);
    if (s.endsWith(".md"))
        s = s.substring(0, s.length - 3);
    s = s.replace(/^\.\//, "");
    return HELP_BY_ID[s] ? s : "index";
}
function getHelpTopic(id) {
    return HELP_BY_ID[resolveHelpId(id)];
}
// Map the active window id to its doc for F1 / future context-help pane.
// Tool windows have a dedicated doc; a focused source editor gets "editor".
const VIEW_HELP = {
    "#disasm": "disasm",
    "#memory": "memory",
    "#memmap": "memmap",
    "#vram": "vram",
    "#memprobe": "memprobe",
    "#crtprobe": "crtprobe",
    "#probelog": "probelog",
    "#scanlineio": "scanlineio",
    "#symbols": "symbols",
    "#callstack": "callstack",
    "#debugtree": "debugtree",
    "#breakpoints": "breakpoints",
    "#asseteditor": "asseteditor",
};
function helpTopicForView(viewId, isEditor) {
    if (isEditor)
        return "editor";
    return (viewId && VIEW_HELP[viewId]) || "index";
}
// Turn relative Markdown links ("foo.md") into internal help routes
// ("#help/foo") so clicks stay in the IDE. Absolute links open in a new tab.
function rewriteHelpLinks(root) {
    const links = root.querySelectorAll("a[href]");
    links.forEach((a) => {
        const href = a.getAttribute("href");
        if (!href)
            return;
        if (/^[a-z][a-z0-9+.-]*:/i.test(href)) { // http:, https:, mailto:, ...
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener noreferrer");
            return;
        }
        if (href.startsWith("/") || href.startsWith("#"))
            return;
        const hashIdx = href.indexOf("#");
        const path = hashIdx >= 0 ? href.substring(0, hashIdx) : href;
        if (!path.endsWith(".md"))
            return;
        a.setAttribute("href", "#help/" + resolveHelpId(path));
        a.removeAttribute("target");
    });
}
// Sanitize and mount a topic. Everything goes through DOMPurify even though
// the docs ship with the app, so the render path stays safe if help ever
// comes from a GitHub project or other user-supplied content.
function renderHelpBody(container, id) {
    const topic = getHelpTopic(id);
    container.innerHTML = DOMPurify.sanitize(topic.html);
    rewriteHelpLinks(container);
}
class HelpView {
    constructor(id) {
        this.id = resolveHelpId(id || "index");
    }
    getPath() {
        return "#help/" + this.id;
    }
    createDiv(parent) {
        this.maindiv = (0, baseviews_1.newDiv)(parent, "vertical-scroll help-view");
        renderHelpBody(this.maindiv[0], this.id);
        return this.maindiv[0];
    }
    refresh(moveCursor) {
        // static content; nothing to recompute on generic refreshes
    }
}
exports.HelpView = HelpView;
//# sourceMappingURL=helpview.js.map