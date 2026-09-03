"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortcutBar = exports.ShortcutBar = void 0;
exports.formatKey = formatKey;
exports.initShortcutBar = initShortcutBar;
exports.setGlobalShortcutsFn = setGlobalShortcutsFn;
exports.setViewShortcutsFn = setViewShortcutsFn;
exports.setBarStatus = setBarStatus;
exports.setBarVisible = setBarVisible;
exports.refreshShortcutBar = refreshShortcutBar;
exports.registerElementShortcuts = registerElementShortcuts;
exports.unregisterElementShortcuts = unregisterElementShortcuts;
const $ = require("jquery");
const keys_1 = require("./keys");
// display a mousetrap-style key spec for the current platform:
//   mac:       'mod+shift+r' -> '⇧⌘R',  'ctrl+alt+r' -> '⌃⌥R'
//   win/linux: 'mod+shift+r' -> 'Ctrl+Shift+R'
// unknown parts (e.g. punctuation keys) pass through unchanged
const MAC_SYMBOLS = { shift: '⇧', ctrl: '⌃', alt: '⌥', meta: '⌘', mod: '⌘', cmd: '⌘' };
const PC_NAMES = { shift: 'Shift', ctrl: 'Ctrl', alt: 'Alt', meta: 'Win', mod: 'Ctrl', cmd: 'Cmd' };
const KEY_SYMBOLS = { arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', backspace: '⌫', enter: '↩', tab: '⇥', escape: '⎋', space: '␣' };
function formatKey(key) {
    var parts = key.toLowerCase().split('+');
    var main = parts.pop();
    var isMac = (0, keys_1.isMacOS)();
    // canonical display order: shift first on mac (HIG), ctrl first on PC
    var order = isMac ? ['shift', 'ctrl', 'alt', 'meta', 'mod', 'cmd'] : ['mod', 'ctrl', 'shift', 'alt', 'meta', 'cmd'];
    var uniq = order.filter((p) => parts.indexOf(p) >= 0);
    for (var p of parts)
        if (uniq.indexOf(p) < 0)
            uniq.push(p);
    var modStr = uniq.map((p) => isMac ? (MAC_SYMBOLS[p] || p) : (PC_NAMES[p] || p)).join(isMac ? '' : '+');
    var mainDisp = /^[a-z][0-9]?$/.test(main) ? main.toUpperCase() : (KEY_SYMBOLS[main] || (isMac ? main : main.charAt(0).toUpperCase() + main.slice(1)));
    return (modStr ? modStr + (isMac ? '' : '+') : '') + mainDisp;
}
class ShortcutBar {
    constructor(div) {
        this.shortcutsSig = "";
        this.status = {};
        this.visible = true;
        // re-renders deferred while a mouse button is down (see trackMousePress)
        this.pendingShortcuts = null;
        this.pendingStatus = false;
        this.div = div;
        this.shortcutsZone = $(document.createElement("span")).addClass("shortcuts_zone");
        this.statusZone = $(document.createElement("span")).addClass("status_zone");
        $(div).append(this.shortcutsZone).append(this.statusZone);
    }
    setShortcuts(shortcuts) {
        if (!this.visible)
            return;
        // skip re-render if nothing changed
        var sig = shortcuts.map((s) => s.key + "\u0001" + s.label).join("\u0002");
        if (sig === this.shortcutsSig)
            return;
        if (mouseDown) {
            this.pendingShortcuts = shortcuts;
            return;
        }
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
    setStatus(id, item) {
        if (item)
            this.status[id] = item;
        else
            delete this.status[id];
        this.renderStatus();
    }
    renderStatus() {
        if (!this.visible)
            return;
        if (mouseDown) {
            this.pendingStatus = true;
            return;
        }
        this.statusZone.empty();
        for (var key of Object.keys(this.status)) {
            var s = this.status[key];
            var span = $(document.createElement("span")).addClass("status_item");
            if (s.cls)
                span.addClass(s.cls);
            if (s.title)
                span.prop("title", s.title);
            span.text(s.text);
            if (s.fn) {
                makeClickable(span, s.fn);
            }
            this.statusZone.append(span);
        }
    }
}
exports.ShortcutBar = ShortcutBar;
function makeClickable(span, fn) {
    // don't steal focus on mousedown: clicking a chip would blur the active
    // view and re-render the bar (removing the chip) before the click lands
    span.addClass("clickable");
    span.mousedown((e) => e.preventDefault());
    span.click(fn);
}
// while a mouse button is down, defer bar re-renders until mouseup:
// focus changes fire during mousedown (widgets focus() their container,
// chips can blur the active view), and re-rendering mid-press would swap
// the chips out from under the cursor before the click event lands
var mouseDown = false;
function flushPendingRenders() {
    if (!exports.shortcutBar)
        return;
    if (exports.shortcutBar.pendingShortcuts) {
        var shortcuts = exports.shortcutBar.pendingShortcuts;
        exports.shortcutBar.pendingShortcuts = null;
        exports.shortcutBar.setShortcuts(shortcuts);
    }
    if (exports.shortcutBar.pendingStatus) {
        exports.shortcutBar.pendingStatus = false;
        exports.shortcutBar.renderStatus();
    }
}
function trackMousePress() {
    $(document).on('mousedown.shortcutbar', () => { mouseDown = true; });
    $(document).on('mouseup.shortcutbar', () => { mouseDown = false; flushPendingRenders(); });
    // released outside the window: no mouseup fires, so flush on blur instead
    $(window).on('blur.shortcutbar', () => { mouseDown = false; flushPendingRenders(); });
}
// module-level singleton + provider wiring
// (avoids circular imports between ui.ts / windows.ts / views)
exports.shortcutBar = null;
function initShortcutBar(div) {
    exports.shortcutBar = new ShortcutBar(div);
    trackMousePress();
}
var globalShortcutsFn = () => [];
var viewShortcutsFn = () => [];
// global/debug shortcuts are composed by ui.ts (knows debug state)
function setGlobalShortcutsFn(fn) { globalShortcutsFn = fn; }
// view-specific shortcuts come from the active ProjectView's getShortcuts()
function setViewShortcutsFn(fn) { viewShortcutsFn = fn; }
// status items are updated directly by the subsystem that owns them
function setBarStatus(id, item) {
    if (exports.shortcutBar)
        exports.shortcutBar.setStatus(id, item);
}
// show/hide the whole bar (driven by the IDE setting); also collapses
// the bottom spacing via the body class (see css/ui.css)
function setBarVisible(visible) {
    $(document.body).toggleClass("statusbar-hidden", !visible);
    if (exports.shortcutBar) {
        exports.shortcutBar.visible = visible;
        if (visible) {
            exports.shortcutBar.shortcutsSig = ""; // force re-render on next refresh
            exports.shortcutBar.renderStatus();
            refreshShortcutBar();
        }
    }
}
function refreshShortcutBar() {
    if (!exports.shortcutBar)
        return;
    var shortcuts = [...globalShortcutsFn(), ...viewShortcutsFn()];
    // widget-scoped providers (e.g. the waveform viewer): show chips while
    // the widget's container has focus
    var ae = document.activeElement;
    for (var es of elementShortcuts) {
        if (ae && es.div.contains(ae))
            shortcuts = shortcuts.concat(es.fn());
    }
    exports.shortcutBar.setShortcuts(shortcuts.filter((s) => !isBrowserEaten(s.key)));
}
var elementShortcuts = [];
function registerElementShortcuts(div, fn) {
    elementShortcuts.push({ div, fn });
}
function unregisterElementShortcuts(div) {
    elementShortcuts = elementShortcuts.filter((es) => es.div !== div);
}
// combos the browser/OS reserves and won't let a page intercept:
// hide them from the bar rather than advertise dead keys
// (the underlying bindings stay in place for platforms where they work)
function isBrowserEaten(key) {
    var k = key.toLowerCase();
    if (!(0, keys_1.isMacOS)()) {
        // Chrome/Firefox devtools on Windows/Linux: Ctrl+Shift+I/J/K
        if (k == 'mod+shift+i' || k == 'mod+shift+j' || k == 'mod+shift+k')
            return true;
        // GNOME desktop: terminal / lock screen
        if (k == 'ctrl+alt+t' || k == 'ctrl+alt+l')
            return true;
    }
    return false;
}
//# sourceMappingURL=shortcutbar.js.map