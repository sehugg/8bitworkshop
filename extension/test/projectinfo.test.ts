import * as assert from 'assert';
import * as path from 'path';
import { FolderInfo, Project, isOwnExtension, projectFor, resolveRunTarget } from '../src/projectinfo';
import { BuildReason, BuildScheduler, Clock } from '../src/autobuild';

const WS = path.resolve('/work/game');
const at = (...p: string[]) => path.join(WS, ...p);

describe('projectFor', function () {
  var folder: FolderInfo = {
    path: WS,
    settings: { platform: 'nes', mainFile: 'src/main.c' },
    folders: {
      'tests': { platform: 'nes' },
      'tests/c64': { platform: 'c64', mainFile: 'demo.c', tool: 'cc65' },
    },
  };

  it('uses the workspace settings, rooted at the main file', function () {
    var p = projectFor(at('src/util.c'), { folders: [folder] });
    assert.equal(p.origin, 'settings');
    assert.equal(p.platform, 'nes');
    assert.equal(p.mainFile, at('src/main.c'));
    assert.equal(p.root, at('src'));
    assert.equal(p.scope, WS);
  });

  it('prefers the most specific folders entry', function () {
    var p = projectFor(at('tests/c64/demo.c'), { folders: [folder] });
    assert.equal(p.origin, 'folders');
    assert.equal(p.platform, 'c64');
    assert.equal(p.folderKey, 'tests/c64');
    assert.equal(p.tool, 'cc65');
    var q = projectFor(at('tests/scroll.c'), { folders: [folder] });
    assert.equal(q.folderKey, 'tests');
    assert.equal(q.mainFile, undefined);
  });

  it('uses a README badge when there are no settings', function () {
    var p = projectFor(at('game.dasm'), { folders: [{ path: WS, settings: {}, readme: { platform: 'vcs', mainFile: 'game.dasm' } }] });
    assert.equal(p.origin, 'readme');
    assert.equal(p.platform, 'vcs');
  });

  it('owns nothing outside its folders', function () {
    assert.equal(projectFor('/elsewhere/main.c', { folders: [folder] }), undefined);
    assert.equal(projectFor(at('main.c'), { folders: [{ path: WS, settings: {} }] }), undefined);
  });

  it('uses a window choice, then the last build', function () {
    var w: Project = { scope: '/tmp/x', root: '/tmp/x', platform: 'nes', mainFile: '/tmp/x/game.s', origin: 'window' };
    assert.equal(projectFor('/tmp/x/game.s', { folders: [], window: [w] }), w);
    var b = projectFor('/lib/util.h', { folders: [folder], builds: [{ project: w, paths: ['/lib/util.h'] }] });
    assert.equal(b, w);
  });

  it('knows which extensions are only ours', function () {
    assert.ok(isOwnExtension('game.dasm'));
    assert.ok(isOwnExtension('game.ca65'));
    assert.ok(!isOwnExtension('game.c'));
    assert.ok(!isOwnExtension('game.s'));
    assert.ok(!isOwnExtension('notes.txt'));
  });
});

describe('resolveRunTarget', function () {
  var project: Project = { scope: WS, root: WS, platform: 'nes', mainFile: at('game.c'), origin: 'settings' };
  var noDeps = () => false;

  it('runs the main file by default, whatever is active', function () {
    assert.equal(resolveRunTarget(project, undefined, at('sprites.c'), undefined, noDeps), at('game.c'));
  });

  it('runs a chosen file', function () {
    assert.equal(resolveRunTarget(project, 'test_scroll.c', at('game.c'), undefined, noDeps), at('test_scroll.c'));
  });

  it('follows the editor, skipping headers and dependencies', function () {
    var deps = (f: string) => f === at('sprites.c');
    assert.equal(resolveRunTarget(project, 'follow', at('level2.c'), at('game.c'), deps), at('level2.c'));
    assert.equal(resolveRunTarget(project, 'follow', at('sprites.c'), at('level2.c'), deps), at('level2.c'));
    assert.equal(resolveRunTarget(project, 'follow', at('game.h'), undefined, deps), at('game.c'));
  });

  it('follows the editor in a directory of programs', function () {
    var dir: Project = { ...project, mainFile: undefined };
    assert.equal(resolveRunTarget(dir, undefined, at('hello.c'), undefined, noDeps), at('hello.c'));
    assert.equal(resolveRunTarget(dir, undefined, '/elsewhere/x.c', at('hello.c'), noDeps), at('hello.c'));
  });
});

/** A clock tests advance by hand. */
class FakeClock implements Clock {
  t = 0;
  timers: { at: number, fn: () => void, id: number }[] = [];
  nextId = 1;
  now() { return this.t; }
  setTimeout(fn: () => void, ms: number) {
    var id = this.nextId++;
    this.timers.push({ at: this.t + ms, fn, id });
    return id;
  }
  clearTimeout(id: any) { this.timers = this.timers.filter(t => t.id !== id); }
  async advance(ms: number) {
    var end = this.t + ms;
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at);
      var next = this.timers[0];
      if (!next || next.at > end) break;
      this.timers.shift();
      this.t = next.at;
      next.fn();
      await flush();
    }
    this.t = end;
    await flush();
  }
}

const flush = () => new Promise(r => setImmediate(r));

describe('BuildScheduler', function () {
  function setup(buildMs = 50) {
    var clock = new FakeClock();
    var builds: BuildReason[] = [];
    var finish: (() => void) | null = null;
    var s = new BuildScheduler(reason => {
      builds.push(reason);
      return new Promise<void>(resolve => {
        finish = () => { clock.t += buildMs; finish = null; resolve(); };
      });
    }, { clock });
    return { clock, builds, s, done: async () => { finish?.(); await flush(); } };
  }

  it('builds once after a burst of typing', async function () {
    var { clock, builds, s, done } = setup();
    for (var i = 0; i < 5; i++) { s.changed(); await clock.advance(50); }
    assert.deepEqual(builds, []);
    await clock.advance(300);
    assert.deepEqual(builds, ['type']);
    await done();
    assert.ok(!s.busy);
  });

  it('builds once more for changes during a build', async function () {
    var { clock, builds, s, done } = setup();
    s.changed();
    await clock.advance(300);
    assert.deepEqual(builds, ['type']);
    s.changed(); await clock.advance(300);
    s.changed(); await clock.advance(300);
    assert.deepEqual(builds, ['type']);
    await done();
    assert.deepEqual(builds, ['type', 'type']);
    await done();
    assert.deepEqual(builds, ['type', 'type']);
  });

  it('builds at once on save, and a pending save wins over typing', async function () {
    var { clock, builds, s, done } = setup();
    s.now('save');
    assert.deepEqual(builds, ['save']);
    s.changed(); await clock.advance(300);
    s.now('save');
    await done();
    assert.deepEqual(builds, ['save', 'save']);
  });

  it('waits longer after slow builds', async function () {
    var { clock, builds, s, done } = setup(2000);
    s.now('save');
    await done();
    assert.equal(s.lastBuildMs, 2000);
    assert.equal(s.delayMs, 4000);
    s.changed();
    await clock.advance(3000);
    assert.deepEqual(builds, ['save']);
    await clock.advance(1000);
    assert.deepEqual(builds, ['save', 'type']);
  });
});
