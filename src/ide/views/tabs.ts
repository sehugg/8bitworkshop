import { indentLess, indentMore, insertTab } from "@codemirror/commands";
import { KeyBinding } from "@codemirror/view";

export const smartIndentKeymap: KeyBinding[] = [
  { key: "Tab", run: indentMore },
  { key: "Shift-Tab", run: indentLess },
];

export const insertTabKeymap: KeyBinding[] = [
  { key: "Tab", run: insertTab },
  { key: "Shift-Tab", run: indentLess },
];
