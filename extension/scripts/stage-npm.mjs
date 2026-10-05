// Stages the npm package for the 8bws command line in out/npm (or --out DIR):
// the CLI bundle with a shebang, assets.json, license files and a package.json
// whose version is the repo's. The packs themselves are not included; the CLI
// downloads them on first use (see src/cli.ts). Run `npm run build` and
// `npm run assets` first so out/8bws.js and out/assets.json are current:
//
//   node scripts/stage-npm.mjs [--out DIR]
//   cd out/npm && npm pack
import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const ext = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outIdx = process.argv.indexOf('--out');
const out = path.resolve(outIdx > 0 ? process.argv[outIdx + 1] : path.join(ext, 'out', 'npm'));
const rootPkg = JSON.parse(readFileSync(path.join(ext, '..', 'package.json'), 'utf-8'));
const manifest = JSON.parse(readFileSync(path.join(ext, 'out', 'assets.json'), 'utf-8'));
if (manifest.ideVersion !== rootPkg.version) {
  throw new Error(`out/assets.json is for ${manifest.ideVersion}, not ${rootPkg.version}: run npm run assets`);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const bundle = readFileSync(path.join(ext, 'out', '8bws.js'), 'utf-8');
writeFileSync(path.join(out, '8bws.js'), '#!/usr/bin/env node\n' + bundle.replace(/^\/\/# sourceMappingURL=.*$/m, ''));
chmodSync(path.join(out, '8bws.js'), 0o755);
copyFileSync(path.join(ext, 'out', 'assets.json'), path.join(out, 'assets.json'));
copyFileSync(path.join(ext, 'LICENSE'), path.join(out, 'LICENSE'));
copyFileSync(path.join(ext, 'THIRD-PARTY-NOTICES.md'), path.join(out, 'THIRD-PARTY-NOTICES.md'));
copyFileSync(path.join(ext, 'npm', 'README.md'), path.join(out, 'README.md'));

writeFileSync(path.join(out, 'package.json'), JSON.stringify({
  name: '8bitworkshop',
  version: rootPkg.version,
  description: 'Build and run retro-computer and arcade programs from the command line: the 8bitworkshop compilers and emulators, headless',
  keywords: ['retro', '8-bit', '6502', 'z80', 'emulator', 'assembler', 'compiler', 'nes', 'c64', 'atari'],
  bin: { '8bws': '8bws.js' },
  files: ['8bws.js', 'assets.json', 'LICENSE', 'THIRD-PARTY-NOTICES.md', 'README.md'],
  engines: { node: '>=20' },
  license: 'GPL-3.0-only',
  author: rootPkg.author,
  repository: { type: 'git', url: 'git+https://github.com/sehugg/8bitworkshop.git' },
  bugs: { url: 'https://github.com/sehugg/8bitworkshop/issues' },
  homepage: 'https://8bitworkshop.com',
}, null, 2) + '\n');
console.log(`staged ${rootPkg.name} ${rootPkg.version} in ${out}`);
