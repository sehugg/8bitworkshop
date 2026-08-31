"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const symbols_1 = require("../../src/common/symbols");
const doccomment_1 = require("../../src/common/symbols/doccomment");
(0, mocha_1.describe)('Symbol Extraction', function () {
    (0, mocha_1.describe)('Basic Symbol Extraction', function () {
        (0, mocha_1.it)('should extract #define macros from C/C++', function () {
            const text = `#define MAX_SIZE 100\n#define JOY_BTN_1_MASK 1\n`;
            const records = (0, symbols_1.extractSymbols)(text, 'test.h', 'text/x-csrc', 'project');
            const defines = records.filter(r => r.kind === 'macro');
            assert_1.default.strictEqual(defines.length, 2);
            const maxMacro = defines.find(r => r.name === 'MAX_SIZE');
            assert_1.default.ok(maxMacro, 'Should find MAX_SIZE macro');
            assert_1.default.strictEqual(maxMacro.name, 'MAX_SIZE');
            assert_1.default.strictEqual(maxMacro.kind, 'macro');
            const joyMacro = defines.find(r => r.name === 'JOY_BTN_1_MASK');
            assert_1.default.ok(joyMacro, 'Should find JOY_BTN_1_MASK macro');
            assert_1.default.strictEqual(joyMacro.name, 'JOY_BTN_1_MASK');
        });
        (0, mocha_1.it)('should extract 6502 labels', function () {
            const text = `foo:    lda #$10\nbar:    sta $80\n`;
            const records = (0, symbols_1.extractSymbols)(text, 'test.s', '6502', 'project');
            const labels = records.filter(r => r.kind === 'label');
            assert_1.default.strictEqual(labels.length, 2);
            const fooLabel = labels.find(r => r.name === 'foo');
            assert_1.default.ok(fooLabel, 'Should find foo label');
            assert_1.default.strictEqual(fooLabel.line, 1);
            const barLabel = labels.find(r => r.name === 'bar');
            assert_1.default.ok(barLabel, 'Should find bar label');
            assert_1.default.strictEqual(barLabel.line, 2);
        });
        (0, mocha_1.it)('should extract 6502 equates', function () {
            const text = `BAR = $1234\nFOO = $5678\n`;
            const records = (0, symbols_1.extractSymbols)(text, 'test.s', '6502', 'project');
            const equates = records.filter(r => r.kind === 'equate');
            assert_1.default.strictEqual(equates.length, 2);
            const barEquate = equates.find(r => r.name === 'BAR');
            assert_1.default.ok(barEquate, 'Should find BAR equate');
            assert_1.default.strictEqual(barEquate.name, 'BAR');
            const fooEquate = equates.find(r => r.name === 'FOO');
            assert_1.default.ok(fooEquate, 'Should find FOO equate');
            assert_1.default.strictEqual(fooEquate.name, 'FOO');
        });
        (0, mocha_1.it)('should not extract label-like text inside comments', function () {
            const text = `lda #$10 ; foo: this is a comment\nlabel:\n`;
            const records = (0, symbols_1.extractSymbols)(text, 'test.s', '6502', 'project');
            const labels = records.filter(r => r.kind === 'label');
            assert_1.default.strictEqual(labels.length, 1);
            const label = labels[0];
            assert_1.default.strictEqual(label.name, 'label', 'Should extract label, not colon from comment');
        });
    });
    (0, mocha_1.describe)('Doc comment extraction (Rule 3)', function () {
        (0, mocha_1.it)('should extract brief from plain comment immediately above', function () {
            const lines = [
                '/* The name of the standard joystick driver for a platform */',
                'extern const char joy_stddrv[];'
            ];
            const doc = (0, doccomment_1.extractDocComment)(lines, 2);
            assert_1.default.ok(doc, 'Should extract doc comment');
            assert_1.default.ok(doc.brief, 'Should have brief');
            assert_1.default.strictEqual(doc.brief, 'The name of the standard joystick driver for a platform', 'Brief should match comment text');
        });
        (0, mocha_1.it)('should use trailing comment as brief', function () {
            const text = '#define MAX 1  /* maximum value */';
            const brief = (0, doccomment_1.extractTrailingComment)(text);
            assert_1.default.ok(brief, 'Should extract trailing comment');
            assert_1.default.strictEqual(brief, 'maximum value', 'Brief should match comment text');
        });
        (0, mocha_1.it)('should return null when no doc comments exist', function () {
            const lines = ['extern const char joy_stddrv[];'];
            const doc = (0, doccomment_1.extractDocComment)(lines, 1);
            assert_1.default.strictEqual(doc, null, 'Should return null when no doc comments');
        });
    });
    (0, mocha_1.describe)('Cross-language extraction', function () {
        (0, mocha_1.it)('should handle wiz editor style (basic extraction)', function () {
            const text = `func main() {\n  return 0;\n}\n`;
            const records = (0, symbols_1.extractSymbols)(text, 'test.wiz', 'text/x-wiz', 'project');
            assert_1.default.ok(Array.isArray(records), 'Should return array for wiz extraction');
        });
        (0, mocha_1.it)('should handle dialog editor style (basic extraction)', function () {
            const text = `@@ Clear, bright, and spacious\n!(kitchen) A kitchen.`;
            const records = (0, symbols_1.extractSymbols)(text, 'game.dlg', 'dialog', 'project');
            assert_1.default.ok(Array.isArray(records), 'Should return array for dialog extraction');
        });
    });
});
(0, mocha_1.describe)('SymbolRecord Type', function () {
    (0, mocha_1.it)('should create valid SymbolRecord', function () {
        const record = {
            id: 'test.c:1:main',
            name: 'main',
            kind: 'func',
            source: 'project',
            file: 'test.c',
            line: 1
        };
        assert_1.default.strictEqual(record.id, 'test.c:1:main');
        assert_1.default.strictEqual(record.name, 'main');
        assert_1.default.strictEqual(record.kind, 'func');
        assert_1.default.strictEqual(record.source, 'project');
        assert_1.default.strictEqual(record.file, 'test.c');
        assert_1.default.strictEqual(record.line, 1);
    });
});
//# sourceMappingURL=testsearchsymbols.js.map