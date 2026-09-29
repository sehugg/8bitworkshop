import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { launcherFiles, projectReadme, writeLauncher } from '../src/terminalcli';
import { parseReadmeBadge } from '../../src/common/detect';

describe('terminalcli', () => {
  var opts = { node: "/Apps/Code's Helper", script: '/ext/out/8bws.js', env: { EIGHTBITWORKSHOP_TOOLCHAINS: '/store/toolchains' } };

  it('quotes paths in the shell launcher', () => {
    var files = launcherFiles(opts, 'darwin');
    assert.deepStrictEqual(files.map(f => f.name), ['8bws']);
    var sh = files[0].text;
    assert.match(sh, /^#!\/bin\/sh\n/);
    assert.ok(sh.includes(`export ELECTRON_RUN_AS_NODE='1'`));
    assert.ok(sh.includes(`export EIGHTBITWORKSHOP_TOOLCHAINS='/store/toolchains'`));
    assert.ok(sh.includes(`exec '/Apps/Code'\\''s Helper' '/ext/out/8bws.js' "$@"`));
  });

  it('adds a .cmd launcher on Windows', () => {
    var cmd = launcherFiles(opts, 'win32').find(f => f.name === '8bws.cmd');
    assert.ok(cmd);
    assert.ok(cmd.text.includes(`"/Apps/Code's Helper" "/ext/out/8bws.js" %*`));
    assert.ok(cmd.text.includes('set "ELECTRON_RUN_AS_NODE=1"'));
  });

  it('writes an executable launcher, rewriting it when paths change', () => {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), '8bws-launcher-'));
    try {
      writeLauncher(dir, opts, 'linux');
      var file = path.join(dir, '8bws');
      assert.ok(fs.statSync(file).mode & 0o100);
      writeLauncher(dir, { ...opts, script: '/ext2/out/8bws.js' }, 'linux');
      assert.ok(fs.readFileSync(file, 'utf-8').includes('/ext2/out/8bws.js'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes a README that detection reads', () => {
    var readme = projectReadme('my-game', { id: 'nes', name: 'NES', romext: '.nes' }, 'game.c');
    assert.deepStrictEqual(parseReadmeBadge(readme), { platform: 'nes', mainFile: 'game.c' });
    assert.ok(readme.includes('8bws build game.c -o game.nes'));
    assert.ok(projectReadme('x', { id: 'c64', name: 'C64' }, 'a.c').includes('-o a.bin'));
  });
});
