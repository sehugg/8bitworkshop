import assert from "assert";
import { describe } from "mocha";
import { defaultKeymap, historyKeymap } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import * as fs from "fs";
import {
    CMKeyBinding, IDE_RESERVED_KEYS, effectiveCMKeySpec, isMacOS, matchesKeyBinding,
    normalizeCMKeySpec, parseKeyBinding, stripCMKeymap
} from "../../src/ide/keys";

function keyEvent(key: string, mods: { mod?: boolean, shift?: boolean, alt?: boolean }): any {
    var mod = !!mods.mod;
    return {
        key,
        ctrlKey: mod && !isMacOS(), metaKey: mod && isMacOS(),
        shiftKey: !!mods.shift, altKey: !!mods.alt
    };
}

describe('parseKeyBinding', () => {
    it('should parse mod+shift+letter', () => {
        assert.deepStrictEqual(parseKeyBinding('mod+shift+k'), { mod: true, shift: true, key: 'k' });
        assert.deepStrictEqual(parseKeyBinding('MOD+SHIFT+K'), { mod: true, shift: true, key: 'k' });
    });
    it('should map arrow aliases', () => {
        assert.strictEqual(parseKeyBinding('mod+left').key, 'arrowleft');
    });
    it('should reject layout-dependent specs', () => {
        assert.strictEqual(parseKeyBinding('mod+alt+k'), null);  // alt is never bound
        assert.strictEqual(parseKeyBinding('mod+shift+='), null); // shift mutates punctuation
        assert.strictEqual(parseKeyBinding('mod+shift+1'), null); // ...and digits
    });
});

describe('matchesKeyBinding', () => {
    const b = parseKeyBinding('mod+shift+k');
    it('should match regardless of the reported case', () => {
        assert.ok(matchesKeyBinding(b, keyEvent('K', { mod: true, shift: true })));
        assert.ok(matchesKeyBinding(b, keyEvent('k', { mod: true, shift: true })));
    });
    it('should not match without the modifiers', () => {
        assert.ok(!matchesKeyBinding(b, keyEvent('k', { mod: true })));
        assert.ok(!matchesKeyBinding(b, keyEvent('k', { shift: true })));
        assert.ok(!matchesKeyBinding(b, keyEvent('k', { mod: true, shift: true, alt: true })));
    });
});

describe('normalizeCMKeySpec', () => {
    it('should ignore modifier order and case', () => {
        // the bug this test exists for: CodeMirror binds deleteLine as
        // "Shift-Mod-k", which an exact string match against "Mod-Shift-k" misses
        assert.strictEqual(normalizeCMKeySpec('Shift-Mod-k'), normalizeCMKeySpec('Mod-Shift-k'));
        assert.strictEqual(normalizeCMKeySpec('Mod-Shift-K'), 'Mod-Shift-k');
        assert.strictEqual(normalizeCMKeySpec('Cmd-Shift-k'), 'Mod-Shift-k');
    });
    it('should keep distinct keys distinct', () => {
        assert.notStrictEqual(normalizeCMKeySpec('Mod-Shift-k'), normalizeCMKeySpec('Mod-k'));
        assert.notStrictEqual(normalizeCMKeySpec('Mod-Shift-k'), normalizeCMKeySpec('Mod-Alt-k'));
    });
    it('should handle the minus key', () => {
        assert.strictEqual(normalizeCMKeySpec('Mod--'), 'Mod--');
    });
});

describe('stripCMKeymap', () => {
    const keymaps: { [name: string]: readonly CMKeyBinding[] } = {
        defaultKeymap, searchKeymap
    };
    for (const name of Object.keys(keymaps)) {
        it(`should leave no IDE shortcut bound in ${name}`, () => {
            const left = stripCMKeymap(keymaps[name], IDE_RESERVED_KEYS)
                .map(effectiveCMKeySpec)
                .filter((s) => s && IDE_RESERVED_KEYS.some((r) => normalizeCMKeySpec(r) == normalizeCMKeySpec(s)));
            assert.deepStrictEqual(left, [], `${name} still binds ${left}`);
        });
    }
    it('should actually remove the two known collisions', () => {
        assert.strictEqual(stripCMKeymap(defaultKeymap, IDE_RESERVED_KEYS).length, defaultKeymap.length - 1);
        assert.strictEqual(stripCMKeymap(searchKeymap, IDE_RESERVED_KEYS).length, searchKeymap.length - 1);
    });
    it('should not disturb bindings the IDE does not claim', () => {
        // Mod-Shift-z (redo on mac) is not an IDE shortcut and must survive
        assert.strictEqual(stripCMKeymap(historyKeymap, IDE_RESERVED_KEYS).length, historyKeymap.length);
    });
});

describe('IDE_RESERVED_KEYS', () => {
    it('should cover every mod+shift shortcut ui.ts binds', () => {
        const src = fs.readFileSync(__dirname + '/../../../src/ide/ui.ts', 'utf-8');
        const bound = new Set((src.match(/'mod\+shift\+[a-z]'/g) || []).map((s) => s.replace(/'/g, '')));
        assert.ok(bound.size > 0, 'found no shortcuts in ui.ts -- did the spelling change?');
        const reserved = new Set(IDE_RESERVED_KEYS.map(normalizeCMKeySpec));
        for (const key of bound) {
            const spec = normalizeCMKeySpec(key.replace(/\+/g, '-'));
            assert.ok(reserved.has(spec), `ui.ts binds ${key}, missing from IDE_RESERVED_KEYS`);
        }
    });
});
