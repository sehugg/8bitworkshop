"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualTextScroller = void 0;
exports.getVisibleEditorLineHeight = getVisibleEditorLineHeight;
const vlist_1 = require("./vlist");
class VirtualTextScroller {
    constructor(parent) {
        var div = document.createElement('div');
        div.setAttribute("class", "memdump");
        parent.appendChild(div);
        this.maindiv = div;
    }
    create(workspace, maxRowCount, fn) {
        this.getLineAt = fn;
        this.memorylist = new vlist_1.VirtualList({
            w: $(workspace).width(),
            h: $(workspace).height(),
            itemHeight: getVisibleEditorLineHeight(),
            totalRows: maxRowCount, // TODO?
            generatorFn: (row) => {
                var line = fn(row);
                var linediv = document.createElement("div");
                linediv.appendChild(document.createTextNode(line.text));
                if (line.clas != null)
                    linediv.className = line.clas;
                return linediv;
            }
        });
        $(this.maindiv).append(this.memorylist.container);
    }
    // TODO: refactor with elsewhere
    refresh() {
        if (this.memorylist) {
            $(this.maindiv).find('[data-index]').each((i, e) => {
                var div = e;
                var row = parseInt(div.getAttribute('data-index'));
                var oldtext = div.innerText;
                var line = this.getLineAt(row);
                var newtext = line.text;
                if (oldtext != newtext) {
                    div.innerText = newtext;
                    if (line.clas != null && !div.classList.contains(line.clas)) {
                        var oldclasses = Array.from(div.classList);
                        oldclasses.forEach((c) => div.classList.remove(c));
                        div.classList.add('vrow');
                        div.classList.add(line.clas);
                    }
                }
            });
        }
    }
}
exports.VirtualTextScroller = VirtualTextScroller;
///
// TODO: https://stackoverflow.com/questions/10463518/converting-em-to-px-in-javascript-and-getting-default-font-size
function getVisibleEditorLineHeight() {
    return $("#booksMenuButton").first().height();
}
//# sourceMappingURL=vtextscroller.js.map