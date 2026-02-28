"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.highlightLines = exports.showValue = exports.currentPc = exports.errorMessages = void 0;
const gutter_1 = require("./gutter");
const state_1 = require("@codemirror/state");
const view_1 = require("@codemirror/view");
// Highlight program counter line.
const currentPcEffect = state_1.StateEffect.define();
const currentPcDecoration = view_1.Decoration.line({
    attributes: { class: "cm-currentpc" }
});
const currentPcLineField = state_1.StateField.define({
    create() { return view_1.Decoration.none; },
    update(lines, tr) {
        lines = lines.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(currentPcEffect)) {
                if (e.value === null)
                    return view_1.Decoration.none;
                const line = tr.state.doc.line(e.value);
                return view_1.Decoration.set([currentPcDecoration.range(line.from)]);
            }
        }
        return lines;
    },
    provide: f => view_1.EditorView.decorations.from(f),
});
// Error message widget to show below error lines
class ErrorMessageWidget extends view_1.WidgetType {
    constructor(message) {
        super();
        this.message = message;
    }
    toDOM() {
        let div = document.createElement("div");
        div.textContent = this.message;
        div.style.cssText = `
      color: #ff6666;
      background-color: #330000;
      padding: 4px 8px;
      margin: 2px 0;
      border-left: 3px solid #ff0000;
      font-family: monospace;
    `;
        return div;
    }
}
// State field to manage error message decorations (supports multiple messages)
const errorMessageField = state_1.StateField.define({
    create() { return view_1.Decoration.none; },
    update(decorations, tr) {
        // Map existing decorations across document changes
        decorations = decorations.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(gutter_1.errorMarkers.showMessage)) {
                if (e.value === null || !e.value) {
                    // Clear all messages
                    return view_1.Decoration.none;
                }
                else if (e.value.toggle) {
                    // Build new decoration set with toggled message
                    const widgets = [];
                    // Collect existing decorations
                    const existingMessages = new Map();
                    decorations.between(0, tr.state.doc.length, (from, to, value) => {
                        try {
                            const lineNum = tr.state.doc.lineAt(to).number;
                            if (value.spec.widget instanceof ErrorMessageWidget) {
                                existingMessages.set(lineNum, value.spec.widget.message);
                            }
                        }
                        catch (_a) { }
                    });
                    // Check if we're adding or removing this line's message
                    const isCurrentlyShown = existingMessages.has(e.value.line);
                    if (isCurrentlyShown) {
                        // Remove the message
                        existingMessages.delete(e.value.line);
                    }
                    else {
                        // Add the new message
                        existingMessages.set(e.value.line, e.value.msg);
                    }
                    // Build sorted decorations
                    const sortedLines = Array.from(existingMessages.keys()).sort((a, b) => a - b);
                    sortedLines.forEach(lineNum => {
                        try {
                            const line = tr.state.doc.line(lineNum);
                            widgets.push(view_1.Decoration.widget({
                                widget: new ErrorMessageWidget(existingMessages.get(lineNum)),
                                block: true,
                                side: 1
                            }).range(line.to));
                        }
                        catch (_a) {
                            // Line doesn't exist, skip
                        }
                    });
                    return view_1.Decoration.set(widgets, true);
                }
            }
        }
        return decorations;
    },
    provide: f => view_1.EditorView.decorations.from(f),
});
// Decorator widget to show values.
class ShowValueWidget extends view_1.WidgetType {
    constructor(value) {
        super();
        this.value = value;
    }
    toDOM() {
        let div = document.createElement("div");
        div.textContent = `${this.value}`;
        div.style.cssText = `
      color: #ccccff;
      background-color: #000066;
      display: inline-block;
    `;
        div.className = "cm-line";
        return div;
    }
}
// Effect to pass the position and value to the state.
const showValueEffect = state_1.StateEffect.define();
const showValueDecorationField = state_1.StateField.define({
    create() { return view_1.Decoration.none; },
    update(decorations, tr) {
        decorations = decorations.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(showValueEffect)) {
                if (e.value === null || !e.value) {
                    return view_1.Decoration.none;
                }
                const line = tr.state.doc.lineAt(e.value.range.to);
                return view_1.Decoration.set([
                    view_1.Decoration.widget({
                        widget: new ShowValueWidget(e.value.val),
                        block: true,
                        side: 1 // Appears after the line
                    }).range(line.to)
                ]);
            }
        }
        return decorations;
    },
    provide: f => view_1.EditorView.decorations.from(f),
});
const highlightLinesEffect = state_1.StateEffect.define();
const highlightLinesDecoration = view_1.Decoration.line({
    attributes: { class: "highlight-lines" }
});
const highlightLinesField = state_1.StateField.define({
    create() { return view_1.Decoration.none; },
    update(decorations, tr) {
        decorations = decorations.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(highlightLinesEffect)) {
                if (e.value === null)
                    return view_1.Decoration.none;
                const { start, end } = e.value;
                const decorationRanges = [];
                // Highlight all lines in the range
                for (let lineNum = start; lineNum <= end; lineNum++) {
                    try {
                        const line = tr.state.doc.line(lineNum);
                        decorationRanges.push(highlightLinesDecoration.range(line.from));
                    }
                    catch (_a) {
                        // Line doesn't exist, skip
                    }
                }
                return view_1.Decoration.set(decorationRanges);
            }
        }
        return decorations;
    },
    provide: f => view_1.EditorView.decorations.from(f),
});
exports.errorMessages = {
    field: errorMessageField,
    widget: ErrorMessageWidget,
};
exports.currentPc = {
    effect: currentPcEffect,
    decoration: currentPcDecoration,
    field: currentPcLineField,
};
exports.showValue = {
    effect: showValueEffect,
    field: showValueDecorationField,
};
exports.highlightLines = {
    effect: highlightLinesEffect,
    field: highlightLinesField,
};
//# sourceMappingURL=visuals.js.map