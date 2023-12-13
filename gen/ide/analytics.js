"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gaPageView = exports.gaEvent = void 0;
function gaEvent(category, action, label, value) {
    if (window['ga']) {
        ga('send', 'event', category, action, label, value);
    }
}
exports.gaEvent = gaEvent;
function gaPageView(page) {
    if (window['ga']) {
        ga('send', 'pageview', page);
    }
}
exports.gaPageView = gaPageView;
//# sourceMappingURL=analytics.js.map