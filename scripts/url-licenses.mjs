#!/usr/bin/env node
// Read URLs out of a Markdown file (default: README.md), look up the license
// for each, and annotate the line with `(SPDX)`. It can also assemble a
// THIRD-PARTY-NOTICES file from the README's Dependencies section.
//
//   node scripts/url-licenses.mjs                 # dry run, show proposed changes
//   node scripts/url-licenses.mjs --write         # update the file in place
//   node scripts/url-licenses.mjs --file README.md --force
//   node scripts/url-licenses.mjs --verbose
//
//   node scripts/url-licenses.mjs --notices       # write extension/THIRD-PARTY-NOTICES.md
//   node scripts/url-licenses.mjs --notices out.md --reuse --write
//   node scripts/url-licenses.mjs --notices --vscode --write
//
// --vscode leaves out dependencies the VS Code extension does not bundle
// (the tools in extension/src/assetpacks.ts UNREVIEWED_TOOLS).
//
// License sources, in order:
//   1. GitHub API /repos/{owner}/{repo}/license  (accurate SPDX id)
//   2. Scrape the web page for common license names / grant text
// Results are cached in scripts/.url-license-cache.json so reruns are cheap
// and we don't hammer upstream sites. Set GITHUB_TOKEN (or
// TEST8BIT_GITHUB_TOKEN) to raise the GitHub rate limit.
//
// Only lines shaped like `* <raw-url>` or `* <raw-url> (existing)` are
// touched; existing annotations are left alone unless --force is given.
//
// --notices collects the components and the white-listed SPDX ids from the
// README's Dependencies section and writes one document with a component list
// and each license's full text. License texts come from, in order:
//   * a local LICENSE file (repo, extension/, the submodules named in
//     .gitmodules, and --compilers)
//   * LICENSES/<id>.txt, as written by `reuse download`
//   * `reuse download <id>` when --reuse is given
//   * the GitHub API's license body, when --fetch is given
// An entry with no text is marked `text not found` so it is easy to review.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt;
};

const file = path.resolve(root, opt('--file', 'README.md'));
const write = has('--write');
const force = has('--force');
const verbose = has('--verbose');
const cachePath = path.resolve(root, opt('--cache', 'scripts/.url-license-cache.json'));
const token = process.env.GITHUB_TOKEN || process.env.TEST8BIT_GITHUB_TOKEN || '';

// ---------------------------------------------------------------- cache
let cache = {};
try {
  cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
} catch { /* no cache yet */ }

function saveCache() {
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n');
}

// ---------------------------------------------------------------- detect
// Ordered most-specific first; first match wins.
const PATTERNS = [
  [/\bAGPL[\s-]?3|GNU Affero General Public License/i, 'AGPL-3.0'],
  [/\bLGPL[\s-]?(3|v3)?|GNU Lesser General Public License/i, 'LGPL-3.0'],
  [/\bLGPL[\s-]?(2|v2|2[.]1)?/i, 'LGPL-2.1'],
  [/\bGPL[\s-]?3|GNU General Public License.{0,40}version 3/i, 'GPL-3.0'],
  [/\bGPL[\s-]?2|GNU General Public License.{0,40}version 2/i, 'GPL-2.0'],
  [/Apache License(,|\s)+Version 2/i, 'Apache-2.0'],
  [/Mozilla Public License|\bMPL-2/i, 'MPL-2.0'],
  [/Eclipse Public License/i, 'EPL-2.0'],
  [/Creative Commons Zero|CC0/i, 'CC0-1.0'],
  [/BSD 3-Clause|BSD-3-Clause|Neither the name.{0,150}(endorse|promote)/is, 'BSD-3-Clause'],
  [/Redistribution and use in source and binary forms.{0,900}(list of conditions|disclaimer)/is, 'BSD-2-Clause'],
  [/BSD 2-Clause|BSD-2-Clause/, 'BSD-2-Clause'],
  [/zlib License|altered source versions must be plainly marked/i, 'Zlib'],
  [/Permission is hereby granted, free of charge.{0,400}without restriction/is, 'MIT'],
  [/\bMIT License\b/i, 'MIT'],
  [/\bISC License\b|Permission to use, copy, modify.{0,200}for any purpose/is, 'ISC'],
  [/The Unlicense|This is free and unencumbered software released into the public domain/i, 'Unlicense'],
  [/\bPublic Domain\b/i, 'Public Domain'],
];

function titleSpdx(text) {
  // The first lines name the license; check them before the patterns, since a
  // GPL-3 body mentions the Affero license and would otherwise read as AGPL.
  const head = text.slice(0, 400);
  const m = head.match(/GNU (AFFERO |LESSER )?GENERAL PUBLIC LICENSE(?:.{0,60}?version (\d))?/i);
  if (m) {
    const kind = (m[1] || '').trim().toLowerCase();
    if (kind === 'affero') return 'AGPL-3.0-only';
    if (kind === 'lesser') return m[2] === '2' ? 'LGPL-2.1-only' : 'LGPL-3.0-only';
    return m[2] === '2' ? 'GPL-2.0-only' : 'GPL-3.0-only';
  }
  return null;
}

function scrapeLicense(html) {
  // Strip scripts/styles/tags so we don't match nav menus as much as possible,
  // then flatten whitespace so license titles and grants match across lines.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
  const title = titleSpdx(text);
  if (title) return title;
  for (const [re, spdx] of PATTERNS) {
    if (re.test(text)) return spdx;
  }
  return null;
}

function githubRepo(url) {
  const m = url.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  const repo = m[2].replace(/\.git$/, '');
  // Skip non-repo github pages.
  if (['orgs', 'sponsors', 'settings', 'features', 'topics'].includes(m[1])) return null;
  return `${m[1]}/${repo}`;
}

async function fetchText(url, extraHeaders = {}) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': '8bitworkshop-license-check', ...extraHeaders },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function lookup(url) {
  if (cache[url]) return cache[url];

  if (githubRepo(url)) {
    try {
      const headers = { Accept: 'application/vnd.github+json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(
        `https://api.github.com/repos/${githubRepo(url)}/license`, { headers });
      if (res.ok) {
        const json = await res.json();
        const spdx = json?.license?.spdx_id;
        if (spdx && spdx !== 'NOASSERTION') return (cache[url] = { license: spdx, src: 'github' });
      } else if (res.status === 404) {
        return (cache[url] = { license: null, src: 'github', note: 'no license file' });
      } else if (verbose) {
        console.error(`  github api ${res.status} for ${url}`);
      }
    } catch (e) {
      if (verbose) console.error(`  github api error for ${url}: ${e.message}`);
    }
  }

  try {
    const html = await fetchText(url);
    const license = scrapeLicense(html);
    return (cache[url] = { license, src: 'scrape' });
  } catch (e) {
    return (cache[url] = { license: null, src: 'error', note: e.message });
  }
}

// ---------------------------------------------------------------- SPDX names
// Map what the README (and the GitHub API) commonly says to a name the SPDX
// license list and `reuse download` understand.
const SPDX_ALIASES = {
  'GPL-3': 'GPL-3.0-only',
  'GPL-3.0': 'GPL-3.0-only',
  'GPL-3.0+': 'GPL-3.0-or-later',
  'GPL-2': 'GPL-2.0-only',
  'GPL-2.0': 'GPL-2.0-only',
  'GPL-2.0+': 'GPL-2.0-or-later',
  'AGPL-3.0': 'AGPL-3.0-only',
  'AGPL-3': 'AGPL-3.0-only',
  'LGPL-3.0': 'LGPL-3.0-only',
  'LGPL-3': 'LGPL-3.0-only',
  'LGPL-2.1': 'LGPL-2.1-only',
  'GNU Lesser Public License Version 3': 'LGPL-3.0-only',
  'Apache 2.0': 'Apache-2.0',
  'Apache-2.0': 'Apache-2.0',
  'BSD': 'BSD-3-Clause',
  'BSD-3': 'BSD-3-Clause',
  'BSD-3-Clause': 'BSD-3-Clause',
  'BSD-2': 'BSD-2-Clause',
  'BSD-2-Clause': 'BSD-2-Clause',
  'zlib': 'Zlib',
  'Zlib': 'Zlib',
  'MIT': 'MIT',
  'ISC': 'ISC',
  'CC0-1.0': 'CC0-1.0',
  'CC0': 'CC0-1.0',
  'Artistic-2.0': 'Artistic-2.0',
  'MPL-2.0': 'MPL-2.0',
  'Public Domain': 'LicenseRef-Public-Domain',
  'public domain': 'LicenseRef-Public-Domain',
};

function canonicalSpdx(name) {
  if (!name) return null;
  const t = name.trim();
  if (SPDX_ALIASES[t]) return SPDX_ALIASES[t];
  // A bare SPDX id, e.g. "BSD-4-Clause".
  return /^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(t) ? t : null;
}

// ---------------------------------------------------------------- notices

const HOME = process.env.HOME || process.env.USERPROFILE || '';
const compilersDir = path.resolve(opt('--compilers', path.join(HOME, '8bitworkshop-compilers')));
const allowReuse = has('--reuse');
const allowFetch = has('--fetch');
const vscodeOnly = has('--vscode');

// README entries for tools the extension does not ship (UNREVIEWED_TOOLS).
const UNBUNDLED_URLS = [
  /floodgap\.com\/retrotech\/xa/,                    // xa
  /github\.com\/camsaul\/nesasm/,                    // nesasm
  /github\.com\/apple2accumulator\/merlin32/,        // merlin32
  /atjs\.mbnet\.fi\/mc6809\/Assembler\/xasm/,        // xasm
  /github\.com\/mbitsnbites\/vasm-mirror/,           // vasm
];

const noticesArg = args.indexOf('--notices');
const noticesPath = noticesArg >= 0
  ? path.resolve(root, (args[noticesArg + 1] && !args[noticesArg + 1].startsWith('--'))
    ? args[noticesArg + 1] : 'extension/THIRD-PARTY-NOTICES.md')
  : null;

const LICENSE_NAMES = [
  'LICENSE', 'LICENSE.txt', 'LICENSE.md', 'LICENSE.TXT', 'LICENCE', 'LICENCE.txt',
  'license', 'license.txt', 'license.md', 'License', 'License.txt', 'license.txt',
  'COPYING', 'COPYING.txt', 'COPYING.md', 'COPYING.LESSER', 'COPYING.LIB',
];

function normUrl(u) {
  return u.trim().replace(/\.git$/, '').replace(/\/+$/, '').toLowerCase();
}

/** `.gitmodules` in `base`: upstream URL -> local checkout path. */
function loadSubmodules(base) {
  const f = path.join(base, '.gitmodules');
  const map = {};
  if (!fs.existsSync(f)) return map;
  let cur = {};
  for (const raw of fs.readFileSync(f, 'utf8').split('\n')) {
    let m;
    if ((m = raw.match(/^\s*\[\s*submodule\s+"([^"]+)"\s*\]/))) cur = { name: m[1] };
    else if ((m = raw.match(/^\s*path\s*=\s*(.+?)\s*$/))) cur.path = m[1];
    else if ((m = raw.match(/^\s*url\s*=\s*(.+?)\s*$/))) cur.url = m[1];
    if (cur.path && cur.url) {
      map[normUrl(cur.url)] = path.join(base, cur.path);
      cur = {};
    }
  }
  return map;
}

const submodules = { ...loadSubmodules(root), ...loadSubmodules(compilersDir) };

function readLicenseFile(dir) {
  for (const name of LICENSE_NAMES) {
    const p = path.join(dir, name);
    try {
      if (fs.statSync(p).isFile()) return { path: p, text: fs.readFileSync(p, 'utf8') };
    } catch { /* not there */ }
  }
  return null;
}

/** SPDX id -> { text, source } for every local license file we can identify. */
function scanLocalLicenses() {
  const found = new Map();
  const dirs = [root, path.join(root, 'extension'), ...Object.values(submodules)];
  for (const dir of dirs) {
    const f = readLicenseFile(dir);
    if (!f) continue;
    const id = canonicalSpdx(scrapeLicense(f.text));
    if (id && !found.has(id)) {
      found.set(id, { text: f.text.trim() + '\n', source: path.relative(root, f.path) });
    }
  }
  return found;
}

/** The license of a component that is a submodule of this repo or of --compilers. */
function localLicenseFor(url) {
  const dir = submodules[normUrl(url)];
  if (!dir || !fs.existsSync(dir)) return null;
  const f = readLicenseFile(dir);
  if (!f) return null;
  return { id: canonicalSpdx(scrapeLicense(f.text)), text: f.text.trim() + '\n', source: path.relative(root, f.path) };
}

/** The components in the README's Dependencies section, grouped by heading. */
function readDependencies(md) {
  const sections = [];
  let section = null;
  for (const line of md.split('\n')) {
    let m;
    if (/^##\s+/.test(line)) section = null;
    if ((m = line.match(/^###\s+(.+?)\s*$/))) {
      section = { title: m[1], deps: [] };
      sections.push(section);
      continue;
    }
    if (!section) continue;
    if ((m = line.match(/^(\s*[*-]\s+)(https?:\/\/[^\s)]+)(\s*)(?:\(([^)]*)\))?(\s*)$/))) {
      section.deps.push({ url: m[2], license: canonicalSpdx(m[4]) });
    }
  }
  return sections.filter(s => /^(Emulators|Compilers|Assemblers|Dev Kits|Firmware)/i.test(s.title) && s.deps.length);
}

/** Friendly names for components whose URL doesn't say much. */
const NAME_OVERRIDES = {
  'https://javatari.org/': 'javatari.js',
  'https://jsnes.org/': 'jsnes',
  'https://www.mamedev.org/': 'MAME',
  'https://sdcc.sourceforge.net/': 'SDCC',
  'https://cc65.github.io/': 'cc65',
  'https://www.veripool.org/wiki/verilator': 'Verilator',
  'https://dasm-assembler.github.io/': 'DASM',
  'https://www.floodgap.com/retrotech/xa/': 'xa',
  'http://48k.ca/zmac.html': 'zmac',
  'https://bellard.org/tcc/': 'TCC',
  'https://shiru.untergrund.net/code.shtml': 'Shiru libraries',
  'http://www.colecovision.eu/ColecoVision/development/libcv.shtml': 'libcv',
  'http://www.virtualdub.org/altirra.html': 'AltirraOS (Altirra firmware)',
  'https://sourceforge.net/projects/cbios/': 'cbios',
};

function nameFor(url) {
  if (NAME_OVERRIDES[url]) return NAME_OVERRIDES[url];
  const repo = githubRepo(url);
  if (repo) return repo.split('/')[1];
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Licenses a URL can't tell us (dead pages, scraped as null, custom terms). */
const SPDX_HINTS = {
  'http://sdcc.sourceforge.net/': 'GPL-2.0-only',
  'https://www.veripool.org/wiki/verilator': 'LGPL-3.0-only',
  'http://mcpp.sourceforge.net/': 'BSD-2-Clause',
  'https://github.com/DavidKinder/Inform6': 'Artistic-2.0',
  'https://bellard.org/tcc/': 'LGPL-2.1-only',
  'https://github.com/yasm/yasm': 'BSD-2-Clause',
  'https://github.com/batari-Basic/batari-Basic': 'GPL-2.0-only',
  'https://github.com/Dialog-IF/dialog': 'BSD-2-Clause',
};

/** Components and notices the README doesn't carry. */
const MANUAL = {
  'http://www.virtualdub.org/altirra.html': {
    license: null,
    text: 'AltirraOS and Altirra BASIC are Copyright (c) 2008-2020 Avery Lee and are '
      + 'distributed under this notice:\n\n'
      + 'Copying and distribution of this file, with or without modification, are permitted '
      + 'in any medium without royalty provided the copyright notice and this notice are '
      + 'preserved. This file is offered as-is, without any warranty.',
  },
};

const EXTRA_COMPONENTS = {
  Firmware: [{
    name: 'ColecoVision minbios',
    url: 'https://github.com/sehugg/8bitworkshop/blob/master/meta/romsrc/coleco/minbios.asm',
    license: null,
    text: 'An 8 KB minimal ColecoVision BIOS assembled from minbios.asm, included with '
      + '8bitworkshop. Licensed CC0.',
  }],
};

/** License body from the GitHub API, for URLs no local file covers. */
async function githubLicenseText(url) {
  const key = `gh:${url}`;
  if (key in cache) return cache[key];
  const repo = githubRepo(url);
  if (!repo) return (cache[key] = null);
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${repo}/license`, { headers });
  if (!res.ok) return (cache[key] = null);
  const json = await res.json();
  const text = json?.content ? Buffer.from(json.content, 'base64').toString('utf8') : null;
  const id = json?.license?.spdx_id && json.license.spdx_id !== 'NOASSERTION'
    ? canonicalSpdx(json.license.spdx_id) : null;
  return (cache[key] = text ? { id, text } : null);
}

/** Resolve the full text of each license id, using every local source first. */
async function resolveLicenseTexts(ids, local) {
  const texts = new Map(local);
  // Some ids are not a document; explain them in a sentence instead.
  if (!texts.has('LicenseRef-Public-Domain')) {
    texts.set('LicenseRef-Public-Domain', {
      text: 'This work is in the public domain. There are no restrictions on its use, '
        + 'modification, or distribution.\n',
      source: 'public domain declaration',
    });
  }
  for (const id of ids) {
    if (texts.has(id)) continue;
    const f = path.join(root, 'LICENSES', `${id}.txt`);
    if (fs.existsSync(f)) {
      texts.set(id, { text: fs.readFileSync(f, 'utf8').trim() + '\n', source: path.relative(root, f) });
      continue;
    }
    if (allowReuse && /^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(id)) {
      try {
        execFileSync('reuse', ['download', id], { cwd: root, stdio: 'ignore' });
        if (fs.existsSync(f)) {
          texts.set(id, { text: fs.readFileSync(f, 'utf8').trim() + '\n', source: path.relative(root, f) });
          console.log(`+ reuse download ${id}`);
        }
      } catch { /* offline, or unknown id */ }
    }
    // The SPDX license list has a plain-text body for every standard id.
    if (!texts.has(id) && allowFetch && /^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(id)) {
      try {
        const res = await fetch(`https://raw.githubusercontent.com/spdx/license-list-data/main/text/${id}.txt`);
        const text = res.ok ? await res.text() : null;
        if (text && !/^404: Not Found/i.test(text)) {
          texts.set(id, { text: text.trim() + '\n', source: `SPDX ${id}` });
          console.log(`+ SPDX ${id}`);
        }
      } catch { /* offline */ }
    }
  }
  return texts;
}

async function generateNotices() {
  const md = fs.readFileSync(file, 'utf8');
  let sections = readDependencies(md);
  if (vscodeOnly) {
    for (const section of sections) {
      section.deps = section.deps.filter(dep => !UNBUNDLED_URLS.some(re => re.test(dep.url)));
    }
    sections = sections.filter(s => s.deps.length);
  }
  const local = scanLocalLicenses();

  // Fill in missing SPDX ids, and remember a URL that can vouch for each id.
  const ids = new Set();
  const urlForId = new Map();
  const addId = (id, url) => { ids.add(id); if (!urlForId.has(id)) urlForId.set(id, url); };
  const localCustom = new Map();  // url -> license text when there is no SPDX id
  for (const section of sections) {
    for (const dep of section.deps) {
      if (!dep.license && SPDX_HINTS[dep.url]) dep.license = SPDX_HINTS[dep.url];
      if (!dep.license) {
        const l = localLicenseFor(dep.url);
        if (l?.id) dep.license = l.id;
        else if (l) { dep.custom = true; localCustom.set(dep.url, l.text); }
      }
      if (MANUAL[dep.url]?.text) dep.custom = true;
      if (dep.license) addId(dep.license, dep.url);
    }
  }

  // GitHub can name the rest, when online.
  if (allowFetch || allowReuse) {
    for (const section of sections) {
      for (const dep of section.deps) {
        if (dep.license || MANUAL[dep.url]) continue;
        const info = await githubLicenseText(dep.url).catch(() => null);
        if (info?.id) { dep.license = info.id; addId(info.id, dep.url); }
        else if (info?.text && !localCustom.has(dep.url)) { dep.custom = true; localCustom.set(dep.url, info.text.trim() + '\n'); }
      }
    }
  }

  const texts = await resolveLicenseTexts(ids, local);

  // No text yet? Try the GitHub body of a component that needs this license.
  if (allowFetch) {
    for (const id of ids) {
      if (texts.has(id)) continue;
      for (const section of sections) {
        const dep = section.deps.find(d => d.license === id);
        if (!dep) continue;
        const info = await githubLicenseText(dep.url).catch(() => null);
        if (info?.text) { texts.set(id, { text: info.text.trim() + '\n', source: dep.url }); break; }
      }
    }
  }

  const out = [];
  out.push('# Third-Party Notices', '');
  out.push('8bitworkshop for VS Code includes the third-party components listed below.');
  out.push('The original 8bitworkshop code is licensed under GPL-3.0 (see `LICENSE`).');
  out.push('The components remain under their own licenses; the texts follow.');
  out.push('');
  out.push('For MIT, BSD, ISC, and Zlib components, each component\'s own copyright');
  out.push('notice is in its source distribution (see the component URL).');
  out.push('');
  out.push('Generated by `scripts/url-licenses.mjs --notices`. Do not edit by hand.');
  out.push('');
  out.push('## Components', '');

  for (const section of sections) {
    out.push(`### ${section.title}`, '');
    const deps = section.deps.slice();
    for (const extra of EXTRA_COMPONENTS[section.title] || []) deps.push({ ...extra, custom: true });
    for (const dep of deps) {
      const license = dep.license || (dep.custom ? 'custom (see Other notices)' : 'license not declared (see source)');
      out.push(`- **${nameFor(dep.url)}** — ${license} — <${dep.url}>`);
    }
    out.push('');
  }

  out.push('## License texts', '');
  for (const id of [...ids].sort()) {
    out.push(`### ${id}`, '');
    const t = texts.get(id);
    if (!t) {
      out.push(`_Text not found. Download it with \`reuse download ${id}\`, or see <${urlForId.get(id) || ''}>._`, '');
      continue;
    }
    out.push(`<!-- ${t.source} -->`, '');
    out.push('```');
    out.push(t.text.trimEnd());
    out.push('```', '');
  }

  const custom = [];
  for (const section of sections) {
    for (const dep of section.deps) {
      const text = MANUAL[dep.url]?.text || localCustom.get(dep.url);
      if (text) custom.push({ name: nameFor(dep.url), text });
    }
    for (const extra of EXTRA_COMPONENTS[section.title] || []) custom.push({ name: extra.name, text: extra.text });
  }
  if (custom.length) {
    out.push('## Other notices', '');
    for (const c of custom) {
      out.push(`### ${c.name}`, '', '```', c.text.trimEnd(), '```', '');
    }
  }

  const result = out.join('\n').replace(/\n{3,}/g, '\n\n');
  if (write) {
    fs.mkdirSync(path.dirname(noticesPath), { recursive: true });
    fs.writeFileSync(noticesPath, result);
    console.log(`Wrote ${path.relative(root, noticesPath)} (${ids.size} licenses)`);
  } else {
    process.stdout.write(result);
  }
  const missing = [...ids].filter(id => !texts.has(id));
  if (missing.length) console.error(`Text not found for: ${missing.join(', ')}`);
  saveCache();
}

// ---------------------------------------------------------------- annotate
// `* <url>` possibly followed by ` (annotation)` and whitespace.
const LINE_RE = /^(\s*[*-]\s+)(https?:\/\/[^\s)]+)(\s*)(?:\(([^)]*)\))?(\s*)$/;

async function annotate() {
  const original = fs.readFileSync(file, 'utf8');
  const lines = original.split('\n');
  let changed = 0;
  let checked = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LINE_RE);
    if (!m) continue;
    const [, bullet, url, gap, existing, trailing] = m;

    if (existing && !force) continue;

    checked++;
    const { license, src, note } = await lookup(url);

    if (!license) {
      console.log(`? ${url}  (${src}${note ? ': ' + note : ''})`);
      continue;
    }
    if (existing === license && !force) continue;

    const newLine = `${bullet}${url}${gap || ' '}(${license})${trailing}`;
    if (newLine !== lines[i]) {
      lines[i] = newLine;
      changed++;
      console.log(`+ ${url} -> (${license})${src === 'scrape' ? ' (scraped)' : ''}`);
    }
  }

  saveCache();

  if (write && changed) {
    fs.writeFileSync(file, lines.join('\n'));
    console.log(`\nWrote ${changed} change(s) to ${path.relative(root, file)}`);
  } else {
    console.log(`\n${changed} change(s)${write ? '' : ' (dry run, pass --write to apply)'}`);
  }
}

if (noticesPath) {
  await generateNotices();
} else {
  await annotate();
}