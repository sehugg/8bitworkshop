"use strict";
// MINIMAL KEYBOARD SHORTCUT MATCHER
//
// Follows the rules from "All JavaScript keyboard shortcut libraries are
// broken" (Hazel Duvall, 2025-01-10):
//   - match on KeyboardEvent.key (layout-aware), never code/keyCode/which
//     (mousetrap and most libraries use which -> wrong keys on Dvorak etc.)
//   - only roman letters (A-Z), digits, and named navigation keys
//   - normalize case, so Shift never changes what is matched
//   - Shift is only allowed with letters (Shift mutates digits/punctuation)
//   - never use Alt (macOS Option mutates letters, e.g. Alt+R = '®';
//     AltGr = Ctrl+Alt on international PC layouts)
//   - 'mod' = Cmd on macOS, Ctrl on Windows/Linux
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDE_RESERVED_KEYS = exports.KeyBinder = void 0;
exports.isMacOS = isMacOS;
exports.parseKeyBinding = parseKeyBinding;
exports.matchesKeyBinding = matchesKeyBinding;
exports.normalizeCMKeySpec = normalizeCMKeySpec;
exports.effectiveCMKeySpec = effectiveCMKeySpec;
exports.stripCMKeymap = stripCMKeymap;
const NAMED_KEYS = {
    left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown',
};
var _isMac = null;
function isMacOS() {
    if (_isMac === null) {
        var nav = typeof navigator !== 'undefined' ? navigator : null;
        _isMac = !!nav && /mac|iphone|ipad|ipod/i.test(nav.platform || nav.userAgent || '');
    }
    return _isMac;
}
function parseKeyBinding(spec) {
    var parts = spec.toLowerCase().split('+');
    var key = parts.pop();
    var b = { mod: false, shift: false, key: '' };
    for (var p of parts) {
        if (p == 'mod' || p == 'ctrl' || p == 'meta' || p == 'cmd')
            b.mod = true;
        else if (p == 'shift')
            b.shift = true;
        else {
            console.warn('Keyboard shortcut "' + spec + '": unsupported modifier "' + p + '" (alt is layout-dependent), skipping');
            return null;
        }
    }
    key = NAMED_KEYS[key] || key;
    var isLetter = /^[a-z]$/.test(key);
    var isFKey = /^f([1-9]|1[0-2])$/.test(key);
    if (!isLetter && !isFKey && !/^[0-9]$/.test(key) && !/^arrow/.test(key)) {
        console.warn('Keyboard shortcut "' + spec + '": key "' + key + '" is layout-dependent (use a-z, 0-9, f1-f12), skipping');
        return null;
    }
    if (b.shift && !isLetter && !/^arrow/.test(key)) {
        console.warn('Keyboard shortcut "' + spec + '": shift is only allowed with letters and arrows, skipping');
        return null;
    }
    b.key = key;
    return b;
}
function matchesKeyBinding(b, e) {
    if (e.altKey)
        return false; // we never bind alt; avoids AltGr ghosts while typing
    var mac = isMacOS();
    var modPressed = mac ? e.metaKey : e.ctrlKey;
    var otherPressed = mac ? e.ctrlKey : e.metaKey;
    if (b.mod !== modPressed || otherPressed)
        return false;
    if (b.shift !== e.shiftKey)
        return false;
    return (e.key || '').toLowerCase() === b.key;
}
class KeyBinder {
    constructor() {
        this.bindings = [];
        this.handler = (e) => {
            // defer to any handler that already claimed this event (CodeMirror
            // keymaps, browser UI, ...) -- they call preventDefault when handled
            if (e.defaultPrevented)
                return;
            for (var i = 0; i < this.bindings.length; i++) {
                var bind = this.bindings[i];
                if (matchesKeyBinding(bind.binding, e)) {
                    e.preventDefault();
                    e.stopPropagation();
                    bind.fn(e);
                    return;
                }
            }
        };
    }
    bind(spec, fn) {
        var b = parseKeyBinding(spec);
        if (b)
            this.bindings.push({ binding: b, fn });
    }
    unbindAll() {
        this.bindings = [];
    }
    attach() {
        window.addEventListener('keydown', this.handler);
    }
    detach() {
        window.removeEventListener('keydown', this.handler);
    }
}
exports.KeyBinder = KeyBinder;
const CM_MODIFIERS = {
    mod: 'Mod', cmd: 'Mod', meta: 'Mod', ctrl: 'Ctrl', control: 'Ctrl',
    shift: 'Shift', alt: 'Alt', option: 'Alt',
};
var _isWin = null;
function isWindows() {
    if (_isWin === null) {
        var nav = typeof navigator !== 'undefined' ? navigator : null;
        _isWin = !!nav && /win/i.test(nav.platform || nav.userAgent || '');
    }
    return _isWin;
}
// "Shift-Mod-k" and "Mod-Shift-K" both become "Mod-Shift-k"
function normalizeCMKeySpec(spec) {
    var parts = spec.split('-');
    var key = parts.pop();
    if (key === '')
        key = '-'; // trailing dash means the key itself is '-'
    var mods = [];
    for (var p of parts) {
        if (p === '')
            continue; // "Mod--" splits to ['Mod', '', '']
        var m = CM_MODIFIERS[p.toLowerCase()] || p;
        if (m == 'Ctrl' && !isMacOS())
            m = 'Mod'; // off macOS, Ctrl *is* Mod
        if (mods.indexOf(m) < 0)
            mods.push(m);
    }
    mods.sort();
    return mods.concat([key.toLowerCase()]).join('-');
}
// the spec CodeMirror will actually use on this platform
function effectiveCMKeySpec(b) {
    var platform = isMacOS() ? b.mac : (isWindows() ? b.win : b.linux);
    return platform || b.key;
}
// every mod+shift+<letter> the IDE binds -- see the shortcuts in ui.ts, which
// testkeys.ts checks this list against
exports.IDE_RESERVED_KEYS = [
    'Mod-Shift-a', 'Mod-Shift-d', 'Mod-Shift-e', 'Mod-Shift-f', 'Mod-Shift-g',
    'Mod-Shift-h', 'Mod-Shift-i', 'Mod-Shift-j', 'Mod-Shift-k', 'Mod-Shift-l',
    'Mod-Shift-r', 'Mod-Shift-x', 'Mod-Shift-y',
];
// drop the bindings that would swallow one of the IDE's own shortcuts
function stripCMKeymap(keymap, specs) {
    var freed = specs.map(normalizeCMKeySpec);
    return keymap.filter(function (b) {
        var spec = effectiveCMKeySpec(b);
        return !spec || freed.indexOf(normalizeCMKeySpec(spec)) < 0;
    });
}
//# sourceMappingURL=keys.js.map