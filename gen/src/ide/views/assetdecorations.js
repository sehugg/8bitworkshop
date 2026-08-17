"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssetHeaderPlugin = createAssetHeaderPlugin;
const view_1 = require("@codemirror/view");
// Asset header detection — shows a clickable badge on lines with ;;{json};; or /*{json}*/
class AssetHeaderWidget extends view_1.WidgetType {
    constructor(header, handleClick) {
        super();
        this.header = header;
        this.handleClick = handleClick;
    }
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
    eq(other) { return this.header === other.header; }
    ignoreEvent() { return false; }
}
const assetHeaderRegex = /[/;][*;](\{.+?\})[*;][/;]/g;
function buildAssetHeaderDecorations(view, handleClick) {
    const widgets = [];
    for (let { from, to } of view.visibleRanges) {
        const text = view.state.sliceDoc(from, to);
        let lineStart = from;
        const lines = text.split('\n');
        for (const line of lines) {
            assetHeaderRegex.lastIndex = 0;
            const m = assetHeaderRegex.exec(line);
            if (m) {
                const matchEnd = lineStart + m.index + m[0].length;
                widgets.push(view_1.Decoration.widget({
                    widget: new AssetHeaderWidget(m[0], handleClick),
                    side: -1,
                }).range(matchEnd));
            }
            lineStart += line.length + 1;
        }
    }
    return view_1.Decoration.set(widgets, true);
}
function createAssetHeaderPlugin(onClick) {
    let currentView;
    function handleClick(span) {
        const pos = currentView.posAtDOM(span);
        onClick(currentView.state.doc.lineAt(pos).number);
    }
    return view_1.ViewPlugin.fromClass(class {
        constructor(view) {
            currentView = view;
            this.decorations = buildAssetHeaderDecorations(view, handleClick);
        }
        update(update) {
            currentView = update.view;
            if (update.docChanged || update.viewportChanged) {
                this.decorations = buildAssetHeaderDecorations(update.view, handleClick);
            }
        }
    }, {
        decorations: v => v.decorations,
    });
}
//# sourceMappingURL=assetdecorations.js.map