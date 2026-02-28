import { LRLanguage, StreamLanguage, language, syntaxTree } from "@codemirror/language";
import { hoverTooltip } from "@codemirror/view";
import { getStyleTags } from "@lezer/highlight";

// Tooltip to show tags, useful for theme and parser development.
export const debugHighlightTagsTooltip = hoverTooltip((view, pos, side) => {
    let tree = syntaxTree(view.state).resolveInner(pos, side);
    let style = getStyleTags(tree);
    let tagList = "";
    if (style) {
        for (let tag of style.tags) {
            tagList += tag.set.join(" < ") + "\n";
        }
    }

    let lang = view.state.facet(language);
    let parserType = (lang instanceof LRLanguage) ? "Lezer LRLanguage" :
        (lang instanceof StreamLanguage) ? "StreamLanguage" : "Unknown";
    let treeName = (lang instanceof LRLanguage) ? "AST   " :
        (lang instanceof StreamLanguage) ? "Token " : "Name  ";

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