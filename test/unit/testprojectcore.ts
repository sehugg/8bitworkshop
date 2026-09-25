import assert from "assert";
import { describe, it } from "mocha";
import { FileProvider, buildWorkerMessage, candidatePaths, mergeSegments, resolveDependencies } from "../../src/common/projectcore";
import { getToolForPlatform } from "../../src/common/toolselect";
import { FileData } from "../../src/common/workertypes";

class MemFiles implements FileProvider {
  reads: string[] = [];
  constructor(readonly files: { [path: string]: FileData }) { }
  async readFile(path: string) {
    this.reads.push(path);
    return this.files[path] ?? null;
  }
}

const c64tool = (fn: string) => getToolForPlatform('c64', fn);

function resolve(files: { [path: string]: FileData }, mainPath: string, tool = c64tool) {
  return resolveDependencies(new MemFiles(files), mainPath, files[mainPath] as string, 'c64', tool);
}

describe('projectcore.resolveDependencies', () => {

  it('should follow includes of includes, main file deps first', async () => {
    const deps = await resolve({
      'main.c': '#include "a.h"\n#include "b.h"\n',
      'a.h': '#include "nested.h"\n',
      'b.h': '',
      'nested.h': '',
    }, 'main.c');
    assert.deepStrictEqual(deps.map((d) => d.filename), ['a.h', 'b.h', 'nested.h']);
  });

  it('should send each file once', async () => {
    const deps = await resolve({
      'main.c': '#include "a.h"\n#include "a.h"\n#include "b.h"\n',
      'a.h': '#include "b.h"\n#include "main.c"\n',
      'b.h': '#include "a.h"\n',
    }, 'main.c');
    assert.deepStrictEqual(deps.map((d) => d.filename), ['a.h', 'b.h']);
  });

  it('should mark linked files and skip missing ones', async () => {
    const deps = await resolve({
      'main.c': '//#link "lib.s"\n//#link "gone.s"\n#include "a.h"\n',
      'a.h': '',
      'lib.s': '',
    }, 'main.c');
    assert.deepStrictEqual(deps.map((d) => [d.filename, d.link]), [['a.h', false], ['lib.s', true]]);
  });

  it('should prefer the file in the main file folder', async () => {
    const deps = await resolve({
      'proj/main.c': '#include "x.h"\n',
      'proj/x.h': 'local',
      'x.h': 'preset',
    }, 'proj/main.c');
    assert.deepStrictEqual(deps.map((d) => [d.path, d.filename, d.data]), [['proj/x.h', 'x.h', 'local']]);
  });

  it('should fall back to the bare name', async () => {
    const deps = await resolve({
      'proj/main.c': '#include "x.h"\n',
      'x.h': 'preset',
    }, 'proj/main.c');
    assert.deepStrictEqual(deps.map((d) => [d.path, d.filename]), [['x.h', 'x.h']]);
  });

  it('should not look in the "local" folder', () => {
    assert.deepStrictEqual(candidatePaths('x.h', 'local/main.c'), ['x.h']);
    assert.deepStrictEqual(candidatePaths('x.h', 'main.c'), ['x.h']);
    assert.deepStrictEqual(candidatePaths('x.h', 'a/main.c'), ['a/x.h', 'x.h']);
  });
});

describe('projectcore.buildWorkerMessage', () => {

  const deps = [
    { path: 'a.h', filename: 'a.h', link: false, data: 'h' },
    { path: 'lib.s', filename: 'lib.s', link: true, data: 's' },
  ];

  it('should give each linked file its own step and tool', () => {
    const { msg, preloads, filename2path } = buildWorkerMessage(
      { mainPath: 'proj/main.c', mainData: 'm', platformId: 'c64', getToolForFilename: c64tool }, deps);
    assert.deepStrictEqual(msg.updates.map((u) => u.path), ['main.c', 'a.h', 'lib.s']);
    assert.deepStrictEqual(msg.buildsteps, [
      { path: 'main.c', files: ['main.c', 'a.h'], platform: 'c64', tool: 'cc65', mainfile: true },
      { path: 'lib.s', files: ['lib.s', 'a.h'], platform: 'c64', tool: 'ca65' },
    ]);
    assert.deepStrictEqual(preloads, ['cc65', 'ca65']);
    assert.strictEqual(filename2path['main.c'], 'proj/main.c');
  });

  it('should ship linked files in the main step for remote tools', () => {
    const { msg, preloads } = buildWorkerMessage(
      { mainPath: 'main.c', mainData: 'm', platformId: 'c64', getToolForFilename: () => 'remote:llvm-mos' }, deps);
    assert.deepStrictEqual(msg.buildsteps, [
      { path: 'main.c', files: ['main.c', 'a.h', 'lib.s'], platform: 'c64', tool: 'remote:llvm-mos', mainfile: true },
    ]);
    assert.deepStrictEqual(preloads, ['remote:llvm-mos']);
  });

  it('should compile linked sources with the main file for single-pass tools', () => {
    const { msg } = buildWorkerMessage(
      { mainPath: 'main.cpp', mainData: 'm', platformId: 'c64', getToolForFilename: () => 'oscar64' },
      [{ path: 'lib.c', filename: 'lib.c', link: true, data: 'c' }]);
    assert.deepStrictEqual(msg.buildsteps, [
      { path: 'main.cpp', files: ['main.cpp', 'lib.c'], platform: 'c64', tool: 'oscar64', mainfile: true, linkfiles: ['lib.c'] },
    ]);
  });

  it('should pass build overrides and data items', () => {
    const { msg } = buildWorkerMessage({
      mainPath: 'main.c', mainData: 'm', platformId: 'c64', getToolForFilename: c64tool,
      symbols: { compile: ['X=1'] } as any, dataItems: [{ key: 'k', value: {} }],
    }, []);
    assert.deepStrictEqual(msg.buildsteps[0].symbols, { compile: ['X=1'] });
    assert.deepStrictEqual(msg.setitems, [{ key: 'k', value: {} }]);
  });
});

describe('projectcore.mergeSegments', () => {
  it('should tag and sort native and linker segments', () => {
    const segs = mergeSegments(
      [{ name: 'RAM', start: 0, size: 0x800, type: 'ram' }],
      [{ name: 'CODE', start: 0x8000, size: 0x100, type: 'rom' }, { name: 'ZP', start: 0x80, size: 0x10, type: 'ram' }]);
    assert.deepStrictEqual(segs.map((s) => [s.name, s.source]), [['RAM', 'native'], ['ZP', 'linker'], ['CODE', 'linker']]);
    assert.deepStrictEqual(mergeSegments(null, null), []);
  });
});
