"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugHighlightTagsTooltip = void 0;
const language_1 = require("@codemirror/language");
const view_1 = require("@codemirror/view");
const highlight_1 = require("@lezer/highlight");
// Tooltip to show tags, useful for theme and parser development.
exports.debugHighlightTagsTooltip = (0, view_1.hoverTooltip)((view, pos, side) => {
    let tree = (0, language_1.syntaxTree)(view.state).resolveInner(pos, side);
    let style = (0, highlight_1.getStyleTags)(tree);
    let tagList = "";
    if (style) {
        for (let tag of style.tags) {
            tagList += tag.set.join(" < ") + "\n";
        }
    }
    let lang = view.state.facet(language_1.language);
    let parserType = (lang instanceof language_1.LRLanguage) ? "Lezer LRLanguage" :
        (lang instanceof language_1.StreamLanguage) ? "StreamLanguage" : "Unknown";
    let treeName = (lang instanceof language_1.LRLanguage) ? "AST   " :
        (lang instanceof language_1.StreamLanguage) ? "Token " : "Name  ";
    return {
        pos: pos,
        above: true,
        arrow: true,
        create(view) {
            let dom = document.createElement("div");
            // Zero size element, so tooltip quickly dismisses when mouse moves over it, force
            // CodeMirror's getBoundingClientRect() in isInTooltip() to always return false.
            dom.style.overflow = "visible";
            dom.style.height = "0";
            dom.style.width = "0";
            // Tooltip content.
            let inner = document.createElement("div");
            inner.className = "cm-debug-tooltip";
            inner.textContent = `Parser: ${parserType}\n${treeName}: ${tree.name}\nTags  : ${tagList}`;
            inner.style.whiteSpace = "pre-wrap";
            inner.style.fontFamily = "monospace";
            inner.style.background = "#333";
            inner.style.color = "white";
            inner.style.padding = "2px 8px";
            inner.style.borderRadius = "4px";
            inner.style.fontSize = "12px";
            inner.style.border = "1px solid #555";
            inner.style.pointerEvents = "none";
            inner.style.position = "absolute";
            inner.style.bottom = "0";
            inner.style.width = "max-content";
            dom.appendChild(inner);
            return { dom };
        }
    };
}, {
    hoverTime: 10,
    hideOnChange: true,
});
//# sourceMappingURL=debug.js.map