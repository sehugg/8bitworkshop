/**
 * Pure helpers for the release script. Kept separate from `release.mjs` so
 * they can be unit tested without touching git or the filesystem.
 */

/**
 * Compute the next version. `kind` is `patch`, `minor`, `major`, or an
 * explicit `x.y.z`. An explicit version may equal the current one (useful for
 * the first release, where `package.json` already carries the version).
 *
 * @param {string} current
 * @param {string} kind
 * @returns {string}
 */
export function bumpVersion(current, kind) {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) {
    throw new Error(`current version "${current}" is not x.y.z`);
  }
  let [major, minor, patch] = match.slice(1).map(Number);
  switch (kind) {
    case 'major':
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor += 1;
      patch = 0;
      break;
    case 'patch':
      patch += 1;
      break;
    default:
      throw new Error(`unknown bump "${kind}" (use patch, minor, major, or x.y.z)`);
  }
  return `${major}.${minor}.${patch}`;
}

/**
 * Move the entries currently under `## [Unreleased]` under a new
 * `## [version] - date` heading, leaving an empty Unreleased section on top.
 *
 * Older entries in this repo use `## <version> (unreleased)` instead. When no
 * standard Unreleased heading is found, the first such heading is renamed and
 * an empty Unreleased section is inserted above it.
 *
 * @param {string} text changelog contents
 * @param {string} version
 * @param {string} date `YYYY-MM-DD`
 * @returns {string}
 */
export function releaseChangelog(text, version, date) {
  const heading = '## [Unreleased]';
  const released = `## [${version}] - ${date}`;
  const index = text.indexOf(heading);
  if (index !== -1) {
    // Insert after the Unreleased heading and the blank line that follows it, so
    // existing content ends up beneath the new version heading.
    let insertAt = text.indexOf('\n', index) + 1;
    if (text[insertAt] === '\n') insertAt += 1;
    return `${text.slice(0, insertAt)}${released}\n\n${text.slice(insertAt)}`;
  }
  const unreleased = /^## [^\n]*\(unreleased\)[^\n]*$/im.exec(text);
  if (unreleased) {
    const start = unreleased.index;
    const lineEnd = text.indexOf('\n', start);
    const end = lineEnd === -1 ? text.length : lineEnd + 1;
    return `${text.slice(0, start)}${heading}\n\n${released}\n${text.slice(end)}`;
  }
  return `${heading}\n\n${released}\n\n${text}`;
}

/** Local calendar date as `YYYY-MM-DD`. */
export function today(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
