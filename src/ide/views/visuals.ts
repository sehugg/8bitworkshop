
import { errorMarkers } from "./gutter";

import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";

// Highlight program counter line.
const currentPcEffect = StateEffect.define<number | null>();

const currentPcDecoration = Decoration.line({
  attributes: { class: "cm-currentpc" }
});

const currentPcLineField = StateField.define({
  create() { return Decoration.none },
  update(lines, tr) {
    lines = lines.map(tr.changes)

    for (let e of tr.effects) {
      if (e.is(currentPcEffect)) {
        if (e.value === null) return Decoration.none;

        const line = tr.state.doc.line(e.value);
        return Decoration.set([currentPcDecoration.range(line.from)]);
      }
    }
    return lines;
  },
  provide: f => EditorView.decorations.from(f),
});


// Error message widget to show below error lines
class ErrorMessageWidget extends WidgetType {
  constructor(readonly message: string) { super() }

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
const errorMessageField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(decorations, tr) {
    // Map existing decorations across document changes
    decorations = decorations.map(tr.changes);

    for (let e of tr.effects) {
      if (e.is(errorMarkers.showMessage)) {
        if (e.value === null || !e.value) {
          // Clear all messages
          return Decoration.none;
        } else if (e.value.toggle) {
          // Build new decoration set with toggled message
          const widgets: any[] = [];

          // Collect existing decorations
          const existingMessages = new Map<number, string>();
          decorations.between(0, tr.state.doc.length, (from, to, value) => {
            try {
              const lineNum = tr.state.doc.lineAt(to).number;
              if (value.spec.widget instanceof ErrorMessageWidget) {
                existingMessages.set(lineNum, (value.spec.widget as ErrorMessageWidget).message);
              }
            } catch { }
          });

          // Check if we're adding or removing this line's message
          const isCurrentlyShown = existingMessages.has(e.value.line);

          if (isCurrentlyShown) {
            // Remove the message
            existingMessages.delete(e.value.line);
          } else {
            // Add the new message
            existingMessages.set(e.value.line, e.value.msg);
          }

          // Build sorted decorations
          const sortedLines = Array.from(existingMessages.keys()).sort((a, b) => a - b);
          sortedLines.forEach(lineNum => {
            try {
              const line = tr.state.doc.line(lineNum);
              widgets.push(
                Decoration.widget({
                  widget: new ErrorMessageWidget(existingMessages.get(lineNum)!),
                  block: true,
                  side: 1
                }).range(line.to)
              );
            } catch {
              // Line doesn't exist, skip
            }
          });

          return Decoration.set(widgets, true);
        }
      }
    }
    return decorations;
  },
  provide: f => EditorView.decorations.from(f),
});

// Decorator widget to show values.
class ShowValueWidget extends WidgetType {
  constructor(readonly value: string) { super() }

  toDOM() {
    let div = document.createElement("div");
    div.textContent = `${this.value}`;
    div.style.cssText = `
      color: #ccccff;
      background-color: #000066;
      display: inline-block;
    `;
    div.className = "cm-line";
    return div
  }
}

// Effect to pass the position and value to the state.
const showValueEffect = StateEffect.define<{ pos: number, val: any } | null>();

const showValueDecorationField = StateField.define({
  create() { return Decoration.none },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);

    for (let e of tr.effects) {
      if (e.is(showValueEffect)) {
        if (e.value === null || !e.value) {
          return Decoration.none;
        }
        return Decoration.set([
          Decoration.widget({
            widget: new ShowValueWidget(e.value.val),
            block: true,
            side: 1 // Appears after the text
          }).range(e.value.pos)
        ])
      }
    }
    return decorations;
  },
  provide: f => EditorView.decorations.from(f),
});

const highlightLinesEffect = StateEffect.define<{ start: number, end: number } | null>();

const highlightLinesDecoration = Decoration.line({
  attributes: { class: "highlight-lines" }
});

const highlightLinesField = StateField.define({
  create() { return Decoration.none },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);

    for (let e of tr.effects) {
      if (e.is(highlightLinesEffect)) {
        if (e.value === null) return Decoration.none;

        const { start, end } = e.value;
        const decorationRanges: any[] = [];

        // Highlight all lines in the range
        for (let lineNum = start; lineNum <= end; lineNum++) {
          try {
            const line = tr.state.doc.line(lineNum);
            decorationRanges.push(highlightLinesDecoration.range(line.from));
          } catch {
            // Line doesn't exist, skip
          }
        }

        return Decoration.set(decorationRanges);
      }
    }
    return decorations;
  },
  provide: f => EditorView.decorations.from(f),
});

export const errorMessages = {
  field: errorMessageField,
  widget: ErrorMessageWidget,
};

export const currentPc = {
  effect: currentPcEffect,
  decoration: currentPcDecoration,
  field: currentPcLineField,
};

export const showValue = {
  effect: showValueEffect,
  field: showValueDecorationField,
};

export const highlightLines = {
  effect: highlightLinesEffect,
  field: highlightLinesField,
};
