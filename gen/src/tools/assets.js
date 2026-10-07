"use strict";
// assets - downloads the toolchain packs listed in out/assets.json on first
// use, checks their hashes, and unpacks them into one asset root (the layout
// of the repo: src/worker/..., presets/). No vscode import, so tests can
// drive it; extension.ts shows the progress.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetStore = exports.ASSET_URLS = void 0;
exports.defaultCacheDir = defaultCacheDir;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto_1 = require("crypto");
const assetpacks_1 = require("./assetpacks");
/** Reports download progress: bytes so far of `total`. */
/** The 8bitworkshop asset servers, tried in order. */
exports.ASSET_URLS = ['https://8bitworkshop.github.io/8bitworkshop/vscode/', 'https://8bitworkshop.com/vscode/'];
/**
 * Where the 8bws command line keeps unpacked toolchains when
 * $EIGHTBITWORKSHOP_TOOLCHAINS isn't set: the user's cache directory.
 */
function defaultCacheDir(env = process.env, platform = process.platform, home = os.homedir()) {
    if (env.EIGHTBITWORKSHOP_TOOLCHAINS)
        return env.EIGHTBITWORKSHOP_TOOLCHAINS;
    if (platform === 'win32')
        return path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), '8bitworkshop', 'Cache');
    if (platform === 'darwin')
        return path.join(home, 'Library', 'Caches', '8bitworkshop');
    return path.join(env.XDG_CACHE_HOME || path.join(home, '.cache'), '8bitworkshop');
}
class AssetStore {
    /**
     * @param cacheDir where asset roots live, one per base pack
     * @param baseUrls asset servers, tried in order (http(s):, file: or a path)
     */
    constructor(cacheDir, manifest, baseUrls, log = () => { }) {
        this.cacheDir = cacheDir;
        this.manifest = manifest;
        this.baseUrls = baseUrls;
        this.log = log;
        this.pending = new Map();
    }
    /** The asset root. Keyed by the base pack, so a new build starts fresh. */
    get root() {
        return path.join(this.cacheDir, this.info('base').sha256.slice(0, 12));
    }
    info(pack) {
        var info = this.manifest.packs[pack];
        if (!info)
            throw new Error(`No toolchain pack "${pack}" in this build of the extension.`);
        return info;
    }
    marker(pack) {
        return path.join(this.root, '.packs', `${pack}-${this.info(pack).sha256}`);
    }
    has(pack) {
        return fs.existsSync(this.marker(pack));
    }
    /** Download and unpack any of `packs` not yet installed; returns the root. */
    async ensure(packs, progress) {
        for (var pack of packs) {
            if (this.has(pack))
                continue;
            var p = this.pending.get(pack);
            if (!p) {
                p = this.install(pack, progress).finally(() => this.pending.delete(pack));
                this.pending.set(pack, p);
            }
            await p;
        }
        return this.root;
    }
    async install(pack, progress) {
        var info = this.info(pack);
        var data = await this.download(info, (n, total) => progress === null || progress === void 0 ? void 0 : progress(pack, n, total));
        var files = await (0, assetpacks_1.readPack)(data);
        var root = this.root;
        // unpack straight into the root: the marker, written last, is what counts,
        // so an interrupted install just runs again
        for (var f of files) {
            var dest = path.resolve(root, f.path);
            if (!dest.startsWith(root + path.sep))
                throw new Error(`Bad path in ${info.file}: ${f.path}`);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, f.data);
        }
        var count = files.length;
        fs.mkdirSync(path.dirname(this.marker(pack)), { recursive: true });
        fs.writeFileSync(this.marker(pack), '');
        this.log(`Installed toolchain pack ${pack} (${count} files) in ${root}`);
        if (pack === 'base')
            this.removeStale();
    }
    /** Fetch a pack from the first server that has it with the right hash. */
    async download(info, progress) {
        var errors = [];
        for (var base of this.baseUrls) {
            var url = joinUrl(base, info.file);
            try {
                this.log(`Downloading ${url}`);
                var data = await fetchBytes(url, info.size, progress);
                var sha256 = (0, crypto_1.createHash)('sha256').update(data).digest('hex');
                if (sha256 !== info.sha256)
                    throw new Error(`hash mismatch (got ${sha256.slice(0, 12)})`);
                return data;
            }
            catch (e) {
                errors.push(`${url}: ${e && e.message || e}`);
                this.log(`  failed: ${e && e.message || e}`);
            }
        }
        throw new Error(`Cannot download toolchain pack ${info.file}. ` + errors.join('; '));
    }
    /** Delete asset roots from older builds of the extension. */
    removeStale() {
        var keep = path.basename(this.root);
        for (var d of fs.readdirSync(this.cacheDir)) {
            if (d === keep || !/^[0-9a-f]{12}$/.test(d))
                continue;
            try {
                fs.rmSync(path.join(this.cacheDir, d), { recursive: true, force: true });
                this.log(`Removed old toolchains ${d}`);
            }
            catch (e) {
                this.log(`Cannot remove old toolchains ${d}: ${e}`);
            }
        }
    }
}
exports.AssetStore = AssetStore;
function joinUrl(base, file) {
    return base.endsWith('/') ? base + file : base + '/' + file;
}
async function fetchBytes(url, size, progress) {
    if (!/^https?:/i.test(url)) {
        var file = url.startsWith('file:') ? new URL(url) : url;
        var buf = new Uint8Array(await fs.promises.readFile(file));
        progress(buf.length, size);
        return buf;
    }
    // the bytes as stored: fetch would decode a .br served as Content-Encoding: br
    var res = await fetch(url, { headers: { 'Accept-Encoding': 'identity' } });
    if (!res.ok || !res.body)
        throw new Error(`HTTP ${res.status}`);
    var total = Number(res.headers.get('content-length')) || size;
    var chunks = [];
    var received = 0;
    var reader = res.body.getReader();
    for (;;) {
        var { done, value } = await reader.read();
        if (done)
            break;
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
//# sourceMappingURL=assets.js.map