import assert from "assert";
import { describe, it } from "mocha";
import { IDE_BASE_URL, githubReadme, ideLink } from "../../src/common/links";
import { parseReadmeBadge } from "../../src/common/detect";

describe('links', () => {
  it('points at the IDE under /latest/', () => {
    assert.strictEqual(IDE_BASE_URL, 'https://8bitworkshop.com/latest/');
    // the trailing slash matters: /latest is a 404
    assert.ok(IDE_BASE_URL.endsWith('/latest/'));
  });

  it('builds IDE links', () => {
    assert.strictEqual(ideLink({ platform: 'nes', file: 'game.c' }),
      'https://8bitworkshop.com/latest/?platform=nes&file=game.c');
    assert.strictEqual(ideLink({ platform: 'nes', file: 'src/my game.c' }),
      'https://8bitworkshop.com/latest/?platform=nes&file=src%2Fmy%20game.c');
    assert.strictEqual(ideLink({ platform: 'nes', file: undefined }),
      'https://8bitworkshop.com/latest/?platform=nes');
    assert.strictEqual(ideLink({}), 'https://8bitworkshop.com/latest/');
  });

  it('writes a README badge the detector can read', () => {
    var readme = githubReadme('my-game', 'nes', 'https://github.com/me/my-game', 'game.c');
    assert.ok(readme.includes('https://8bitworkshop.com/latest/?platform=nes&githubURL=https%3A%2F%2Fgithub.com%2Fme%2Fmy-game&file=game.c'), readme);
    assert.deepStrictEqual(parseReadmeBadge(readme), { platform: 'nes', mainFile: 'game.c' });
  });
});
