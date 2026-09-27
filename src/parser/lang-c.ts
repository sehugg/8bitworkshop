// C language support: @fazelstudio/codemirror-lang-c with fixed indent rules.
// The package's IfStatement rule calls a nonexistent context.matchCh() and
// throws, which leaves Enter with no indentation, and it doesn't indent case bodies.
// Inside braces, a new line matches the statement above it, so files keep
// their own indent width.

import { continuedIndent, delimitedIndent, indentNodeProp, LanguageSupport, LRLanguage, TreeIndentContext } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import { cLanguage as baseCLanguage } from "@fazelstudio/codemirror-lang-c";

const blockIndent = delimitedIndent({ closing: "}" });
const caseLabel = /^\s*(case\b|default\b|\})/;
const skipSiblings = new Set(["{", "BlockComment", "LineComment", "PreprocDirective"]);

// Indentation of the nearest item above 'pos' in this braced node that starts
// its own line below the opening brace, or null if there is none.
function siblingIndent(context: TreeIndentContext): number | null {
  const doc = context.state.doc;
  const openLine = doc.lineAt(context.node.from).number;
  for (let child: SyntaxNode | null = context.node.childBefore(context.pos); child; child = child.prevSibling) {
    if (skipSiblings.has(child.name) || child.type.isError) continue;
    const line = doc.lineAt(child.from);
    if (line.number <= openLine) break;
    if (/^\s*$/.test(line.text.slice(0, child.from - line.from))) return context.lineIndent(child.from);
  }
  return null;
}

// Closing brace aligns with the opener; other lines match the item above.
function bracedIndent(context: TreeIndentContext): number {
  if (!/^\s*\}/.test(context.textAfter)) {
    const indent = siblingIndent(context);
    if (indent != null) return indent;
  }
  return blockIndent(context);
}

export const cLanguage: LRLanguage = baseCLanguage.configure({
  props: [
    indentNodeProp.add({
      IfStatement: continuedIndent({ except: /^\s*({|else\b)/ }),
      // In a switch body, lines after "case x:" indent one unit past the label.
      CompoundStatement: (context: TreeIndentContext) => {
        if (context.node.parent?.name == "SwitchStatement" && !caseLabel.test(context.textAfter)) {
          const last = context.node.childBefore(context.pos);
          if (last?.name == "CaseStatement") return context.lineIndent(last.from) + context.unit;
        }
        return bracedIndent(context);
      },
      FieldDeclarationList: bracedIndent,
      EnumeratorList: bracedIndent,
      InitializerList: bracedIndent,
      CaseStatement: (context: TreeIndentContext) =>
        context.baseIndent + (caseLabel.test(context.textAfter) ? 0 : context.unit),
    }),
  ],
});

export function c(): LanguageSupport {
  return new LanguageSupport(cLanguage);
}
