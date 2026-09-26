import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { clangArgs, clangConfig, extractHeaders, patchHeaderForClang } from '../src/cheaders';

const WORKER = path.resolve(__dirname, '../../../src/worker');
const DIRS = { headerDir: '/h', shimDir: '/shims', sourceDir: '/src' };

describe('patchHeaderForClang', function () {
  it('turns cc65 void arrays into byte arrays', function () {
    assert.equal(patchHeaderForClang('cc65', 'extern void c64_ram_emd[];'), 'extern unsigned char c64_ram_emd[];');
    assert.equal(patchHeaderForClang('cc65', 'extern const void joy_static_stddrv[];'),
      'extern const unsigned char joy_static_stddrv[];');
    assert.equal(patchHeaderForClang('cc65', 'void __fastcall__ f(void* p);'), 'void __fastcall__ f(void* p);');
  });

  it('parenthesizes SDCC __at and drops inline assembly', function () {
    assert.equal(patchHeaderForClang('sdcc', 'static volatile __sfr __at 0xbe port;'),
      'static volatile __sfr __at(0xbe) port;');
    assert.equal(patchHeaderForClang('sdcc', 'void f(void) {\n__asm\n  ld a,#1\n__endasm;\n}'),
      'void f(void) {\n;\n}');
    assert.equal(patchHeaderForClang('sdcc', '__asm__("di");'), '__asm__("di");');
  });
});

describe('clangConfig', function () {
  it('passes cc65 the platform defines and C89 with unsigned char', function () {
    const c = clangConfig('cc65', 'c64', DIRS)!;
    assert.deepEqual(c.defines, ['__CC65__', '__8BITWORKSHOP__', '__CBM__', '__C64__']);
    assert.equal(c.std, 'gnu89');
    assert.equal(c.target, 'msp430');
    assert.ok(clangArgs(c).includes('-funsigned-char'));
    assert.equal(c.forcedInclude, path.join('/shims', 'cc65.h'));
  });

  it('reads -D and -I from extra_preproc_args', function () {
    const c = clangConfig('sdcc', 'msx-libcv', DIRS)!;
    assert.ok(c.defines.includes('CV_MSX'));
    assert.ok(c.defines.includes('__SDCC_z80'));
    assert.ok(c.includeDirs.includes(path.join('/h', 'lib')));
    const coleco = clangConfig('sdcc', 'coleco', DIRS)!;
    assert.ok(coleco.includeDirs.includes('/h/include/coleco'));
  });

  it('uses gbz80 defines on the Game Boy', function () {
    const c = clangConfig('sdcc', 'gb', DIRS)!;
    assert.ok(c.defines.includes('__SDCC_gbz80'));
    assert.ok(!c.defines.includes('__SDCC_z80'));
  });

  it('has nothing for other tools', function () {
    assert.equal(clangConfig('dasm', 'vcs', DIRS), undefined);
  });
});

describe('extractHeaders', function () {
  it('writes patched package and lib headers', function () {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cheaders-'));
    try {
      const files = extractHeaders(WORKER, 'cc65', 'c64', out);
      assert.ok(files.some((f) => f.endsWith(path.join('include', 'c64.h'))));
      const c64 = fs.readFileSync(path.join(out, 'include', 'c64.h'), 'latin1');
      assert.ok(!/extern void \w+\[\]/.test(c64));
      const lib = extractHeaders(WORKER, 'sdcc', 'msx-libcv', out);
      assert.ok(lib.some((f) => f.endsWith(path.join('lib', 'cv.h'))));
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});
