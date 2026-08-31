import $ = require("jquery");
import { isMacOS } from "./keys";

// KEYBOARD SHORTCUTS / STATUS BAR
//
// Display-only bar with two zones:
//   left:  context-sensitive keyboard shortcuts (chips of form "<kbd> Ctrl+Alt+R Reset")
//   right: status items (errors, debug state, etc.)
//
// The bar does NOT bind any keys -- actual key handling lives where it
// always has (mousetrap in Toolbar, CodeMirror keymaps). The bar reflects
// what is available in the current context; chips are clickable where an
// obvious action exists.

export interface Shortcut {
    key: string;            // display combo, e.g. "Ctrl+Alt+R"
    label: string;
    fn?: (e?, combo?) => void;  // optional: makes the chip clickable
}

export interface StatusItem {
    text: string;
    cls?: string;           // extra css class, e.g. 'error' 'ok' 'running'
    title?: string;         // tooltip
    fn?: (e?) => void;      // optional: makes the chip clickable
}

// display a mousetrap-style key spec for the current platform:
//   mac:       'mod+shift+r' -> '⇧⌘R',  'ctrl+alt+r' -> '⌃⌥R'
//   win/linux: 'mod+shift+r' -> 'Ctrl+Shift+R'
// unknown parts (e.g. punctuation keys) pass through unchanged
const MAC_SYMBOLS: { [mod: string]: string } = { shift: '⇧', ctrl: '⌃', alt: '⌥', meta: '⌘', mod: '⌘', cmd: '⌘' };
const PC_NAMES: { [mod: string]: string } = { shift: 'Shift', ctrl: 'Ctrl', alt: 'Alt', meta: 'Win', mod: 'Ctrl', cmd: 'Cmd' };
const KEY_SYMBOLS: { [k: string]: string } = { arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', backspace: '⌫', enter: '↩', tab: '⇥', escape: '⎋' };

export function formatKey(key: string): string {
    var parts = key.toLowerCase().split('+');
    var main = parts.pop() as string;
    var isMac = isMacOS();
    // canonical display order: shift first on mac (HIG), ctrl first on PC
    var order = isMac ? ['shift', 'ctrl', 'alt', 'meta', 'mod', 'cmd'] : ['mod', 'ctrl', 'shift', 'alt', 'meta', 'cmd'];
    var uniq = order.filter((p) => parts.indexOf(p) >= 0);
    for (var p of parts) if (uniq.indexOf(p) < 0) uniq.push(p);
    var modStr = uniq.map((p) => isMac ? (MAC_SYMBOLS[p] || p) : (PC_NAMES[p] || p)).join(isMac ? '' : '+');
    var mainDisp = /^[a-z]$/.test(main) ? main.toUpperCase() : (KEY_SYMBOLS[main] || (isMac ? main : main.charAt(0).toUpperCase() + main.slice(1)));
    return (modStr ? modStr + (isMac ? '' : '+') : '') + mainDisp;
}

export class ShortcutBar {
    div: HTMLElement;
    shortcutsSig: string = "";
    status: { [id: string]: StatusItem } = {};
    shortcutsZone: JQuery;
    statusZone: JQuery;
    visible: boolean = true;

    constructor(div: HTMLElement) {
        this.div = div;
        this.shortcutsZone = $(document.createElement("span")).addClass("shortcuts_zone");
        this.statusZone = $(document.createElement("span")).addClass("status_zone");
        $(div).append(this.shortcutsZone).append(this.statusZone);
    }

    setShortcuts(shortcuts: Shortcut[]) {
        if (!this.visible) return;
        // skip re-render if nothing changed
        var sig = shortcuts.map((s) => s.key + "\u0001" + s.label).join("\u0002");
        if (sig === this.shortcutsSig) return;
        this.shortcutsSig = sig;
        this.shortcutsZone.empty();
        for (var s of shortcuts) {
            var span = $(document.createElement("span")).addClass("shortcut");
            span.append($(document.createElement("kbd")).text(formatKey(s.key)));
            span.append(document.createTextNode(" " + s.label));
            if (s.fn) {
                makeClickable(span, s.fn);
            }
            this.shortcutsZone.append(span);
        }
    }

    setStatus(id: string, item: StatusItem | null) {
        if (item) this.status[id] = item;
        else delete this.status[id];
        this.renderStatus();
    }

    renderStatus() {
        if (!this.visible) return;
        this.statusZone.empty();
        for (var key of Object.keys(this.status)) {
            var s = this.status[key];
            var span = $(document.createElement("span")).addClass("status_item");
            if (s.cls) span.addClass(s.cls);
            if (s.title) span.prop("title", s.title);
            span.text(s.text);
            if (s.fn) {
                makeClickable(span, s.fn);
            }
            this.statusZone.append(span);
        }
    }
}

function makeClickable(span: JQuery, fn: (e?) => void) {
    // don't steal focus on mousedown: clicking a chip would blur the active
    // view and re-render the bar (removing the chip) before the click lands
    span.addClass("clickable");
    span.mousedown((e) => e.preventDefault());
    span.click(fn);
}

// module-level singleton + provider wiring
// (avoids circular imports between ui.ts / windows.ts / views)

export var shortcutBar: ShortcutBar = null;

export function initShortcutBar(div: HTMLElement) {
    shortcutBar = new ShortcutBar(div);
}

var globalShortcutsFn: () => Shortcut[] = () => [];
var viewShortcutsFn: () => Shortcut[] = () => [];

// global/debug shortcuts are composed by ui.ts (knows debug state)
export function setGlobalShortcutsFn(fn: () => Shortcut[]) { globalShortcutsFn = fn; }
// view-specific shortcuts come from the active ProjectView's getShortcuts()
export function setViewShortcutsFn(fn: () => Shortcut[]) { viewShortcutsFn = fn; }

// status items are updated directly by the subsystem that owns them
export function setBarStatus(id: string, item: StatusItem | null) {
    if (shortcutBar) shortcutBar.setStatus(id, item);
}

// show/hide the whole bar (driven by the IDE setting); also collapses
// the bottom spacing via the body class (see css/ui.css)
export function setBarVisible(visible: boolean) {
    $(document.body).toggleClass("statusbar-hidden", !visible);
    if (shortcutBar) {
        shortcutBar.visible = visible;
        if (visible) {
            shortcutBar.shortcutsSig = ""; // force re-render on next refresh
            shortcutBar.renderStatus();
            refreshShortcutBar();
        }
    }
}

export function refreshShortcutBar() {
    if (shortcutBar) shortcutBar.setShortcuts([...globalShortcutsFn(), ...viewShortcutsFn()].filter((s) => !isBrowserEaten(s.key)));
}

// combos the browser/OS reserves and won't let a page intercept:
// hide them from the bar rather than advertise dead keys
// (the underlying bindings stay in place for platforms where they work)
function isBrowserEaten(key: string): boolean {
    var k = key.toLowerCase();
    if (!isMacOS()) {
        // Chrome/Firefox devtools on Windows/Linux: Ctrl+Shift+I/J/K
        if (k == 'mod+shift+i' || k == 'mod+shift+j' || k == 'mod+shift+k') return true;
        // GNOME desktop: terminal / lock screen
        if (k == 'ctrl+alt+t' || k == 'ctrl+alt+l') return true;
    }
    return false;
}
