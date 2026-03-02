import { EditorSelection } from "@codemirror/state";
import { EditorView, KeyBinding } from "@codemirror/view";

function tab(view: EditorView): boolean {
  const tabSize = view.state.tabSize;
  view.dispatch(view.state.changeByRange(sel => {
    const startLine = view.state.doc.lineAt(sel.from);
    const endLine = view.state.doc.lineAt(sel.to);
    if (sel.empty) {
      // Cursor only: insert spaces to next tab stop
      const col = sel.head - startLine.from;
      const spaces = tabSize - (col % tabSize);
      const insert = " ".repeat(spaces);
      return {
        changes: { from: sel.from, insert },
        range: EditorSelection.cursor(sel.from + spaces),
      };
    } else if (startLine.number === endLine.number) {
      // Single-line selection: replace with spaces, cursor at end of whitespace
      const col = sel.from - startLine.from;
      const spaces = tabSize - (col % tabSize);
      const insert = " ".repeat(spaces);
      return {
        changes: { from: sel.from, to: sel.to, insert },
        range: EditorSelection.cursor(sel.from + spaces),
      };
    } else {
      // Multi-line selection: move first non-ws char to next tab stop on each line
      const changes = [];
      for (let i = startLine.number; i <= endLine.number; i++) {
        const line = view.state.doc.line(i);
        const firstNonWs = line.text.search(/\S/);
        if (firstNonWs < 0) continue;
        const newCol = (Math.floor(firstNonWs / tabSize) + 1) * tabSize;
        const spaces = newCol - firstNonWs;
        changes.push({ from: line.from + firstNonWs, insert: " ".repeat(spaces) });
      }
      const changeSet = view.state.changes(changes);
      return {
        changes: changeSet,
        range: EditorSelection.range(changeSet.mapPos(sel.from), changeSet.mapPos(sel.to)),
      };
    }
  }));
  return true;
}

function shiftTab(view: EditorView): boolean {
  const tabSize = view.state.tabSize;
  const changes = [];
  const seen = new Set<number>();
  for (const sel of view.state.selection.ranges) {
    const startLine = view.state.doc.lineAt(sel.from);
    const endLine = view.state.doc.lineAt(sel.to);
    for (let i = startLine.number; i <= endLine.number; i++) {
      if (seen.has(i)) continue;
      seen.add(i);
      const line = view.state.doc.line(i);
      const firstNonWs = line.text.search(/\S/);
      if (firstNonWs <= 0) continue;
      const newCol = Math.floor((firstNonWs - 1) / tabSize) * tabSize;
      changes.push({ from: line.from + newCol, to: line.from + firstNonWs });
    }
  }
  if (changes.length) view.dispatch({ changes });
  return true;
}

export const tabKeymap: KeyBinding[] = [
  { key: "Tab", run: tab },
  { key: "Shift-Tab", run: shiftTab },
];
