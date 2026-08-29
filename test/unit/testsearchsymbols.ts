import assert from "assert";
import { describe, it } from "mocha";
import { extractSymbols } from "../../src/common/symbols";
import { extractDocComment, extractTrailingComment } from "../../src/common/symbols/doccomment";
import { SymbolRecord } from "../../src/common/searchtypes";

describe('Symbol Extraction', function () {
  describe('Basic Symbol Extraction', function () {
    it('should extract #define macros from C/C++', function () {
      const text = `#define MAX_SIZE 100\n#define JOY_BTN_1_MASK 1\n`;
      const records = extractSymbols(text, 'test.h', 'text/x-csrc', 'project');

      const defines = records.filter(r => r.kind === 'macro');
      assert.strictEqual(defines.length, 2);

      const maxMacro = defines.find(r => r.name === 'MAX_SIZE');
      assert.ok(maxMacro, 'Should find MAX_SIZE macro');
      assert.strictEqual(maxMacro.name, 'MAX_SIZE');
      assert.strictEqual(maxMacro.kind, 'macro');

      const joyMacro = defines.find(r => r.name === 'JOY_BTN_1_MASK');
      assert.ok(joyMacro, 'Should find JOY_BTN_1_MASK macro');
      assert.strictEqual(joyMacro.name, 'JOY_BTN_1_MASK');
    });

    it('should extract 6502 labels', function () {
      const text = `foo:    lda #$10\nbar:    sta $80\n`;
      const records = extractSymbols(text, 'test.s', '6502', 'project');

      const labels = records.filter(r => r.kind === 'label');
      assert.strictEqual(labels.length, 2);

      const fooLabel = labels.find(r => r.name === 'foo');
      assert.ok(fooLabel, 'Should find foo label');
      assert.strictEqual(fooLabel.line, 1);

      const barLabel = labels.find(r => r.name === 'bar');
      assert.ok(barLabel, 'Should find bar label');
      assert.strictEqual(barLabel.line, 2);
    });

    it('should extract 6502 equates', function () {
      const text = `BAR = $1234\nFOO = $5678\n`;
      const records = extractSymbols(text, 'test.s', '6502', 'project');

      const equates = records.filter(r => r.kind === 'equate');
      assert.strictEqual(equates.length, 2);

      const barEquate = equates.find(r => r.name === 'BAR');
      assert.ok(barEquate, 'Should find BAR equate');
      assert.strictEqual(barEquate.name, 'BAR');

      const fooEquate = equates.find(r => r.name === 'FOO');
      assert.ok(fooEquate, 'Should find FOO equate');
      assert.strictEqual(fooEquate.name, 'FOO');
    });

    it('should not extract label-like text inside comments', function () {
      const text = `lda #$10 ; foo: this is a comment\nlabel:\n`;
      const records = extractSymbols(text, 'test.s', '6502', 'project');

      const labels = records.filter(r => r.kind === 'label');
      assert.strictEqual(labels.length, 1);

      const label = labels[0];
      assert.strictEqual(label.name, 'label', 'Should extract label, not colon from comment');
    });
  });

  describe('Doc comment extraction (Rule 3)', function () {
    it('should extract brief from plain comment immediately above', function () {
      const lines = [
        '/* The name of the standard joystick driver for a platform */',
        'extern const char joy_stddrv[];'
      ];
      const doc = extractDocComment(lines, 2);
      assert.ok(doc, 'Should extract doc comment');
      assert.ok(doc.brief, 'Should have brief');
      assert.strictEqual(doc.brief, 'The name of the standard joystick driver for a platform', 'Brief should match comment text');
    });

    it('should use trailing comment as brief', function () {
      const text = '#define MAX 1  /* maximum value */';
      const brief = extractTrailingComment(text);
      assert.ok(brief, 'Should extract trailing comment');
      assert.strictEqual(brief, 'maximum value', 'Brief should match comment text');
    });

    it('should return null when no doc comments exist', function () {
      const lines = ['extern const char joy_stddrv[];'];
      const doc = extractDocComment(lines, 1);
      assert.strictEqual(doc, null, 'Should return null when no doc comments');
    });
  });

  describe('Cross-language extraction', function () {
    it('should handle wiz editor style (basic extraction)', function () {
      const text = `func main() {\n  return 0;\n}\n`;
      const records = extractSymbols(text, 'test.wiz', 'text/x-wiz', 'project');
      assert.ok(Array.isArray(records), 'Should return array for wiz extraction');
    });

    it('should handle dialog editor style (basic extraction)', function () {
      const text = `@@ Clear, bright, and spacious\n!(kitchen) A kitchen.`;
      const records = extractSymbols(text, 'game.dlg', 'dialog', 'project');
      assert.ok(Array.isArray(records), 'Should return array for dialog extraction');
    });
  });
});

describe('SymbolRecord Type', function () {
  it('should create valid SymbolRecord', function () {
    const record: SymbolRecord = {
      id: 'test.c:1:main',
      name: 'main',
      kind: 'func',
      source: 'project',
      file: 'test.c',
      line: 1
    };

    assert.strictEqual(record.id, 'test.c:1:main');
    assert.strictEqual(record.name, 'main');
    assert.strictEqual(record.kind, 'func');
    assert.strictEqual(record.source, 'project');
    assert.strictEqual(record.file, 'test.c');
    assert.strictEqual(record.line, 1);
  });
});