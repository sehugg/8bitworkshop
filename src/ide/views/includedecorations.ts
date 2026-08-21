import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { ToolIncludePattern } from "../../common/toolmeta";

// Include link detection — shows a clickable badge on lines with include
// directives (#include, .include, `include, !src, ...) to open a read-only
// view of the referenced file. Patterns come from the tool registry
// (src/common/toolmeta.ts) so all languages are supported.

class IncludeLinkWidget extends WidgetType {
  constructor(readonly filename: string, readonly system: boolean, readonly handleClick: (filename: string, system: boolean) => void) { super() }

  toDOM() {
    const span = document.createElement("span");
    span.className = "include-link-badge";
    span.textContent = "→";
    span.title = (this.system ? "System header: " : "View ") + this.filename;
    span.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleClick(this.filename, this.system);
    });
    return span;
  }

  eq(other: IncludeLinkWidget) { return this.filename === other.filename && this.system === other.system; }
  ignoreEvent() { return false; }
}

function buildIncludeLinkDecorations(view: EditorView, patterns: (RegExp | ToolIncludePattern)[], handleClick: (filename: string, system: boolean) => void): DecorationSet {
  const widgets: any[] = [];
  const doc = view.state.doc;
  const seen = new Set<string>(); // dedupe (line number, filename)
  for (let { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    for (let pat of patterns) {
      const p: ToolIncludePattern = pat instanceof RegExp ? { re: pat } : pat;
      p.re.lastIndex = 0; // patterns are shared and global, so rewind first
      let m;
      while ((m = p.re.exec(text))) {
        const filename = m[p.group != null ? p.group : m.length - 1];
        if (!filename) continue;
        // place widget at end of the line containing the match
        const matchEnd = Math.min(from + m.index + m[0].length, doc.length);
        const line = doc.lineAt(matchEnd);
        const key = line.number + ':' + filename;
        if (seen.has(key)) continue;
        seen.add(key);
        widgets.push(
          Decoration.widget({
            widget: new IncludeLinkWidget(filename, !!p.system, handleClick),
            side: 1,
          }).range(line.to)
        );
      }
    }
  }
  return Decoration.set(widgets, true);
}

export function createIncludeLinkPlugin(getPatterns: () => (RegExp | ToolIncludePattern)[], onClick: (filename: string, system: boolean) => void) {
  function build(view: EditorView): DecorationSet {
    const patterns = getPatterns();
    if (!patterns || !patterns.length) return Decoration.none;
    return buildIncludeLinkDecorations(view, patterns, onClick);
  }
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = build(update.view);
      }
    }
  }, {
    decorations: v => v.decorations,
  });
}
