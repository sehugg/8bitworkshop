"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textTransformFilterCompartment = void 0;
exports.createTextTransformFilterEffect = createTextTransformFilterEffect;
const state_1 = require("@codemirror/state");
function createTextTransformFilter(textMapFunctions) {
    return state_1.EditorState.transactionFilter.of((tr) => {
        // Only transform user-initiated text, and only when textMapFunctions.input is set.
        if (!tr.docChanged || !tr.isUserEvent("input") || !textMapFunctions.input)
            return tr;
        // Apply the transform to each inserted text segment.
        let changes = [];
        let changed = false;
        tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
            const original = inserted.toString();
            const transformed = textMapFunctions.input(original);
            changes.push({ from: fromA, to: toA, insert: transformed });
            if (transformed !== original)
                changed = true;
        });
        if (!changed)
            return tr;
        // Preserve annotations from the original transaction.
        const userEvent = tr.annotation(state_1.Transaction.userEvent);
        const addToHistory = tr.annotation(state_1.Transaction.addToHistory);
        return {
            changes,
            selection: tr.selection,
            effects: tr.effects,
            scrollIntoView: tr.scrollIntoView,
            annotations: [
                ...(userEvent != null ? [state_1.Transaction.userEvent.of(userEvent)] : []),
                ...(addToHistory != null ? [state_1.Transaction.addToHistory.of(addToHistory)] : []),
            ],
        };
    });
}
const textTransformFilterCompartment = new state_1.Compartment();
exports.textTransformFilterCompartment = textTransformFilterCompartment;
function createTextTransformFilterEffect(textMapFunctions) {
    return textTransformFilterCompartment.reconfigure(createTextTransformFilter(textMapFunctions));
}
//# sourceMappingURL=filters.js.map