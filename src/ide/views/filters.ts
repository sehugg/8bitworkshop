import { Compartment, EditorState, Transaction } from "@codemirror/state";

type TextMapFunctions = { input: ((text: string) => string) | null };

function createTextTransformFilter(textMapFunctions: TextMapFunctions) {
    return EditorState.transactionFilter.of((tr: Transaction) => {
        // Only transform user-initiated text, and only when textMapFunctions.input is set.
        if (!tr.docChanged || !tr.isUserEvent("input") || !textMapFunctions.input) return tr;

        // Apply the transform to each inserted text segment.
        let changes: { from: number; to: number; insert: string }[] = [];
        let changed = false;
        tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
            const original = inserted.toString();
            const transformed = textMapFunctions.input(original);
            changes.push({ from: fromA, to: toA, insert: transformed });
            if (transformed !== original) changed = true;
        });
        if (!changed) return tr;

        // Preserve annotations from the original transaction.
        const userEvent = tr.annotation(Transaction.userEvent);
        const addToHistory = tr.annotation(Transaction.addToHistory);
        return {
            changes,
            selection: tr.selection,
            effects: tr.effects,
            scrollIntoView: tr.scrollIntoView,
            annotations: [
                ...(userEvent != null ? [Transaction.userEvent.of(userEvent)] : []),
                ...(addToHistory != null ? [Transaction.addToHistory.of(addToHistory)] : []),
            ],
        };
    });
}

const textTransformFilterCompartment = new Compartment();

function createTextTransformFilterEffect(textMapFunctions: TextMapFunctions) {
    return textTransformFilterCompartment.reconfigure(createTextTransformFilter(textMapFunctions));
}

export { createTextTransformFilterEffect, textTransformFilterCompartment };
