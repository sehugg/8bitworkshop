import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as onig from 'vscode-oniguruma';
import { INITIAL, IGrammar, Registry, parseRawGrammar } from 'vscode-textmate';
import { ASM_LANGUAGES, makeContributions, makeGrammar, makeLanguageConfiguration } from '../src/syntaxgen';
import { getToolForPlatform } from '../../src/common/toolselect';
import { TOOL_META } from '../../src/common/toolmeta';

const EXT_ROOT = path.resolve(__dirname, '../..');

let registry: Registry;

async function loadGrammar(cpu: string): Promise<IGrammar> {
  if (!registry) {
    const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
    await onig.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
    registry = new Registry({
      onigLib: Promise.resolve({
        createOnigScanner: (s: string[]) => new onig.OnigScanner(s),
        createOnigString: (s: string) => new onig.OnigString(s),
      }),
      loadGrammar: async (scope: string) => {
        const lang = ASM_LANGUAGES.find((l) => `source.asm.${l.cpu}` === scope);
        return lang ? parseRawGrammar(JSON.stringify(makeGrammar(lang)), `${scope}.json`) : null;
      },
    });
  }
  return (await registry.loadGrammar(`source.asm.${cpu}`))!;
}

/** Tokenizes one line; returns [text, last scope without the suffix] pairs. */
function tokens(g: IGrammar, line: string): [string, string][] {
  const r = g.tokenizeLine(line, INITIAL);
  return r.tokens
    .map((t): [string, string] => [line.slice(t.startIndex, t.endIndex),
      t.scopes.length > 1 ? t.scopes[t.scopes.length - 1].replace(/\.[^.]+$/, '') : ''])
    .filter(([text]) => text.trim() !== '');
}

/** The scope of the first token whose text is `text`. */
function scopeOf(g: IGrammar, line: string, text: string): string {
  const t = tokens(g, line).find(([s]) => s === text);
  assert.ok(t, `no token '${text}' in ${JSON.stringify(tokens(g, line))}`);
  return t[1];
}

const LABEL = 'entity.name.function.label';
const OPCODE = 'keyword.other.opcode';
const DIRECTIVE = 'keyword.control.directive';
const CONSTANT = 'variable.other.constant';
const REGISTER = 'variable.language.register';
const MACRO_CALL = 'entity.name.function.macro.call';

describe('6502 grammar', function () {
  let g: IGrammar;
  before(async () => { g = await loadGrammar('6502'); });

  it('reads dasm: column-0 labels, plain directives, locals', function () {
    assert.equal(scopeOf(g, 'Start\tsei', 'Start'), LABEL);
    assert.equal(scopeOf(g, 'Start\tsei', 'sei'), OPCODE);
    assert.equal(scopeOf(g, '.CLEAR_STACK    dex', '.CLEAR_STACK'), LABEL);
    assert.equal(scopeOf(g, '\tprocessor 6502', 'processor'), DIRECTIVE);
    assert.equal(scopeOf(g, '\tseg.u Variables', 'seg.u'), DIRECTIVE);
    assert.equal(scopeOf(g, '\tSEG CODE', 'SEG'), DIRECTIVE);
    assert.equal(scopeOf(g, '\tdc.b $1,$2', 'dc.b'), DIRECTIVE);
    assert.equal(scopeOf(g, '\tlda.w $80', 'lda.w'), OPCODE);
    assert.equal(scopeOf(g, 'COLUP0 = $06', 'COLUP0'), CONSTANT);
    assert.equal(scopeOf(g, 'Height  equ 192', 'Height'), CONSTANT);
    assert.equal(scopeOf(g, '.CYCLES     SET {1}', '.CYCLES'), CONSTANT);
    assert.equal(scopeOf(g, '.CYCLES     SET {1}', '{1}'), 'variable.parameter');
    assert.equal(scopeOf(g, '            MAC SLEEP', 'SLEEP'), 'entity.name.function');
    assert.equal(scopeOf(g, '                IFNCONST NO_ILLEGAL', 'IFNCONST'), DIRECTIVE);
    assert.equal(scopeOf(g, '    SLEEP 12', 'SLEEP'), MACRO_CALL);
    assert.equal(scopeOf(g, '\tlax (zp),y', 'lax'), 'keyword.other.opcode.illegal');
  });

  it('reads ca65: dot directives, @locals, unnamed labels, functions', function () {
    assert.equal(scopeOf(g, '.segment "CODE"', '.segment'), DIRECTIVE);
    assert.equal(scopeOf(g, '.segment "CODE"', '"CODE"'), 'string.quoted.double');
    assert.equal(scopeOf(g, '.proc main', 'main'), 'entity.name.function');
    assert.equal(scopeOf(g, '  @loop: lda $2002', '@loop'), LABEL);
    assert.equal(scopeOf(g, '  @loop: lda $2002', 'lda'), OPCODE);
    assert.equal(scopeOf(g, 'nmi:', 'nmi'), LABEL);
    assert.equal(scopeOf(g, '  bne :-', ':-'), LABEL);
    assert.equal(scopeOf(g, '  lda #<.loword(foo)', '.loword'), 'support.function');
    assert.equal(scopeOf(g, '  lda #<.loword(foo)', '#'), 'keyword.operator.immediate');
    assert.equal(scopeOf(g, 'foo: .res 3', '.res'), DIRECTIVE);
    assert.equal(scopeOf(g, 'lda #0', 'lda'), OPCODE);
    assert.equal(scopeOf(g, 'SPEED := 3', 'SPEED'), CONSTANT);
  });

  it('marks index registers and numbers', function () {
    assert.equal(scopeOf(g, '  sta $0200,x', 'x'), REGISTER);
    assert.equal(scopeOf(g, '  sta $0200,x', '$0200'), 'constant.numeric.hex');
    assert.equal(scopeOf(g, '  asl a', 'a'), REGISTER);
    assert.equal(scopeOf(g, '  lda #%1110 ; bits', '%1110'), 'constant.numeric.binary');
    assert.equal(scopeOf(g, '  lda #%1110 ; bits', '; bits'), 'comment.line.semicolon');
    assert.equal(scopeOf(g, "  lda #'A", "'A"), 'string.quoted.single');
    assert.equal(scopeOf(g, '  lda a_var', 'a_var'), 'variable.other');
  });
});

describe('Z80 grammar', function () {
  let g: IGrammar;
  before(async () => { g = await loadGrammar('z80'); });

  it('reads zmac', function () {
    assert.equal(scopeOf(g, 'PrgStart:   DI', 'PrgStart'), LABEL);
    assert.equal(scopeOf(g, 'PrgStart:   DI', 'DI'), OPCODE);
    assert.equal(scopeOf(g, '            INCLUDE "hvglib.h"', 'INCLUDE'), DIRECTIVE);
    assert.equal(scopeOf(g, 'FrameCount  EQU     $4F00', 'FrameCount'), CONSTANT);
    assert.equal(scopeOf(g, '            DB      00001000b', '00001000b'), 'constant.numeric.binary');
    assert.equal(scopeOf(g, '            ld a,0FFh', '0FFh'), 'constant.numeric.hex');
    assert.equal(scopeOf(g, '            SYSTEM  INTPC', 'SYSTEM'), MACRO_CALL);
    assert.equal(scopeOf(g, "  ex af,af'", "af'"), REGISTER);
    assert.equal(scopeOf(g, '  ld (ix+2),a', 'ix'), REGISTER);
    assert.equal(scopeOf(g, '  jp nz,loop', 'nz'), 'keyword.other.condition');
    assert.equal(scopeOf(g, '  ret z', 'z'), 'keyword.other.condition');
    assert.equal(scopeOf(g, 'mymac macro arg', 'mymac'), 'entity.name.function');
  });

  it('reads sdas', function () {
    assert.equal(scopeOf(g, '\t.area _CODE', '.area'), DIRECTIVE);
    assert.equal(scopeOf(g, '\t.globl _main', '.globl'), DIRECTIVE);
    assert.equal(scopeOf(g, '00101$:', '00101$'), LABEL);
    assert.equal(scopeOf(g, '\tjr\tNZ,00101$', '00101$'), 'variable.other');
    assert.equal(scopeOf(g, '\tld\ta,#0x3f', '0x3f'), 'constant.numeric.hex');
    assert.equal(scopeOf(g, '\tldh\t(_x),a', 'ldh'), OPCODE);
  });
});

describe('6809 grammar', function () {
  let g: IGrammar;
  before(async () => { g = await loadGrammar('6809'); });

  it('reads Motorola-style source', function () {
    assert.equal(scopeOf(g, 'palette\tequ\t$c000', 'palette'), CONSTANT);
    assert.equal(scopeOf(g, '        leax\t1,x', 'leax'), OPCODE);
    assert.equal(scopeOf(g, '        leax\t1,x', 'x'), REGISTER);
    assert.equal(scopeOf(g, '\tfcb\t$1,$2', 'fcb'), DIRECTIVE);
    assert.equal(scopeOf(g, '* comment', '* comment'), 'comment.line.asterisk');
    assert.equal(scopeOf(g, '\tpshs a,b', 'b'), REGISTER);
  });
});

describe('assembler languages', function () {
  it('match package.json', function () {
    const pkg = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, 'package.json'), 'utf8'));
    const c = makeContributions();
    assert.deepEqual(pkg.contributes.languages, c.languages);
    assert.deepEqual(pkg.contributes.grammars, c.grammars);
  });

  it('claim only extensions whose tool uses that CPU style', function () {
    const style: Record<string, string> = { '8bws-6502': '6502', '8bws-z80': 'z80', '8bws-6809': '6809' };
    const platform: Record<string, string> = { '8bws-6502': 'nes', '8bws-z80': 'zx', '8bws-6809': 'williams' };
    for (const lang of ASM_LANGUAGES) {
      for (const ext of lang.extensions) {
        const tool = getToolForPlatform(platform[lang.id], `main${ext}`);
        assert.equal(TOOL_META[tool]?.editorStyle, style[lang.id], `${ext} -> ${tool}`);
      }
    }
  });

  it('have folding markers that match either case', function () {
    const cfg: any = makeLanguageConfiguration(ASM_LANGUAGES[0]);
    const start = new RegExp(cfg.folding.markers.start);
    const end = new RegExp(cfg.folding.markers.end);
    assert.ok(start.test('            MAC SLEEP'));
    assert.ok(start.test('.proc main'));
    assert.ok(start.test('\t.if FOO'));
    assert.ok(end.test('            ENDM'));
    assert.ok(end.test('.endproc'));
    assert.ok(!start.test('\tlda #0'));
  });
});
