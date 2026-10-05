// assetpack - packs the toolchain assets (src/worker/{wasm,fs,asmjs,lib},
// presets/) into one .tar.br per pack (see assetpacks.ts), and writes the
// manifest the extension downloads them by. Bundled by build.mjs:
//
//   node out/assetpack.js [--quality N] [rootDir] [outDir]
//
// writes <outDir>/8bitworkshop-<pack>-<ideVersion>-<hash>.tar.br and
// out/assets.json. Upload the packs to the asset server (ASSET_URLS in
// extension.ts). --quality trades size for speed: 11 (the default)
// takes minutes; 8 is nearly as small and much faster.
//
// `npm run package` packs at quality 8, which we ship; `npm run
// package:release`, `vsce-publish` and `ovsx-publish` pack at 11. `vscode:prepublish`
// only builds, so vsce never repacks the assets on its own.

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { ASSET_DIRS, ASSET_EXCLUDE, AssetManifest, BROTLI_QUALITY, EXTRA_FILES, PACKS, PackName, isUnreviewedFile, makePack, packForFile } from '../../src/tools/assetpacks';

const args = process.argv.slice(2);
const qi = args.indexOf('--quality');
const quality = qi >= 0 ? Number(args.splice(qi, 2)[1]) : BROTLI_QUALITY;
const rootDir = path.resolve(args[0] || path.join(__dirname, '../..'));
const outDir = path.resolve(args[1] || path.join(__dirname, 'assets'));
const manifestFile = path.join(__dirname, 'assets.json');

/** Tracked files under ASSET_DIRS, grouped by pack, sorted. */
export function listPackFiles(root: string): { [pack: string]: string[] } {
  var tracked = execFileSync('git', ['ls-files', '-z', '--', ...ASSET_DIRS], { cwd: root, encoding: 'utf-8', maxBuffer: 1 << 26 })
    .split('\0').filter(f => f);
  var out: { [pack: string]: string[] } = {};
  for (var pack of PACKS) out[pack] = [];
  for (var f of tracked) {
    // deleted in the work tree but not yet in the index
    if (!fs.existsSync(path.join(root, f))) continue;
    // a symlinked directory (presets/msx-libcv -> coleco) becomes a copy,
    // since Windows can't make symlinks
    for (var g of expandLink(root, f, tracked)) {
      if (!ASSET_EXCLUDE.test(g) && !isUnreviewedFile(g)) out[packForFile(g)].push(g);
    }
  }
  for (var name in EXTRA_FILES) out[name].push(...EXTRA_FILES[name].filter(f => !isUnreviewedFile(f)));
  for (var name in out) out[name].sort();
  return out;
}

/** `rel` if it's a file, or the tracked files under the directory it links to. */
function expandLink(root: string, rel: string, tracked: string[]): string[] {
  var abs = path.join(root, rel);
  if (!fs.statSync(abs).isDirectory()) return [rel];
  var target = path.relative(root, fs.realpathSync(abs)).split(path.sep).join('/') + '/';
  return tracked.filter(t => t.startsWith(target)).map(t => rel + '/' + t.slice(target.length));
}

async function main() {
  var lists = listPackFiles(rootDir);
  var ideVersion = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')).version;
  var manifest: AssetManifest = { ideVersion, packs: {} };
  fs.mkdirSync(outDir, { recursive: true });
  // compress the packs in parallel (zlib runs on the thread pool)
  await Promise.all(PACKS.map(async pack => {
    var files = lists[pack].map(f => ({ path: f, data: fs.readFileSync(path.join(rootDir, f)) }));
    var data = await makePack(files, quality);
    var sha256 = createHash('sha256').update(data).digest('hex');
    var file = `8bitworkshop-${pack}-${ideVersion}-${sha256.slice(0, 8)}.tar.br`;
    fs.writeFileSync(path.join(outDir, file), data);
    // drop packs from earlier runs, so the extension never bundles a stale one
    for (var old of fs.readdirSync(outDir)) {
      if (old !== file && old.startsWith(`8bitworkshop-${pack}-`) && old.endsWith('.tar.br')) {
        fs.rmSync(path.join(outDir, old), { force: true });
      }
    }
    manifest.packs[pack as PackName] = { file, size: data.length, sha256, count: files.length };
    var raw = files.reduce((n, f) => n + f.data.length, 0);
    console.error(`assetpack: ${pack}: ${files.length} files, ${mb(raw)} -> ${mb(data.length)} ${path.relative(process.cwd(), path.join(outDir, file))}`);
  }));
  // PACKS order, whichever finished first
  manifest.packs = Object.fromEntries(PACKS.map(p => [p, manifest.packs[p]]));
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  console.error(`assetpack: wrote ${path.relative(process.cwd(), manifestFile)}`);
}

function mb(n: number) {
  return (n / 1048576).toFixed(1) + ' MB';
}

if (require.main === module) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
