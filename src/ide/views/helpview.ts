import DOMPurify = require("dompurify");
import { ProjectView, newDiv } from "./baseviews";
import { setDocsProvider } from "../search/docssource";

// Help docs are Markdown files under src/docs. The esbuild plugin in
// build/md-loader.mjs renders each import to an HTML string at build time;
// src/md.d.ts supplies the ambient module type for `tsc`.
import indexMd from "../../docs/index.md";
import editorMd from "../../docs/editor.md";
import disasmMd from "../../docs/disasm.md";
import memoryMd from "../../docs/memory.md";
import memmapMd from "../../docs/memmap.md";
import vramMd from "../../docs/vram.md";
import memprobeMd from "../../docs/memprobe.md";
import crtprobeMd from "../../docs/crtprobe.md";
import probelogMd from "../../docs/probelog.md";
import scanlineioMd from "../../docs/scanlineio.md";
import symbolsMd from "../../docs/symbols.md";
import callstackMd from "../../docs/callstack.md";
import debugtreeMd from "../../docs/debugtree.md";
import breakpointsMd from "../../docs/breakpoints.md";
import asseteditorMd from "../../docs/asseteditor.md";
import managingFilesMd from "../../docs/managing-files.md";
import buildDirectivesMd from "../../docs/build-directives.md";
import toolchainsMd from "../../docs/toolchains.md";
import assetHeadersMD from "../../docs/asset-headers.md";
import embeddingIdeMd from "../../docs/embedding-ide.md";

// Help is a normal ProjectView so it reuses ProjectWindows (tabs, hash
// routing, the window list). The registry and renderHelpBody() below are
// deliberately independent of the view so a split-pane help panel can reuse
// them without going through ProjectWindows.

export interface HelpTopic {
  id: string;     // stable id used in #help/<id>
  title: string;  // window/sidebar title
  html: string;   // rendered Markdown (still sanitized before display)
}

// Registry, in the order topics appear in the docs index.
export const HELP_TOPICS: HelpTopic[] = [
  { id: "index", title: "IDE Help", html: indexMd },
  { id: "editor", title: "Editor", html: editorMd },
  { id: "disasm", title: "Disassembly", html: disasmMd },
  { id: "memory", title: "Memory Browser", html: memoryMd },
  { id: "memmap", title: "Memory Map", html: memmapMd },
  { id: "vram", title: "VRAM Browser", html: vramMd },
  { id: "memprobe", title: "Memory Probe", html: memprobeMd },
  { id: "crtprobe", title: "CRT Probe", html: crtprobeMd },
  { id: "probelog", title: "Probe Log", html: probelogMd },
  { id: "scanlineio", title: "Scanline I/O", html: scanlineioMd },
  { id: "symbols", title: "Symbol Profiler", html: symbolsMd },
  { id: "callstack", title: "Call Stack", html: callstackMd },
  { id: "debugtree", title: "Debug Tree", html: debugtreeMd },
  { id: "breakpoints", title: "Breakpoints", html: breakpointsMd },
  { id: "asseteditor", title: "Asset Editor", html: asseteditorMd },
  { id: "managing-files", title: "Managing Files", html: managingFilesMd },
  { id: "build-directives", title: "Build Directives", html: buildDirectivesMd },
  { id: "toolchains", title: "Toolchains & Platforms", html: toolchainsMd },
  { id: "asset-headers", title: "Asset Headers", html: assetHeadersMD },
  { id: "embedding-ide", title: "Embedding the IDE", html: embeddingIdeMd },
];

const HELP_BY_ID: { [id: string]: HelpTopic } = {};
for (let topic of HELP_TOPICS) HELP_BY_ID[topic.id] = topic;

// Make the bundled docs searchable from the IDE search palette.
setDocsProvider(() => HELP_TOPICS);

// Accepts "#help/editor", "help/editor", "#help", "editor.md", "editor" and
// returns a known topic id (falling back to the index).
export function resolveHelpId(id: string): string {
  let s = id || "";
  if (s.startsWith("#")) s = s.substring(1);
  if (s.startsWith("help")) s = s.substring("help".length);
  if (s.startsWith("/")) s = s.substring(1);
  if (s.endsWith(".md")) s = s.substring(0, s.length - 3);
  s = s.replace(/^\.\//, "");
  return HELP_BY_ID[s] ? s : "index";
}

export function getHelpTopic(id: string): HelpTopic {
  return HELP_BY_ID[resolveHelpId(id)];
}

// Map the active window id to its doc for F1 / future context-help pane.
// Tool windows have a dedicated doc; a focused source editor gets "editor".
const VIEW_HELP: { [viewId: string]: string } = {
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

export function helpTopicForView(viewId: string, isEditor: boolean): string {
  if (isEditor) return "editor";
  return (viewId && VIEW_HELP[viewId]) || "index";
}

// Turn relative Markdown links ("foo.md") into internal help routes
// ("#help/foo") so clicks stay in the IDE. Absolute links open in a new tab.
function rewriteHelpLinks(root: HTMLElement) {
  const links = root.querySelectorAll("a[href]");
  links.forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) return;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) { // http:, https:, mailto:, ...
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      return;
    }
    if (href.startsWith("/") || href.startsWith("#")) return;
    const hashIdx = href.indexOf("#");
    const path = hashIdx >= 0 ? href.substring(0, hashIdx) : href;
    if (!path.endsWith(".md")) return;
    a.setAttribute("href", "#help/" + resolveHelpId(path));
    a.removeAttribute("target");
  });
}

// Sanitize and mount a topic. Everything goes through DOMPurify even though
// the docs ship with the app, so the render path stays safe if help ever
// comes from a GitHub project or other user-supplied content.
export function renderHelpBody(container: HTMLElement, id: string) {
  const topic = getHelpTopic(id);
  container.innerHTML = DOMPurify.sanitize(topic.html);
  rewriteHelpLinks(container);
}

export class HelpView implements ProjectView {
  maindiv: JQuery;
  id: string;

  constructor(id?: string) {
    this.id = resolveHelpId(id || "index");
  }

  getPath(): string {
    return "#help/" + this.id;
  }

  createDiv(parent: HTMLElement) {
    this.maindiv = newDiv(parent, "vertical-scroll help-view");
    renderHelpBody(this.maindiv[0], this.id);
    return this.maindiv[0];
  }

  refresh(moveCursor: boolean) {
    // static content; nothing to recompute on generic refreshes
  }
}
