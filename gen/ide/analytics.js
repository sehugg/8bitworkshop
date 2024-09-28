"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gaEvent = gaEvent;
exports.gaPageView = gaPageView;
function gaEvent(category, action, label, value) {
    if (window['ga']) {
        ga('send', 'event', category, action, label, value);
    }
}
function gaPageView(page) {
    if (window['ga']) {
        ga('send', 'pageview', page);
    }
}
//# sourceMappingURL=analytics.js.map