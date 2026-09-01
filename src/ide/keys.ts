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

export interface KeyBinding {
    mod: boolean;      // Cmd on macOS, Ctrl on Windows/Linux
    shift: boolean;
    key: string;       // normalized: 'a'-'z', '0'-'9', or 'arrowleft' etc.
}

const NAMED_KEYS: { [k: string]: string } = {
    left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown',
};

var _isMac: boolean | null = null;

export function isMacOS(): boolean {
    if (_isMac === null) {
        var nav = typeof navigator !== 'undefined' ? navigator : null;
        _isMac = !!nav && /mac|iphone|ipad|ipod/i.test(nav.platform || nav.userAgent || '');
    }
    return _isMac;
}

export function parseKeyBinding(spec: string): KeyBinding | null {
    var parts = spec.toLowerCase().split('+');
    var key = parts.pop() as string;
    var b: KeyBinding = { mod: false, shift: false, key: '' };
    for (var p of parts) {
        if (p == 'mod' || p == 'ctrl' || p == 'meta' || p == 'cmd') b.mod = true;
        else if (p == 'shift') b.shift = true;
        else {
            console.warn('Keyboard shortcut "' + spec + '": unsupported modifier "' + p + '" (alt is layout-dependent), skipping');
            return null;
        }
    }
    key = NAMED_KEYS[key] || key;
    var isLetter = /^[a-z]$/.test(key);
    if (!isLetter && !/^[0-9]$/.test(key) && !/^arrow/.test(key)) {
        console.warn('Keyboard shortcut "' + spec + '": key "' + key + '" is layout-dependent (use a-z, 0-9), skipping');
        return null;
    }
    if (b.shift && !isLetter && !/^arrow/.test(key)) {
        console.warn('Keyboard shortcut "' + spec + '": shift is only allowed with letters and arrows, skipping');
        return null;
    }
    b.key = key;
    return b;
}

export function matchesKeyBinding(b: KeyBinding, e: KeyboardEvent): boolean {
    if (e.altKey) return false; // we never bind alt; avoids AltGr ghosts while typing
    var mac = isMacOS();
    var modPressed = mac ? e.metaKey : e.ctrlKey;
    var otherPressed = mac ? e.ctrlKey : e.metaKey;
    if (b.mod !== modPressed || otherPressed) return false;
    if (b.shift !== e.shiftKey) return false;
    return (e.key || '').toLowerCase() === b.key;
}

export class KeyBinder {
    bindings: { binding: KeyBinding; fn: (e?: any, combo?: any) => void }[] = [];
    private handler = (e: KeyboardEvent) => {
        // defer to any handler that already claimed this event (CodeMirror
        // keymaps, browser UI, ...) -- they call preventDefault when handled
        if (e.defaultPrevented) return;
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
    bind(spec: string, fn: (e?: any, combo?: any) => void) {
        var b = parseKeyBinding(spec);
        if (b) this.bindings.push({ binding: b, fn });
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

// --- CodeMirror keymap interop ---
//
// CodeMirror calls preventDefault() on any key one of its keymaps handles, and
// KeyBinder (above) deliberately defers to that, so a key CodeMirror binds can
// never reach the IDE while an editor is focused. Handing a key over to the IDE
// therefore means removing CodeMirror's binding for it.
//
// The specs can't be compared as strings: CodeMirror writes modifiers in
// whatever order each binding's author chose ("Shift-Mod-k" for deleteLine,
// "Mod-Shift-l" for selectSelectionMatches), and a binding may carry
// per-platform specs that override its default one.

export interface CMKeyBinding {
    key?: string;
    mac?: string;
    win?: string;
    linux?: string;
}

const CM_MODIFIERS: { [k: string]: string } = {
    mod: 'Mod', cmd: 'Mod', meta: 'Mod', ctrl: 'Ctrl', control: 'Ctrl',
    shift: 'Shift', alt: 'Alt', option: 'Alt',
};

var _isWin: boolean | null = null;

function isWindows(): boolean {
    if (_isWin === null) {
        var nav = typeof navigator !== 'undefined' ? navigator : null;
        _isWin = !!nav && /win/i.test(nav.platform || nav.userAgent || '');
    }
    return _isWin;
}

// "Shift-Mod-k" and "Mod-Shift-K" both become "Mod-Shift-k"
export function normalizeCMKeySpec(spec: string): string {
    var parts = spec.split('-');
    var key = parts.pop() as string;
    if (key === '') key = '-'; // trailing dash means the key itself is '-'
    var mods: string[] = [];
    for (var p of parts) {
        if (p === '') continue; // "Mod--" splits to ['Mod', '', '']
        var m = CM_MODIFIERS[p.toLowerCase()] || p;
        if (m == 'Ctrl' && !isMacOS()) m = 'Mod'; // off macOS, Ctrl *is* Mod
        if (mods.indexOf(m) < 0) mods.push(m);
    }
    mods.sort();
    return mods.concat([key.toLowerCase()]).join('-');
}

// the spec CodeMirror will actually use on this platform
export function effectiveCMKeySpec(b: CMKeyBinding): string | undefined {
    var platform = isMacOS() ? b.mac : (isWindows() ? b.win : b.linux);
    return platform || b.key;
}

// every mod+shift+<letter> the IDE binds -- see the shortcuts in ui.ts, which
// testkeys.ts checks this list against
export const IDE_RESERVED_KEYS = [
    'Mod-Shift-a', 'Mod-Shift-d', 'Mod-Shift-e', 'Mod-Shift-f', 'Mod-Shift-g',
    'Mod-Shift-h', 'Mod-Shift-i', 'Mod-Shift-j', 'Mod-Shift-k', 'Mod-Shift-l',
    'Mod-Shift-r', 'Mod-Shift-x', 'Mod-Shift-y',
];

// drop the bindings that would swallow one of the IDE's own shortcuts
export function stripCMKeymap<T extends CMKeyBinding>(keymap: readonly T[], specs: string[]): T[] {
    var freed = specs.map(normalizeCMKeySpec);
    return keymap.filter(function (b) {
        var spec = effectiveCMKeySpec(b);
        return !spec || freed.indexOf(normalizeCMKeySpec(spec)) < 0;
    });
}
