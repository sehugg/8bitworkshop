import assert from "assert";
import { describe, it } from "mocha";
import * as fs from "fs";

// .gitmodules lives at the repo root, which is the cwd for `npm test`.
const GITMODULES = '.gitmodules';

interface Submodule { name: string, path: string, url: string }

function parseGitmodules(text: string): Submodule[] {
  var out: Submodule[] = [];
  var cur: any = null;
  for (var line of text.split('\n')) {
    var m;
    if ((m = line.match(/^\s*\[\s*submodule\s+"([^"]+)"\s*\]/))) {
      cur = { name: m[1] };
      out.push(cur);
    } else if (cur && (m = line.match(/^\s*(\w+)\s*=\s*(.*?)\s*$/))) {
      cur[m[1]] = m[2];
    }
  }
  return out;
}

// git resolves a relative URL ("./chips") against the superproject's remote,
// so "./chips" in a repo hosted at github.com/org/repo becomes
// github.com/org/repo/chips -- a 404 that breaks every CI clone.
function isRelativeURL(url: string) {
  return url.startsWith('./') || url.startsWith('../') || !/^[a-z][a-z0-9+.-]*:\/\/|^[^@\/]+@[^:\/]+:./i.test(url);
}

describe('submodules', () => {
  it('.gitmodules exists and lists submodules', function () {
    if (!fs.existsSync(GITMODULES)) this.skip();
    var subs = parseGitmodules(fs.readFileSync(GITMODULES, 'utf8'));
    assert.ok(subs.length > 0, 'no submodules parsed from .gitmodules');
  });

  it('uses absolute URLs that do not depend on the superproject remote', function () {
    if (!fs.existsSync(GITMODULES)) this.skip();
    var subs = parseGitmodules(fs.readFileSync(GITMODULES, 'utf8'));
    for (var sub of subs) {
      assert.ok(sub.path, `${sub.name}: missing path`);
      assert.ok(sub.url, `${sub.name}: missing url`);
      assert.ok(!isRelativeURL(sub.url),
        `${sub.name}: relative url "${sub.url}" resolves against the superproject remote and breaks CI; use e.g. https://github.com/8bitworkshop/${sub.name}`);
    }
  });
});
