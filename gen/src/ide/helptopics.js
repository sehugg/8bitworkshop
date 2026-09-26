"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerElementHelpTopic = registerElementHelpTopic;
exports.unregisterElementHelpTopic = unregisterElementHelpTopic;
exports.elementHelpTopicForFocus = elementHelpTopicForFocus;
// Widgets embedded directly in a platform's UI (not a ProjectWindows tab,
// e.g. the Verilog waveform viewer alongside the emulator screen) register
// their container + topic id here so F1 can find them while focused.
// This stays out of views/helpview.ts, which imports every help page.
let elementHelpTopics = [];
function registerElementHelpTopic(div, id) {
    elementHelpTopics.push({ div, id });
}
function unregisterElementHelpTopic(div) {
    elementHelpTopics = elementHelpTopics.filter((eh) => eh.div !== div);
}
// topic id for the currently focused element-scoped widget, if any
function elementHelpTopicForFocus() {
    const ae = document.activeElement;
    if (!ae)
        return null;
    for (const eh of elementHelpTopics) {
        if (eh.div.contains(ae))
            return eh.id;
    }
    return null;
}
//# sourceMappingURL=helptopics.js.map