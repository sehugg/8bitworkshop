import { EditorState, Transaction, Compartment } from "@codemirror/state";

function createTextTransformFilter(textMapFunctions: { input: ((text: string) => string) | null }) {
    console.log("createTextTransformFilter", textMapFunctions);
    return EditorState.transactionFilter.of((tr: Transaction) => {
        if (!tr.docChanged || !tr.isUserEvent("input") || !textMapFunctions.input) return tr;

        let changes: { from: number; to: number; insert: string }[] = [];
        tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
            changes.push({ from: fromA, to: toA, insert: textMapFunctions.input(inserted.toString()) });
        });

        return { changes, selection: tr.selection };
    });
}

const textTransformFilterCompartment = new Compartment();

function createTextTransformFilterEffect(textMapFunctions: { input: ((text: string) => string) | null }) {
    return textTransformFilterCompartment.reconfigure(createTextTransformFilter(textMapFunctions));
}

export { textTransformFilterCompartment, createTextTransformFilterEffect };
