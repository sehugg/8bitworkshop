import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";

// Asset header detection — shows a clickable badge on lines with ;;{json};; or /*{json}*/
class AssetHeaderWidget extends WidgetType {
  constructor(readonly header: string, readonly onClick: () => void) { super() }

  toDOM() {
    const span = document.createElement("span");
    span.className = "asset-header-badge";
    span.textContent = "↗ Asset Editor";
    span.title = "Open in Asset Editor";
    span.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onClick();
    });
    return span;
  }

  eq(other: AssetHeaderWidget) { return this.header === other.header; }
  ignoreEvent() { return false; }
}

const assetHeaderRegex = /[/;][*;](\{.+?\})[*;][/;]/g;

function buildAssetHeaderDecorations(view: EditorView, onClick: () => void): DecorationSet {
  const widgets: any[] = [];
  for (let { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    let lineStart = from;
    const lines = text.split('\n');
    for (const line of lines) {
      assetHeaderRegex.lastIndex = 0;
      const m = assetHeaderRegex.exec(line);
      if (m) {
        const lineEnd = lineStart + line.length;
        widgets.push(
          Decoration.widget({
            widget: new AssetHeaderWidget(m[0], onClick),
            side: 1,
          }).range(lineEnd)
        );
      }
      lineStart += line.length + 1;
    }
  }
  return Decoration.set(widgets, true);
}

export function createAssetHeaderPlugin(onClick: () => void) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildAssetHeaderDecorations(view, onClick);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildAssetHeaderDecorations(update.view, onClick);
      }
    }
  }, {
    decorations: v => v.decorations,
  });
}
