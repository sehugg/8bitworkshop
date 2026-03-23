import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";

// Asset header detection — shows a clickable badge on lines with ;;{json};; or /*{json}*/
class AssetHeaderWidget extends WidgetType {
  constructor(readonly header: string, readonly handleClick: (span: HTMLElement) => void) { super() }

  toDOM() {
    const span = document.createElement("span");
    span.className = "asset-header-badge";
    span.textContent = "↗ Asset Editor";
    span.title = "Open in Asset Editor";
    span.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleClick(span);
    });
    return span;
  }

  eq(other: AssetHeaderWidget) { return this.header === other.header; }
  ignoreEvent() { return false; }
}

const assetHeaderRegex = /[/;][*;](\{.+?\})[*;][/;]/g;

function buildAssetHeaderDecorations(view: EditorView, handleClick: (span: HTMLElement) => void): DecorationSet {
  const widgets: any[] = [];
  for (let { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    let lineStart = from;
    const lines = text.split('\n');
    for (const line of lines) {
      assetHeaderRegex.lastIndex = 0;
      const m = assetHeaderRegex.exec(line);
      if (m) {
        const matchEnd = lineStart + m.index + m[0].length;
        widgets.push(
          Decoration.widget({
            widget: new AssetHeaderWidget(m[0], handleClick),
            side: -1,
          }).range(matchEnd)
        );
      }
      lineStart += line.length + 1;
    }
  }
  return Decoration.set(widgets, true);
}

export function createAssetHeaderPlugin(onClick: (lineNumber: number) => void) {
  let currentView: EditorView;
  function handleClick(span: HTMLElement) {
    const pos = currentView.posAtDOM(span);
    onClick(currentView.state.doc.lineAt(pos).number);
  }
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      currentView = view;
      this.decorations = buildAssetHeaderDecorations(view, handleClick);
    }
    update(update: ViewUpdate) {
      currentView = update.view;
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildAssetHeaderDecorations(update.view, handleClick);
      }
    }
  }, {
    decorations: v => v.decorations,
  });
}
