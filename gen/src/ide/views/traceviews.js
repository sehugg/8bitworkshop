"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TracePlaybackView = void 0;
class TracePlaybackView {
    constructor() {
        this.recreateOnResize = true;
        this.totalRows = 0x1400;
    }
    createDiv(parent) {
        var div = document.createElement('div');
        div.setAttribute("class", "memdump");
        parent.appendChild(div);
        return this.maindiv = div;
    }
    tick() {
    }
    refresh() {
    }
}
exports.TracePlaybackView = TracePlaybackView;
//# sourceMappingURL=traceviews.js.map