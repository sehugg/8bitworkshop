"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIncludeLinkPlugin = createIncludeLinkPlugin;
const view_1 = require("@codemirror/view");
// Include link detection — shows a clickable badge on lines with include
// directives (#include, .include, `include, !src, ...) to open a read-only
// view of the referenced file. Patterns come from the tool registry
// (src/common/toolmeta.ts) so all languages are supported.
class IncludeLinkWidget extends view_1.WidgetType {
    constructor(filename, system, handleClick) {
        super();
        this.filename = filename;
        this.system = system;
        this.handleClick = handleClick;
    }
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
    eq(other) { return this.filename === other.filename && this.system === other.system; }
    ignoreEvent() { return false; }
}
function buildIncludeLinkDecorations(view, patterns, handleClick) {
    const widgets = [];
    const doc = view.state.doc;
    const seen = new Set(); // dedupe (line number, filename)
    for (let { from, to } of view.visibleRanges) {
        const text = view.state.sliceDoc(from, to);
        for (let pat of patterns) {
            const p = pat instanceof RegExp ? { re: pat } : pat;
            p.re.lastIndex = 0; // patterns are shared and global, so rewind first
            let m;
            while ((m = p.re.exec(text))) {
                const filename = m[p.group != null ? p.group : m.length - 1];
                if (!filename)
                    continue;
                // place widget at end of the line containing the match
                const matchEnd = Math.min(from + m.index + m[0].length, doc.length);
                const line = doc.lineAt(matchEnd);
                const key = line.number + ':' + filename;
                if (seen.has(key))
                    continue;
                seen.add(key);
                widgets.push(view_1.Decoration.widget({
                    widget: new IncludeLinkWidget(filename, !!p.system, handleClick),
                    side: 1,
                }).range(line.to));
            }
        }
    }
    return view_1.Decoration.set(widgets, true);
}
function createIncludeLinkPlugin(getPatterns, onClick) {
    function build(view) {
        const patterns = getPatterns();
        if (!patterns || !patterns.length)
            return view_1.Decoration.none;
        return buildIncludeLinkDecorations(view, patterns, onClick);
    }
    return view_1.ViewPlugin.fromClass(class {
        constructor(view) {
            this.decorations = build(view);
        }
        update(update) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = build(update.view);
            }
        }
    }, {
        decorations: v => v.decorations,
    });
}
//# sourceMappingURL=includedecorations.js.map