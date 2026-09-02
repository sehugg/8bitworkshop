"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const commands_1 = require("@codemirror/commands");
const search_1 = require("@codemirror/search");
const fs = __importStar(require("fs"));
const keys_1 = require("../../src/ide/keys");
function keyEvent(key, mods) {
    var mod = !!mods.mod;
    return {
        key,
        ctrlKey: mod && !(0, keys_1.isMacOS)(), metaKey: mod && (0, keys_1.isMacOS)(),
        shiftKey: !!mods.shift, altKey: !!mods.alt
    };
}
(0, mocha_1.describe)('parseKeyBinding', () => {
    it('should parse mod+shift+letter', () => {
        assert_1.default.deepStrictEqual((0, keys_1.parseKeyBinding)('mod+shift+k'), { mod: true, shift: true, key: 'k' });
        assert_1.default.deepStrictEqual((0, keys_1.parseKeyBinding)('MOD+SHIFT+K'), { mod: true, shift: true, key: 'k' });
    });
    it('should map arrow aliases', () => {
        assert_1.default.strictEqual((0, keys_1.parseKeyBinding)('mod+left').key, 'arrowleft');
    });
    it('should parse f-keys', () => {
        assert_1.default.deepStrictEqual((0, keys_1.parseKeyBinding)('f8'), { mod: false, shift: false, key: 'f8' });
        assert_1.default.deepStrictEqual((0, keys_1.parseKeyBinding)('F12'), { mod: false, shift: false, key: 'f12' });
        assert_1.default.strictEqual((0, keys_1.parseKeyBinding)('f13'), null);
    });
    it('should reject layout-dependent specs', () => {
        assert_1.default.strictEqual((0, keys_1.parseKeyBinding)('mod+alt+k'), null); // alt is never bound
        assert_1.default.strictEqual((0, keys_1.parseKeyBinding)('mod+shift+='), null); // shift mutates punctuation
        assert_1.default.strictEqual((0, keys_1.parseKeyBinding)('mod+shift+1'), null); // ...and digits
    });
});
(0, mocha_1.describe)('matchesKeyBinding', () => {
    const b = (0, keys_1.parseKeyBinding)('mod+shift+k');
    it('should match regardless of the reported case', () => {
        assert_1.default.ok((0, keys_1.matchesKeyBinding)(b, keyEvent('K', { mod: true, shift: true })));
        assert_1.default.ok((0, keys_1.matchesKeyBinding)(b, keyEvent('k', { mod: true, shift: true })));
    });
    it('should not match without the modifiers', () => {
        assert_1.default.ok(!(0, keys_1.matchesKeyBinding)(b, keyEvent('k', { mod: true })));
        assert_1.default.ok(!(0, keys_1.matchesKeyBinding)(b, keyEvent('k', { shift: true })));
        assert_1.default.ok(!(0, keys_1.matchesKeyBinding)(b, keyEvent('k', { mod: true, shift: true, alt: true })));
    });
});
(0, mocha_1.describe)('normalizeCMKeySpec', () => {
    it('should ignore modifier order and case', () => {
        // the bug this test exists for: CodeMirror binds deleteLine as
        // "Shift-Mod-k", which an exact string match against "Mod-Shift-k" misses
        assert_1.default.strictEqual((0, keys_1.normalizeCMKeySpec)('Shift-Mod-k'), (0, keys_1.normalizeCMKeySpec)('Mod-Shift-k'));
        assert_1.default.strictEqual((0, keys_1.normalizeCMKeySpec)('Mod-Shift-K'), 'Mod-Shift-k');
        assert_1.default.strictEqual((0, keys_1.normalizeCMKeySpec)('Cmd-Shift-k'), 'Mod-Shift-k');
    });
    it('should keep distinct keys distinct', () => {
        assert_1.default.notStrictEqual((0, keys_1.normalizeCMKeySpec)('Mod-Shift-k'), (0, keys_1.normalizeCMKeySpec)('Mod-k'));
        assert_1.default.notStrictEqual((0, keys_1.normalizeCMKeySpec)('Mod-Shift-k'), (0, keys_1.normalizeCMKeySpec)('Mod-Alt-k'));
    });
    it('should handle the minus key', () => {
        assert_1.default.strictEqual((0, keys_1.normalizeCMKeySpec)('Mod--'), 'Mod--');
    });
});
(0, mocha_1.describe)('stripCMKeymap', () => {
    const keymaps = {
        defaultKeymap: commands_1.defaultKeymap, searchKeymap: search_1.searchKeymap
    };
    for (const name of Object.keys(keymaps)) {
        it(`should leave no IDE shortcut bound in ${name}`, () => {
            const left = (0, keys_1.stripCMKeymap)(keymaps[name], keys_1.IDE_RESERVED_KEYS)
                .map(keys_1.effectiveCMKeySpec)
                .filter((s) => s && keys_1.IDE_RESERVED_KEYS.some((r) => (0, keys_1.normalizeCMKeySpec)(r) == (0, keys_1.normalizeCMKeySpec)(s)));
            assert_1.default.deepStrictEqual(left, [], `${name} still binds ${left}`);
        });
    }
    it('should actually remove the two known collisions', () => {
        assert_1.default.strictEqual((0, keys_1.stripCMKeymap)(commands_1.defaultKeymap, keys_1.IDE_RESERVED_KEYS).length, commands_1.defaultKeymap.length - 1);
        assert_1.default.strictEqual((0, keys_1.stripCMKeymap)(search_1.searchKeymap, keys_1.IDE_RESERVED_KEYS).length, search_1.searchKeymap.length - 1);
    });
    it('should not disturb bindings the IDE does not claim', () => {
        // Mod-Shift-z (redo on mac) is not an IDE shortcut and must survive
        assert_1.default.strictEqual((0, keys_1.stripCMKeymap)(commands_1.historyKeymap, keys_1.IDE_RESERVED_KEYS).length, commands_1.historyKeymap.length);
    });
});
(0, mocha_1.describe)('IDE_RESERVED_KEYS', () => {
    it('should cover every mod+shift shortcut ui.ts binds', () => {
        const src = fs.readFileSync(__dirname + '/../../../src/ide/ui.ts', 'utf-8');
        const bound = new Set((src.match(/'mod\+shift\+[a-z]'/g) || []).map((s) => s.replace(/'/g, '')));
        assert_1.default.ok(bound.size > 0, 'found no shortcuts in ui.ts -- did the spelling change?');
        const reserved = new Set(keys_1.IDE_RESERVED_KEYS.map(keys_1.normalizeCMKeySpec));
        for (const key of bound) {
            const spec = (0, keys_1.normalizeCMKeySpec)(key.replace(/\+/g, '-'));
            assert_1.default.ok(reserved.has(spec), `ui.ts binds ${key}, missing from IDE_RESERVED_KEYS`);
        }
    });
});
//# sourceMappingURL=testkeys.js.map