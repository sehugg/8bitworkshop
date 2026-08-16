"use strict";
/// TOOLBAR
Object.defineProperty(exports, "__esModule", { value: true });
exports.Toolbar = void 0;
// Lazy mousetrap require: mousetrap references `document` at module load time,
// which crashes in Node-based tests (window is polyfilled, document is not).
function getMousetrap() {
    return require('mousetrap');
}
class Toolbar {
    constructor(parentDiv, focusDiv) {
        this.boundkeys = [];
        const Mousetrap = getMousetrap();
        this.mousetrap = focusDiv ? new Mousetrap(focusDiv) : Mousetrap;
        this.span = $(document.createElement("span")).addClass("btn_toolbar");
        parentDiv.appendChild(this.span[0]);
        this.newGroup();
    }
    destroy() {
        if (this.span) {
            this.span.remove();
            this.span = null;
        }
        if (this.mousetrap) {
            for (var key of this.boundkeys) {
                this.mousetrap.unbind(key);
            }
            this.mousetrap = null;
        }
    }
    newGroup() {
        return this.grp = $(document.createElement("span")).addClass("btn_group").appendTo(this.span).hide();
    }
    add(key, alttext, icon, fn) {
        var btn = null;
        if (icon) {
            btn = $(document.createElement("button")).addClass("btn");
            if (icon.startsWith('glyphicon')) {
                icon = '<span class="glyphicon ' + icon + '" aria-hidden="true"></span>';
            }
            btn.html(icon);
            btn.prop("title", key ? (alttext + " (" + key + ")") : alttext);
            btn.click(fn);
            this.grp.append(btn).show();
        }
        if (key) {
            this.mousetrap.bind(key, fn);
            this.boundkeys.push(key);
        }
        return btn;
    }
}
exports.Toolbar = Toolbar;
//# sourceMappingURL=toolbar.js.map