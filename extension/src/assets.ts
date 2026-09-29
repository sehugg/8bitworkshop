// assets - downloads the toolchain packs listed in out/assets.json on first
// use, checks their hashes, and unpacks them into one asset root (the layout
// of the repo: src/worker/..., presets/). No vscode import, so tests can
// drive it; extension.ts shows the progress.

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { AssetManifest, PackInfo, readPack } from './assetpacks';

/** Reports download progress: bytes so far of `total`. */
/** The 8bitworkshop asset servers, tried in order after 8bitworkshop.assetUrl. */
export const ASSET_URLS = ['https://sehugg.github.io/8bitworkshop/vscode/', 'https://8bitworkshop.com/vscode/'];

export type ProgressFn = (pack: string, received: number, total: number) => void;

export class AssetStore {
  private pending = new Map<string, Promise<void>>();

  /**
   * @param cacheDir where asset roots live, one per base pack
   * @param baseUrls asset servers, tried in order (http(s):, file: or a path)
   */
  constructor(
    readonly cacheDir: string,
    readonly manifest: AssetManifest,
    readonly baseUrls: string[],
    readonly log: (msg: string) => void = () => { }) { }

  /** The asset root. Keyed by the base pack, so a new build starts fresh. */
  get root(): string {
    return path.join(this.cacheDir, this.info('base').sha256.slice(0, 12));
  }

  private info(pack: string): PackInfo {
    var info = this.manifest.packs[pack];
    if (!info) throw new Error(`No toolchain pack "${pack}" in this build of the extension.`);
    return info;
  }

  private marker(pack: string): string {
    return path.join(this.root, '.packs', `${pack}-${this.info(pack).sha256}`);
  }

  has(pack: string): boolean {
    return fs.existsSync(this.marker(pack));
  }

  /** Download and unpack any of `packs` not yet installed; returns the root. */
  async ensure(packs: string[], progress?: ProgressFn): Promise<string> {
    for (var pack of packs) {
      if (this.has(pack)) continue;
      var p = this.pending.get(pack);
      if (!p) {
        p = this.install(pack, progress).finally(() => this.pending.delete(pack));
        this.pending.set(pack, p);
      }
      await p;
    }
    return this.root;
  }

  private async install(pack: string, progress?: ProgressFn) {
    var info = this.info(pack);
    var data = await this.download(info, (n, total) => progress?.(pack, n, total));
    var files = await readPack(data);
    var root = this.root;
    // unpack straight into the root: the marker, written last, is what counts,
    // so an interrupted install just runs again
    for (var f of files) {
      var dest = path.resolve(root, f.path);
      if (!dest.startsWith(root + path.sep)) throw new Error(`Bad path in ${info.file}: ${f.path}`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, f.data);
    }
    var count = files.length;
    fs.mkdirSync(path.dirname(this.marker(pack)), { recursive: true });
    fs.writeFileSync(this.marker(pack), '');
    this.log(`Installed toolchain pack ${pack} (${count} files) in ${root}`);
    if (pack === 'base') this.removeStale();
  }

  /** Fetch a pack from the first server that has it with the right hash. */
  private async download(info: PackInfo, progress: (n: number, total: number) => void): Promise<Uint8Array> {
    var errors: string[] = [];
    for (var base of this.baseUrls) {
      var url = joinUrl(base, info.file);
      try {
        this.log(`Downloading ${url}`);
        var data = await fetchBytes(url, info.size, progress);
        var sha256 = createHash('sha256').update(data).digest('hex');
        if (sha256 !== info.sha256) throw new Error(`hash mismatch (got ${sha256.slice(0, 12)})`);
        return data;
      } catch (e) {
        errors.push(`${url}: ${e && e.message || e}`);
        this.log(`  failed: ${e && e.message || e}`);
      }
    }
    throw new Error(`Cannot download toolchain pack ${info.file}. ` + errors.join('; '));
  }

  /** Delete asset roots from older builds of the extension. */
  private removeStale() {
    var keep = path.basename(this.root);
    for (var d of fs.readdirSync(this.cacheDir)) {
      if (d === keep || !/^[0-9a-f]{12}$/.test(d)) continue;
      try {
        fs.rmSync(path.join(this.cacheDir, d), { recursive: true, force: true });
        this.log(`Removed old toolchains ${d}`);
      } catch (e) {
        this.log(`Cannot remove old toolchains ${d}: ${e}`);
      }
    }
  }
}

function joinUrl(base: string, file: string): string {
  return base.endsWith('/') ? base + file : base + '/' + file;
}

async function fetchBytes(url: string, size: number, progress: (n: number, total: number) => void): Promise<Uint8Array> {
  if (!/^https?:/i.test(url)) {
    var file = url.startsWith('file:') ? new URL(url) : url;
    var buf = new Uint8Array(await fs.promises.readFile(file));
    progress(buf.length, size);
    return buf;
  }
  // the bytes as stored: fetch would decode a .br served as Content-Encoding: br
  var res = await fetch(url, { headers: { 'Accept-Encoding': 'identity' } });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  var total = Number(res.headers.get('content-length')) || size;
  var chunks: Uint8Array[] = [];
  var received = 0;
  var reader = res.body.getReader();
  for (; ;) {
    var { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    progress(received, total);
  }
  var out = new Uint8Array(received);
  var ofs = 0;
  for (var c of chunks) {
    out.set(c, ofs);
    ofs += c.length;
  }
  return out;
}
