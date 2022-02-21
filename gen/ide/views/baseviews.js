"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newDiv = exports.isMobileDevice = void 0;
;
// detect mobile (https://stackoverflow.com/questions/3514784/what-is-the-best-way-to-detect-a-mobile-device)
exports.isMobileDevice = window.matchMedia && window.matchMedia("only screen and (max-width: 760px)").matches;
function newDiv(parent, cls) {
    var div = $(document.createElement("div"));
    if (parent)
        div.appendTo(parent);
    if (cls)
        div.addClass(cls);
    return div;
}
exports.newDiv = newDiv;
//# sourceMappingURL=baseviews.js.map