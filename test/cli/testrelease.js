"use strict";

var assert = require('assert');

// Plain .mjs helpers so the release script and these tests share one copy.
var release;

describe('Release helpers', function () {
  before(async function () {
    release = await import('../../scripts/release-lib.mjs');
  });

  it('should bump patch, minor, and major versions', function () {
    assert.strictEqual(release.bumpVersion('1.2.3', 'patch'), '1.2.4');
    assert.strictEqual(release.bumpVersion('1.2.3', 'minor'), '1.3.0');
    assert.strictEqual(release.bumpVersion('1.2.3', 'major'), '2.0.0');
  });

  it('should accept an explicit version, including the current one', function () {
    assert.strictEqual(release.bumpVersion('1.2.3', '0.2.0'), '0.2.0');
    assert.strictEqual(release.bumpVersion('1.2.3', '1.2.3'), '1.2.3');
  });

  it('should reject unknown bumps and malformed versions', function () {
    assert.throws(() => release.bumpVersion('1.2.3', 'huge'), /unknown bump/);
    assert.throws(() => release.bumpVersion('1.2', 'patch'), /not x\.y\.z/);
  });

  it('should move Unreleased entries under the new version', function () {
    var changelog = '## [Unreleased]\n\n### Added\n- thing\n';
    assert.strictEqual(
      release.releaseChangelog(changelog, '1.0.0', '2026-01-02'),
      '## [Unreleased]\n\n## [1.0.0] - 2026-01-02\n\n### Added\n- thing\n');
  });

  it('should keep already-released sections intact', function () {
    var changelog = '## [Unreleased]\n\n### Added\n- thing\n\n## [0.1.0] - 2025-01-01\n\n- old\n';
    assert.strictEqual(
      release.releaseChangelog(changelog, '1.0.0', '2026-01-02'),
      '## [Unreleased]\n\n## [1.0.0] - 2026-01-02\n\n### Added\n- thing\n\n## [0.1.0] - 2025-01-01\n\n- old\n');
  });

  it('should handle the older "version (unreleased)" heading', function () {
    var changelog = '# Changelog\n\n## 4.0.0 (unreleased)\n\n### Added\n- thing\n';
    assert.strictEqual(
      release.releaseChangelog(changelog, '4.0.1', '2026-01-02'),
      '# Changelog\n\n## [Unreleased]\n\n## [4.0.1] - 2026-01-02\n\n### Added\n- thing\n');
  });

  it('should add an Unreleased section when the changelog has none', function () {
    assert.ok(
      release.releaseChangelog('# Changelog\n', '1.0.0', '2026-01-02')
        .includes('## [Unreleased]\n\n## [1.0.0] - 2026-01-02\n'));
  });

  it('should format a local date as YYYY-MM-DD', function () {
    assert.strictEqual(release.today(new Date(2026, 0, 2)), '2026-01-02');
  });
});
