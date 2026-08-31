
/// TOOLBAR

import { formatKey } from "./shortcutbar";
import { KeyBinder, parseKeyBinding } from "./keys";

// Lazy mousetrap require: mousetrap references `document` at module load time,
// which crashes in Node-based tests (window is polyfilled, document is not).
function getMousetrap() {
    return require('mousetrap');
}

// Patch mousetrap's default stopCallback, which blocks ALL bound shortcuts
// when the event target is an input or contenteditable element -- which
// includes the CodeMirror editor. Allow combos with ctrl/alt/meta modifiers
// through so app commands keep working while typing in the editor.
// (AltGraph = AltGr on international keyboards: treat as character input.)
function patchMousetrap(Mousetrap: any) {
    if (Mousetrap._8bwPatched) return Mousetrap;
    var origStop = Mousetrap.stopCallback;
    Mousetrap.stopCallback = function (e, element, combo, sequence) {
        if (e && (e.ctrlKey || e.altKey || e.metaKey)) {
            if (e.getModifierState && e.getModifierState('AltGraph')) {
                return origStop.call(this, e, element, combo, sequence);
            }
            return false;
        }
        return origStop.call(this, e, element, combo, sequence);
    };
    Mousetrap._8bwPatched = true;
    return Mousetrap;
}

export class Toolbar {
    span : JQuery;
    grp : JQuery;
    mousetrap;
    boundkeys = [];
    keybinder: KeyBinder;
    focusDiv: HTMLElement;

    constructor(parentDiv:HTMLElement, focusDiv:HTMLElement) {
      const Mousetrap = patchMousetrap(getMousetrap());
      // article-compliant bindings (match on KeyboardEvent.key) go through
      // KeyBinder; non-compliant specs (punctuation, alt, shift+digit) fall
      // back to mousetrap's positional matching
      this.focusDiv = focusDiv;
      this.keybinder = new KeyBinder();
      this.keybinder.attach();
      this.mousetrap = focusDiv ? new Mousetrap(focusDiv) : Mousetrap;
      this.span = $(document.createElement("span")).addClass("btn_toolbar");
      parentDiv.appendChild(this.span[0]);
      this.newGroup();
    }
    destroy() {
      if (this.span) {
        this.span.remove();
        this.span = null;
      }
      if (this.keybinder) {
        this.keybinder.detach();
        this.keybinder.unbindAll();
        this.keybinder = null;
      }
      if (this.mousetrap) {
        for (var key of this.boundkeys) {
          this.mousetrap.unbind(key);
        }
        this.mousetrap = null;
      }
    }
    newGroup() {
      return this.grp = $(document.createElement("span")).addClass("btn_group").appendTo(this.span).hide();
    }
    add(key:string, alttext:string, icon:string, fn:(e,combo) => void) {
      var btn = null;
      if (icon) {
        btn = $(document.createElement("button")).addClass("btn");
        if (icon.startsWith('glyphicon')) {
          icon = '<span class="glyphicon ' + icon + '" aria-hidden="true"></span>';
        }
        btn.html(icon);
        btn.prop("title", key ? (alttext+" ("+formatKey(key)+")") : alttext);
        btn.click(fn);
        this.grp.append(btn).show();
      }
      if (key) {
        if (!this.focusDiv && parseKeyBinding(key)) {
          // layout-safe global binding: fires even when the editor has focus
          this.keybinder.bind(key, fn);
        } else {
          // legacy fallback: mousetrap (positional matching, input-scoped)
          this.mousetrap.bind(key, (e, combo) => { fn(e, combo); return false; });
          this.boundkeys.push(key);
        }
      }
      return btn;
    }
    
  }
  