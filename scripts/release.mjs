#!/usr/bin/env node
/**
 * Release helper: bump the app version, move the changelog's unreleased
 * entries under the new version, commit, and tag.
 *
 *   npm run release -- patch
 *   npm run release -- minor --push
 *   npm run release -- 4.1.0 --push
 *
 * Runs the type check and test suite first (skip with --no-tests) and refuses
 * to run on a dirty (tracked) tree. `--dry-run` prints the plan and stops
 * before anything is written.
 *
 * The tag is what CI and the distro build see. The web site is deployed from
 * the `release` branch, so to publish:
 *
 *   git push origin release
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bumpVersion, releaseChangelog, today } from './release-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const push = args.includes('--push');
const skipTests = args.includes('--no-tests');
const kind = args.find((arg) => !arg.startsWith('--'));

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

if (!kind) {
  fail('usage: npm run release -- <patch|minor|major|x.y.z> [--push] [--dry-run] [--no-tests]');
}

const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit' });
const capture = (cmd, cmdArgs) =>
  execFileSync(cmd, cmdArgs, { cwd: root, encoding: 'utf8' }).trim();

// Ignore untracked scratch files (there are usually a few in this repo), but
// refuse to commit a release on top of uncommitted tracked changes. Only the
// three release files are staged below, so untracked files are never added.
if (capture('git', ['status', '--porcelain', '--untracked-files=no'])) {
  fail('working tree has uncommitted tracked changes; commit or stash first');
}
if (capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']) === 'HEAD') {
  fail('detached HEAD; check out a branch first');
}

const packagePath = join(root, 'package.json');
const packageLockPath = join(root, 'package-lock.json');
const changelogPath = join(root, 'CHANGELOG.md');
const changelog = readFileSync(changelogPath, 'utf8');
const current = JSON.parse(readFileSync(packagePath, 'utf8')).version;
const next = bumpVersion(current, kind);
const tag = `v${next}`;
const updatedChangelog = releaseChangelog(changelog, next, today());

if (capture('git', ['tag', '--list', tag])) {
  fail(`tag ${tag} already exists`);
}

if (next === current) {
  console.log(`release: releasing current version ${next} (no bump)`);
} else {
  console.log(`release: ${current} -> ${next}`);
}
console.log(`release: changelog ${updatedChangelog === changelog ? 'unchanged' : 'updated'}`);

if (dryRun) {
  console.log(`release: dry run, would commit and tag ${tag}`);
  process.exit(0);
}

if (!skipTests) {
  try {
    run('npm', ['run', 'tslint']);
    run('npm', ['test']);
  } catch {
    fail('typecheck or tests failed; nothing was bumped');
  }
}

// Bump package.json and package-lock.json. --no-git-tag-version keeps npm from
// committing/tagging, so this script controls the commit contents and message.
run('npm', ['version', next, '--no-git-tag-version', '--allow-same-version']);
writeFileSync(changelogPath, updatedChangelog);
run('git', ['add', packagePath, packageLockPath, changelogPath]);
run('git', ['commit', '-m', tag]);
run('git', ['tag', '-a', tag, '-m', tag]);

if (push) {
  run('git', ['push', '--follow-tags']);
  console.log(`release: pushed ${tag}`);
} else {
  console.log(`release: done. next:\n  git push --follow-tags\n  git push origin release  # when the release branch is ready to deploy`);
}
