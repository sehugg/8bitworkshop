import assert from "assert";
import { describe, it } from "mocha";
import {
  TOOL_META, getToolMeta, getToolMetaForFilename, getPreloadFSName, getSkeletonName,
  getIncludePatterns, getLinkPatterns, matchDependencyPatterns
} from "../../src/common/toolmeta";
// Node-friendly worker entry point (re-exports TOOLS without Worker wiring)
import { TOOLS } from "../../src/worker/workerlib";

describe('Tool metadata registry', function () {
  it('every registry key matches its tool id', function () {
    for (let id in TOOL_META) {
      assert.strictEqual(TOOL_META[id].id, id, `TOOL_META['${id}'].id mismatch`);
    }
  });

  it('every worker build tool is registered (and vice versa)', function () {
    // worker TOOLS -> must exist in registry
    for (let id of Object.keys(TOOLS)) {
      assert.ok(TOOL_META[id], `worker TOOLS['${id}'] missing from TOOL_META`);
    }
    // registry -> must have a worker build fn, unless explicitly deferred
    // or built on a remote server (llvm-mos)
    for (let id in TOOL_META) {
      let meta = TOOL_META[id];
      if (meta.noWorkerBuild || meta.remote) continue;
      assert.ok(TOOLS[id], `TOOL_META['${id}'] missing from worker TOOLS`);
    }
  });

  it('getToolMeta strips the remote: transport prefix', function () {
    assert.strictEqual(getToolMeta('remote:llvm-mos'), TOOL_META['llvm-mos']);
    assert.strictEqual(getToolMeta('llvm-mos'), TOOL_META['llvm-mos']);
    assert.strictEqual(getToolMeta('bogus'), undefined);
  });

  it('getToolMetaForFilename finds tools by extension', function () {
    assert.ok(getToolMetaForFilename('foo.c').some(m => m.id === 'cc65'));
    assert.ok(getToolMetaForFilename('foo.s').some(m => m.id === 'ca65'));
    assert.ok(getToolMetaForFilename('foo.wiz').some(m => m.id === 'wiz'));
    assert.ok(getToolMetaForFilename('foo.ecs').some(m => m.id === 'ecs'));
    assert.ok(getToolMetaForFilename('foo.dg').some(m => m.id === 'dialog'));
    // unknown extension -> no matches
    assert.deepStrictEqual(getToolMetaForFilename('foo.xyz'), []);
  });

  it('getPreloadFSName resolves per-platform filesystems', function () {
    assert.strictEqual(getPreloadFSName('cc65', 'nes'), '65-nes');
    assert.strictEqual(getPreloadFSName('cc65', 'c64'), '65-c64');
    assert.strictEqual(getPreloadFSName('cc65', 'nonexistent'), undefined);
    assert.strictEqual(getPreloadFSName('sdcc'), 'sdcc'); // default config
    assert.strictEqual(getPreloadFSName('dasm'), undefined);
  });

  it('getSkeletonName defaults to the tool id', function () {
    assert.strictEqual(getSkeletonName('dasm'), 'dasm');
    assert.strictEqual(getSkeletonName('remote:llvm-mos'), 'llvm-mos');
  });

  it('covers the previously-scattered editor styles and help URLs', function () {
    // spot-check ids that used to live in TOOL_TO_SOURCE_STYLE / TOOL_TO_HELPURL
    for (let id of ['dasm', 'acme', 'cc65', 'ca65', 'sdcc', 'cmoc', 'zmac',
      'nesasm', 'bataribasic', 'fastbasic', 'wiz', 'silice', 'ecs', 'dialog']) {
      assert.ok(TOOL_META[id], `expected tool '${id}' in registry`);
    }
    assert.strictEqual(TOOL_META['cc65'].editorStyle, 'text/x-csrc');
    assert.strictEqual(TOOL_META['ca65'].editorStyle, '6502');
    assert.ok(TOOL_META['dasm'].helpURL);
  });

  it('include patterns exist for tools that do dependency parsing', function () {
    assert.ok(TOOL_META['cc65'].includePatterns.length > 0);
    assert.ok(TOOL_META['verilator'].includePatterns.length > 0);
    assert.ok(TOOL_META['acme'].includePatterns.length > 0);
    assert.ok(TOOL_META['dialog'].includePatterns.length > 0);
    assert.ok(TOOL_META['wiz'].includePatterns.length > 0);
  });

  it('matches include directives for the tool that builds the file', function () {
    let deps = (text: string, tool?: string, platform?: string) =>
      matchDependencyPatterns(text, getIncludePatterns(tool, platform));
    assert.deepStrictEqual(deps('#include "foo.h"\n', 'cc65'), ['foo.h']);
    assert.deepStrictEqual(deps('\t.include "foo.inc"\n', 'ca65'), ['foo.inc']);
    assert.deepStrictEqual(deps('//#resource "foo.bin"\n', 'dasm'), ['foo.bin']);
    assert.deepStrictEqual(deps('!src "foo.acme"\n', 'acme'), ['foo.acme']);
    assert.deepStrictEqual(deps('%% #include "foo.dg"\n', 'dialog'), ['foo.dg']);
    assert.deepStrictEqual(deps('  USE foo.xasm\n', 'xasm6809'), ['foo.xasm']);
    // ecs uses both its own import and the shared .include directive
    assert.deepStrictEqual(deps('.include "vcs.h"\nimport "lib.ecs"\n', 'ecs'),
      ['vcs.h', 'lib.ecs']);
    // wiz: import gets an implicit .wiz extension, embed does not
    assert.deepStrictEqual(deps('import "nes";\nembed "map.bin";\n', 'wiz'),
      ['nes.wiz', 'map.bin']);
    // verilog: .arch names a .json file
    assert.deepStrictEqual(deps('`include "hvsync.v"\n.arch mynes\n', 'verilator'),
      ['hvsync.v', 'mynes.json']);
    // unknown tool falls back to the platform
    assert.deepStrictEqual(deps('`include "hvsync.v"\n', null, 'verilog'), ['hvsync.v']);
    assert.deepStrictEqual(deps('#include "foo.h"\n', null, 'c64'), ['foo.h']);
  });

  it('matches link directives only for tools that link', function () {
    let deps = (text: string, tool?: string, platform?: string) =>
      matchDependencyPatterns(text, getLinkPatterns(tool, platform));
    assert.deepStrictEqual(deps('//#link "foo.c"\n', 'cc65'), ['foo.c']);
    assert.deepStrictEqual(deps(';#link "foo.s"\n', 'ca65'), ['foo.s']);
    assert.deepStrictEqual(deps('//#link "foo.v"\n', 'verilator'), []); // hdl tools don't link
    assert.deepStrictEqual(deps('//#link "foo.v"\n', null, 'verilog'), []);
  });

  it('parses verilog directives in .asm files built by jsasm', function () {
    // presets/verilog/test2.asm: .include "*.v" plus ".arch femto16"
    let text = '.include "cpu16.v"\n.arch femto16\n';
    let files = matchDependencyPatterns(text, getIncludePatterns('jsasm', 'verilog'));
    assert.deepStrictEqual(files, ['cpu16.v', 'femto16.json']);
    // and no shared-pattern duplicate of the .include
    assert.strictEqual(files.filter(f => f == 'cpu16.v').length, 1);
  });

  it('falls back to the platform when a tool declares no patterns', function () {
    // 'basic' has no includePatterns of its own -> platform default
    assert.deepStrictEqual(
      matchDependencyPatterns('#include "foo.h"\n', getIncludePatterns('basic', 'c64')),
      ['foo.h']);
    // an explicit empty list means "this tool has no such directives"
    assert.deepStrictEqual(getLinkPatterns('jsasm', 'verilog'), []);
  });

  it('rewinds shared global patterns between files', function () {
    // patterns are shared between tools and have the /g flag, so a stale
    // lastIndex would make the second scan miss the directive
    let pats = getIncludePatterns('cc65');
    assert.deepStrictEqual(matchDependencyPatterns('#include "a.h"\n', pats), ['a.h']);
    assert.deepStrictEqual(matchDependencyPatterns('#include "b.h"\n', pats), ['b.h']);
  });
});
